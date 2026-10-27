import type { FastifyRequest } from 'fastify';
import {
  confirmNeededBody,
  consistencyWarnings,
  countryOf,
  needsAcknowledge,
  NOTICE_MODES,
  overriddenCodes,
  type AiPromptRow,
  type ConsistencyAction,
  type ConsistencyCtx,
  type ConsistencySite,
  type LadderRow,
  type RunInput,
  type SitePageRow,
  type SiteRow as EngineSiteRow,
  type LivePage,
  type StartCtx,
  roleAtLeast,
  registrableDomain,
  type Role,
  type SettingsInput,
  type Warning,
} from '@seo/shared';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { OrgRow, SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { siteRows } from '../n8n/client';
import { audit, type AuditActor } from './audit';
import type { ScheduleChange } from './billing';

/**
 * MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2.2): the server side of the one mismatch mechanism.
 * The rules are pure and live in `@seo/shared` (consistency.ts, one registry); this file only reads what they need (the website row,
 * the pipeline, the engine's own row of the website, the ladders, the latest research, the AI questions) and enforces the answer:
 * a warning that is not acknowledged answers 409 `confirm_needed` with the warnings (`notices` and `warnings`, one list) and the ids
 * to send back in `acknowledge`. Every start goes through it (createRunWithMeta): the app's forms, the REST API, MCP, proposals,
 * onboarding. An automatic start cannot acknowledge, so it stops and becomes a "Needs you" item.
 */

export const siteApiOf = (site: Pick<SiteRow, 'orgId' | 'id'>): string => `/api/orgs/${site.orgId}/sites/${site.id}`;

export const consistencySite = (s: SiteRow): ConsistencySite => ({
  domain: s.domain,
  country: s.country,
  business: s.business,
  customers: s.customers,
  businessFacts: s.businessFacts,
  services: s.services,
  cta: s.cta,
  timezone: s.timezone,
  competitors: s.competitors,
});

const tracked = (s: SiteRow) => !!s.verifiedAt && ['active', 'paused'].includes(s.trackingStatus);

/** How a start came in (consistency-more.ts StartCtx): a keyword proposal, an automatic start, the person's role. */
export interface RunWarningOpts {
  costLabel?: string;
  /** a keyword proposal approved or swapped (D1 asks before it starts a new ladder) */
  proposal?: boolean;
  /** started by the system on the owner's behalf */
  auto?: boolean;
  role?: Role;
}

/** The website's live pages that already answer a keyword (seo_pages, the Content Cadence's own matcher). Unreadable = none. */
export async function livePagesFor(domain: string, keywords: string[]): Promise<LivePage[]> {
  const want = keywords.map((k) => k.trim()).filter(Boolean);
  if (!want.length) return [];
  const [pages, { matchPage }] = await Promise.all([siteRows<SitePageRow>('pages', domain, { max: 2000 }).catch(() => [] as SitePageRow[]), import('./cadence')]);
  if (!pages.length) return [];
  return want.flatMap((keyword) => {
    const m = matchPage(pages, keyword);
    return m ? [{ keyword, url: m.url, title: m.title, matchedBy: m.matchedBy }] : [];
  });
}

/** D1: what a ladder start is quoted at in credits, as it will run and planned without a page (the run path's own estimate). */
async function ladderQuotes(input: RunInput, site: SiteRow): Promise<Pick<StartCtx, 'credits' | 'planCredits'>> {
  if (input.mode !== 'ladder') return {};
  try {
    const [{ estimateCost }, { quoteCredits }, { settingsRow }] = await Promise.all([import('./runs'), import('./billing'), import('./admin/settings')]);
    const s = await settingsRow();
    const asRuns = await estimateCost(input, site);
    const plan = await estimateCost({ ...input, pagesHeld: 'manual' }, site);
    return { credits: quoteCredits(asRuns, s), planCredits: quoteCredits(plan, s) };
  } catch {
    return {};
  }
}

/** The warnings of a run start: the forms' duplicate warnings, the market checks and the money / data checks, on the website's own data. */
export async function runWarnings(org: OrgRow, site: SiteRow | null, input: RunInput, opts: RunWarningOpts = {}): Promise<Warning[]> {
  if (!site) return [];
  // read lazily: pipeline.ts imports half the server, and runs.ts (which imports this file) is one of its readers
  const wantsPipeline = NOTICE_MODES.includes(input.mode) || input.mode === 'track';
  const keywords = input.mode === 'ladder' || (input.mode === 'keyword' && input.receiveContent !== false && !input.existingPageUrl) ? [input.keyword] : [];
  const [pipeline, livePages] = await Promise.all([
    site.verifiedAt && wantsPipeline ? import('./pipeline').then((m) => m.pipelineData(org, site)).catch(() => null) : Promise.resolve(null),
    site.verifiedAt ? livePagesFor(site.domain, keywords).catch(() => [] as LivePage[]) : Promise.resolve([] as LivePage[]),
  ]);
  // the quote only matters to the new-ladder confirmation (D1); the ladder's mode decides it, as the run path does (pagesHeld)
  const quotes = opts.proposal && !opts.auto ? await ladderQuotes(withHeld(input, pipeline), site) : {};
  return consistencyWarnings('run', input as unknown as Record<string, unknown>, {
    site: consistencySite(site),
    siteApi: siteApiOf(site),
    tracked: tracked(site),
    pipeline,
    pipelineOpts: opts.costLabel ? { costLabel: opts.costLabel } : undefined,
    start: { proposal: !!opts.proposal, auto: !!opts.auto, admin: opts.role ? roleAtLeast(opts.role, 'admin') : undefined, ...quotes },
    livePages,
  });
}

/** The ladder as the run path will quote it: Manual (the request's or the website's default) or held for the profile writes no page now. */
function withHeld(input: RunInput, pipeline: { automation?: { defaultMode?: string }; readiness?: { ready: boolean } | null } | null): RunInput {
  if (input.mode !== 'ladder' || input.pagesHeld) return input;
  const manual = input.ladderMode === 'manual' || (!input.ladderMode && pipeline?.automation?.defaultMode === 'manual');
  const held = !manual && !!pipeline?.readiness && !pipeline.readiness.ready;
  return manual ? { ...input, pagesHeld: 'manual' } : held ? { ...input, pagesHeld: 'profile' } : input;
}

/** The engine's row of the website (seo_sites): the market every weekly job measures it in. null when it cannot be read or is missing. */
export async function engineSiteRow(domain: string): Promise<EngineSiteRow | null> {
  try {
    const rows = await siteRows<EngineSiteRow>('sites', domain, { max: 5 });
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** The website's ladders, one per ladder id, with the market each is measured in. */
export async function ladderMarkets(domain: string): Promise<{ id: string; head: string; country: string }[]> {
  const rows = await siteRows<LadderRow>('ladders', domain, { max: 2000 }).catch(() => [] as LadderRow[]);
  const by = new Map<string, { id: string; head: string; country: string }>();
  for (const r of rows) {
    if (!r.ladder_id || by.has(r.ladder_id) || ['archived', 'deleted'].includes(String(r.status))) continue;
    by.set(r.ladder_id, { id: r.ladder_id, head: r.head_keyword || r.keyword, country: r.country || (r.location_code ? String(r.location_code) : '') });
  }
  return [...by.values()].map((l) => ({ ...l, country: countryOf(l.country)?.name ?? l.country }));
}

/** Everything the standing checks read about one website (each part on its own: an unreadable part is simply not judged). */
export async function standingCtx(org: OrgRow, site: SiteRow): Promise<ConsistencyCtx> {
  const { latestReport } = await import('./runs');
  const [engine, ladders, research, prompts] = await Promise.all([
    tracked(site) ? engineSiteRow(site.domain) : Promise.resolve(null),
    site.verifiedAt ? ladderMarkets(site.domain) : Promise.resolve([]),
    site.verifiedAt ? latestReport(org.id, site.id, ['keyword_strategy']).catch(() => null) : Promise.resolve(null),
    tracked(site) ? siteRows<AiPromptRow>('aiPrompts', site.domain, { max: 600 }).catch(() => [] as AiPromptRow[]) : Promise.resolve([] as AiPromptRow[]),
  ]);
  return {
    site: consistencySite(site),
    siteApi: siteApiOf(site),
    tracked: tracked(site),
    engine: engine ? { country: engine.country, locationCode: Number(engine.location_code) || null, languageCode: engine.language_code } : null,
    ladders,
    research: research ? { country: countryOf(String(research.payload.country ?? ''))?.name ?? null } : null,
    aiPrompts: prompts.filter((p) => p.source === 'custom' || p.source === 'auto' || !p.source).map((p) => ({ promptId: p.prompt_id, prompt: p.prompt, market: p.market, status: p.status })),
    // AI-FOCUS (2026-10-27): what the AI panel's two focus warnings read (ladders with status, pages, services, keywords, the panel size and its price)
    aiFocus: tracked(site) ? await import('./aiFocus').then((m) => m.aiFocusCtx(site, prompts, engine)).catch(() => null) : null,
  };
}

/** The website's standing warnings (shown as a banner on its pages), without those a person already answered with Continue anyway. */
export async function standingWarnings(org: OrgRow, site: SiteRow): Promise<{ warnings: Warning[]; acknowledged: Warning[] }> {
  const all = consistencyWarnings('site_standing', {}, await standingCtx(org, site));
  const ack = new Set(site.acknowledgedWarnings ?? []);
  return { warnings: all.filter((w) => !(w.tone === 'warning' && ack.has(w.id))), acknowledged: all.filter((w) => w.tone === 'warning' && ack.has(w.id)) };
}

const DUPLICATE_MESSAGE = 'This looks like a duplicate of work already planned or running. Read the notices, then send their ids in "acknowledge" to start it anyway.';
const MISMATCH_MESSAGE = 'This does not match what we know about the website. Read the warnings: apply the correction they offer, or send their ids in "acknowledge" to go ahead anyway.';

/** The one 409 every path answers: `confirm_needed`, with the warnings and the ids still to acknowledge. */
export function confirmNeeded(warnings: Warning[], open: Warning[], message?: string): HttpError {
  const msg = message ?? (open.every((w) => w.code.startsWith('pipeline.')) ? DUPLICATE_MESSAGE : MISMATCH_MESSAGE);
  return new HttpError(409, msg, 'confirm_needed', undefined, confirmNeededBody(warnings, open) as unknown as Record<string, unknown>);
}

/** Throws the 409 when a warning is not acknowledged; returns what the caller went past (for the run and the audit log). */
export function assertConsistent(warnings: Warning[], acknowledge: readonly string[] = [], message?: string): { ids: string[]; codes: string[] } {
  const open = needsAcknowledge(warnings, acknowledge);
  if (open.length) throw confirmNeeded(warnings, open, message);
  return overriddenCodes(warnings, acknowledge);
}

/** Whether an error is the mechanism's 409 (an automatic start turns it into a "Needs you" item). */
export const isConfirmNeeded = (err: unknown): err is HttpError & { extra: { warnings: Warning[]; needsAcknowledge: string[] } } =>
  err instanceof HttpError && err.statusCode === 409 && err.code === 'confirm_needed';

/** The first open warning's title, for a note a person reads ("Waiting for you: ..."). */
export function firstOpenTitle(err: unknown): string {
  if (!isConfirmNeeded(err)) return '';
  const open = new Set(err.extra.needsAcknowledge ?? []);
  return (err.extra.warnings ?? []).find((w) => open.has(w.id))?.title ?? '';
}

/** One audit row for every "Continue anyway": which codes, on what, with which values. */
export async function recordOverride(
  req: FastifyRequest | null,
  orgId: string,
  e: { codes: string[]; ids: string[]; target: { type: string; id?: string | null; label?: string | null }; what: string; actor?: AuditActor; values?: Record<string, unknown> },
): Promise<void> {
  if (!e.ids.length) return;
  await audit(req, orgId, { action: 'warning.overridden', target: e.target, ...(e.actor ? { actor: e.actor } : {}), details: { codes: e.codes, ids: e.ids.slice(0, 20), what: e.what, ...(e.values ?? {}) } });
}

/** Keeps a standing warning quiet: its id is stored on the website (the id embeds the facts, so a change warns again). */
export async function acknowledgeOnSite(site: SiteRow, ids: string[]): Promise<string[]> {
  const next = [...new Set([...(site.acknowledgedWarnings ?? []), ...ids])].slice(-100);
  await db.update(schema.sites).set({ acknowledgedWarnings: next, updatedAt: new Date() }).where(eq(schema.sites.id, site.id));
  return next;
}

/** A check of a non-run write (site save, AI questions): the warnings, enforced. */
export function checkWrite(action: ConsistencyAction, input: Record<string, unknown>, ctx: ConsistencyCtx, acknowledge: readonly string[] = []) {
  const warnings = consistencyWarnings(action, input, ctx);
  return { warnings, ...assertConsistent(warnings, acknowledge) };
}

/** `acknowledge` from any request body (a list of warning ids), and the body without it. */
export function takeAcknowledge(body: unknown): { acknowledge: string[]; rest: unknown } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { acknowledge: [], rest: body };
  const { acknowledge, ...rest } = body as Record<string, unknown>;
  const list = Array.isArray(acknowledge) ? acknowledge.map((x) => String(x ?? '').trim()).filter((x) => x && x.length <= 200).slice(0, 20) : [];
  return { acknowledge: list, rest };
}

// ---------------- the more cases (consistency-more.ts): settings saves, "Add to my ladder", integrations ----------------

/** Who asks, for the audit row of a "Continue anyway" on a write that is not a run. */
type Asker = { org: OrgRow; site: SiteRow; role?: Role };

/**
 * S1-S7, C1, M7: a pipeline or monitor setting about to be saved. Reads the pipeline (and, for a schedule change, the company's credits),
 * throws the 409 until every warning is accepted or acknowledged, and records a "Continue anyway". `schedule` is the change the credit
 * forecast follows; `revert` the values that keep the current setting (C1's Accept).
 */
export async function checkSettings(
  req: FastifyRequest | null,
  who: Asker,
  input: SettingsInput,
  opts: { schedule?: ScheduleChange; revert?: Record<string, unknown> } = {},
): Promise<void> {
  const { acknowledge } = takeAcknowledge(req?.body);
  const { org, site } = who;
  const [pipeline, runway] = await Promise.all([
    // the monitor checks read the website and the credits only; the pipeline checks (cadence, automation, a ladder) read the pipeline
    site.verifiedAt && input.setting !== 'monitors' ? import('./pipeline').then((m) => m.pipelineData(org, site)).catch(() => null) : Promise.resolve(null),
    opts.schedule ? import('./billing').then((m) => m.creditRunway(org, site, opts.schedule!)).catch(() => null) : Promise.resolve(null),
  ]);
  const chk = checkWrite(
    'settings',
    input as unknown as Record<string, unknown>,
    {
      site: consistencySite(site),
      siteApi: siteApiOf(site),
      tracked: tracked(site),
      pipeline,
      credits: runway ? { ...runway, ...(opts.revert ? { revert: opts.revert } : {}) } : null,
      start: { admin: who.role ? roleAtLeast(who.role, 'admin') : undefined },
    },
    acknowledge,
  );
  await recordOverride(req, site.orgId, { ...chk, target: { type: 'site', id: site.id, label: site.domain }, what: `settings:${input.setting}`, values: { ...input } });
}

/** D4: "Add to my ladder", checked like a new page: another ladder's search, a live page, a search nobody can win, another market. */
export async function checkLadderAdd(req: FastifyRequest | null, who: Asker, keyword: string, ladderId: string): Promise<void> {
  const { acknowledge } = takeAcknowledge(req?.body);
  const { org, site } = who;
  const [pipeline, livePages] = await Promise.all([
    import('./pipeline').then((m) => m.pipelineData(org, site)).catch(() => null),
    livePagesFor(site.domain, [keyword]).catch(() => [] as LivePage[]),
  ]);
  const chk = checkWrite('ladder_add', { keyword, ladderId }, { site: consistencySite(site), siteApi: siteApiOf(site), pipeline, livePages }, acknowledge);
  await recordOverride(req, site.orgId, { ...chk, target: { type: 'site', id: site.id, label: site.domain }, what: 'ladder_add', values: { keyword, ladderId } });
}

/** I1-I3: a CMS connection, an outreach mailbox, a backlinks file of another website. */
export async function checkIntegration(
  req: FastifyRequest | null,
  who: Pick<Asker, 'org' | 'site'>,
  input: Record<string, unknown> & { kind: 'cms' | 'mailbox' | 'link_import' },
): Promise<void> {
  const { acknowledge } = takeAcknowledge(req?.body);
  const { org, site } = who;
  const companyDomains =
    input.kind === 'mailbox'
      ? (await db.query.sites.findMany({ where: eq(schema.sites.orgId, site.orgId), columns: { domain: true } })).map((s) => s.domain).filter((d) => d !== site.domain)
      : [];
  const chk = checkWrite('integration', input, { site: consistencySite(site), siteApi: siteApiOf(site), companyDomains }, acknowledge);
  await recordOverride(req, site.orgId, { ...chk, target: { type: 'site', id: site.id, label: site.domain }, what: `integration:${input.kind}` });
}

/**
 * I7: where https://<domain>/ sends a visitor, when it is another registrable domain ('' when it stays, or when the address cannot be
 * read: an unreachable website is not a mismatch). One request, redirects followed, 5 seconds at most. Never in tests.
 */
export async function redirectTarget(domain: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (fetcher === fetch && (process.env.VITEST || process.env.NODE_ENV === 'test')) return '';
  try {
    const res = await fetcher(`https://${domain}/`, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlaventraBot/1.0)' } });
    void res.body?.cancel().catch(() => undefined);
    const host = (String(res.url || '').match(/^https?:\/\/([^/?#:]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
    return host && registrableDomain(host) !== registrableDomain(domain) ? host : '';
  } catch {
    return '';
  }
}
