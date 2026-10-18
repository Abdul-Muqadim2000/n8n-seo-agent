// G6 (2026-10-18, n8n/seo-agent/AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale — the app's half of the engine's
// AIP kit (n8n/seo-agent/v5/code/_ai_panel.js). ONE cost formula: this file mirrors AIP.cost value for value, and both are held to the same
// golden cases (n8n/seo-agent/v5/data/ai_panel_cost_cases.json, copied by the engine build to ./ai-panel-cost-cases.generated.ts; the engine
// runs them in harness S211, the app in cost.aipanel.test.ts). Change a price or a rule on one side and the other side's test fails.
//
// What it answers, before the owner pays: what a panel of N questions on these engines with this pulse setting costs per weekly run, per
// pulse morning and per month; how many executions a weekly run is split into; how many mornings a week the pulse asks each question; and
// the 95% half-widths the panel buys on the weekly headline and on a typical topic cluster.

/** DataForSEO price per question on each engine. The two API engines are estimates until their first live call. */
export const AI_PANEL_PRICE = { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, copilot: 0.002, chatgpt_api: 0.012, gemini_api: 0.02 } as const;
export type AiPanelEngine = keyof typeof AI_PANEL_PRICE;
export const AI_PANEL_PRICE_BASIS: Partial<Record<AiPanelEngine, string>> = {
  chatgpt_api: 'estimate: DataForSEO $0.0002 a task + OpenAI tokens + web search (~$0.01); confirm on the first live run',
  gemini_api: 'estimate: DataForSEO $0.0002 a task + Gemini tokens + Google Search grounding; confirm on the first live run',
};
export const AI_PANEL_DEFAULT_ENGINES: readonly AiPanelEngine[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
export const AI_PANEL_MONTHLY_ENGINES: readonly AiPanelEngine[] = ['claude'];
export const AI_PANEL_PULSE_ENGINES: readonly AiPanelEngine[] = ['chatgpt', 'gemini', 'ai_mode', 'copilot'];
export const AI_PANEL_LIMITS = {
  min: 3, max: 500, default_new: 50, default_stored: 20, chunk_requests: 600, pulse_max_requests: 900, full_pulse_max_panel: 50,
  target_headline: 3, target_cluster: 8, cluster_size_guess: 12, max_run_usd: 150,
} as const;
export const AI_PANEL_FIXED = {
  weekly_ai_min: 0.13, brief_ai: 0.03, analyst_job_ai: 0.02, analyst_per_job: 12, analyst_share: 0.35, analyst_cap_base: 24, analyst_cap_max: 60,
  full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6,
} as const;
export type AiPulseMode = '' | 'auto' | 'sample' | 'full';

const n0 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** The panel size a site is held to: no monitors row = 50; an empty stored size = 20 (a release never raises a site's spend); else 3-500. */
export function aiPanelSize(row: { siteId?: string | null; promptsMax?: number | null } | null): number {
  if (!row || !row.siteId) return AI_PANEL_LIMITS.default_new;
  const v = Number(row.promptsMax);
  if (row.promptsMax == null || !Number.isFinite(v) || v <= 0) return AI_PANEL_LIMITS.default_stored;
  return clamp(Math.round(v), AI_PANEL_LIMITS.min, AI_PANEL_LIMITS.max);
}

/** Half the width of the 95% Wilson range at n answers and a true rate p (default 0.5, the widest), in points rounded to 0.1. */
export function aiHalfWidth(n: number, p = 0.5): number | null {
  const N = n0(n); if (N <= 0) return null;
  const z = 1.96, d = 1 + (z * z) / N, m = z * Math.sqrt((p * (1 - p)) / N + (z * z) / (4 * N * N));
  return Math.round((1000 * m) / d) / 10;
}

export interface AiPulsePlan { perWeek: number; headline: number | null; cluster: number | null; capped: boolean; why: string }

/** N: how many of the six pulse mornings a week each question is asked (AIP.pulsePerWeek). */
export function aiPulsePerWeek(o: { asked: number; weeklyEngines: number; pulseEngines: number; clusterSize?: number; mode?: AiPulseMode | string; perWeek?: number | null }): AiPulsePlan {
  const L = AI_PANEL_LIMITS;
  const asked = Math.max(1, n0(o.asked)), wE = Math.max(0, n0(o.weeklyEngines)), pE = Math.max(0, n0(o.pulseEngines));
  const cl = Math.max(1, n0(o.clusterSize) || L.cluster_size_guess);
  const capQ = pE ? Math.floor(L.pulse_max_requests / pE) : asked;
  const capN = Math.max(1, Math.min(6, Math.floor((6 * capQ) / asked)));
  const at = (N: number) => ({ headline: aiHalfWidth(asked * (wE + N * pE)), cluster: aiHalfWidth(Math.min(asked, cl) * (wE + N * pE)) });
  const mode = String(o.mode || '').toLowerCase();
  if (!pE) return { perWeek: 0, ...at(0), capped: false, why: 'no pulse engine is on' };
  if (mode === 'full' || (mode !== 'sample' && asked <= L.full_pulse_max_panel - 1)) {
    const N = Math.min(6, capN);
    return { perWeek: N, ...at(N), capped: N < 6, why: N < 6 ? `every question every morning would be ${asked * pE} requests; one morning asks at most ${L.pulse_max_requests}, so each question is asked ${N} mornings a week` : 'every question, every pulse morning' };
  }
  const fixed = n0(o.perWeek);
  if (fixed >= 1) { const N = Math.min(6, Math.round(fixed), capN); return { perWeek: N, ...at(N), capped: N < Math.round(fixed), why: `set by the owner: each question ${N} morning(s) a week${N < Math.round(fixed) ? ` (more would pass the ${L.pulse_max_requests}-request morning limit)` : ''}` }; }
  for (let N = 1; N <= capN; N++) { const h = at(N); if ((h.headline ?? 99) <= L.target_headline && (h.cluster ?? 99) <= L.target_cluster) return { perWeek: N, ...h, capped: false, why: `the fewest mornings that bring the weekly rate to ±${h.headline} points and a ${cl}-question cluster to ±${h.cluster} (95%)` }; }
  return { perWeek: capN, ...at(capN), capped: true, why: `the most one morning allows (${L.pulse_max_requests} requests): a ${cl}-question cluster reaches ±${at(capN).cluster} points, not ±${L.target_cluster}` };
}

export interface AiMoney { dfs: number; ai: number; usd: number }
export interface AiPanelCost {
  panel: number; asked: number; engines: AiPanelEngine[]; weeklyEngines: AiPanelEngine[]; pulseEngines: AiPanelEngine[];
  perWeek: number; pulseQuestionsDay: number; pulseWhy: string; pulseCapped: boolean;
  requests: { weekly: number; full: number; pulseDay: number };
  executions: number; analystJobs: number;
  halfWidth: { headline: number | null; cluster: number | null };
  run: { weekly: AiMoney; full: AiMoney }; fullExtra: AiMoney; pulseDay: AiMoney;
  month: { weekly: number; fullExtra: number; pulse: number; total: number };
  prices: { engine: AiPanelEngine; usd: number; basis: string }[];
}

/** The one AI-panel cost formula (AIP.cost). Every figure in US dollars. */
export function estimateAiPanelCost(o: { panel?: number; engines?: readonly string[]; pulse?: boolean; pulseMode?: AiPulseMode | string; pulsePerWeek?: number | null; clusterSize?: number } = {}): AiPanelCost {
  const L = AI_PANEL_LIMITS, F = AI_PANEL_FIXED, P = AI_PANEL_PRICE as Record<string, number>;
  const panel = clamp(Math.round(n0(o.panel)) || L.default_new, L.min, L.max);
  const engines = [...new Set((o.engines && o.engines.length ? o.engines : AI_PANEL_DEFAULT_ENGINES).filter((e) => P[e] != null))] as AiPanelEngine[];
  const sum = (list: readonly string[]) => list.reduce((t, e) => t + (P[e] || 0), 0);
  const asked = Math.max(1, panel - 1);
  const wE = engines.filter((e) => !AI_PANEL_MONTHLY_ENGINES.includes(e));
  const pE = AI_PANEL_PULSE_ENGINES.filter((e) => engines.includes(e));
  const answers = asked * wE.length;
  const cap = Math.min(F.analyst_cap_max, F.analyst_cap_base + Math.floor(panel / 25));
  const jobs = Math.min(cap, Math.ceil((answers * F.analyst_share) / F.analyst_per_job));
  const weekly: AiMoney = { dfs: r4(asked * sum(wE)), ai: r4(Math.max(F.weekly_ai_min, F.brief_ai + jobs * F.analyst_job_ai)), usd: 0 }; weekly.usd = r4(weekly.dfs + weekly.ai);
  const extra: AiMoney = { dfs: r4((engines.includes('claude') ? panel * P.claude : 0) + sum(wE) + F.full_dfs), ai: F.full_ai, usd: 0 }; extra.usd = r4(extra.dfs + extra.ai);
  const full: AiMoney = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai), usd: 0 }; full.usd = r4(full.dfs + full.ai);
  const on = o.pulse !== false && pE.length > 0;
  const pw: AiPulsePlan = on ? aiPulsePerWeek({ asked, weeklyEngines: wE.length, pulseEngines: pE.length, clusterSize: o.clusterSize, mode: o.pulseMode, perWeek: o.pulsePerWeek })
    : { perWeek: 0, headline: aiHalfWidth(answers), cluster: aiHalfWidth(Math.min(asked, n0(o.clusterSize) || L.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
  const qDay = on ? Math.min(asked, Math.ceil((asked * pw.perWeek) / F.pulse_days)) : 0;
  const pulseDay: AiMoney = { dfs: r4(qDay * sum(pE)), ai: 0, usd: 0 }; pulseDay.usd = pulseDay.dfs;
  const W = F.weeks_per_month;
  const month = { weekly: r2(W * weekly.usd), fullExtra: r2(extra.usd), pulse: r2(W * F.pulse_days * pulseDay.usd), total: 0 };
  month.total = r2(month.weekly + month.fullExtra + month.pulse);
  return {
    panel, asked, engines, weeklyEngines: wE, pulseEngines: on ? [...pE] : [], perWeek: pw.perWeek, pulseQuestionsDay: qDay, pulseWhy: pw.why, pulseCapped: !!pw.capped,
    requests: { weekly: answers, full: answers + (engines.includes('claude') ? panel : 0) + wE.length, pulseDay: qDay * (on ? pE.length : 0) },
    executions: Math.max(1, Math.ceil(answers / L.chunk_requests)), analystJobs: jobs,
    halfWidth: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, fullExtra: extra, pulseDay, month,
    prices: engines.map((e) => ({ engine: e, usd: P[e], basis: AI_PANEL_PRICE_BASIS[e] || 'measured / priced' })),
  };
}
