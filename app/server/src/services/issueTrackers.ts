import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  asanaState,
  findingTicket,
  issueCreateSchema,
  issueSourceKey,
  jiraState,
  linearState,
  recommendationTicket,
  secretHint,
  ticketAdf,
  ticketMarkdown,
  ticketPlain,
  trackerConnectSchema,
  TRACKER_KINDS,
  INTEGRATION_LABELS,
  type AuditFindingRow,
  type FindingForTicket,
  type IssueLinkView,
  type IssueState,
  type TicketContent,
  type TrackerKind,
} from '@seo/shared';
import { requireVerified, type OrgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { IntegrationRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { HttpError, notFound, parse } from '../lib/errors';
import { outbound, safeError, type OutResponse } from '../lib/netGuard';
import { seal, unseal } from '../lib/secretBox';
import { siteRows } from '../n8n/client';
import { integrationOf, requireSecrets, toIntegrationView, toIssueView } from './integrations';
import { loadBundle, recommend } from './recommendations';

/**
 * G4 (2026-10-17) — issue trackers: an audit finding or a recommendation becomes ONE ticket in Jira Cloud, Linear or Asana, with the
 * evidence, the example pages and the fix; the remote key is kept, its state is read back, and a second push answers the first
 * ticket. Design note: app/docs/INTEGRATIONS.md §2.
 *
 * Vendor request shapes (each one mocked from these pages in issueTrackers.test.ts):
 *  - Jira Cloud REST v3 — POST /rest/api/3/issue, GET /rest/api/3/issue/{key}?fields=status, GET /rest/api/3/project/{key},
 *    GET /rest/api/3/issue/createmeta/{project}/issuetypes; Basic auth `email:api_token`
 *    https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post
 *    https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
 *  - Linear GraphQL — POST https://api.linear.app/graphql, `Authorization: <personal API key>`, `issueCreate`, `issue(id)`, `teams`
 *    https://linear.app/developers/graphql
 *  - Asana REST — POST /api/1.0/tasks, GET /api/1.0/tasks/{gid}, GET /api/1.0/projects/{gid}; `Authorization: Bearer <PAT>`
 *    https://developers.asana.com/reference/createtask
 */

type Cfg = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

class VendorError extends HttpError {}
const vendorError = (kind: TrackerKind, res: OutResponse | null, err?: unknown): VendorError => {
  if (!res) return new VendorError(502, `${INTEGRATION_LABELS[kind]} could not be reached: ${safeError(err)}`, 'tracker_unreachable');
  let detail = '';
  try {
    const j = JSON.parse(res.text) as Record<string, unknown>;
    const msgs = [
      ...(Array.isArray(j.errorMessages) ? j.errorMessages : []),
      ...Object.values((j.errors as Record<string, unknown>) ?? {}).map((e) => (typeof e === 'string' ? e : s((e as Record<string, unknown>)?.message))),
    ].filter(Boolean);
    detail = msgs.slice(0, 3).join('; ');
  } catch {
    detail = res.text.replace(/\s+/g, ' ').slice(0, 160);
  }
  if (res.status === 401 || res.status === 403) return new VendorError(502, `${INTEGRATION_LABELS[kind]} refused the token (${res.status}${detail ? `: ${detail}` : ''}). Create a new one and connect again.`, 'tracker_refused');
  if (res.status === 404) return new VendorError(502, `${INTEGRATION_LABELS[kind]} says the project or ticket does not exist, or the token cannot see it${detail ? ` (${detail})` : ''}.`, 'tracker_not_found');
  return new VendorError(502, `${INTEGRATION_LABELS[kind]} answered ${res.status}${detail ? `: ${detail}` : ''}`, 'tracker_error');
};

async function call(kind: TrackerKind, req: Parameters<typeof outbound>[0]): Promise<Record<string, unknown>> {
  let res: OutResponse;
  try {
    res = await outbound({ timeoutMs: 15_000, maxBytes: 512 * 1024, ...req });
  } catch (err) {
    throw vendorError(kind, null, err);
  }
  if (res.status < 200 || res.status >= 300) throw vendorError(kind, res);
  try {
    const j = JSON.parse(res.text || '{}') as Record<string, unknown>;
    // GraphQL reports failures inside a 200
    if (kind === 'linear' && Array.isArray(j.errors) && j.errors.length) {
      const m = s((j.errors[0] as Record<string, unknown>)?.message);
      const auth = /auth|api key|unauthor/i.test(m);
      throw new VendorError(502, auth ? `Linear refused the API key (${m}). Create a new one and connect again.` : `Linear: ${m}`, auth ? 'tracker_refused' : 'tracker_error');
    }
    return j;
  } catch (e) {
    if (e instanceof VendorError) throw e;
    throw new VendorError(502, `${INTEGRATION_LABELS[kind]} answered something that is not JSON`, 'tracker_error');
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// the three vendors
// ---------------------------------------------------------------------------------------------------------------------------

const jiraAuth = (email: string, token: string) => ({ authorization: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'), accept: 'application/json', 'content-type': 'application/json' });
const linearHeaders = (key: string) => ({ authorization: key, 'content-type': 'application/json' });
const asanaHeaders = (pat: string) => ({ authorization: `Bearer ${pat}`, accept: 'application/json', 'content-type': 'application/json' });
const LINEAR = 'https://api.linear.app/graphql';
const ASANA = 'https://app.asana.com/api/1.0';

export interface Vendor {
  /** checks the credentials and the target, answering the settings to keep */
  verify(cfg: Cfg, secret: string): Promise<Cfg>;
  create(cfg: Cfg, secret: string, t: TicketContent): Promise<{ id: string; key: string; url: string; status: string; state: IssueState }>;
  read(cfg: Cfg, secret: string, link: { remoteId: string; remoteKey: string }): Promise<{ status: string; state: IssueState; url?: string }>;
}

export const VENDORS: Record<TrackerKind, Vendor> = {
  jira: {
    async verify(cfg, token) {
      const h = jiraAuth(s(cfg.email), token);
      const project = await call('jira', { url: `${s(cfg.siteUrl)}/rest/api/3/project/${encodeURIComponent(s(cfg.projectKey))}`, method: 'GET', headers: h });
      const types = await call('jira', { url: `${s(cfg.siteUrl)}/rest/api/3/issue/createmeta/${encodeURIComponent(s(cfg.projectKey))}/issuetypes`, method: 'GET', headers: h });
      const list = (Array.isArray(types.issueTypes) ? types.issueTypes : Array.isArray(types.values) ? types.values : []) as Record<string, unknown>[];
      const want = s(cfg.issueType).toLowerCase();
      const t = list.find((x) => s(x.name).toLowerCase() === want && x.subtask !== true);
      if (!t)
        throw new HttpError(400, `The project ${s(cfg.projectKey)} has no issue type "${s(cfg.issueType)}". It has: ${list.filter((x) => x.subtask !== true).map((x) => s(x.name)).join(', ') || 'none the token can use'}.`, 'validation', { issueType: 'Not in this project' });
      return { siteUrl: cfg.siteUrl, email: cfg.email, projectKey: cfg.projectKey, projectName: s(project.name), issueType: s(t.name), issueTypeId: s(t.id) };
    },
    async create(cfg, token, t) {
      const j = await call('jira', {
        url: `${s(cfg.siteUrl)}/rest/api/3/issue`,
        method: 'POST',
        headers: jiraAuth(s(cfg.email), token),
        body: JSON.stringify({ fields: { project: { key: s(cfg.projectKey) }, issuetype: { id: s(cfg.issueTypeId) }, summary: t.title.slice(0, 250), description: ticketAdf(t), labels: ['ascentra', 'seo'] } }),
      });
      const key = s(j.key);
      if (!key) throw new VendorError(502, 'Jira did not return the new ticket', 'tracker_error');
      return { id: s(j.id), key, url: `${s(cfg.siteUrl)}/browse/${key}`, status: 'To Do', state: 'todo' };
    },
    async read(cfg, token, link) {
      const j = await call('jira', { url: `${s(cfg.siteUrl)}/rest/api/3/issue/${encodeURIComponent(link.remoteKey || link.remoteId)}?fields=status`, method: 'GET', headers: jiraAuth(s(cfg.email), token) });
      const st = ((j.fields as Cfg)?.status ?? {}) as Cfg;
      return { status: s(st.name), state: jiraState((st.statusCategory as Cfg)?.key) };
    },
  },
  linear: {
    async verify(cfg, key) {
      const j = await call('linear', {
        url: LINEAR,
        method: 'POST',
        headers: linearHeaders(key),
        body: JSON.stringify({ query: 'query Teams($key: String!) { viewer { id name } teams(filter: { key: { eq: $key } }) { nodes { id key name } } }', variables: { key: s(cfg.teamKey) } }),
      });
      const team = (((j.data as Cfg)?.teams as Cfg)?.nodes as Cfg[] | undefined)?.[0];
      if (!team) throw new HttpError(400, `This API key cannot see a team with the key ${s(cfg.teamKey)}.`, 'validation', { teamKey: 'No such team' });
      return { teamKey: s(team.key), teamId: s(team.id), teamName: s(team.name) };
    },
    async create(cfg, key, t) {
      const j = await call('linear', {
        url: LINEAR,
        method: 'POST',
        headers: linearHeaders(key),
        body: JSON.stringify({
          query: 'mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url state { name type } } } }',
          variables: { input: { teamId: s(cfg.teamId), title: t.title.slice(0, 250), description: ticketMarkdown(t) } },
        }),
      });
      const r = ((j.data as Cfg)?.issueCreate ?? {}) as Cfg;
      const issue = (r.issue ?? {}) as Cfg;
      if (r.success !== true || !issue.id) throw new VendorError(502, 'Linear did not create the ticket', 'tracker_error');
      const st = (issue.state ?? {}) as Cfg;
      return { id: s(issue.id), key: s(issue.identifier), url: s(issue.url), status: s(st.name), state: linearState(st.type) };
    },
    async read(_cfg, key, link) {
      const j = await call('linear', {
        url: LINEAR,
        method: 'POST',
        headers: linearHeaders(key),
        body: JSON.stringify({ query: 'query Issue($id: String!) { issue(id: $id) { identifier url state { name type } } }', variables: { id: link.remoteId } }),
      });
      const issue = ((j.data as Cfg)?.issue ?? {}) as Cfg;
      const st = (issue.state ?? {}) as Cfg;
      return { status: s(st.name), state: linearState(st.type), url: s(issue.url) || undefined };
    },
  },
  asana: {
    async verify(cfg, pat) {
      const j = await call('asana', { url: `${ASANA}/projects/${encodeURIComponent(s(cfg.projectGid))}?opt_fields=name,workspace.gid,permalink_url`, method: 'GET', headers: asanaHeaders(pat) });
      const d = (j.data ?? {}) as Cfg;
      return { projectGid: cfg.projectGid, projectName: s(d.name), workspaceGid: s((d.workspace as Cfg)?.gid) };
    },
    async create(cfg, pat, t) {
      const j = await call('asana', {
        url: `${ASANA}/tasks?opt_fields=gid,permalink_url,completed`,
        method: 'POST',
        headers: asanaHeaders(pat),
        body: JSON.stringify({ data: { name: t.title.slice(0, 250), notes: ticketPlain(t), projects: [s(cfg.projectGid)] } }),
      });
      const d = (j.data ?? {}) as Cfg;
      if (!d.gid) throw new VendorError(502, 'Asana did not create the task', 'tracker_error');
      return { id: s(d.gid), key: s(d.gid), url: s(d.permalink_url), status: d.completed === true ? 'Completed' : 'Open', state: asanaState(d.completed) };
    },
    async read(_cfg, pat, link) {
      const j = await call('asana', { url: `${ASANA}/tasks/${encodeURIComponent(link.remoteId)}?opt_fields=completed,permalink_url`, method: 'GET', headers: asanaHeaders(pat) });
      const d = (j.data ?? {}) as Cfg;
      return { status: d.completed === true ? 'Completed' : 'Open', state: asanaState(d.completed), url: s(d.permalink_url) || undefined };
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------------
// connecting
// ---------------------------------------------------------------------------------------------------------------------------

const secretOf = (b: { kind: TrackerKind } & Record<string, unknown>): string => s(b.kind === 'jira' ? b.apiToken : b.kind === 'linear' ? b.apiKey : b.token);

/** Connects (or replaces) the company's tracker of that kind, after the vendor confirmed the token and the project / team. */
export async function connectTracker(org: OrgRow, user: UserRow, body: unknown) {
  const b = parse(trackerConnectSchema, body);
  requireSecrets();
  const secret = secretOf(b as never);
  const { apiToken: _t, apiKey: _k, token: _p, kind, ...cfgIn } = b as Record<string, unknown> & { kind: TrackerKind };
  const cfg = await VENDORS[kind].verify(cfgIn, secret);
  const values = {
    orgId: org.id,
    kind,
    name: INTEGRATION_LABELS[kind],
    config: cfg,
    secret: seal(secret),
    secretHint: secretHint(kind === 'linear' ? 'key' : 'token', secret),
    status: 'ok',
    lastError: '',
    lastCheckedAt: new Date(),
    createdBy: user.id,
    updatedAt: new Date(),
  };
  const existing = await db.query.integrations.findFirst({ where: and(eq(schema.integrations.orgId, org.id), eq(schema.integrations.kind, kind)) });
  const [row] = existing
    ? await db.update(schema.integrations).set(values).where(eq(schema.integrations.id, existing.id)).returning()
    : await db.insert(schema.integrations).values(values).returning();
  return toIntegrationView(row);
}

function trackerSecret(row: IntegrationRow): string {
  try {
    return s(unseal(row.secret));
  } catch {
    throw new HttpError(409, 'The stored token cannot be read any more (the server key changed). Connect the tracker again.', 'secret_unreadable');
  }
}

async function markStatus(row: IntegrationRow, err: unknown | null) {
  await db
    .update(schema.integrations)
    .set({ status: err ? 'error' : 'ok', lastError: err ? s((err as Error).message).slice(0, 300) : '', lastCheckedAt: new Date() })
    .where(eq(schema.integrations.id, row.id));
}

export async function testTracker(orgId: string, id: unknown) {
  const row = await integrationOf(orgId, id);
  if (!(TRACKER_KINDS as readonly string[]).includes(row.kind)) throw notFound('Integration not found');
  try {
    await VENDORS[row.kind as TrackerKind].verify(row.config, trackerSecret(row));
    await markStatus(row, null);
    return { ok: true, error: '' };
  } catch (e) {
    await markStatus(row, e);
    return { ok: false, error: s((e as Error).message) };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// creating a ticket
// ---------------------------------------------------------------------------------------------------------------------------

const appLink = (path: string) => `${config.appUrl}${path}`;
const parseUrls = (v: unknown): string[] => {
  try {
    const a = JSON.parse(s(v));
    return Array.isArray(a) ? a.map(s).filter((u) => /^https?:\/\//i.test(u)).slice(0, 10) : [];
  } catch {
    return [];
  }
};

/** The finding as the audit stored it, plus the "why" and the "fix" from the audit's own report when the app holds it. */
async function findingContent(org: OrgRow, site: SiteRow, auditId: string, findingKey: string): Promise<{ title: string; content: TicketContent }> {
  const rows = await siteRows<AuditFindingRow>('auditFindings', site.domain, {
    extra: [
      { columnName: 'audit_id', condition: 'eq', value: auditId },
      { columnName: 'finding_key', condition: 'eq', value: findingKey },
    ],
    max: 5,
    fresh: true,
  });
  const f = rows[0];
  if (!f) throw notFound('Finding not found in that audit');
  const rep = await db.query.reports.findFirst({
    where: and(
      eq(schema.reports.orgId, org.id),
      eq(schema.reports.siteId, site.id),
      inArray(schema.reports.stage, ['site_audit', 'full_report']),
      or(sql`${schema.reports.payload}->>'audit_id' = ${auditId}`, sql`${schema.reports.payload}->'site_audit'->>'audit_id' = ${auditId}`),
    ),
    orderBy: desc(schema.reports.receivedAt),
  });
  const p = (rep?.payload ?? {}) as Record<string, unknown>;
  const list = [...(Array.isArray(p.findings) ? p.findings : []), ...(Array.isArray((p.site_audit as Record<string, unknown> | undefined)?.findings) ? ((p.site_audit as Record<string, unknown>).findings as unknown[]) : [])] as Record<string, unknown>[];
  const full = list.find((x) => s(x.title).slice(0, 200) === s(f.title) && (!x.category || s(x.category) === s(f.category)));
  const finding: FindingForTicket = {
    title: s(f.title),
    category: s(f.category),
    severity: s(f.severity),
    affected: f.affected_count == null ? null : Number(f.affected_count),
    checked: Number(f.checked) || null,
    evidence: s(f.evidence) || s(full?.evidence) || null,
    why: s(full?.why) || null,
    fix: s(full?.fix) || null,
    sampleUrls: parseUrls(f.sample_urls).length ? parseUrls(f.sample_urls) : Array.isArray(full?.sample_urls) ? (full!.sample_urls as unknown[]).map(s).filter(Boolean).slice(0, 10) : [],
    auditedAt: s(f.audited_at),
    reportType: rep?.stage ?? 'site_audit',
  };
  return { title: finding.title, content: findingTicket(finding, site.domain, appLink(`/o/${org.id}/sites/${site.id}/technical?audit=${encodeURIComponent(auditId)}`)) };
}

async function recommendationContent(org: OrgRow, site: SiteRow, id: string): Promise<{ title: string; content: TicketContent }> {
  const r = recommend(site, await loadBundle(org, site)).find((x) => x.id === id);
  if (!r) throw notFound('That recommendation is not open for this website any more');
  const body = [r.detail, r.evidence ? `Evidence: ${r.evidence}` : ''].filter(Boolean).join('\n\n');
  return { title: r.title, content: recommendationTicket({ title: r.title, body, action: r.action?.label ?? null }, site.domain, appLink(`/o/${org.id}/sites/${site.id}/recommendations`)) };
}

/** A placeholder older than this is a crashed attempt, and the next push may take it over. */
const CREATING_STALE_MS = 2 * 60_000;

/**
 * Pushes a finding or a recommendation to the company's tracker — once. The `issue_links` row is inserted (status `creating`) BEFORE
 * the vendor call, under the unique (company, source) index, so two pushes at the same moment cannot both reach the vendor.
 */
export async function createIssue(a: OrgAccess, body: unknown): Promise<{ existing: boolean; issue: IssueLinkView }> {
  const b = parse(issueCreateSchema, body);
  const site = await db.query.sites.findFirst({ where: and(eq(schema.sites.orgId, a.org.id), eq(schema.sites.id, b.websiteId)) });
  if (!site) throw notFound('Website not found');
  requireVerified(site);
  const trackers = (await db.select().from(schema.integrations).where(and(eq(schema.integrations.orgId, a.org.id), inArray(schema.integrations.kind, [...TRACKER_KINDS])))) as IntegrationRow[];
  const tracker = b.kind ? trackers.find((t) => t.kind === b.kind) : trackers.length === 1 ? trackers[0] : undefined;
  if (!tracker)
    throw new HttpError(400, trackers.length ? 'Choose which tracker the ticket goes to' : 'Connect Jira, Linear or Asana first (Company settings → Integrations)', 'tracker_missing', trackers.length ? { kind: 'Choose one' } : undefined);
  const kind = tracker.kind as TrackerKind;
  const sourceKey = issueSourceKey(site.id, b.source.type === 'finding' ? { type: 'finding', findingKey: b.source.findingKey } : { type: 'recommendation', id: b.source.id });

  // one finding = one ticket
  const [mine] = await db
    .insert(schema.issueLinks)
    .values({ orgId: a.org.id, siteId: site.id, integrationId: tracker.id, kind, sourceKey, status: 'creating', createdBy: a.user.id })
    .onConflictDoNothing()
    .returning();
  let link = mine;
  if (!link) {
    const prior = await db.query.issueLinks.findFirst({ where: and(eq(schema.issueLinks.orgId, a.org.id), eq(schema.issueLinks.sourceKey, sourceKey)) });
    if (!prior) throw new HttpError(409, 'Try again in a moment', 'conflict');
    if (prior.status === 'created') return { existing: true, issue: toIssueView(prior) };
    // a placeholder of a push still in flight; or a crashed one, which this push takes over
    const [taken] = await db
      .update(schema.issueLinks)
      .set({ status: 'creating', createdAt: new Date(), integrationId: tracker.id, kind, createdBy: a.user.id })
      .where(and(eq(schema.issueLinks.id, prior.id), or(eq(schema.issueLinks.status, 'failed'), lt(schema.issueLinks.createdAt, new Date(Date.now() - CREATING_STALE_MS)))))
      .returning();
    if (!taken) throw new HttpError(409, 'A ticket for this is being created right now', 'issue_in_progress');
    link = taken;
  }

  try {
    const { title, content } = b.source.type === 'finding' ? await findingContent(a.org, site, b.source.auditId, b.source.findingKey) : await recommendationContent(a.org, site, b.source.id);
    const made = await VENDORS[kind].create(tracker.config, trackerSecret(tracker), content);
    const [saved] = await db
      .update(schema.issueLinks)
      .set({ status: 'created', sourceTitle: title.slice(0, 300), remoteId: made.id, remoteKey: made.key, remoteUrl: made.url, remoteStatus: made.status, remoteState: made.state, syncedAt: new Date() })
      .where(eq(schema.issueLinks.id, link.id))
      .returning();
    if (tracker.status !== 'ok') await markStatus(tracker, null);
    return { existing: false, issue: toIssueView(saved) };
  } catch (e) {
    // nothing was created on their side (or we cannot know it was): the placeholder goes, so the next push may try again
    await db.delete(schema.issueLinks).where(and(eq(schema.issueLinks.id, link.id), eq(schema.issueLinks.status, 'creating')));
    if (e instanceof VendorError && e.code === 'tracker_refused') await markStatus(tracker, e);
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// reading the state back
// ---------------------------------------------------------------------------------------------------------------------------

const REFRESH_MS = 5 * 60_000;

/** Reads the state of this company's tickets from their trackers (each at most once per 5 minutes, 50 at a time). */
export async function refreshIssues(orgId: string, siteId?: string | null): Promise<{ refreshed: number; failed: number }> {
  const conds = [eq(schema.issueLinks.orgId, orgId), eq(schema.issueLinks.status, 'created'), or(isNull(schema.issueLinks.syncedAt), lt(schema.issueLinks.syncedAt, new Date(Date.now() - REFRESH_MS)))];
  if (siteId) conds.push(eq(schema.issueLinks.siteId, siteId));
  const links = await db.select().from(schema.issueLinks).where(and(...conds)).orderBy(schema.issueLinks.syncedAt).limit(50);
  if (!links.length) return { refreshed: 0, failed: 0 };
  const trackers = await db.select().from(schema.integrations).where(and(eq(schema.integrations.orgId, orgId), inArray(schema.integrations.kind, [...TRACKER_KINDS])));
  let refreshed = 0;
  let failed = 0;
  for (const l of links) {
    const t = trackers.find((x) => x.kind === l.kind);
    if (!t) continue;
    try {
      const r = await VENDORS[l.kind as TrackerKind].read(t.config, trackerSecret(t), l);
      await db
        .update(schema.issueLinks)
        .set({ remoteStatus: r.status.slice(0, 100), remoteState: r.state, ...(r.url ? { remoteUrl: r.url } : {}), syncedAt: new Date() })
        .where(eq(schema.issueLinks.id, l.id));
      refreshed++;
    } catch {
      failed++;
      await db.update(schema.issueLinks).set({ syncedAt: new Date() }).where(eq(schema.issueLinks.id, l.id));
    }
  }
  return { refreshed, failed };
}

export async function listIssues(orgId: string, siteId?: string | null): Promise<IssueLinkView[]> {
  const conds = [eq(schema.issueLinks.orgId, orgId)];
  if (siteId) conds.push(eq(schema.issueLinks.siteId, siteId));
  const rows = await db.select().from(schema.issueLinks).where(and(...conds)).orderBy(desc(schema.issueLinks.createdAt)).limit(500);
  return rows.map(toIssueView);
}

/** The trackers this company connected (kind + name only), for the "Create ticket" buttons a member sees. */
export async function connectedTrackers(orgId: string): Promise<{ kind: TrackerKind; name: string; target: string; status: string }[]> {
  const rows = await db.select().from(schema.integrations).where(and(eq(schema.integrations.orgId, orgId), inArray(schema.integrations.kind, [...TRACKER_KINDS])));
  return rows.map((r) => ({ kind: r.kind as TrackerKind, name: r.name, target: s(r.config.projectName) || s(r.config.teamName) || s(r.config.projectKey) || s(r.config.teamKey), status: r.status }));
}
