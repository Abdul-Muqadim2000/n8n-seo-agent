import { estimateAiPanelCost } from './ai-panel';
import { estimateAiGrowthCost, estimateAiVisibilityCost, MONITOR_COSTS } from './constants';
import { modeCostUsd } from './cost';
import { DEFAULT_AUTOPILOT_LEVEL, type AutopilotLevel } from './cycles';
import type { MonitorSettings } from './schemas';

// What a website's schedules (its "autopilot") use a month, row by row, one function for the settings card the customer sees, the
// Credits page's forecast and the server's reserve for the schedules (app/docs/CREDITS.md), so the three never disagree. Amounts are the
// provider cost in USD; screens turn them into credits with the company's credit rate.

export type AutopilotRowId = 'site_report' | 'ai_visibility' | 'ai_pulse' | 'ai_growth' | 'backlinks' | 'link_builder' | 'rank_tracker' | 'audit' | 'blog_posts' | 'research';

/**
 * Keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.4): what the autopilot writes on its own depends on the level and on the keywords the
 * client chose. `writing`: a client-chosen Auto ladder still has pages to write (levels 1 and 2 write nothing else on their own, and
 * nothing at all before the first keyword). Level 3 also writes new topics and the AI answer pages, and refreshes the keyword research
 * every 90 days. Defaults: level 2, writing (the forecast shown while the client is choosing a keyword).
 */
export interface AutopilotPlan {
  level?: AutopilotLevel;
  writing?: boolean;
  /**
   * The website has a keyword ladder, so the weekly rank check runs (and is charged). Pre-launch run 2026-10-21 (B4): the Pipeline counted
   * the rank check and the Credits page did not (573 against 567 credits a month for one website); both read this row now. Default false:
   * a screen that does not know the ladders forecasts no rank check, as the engine runs none without a ladder.
   */
  ranking?: boolean;
}

/** A keyword research refresh every 90 days at level 3: the discovery run, a month's share. */
export const RESEARCH_REFRESH_DAYS = 90;

/**
 * What the autopilot runs on its own for a website (2026-10-28): the Pipeline's own rule (server services/pipeline.ts `base`): a verified
 * website whose weekly tracking is on (not paused by a person, nor by the credit guard) with the monitor switched on (missing settings =
 * the defaults, on). Recommendations and the Overview's checklist read it, so neither asks the client to run by hand what the weekly
 * cycle does anyway (a client ran the first audit by hand three hours before the autopilot's own audit, because both screens said to).
 */
export interface AutopilotRuns {
  audit: boolean;
  aiVisibility: boolean;
  backlinks: boolean;
}

export function autopilotRuns(site: { verified: boolean; trackingStatus: string }, m: Partial<Pick<MonitorSettings, 'aiVisibility' | 'backlinks' | 'auditMonthly'>> | null | undefined): AutopilotRuns {
  const live = site.verified && site.trackingStatus === 'active';
  return { audit: live && (m?.auditMonthly ?? true), aiVisibility: live && (m?.aiVisibility ?? true), backlinks: live && (m?.backlinks ?? true) };
}

export interface AutopilotRow {
  id: AutopilotRowId;
  label: string;
  detail: string;
  on: boolean;
  /** provider cost a month in USD (0 when off) */
  usd: number;
}

type Monitors = Pick<
  MonitorSettings,
  'aiVisibility' | 'aiEngines' | 'aiPromptsMax' | 'aiPulse' | 'aiPulseMode' | 'aiPulsePerWeek' | 'aiGrowth' | 'aiPagesPerMonth' | 'backlinks' | 'linkBuilder' | 'auditMonthly' | 'auditPages'
> &
  // W2-FIX (2026-10-23): the owner's AI options (absent = off), priced into the AI visibility and pulse rows like the engine's AIP.cost does
  Partial<Pick<MonitorSettings, 'aiClaudeWeekly' | 'aiPulseEngines' | 'aiPersonaContext' | 'aiPersonas' | 'aiFanoutCheck' | 'aiDemandMarket'>>;

/** The W2-E3 options of a website's monitor settings as estimateAiPanelCost takes them (only the ones set). */
export function aiPanelOptionsOf(m: Partial<Pick<MonitorSettings, 'aiClaudeWeekly' | 'aiPulseEngines' | 'aiPersonaContext' | 'aiPersonas' | 'aiFanoutCheck' | 'aiDemandMarket'>>) {
  return {
    ...(m.aiClaudeWeekly ? { claudeWeekly: true } : {}),
    ...(m.aiPulseEngines && m.aiPulseEngines.length ? { pulseEngines: m.aiPulseEngines } : {}),
    ...(m.aiPersonaContext ? { personaContext: true, personas: m.aiPersonas ?? [] } : {}),
    ...(m.aiFanoutCheck ? { fanoutCheck: m.aiFanoutCheck } : {}),
    ...(m.aiDemandMarket ? { demandMarket: true } : {}),
  };
}

export function autopilotRows(m: Monitors, blogsPerWeek: number, plan: AutopilotPlan = {}): AutopilotRow[] {
  const c = MONITOR_COSTS;
  const level = plan.level ?? DEFAULT_AUTOPILOT_LEVEL;
  const full = level === 3;
  const writing = plan.writing ?? true;
  const opts = aiPanelOptionsOf(m);
  const ai = estimateAiVisibilityCost({ prompts: m.aiPromptsMax, engines: m.aiEngines, pulse: m.aiPulse, pulseMode: m.aiPulseMode, pulsePerWeek: m.aiPulsePerWeek, ...opts });
  const panel = estimateAiPanelCost({ panel: m.aiPromptsMax, engines: m.aiEngines, pulse: m.aiPulse, pulseMode: m.aiPulseMode, pulsePerWeek: m.aiPulsePerWeek, ...opts });
  // the AI answer pages are written on their own at level 3 only; at levels 1 and 2 they are suggestions (the drafts still cost)
  const growth = estimateAiGrowthCost({ pages: full ? m.aiPagesPerMonth : 0, growth: m.aiGrowth });
  const setPosts = Math.max(0, blogsPerWeek || 0);
  // levels 1-2: pages only while a keyword the client chose has pages left; level 3 writes whatever passes the topic check
  const posts = full || writing ? setPosts : 0;
  const postsDetail = posts
    ? `${posts} a week, about ${c.weeksPerMonth} weeks a month`
    : setPosts
      ? 'none until you choose a keyword (or while your keywords have no pages left)'
      : 'none';
  const rows: AutopilotRow[] = [
    { id: 'site_report', label: 'Weekly site report', detail: 'Search Console, GA4, Google Trends, live rank checks', on: true, usd: c.siteTrackerMonthly },
    { id: 'ai_visibility', label: 'AI visibility', detail: `${m.aiPromptsMax} questions weekly, Claude and the market-wide index monthly`, on: m.aiVisibility, usd: ai.weekly + ai.fullRun },
    {
      id: 'ai_pulse',
      label: 'Daily AI pulse',
      detail: panel.perWeek >= 6 ? `${panel.pulseQuestionsDay} questions a day on the fast engines` : `${panel.pulseQuestionsDay} questions a day (each one ${panel.perWeek}× a week) on the fast engines`,
      on: m.aiVisibility && m.aiPulse && ai.pulse > 0,
      usd: ai.pulse,
    },
    {
      id: 'ai_growth',
      label: 'AI growth',
      detail: full
        ? `${m.aiPagesPerMonth} AI answer page${m.aiPagesPerMonth === 1 ? '' : 's'} a month, outreach drafts; Bing / IndexNow and page checks free`
        : 'outreach drafts; AI answer pages are suggestions you approve; Bing / IndexNow and page checks free',
      on: m.aiVisibility && m.aiGrowth,
      usd: growth.total,
    },
    { id: 'backlinks', label: 'Backlink monitor', detail: 'weekly watch, monthly full report', on: m.backlinks, usd: c.backlinksMonthly },
    { id: 'link_builder', label: 'Link builder', detail: 'up to 10 drafted sequences a week; opportunity search, contacts and checks free', on: m.linkBuilder, usd: c.linkBuilderMonthly },
    { id: 'rank_tracker', label: 'Rank checks', detail: plan.ranking ? 'your keyword ladders\' pages on Google, every week' : 'none until you have a keyword ladder', on: !!plan.ranking, usd: c.rankTrackerMonthly },
    { id: 'audit', label: 'Monthly technical audit', detail: `up to ${m.auditPages} pages`, on: m.auditMonthly, usd: c.auditMonthly },
    { id: 'blog_posts', label: 'Pages for your keywords', detail: postsDetail, on: posts > 0, usd: posts * c.weeksPerMonth * c.blogPostEach },
    { id: 'research', label: 'Keyword research refresh', detail: `every ${RESEARCH_REFRESH_DAYS} days, so new keywords can be proposed`, on: full, usd: (modeCostUsd('discover') * 30) / RESEARCH_REFRESH_DAYS },
  ];
  return rows.map((r) => ({ ...r, usd: r.on ? Math.round(r.usd * 10000) / 10000 : 0 }));
}

/**
 * What the first cycle's checks use on launch day (the launch screen's "Today" estimate, provider cost in USD): a week's share of every
 * weekly row that is on, the monthly audit in full (cycle 0 is also the website's monthly cycle). The site report counts: the Site Tracker
 * run "Track my site" starts is the website's first weekly site report, autopilot spend (D3, 2026-10-21: it was left out, so the launch
 * total showed nothing for it). Pages and the research refresh are not checks the first cycle starts on its own.
 */
export function firstCycleChecksUsd(rows: AutopilotRow[]): number {
  const usd = rows
    .filter((r) => r.on && r.id !== 'blog_posts' && r.id !== 'research')
    .reduce((t, r) => t + (r.id === 'audit' ? r.usd : r.usd / MONITOR_COSTS.weeksPerMonth), 0);
  return Math.round(usd * 10000) / 10000;
}

/** The month's total (provider cost, USD) of the rows that are on. */
export function autopilotMonthlyUsd(m: Monitors, blogsPerWeek: number, plan: AutopilotPlan = {}): number {
  return Math.round(autopilotRows(m, blogsPerWeek, plan).reduce((t, r) => t + r.usd, 0) * 10000) / 10000;
}
