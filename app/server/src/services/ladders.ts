import {
  daysSince,
  isWon,
  keywordTokens,
  LADDER_SITE_ROW,
  ladderOverlaps,
  ladderStatus,
  MODES,
  MONITOR_COSTS,
  normKeyword,
  splitList,
  type ContentLogRow,
  type DetectedPage,
  type LadderCard,
  type LadderDetail,
  type LadderMode,
  type LadderPage,
  type LadderPageState,
  type LadderRow,
  type LadderSettingsRow,
  type LadderStatus,
  type LadderTimelineEvent,
  type NeedsYouItem,
  type PlanType,
  type QueryRow,
  type QueueItem,
  type RankHistoryRow,
  type RankPoint,
  type Report,
  type SiteAutomation,
} from '@seo/shared';
import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { OrgRow, SiteRow } from '../db/schema';
import { rankSeries } from './data';
import { actionFromApiBody } from './recommendations';
import { filesFor, toReport } from './runs';

// Keyword ladders on the Pipeline page (PIPELINE_FEATURE_SPEC.md §4, §6, §8): one card per ladder and its detail (the climb,
// timeline, results), built from the n8n Data Tables of the website (seo_ladders, seo_rank_history, seo_content_log,
// seo_query_history, seo_ladder_settings) and what the app itself knows (ladder-plan and page reports, the runs it started).
//
// Page states (LadderPageState):
// - published: the content log has the page's address (the publish check), or the ladder row says published;
// - writing: a run of the app for the keyword is going, or the page started less than 3 hours ago (content log row, or the ladder
//   row marked "writing" by the ladder run itself) and no page has arrived since — the app's own runs expire after 3 hours;
// - waiting: started longer ago, or its page arrived: written, not published. A page whose latest run failed and never arrived is
//   planned again (it was not written; the failed run shows under Needs you);
// - gated: the main page of a Short / Full ladder while fewer than half of its supporting pages are live and the main keyword is not
//   in the top 30 (§6.2), as the Content Cadence holds it back (Cadence_Plan.js, since Phase 2); MAIN_PAGE_GATE turns the rule off;
// - planned: the rest.
// Ladders without a seo_ladder_settings row take the website's default mode (the '_site' row, else Auto) and are active, in
// start-date order; beyond the website's limit of active Auto ladders they are Queued — the same rules as Cadence_Plan.js. What the
// Monday runs write (the dated pages, Queued, the pile-up guard, Manual ladders' next pages) comes from the cadence mirror
// (cadence.ts) through LadderSchedule; without it (older callers, tests) the same rules run on the page states here.

export const MAIN_PAGE_GATE = true;
/** about one DataForSEO live SERP check per keyword per week */
export const LADDER_COSTS = { rankCheckEach: 0.015 };
export const SITE_ROW = LADDER_SITE_ROW;
export const SITE_DEFAULTS: SiteAutomation = { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 };
const WRITING_WINDOW_MS = 3 * 3600_000;
const ACTIVE_RUN = ['submitting', 'accepted', 'running'];

const norm = normKeyword;
const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const s = (v: unknown): string => (v == null ? '' : String(v));
const round2 = (x: number) => Math.round(x * 100) / 100;
const plural = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const q = (k: string) => `“${k}”`;
const isoOk = (v: unknown): v is string => typeof v === 'string' && v !== '' && !Number.isNaN(Date.parse(v));
/** host-agnostic page address: no protocol, no www., no query, no trailing slash */
export const urlKey = (u: string) =>
  s(u)
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
const shortUrl = (u: string) => s(u).replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

function group<T>(list: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

// ---------------- inputs ----------------

/** A ladder-plan report the app received: what the plan knew about each keyword. */
export interface PlanInfo {
  reportId: string;
  runId: string | null;
  ladderId: string;
  head: string;
  receivedAt: string;
  planType: PlanType | null;
  /** the plan's expected months ("4-8"), '' before v4.8 */
  months: string;
  expectedVisitsTop3: number | null;
  keywords: { keyword: string; volume: number | null; kd: number | null }[];
}

/** A page the app received (stage content, with the article). */
export interface PageReport {
  reportId: string;
  runId: string | null;
  keyword: string;
  ladderId: string;
  receivedAt: string;
}

/** A run of the website started in the app. */
export interface SiteRun {
  id: string;
  mode: string;
  status: string;
  title: string;
  error: string | null;
  keyword: string;
  /** input.ladder.id of a ladder page */
  ladderId: string;
  costUsd: number;
  createdAt: string;
}

export interface LadderSources {
  ladders: LadderRow[];
  history: RankHistoryRow[];
  logs: ContentLogRow[];
  queries: QueryRow[];
  settings: LadderSettingsRow[];
  plans: PlanInfo[];
  pageReports: PageReport[];
  runs: SiteRun[];
  /** pages the weekly site report found live by itself (Phase 4 `detected_published`), newest first */
  detected?: DetectedPage[];
}

/** What the schedules do next (the Pipeline's automations and the Content Cadence mirror, cadence.ts). */
export interface LadderSchedule {
  /** the pages the Content Cadence writes on its coming runs, in order, each with its run */
  dated: { item: QueueItem; at: string }[];
  /** the next Content Cadence runs (UTC ISO); empty when it is off */
  cadenceRuns: string[];
  /** the next rank check; null when the rank tracker is off */
  rankNextAt: string | null;
  /** the coming run as n8n plans it (cadence mirror) */
  plan?: SchedulePlan;
  /** the latest content_cadence report (last 8 days, nothing published since) said the pile-up guard held */
  lastRunPileup?: { at: string; waiting: number; max: number } | null;
}

export interface SchedulePlan {
  /** Auto ladders beyond the website's limit of active ladders */
  queued: string[];
  /** each Manual ladder's next page (written only with the person's OK) */
  awaitingApproval: QueueItem[];
  /** each ladder's next page the cadence may write (direct plans: the main page first; the gated main page left out) */
  nextOf: Map<string, QueueItem>;
  /** the pile-up guard holds for the coming run (weekly posts on) */
  pileup: boolean;
  /** pages written and not published, as the guard counts them */
  waitingPublish: number;
  maxWaiting: number;
}

export interface WaitingPage {
  keyword: string;
  ladderId: string | null;
  head: string;
  writtenAt: string | null;
  days: number;
}

export interface LadderBuild {
  cards: LadderCard[];
  /** every ladder's detail (without its reports: ladderReports() adds them for the one shown) */
  details: Map<string, LadderDetail>;
  automation: SiteAutomation;
  /** every page of the website written and not published (ladder pages and other posts), oldest first */
  waiting: WaitingPage[];
  /** clicks of all published ladder pages, latest Search Console period */
  clicks28d: number;
  /** ladder pages that improve a page the website already has: `${ladderId}|${keyword}` → its address */
  existingPages: Map<string, string>;
  /** Manual ladders' next pages (the cadence mirror's; else the first planned page) */
  awaiting: QueueItem[];
  /** the pile-up guard: holds for the coming run, or held on the last run */
  pileup: { waiting: number; max: number; lastRunAt: string | null; now: boolean } | null;
}

// ---------------- settings ----------------

const asMode = (v: unknown, d: LadderMode): LadderMode => {
  const m = s(v).toLowerCase().trim();
  return m === 'auto' || m === 'manual' ? m : d;
};
const asPlan = (v: unknown): PlanType | null => (v === 'direct' || v === 'short' || v === 'full' ? v : null);
/** n8n's rule (Cadence_Plan.js posInt): a whole number >= 1, capped; '' / null / 0 = the default */
const positive = (v: unknown, d: number, max: number) => {
  const x = Number(v);
  return v !== '' && v != null && Number.isFinite(x) && x >= 1 ? Math.min(max, Math.floor(x)) : d;
};

/** The website's automation settings: the '_site' row of seo_ladder_settings, or the defaults. */
export function siteAutomation(settings: LadderSettingsRow[]): SiteAutomation {
  const r = settings.find((x) => x.ladder_id === SITE_ROW);
  if (!r) return { ...SITE_DEFAULTS };
  return {
    // the cadence reads 'manual' or else Auto
    defaultMode: asMode(r.mode, SITE_DEFAULTS.defaultMode),
    opportunities: asMode(r.opportunities, SITE_DEFAULTS.opportunities),
    autoStartLadders: r.auto_start === true || s(r.auto_start) === 'true',
    maxActiveLadders: positive(r.max_active, SITE_DEFAULTS.maxActiveLadders, 20),
    maxWaiting: positive(r.max_waiting, SITE_DEFAULTS.maxWaiting, 100),
  };
}

// ---------------- page states ----------------

interface LogState {
  state: LadderPageState;
  writtenAt: string | null;
}

/** State of a page from its content-log rows (newest first), reports and app runs. */
function logState(logs: ContentLogRow[], reports: PageReport[], runs: SiteRun[], now: number): LogState | null {
  const active = runs.find((r) => ACTIVE_RUN.includes(r.status) && now - Date.parse(r.createdAt) < 12 * 3600_000);
  if (active) return { state: 'writing', writtenAt: null };
  const latestRun = runs[0];
  if (latestRun?.status === 'failed') {
    const after = Date.parse(latestRun.createdAt);
    const arrived = reports.some((r) => Date.parse(r.receivedAt) >= after);
    const retried = logs.some((l) => Date.parse(l.started_at) > after + 10 * 60_000);
    if (!arrived && !retried) return { state: 'planned', writtenAt: null };
  }
  const log = logs.find((l) => l.status !== 'published' && !l.published_url);
  if (!log) return null;
  const started = s(log.started_at);
  const arrived = reports.find((r) => r.receivedAt >= started);
  if (!arrived && isoOk(started) && now - Date.parse(started) < WRITING_WINDOW_MS) return { state: 'writing', writtenAt: null };
  return { state: 'waiting', writtenAt: isoOk(started) ? started : (arrived?.receivedAt ?? null) };
}

// ---------------- build ----------------

interface Built {
  id: string;
  head: string;
  rows: LadderRow[];
  settings: LadderSettingsRow | undefined;
  mode: LadderMode;
  planType: PlanType | null;
  plan: PlanInfo | null;
  pages: LadderPage[];
  headHistory: RankPoint[];
}

export function buildLadders(src: LadderSources, sched: LadderSchedule, opts: { now?: number; gate?: boolean } = {}): LadderBuild {
  const now = opts.now ?? Date.now();
  const gate = opts.gate ?? MAIN_PAGE_GATE;
  const automation = siteAutomation(src.settings);
  const settingsOf = new Map(src.settings.filter((r) => r.ladder_id && r.ladder_id !== SITE_ROW).map((r) => [r.ladder_id, r]));

  const groups = group(
    src.ladders.filter((r) => r.ladder_id && r.keyword),
    (r) => r.ladder_id,
  );
  const hist = group(src.history, (h) => `${h.ladder_id}|${s(h.keyword).toLowerCase()}`);
  const byNewest = <T>(get: (x: T) => string) => (a: T, b: T) => get(b).localeCompare(get(a));
  const logsBy = group([...src.logs].sort(byNewest((l) => s(l.started_at))), (l) => norm(l.keyword));
  const reportsBy = group([...src.pageReports].sort(byNewest((r) => r.receivedAt)), (r) => norm(r.keyword));
  const runsBy = group(
    src.runs.filter((r) => r.mode === 'keyword').sort(byNewest((r) => r.createdAt)),
    (r) => norm(r.keyword),
  );
  const plans = [...src.plans].sort(byNewest((p) => p.receivedAt));
  // a page the weekly site report found live: published from then on, even before n8n's own rows say so
  const detectedOf = (id: string, k: string) => (src.detected ?? []).find((d) => norm(d.keyword) === k && (!d.ladderId || d.ladderId === id)) ?? null;
  const foundLive = new Set<string>();
  // search volume / difficulty are properties of the keyword: any plan of the website knows them (the ladder's own plan first)
  const metricsOf = (id: string) => {
    const m = new Map<string, { volume: number | null; kd: number | null }>();
    for (const p of [...plans.filter((x) => x.ladderId === id), ...plans.filter((x) => x.ladderId !== id)])
      for (const k of p.keywords) if (!m.has(norm(k.keyword))) m.set(norm(k.keyword), { volume: k.volume, kd: k.kd });
    return m;
  };

  // ---- priority: the settings' priority, then the oldest ladder first (as the cadence orders them) ----
  const startOf = (id: string) =>
    groups
      .get(id)!
      .map((r) => s(r.start_date))
      .filter(Boolean)
      .sort()[0] || s(settingsOf.get(id)?.created_at);
  const prio = (id: string) => (n(settingsOf.get(id)?.priority) > 0 ? n(settingsOf.get(id)?.priority) : Infinity);
  const order = [...groups.keys()].sort((a, b) => prio(a) - prio(b) || startOf(a).localeCompare(startOf(b)) || a.localeCompare(b));

  // ---- pages ----
  const existingPages = new Map<string, string>();
  const built: Built[] = order.map((id) => {
    const rows = groups
      .get(id)!
      .slice()
      .sort((a, b) => n(a.rung) - n(b.rung) || n(a.page_no) - n(b.page_no));
    const head = s(rows[0].head_keyword) || s(rows.find((r) => n(r.rung) === 4)?.keyword);
    const st = settingsOf.get(id);
    const plan = plans.find((p) => p.ladderId === id) ?? null;
    const metrics = metricsOf(id);
    const pages = rows.map((r): LadderPage => {
      const k = norm(r.keyword);
      const logs = logsBy.get(k) ?? [];
      const reports = reportsBy.get(k) ?? [];
      const runs = runsBy.get(k) ?? [];
      const report = reports.find((x) => x.ladderId === id) ?? reports[0] ?? null;
      const pub = logs.find((l) => l.published_url || l.status === 'published');
      const status = s(r.status) || 'planned';
      const series = rankSeries(hist.get(`${id}|${s(r.keyword).toLowerCase()}`) ?? []);
      if ((r.page_exists === true || s(r.page_exists) === 'true') && r.target_url) existingPages.set(`${id}|${k}`, s(r.target_url));
      let state: LadderPageState = 'planned';
      let writtenAt: string | null = null;
      let publishedAt: string | null = null;
      let publishedUrl = '';
      if (status === 'published' || pub) {
        state = 'published';
        publishedUrl = s(pub?.published_url) || (status === 'published' ? s(r.target_url) : '');
        const at = pub?.published_at;
        publishedAt = isoOk(at) ? at : null;
        const started = logs.map((l) => s(l.started_at)).filter(isoOk).sort()[0];
        writtenAt = started ?? report?.receivedAt ?? null;
      } else {
        const fromLog = logState(logs, reports, runs, now);
        if (fromLog) ({ state, writtenAt } = fromLog);
        else if (status === 'writing') {
          // marked by the ladder run's own first pages (no content-log row): written with the plan
          const start = s(r.start_date);
          if (isoOk(start) && now - Date.parse(start) < WRITING_WINDOW_MS && !report) state = 'writing';
          else {
            state = 'waiting';
            writtenAt = isoOk(start) ? start : (report?.receivedAt ?? null);
          }
        }
      }
      const det = detectedOf(id, k);
      if (det) {
        foundLive.add(`${id}|${k}`);
        if (state !== 'published') {
          state = 'published';
          publishedUrl = det.url;
          publishedAt = det.at;
        } else {
          publishedUrl ||= det.url;
          publishedAt ??= det.at;
        }
      }
      const run = runs.find((x) => x.status !== 'failed');
      const m = metrics.get(k);
      return {
        keyword: s(r.keyword),
        rung: n(r.rung),
        pageNo: n(r.page_no),
        pageType: s(r.page_type),
        state,
        targetUrl: s(r.target_url),
        publishedUrl,
        position: series.latest,
        previousPosition: series.previous,
        bestPosition: series.best,
        history: series.history,
        writtenAt,
        publishedAt,
        runId: state === 'planned' ? null : (report?.runId ?? run?.id ?? null),
        reportId: state === 'planned' ? null : (report?.reportId ?? null),
        volume: m?.volume ?? null,
        kd: m?.kd ?? null,
        supporting: splitList(r.supporting),
      };
    });
    const planType = asPlan(st?.plan_type) ?? plan?.planType ?? null;
    const headPage = pages.find((p) => norm(p.keyword) === norm(head)) ?? pages.find((p) => p.rung === 4);
    const headHistory = (headPage?.history ?? rankSeries(hist.get(`${id}|${head.toLowerCase()}`) ?? []).history).filter((p) => p.position >= 0);
    // the main page waits for support in Short / Full ladders (§6.2)
    const main = pages.find((p) => p.rung === 4 && p.state === 'planned');
    if (gate && main && planType !== 'direct') {
      const support = pages.filter((p) => p.rung !== 4);
      const live = support.filter((p) => p.state === 'published').length;
      const headPos = headHistory[headHistory.length - 1]?.position ?? 0;
      if (live < support.length / 2 && !(headPos > 0 && headPos <= 30)) main.state = 'gated';
    }
    return { id, head, rows, settings: st, mode: asMode(st?.mode, automation.defaultMode), planType, plan, pages, headHistory };
  });

  // ---- pages written and not published, ladder pages and other posts (drafts older than 180 days drop out) ----
  const ladderKw = new Set(built.flatMap((b) => b.pages.map((p) => norm(p.keyword))));
  const waiting: WaitingPage[] = [];
  const seenWaiting = new Set<string>();
  // a keyword planned in two ladders is one page (the ladder with the higher priority shows it)
  for (const b of built)
    for (const p of b.pages)
      if (p.state === 'waiting' && !seenWaiting.has(norm(p.keyword))) {
        seenWaiting.add(norm(p.keyword));
        waiting.push({ keyword: p.keyword, ladderId: b.id, head: b.head, writtenAt: p.writtenAt, days: daysSince(p.writtenAt, now) });
      }
  for (const [k, logs] of logsBy) {
    if (!k || ladderKw.has(k) || logs.some((l) => l.published_url || l.status === 'published') || (src.detected ?? []).some((d) => norm(d.keyword) === k)) continue;
    const st = logState(logs, reportsBy.get(k) ?? [], runsBy.get(k) ?? [], now);
    if (st?.state === 'waiting' && now - Date.parse(st.writtenAt ?? '') < 180 * 864e5)
      waiting.push({ keyword: s(logs[0].keyword), ladderId: null, head: '', writtenAt: st.writtenAt, days: daysSince(st.writtenAt, now) });
  }
  waiting.sort((a, b) => b.days - a.days);

  // ---- focus: at most maxActiveLadders Auto ladders with pages left to write; the next ones wait as Queued (§6.3) ----
  const plan = sched.plan;
  const queued = new Set<string>(plan?.queued ?? []);
  if (!plan) {
    let free = automation.maxActiveLadders;
    for (const b of built) {
      const st = s(b.settings?.status);
      const candidate = b.mode === 'auto' && (!st || st === 'active' || st === 'queued') && !isWon(b.headHistory) && b.pages.some((p) => p.state === 'planned' || p.state === 'gated');
      if (!candidate) continue;
      if (free > 0) free--;
      else queued.add(b.id);
    }
  }
  // ---- the pile-up guard: the cadence mirror's count (n8n's rule), else the pages written and not published ----
  const pileup: LadderBuild['pileup'] = plan
    ? plan.pileup
      ? { waiting: plan.waitingPublish, max: plan.maxWaiting, lastRunAt: sched.lastRunPileup?.at ?? null, now: true }
      : sched.lastRunPileup
        ? { waiting: sched.lastRunPileup.waiting, max: sched.lastRunPileup.max, lastRunAt: sched.lastRunPileup.at, now: false }
        : null
    : automation.maxWaiting > 0 && waiting.length >= automation.maxWaiting
      ? { waiting: waiting.length, max: automation.maxWaiting, lastRunAt: null, now: true }
      : null;

  // ---- traffic: Search Console rows by page address (re-runs store a period again: the newest check counts) ----
  const latestQ = new Map<string, QueryRow>();
  for (const r of src.queries) {
    if (!r.page) continue;
    const k = `${s(r.query).toLowerCase()}|${s(r.period_end)}|${urlKey(r.page)}`;
    const cur = latestQ.get(k);
    if (!cur || s(r.checked_at) > s(cur.checked_at)) latestQ.set(k, r);
  }
  const qByUrl = group([...latestQ.values()], (r) => urlKey(r.page));
  const traffic = (urls: Set<string>): LadderDetail['traffic'] => {
    const per = new Map<string, { clicks: number; impressions: number }>();
    for (const u of urls)
      for (const r of qByUrl.get(u) ?? []) {
        const p = per.get(s(r.period_end)) ?? { clicks: 0, impressions: 0 };
        p.clicks += n(r.clicks);
        p.impressions += n(r.impressions);
        per.set(s(r.period_end), p);
      }
    const points = [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([periodEnd, v]) => ({ periodEnd, ...v }));
    const last = points[points.length - 1];
    return { points, clicks28d: last?.clicks ?? 0, impressions28d: last?.impressions ?? 0 };
  };

  const overlaps = ladderOverlaps(built.map((b) => ({ id: b.id, head: b.head, keywords: b.pages.map((p) => p.keyword) })));

  const cards: LadderCard[] = [];
  const details = new Map<string, LadderDetail>();
  built.forEach((b, i) => {
    const { pages } = b;
    const { status, statusText } = ladderStatus({
      settingsStatus: s(b.settings?.status),
      queued: queued.has(b.id),
      pages,
      headHistory: b.headHistory,
      siteWaiting: pileup?.now ? pileup.waiting : 0,
      maxWaiting: pileup?.now ? pileup.max : 0,
      now,
    });
    const count = (st: LadderPageState) => pages.filter((p) => p.state === st).length;
    const counts = { total: pages.length, published: count('published'), waiting: count('waiting'), writing: count('writing'), planned: count('planned') + count('gated') };
    const valid = b.headHistory;
    const headPosition = valid.length ? valid[valid.length - 1].position : null;
    const prev = valid.length > 1 ? valid[valid.length - 2].position : null;
    // 0 = not in the top 50: counts as 51 when the keyword enters or leaves the top 50
    const eff = (p: number) => (p === 0 ? 51 : p);
    const headChange = headPosition != null && prev != null && (headPosition > 0 || prev > 0) ? eff(prev) - eff(headPosition) : null;
    const ranked = pages.map((p) => p.position).filter((p): p is number => p != null && p > 0);
    const hasHeadPage = pages.some((p) => norm(p.keyword) === norm(b.head));
    if (!hasHeadPage && headPosition != null && headPosition > 0) ranked.push(headPosition);

    // the Mondays that write one of its pages (the cadence mirror: only Auto ladders that are active, not won, and not while pages pile up)
    const writes = b.mode === 'auto' && !['paused', 'queued', 'won'].includes(status) && !pileup?.now;
    const mine = writes
      ? sched.dated.filter((d) => d.item.ladder?.id === b.id && d.at && pages.some((p) => norm(p.keyword) === norm(d.item.keyword) && (p.state === 'planned' || p.state === 'gated')))
      : [];
    const pageNoOf = (kw: string) => pages.find((p) => norm(p.keyword) === norm(kw))?.pageNo ?? 0;
    const approve = plan ? plan.awaitingApproval.find((a) => a.ladder?.id === b.id) : undefined;
    const next = nextStep(status, b.mode, pages, mine, sched, counts.waiting, { approve, nextPage: plan?.nextOf.get(b.id), planned: !!plan });
    const kwCount = new Set([b.head, ...pages.map((p) => p.keyword)].map(norm)).size;
    const monthWrites = mine.filter((m) => Date.parse(m.at!) <= now + 28 * 864e5).length;
    const monthlyCostUsd = round2(LADDER_COSTS.rankCheckEach * kwCount * MONITOR_COSTS.weeksPerMonth + monthWrites * MONITOR_COSTS.blogPostEach);
    const mainRow = b.rows.find((r) => n(r.rung) === 4) ?? b.rows[b.rows.length - 1];

    const card: LadderCard = {
      id: b.id,
      head: b.head,
      country: s(b.rows[0].country),
      startDate: s(b.rows[0].start_date),
      planType: b.planType,
      mode: b.mode,
      priority: i + 1,
      status,
      statusText,
      counts,
      headPosition,
      headChange,
      headSeries: valid,
      top10: ranked.filter((p) => p <= 10).length,
      top3: ranked.filter((p) => p <= 3).length,
      next,
      months: s(mainRow?.months) || (b.plan?.months ?? ''),
      monthlyCostUsd,
      overlaps: overlaps.get(b.id) ?? [],
    };
    cards.push(card);

    // ---- timeline: what happened, then the coming Mondays ----
    const ev: LadderTimelineEvent[] = [];
    if (isoOk(card.startDate)) ev.push({ at: card.startDate, kind: 'planned', text: `Ladder planned: ${plural(pages.length, 'page')} towards ${q(b.head)}`, future: false });
    for (const p of pages) {
      if (p.writtenAt && p.state !== 'writing') ev.push({ at: p.writtenAt, kind: 'written', text: `${q(p.keyword)} written`, future: false, keyword: p.keyword });
      if (p.publishedAt)
        ev.push(
          foundLive.has(`${b.id}|${norm(p.keyword)}`)
            ? { at: p.publishedAt, kind: 'published', text: `We found ${q(p.keyword)} live${p.publishedUrl ? ` at ${shortUrl(p.publishedUrl)}` : ''}: spotted automatically by the weekly site check`, future: false, keyword: p.keyword, detected: true }
            : { at: p.publishedAt, kind: 'published', text: `${q(p.keyword)} published${p.publishedUrl ? ` at ${shortUrl(p.publishedUrl)}` : ''}`, future: false, keyword: p.keyword },
        );
      const h = p.history.filter((x) => x.position >= 0);
      const top10 = h.find((x) => x.position > 0 && x.position <= 10);
      const top3 = h.find((x) => x.position > 0 && x.position <= 3);
      if (top10) ev.push({ at: top10.checkedAt, kind: 'top10', text: `${q(p.keyword)} reached the top 10 (#${top10.position})`, future: false, keyword: p.keyword });
      if (top3) ev.push({ at: top3.checkedAt, kind: 'top3', text: `${q(p.keyword)} reached the top 3 (#${top3.position})`, future: false, keyword: p.keyword });
      for (let j = 1; j < h.length; j++) {
        const [a, c] = [h[j - 1].position, h[j].position];
        if (a > 0 && eff(c) - a >= 5)
          ev.push({ at: h[j].checkedAt, kind: 'drop', text: c === 0 ? `${q(p.keyword)} dropped out of the top 50 (was #${a})` : `${q(p.keyword)} dropped from #${a} to #${c}`, future: false, keyword: p.keyword });
      }
    }
    for (const m of mine) ev.push({ at: m.at!, kind: 'next', text: `Writes page ${pageNoOf(m.item.keyword)}: ${q(m.item.keyword)}`, future: true, keyword: m.item.keyword });
    if (sched.rankNextAt) ev.push({ at: sched.rankNextAt, kind: 'next', text: `Rank check of ${plural(kwCount, 'keyword')}`, future: true });
    ev.sort((a, c) => a.at.localeCompare(c.at));

    // ---- cost so far: the app's runs for this ladder, the cadence's pages, the rank checks; a plan made outside the app at its list price ----
    const planRuns = new Set(plans.filter((p) => p.ladderId === b.id && p.runId).map((p) => p.runId));
    const appRuns = src.runs.filter((r) => r.status !== 'failed' && (r.ladderId === b.id || planRuns.has(r.id)));
    const keywords = new Set(pages.map((p) => norm(p.keyword)));
    const cadencePages = src.logs.filter((l) => s(l.request_id).startsWith('cad_') && (s(l.ladder_id) === b.id || keywords.has(norm(l.keyword)))).length;
    const checks = src.history.filter((h) => h.ladder_id === b.id).length;
    const costSoFarUsd = round2(
      appRuns.reduce((t, r) => t + r.costUsd, 0) +
        (appRuns.some((r) => r.mode === 'ladder') ? 0 : MODES.ladder.costUsd) +
        cadencePages * MONITOR_COSTS.blogPostEach +
        checks * LADDER_COSTS.rankCheckEach,
    );
    const samePlan = b.plan ?? plans.find((p) => norm(p.head) === norm(b.head)) ?? null;
    details.set(b.id, {
      ...card,
      pages,
      timeline: ev,
      traffic: traffic(new Set(pages.filter((p) => p.publishedUrl).map((p) => urlKey(p.publishedUrl)))),
      reports: [],
      costSoFarUsd,
      expectedVisitsTop3: samePlan?.expectedVisitsTop3 ?? null,
    });
  });

  const allUrls = new Set(built.flatMap((b) => b.pages.filter((p) => p.publishedUrl).map((p) => urlKey(p.publishedUrl))));
  // Manual ladders' next pages: the mirror's (n8n's order and gate), else each Manual ladder's first planned page
  const awaiting: QueueItem[] = plan
    ? plan.awaitingApproval.filter((a) => {
        const c = cards.find((x) => x.id === a.ladder?.id);
        return c && !['paused', 'queued', 'won'].includes(c.status);
      })
    : built.flatMap((b) => {
        const c = cards.find((x) => x.id === b.id)!;
        if (b.mode !== 'manual' || ['paused', 'queued', 'won'].includes(c.status)) return [];
        const p = b.pages.find((x) => x.state === 'planned');
        const row = p && b.rows.find((r) => norm(r.keyword) === norm(p.keyword));
        if (!p || !row) return [];
        return [
          {
            keyword: p.keyword,
            source: 'ladder' as const,
            why: `Keyword ladder “${b.head}”, ${p.rung === 4 ? 'the main page' : `rung ${p.rung}`}: the next planned page towards the main keyword`,
            pageType: p.pageType || 'Service Page',
            existingPageUrl: existingPages.get(`${b.id}|${norm(p.keyword)}`) ?? '',
            ladder: { id: b.id, rung: p.rung, head: s(row.head_keyword) || b.head, pageNo: p.pageNo },
          },
        ];
      });
  return { cards, details, automation, waiting, clicks28d: traffic(allUrls).clicks28d, existingPages, awaiting, pileup };
}

function nextStep(
  status: LadderStatus,
  mode: LadderMode,
  pages: LadderPage[],
  mine: { item: QueueItem; at: string | null }[],
  sched: LadderSchedule,
  waiting: number,
  m: { approve?: QueueItem; nextPage?: QueueItem; planned: boolean },
): LadderCard['next'] {
  const pageOf = (kw: string) => pages.find((p) => norm(p.keyword) === norm(kw));
  if (status === 'paused') return { kind: 'wait', text: 'Paused: no new pages until you resume it', at: null };
  if (status === 'queued') return { kind: 'wait', text: 'Queued: it starts when a ladder ahead of it is won, fully written or paused', at: null };
  if (status === 'won') return { kind: 'check', text: 'Won: the rank check keeps an eye on it', at: sched.rankNextAt };
  if (status === 'needs_you') return { kind: 'publish', text: waiting ? `Waiting for you: publish ${plural(waiting, 'page')}` : 'Waiting for you: publish the waiting pages', at: null };
  const writing = pages.find((p) => p.state === 'writing');
  if (writing) return { kind: 'write', text: `Writing ${q(writing.keyword)} now`, at: null };
  const firstPlanned = pages.find((p) => p.state === 'planned');
  // the page the cadence would write next (the mirror's: Direct plans start with the main page), else the first planned one
  const planned = (m.nextPage && pages.find((p) => p.state === 'planned' && norm(p.keyword) === norm(m.nextPage!.keyword))) || firstPlanned;
  if (mode === 'manual') {
    const ok = m.planned ? (m.approve ? pageOf(m.approve.keyword) ?? null : null) : planned;
    if (ok) return { kind: 'approve', text: `Waiting for your OK to write ${q(ok.keyword)}`, at: null };
  }
  if (mine[0]) return { kind: 'write', text: `Writes page ${pageOf(mine[0].item.keyword)?.pageNo}: ${q(mine[0].item.keyword)}`, at: mine[0].at };
  if (waiting) return { kind: 'publish', text: `Waiting for you: publish ${plural(waiting, 'page')}`, at: null };
  if (planned)
    return {
      kind: 'write',
      text:
        mode === 'manual'
          ? `Next page: ${q(planned.keyword)}. Manual: use Write now when you want it`
          : sched.cadenceRuns.length
            ? `Next page: ${q(planned.keyword)}, after the posts ahead of it`
            : `Next page: ${q(planned.keyword)}. Weekly posts are off: use Write now`,
      at: null,
    };
  if (pages.some((p) => p.state === 'gated')) return { kind: 'wait', text: 'The main page waits until half of the supporting pages are live', at: null };
  if (sched.rankNextAt) return { kind: 'check', text: 'Every page is written: next rank check', at: sched.rankNextAt };
  return { kind: 'none', text: 'Every page is written', at: null };
}

// ---------------- Needs you (the ladders' part) ----------------

/** the same words: "e invoicing in uae" and "UAE e-invoicing" */
const sameSearch = (a: string, b: string) => keywordTokens(a).sort().join(' ') === keywordTokens(b).sort().join(' ');

const KIND_RANK: Record<NeedsYouItem['kind'], number> = { connection: 0, pileup: 1, publish: 2, failed: 3, duplicate: 4, overlap: 5, approve: 6 };

/** Most urgent first: warnings, then by kind. */
export function sortNeedsYou(items: NeedsYouItem[]): NeedsYouItem[] {
  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1) || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}

/** Pages to publish (per ladder, oldest first), the pile-up guard, duplicate / overlapping ladders, steps of Manual ladders. */
export function ladderNeedsYou(b: LadderBuild): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const pile = b.pileup;
  if (pile)
    out.push({
      id: 'pileup',
      kind: 'pileup',
      severity: 'warning',
      title: pile.now ? `Weekly posts stopped: ${plural(pile.waiting, 'page')} wait to be published` : `Last Monday’s posts were skipped: ${plural(pile.waiting, 'page')} waited to be published`,
      detail:
        (pile.lastRunAt ? 'Last Monday’s run wrote nothing for this reason. ' : '') +
        `No new page is written while ${pile.max === 1 ? 'a page waits' : `${pile.max} or more pages wait`} to be published (your limit). Publish them to continue: a page can only rank once it is live, and writing more while these wait only adds cost.`,
      action: { label: 'See the pages', page: 'content' },
    });

  const byLadder = group(b.waiting, (w) => w.ladderId ?? '');
  const groups = [...byLadder.entries()].map(([id, list]) => ({ id, list: [...list].sort((x, y) => y.days - x.days) })).sort((x, y) => y.list[0].days - x.list[0].days);
  for (const g of groups) {
    const oldest = g.list[0];
    out.push({
      id: `publish:${g.id || 'other'}`,
      kind: 'publish',
      severity: oldest.days >= 7 ? 'warning' : 'info',
      title: g.id ? `Publish ${plural(g.list.length, 'page')} of ${q(oldest.head)}` : `Publish ${plural(g.list.length, 'written page')}`,
      detail:
        g.list.map((w) => `${q(w.keyword)} (${w.days ? `waiting ${plural(w.days, 'day')}` : 'written today'})`).join(', ') +
        '. Put each page on your website, then report its address so tracking starts.',
      action: { label: 'I published it', mode: 'published', prefill: { keyword: oldest.keyword } },
      ...(g.id ? { ladderId: g.id } : {}),
    });
  }

  const done = new Set<string>();
  for (const c of b.cards)
    for (const o of c.overlaps) {
      const pair = [c.id, o.ladderId].sort().join('|');
      const other = b.cards.find((x) => x.id === o.ladderId);
      if (done.has(pair) || !other) continue;
      done.add(pair);
      // the one further down the priority list is the one to look at
      const [keep, act] = c.priority <= other.priority ? [c, other] : [other, c];
      if (sameSearch(c.head, other.head))
        out.push({
          id: `duplicate:${pair}`,
          kind: 'duplicate',
          severity: 'warning',
          title: `Two ladders for ${q(keep.head)}`,
          detail: 'Both plan, write and track the same pages: double cost, and pages that compete with each other in Google. Only one of them should stay.',
          action: { label: 'Open the second ladder', ladderId: act.id },
          ladderId: act.id,
        });
      else {
        const back = other.overlaps.find((x) => x.ladderId === c.id)?.keywords ?? [];
        const shared = [...new Set([...o.keywords, ...back])];
        out.push({
          id: `overlap:${pair}`,
          kind: 'overlap',
          severity: 'warning',
          title: `${q(keep.head)} and ${q(act.head)} overlap`,
          detail: `They share searches: ${shared.slice(0, 4).map(q).join(', ')}${shared.length > 4 ? ` and ${shared.length - 4} more` : ''}. Two pages for the same search compete in Google; keep each search in one ladder.`,
          action: { label: 'Open the ladder', ladderId: act.id },
          ladderId: act.id,
        });
      }
    }

  // Manual ladders: the next page waits for the person's OK (the button opens Write now with the ladder fields)
  for (const a of b.awaiting) {
    const c = b.cards.find((x) => x.id === a.ladder?.id);
    if (!c || !a.ladder) continue;
    const { rung, pageNo } = a.ladder;
    out.push({
      id: `approve:${c.id}`,
      kind: 'approve',
      severity: 'info',
      title: `Next page ready: ${q(a.keyword)}`,
      detail: `Page ${pageNo} of your ladder ${q(c.head)}${rung === 4 ? ' (the main page)' : `, rung ${rung}`}. The ladder is Manual: write it now (about $${MONITOR_COSTS.blogPostEach.toFixed(2)}) or leave it for later.`,
      action:
        actionFromApiBody(
          {
            mode: 'keyword',
            keyword: a.keyword,
            page_type: a.pageType,
            existing_page_url: a.existingPageUrl,
            ladder_id: c.id,
            ladder_rung: rung,
            ladder_head: a.ladder.head || c.head,
            ladder_page_no: pageNo,
            receive: ['Keyword Report', 'Page Content'],
          },
          'Write it',
        ) ?? null,
      ladderId: c.id,
      writeNow: a,
    });
  }
  return out;
}

// ---------------- what the app knows (its database) ----------------

const numOrNull = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Plan reports, delivered pages and the app's runs of the website. */
export async function ladderAppSources(org: OrgRow, site: SiteRow): Promise<Pick<LadderSources, 'plans' | 'pageReports' | 'runs' | 'detected'>> {
  const R = schema.reports;
  const p = R.payload;
  const [planRows, pageRows, runRows, detectedRows] = await Promise.all([
    db
      .select({
        id: R.id,
        runId: R.runId,
        receivedAt: R.receivedAt,
        ladderId: sql<string | null>`${p}->>'ladder_id'`,
        head: sql<string | null>`coalesce(${p}->>'keyword', ${p}->'head'->>'keyword')`,
        planType: sql<string | null>`${p}->>'plan_type'`,
        months: sql<string | null>`${p}->>'months'`,
        visits: sql<string | null>`${p}->'feasibility'->>'expected_visits_top3'`,
        rungs: sql<unknown>`${p}->'rungs'`,
        top: sql<unknown>`${p}->'top_page'`,
      })
      .from(R)
      .where(and(eq(R.orgId, org.id), eq(R.siteId, site.id), eq(R.stage, 'ladder_plan')))
      .orderBy(desc(R.receivedAt))
      .limit(50),
    db
      .select({ id: R.id, runId: R.runId, receivedAt: R.receivedAt, keyword: sql<string | null>`${p}->>'keyword'`, ladderId: sql<string | null>`${p}->>'ladder_id'` })
      .from(R)
      .where(and(eq(R.orgId, org.id), eq(R.siteId, site.id), eq(R.stage, 'content'), sql`${R.summary}->>'hasPage' = 'true'`))
      .orderBy(desc(R.receivedAt))
      .limit(500),
    db
      .select({
        id: schema.runs.id,
        mode: schema.runs.mode,
        status: schema.runs.status,
        title: schema.runs.title,
        error: schema.runs.error,
        keyword: sql<string | null>`${schema.runs.input}->>'keyword'`,
        ladderId: sql<string | null>`${schema.runs.input}->'ladder'->>'id'`,
        est: schema.runs.estimatedCostUsd,
        act: schema.runs.actualCostUsd,
        createdAt: schema.runs.createdAt,
      })
      .from(schema.runs)
      .where(
        and(
          eq(schema.runs.orgId, org.id),
          eq(schema.runs.siteId, site.id),
          or(inArray(schema.runs.mode, ['keyword', 'ladder']), gte(schema.runs.createdAt, new Date(Date.now() - 7 * 864e5))),
        ),
      )
      .orderBy(desc(schema.runs.createdAt))
      .limit(500),
    // Phase 4: weekly site reports that found written pages live on the website (missing before it is deployed)
    db
      .select({ id: R.id, receivedAt: R.receivedAt, detected: sql<unknown>`${p}->'detected_published'` })
      .from(R)
      .where(and(eq(R.orgId, org.id), eq(R.siteId, site.id), eq(R.stage, 'site_tracker'), gte(R.receivedAt, new Date(Date.now() - 180 * 864e5)), sql`jsonb_typeof(${p}->'detected_published') = 'array'`))
      .orderBy(desc(R.receivedAt))
      .limit(30),
  ]);
  type PlanPage = { keyword?: unknown; volume?: unknown; kd?: unknown };
  const plans: PlanInfo[] = planRows.map((r) => {
    const rungPages = (Array.isArray(r.rungs) ? r.rungs : []).flatMap((g) => (Array.isArray((g as { pages?: unknown }).pages) ? ((g as { pages: PlanPage[] }).pages ?? []) : []));
    const top = r.top && typeof r.top === 'object' ? [r.top as PlanPage] : [];
    return {
      reportId: r.id,
      runId: r.runId,
      ladderId: s(r.ladderId),
      head: s(r.head),
      receivedAt: r.receivedAt.toISOString(),
      planType: asPlan(r.planType),
      months: asPlan(r.planType) ? s(r.months) : '',
      expectedVisitsTop3: numOrNull(r.visits),
      keywords: [...rungPages, ...top].filter((x) => x && x.keyword).map((x) => ({ keyword: s(x.keyword), volume: numOrNull(x.volume), kd: numOrNull(x.kd) })),
    };
  });
  return {
    plans,
    detected: detectedRows.flatMap((r) => detectedPages(r.detected, r.receivedAt.toISOString(), r.id)),
    pageReports: pageRows.map((r) => ({ reportId: r.id, runId: r.runId, keyword: s(r.keyword), ladderId: s(r.ladderId), receivedAt: r.receivedAt.toISOString() })),
    runs: runRows.map((r) => ({
      id: r.id,
      mode: r.mode,
      status: r.status,
      title: r.title,
      error: r.error,
      keyword: s(r.keyword),
      ladderId: s(r.ladderId),
      costUsd: r.act ?? r.est,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** The `detected_published` entries of one site_tracker report (Phase 4): keyword + a web address; anything else is ignored. */
export function detectedPages(v: unknown, at: string, reportId: string): DetectedPage[] {
  const out: DetectedPage[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    if (!x || typeof x !== 'object') continue;
    const d = x as Record<string, unknown>;
    const url = s(d.url).trim();
    const keyword = s(d.keyword).trim();
    if (!keyword || !/^https?:\/\/[^\s/]+/i.test(url)) continue;
    const ladderId = s(d.ladder_id).trim();
    out.push({ keyword, url, ladderId: /^[A-Za-z0-9_-]{1,80}$/.test(ladderId) && ladderId !== SITE_ROW ? ladderId : '', head: s(d.head ?? d.head_keyword).trim(), matchedBy: s(d.matched_by).trim(), at, reportId });
  }
  return out;
}

/** The reports of one ladder: its plan, its weekly rank reports and its pages. */
export async function ladderReports(org: OrgRow, site: SiteRow, ladderId: string, pageReportIds: string[]): Promise<Report[]> {
  const R = schema.reports;
  const ofLadder = and(inArray(R.stage, ['ladder_plan', 'rank_tracker', 'content']), sql`${R.payload}->>'ladder_id' = ${ladderId}`);
  const rows = await db
    .select({ id: R.id, runId: R.runId, siteId: R.siteId, stage: R.stage, status: R.status, title: R.title, summary: R.summary, receivedAt: R.receivedAt, scheduled: R.scheduled })
    .from(R)
    .where(and(eq(R.orgId, org.id), eq(R.siteId, site.id), pageReportIds.length ? or(ofLadder, inArray(R.id, pageReportIds)) : ofLadder))
    .orderBy(desc(R.receivedAt))
    .limit(60);
  const fm = await filesFor(rows.map((r) => r.id));
  return rows.map((r) => toReport(r, fm.get(r.id) ?? [], site.domain));
}
