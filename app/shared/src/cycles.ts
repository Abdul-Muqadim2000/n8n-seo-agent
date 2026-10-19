// The contract between the engine and the app for the per-website 7-day cycle and keyword-first autopilot
// (n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §14). The engine mirrors every constant and rule here in v5/code/_cycle.js and
// v5/code/Cadence_Plan.js; a change on one side changes the other in the same commit.

/** The jobs of one cycle, in the order they run (today's Monday order). `preview` runs 48 h before a cycle, never in cycle 0. */
export const CYCLE_JOBS = [
  { job: 'ai_visibility', workflowId: 'SEOagentAIVisib1' },
  { job: 'backlinks', workflowId: 'SEOagentBacklnk1' },
  { job: 'rank_tracker', workflowId: 'SEOagentTracker1' },
  { job: 'site_tracker', workflowId: 'SEOagentSiteTrk1' },
  { job: 'ai_growth', workflowId: 'SEOagentAIGrow1' },
  { job: 'content_cadence', workflowId: 'SEOagentCadence1' },
  { job: 'link_builder', workflowId: 'SEOagentLinkBld1' },
  { job: 'audit', workflowId: 'SEOagentAuditSc1' },
] as const;
export type CycleJob = (typeof CYCLE_JOBS)[number]['job'] | 'preview';

/** A cycle starts at this local time in the website's time zone (cycle 0 starts at setup). */
export const CYCLE_LOCAL_TIME = '06:00';
/** The "Coming up" plan is made this long before each cycle. */
export const PREVIEW_HOURS_BEFORE = 48;
/** At level 3 an announced keyword starts this long after it was announced, unless the client changes or skips it. */
export const PROPOSAL_WAIT_HOURS = 48;
/** A queued ladder planned longer ago than this gets a fresh keyword check when it becomes active. */
export const QUEUED_RECHECK_DAYS = 60;
/** Auto-pause: this many rejected automatic (non-ladder) pages among the last `REJECT_WINDOW` drop the level to 1. */
export const REJECT_LIMIT = 2;
export const REJECT_WINDOW = 5;
/** Upgrade nudge: after this many approved or published pages at level 1, offer level 2 (never switched automatically). */
export const NUDGE_AFTER_PAGES = 5;

export type AutopilotLevel = 1 | 2 | 3;
export const DEFAULT_AUTOPILOT_LEVEL: AutopilotLevel = 2;
export const AUTOPILOT_LEVELS: ReadonlyArray<{ level: AutopilotLevel; label: string; summary: string }> = [
  { level: 1, label: 'Only my keywords', summary: 'We write pages for the keywords you choose. Everything else waits for your OK.' },
  { level: 2, label: 'My keywords and keep my pages healthy', summary: 'We also refresh your existing pages on your topics when they lose visitors or sit close to page one. New topics wait for your OK.' },
  { level: 3, label: 'Full autopilot', summary: 'We also choose new topics and keywords for you. We tell you two days before anything new starts, and you can change or skip it.' },
];

/** Who chose a ladder's keyword. The automatic pipeline writes `client_*` ladders at every level and `system_announced` ones at level 3 only. */
export type ChosenBy = 'client_typed' | 'client_picked' | 'system_announced';

/** Content sources the Content Cadence can pick. `ladder` is the client's plan; the rest depend on the level. */
export type TopicSource = 'ladder' | 'decay' | 'striking' | 'trend' | 'ai_answer' | 'ai_refresh';

/** Which sources run automatically at each level (the fit gate always runs; level 2 also needs the item to be "in topic" and to change an existing page). */
export const AUTO_SOURCES: Record<AutopilotLevel, ReadonlyArray<TopicSource>> = {
  1: ['ladder'],
  2: ['ladder', 'decay', 'striking', 'ai_refresh'],
  3: ['ladder', 'decay', 'striking', 'ai_refresh', 'trend', 'ai_answer'],
};

/** The one normalisation of a keyword both sides use for item keys and skips. */
export const cycleNorm = (s: string): string => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** An item of the "Coming up" plan is identified by its keyword alone, so a skip covers every source of the same search. */
export const itemKey = (keyword: string): string => cycleNorm(keyword);
/** A cycle's key: the website and the local date the cycle is due. */
export const cycleKey = (siteId: string, localDate: string): string => `cyc:${siteId}:${localDate}`;

export type CycleJobStatus = 'starting' | 'running' | 'done' | 'skipped' | 'refused' | 'failed' | 'gave_up';

/** One row of the engine's `seo_cycle_jobs`, as the app reads it. */
export interface CycleJobRow {
  key: string;
  site_id: string;
  cycle_key: string;
  job: CycleJob;
  workflow_id: string;
  status: CycleJobStatus;
  attempts: number;
  run_id: string;
  ledger_key: string;
  monthly: boolean;
  reason: string;
  due_at: string;
  started_at: string;
  finished_at: string;
  updated_at: string;
}

/** One row of the engine's `seo_cycles`. */
export interface CycleRow {
  site_id: string;
  domain: string;
  anchor_at: string;
  tz: string;
  cycle_weekday: number;
  local_time: string;
  monthly_day: number;
  next_due_at: string;
  next_preview_at: string;
  current_key: string;
  status: 'active' | 'paused' | 'off';
  skip_jobs: string;
  last_cycle_at: string;
  last_monthly_key: string;
  adopted: boolean;
  updated_at: string;
}

/** An item of the "Coming up" plan (callback stage `cycle_preview`) and of the cadence's `suggestions`. */
export interface CyclePreviewItem {
  item_key: string;
  keyword: string;
  source: TopicSource;
  page_type: string;
  existing_page_url: string;
  ladder_id: string;
  rung: number;
  why: string;
  /** true: written in the cycle unless skipped; false: written only after an approval */
  auto: boolean;
  est_usd: number;
  ai_target?: { question: string; kind: string; target_id: string; fanout: string[]; sources: unknown[]; competitors: string[] } | null;
}

/** The `cycle_preview` callback body (beside the usual callback fields). */
export interface CyclePreview {
  stage: 'cycle_preview';
  site_id: string;
  domain: string;
  cycle_key: string;
  scheduled_for: string;
  level: AutopilotLevel;
  pages_per_week: number;
  waiting_for_keyword: boolean;
  paused_reason: string;
  items: CyclePreviewItem[];
  suggestions: CyclePreviewItem[];
}

/** One row of the engine's `seo_skips`, written by the app. */
export interface SkipRow {
  key: string;
  site_id: string;
  cycle_key: string;
  item_key: string;
  decision: 'skip' | 'approve';
  scope: 'cycle' | 'always';
  by: string;
  created_at: string;
}
export const skipKey = (siteId: string, scope: 'cycle' | 'always', cycle: string, item: string): string =>
  `${siteId}:${scope === 'always' ? 'always' : cycle}:${item}`;
