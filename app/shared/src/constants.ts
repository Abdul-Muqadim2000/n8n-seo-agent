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
] as const;
export type AiEngine = (typeof AI_ENGINES)[number]['value'];
export const AI_ENGINE_VALUES = AI_ENGINES.map((e) => e.value) as unknown as [AiEngine, ...AiEngine[]];

export const PROSPECT_STATUSES = ['new', 'contacted', 'won', 'rejected', 'ignored'] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const CRAWL_PAGE_OPTIONS = [200, 500, 1000] as const;

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
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
  /** Rough Claude + DataForSEO cost per run in USD (HANDOVER.md §4, live runs of 2026-10-02). */
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
    costUsd: 0.2,
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
    costUsd: 1.2,
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
    costUsd: 0.4,
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
    costUsd: 0.03,
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
    costUsd: 0.1,
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
    costUsd: 1.8,
    etaMinutes: 8,
    siteBound: true,
    finalStages: ['ladder_plan'],
  },
  track: {
    id: 'track',
    title: 'Track my site',
    summary: 'Weekly Search Console, GA4, Google Trends and live rank checks with actions, plus blog posts per week and growth monitors.',
    delivers: 'First tracking report in minutes, then every Monday',
    category: 'tracking',
    costUsd: 0.1,
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
    costUsd: 0,
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
    costUsd: 0,
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
    costUsd: 1.2,
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
    costUsd: 0,
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
    costUsd: 0.9,
    etaMinutes: 10,
    siteBound: true,
    finalStages: ['ai_visibility'],
    startStages: ['ai_visibility_started'],
  },
  backlinks: {
    id: 'backlinks',
    title: 'Backlink check',
    summary: 'Lost and spammy links, broken-link reclaim, link gap against competitors, unlinked mentions and outreach drafts.',
    delivers: 'Backlink report (PDF), prospects.csv, disavow list when needed',
    category: 'growth',
    costUsd: 0.25,
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
export const SCHEDULED_STAGES = ['site_tracker', 'rank_tracker', 'content_cadence', 'console_alert', 'ai_visibility', 'backlinks', 'site_audit'] as const;

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
  backlinks_started: 'Backlink check started',
  backlinks: 'Backlink report',
  rejected: 'Rejected',
};

/** Monthly cost of the background monitors per site (HANDOVER.md §1, v4.6 reuse rules). */
export const MONITOR_COSTS = {
  aiVisibilityMonthly: 0.87 + 3 * 0.12,
  backlinksMonthly: 0.2 + 3 * 0.05,
  siteTrackerMonthly: 4 * 0.03,
  auditMonthly: 0.1,
  blogPostEach: 1.2,
  weeksPerMonth: 4.33,
};

export function estimateMonitoringCost(opts: { aiVisibility: boolean; backlinks: boolean; auditMonthly: boolean; blogsPerWeek: number }): number {
  const c = MONITOR_COSTS;
  let total = c.siteTrackerMonthly;
  if (opts.aiVisibility) total += c.aiVisibilityMonthly;
  if (opts.backlinks) total += c.backlinksMonthly;
  if (opts.auditMonthly) total += c.auditMonthly;
  total += opts.blogsPerWeek * c.weeksPerMonth * c.blogPostEach;
  return Math.round(total * 100) / 100;
}

export const VERIFICATION_META_NAME = 'seo-agent-verification';
export const VERIFICATION_TXT_PREFIX = 'seo-agent-verification=';

// ---------- automations (the n8n schedules, build_*.py; times are in n8n's timezone, GENERIC_TIMEZONE, default America/New_York) ----------
export type AutomationId = 'ai_visibility' | 'backlinks' | 'rank_tracker' | 'site_tracker' | 'content_cadence' | 'audit';
export interface AutomationInfo {
  id: AutomationId;
  title: string;
  /** what it does each time */
  summary: string;
  /** how often, in words */
  cadence: string;
  schedule: { kind: 'weekly'; weekday: number; hour: number; minute: number } | { kind: 'monthly'; day: number; hour: number; minute: number };
  /** n8n workflow id */
  workflow: string;
  /** the report stage it delivers */
  stage: string;
  /** the mode that runs the same work on demand */
  runNowMode?: ModeId;
  /** the website settings tab that controls it */
  settingsTab: string;
}

export const AUTOMATIONS: AutomationInfo[] = [
  {
    id: 'ai_visibility',
    title: 'AI visibility check',
    summary: 'Asks your buyer questions on ChatGPT, Perplexity and Google AI (Gemini and Claude once a month): mentions, citations, share of voice, sources AI trusts.',
    cadence: 'Every Monday · Gemini, Claude and the market view on the month’s first run',
    schedule: { kind: 'weekly', weekday: 1, hour: 7, minute: 0 },
    workflow: 'SEOagentAIVisib1',
    stage: 'ai_visibility',
    runNowMode: 'ai_visibility',
    settingsTab: 'tracking',
  },
  {
    id: 'backlinks',
    title: 'Backlink monitor',
    summary: 'Watches for lost and spammy links every week; once a month a full report with broken-link reclaim, unlinked mentions and outreach drafts (link gap each quarter).',
    cadence: 'Every Monday · full report on the month’s first run',
    schedule: { kind: 'weekly', weekday: 1, hour: 7, minute: 30 },
    workflow: 'SEOagentBacklnk1',
    stage: 'backlinks',
    runNowMode: 'backlinks',
    settingsTab: 'tracking',
  },
  {
    id: 'rank_tracker',
    title: 'Rank tracker',
    summary: 'Checks the live Google position of every keyword-ladder page and the head term, and recommends the next rung.',
    cadence: 'Every Monday · unpublished pages outside the top 50 once a month',
    schedule: { kind: 'weekly', weekday: 1, hour: 8, minute: 0 },
    workflow: 'SEOagentTracker1',
    stage: 'rank_tracker',
    settingsTab: 'tracking',
  },
  {
    id: 'site_tracker',
    title: 'Weekly site report',
    summary: 'Search Console, GA4, Google Trends and live rank checks of your tracked keywords, with the week’s actions.',
    cadence: 'Every Monday · trends reused for 25 days',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    workflow: 'SEOagentSiteTrk1',
    stage: 'site_tracker',
    runNowMode: 'track',
    settingsTab: 'tracking',
  },
  {
    id: 'content_cadence',
    title: 'Blog posts',
    summary: 'Writes your weekly posts: the next keyword-ladder page first, then queries close to page one, then rising searches — each a researched, QA-checked page.',
    cadence: 'Every Monday · as many posts as you set per week',
    schedule: { kind: 'weekly', weekday: 1, hour: 10, minute: 0 },
    workflow: 'SEOagentCadence1',
    stage: 'content',
    settingsTab: 'tracking',
  },
  {
    id: 'audit',
    title: 'Technical audit',
    summary: 'Re-audits the site when its sitemap changed (or after 60 days): health score, what changed since the last audit, fix pack.',
    cadence: '1st of every month · skipped when nothing changed',
    schedule: { kind: 'monthly', day: 1, hour: 6, minute: 0 },
    workflow: 'SEOagentAuditSc1',
    stage: 'site_audit',
    runNowMode: 'audit',
    settingsTab: 'tracking',
  },
];

/** The next time a schedule fires after `from`, in the n8n timezone `tz` (DST-safe, no libraries). */
export function nextScheduledRun(s: AutomationInfo['schedule'], tz: string, from: Date = new Date()): Date {
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
  const today = parts(from);
  for (let i = 0; i < 70; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    const match = s.kind === 'weekly' ? wd === s.weekday : d === s.day;
    if (!match) continue;
    const at = wallToUtc(y, m, d, s.hour, s.minute);
    if (at.getTime() > from.getTime()) return at;
  }
  return new Date(from.getTime() + 7 * 864e5);
}
