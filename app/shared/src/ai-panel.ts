// G6 (2026-10-18, n8n/seo-agent/AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale, the app's half of the engine's
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

// ---- W2-E3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §4): the owner's engine and coverage options ----
// The mirror of AIP.XPRICE / PERSONA / FANOUT_MAX / DEMAND_TASKS / PULSE_ALLOWED / pulseEnginesOf / monthlyOf / optionsOf (v5/code/_ai_panel.js),
// held to the engine's `cases_options` golden cases. Every option is off by default, so a panel that sets none costs what it cost before.
/** The options' prices, apart from AI_PANEL_PRICE (which AI_ENGINE_COST is held to): a Google results page 10 deep, a ChatGPT API answer
 *  (an estimate until its first live call), one LLM Mentions task of the monthly market trend. */
export const AI_PANEL_XPRICE = { fanout_serp: 0.002, persona: 0.012, demand_task: 0.11 } as const;
/** The persona test: the same 12 questions for every buyer role, plus the same questions once with no role (one control for every role). */
export const AI_PANEL_PERSONA = { questions: 12, max_roles: 6 } as const;
export const AI_PANEL_FANOUT_MAX = 200;
export const AI_PANEL_DEMAND_TASKS = 3;
/** The engines the daily pulse may ask (the owner's `ai_pulse_engines`); the default is AI_PANEL_PULSE_ENGINES. */
export const AI_PANEL_PULSE_ALLOWED: readonly AiPanelEngine[] = ['chatgpt', 'gemini', 'ai_mode', 'copilot', 'perplexity', 'ai_overview'];
const listOfX = (v: unknown): string[] => (Array.isArray(v) ? v : String(v ?? '').split(/[\n,;|]+/)).map((x) => String(x ?? '').trim()).filter(Boolean);
/** The engines the daily pulse asks: the owner's choice (only engines the site has on, in a fixed order) or, with none, the default four. */
export function aiPulseEnginesOf(engines: readonly string[] | null | undefined, chosen?: string | readonly string[] | null): AiPanelEngine[] {
  const en = (engines && engines.length ? engines : AI_PANEL_DEFAULT_ENGINES).map((e) => String(e).trim().toLowerCase());
  const pick = listOfX(chosen).map((e) => e.toLowerCase().replace(/[\s-]+/g, '_')).filter((e) => (AI_PANEL_PULSE_ALLOWED as readonly string[]).includes(e) && en.includes(e));
  return pick.length ? AI_PANEL_PULSE_ALLOWED.filter((e) => pick.includes(e)) : AI_PANEL_PULSE_ENGINES.filter((e) => en.includes(e));
}
/** The engines asked only on the month's full run (none when the owner set Claude weekly). */
export const aiMonthlyEngines = (claudeWeekly?: boolean | null): AiPanelEngine[] => (claudeWeekly ? [] : [...AI_PANEL_MONTHLY_ENGINES]);
export interface AiPanelOptionsCost {
  claudeWeekly: boolean;
  pulseEngines: AiPanelEngine[];
  persona: { on: boolean; roles: number; questions: number; requestsRun: number; dfsRun: number };
  fanout: { queries: number; requestsRun: number; dfsRun: number };
  demandMarket: { on: boolean; tasks: number; dfsFull: number };
  requestsExtra: { weekly: number; full: number };
}
/** The options as the cost formula takes them (AIP.cost's claude_weekly, pulse_engines, persona_context + personas, fanout_check, demand_market). */
export interface AiPanelOptions { claudeWeekly?: boolean | null; pulseEngines?: string | readonly string[] | null; personaContext?: boolean | null; personas?: number | null; fanoutCheck?: number | null; demandMarket?: boolean | null }

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
  /** W2-E3: what each option adds (all zero / off by default) */
  options: AiPanelOptionsCost;
}

/** The one AI-panel cost formula (AIP.cost). Every figure in US dollars. W2-E3: + the owner's engine and coverage options. */
export function estimateAiPanelCost(o: { panel?: number; engines?: readonly string[]; pulse?: boolean; pulseMode?: AiPulseMode | string; pulsePerWeek?: number | null; clusterSize?: number } & AiPanelOptions = {}): AiPanelCost {
  const L = AI_PANEL_LIMITS, F = AI_PANEL_FIXED, P = AI_PANEL_PRICE as Record<string, number>;
  const panel = clamp(Math.round(n0(o.panel)) || L.default_new, L.min, L.max);
  const engines = [...new Set((o.engines && o.engines.length ? o.engines : AI_PANEL_DEFAULT_ENGINES).filter((e) => P[e] != null))] as AiPanelEngine[];
  const sum = (list: readonly string[]) => list.reduce((t, e) => t + (P[e] || 0), 0);
  const asked = Math.max(1, panel - 1);
  const MONTHLY = aiMonthlyEngines(o.claudeWeekly);   // W2-E3: Claude weekly when the owner asks for it
  const wE = engines.filter((e) => !MONTHLY.includes(e));
  const pE = aiPulseEnginesOf(engines, o.pulseEngines);   // W2-E3: the owner's pulse engines ('' = the default four)
  const answers = asked * wE.length;
  const cap = Math.min(F.analyst_cap_max, F.analyst_cap_base + Math.floor(panel / 25));
  const jobs = Math.min(cap, Math.ceil((answers * F.analyst_share) / F.analyst_per_job));
  // W2-E3: the persona test and the fan-out check every weekly run, the market trend on the full run
  const roles = o.personaContext ? Math.min(AI_PANEL_PERSONA.max_roles, Math.max(0, Math.round(n0(o.personas)))) : 0;
  const pq = roles ? Math.min(AI_PANEL_PERSONA.questions, asked) : 0;
  const pReq = roles ? (roles + 1) * pq : 0;
  const fq = clamp(Math.round(n0(o.fanoutCheck)), 0, AI_PANEL_FANOUT_MAX);
  const dm = !!o.demandMarket;
  const opt: AiPanelOptionsCost = { claudeWeekly: !!o.claudeWeekly, pulseEngines: [...pE],
    persona: { on: !!o.personaContext, roles, questions: pq, requestsRun: pReq, dfsRun: r4(pReq * AI_PANEL_XPRICE.persona) },
    fanout: { queries: fq, requestsRun: fq, dfsRun: r4(fq * AI_PANEL_XPRICE.fanout_serp) },
    demandMarket: { on: dm, tasks: dm ? AI_PANEL_DEMAND_TASKS : 0, dfsFull: dm ? r4(AI_PANEL_DEMAND_TASKS * AI_PANEL_XPRICE.demand_task) : 0 },
    requestsExtra: { weekly: pReq + fq, full: pReq + fq + (dm ? AI_PANEL_DEMAND_TASKS : 0) } };
  const weekly: AiMoney = { dfs: r4(asked * sum(wE) + opt.persona.dfsRun + opt.fanout.dfsRun), ai: r4(Math.max(F.weekly_ai_min, F.brief_ai + jobs * F.analyst_job_ai)), usd: 0 }; weekly.usd = r4(weekly.dfs + weekly.ai);
  const extra: AiMoney = { dfs: r4(MONTHLY.filter((e) => engines.includes(e)).reduce((t, e) => t + panel * (P[e] || 0), 0) + sum(wE) + F.full_dfs + opt.demandMarket.dfsFull), ai: F.full_ai, usd: 0 }; extra.usd = r4(extra.dfs + extra.ai);
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
    requests: { weekly: answers, full: answers + MONTHLY.filter((e) => engines.includes(e)).length * panel + wE.length, pulseDay: qDay * (on ? pE.length : 0) },
    executions: Math.max(1, Math.ceil(answers / L.chunk_requests)), analystJobs: jobs,
    halfWidth: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, fullExtra: extra, pulseDay, month,
    prices: engines.map((e) => ({ engine: e, usd: P[e], basis: AI_PANEL_PRICE_BASIS[e] || 'measured / priced' })),
    options: opt,
  };
}

// ---------------- F3 (2026-10-23, APP_AUDIT.md A2 / A3): the panel a run asks, and what an on-demand run costs ----------------

/** The panel an on-demand AI visibility run asks, from the website's monitor settings as stored NOW (W2-E3: with the owner's options). */
export interface AiRunPanel { panel: number; engines: string[]; options?: AiPanelOptions }

/**
 * A2: the website's panel as the engine reads it (AIP.panelSize): no monitors row = 50 questions on the default engines; a row = its size
 * (an empty size = 20) and its engines. The quote of an on-demand run is this panel's full run (`estimateAiPanelCost(...).run.full`).
 */
export function aiRunPanelOf(m: ({ aiPromptsMax?: number | null; aiEngines?: readonly string[] | null } & {
  // W2-E3 (2026-10-23): the owner's options as the monitors row holds them; absent = off (older callers keep the old quote)
  aiClaudeWeekly?: boolean | null; aiPulseEngines?: string | readonly string[] | null; aiPersonaContext?: boolean | null; aiPersonas?: string | readonly string[] | null; aiFanoutCheck?: number | null; aiDemandMarket?: boolean | null;
}) | null): AiRunPanel {
  if (!m) return { panel: AI_PANEL_LIMITS.default_new, engines: [...AI_PANEL_DEFAULT_ENGINES] };
  const base: AiRunPanel = { panel: aiPanelSize({ siteId: 'site', promptsMax: m.aiPromptsMax ?? null }), engines: m.aiEngines && m.aiEngines.length ? [...m.aiEngines] : [...AI_PANEL_DEFAULT_ENGINES] };
  const options: AiPanelOptions = {
    ...(m.aiClaudeWeekly ? { claudeWeekly: true } : {}),
    ...(m.aiPulseEngines && listOfX(m.aiPulseEngines).length ? { pulseEngines: listOfX(m.aiPulseEngines) } : {}),
    ...(m.aiPersonaContext ? { personaContext: true, personas: Math.min(AI_PANEL_PERSONA.max_roles, listOfX(m.aiPersonas).length) } : {}),
    ...(Number(m.aiFanoutCheck) > 0 ? { fanoutCheck: Math.min(AI_PANEL_FANOUT_MAX, Math.round(Number(m.aiFanoutCheck))) } : {}),
    ...(m.aiDemandMarket ? { demandMarket: true } : {}),
  };
  return Object.keys(options).length ? { ...base, options } : base;
}

/** What an on-demand run of this panel costs (a full run: every engine incl. the monthly one, the brand question, the brief, and W2-E3 the
 *  owner's options: the persona test, the fan-out check, the monthly market trend), US dollars. The engine reserves the same figure (AI Plan
 *  prices a run's first part on the panel the site is set to, F3 engine side #3). */
export function aiOnDemandRunUsd(p: AiRunPanel): number {
  return aiOnDemandRunCost(p).usd;
}
/** The same quote split into Claude and DataForSEO money (estimateRunCostParts should read this one, so the options are in the breakdown too). */
export function aiOnDemandRunCost(p: AiRunPanel): AiMoney {
  return estimateAiPanelCost({ panel: p.panel, engines: p.engines, ...(p.options || {}) }).run.full;
}

/** One stored question as the cut needs it. */
export interface AiPanelAskRow { promptId: string; status: string; source: string; pinned: boolean }

/**
 * A3: which questions the next weekly run asks, the engine's cut (AI_Plan.js): the questions that are not switched off or refused, the
 * pinned ones first (stored order kept), then the owner's own (`custom`) and the pinned, then the automatic ones, cut at the panel size.
 * The rest are stored and NOT asked. (The engine's fit gate can still set a question aside at run time; that one is not modelled here.)
 */
export function aiAskedSet(prompts: readonly AiPanelAskRow[], size: number): { asked: Set<string>; over: Set<string> } {
  const live = prompts.map((p, i) => ({ p, i })).filter(({ p }) => !['off', 'refused'].includes(String(p.status || 'active')));
  live.sort((a, b) => (Number(b.p.pinned) - Number(a.p.pinned)) || a.i - b.i);
  const own = live.filter(({ p }) => p.source === 'custom' || p.pinned), auto = live.filter(({ p }) => !(p.source === 'custom' || p.pinned));
  const order = [...own, ...auto].map(({ p }) => p.promptId);
  const n = Math.max(0, Math.round(size));
  return { asked: new Set(order.slice(0, n)), over: new Set(order.slice(n)) };
}

/**
 * A3: adding `adding` questions of the owner's own to a panel that holds `own` of them already: how many would NOT be asked at this size,
 * and the size that would ask them all (the owner's questions come before the automatic ones, so only theirs can be crowded out).
 */
export function aiPanelOverflow(own: number, adding: number, size: number): { notAsked: number; sizeNeeded: number } {
  const total = Math.max(0, own) + Math.max(0, adding);
  return { notAsked: Math.max(0, total - Math.max(0, size)), sizeNeeded: Math.min(AI_PANEL_LIMITS.max, total) };
}

// ---------------- the segments and the panel a weekly run measured (seo_ai_visibility segments_json / panel_json) ----------------

export type AiSegmentDim = 'engine' | 'cluster' | 'persona' | 'market' | 'stage' | 'cluster x persona' | 'engine x cluster' | 'market x cluster';
export interface AiSegment {
  dim: AiSegmentDim | string;
  key: string;
  questions: number;
  /** answers counted (this run's weekly-engine answers + the pulse's answers of the same questions) */
  n: number;
  /** answers naming the business */
  k: number;
  cited: number;
  pulseN: number;
  /** share of answers naming you, %, null without answers; `enough` false under AI_SEGMENT_MIN answers */
  rate: number | null;
  /** 95% Wilson range, % */
  ci: [number, number] | null;
  enough: boolean;
  /** yours out of yours plus the businesses named instead, in the weekly answers, % */
  sov: number | null;
  leader: string;
  /** the change against the previous comparable run: a real move only when it cleared the Benjamini-Hochberg cut */
  delta: number | null;
  significant: boolean | null;
}
export interface AiSegments {
  rows: AiSegment[];
  family: { method: string; q: number; tests: number; rejected: number; note: string } | null;
  moves: { dim: string; key: string; rate: number | null; delta: number; n: number }[];
  minAnswers: number;
}
export interface AiPanelInfo {
  size: number;
  setting: number | null;
  engines: string[];
  composition: Record<'cluster' | 'persona' | 'market' | 'stage', Record<string, number>>;
  overlapWithPrevious: { share: number | null; same: boolean | null; common: number } | null;
  halfWidth: { measured: { headline: number | null; medianCluster: number | null }; achievable: { headline: number | null; cluster: number | null; perWeek: number } } | null;
  executions: number;
}
/** under this many answers a segment rate is "too few answers" (the engine's MIN_RATE_SAMPLES) */
export const AI_SEGMENT_MIN = 12;

const wilson = (k: number, n: number): [number, number] | null => {
  if (!n) return null; const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, Math.round((1000 * (c - m)) / d) / 10), Math.min(100, Math.round((1000 * (c + m)) / d) / 10)];
};
const parseJ = (t: unknown): unknown => { if (t && typeof t === 'object') return t; try { return JSON.parse(String(t ?? '')); } catch { return null; } };
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const nn = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The compact segments_json of a stored row (one array per segment, the columns named once) -> rows with their ranges. */
export function aiSegmentsFromJson(json: unknown): AiSegments | null {
  const x = rec(parseJ(json));
  if (!Array.isArray(x.rows)) return null;
  const cols = Array.isArray(x.cols) ? (x.cols as string[]) : ['dim', 'key', 'questions', 'n', 'k', 'cited', 'sov', 'leader', 'pulse_n', 'delta', 'significant'];
  const min = nn(x.min_answers) ?? AI_SEGMENT_MIN;
  const rows = (x.rows as unknown[]).map((r): AiSegment => {
    const o: Record<string, unknown> = Array.isArray(r) ? Object.fromEntries(cols.map((c, i) => [c, (r as unknown[])[i]])) : rec(r);
    const n = Math.max(0, Number(o.n) || 0), k = Math.max(0, Number(o.k) || 0);
    return { dim: String(o.dim ?? ''), key: String(o.key ?? ''), questions: Number(o.questions) || 0, n, k, cited: Number(o.cited) || 0, pulseN: Number(o.pulse_n) || 0,
      rate: n ? Math.round((1000 * k) / n) / 10 : null, ci: wilson(k, n), enough: n >= min, sov: nn(o.sov), leader: String(o.leader ?? ''), delta: nn(o.delta), significant: o.significant == null ? null : o.significant === true };
  });
  const f = rec(x.family);
  return { rows, minAnswers: min, family: x.family ? { method: String(f.method ?? ''), q: Number(f.q) || 0, tests: Number(f.tests) || 0, rejected: Number(f.rejected) || 0, note: String(f.note ?? '') } : null,
    moves: (Array.isArray(x.moves) ? x.moves : []).map((m) => { const o = rec(m); return { dim: String(o.dim ?? ''), key: String(o.key ?? ''), rate: nn(o.rate), delta: Number(o.delta) || 0, n: Number(o.n) || 0 }; }) };
}
/** The panel_json of a stored row -> what the app shows (the question ids stay on the server). */
export function aiPanelFromJson(json: unknown): AiPanelInfo | null {
  const x = rec(parseJ(json)); if (!Object.keys(x).length) return null;
  const comp = rec(x.composition), hw = rec(x.half_width), me = rec(hw.measured), ac = rec(hw.achievable), ov = x.overlap_with_previous ? rec(x.overlap_with_previous) : null;
  const dict = (v: unknown) => Object.fromEntries(Object.entries(rec(v)).map(([k, n]) => [k, Number(n) || 0]));
  return { size: Number(x.size) || (Array.isArray(x.ids) ? x.ids.length : 0), setting: nn(x.setting), engines: Array.isArray(x.engines) ? (x.engines as unknown[]).map(String) : [],
    composition: { cluster: dict(comp.cluster), persona: dict(comp.persona), market: dict(comp.market), stage: dict(comp.stage) },
    overlapWithPrevious: ov ? { share: nn(ov.share), same: ov.same == null ? null : ov.same === true, common: Number(ov.common) || 0 } : null,
    halfWidth: x.half_width ? { measured: { headline: nn(me.headline), medianCluster: nn(me.median_cluster) }, achievable: { headline: nn(ac.headline), cluster: nn(ac.cluster), perWeek: Number(ac.per_week) || 0 } } : null,
    executions: Number(x.executions) || 1 };
}

// ---------------- the CSV import of the panel manager ----------------

export const AI_PANEL_CSV_COLUMNS = ['question', 'buyer role', 'cluster', 'stage', 'market', 'pinned'] as const;
export interface AiPanelCsvResult { rows: { prompt: string; persona: string; cluster: string; stage: '' | 'awareness' | 'consideration' | 'decision'; market: string; pinned: boolean }[]; errors: { line: number; message: string }[]; skipped: number }

/** One CSV cell list per line (RFC 4180: quotes, doubled quotes, commas and line breaks inside quotes; ; or tab as the separator too). */
function csvLines(text: string): string[][] {
  const t = String(text ?? '').replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && !cell) { q = true; continue; }
    if (c === sep) { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}

/**
 * The owner's question list as CSV (a spreadsheet export): one question per line; the header names the columns in any order,
 * question (required), buyer role, cluster, stage (awareness / consideration / decision), market (country-language, e.g. SA-en), pinned
 * (yes / no). Without a header the first column is the question. At most 500 rows; duplicates (same text) are skipped.
 */
export function parseAiPanelCsv(text: string, max = 500): AiPanelCsvResult {
  const lines = csvLines(text);
  const errors: AiPanelCsvResult['errors'] = []; const rows: AiPanelCsvResult['rows'] = []; let skipped = 0;
  if (!lines.length) return { rows, errors: [{ line: 0, message: 'The file is empty' }], skipped };
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const head = lines[0].map(norm);
  const find = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const hasHead = find('question', 'prompt', 'questions') >= 0;
  const ix = hasHead ? { q: find('question', 'prompt', 'questions'), p: find('buyer role', 'persona', 'role'), c: find('cluster', 'topic', 'topic cluster'), s: find('stage', 'funnel stage'), m: find('market'), pin: find('pinned', 'pin') }
    : { q: 0, p: 1, c: 2, s: 3, m: 4, pin: 5 };
  const seen = new Set<string>();
  lines.slice(hasHead ? 1 : 0).forEach((cells, i) => {
    const line = i + (hasHead ? 2 : 1);
    const get = (j: number) => (j >= 0 ? String(cells[j] ?? '').trim() : '');
    const prompt = get(ix.q).replace(/\s+/g, ' ');
    if (!prompt) { skipped++; return; }
    if (prompt.length < 10) { errors.push({ line, message: `"${prompt}" is shorter than 10 characters` }); return; }
    if (prompt.length > 300) { errors.push({ line, message: 'The question is longer than 300 characters' }); return; }
    const key = prompt.toLowerCase(); if (seen.has(key)) { skipped++; return; } seen.add(key);
    const st = get(ix.s).toLowerCase();
    if (st && !['awareness', 'consideration', 'decision'].includes(st)) { errors.push({ line, message: `Stage "${get(ix.s)}" is not awareness, consideration or decision` }); return; }
    const mk = get(ix.m).replace(/[_\s]+/g, '-');
    const mm = mk ? mk.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/) : null;
    if (mk && !mm) { errors.push({ line, message: `Market "${get(ix.m)}" should be a country code and a language, e.g. SA-en` }); return; }
    if (rows.length >= max) { skipped++; return; }
    rows.push({ prompt, persona: get(ix.p).slice(0, 40), cluster: get(ix.c).slice(0, 60).toLowerCase(), stage: (st || '') as AiPanelCsvResult['rows'][number]['stage'],
      market: mm ? mm[1].toUpperCase() + '-' + (mm[2] || 'en').toLowerCase() : '', pinned: /^(y|yes|true|1|pinned)$/i.test(get(ix.pin)) });
  });
  return { rows, errors, skipped };
}
