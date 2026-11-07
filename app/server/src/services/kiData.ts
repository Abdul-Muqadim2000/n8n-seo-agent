// KI A1 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §7, fixes/A1_ROUTES.md): the keyword-intelligence reads and writes of the app.
//
// The engine's four KI tables are keyed by domain, like every dashboard table, so the isolation is the route's: the website belongs to the company
// (siteAccess) and the company proved it owns the domain (requireVerified). Every read below filters by that domain in the request to n8n AND
// again on the rows that come back (a row of another domain is never mapped). The website's switch (seo_monitors.ki_mode) and the kill switch
// (seo_cache ki:kill, a read error = on) decide whether anything is shown at all; when not, the routes answer 404 as for an unknown website.
//
// Performance (owner's rule, 2026-11-08): one read of each table per website per minute (services/ki.ts kiCache, emptied by a KI callback,
// a status change and the mode switch), mapped once into the views of shared/src/ki-api.ts; filters, sort and paging run on the mapped rows.

import {
  AI_PANEL_LIMITS,
  aiPanelSize,
  isClientRole,
  KI_APPROVE_MAX,
  KI_KILL_KEY,
  kiBrandTokens,
  kiCompetitorOrder,
  kiCompetitorView,
  kiFacetsOf,
  kiGapView,
  kiKeywordComparator,
  kiKeywordMatches,
  kiKeywordView,
  kiKilled,
  kiMaxCompetitorsOf,
  kiModeOf,
  kiPage,
  kiQuestionText,
  kiQuickWin,
  kiRunView,
  kiSummaryOf,
  kiVisible,
  n8nSiteId,
  normKeyword,
  roleAtLeast,
  type AiPromptRow,
  type KiCompetitorRow,
  type KiCompetitorsResponse,
  type KiCompetitorView,
  type KiCompUserStatus,
  type KiGapRow,
  type KiGapStatus,
  type KiGapsResponse,
  type KiGapView,
  type KiKeywordQuery,
  type KiKeywordRow,
  type KiKeywordsResponse,
  type KiKeywordView,
  type KiMode,
  type KiOverview,
  type KiQuestionsApproveResult,
  type KiRunRow,
  type KiRunView,
  type KiStage,
  type MonitorsRow,
  type NeedsYouItem,
  type Recommendation,
  type Role,
  type RunInput,
  type ScoreInput,
} from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import type { SiteRow, UserRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { invalidateSite, rows, siteAdmin, siteRows } from '../n8n/client';
import { settingsRow } from './admin/settings';
import { quoteCredits } from './billing';
import { invalidateKi, KI_CACHE_MS, kiCache } from './ki';
import { estimateCost } from './runs';

/** How many rows of each table one read takes at most (a website can hold thousands of keywords). */
export const KI_READ_MAX = { competitors: 2000, keywords: 20000, gaps: 5000, runs: 40 } as const;

// ---------------------------------------------------------------------------------------------------------------------------
// the switch: who sees what
// ---------------------------------------------------------------------------------------------------------------------------

export interface KiState {
  /** the stored mode */
  mode: KiMode;
  killed: boolean;
  admin: boolean;
  visible: boolean;
  maxCompetitors: number;
  monitors: MonitorsRow | null;
}

/** The website's KI state for this person. 502 when the engine's settings cannot be read (nothing is shown or started). */
export async function kiState(site: Pick<SiteRow, 'domain'>, user: UserRow | null): Promise<KiState> {
  const mons = await siteRows<MonitorsRow>('monitors', site.domain, { max: 5 }).catch(() => null);
  if (!mons) throw new HttpError(502, 'The SEO engine could not be read right now. Please try again in a minute.', 'engine_unreachable');
  const row = mons.find((m) => String(m.domain ?? '').toLowerCase() === site.domain.toLowerCase()) ?? null;
  const mode = kiModeOf(row?.ki_mode);
  const admin = isPlatformAdmin(user);
  // the kill switch only matters where something could be shown: an Off website reads nothing more (every existing page as before)
  const killed = mode === 'off' ? false : await kiKillSwitch();
  return { mode, killed, admin, visible: !killed && kiVisible(mode, admin), maxCompetitors: kiMaxCompetitorsOf(row?.ki_max_competitors), monitors: row };
}

/** seo_cache `ki:kill` = 1, or unreadable: every KI read behaves as Off (fails closed, CONTRACTS §1). */
export async function kiKillSwitch(): Promise<boolean> {
  try {
    return kiKilled(await rows<{ key?: unknown; value?: unknown }>('cache', { filters: [{ columnName: 'key', condition: 'eq', value: KI_KILL_KEY }], max: 3 }));
  } catch {
    return true;
  }
}

/** The data routes: 404 (as for a website that does not exist) unless the KI pages are visible to this person. */
export function requireKiVisible(st: KiState): void {
  if (!st.visible) throw notFound('Not found');
}

// ---------------------------------------------------------------------------------------------------------------------------
// the reads (cached per website, mapped once)
// ---------------------------------------------------------------------------------------------------------------------------

export interface KiData {
  competitors: KiCompetitorView[];
  keywords: KiKeywordView[];
  gaps: KiGapView[];
  runs: KiRunView[];
  /** the raw keyword rows by kw_key, for include=serp and the question approval */
  keywordRows: Map<string, KiKeywordRow>;
}

const sameDomain = (d: string) => (r: { domain?: unknown }) => String(r?.domain ?? '').trim().toLowerCase() === d;

export async function kiData(site: Pick<SiteRow, 'domain' | 'brandNames'>): Promise<KiData> {
  const d = site.domain.toLowerCase();
  const tokens = kiBrandTokens(d, site.brandNames ?? []);
  const key = `${d}|${tokens.join(',')}`;
  const hit = kiCache.get(key);
  if (hit && Date.now() - hit.at < KI_CACHE_MS) return hit.value as KiData;
  const [c, k, g, r] = await Promise.all([
    siteRows<KiCompetitorRow>('kiCompetitors', site.domain, { max: KI_READ_MAX.competitors }),
    siteRows<KiKeywordRow>('kiKeywords', site.domain, { max: KI_READ_MAX.keywords }),
    siteRows<KiGapRow>('kiGaps', site.domain, { max: KI_READ_MAX.gaps }),
    siteRows<KiRunRow>('kiRuns', site.domain, { sortBy: 'started_at:desc', max: KI_READ_MAX.runs }),
  ]).catch((err) => {
    throw err instanceof HttpError ? err : new HttpError(502, 'The SEO engine could not be read right now. Please try again in a minute.', 'engine_unreachable');
  });
  const own = sameDomain(d);
  const kRows = k.filter(own);
  const value: KiData = {
    competitors: c.filter(own).map(kiCompetitorView).filter((x) => x.compDomain).sort(kiCompetitorOrder),
    keywords: kRows.map((x) => kiKeywordView(x, tokens)).filter((x) => x.kwKey && x.keyword),
    gaps: g.filter(own).map(kiGapView).filter((x) => x.gapId),
    runs: r.filter(own).map(kiRunView).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    keywordRows: new Map(kRows.map((x) => [String(x.kw_key ?? ''), x])),
  };
  kiCache.set(key, { at: Date.now(), value });
  return value;
}

/** The market the pages show: the one asked for, else the newest run that delivered, else the commonest among the keywords; null = all. */
export function kiMarketFor(data: Pick<KiData, 'runs' | 'keywords' | 'competitors'>, asked?: string): string | null {
  if (asked) return asked;
  const run = data.runs.find((r) => (r.status === 'ok' || r.status === 'partial') && r.market);
  if (run) return run.market;
  const n = new Map<string, number>();
  for (const x of [...data.keywords, ...data.competitors]) if (x.market) n.set(x.market, (n.get(x.market) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
const inMarket = (m: string | null) => <T extends { market: string }>(x: T) => !m || !x.market || x.market === m;

// ---------------------------------------------------------------------------------------------------------------------------
// GET .../ki
// ---------------------------------------------------------------------------------------------------------------------------

/** The quotes of the two runs, the run path's own (estimateCost + quoteCredits): never a different number from the one the run is charged against. */
export async function kiCredits(site: Pick<SiteRow, 'domain'>): Promise<KiOverview['credits']> {
  const st = await settingsRow();
  const q = async (mode: 'competitors' | 'keyword_research') => quoteCredits(await estimateCost({ mode } as unknown as RunInput, site), st);
  const [competitors, research] = await Promise.all([q('competitors'), q('keyword_research')]);
  return { competitors, research };
}

export async function kiOverview(site: SiteRow, user: UserRow | null, role: Role, st: KiState, market?: string): Promise<KiOverview> {
  const credits = await kiCredits(site);
  const base = {
    mode: st.admin ? st.mode : st.mode === 'on' ? ('on' as const) : ('off' as const),
    visible: st.visible,
    ...(st.admin ? { killed: st.killed } : {}),
    canSwitch: st.admin,
    canAct: st.visible && roleAtLeast(role, 'member') && !isClientRole(role),
    maxCompetitors: st.maxCompetitors,
    credits,
  };
  if (!st.visible) return { ...base, lastRuns: [], summary: null };
  const data = await kiData(site);
  const m = kiMarketFor(data, market);
  const f = inMarket(m);
  const lastRuns = [...data.runs.filter((r) => r.kind === 'competitors').slice(0, 3), ...data.runs.filter((r) => r.kind === 'keyword_research').slice(0, 3)]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { ...base, lastRuns, summary: kiSummaryOf(m, data.competitors.filter(f), data.keywords.filter(f), data.gaps.filter(f)) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// lists
// ---------------------------------------------------------------------------------------------------------------------------

export function kiCompetitorsOf(data: KiData, st: Pick<KiState, 'maxCompetitors'>, q: { market?: string; status?: string; class?: string }): KiCompetitorsResponse {
  const m = kiMarketFor(data, q.market);
  const all = data.competitors.filter(inMarket(m));
  const items = all.filter((c) => (!q.status || c.status === q.status) && (!q.class || c.class === q.class));
  return { market: m, maxCompetitors: st.maxCompetitors, chosen: all.filter((c) => c.status === 'chosen').length, items };
}

/** The keyword rows of one query, filtered and sorted (every page and the CSV read the same list). */
export function kiKeywordList(data: KiData, q: KiKeywordQuery): { market: string | null; all: KiKeywordView[]; list: KiKeywordView[] } {
  const m = kiMarketFor(data, q.market);
  const all = data.keywords.filter(inMarket(m));
  const list = all.filter((v) => kiKeywordMatches(v, q)).sort(kiKeywordComparator(q.sort));
  return { market: m, all, list };
}

export function kiKeywordsOf(data: KiData, q: KiKeywordQuery): KiKeywordsResponse {
  const { market, all, list } = kiKeywordList(data, q);
  const page = kiPage(list, q.page, q.pageSize);
  const items = q.includeSerp
    ? page.items.map((v) => {
        const raw = data.keywordRows.get(v.kwKey);
        return raw ? { ...v, top10: kiKeywordView(raw, [], true).top10 } : v;
      })
    : page.items;
  return { market, total: page.total, page: page.page, pageSize: page.pageSize, pages: page.pages, sort: q.sort, items, facets: kiFacetsOf(all) };
}

export function kiGapList(data: KiData, q: { market?: string; type?: string; status?: string }): { market: string | null; all: KiGapView[]; list: KiGapView[] } {
  const m = kiMarketFor(data, q.market);
  const all = data.gaps.filter(inMarket(m));
  const list = all.filter((g) => (!q.type || g.type === q.type) && (!q.status || g.status === q.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.gapId.localeCompare(b.gapId));
  return { market: m, all, list };
}

export function kiGapsOf(data: KiData, q: { market?: string; type?: string; status?: string; page: number; pageSize: number }): KiGapsResponse {
  const { market, all, list } = kiGapList(data, q);
  const page = kiPage(list, q.page, q.pageSize);
  const byType: KiGapsResponse['byType'] = {};
  const byStatus: KiGapsResponse['byStatus'] = {};
  for (const g of all) {
    byType[g.type] = (byType[g.type] ?? 0) + 1;
    byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
  }
  return { market, total: page.total, page: page.page, pageSize: page.pageSize, pages: page.pages, items: page.items, byType, byStatus };
}

/** CSV in chunks of 500 rows (the response is streamed, never built as one string). */
export function* kiCsvChunks<T>(header: readonly string[], items: readonly T[], line: (x: T) => string, chunk = 500): Generator<string> {
  yield header.join(',') + '\r\n';
  for (let i = 0; i < items.length; i += chunk) yield items.slice(i, i + chunk).map(line).join('');
}

// ---------------------------------------------------------------------------------------------------------------------------
// writes (through Site Admin, CONTRACTS §5)
// ---------------------------------------------------------------------------------------------------------------------------

const base = (site: Pick<SiteRow, 'domain'>, action: string) => ({ domain: site.domain, site_id: n8nSiteId(site.domain), request_id: `app-${action}-${Date.now().toString(36)}` });
const done = (site: Pick<SiteRow, 'domain'>) => {
  invalidateKi(site.domain);
  invalidateSite(site.domain);
};

export async function setCompetitorStatus(site: SiteRow, st: KiState, compDomain: string, status: KiCompUserStatus): Promise<{ ok: true; compDomain: string; status: KiCompUserStatus; chosen: number; maxCompetitors: number }> {
  const data = await kiData(site);
  const rowsOf = data.competitors.filter((c) => c.compDomain === compDomain);
  if (!rowsOf.length) throw notFound(`${compDomain} is not in your competitor list.`);
  const row = rowsOf[0];
  const market = row.market;
  const chosenNow = data.competitors.filter((c) => c.status === 'chosen' && c.market === market && c.compDomain !== compDomain).length;
  if (status === 'chosen' && chosenNow >= st.maxCompetitors)
    throw new HttpError(409, `You can choose up to ${st.maxCompetitors} competitors. Move one to your watchlist or mark it as not a competitor first.`, 'ki_max_competitors', undefined, { max: st.maxCompetitors });
  const r = await siteAdmin({ ...base(site, 'ki_competitor'), action: 'ki_competitor', market, comp_domain: compDomain, status });
  done(site);
  if (!r.ok) {
    if (/max|limit|up to/i.test(String(r.error ?? ''))) throw new HttpError(409, `You can choose up to ${st.maxCompetitors} competitors. Move one to your watchlist or mark it as not a competitor first.`, 'ki_max_competitors', undefined, { max: st.maxCompetitors });
    throw new HttpError(502, r.error || 'The SEO engine could not save the change.', 'admin_failed');
  }
  if (r.affected === 0) throw notFound(`${compDomain} is not in your competitor list.`);
  return { ok: true, compDomain, status, chosen: chosenNow + (status === 'chosen' ? 1 : 0), maxCompetitors: st.maxCompetitors };
}

export async function setGapStatus(site: SiteRow, gapId: string, status: KiGapStatus): Promise<{ ok: true; gapId: string; status: KiGapStatus }> {
  const data = await kiData(site);
  if (!data.gaps.some((g) => g.gapId === gapId)) throw notFound('This gap is not in your list.');
  const r = await siteAdmin({ ...base(site, 'ki_gap'), action: 'ki_gap', gap_id: gapId, status });
  done(site);
  if (!r.ok) throw new HttpError(502, r.error || 'The SEO engine could not save the change.', 'admin_failed');
  if (r.affected === 0) throw notFound('This gap is not in your list.');
  return { ok: true, gapId, status };
}

/** The KI stage as the AI panel's buyer stage (aiQuestionSchema). */
const PANEL_STAGE: Record<KiStage, 'decision' | 'consideration' | 'awareness'> = { hire: 'decision', compare: 'decision', solution: 'consideration', problem: 'awareness', info: 'awareness' };

/**
 * Buyer questions into the AI question panel, as the owner's own (Site Admin `ai_prompts` add, the panel manager's path): no paid run. The
 * panel asks the owner's own questions first, so only as many are added as the panel has room for (its size minus the owner's own questions
 * already on it); the rest come back as `panel_full`. Gated rows, texts that are not questions and questions already on the panel are skipped.
 */
export async function approveQuestions(site: SiteRow, st: KiState, keys: readonly string[]): Promise<KiQuestionsApproveResult> {
  const data = await kiData(site);
  const prompts = await siteRows<AiPromptRow>('aiPrompts', site.domain, { max: AI_PANEL_LIMITS.max * 4, fresh: true }).then((r) => r.filter(sameDomain(site.domain.toLowerCase())));
  const live = prompts.filter((p) => !['off', 'refused', 'retired'].includes(String(p.status || 'active')));
  const onPanel = new Set(live.map((p) => normKeyword(String(p.prompt ?? '').replace(/\?+\s*$/, ''))));
  const own = live.filter((p) => p.source === 'custom' || p.pinned === true).length;
  const size = aiPanelSize({ siteId: st.monitors?.site_id ? String(st.monitors.site_id) : site.domain, promptsMax: st.monitors?.ai_prompts_max ?? null });
  let room = Math.max(0, size - own);
  const added: KiQuestionsApproveResult['added'] = [];
  const skipped: KiQuestionsApproveResult['skipped'] = [];
  const seen = new Set<string>();
  const add: Record<string, unknown>[] = [];
  for (const kwKey of keys.slice(0, KI_APPROVE_MAX)) {
    if (seen.has(kwKey)) { skipped.push({ kwKey, reason: 'duplicate' }); continue; }
    seen.add(kwKey);
    const v = data.keywords.find((k) => k.kwKey === kwKey);
    if (!v) { skipped.push({ kwKey, reason: 'not_found' }); continue; }
    if (v.gate === 'fail') { skipped.push({ kwKey, reason: 'gated' }); continue; }
    if (!v.question) { skipped.push({ kwKey, reason: 'not_a_question' }); continue; }
    const question = kiQuestionText(v.keyword);
    const norm = normKeyword(question.replace(/\?+\s*$/, ''));
    if (onPanel.has(norm)) { skipped.push({ kwKey, reason: 'already_on_panel' }); continue; }
    if (room <= 0) { skipped.push({ kwKey, reason: 'panel_full' }); continue; }
    room--;
    onPanel.add(norm);
    added.push({ kwKey, question });
    add.push({ prompt: question, persona: '', cluster: '', stage: v.stage ? PANEL_STAGE[v.stage] : '', market: /^[A-Z]{2}-[a-z]{2,3}$/.test(v.market) ? v.market : '', pinned: false, keyword: v.keyword.slice(0, 120) });
  }
  if (add.length) {
    const r = await siteAdmin({ ...base(site, 'ai_prompts'), action: 'ai_prompts', add, remove: [], enable: [], pin: [], unpin: [], accept: [], retire: [], edit: [] });
    invalidateSite(site.domain);
    if (!r.ok) throw new HttpError(502, r.error || 'The SEO engine could not add the questions.', 'admin_failed');
  }
  return { added, skipped, panelSize: size, ownOnPanel: own + added.length };
}

/** PATCH .../ki/mode: writes Site Admin `monitors` {ki_mode} only, then reads the stored value back. */
export async function setKiMode(site: SiteRow, mode: KiMode): Promise<{ ok: true; mode: KiMode }> {
  const r = await siteAdmin({ ...base(site, 'monitors'), action: 'monitors', monitors: { ki_mode: mode } });
  invalidateKi(site.domain);
  invalidateSite(site.domain);
  if (!r.ok) throw new HttpError(502, r.error || 'The SEO engine could not save the change.', 'admin_failed');
  const back = await siteRows<MonitorsRow>('monitors', site.domain, { max: 5, fresh: true }).catch(() => null);
  const row = back?.find((m) => String(m.domain ?? '').toLowerCase() === site.domain.toLowerCase());
  const stored = kiModeOf(row?.ki_mode);
  if (!row || stored !== mode) throw new HttpError(502, 'The SEO engine did not keep the change. Please try again in a minute.', 'admin_failed');
  return { ok: true, mode: stored };
}

// ---------------------------------------------------------------------------------------------------------------------------
// recommendations and Needs you (On websites only, never Off or Trial)
// ---------------------------------------------------------------------------------------------------------------------------

export interface KiForRecs {
  competitorsFound: number;
  confirmed: boolean;
  quickWins: number;
  market: string | null;
}

/** null unless the website is On (and the kill switch off): Trial and Off add nothing anywhere. */
export async function kiForRecs(site: SiteRow): Promise<KiForRecs | null> {
  const st = await kiState(site, null);
  if (st.mode !== 'on' || st.killed) return null;
  const data = await kiData(site);
  const m = kiMarketFor(data, undefined);
  const f = inMarket(m);
  const comps = data.competitors.filter(f).filter((c) => c.class === 'direct' || c.class === 'adjacent');
  return { competitorsFound: comps.length, confirmed: data.competitors.some((c) => c.statusBy === 'user'), quickWins: data.keywords.filter(f).filter(kiQuickWin).length, market: m };
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function kiRecommendations(k: KiForRecs | null | undefined): { rec: Recommendation; score?: ScoreInput }[] {
  if (!k) return [];
  const out: { rec: Recommendation; score?: ScoreInput }[] = [];
  if (!k.confirmed)
    out.push({
      rec: {
        id: 'ki:competitors',
        category: 'rankings',
        priority: 'medium',
        title: 'Choose your competitors',
        detail: k.competitorsFound
          ? `We found ${plural(k.competitorsFound, 'business', 'businesses')} that show up for the same services as you. Choose up to 5 so your keyword research compares you with the right ones.`
          : 'Find the businesses that show up for the same services as you, then choose up to 5 so your keyword research compares you with the right ones.',
        action: { label: k.competitorsFound ? 'Choose competitors' : 'Find competitors', page: 'competitors' },
      },
    });
  if (k.quickWins > 0)
    out.push({
      rec: {
        id: 'ki:quick-wins',
        category: 'rankings',
        priority: 'high',
        title: `${plural(k.quickWins, 'quick win')} found`,
        detail: 'Searches where your website already shows near the top of Google. A better page for each is the shortest way to more visits.',
        action: { label: 'See the quick wins', page: 'keywords' },
      },
    });
  return out;
}

export function kiNeedsYou(k: KiForRecs | null | undefined): NeedsYouItem[] {
  return kiRecommendations(k).map(({ rec }) => ({
    id: rec.id,
    kind: 'ki' as const,
    severity: 'info' as const,
    title: rec.title,
    detail: rec.detail,
    action: rec.action?.page ? { label: rec.action.label, page: rec.action.page } : null,
  }));
}

/** Exported for the tests: the org part of the isolation is the route's siteAccess; this is the domain part. */
export const kiOwnRow = (domain: string) => sameDomain(domain.toLowerCase());

// ---------------------------------------------------------------------------------------------------------------------------
// API v1 / MCP get_table: the four KI tables, read-only, for an On website of the key's company only (never Trial, never Off)
// ---------------------------------------------------------------------------------------------------------------------------

export const KI_V1_TABLES = { ki_competitors: 'kiCompetitors', ki_keywords: 'kiKeywords', ki_gaps: 'kiGaps', ki_runs: 'kiRuns' } as const;
export type KiV1Table = keyof typeof KI_V1_TABLES;
export const isKiV1Table = (t: unknown): t is KiV1Table => typeof t === 'string' && Object.prototype.hasOwnProperty.call(KI_V1_TABLES, t);
const V1_DROP = new Set(['id', 'createdAt', 'updatedAt']);

/**
 * One page of a KI table as stored (JSON columns stay strings, as in the engine's table), with the company's ids beside each row. A website
 * that is not On answers exactly like an unknown table, so a key never learns that a Trial exists.
 */
export async function kiTableRowsV1(
  org: { id: string },
  site: SiteRow,
  table: KiV1Table,
  q: Record<string, unknown>,
  page: <T>(all: readonly T[], cursor: unknown, limit: unknown) => { items: T[]; nextCursor: string | null },
): Promise<{ table: string; columns: { name: string; type: string; description: string }[]; items: Record<string, unknown>[]; nextCursor: string | null }> {
  const st = await kiState(site, null);
  if (st.mode !== 'on' || st.killed) throw notFound('Unknown table: use one of rank_history, site_metrics, audit_findings, ai_visibility, backlinks, runs');
  const key = KI_V1_TABLES[table];
  const raw = await siteRows<Record<string, unknown>>(key, site.domain, { max: key === 'kiKeywords' ? KI_READ_MAX.keywords : KI_READ_MAX.gaps });
  const own = sameDomain(site.domain.toLowerCase());
  const exportedAt = new Date().toISOString();
  const all = raw.filter(own).map((r) => ({
    company_id: org.id,
    website_id: site.id,
    website_domain: site.domain,
    exported_at: exportedAt,
    ...Object.fromEntries(Object.entries(r).filter(([k]) => !V1_DROP.has(k))),
  }));
  const p = page(all, q.cursor, q.limit);
  const cols = all[0] ? Object.keys(all[0]) : ['company_id', 'website_id', 'website_domain', 'exported_at'];
  return { table, columns: cols.map((name) => ({ name, type: 'STRING', description: name.endsWith('_json') ? 'JSON, as the engine stores it' : '' })), items: p.items, nextCursor: p.nextCursor };
}
