// AI visibility fix wave F3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md A1, A4, A7, A8): what may be compared
// with what, and how the stored separators are read.
//
// A1. The engine refuses a week-on-week change when the engines or the questions changed (AI_Metrics.js `like`) and tests every headline
// change it does print (B8-1, `delta.tests`). It now stores that decision on the row (`seo_ai_visibility.compare_json`). The app reads it
// as stored; for a row written before the column existed it applies the same like-for-like rule on what the two rows record (the engines
// that answered, the question ids of `panel_json`, the panel size) and refuses the change whenever it cannot tell. Two rows are never
// subtracted blindly, and an arrow is only drawn for a change a test called real.

import { AI_MIN_RATE_SAMPLES } from './ai-visibility';

export type AiCompareMetricKey = 'named_rate' | 'cited_rate' | 'share_of_voice' | 'visibility_score' | 'avg_position';
export const AI_COMPARE_METRICS: readonly AiCompareMetricKey[] = ['named_rate', 'cited_rate', 'share_of_voice', 'visibility_score', 'avg_position'];

/** One figure's change against the previous comparable run. Rates are percentages (0-100); `delta` is in points. */
export interface AiMetricChange {
  now: number | null;
  prev: number | null;
  delta: number | null;
  nNow: number | null;
  nPrev: number | null;
  /** true: a real change at 95%; false: within the noise; null: not tested (no denominator, too few answers, or not comparable) */
  significant: boolean | null;
  p: number | null;
}

/** The period a run's headline rates were counted over (this run plus the pulse days since the previous stored run). */
export interface AiWindow {
  from: string;
  to: string;
  days: number | null;
}

export interface AiCompare {
  /** 'engine': read from the row's compare_json; 'app': the interim rule on an older row */
  source: 'engine' | 'app';
  ruleVersion: string;
  comparable: boolean;
  /** why there is no change to show (null when comparable) */
  reason: string | null;
  previousRunId: string | null;
  previousAt: string | null;
  /** share of this run's questions that the previous run asked too (0-1), null when not known */
  panelOverlap: number | null;
  enginesSame: boolean | null;
  window: AiWindow | null;
  metrics: Partial<Record<AiCompareMetricKey, AiMetricChange>>;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const r1 = (x: number) => Math.round(x * 10) / 10;

function parseJson(v: unknown): unknown {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function windowOf(v: unknown): AiWindow | null {
  const w = rec(v);
  const from = str(w.from), to = str(w.to);
  if (!from && !to) return null;
  return { from: from ?? '', to: to ?? '', days: num(w.days) };
}

/**
 * The engine's `compare_json` of a stored row. null when the row has none (an older row) or it cannot be read, so the caller falls back
 * to the interim rule and never to "comparable". A row the engine called not comparable carries no delta, whatever else it holds.
 */
export function parseAiCompareJson(json: unknown): AiCompare | null {
  const x = rec(parseJson(json));
  if (typeof x.comparable !== 'boolean') return null;
  const comparable = x.comparable;
  const m = rec(x.metrics);
  const metrics: AiCompare['metrics'] = {};
  for (const k of AI_COMPARE_METRICS) {
    if (!(k in m)) continue;
    const v = rec(m[k]);
    metrics[k] = {
      now: num(v.now),
      prev: num(v.prev),
      delta: comparable ? num(v.delta) : null,
      nNow: num(v.n_now),
      nPrev: num(v.n_prev),
      significant: comparable && typeof v.significant === 'boolean' ? v.significant : null,
      p: num(v.p),
    };
  }
  return {
    source: 'engine',
    ruleVersion: String(x.rule_version ?? ''),
    comparable,
    reason: comparable ? null : str(x.reason) ?? 'The engine did not compare this run with the previous one.',
    previousRunId: str(x.previous_run_id),
    previousAt: str(x.previous_at),
    panelOverlap: num(x.panel_overlap),
    enginesSame: typeof x.engines_same === 'boolean' ? x.engines_same : null,
    window: windowOf(x.window),
    metrics,
  };
}

// ---------------- the interim rule (rows without compare_json) ----------------

/** What the app can read off one stored row to compare it with another. */
export interface AiCompareSide {
  runId: string;
  checkedAt: string;
  prompts: number;
  /** answers the rates are counted on */
  samples: number;
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  visibilityScore: number | null;
  avgRank: number | null;
  /** the weekly engines that answered (monthly and carried engines left out), null when the row does not say */
  engines: string[] | null;
  /** the question ids the run asked (panel_json.ids), null when the row does not say */
  questionIds: string[] | null;
  /** panel_json.overlap_with_previous, the engine's own count against the run before */
  overlapWithPrevious?: { share: number | null; same: boolean | null } | null;
}

export const AI_COMPARE_APP_RULE = 'app-interim-1';
/** the engine's own threshold: under this share of shared questions it is a different panel (AIP.overlap) */
export const AI_COMPARE_MIN_OVERLAP = 0.8;
/** the engine's RT.comparable: panel sizes more than this far apart are not compared */
export const AI_COMPARE_MAX_SIZE_CHANGE = 0.2;
const MONTHLY = ['claude'];

/**
 * The engines a stored `engines_json` says were READ this run (the engine's `engSet`): weekly engines only, not carried, and only
 * those that answered or at least came back without an error. A row of an older shape without counts keeps the engine.
 */
export function aiEngineSetOf(engines: Record<string, unknown> | null | undefined): string[] | null {
  if (!engines || typeof engines !== 'object') return null;
  const keys = Object.keys(engines);
  if (!keys.length) return null;
  const answered = (v: unknown) => {
    const x = rec(v);
    if (x.samples == null && x.answered == null) return true;
    if ((Number(x.samples != null ? x.samples : x.answered) || 0) > 0) return true;
    const asked = Number(x.asked) || 0;
    return asked > 0 && (Number(x.errors) || 0) < asked;
  };
  return keys.filter((e) => !MONTHLY.includes(e) && !(rec(engines[e]).carried === true || rec(engines[e]).carried === 'true') && answered(engines[e])).sort();
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 through erf), enough for a two-sided p-value. */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Two-proportion z-test (pooled), the engine's `changeOf` / `_ai_stats.js`: k1 of n1 now against k2 of n2 before. Under the floor of
 * AI_MIN_RATE_SAMPLES answers on either side there is no test (significant null).
 */
export function aiTwoProportion(k1: number, n1: number, k2: number, n2: number): { z: number | null; p: number | null; significant: boolean | null } {
  if (!(n1 >= AI_MIN_RATE_SAMPLES) || !(n2 >= AI_MIN_RATE_SAMPLES)) return { z: null, p: null, significant: null };
  const p1 = k1 / n1, p2 = k2 / n2, pool = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return { z: 0, p: 1, significant: false };
  const z = (p1 - p2) / se;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return { z: Math.round(z * 100) / 100, p: Math.round(p * 10000) / 10000, significant: p < 0.05 };
}

const day = (iso: string) => String(iso || '').slice(0, 10);
const daysBetween = (a: string, b: string): number | null => {
  const x = Date.parse(a), y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.max(0, Math.round((y - x) / 864e5)) : null;
};
const names = (l: string[]) => l.join(', ') || 'none';

/**
 * The like-for-like rule for two stored rows that carry no compare_json: the same weekly engines, at least 80% of this run's questions
 * asked then too (when both rows record their ids, else the engine's own overlap count on this row), and panel sizes within 20%. When the
 * rows do not record which questions they asked, nothing is compared: unknown is never "comparable".
 */
export function aiCompareInterim(now: AiCompareSide, prev: AiCompareSide | null): AiCompare {
  const base: AiCompare = {
    source: 'app',
    ruleVersion: AI_COMPARE_APP_RULE,
    comparable: false,
    reason: null,
    previousRunId: prev?.runId || null,
    previousAt: prev?.checkedAt || null,
    panelOverlap: null,
    enginesSame: null,
    window: prev ? { from: day(prev.checkedAt), to: day(now.checkedAt), days: daysBetween(prev.checkedAt, now.checkedAt) } : null,
    metrics: {},
  };
  if (!prev) return { ...base, reason: 'This is the first stored run: changes appear from the next comparable run.' };
  const then = day(prev.checkedAt);
  if (now.engines && prev.engines) {
    base.enginesSame = now.engines.join('+') === prev.engines.join('+');
    if (!base.enginesSame) return { ...base, reason: `Not compared with ${then}: different engines answered (${names(prev.engines)} then, ${names(now.engines)} now), a different measurement, not a different result.` };
  } else return { ...base, reason: `Not compared with ${then}: the stored runs do not record which engines answered.` };
  if (now.questionIds && prev.questionIds && now.questionIds.length) {
    const before = new Set(prev.questionIds);
    const common = now.questionIds.filter((id) => before.has(id)).length;
    base.panelOverlap = Math.round((common / now.questionIds.length) * 1000) / 1000;
  } else if (now.overlapWithPrevious && now.overlapWithPrevious.share != null) {
    base.panelOverlap = now.overlapWithPrevious.share;
    if (now.overlapWithPrevious.same === false) base.panelOverlap = Math.min(base.panelOverlap, AI_COMPARE_MIN_OVERLAP - 0.001);
  }
  if (base.panelOverlap == null) return { ...base, reason: `Not compared with ${then}: the stored runs do not record which questions they asked.` };
  if (base.panelOverlap < AI_COMPARE_MIN_OVERLAP)
    return { ...base, reason: `Not compared with ${then}: only ${Math.round(base.panelOverlap * 100)}% of the questions asked now were asked then, a different panel, not a different result.` };
  const a = Number(now.prompts) || 0, b = Number(prev.prompts) || 0;
  if (a && b && Math.abs(a - b) / Math.max(a, b) > AI_COMPARE_MAX_SIZE_CHANGE)
    return { ...base, reason: `Not compared with ${then}: the panel changed from ${b} to ${a} questions.` };

  const nNow = Math.max(0, Math.round(Number(now.samples) || 0)), nPrev = Math.max(0, Math.round(Number(prev.samples) || 0));
  const rate = (k: 'mentionRate' | 'citationRate'): AiMetricChange => {
    const t = aiTwoProportion(Math.round((now[k] * nNow) / 100), nNow, Math.round((prev[k] * nPrev) / 100), nPrev);
    return { now: now[k], prev: prev[k], delta: r1(now[k] - prev[k]), nNow, nPrev, significant: t.significant, p: t.p };
  };
  // share of voice, the score and the position have no denominator on the row: their change is shown, never called real
  const untested = (x: number | null, y: number | null): AiMetricChange => ({ now: x, prev: y, delta: x != null && y != null ? r1(x - y) : null, nNow, nPrev, significant: null, p: null });
  return {
    ...base,
    comparable: true,
    metrics: {
      named_rate: rate('mentionRate'),
      cited_rate: rate('citationRate'),
      share_of_voice: untested(now.shareOfVoice, prev.shareOfVoice),
      visibility_score: untested(now.visibilityScore, prev.visibilityScore),
      avg_position: untested(now.avgRank && now.avgRank > 0 ? now.avgRank : null, prev.avgRank && prev.avgRank > 0 ? prev.avgRank : null),
    },
  };
}

/** The change of one figure as the UI may print it: a delta only on a comparable pair, with its verdict. */
export function aiChangeOf(c: AiCompare | null | undefined, k: AiCompareMetricKey): { delta: number | null; verdict: 'real' | 'noise' | 'untested' | 'none' } {
  if (!c || !c.comparable) return { delta: null, verdict: 'none' };
  const m = c.metrics[k];
  if (!m || m.delta == null) return { delta: null, verdict: 'none' };
  return { delta: m.delta, verdict: m.significant === true ? 'real' : m.significant === false ? 'noise' : 'untested' };
}

/** A8: the period the run's rates were counted over, in words; "since the previous run" when the row does not say. */
export function aiWindowLabel(c: AiCompare | null | undefined): string {
  const w = c?.window;
  if (w && w.from && w.to) return `${w.from} to ${w.to}${w.days != null ? ` (${w.days} day${w.days === 1 ? '' : 's'})` : ''}`;
  if (c?.previousAt) return `since the previous run (${day(c.previousAt)})`;
  return 'this run';
}

// ---------------- A4: the engine's separators ----------------

export type AiAlertLevel = 'high' | 'medium' | 'low' | 'info';
export interface AiAlert {
  level: AiAlertLevel;
  text: string;
}

/**
 * Alerts of a stored row: the engine joins them with " | " (AI_Metrics.js, Pulse_Metrics.js) and each one starts with its level
 * ("high: ..."); an alert's own text may hold commas. A JSON array (a later engine) is read as such.
 */
export function aiAlertsOf(v: unknown): AiAlert[] {
  const parsed = typeof v === 'string' && v.trim().startsWith('[') ? parseJson(v) : Array.isArray(v) ? v : null;
  const parts: unknown[] = Array.isArray(parsed) ? parsed : String(v ?? '').split(/\s*\|\s*/);
  const out: AiAlert[] = [];
  for (const p of parts) {
    if (p && typeof p === 'object') {
      const o = rec(p);
      const text = String(o.text ?? '').trim();
      if (text) out.push({ level: levelOf(String(o.level ?? '')), text });
      continue;
    }
    const s = String(p ?? '').trim();
    if (!s) continue;
    const m = s.match(/^(critical|high|medium|warning|low|info)\s*:\s*(.+)$/is);
    out.push(m ? { level: levelOf(m[1]), text: m[2].trim() } : { level: 'info', text: s });
  }
  return out;
}
function levelOf(s: string): AiAlertLevel {
  const l = s.toLowerCase();
  return l === 'critical' || l === 'high' ? 'high' : l === 'medium' || l === 'warning' ? 'medium' : l === 'low' ? 'low' : 'info';
}

/** URLs the engine joined with spaces (Parse_AI_Answers.js `our_urls`); a JSON array is read as such; commas and new lines split too. */
export function aiUrlsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  const s = String(v ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    const a = parseJson(s);
    if (Array.isArray(a)) return a.map((x) => (x && typeof x === 'object' ? String(rec(x).u ?? rec(x).url ?? '') : String(x ?? ''))).map((x) => x.trim()).filter(Boolean);
  }
  return [...new Set(s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean))];
}

// ---------------- A7: a pulse morning that did not ask the whole panel ----------------

export interface AiPulseDayInfo {
  /** 'full': the whole panel; 'sample': a rotating sample of it; '' unknown (older row) */
  sampleMode: 'full' | 'sample' | '';
  questionsAsked: number | null;
  panelSize: number | null;
  enginesAnswered: string[] | null;
  /** some engine returned nothing that morning */
  partial: boolean;
}

/** The pulse row's own record of what it asked (the new columns, else `sample_json`); an older row says nothing and reads as unknown. */
export function aiPulseDayInfo(row: { sample_mode?: unknown; questions_asked?: unknown; engines_answered?: unknown; partial?: unknown; sample_json?: unknown }): AiPulseDayInfo {
  const sj = rec(parseJson(row.sample_json));
  const modeRaw = String(row.sample_mode ?? sj.mode ?? '').toLowerCase();
  const asked = num(row.questions_asked) ?? num(sj.asked) ?? (Array.isArray(sj.asked) ? (sj.asked as unknown[]).length : null) ?? num(sj.questions);
  const panel = num(sj.panel_size) ?? num(sj.panel);
  const engRaw = row.engines_answered;
  const engines = Array.isArray(engRaw) ? engRaw.map(String) : typeof engRaw === 'string' && engRaw.trim() ? (engRaw.trim().startsWith('[') ? ((parseJson(engRaw) as unknown[]) ?? []).map(String) : engRaw.split(/[\s,|]+/).filter(Boolean)) : null;
  const sampleMode: AiPulseDayInfo['sampleMode'] = modeRaw === 'full' ? 'full' : modeRaw === 'sample' || modeRaw === 'rotating' ? 'sample' : asked != null && panel != null && asked < panel ? 'sample' : '';
  return { sampleMode, questionsAsked: asked, panelSize: panel, enginesAnswered: engines, partial: row.partial === true || row.partial === 'true' || row.partial === 1 };
}
