// Row shapes of the n8n Data Tables (columns defined once in n8n/seo-agent/ladder_common.py). Every row also carries the
// Data Table's own `id`, `createdAt` and `updatedAt`. JSON columns (`*_json`) are strings in n8n; the server parses them.

export interface DtRow {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface LadderRow extends DtRow {
  ladder_id: string; domain: string; head_keyword: string; rung: number; page_no: number; keyword: string; supporting: string;
  page_type: string; target_url: string; page_exists: boolean; status: string; months: string; start_date: string; country: string;
  location_code: number; language_code: string; email: string; callback_url: string; request_id: string;
}
export interface RankHistoryRow extends DtRow {
  /** ladder id, or the site id for Site Tracker live checks */
  ladder_id: string; keyword: string; checked_at: string;
  /** 0 = not in the top 50, -1 = the check failed (check again) */
  position: number; url: string; serp_features: string; domain: string; rung: number;
}
export interface SiteRow extends DtRow {
  site_id: string; domain: string; gsc_property: string; ga4_property_id: string; country: string; location_code: number;
  language_code: string; email: string; callback_url: string; keywords: string; status: string; source: string; created_at: string;
  last_run_at: string; last_status: string; request_id: string;
}
export interface SiteMetricsRow extends DtRow {
  site_id: string; domain: string; period_start: string; period_end: string; checked_at: string; gsc_connected: boolean;
  ga4_connected: boolean; clicks: number; impressions: number; ctr: number; position: number; prev_clicks: number;
  prev_impressions: number; prev_ctr: number; prev_position: number; yoy_clicks: number; yoy_impressions: number; sessions: number;
  engaged_sessions: number; key_events: number; prev_sessions: number; prev_engaged_sessions: number; prev_key_events: number;
  organic_share: number; queries: number; striking: number; alerts: string;
}
export interface QueryRow extends DtRow {
  site_id: string; domain: string; period_end: string; checked_at: string; query: string; clicks: number; impressions: number;
  ctr: number; position: number; prev_clicks: number; prev_impressions: number; prev_position: number; page: string;
  tracked: boolean; serp_position: number;
}
export interface ContentLogRow extends DtRow {
  site_id: string; domain: string; keyword: string; source: string; page_type: string; existing_page_url: string; rung: number;
  ladder_id: string; request_id: string; started_at: string; status: string; published_url: string; published_at: string; week: string;
}
export interface TrendRow extends DtRow {
  site_id: string; domain: string; keyword: string; checked_at: string; period_end: string; direction: string; change_pct: number;
  peak_date: string; latest: number; average: number; rising: string; top: string;
}
export interface CadenceRow extends DtRow {
  site_id: string; domain: string; pages_per_week: number; status: string; updated_at: string; request_id: string;
}
export interface ConsoleAlertRow extends DtRow {
  site_id: string; domain: string; kind: string; severity: string; subject: string; summary: string; received_at: string;
  message_id: string; status: string; source: string;
}
export interface CheckinRow extends DtRow {
  site_id: string; domain: string; month: string; manual_action: boolean; security_issue: boolean; notes: string;
  coverage_json: string; not_indexed_total: number; csv_kind: string; submitted_at: string; source: string; request_id: string;
}
export interface ProfileRow extends DtRow {
  site_id: string; domain: string; business_name: string; business_type: string; logo_url: string; street_address: string;
  city: string; region: string; postal_code: string; country_code: string; phone: string; public_email: string;
  opening_hours: string; price_range: string; service_areas: string; map_url: string; author_name: string;
  author_job_title: string; author_credentials: string; author_bio: string; author_url: string; author_image_url: string;
  author_same_as: string; author_knows_about: string; reviewer_name: string; reviewer_job_title: string; reviewer_url: string;
  updated_at: string; request_id: string;
}
export interface CaseStudyRow extends DtRow {
  case_id: string; site_id: string; domain: string; keyword: string; title: string; client_name: string; client_public: boolean;
  industry: string; location: string; service: string; challenge: string; solution: string; timeline: string; results: string;
  quote: string; quote_by: string; page_url: string; status: string; created_at: string; request_id: string;
}
export interface MonitorsRow extends DtRow {
  site_id: string; domain: string; ai_visibility: boolean; ai_engines: string; ai_prompts_max: number; backlinks: boolean;
  audit_monthly: boolean; audit_pages: number; audit_js: boolean; competitors: string; brand_names: string; updated_at: string;
  request_id: string;
}
export interface AiPromptRow extends DtRow {
  prompt_id: string; site_id: string; domain: string; prompt: string; kind: string; topic: string; keyword: string;
  source: string; status: string; created_at: string;
}
export interface AiAnswerRow extends DtRow {
  site_id: string; domain: string; run_id: string; checked_at: string; prompt_id: string; prompt: string; kind: string;
  topic: string; engine: string; answered: boolean; mentioned: boolean; cited: boolean; rank: number; our_urls: string;
  competitors: string; sources: string; excerpt: string; cost: number; error: string;
}
export interface AiVisibilityRow extends DtRow {
  site_id: string; domain: string; run_id: string; checked_at: string; prompts: number; answers: number; mention_rate: number;
  citation_rate: number; share_of_voice: number; avg_rank: number; aio_presence: number; aio_citation_rate: number;
  engines_json: string; competitors_json: string; sources_json: string; pages_json: string; gaps_json: string;
  market_json: string; market_month: string; cost_usd: number; alerts: string;
}
export interface BacklinkSnapshotRow extends DtRow {
  site_id: string; domain: string; checked_at: string; mode: string; rank: number; backlinks: number; referring_domains: number;
  referring_domains_nofollow: number; spam_score: number; broken_backlinks: number; new_links: number; lost_links: number;
  important_lost: number; spammy_new: number; lost_json: string; new_json: string; competitors_json: string;
  timeseries_json: string; cost_usd: number;
}
export interface ProspectRow extends DtRow {
  site_id: string; domain: string; prospect_domain: string; type: string; rank: number; spam_score: number; detail: string;
  source_url: string; target_url: string; status: string; first_seen: string; last_seen: string; won_at: string;
  outreach_subject: string; outreach_body: string; note: string;
}
export interface AuditRow extends DtRow {
  site_id: string; domain: string; audit_id: string; audited_at: string; report_type: string; health_score: number; grade: string;
  pages_crawled: number; findings: number; critical: number; high: number; medium: number; low: number; scheduled: boolean;
  request_id: string;
}
export interface AuditFindingRow extends DtRow {
  site_id: string; domain: string; audit_id: string; audited_at: string; finding_key: string; category: string; severity: string;
  title: string; affected_count: number;
}

/** v4.8 (PIPELINE_FEATURE_SPEC.md §9.1): one row per keyword ladder; the row with ladder_id '_site' holds the website's defaults
 * (mode = default mode for new ladders, opportunities, auto_start, max_active, max_waiting). Created by n8n in Phase 2: until then
 * every ladder is Auto, active, in start-date order. */
export interface LadderSettingsRow extends DtRow {
  ladder_id: string; site_id: string; domain: string; head_keyword: string; mode: string; priority: number; status: string;
  plan_type: string; reach: number; source: string; opportunities: string; auto_start: boolean; max_active: number;
  max_waiting: number; created_at: string; updated_at: string;
}

/** seo_ladder_settings exactly as n8n reads it (Cadence_Plan.js): the app creates the table with these columns when it is missing. */
export const LADDER_SETTINGS_COLUMNS = [
  { name: 'ladder_id', type: 'string' },
  { name: 'site_id', type: 'string' },
  { name: 'domain', type: 'string' },
  { name: 'head_keyword', type: 'string' },
  { name: 'mode', type: 'string' },
  { name: 'priority', type: 'number' },
  { name: 'status', type: 'string' },
  { name: 'plan_type', type: 'string' },
  { name: 'reach', type: 'number' },
  { name: 'source', type: 'string' },
  { name: 'opportunities', type: 'string' },
  { name: 'auto_start', type: 'boolean' },
  { name: 'max_active', type: 'number' },
  { name: 'max_waiting', type: 'number' },
  { name: 'created_at', type: 'string' },
  { name: 'updated_at', type: 'string' },
] as const;
export type LadderSettingsColumn = (typeof LADDER_SETTINGS_COLUMNS)[number]['name'];
/** the settings row that holds the website's defaults */
export const LADDER_SITE_ROW = '_site';

export const TABLES = {
  ladders: 'seo_ladders',
  rankHistory: 'seo_rank_history',
  sites: 'seo_sites',
  siteMetrics: 'seo_site_metrics',
  queryHistory: 'seo_query_history',
  contentLog: 'seo_content_log',
  trends: 'seo_trends',
  cadence: 'seo_cadence',
  consoleAlerts: 'seo_console_alerts',
  checkins: 'seo_console_checkins',
  profiles: 'seo_profiles',
  caseStudies: 'seo_case_studies',
  monitors: 'seo_monitors',
  aiPrompts: 'seo_ai_prompts',
  aiAnswers: 'seo_ai_answers',
  aiVisibility: 'seo_ai_visibility',
  backlinkSnapshots: 'seo_backlink_snapshots',
  prospects: 'seo_link_prospects',
  audits: 'seo_audits',
  auditFindings: 'seo_audit_findings',
  ladderSettings: 'seo_ladder_settings',
} as const;
export type TableKey = keyof typeof TABLES;
