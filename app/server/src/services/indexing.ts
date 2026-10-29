import {
  buildIndexingData,
  clampIndexDailyCap,
  cleanDomain,
  indexHistoryLabel,
  indexPagesPage,
  indexingCauseOfKey,
  indexWatchOn,
  INDEX_DAILY_CAP,
  n8nSiteId,
  safeJson,
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

/** At most this many page rows of one website are read at once (the engine knows up to 5,000; the page says when it is capped). */
export const INDEX_PAGES_MAX = 5000;

type Logger = { warn: (o: object, msg: string) => void };
const quiet: Logger = { warn: (o, msg) => console.warn(JSON.stringify({ level: 'warn', msg, ...o })) };

/** The engine's rows of this website only: the tables are keyed by the engine's site id, and two domains can share one (engineIdCollides). */
const mine = <T extends { domain?: string }>(domain: string, xs: T[]): T[] => xs.filter((r) => !r.domain || cleanDomain(r.domain) === cleanDomain(domain));
const bySite = (domain: string) => ({ columnName: 'site_id', condition: 'eq' as const, value: n8nSiteId(domain) });

/** The website's page rows (capped). */
export async function indexPageRows(domain: string, extra: { columnName: string; condition: 'eq'; value: string }[] = [], max = INDEX_PAGES_MAX): Promise<IndexPageRow[]> {
  return mine(domain, await rows<IndexPageRow>('indexPages', { filters: [bySite(domain), ...extra], max }));
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

/**
 * The Indexing page in one answer. The page rows and the runs decide whether the page can be shown; the Google events and the update
 * impact are extras (an unreadable events table leaves the timeline empty, never the page).
 */
export async function indexingData(site: Pick<SiteRow, 'domain'>, log: Logger = quiet): Promise<IndexingData> {
  const d = site.domain;
  const settings = await indexSettings(d).catch(() => ({ on: true, dailyCap: INDEX_DAILY_CAP.default }));
  const [pages, runs, events, impacts] = await Promise.allSettled([
    indexPageRows(d),
    rows<IndexRunRow>('indexRuns', { filters: [bySite(d)], sortBy: 'run_at:desc', max: 12 }),
    rows<GoogleEventRow>('googleEvents', { sortBy: 'started_at:desc', max: 12 }),
    rows<UpdateImpactRow>('updateImpact', { filters: [bySite(d)], sortBy: 'compared_at:desc', max: 3 }),
  ]);
  if (pages.status === 'rejected' || runs.status === 'rejected') {
    const err = pages.status === 'rejected' ? pages.reason : (runs as PromiseRejectedResult).reason;
    log.warn({ site: d, err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage not read');
    return unreadable(settings, 'We could not read your index check just now. Nothing is lost; try again in a few minutes.');
  }
  return buildIndexingData({
    rows: pages.value,
    runs: mine(d, runs.value),
    events: events.status === 'fulfilled' ? events.value : [],
    impacts: impacts.status === 'fulfilled' ? mine(d, impacts.value) : [],
    settings,
    capped: pages.value.length >= INDEX_PAGES_MAX,
  });
}

/** One page of a group's addresses (the same capped read, so it is the read cache's, not a second one). */
export async function indexingPages(site: Pick<SiteRow, 'domain'>, q: Record<string, unknown>): Promise<IndexPagesPage> {
  const pick = (k: string, max = 40) => {
    const v = typeof q[k] === 'string' ? (q[k] as string) : '';
    return /^[a-z_]{1,40}$/.test(v) ? v.slice(0, max) : undefined;
  };
  const lane = pick('lane');
  return indexPagesPage(await indexPageRows(site.domain), {
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
 * What the recommendations need (services/recommendations.ts): the newest run's counts and freeze, and the pages Google read and left
 * out (one recommendation with "Improve this page" for the most important). Two small reads; the caller catches.
 */
export async function indexingForRecs(site: Pick<SiteRow, 'domain'>): Promise<IndexingForRecs | null> {
  const d = site.domain;
  const [settings, runs, quality] = await Promise.all([
    indexSettings(d),
    rows<IndexRunRow>('indexRuns', { filters: [bySite(d)], sortBy: 'run_at:desc', max: 1 }),
    indexPageRows(d, [{ columnName: 'action', condition: 'eq', value: 'quality' }], 200),
  ]);
  const run = mine(d, runs)[0];
  if (!run?.run_at) return { on: settings.on, runAt: null, freeze: { on: false, reason: '' }, siteFix: [], other: [], quality: [] };
  const byCause = safeJson<Record<string, unknown>>(String(run.by_cause_json ?? ''), {});
  const count = (c: IndexCause) => Math.max(0, Math.round(Number(byCause[c]) || 0));
  const other: IndexingForRecs['other'] = [
    { action: 'links' as const, cause: 'unknown_to_google' as const, total: count('unknown_to_google') },
    { action: 'links' as const, cause: 'discovered_not_crawled' as const, total: count('discovered_not_crawled') },
    { action: 'duplicate' as const, cause: 'google_chose_other' as const, total: count('google_chose_other') },
    { action: 'duplicate' as const, cause: 'duplicate_no_canonical' as const, total: count('duplicate_no_canonical') },
    { action: 'quality' as const, cause: 'crawled_not_indexed' as const, total: Math.max(count('crawled_not_indexed'), quality.length) },
  ].filter((x) => x.total > 0);
  const freeze = run.freeze === true || String(run.freeze) === 'true';
  return {
    on: settings.on,
    runAt: String(run.run_at),
    freeze: { on: freeze, reason: String(run.freeze_reason ?? '') },
    siteFix: [],
    other,
    quality: quality
      .filter((p) => p.url && String(p.state) !== 'indexed')
      .sort((a, b) => (Number(b.impressions_28d) || 0) - (Number(a.impressions_28d) || 0) || (Number(b.clicks_28d) || 0) - (Number(a.clicks_28d) || 0))
      .slice(0, 3)
      .map((p) => ({ url: String(p.url), title: String(p.title ?? '').slice(0, 200), impressions28d: Number(p.impressions_28d) || 0 })),
  };
}

/** The cause a task key names, for the recommendations (re-exported for one import). */
export const causeOfTaskKey = (key: string): IndexSiteFixCause | null => indexingCauseOfKey(key);
