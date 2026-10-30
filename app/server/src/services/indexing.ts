import {
  buildIndexingData,
  clampIndexDailyCap,
  cleanDomain,
  indexHistoryLabel,
  indexPageOf,
  indexPagesPage,
  indexRunOf,
  indexingCauseOfKey,
  indexWatchOn,
  indexSitemapSubmitOn,
  isUtilityPage,
  INDEX_ASK_QUIET_DAYS,
  INDEX_ASKED_SHOWN_DAYS,
  INDEX_DAILY_CAP,
  n8nSiteId,
  urlOnHost,
  type GoogleEventRow,
  type IndexCause,
  type IndexHistoryEntry,
  type IndexHistoryRow,
  type IndexingData,
  type IndexingForRecs,
  type IndexPage,
  type IndexPagesPage,
  type IndexPageRow,
  type IndexRunRow,
  type IndexSiteFixCause,
  type MonitorsRow,
  type UpdateImpactRow,
} from '@seo/shared';
import type { FastifyRequest } from 'fastify';
import type { SiteAccess } from '../auth/access';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db, schema } from '../db';
import type { SiteRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { rows, siteRows, updateRows } from '../n8n/client';
import { audit } from './audit';

// Index coverage (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md §6): the app's reads of the engine's daily index check.
// Read only (the engine writes every row); every read is bounded (pages capped, runs 12, events 12, impacts 3) and every failure is a
// "could not read" answer for this page alone: nothing here is awaited by the Pipeline, the Overview or Technical health, and the
// recommendations read it through `indexingForRecs` with their own catch.

/** At most this many page rows of one website are read at once (the engine knows up to 6,000; the page says when it is capped). */
export const INDEX_PAGES_MAX = 5000;
/** the in-search pages that still carry something to do (in search but missing from the sitemap) are read on their own */
const INDEXED_WITH_CAUSE_MAX = 1000;
/** A15: the recommendations' reads must fit in this (Recommendations and the Overview wait on them); late = no index items */
const RECS_DEADLINE_MS = 8_000;

type Logger = { warn: (o: object, msg: string) => void };
const quiet: Logger = { warn: (o, msg) => console.warn(JSON.stringify({ level: 'warn', msg, ...o })) };

/** The engine's rows of this website only: the tables are keyed by the engine's site id, and two domains can share one (engineIdCollides). */
const mine = <T extends { domain?: string }>(domain: string, xs: T[]): T[] => xs.filter((r) => !r.domain || cleanDomain(r.domain) === cleanDomain(domain));
const bySite = (domain: string) => ({ columnName: 'site_id', condition: 'eq' as const, value: n8nSiteId(domain) });
type F = { columnName: string; condition: 'eq' | 'neq' | 'gte'; value: string | boolean };

/** The website's page rows (capped). */
export async function indexPageRows(domain: string, extra: F[] = [], max = INDEX_PAGES_MAX): Promise<IndexPageRow[]> {
  return mine(domain, await rows<IndexPageRow>('indexPages', { filters: [bySite(domain), ...extra], max }));
}

/**
 * X15: the rows the Indexing page needs. Pages in Google search with nothing to do are most of a healthy website and the page never lists
 * them, so they are not read one by one: their counts come from the newest run that read the website (`indexedCounts`). Two reads: every
 * page not in search (capped), and the in-search pages missing from the sitemap. Without such a run the whole table is read as before.
 */
async function pageView(domain: string, runs: IndexRunRow[]): Promise<{ rows: IndexPageRow[]; capped: boolean; indexedCounts?: { all: number; newLane: number } }> {
  const good = runs.map(indexRunOf).sort((a, b) => (b.runAt > a.runAt ? 1 : -1)).find((r) => r.runAt && !r.failed && !r.reservation);
  if (!good) {
    const all = await indexPageRows(domain);
    return { rows: all, capped: all.length >= INDEX_PAGES_MAX };
  }
  const [out, flagged] = await Promise.all([
    indexPageRows(domain, [{ columnName: 'state', condition: 'neq', value: 'indexed' }]),
    indexPageRows(domain, [{ columnName: 'state', condition: 'eq', value: 'indexed' }, { columnName: 'cause', condition: 'eq', value: 'indexed_not_in_sitemap' }], INDEXED_WITH_CAUSE_MAX),
  ]);
  return { rows: [...out, ...flagged], capped: out.length >= INDEX_PAGES_MAX, indexedCounts: { all: good.indexed, newLane: good.newIndexed } };
}

/** Indexing on/off and the daily checks, from the website's monitor row (empty = on, 300). */
export async function indexSettings(domain: string): Promise<{ on: boolean; dailyCap: number }> {
  return (await indexMonitor(domain)).settings;
}
/** The same row, with wave 2's sitemap switch (empty = off). */
async function indexMonitor(domain: string): Promise<{ settings: { on: boolean; dailyCap: number }; sitemapSubmit: boolean }> {
  const m = (await siteRows<MonitorsRow>('monitors', domain, { max: 5 }).catch(() => [] as MonitorsRow[]))[0];
  const cap = m?.index_daily_cap;
  return {
    settings: { on: indexWatchOn(m?.index_watch), dailyCap: cap == null || cap === '' ? INDEX_DAILY_CAP.default : clampIndexDailyCap(cap) },
    sitemapSubmit: indexSitemapSubmitOn(m?.index_sitemap_submit),
  };
}

/** wave 2 (§3.2): the pages the client said they asked Google about lately (an engine without the column answers nothing, never an error). */
const askedRows = (d: string) =>
  indexPageRows(d, [{ columnName: 'asked_google_at', condition: 'gte', value: new Date(Date.now() - INDEX_ASKED_SHOWN_DAYS * 864e5).toISOString() }], 50);

const unreadable = (settings: { on: boolean; dailyCap: number }, error: string): IndexingData => ({
  ...buildIndexingData({ rows: [], runs: [], events: [], impacts: [], settings }),
  status: 'unreadable',
  error,
});

const runsOf = (d: string) => rows<IndexRunRow>('indexRuns', { filters: [bySite(d)], sortBy: 'run_at:desc', max: 12 }).then((xs) => mine(d, xs));

/**
 * The Indexing page in one answer. The page rows and the runs decide whether the page can be shown; the Google events and the update
 * impact are extras (an unreadable events table leaves the timeline empty, never the page).
 */
/**
 * ENGINE_BUILD wave 2 contract 6: the newest "I asked Google" per page from the app's own audit log (last 45 days), so a write an
 * overlapping engine run put back is shown as not recorded (the client presses again) instead of silently vanishing.
 */
async function askedByApp(orgId: string, siteId: string): Promise<Record<string, string>> {
  const since = new Date(Date.now() - INDEX_ASKED_SHOWN_DAYS * 864e5);
  const xs = await db
    .select({ at: schema.auditEvents.at, details: schema.auditEvents.details })
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.orgId, orgId), eq(schema.auditEvents.action, 'indexing.asked_google'), eq(schema.auditEvents.targetId, siteId), gte(schema.auditEvents.at, since)))
    .orderBy(desc(schema.auditEvents.at))
    .limit(200);
  const out: Record<string, string> = {};
  for (const x of xs) {
    const url = String((x.details as Record<string, unknown> | null)?.url ?? '');
    if (url && !out[url]) out[url] = x.at.toISOString();
  }
  return out;
}

export async function indexingData(site: Pick<SiteRow, 'domain'> & Partial<Pick<SiteRow, 'id' | 'orgId'>>, log: Logger = quiet): Promise<IndexingData> {
  const d = site.domain;
  const mon = await indexMonitor(d).catch(() => ({ settings: { on: true, dailyCap: INDEX_DAILY_CAP.default }, sitemapSubmit: false }));
  const settings = mon.settings;
  const runsP = runsOf(d);
  const [view, runs, events, impacts, asked, byApp] = await Promise.allSettled([
    runsP.then((r) => pageView(d, r)),
    runsP,
    rows<GoogleEventRow>('googleEvents', { sortBy: 'started_at:desc', max: 12 }),
    rows<UpdateImpactRow>('updateImpact', { filters: [bySite(d)], sortBy: 'compared_at:desc', max: 3 }),
    askedRows(d),
    site.id && site.orgId ? askedByApp(site.orgId, site.id) : Promise.resolve({}),
  ]);
  if (view.status === 'rejected' || runs.status === 'rejected') {
    const err = view.status === 'rejected' ? view.reason : (runs as PromiseRejectedResult).reason;
    log.warn({ site: d, err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage not read');
    return unreadable(settings, 'We could not read your index check just now. Nothing is lost; try again in a few minutes.');
  }
  // the pages asked about that the page view did not read (in search now): added once each, so every figure stays the same
  const seen = new Set(view.value.rows.map((r) => String(r.url)));
  const extra = asked.status === 'fulfilled' ? asked.value.filter((r) => r.url && !seen.has(String(r.url))) : [];
  return buildIndexingData({
    rows: [...view.value.rows, ...extra],
    runs: runs.value,
    sitemapSubmit: mon.sitemapSubmit,
    askedByApp: byApp.status === 'fulfilled' ? byApp.value : undefined,
    events: events.status === 'fulfilled' ? events.value : [],
    impacts: impacts.status === 'fulfilled' ? mine(d, impacts.value) : [],
    settings,
    capped: view.value.capped,
    indexedCounts: view.value.indexedCounts,
  });
}

/** One page of a group's addresses (the same reads as the page, so they are the read cache's, not a second set). */
export async function indexingPages(site: Pick<SiteRow, 'domain'>, q: Record<string, unknown>): Promise<IndexPagesPage> {
  const pick = (k: string, max = 40) => {
    const v = typeof q[k] === 'string' ? (q[k] as string) : '';
    return /^[a-z_]{1,40}$/.test(v) ? v.slice(0, max) : undefined;
  };
  const lane = pick('lane');
  const view = await pageView(site.domain, await runsOf(site.domain));
  return indexPagesPage(view.rows, {
    lane: lane === 'new' || lane === 'existing' ? lane : undefined,
    action: pick('action'),
    cause: pick('cause'),
    dropped: q.dropped === '1' || q.dropped === 'true',
    page: Number(q.page),
    pageSize: Number(q.pageSize),
  });
}

/** What happened to one page over time (newest first, at most 20 changes). Only an address on the website's own host is read. */
export async function indexingHistory(site: Pick<SiteRow, 'domain'>, url: string): Promise<IndexHistoryEntry[] | null> {
  if (!url || url.length > 2000 || !/^https?:\/\//i.test(url) || !urlOnHost(url, site.domain)) return null;
  const xs = await rows<IndexHistoryRow>('indexHistory', { filters: [bySite(site.domain), { columnName: 'url', condition: 'eq', value: url }], sortBy: 'at:desc', max: 20 });
  return xs.map((h) => ({ at: String(h.at ?? ''), state: String(h.state ?? ''), cause: String(h.cause ?? ''), label: indexHistoryLabel(String(h.state ?? ''), String(h.cause ?? '')), evidence: String(h.evidence ?? ''), coverage: String(h.coverage ?? '') }));
}

/**
 * What the recommendations need (services/recommendations.ts): the newest run's counts and freeze, the pages Google read and left out
 * (one recommendation with "Improve this page" for the most important), and the pages to ask Google about. Small bounded reads with a
 * deadline (A15); the caller catches, and a late answer is "no index items".
 */
export async function indexingForRecs(site: Pick<SiteRow, 'domain'>): Promise<IndexingForRecs | null> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), RECS_DEADLINE_MS);
  });
  try {
    return await Promise.race([readForRecs(site.domain), late]);
  } finally {
    clearTimeout(timer);
  }
}

async function readForRecs(d: string): Promise<IndexingForRecs | null> {
  const [settings, runs, quality, ask] = await Promise.all([
    indexSettings(d),
    rows<IndexRunRow>('indexRuns', { filters: [bySite(d)], sortBy: 'run_at:desc', max: 5 }).then((xs) => mine(d, xs)),
    indexPageRows(d, [{ columnName: 'action', condition: 'eq', value: 'quality' }], 50).catch(() => [] as IndexPageRow[]),
    indexPageRows(d, [{ columnName: 'ask_google', condition: 'eq', value: true }], 10).catch(() => [] as IndexPageRow[]),
  ]);
  // a reservation row (a run that had not finished, or crashed) is never the latest reading
  const all = runs.map(indexRunOf).filter((r) => r.runAt && !r.reservation).sort((a, b) => (b.runAt > a.runAt ? 1 : -1));
  // A11: the freeze is the engine's newest run's flag; the counts are the newest run that read the website (A4)
  const latest = all[0];
  const run = all.find((r) => !r.failed);
  const freeze = latest?.freeze ? { on: true, reason: latest.freezeReason } : { on: false, reason: '' };
  if (!run) return { on: settings.on, runAt: null, freeze, siteFix: [], other: [], quality: [], askGoogle: [] };
  const count = (c: IndexCause) => Math.max(0, Math.round(run.byCause[c] ?? 0));
  // wave 2 (DESIGN_WAVE2 §3.2): pages that need a link are the `indexing:links` step's recommendation (the cause counts also hold pages the
  // website already links to, which wait for Google with nothing to do)
  const other: IndexingForRecs['other'] = [
    { action: 'duplicate' as const, cause: 'google_chose_other' as const, total: count('google_chose_other') },
    { action: 'duplicate' as const, cause: 'duplicate_no_canonical' as const, total: count('duplicate_no_canonical') },
    { action: 'quality' as const, cause: 'crawled_not_indexed' as const, total: Math.max(count('crawled_not_indexed'), quality.length) },
  ].filter((x) => x.total > 0);
  const byImpr = (a: IndexPageRow, b: IndexPageRow) => (Number(b.impressions_28d) || 0) - (Number(a.impressions_28d) || 0) || (Number(b.clicks_28d) || 0) - (Number(a.clicks_28d) || 0);
  return {
    on: settings.on,
    runAt: run.runAt,
    freeze,
    siteFix: [],
    other,
    quality: quality
      // wave 2 (DESIGN_WAVE2 §2.4): a policy or utility page is never a page to improve
      .filter((p) => p.url && String(p.state) !== 'indexed' && !isUtilityPage(String(p.url)))
      .sort(byImpr)
      .slice(0, 3)
      .map((p) => ({ url: String(p.url), title: String(p.title ?? '').slice(0, 200), impressions28d: Number(p.impressions_28d) || 0 })),
    // FIX_CONTRACT (X8): at most 5, never a page left out on purpose, never a rewrite candidate while an update rolls out
    askGoogle: ask
      .map(indexPageOf)
      // wave 2: a page the client asked about in the last 14 days is waiting for Google, not asked for again
      .filter((p) => p.askGoogle && p.action !== 'leave_out' && !(freeze.on && p.action === 'quality') && !askedLately(p))
      .sort((a, b) => b.impressions28d - a.impressions28d || a.url.localeCompare(b.url))
      .slice(0, 5)
      .map((p) => ({ url: p.url, title: p.title })),
  };
}

const askedLately = (p: IndexPage, now = Date.now()) => !!p.askedGoogleAt && now - Date.parse(p.askedGoogleAt) < INDEX_ASK_QUIET_DAYS * 864e5 && !(p.googleReadAfterAskAt >= p.askedGoogleAt);

/**
 * wave 2 (DESIGN_WAVE2 §3.2): "I asked Google" for one page. Members and above, verified websites only; the page must be a page of this
 * website the daily index check knows. Writes `asked_google_at` on that page's row of the engine's table (the same Data Table write the app
 * uses for the engine's other tables), which makes the engine read Google's view of the page again within two days. Written to the audit log.
 * A second click within a day keeps the first time. Nothing is sent to Google: the client asked in Search Console themselves.
 */
export async function markAskedGoogle(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<{ page: IndexPage }> {
  const d = a.site.domain;
  const url = String((body as Record<string, unknown> | null)?.url ?? '').trim();
  if (!url || url.length > 2000 || !/^https?:\/\//i.test(url) || !urlOnHost(url, d)) throw notFound('That address is not a page of this website');
  let found: IndexPageRow[];
  try {
    found = mine(d, await rows<IndexPageRow>('indexPages', { filters: [bySite(d), { columnName: 'url', condition: 'eq', value: url }], max: 1, fresh: true }));
  } catch {
    throw new HttpError(503, 'We could not reach your index check just now, so nothing was saved. Try again in a few minutes.', 'engine_unreachable');
  }
  const row = found[0];
  if (!row) throw notFound('The daily index check does not know this page yet.');
  const page = indexPageOf(row);
  if (page.state === 'indexed') throw new HttpError(409, 'This page is in Google search already, so there is nothing to ask.', 'already_in_search');
  const now = new Date();
  const recent = !!page.askedGoogleAt && now.getTime() - Date.parse(page.askedGoogleAt) < 864e5 && !(page.googleReadAfterAskAt >= page.askedGoogleAt);
  const at = recent ? page.askedGoogleAt : now.toISOString();
  if (!recent) {
    let ok = false;
    try {
      ok = await updateRows('indexPages', [bySite(d), { columnName: 'url', condition: 'eq', value: url }], { asked_google_at: at });
    } catch {
      ok = false;
    }
    // the engine's table without the column (an engine from before wave 2) or n8n not answering: nothing was saved, and the person is told
    if (!ok) throw new HttpError(503, 'We could not save it just now, so nothing changed. Try again in a few minutes.', 'engine_not_saved');
    await audit(req, a.org.id, { action: 'indexing.asked_google', target: { type: 'site', id: a.site.id, label: d }, details: { url: url.slice(0, 500) } });
  }
  return { page: indexPageOf({ ...row, asked_google_at: at }) };
}

/** The cause a task key names, for the recommendations (re-exported for one import). */
export const causeOfTaskKey = (key: string): IndexSiteFixCause | null => indexingCauseOfKey(key);
