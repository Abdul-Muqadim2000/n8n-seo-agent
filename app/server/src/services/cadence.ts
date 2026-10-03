import {
  LADDER_SITE_ROW,
  normKeyword,
  type ContentLogRow,
  type LadderMode,
  type LadderRow,
  type LadderSettingsRow,
  type PlanType,
  type QueryRow,
  type QueueItem,
  type RankHistoryRow,
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
// - pile-up guard: max_waiting or more distinct keywords written but not published (content log 'started', no published_url,
//   started in the last 120 days) -> nothing is written that week;
// - opportunity posts (Search Console striking distance, then rising Google Trends searches) only when opportunities is Auto;
//   when Manual they are suggestions (the first 5);
// - Manual ladders are never written: each one's next eligible page waits for approval;
// - skips keywords written in the last 90 days (or published), ladder rows marked writing / published, brand queries.

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
  const seen = new Set<string>();
  const candidates = cands.filter((c) => {
    const k = norm(c.keyword);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // ---- pile-up guard ----
  const waitingKw = new Set(
    logs.filter((l) => l.status === 'started' && !l.published_url && now - ms(l.started_at) < CADENCE.waitingDays * 864e5).map((l) => norm(l.keyword)),
  );
  const pausedReason = pages > 0 && waitingKw.size >= cfg.maxWaiting ? 'pileup' : '';
  const picks = pausedReason ? [] : candidates.slice(0, pages);

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
  };
}

export interface CadenceWeek extends CadencePlan {
  /** the run (UTC ISO) */
  at: string;
}

/**
 * The coming Monday runs, one after the other: each run's picks are logged as written (content log 'started' at the run), as the
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
        status: 'started',
        started_at: at,
        published_url: '',
        published_at: '',
        domain: input.domain,
        ladder_id: p.ladder?.id ?? '',
        source: p.source,
        request_id: 'cad_simulated',
      } as ContentLogRow);
  }
  return weeks;
}
