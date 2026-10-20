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
/** `cycle` is the dispatcher's marker row of a cycle itself (key `<cycle_key>:cycle`), not a job that runs. */
export type CycleJob = (typeof CYCLE_JOBS)[number]['job'] | 'preview' | 'cycle';

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
/** The same sources as values (the run form's `source`, schemas.ts). */
export const TOPIC_SOURCES = ['ladder', 'decay', 'striking', 'trend', 'ai_answer', 'ai_refresh'] as const satisfies readonly TopicSource[];

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
  /** the AI target this item answers (AI pages) */
  target_id?: string;
  /** an item the client approved for this cycle */
  approved?: boolean;
  /** ladder items: who chose the ladder's keyword */
  chosen_by?: ChosenBy | '';
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
  /** the cycle's local date (YYYY-MM-DD) */
  cycle_date?: string;
  trigger?: 'cycle';
  /** why the cycle writes nothing ('' when it writes) */
  reason?: string;
  /** the fit gate's refusals: never written, never suggested */
  refused?: { keyword: string; source: string; reason: string; detail: string; note?: string; target_id?: string }[];
  /** what the client skipped */
  skipped?: { item_key: string; keyword: string; source: string; scope: 'always' | 'cycle' }[];
  /** R-K7: the cycle's budget */
  budget?: { pages_per_week: number; spent: number; room: number; window_start?: string; spent_keywords?: { keyword: string; how: string }[] };
  /** the engine's price of one page (USD) and where it comes from: internal, never shown to a customer */
  est_page_usd?: number;
  est_basis?: string;
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

// ---------------------------------------------------------------------------------------------------------------------------------
// App API shapes (app/API.md "Cycle, Coming up, keyword proposals, research, feedback"). The clock itself is in cycle-clock.ts.
// Prices reach customers in credits only; reasons are customer words (never an execution id, a table or a provider).
// ---------------------------------------------------------------------------------------------------------------------------------

/** One job of a cycle as the app shows it. */
export interface CycleJobView {
  job: Exclude<CycleJob, 'cycle'>;
  /** "AI visibility", "Backlinks" ... */
  label: string;
  /** 'waiting': not started yet in this cycle */
  status: CycleJobStatus | 'waiting';
  attempts: number;
  monthly: boolean;
  reason: string;
  dueAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** One cycle of a website and its jobs. */
export interface CycleSummary {
  cycleKey: string;
  /** the local date */
  date: string;
  monthly: boolean;
  cycle0: boolean;
  /** running | done | skipped (covered by the next one) */
  status: 'running' | 'done' | 'skipped';
  jobs: CycleJobView[];
}

/** GET /api/orgs/:orgId/sites/:siteId/cycle */
export interface SiteCycleView {
  /** whether the engine has written the website's cycle row (false before tracking starts, or until the engine adopts it) */
  known: boolean;
  status: 'active' | 'paused' | 'off' | 'not_started';
  timezone: string;
  /** 0-6, Sunday 0, in `timezone`; null before tracking starts */
  weekday: number | null;
  weekdayName: string | null;
  localTime: string;
  anchorAt: string | null;
  monthlyDay: number | null;
  nextDueAt: string | null;
  nextPreviewAt: string | null;
  lastCycleAt: string | null;
  /** the cycle being worked on, with its jobs in order */
  current: CycleSummary | null;
  /** earlier cycles, newest first (up to 8) */
  recent: CycleSummary[];
  /** the coming cycles (the first one may be due now) */
  upcoming: import('./cycle-clock').CycleOccurrence[];
  /** a cycle is more than CYCLE_OVERDUE_HOURS late */
  overdue: boolean;
  /** owners and admins may change the weekday */
  canChangeWeekday: boolean;
}

/** PATCH /api/orgs/:orgId/sites/:siteId/cycle */
export interface CycleWeekdayResult {
  weekday: number;
  weekdayName: string;
  /** the next cycle on the new weekday, at least CYCLE_SPACING_DAYS after the last one started (the engine recomputes it within 5 minutes) */
  nextDueAt: string | null;
  timezone: string;
}

/** One item of the "Coming up" plan as the app shows it. */
export interface ComingUpItem {
  itemKey: string;
  keyword: string;
  source: TopicSource;
  pageType: string;
  existingPageUrl: string;
  ladderId: string;
  rung: number;
  why: string;
  /** true: written in the cycle unless skipped; false: written only after an approval */
  auto: boolean;
  credits: number;
  aiTarget: { targetId: string; question: string; kind: 'answer' | 'refresh'; fanout: string[]; sources: { url: string; title: string }[]; competitors: string[] } | null;
  /** the client's decision on it, if any (the newest) */
  decision: { decision: 'skip' | 'approve'; scope: 'cycle' | 'always'; by: string; at: string } | null;
  /** Skip: every item; Approve: the items that wait for an OK */
  canSkip: boolean;
  canApprove: boolean;
}

/** GET /api/orgs/:orgId/sites/:siteId/coming-up */
export interface ComingUpView {
  /** false before the first plan arrives (48 hours before cycle 1) */
  available: boolean;
  cycleKey: string;
  cycleDate: string;
  scheduledFor: string | null;
  receivedAt: string | null;
  level: AutopilotLevel;
  pagesPerWeek: number;
  waitingForKeyword: boolean;
  pausedReason: '' | 'pileup' | 'site_paused';
  reason: string;
  /** written on their own in the cycle (auto) and the ladder pages waiting for an OK (not auto) */
  items: ComingUpItem[];
  /** what waits for the client's OK */
  suggestions: ComingUpItem[];
  /** refused by the topic check, with the reason */
  refused: { keyword: string; source: string; reason: string; detail: string }[];
  /** the credits the automatic items use */
  autoCredits: number;
  /** whether the person asking may decide (owner, admin, member) */
  canDecide: boolean;
  /** the plan is for a cycle that already started: decisions are closed */
  closed: boolean;
}

/** POST /api/orgs/:orgId/sites/:siteId/coming-up/decisions */
export interface ComingUpDecisionResult {
  item: ComingUpItem;
  /** the seo_skips key written */
  key: string;
}

export type KeywordProposalStatus = 'pending' | 'approved' | 'swapped' | 'skipped' | 'started' | 'expired' | 'failed';

/** A keyword the system proposes: at levels 1-2 a suggestion that waits for the client; at level 3 an announcement that starts at `startAt`. */
export interface KeywordProposalView {
  id: string;
  siteId: string;
  keyword: string;
  status: KeywordProposalStatus;
  /** level 3: when it starts unless changed or skipped; null = a suggestion */
  startAt: string | null;
  level: AutopilotLevel;
  why: string;
  /** what made room: fewer ladders than the limit ('room'), a won ladder ('won'), a ladder with no pages left ('done') */
  occasion: 'room' | 'won' | 'done';
  searches: number | null;
  difficulty: string | null;
  /** plain words: "Good chance", "Takes a few months", "Hard for your website now" */
  chance: string;
  planType: string | null;
  months: string;
  /** about this many credits a page */
  creditsPerPage: number;
  /** the run that started its ladder, once started */
  runId: string | null;
  /** the keyword typed instead (swap) */
  swappedFor: string | null;
  /** why it did not start (failed / expired) */
  note: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

/** GET /api/orgs/:orgId/sites/:siteId/keyword-proposals */
export interface KeywordProposalList {
  pending: KeywordProposalView[];
  recent: KeywordProposalView[];
  level: AutopilotLevel;
  /** the platform switch (AUTO_START_LADDERS): when off, nothing is proposed or started by the system */
  enabled: boolean;
}

/** GET .../keywords/recommended `status` (the onboarding poll) */
export type ResearchStatus = 'none' | 'running' | 'ready';

/** POST /api/orgs/:orgId/sites/:siteId/research/start */
export interface ResearchStartResult {
  status: ResearchStatus;
  /** the discovery run, when one is going or was started */
  runId: string | null;
  startedAt: string | null;
  /** the run is the website's one free research at setup */
  free: boolean;
  /** started now (false: one was already going, or the research is fresh) */
  started: boolean;
}

/** POST /api/orgs/:orgId/reports/:reportId/feedback */
export interface ContentFeedbackResult {
  id: string;
  verdict: 'reject';
  /** this rejection dropped the website's level to 1 (the auto-pause) */
  levelDropped: boolean;
  level: AutopilotLevel;
}

/** Plain words for a keyword's difficulty for the website (plan §5.2). Not realistic has none: it is not shown. */
export const CHANCE_WORDS: Record<string, string> = { easy: 'Good chance', reachable: 'Takes a few months', hard: 'Hard for your website now', very_hard: 'Hard for your website now' };
