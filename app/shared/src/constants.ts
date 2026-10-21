import { modeCostUsd } from './cost';
import { AI_PANEL_LIMITS, AI_PANEL_PRICE, AI_PANEL_PULSE_ENGINES, estimateAiPanelCost, type AiPulseMode } from './ai-panel';
import { ENGINE_TIMEZONE, isValidTimezone, localDateOf, readCycleIntent, upcomingCycles, type CycleIntent } from './cycle-clock';
import type { CycleJob } from './cycles';

/**
 * The onboarding steps the server keeps on the company (organizations.onboarding_step: the furthest one reached), in the wizard's order
 * (web/src/pages/onboarding/_components/wizard.ts STEPS, plus `done`), so the wizard resumes at the step where it was left.
 */
export const ONBOARDING_STEPS = ['company', 'website', 'verify', 'business', 'profile', 'keyword', 'tracking', 'launch', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Option lists mirror the n8n form pages and Normalize Input (n8n/seo-agent/v5 + build_v4.py), so every value the app sends
// is one the workflow already understands. Change them together.

export const COUNTRIES = [
  { name: 'United States', iso: 'US' },
  { name: 'United Kingdom', iso: 'GB' },
  { name: 'Canada', iso: 'CA' },
  { name: 'Australia', iso: 'AU' },
  { name: 'New Zealand', iso: 'NZ' },
  { name: 'Ireland', iso: 'IE' },
  { name: 'Pakistan', iso: 'PK' },
  { name: 'India', iso: 'IN' },
  { name: 'United Arab Emirates', iso: 'AE' },
  { name: 'Saudi Arabia', iso: 'SA' },
  { name: 'Singapore', iso: 'SG' },
  { name: 'South Africa', iso: 'ZA' },
  { name: 'Germany', iso: 'DE' },
  { name: 'France', iso: 'FR' },
  { name: 'Spain', iso: 'ES' },
  { name: 'Italy', iso: 'IT' },
  { name: 'Netherlands', iso: 'NL' },
  { name: 'Brazil', iso: 'BR' },
  { name: 'Mexico', iso: 'MX' },
] as const;
export type CountryName = (typeof COUNTRIES)[number]['name'];
export const COUNTRY_NAMES = COUNTRIES.map((c) => c.name) as unknown as [CountryName, ...CountryName[]];

/** Page types: `value` is what Normalize Input expects (it maps "Pillar" and "Local" itself). */
export const PAGE_TYPES = [
  { value: 'Service Page', label: 'Service page' },
  { value: 'Product Page', label: 'Product page' },
  { value: 'Blog Post', label: 'Blog post' },
  { value: 'Landing Page', label: 'Landing page' },
  { value: 'Guide', label: 'Guide' },
  { value: 'Pillar Page', label: 'Pillar / hub page' },
  { value: 'Local Page', label: 'Local page (city or area)' },
] as const;
export type PageType = (typeof PAGE_TYPES)[number]['value'];
export const PAGE_TYPE_VALUES = PAGE_TYPES.map((p) => p.value) as unknown as [PageType, ...PageType[]];

export const TONES = [
  'Professional and direct',
  'Friendly and plain-spoken',
  'Bold and confident',
  'Technical and precise',
  'Premium and understated',
] as const;
export type Tone = (typeof TONES)[number];

/** Content goal: `value` is the internal key, `formLabel` the text Normalize Input matches (sell / traffic / brand / leads). */
export const GOALS = [
  { value: 'leads', label: 'Get leads and enquiries' },
  { value: 'sales', label: 'Sell online' },
  { value: 'traffic', label: 'Rank and educate (traffic)' },
  { value: 'brand', label: 'Build the brand' },
] as const;
export type Goal = (typeof GOALS)[number]['value'];
export const GOAL_VALUES = GOALS.map((g) => g.value) as unknown as [Goal, ...Goal[]];

export const AI_ENGINES = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'ai_overview', label: 'Google AI Overviews' },
  { value: 'ai_mode', label: 'Google AI Mode' },
  /** v4.12: Bing's Copilot Search summary (DataForSEO Bing results), opt-in: Bing shows it for few searches */
  { value: 'copilot', label: 'Microsoft Copilot (Bing; few searches show it)' },
  /** G6 (2026-10-18): what an app or agent built on the models answers (DataForSEO LLM Responses with web search), opt-in */
  { value: 'chatgpt_api', label: 'ChatGPT API (GPT with web search)' },
  { value: 'gemini_api', label: 'Gemini API (with Google Search)' },
] as const;
export type AiEngine = (typeof AI_ENGINES)[number]['value'];
export const AI_ENGINE_VALUES = AI_ENGINES.map((e) => e.value) as unknown as [AiEngine, ...AiEngine[]];
/** the engines a website starts with (Copilot and the two model APIs are opt-in) */
export const AI_DEFAULT_ENGINES: AiEngine[] = AI_ENGINE_VALUES.filter((e) => e !== 'copilot' && e !== 'chatgpt_api' && e !== 'gemini_api');

export const PROSPECT_STATUSES = ['new', 'contacted', 'replied', 'won', 'rejected', 'ignored'] as const;   // replied: v4.13 (the app's inbox read a reply)
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const CRAWL_PAGE_OPTIONS = [200, 500, 1000] as const;

// G5 (app/docs/WHITE_LABEL.md): the two client roles of an agency's client workspace rank BELOW viewer, so every route that asks for
// viewer or more refuses them; the client portal opens its few routes to them explicitly (deny by default).
export const ROLES = ['owner', 'admin', 'member', 'viewer', 'client_approver', 'client_viewer'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_RANK: Record<Role, number> = { client_viewer: -2, client_approver: -1, viewer: 0, member: 1, admin: 2, owner: 3 };
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
  client_approver: 'Client approver',
  client_viewer: 'Client viewer',
};
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[min];
}

export const COMPANY_SIZES = ['Just me', '2-10', '11-50', '51-200', '201-1000', '1000+'] as const;

/** Every run mode the n8n API front door accepts. */
export const MODE_IDS = [
  'verdict',
  'keyword',
  'discover',
  'describe',
  'audit',
  'ladder',
  'track',
  'published',
  'checkin',
  'case_study',
  'profile',
  'ai_visibility',
  'backlinks',
] as const;
export type ModeId = (typeof MODE_IDS)[number];

export type ModeCategory = 'keywords' | 'content' | 'technical' | 'growth' | 'tracking' | 'brand';

export interface ModeInfo {
  id: ModeId;
  title: string;
  /** One line under the title on the tools page. */
  summary: string;
  /** What arrives when it finishes. */
  delivers: string;
  category: ModeCategory;
  /** Claude + search-data cost of one run in USD. One table only: `cost.ts` mirrors the engine's own calibrated figures, and the
   *  engine's number replaces this one as soon as a run reports it (B-R3 / B-B1, benchmark area 13 §3.1). */
  costUsd: number;
  etaMinutes: number;
  /** Runs against one of the company's verified sites. */
  siteBound: boolean;
  /** The site may be left out (keyword research without a website). */
  siteOptional?: boolean;
  /** Final callback stages: the run is complete when one of them arrives. */
  finalStages: string[];
  /** Interim callback stages: the run is running. */
  startStages?: string[];
}

export const MODES: Record<ModeId, ModeInfo> = {
  verdict: {
    id: 'verdict',
    title: 'Keyword verdict',
    summary: 'Is this keyword worth writing for? Get a GO / GO WITH CHANGES / AVOID verdict with reasons and risks.',
    delivers: 'Verdict, score, reasons, risks and the recommended page (PDF)',
    category: 'keywords',
    costUsd: modeCostUsd('verdict'),
    etaMinutes: 4,
    siteBound: false,
    siteOptional: true,
    finalStages: ['content'],
  },
  keyword: {
    id: 'keyword',
    title: 'Write a page',
    summary: 'Competitor research, a verdict, a keyword report and a finished, QA-checked page for one keyword.',
    delivers: 'Keyword report + page as Word, PDF, HTML, Markdown and meta.json',
    category: 'content',
    costUsd: modeCostUsd('keyword'),
    etaMinutes: 10,
    siteBound: false,
    siteOptional: true,
    finalStages: ['content'],
  },
  discover: {
    id: 'discover',
    title: 'Keyword discovery',
    summary: 'Multi-source keyword research for your business: opportunity scores, topic clusters, quick wins and AI search demand.',
    delivers: 'Keyword strategy (PDF) with priority keywords checked live on Google',
    category: 'keywords',
    costUsd: modeCostUsd('discover'),
    etaMinutes: 10,
    siteBound: false,
    siteOptional: true,
    finalStages: ['keyword_strategy'],
  },
  describe: {
    id: 'describe',
    title: 'Describe my website',
    summary: 'A structured description of your site from its homepage: what you do, for whom, offers and proof.',
    delivers: 'Site description',
    category: 'brand',
    costUsd: modeCostUsd('describe'),
    etaMinutes: 2,
    siteBound: true,
    finalStages: ['site_description'],
  },
  audit: {
    id: 'audit',
    title: 'Site audit',
    summary: 'Technical audit (crawl, probes, scoring, fix pack) or the full SEO report with competitors, backlinks and AI visibility.',
    delivers: 'Audit report (PDF), diff since the last audit, fix pack (.zip)',
    category: 'technical',
    costUsd: modeCostUsd('audit'),
    etaMinutes: 20,
    siteBound: true,
    finalStages: ['site_audit', 'full_report'],
  },
  ladder: {
    id: 'ladder',
    title: 'Rank my site for a keyword',
    summary: 'A keyword ladder from winnable long-tail pages up to the head term, with a link map, a timeline and the first pages written now.',
    delivers: 'Ladder plan (PDF + Word), then each page as it is written; weekly rank tracking',
    category: 'growth',
    costUsd: modeCostUsd('ladder'),
    etaMinutes: 8,
    siteBound: true,
    finalStages: ['ladder_plan'],
  },
  track: {
    id: 'track',
    title: 'Track my site',
    summary: 'Weekly Search Console, GA4, Google Trends and live rank checks with actions, plus blog posts per week and growth monitors.',
    delivers: 'First tracking report in minutes, then every week on the day tracking started',
    category: 'tracking',
    costUsd: modeCostUsd('track'),
    etaMinutes: 3,
    siteBound: true,
    finalStages: ['site_tracker_setup', 'site_tracker'],
  },
  published: {
    id: 'published',
    title: 'I published a page',
    summary: 'Live check of a page you published (meta, schema, author, images, links, indexability); marks it published and suggests links.',
    delivers: 'Publish check with fixes and internal link suggestions',
    category: 'content',
    costUsd: modeCostUsd('published'),
    etaMinutes: 1,
    siteBound: true,
    finalStages: ['published'],
  },
  checkin: {
    id: 'checkin',
    title: 'Search Console check-in',
    summary: 'Monthly record of what the API cannot see: manual actions, security issues and the Pages report.',
    delivers: 'Check-in recorded; issues raised as alerts',
    category: 'tracking',
    costUsd: modeCostUsd('checkin'),
    etaMinutes: 1,
    siteBound: true,
    finalStages: ['console_checkin'],
  },
  case_study: {
    id: 'case_study',
    title: 'Write a case study',
    summary: 'Turn a client result into proof that later pages cite, and into its own case-study page.',
    delivers: 'Case-study page (Word, PDF, HTML, Markdown)',
    category: 'content',
    costUsd: modeCostUsd('case_study'),
    etaMinutes: 15,
    siteBound: true,
    finalStages: ['content'],
    startStages: ['case_study_started'],
  },
  profile: {
    id: 'profile',
    title: 'Business profile (E-E-A-T)',
    summary: 'Author, expert reviewer and business address used for bylines, author boxes, Person and LocalBusiness schema.',
    delivers: 'Profile saved, readiness score and schema preview',
    category: 'brand',
    costUsd: modeCostUsd('profile'),
    etaMinutes: 1,
    siteBound: true,
    finalStages: ['profile'],
  },
  ai_visibility: {
    id: 'ai_visibility',
    title: 'AI visibility check',
    summary: 'Ask buyer questions on ChatGPT, Perplexity, Gemini, Claude and Google AI: mentions, citations, share of voice, sources AI trusts.',
    delivers: 'AI visibility report (PDF) with the answer grid and actions',
    category: 'growth',
    costUsd: modeCostUsd('ai_visibility'),
    etaMinutes: 10,
    siteBound: true,
    finalStages: ['ai_visibility'],
    startStages: ['ai_visibility_started'],
  },
  backlinks: {
    id: 'backlinks',
    title: 'Backlink check',
    summary: 'Every link source merged (DataForSEO, Bing, your Search Console export, GA4, Common Crawl, Wikipedia, news), links checked on their pages, lost links with the reason, the gap and lists, outreach drafts.',
    delivers: 'Backlink report (PDF), prospects.csv, disavow list when needed',
    category: 'growth',
    costUsd: modeCostUsd('backlinks'),
    etaMinutes: 5,
    siteBound: true,
    finalStages: ['backlinks'],
    startStages: ['backlinks_started'],
  },
};

export const MODE_CATEGORIES: Record<ModeCategory, string> = {
  keywords: 'Keyword research',
  content: 'Content',
  technical: 'Technical SEO',
  growth: 'Growth',
  tracking: 'Tracking',
  brand: 'Brand & E-E-A-T',
};

/** Callback stages sent by scheduled workflows (no run started them from the app). */
export const SCHEDULED_STAGES = ['site_tracker', 'rank_tracker', 'content_cadence', 'console_alert', 'ai_visibility', 'ai_pulse', 'ai_growth', 'backlinks', 'link_builder', 'site_audit'] as const;

export const STAGE_LABELS: Record<string, string> = {
  site_description: 'Site description',
  keyword_strategy: 'Keyword strategy',
  content: 'Page / keyword report',
  site_audit: 'Technical audit',
  full_report: 'Full SEO report',
  ladder_plan: 'Ladder plan',
  rank_tracker: 'Rank tracker',
  site_tracker_setup: 'Tracking set up',
  site_tracker: 'Weekly site report',
  content_cadence: 'Content cadence',
  published: 'Publish check',
  console_checkin: 'Search Console check-in',
  console_alert: 'Search Console alert',
  profile: 'Business profile',
  case_study_started: 'Case study started',
  ai_visibility_started: 'AI visibility started',
  ai_visibility: 'AI visibility report',
  ai_pulse: 'AI pulse',   // D-13: "alert" only when the day has one (titleFor)
  ai_growth: 'AI growth',
  backlinks_started: 'Backlink check started',
  backlinks: 'Backlink report',
  link_builder: 'Link building',
  rejected: 'Rejected',
  // keyword-first (2026-10-19): the weekly plan, 48 hours before each cycle
  cycle_preview: 'Coming up plan',
};

/** Monthly cost of the background monitors per site (HANDOVER.md §1, v4.6 reuse rules; AI visibility: estimateAiVisibilityCost, v4.9). */
export const MONITOR_COSTS = {
  /** the defaults (20 questions, all six engines, daily pulse on), see estimateAiVisibilityCost */
  aiVisibilityMonthly: 0,
  /** v4.12: the AI growth loop with its default AI pages, see estimateAiGrowthCost */
  aiGrowthMonthly: 0,
  /** v4.10 (BACKLINKS_SPEC.md §6): the monthly full run $0.51 (DataForSEO incl. link details, anchors, pages, competitors' new links,
   *  bulk authority; Link Analyst; outreach) + 3.33 light weeks at $0.09; the free sources and the link check cost nothing */
  backlinksMonthly: 0.51 + 3.33 * 0.09,
  /** v4.13 (LINK_BUILDER_SPEC.md §8): the sequence writer (≤ 10 a week) ≈ $0.25, competitors' broken backlinks ≈ $0.07, replies ≈ $0.001 each; the rest is free */
  linkBuilderMonthly: 0.35,
  siteTrackerMonthly: 4 * 0.03,
  /** the weekly rank check of a website's keyword ladders (the Pipeline's figure since v4.8; one forecast row, shared/src/autopilot.ts) */
  rankTrackerMonthly: 0.1,
  /** the monthly technical audit and each written page are ordinary runs: priced from the one table, never a second copy */
  auditMonthly: modeCostUsd('audit'),
  blogPostEach: modeCostUsd('keyword'),
  weeksPerMonth: 4.33,
};

/** DataForSEO price per question on each AI engine, the one table, ./ai-panel.ts (mirrors the engine's AIP.PRICE, golden cases in both). */
export const AI_ENGINE_COST: Record<AiEngine, number> = { ...AI_PANEL_PRICE };
/** The engines the daily AI Pulse asks (n8n Pulse_Plan.js CONFIG.pulse_engines), Tuesday to Sunday. */
export const AI_PULSE_ENGINES: readonly AiEngine[] = AI_PANEL_PULSE_ENGINES;
/** G6 (2026-10-18): a NEW website starts with 50 questions; a website whose stored setting is empty keeps 20; up to 500. */
export const AI_PROMPTS_DEFAULT = AI_PANEL_LIMITS.default_new;
export const AI_PROMPTS_STORED_DEFAULT = AI_PANEL_LIMITS.default_stored;
export const AI_PROMPTS_MAX = AI_PANEL_LIMITS.max;

/** Questions the weekly run and the daily pulse ask: the panel without its brand question ("What is <site>?", asked once a month). */
export function aiPulseQuestions(panel: number): number {
  return Math.max(1, Math.min(AI_PROMPTS_MAX, panel) - 1);
}

/**
 * Monthly cost of AI visibility for one site (v4.9, n8n/seo-agent/AI_VISIBILITY_SPEC.md §5): the weekly run (every engine but Claude, plus
 * the Answer Analyst and the brief), the month's full run (Claude, the AI-answer database index and question discovery) and the daily pulse.
 */
export function estimateAiVisibilityCost(o: { prompts?: number; engines?: readonly AiEngine[]; pulse?: boolean; pulseMode?: AiPulseMode | string; pulsePerWeek?: number | null } = {}): { weekly: number; fullRun: number; pulse: number; total: number } {
  // G6 (2026-10-18): one formula, ./ai-panel.ts estimateAiPanelCost, the mirror of the engine's AIP.cost (golden cases on both sides)
  const c = estimateAiPanelCost({ panel: o.prompts ?? AI_PROMPTS_DEFAULT, engines: o.engines && o.engines.length ? o.engines : AI_DEFAULT_ENGINES, pulse: o.pulse, pulseMode: o.pulseMode, pulsePerWeek: o.pulsePerWeek });
  return { weekly: c.month.weekly, fullRun: c.month.fullExtra, pulse: c.month.pulse, total: c.month.total };
}
MONITOR_COSTS.aiVisibilityMonthly = estimateAiVisibilityCost().total;

/** v4.12 (n8n/seo-agent/AI_GROWTH_SPEC.md): AI answer / refresh pages a month (default 2, at most 8). Keyword-first (D4): written on their own
 *  at autopilot level 3 only; at levels 1 and 2 they are how many AI suggestions a month the weekly plan offers. */
export const AI_PAGES_DEFAULT = 2;
export const AI_PAGES_MAX = 8;
/** Monthly cost of the AI growth loop: the AI pages (a content run each) + the weekly outreach drafts (Claude); Bing / IndexNow submission,
 *  the page checks, the cited-page fetches and the entity check are free. */
export function estimateAiGrowthCost(o: { pages?: number; growth?: boolean } = {}): { pages: number; drafts: number; total: number } {
  if (o.growth === false) return { pages: 0, drafts: 0, total: 0 };
  const n = Math.min(AI_PAGES_MAX, Math.max(0, o.pages ?? AI_PAGES_DEFAULT));
  const r = (x: number) => Math.round(x * 100) / 100;
  const pages = n * MONITOR_COSTS.blogPostEach, drafts = MONITOR_COSTS.weeksPerMonth * 0.03;
  return { pages: r(pages), drafts: r(drafts), total: r(pages + drafts) };
}
MONITOR_COSTS.aiGrowthMonthly = estimateAiGrowthCost().total;

export function estimateMonitoringCost(opts: { aiVisibility: boolean; backlinks: boolean; auditMonthly: boolean; blogsPerWeek: number; aiPrompts?: number; aiEngines?: readonly AiEngine[]; aiPulse?: boolean; aiGrowth?: boolean; aiPages?: number; linkBuilder?: boolean }): number {
  const c = MONITOR_COSTS;
  let total = c.siteTrackerMonthly;
  if (opts.aiVisibility) total += estimateAiVisibilityCost({ prompts: opts.aiPrompts, engines: opts.aiEngines, pulse: opts.aiPulse }).total;
  if (opts.aiVisibility) total += estimateAiGrowthCost({ pages: opts.aiPages, growth: opts.aiGrowth }).total;   // v4.12
  if (opts.backlinks) total += c.backlinksMonthly;
  if (opts.linkBuilder) total += c.linkBuilderMonthly;   // v4.13
  if (opts.auditMonthly) total += c.auditMonthly;
  total += opts.blogsPerWeek * c.weeksPerMonth * c.blogPostEach;
  return Math.round(total * 100) / 100;
}

export const VERIFICATION_META_NAME = 'seo-agent-verification';
export const VERIFICATION_TXT_PREFIX = 'seo-agent-verification=';

// ---------- automations (the n8n schedules, build_*.py; times are in n8n's timezone, GENERIC_TIMEZONE, default America/New_York) ----------
export type AutomationId = 'ai_visibility' | 'ai_pulse' | 'ai_growth' | 'backlinks' | 'link_builder' | 'rank_tracker' | 'site_tracker' | 'content_cadence' | 'audit';
export interface AutomationInfo {
  id: AutomationId;
  title: string;
  /** what it does each time */
  summary: string;
  /** how often, in words */
  cadence: string;
  /**
   * When it runs. 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4): the weekly work runs inside each website's own 7-day cycle (`cycle`: the job
   * and its place in the cycle's order; `monthlyOnly`: only in the website's monthly cycle), started by the engine's Cycle Dispatcher on the
   * website's weekday at 06:00 in its time zone (cycle 0 at setup). `daily` stays on the engine's clock; `skipCycleDay`: the website's own
   * cycle day is left out (its weekly run asks the same engines). `weekly` / `monthly` are the old shared slots (still understood for history).
   */
  schedule:
    | { kind: 'cycle'; job: Exclude<CycleJob, 'preview' | 'cycle'>; order: number; monthlyOnly?: boolean }
    | { kind: 'weekly'; weekday: number; hour: number; minute: number }
    | { kind: 'monthly'; day: number; hour: number; minute: number }
    | { kind: 'daily'; weekdays: number[]; hour: number; minute: number; skipCycleDay?: boolean };
  /** n8n workflow id */
  workflow: string;
  /** the report stage it delivers */
  stage: string;
  /** the mode that runs the same work on demand */
  runNowMode?: ModeId;
  /** the website settings tab that controls it */
  settingsTab: string;
  /**
   * R103 (2026-10-16): when this schedule first existed (its n8n workflow's `createdAt`, UTC, read from the instance on 2026-10-15). A fire
   * due before it is not a missed fire, the delivery rate counted 57 of its 72 "missed" fires before the workflow was even created.
   */
  since?: string;
}

export const AUTOMATIONS: AutomationInfo[] = [
  {
    id: 'ai_visibility',
    title: 'AI visibility check',
    summary: 'Asks your buyer questions on ChatGPT, Gemini, Perplexity and Google AI (Claude once a month): mentions with their 95% range, citations, share of voice, how AI describes you, AI visits and revenue (GA4), AI crawler access.',
    cadence: 'Every week in your website\'s cycle · Claude, new questions and the market-wide index in the monthly cycle',
    schedule: { kind: 'cycle', job: 'ai_visibility', order: 1 },
    workflow: 'SEOagentAIVisib1',
    since: '2026-10-02T12:32:00.000Z',
    stage: 'ai_visibility',
    runNowMode: 'ai_visibility',
    settingsTab: 'tracking',
  },
  {
    id: 'ai_pulse',
    title: 'AI pulse',
    summary: 'Asks every tracked question on ChatGPT, Gemini and Google AI Mode each day; the weekly report counts these answers, and you hear about a real drop the same day.',
    cadence: 'Every day except your website\'s cycle day · alerts only when something really changed',
    schedule: { kind: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], hour: 6, minute: 30, skipCycleDay: true },
    workflow: 'SEOagentAIPulse1',
    since: '2026-10-07T22:21:00.000Z',
    stage: 'ai_pulse',
    settingsTab: 'tracking',
  },
  {
    id: 'ai_growth',
    title: 'AI growth',
    summary: 'Sends new and updated pages to Bing and IndexNow, checks your key pages can be read and quoted by AI, lists the exact pages AI cites without naming you (with outreach drafts) and queues the questions to win for the weekly content run.',
    cadence: 'Every week in your website\'s cycle · after the AI visibility check, before the content run',
    schedule: { kind: 'cycle', job: 'ai_growth', order: 5 },
    workflow: 'SEOagentAIGrow1',
    since: '2026-10-10T15:14:00.000Z',
    stage: 'ai_growth',
    settingsTab: 'tracking',
  },
  {
    id: 'backlinks',
    title: 'Backlink monitor',
    summary: 'Watches for lost and spammy links every week; once a month a full report with broken-link reclaim, unlinked mentions and outreach drafts (link gap each quarter).',
    cadence: 'Every week in your website\'s cycle · full report in the monthly cycle',
    schedule: { kind: 'cycle', job: 'backlinks', order: 2 },
    workflow: 'SEOagentBacklnk1',
    since: '2026-10-02T12:32:00.000Z',
    stage: 'backlinks',
    runNowMode: 'backlinks',
    settingsTab: 'tracking',
  },
  {
    id: 'link_builder',
    title: 'Link builder',
    summary: 'Finds new link opportunities (journalist requests, dead links to replace, resource pages, competitors\' lost links), checks each site and finds the right person, picks your page and the link text, and drafts a short e-mail sequence for you to approve and send from your own mailbox; tracks the listings you can add yourself and what each won link did.',
    cadence: 'Every week in your website\'s cycle · after the backlink monitor and the AI growth loop',
    schedule: { kind: 'cycle', job: 'link_builder', order: 7 },
    workflow: 'SEOagentLinkBld1',
    since: '2026-10-11T00:42:00.000Z',
    stage: 'link_builder',
    settingsTab: 'tracking',
  },
  {
    id: 'rank_tracker',
    title: 'Rank tracker',
    summary:
      'Checks the live Google position of every keyword-ladder page and the head term, records what the results page showed (AI Overview, snippet, People Also Ask, local pack, video), who ranks above you and your share of voice, and recommends the next rung.',
    cadence: 'Every week in your website\'s cycle · main keywords also on a phone · unpublished pages outside the top 50 once a month',
    schedule: { kind: 'cycle', job: 'rank_tracker', order: 3 },
    workflow: 'SEOagentTracker1',
    since: '2026-10-01T12:06:00.000Z',
    stage: 'rank_tracker',
    settingsTab: 'tracking',
  },
  {
    id: 'site_tracker',
    title: 'Weekly site report',
    summary: 'Search Console, GA4, Google Trends and live rank checks of your tracked keywords, with the week\'s actions.',
    cadence: 'Every week in your website\'s cycle · trends reused for 25 days',
    schedule: { kind: 'cycle', job: 'site_tracker', order: 4 },
    workflow: 'SEOagentSiteTrk1',
    since: '2026-10-01T22:22:00.000Z',
    stage: 'site_tracker',
    runNowMode: 'track',
    settingsTab: 'tracking',
  },
  {
    id: 'content_cadence',
    title: 'Pages for your keywords',
    summary: 'Writes the next pages of the keywords you chose, each a researched, quality-checked page. What else it writes on its own depends on your autopilot level; everything else waits for your OK in the weekly "Coming up" plan.',
    cadence: 'Every week in your website\'s cycle · as many pages as you set per week, only once you have chosen a keyword',
    schedule: { kind: 'cycle', job: 'content_cadence', order: 6 },
    workflow: 'SEOagentCadence1',
    since: '2026-10-01T23:15:00.000Z',
    stage: 'content',
    settingsTab: 'tracking',
  },
  {
    id: 'audit',
    title: 'Technical audit',
    summary: 'Re-audits the site when its sitemap changed (or after 60 days): health score, what changed since the last audit, fix pack.',
    cadence: 'In your website\'s monthly cycle (the first cycle on or after the day of the month tracking started) · skipped when nothing changed',
    schedule: { kind: 'cycle', job: 'audit', order: 8, monthlyOnly: true },
    workflow: 'SEOagentAuditSc1',
    since: '2026-10-02T12:32:00.000Z',
    stage: 'site_audit',
    runNowMode: 'audit',
    settingsTab: 'tracking',
  },
];

/**
 * R103 (2026-10-16): every n8n schedule the delivery rate measures, the nine automations above plus the tenth, the daily key-page watch
 * (`SEOagentPageWch1`, build_site_tracker.py: `days`, interval 1, 05:45 in n8n's timezone, every day). Page Watch is not an automation a
 * website switches on (it has no report stage and no settings tab of its own), so it is not in `AUTOMATIONS`; it is a schedule all the
 * same, and a schedule that does not fire is a missed fire.
 */
export type ScheduleId = AutomationId | 'page_watch';
export type ScheduleInfo = Omit<AutomationInfo, 'id'> & { id: ScheduleId };

export const PAGE_WATCH_SCHEDULE: ScheduleInfo = {
  id: 'page_watch',
  title: 'Key-page watch',
  summary: 'Reads your key pages and robots.txt every morning and alerts the same day when one went noindex, started redirecting, lost its canonical or changed its title.',
  cadence: 'Every day 05:45',
  schedule: { kind: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], hour: 5, minute: 45 },
  workflow: 'SEOagentPageWch1',
  stage: 'page_watch',
  settingsTab: 'tracking',
  since: '2026-10-13T06:16:00.000Z',
};

export const SCHEDULES: ScheduleInfo[] = [...AUTOMATIONS, PAGE_WATCH_SCHEDULE];

/**
 * The next time a schedule runs after `from` (DST-safe, no libraries). `daily` / `weekly` / `monthly` fire on the engine's clock `tz`. A
 * `cycle` job runs in the website's own cycle (`site`: its seo_cycles row as an intent, or the app's anchor and zone): its next cycle's
 * due time, the next MONTHLY cycle for a monthly-only job; null without a site (the job has no shared slot any more). A daily schedule
 * with `skipCycleDay` leaves out the website's cycle day (its local date in the website's zone on the cycle weekday, Monday when the
 * website has no cycle yet), as the AI Pulse does.
 */
export function nextScheduledRun(s: AutomationInfo['schedule'], tz: string, from: Date = new Date(), site?: CycleIntent | null): Date | null {
  if (s.kind === 'cycle') {
    if (!site) return null;
    const list = upcomingCycles(site, from.getTime(), s.monthlyOnly ? 16 : 2).filter((c) => Date.parse(c.at) > from.getTime() - 1 && (!s.monthlyOnly || c.monthly));
    return list.length ? new Date(list[0].at) : null;
  }
  const parts = (d: Date) => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(d);
    const g = (t: string) => f.find((p) => p.type === t)?.value ?? '0';
    return { y: Number(g('year')), m: Number(g('month')), d: Number(g('day')), h: Number(g('hour')), mi: Number(g('minute')), s: Number(g('second')), wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
  };
  const offset = (d: Date) => {
    const p = parts(d);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000;
  };
  const wallToUtc = (y: number, m: number, d: number, h: number, mi: number) => {
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const first = guess - offset(new Date(guess));
    return new Date(guess - offset(new Date(first)));
  };
  // the website's own cycle day (the AI Pulse leaves it out): its zone and weekday, Monday for a website with no cycle yet
  const siteRead = s.kind === 'daily' && s.skipCycleDay ? (site ? readCycleIntent(site) : null) : null;
  const skipDay = (at: Date) => {
    if (!(s.kind === 'daily' && s.skipCycleDay)) return false;
    const zone = siteRead?.tz ?? (site && isValidTimezone(site.tz) ? site.tz : ENGINE_TIMEZONE);
    const wd = siteRead ? siteRead.weekday : 1;
    return localDateOf(zone, at.getTime()).weekday === wd;
  };
  const today = parts(from);
  for (let i = 0; i < 70; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    const match = s.kind === 'weekly' ? wd === s.weekday : s.kind === 'daily' ? s.weekdays.includes(wd) : d === s.day;
    if (!match) continue;
    const at = wallToUtc(y, m, d, s.hour, s.minute);
    if (at.getTime() > from.getTime() && !skipDay(at)) return at;
  }
  return new Date(from.getTime() + 7 * 864e5);
}
