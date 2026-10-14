"""Shared definitions for the keyword-ladder feature (used by build_v4.py and build_ladder_extras.py)."""
import uuid as _uuid
LADDER_TABLE = 'seo_ladders'
HISTORY_TABLE = 'seo_rank_history'
LADDER_COLS = [('ladder_id', 'string'), ('domain', 'string'), ('head_keyword', 'string'), ('rung', 'number'), ('page_no', 'number'), ('keyword', 'string'),
               ('supporting', 'string'), ('page_type', 'string'), ('target_url', 'string'), ('page_exists', 'boolean'), ('status', 'string'), ('months', 'string'),
               ('start_date', 'string'), ('country', 'string'), ('location_code', 'number'), ('language_code', 'string'), ('email', 'string'), ('callback_url', 'string'), ('request_id', 'string'),
               ('target_words', 'number'),   # P2-7 (2026-10-12): the word target the verdict set for this page (0 = unknown); run sync_tables.py after deploying
               # R1 (2026-10-13, re-rating): why the row is in its current status when something moved it back -- a page run the daily budget
               # guard refused sets `writing` back to `planned` and says so here, so the ladder plan, the Rank Tracker and the Content
               # Cadence never report a page that was never written. Empty on a row nothing moved.
               ('status_note', 'string')]
HISTORY_COLS = [('ladder_id', 'string'), ('keyword', 'string'), ('checked_at', 'string'), ('position', 'number'), ('url', 'string'), ('serp_features', 'string'), ('domain', 'string'), ('rung', 'number')]
HISTORY_COLS = [('ladder_id', 'string'), ('keyword', 'string'), ('checked_at', 'string'), ('position', 'number'), ('url', 'string'), ('serp_features', 'string'), ('domain', 'string'), ('rung', 'number'),
                # v4.16 (G6, 2026-10-12 system review): the whole results page of the same SERP call, so a reading can be read back and
                # trended. `device` = 'desktop' (every check so far) or 'mobile' (the ladder's main keywords); an empty value in a row
                # written before G6 means desktop. The three JSON columns are written by _rank_serp.js (RS.pack keeps them small):
                # features_json = AI Overview (shown / cites us / sources loaded), snippet, People Also Ask, local pack, video, shopping;
                # competitors_json = the top-10 domains with positions, who is above us and the tracked competitors' positions;
                # snapshot_json = the top 10 with URLs and trimmed titles, kept as proof of the reading (criterion 2.2).
                # share_of_voice = our modelled share of the clicks page 1 offers (RS.METHOD), -1 when the check could not be read.
                ('device', 'string'), ('features_json', 'string'), ('competitors_json', 'string'), ('snapshot_json', 'string'), ('share_of_voice', 'number')]
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
              ('created_at', 'string'), ('last_run_at', 'string'), ('last_status', 'string'), ('request_id', 'string'),
              # v4.15 (G19, SITE_MODEL_SPEC.md): the one site model every workflow reads -- resolved weekly by the Site Tracker, on demand by the
              # main workflow (v5/code/_site_model.js, SM.toRow). canonical_host = the host every emitted URL uses; nap_json / services_json /
              # nav_pages_json are JSON strings; brand_names / competitors are comma-separated.
              ('canonical_host', 'string'), ('business_name', 'string'), ('logo_url', 'string'), ('nap_json', 'string'), ('services_json', 'string'),
              ('nav_pages_json', 'string'), ('business_facts', 'string'), ('cta', 'string'), ('brand_names', 'string'), ('competitors', 'string'),
              ('accreditation', 'string'), ('model_updated_at', 'string')]
# v4.15 (G19): the site's page inventory -- one row per site and URL (sitemap, Search Console, AI Growth key pages, publish detection), filled
# by D11; `queries_json` holds the Search Console queries the page gets impressions for. SM.matchPage() reads it.
PAGES_TABLE = 'seo_pages'
PAGES_COLS = [('site_id', 'string'), ('url', 'string'), ('title', 'string'), ('h1', 'string'), ('source', 'string'), ('lastmod', 'string'),
              ('queries_json', 'string'), ('updated_at', 'string')]
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

def dt_update_where_params(table, cols, conditions, values):
    """Update `values` (col -> expression) on every row matching ALL (column, condition, value) triples — like dt_update_params, but with
    an operator per condition (P34-5: status = reserved AND created_at < cutoff marks the stale reservations)."""
    return {'resource': 'row', 'operation': 'update', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': k, 'condition': c, 'keyValue': v} for k, c, v in conditions]},
            'columns': {'mappingMode': 'defineBelow', 'value': values, 'matchingColumns': [], 'schema': dt_schema(cols), 'attemptToConvertTypes': True, 'convertFieldsToString': False}, 'options': {}}

# ---- Search Console notices (mail watcher) and monthly check-ins (v4.3) ----
ALERTS_TABLE = 'seo_console_alerts'
CHECKIN_TABLE = 'seo_console_checkins'
ALERTS_COLS = [('site_id', 'string'), ('domain', 'string'), ('kind', 'string'), ('severity', 'string'), ('subject', 'string'), ('summary', 'string'), ('received_at', 'string'), ('message_id', 'string'), ('status', 'string'), ('source', 'string')]
CHECKIN_COLS = [('site_id', 'string'), ('domain', 'string'), ('month', 'string'), ('manual_action', 'boolean'), ('security_issue', 'boolean'), ('notes', 'string'), ('coverage_json', 'string'), ('not_indexed_total', 'number'), ('csv_kind', 'string'), ('submitted_at', 'string'), ('source', 'string'), ('request_id', 'string'),
                # D25c (2026-10-12, FIX_PLAN): a test check-in is stored like any other but never counts as the month's answer
                # (v5/code/_checkin_test.js: the form's "test" answer, the API's is_test, a test caller, or a note that marks it)
                ('is_test', 'boolean')]

# ---- E-E-A-T and page types (v4.4): one business profile per site (author, reviewer, address / NAP) and the case-study library ----
PROFILE_TABLE = 'seo_profiles'
CASE_TABLE = 'seo_case_studies'
PROFILE_COLS = [('site_id', 'string'), ('domain', 'string'), ('business_name', 'string'), ('business_type', 'string'), ('logo_url', 'string'), ('street_address', 'string'), ('city', 'string'),
                ('region', 'string'), ('postal_code', 'string'), ('country_code', 'string'), ('phone', 'string'), ('public_email', 'string'), ('opening_hours', 'string'), ('price_range', 'string'),
                ('service_areas', 'string'), ('map_url', 'string'), ('author_name', 'string'), ('author_job_title', 'string'), ('author_credentials', 'string'), ('author_bio', 'string'),
                ('author_url', 'string'), ('author_image_url', 'string'), ('author_same_as', 'string'), ('author_knows_about', 'string'), ('reviewer_name', 'string'), ('reviewer_job_title', 'string'),
                ('reviewer_url', 'string'),
                # G31 (2026-10-13, FIX_PLAN): the stored style guide — the brand's written form ("Tech&"), extra wrong forms to catch,
                # the spelling variant (empty = follow the market the page targets), the words to avoid, the tone and any further rule.
                # Read by Brief Context into every writing prompt (v5/code/_style_guide.js) and checked by Content QA.
                ('style_brand_form', 'string'), ('style_brand_wrong', 'string'), ('style_spelling', 'string'),
                ('style_avoid', 'string'), ('style_tone', 'string'), ('style_notes', 'string'),
                ('updated_at', 'string'), ('request_id', 'string')]
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
                 ('audit_pages', 'number'), ('audit_js', 'boolean'), ('competitors', 'string'), ('brand_names', 'string'), ('updated_at', 'string'), ('request_id', 'string'),
                 ('ai_pulse', 'boolean'),   # v4.9: daily AI pulse (empty = on)
                 ('ai_growth', 'boolean'), ('ai_pages_month', 'number'),   # v4.12 (AI_GROWTH_SPEC.md): the weekly AI Growth loop (empty = on) and AI answer / refresh pages a month (empty = 2)
                 ('link_builder', 'boolean'),   # v4.13 (LINK_BUILDER_SPEC.md): the weekly Link Builder (empty = on); on, the Backlink Monitor no longer drafts e-mails
                 ('stuck_weeks', 'number')]   # G32 (2026-10-13): weeks without a position gain before a ladder is called stuck and gets a re-plan proposal (empty = 8, kept 2-26); run sync_tables.py after deploying
AI_PROMPTS_COLS = [('prompt_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('keyword', 'string'), ('source', 'string'), ('status', 'string'), ('created_at', 'string'),
                   ('stage', 'string'), ('cluster', 'string'), ('volume', 'number'), ('origin', 'string'), ('updated_at', 'string')]   # v4.9: buyer stage, topic cluster, monthly search volume, where the question came from
AI_ANSWERS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompt_id', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('engine', 'string'),
                   ('answered', 'boolean'), ('mentioned', 'boolean'), ('cited', 'boolean'), ('rank', 'number'), ('our_urls', 'string'), ('competitors', 'string'), ('sources', 'string'), ('excerpt', 'string'), ('cost', 'number'), ('error', 'string'),
                   ('run_kind', 'string'), ('sentiment', 'string'), ('brands', 'string'), ('issues', 'string'), ('fanout', 'string'),
                   ('cited_urls', 'string')]   # v4.12: the exact third-party pages the answer cited (JSON [{u, t}], max 8) — the earned-media targets. v4.9: weekly / full / pulse / on_demand, how the answer speaks of you, brands in order, wrong claims, the searches the engine ran
AI_VIS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompts', 'number'), ('answers', 'number'), ('mention_rate', 'number'), ('citation_rate', 'number'), ('share_of_voice', 'number'),
               ('avg_rank', 'number'), ('aio_presence', 'number'), ('aio_citation_rate', 'number'), ('engines_json', 'string'), ('competitors_json', 'string'), ('sources_json', 'string'), ('pages_json', 'string'), ('gaps_json', 'string'),
               ('market_json', 'string'), ('market_month', 'string'), ('cost_usd', 'number'), ('alerts', 'string'),
               ('run_kind', 'string'), ('samples', 'number'), ('visibility_score', 'number'), ('mention_lo', 'number'), ('mention_hi', 'number'), ('sentiment_score', 'number'), ('accuracy_issues', 'number'),
               ('ai_sessions', 'number'), ('ai_conversions', 'number'), ('ai_revenue', 'number'), ('index_sov', 'number'), ('ai_impressions', 'number'),
               ('perception_json', 'string'), ('traffic_json', 'string'), ('access_json', 'string'), ('index_json', 'string'), ('clusters_json', 'string')]   # v4.9 (AI_VISIBILITY_SPEC.md)
# v4.9: one row per site per day from the AI Pulse (the panel on the fast engines; small aggregates, no answer text)
AI_DAILY_TABLE = 'seo_ai_daily'
AI_DAILY_COLS = [('site_id', 'string'), ('domain', 'string'), ('date', 'string'), ('checked_at', 'string'), ('run_id', 'string'), ('samples', 'number'), ('mentioned', 'number'), ('cited', 'number'),
                 ('mention_rate', 'number'), ('citation_rate', 'number'), ('share_of_voice', 'number'), ('visibility_score', 'number'), ('engines_json', 'string'), ('prompts_json', 'string'),
                 ('competitors_json', 'string'), ('sources_json', 'string'), ('alerts', 'string'), ('cost_usd', 'number')]
# v4.12 (AI_GROWTH_SPEC.md): the weekly AI Growth loop — what it does so the site gets named and cited, not only measured.
# seo_ai_pages: one row per site and key page: can an AI assistant read and quote it (raw HTML without JavaScript, answer in the first 200
# characters, a visible update date, question headings, sourced figures, size), and is it in Bing's index (Bing Webmaster GetUrlInfo) / submitted.
AI_PAGES_TABLE = 'seo_ai_pages'
AI_PAGES_COLS = [('site_id', 'string'), ('domain', 'string'), ('url', 'string'), ('kind', 'string'), ('checked_at', 'string'), ('status', 'number'), ('score', 'number'), ('checks_json', 'string'),
                 ('issues', 'string'), ('words_raw', 'number'), ('title', 'string'), ('updated_on', 'string'), ('bing_crawled_at', 'string'), ('bing_status', 'number'), ('submitted_at', 'string'),
                 ('submitted_via', 'string'), ('cited_by', 'string'), ('questions', 'string')]
# seo_ai_targets: the questions the site should win in AI answers and how — a new answer page (answer) or a refresh of the page it has (refresh);
# written by AI Growth, consumed by the Content Cadence (ai_pages_month), status queued -> writing -> written -> won (or skipped).
AI_TARGETS_TABLE = 'seo_ai_targets'
AI_TARGETS_COLS = [('target_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('prompt_id', 'string'), ('question', 'string'), ('keyword', 'string'), ('kind', 'string'), ('page_url', 'string'),
                   ('page_type', 'string'), ('fanout', 'string'), ('sources_json', 'string'), ('competitors', 'string'), ('engines', 'string'), ('stage', 'string'), ('value', 'number'), ('status', 'string'),
                   ('reason', 'string'), ('created_at', 'string'), ('updated_at', 'string'), ('request_id', 'string'), ('written_at', 'string'), ('won_at', 'string')]
# seo_ai_growth: one row per site and weekly run (what was done automatically, the plan, the earned-media list, the entity check)
AI_GROWTH_TABLE = 'seo_ai_growth'
AI_GROWTH_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('submitted', 'number'), ('submitted_json', 'string'), ('indexnow', 'string'),
                  ('pages_checked', 'number'), ('avg_score', 'number'), ('pages_json', 'string'), ('targets_json', 'string'), ('earned_json', 'string'), ('entity_json', 'string'),
                  ('actions_json', 'string'), ('alerts', 'string'), ('cost_usd', 'number')]
BL_SNAP_COLS = [('site_id', 'string'), ('domain', 'string'), ('checked_at', 'string'), ('mode', 'string'), ('rank', 'number'), ('backlinks', 'number'), ('referring_domains', 'number'), ('referring_domains_nofollow', 'number'),
                ('spam_score', 'number'), ('broken_backlinks', 'number'), ('new_links', 'number'), ('lost_links', 'number'), ('important_lost', 'number'), ('spammy_new', 'number'), ('lost_json', 'string'), ('new_json', 'string'),
                ('competitors_json', 'string'), ('timeseries_json', 'string'), ('cost_usd', 'number'),
                ('union_domains', 'number'), ('best_links', 'number'), ('verified_live', 'number'), ('at_risk', 'number'), ('confirmed_lost', 'number'), ('referral_visits', 'number'),
                ('referral_key_events', 'number'), ('coverage_json', 'string'), ('anchors_json', 'string'), ('pages_json', 'string'), ('values_json', 'string')]   # v4.10 (BACKLINKS_SPEC.md): all sources merged + verified
PROSPECT_COLS = [('site_id', 'string'), ('domain', 'string'), ('prospect_domain', 'string'), ('type', 'string'), ('rank', 'number'), ('spam_score', 'number'), ('detail', 'string'), ('source_url', 'string'), ('target_url', 'string'),
                 ('status', 'string'), ('first_seen', 'string'), ('last_seen', 'string'), ('won_at', 'string'), ('outreach_subject', 'string'), ('outreach_body', 'string'), ('note', 'string'),
                 ('score', 'number'), ('origin', 'string'), ('contact_email', 'string'), ('contact_url', 'string'), ('contacted_at', 'string'), ('followup_step', 'number'),
                 ('followup_subject', 'string'), ('followup_body', 'string'), ('verified_at', 'string'),   # v4.10: value x likelihood score, where it came from, a contact found on the site, follow-up drafts (1 + 2), won only after the link is verified
                 ('drafted_at', 'string')]   # P34-1 (2026-10-12): when the stored draft was written. Empty, or before the D12 / D13 gates = superseded: cleared, never counted, never offered (v5/code/_drafts.js, app/shared/src/outreach.ts)
# v4.10: the link ledger — one row per site and referring domain, merged from every source (DataForSEO, Bing Webmaster Tools, the Search Console
# links export, GA4 referrals, Wikipedia / Hacker News / news / web mentions) and verified by fetching the linking page (BACKLINKS_SPEC.md).
LINKS_TABLE = 'seo_backlinks'
LINKS_COLS = [('site_id', 'string'), ('domain', 'string'), ('ref_domain', 'string'), ('kind', 'string'), ('from_url', 'string'), ('to_url', 'string'), ('anchor', 'string'), ('anchor_kind', 'string'),
              ('rel', 'string'), ('placement', 'string'), ('link_type', 'string'), ('relevance', 'number'), ('note', 'string'), ('sources', 'string'), ('source_count', 'number'),
              ('first_seen', 'string'), ('last_seen', 'string'), ('status', 'string'), ('lost_at', 'string'), ('lost_reason', 'string'), ('miss_count', 'number'),
              ('verify', 'string'), ('verified_at', 'string'), ('noindex', 'boolean'), ('canonical_elsewhere', 'boolean'), ('outbound', 'number'), ('page_title', 'string'), ('context', 'string'),
              ('authority', 'number'), ('dr', 'number'), ('cc_rank', 'number'), ('page_keywords', 'number'), ('spam_score', 'number'), ('original', 'boolean'), ('sitewide', 'number'), ('links', 'number'),
              ('visits', 'number'), ('key_events', 'number'), ('ai_cited', 'boolean'), ('seo_value', 'number'), ('referral_value', 'number'), ('brand_value', 'number'), ('updated_at', 'string')]
# v4.10: links the person uploads in the web app (Search Console Links report exports: "Latest links", "More sample links", "Top linking sites";
# or any CSV of linking pages). Raw evidence; the Backlink Monitor merges the latest import per site and source into the ledger.
# v4.10: the Common Crawl web graph per site, written by the linkgraph job (n8n/seo-agent/linkgraph/, once per graph release): the site's
# referring domains (kind link), domains that link to a competitor and not to the site (gap, links_to = the competitors) and authority ranks
# for the site's other referrers (rank). hc_pos / pr_pos = harmonic-centrality / PageRank position among ~133M domains (1 = best).
# v4.13 Link Builder (LINK_BUILDER_SPEC.md): one row per site x prospect domain x type with the qualification, contacts, our page, the link
# text and the drafted sequence (the app sends it); the listings checklist; what each won link did for its page.
LINK_OUTREACH_TABLE = 'seo_link_outreach'
LINK_OUTREACH_COLS = [('site_id', 'string'), ('domain', 'string'), ('prospect_domain', 'string'), ('type', 'string'), ('status', 'string'), ('score', 'number'),
                      ('fit', 'number'), ('fit_reason', 'string'), ('checks_json', 'string'), ('page_url', 'string'), ('page_title', 'string'), ('evidence', 'string'),
                      ('contacts_json', 'string'), ('contact_email', 'string'), ('contact_form_url', 'string'), ('country', 'string'), ('language', 'string'),
                      ('target_url', 'string'), ('target_reason', 'string'), ('anchor_hint', 'string'), ('sequence_json', 'string'), ('deadline', 'string'),
                      ('drafted_at', 'string'), ('checked_at', 'string'), ('request_id', 'string')]
LISTINGS_TABLE = 'seo_listings'
LISTINGS_COLS = [('site_id', 'string'), ('domain', 'string'), ('listing_id', 'string'), ('name', 'string'), ('category', 'string'), ('status', 'string'),
                 ('profile_url', 'string'), ('rel', 'string'), ('competitors', 'string'), ('submit_url', 'string'), ('priority', 'number'), ('why', 'string'),
                 ('checked_at', 'string'), ('submitted_at', 'string'), ('note', 'string')]
LINK_IMPACT_TABLE = 'seo_link_impact'
LINK_IMPACT_COLS = [('site_id', 'string'), ('domain', 'string'), ('ref_domain', 'string'), ('from_url', 'string'), ('target_url', 'string'), ('t0', 'string'),
                    ('weeks', 'number'), ('base_position', 'number'), ('base_clicks', 'number'), ('position', 'number'), ('clicks', 'number'),
                    ('page_change', 'number'), ('control_change', 'number'), ('control_spread', 'number'), ('effect', 'number'), ('verdict', 'string'),
                    ('note', 'string'), ('keyword', 'string'), ('updated_at', 'string'),
                    # G12 (2026-10-13, FIX_PLAN): the same control-group reading now also measures a PAGE CHANGE, so each row says
                    # which it is — kind `link` (a won link, ref_domain set) or `page_change` (a page that went live or was rewritten,
                    # ref_domain empty), and `change` names the change (published | rewritten).
                    ('kind', 'string'), ('change', 'string')]
LINK_GRAPH_TABLE = 'seo_link_graph'
LINK_GRAPH_COLS = [('site_id', 'string'), ('domain', 'string'), ('release', 'string'), ('kind', 'string'), ('ref_domain', 'string'), ('hc_pos', 'number'), ('pr_pos', 'number'),
                   ('n_hosts', 'number'), ('links_to', 'string'), ('checked_at', 'string')]
LINK_IMPORTS_TABLE = 'seo_link_imports'
LINK_IMPORTS_COLS = [('site_id', 'string'), ('domain', 'string'), ('import_id', 'string'), ('source', 'string'), ('ref_domain', 'string'), ('from_url', 'string'), ('to_url', 'string'),
                     ('anchor', 'string'), ('links', 'number'), ('last_crawled', 'string'), ('imported_at', 'string')]
AUDITS_COLS = [('site_id', 'string'), ('domain', 'string'), ('audit_id', 'string'), ('audited_at', 'string'), ('report_type', 'string'), ('health_score', 'number'), ('grade', 'string'), ('pages_crawled', 'number'),
               ('findings', 'number'), ('critical', 'number'), ('high', 'number'), ('medium', 'number'), ('low', 'number'), ('scheduled', 'boolean'), ('request_id', 'string')]
AUDIT_FINDINGS_COLS = [('site_id', 'string'), ('domain', 'string'), ('audit_id', 'string'), ('audited_at', 'string'), ('finding_key', 'string'), ('category', 'string'), ('severity', 'string'), ('title', 'string'), ('affected_count', 'number'),
                       # G26 (2026-10-12, FIX_PLAN): the impact weight that ordered the fix list (severity x pages affected x their clicks and
                       # impressions x their place in the site) and the one sentence that explains it, so the app can order the same way
                       ('impact', 'number'), ('impact_basis', 'string'),
                       # G11 (2026-10-13, FIX_PLAN): "I fixed this" in the app sets recheck_state to `requested` (with recheck_requested_at);
                       # the next daily Page Watch answers it on the site's key pages and writes back `fixed` / `still_open` / `not_checked`
                       # with the rule it used and one sentence of evidence - days instead of waiting for the next monthly audit (1.10).
                       ('recheck_state', 'string'), ('recheck_requested_at', 'string'), ('recheck_at', 'string'), ('recheck_rule', 'string'), ('recheck_note', 'string')]

# ---- the daily key-page watch and Google's view of those pages (G11 + G25, 2026-10-13, FIX_PLAN) ----
# One row per site and key page: today's raw reading (status, a redirect that appeared, noindex, canonical, title, description, H1s, whether
# robots.txt blocks it) with the change history, plus what Search Console's URL Inspection said about the same page (index state, the
# canonical Google chose, its last crawl, mobile usability, rich results) - written by the weekly rotation, which spends at most
# PW.PER_RUN of Google's 2,000-a-day quota per property. The site-level fingerprint (robots.txt hash, when the watch last ran) lives in
# seo_cache under `watch:<site_id>`, beside the sitemap fingerprints.
PAGE_WATCH_TABLE = 'seo_page_watch'
PAGE_WATCH_COLS = [('site_id', 'string'), ('domain', 'string'), ('url', 'string'), ('kind', 'string'), ('weight', 'number'), ('checked_at', 'string'),
                   ('status', 'number'), ('location', 'string'), ('noindex', 'boolean'), ('noindex_source', 'string'), ('canonical', 'string'), ('canonical_ok', 'boolean'),
                   ('title', 'string'), ('title_hash', 'string'), ('titles', 'number'), ('description', 'string'), ('h1', 'string'), ('h1s', 'number'),
                   ('robots_blocked', 'boolean'), ('robots_hash', 'string'), ('state', 'string'), ('changes', 'string'), ('last_change_at', 'string'),
                   ('changed_count', 'number'), ('error', 'string'),
                   ('inspect_at', 'string'), ('index_state', 'string'), ('indexed', 'string'), ('coverage', 'string'), ('google_canonical', 'string'),
                   ('last_crawl', 'string'), ('mobile', 'string'), ('rich_results', 'string'), ('inspect_error', 'string')]

# ---- reuse instead of repeat (v4.6): one key/value cache for results that do not need to be fetched again ----
# keys: 'age:<domain>' (registration date, 365 days), 'desc:<domain>' (site description, 30 days), 'sitemap:<site_id>' (sitemap fingerprint)
# v4.9: 'ai_brands:<site_id>' (brand names AI uses for competitors -> their domain, learned by the Answer Analyst), 'ai_index:<site_id>' (the monthly AI-answer database view)
# v4.12: 'indexnow:<site_id>' (the site's IndexNow key; the owner hosts https://<domain>/<key>.txt)
# v4.16 (G11): 'watch:<site_id>' (the daily key-page watch: the robots.txt fingerprint and when it last ran)
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

def dt_get_all_where_params(table, conditions):
    """Get every row matching ALL (column, condition, value) triples (e.g. site + date range; string columns compare as text, so ISO dates order correctly)."""
    return {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'returnAll': True, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': k, 'condition': c, 'keyValue': v} for k, c, v in conditions]}, 'options': {}}
def dt_delete_where_params(table, conditions):
    """Delete the rows matching ALL (column, condition, value) triples (retention of tables that only grow)."""
    return {'resource': 'row', 'operation': 'deleteRows', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}, 'matchType': 'allConditions',
            'filters': {'conditions': [{'keyName': k, 'condition': c, 'keyValue': v} for k, c, v in conditions]}, 'options': {}}

# ---- run ledger (v4.14, 2026-10-11, FIX_PLAN D1): one row per execution of the main workflow and per Keyword Check request, inserted BEFORE the
# limits are checked, so parallel executions see each other (the static-data counters they used before overwrote one another: 8 runs counted as 5).
# status: reserved -> done (settled_usd written at the end) | refused (the limit refused the run; never counted). Rate Limit / Assess Limit count
# only rows with a lower id than their own, so row order decides ties. Keyword Check rows carry mode 'assess' and stay out of the main limits.
RUN_LEDGER_TABLE = 'seo_run_ledger'
RUN_LEDGER_COLS = [('run_id', 'string'), ('key', 'string'), ('mode', 'string'), ('est_usd', 'number'), ('created_at', 'string'), ('status', 'string'), ('settled_usd', 'number'),
                   # P34-5 (2026-10-12): which site a run is working on and whether it is a heavy crawl, so a second large audit of the
                   # same site is refused while one is running (two 200-page audits at once killed the n8n task runner and both were
                   # cancelled at the 90-minute timeout). status gains `stale`: reserved, never settled, older than the age limit.
                   ('domain', 'string'), ('heavy', 'boolean'),
                   # R9 (2026-10-13, re-rating): the ledger counted Claude money only, so the monitors spent DataForSEO money with no row at
                   # all and both audits carried est_usd 0 while each crawl cost $0.09. Every row now carries the run's DataForSEO estimate
                   # beside the AI one, and `dfs_usd` is the measured amount where the run knows it (the monitors' own cost_usd).
                   ('dfs_est_usd', 'number'), ('dfs_usd', 'number'),
                   # R28 (2026-10-14, system review FIX_PLAN §3.12): the DataForSEO account balance read for free from `appendix/user_data`
                   # at the moment this row was reserved. The engine's own figures did not reconcile with the money (+73% in one window),
                   # so the day's spend is checked against the only measurement that cannot be argued with — how far the balance actually
                   # fell between the day's first and last reading. 0 = not read (the Keyword Check and the schedules do not read it).
                   ('dfs_balance', 'number'),
                   # G23 (2026-10-13, FIX_PLAN): a settled row must say which part of its cost was MEASURED and which ESTIMATED. `settled_usd`
                   # stored the per-mode reservation while every reader took it for a measured cost, and Claude's spend could be stated no
                   # closer than "$1.6-3.0" because the three Opus nodes stream and a streaming call reports no token usage at all.
                   # `cost_mode` is the estimate key the run was priced on — the key of the self-correcting rolling figure in seo_cache
                   # (`cost:<kind>:<mode>`); `ai_usd` is the run's own Claude figure, priced by v5/code/_cost_cal.js from the characters the
                   # prompts really interpolated, the characters the models answered with and the thinking budget; and `cost_basis` says in
                   # words which half of measured_usd + estimated_usd is which.
                   ('cost_mode', 'string'), ('ai_usd', 'number'), ('measured_usd', 'number'), ('estimated_usd', 'number'), ('cost_basis', 'string')]

# ---- R9 (2026-10-13, re-rating): every scheduled run reserves and settles a seo_run_ledger row too. Before this the ledger held nothing for
# the AI Pulse, the Rank Tracker, the Content Cadence, the Link Builder, AI Growth or the Site Tracker, so the day's guard refused
# customer-facing runs over Claude estimates while the schedules spent DataForSEO money unseen. The estimates are per site and measured on
# techand.ai (the 2026-10-11 and 2026-10-13 runs plus each feature's spec): `ai` = Claude, `dfs` = DataForSEO, `dfs_full` = a full run where
# the workflow has a light and a full mode (the Backlink Monitor). They are estimates, exactly like Rate Limit's EST table; `dfs_usd` carries
# the measured figure once the run knows it.
LEDGER_EST = {
    'ai_visibility':   {'ai': 0.27, 'dfs': 0.60},    # ~$0.87 / site / week measured (AI_VISIBILITY_SPEC)
    'ai_pulse':        {'ai': 0.004, 'dfs': 0.08},   # $0.084 / site / day measured 2026-10-08 and again on 2026-10-13
    'ai_growth':       {'ai': 0.55, 'dfs': 0.05},    # AI pages + outreach drafts (AI_GROWTH_SPEC: ~$2.53 / site / month)
    'backlinks':       {'ai': 0.05, 'dfs': 0.05, 'dfs_full': 0.45},   # Monday light watch vs the monthly full report (~$0.50)
    # R28 (2026-10-14): the Audit Scheduler *spawns* audits into the main workflow and crawls nothing itself, so its own $0.09 was the
    # same crawl the spawned run reserves and settles for itself - counted twice. It reserves nothing now, exactly as the Content
    # Cadence does, and the guard still sees every audit through the row each spawned run makes before its own crawl.
    'audit_schedule':  {'ai': 0.0,  'dfs': 0.0},     # it plans and spawns; every spawned audit reserves its own row (the crawl is $0.09 there)
    'link_builder':    {'ai': 0.30, 'dfs': 0.05},    # $0.35 / site / month (LINK_BUILDER_SPEC)
    'rank_tracker':    {'ai': 0.0,  'dfs': 0.15},    # the week's SERP checks of one site's ladders
    'site_tracker':    {'ai': 0.03, 'dfs': 0.01},    # the site brief; Search Console / GA4 / Trends are free
    'content_cadence': {'ai': 0.0,  'dfs': 0.0},     # it plans and spawns; every page run reserves its own row
}


def monitor_ledger_js(v5_dir, mode, plan_node, row_node, measured=''):
    """R9: the reserve and settle Code-node sources for one scheduled workflow, filled in from v5/code/Monitor_Ledger_*.js.
    `plan_node` knows how many sites this run covers, `row_node` is the reserve node's own name, and `measured` is the node that
    carries the run's real DataForSEO cost as `cost_usd` ('' when the workflow has none)."""
    import json as _json, os as _os
    assert mode in LEDGER_EST, 'no ledger estimate for ' + mode
    rd = lambda f: open(_os.path.join(v5_dir, 'code', f), encoding='utf-8').read()
    reserve = (rd('Monitor_Ledger_Row.js').replace('__PLAN__', plan_node).replace('__MODE__', mode)
               .replace('__EST__', _json.dumps(LEDGER_EST[mode], sort_keys=True)))
    settle = rd('Monitor_Ledger_Settle.js').replace('__ROW__', row_node).replace('__MEASURED__', measured)
    for ph in ('__PLAN__', '__MODE__', '__EST__', '__ROW__', '__MEASURED__'):
        assert ph not in reserve and ph not in settle, ph + ' left in the ledger code for ' + mode
    return reserve, settle


# ---- R17 (2026-10-14, system review FIX_PLAN 3.12 / RESULTS 2.11): the reservation must sit on the MAIN path -------------------
# R9 hung the reserve chain BESIDE the plan node, because a Data Table node answers with the row it wrote rather than with its input. n8n's
# v1 execution order runs that side branch LAST, so every one of the nine scheduled workflows reserved its row after the whole paid pipeline
# had run: in exec 568 `Settle Run Ledger (Pulse)` ran at 16:22:15.507 and matched nothing, and `Reserve Run Ledger (Pulse)` inserted a fresh
# `reserved` row at 16:22:15.584 - so the guard never saw a monitor before it spent, the row counted against the day's cap until the stale
# release cleared it two hours later, and the measured figure the settle had just computed was thrown away ($1.394 of a $2.388 run).
# The chain now sits in the data path - plan -> Ensure -> Row -> Reserve -> After Run Ledger -> (what the plan used to feed) - and this one
# Code node hands the plan's own items back, so nothing downstream ever sees the Data Table rows.
LEDGER_RESUME_JS = """// R17 (2026-10-14, system review FIX_PLAN 3.12): the run ledger reserves its row on the MAIN path now, before the first paid call -
// it used to hang off the plan node as a side branch and n8n's v1 order ran it last, after all the spending. A Data Table node answers with
// the row it wrote rather than with its input, so this node hands __PLAN__'s own items back to the pipeline, unchanged and in order.
return $('__PLAN__').all();
"""


def ledger_tag(wiring):
    """The tag of a ledger wiring entry ('Run Ledger Row (Pulse)' -> 'Pulse')."""
    r = str(wiring['reserve'])
    assert r.startswith('Run Ledger Row (') and r.endswith(')'), 'unexpected reserve node name: ' + r
    return r[len('Run Ledger Row ('):-1]


_LEDGER_NS = _uuid.UUID('7c1f2a44-0b3e-4e6a-9d21-5e8a1c0f4b77')


def ledger_mainline(wfobj, wiring):
    """R17: move everything the plan node used to feed to the far side of the reserve chain, so no paid node of the workflow can run
    before the ledger row exists. Called at WRITE time, when every connection of the workflow is already made, and it is the one place
    the three builders share. It also makes the two Data Table nodes of the chain `alwaysOutputData` + `continueRegularOutput`: they sit
    in the data path now, so neither may end the run by answering with nothing."""
    tag = ledger_tag(wiring)
    conns, nodes = wfobj['connections'], {n['name']: n for n in wfobj['nodes']}
    plan, ensure = wiring['plan'], 'Ensure Run Ledger (' + tag + ')'
    reserve, resume = 'Reserve Run Ledger (' + tag + ')', 'After Run Ledger (' + tag + ')'
    for nm in (plan, ensure, reserve, wiring['settle']):
        assert nm in nodes, 'R17: ' + nm + ' is missing from ' + str(wfobj.get('name'))
    assert resume not in nodes, 'R17: ' + resume + ' already exists (ledger_mainline ran twice)'
    outs = conns.setdefault(plan, {}).setdefault('main', [])
    while not outs: outs.append([])
    downstream = [t for t in outs[0] if t['node'] != ensure]
    assert downstream, 'R17: ' + plan + ' feeds nothing but the ledger - there is no pipeline to put behind the reservation'
    assert any(t['node'] == ensure for t in outs[0]), 'R17: ' + plan + ' does not start the ledger chain'
    outs[0] = [{'node': ensure, 'type': 'main', 'index': 0}]
    x, y = nodes[reserve]['position']
    wfobj['nodes'].append({'parameters': {'jsCode': LEDGER_RESUME_JS.replace('__PLAN__', plan)},
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + resume)), 'name': resume,
                           'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [x + 220, y]})
    router = conns.setdefault(reserve, {}).setdefault('main', [])
    while not router: router.append([])
    router[0] = [t for t in router[0] if t['node'] != resume] + [{'node': resume, 'type': 'main', 'index': 0}]
    conns.setdefault(resume, {})['main'] = [downstream]
    for nm in (ensure, reserve):
        nodes[nm]['alwaysOutputData'] = True
        nodes[nm]['onError'] = 'continueRegularOutput'
    wiring['resume'] = resume
    return resume


# ---- R29 (2026-10-14, system review FIX_PLAN 3.12, secret handling): SEO_ALERT_WEBHOOK_URL is a SECRET (a Slack incoming webhook is a
# bearer URL: anyone holding it can post into the channel), and it was baked into the generated node code the way SEO_MAIL_FROM is - so the
# live URL ended up in workflows/SEO_Agent_Error_Handler.json, workflows/SEO_Agent_Page_Watch.json and harness/code_v4/EH__Alert_*.js, all
# tracked in a PUBLIC repository. The build bakes this placeholder now and apply_env.py substitutes the real value into the JSON it hands to
# the import, after the build and before the import, so the repository never carries the secret and the deployed instance still works.
# A node that still holds the placeholder has no webhook configured: the ops-alert kit treats it as unset (OA.cfgUrl).
ALERT_WEBHOOK_PLACEHOLDER = '__SEO_ALERT_WEBHOOK_URL__'


# ---- ops alerts (D25b, 2026-10-12, FIX_PLAN): the Error Handler had one channel (e-mail), and on 2026-10-10 and 2026-10-12 it failed with a
# connection error, so nobody learned that a run had failed. Every alert is now written here first (one row per alert key, the repeats counted)
# and then sent to an independent webhook (SEO_ALERT_WEBHOOK_URL, Slack / Teams / anything that takes a POST) as well as the e-mail. The row is
# the record of last resort: it survives both channels being down, and the app's failure watcher reads the same failures from n8n.
OPS_ALERTS_TABLE = 'seo_ops_alerts'
OPS_ALERTS_COLS = [('alert_key', 'string'), ('workflow', 'string'), ('node', 'string'), ('message', 'string'), ('execution_id', 'string'), ('execution_url', 'string'),
                   ('mode', 'string'), ('severity', 'string'), ('first_seen_at', 'string'), ('last_seen_at', 'string'), ('count', 'number'),
                   ('channels', 'string'), ('delivered', 'string'), ('notes', 'string')]
