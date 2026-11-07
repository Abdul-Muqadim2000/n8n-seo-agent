// KI: keyword intelligence (Competitors + Keyword research), the app's half of docs/keyword-intel-2026-11-08/CONTRACTS.md (rule `ki-1`).
//
// W0 (2026-11-08) freezes the shapes every later package codes against: the four engine tables (§2), the callback bodies (§4), the per-site
// switch (§1) and the words the screens use (§6). The engine kit `n8n/seo-agent/v5/code/_ki.js` (E1) computes the numbers; this file only
// names them and says them in plain words. The verdict words and thresholds are held to the engine by one fixture,
// `n8n/seo-agent/harness/fixtures/ki_parity.json` (ki.parity.test.ts here, the harness on the engine side).
//
// Every stored or reported number has a sibling basis: `measured | provider_estimate | modelled | inferred`, plus `source` and `fetched_at`.
// JSON columns are strings in the tables; the callbacks carry them parsed.

import { COST_TABLE, keyCost, type CostKey } from './cost';
import type { DtRow } from './tables';

export const KI_RULE_VERSION = 'ki-1';

// ---------------------------------------------------------------------------------------------------------------------------
// §1 the per-site switch (seo_monitors.ki_mode / ki_refresh / ki_max_competitors, written through Site Admin `monitors` only)
// ---------------------------------------------------------------------------------------------------------------------------

/** Off = every existing path as before; Trial = runs on demand, results for platform admins only, nothing else reads them; On = runs + consumers. */
export const KI_MODES = ['off', 'trial', 'on'] as const;
export type KiMode = (typeof KI_MODES)[number];
export const KI_MODE_LABELS: Record<KiMode, string> = { off: 'Off', trial: 'Trial (our team only)', on: 'On' };

/** The stored mode as the engine reads it: anything that is not trial or on (empty, unknown, a typo) is off. */
export function kiModeOf(v: unknown): KiMode {
  const m = String(v ?? '').trim().toLowerCase();
  return m === 'trial' || m === 'on' ? m : 'off';
}

/** The kill switch row (seo_cache key `ki:kill`, value 1): any read error counts as killed (fails closed). */
export const KI_KILL_KEY = 'ki:kill';
export function kiKilled(rows: ReadonlyArray<{ key?: unknown; value?: unknown }> | null | undefined): boolean {
  if (!rows) return true;
  return rows.some((r) => String(r?.key ?? '').trim() === KI_KILL_KEY && /^(1|true|on|yes)$/i.test(String(r?.value ?? '').trim()));
}

/** May this person start a KI run on a website in this mode? On: anyone who may start runs; Trial: platform admins only; Off: nobody. */
export function kiMayRun(mode: KiMode, platformAdmin: boolean): boolean {
  return mode === 'on' || (mode === 'trial' && platformAdmin);
}
/** May this person see the KI pages and results? The same rule as starting a run. */
export const kiVisible = kiMayRun;

/** How many competitors the client may choose (1-5, empty = 5). */
export const KI_MAX_COMPETITORS = 5;
export function kiMaxCompetitorsOf(v: unknown): number {
  const n = Number(v);
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? KI_MAX_COMPETITORS : Math.min(KI_MAX_COMPETITORS, Math.max(1, Math.round(n)));
}
/** The monthly refresh in the cycle when On (empty = yes). */
export function kiRefreshOf(v: unknown): boolean {
  return !/^(false|0|no|off)$/i.test(String(v ?? '').trim());
}

// ---------------------------------------------------------------------------------------------------------------------------
// §3 modes, kinds, stages
// ---------------------------------------------------------------------------------------------------------------------------

export const KI_RUN_MODES = ['competitors', 'keyword_research'] as const;
export type KiRunMode = (typeof KI_RUN_MODES)[number];
export const isKiRunMode = (m: unknown): m is KiRunMode => (KI_RUN_MODES as readonly unknown[]).includes(m);

/** The callback stages per run mode (§4): one started notice, then one final answer. */
export const KI_CALLBACK_STAGES: Record<KiRunMode, { started: string; final: string }> = {
  competitors: { started: 'ki_competitors_started', final: 'ki_competitors' },
  keyword_research: { started: 'ki_research_started', final: 'ki_research' },
};
export const KI_FINAL_STAGES: readonly string[] = KI_RUN_MODES.map((m) => KI_CALLBACK_STAGES[m].final);

/** Credits a default run is quoted at, from the one cost table (cost.ts, the mirror of the engine's _cost_cal.js), at the platform's rate. */
export function kiCreditsEstimate(kind: KiRunMode, rate: { creditValueUsd: number; markup: number } = { creditValueUsd: 0.05, markup: 3 }): number {
  const usd = keyCost(kind as CostKey);
  const perUsd = rate.creditValueUsd > 0 ? rate.markup / rate.creditValueUsd : 0;
  if (!(usd > 0) || !(perUsd > 0)) return 0;
  return Math.max(1, Math.ceil(Math.round(usd * perUsd * 100) / 100 - 1e-9));
}
/** The cost rows behind the quote (for a breakdown; customers see credits only). */
export const kiCostRow = (kind: KiRunMode) => COST_TABLE[kind as CostKey];

// ---------------------------------------------------------------------------------------------------------------------------
// §6 the words (one place; the screens, the guides and the reports read these)
// ---------------------------------------------------------------------------------------------------------------------------

export const KI_VERDICT_IDS = ['go', 'months', 'hard', 'gated'] as const;
export type KiVerdict = (typeof KI_VERDICT_IDS)[number];
export const KI_VERDICTS: Record<KiVerdict, string> = {
  go: 'Go',
  months: 'Takes a few months',
  hard: 'Hard for your site now',
  gated: 'Not for you',
};
/** The badge tones of the web app (components/ui/badge.tsx), the one tone map for the verdict. */
export type KiTone = 'neutral' | 'accent' | 'good' | 'warning' | 'serious' | 'critical';
export const KI_VERDICT_TONE: Record<KiVerdict, KiTone> = { go: 'good', months: 'warning', hard: 'serious', gated: 'neutral' };

/** The verdict is read from the Win factor (DESIGN.md §3.8): >= 0.60 Go, 0.35 to 0.60 Takes a few months, below 0.35 Hard; a gated row says why. */
export const KI_VERDICT_THRESHOLDS = { go: 0.6, months: 0.35 } as const;
export function kiVerdict(row: { gate?: string | null; win?: number | null }): KiVerdict {
  if (String(row.gate ?? '') === 'fail') return 'gated';
  const w = Number(row.win);
  if (!Number.isFinite(w)) return 'hard';
  return w >= KI_VERDICT_THRESHOLDS.go ? 'go' : w >= KI_VERDICT_THRESHOLDS.months ? 'months' : 'hard';
}

export const KI_STAGE_IDS = ['hire', 'compare', 'solution', 'problem', 'info'] as const;
export type KiStage = (typeof KI_STAGE_IDS)[number];
export const KI_STAGES: Record<KiStage, string> = {
  hire: 'Ready to hire',
  compare: 'Comparing providers',
  solution: 'Looking for a solution',
  problem: 'Has a problem to solve',
  info: 'Learning about the topic',
};
/** The stage weights of the score (DESIGN.md §3.6); the engine's KI.CONFIG holds the same numbers. */
export const KI_STAGE_WEIGHT: Record<KiStage, number> = { hire: 1, compare: 0.9, solution: 0.65, problem: 0.5, info: 0.3 };

export const KI_INTENTS = ['commercial', 'transactional', 'informational', 'navigational'] as const;
export type KiIntent = (typeof KI_INTENTS)[number];

export const KI_CLASS_IDS = ['direct', 'adjacent', 'principal', 'directory', 'publisher_list', 'platform', 'government', 'job_board', 'media'] as const;
export type KiClass = (typeof KI_CLASS_IDS)[number];
export const KI_CLASSES: Record<KiClass, string> = {
  direct: 'Direct competitor',
  adjacent: 'Close competitor',
  principal: 'Software maker or principal',
  directory: 'Directory',
  publisher_list: 'List or ranking article',
  platform: 'Platform',
  government: 'Government site',
  job_board: 'Job board',
  media: 'News or media',
};
/** Only these two are scored as competitors; the rest become listing, list-placement or format actions. */
export const KI_SCORED_CLASSES: readonly KiClass[] = ['direct', 'adjacent'];

export const KI_BASIS_IDS = ['measured', 'provider_estimate', 'modelled', 'inferred'] as const;
export type KiBasis = (typeof KI_BASIS_IDS)[number];
/** The legend, as words. `provider_estimate` names its source: "estimate from <source>". */
export const KI_BASIS: Record<KiBasis, string> = {
  measured: 'measured',
  provider_estimate: 'estimate from <source>',
  modelled: 'our estimate',
  inferred: 'AI judgement',
};
export function kiBasisLabel(basis: unknown, source?: unknown): string {
  const b = String(basis ?? '') as KiBasis;
  if (b === 'provider_estimate') return 'estimate from ' + (String(source ?? '').trim() || 'our data provider');
  return KI_BASIS[b] ?? 'not available';
}

export const KI_SIZE_TAGS = ['peer', 'leader', 'smaller', 'out_of_reach', 'unknown'] as const;
export type KiSizeTag = (typeof KI_SIZE_TAGS)[number];
export const KI_SIZE_LABELS: Record<KiSizeTag, string> = { peer: 'About your size', leader: 'Market leader', smaller: 'Smaller than you', out_of_reach: 'Far bigger than you', unknown: 'Size not known' };

export const KI_SOURCES = ['gsc', 'paa', 'related', 'forum', 'autocomplete', 'labs_ideas', 'labs_suggestions', 'labs_related', 'competitor', 'gap', 'tracked', 'ladder', 'seed'] as const;
export type KiSource = (typeof KI_SOURCES)[number];
export const KI_SOURCE_LABELS: Record<KiSource, string> = {
  gsc: 'Your Search Console',
  paa: 'People also ask',
  related: 'Related searches',
  forum: 'Forum threads in the results',
  autocomplete: 'Google autocomplete',
  labs_ideas: 'Keyword ideas',
  labs_suggestions: 'Keyword suggestions',
  labs_related: 'Related keywords',
  competitor: 'Your competitors rank for it',
  gap: 'Competitors rank, you do not',
  tracked: 'You track it',
  ladder: 'One of your keyword ladders',
  seed: 'Your services',
};

export const KI_GAP_TYPES = ['missing', 'untapped', 'weak', 'striking', 'strong', 'topic', 'page_type', 'ai_answer', 'listing', 'backlink'] as const;
export type KiGapType = (typeof KI_GAP_TYPES)[number];
export const KI_GAP_ACTIONS = ['new_page', 'refresh', 'list', 'pitch', 'link', 'defend'] as const;
export type KiGapAction = (typeof KI_GAP_ACTIONS)[number];
export const KI_PAGE_ACTIONS = ['new', 'refresh', 'list', 'none'] as const;
export type KiPageAction = (typeof KI_PAGE_ACTIONS)[number];

export const KI_RUN_STATUSES = ['ok', 'partial', 'failed', 'refused'] as const;
export type KiRunStatus = (typeof KI_RUN_STATUSES)[number];
export const KI_SECTION_STATES = ['ok', 'partial', 'missing', 'skipped'] as const;
export type KiSectionState = (typeof KI_SECTION_STATES)[number];
export const KI_COMP_STATUSES = ['candidate', 'chosen', 'watch', 'dismissed'] as const;
export type KiCompStatus = (typeof KI_COMP_STATUSES)[number];
export const KI_GAP_STATUSES = ['open', 'started', 'dismissed', 'done'] as const;
export type KiGapStatus = (typeof KI_GAP_STATUSES)[number];

/** Why the engine refused a run, in the client's words (the stub answers `not_available_yet`, `ki_off` or `killed`). */
export const KI_REFUSAL_TEXT: Record<string, string> = {
  not_available_yet: 'This analysis is not available yet. Nothing was charged.',
  ki_off: 'This analysis is not switched on for this website yet. Nothing was charged.',
  killed: 'This analysis is paused for maintenance. Please try again later. Nothing was charged.',
  market_mismatch: 'This analysis runs for your website\'s main market. Choose that country and try again. Nothing was charged.',
};
export function kiRefusalText(reason: unknown): string {
  return KI_REFUSAL_TEXT[String(reason ?? '')] ?? 'This analysis could not run. Nothing was charged.';
}

// ---------------------------------------------------------------------------------------------------------------------------
// §2 the table rows (as the n8n public API returns them: JSON columns are strings, empty cells null)
// ---------------------------------------------------------------------------------------------------------------------------

export interface KiSectionStateRow {
  key: string;
  state: KiSectionState;
  reason: string;
  rows: number;
}

/** seo_ki_runs: one row per KI run. */
export interface KiRunRow extends DtRow {
  site_id: string; domain: string; run_id: string; request_id: string; kind: KiRunMode; market: string; location_code: number | null;
  language_code: string; mode: Exclude<KiMode, 'off'>; rule_version: string; started_at: string; finished_at: string | null; status: KiRunStatus;
  reason: string | null;
  /** [{key, state, reason, rows}] */
  sections_json: string | null;
  counts_json: string | null; cost_dfs_usd: number | null; cost_claude_usd: number | null; config_json: string | null;
}

export interface KiEvidence { seed: string; position: number; url: string }
export interface KiTopPage { url: string; etv: number | null; keywords: number | null; page_type: string }
export interface KiCompetitorProfile {
  etv: number | null; keywords: number | null; refdomains: number | null; top_pages: KiTopPage[]; brand_share: number | null;
  pace_per_month: number | null; basis: Record<string, KiBasis>; fetched_at: string;
}

/** seo_ki_competitors: one row per site x market x comp_domain. */
export interface KiCompetitorRow extends DtRow {
  site_id: string; domain: string; market: string; comp_domain: string; class: KiClass; class_basis: 'rule' | 'page' | 'llm' | 'declared' | 'user';
  class_confidence: number | null; scored: boolean | null; score: number | null; score_low: number | null; score_high: number | null;
  serp_share: number | null; topic_sim: number | null; geo_match: number | null; ai_share: number | null; size_tag: KiSizeTag | null;
  seeds_seen: number | null; seeds_total: number | null; reasons_json: string | null;
  /** [{seed, position, url}], at most 20 */
  evidence_json: string | null;
  declared: boolean | null; status: KiCompStatus; status_by: 'auto' | 'user' | 'declared'; first_seen: string; last_seen: string; misses: number | null;
  profile_json: string | null; run_id: string; updated_at: string;
}

export interface KiSourceEntry { source: KiSource; fetched_at: string; detail?: string }
export interface KiTop10Entry { url: string; host: string; type: string; pos: number }
export interface KiCompetitorPosition { domain: string; position: number; url: string }

/** seo_ki_keywords: one row per site x market x kw_key. */
export interface KiKeywordRow extends DtRow {
  site_id: string; domain: string; market: string; keyword: string; kw_key: string;
  /** [{source, fetched_at, detail}] */
  sources_json: string | null;
  source_count: number | null; volume: number | null; volume_basis: KiBasis | null; volume_source: string | null; cpc: number | null; kd: number | null;
  trend_json: string | null; gsc_impressions: number | null; gsc_clicks: number | null; gsc_position: number | null; gsc_page: string | null;
  intent: KiIntent | null; stage: KiStage | null; stage_evidence_json: string | null; intent_confidence: number | null; needs_review: boolean | null;
  gate: 'pass' | 'fail'; gate_reason: string | null; fit: number | null; demand: number | null; win: number | null; value: number | null; gap: number | null;
  score: number | null; score_low: number | null; score_high: number | null; low_confidence: boolean | null; verdict: KiVerdict;
  cluster_id: string | null; is_head: boolean | null; cluster_size: number | null; cluster_demand: number | null; serp_read_at: string | null;
  /** [{url, host, type, pos}] */
  top10_json: string | null;
  page_action: KiPageAction | null; page_url: string | null; cannibal_json: string | null;
  /** [{domain, position, url}] */
  competitors_json: string | null;
  striking: boolean | null; run_id: string; fetched_at: string; updated_at: string;
}

/** seo_ki_gaps: one row per gap against the chosen competitor set. */
export interface KiGapRow extends DtRow {
  gap_id: string; site_id: string; domain: string; market: string; type: KiGapType; keyword: string | null; cluster_id: string | null;
  competitor_domains_json: string | null; client_position: number | null; evidence_json: string | null; sample_note: string | null;
  action: KiGapAction; action_target: string | null; credits: number | null; status: KiGapStatus; run_id: string; created_at: string; updated_at: string;
}

/** The tables' column names, in the engine's order (ladder_common.py KI_*_COLS; ki.parity.test.ts holds them equal). */
export const KI_TABLES = { runs: 'seo_ki_runs', competitors: 'seo_ki_competitors', keywords: 'seo_ki_keywords', gaps: 'seo_ki_gaps' } as const;

// ---------------------------------------------------------------------------------------------------------------------------
// §4 the callbacks
// ---------------------------------------------------------------------------------------------------------------------------

/** A started notice (`ki_competitors_started` / `ki_research_started`). */
export interface KiStartedCallback {
  stage: 'ki_competitors_started' | 'ki_research_started';
  status: 'accepted';
  request_id: string; run_id: string; domain: string; market: string; mode: Exclude<KiMode, 'off'>; rule_version: string;
}

/** What every final KI callback carries. A refused run has empty sections and summary. */
export interface KiCallbackBase {
  status: KiRunStatus;
  reason: string;
  request_id: string; run_id: string; domain: string; market: string;
  mode: KiMode; rule_version: string;
  sections: KiSectionStateRow[];
  summary: Record<string, number>;
  /** the basis legend: {measured: 'measured', ...} */
  labels: Partial<Record<KiBasis, string>>;
  run_ledger: Record<string, unknown> | null;
  run_cost_estimate_usd: number | null;
  run_cost_estimate_basis: string;
  run_cost_estimate_state: string;
}

/** A competitor row as the callback carries it: the stored row with its JSON fields parsed. */
export type KiCompetitorOut = Omit<KiCompetitorRow, 'reasons_json' | 'evidence_json' | 'profile_json' | keyof DtRow> & {
  reasons: string[]; evidence: KiEvidence[]; profile: KiCompetitorProfile | null;
};

export interface KiCompetitorsCallback extends KiCallbackBase {
  stage: 'ki_competitors';
  /** the top 20 rows as stored */
  competitors: KiCompetitorOut[];
  /** directory and list rows: where to be listed */
  listings: KiCompetitorOut[];
  platforms: KiCompetitorOut[];
}

export interface KiClusterOut {
  cluster_id: string; head: string; members: number; demand: number | null; stage: KiStage | null; verdict: KiVerdict; score: number | null;
  score_low: number | null; score_high: number | null; page_action: KiPageAction | null; page_url: string | null;
}
export interface KiStrikingOut { keyword: string; position: number; impressions: number; page: string; change: string }
export interface KiQuestionOut { question: string; cluster_id: string | null; sources: KiSource[] }
export interface KiPlanAction {
  action_id: string; kind: KiGapAction | 'ladder' | 'write'; title: string; why: string; target: string; credits: number;
  gap_id?: string; cluster_id?: string;
}

export interface KiResearchCallback extends KiCallbackBase {
  stage: 'ki_research';
  /** the top 50 heads with their member counts */
  clusters: KiClusterOut[];
  /** at most 30 */
  striking: KiStrikingOut[];
  /** at most 30 */
  questions: KiQuestionOut[];
  gaps_summary: Partial<Record<KiGapType, number>>;
  /** at most 10 */
  plan: KiPlanAction[];
}

export type KiFinalCallback = KiCompetitorsCallback | KiResearchCallback;

/** A final KI callback that delivered no result (refused or failed): the run ends failed and is not charged. Null for any other body. */
export function kiNoResultOf(stage: string, body: Record<string, unknown>): string | null {
  if (!KI_FINAL_STAGES.includes(stage)) return null;
  const st = String(body.status ?? '').toLowerCase();
  if (st === 'refused') return kiRefusalText(body.reason);
  if (st === 'failed') return 'This analysis could not finish. Nothing was charged.';
  return null;
}
