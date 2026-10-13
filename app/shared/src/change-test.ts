// G12 (2026-10-13, system review FIX_PLAN.md; criterion 3.4): did a change help? Seasonality and Google's own updates move every page
// of a site at once, so a before / after comparison alone proves nothing (P1: measuring a change needs a control or a counterfactual;
// P2: even the most reliable test type SearchPilot publishes wins only about two times in three). The Link Builder has always measured
// a won link against a control group of the site's OTHER pages over the same weeks; this is the same comparison for a PAGE CHANGE,
// and the same implementation as the engine's `n8n/seo-agent/v5/code/_change_test.js` — the two must agree to the decimal.
// The verdicts are graded and deliberately weak. Nothing here ever says a change CAUSED anything.

export type ChangeVerdict = 'likely_helped' | 'possibly_helped' | 'no_effect_yet' | 'too_early' | 'cant_tell';

export const CHANGE_VERDICT_LABELS: Record<ChangeVerdict, string> = {
  likely_helped: 'Likely helped',
  possibly_helped: 'Possibly helped',
  no_effect_yet: 'No clear effect yet',
  too_early: 'Too early to tell',
  cant_tell: 'Can’t tell',
};

export const CHANGE_VERDICT_TONES: Record<ChangeVerdict, 'good' | 'neutral' | 'warning'> = {
  likely_helped: 'good',
  possibly_helped: 'good',
  no_effect_yet: 'neutral',
  too_early: 'neutral',
  cant_tell: 'neutral',
};

export const CHANGE_TEST_METHOD =
  'Each change is dated and read against a control group: the same page’s average Google position before and after, minus what the site’s other pages did over the same weeks. That removes the part of the move that was the season, the market or a Google update. “Likely helped” means the page beat its control group by more than twice the spread of the control group itself and nothing else changed on that page in the same four weeks; “possibly helped” means it beat the control group by less than that; “no clear effect yet” means it did not. A control group narrows the alternatives: it is never proof of cause.';

/** a change read before this many weeks says "too early": Google needs weeks to settle */
export const CHANGE_MIN_WEEKS = 6;
/** fewer than this many other pages to compare with is no usable control group */
export const CHANGE_MIN_OTHERS = 3;

const r1 = (n: number) => Math.round(10 * n) / 10;

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
}

export interface ChangeTestInput {
  /** weeks since the change */
  weeks: number;
  /** the page's average position before the change (lower is better); null when there is no reading */
  base: number | null;
  /** its average position now */
  now: number | null;
  /** the control group: what the site's other pages moved over the same window (before − after) */
  others: readonly number[];
  /** something else changed on the same page inside four weeks: the credit is shared */
  joint?: number;
  /** 'page' (default) or 'link', which only changes the wording */
  kind?: 'page' | 'link';
  /** replaces the default "no reading" note, e.g. when the site has no Search Console data at all */
  noData?: string;
}

export interface ChangeTestResult {
  weeks: number;
  basePosition: number;
  position: number;
  /** places the page moved up (positive = up) */
  pageChange: number;
  controlChange: number;
  controlSpread: number;
  controlPages: number;
  /** the page's move minus the control group's */
  effect: number;
  verdict: ChangeVerdict;
  verdictLabel: string;
  note: string;
}

const NOTES = {
  link: { early: 'read at 6, 10 and 16 weeks after the link went live', noData: 'the page had no search impressions before or after the link' },
  page: { early: 'read at 6, 10 and 16 weeks after the change', noData: 'the page had no search impressions before or after the change' },
};

export function changeTest(input: ChangeTestInput): ChangeTestResult {
  const kind = input.kind === 'link' ? 'link' : 'page';
  const weeks = Math.max(0, Math.floor(Number(input.weeks) || 0));
  const empty: ChangeTestResult = {
    weeks,
    basePosition: 0,
    position: 0,
    pageChange: 0,
    controlChange: 0,
    controlSpread: 0,
    controlPages: 0,
    effect: 0,
    verdict: 'cant_tell',
    verdictLabel: CHANGE_VERDICT_LABELS.cant_tell,
    note: '',
  };
  if (weeks < CHANGE_MIN_WEEKS) return { ...empty, verdict: 'too_early', verdictLabel: CHANGE_VERDICT_LABELS.too_early, note: NOTES[kind].early };
  const base = input.base == null ? NaN : Number(input.base);
  const now = input.now == null ? NaN : Number(input.now);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) {
    return { ...empty, note: input.noData || NOTES[kind].noData };
  }
  const others = input.others.map(Number).filter((n) => Number.isFinite(n));
  const basePosition = r1(base);
  const position = r1(now);
  const pageChange = r1(basePosition - position);
  const mid = median(others);
  const controlChange = r1(mid);
  const controlSpread = r1(median(others.map((d) => Math.abs(d - mid))));
  const effect = r1(pageChange - controlChange);
  const joint = Number(input.joint) || 0;
  const verdict: ChangeVerdict =
    others.length < CHANGE_MIN_OTHERS
      ? effect > 1
        ? 'possibly_helped'
        : 'no_effect_yet'
      : effect > Math.max(1, 2 * controlSpread) && !joint
        ? 'likely_helped'
        : effect > Math.max(0.5, controlSpread)
          ? 'possibly_helped'
          : 'no_effect_yet';
  const note =
    (joint ? (kind === 'link' ? 'another link to this page within 4 weeks (credit shared); ' : 'another change to this page within 4 weeks (credit shared); ') : '') +
    (others.length < CHANGE_MIN_OTHERS ? 'few other pages to compare with; ' : '') +
    `position ${basePosition} → ${position} vs the site’s other pages ${controlChange >= 0 ? '+' : ''}${controlChange}`;
  return { weeks, basePosition, position, pageChange, controlChange, controlSpread, controlPages: others.length, effect, verdict, verdictLabel: CHANGE_VERDICT_LABELS[verdict], note };
}

/** one page change, dated, with its reading */
export interface PageChangeTest extends ChangeTestResult {
  url: string;
  /** what changed: published | rewritten */
  change: string;
  /** the date of the change */
  t0: string;
  keyword: string;
}

export interface PagePeriodPoint {
  periodEnd: string;
  page: string;
  query: string;
  position: number;
  impressions: number;
  clicks: number;
}

export interface PageChangeInput {
  /** one row per query × page × period, as `seo_query_history` stores them */
  points: readonly PagePeriodPoint[];
  /** the dated changes: a published or rewritten page */
  changes: readonly { url: string; t0: string; change: string; keyword?: string }[];
  /** today, for the week count */
  now?: Date;
  /** at most this many readings (newest changes first) */
  limit?: number;
}

const pathKey = (u: string): string =>
  String(u || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

/** the impression-weighted average position per page in one stored period, with its strongest query */
function pagePositions(points: readonly PagePeriodPoint[], periodEnd: string) {
  const m = new Map<string, { w: number; s: number; clicks: number; query: string; qi: number }>();
  for (const p of points) {
    if (p.periodEnd !== periodEnd || !p.page || !(p.position > 0)) continue;
    const k = pathKey(p.page);
    const i = Math.max(1, p.impressions || 0);
    const e = m.get(k) ?? { w: 0, s: 0, clicks: 0, query: p.query, qi: 0 };
    e.w += i;
    e.s += p.position * i;
    e.clicks += p.clicks || 0;
    if (i > e.qi) {
      e.query = p.query;
      e.qi = i;
    }
    m.set(k, e);
  }
  return m;
}

/**
 * Every dated page change read against the site's other pages, from the stored Search Console periods. Same shape as the Link
 * Builder's link readings, so one table and one set of words serve both.
 */
export function pageChangeTests(input: PageChangeInput): PageChangeTest[] {
  const now = input.now ?? new Date();
  const periods = [...new Set(input.points.map((p) => p.periodEnd).filter(Boolean))].sort();
  const last = periods[periods.length - 1];
  const changed = new Map<string, { url: string; t0: string; change: string; keyword: string }>();
  for (const c of input.changes) {
    const t0 = String(c.t0 ?? '').slice(0, 10);
    if (!t0 || !c.url) continue;
    const k = pathKey(c.url);
    const old = changed.get(k);
    if (!old || t0 > old.t0) changed.set(k, { url: c.url, t0, change: c.change, keyword: c.keyword ?? '' });
  }
  const list = [...changed.values()].sort((a, b) => b.t0.localeCompare(a.t0)).slice(0, input.limit ?? 30);
  const cache = new Map<string, ReturnType<typeof pagePositions>>();
  const at = (period: string) => {
    const hit = cache.get(period);
    if (hit) return hit;
    const m = pagePositions(input.points, period);
    cache.set(period, m);
    return m;
  };
  return list.map((c) => {
    const k = pathKey(c.url);
    const before = periods.filter((p) => p <= c.t0).pop();
    const B = before ? at(before) : null;
    const A = last && last !== before ? at(last) : null;
    const pb = B?.get(k);
    const pa = A?.get(k);
    const others =
      B && A
        ? [...A.keys()]
            .filter((x) => x !== k && B.has(x) && !(changed.has(x) && before !== undefined && changed.get(x)!.t0 >= before))
            .map((x) => B.get(x)!.s / B.get(x)!.w - A.get(x)!.s / A.get(x)!.w)
        : [];
    const weeks = Math.floor((now.getTime() - Date.parse(`${c.t0}T00:00:00Z`)) / (7 * 864e5));
    const res = changeTest({
      kind: 'page',
      weeks,
      base: pb ? pb.s / pb.w : null,
      now: pa ? pa.s / pa.w : null,
      others,
      noData: !input.points.length ? 'no Search Console data for this website yet' : !before ? 'no stored Search Console period from before the change' : undefined,
    });
    const read = res.verdict !== 'too_early' && res.verdict !== 'cant_tell';
    return { ...res, url: c.url, change: c.change, t0: c.t0, keyword: read ? pa?.query || pb?.query || c.keyword : c.keyword };
  });
}
