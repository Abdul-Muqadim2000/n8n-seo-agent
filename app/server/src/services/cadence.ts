import {
  LADDER_SITE_ROW,
  type AiTargetRow,
  normKeyword,
  type ContentLogRow,
  type LadderMode,
  type LadderRow,
  type LadderSettingsRow,
  type PlanType,
  type QueryRow,
  type QueueItem,
  type RankHistoryRow,
  type SitePageRow,
  type TrendRow,
} from '@seo/shared';

// The app's mirror of the Content Cadence (n8n/seo-agent/v5/code/Cadence_Plan.js, v4.8 — the source of truth): which pages the
// Monday run writes for one website, and why it writes nothing. Pure functions, rule for rule the same as n8n, so the Pipeline page
// ("This week", the ladder cards' next step, Needs you) never says a page will be written when n8n would not write it:
// - per ladder (seo_ladder_settings; no row = the website's default mode, else Auto; status active; priority by oldest start date):
//   only Auto ladders with status active / queued that are not won are written; the max_active highest-priority ones that still
//   have planned pages are active, the others wait (queued). Ladder 1's eligible pages come before ladder 2's; inside a ladder by
//   rung, then page number; a Direct plan writes the main page (rung 4) first;
// - main-page gate (not Direct): the main page waits until half of the supporting pages are published (ladder row 'published' or a
//   content-log row with a published_url), or the main keyword's latest valid rank check is 1-30;
// - won: the main keyword in the top 3 in each of the last 4 valid checks (failed checks, -1, skipped), or status 'won';
// - pile-up guard (v4.14, FIX_PLAN D5): max_waiting or more distinct keywords written but not published -> nothing is written that
//   week. A keyword waits when a content-log row of the last 120 days has any status but published (every content run writes one:
//   the ladder's page runs, the app's "Write now", the cadence), or a ladder row is still 'writing' and its keyword has no
//   published page;
// - opportunity posts (Search Console striking distance, then rising Google Trends searches) only when opportunities is Auto;
//   when Manual they are suggestions (the first 5);
// - Manual ladders are never written: each one's next eligible page waits for approval;
// - skips keywords written in the last 90 days (or published), ladder rows marked writing / published, brand queries;
// - v4.12 (AI_GROWTH_SPEC.md): the AI page of the week — the most valuable queued AI target (seo_ai_targets) as a new answer page or a refresh,
//   on top of the blog posts, at most one a week and ai_pages_month a month, not while the pile-up guard holds; Manual opportunities -> a suggestion.
// - v4.15 (D11, SITE_MODEL_SPEC.md): one search, one page — a candidate whose search a LIVE page of the website already answers
//   (the page inventory seo_pages, matched like SM.matchPage in n8n/seo-agent/v5/code/_site_model.js) is never written as a second
//   page: a ladder page becomes a refresh of that page, an opportunity post is left out and named in `coveredByLivePages`.

export const CADENCE = {
  maxPerWeek: 3,
  skipRecentDays: 90,
  strikingMinImpressions: 30,
  strikingMin: 4,
  strikingMax: 20,
  maxActive: 2,
  maxWaiting: 3,
  waitingDays: 120,
  gateHeadPosition: 30,
  wonChecks: 4,
  wonPosition: 3,
  suggestions: 5,
  /** queue entries shown after the coming run's picks (n8n reports 4 as `upcoming`; the app shows a few more) */
  later: 8,
} as const;

const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'] as const;
export type SettingsStatus = (typeof STATUSES)[number];

const norm = normKeyword;
const lc = (v: unknown) => String(v == null ? '' : v).toLowerCase().trim();
const num = (v: unknown) => Number(v) || 0;
const ms = (iso: unknown) => {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : 0;
};
/** n8n's posInt: a whole number >= 1 (capped), else the default ('' and null are "not set") */
export const posInt = (v: unknown, d: number, max: number) => {
  const x = Number(v);
  return v !== '' && v != null && Number.isFinite(x) && x >= 1 ? Math.min(max, Math.floor(x)) : d;
};
// ---- D11: does a live page of the website already answer this search? (SM.matchPage in v5/code/_site_model.js, rule for rule) ----
const PAGE_STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
const pageTokens = (v: unknown) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
/** meaningful words: one-letter parts ("e" of "e invoicing") and stop words never decide a match */
const pageTerms = (v: unknown) => [...new Set(pageTokens(v).filter((t) => t.length > 1 && !PAGE_STOP.has(t)))];
const pagePath = (u: unknown) => String(u || '').replace(/^https?:\/\/[^/]*/i, '') || '/';
export const PAGE_MATCH_MIN = 0.75;
export interface PageMatch { url: string; title: string; matchedBy: 'query' | 'slug' | 'title'; score: number }
/** The page that already answers `keyword`, or null — impressions for the exact query first, then 75% of its words in the slug or title. */
export function matchPage(pages: SitePageRow[], keyword: string): PageMatch | null {
  const want = pageTerms(keyword);
  if (!want.length || !pages.length) return null;
  const key = pageTokens(keyword).join(' ');
  for (const p of pages) {
    let qs: Array<{ query?: string; impressions?: number }> = [];
    try { const x = JSON.parse(String(p.queries_json || '[]')); if (Array.isArray(x)) qs = x; } catch { qs = []; }
    if (qs.some((q) => pageTokens(q?.query).join(' ') === key && (Number(q?.impressions) || 0) > 0)) return { url: p.url, title: p.title || '', matchedBy: 'query', score: 1 };
  }
  let best: PageMatch | null = null;
  for (const p of pages) {
    const slug = pageTerms(pagePath(p.url).replace(/\.[a-z]{2,5}$/i, ''));
    const title = pageTerms(`${p.title || ''} ${p.h1 || ''}`);
    const inSlug = want.filter((t) => slug.includes(t)).length / want.length;
    const inTitle = want.filter((t) => title.includes(t)).length / want.length;
    const score = Math.max(inSlug, inTitle);
    if (score + 1e-9 >= PAGE_MATCH_MIN && (!best || score > best.score))
      best = { url: p.url, title: p.title || '', matchedBy: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100 };
  }
  return best;
}
const isTop = (l: LadderRow) => Number(l.rung) === 4;
const byRung = (a: LadderRow, b: LadderRow) => num(a.rung) - num(b.rung) || num(a.page_no) - num(b.page_no);

export interface CadenceInput {
  domain: string;
  /** seo_cadence pages per week (0 or off: the Monday run skips the website) */
  pagesPerWeek: number;
  ladders: LadderRow[];
  queries: QueryRow[];
  trends: TrendRow[];
  logs: ContentLogRow[];
  settings: LadderSettingsRow[];
  /** the website's rank checks (the main keywords' rows are used) */
  history: RankHistoryRow[];
  /** v4.12: the AI growth loop's targets (queued ones are written) and the AI pages a month (0 = none, or AI visibility / growth off) */
  aiTargets?: AiTargetRow[];
  aiPagesPerMonth?: number;
  /** v4.15 (D11): the website's page inventory (seo_pages) — the pages it already has */
  pages?: SitePageRow[];
}

/** The website's defaults as n8n reads them from the '_site' row. */
export interface CadenceSiteConfig {
  mode: LadderMode;
  opportunities: LadderMode;
  maxActive: number;
  maxWaiting: number;
}

export function cadenceSiteConfig(settings: LadderSettingsRow[]): CadenceSiteConfig {
  const r = settings.find((x) => String(x.ladder_id) === LADDER_SITE_ROW);
  return {
    mode: lc(r?.mode) === 'manual' ? 'manual' : 'auto',
    opportunities: lc(r?.opportunities) === 'manual' ? 'manual' : 'auto',
    maxActive: posInt(r?.max_active, CADENCE.maxActive, 20),
    maxWaiting: posInt(r?.max_waiting, CADENCE.maxWaiting, 100),
  };
}

export interface CadenceLadder {
  id: string;
  head: string;
  mode: LadderMode;
  status: SettingsStatus;
  planType: PlanType | '';
  /** settings priority (>= 1), null when not set */
  priority: number | null;
  start: string;
  /** the main keyword's latest valid check (0 = not in the top 50), null before the first one */
  headPosition: number | null;
  won: boolean;
  supporting: number;
  published: number;
  gateOpen: boolean;
  /** the gated main page is all that is left to write */
  mainWaiting: boolean;
  /** pages still to write, in writing order (the gated main page included) */
  remaining: QueueItem[];
  /** pages that may be written now (remaining without the gated main page) */
  eligible: QueueItem[];
  /** what the coming run does with it */
  role: 'active' | 'queued' | 'manual' | 'paused' | 'won' | 'done';
}

export interface CadencePlan {
  config: CadenceSiteConfig;
  /** the posts the run writes, in order (empty when posts are off or the pile-up guard holds) */
  picks: QueueItem[];
  /** every candidate in order (ladder pages of the active ladders, then opportunity posts when Auto), each keyword once */
  candidates: QueueItem[];
  /** opportunity posts while opportunities is Manual (nothing written) */
  suggestions: QueueItem[];
  /** each Manual ladder's next page, waiting for the person's OK */
  awaitingApproval: QueueItem[];
  ladders: CadenceLadder[];
  queued: string[];
  won: string[];
  /** ladders whose gated main page is all that is left */
  waitingForSupport: string[];
  pausedReason: '' | 'pileup';
  /** distinct keywords written and not published (the pile-up count) */
  waitingPublish: number;
  /** those keywords, oldest first (v4.14, D5: ladder pages included) */
  waitingKeywords: string[];
  /** v4.15 (D11): candidates a live page of the website already answers (refreshed or left out, never written as a second page) */
  coveredByLivePages: Array<{ keyword: string; source: QueueItem['source']; url: string }>;
}

function ladderItem(l: LadderRow): QueueItem {
  const rung = num(l.rung);
  return {
    keyword: l.keyword,
    source: 'ladder',
    why: `Keyword ladder “${l.head_keyword || ''}”, ${rung === 4 ? 'the main page' : `rung ${rung}`}: the next planned page towards the main keyword`,
    pageType: l.page_type || 'Service Page',
    existingPageUrl: l.page_exists === true || String(l.page_exists) === 'true' ? l.target_url || '' : '',
    ladder: { id: l.ladder_id, rung, head: l.head_keyword || '', pageNo: num(l.page_no) },
  };
}

/** The Content Cadence's plan for one website at `now` (one Monday run). */
export function planCadence(input: CadenceInput, now: number): CadencePlan {
  const cfg = cadenceSiteConfig(input.settings);
  const pages = Math.min(CADENCE.maxPerWeek, Math.max(0, Math.floor(Number(input.pagesPerWeek) || 0)));
  const logs = input.logs.filter((l) => l && l.keyword);
  const recent = new Set(logs.filter((l) => l.status === 'published' || now - ms(l.started_at) < CADENCE.skipRecentDays * 864e5).map((l) => norm(l.keyword)));
  const publishedKw = new Set(logs.filter((l) => l.published_url).map((l) => norm(l.keyword)));
  const lrows = input.ladders.filter((l) => l && l.ladder_id && l.keyword).sort(byRung);
  const ladderKw = new Set(lrows.map((l) => norm(l.keyword)));
  for (const l of lrows) if (l.status === 'writing' || l.status === 'published') recent.add(norm(l.keyword));
  const open = (l: LadderRow) => String(l.status || 'planned') === 'planned' && !recent.has(norm(l.keyword));
  const settingOf = new Map(input.settings.filter((r) => r.ladder_id && String(r.ladder_id) !== LADDER_SITE_ROW).map((r) => [String(r.ladder_id), r]));

  const groups = new Map<string, LadderRow[]>();
  for (const l of lrows) groups.set(l.ladder_id, [...(groups.get(l.ladder_id) ?? []), l]);
  const info = [...groups.entries()]
    .map(([id, rows]) => {
      const st = settingOf.get(String(id)) ?? null;
      const top = rows.find(isTop) ?? null;
      const head = top?.keyword || rows[0].head_keyword || '';
      const mode: LadderMode = st && (lc(st.mode) === 'auto' || lc(st.mode) === 'manual') ? (lc(st.mode) as LadderMode) : cfg.mode;
      const status: SettingsStatus = st && (STATUSES as readonly string[]).includes(lc(st.status)) ? (lc(st.status) as SettingsStatus) : 'active';
      const planType: PlanType | '' = st && ['direct', 'short', 'full'].includes(lc(st.plan_type)) ? (lc(st.plan_type) as PlanType) : '';
      const prio = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
      const start = rows.map((r) => String(r.start_date || '')).filter(Boolean).sort()[0] || String(st?.created_at || '');
      // failed checks (-1) are "check again", not a position
      const hist = input.history
        .filter((h) => String(h.ladder_id) === String(id) && norm(h.keyword) === norm(head) && String(h.position) !== '' && h.position != null && Number.isFinite(Number(h.position)) && Number(h.position) >= 0)
        .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
      const headPosition = hist.length ? Number(hist[0].position) : null;
      const lastN = hist.slice(0, CADENCE.wonChecks);
      const won = lastN.length >= CADENCE.wonChecks && lastN.every((h) => Number(h.position) >= 1 && Number(h.position) <= CADENCE.wonPosition);
      const support = rows.filter((r) => !isTop(r));
      const published = support.filter((r) => r.status === 'published' || publishedKw.has(norm(r.keyword))).length;
      const gateOpen = planType === 'direct' || !support.length || published * 2 >= support.length || (headPosition != null && headPosition >= 1 && headPosition <= CADENCE.gateHeadPosition);
      const ordered = planType === 'direct' ? [...rows.filter(isTop), ...rows.filter((r) => !isTop(r))] : rows;
      const remaining = ordered.filter(open);
      const eligible = remaining.filter((r) => !isTop(r) || gateOpen);
      const mainWaiting = !gateOpen && remaining.some(isTop) && !eligible.length;
      return { id, head, mode, status, planType, prio, start, headPosition, won, supporting: support.length, published, gateOpen, mainWaiting, remaining, eligible };
    })
    .sort((a, b) => a.prio - b.prio || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

  const writable = info.filter((x) => (x.status === 'active' || x.status === 'queued') && !x.won);
  const autoL = writable.filter((x) => x.mode === 'auto' && x.remaining.length);
  const active = autoL.slice(0, cfg.maxActive);
  const queued = autoL.slice(cfg.maxActive);
  const manualL = writable.filter((x) => x.mode === 'manual');

  const cands: QueueItem[] = [];
  for (const x of active) for (const l of x.eligible) cands.push(ladderItem(l));

  // ---- opportunity posts: striking distance (Search Console), then rising searches (Google Trends) ----
  const opps: QueueItem[] = [];
  const sq = input.queries.filter((q) => q && q.query);
  const latest = sq.reduce((m, q) => (String(q.period_end) > m ? String(q.period_end) : m), '');
  const brand = input.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const strikes = sq
    .filter(
      (q) =>
        String(q.period_end) === latest &&
        Number(q.position) >= CADENCE.strikingMin &&
        Number(q.position) <= CADENCE.strikingMax &&
        Number(q.impressions) >= CADENCE.strikingMinImpressions &&
        !(brand.length >= 4 && norm(q.query).replace(/\s/g, '').includes(brand)) &&
        !recent.has(norm(q.query)) &&
        !ladderKw.has(norm(q.query)),
    )
    .sort((a, b) => Number(b.impressions) - Number(a.impressions));
  for (const q of strikes)
    opps.push({
      keyword: q.query,
      source: 'striking',
      why: `Ranks #${Math.round(Number(q.position))} with ${q.impressions} impressions in 28 days (Search Console): one push from the top 3`,
      pageType: q.page && !/\/(blog|news|insights|articles)\//i.test(q.page) ? 'Service Page' : 'Guide',
      existingPageUrl: q.page || '',
      ladder: null,
    });
  const rising = input.trends.filter((t) => t && t.direction === 'rising' && t.rising);
  const latestT = rising.reduce((m, t) => (String(t.checked_at) > m ? String(t.checked_at) : m), '');
  for (const t of rising.filter((x) => String(x.checked_at) === latestT))
    for (const rq of String(t.rising)
      .split(',')
      .map((x) => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase())
      .filter(Boolean)) {
      if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some((c) => norm(c.keyword) === norm(rq)) || opps.some((c) => norm(c.keyword) === norm(rq))) continue;
      opps.push({
        keyword: rq,
        source: 'trend',
        why: `Rising related search for “${t.keyword}” (Google Trends, ${t.change_pct > 0 ? '+' : ''}${t.change_pct}% vs the 12-month average)`,
        pageType: 'Guide',
        existingPageUrl: '',
        ladder: null,
      });
    }
  let suggestions: QueueItem[] = [];
  if (cfg.opportunities === 'auto') cands.push(...opps);
  else {
    const sk = new Set<string>();
    suggestions = opps
      .filter((o) => {
        const k = norm(o.keyword);
        if (!k || sk.has(k)) return false;
        sk.add(k);
        return true;
      })
      .slice(0, CADENCE.suggestions);
  }
  // D11: one search, one page — a candidate a live page of the website already answers is refreshed (ladder) or left out (opportunity post)
  const inventory = (input.pages || []).filter((p) => p && p.url);
  const coveredByLivePages: CadencePlan['coveredByLivePages'] = [];
  const seen = new Set<string>();
  const candidates = cands.filter((c) => {
    const k = norm(c.keyword);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    if (c.existingPageUrl) return true;
    const hit = matchPage(inventory, c.keyword);
    if (!hit) return true;
    coveredByLivePages.push({ keyword: c.keyword, source: c.source, url: hit.url });
    if (c.source !== 'ladder') return false;
    c.existingPageUrl = hit.url;
    c.why += ` — ${hit.url} already answers this search, so it is refreshed, not written again`;
    return true;
  });

  // ---- pile-up guard (v4.14, FIX_PLAN D5: Cadence_Plan.js) ----
  // Every page written and not published counts, each keyword once: the content-log rows that say `written` (in the last 120 days) and
  // the ladder rows still 'writing' whose keyword has such a row and no published page.
  // R1 (2026-10-13, the re-rating run): `written` in the content log is the only proof that a page exists. A `started` row is a run that
  // opened the row and never finished, and a ladder row saying `writing` is a promise, not a page — live, a page run the budget guard
  // refused left row 19 "writing" with a `started` log row, and this guard counted it among 6 pages waiting and paused the site.
  const freshW = (t: unknown) => { const x = ms(t); return x > 0 && now - x < CADENCE.waitingDays * 864e5; };
  const isWritten = (l: ContentLogRow) => l.status === 'written' || l.status === 'published' || !!String(l.published_url ?? '').trim();
  const waitingMap = new Map<string, { keyword: string; writtenAt: string }>();
  for (const l of logs) {
    if (l.status !== 'written' || !freshW(l.started_at)) continue;
    const k = norm(l.keyword);
    if (!k || waitingMap.has(k)) continue;
    waitingMap.set(k, { keyword: l.keyword, writtenAt: String(l.started_at || '') });
  }
  for (const l of lrows) {
    if (l.status !== 'writing') continue;
    const k = norm(l.keyword);
    if (!k || waitingMap.has(k) || publishedKw.has(k)) continue;
    // R1: no `written` log row = the page was never written (the engine's refusal path resets such a row to `planned`)
    const lg = logs.filter((r) => norm(r.keyword) === k && isWritten(r)).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] ?? null;
    if (!lg) continue;
    const at = String(lg.started_at || l.start_date || '');
    if (!freshW(at)) continue;
    waitingMap.set(k, { keyword: l.keyword, writtenAt: at });
  }
  const waitingKw = new Set(waitingMap.keys());
  const waitingKeywords = [...waitingMap.values()].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt)).map((w) => w.keyword);
  const pausedReason = pages > 0 && waitingKw.size >= cfg.maxWaiting ? 'pileup' : '';
  const picks = pausedReason ? [] : candidates.slice(0, pages);

  // ---- v4.12: the AI page of the week (Cadence_Plan.js) ----
  const aiQuota = Math.max(0, Math.floor(Number(input.aiPagesPerMonth ?? 0)));
  const isAi = (l: ContentLogRow) => l.source === 'ai_answer' || l.source === 'ai_refresh';
  const monthKey = new Date(now).toISOString().slice(0, 7);
  const aiUsed = logs.filter((l) => isAi(l) && String(l.started_at || '').slice(0, 7) === monthKey).length;
  const aiThisWeek = logs.some((l) => isAi(l) && now - ms(l.started_at) < 6 * 864e5);
  const keyOfU = (u: unknown) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const refreshedRecently = new Set(logs.filter((l) => l.existing_page_url && now - ms(l.started_at) < 60 * 864e5).map((l) => keyOfU(l.existing_page_url)));
  // one search, one page (Cadence_Plan.js): an AI question a keyword-ladder page targets is written AS that page, with the AI target; the
  // words of the site's ladder heads appear everywhere and do not count
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'list', 'guide']);
  const headWords = new Set(lrows.flatMap((l) => norm(l.head_keyword).split(' ')).filter(Boolean));
  const kwTok = (k: string) => [...new Set(norm(k).replace(/\b(e)\b/g, ' ').split(' ').filter((w) => w.length > 2 && !STOPW.has(w) && !headWords.has(w)))];
  const sameSearch = (x: string, y: string) => { const A = kwTok(x), B = new Set(kwTok(y)); return A.length > 0 && B.size > 0 && A.filter((w) => B.has(w)).length / A.length >= 0.6; };
  for (let i = 0; i < picks.length; i++) {
    const pk = picks[i];
    if (pk.source !== 'ladder' || pk.aiTarget) continue;
    const t = (input.aiTargets ?? []).find((x) => x.status === 'queued' && x.kind !== 'refresh' && (sameSearch(x.keyword, pk.keyword) || sameSearch(pk.keyword, x.keyword)));
    if (t) picks[i] = { ...pk, why: `${pk.why} — written to answer “${t.question}” in AI answers`, aiTarget: { targetId: t.target_id, question: t.question, kind: 'answer' } };
  }
  const aiQueue = (input.aiTargets ?? [])
    .filter((t) => t.status === 'queued' && t.keyword && !(t.kind !== 'refresh' && lrows.some((l) => sameSearch(t.keyword, l.keyword) || sameSearch(l.keyword, t.keyword))) && (t.kind === 'refresh' ? !!t.page_url && !refreshedRecently.has(keyOfU(t.page_url)) : !recent.has(norm(t.keyword)) && !ladderKw.has(norm(t.keyword))) && !picks.some((p) => norm(p.keyword) === norm(t.keyword)))
    .sort((a, z) => num(z.value) - num(a.value));
  const aiTop = aiQueue[0];
  const aiItem: QueueItem | null = aiTop
    ? {
        keyword: aiTop.keyword,
        source: aiTop.kind === 'refresh' ? 'ai_refresh' : 'ai_answer',
        why: `AI answers “${aiTop.question}” without you${aiTop.competitors ? ` (it names ${String(aiTop.competitors).split(', ').slice(0, 3).join(', ')})` : ''}${aiTop.kind === 'refresh' ? `: refresh ${aiTop.page_url}` : ': a new answer page'}`,
        pageType: aiTop.kind === 'refresh' ? 'Service Page' : aiTop.page_type || 'Guide',
        existingPageUrl: aiTop.kind === 'refresh' ? aiTop.page_url : '',
        ladder: null,
        aiTarget: { targetId: aiTop.target_id, question: aiTop.question, kind: aiTop.kind === 'refresh' ? 'refresh' : 'answer' },
      }
    : null;
  const aiDue = !!aiItem && aiQuota > aiUsed && !aiThisWeek && waitingKw.size < cfg.maxWaiting;
  if (aiDue && aiItem && cfg.opportunities === 'auto') picks.push(aiItem);
  else if (aiDue && aiItem) suggestions = [aiItem, ...suggestions].slice(0, CADENCE.suggestions);

  const activeIds = new Set(active.map((x) => x.id));
  const queuedIds = new Set(queued.map((x) => x.id));
  const ladders: CadenceLadder[] = info.map((x) => ({
    id: x.id,
    head: x.head,
    mode: x.mode,
    status: x.status,
    planType: x.planType,
    priority: Number.isFinite(x.prio) ? x.prio : null,
    start: x.start,
    headPosition: x.headPosition,
    won: x.won || x.status === 'won',
    supporting: x.supporting,
    published: x.published,
    gateOpen: x.gateOpen,
    mainWaiting: x.mainWaiting,
    remaining: x.remaining.map(ladderItem),
    eligible: x.eligible.map(ladderItem),
    role: x.won || x.status === 'won' ? 'won' : !['active', 'queued'].includes(x.status) ? 'paused' : x.mode === 'manual' ? 'manual' : activeIds.has(x.id) ? 'active' : queuedIds.has(x.id) ? 'queued' : 'done',
  }));
  return {
    config: cfg,
    picks,
    candidates,
    suggestions,
    awaitingApproval: manualL.filter((x) => x.eligible.length).map((x) => ladderItem(x.eligible[0])),
    ladders,
    queued: queued.map((x) => x.id),
    won: info.filter((x) => x.won || x.status === 'won').map((x) => x.id),
    waitingForSupport: info.filter((x) => x.mainWaiting && (x.status === 'active' || x.status === 'queued') && !x.won).map((x) => x.id),
    pausedReason,
    waitingPublish: waitingKw.size,
    waitingKeywords,
    coveredByLivePages,
  };
}

export interface CadenceWeek extends CadencePlan {
  /** the run (UTC ISO) */
  at: string;
}

/**
 * The coming Monday runs, one after the other: each run's picks are logged as written (content log 'written' at the run), as the
 * real runs do, so later runs move on — and stop once the pile-up guard holds. Nothing is assumed to get published or to rank.
 * Without runs (weekly posts off), one plan at `now` shows what would be written.
 */
export function simulateCadence(input: CadenceInput, runs: string[], now = Date.now()): CadenceWeek[] {
  if (!runs.length) return [{ ...planCadence(input, now), at: '' }];
  const logs = [...input.logs];
  const weeks: CadenceWeek[] = [];
  for (const at of runs) {
    const t = Date.parse(at);
    const plan = planCadence({ ...input, logs }, Number.isFinite(t) ? t : now);
    weeks.push({ ...plan, at });
    for (const p of plan.picks)
      logs.push({
        keyword: p.keyword,
        status: 'written',
        started_at: at,
        published_url: '',
        published_at: '',
        domain: input.domain,
        ladder_id: p.ladder?.id ?? '',
        source: p.source,
        existing_page_url: p.existingPageUrl || '',
        request_id: 'cad_simulated',
      } as ContentLogRow);
  }
  return weeks;
}
