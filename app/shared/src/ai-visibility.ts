// AI visibility statistics the app shows next to the engine's figures (benchmark area 8, n8n/seo-agent/docs/system-review-2026-10-14/
// BENCH_AREA8_ai_visibility.md rows B8-6 and B8-7). The engine (n8n v5/code/_ai_stats.js) judges every rate with a 95% Wilson range and
// refuses a rate under a floor; these are the same formulas and the same floors, so the app never prints a figure more precise than the
// engine measured it, and the settings page can say what each panel size and cadence buys BEFORE the owner pays for it.
import { AI_DEFAULT_ENGINES, AI_PROMPTS_MAX, AI_PULSE_ENGINES, aiPulseQuestions, type AiEngine } from './constants';

/** under this many answers a headline rate is a straw poll (engine: MIN_RATE_SAMPLES) */
export const AI_MIN_RATE_SAMPLES = 12;
/** a per-question win rate needs this many answers before it says anything (engine: MIN_Q_SAMPLES) */
export const AI_MIN_QUESTION_SAMPLES = 4;
/** asked on the month's full run only, so never in the weekly figures (engine: AI_Plan.js CONFIG.monthly_engines) */
export const AI_MONTHLY_ENGINES: readonly AiEngine[] = ['claude'];
/** the AI Pulse runs Tuesday to Sunday */
export const AI_PULSE_DAYS_PER_WEEK = 6;
/** the panel sizes the precision table compares, besides the site's own */
export const AI_PRECISION_PANELS = [8, 20, 50] as const;

/** 95% Wilson range of k out of n, in percent rounded to 0.1 — the engine's `wilson` exactly. null without a sample. */
export function wilsonRange(k: number, n: number, z = 1.96): [number, number] | null {
  if (!n || n <= 0) return null;
  const kk = Math.max(0, Math.min(n, k));
  const p = kk / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, Math.round((1000 * (c - m)) / d) / 10), Math.min(100, Math.round((1000 * (c + m)) / d) / 10)];
}

/** Half the width of the 95% Wilson range, in points, for n answers at a true rate p (default 0.5: the widest it can be). */
export function halfWidth95(n: number, p = 0.5, z = 1.96): number | null {
  if (!n || n <= 0) return null;
  const d = 1 + (z * z) / n, m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.round((1000 * m) / d) / 10;
}

export interface QuestionWin {
  /** the share of the week's answers naming the business, as the engine computed it */
  rate: number | null;
  samples: number;
  ci: [number, number] | null;
  /** false = too few answers to call it a rate (the grid says so instead of printing 0% as a result) */
  enough: boolean;
  why: string;
}

/**
 * B8-6: a question's win rate with its range and its floor. The engine sends `win: { ci, enough, why }` in the callback; when it is
 * present it is used as sent, otherwise the same range is rebuilt from the rate and the sample (k = rate × samples, exact to 0.1%).
 */
export function questionWin(q: { winRate: number | null; samples: number; win?: { ci?: unknown; enough?: unknown; why?: unknown } | null }): QuestionWin {
  const n = Math.max(0, Math.round(Number(q.samples) || 0));
  const rate = q.winRate == null ? null : Number(q.winRate);
  const w = q.win ?? null;
  const sentCi = w && Array.isArray(w.ci) && w.ci.length === 2 && w.ci.every((x) => typeof x === 'number') ? (w.ci as [number, number]) : null;
  const k = rate == null ? 0 : Math.round((rate * n) / 100);
  const ci = sentCi ?? (rate == null ? null : wilsonRange(k, n));
  const enough = typeof w?.enough === 'boolean' ? w.enough : n >= AI_MIN_QUESTION_SAMPLES;
  const why = typeof w?.why === 'string' && w.why ? w.why
    : !n ? 'no answer came back for this question this week'
    : enough ? '' : `measured on ${n} answer${n === 1 ? '' : 's'} only — a rate needs ${AI_MIN_QUESTION_SAMPLES} before it says anything`;
  return { rate, samples: n, ci, enough, why };
}

/** What one question collects in a week: the weekly run's answers and the daily pulse's, measured or modelled. */
export interface AiSampleRate {
  weeklyPerQuestion: number;
  pulsePerQuestion: number;
  /** the share of requests that came back with an answer (1 when modelled) */
  answerRate: number;
  basis: 'measured' | 'modelled';
  /** whether the pulse figure was measured or projected from the weekly answer rate */
  pulseBasis: 'measured' | 'modelled' | 'off';
  why: string;
}

const weeklyEngines = (engines: readonly AiEngine[]) => engines.filter((e) => !AI_MONTHLY_ENGINES.includes(e));
const pulseEngines = (engines: readonly AiEngine[]) => AI_PULSE_ENGINES.filter((e) => engines.includes(e));
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Answers per question per week. Measured when the latest run is given (its 7-day sample over its buyer questions — the engine's own
 * figure, failed requests and AI Overviews Google did not show already left out); modelled otherwise (one answer per weekly engine per
 * question, six pulse mornings on the fast engines, every request answered — an upper bound, and it says so).
 */
export function aiSampleRate(o: {
  engines?: readonly AiEngine[];
  pulse?: boolean;
  measured?: { samples: number; pulseSamples: number; questions: number; checkedAt?: string; /** the engine's `metrics.rate_period` */ ratePeriod?: string | null } | null;
} = {}): AiSampleRate {
  const engines = o.engines && o.engines.length ? o.engines : AI_DEFAULT_ENGINES;
  const wE = weeklyEngines(engines).length, pE = pulseEngines(engines).length;
  const pulseOn = o.pulse !== false && pE > 0;
  const modelPulse = pulseOn ? AI_PULSE_DAYS_PER_WEEK * pE : 0;
  const m = o.measured;
  if (m && m.questions > 0 && m.samples > 0) {
    const weeklyN = Math.max(0, m.samples - (m.pulseSamples || 0));
    const weekly = weeklyN / m.questions;
    const answerRate = wE ? Math.min(1, weekly / wE) : 1;
    const measuredPulse = (m.pulseSamples || 0) / m.questions;
    const pulse = !pulseOn ? 0 : measuredPulse > 0 ? measuredPulse : modelPulse * answerRate;
    const pulseBasis: AiSampleRate['pulseBasis'] = !pulseOn ? 'off' : measuredPulse > 0 ? 'measured' : 'modelled';
    return {
      weeklyPerQuestion: r1(weekly), pulsePerQuestion: r1(pulse), answerRate: Math.round(answerRate * 100) / 100, basis: 'measured', pulseBasis,
      why: `measured on the run of ${m.checkedAt ? m.checkedAt.slice(0, 10) : 'the latest check'}: ${m.samples} answers ${m.ratePeriod?.trim() ? `from ${m.ratePeriod.trim()}` : 'over 7 days'} to ${m.questions} buyer question${m.questions === 1 ? '' : 's'}`
        + ` (${r1(weekly)} a question from the weekly run${measuredPulse > 0 ? `, ${r1(measuredPulse)} from the daily pulse` : ''})`
        + (pulseBasis === 'modelled' ? `; the daily pulse is projected at the same answer rate (${Math.round(answerRate * 100)}%)` : ''),
    };
  }
  return {
    weeklyPerQuestion: wE, pulsePerQuestion: modelPulse, answerRate: 1, basis: 'modelled', pulseBasis: pulseOn ? 'modelled' : 'off',
    why: `modelled before any run: ${wE} weekly engine${wE === 1 ? '' : 's'}${pulseOn ? ` and ${pE} pulse engine${pE === 1 ? '' : 's'} on ${AI_PULSE_DAYS_PER_WEEK} mornings` : ''}, every request answered — real runs lose some (failed requests, searches with no AI Overview), so the true range is a little wider`,
  };
}

export interface AiPrecisionRow {
  /** the panel setting (questions tracked, the brand question included) */
  panel: number;
  /** buyer questions asked every week (the panel without its brand question) */
  asked: number;
  cadence: 'weekly' | 'weekly_pulse';
  /** answers the headline rates are measured on over 7 days */
  answers: number;
  /** ± points at 95% on "named in" for the whole panel, at worst (a rate near 50%) */
  headline: number | null;
  answersPerQuestion: number;
  /** ± points at 95% on one question's win rate, at worst */
  perQuestion: number | null;
  /** whether one question collects enough answers for its own rate */
  perQuestionEnough: boolean;
  /** true for the site's own setting */
  current: boolean;
}

/**
 * B8-7: the achievable 95% half-width at each panel size and cadence, from the engine's own sample. Evertune publishes ±44 / ±9 / ±1
 * points for 1 / 100 / 10,000 samples and Gumshoe ±5; this is the same statement for THIS site's panel, so the panel size (G20) is
 * chosen against what it buys. Half-widths are the widest case (a rate near 50%): a rate near 0% or 100% is narrower.
 */
export function aiPrecisionTable(o: {
  panel: number;
  engines?: readonly AiEngine[];
  pulse?: boolean;
  measured?: { samples: number; pulseSamples: number; questions: number; checkedAt?: string } | null;
  panels?: readonly number[];
}): { basis: AiSampleRate['basis']; why: string; rate: AiSampleRate; pulseAvailable: boolean; rows: AiPrecisionRow[] } {
  const engines = o.engines && o.engines.length ? o.engines : AI_DEFAULT_ENGINES;
  const pulseAvailable = pulseEngines(engines).length > 0;
  // the pulse figure is wanted for the "with the daily pulse" rows even when the site has it off today
  const rate = aiSampleRate({ engines, pulse: true, measured: o.measured });
  const cur = Math.min(AI_PROMPTS_MAX, Math.max(3, Math.round(o.panel)));
  const panels = [...new Set([...(o.panels ?? AI_PRECISION_PANELS), cur])].filter((x) => x >= 3 && x <= AI_PROMPTS_MAX).sort((a, b) => a - b);
  const curPulse = o.pulse !== false && pulseAvailable;
  const rows: AiPrecisionRow[] = [];
  for (const panel of panels) {
    const asked = aiPulseQuestions(panel);
    for (const cadence of (pulseAvailable ? ['weekly', 'weekly_pulse'] : ['weekly']) as AiPrecisionRow['cadence'][]) {
      const perQ = rate.weeklyPerQuestion + (cadence === 'weekly_pulse' ? rate.pulsePerQuestion : 0);
      const answers = Math.round(perQ * asked);
      const qn = Math.round(perQ);
      rows.push({ panel, asked, cadence, answers, headline: halfWidth95(answers), answersPerQuestion: r1(perQ), perQuestion: halfWidth95(qn), perQuestionEnough: qn >= AI_MIN_QUESTION_SAMPLES,
        current: panel === cur && (cadence === 'weekly_pulse') === curPulse });
    }
  }
  return { basis: rate.basis, why: rate.why, rate, pulseAvailable, rows };
}
