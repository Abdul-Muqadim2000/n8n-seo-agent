import { estimateAiPanelCost } from './ai-panel';
import { estimateAiGrowthCost, estimateAiVisibilityCost, MONITOR_COSTS } from './constants';
import type { MonitorSettings } from './schemas';

// What a website's schedules (its "autopilot") use a month, row by row — one function for the settings card the customer sees, the
// Credits page's forecast and the server's reserve for the schedules (app/docs/CREDITS.md), so the three never disagree. Amounts are the
// provider cost in USD; screens turn them into credits with the company's credit rate.

export type AutopilotRowId = 'site_report' | 'ai_visibility' | 'ai_pulse' | 'ai_growth' | 'backlinks' | 'link_builder' | 'audit' | 'blog_posts';

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
>;

export function autopilotRows(m: Monitors, blogsPerWeek: number): AutopilotRow[] {
  const c = MONITOR_COSTS;
  const ai = estimateAiVisibilityCost({ prompts: m.aiPromptsMax, engines: m.aiEngines, pulse: m.aiPulse, pulseMode: m.aiPulseMode, pulsePerWeek: m.aiPulsePerWeek });
  const panel = estimateAiPanelCost({ panel: m.aiPromptsMax, engines: m.aiEngines, pulse: m.aiPulse, pulseMode: m.aiPulseMode, pulsePerWeek: m.aiPulsePerWeek });
  const growth = estimateAiGrowthCost({ pages: m.aiPagesPerMonth, growth: m.aiGrowth });
  const posts = Math.max(0, blogsPerWeek || 0);
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
      detail: `${m.aiPagesPerMonth} AI answer page${m.aiPagesPerMonth === 1 ? '' : 's'} a month, outreach drafts; Bing / IndexNow and page checks free`,
      on: m.aiVisibility && m.aiGrowth,
      usd: growth.total,
    },
    { id: 'backlinks', label: 'Backlink monitor', detail: 'weekly watch, monthly full report', on: m.backlinks, usd: c.backlinksMonthly },
    { id: 'link_builder', label: 'Link builder', detail: 'up to 10 drafted sequences a week; opportunity search, contacts and checks free', on: m.linkBuilder, usd: c.linkBuilderMonthly },
    { id: 'audit', label: 'Monthly technical audit', detail: `up to ${m.auditPages} pages`, on: m.auditMonthly, usd: c.auditMonthly },
    { id: 'blog_posts', label: 'Blog posts', detail: posts ? `${posts} a week, about ${c.weeksPerMonth} weeks a month` : 'none', on: posts > 0, usd: posts * c.weeksPerMonth * c.blogPostEach },
  ];
  return rows.map((r) => ({ ...r, usd: r.on ? Math.round(r.usd * 10000) / 10000 : 0 }));
}

/** The month's total (provider cost, USD) of the rows that are on. */
export function autopilotMonthlyUsd(m: Monitors, blogsPerWeek: number): number {
  return Math.round(autopilotRows(m, blogsPerWeek).reduce((t, r) => t + r.usd, 0) * 10000) / 10000;
}
