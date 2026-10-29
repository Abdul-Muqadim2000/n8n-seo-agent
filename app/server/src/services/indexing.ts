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
  INDEX_DAILY_CAP,
  n8nSiteId,
  urlOnHost,
  type GoogleEventRow,
  type IndexCause,
  type IndexHistoryEntry,
  type IndexHistoryRow,
  type IndexingData,
  type IndexingForRecs,
  type IndexPagesPage,
  type IndexPageRow,
  type IndexRunRow,
  type IndexSiteFixCause,
  type MonitorsRow,
  type UpdateImpactRow,
} from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { rows, siteRows } from '../n8n/client';

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
type F = { columnName: string; condition: 'eq' | 'neq'; value: string | boolean };

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
  const good = runs.map(indexRunOf).sort((a, b) => (b.runAt > a.runAt ? 1 : -1)).find((r) => r.runAt && !r.failed);
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
  const m = (await siteRows<MonitorsRow>('monitors', domain, { max: 5 }).catch(() => [] as MonitorsRow[]))[0];
  const cap = m?.index_daily_cap;
  return { on: indexWatchOn(m?.index_watch), dailyCap: cap == null || cap === '' ? INDEX_DAILY_CAP.default : clampIndexDailyCap(cap) };
}

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
export async function indexingData(site: Pick<SiteRow, 'domain'>, log: Logger = quiet): Promise<IndexingData> {
  const d = site.domain;
  const settings = await indexSettings(d).catch(() => ({ on: true, dailyCap: INDEX_DAILY_CAP.default }));
  const runsP = runsOf(d);
  const [view, runs, events, impacts] = await Promise.allSettled([
    runsP.then((r) => pageView(d, r)),
    runsP,
    rows<GoogleEventRow>('googleEvents', { sortBy: 'started_at:desc', max: 12 }),
    rows<UpdateImpactRow>('updateImpact', { filters: [bySite(d)], sortBy: 'compared_at:desc', max: 3 }),
  ]);
  if (view.status === 'rejected' || runs.status === 'rejected') {
    const err = view.status === 'rejected' ? view.reason : (runs as PromiseRejectedResult).reason;
    log.warn({ site: d, err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage not read');
    return unreadable(settings, 'We could not read your index check just now. Nothing is lost; try again in a few minutes.');
  }
  return buildIndexingData({
    rows: view.value.rows,
    runs: runs.value,
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
  const all = runs.map(indexRunOf).filter((r) => r.runAt).sort((a, b) => (b.runAt > a.runAt ? 1 : -1));
  // A11: the freeze is the engine's newest run's flag; the counts are the newest run that read the website (A4)
  const latest = all[0];
  const run = all.find((r) => !r.failed);
  const freeze = latest?.freeze ? { on: true, reason: latest.freezeReason } : { on: false, reason: '' };
  if (!run) return { on: settings.on, runAt: null, freeze, siteFix: [], other: [], quality: [], askGoogle: [] };
  const count = (c: IndexCause) => Math.max(0, Math.round(run.byCause[c] ?? 0));
  const other: IndexingForRecs['other'] = [
    { action: 'links' as const, cause: 'unknown_to_google' as const, total: count('unknown_to_google') },
    { action: 'links' as const, cause: 'discovered_not_crawled' as const, total: count('discovered_not_crawled') },
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
      .filter((p) => p.url && String(p.state) !== 'indexed')
      .sort(byImpr)
      .slice(0, 3)
      .map((p) => ({ url: String(p.url), title: String(p.title ?? '').slice(0, 200), impressions28d: Number(p.impressions_28d) || 0 })),
    // FIX_CONTRACT (X8): at most 5, never a page left out on purpose, never a rewrite candidate while an update rolls out
    askGoogle: ask
      .map(indexPageOf)
      .filter((p) => p.askGoogle && p.action !== 'leave_out' && !(freeze.on && p.action === 'quality'))
      .sort((a, b) => b.impressions28d - a.impressions28d || a.url.localeCompare(b.url))
      .slice(0, 5)
      .map((p) => ({ url: p.url, title: p.title })),
  };
}

/** The cause a task key names, for the recommendations (re-exported for one import). */
export const causeOfTaskKey = (key: string): IndexSiteFixCause | null => indexingCauseOfKey(key);
