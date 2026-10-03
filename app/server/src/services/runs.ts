import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import {
  buildN8nPayload,
  cleanDomain,
  compactBody,
  estimateRunCost,
  estimateRunMinutes,
  MODES,
  n8nSiteId,
  ladderPrefsSchema,
  LADDER_ID_RE,
  normKeyword,
  roleAtLeast,
  urlOnDomain,
  urlOnHost,
  type ModeId,
  type LadderPrefs,
  type LadderRow,
  type Report,
  type ReportFile,
  type Role,
  type Run,
  type RunInput,
  type SiteContext,
} from '@seo/shared';
import { requireVerified, type OrgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, ReportRow, RunRow, SiteRow } from '../db/schema';
import { safeEqual } from '../lib/crypto';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { insertRows, invalidateSite, siteRows, startRun, updateRows } from '../n8n/client';
import { assertGa4ForDomain } from './google';
import { extractFiles } from './files';
import { applyLadderPrefs, markLadderWon } from './ladderSettings';
import { assertBudget, lockCompany } from './spend';
import { ledgerCost, stageOf, summarize, titleFor } from './summaries';

export const estimateCost = (input: RunInput): number => estimateRunCost(input.mode, input as unknown as Record<string, unknown>);
export const etaFor = (input: RunInput): number => estimateRunMinutes(input.mode, input as unknown as Record<string, unknown>);

export function runTitle(input: RunInput, site: SiteRow | null): string {
  const dom = site?.domain;
  switch (input.mode) {
    case 'verdict':
      return `Verdict: ${input.keyword}`;
    case 'keyword':
      return `${input.receiveContent ? 'Page' : 'Keyword report'}: ${input.keyword}`;
    case 'ladder':
      return `Ladder: ${input.keyword}`;
    case 'published':
      return `Publish check: ${input.keyword}`;
    case 'case_study':
      return `Case study: ${input.service}`;
    case 'audit':
      return `${input.reportType === 'full' ? 'Full SEO report' : 'Technical audit'}${dom ? ` · ${dom}` : ''}`;
    case 'discover':
      return `Keyword discovery${dom ? ` · ${dom}` : input.business ? ` · ${input.business.slice(0, 40)}` : ''}`;
    default:
      return `${MODES[input.mode].title}${dom ? ` · ${dom}` : ''}`;
  }
}

export function siteContext(site: SiteRow): SiteContext {
  return {
    domain: site.domain,
    country: site.country,
    business: site.business,
    customers: site.customers,
    goal: site.goal,
    tone: site.tone,
    cta: site.cta,
    businessFacts: site.businessFacts,
    competitors: site.competitors,
    brandNames: site.brandNames,
    ga4PropertyId: site.ga4PropertyId,
  };
}

export function callbackUrl(org: OrgRow): string {
  return `${config.callbackBaseUrl}/api/hooks/n8n/${org.hookToken}`;
}

// the company's spend (runs + keyword checks) and the locked budget check live in spend.ts
export { monthSpend, monthStart } from './spend';

/**
 * What a role may ask for: a new ladder's Auto / Manual and its place in the order (`ladderPrefs`) are ladder settings, so admins
 * only — a member's choices are dropped and the website's defaults apply, as for any ladder.
 */
export function inputForRole(input: RunInput, role: Role): RunInput {
  if (input.mode === 'ladder' && input.ladderPrefs && !roleAtLeast(role, 'admin')) return { ...input, ladderPrefs: undefined };
  return input;
}

export interface CreateRunOptions {
  /** 'auto': started by "Choose keywords for me" on the owner's behalf (its title says so; its reports count as automatic) */
  startedBy?: 'person' | 'auto';
}

export async function createRun(a: OrgAccess, input: RunInput, opts: CreateRunOptions = {}): Promise<RunRow> {
  const { org, user } = a;
  const auto = opts.startedBy === 'auto';
  if (org.disabled) throw forbidden('This company is disabled. Contact the platform administrator.');
  if (config.requireEmailVerification && !user.emailVerifiedAt) throw forbidden('Verify your e-mail address before starting runs (check your inbox, or resend the link from your account page).');

  let site: SiteRow | null = null;
  if (input.siteId) {
    site = (await db.query.sites.findFirst({ where: and(eq(schema.sites.id, input.siteId), eq(schema.sites.orgId, org.id)) })) ?? null;
    if (!site) throw badRequest('Choose one of your websites', { siteId: 'Unknown website' });
    // results are stored under the domain in n8n: only the verified owner may run against it
    requireVerified(site);
  } else if (MODES[input.mode].siteBound) {
    throw badRequest('Choose a website', { siteId: 'Required' });
  }
  // the SEO engine accepts an existing page only on the domain itself (www or not), not on a subdomain
  if (site && input.mode === 'keyword' && input.existingPageUrl && !urlOnHost(input.existingPageUrl, site.domain))
    throw badRequest(`The existing page must be on ${site.domain} (not a subdomain)`, { existingPageUrl: `Must be a page on ${site.domain}` });
  // a GA4 property is read with the shared service account: it must measure this site
  if (site && input.mode === 'track' && input.ga4PropertyId) await assertGa4ForDomain(input.ga4PropertyId, site.domain);
  if (site && input.mode === 'published' && !urlOnDomain(input.publishedUrl, site.domain))
    throw badRequest(`The published page must be on ${site.domain}`, { publishedUrl: `Must be a page on ${site.domain}` });
  input = inputForRole(input, a.role);

  // a typed keyword that is a planned page of one of the website's ladders is written as that ladder page (linked to the ladder,
  // tracked, marked "writing" so the Content Cadence moves on), exactly like "Write now" on the Pipeline page
  if (site && input.mode === 'keyword' && input.receiveContent && !input.ladder) {
    const page = await plannedLadderPage(site.domain, input.keyword);
    if (page) input = { ...input, keyword: page.keyword, ladder: page.ladder };
  }

  const estimated = estimateCost(input);
  const body = compactBody(
    // ENGINE_EMAILS off: n8n gets no address at all, so it e-mails nothing; every result arrives here through the callback
    buildN8nPayload(input, site ? siteContext(site) : null, { callbackUrl: callbackUrl(org), email: config.engineEmails && input.emailCopy ? user.email : '' }),
  );
  if (input.mode === 'keyword' && input.ladder && site) body.ladder_links = await ladderLinks(site.domain, input.ladder.id, input.ladder.rung, input.keyword);
  // budget checks and the insert under one lock per company, so parallel requests (runs and keyword checks) cannot all pass the same
  // check; the month counts runs and keyword checks, the platform's daily ceiling every company (spend.ts)
  const run = await db.transaction(async (tx) => {
    await lockCompany(tx, org.id);
    await assertBudget(tx, org, estimated, 'This run');
    const [row] = await tx
      .insert(schema.runs)
      .values({
        orgId: org.id,
        siteId: site?.id ?? null,
        userId: user.id,
        mode: input.mode,
        title: auto && input.mode === 'ladder' ? `Started automatically: ${input.keyword}` : runTitle(input, site),
        status: 'submitting',
        input: { ...input, emailCopy: config.engineEmails && input.emailCopy, ...(auto ? { autoStart: true } : {}) } as unknown as Record<string, unknown>,
        estimatedCostUsd: estimated,
        etaMinutes: etaFor(input),
      })
      .returning();
    return row;
  });

  const res = await startRun(body, org.id);
  if (!res.ok) {
    const [failed] = await db
      .update(schema.runs)
      .set({ status: 'failed', error: res.error, requestId: res.requestId, completedAt: new Date() })
      .where(eq(schema.runs.id, run.id))
      .returning();
    return failed;
  }
  const [accepted] = await db
    .update(schema.runs)
    .set({ status: 'accepted', requestId: res.requestId, acceptedAt: new Date(), etaMinutes: Math.max(run.etaMinutes, res.etaMinutes ?? 0) })
    .where(eq(schema.runs.id, run.id))
    .returning();

  // a page written from the app: the content log (cadence skips it, "waiting to publish", the publish check finds it) and, for a
  // ladder page, the ladder row (no longer "planned") — the same bookkeeping the cadence and the ladder runs do inside n8n
  if (input.mode === 'keyword' && input.receiveContent && site) await recordPageInEngine(site, input, accepted.requestId ?? '').catch(() => undefined);

  if (input.mode === 'track' && site) {
    // the site's ladders keep their own delivery address: point them here as well (and drop stored e-mails when engine e-mails are off)
    await routeSiteToApp(org, site).catch(() => undefined);
    await db
      .update(schema.sites)
      .set({
        trackingStatus: 'active',
        trackingStartedAt: site.trackingStartedAt ?? new Date(),
        keywords: input.keywords.length ? input.keywords : site.keywords,
        blogsPerWeek: input.blogsPerWeek,
        ga4PropertyId: input.ga4PropertyId || site.ga4PropertyId,
        competitors: input.competitors.length ? input.competitors : site.competitors,
        brandNames: input.monitors.brandNames.length ? input.monitors.brandNames : site.brandNames,
        updatedAt: new Date(),
      })
      .where(eq(schema.sites.id, site.id));
  }
  return accepted;
}

async function recordPageInEngine(site: SiteRow, input: Extract<RunInput, { mode: 'keyword' }>, requestId: string) {
  const now = new Date().toISOString();
  await insertRows('contentLog', [
    {
      site_id: n8nSiteId(site.domain),
      domain: site.domain,
      keyword: input.keyword,
      source: input.ladder ? 'ladder' : 'app',
      page_type: input.pageType,
      existing_page_url: input.existingPageUrl,
      rung: input.ladder?.rung ?? 0,
      ladder_id: input.ladder?.id ?? '',
      request_id: requestId,
      started_at: now,
      status: 'started',
      published_url: '',
      published_at: '',
      week: now.slice(0, 10),
    },
  ]);
  if (input.ladder)
    await updateRows(
      'ladders',
      [
        { columnName: 'ladder_id', condition: 'eq', value: input.ladder.id },
        { columnName: 'keyword', condition: 'eq', value: input.keyword },
      ],
      { status: 'writing' },
    );
}

/** Runs n8n accepted but never answered (a failed execution only e-mails ops): failed after 3 h or 6x their expected time. */
export async function expireStaleRuns(): Promise<number> {
  const rows = await db
    .update(schema.runs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      error: 'No result arrived from the SEO engine in time. The run may have failed in n8n (ops were e-mailed); start it again or check the execution in n8n.',
    })
    .where(
      and(
        inArray(schema.runs.status, ['submitting', 'accepted', 'running']),
        lt(schema.runs.createdAt, sql`now() - greatest(interval '3 hours', make_interval(mins => ${schema.runs.etaMinutes} * 6))`),
      ),
    )
    .returning({ id: schema.runs.id });
  return rows.length;
}

/** Internal links of a ladder page, as the Content Cadence builds them: the top page (hub) and a sibling on the same rung. */
export async function plannedLadderPage(domain: string, keyword: string): Promise<{ keyword: string; ladder: { id: string; rung: number; head: string; pageNo: number } } | null> {
  const rowsOf = await siteRows<LadderRow>('ladders', domain, { max: 1000, fresh: true }).catch(() => [] as LadderRow[]);
  const k = normKeyword(keyword);
  const r = rowsOf.find((l) => l.ladder_id && normKeyword(l.keyword) === k && String(l.status || 'planned') === 'planned');
  return r ? { keyword: r.keyword, ladder: { id: r.ladder_id, rung: Number(r.rung) || 0, head: r.head_keyword || '', pageNo: Number(r.page_no) || 0 } } : null;
}

async function ladderLinks(domain: string, ladderId: string, rung: number, keyword: string): Promise<{ url: string; path: string; role: string; keyword: string; planned: boolean }[]> {
  const rowsOf = await siteRows<LadderRow>('ladders', domain, { extra: [{ columnName: 'ladder_id', condition: 'eq', value: ladderId }], max: 100, fresh: true }).catch(() => [] as LadderRow[]);
  const top = rowsOf.find((r) => Number(r.rung) === 4);
  const links: { url: string; role: string; keyword: string }[] = [];
  if (rung === 4) for (const r of rowsOf.filter((x) => Number(x.rung) !== 4 && x.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword });
  else {
    if (top?.target_url && top.keyword !== keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword });
    const sib = rowsOf.find((x) => Number(x.rung) === rung && x.keyword !== keyword && x.target_url);
    if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword });
  }
  return links.map((l) => ({ ...l, path: l.url.replace(/^https?:\/\/[^/]+/i, '') || '/', planned: true }));
}

/** Points every stored delivery address of the site in n8n (site row, ladders) at this company's callback; clears stored e-mails while engine e-mails are off. */
export async function routeSiteToApp(org: OrgRow, site: SiteRow): Promise<void> {
  const data: Record<string, unknown> = { callback_url: callbackUrl(org) };
  if (!config.engineEmails) data.email = '';
  const byDomain = [{ columnName: 'domain', condition: 'eq' as const, value: site.domain }];
  await updateRows('ladders', byDomain, data);
  await updateRows('sites', byDomain, data);
  invalidateSite(site.domain);
}

// ---------------- callbacks ----------------

/**
 * The new ladder's settings the person chose in the "New keyword ladder" flow (the run's `ladderPrefs`), when its plan arrives: a
 * ladder_plan callback of that ladder run that planned pages (`planned: false` = refused, nothing to set) with a valid ladder id.
 */
export function ladderPrefsOf(stage: string, body: Record<string, unknown>, run: { mode: string; input: Record<string, unknown> } | null): { ladderId: string; prefs: LadderPrefs } | null {
  if (stage !== 'ladder_plan' || run?.mode !== 'ladder') return null;
  if (body.planned === false || body.planned === 'false') return null;
  const id = typeof body.ladder_id === 'string' ? body.ladder_id.trim() : '';
  if (!LADDER_ID_RE.test(id) || id === '_site') return null;
  const parsed = ladderPrefsSchema.safeParse(run.input?.ladderPrefs);
  if (!parsed.success || (!parsed.data.mode && parsed.data.first !== true)) return null;
  return { ladderId: id, prefs: parsed.data };
}

/** The ladder a rank-tracker callback reports as won (`won: true`), else null. */
export function wonLadderOf(stage: string, body: Record<string, unknown>): string | null {
  if (stage !== 'rank_tracker' || !(body.won === true || body.won === 'true')) return null;
  const id = typeof body.ladder_id === 'string' ? body.ladder_id.trim() : '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) && id !== '_site' ? id : null;
}

export async function orgByHookToken(token: string): Promise<OrgRow | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.hookToken, token) });
  return org && safeEqual(org.hookToken, token) ? org : null;
}

export async function ingestCallback(
  org: OrgRow,
  body: Record<string, unknown>,
): Promise<{ reportId: string; runId: string | null; stage: string; ladderWon?: boolean; prefsApplied?: boolean }> {
  const stage = stageOf(body);
  const requestId = body.request_id != null && body.request_id !== '' ? String(body.request_id) : null;
  const { callback_url: _cb, ...rest } = body; // the callback URL carries the company's hook token: never stored
  const { payload: raw, files } = extractFiles(rest);
  // older n8n builds listed other customers' Search Console properties in "no access" errors: never stored
  const payload = JSON.parse(JSON.stringify(raw).replace(/ \(it can see: [^)]*\)/g, '')) as Record<string, unknown>;

  const domain = cleanDomain(body.domain);
  const site = domain ? ((await db.query.sites.findFirst({ where: and(eq(schema.sites.orgId, org.id), eq(schema.sites.domain, domain)) })) ?? null) : null;
  const run = requestId
    ? ((await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, org.id), eq(schema.runs.requestId, requestId)), orderBy: desc(schema.runs.createdAt) })) ?? null)
    : null;

  const status = String(body.status ?? (stage === 'rejected' ? 'rejected' : 'completed'));
  const reportId = await db.transaction(async (tx) => {
    const [rep] = await tx
      .insert(schema.reports)
      .values({
        orgId: org.id,
        runId: run?.id ?? null,
        siteId: site?.id ?? run?.siteId ?? null,
        stage,
        status,
        title: run?.mode === 'verdict' && stage === 'content' ? `Verdict: ${String(body.keyword ?? '')}` : titleFor(stage, body),
        requestId,
        // weekly reports reuse the request id of the run that set tracking up: they are scheduled all the same; a ladder started by
        // "Choose keywords for me" is automatic too (it shows among the Pipeline's automatic runs)
        scheduled: !run || body.on_demand === false || ['rank_tracker', 'content_cadence', 'console_alert'].includes(stage) || run.input?.autoStart === true,
        summary: summarize(stage, body),
        payload,
      })
      .returning({ id: schema.reports.id });
    if (files.length)
      await tx.insert(schema.files).values(
        files.map((f) => ({ id: f.id, orgId: org.id, reportId: rep.id, field: f.field, kind: f.kind, fileName: f.fileName, mimeType: f.mimeType, size: f.size, data: f.data })),
      );

    if (run) {
      const info = MODES[run.mode as ModeId];
      // increments in SQL: several callbacks of one run (ladder pages) may arrive at the same moment
      const patch: Record<string, unknown> = { reportCount: sql`${schema.runs.reportCount} + 1`, lastStage: stage };
      const cost = ledgerCost(body);
      if (cost != null) patch.actualCostUsd = sql`coalesce(${schema.runs.actualCostUsd}, 0) + ${cost}`;
      if (stage === 'rejected') {
        if (run.status !== 'completed') Object.assign(patch, { status: 'failed', error: String(body.error ?? 'Rejected by the SEO engine'), completedAt: new Date() });
      } else if (info?.finalStages.includes(stage)) {
        if (run.status !== 'completed') Object.assign(patch, { status: 'completed', completedAt: new Date(), error: null });
      } else if (run.status === 'accepted' || run.status === 'submitting') {
        patch.status = 'running';
      }
      await tx.update(schema.runs).set(patch).where(eq(schema.runs.id, run.id));
    }
    if (site && (stage === 'site_tracker_setup' || stage === 'site_tracker') && site.trackingStatus === 'not_started')
      await tx.update(schema.sites).set({ trackingStatus: 'active', trackingStartedAt: new Date() }).where(eq(schema.sites.id, site.id));
    return rep.id;
  });
  if (domain) invalidateSite(domain);
  // the rank tracker says a ladder is won (main keyword top 3 in 4 checks): its settings row says so, so the cadence stops writing it
  // and the app keeps showing Won once the tracker stops checking it (not for a ladder the person paused)
  let ladderWon: boolean | undefined;
  const wonId = wonLadderOf(stage, body);
  if (wonId && site?.verifiedAt) ladderWon = await markLadderWon(site, wonId).catch(() => false);
  // the plan of a ladder started in the "New keyword ladder" flow: its Auto / Manual and "write it first" (n8n wrote the settings row
  // with the website's defaults just before this callback; refused plans have no row and get nothing)
  let prefsApplied: boolean | undefined;
  const prefs = ladderPrefsOf(stage, body, run);
  if (prefs && site?.verifiedAt) prefsApplied = await applyLadderPrefs(site, prefs.ladderId, prefs.prefs).catch(() => false);
  return { reportId, runId: run?.id ?? null, stage, ...(ladderWon !== undefined ? { ladderWon } : {}), ...(prefsApplied !== undefined ? { prefsApplied } : {}) };
}

// ---------------- serializers ----------------

export function toRun(r: RunRow, extra: { siteDomain?: string | null; userName?: string | null } = {}): Run {
  return {
    id: r.id,
    orgId: r.orgId,
    siteId: r.siteId,
    siteDomain: extra.siteDomain ?? null,
    userId: r.userId,
    userName: extra.userName ?? null,
    mode: r.mode as ModeId,
    title: r.title,
    status: r.status as Run['status'],
    requestId: r.requestId,
    error: r.error,
    estimatedCostUsd: r.estimatedCostUsd,
    actualCostUsd: r.actualCostUsd,
    etaMinutes: r.etaMinutes,
    input: r.input as unknown as RunInput,
    createdAt: r.createdAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    reportCount: r.reportCount,
    lastStage: r.lastStage,
  };
}

export function toReport(r: Pick<ReportRow, 'id' | 'runId' | 'siteId' | 'stage' | 'status' | 'title' | 'summary' | 'receivedAt' | 'scheduled'>, files: ReportFile[], siteDomain: string | null = null): Report {
  return {
    id: r.id,
    runId: r.runId,
    siteId: r.siteId,
    siteDomain,
    stage: r.stage,
    status: r.status,
    title: r.title,
    summary: r.summary,
    receivedAt: r.receivedAt.toISOString(),
    scheduled: r.scheduled,
    files,
  };
}

export async function filesFor(reportIds: string[]): Promise<Map<string, ReportFile[]>> {
  const m = new Map<string, ReportFile[]>();
  if (!reportIds.length) return m;
  const rows = await db
    .select({ id: schema.files.id, reportId: schema.files.reportId, kind: schema.files.kind, fileName: schema.files.fileName, mimeType: schema.files.mimeType, size: schema.files.size, field: schema.files.field })
    .from(schema.files)
    .where(inArray(schema.files.reportId, reportIds));
  for (const f of rows) {
    const list = m.get(f.reportId) ?? [];
    list.push({ id: f.id, kind: f.kind as ReportFile['kind'], fileName: f.fileName, mimeType: f.mimeType, size: f.size, field: f.field });
    m.set(f.reportId, list);
  }
  return m;
}

export async function reportsList(orgId: string, opts: { siteId?: string; runId?: string; stages?: string[]; limit?: number; before?: Date }): Promise<Report[]> {
  const conds = [eq(schema.reports.orgId, orgId)];
  if (opts.siteId) conds.push(eq(schema.reports.siteId, opts.siteId));
  if (opts.runId) conds.push(eq(schema.reports.runId, opts.runId));
  if (opts.stages?.length) conds.push(inArray(schema.reports.stage, opts.stages));
  if (opts.before) conds.push(lt(schema.reports.receivedAt, opts.before));
  const rows = await db
    .select({
      id: schema.reports.id,
      runId: schema.reports.runId,
      siteId: schema.reports.siteId,
      stage: schema.reports.stage,
      status: schema.reports.status,
      title: schema.reports.title,
      summary: schema.reports.summary,
      receivedAt: schema.reports.receivedAt,
      scheduled: schema.reports.scheduled,
      domain: schema.sites.domain,
    })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .where(and(...conds))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  const fm = await filesFor(rows.map((r) => r.id));
  return rows.map((r) => toReport(r, fm.get(r.id) ?? [], r.domain));
}

/** Latest report of a stage for a site, with its payload (dashboards read the rich weekly reports). */
export async function latestReport(orgId: string, siteId: string, stages: string[]): Promise<{ report: Report; payload: Record<string, unknown> } | null> {
  const row = await db.query.reports.findFirst({
    where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.siteId, siteId), inArray(schema.reports.stage, stages)),
    orderBy: desc(schema.reports.receivedAt),
  });
  if (!row) return null;
  const fm = await filesFor([row.id]);
  return { report: toReport(row, fm.get(row.id) ?? []), payload: row.payload };
}

export async function getRunOrThrow(orgId: string, runId: string): Promise<RunRow> {
  const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, orgId), eq(schema.runs.id, runId)) });
  if (!run) throw notFound('Run not found');
  return run;
}
