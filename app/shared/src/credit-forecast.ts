import type { AutopilotRow } from './autopilot';
import type { CreditForecast, CreditOrigin, CreditRunways, ForecastBasis, ForecastRow, OutcomeCost, OutcomeKind, SiteCreditForecast } from './billing';
import { isKiRunMode } from './ki';

// CR17-I (client report 2026-11-17, M2): the credit forecast from what the work REALLY charged, not from the price list.
//
// The client was told "about 1,404 credits a month, runs out 28 Nov" while its schedules had charged 443 in the last 30 days: every page
// was priced at the quote (114 credits, charged 53 to 76), two pages a week were forecast while its ladders had one page left, the daily
// pulse was forecast at 169 while it was charged 10, and our own test runs (118 credits) were projected forward as the client's pace.
//
// The rules, one place, pure (the server reads the ledger and the websites' schedules and calls these):
//   * each row of a website's schedules (shared/src/autopilot.ts) that is on is forecast from that row's charges of the last 30 days
//     (the monthly audit: 60 days, the research refresh: 90), once THAT ROW has that much history of its own (FX-SERVER, review R3 M1: the
//     website's age is not the row's: a monitor switched on today on a 60-day-old website was "measured" at 0); a younger row uses its
//     typical charge per run x the runs a month the schedule makes; a row with no charge yet, or one being switched on now, uses its
//     typical run if it ran before, else the price list ("estimate");
//   * pages: the typical charge of a written page (median of the last 60 days) x the pages still due: pages a week x 4.33, never more than
//     the pages its keyword ladders still have to write (level 3 writes new topics: no ceiling), never less than the pages the autopilot
//     really wrote in the last 30 days (approved suggestions and AI answer pages are written on top of the ladders' pages);
//   * the company's own analyses: what they charged in the last 30 days, our team's test runs (keyword research Trial) left out;
//   * cost per outcome: median and usual range of each kind of finished work (one run = one outcome), the last 60 days.

const DAY = 86_400_000;
const WEEKS = 4.33;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** One usage entry of the ledger as the forecast reads it. `credits` is signed as stored: a debit negative, a return positive. */
export interface UsageEntry {
  at: string;
  credits: number;
  origin: CreditOrigin;
  mode: string;
  domain: string;
  /** the app run it belongs to (on-demand work, a final version), else null */
  runId: string | null;
  /** the engine execution (schedules), else null */
  engineRunId?: string | null;
  /** the app run was our team's Trial (`runs.input.kiTrial`) */
  kiTrial?: boolean;
  /** the ledger entry's own id (an outcome with neither run id is one entry) */
  id?: string;
}

/** Which kind of finished work a mode is. */
export function outcomeKindOfMode(mode: string | null | undefined): OutcomeKind {
  const m = String(mode ?? '').trim();
  if (['keyword', 'content', 'cadence', 'content_cadence', 'case_study', 'page'].includes(m)) return 'page';
  if (m === 'ai_visibility') return 'ai_check';
  if (m === 'ai_pulse') return 'ai_pulse';
  if (m === 'ai_growth') return 'ai_growth';
  if (m === 'site_tracker' || m === 'track') return 'site_report';
  if (m === 'backlinks') return 'backlinks';
  if (m === 'link_builder') return 'link_builder';
  if (m === 'rank_tracker') return 'rank_check';
  if (m === 'audit' || m === 'site_audit') return 'audit';
  if (m === 'full' || m === 'report') return 'report';
  if (m === 'discover' || m === 'keyword_research') return 'research';
  if (m === 'competitors') return 'competitors';
  if (m === 'ladder') return 'ladder_plan';
  if (m === 'keyword_check' || m === 'assess') return 'keyword_check';
  if (m === 'verdict') return 'verdict';
  if (m === 'finalize' || m === 'page_finalize') return 'final_version';
  return 'other';
}

export const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  page: 'A written page',
  ai_check: 'Weekly AI visibility check',
  ai_pulse: 'Daily AI pulse',
  ai_growth: 'AI growth week',
  site_report: 'Weekly site report',
  backlinks: 'Backlink check',
  link_builder: 'Link building week',
  rank_check: 'Rank check',
  audit: 'Technical audit',
  report: 'Full SEO report',
  research: 'Keyword research',
  competitors: 'Competitor research',
  ladder_plan: 'Keyword ladder plan',
  keyword_check: 'Keyword check',
  verdict: 'Keyword verdict',
  final_version: 'Final version of a page',
  other: 'Other work',
};

/** The autopilot row (shared/src/autopilot.ts) a kind of automatic work is forecast in. */
const ROW_OF: Partial<Record<OutcomeKind, string>> = {
  page: 'blog_posts',
  ai_check: 'ai_visibility',
  ai_pulse: 'ai_pulse',
  ai_growth: 'ai_growth',
  site_report: 'site_report',
  backlinks: 'backlinks',
  link_builder: 'link_builder',
  rank_check: 'rank_tracker',
  audit: 'audit',
  research: 'research',
};

/** Per row: the history window (days), the history a website needs before its sum is read, and the runs a month the schedule makes. */
const ROW_RULE: Record<string, { window: number; mature: number; runs: number }> = {
  site_report: { window: 30, mature: 14, runs: WEEKS },
  ai_visibility: { window: 30, mature: 14, runs: WEEKS },
  ai_pulse: { window: 30, mature: 7, runs: 6 * WEEKS },
  ai_growth: { window: 30, mature: 14, runs: WEEKS },
  backlinks: { window: 30, mature: 14, runs: WEEKS },
  link_builder: { window: 30, mature: 14, runs: WEEKS },
  rank_tracker: { window: 30, mature: 14, runs: WEEKS },
  audit: { window: 60, mature: 28, runs: 1 },
  research: { window: 90, mature: 80, runs: 30 / 90 },
  other: { window: 30, mature: 14, runs: 0 },
};

const host = (d: string) => String(d ?? '').trim().toLowerCase().replace(/^www\./, '');

/**
 * Our own team's test runs, never the client's pace: a keyword-intelligence charge with no app run behind it (a client's own KI run always
 * has one: prod review 2026-11-12, S2-01) and any charge of an app run marked as our Trial.
 */
export function isOurTestEntry(e: Pick<UsageEntry, 'mode' | 'runId' | 'kiTrial'>): boolean {
  return e.kiTrial === true || (isKiRunMode(String(e.mode ?? '')) && !e.runId);
}

/**
 * One finished piece of work per run and kind: the entries of one app run (or one engine execution) of one kind, netted (a re-price, a
 * return). A ladder run also writes its first page under the same run: the plan and the page are two outcomes. An entry without a mode (a
 * re-price) nets into the first outcome of its run.
 */
export function outcomesOf(entries: readonly UsageEntry[]): { key: string; kind: OutcomeKind; credits: number; at: string; origin: CreditOrigin; domain: string }[] {
  type O = { key: string; kind: OutcomeKind; credits: number; at: string; origin: CreditOrigin; domain: string };
  const by = new Map<string, O>();
  const firstOfRun = new Map<string, O>();
  const runKey = (e: UsageEntry, i: number) => (e.runId ? `run:${e.runId}` : e.engineRunId ? `exec:${e.engineRunId}` : `entry:${e.id ?? i}`);
  const modeless: { e: UsageEntry; i: number }[] = [];
  entries.forEach((e, i) => {
    if (!String(e.mode ?? '').trim()) return void modeless.push({ e, i });
    const run = runKey(e, i);
    const kind = outcomeKindOfMode(e.mode);
    const key = `${run}|${kind}`;
    const cur = by.get(key);
    if (cur) {
      cur.credits += -e.credits;
      if (e.at < cur.at) cur.at = e.at;
    } else {
      const o: O = { key, kind, credits: -e.credits, at: e.at, origin: e.origin, domain: host(e.domain) };
      by.set(key, o);
      const f = firstOfRun.get(run);
      if (!f || o.at < f.at) firstOfRun.set(run, o);
    }
  });
  for (const { e, i } of modeless) {
    const run = runKey(e, i);
    const f = firstOfRun.get(run);
    if (f) f.credits += -e.credits;
    else by.set(`${run}|other`, { key: `${run}|other`, kind: 'other', credits: -e.credits, at: e.at, origin: e.origin, domain: host(e.domain) });
  }
  return [...by.values()].map((o) => ({ ...o, credits: r2(o.credits) }));
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/** median and usual range of a list of charges (the 20th to 80th percentile from 5 on, else lowest to highest) */
export function spread(values: readonly number[]): { median: number; low: number; high: number; count: number } {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return { median: 0, low: 0, high: 0, count: 0 };
  const wide = v.length >= 5;
  return { median: r2(quantile(v, 0.5)), low: r2(wide ? quantile(v, 0.2) : v[0]), high: r2(wide ? quantile(v, 0.8) : v[v.length - 1]), count: v.length };
}

/** What each kind of finished work has cost (the last `days` days, our test runs left out), most frequent first. */
export function costPerOutcome(entries: readonly UsageEntry[], now: Date = new Date(), days = 60): OutcomeCost[] {
  const since = now.getTime() - days * DAY;
  const outs = outcomesOf(entries.filter((e) => Date.parse(e.at) >= since && !isOurTestEntry(e)));
  const by = new Map<OutcomeKind, number[]>();
  for (const o of outs) if (o.credits > 0 && o.kind !== 'other') by.set(o.kind, [...(by.get(o.kind) ?? []), o.credits]);
  return [...by.entries()]
    .map(([kind, v]) => ({ kind, label: OUTCOME_LABEL[kind], ...spread(v) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || b.median - a.median);
}

/** "about 55 to 65 credits (typical of your last 9)" for a form or the Credits page; null when there is no history. */
export function outcomeCostText(c: OutcomeCost | null | undefined): string | null {
  if (!c || !c.count) return null;
  const n = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : String(Math.round(x * 10) / 10));
  const range = Math.round(c.low) === Math.round(c.high) ? `about ${n(c.median)} credits` : `about ${n(c.low)} to ${n(c.high)} credits`;
  return `${range} (typical: ${n(c.median)}, from your last ${c.count === 1 ? 'one' : c.count})`;
}

/** One website's schedules as the forecast needs them. */
export interface ForecastSiteInput {
  domain: string;
  /** the rows of its schedules, on / off and their price-list cost in USD (siteAutopilotRows) */
  rows: AutopilotRow[];
  /** pages a week the content cadence may write */
  pagesPerWeek: number;
  /** pages its keyword ladders still have to write (Auto, chosen by the client); null = no ceiling (level 3 writes new topics too) */
  pagesLeft: number | null;
  /** when its schedules started (verified / tracking started): how much history there can be */
  since: string | null;
  /** paused by a person: forecasts nothing */
  pausedByPerson?: boolean;
  /** rows being switched on by the change a person is about to save (the settings warning): no measured window, a typical run or the
   *  price list, whatever their older history says */
  switchedOn?: readonly string[];
}

export interface ForecastInput {
  sites: readonly ForecastSiteInput[];
  /** the company's usage entries of the last 90 days at least */
  entries: readonly UsageEntry[];
  /** credits per USD of provider cost (creditRate) */
  rate: number;
  now?: Date;
}

const pagesWord = (n: number) => (n === 1 ? '1 page' : `${Math.round(n * 10) / 10} pages`);

/** The forecast for the next 30 days, per website and row, from the ledger (see the header). */
export function measuredForecast(input: ForecastInput): CreditForecast {
  const now = input.now ?? new Date();
  const t = now.getTime();
  const auto = input.entries.filter((e) => e.origin === 'autopilot' && !isOurTestEntry(e));
  const own = input.entries.filter((e) => e.origin === 'on_demand' && !isOurTestEntry(e) && Date.parse(e.at) >= t - 30 * DAY && Date.parse(e.at) <= t);
  const onDemandMonthly = r2(Math.max(0, -own.reduce((s, e) => s + e.credits, 0)));
  // the typical written page of the company (its own pages too: the same work), for a website with no automatic page yet
  const pageCosts = (d?: string, origin?: CreditOrigin) =>
    outcomesOf(input.entries.filter((e) => !isOurTestEntry(e) && Date.parse(e.at) >= t - 60 * DAY && (!d || host(e.domain) === d) && (!origin || e.origin === origin)))
      .filter((o) => o.kind === 'page' && o.credits > 0)
      .map((o) => o.credits);
  const companyPage = spread(pageCosts());
  const sites: SiteCreditForecast[] = input.sites.map((site) => {
    const d = host(site.domain);
    const mine = auto.filter((e) => host(e.domain) === d);
    // the history there is: since the website's schedules were first charged (the pages' pace reads it); each other row reads its OWN
    // history (rowForecast)
    const firstSeen = mine.reduce<number | null>((m, e) => (m == null || Date.parse(e.at) < m ? Date.parse(e.at) : m), null);
    const sinceMs = site.since ? Date.parse(site.since) : NaN;
    const start = firstSeen == null ? t : Number.isFinite(sinceMs) ? Math.min(sinceMs, firstSeen) : firstSeen;
    const age = Math.max(0, (t - start) / DAY);
    const switchedOn = new Set(site.switchedOn ?? []);
    const rows: ForecastRow[] = [];
    const seenRows = new Set<string>();
    for (const row of site.rows) {
      seenRows.add(row.id);
      const quote = r2(row.usd * input.rate);
      if (site.pausedByPerson || !row.on) {
        rows.push({ id: row.id, label: row.label, credits: 0, basis: 'off', detail: site.pausedByPerson ? 'paused' : 'off' });
        continue;
      }
      if (row.id === 'blog_posts') {
        // the pages still due: the weekly pace, never more than the ladders have left, but never less than what the autopilot really wrote
        // in the last 30 days (approved suggestions and AI answer pages are written too, on top of the ladders' own pages)
        const cap = site.pagesPerWeek * WEEKS;
        const recent = outcomesOf(mine.filter((e) => Date.parse(e.at) >= t - 30 * DAY)).filter((o) => o.kind === 'page' && o.credits > 0).length;
        const pace = age >= 14 ? (recent * 30) / Math.min(30, age) : 0;
        const due = Math.max(0, Math.min(cap, Math.max(site.pagesLeft ?? Infinity, pace)));
        // the website's own automatic pages first (what the cadence is charged), then any page of the website, then the company's
        const autoPage = spread(pageCosts(d, 'autopilot'));
        const sitePage = autoPage.count ? autoPage : spread(pageCosts(d));
        const per = sitePage.count ? sitePage.median : companyPage.count ? companyPage.median : site.pagesPerWeek > 0 ? quote / (site.pagesPerWeek * WEEKS) : 0;
        const basis: ForecastBasis = sitePage.count || companyPage.count ? 'per_run' : 'estimate';
        const why =
          site.pagesLeft == null || due >= cap
            ? `${pagesWord(r2(due))} a month (${site.pagesPerWeek} a week)`
            : due > site.pagesLeft
              ? `${pagesWord(r2(due))} a month, as in the last 30 days (${site.pagesLeft === 0 ? 'none' : site.pagesLeft} left on your keyword ladders)`
              : `${pagesWord(site.pagesLeft)} left on your keyword ladders`;
        rows.push({
          id: row.id,
          label: row.label,
          credits: r2(due * per),
          basis: due > 0 ? basis : 'off',
          detail: due > 0 ? `${why}, about ${Math.round(per)} credits each${basis === 'estimate' ? ' (price list: no page written yet)' : ''}` : 'no page left to write on your keyword ladders',
        });
        continue;
      }
      rows.push(rowForecast(row.id, row.label, mine.filter((e) => ROW_OF[outcomeKindOfMode(e.mode)] === row.id), quote, t, switchedOn.has(row.id), age));
    }
    // automatic work no row names (a final version, an automatic keyword re-check): what it charged, as its own row
    const other = mine.filter((e) => {
      const r = ROW_OF[outcomeKindOfMode(e.mode)];
      return !r || !seenRows.has(r);
    });
    if (other.length && !site.pausedByPerson) {
      const o = rowForecast('other', 'Other automatic work', other, 0, t, false, age);
      if (o.credits > 0) rows.push(o);
    }
    return { domain: site.domain, monthly: r2(rows.reduce((s, r) => s + r.credits, 0)), rows };
  });
  const autopilotMonthly = r2(sites.reduce((s, x) => s + x.monthly, 0));
  return {
    autopilotMonthly,
    onDemandMonthly,
    sites,
    basis: 'From what your work really used in the last 30 days (60 for the monthly audit), and the pages your keyword ladders still have to write. Our own test runs are left out.',
  };
}


/**
 * One row of a website's schedules. "measured" (the row's charges over its window, a 0 included: an audit skipped because nothing changed)
 * only when the row itself has history that old: its first charge at least `mature` days ago. A row with fewer days of its own history uses
 * its typical charge per run; a row never charged, or one being switched on now (`fresh`), its typical run if it ran before, else the
 * price list. (FX-SERVER, review R3 M1: the row read the WEBSITE's age, so turning a monitor on on an established website forecast 0 and
 * the settings warning and the autopilot reserve ignored it.)
 */
export function rowForecast(id: string, label: string, entries: readonly UsageEntry[], quote: number, t: number, fresh = false, siteAge = Infinity): ForecastRow {
  const rule = ROW_RULE[id] ?? ROW_RULE.other;
  const past = entries.filter((e) => Date.parse(e.at) <= t);
  const firstCharge = past.reduce<number | null>((m, e) => (e.credits < 0 && (m == null || Date.parse(e.at) < m) ? Date.parse(e.at) : m), null);
  const age = firstCharge == null ? 0 : Math.max(0, (t - firstCharge) / DAY);
  const inWindow = past.filter((e) => Date.parse(e.at) >= t - rule.window * DAY);
  const sum = -inWindow.reduce((s, e) => s + e.credits, 0);
  if (!fresh && firstCharge != null && age >= rule.mature) {
    // the days the row's charges cover: its own history plus the one interval its first run stands for (four weekly runs span 21 days
    // but are four weeks of work), never more than the website's schedules have run or the window
    const interval = rule.runs > 0 ? 30 / rule.runs : Infinity;
    const days = Math.max(1, Math.min(rule.window, siteAge, age + interval));
    const credits = r2(Math.max(0, (sum * 30) / days));
    const runs = outcomesOf(inWindow).filter((o) => o.credits > 0).length;
    return {
      id,
      label,
      credits,
      basis: 'measured',
      detail: runs ? `${runs} run${runs === 1 ? '' : 's'} used ${Math.round(Math.max(0, sum))} credits in the last ${Math.round(days)} days` : `nothing charged in the last ${Math.round(days)} days`,
    };
  }
  const per = spread(outcomesOf(past).map((o) => o.credits));
  if (per.count && rule.runs > 0)
    return { id, label, credits: r2(per.median * rule.runs), basis: 'per_run', detail: `about ${Math.round(per.median)} credits a run, ${Math.round(rule.runs * 10) / 10} runs a month` };
  return { id, label, credits: quote, basis: 'estimate', detail: 'price list: not enough history yet' };
}

/** How long `available` credits last: the schedules alone, and with the company's own analyses at last month's pace. */
export function creditRunways(available: number, autopilotMonthly: number, onDemandMonthly: number): CreditRunways {
  const dailyAutopilot = r2(Math.max(0, autopilotMonthly) / 30);
  const dailyWithOwn = r2((Math.max(0, autopilotMonthly) + Math.max(0, onDemandMonthly)) / 30);
  const days = (daily: number) => (daily > 0 ? Math.max(0, Math.floor((Math.max(0, available) / daily) * 10) / 10) : null);
  return { autopilotAlone: days(dailyAutopilot), withOwn: days(dailyWithOwn), dailyAutopilot, dailyWithOwn };
}
