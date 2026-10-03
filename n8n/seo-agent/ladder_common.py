"""Shared definitions for the keyword-ladder feature (used by build_v4.py and build_ladder_extras.py)."""
LADDER_TABLE = 'seo_ladders'
HISTORY_TABLE = 'seo_rank_history'
LADDER_COLS = [('ladder_id', 'string'), ('domain', 'string'), ('head_keyword', 'string'), ('rung', 'number'), ('page_no', 'number'), ('keyword', 'string'),
               ('supporting', 'string'), ('page_type', 'string'), ('target_url', 'string'), ('page_exists', 'boolean'), ('status', 'string'), ('months', 'string'),
               ('start_date', 'string'), ('country', 'string'), ('location_code', 'number'), ('language_code', 'string'), ('email', 'string'), ('callback_url', 'string'), ('request_id', 'string')]
HISTORY_COLS = [('ladder_id', 'string'), ('keyword', 'string'), ('checked_at', 'string'), ('position', 'number'), ('url', 'string'), ('serp_features', 'string'), ('domain', 'string'), ('rung', 'number')]
DT_TYPE, DT_VERSION = 'n8n-nodes-base.dataTable', 1.1

def dt_schema(cols):
    return [{'id': c, 'displayName': c, 'required': False, 'defaultMatch': False, 'display': True, 'type': t, 'canBeUsedToMatch': True, 'removed': False} for c, t in cols]
def dt_create_params(table, cols):
    """Create the table if it does not exist (returns the existing one otherwise) — self-healing setup, no UI step."""
    return {'resource': 'table', 'operation': 'create', 'tableName': table, 'columns': {'column': [{'name': c, 'type': t} for c, t in cols]}, 'options': {'createIfNotExists': True}}
def dt_insert_params(table, cols):
    return {'resource': 'row', 'operation': 'insert', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table},
            'columns': {'mappingMode': 'autoMapInputData', 'value': None, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}
def dt_get_all_params(table):
    return {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'returnAll': True, 'options': {}}

# ---- site tracking (v4.3): Search Console + GA4 + Trends + SERP per registered site ----
SITES_TABLE = 'seo_sites'
METRICS_TABLE = 'seo_site_metrics'
QUERY_TABLE = 'seo_query_history'
SITES_COLS = [('site_id', 'string'), ('domain', 'string'), ('gsc_property', 'string'), ('ga4_property_id', 'string'), ('country', 'string'), ('location_code', 'number'),
              ('language_code', 'string'), ('email', 'string'), ('callback_url', 'string'), ('keywords', 'string'), ('status', 'string'), ('source', 'string'),
              ('created_at', 'string'), ('last_run_at', 'string'), ('last_status', 'string'), ('request_id', 'string')]
METRICS_COLS = [('site_id', 'string'), ('domain', 'string'), ('period_start', 'string'), ('period_end', 'string'), ('checked_at', 'string'), ('gsc_connected', 'boolean'), ('ga4_connected', 'boolean'),
                ('clicks', 'number'), ('impressions', 'number'), ('ctr', 'number'), ('position', 'number'), ('prev_clicks', 'number'), ('prev_impressions', 'number'), ('prev_ctr', 'number'), ('prev_position', 'number'),
                ('yoy_clicks', 'number'), ('yoy_impressions', 'number'), ('sessions', 'number'), ('engaged_sessions', 'number'), ('key_events', 'number'), ('prev_sessions', 'number'), ('prev_engaged_sessions', 'number'),
                ('prev_key_events', 'number'), ('organic_share', 'number'), ('queries', 'number'), ('striking', 'number'), ('alerts', 'string')]
QUERY_COLS = [('site_id', 'string'), ('domain', 'string'), ('period_end', 'string'), ('checked_at', 'string'), ('query', 'string'), ('clicks', 'number'), ('impressions', 'number'), ('ctr', 'number'),
              ('position', 'number'), ('prev_clicks', 'number'), ('prev_impressions', 'number'), ('prev_position', 'number'), ('page', 'string'), ('tracked', 'boolean'), ('serp_position', 'number')]

def dt_upsert_params(table, cols, key):
    """Insert or update the row whose `key` column equals the input's `key` field (all other columns auto-mapped)."""
    return {'resource': 'row', 'operation': 'upsert', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': key, 'condition': 'eq', 'keyValue': '={{ $json.' + key + ' }}'}]},
            'columns': {'mappingMode': 'autoMapInputData', 'value': None, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}
def dt_get_where_params(table, key, condition, value=None):
    """Get every row matching one condition (e.g. tracked isTrue)."""
    cond = {'keyName': key, 'condition': condition}
    if value is not None: cond['keyValue'] = value
    return {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'returnAll': True, 'matchType': 'allConditions', 'filters': {'conditions': [cond]}, 'options': {}}

# ---- content cadence + published-page feedback (v4.3) ----
LOG_TABLE = 'seo_content_log'
TRENDS_TABLE = 'seo_trends'
CADENCE_TABLE = 'seo_cadence'
LOG_COLS = [('site_id', 'string'), ('domain', 'string'), ('keyword', 'string'), ('source', 'string'), ('page_type', 'string'), ('existing_page_url', 'string'), ('rung', 'number'), ('ladder_id', 'string'),
            ('request_id', 'string'), ('started_at', 'string'), ('status', 'string'), ('published_url', 'string'), ('published_at', 'string'), ('week', 'string')]
TRENDS_COLS = [('site_id', 'string'), ('domain', 'string'), ('keyword', 'string'), ('checked_at', 'string'), ('period_end', 'string'), ('direction', 'string'), ('change_pct', 'number'), ('peak_date', 'string'),
               ('latest', 'number'), ('average', 'number'), ('rising', 'string'), ('top', 'string')]
CADENCE_COLS = [('site_id', 'string'), ('domain', 'string'), ('pages_per_week', 'number'), ('status', 'string'), ('updated_at', 'string'), ('request_id', 'string')]

def dt_upsert_params_keys(table, cols, keys):
    """Upsert matching on several columns (all must equal the input's fields)."""
    return {'resource': 'row', 'operation': 'upsert', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': k, 'condition': 'eq', 'keyValue': '={{ $json.' + k + ' }}'} for k in keys]},
            'columns': {'mappingMode': 'autoMapInputData', 'value': None, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}
def dt_update_params(table, cols, conditions, values):
    """Update the columns in `values` (col -> expression) on every row matching all `conditions` ((col, expression) pairs)."""
    return {'resource': 'row', 'operation': 'update', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': k, 'condition': 'eq', 'keyValue': v} for k, v in conditions]},
            'columns': {'mappingMode': 'defineBelow', 'value': values, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}

# ---- Search Console notices (mail watcher) and monthly check-ins (v4.3) ----
ALERTS_TABLE = 'seo_console_alerts'
CHECKIN_TABLE = 'seo_console_checkins'
ALERTS_COLS = [('site_id', 'string'), ('domain', 'string'), ('kind', 'string'), ('severity', 'string'), ('subject', 'string'), ('summary', 'string'), ('received_at', 'string'), ('message_id', 'string'), ('status', 'string'), ('source', 'string')]
CHECKIN_COLS = [('site_id', 'string'), ('domain', 'string'), ('month', 'string'), ('manual_action', 'boolean'), ('security_issue', 'boolean'), ('notes', 'string'), ('coverage_json', 'string'), ('not_indexed_total', 'number'), ('csv_kind', 'string'), ('submitted_at', 'string'), ('source', 'string'), ('request_id', 'string')]

# ---- E-E-A-T and page types (v4.4): one business profile per site (author, reviewer, address / NAP) and the case-study library ----
PROFILE_TABLE = 'seo_profiles'
CASE_TABLE = 'seo_case_studies'
PROFILE_COLS = [('site_id', 'string'), ('domain', 'string'), ('business_name', 'string'), ('business_type', 'string'), ('logo_url', 'string'), ('street_address', 'string'), ('city', 'string'),
                ('region', 'string'), ('postal_code', 'string'), ('country_code', 'string'), ('phone', 'string'), ('public_email', 'string'), ('opening_hours', 'string'), ('price_range', 'string'),
                ('service_areas', 'string'), ('map_url', 'string'), ('author_name', 'string'), ('author_job_title', 'string'), ('author_credentials', 'string'), ('author_bio', 'string'),
                ('author_url', 'string'), ('author_image_url', 'string'), ('author_same_as', 'string'), ('author_knows_about', 'string'), ('reviewer_name', 'string'), ('reviewer_job_title', 'string'),
                ('reviewer_url', 'string'), ('updated_at', 'string'), ('request_id', 'string')]
CASE_COLS = [('case_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('keyword', 'string'), ('title', 'string'), ('client_name', 'string'), ('client_public', 'boolean'), ('industry', 'string'),
             ('location', 'string'), ('service', 'string'), ('challenge', 'string'), ('solution', 'string'), ('timeline', 'string'), ('results', 'string'), ('quote', 'string'), ('quote_by', 'string'),
             ('page_url', 'string'), ('status', 'string'), ('created_at', 'string'), ('request_id', 'string')]

# ---- growth monitors (v4.5): per-site monitor settings, AI visibility, backlink loop, audit history ----
MONITORS_TABLE = 'seo_monitors'
AI_PROMPTS_TABLE = 'seo_ai_prompts'
AI_ANSWERS_TABLE = 'seo_ai_answers'
AI_VIS_TABLE = 'seo_ai_visibility'
BL_SNAP_TABLE = 'seo_backlink_snapshots'
PROSPECT_TABLE = 'seo_link_prospects'
AUDITS_TABLE = 'seo_audits'
AUDIT_FINDINGS_TABLE = 'seo_audit_findings'
MONITORS_COLS = [('site_id', 'string'), ('domain', 'string'), ('ai_visibility', 'boolean'), ('ai_engines', 'string'), ('ai_prompts_max', 'number'), ('backlinks', 'boolean'), ('audit_monthly', 'boolean'),
                 ('audit_pages', 'number'), ('audit_js', 'boolean'), ('competitors', 'string'), ('brand_names', 'string'), ('updated_at', 'string'), ('request_id', 'string')]
AI_PROMPTS_COLS = [('prompt_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('keyword', 'string'), ('source', 'string'), ('status', 'string'), ('created_at', 'string')]
AI_ANSWERS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompt_id', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('engine', 'string'),
                   ('answered', 'boolean'), ('mentioned', 'boolean'), ('cited', 'boolean'), ('rank', 'number'), ('our_urls', 'string'), ('competitors', 'string'), ('sources', 'string'), ('excerpt', 'string'), ('cost', 'number'), ('error', 'string')]
AI_VIS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompts', 'number'), ('answers', 'number'), ('mention_rate', 'number'), ('citation_rate', 'number'), ('share_of_voice', 'number'),
               ('avg_rank', 'number'), ('aio_presence', 'number'), ('aio_citation_rate', 'number'), ('engines_json', 'string'), ('competitors_json', 'string'), ('sources_json', 'string'), ('pages_json', 'string'), ('gaps_json', 'string'),
               ('market_json', 'string'), ('market_month', 'string'), ('cost_usd', 'number'), ('alerts', 'string')]
BL_SNAP_COLS = [('site_id', 'string'), ('domain', 'string'), ('checked_at', 'string'), ('mode', 'string'), ('rank', 'number'), ('backlinks', 'number'), ('referring_domains', 'number'), ('referring_domains_nofollow', 'number'),
                ('spam_score', 'number'), ('broken_backlinks', 'number'), ('new_links', 'number'), ('lost_links', 'number'), ('important_lost', 'number'), ('spammy_new', 'number'), ('lost_json', 'string'), ('new_json', 'string'),
                ('competitors_json', 'string'), ('timeseries_json', 'string'), ('cost_usd', 'number')]
PROSPECT_COLS = [('site_id', 'string'), ('domain', 'string'), ('prospect_domain', 'string'), ('type', 'string'), ('rank', 'number'), ('spam_score', 'number'), ('detail', 'string'), ('source_url', 'string'), ('target_url', 'string'),
                 ('status', 'string'), ('first_seen', 'string'), ('last_seen', 'string'), ('won_at', 'string'), ('outreach_subject', 'string'), ('outreach_body', 'string'), ('note', 'string')]
AUDITS_COLS = [('site_id', 'string'), ('domain', 'string'), ('audit_id', 'string'), ('audited_at', 'string'), ('report_type', 'string'), ('health_score', 'number'), ('grade', 'string'), ('pages_crawled', 'number'),
               ('findings', 'number'), ('critical', 'number'), ('high', 'number'), ('medium', 'number'), ('low', 'number'), ('scheduled', 'boolean'), ('request_id', 'string')]
AUDIT_FINDINGS_COLS = [('site_id', 'string'), ('domain', 'string'), ('audit_id', 'string'), ('audited_at', 'string'), ('finding_key', 'string'), ('category', 'string'), ('severity', 'string'), ('title', 'string'), ('affected_count', 'number')]

# ---- reuse instead of repeat (v4.6): one key/value cache for results that do not need to be fetched again ----
# keys: 'age:<domain>' (registration date, 365 days), 'desc:<domain>' (site description, 30 days), 'sitemap:<site_id>' (sitemap fingerprint)
CACHE_TABLE = 'seo_cache'
CACHE_COLS = [('key', 'string'), ('kind', 'string'), ('site_id', 'string'), ('value', 'string'), ('updated_at', 'string')]

# ---- pipeline (v4.8, PIPELINE_FEATURE_SPEC §9.1): per-ladder Auto / Manual, priority and status, written by the web app through the n8n public API ----
# One row per ladder (ladder_id = seo_ladders.ladder_id) plus one row per site with ladder_id '_site' holding the website defaults (mode for new ladders,
# opportunities, auto_start, max_active, max_waiting). A ladder without a row = the site's default mode (else auto), active, priority by start date.
LADDER_SETTINGS_TABLE = 'seo_ladder_settings'
LADDER_SETTINGS_COLS = [('ladder_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('head_keyword', 'string'), ('mode', 'string'), ('priority', 'number'), ('status', 'string'),
                        ('plan_type', 'string'), ('reach', 'number'), ('source', 'string'), ('opportunities', 'string'), ('auto_start', 'boolean'), ('max_active', 'number'), ('max_waiting', 'number'),
                        ('created_at', 'string'), ('updated_at', 'string')]

def dt_get_recent_params(table, key, condition, value, limit, order_col='createdAt', direction='DESC'):
    """Get at most `limit` rows matching one condition, newest first (bounded load for tables that only grow, e.g. the rank history)."""
    p = dt_get_where_params(table, key, condition, value)
    p.update({'returnAll': False, 'limit': limit, 'orderBy': True, 'orderByColumn': order_col, 'orderByDirection': direction})
    return p

def dt_get_any_params(table, conditions):
    """Get every row matching ANY of the (column, expression) equality conditions (e.g. a domain with and without www., or two cache keys)."""
    return {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'returnAll': True, 'matchType': 'anyCondition',
            'filters': {'conditions': [{'keyName': k, 'condition': 'eq', 'keyValue': v} for k, v in conditions]}, 'options': {}}

# keys of seo_cache since v4.8: 'reach:<site_id>' (the keyword difficulty the site can already win, 30 days; v5/code/_reach.js)
