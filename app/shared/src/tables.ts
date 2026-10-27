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
  /** R34 (A4, 2026-10-16): why a row is `live (existing page)` and the page that covers it; the planned address it would have had */
  status_note?: string; covered_by?: string; planned_url?: string;
  /** F-KW (2026-10-20): who chose this ladder's keyword, written by the ladder run on every row before its settings row ('' = before the column) */
  chosen_by?: string;
  /** the word count the ladder's verdict set for this page (0 = unknown); passed to a page run as `ladder_words` (P2-7) */
  target_words?: number;
}
export interface RankHistoryRow extends DtRow {
  /** ladder id, or the site id for Site Tracker live checks */
  ladder_id: string; keyword: string; checked_at: string;
  /** 0 = not in the top 50, -1 = the check failed (check again) */
  position: number; url: string; serp_features: string; domain: string; rung: number;
  /** G6: everything else the same SERP call showed. Rows written before G6 have none of it (device '' = desktop). */
  device?: string;
  /** JSON (v5/code/_rank_serp.js): AI Overview (shown / cites us / sources loaded), snippet, People Also Ask, local pack, video, shopping */
  features_json?: string;
  /** JSON: the top-10 domains with positions, who is above us, the tracked competitors' positions and the modelled shares */
  competitors_json?: string;
  /** JSON: the top 10 with URLs and trimmed titles, kept as proof of the reading */
  snapshot_json?: string;
  /** our modelled share of the clicks page 1 offers; -1 = the check failed */
  share_of_voice?: number;
}
export interface SiteRow extends DtRow {
  site_id: string; domain: string; gsc_property: string; ga4_property_id: string; country: string; location_code: number;
  language_code: string; email: string; callback_url: string; keywords: string; status: string; source: string; created_at: string;
  last_run_at: string; last_status: string; request_id: string;
  /** B7-5 (W3-D): [{ name, pattern }] as JSON text, set through Site Admin `content_groups` */
  content_groups_json?: string;
  /** G19 site model (2026-10-12): the services the weekly crawl read (JSON list), the competitors (comma list) */
  services_json?: string; competitors?: string; brand_names?: string; canonical_host?: string;
  /** keyword-first (2026-10-19): what the client said they sell ("What do you sell?"), JSON list; never overwritten by a crawl */
  declared_services?: string;
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
  /** R111 (2026-10-16): for status `not_ready` (the last quality round failed), the QA reasons, '; '-joined */
  qa_reasons?: string;
  /** 2026-10-27: why the page was marked published although the live page did not match the draft (the owner confirmed it); '' otherwise */
  publish_note?: string;
}
export interface TrendRow extends DtRow {
  site_id: string; domain: string; keyword: string; checked_at: string; period_end: string; direction: string; change_pct: number;
  peak_date: string; latest: number; average: number; rising: string; top: string;
}
/** v4.15 (D11, SITE_MODEL_SPEC.md): the website's page inventory, written weekly by the Site Tracker, what the site already has */
export interface SitePageRow extends DtRow {
  site_id: string; url: string; title: string; h1: string; source: string; lastmod: string; queries_json: string; updated_at: string;
  /**
   * v4.16 (B4-1 / B4-2, benchmark area 4): the page's own Search Console measurement and the decay judgement made of it.
   * `decay_state` is one of decaying / seasonal / watch / steady / too_small (empty = never measured); `decay_basis` is the
   * sentence that must travel with the number. The cadence writes a refresh only for `decaying`.
   */
  clicks?: number; impressions?: number; position?: number; prev_clicks?: number; yoy_clicks?: number;
  decay_state?: string; decay_pct?: number; decay_lost?: number; decay_kind?: string; decay_basis?: string; measured_at?: string;
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
  /** G31: the stored style guide, the brand's written form, wrong forms to catch, the spelling variant, words to avoid, the tone, other rules */
  style_brand_form: string; style_legal_name?: string; style_brand_wrong: string; style_spelling: string; style_avoid: string; style_tone: string; style_notes: string;
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
  /** v4.9: the daily AI Pulse (empty = on) */
  ai_pulse: boolean;
  /** v4.12: the weekly AI growth loop (empty = on) and AI answer / refresh pages a month (empty = 2) */
  ai_growth: boolean | null; ai_pages_month: number | null;
  /** v4.13 (empty = on) */
  link_builder: boolean | null;
  /** G6 (2026-10-18): buyer roles and extra markets (CC-lang) the panel covers; the pulse's sampling ('' auto | sample | full) and mornings a week (empty = auto) */
  ai_personas?: string; ai_markets?: string; ai_pulse_mode?: string; ai_pulse_per_week?: number | null;
  /** AI-FOCUS (2026-10-27): what the daily pulse asks (focus | all | '' = all) and whether the questions follow the focus ('off' | '') */
  ai_pulse_scope?: string; ai_focus_mode?: string;
  /** W2 (WAVE2_CONTRACTS.md §4; absent before the engine adds them): weekly Claude, pulse engines, persona context, fan-out check N, share-of-voice set, owner alert rules (JSON) */
  ai_claude_weekly?: boolean | null; ai_pulse_engines?: string; ai_persona_context?: boolean | null; ai_fanout_check?: number | null; ai_sov_set?: string; ai_alert_rules_json?: string;
  /** W2-E3: the monthly market trend (empty = off) */
  ai_demand_market?: boolean | null;
}
export interface AiPromptRow extends DtRow {
  prompt_id: string; site_id: string; domain: string; prompt: string; kind: string; topic: string; keyword: string;
  source: string; status: string; created_at: string;
  /** v4.9: buyer stage, topic cluster, monthly AI search volume (null = not looked up yet), where the question came from */
  stage: string; cluster: string; volume: number | null; origin: string; updated_at: string;
  /** G6 (2026-10-18): buyer role, market (CC-lang), pinned by the owner, and the fit gate's sentence when status is 'refused' */
  persona?: string; market?: string; pinned?: boolean | null; fit_note?: string;
  /** W2 §3: the run that last asked it, when, how often in 28 days, the run whose gate refused it; F2: where the keyword came from */
  last_asked_run?: string; last_asked_at?: string; asked_n_28d?: number | null; refused_at_run?: string; keyword_source?: string;
  /** AI-FOCUS (2026-10-27): the focus topic it measures, where it came from, its state, when last in focus; when and why it was retired */
  focus_topic?: string; focus_source?: string; focus_state?: string; focus_seen_at?: string; retired_at?: string; retire_reason?: string;
}
/**
 * R-A7 (review 2026-10-23): the `origin` of a question the owner deleted. Its row stays as a tombstone with status `off`, so the engine
 * never writes or asks it again; the app hides it everywhere.
 */
export const AI_PROMPT_DELETED = 'deleted';
export const aiPromptDeleted = (p: { origin?: unknown }): boolean => String(p?.origin ?? '') === AI_PROMPT_DELETED;
export interface AiAnswerRow extends DtRow {
  site_id: string; domain: string; run_id: string; checked_at: string; prompt_id: string; prompt: string; kind: string;
  topic: string; engine: string; answered: boolean; mentioned: boolean; cited: boolean; rank: number; our_urls: string;
  competitors: string; sources: string; excerpt: string; cost: number; error: string;
  /** v4.9: weekly | full | pulse | on_demand; sentiment toward the business; brands named in order; wrong claims ("claim -> fact" | ...); the searches the engine ran (" | ") */
  run_kind: string; sentiment: string; brands: string; issues: string; fanout: string;
  /** v4.12: the exact third-party pages cited (JSON [{u, t}]) */
  cited_urls: string;
  /** 2026-10-23 engine contract (absent on older rows): the name as named, the URL cited, the 1-based place named, every entity (JSON) */
  named?: string; position?: number | null; entities?: string;
  /** W2 §1 (absent on older rows): the whole answer, every citation in order, retrieved-not-cited pages, fan-out, product / ad / local cards, the model */
  answer_text?: string; cited_json?: string; retrieved_json?: string; fanout_json?: string; products_json?: string; ads_json?: string; local_json?: string; model?: string; detail_json?: string;
}
export interface AiVisibilityRow extends DtRow {
  site_id: string; domain: string; run_id: string; checked_at: string; prompts: number; answers: number; mention_rate: number;
  citation_rate: number; share_of_voice: number; avg_rank: number; aio_presence: number; aio_citation_rate: number;
  engines_json: string; competitors_json: string; sources_json: string; pages_json: string; gaps_json: string;
  market_json: string; market_month: string; cost_usd: number; alerts: string;
  /** v4.9 (n8n/seo-agent/AI_VISIBILITY_SPEC.md): 7-day figures incl. the daily pulse, 95% range, score, perception, GA4, crawler access, database index */
  run_kind: string; samples: number; visibility_score: number; mention_lo: number; mention_hi: number; sentiment_score: number | null;
  accuracy_issues: number; ai_sessions: number | null; ai_conversions: number | null; ai_revenue: number | null; index_sov: number | null;
  ai_impressions: number | null; perception_json: string; traffic_json: string; access_json: string; index_json: string; clusters_json: string;
  /** G6 (2026-10-18): rates per engine x cluster x buyer role x market x stage (compact: one array per segment), the panel asked, the executions it took */
  segments_json?: string; panel_json?: string; chunks?: number | null;
  /** 2026-10-23 (APP_AUDIT.md A1 / A8): the engine's comparison with the previous run and the period counted (JSON; absent on older rows) */
  compare_json?: string;
  /** W2 §2 (absent on older rows; an absent block keeps today's view) */
  urls_json?: string; shopping_json?: string; ads_local_json?: string; ci_json?: string; sov_json?: string; sentiment_json?: string; impact_json?: string;
  alerts_rules_json?: string; fanout_gap_json?: string; demand_json?: string; imports_json?: string; exec_ids?: string; notes_json?: string;
}
/** W2 §5: the owner's Bing AI Performance / Search Console AI uploads, written by the app, read by the engine */
export interface AiImportRow extends DtRow {
  site_id: string; domain: string; source: string; day: string; url: string; query: string; impressions: number; citations: number; clicks: number;
  file_name: string; imported_at: string; import_id: string;
}
/** v4.12 (n8n/seo-agent/AI_GROWTH_SPEC.md): the AI growth loop's key pages, can AI read and quote them, Bing's crawl, submission */
export interface AiPageRow extends DtRow {
  site_id: string; domain: string; url: string; kind: string; checked_at: string; status: number; score: number | null; checks_json: string; issues: string;
  words_raw: number; title: string; updated_on: string; bing_crawled_at: string; bing_status: number; submitted_at: string; submitted_via: string; cited_by: string; questions: string;
}
/** v4.12: the questions to win in AI answers (a new answer page or a refresh), written by the content run; queued -> writing -> won (or skipped) */
export interface AiTargetRow extends DtRow {
  target_id: string; site_id: string; domain: string; prompt_id: string; question: string; keyword: string; kind: string; page_url: string; page_type: string;
  fanout: string; sources_json: string; competitors: string; engines: string; stage: string; value: number; status: string; reason: string;
  created_at: string; updated_at: string; request_id: string; written_at: string; won_at: string;
}
/** v4.12: one row per site and weekly AI growth run */
export interface AiGrowthRow extends DtRow {
  site_id: string; domain: string; run_id: string; checked_at: string; submitted: number; submitted_json: string; indexnow: string; pages_checked: number; avg_score: number | null;
  pages_json: string; targets_json: string; earned_json: string; entity_json: string; actions_json: string; alerts: string; cost_usd: number;
}
/** v4.9: one row per site and day from the AI Pulse (counts only, no answer text) */
export interface AiDailyRow extends DtRow {
  site_id: string; domain: string; date: string; checked_at: string; run_id: string; samples: number; mentioned: number; cited: number;
  mention_rate: number; citation_rate: number; share_of_voice: number; visibility_score: number; engines_json: string; prompts_json: string;
  competitors_json: string; sources_json: string; alerts: string; cost_usd: number;
  /** G6 (2026-10-18): the morning's rotating sample (mode, N a week, questions asked of the panel, strata covered) */
  sample_json?: string;
  /** 2026-10-23 (APP_AUDIT.md A7): full | sample, questions asked that morning, engines that answered, a morning an engine returned nothing */
  sample_mode?: string; questions_asked?: number | null; engines_answered?: string; partial?: boolean | null; rule_version?: string;
}
export interface BacklinkSnapshotRow extends DtRow {
  site_id: string; domain: string; checked_at: string; mode: string; rank: number; backlinks: number; referring_domains: number;
  referring_domains_nofollow: number; spam_score: number; broken_backlinks: number; new_links: number; lost_links: number;
  important_lost: number; spammy_new: number; lost_json: string; new_json: string; competitors_json: string;
  timeseries_json: string; cost_usd: number;
  /** v4.10 (n8n/seo-agent/BACKLINKS_SPEC.md): every source merged + the link check */
  union_domains: number | null; best_links: number | null; verified_live: number | null; at_risk: number | null; confirmed_lost: number | null;
  referral_visits: number | null; referral_key_events: number | null; coverage_json: string; anchors_json: string; pages_json: string; values_json: string;
}
export interface ProspectRow extends DtRow {
  site_id: string; domain: string; prospect_domain: string; type: string; rank: number; spam_score: number; detail: string;
  source_url: string; target_url: string; status: string; first_seen: string; last_seen: string; won_at: string;
  outreach_subject: string; outreach_body: string; note: string;
  /** v4.10: value x likelihood, where it came from, a contact found on the site, follow-up drafts, won only after the link was found */
  score: number | null; origin: string; contact_email: string; contact_url: string; contacted_at: string; followup_step: number | null;
  followup_subject: string; followup_body: string; verified_at: string;
  /** P34-1 (2026-10-12): when the stored draft was written. Empty, or before DRAFT_GATES_AT, means it was written without the current
   *  outreach gates: it is superseded and must not be offered (see prospectDraft in ./outreach). */
  drafted_at: string;
}
/** v4.10: the link ledger, one row per site and referring site, merged from every source and checked on the linking page */
export interface BacklinkRow extends DtRow {
  site_id: string; domain: string; ref_domain: string; kind: string; from_url: string; to_url: string; anchor: string; anchor_kind: string;
  rel: string; placement: string; link_type: string; relevance: number | null; note: string; sources: string; source_count: number;
  first_seen: string; last_seen: string; status: string; lost_at: string; lost_reason: string; miss_count: number;
  verify: string; verified_at: string; noindex: boolean; canonical_elsewhere: boolean; outbound: number; page_title: string; context: string;
  authority: number; dr: number; cc_rank: number; page_keywords: number; spam_score: number; original: boolean; sitewide: number; links: number;
  visits: number; key_events: number; ai_cited: boolean; seo_value: number; referral_value: number; brand_value: number; updated_at: string;
}
/** v4.10: links the person uploads (Search Console Links exports); the Backlink Monitor merges the latest upload per source */
export interface LinkImportRow extends DtRow {
  site_id: string; domain: string; import_id: string; source: string; ref_domain: string; from_url: string; to_url: string; anchor: string;
  links: number; last_crawled: string; imported_at: string;
}
/** seo_link_imports exactly as n8n reads it (Link_Merge.js; ladder_common.py LINK_IMPORTS_COLS): the app creates it when missing. */
export const LINK_IMPORT_COLUMNS = [
  { name: 'site_id', type: 'string' },
  { name: 'domain', type: 'string' },
  { name: 'import_id', type: 'string' },
  { name: 'source', type: 'string' },
  { name: 'ref_domain', type: 'string' },
  { name: 'from_url', type: 'string' },
  { name: 'to_url', type: 'string' },
  { name: 'anchor', type: 'string' },
  { name: 'links', type: 'number' },
  { name: 'last_crawled', type: 'string' },
  { name: 'imported_at', type: 'string' },
] as const;
/** v4.10: the Common Crawl web graph per site (the linkgraph job): referring domains, the competitor gap, authority ranks */
export interface LinkGraphRow extends DtRow {
  site_id: string; domain: string; release: string; kind: string; ref_domain: string; hc_pos: number; pr_pos: number; n_hosts: number;
  links_to: string; checked_at: string;
}
export interface AuditRow extends DtRow {
  site_id: string; domain: string; audit_id: string; audited_at: string; report_type: string; health_score: number; grade: string;
  pages_crawled: number; findings: number; critical: number; high: number; medium: number; low: number; scheduled: boolean;
  request_id: string;
  /** B-5 + INVARIANTS rule 1 (F-B, 2026-10-17): whether the crawl ran JavaScript, the version of the engine's checks, and the keys of the
   * previous audit's findings the engine did NOT count as fixed (a check changed, one outside reading, a JavaScript / plain crawl), as JSON
   * text `[{ key, why }]`. Rows written before have none. */
  crawl_js?: boolean | null; checks_version?: string | null; not_fixed_json?: string | null;
}
/** B-5: the previous audit's finding keys the engine did not count as fixed, with the reason (empty for rows that carry none) */
export function notFixedKeys(row: { not_fixed_json?: unknown } | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const raw = row?.not_fixed_json;
  if (typeof raw !== 'string' || !raw.trim()) return out;
  try {
    const list: unknown = JSON.parse(raw);
    if (Array.isArray(list)) for (const x of list) if (x && typeof x === 'object' && typeof (x as { key?: unknown }).key === 'string') out.set((x as { key: string }).key, String((x as { why?: unknown }).why ?? ''));
  } catch { /* a malformed value is no decision */ }
  return out;
}
export interface AuditFindingRow extends DtRow {
  site_id: string; domain: string; audit_id: string; audited_at: string; finding_key: string; category: string; severity: string;
  title: string; affected_count: number;
  /** G11 (2026-10-13, FIX_PLAN): "I fixed this" sets recheck_state to `requested`; the next daily key-page watch answers it
   * (`fixed` / `still_open` / `not_checked`) with the rule it used and one sentence of evidence. Rows written before this have none. */
  recheck_state?: string; recheck_requested_at?: string; recheck_at?: string; recheck_rule?: string; recheck_note?: string;
  /** G26 (2026-10-12, FIX_PLAN): the impact weight the audit ordered its fix list by (severity x pages affected x the Search Console
   * clicks and impressions of those pages x their place in the site) and the one line that explains it. Rows written before this
   * change have neither, so every reader falls back to the severity order. */
  impact?: number; impact_basis?: string;
  /** R19: the pages the count was measured on (0 / missing on rows before it was stored) */
  checked?: number;
  /** B5-11 (v4.18): the engine's evidence line and up to 5 example addresses (a JSON array as text); rows written before have neither */
  evidence?: string; sample_urls?: string;
}

/** v4.8 (PIPELINE_FEATURE_SPEC.md §9.1): one row per keyword ladder; the row with ladder_id '_site' holds the website's defaults
 * (mode = default mode for new ladders, opportunities, auto_start, max_active, max_waiting). Created by n8n in Phase 2: until then
 * every ladder is Auto, active, in start-date order. */
export interface LadderSettingsRow extends DtRow {
  ladder_id: string; site_id: string; domain: string; head_keyword: string; mode: string; priority: number; status: string;
  plan_type: string; reach: number; source: string; opportunities: string; auto_start: boolean; max_active: number;
  max_waiting: number; created_at: string; updated_at: string;
  /** keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1): who chose a ladder's keyword (client_typed | client_picked |
   * system_announced; '' = a ladder from before the column, or one started through the API = the client) */
  chosen_by?: string;
  /** the '_site' row only: the website's autopilot level (1 | 2 | 3; empty = 2) */
  autopilot_level?: number | string | null;
  /** F-KW (2026-10-20, plan §5.6): when the app's fresh keyword check of a ladder planned 60+ days ago PASSED (ISO); the cadence writes no
   * page of such a ladder until it is set. Written by the app (autopilot.ts recheckActivated). */
  rechecked_at?: string;
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
  { name: 'chosen_by', type: 'string' },
  { name: 'autopilot_level', type: 'number' },
  { name: 'rechecked_at', type: 'string' },
] as const;
export type LadderSettingsColumn = (typeof LADDER_SETTINGS_COLUMNS)[number]['name'];
/** the settings row that holds the website's defaults */
export const LADDER_SITE_ROW = '_site';

/** G11 + G25 (2026-10-13, FIX_PLAN): the daily key-page watch (`SEO Agent, Page Watch`, every morning) and the weekly URL Inspection
 * rotation write one row per site and key page. `state`: ok | changed | not_checked; `changes`: the change codes of the last reading;
 * `indexed`: 'yes' | 'no' | '' (empty = Google was not asked, or the answer failed, never "fine"); `mobile`: 'pass' | 'fail' | ''. */
export interface PageWatchRow extends DtRow {
  site_id: string; domain: string; url: string; kind: string; weight: number; checked_at: string;
  status: number; location: string; noindex: boolean; noindex_source: string; canonical: string; canonical_ok: boolean;
  title: string; title_hash: string; titles: number; description: string; h1: string; h1s: number;
  robots_blocked: boolean; robots_hash: string; state: string; changes: string; last_change_at: string; changed_count: number; error: string;
  inspect_at: string; index_state: string; indexed: string; coverage: string; google_canonical: string; last_crawl: string;
  mobile: string; rich_results: string; inspect_error: string;
}

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
  pages: 'seo_pages',
  caseStudies: 'seo_case_studies',
  monitors: 'seo_monitors',
  aiPrompts: 'seo_ai_prompts',
  aiAnswers: 'seo_ai_answers',
  aiVisibility: 'seo_ai_visibility',
  aiDaily: 'seo_ai_daily',
  aiPages: 'seo_ai_pages',
  aiTargets: 'seo_ai_targets',
  aiGrowth: 'seo_ai_growth',
  /** W2 §5 (2026-10-23): the owner's AI report uploads (Bing AI Performance, Search Console AI features), written by the app */
  aiImports: 'seo_ai_imports',
  backlinkSnapshots: 'seo_backlink_snapshots',
  prospects: 'seo_link_prospects',
  backlinks: 'seo_backlinks',
  linkImports: 'seo_link_imports',
  linkGraph: 'seo_link_graph',
  audits: 'seo_audits',
  auditFindings: 'seo_audit_findings',
  /** G11 + G25 (2026-10-13): one row per site and key page, the daily raw watch and what Search Console's URL Inspection said about it */
  pageWatch: 'seo_page_watch',
  ladderSettings: 'seo_ladder_settings',
  /** D25b + R6 (2026-10-12/13): every ops alert, with the channel that carried it, what G21's alert delivery rate is measured from */
  opsAlerts: 'seo_ops_alerts',
  /** D1 + R9 + G23: one row per run, with its reservation and what it settled (which part measured, which estimated) */
  runLedger: 'seo_run_ledger',
  /** v4.13 Link Builder */
  linkOutreach: 'seo_link_outreach',
  listings: 'seo_listings',
  linkImpact: 'seo_link_impact',
  /** the engine's key/value store; the app reads its `cost:*` rows (the rolling per-mode figures the engine reserves, R100) and the
   * `ai_brands:<site_id>` rows (the names AI uses for other companies, for the cadence mirror's fit gate) */
  cache: 'seo_cache',
  /** keyword-first / the per-website cycle (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §14.1): one row per website, written by the engine */
  cycles: 'seo_cycles',
  /** one row per website x cycle x job, written by the Cycle Dispatcher (record-then-start, then the outcome) */
  cycleJobs: 'seo_cycle_jobs',
  /** the client's decisions on the "Coming up" plan: written by the app, read by the Content Cadence */
  skips: 'seo_skips',
} as const;
export type TableKey = keyof typeof TABLES;

/** seo_skips exactly as the engine creates it (ladder_common.py SKIPS_COLS): the app creates the table with these columns when it is missing. */
export const SKIPS_COLUMNS = [
  { name: 'key', type: 'string' },
  { name: 'site_id', type: 'string' },
  { name: 'cycle_key', type: 'string' },
  { name: 'item_key', type: 'string' },
  { name: 'decision', type: 'string' },
  { name: 'scope', type: 'string' },
  { name: 'by', type: 'string' },
  { name: 'created_at', type: 'string' },
  // F-KW (2026-10-20): the item an approval is for (the plan item's source and ladder), so it never approves another page with the keyword
  { name: 'source', type: 'string' },
  { name: 'ladder_id', type: 'string' },
] as const;
