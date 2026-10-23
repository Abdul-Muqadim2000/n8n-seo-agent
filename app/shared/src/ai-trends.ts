// AI visibility wave 2 (W2-A, 2026-10-23): the page's filter, the trend lines with their breaks, the owner's alert rules (WAVE2_CONTRACTS.md
// §4) and the "part of the open run" note (§6).
//
// A trend line is never drawn across a run the engine did not compare with the one before it (`compare_json.comparable` false, or the
// app's like-for-like rule on an older row): the line stops, a dashed marker says why, and the next segment starts fresh. A rule fires
// only on a comparable pair, only when its own test passes, and only when the change is at least the owner's threshold.

import { z } from 'zod';
import type { AiCompare } from './ai-compare';

const S = (v: unknown, max = 80): string => (typeof v === 'string' ? v.trim().slice(0, max) : Array.isArray(v) && typeof v[0] === 'string' ? v[0].trim().slice(0, max) : '');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---------------- the filter bar ----------------

export const AI_FILTER_DIMS = ['engine', 'cluster', 'persona', 'market', 'stage'] as const;
export type AiFilterDim = (typeof AI_FILTER_DIMS)[number];
export interface AiFilter { engine: string; cluster: string; persona: string; market: string; stage: string; from: string; to: string }
export const AI_FILTER_EMPTY: AiFilter = { engine: '', cluster: '', persona: '', market: '', stage: '', from: '', to: '' };
export const AI_FILTER_LABEL: Record<AiFilterDim, string> = { engine: 'Engine', cluster: 'Topic', persona: 'Buyer role', market: 'Market', stage: 'Stage' };

/** The filter from a query string (the page's URL, or an API call): trimmed, dates only as YYYY-MM-DD, anything else dropped. */
export function aiFilterFrom(q: Record<string, unknown> | URLSearchParams | null | undefined): AiFilter {
  const get = (k: string): unknown => (q instanceof URLSearchParams ? q.get(k) : q ? q[k] : undefined);
  const day = (k: string) => { const v = S(get(k), 10); return DAY.test(v) ? v : ''; };
  return { engine: S(get('engine'), 40), cluster: S(get('cluster')), persona: S(get('persona'), 40), market: S(get('market'), 8), stage: S(get('stage'), 20), from: day('from'), to: day('to') };
}
/** Only the keys that are set, for a URL or a query key. */
export function aiFilterQuery(f: Partial<AiFilter>): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'string' && v));
}
/** The dimensions set (not the dates). */
export const aiFilterDims = (f: AiFilter): AiFilterDim[] => AI_FILTER_DIMS.filter((d) => !!f[d]);
/** One dimension set (dates aside): the segment the engine already measures for every run, so it has a trend of its own. */
export function aiFilterSegment(f: AiFilter): { dim: AiFilterDim; key: string } | null {
  const d = aiFilterDims(f);
  return d.length === 1 ? { dim: d[0], key: f[d[0]] } : null;
}
export const aiInRange = (iso: string, f: Pick<AiFilter, 'from' | 'to'>): boolean => {
  const day = String(iso ?? '').slice(0, 10);
  return (!f.from || day >= f.from) && (!f.to || day <= f.to);
};

/** What an answer needs to be filtered (the question's role, market, stage and topic come from the panel row). */
export interface AiFilterable { engine: string; promptId: string }
export interface AiPromptFacets { cluster: string; persona: string; market: string; stage: string }
export function aiMatchesFilter(a: AiFilterable, p: AiPromptFacets | undefined, f: AiFilter): boolean {
  if (f.engine && a.engine !== f.engine) return false;
  if (!f.cluster && !f.persona && !f.market && !f.stage) return true;
  if (!p) return false;
  return (!f.cluster || p.cluster === f.cluster) && (!f.persona || p.persona === f.persona) && (!f.market || p.market === f.market) && (!f.stage || p.stage === f.stage);
}

// ---------------- rates with their range ----------------

/** 95% Wilson range in percent, one decimal (the engine's `wilson`). null without answers. */
export function aiWilson(k: number, n: number): [number, number] | null {
  if (!(n > 0)) return null;
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, Math.round((1000 * (c - m)) / d) / 10), Math.min(100, Math.round((1000 * (c + m)) / d) / 10)];
}
/** Two-proportion z-test (the engine's `changeOf`): real when |z| >= 1.96 AND the move is >= 5 points; untested under 12 answers a side. */
export function aiTwoProp(r1: number, n1: number, r0: number, n0: number): { significant: boolean | null; z: number | null } {
  if (!(n1 >= 12) || !(n0 >= 12)) return { significant: null, z: null };
  const k1 = (r1 / 100) * n1, k0 = (r0 / 100) * n0, p = (k1 + k0) / (n1 + n0);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n0));
  if (!(se > 0)) return { significant: false, z: 0 };
  const z = (r1 / 100 - r0 / 100) / se;
  return { significant: Math.abs(z) >= 1.96 && Math.abs(r1 - r0) >= 5, z: Math.round(z * 100) / 100 };
}

// ---------------- trend lines with breaks ----------------

export interface AiTrendRun { runId: string; checkedAt: string; compare: AiCompare | null }
/** A break before run i: the engine (or the like-for-like rule) did not compare it with the run before. The first run is no break. */
export const aiIsBreak = (r: AiTrendRun, i: number): boolean => i > 0 && !!r.compare && !r.compare.comparable;

/**
 * Rows for a line chart where a not-comparable run starts a new segment: a gap row (every series null) sits between the two runs, so a
 * chart drawn with connectNulls off stops the line there. `breaks` lists the runs that start a segment, with the reason, for the markers.
 */
export function aiTrendRows<R extends AiTrendRun>(runs: readonly R[], values: (r: R) => Record<string, number | null | [number, number] | string>): { rows: Record<string, unknown>[]; breaks: { at: string; reason: string }[] } {
  const rows: Record<string, unknown>[] = [];
  const breaks: { at: string; reason: string }[] = [];
  runs.forEach((r, i) => {
    if (aiIsBreak(r, i)) {
      const prev = runs[i - 1];
      const mid = new Date((Date.parse(prev.checkedAt) + Date.parse(r.checkedAt)) / 2).toISOString();
      rows.push({ checkedAt: mid, gap: true });
      breaks.push({ at: r.checkedAt, reason: r.compare?.reason ?? 'Not compared with the run before' });
    }
    rows.push({ checkedAt: r.checkedAt, runId: r.runId, ...values(r) });
  });
  return { rows, breaks };
}

// ---------------- the owner's alert rules (§4 ai_alert_rules_json) ----------------

export const AI_RULE_METRICS = ['named_rate', 'cited_rate', 'share_of_voice', 'visibility_score', 'avg_position', 'competitor_share'] as const;
export type AiRuleMetric = (typeof AI_RULE_METRICS)[number];
export const AI_RULE_METRIC_LABEL: Record<AiRuleMetric, string> = {
  named_rate: 'Named in answers',
  cited_rate: 'Your pages cited',
  share_of_voice: 'Share of voice',
  visibility_score: 'AI visibility score',
  avg_position: 'Average place named',
  competitor_share: "A competitor's share of voice",
};
/** what a threshold is counted in, per metric */
export const AI_RULE_UNIT: Record<AiRuleMetric, string> = { named_rate: 'points', cited_rate: 'points', share_of_voice: 'points', visibility_score: 'points of 100', avg_position: 'places', competitor_share: 'points' };
export const AI_RULES_MAX = 20;

const ruleScope = z
  .object({
    engine: z.string().trim().max(40).optional(),
    cluster: z.string().trim().max(80).optional(),
    persona: z.string().trim().max(40).optional(),
    market: z.string().trim().max(8).optional(),
    competitor: z.string().trim().max(120).optional(),
  })
  .default({});
export const aiAlertRuleSchema = z
  .object({
    id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Use letters, numbers, - or _'),
    metric: z.enum(AI_RULE_METRICS, { message: 'Choose what to watch' }),
    scope: ruleScope,
    direction: z.enum(['drop', 'rise', 'any']).default('drop'),
    threshold_points: z.number({ message: 'Enter a number' }).min(0.5, 'At least 0.5').max(100, 'At most 100'),
    enabled: z.boolean().default(true),
  })
  .superRefine((r, ctx) => {
    if (r.metric === 'competitor_share' && !r.scope.competitor) ctx.addIssue({ code: 'custom', path: ['scope', 'competitor'], message: 'Name the competitor this rule watches' });
    if (r.metric !== 'competitor_share' && r.scope.competitor) ctx.addIssue({ code: 'custom', path: ['scope', 'competitor'], message: "A competitor applies only to a competitor's share of voice" });
    if (r.metric === 'avg_position' && r.threshold_points > 20) ctx.addIssue({ code: 'custom', path: ['threshold_points'], message: 'A place in an answer moves by 20 at most' });
    if (r.scope.market && !/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/.test(r.scope.market)) ctx.addIssue({ code: 'custom', path: ['scope', 'market'], message: 'Use a country code and a language, e.g. SA-en' });
  });
export type AiAlertRule = z.output<typeof aiAlertRuleSchema>;
export const aiAlertRulesSchema = z
  .array(aiAlertRuleSchema)
  .max(AI_RULES_MAX, `At most ${AI_RULES_MAX} rules`)
  .superRefine((rules, ctx) => {
    const seen = new Set<string>();
    rules.forEach((r, i) => {
      if (seen.has(r.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Two rules have the same id' });
      seen.add(r.id);
    });
  });

/** The stored ai_alert_rules_json read back (a bad row is dropped, never fatal). */
export function aiAlertRulesOf(v: unknown): AiAlertRule[] {
  let j: unknown = v;
  if (typeof v === 'string') {
    try { j = v.trim() ? JSON.parse(v) : []; } catch { j = []; }
  }
  if (!Array.isArray(j)) return [];
  return j.map((r) => aiAlertRuleSchema.safeParse(r)).filter((r) => r.success).map((r) => r.data!).slice(0, AI_RULES_MAX);
}

/** A rule in words, e.g. "Named in answers on ChatGPT drops by 5 points or more". */
export function aiRuleSentence(r: Pick<AiAlertRule, 'metric' | 'scope' | 'direction' | 'threshold_points'>, engineName: (k: string) => string = (k) => k): string {
  const where = [r.scope.engine ? `on ${engineName(r.scope.engine)}` : '', r.scope.cluster ? `for "${r.scope.cluster}"` : '', r.scope.persona ? `for ${r.scope.persona}` : '', r.scope.market ? `in ${r.scope.market}` : ''].filter(Boolean).join(' ');
  const what = r.metric === 'competitor_share' ? `${r.scope.competitor || 'A competitor'}'s share of voice` : AI_RULE_METRIC_LABEL[r.metric];
  const move = r.direction === 'drop' ? (r.metric === 'avg_position' ? 'gets worse' : 'drops') : r.direction === 'rise' ? (r.metric === 'avg_position' ? 'improves' : 'rises') : 'moves';
  return `${what}${where ? ' ' + where : ''} ${move} by ${r.threshold_points} ${AI_RULE_UNIT[r.metric]} or more`;
}

/** What the preview reads off one stored run. */
export interface AiRuleRun extends AiTrendRun {
  engines?: { key: string; mentionRate: number | null; citationRate: number | null; samples: number }[];
  sov?: { id: string; name: string; share: number | null; n: number }[];
  samples?: number;
}
export interface AiRulePreview {
  /** comparable pairs the rule could be judged on */
  evaluated: number;
  fired: { at: string; delta: number; note: string }[];
  /** pairs left out: not comparable / the figure was not tested / not on record */
  notComparable: number;
  untested: number;
  /** the rule cannot be judged on the stored runs at all (a topic, role or market scope), with the reason */
  unavailable: string | null;
}

/**
 * How often a rule would have fired on the stored runs, judged the way the engine will judge it: only comparable pairs, only when the
 * figure's own test called the change real, and only when |change| >= threshold in the rule's direction. Topic, role and market scopes
 * are judged by the engine from the run's segments and are not previewed here (said so, never guessed).
 */
export function aiRulePreview(rule: Pick<AiAlertRule, 'metric' | 'scope' | 'direction' | 'threshold_points'>, runs: readonly AiRuleRun[]): AiRulePreview {
  const out: AiRulePreview = { evaluated: 0, fired: [], notComparable: 0, untested: 0, unavailable: null };
  if (rule.scope.cluster || rule.scope.persona || rule.scope.market) {
    out.unavailable = 'Topic, buyer role and market rules are judged by the engine on each run from that segment; the stored history keeps only the latest run\'s segments, so there is nothing to replay.';
    return out;
  }
  const want = (d: number) => {
    // a place is better when it falls: "drop" on avg_position means the place number rises
    const worse = rule.metric === 'avg_position' ? d > 0 : d < 0;
    return Math.abs(d) >= rule.threshold_points && (rule.direction === 'any' || (rule.direction === 'drop' ? worse : !worse));
  };
  const KEY: Partial<Record<AiRuleMetric, 'named_rate' | 'cited_rate' | 'share_of_voice' | 'visibility_score' | 'avg_position'>> = { named_rate: 'named_rate', cited_rate: 'cited_rate', share_of_voice: 'share_of_voice', visibility_score: 'visibility_score', avg_position: 'avg_position' };
  for (let i = 1; i < runs.length; i++) {
    const r = runs[i], p = runs[i - 1];
    if (!r.compare || !r.compare.comparable) { out.notComparable++; continue; }
    let delta: number | null = null, significant: boolean | null = null;
    if (rule.scope.engine) {
      if (rule.metric !== 'named_rate' && rule.metric !== 'cited_rate') { out.untested++; continue; }
      const k = rule.metric === 'named_rate' ? 'mentionRate' : 'citationRate';
      const a = r.engines?.find((e) => e.key === rule.scope.engine), b = p.engines?.find((e) => e.key === rule.scope.engine);
      if (!a || !b || a[k] == null || b[k] == null) { out.untested++; continue; }
      delta = Math.round(((a[k] as number) - (b[k] as number)) * 10) / 10;
      significant = aiTwoProp(a[k] as number, a.samples, b[k] as number, b.samples).significant;
    } else if (rule.metric === 'competitor_share') {
      const id = String(rule.scope.competitor ?? '').toLowerCase();
      const find = (x: AiRuleRun) => x.sov?.find((b) => b.id.toLowerCase() === id || b.name.toLowerCase() === id);
      const a = find(r), b = find(p);
      if (!a || !b || a.share == null || b.share == null || !r.samples || !p.samples) { out.untested++; continue; }
      delta = Math.round((a.share - b.share) * 10) / 10;
      significant = aiTwoProp(a.share, r.samples, b.share, p.samples).significant;
    } else {
      const m = r.compare.metrics[KEY[rule.metric]!];
      if (!m || m.delta == null) { out.untested++; continue; }
      delta = m.delta;
      significant = m.significant;
    }
    if (significant == null) { out.untested++; continue; }
    out.evaluated++;
    if (significant && delta != null && want(delta)) out.fired.push({ at: r.checkedAt, delta, note: `${delta > 0 ? '+' : ''}${delta} ${AI_RULE_UNIT[rule.metric]}` });
  }
  return out;
}

// ---------------- §6: a start that joins the open run ----------------

/** The run stage the app records for an on-demand start the engine joined to its open run (not a failure: nothing is charged twice). */
export const AI_JOINED_OPEN_RUN = 'joined_open_run';

/** The note for a `rejected` callback with reason 'open_run': "Part of the open run (finishes about 09:40 UTC)." + the engine's sentence. */
export function aiOpenRunNote(body: Record<string, unknown>): string | null {
  if (String(body.reason ?? '') !== 'open_run') return null;
  const o = body.open_run && typeof body.open_run === 'object' ? (body.open_run as Record<string, unknown>) : {};
  const t = Date.parse(String(o.expected_finish ?? ''));
  const when = Number.isFinite(t) ? ` (finishes about ${new Date(t).toISOString().slice(11, 16)} UTC${new Date(t).toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10) ? ` on ${new Date(t).toISOString().slice(0, 10)}` : ''})` : '';
  const sentence = typeof body.error === 'string' ? body.error.trim() : '';
  return `Part of the open run${when}.${sentence ? ' ' + sentence : ''}`.slice(0, 1000);
}
