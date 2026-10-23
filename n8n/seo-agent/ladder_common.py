"""Shared definitions for the keyword-ladder feature (used by build_v4.py and build_ladder_extras.py)."""
import json as _json
import os as _os
import uuid as _uuid

_V5 = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'v5')


def read_v5(path):
    """Read a file from v5/ (the one copy of a shared kit or node, used by every builder)."""
    return open(_os.path.join(_V5, path), encoding='utf-8').read()
LADDER_TABLE = 'seo_ladders'
HISTORY_TABLE = 'seo_rank_history'
LADDER_COLS = [('ladder_id', 'string'), ('domain', 'string'), ('head_keyword', 'string'), ('rung', 'number'), ('page_no', 'number'), ('keyword', 'string'),
               ('supporting', 'string'), ('page_type', 'string'), ('target_url', 'string'), ('page_exists', 'boolean'), ('status', 'string'), ('months', 'string'),
               ('start_date', 'string'), ('country', 'string'), ('location_code', 'number'), ('language_code', 'string'), ('email', 'string'), ('callback_url', 'string'), ('request_id', 'string'),
               ('target_words', 'number'),   # P2-7 (2026-10-12): the word target the verdict set for this page (0 = unknown); run sync_tables.py after deploying
               # R1 (2026-10-13, re-rating): why the row is in its current status when something moved it back -- a page run the daily budget
               # guard refused sets `writing` back to `planned` and says so here, so the ladder plan, the Rank Tracker and the Content
               # Cadence never report a page that was never written. Empty on a row nothing moved.
               ('status_note', 'string'),
               # F-KW (2026-10-20): who chose this ladder's keyword (client_typed | client_picked | system_announced), written by the ladder run on
               # every row BEFORE its seo_ladder_settings row, so the Content Cadence still knows when that second write fails; '' = a row from
               # before the column. Run sync_tables.py after deploying.
               ('chosen_by', 'string')]
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
              ('accreditation', 'string'), ('model_updated_at', 'string'),
              # B7-5 (W3-D, 2026-10-17): content groups -- a JSON list [{name, pattern}] of regexes over page paths, set through Site Admin
              # (action content_groups); the Site Tracker reports each group's Search Console clicks with the same statistical bar
              ('content_groups_json', 'string'),
              # 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): the services the client declared ("What do you sell?" on Track my site), a JSON
              # list. Written by Track my site only; the site model (SM.from) merges it into its services and SM.toRow writes it back unchanged, so
              # the weekly Site Tracker never overwrites it. Read by the fit gate (protected words, topics) and the keyword research (seeds).
              ('declared_services', 'string')]
# v4.15 (G19): the site's page inventory -- one row per site and URL (sitemap, Search Console, AI Growth key pages, publish detection), filled
# by D11; `queries_json` holds the Search Console queries the page gets impressions for. SM.matchPage() reads it.
PAGES_TABLE = 'seo_pages'
PAGES_COLS = [('site_id', 'string'), ('url', 'string'), ('title', 'string'), ('h1', 'string'), ('source', 'string'), ('lastmod', 'string'),
              ('queries_json', 'string'), ('updated_at', 'string'),
              # B4-1 / B4-2 (2026-10-15, benchmark area 4, BENCH_AREA4_cadence.md): the page's own Search Console measurement and the
              # decay judgement made of it. Until now the decay verdict lived for the length of one Site Tracker run and died in an
              # e-mail; stored here, the Content Cadence reads it and WRITES the refresh. `decay_state` is one of
              # decaying / seasonal / watch / steady / too_small; `decay_basis` is the sentence that must travel with the number.
              ('clicks', 'number'), ('impressions', 'number'), ('position', 'number'), ('prev_clicks', 'number'), ('yoy_clicks', 'number'),
              ('decay_state', 'string'), ('decay_pct', 'number'), ('decay_lost', 'number'), ('decay_kind', 'string'),
              ('decay_basis', 'string'), ('measured_at', 'string'),
              # RV-1 (2026-10-21, pre-launch run on techand.ai): what the address answered when it was last read, redirects followed (0 = never
              # read) and when. A page known only from Search Console carried no status, so every report advised on old addresses that 404.
              # Written by the Site Tracker (Status Targets (Site) -> Fetch Page Status (Site)); read through SM.isGone / SM.gonePages.
              ('http_status', 'number'), ('status_at', 'string')]
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
            ('request_id', 'string'), ('started_at', 'string'), ('status', 'string'), ('published_url', 'string'), ('published_at', 'string'), ('week', 'string'),
            # R111 (2026-10-16, re-rating 2026-10-15): a page whose FINAL quality round failed is stored `status: 'not_ready'` (a draft to fix
            # and run again, never "publish it") and carries the last round's reasons here, '; '-joined (Content_Log_Row.js)
            ('qa_reasons', 'string')]
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
                 ('stuck_weeks', 'number'),   # G32 (2026-10-13): weeks without a position gain before a ladder is called stuck and gets a re-plan proposal (empty = 8, kept 2-26)
                 # G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): buyer roles and extra markets the panel covers, and how the daily pulse samples it
                 ('ai_personas', 'string'), ('ai_markets', 'string'), ('ai_pulse_mode', 'string'), ('ai_pulse_per_week', 'number')]
AI_PROMPTS_COLS = [('prompt_id', 'string'), ('site_id', 'string'), ('domain', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('keyword', 'string'), ('source', 'string'), ('status', 'string'), ('created_at', 'string'),
                   ('stage', 'string'), ('cluster', 'string'), ('volume', 'number'), ('origin', 'string'), ('updated_at', 'string'),
                   # G6 (2026-10-18): who asks it (buyer role), in which market (CC-lang), pinned by the owner (never retired by the writer),
                   # and the fit gate's sentence when status is 'refused' (stored, so the panel manager shows what was refused and why)
                   ('persona', 'string'), ('market', 'string'), ('pinned', 'boolean'), ('fit_note', 'string'),
                   # F2 (2026-10-23, ENGINE_AUDIT.md E9): where the search phrase (`keyword`) came from: owner | writer | template | derived. A derived
                   # phrase is built from the question's own words (AIP.keywordOf); AI Requests does not ask Google's AI Overview for it
                   ('keyword_source', 'string')]   # v4.9 (the row above): buyer stage, topic cluster, monthly search volume, where the question came from
AI_ANSWERS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompt_id', 'string'), ('prompt', 'string'), ('kind', 'string'), ('topic', 'string'), ('engine', 'string'),
                   ('answered', 'boolean'), ('mentioned', 'boolean'), ('cited', 'boolean'), ('rank', 'number'), ('our_urls', 'string'), ('competitors', 'string'), ('sources', 'string'), ('excerpt', 'string'), ('cost', 'number'), ('error', 'string'),
                   ('run_kind', 'string'), ('sentiment', 'string'), ('brands', 'string'), ('issues', 'string'), ('fanout', 'string'),
                   ('cited_urls', 'string'),
                   ('named', 'boolean'), ('position', 'number'), ('entities_json', 'string'),
                   # W2-E1 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §1, fixes/W2-E1.md): what every engine call already returned and
                   # was thrown away - the full answer (12,000 characters max), every source cited in order, the pages read but not cited, the searches
                   # run, product / ad / local-business cards, the model, and detail_json {answer_len, answer_cut, analysed} (v5/code/_ai_answer_data.js)
                   ('answer_text', 'string'), ('cited_json', 'string'), ('retrieved_json', 'string'), ('fanout_json', 'string'), ('products_json', 'string'),
                   ('ads_json', 'string'), ('local_json', 'string'), ('model', 'string'), ('detail_json', 'string')]   # F1a (2026-10-23): the brand NAMED in the text (mentioned = named or cited), its place among the businesses offered, every business with its role (JSON [{id, name, role, position, cited}]). v4.12: the exact third-party pages the answer cited (JSON [{u, t}], max 8) — the earned-media targets. v4.9: weekly / full / pulse / on_demand, how the answer speaks of you, brands in order, wrong claims, the searches the engine ran
AI_VIS_COLS = [('site_id', 'string'), ('domain', 'string'), ('run_id', 'string'), ('checked_at', 'string'), ('prompts', 'number'), ('answers', 'number'), ('mention_rate', 'number'), ('citation_rate', 'number'), ('share_of_voice', 'number'),
               ('avg_rank', 'number'), ('aio_presence', 'number'), ('aio_citation_rate', 'number'), ('engines_json', 'string'), ('competitors_json', 'string'), ('sources_json', 'string'), ('pages_json', 'string'), ('gaps_json', 'string'),
               ('market_json', 'string'), ('market_month', 'string'), ('cost_usd', 'number'), ('alerts', 'string'),
               ('run_kind', 'string'), ('samples', 'number'), ('visibility_score', 'number'), ('mention_lo', 'number'), ('mention_hi', 'number'), ('sentiment_score', 'number'), ('accuracy_issues', 'number'),
               ('ai_sessions', 'number'), ('ai_conversions', 'number'), ('ai_revenue', 'number'), ('index_sov', 'number'), ('ai_impressions', 'number'),
               ('perception_json', 'string'), ('traffic_json', 'string'), ('access_json', 'string'), ('index_json', 'string'), ('clusters_json', 'string'),   # v4.9 (AI_VISIBILITY_SPEC.md)
               ('rival_sources_json', 'string'),   # wave 3 (W3-F via W3-E): the rival businesses' own pages AI cites, read by Growth_Plan.js
               # G6 (2026-10-18): rates per engine x cluster x persona x market with ranges and BH-corrected changes; the panel this run asked
               # (question ids, engines, composition, the pulse's sample, achievable half-widths) so the next delta can be refused when it changed;
               # how many executions the run took
               ('segments_json', 'string'), ('panel_json', 'string'), ('chunks', 'number'),
               # F1b (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F1b.md): the measurement rule the row was counted under (a row of another
               # rule is never compared), "named in" by its own name (mention_rate holds the same figure from this rule on), the place in the
               # answers (mean place when named, share named first, position-weighted visibility), the period counted (A8), the comparison every
               # reader shares (compare_json, A1) and the counts the next run is compared against (metrics_json)
               ('rule_version', 'string'), ('named_rate', 'number'), ('avg_position', 'number'), ('first_rate', 'number'), ('pos_visibility', 'number'),
               ('rate_period', 'string'), ('compare_json', 'string'), ('metrics_json', 'string'),
               # W2-E1 (2026-10-23, WAVE2_CONTRACTS.md §2): your pages AI read / cited and the page cited instead, product cards, ads and local cards.
               # sources_json (above) changes shape from this rule on: {v: 2, types, domains, n, list: <the old array>} (old rows hold the array)
               ('urls_json', 'string'), ('shopping_json', 'string'), ('ads_local_json', 'string')]
# v4.9: one row per site per day from the AI Pulse (the panel on the fast engines; small aggregates, no answer text)
AI_DAILY_TABLE = 'seo_ai_daily'
AI_DAILY_COLS = [('site_id', 'string'), ('domain', 'string'), ('date', 'string'), ('checked_at', 'string'), ('run_id', 'string'), ('samples', 'number'), ('mentioned', 'number'), ('cited', 'number'),
                 ('mention_rate', 'number'), ('citation_rate', 'number'), ('share_of_voice', 'number'), ('visibility_score', 'number'), ('engines_json', 'string'), ('prompts_json', 'string'),
                 ('competitors_json', 'string'), ('sources_json', 'string'), ('alerts', 'string'), ('cost_usd', 'number'),
                 ('sample_json', 'string'),   # G6 (2026-10-18): the morning's rotating sample — mode, N a week, questions asked of the panel, strata covered
                 # F1b (2026-10-23): the rule the morning was counted under (mentioned = NAMED from it on), whether it asked the whole panel or a
                 # rotating sample, how many questions, which engines answered, a partial morning (an engine asked returned nothing), the mean
                 # place, the per-answer record the weekly run pools (named, cited, place, competitors named) and what could be read (A7)
                 ('rule_version', 'string'), ('sample_mode', 'string'), ('questions_asked', 'number'), ('engines_answered', 'string'), ('partial', 'boolean'),
                 ('avg_position', 'number'), ('detail_json', 'string'), ('readable_json', 'string')]
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
               ('findings', 'number'), ('critical', 'number'), ('high', 'number'), ('medium', 'number'), ('low', 'number'), ('scheduled', 'boolean'), ('request_id', 'string'),
               # B-5 + INVARIANTS rule 1 (F-B, 2026-10-17): whether the crawl ran JavaScript (a JavaScript crawl is never compared like for like
               # with a plain one), the version of the engine's checks the audit ran (a finding that left the list because a check changed is
               # not "fixed"), and the keys the engine did not count as fixed, as JSON text, so the app's lists follow (run sync_tables.py)
               ('crawl_js', 'boolean'), ('checks_version', 'string'), ('not_fixed_json', 'string')]
AUDIT_FINDINGS_COLS = [('site_id', 'string'), ('domain', 'string'), ('audit_id', 'string'), ('audited_at', 'string'), ('finding_key', 'string'), ('category', 'string'), ('severity', 'string'), ('title', 'string'), ('affected_count', 'number'),
                       # R19 (2026-10-14, FIX_PLAN §3.12): how many pages the count above was measured on. 31 of 45 URL inspections failed in
                       # execution 550, so a finding measured on 14 pages was compared with one measured on 25 and called an improvement.
                       # With the sample stored, the next audit prints "not compared: the sample moved" instead of a delta (run sync_tables.py).
                       ('checked', 'number'),
                       # G26 (2026-10-12, FIX_PLAN): the impact weight that ordered the fix list (severity x pages affected x their clicks and
                       # impressions x their place in the site) and the one sentence that explains it, so the app can order the same way
                       ('impact', 'number'), ('impact_basis', 'string'),
                       # G11 (2026-10-13, FIX_PLAN): "I fixed this" in the app sets recheck_state to `requested` (with recheck_requested_at);
                       # the next daily Page Watch answers it on the site's key pages and writes back `fixed` / `still_open` / `not_checked`
                       # with the rule it used and one sentence of evidence - days instead of waiting for the next monthly audit (1.10).
                       ('recheck_state', 'string'), ('recheck_requested_at', 'string'), ('recheck_at', 'string'), ('recheck_rule', 'string'), ('recheck_note', 'string'),
                       # B5-11 (W3-G, 2026-10-17): the finding's evidence line and up to 5 example addresses (JSON text), so the read API
                       # (`GET /api/v1/websites/:id/audits/:auditId`) can say WHY a finding is there; rows before this answer null (run sync_tables.py)
                       ('evidence', 'string'), ('sample_urls', 'string'),
                       # B-5 (F-B, 2026-10-17): the version of the check that raised the finding (Audit_Diff CHECK_CHANGES); '' on older rows
                       ('check_version', 'string')]

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
                        ('created_at', 'string'), ('updated_at', 'string'),
                        # 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §5.5 / §14): who chose a ladder's keyword (client_typed | client_picked |
                        # system_announced; '' = client_typed) and, on the '_site' row, the website's autopilot level (1 | 2 | 3; empty = 2)
                        ('chosen_by', 'string'), ('autopilot_level', 'number'),
                        # F-KW (2026-10-20, plan §5.6): when the app's fresh Keyword Check of a ladder planned 60+ days ago PASSED (ISO). The Content
                        # Cadence writes no page of such a ladder until it is set (a check that fell pauses the ladder instead). Written by the app.
                        ('rechecked_at', 'string')]

# ---- the per-website 7-day cycle (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4 / §7 / §14; app mirror app/shared/src/cycles.ts) ----
# seo_cycles: one row per website (upsert by site_id), written by the Site Kickoff and the Cycle Dispatcher. Times are ISO UTC; tz is IANA;
# cycle_weekday 0-6 (Sunday 0) in tz; local_time 'HH:MM'; monthly_day 1-28; current_key 'cyc:<site_id>:<YYYY-MM-DD>' (the local due date).
CYCLES_TABLE = 'seo_cycles'
CYCLES_COLS = [('site_id', 'string'), ('domain', 'string'), ('anchor_at', 'string'), ('tz', 'string'), ('cycle_weekday', 'number'), ('local_time', 'string'),
               ('monthly_day', 'number'), ('next_due_at', 'string'), ('next_preview_at', 'string'), ('current_key', 'string'), ('status', 'string'),
               ('skip_jobs', 'string'), ('last_cycle_at', 'string'), ('last_monthly_key', 'string'), ('adopted', 'boolean'), ('updated_at', 'string')]
# seo_cycle_jobs: one row per website x cycle x job (upsert by key = '<cycle_key>:<job>'), written by the dispatcher BEFORE it starts the job
# (record-then-start). status: starting | running | done | skipped | refused | failed | gave_up; ledger_key 'cycle:<cycle_key>:<job>'.
CYCLE_JOBS_TABLE = 'seo_cycle_jobs'
CYCLE_JOBS_COLS = [('key', 'string'), ('site_id', 'string'), ('cycle_key', 'string'), ('job', 'string'), ('workflow_id', 'string'), ('status', 'string'),
                   ('attempts', 'number'), ('run_id', 'string'), ('ledger_key', 'string'), ('monthly', 'boolean'), ('reason', 'string'), ('due_at', 'string'),
                   ('started_at', 'string'), ('finished_at', 'string'), ('updated_at', 'string')]
# seo_skips: the client's decisions on the "Coming up" plan, written by the app; read by the Content Cadence. key '<site_id>:<cycle_key|always>:<item_key>',
# item_key = the normalised keyword (lower case, non-alphanumerics -> one space); decision skip | approve; scope cycle | always.
SKIPS_TABLE = 'seo_skips'
SKIPS_COLS = [('key', 'string'), ('site_id', 'string'), ('cycle_key', 'string'), ('item_key', 'string'), ('decision', 'string'), ('scope', 'string'),
              ('by', 'string'), ('created_at', 'string'),
              # F-KW (2026-10-20): the item an approval is for (the CyclePreviewItem's source and ladder_id), so it never approves another page
              # that shares the keyword; empty = an older keyword-only row (approved only when one item alone has that keyword)
              ('source', 'string'), ('ladder_id', 'string')]

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
                   ('cost_mode', 'string'), ('ai_usd', 'number'), ('measured_usd', 'number'), ('estimated_usd', 'number'), ('cost_basis', 'string'),
                   # B-A5 (2026-10-15, build section 62): only the DAY was reconciled against the account, never the run — and a run cannot
                   # say what it truly cost unless it happens to be the only one in flight. Every settle now takes a second free
                   # `appendix/user_data` reading (`dfs_balance_end`) and stamps the moment it settled (`settled_at`), so the move between
                   # a row's two readings can be attributed to that row when no other row was open across its window, and `dfs_source`
                   # says which figure the row carries: 'account' (measured against the balance) or 'tasks' (its own per-task sum).
                   ('settled_at', 'string'), ('dfs_balance_end', 'number'), ('dfs_source', 'string')]

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
    # B6-7 (2026-10-15, benchmark area 6): Monitor_Ledger_Row multiplies this by the number of PLAN ITEMS, and the Rank Tracker's
    # plan emits one item per keyword check - so $0.15 reserved $0.15 a CHECK and a ten-check week held $1.50 of the day's budget
    # for $0.15 of work. It is the measured per-check price now (depth 50, $0.015), so the reservation is what the run will spend,
    # and B6-7's own keyword checks move it by exactly what they cost. The settle takes the provider's measured figure (R28).
    'rank_tracker':    {'ai': 0.0,  'dfs': 0.015},   # ONE depth-50 SERP check, measured; the plan emits one item per check
    'site_tracker':    {'ai': 0.03, 'dfs': 0.01},    # the site brief; Search Console / GA4 / Trends are free
    'content_cadence': {'ai': 0.0,  'dfs': 0.0},     # it plans and spawns; every page run reserves its own row
    # R32's companion (2026-10-14, FIX_PLAN §3.13): the daily key-page watch spends nothing (25 plain GETs, no DataForSEO, no Claude) but
    # kept no row at all, so it was invisible to the guard and to the day's reconciliation. It reserves nothing and settles nothing.
    'page_watch':      {'ai': 0.0,  'dfs': 0.0},
    # W3-F (2026-10-17): the Reply Reader classifies ONE reply with Haiku (about 1k tokens in, 300 out); the web app calls it per reply and waits
    'reply_read':      {'ai': 0.003, 'dfs': 0.0},
}


def monitor_ledger_js(v5_dir, mode, plan_node, row_node, measured=''):
    """R9: the reserve and settle Code-node sources for one scheduled workflow, filled in from v5/code/Monitor_Ledger_*.js.
    `plan_node` knows how many sites this run covers, `row_node` is the reserve node's own name, and `measured` is the node that
    carries the run's real DataForSEO cost as `cost_usd` ('' when the workflow has none).
    R31 (2026-10-14, FIX_PLAN §3.13): the settle carries the shared cost kit and the list of this workflow's Claude nodes, so a run in
    which no model ran settles nothing instead of the figure it reserved. `__AI_NODES__` is filled in at WRITE time by
    ledger_mainline(), which is the first moment the whole workflow — model nodes and all — exists."""
    import json as _json, os as _os
    assert mode in LEDGER_EST, 'no ledger estimate for ' + mode
    rd = lambda f: open(_os.path.join(v5_dir, 'code', f), encoding='utf-8').read()
    cost_cal = rd('_cost_cal.js').rstrip('\n')
    tag = ledger_tag({'reserve': row_node})
    reserve = (rd('Monitor_Ledger_Row.js').replace('__PLAN__', plan_node).replace('__MODE__', mode)
               .replace('__BALANCE__', 'DFS Balance (' + tag + ')')
               .replace('__EST__', _json.dumps(LEDGER_EST[mode], sort_keys=True)))
    settle = (rd('Monitor_Ledger_Settle.js').replace('/*__COST_CAL__*/', cost_cal)
              .replace('__ROW__', row_node).replace('__MEASURED__', measured))
    for ph in ('__PLAN__', '__MODE__', '__EST__', '__ROW__', '__MEASURED__', '__BALANCE__', '/*__COST_CAL__*/'):
        assert ph not in reserve and ph not in settle, ph + ' left in the ledger code for ' + mode
    assert '__AI_NODES__' in settle, 'R31: the settle has nowhere to learn this workflow\'s Claude nodes'
    # B-A5 (2026-10-15, section 62): the settle's two new inputs are named at WRITE time by ledger_mainline(), where the tag is known
    # and the nodes are built — exactly as __AI_NODES__ is.
    assert '__BAL_END__' in settle and '__LEDGER__' in settle, 'B-A5: the settle cannot reach the account or the ledger rows'
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
// B-A9 (2026-10-15, build section 64): and it is the gate. R17 put the reservation in front of the spending; nothing ever LOOKED at what was
// already running, so a scheduled monitor could not be refused for concurrency however much was in flight - the one guard every API run
// passes (*Rate Limit*) had no counterpart here. The rules are shared with it (v5/code/_run_guard.js): a run of the same monitor still in
// flight, a heavy crawl of the same site, too many analyses at once, or an account that cannot pay for this run. A refusal costs nothing -
// it happens after the row exists and before the first paid node, and the row is marked `refused` so it never holds a cent of the day.
/*__CATCHUP__*/
/*__RUN_GUARD__*/
const plan = $('__PLAN__').all();
let rows = []; try { rows = $('__LEDGER__').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { rows = []; }
let mine = {}; try { mine = $('__RESERVE__').first().json || {}; } catch (e) { mine = {}; }
if (mine && mine.error) mine = {};
// R77 (2026-10-16, re-rating C-1): the run that started this one, by identity. The front door's own row has the same mode and is still
// `reserved` when an on-demand monitor reads the ledger, so the mode alone made the child refuse itself (exec 624). The child's row names
// its parent in its key (Monitor_Ledger_Row: `parent:<id>`), and the trigger item carries it too; a genuine twin is still refused.
// R116: and the refusal knows who is waiting for it — an on-demand run's trigger carries the caller's callback and request id.
let __trig = {};
for (const __n of ['Manual Run', 'Watch Run']) { try { const __t = $(__n).first(); if (__t && __t.json) { __trig = __t.json; break; } } catch (e) {} }
if (__trig.body && typeof __trig.body === 'object') __trig = { ...__trig, ...__trig.body };
let __row = {}; try { __row = $('__ROW__').first().json || {}; } catch (e) { __row = {}; }
const __S = (v) => String(v == null ? '' : v).trim();
const parent_run_id = RG.parentOf(mine) || RG.parentOf(__row) || __S(__trig.parent_run_id);
// R94 follow-up (2026-10-16, A14): a run started by its OWN Schedule Trigger whose latest due slot the catch-up already ran (seo_cache
// `catchup:<workflow id>:<due ISO>`, written before it starts) is the delayed timer of a week that is done - a sleeping Mac delivers a
// fire hours late, and the catch-up starts it after 6 h, so without this the week ran twice. A catch-up start enters through the Execute
// Workflow Trigger, so the Schedule Trigger node has no data in it and nothing is checked.
const __SCHED = __SCHED_JSON__;
let __caught = null;
if (__SCHED.trigger && __SCHED.cron) {
  let __fire = null; try { const __t = $(__SCHED.trigger).first(); __fire = __t && __t.json ? __t.json : null; } catch (e) { __fire = null; }
  if (__fire) {
    try {
      const __ft = Date.parse(String(__fire.timestamp || '')) || Date.now();
      const __due = CU.lastDue(__SCHED.cron, __SCHED.tz, __ft);
      let __recs = []; try { __recs = $('__CATCHREC__').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { __recs = []; }
      __caught = RG.caughtUp({ records: __recs, workflow_id: __SCHED.wf, due: __due ? new Date(__due).toISOString() : '' });
    } catch (e) { __caught = null; }   // fail OPEN: a scheduled run is never refused for a lookup that did not work
  }
}
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): the twin rule is per website for a run that names one - a cycle job or an on-demand start
// (trigger `domain`, or `site_id` with the domain on this run's row). A run that names none (the daily batch pulse / page watch) keeps the
// mode-only rule. A cycle job's capacity refusal is retried by the Cycle Dispatcher, so its wording says so instead of "skipped".
const __site = __S(__trig.domain) || (__S(__trig.site_id) ? __S((mine && mine.domain) || (__row && __row.domain)) : '');   // RG.gate normalises the host
const __cycle = __S(__trig.trigger) === 'cycle';
const g = RG.gate({ rows, mine, mode: '__MODE__', where: '__WHERE__', run_id: String($execution.id), site: __site, cycle: __cycle, caught_up: __caught, parent_run_id });
if (g.allowed || __NO_GATE__) return plan;   // W3-F: a synchronous caller is waiting (the Reply Reader): it keeps its row but is never refused by what else is running
let __dom = __S(__trig.domain);
if (!__dom) { try { __dom = __S((plan[0] && plan[0].json || {}).domain); } catch (e) { __dom = ''; } }
return [{ json: { run_refused: true, run_id: String($execution.id), refused_at: new Date().toISOString(),
  // 2026-10-19: the reason code first, so the Cycle Dispatcher (which reads only the ledger row) tells a capacity refusal it retries
  // (`same_mode`, `heavy_busy`, `too_many_open`) from one it does not (`account_low`, `caught_up`)
  cost_basis: ('refused before any spending (' + g.reason + '): ' + g.refusal + ' [' + g.basis + ']').slice(0, 400),
  retry: !!g.retry, cycle_key: __cycle ? __S(__trig.cycle_key) : '', site: g.site || '',
  reason: g.reason, refusal: g.refusal, basis: g.basis, open_runs: g.open_runs, open: g.open, max_open: g.max_open,
  stale_ignored: g.stale_ignored, mode: g.mode, where: g.where, parent_run_id,
  // R116: who to tell. Only a run started by hand (a Manual Run with a callback) has someone waiting; a scheduled refusal has nobody.
  callback_url: __S(__trig.callback_url), request_id: __S(__trig.request_id), domain: __dom.toLowerCase(),
  monitor: __S(__trig.monitor) || g.mode, on_demand: !!__S(__trig.callback_url) } }];
"""

# ---- B-A7 / B-A9 (2026-10-15, build section 64): the kits the ledger chain inlines, read once from v5/ ----
OPS_ALERT_SRC = read_v5('code/_ops_alert.js').rstrip('\n')
ALERT_RETRY_SRC = read_v5('code/_alert_retry.js').rstrip('\n')
RUN_GUARD_SRC = read_v5('code/_run_guard.js').rstrip('\n')
CATCHUP_SRC = read_v5('code/_catchup.js').rstrip('\n')   # R94 follow-up: CU.lastDue, so a scheduled run can name its own due slot


def _schedule_of(wfobj):
    """R94 follow-up: the Schedule Trigger of a workflow as {trigger, cron, tz, wf} (the same five-field cron build_catchup.py plans with), or {}."""
    trig = [n for n in wfobj['nodes'] if n.get('type') == 'n8n-nodes-base.scheduleTrigger']
    if not trig:
        return {}
    assert len(trig) == 1, 'R94: more than one Schedule Trigger in ' + str(wfobj.get('name'))
    ivs = trig[0]['parameters']['rule']['interval']; assert len(ivs) == 1, 'R94: a Schedule Trigger with several rules in ' + str(wfobj.get('name'))
    iv = ivs[0]; f = iv.get('field')
    if f == 'cronExpression':
        cron = ' '.join(str(iv['expression']).split()[-5:])
    elif f == 'weeks':
        cron = '%d %d * * %s' % (int(iv['triggerAtMinute']), int(iv['triggerAtHour']), ','.join(str(d) for d in (iv.get('triggerAtDay') or [])) or '*')
    elif f == 'days':
        cron = '%d %d * * *' % (int(iv['triggerAtMinute']), int(iv['triggerAtHour']))
    else:
        raise AssertionError('R94: schedule field "' + str(f) + '" in ' + str(wfobj.get('name')) + ' is not taught to the run guard')
    from env_settings import ENV
    tz = (wfobj.get('settings') or {}).get('timezone') or (ENV.get('GENERIC_TIMEZONE') or '').strip() or 'America/New_York'
    return {'trigger': trig[0]['name'], 'cron': cron, 'tz': tz, 'wf': str(wfobj.get('id'))}


def engine_tz():
    """The engine's own time zone (n8n's GENERIC_TIMEZONE; America/New_York when unset, as n8n/compose.yml and the catch-up default it)."""
    from env_settings import ENV
    return (ENV.get('GENERIC_TIMEZONE') or '').strip() or 'America/New_York'


def site_time_src():
    """2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): the website-calendar kit (ST, v5/code/_site_time.js) with the engine zone written in.
    Every builder inlines it through the `/*__SITE_TIME__*/` marker (inside _monitor_sites.js for the monitors, directly elsewhere)."""
    s = read_v5('code/_site_time.js').rstrip('\n').replace('__ENGINE_TZ__', engine_tz())
    assert '__ENGINE_TZ__' not in s
    return s


def inline_kits(src):
    """Replace the kit markers with the one copy of each kit (the same markers every builder uses)."""
    return (src.replace('/*__OPS_ALERT__*/', OPS_ALERT_SRC)
               .replace('/*__ALERT_RETRY__*/', ALERT_RETRY_SRC)
               .replace('/*__RUN_GUARD__*/', RUN_GUARD_SRC)
               .replace('/*__CATCHUP__*/', CATCHUP_SRC))


def _if_params(nid, expr):
    """A boolean IF node's parameters (the same shape all three builders write)."""
    return {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
                           'conditions': [{'id': nid, 'leftValue': '=' + expr, 'rightValue': '',
                                           'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'},
            'looseTypeValidation': True, 'options': {}}


def ledger_tag(wiring):
    """The tag of a ledger wiring entry ('Run Ledger Row (Pulse)' -> 'Pulse')."""
    r = str(wiring['reserve'])
    assert r.startswith('Run Ledger Row (') and r.endswith(')'), 'unexpected reserve node name: ' + r
    return r[len('Run Ledger Row ('):-1]


_LEDGER_NS = _uuid.UUID('7c1f2a44-0b3e-4e6a-9d21-5e8a1c0f4b77')


#  R31 / R32 (2026-10-14, FIX_PLAN §3.13): the free balance probe every scheduled run now takes, and the list of this workflow's own
#  Claude nodes that its settle checks before it settles a cent. Both are filled in at write time, when the whole workflow exists.
DFS_BALANCE_URL = 'https://api.dataforseo.com/v3/appendix/user_data'   # free, answers in milliseconds, no cost to the account


# B-C2 (2026-10-15, build section 84): the one FREE Anthropic endpoint. `/v1/messages/count_tokens` costs nothing and is called on the
# main path behind every agent to measure what that agent really sent and received. The URL is what identifies it, not the node's name,
# so a paid call cannot slip past by being called "Count …" — the same rule R32 used for `appendix/user_data`.
ANTHROPIC_COUNT_URL = 'https://api.anthropic.com/v1/messages/count_tokens'


def _ai_nodes_of(wfobj):
    """Every Claude node of this workflow that SPENDS, as the names that appear in the run data: an `lmChatAnthropic` model node never
    runs on the main path (it hangs off its agent on an `ai_languageModel` connection and has no items of its own), so the AGENT is what
    a settle can ask about; an HTTP node that carries the Anthropic credential is itself the call — unless it is the free token counter,
    which bills nothing and whose presence must never be read as "a model ran" (B-C2)."""
    conns, out = wfobj.get('connections') or {}, set()
    for n in wfobj['nodes']:
        t = str(n.get('type') or '')
        if 'lmChatAnthropic' in t:
            for lst in ((conns.get(n['name']) or {}).get('ai_languageModel') or []):
                for tgt in (lst or []): out.add(tgt['node'])
        elif 'lmChat' not in t and str((n.get('parameters') or {}).get('url') or '') != ANTHROPIC_COUNT_URL \
                and any(isinstance(c, dict) and c.get('id') == 'SEOcredAnthropic'
                        for c in (n.get('credentials') or {}).values()):
            out.add(n['name'])
    return sorted(out)


def _no_dfs_probe(spec):
    """W3-F: a workflow that never calls DataForSEO (the Reply Reader) has nothing to read the account balance for. Its two probe nodes keep their
    names and place on the chain (the reserve and the settle read them by name, and read nothing when they answer empty) but are a no-op Code
    node, so the workflow holds no DataForSEO call and the in-200 ratchet (harness/in200_baseline.json) does not grow."""
    for k in ('credentials', 'retryOnFail', 'maxTries', 'waitBetweenTries'): spec.pop(k, None)
    spec['type'], spec['typeVersion'] = 'n8n-nodes-base.code', 2
    spec['parameters'] = {'jsCode': 'return [{ json: {} }];   // no DataForSEO in this workflow: no account balance to read'}
    return spec


def ledger_mainline(wfobj, wiring):
    """R17: move everything the plan node used to feed to the far side of the reserve chain, so no paid node of the workflow can run
    before the ledger row exists. Called at WRITE time, when every connection of the workflow is already made, and it is the one place
    the three builders share. It also makes the two Data Table nodes of the chain `alwaysOutputData` + `continueRegularOutput`: they sit
    in the data path now, so neither may end the run by answering with nothing.
    R31 / R32 (2026-10-14): it also teaches the settle which Claude nodes this workflow has (so a run that called none settles none) and
    puts the free `appendix/user_data` balance reading on the chain, so a scheduled run's spend reaches the day's reconciliation too —
    until now only main-workflow runs took a reading, and the monitors are where most of the DataForSEO money goes."""
    tag = ledger_tag(wiring)
    conns, nodes = wfobj['connections'], {n['name']: n for n in wfobj['nodes']}
    plan, ensure = wiring['plan'], 'Ensure Run Ledger (' + tag + ')'
    reserve, resume = 'Reserve Run Ledger (' + tag + ')', 'After Run Ledger (' + tag + ')'
    for nm in (plan, ensure, reserve, wiring['settle']):
        assert nm in nodes, 'R17: ' + nm + ' is missing from ' + str(wfobj.get('name'))
    # ---- R31: the settle learns this workflow's Claude nodes ----
    settle_code = 'Ledger Settle (' + tag + ')'
    assert settle_code in nodes, 'R31: ' + settle_code + ' is missing from ' + str(wfobj.get('name'))
    ai_nodes = _ai_nodes_of(wfobj)
    src = nodes[settle_code]['parameters']['jsCode']
    assert '__AI_NODES__' in src, 'R31: ' + settle_code + ' does not read the workflow\'s Claude nodes'
    nodes[settle_code]['parameters']['jsCode'] = src.replace('__AI_NODES__', _json.dumps(ai_nodes), 1)
    wiring['ai_nodes'] = ai_nodes
    # ---- R32 / the day's reconciliation: the free balance reading, between Ensure and Row ----
    balance = 'DFS Balance (' + tag + ')'
    if balance not in nodes:
        bx, by = nodes[ensure]['position']
        wfobj['nodes'].append({'parameters': {'method': 'GET', 'url': DFS_BALANCE_URL, 'authentication': 'genericCredentialType',
                                              'genericAuthType': 'httpBasicAuth',
                                              'options': {'timeout': 15000, 'response': {'response': {'neverError': True}}}},
                               'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + balance)), 'name': balance,
                               'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.5, 'position': [bx + 110, by - 150],
                               'credentials': {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}},
                               'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True,
                               'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
        if wiring.get('no_dfs'): _no_dfs_probe(wfobj['nodes'][-1])
        eo = conns.setdefault(ensure, {}).setdefault('main', [])
        while not eo: eo.append([])
        assert any(t['node'] == wiring['reserve'] for t in eo[0]), 'R32: ' + ensure + ' does not feed ' + wiring['reserve']
        eo[0] = [t for t in eo[0] if t['node'] != wiring['reserve']] + [{'node': balance, 'type': 'main', 'index': 0}]
        conns.setdefault(balance, {})['main'] = [[{'node': wiring['reserve'], 'type': 'main', 'index': 0}]]
        nodes[balance] = wfobj['nodes'][-1]
    wiring['balance'] = balance
    # ---- B-A9 (2026-10-15, build section 64): what else is running, read before this run reserves its own row ----
    # The same order *Rate Limit* uses on the API side: the ledger is read first, the row is inserted next, and the gate counts the rows
    # with a lower id than its own, so row order breaks ties and no run slips past while another is counting.
    openrun = 'Load Open Runs (' + tag + ')'
    if openrun not in nodes:
        ox, oy = nodes[balance]['position']
        wfobj['nodes'].append({'parameters': dt_get_all_where_params(RUN_LEDGER_TABLE, [
                                   ('created_at', 'gte', '={{ new Date(Date.now() - ' + str(LEDGER_WINDOW_MS) + ').toISOString() }}')]),
                               'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + openrun)), 'name': openrun,
                               'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [ox + 110, oy + 150],
                               'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
        conns.setdefault(balance, {})['main'] = [[{'node': openrun, 'type': 'main', 'index': 0}]]
        conns.setdefault(openrun, {})['main'] = [[{'node': wiring['reserve'], 'type': 'main', 'index': 0}]]
        nodes[openrun] = wfobj['nodes'][-1]
    wiring['open_runs'] = openrun
    # ---- R94 follow-up: the catch-up's own records (kind `catchup` in seo_cache), read before the reservation, only for a workflow that has a
    # Schedule Trigger. The code keeps this workflow's `catchup:<id>:` keys.
    sched = _schedule_of(wfobj)
    catchrec = 'Load Catch-up Records (' + tag + ')'
    if sched and catchrec not in nodes:
        cx, cy = nodes[openrun]['position']
        wfobj['nodes'].append({'parameters': dt_get_all_where_params(CACHE_TABLE, [('kind', 'eq', 'catchup')]),
                               'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + catchrec)), 'name': catchrec,
                               'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [cx + 110, cy + 150],
                               'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
        nodes[catchrec] = wfobj['nodes'][-1]
        conns.setdefault(openrun, {})['main'] = [[{'node': catchrec, 'type': 'main', 'index': 0}]]
        conns.setdefault(catchrec, {})['main'] = [[{'node': wiring['reserve'], 'type': 'main', 'index': 0}]]
    wiring['catchup_records'] = catchrec if sched else ''
    assert resume not in nodes, 'R17: ' + resume + ' already exists (ledger_mainline ran twice)'
    outs = conns.setdefault(plan, {}).setdefault('main', [])
    while not outs: outs.append([])
    downstream = [t for t in outs[0] if t['node'] != ensure]
    assert downstream, 'R17: ' + plan + ' feeds nothing but the ledger - there is no pipeline to put behind the reservation'
    assert any(t['node'] == ensure for t in outs[0]), 'R17: ' + plan + ' does not start the ledger chain'
    outs[0] = [{'node': ensure, 'type': 'main', 'index': 0}]
    x, y = nodes[reserve]['position']
    wfobj['nodes'].append({'parameters': {'jsCode': inline_kits(LEDGER_RESUME_JS)
                                          .replace('__PLAN__', plan).replace('__LEDGER__', openrun).replace('__RESERVE__', reserve)
                                          .replace('__ROW__', str(wiring['reserve']))
                                          .replace('__SCHED_JSON__', _json.dumps(sched)).replace('__CATCHREC__', catchrec)
                                          .replace('__MODE__', str(wiring['mode'])).replace('__WHERE__', str(wfobj.get('name') or tag))
                                          .replace('__NO_GATE__', 'true' if wiring.get('no_gate') else 'false')},
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + resume)), 'name': resume,
                           'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [x + 220, y]})
    nodes[resume] = wfobj['nodes'][-1]
    router = conns.setdefault(reserve, {}).setdefault('main', [])
    while not router: router.append([])
    router[0] = [t for t in router[0] if t['node'] != resume] + [{'node': resume, 'type': 'main', 'index': 0}]
    # ---- B-A9: the gate's two ways out. The pipeline hangs off "yes"; "no" marks the row refused and the run ends there, having spent
    # nothing (a `refused` row is skipped by every count, so a skipped run never holds a cent of the day's budget either).
    allow, refuse = 'Run Allowed? (' + tag + ')', 'Refuse Run Ledger (' + tag + ')'
    assert allow not in nodes and refuse not in nodes, 'B-A9: the guard of ' + str(wfobj.get('name')) + ' is already built'
    wfobj['nodes'].append({'parameters': _if_params(str(_uuid.uuid5(_LEDGER_NS, allow + ':cond')), '{{ !$json.run_refused }}'),
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + allow)), 'name': allow,
                           'type': 'n8n-nodes-base.if', 'typeVersion': 2.3, 'position': [x + 440, y]})
    wfobj['nodes'].append({'parameters': dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS,
                               [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
                               {'status': 'refused', 'settled_usd': 0, 'dfs_usd': 0, 'measured_usd': 0, 'estimated_usd': 0,
                                'settled_at': '={{ $json.refused_at }}', 'cost_basis': '={{ $json.cost_basis }}'}),
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + refuse)), 'name': refuse,
                           'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [x + 660, y + 200],
                           'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
    nodes[allow], nodes[refuse] = wfobj['nodes'][-2], wfobj['nodes'][-1]
    conns.setdefault(resume, {})['main'] = [[{'node': allow, 'type': 'main', 'index': 0}]]
    conns.setdefault(allow, {})['main'] = [downstream, [{'node': refuse, 'type': 'main', 'index': 0}]]
    for nm in (ensure, reserve):
        nodes[nm]['alwaysOutputData'] = True
        nodes[nm]['onError'] = 'continueRegularOutput'
    wiring['resume'] = resume
    wiring['guard'] = {'load': openrun, 'gate': resume, 'if': allow, 'refuse': refuse, 'kit': 'RG'}
    # ---- R96 / R116 (2026-10-16, re-rating C-20 / D-20, build section 96): what a refusal does after it marks its row ----
    # R96: the refusal used to fall into the settle chain like any other loose end — *DFS Balance End* (exec 624 waited 5 min 33 s on it
    # behind another run's DataForSEO calls), *Load Run Ledger*, *Ledger Settle* (which computed "$0.45 estimated, done" for a run that
    # spent nothing) and *Settle Run Ledger* (whose `status = reserved` filter then matched nothing, so the figure was dropped). The
    # refused row is already settled by the refusal itself — `refused`, $0, `settled_at`, the reason — so the run ends at its own notice.
    # R116: and the caller who is waiting for an on-demand run hears why it did not run: `{stage: rejected, status: rejected, error,
    # request_id}` to the trigger's callback (v5/code/Refusal_Notice.js); a scheduled refusal posts nothing.
    notice, tell, post = 'Refusal Notice (' + tag + ')', 'Tell Caller (' + tag + ')?', 'Post Refusal (' + tag + ')'
    assert not any(n in nodes for n in (notice, tell, post)), 'R116: the refusal notice of ' + str(wfobj.get('name')) + ' is already built'
    rx, ry = nodes[refuse]['position']
    wfobj['nodes'].append({'parameters': {'jsCode': read_v5('code/Refusal_Notice.js').replace('__RESUME__', resume)},
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + notice)), 'name': notice,
                           'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [rx + 220, ry],
                           'onError': 'continueRegularOutput', 'executeOnce': True})
    wfobj['nodes'].append({'parameters': _if_params(str(_uuid.uuid5(_LEDGER_NS, tell + ':cond')), '{{ !$json.skip }}'),
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + tell)), 'name': tell,
                           'type': 'n8n-nodes-base.if', 'typeVersion': 2.3, 'position': [rx + 440, ry]})
    wfobj['nodes'].append({'parameters': {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json',
                                          'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'timeout': 30000}},
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + post)), 'name': post,
                           'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.5, 'position': [rx + 660, ry - 100],
                           'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
    for nm in (notice, tell, post): nodes[nm] = next(n for n in wfobj['nodes'] if n['name'] == nm)
    conns.setdefault(refuse, {})['main'] = [[{'node': notice, 'type': 'main', 'index': 0}]]
    conns.setdefault(notice, {})['main'] = [[{'node': tell, 'type': 'main', 'index': 0}]]
    conns.setdefault(tell, {})['main'] = [[{'node': post, 'type': 'main', 'index': 0}], []]
    wiring['guard'].update({'notice': notice, 'tell': tell, 'post': post, 'post_max_tries': 3})
    # the refusal IS where a refused row is settled (it writes status, $0, settled_at and the reason), so it is one of the run's settle
    # ends — and the walk below must not wire its branch into the balance read and the settle code
    wiring['settle_from'] = sorted(set(wiring.get('settle_from') or []) | {refuse})
    # ---- R31 (2026-10-14, FIX_PLAN §3.13): every end of the run reaches the settle ----
    # The settle hung off the report node only, so a run that found nothing to do (the `Nothing To Do (…)` branch every monitor has)
    # reserved a row and then finished without ever settling it — the row sat `reserved` against the guard until *Release Stale Runs*
    # cleared it two hours later. A crashed run is what the stale release is for; a run that simply had nothing to do is not. Walk
    # forward from the resume node, refusing to pass anything that already feeds the settle: whatever still ends with no outgoing
    # connection is wired into the settle here, in the one place the three builders share.
    settle_code = 'Ledger Settle (' + tag + ')'
    outs_of = lambda nd: [t['node'] for lst in ((conns.get(nd) or {}).get('main') or []) for t in (lst or [])]
    blocked = set(wiring.get('settle_from') or []) | {settle_code, wiring['settle']}   # R96: settle_from holds the refusal, so its branch stays apart
    seen, stack = {resume}, [resume]
    while stack:
        cur = stack.pop()
        if cur in blocked: continue
        for t in outs_of(cur):
            if t not in seen: seen.add(t); stack.append(t)
    loose = sorted(n for n in seen if n not in blocked and n in nodes and not outs_of(n))
    for nm in loose:
        o = conns.setdefault(nm, {}).setdefault('main', [])
        while not o: o.append([])
        o[0] = o[0] + [{'node': settle_code, 'type': 'main', 'index': 0}]
    wiring['settle_from'] = sorted(set(wiring.get('settle_from') or []) | set(loose))
    wiring['settle_from_ends'] = loose   # the branches that used to finish without settling
    _ledger_settle_chain(wfobj, wiring, tag, settle_code, conns, nodes)
    _alert_retry_chain(wfobj, wiring, tag, conns, nodes)
    # R96: the proof, recorded for the harness (S115) — every node a refusal can reach. None of them may be a DataForSEO call, the balance
    # read or the settle chain.
    seen_r, stack_r = {refuse}, [refuse]
    while stack_r:
        for t in outs_of(stack_r.pop()):
            if t not in seen_r: seen_r.add(t); stack_r.append(t)
    wiring['guard']['refusal_path'] = sorted(seen_r)
    for n in seen_r:
        nd = nodes.get(n) or {}
        assert 'dataforseo.com' not in str((nd.get('parameters') or {}).get('url') or ''), 'R96: the refusal of ' + str(wfobj.get('name')) + ' reaches ' + n
        assert n not in (wiring.get('balance_end'), wiring.get('ledger_load'), settle_code, wiring['settle']), \
            'R96: the refusal of ' + str(wfobj.get('name')) + ' reaches the settle chain at ' + n
    return resume


#  B-A7 (2026-10-15, build section 64): the sweep that re-attempts an undelivered alert.
#  An alert got one attempt per channel. If that attempt failed - and SMTP failed on 2026-10-10 and again on 2026-10-12, which is why the
#  webhook channel exists at all - the row sat at `pending` or `failed` and nobody was ever told. Rule 3 of INVARIANTS.md ends on the clause
#  that matters: *a failure that reaches no human is not handled.*
#  A retry needs a clock. Rather than invent one, it borrows the ten that already exist: the LAST thing every scheduled run does, after its
#  row is settled and when there is nothing left to spend or delay, is ask whether an alert is still waiting and re-send up to five of them.
#  Page Watch runs daily at 05:45, the AI Pulse daily at 06:30, six more between 07:00 and 11:00 on Mondays, the Audit Scheduler monthly -
#  and the Error Handler carries the same chain, so a second failure also sweeps the first one's undelivered alert.
#  It sits behind the settle on purpose: it can never delay the run's own work, and it runs on the branches that found nothing to do too.
def _alert_retry_chain(wfobj, wiring, tag, conns, nodes):
    settle = wiring['settle']
    names = ['Ensure Ops Alerts (' + tag + ')', 'Load Open Alerts (' + tag + ')', 'Alert Retry Plan (' + tag + ')',
             'Any Alert Retry (' + tag + ')?', 'Post Alert Retry (' + tag + ')', 'Alert Retry Result (' + tag + ')',
             'Save Alert Retry (' + tag + ')']
    assert not any(n in nodes for n in names), 'B-A7: the alert sweep of ' + str(wfobj.get('name')) + ' is already built'
    ensure_t, load_t, plan_t, if_t, post_t, result_t, save_t = names
    sx, sy = nodes[settle]['position']
    nid = lambda n: str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + n))
    add = lambda spec: (wfobj['nodes'].append(spec), nodes.__setitem__(spec['name'], spec))
    add({'parameters': dt_create_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS), 'id': nid(ensure_t), 'name': ensure_t,
         'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [sx + 220, sy], 'onError': 'continueRegularOutput', 'executeOnce': True})
    # only the rows a retry could still help: an alert nobody has had for a week is past AR.MAX_ATTEMPTS by a wide margin
    add({'parameters': dt_get_all_where_params(OPS_ALERTS_TABLE, [
             ('last_seen_at', 'gte', '={{ new Date(Date.now() - 7 * 864e5).toISOString() }}')]),
         'id': nid(load_t), 'name': load_t, 'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [sx + 440, sy],
         'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
    add({'parameters': {'jsCode': inline_kits(read_v5('code/Alert_Retry_Plan.js')).replace('__LOAD__', load_t)
                        .replace('__ALERT_WEBHOOK_URL__', ALERT_WEBHOOK_PLACEHOLDER).replace('__WHERE__', str(wfobj.get('name') or tag))},
         'id': nid(plan_t), 'name': plan_t, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [sx + 660, sy],
         'onError': 'continueRegularOutput', 'executeOnce': True})
    add({'parameters': _if_params(str(_uuid.uuid5(_LEDGER_NS, if_t + ':cond')), '{{ !$json.skip }}'), 'id': nid(if_t), 'name': if_t,
         'type': 'n8n-nodes-base.if', 'typeVersion': 2.3, 'position': [sx + 880, sy]})
    # fullResponse + neverError: the status code is the evidence of delivery, and a 404 from a revoked hook never reads as success
    add({'parameters': {'method': 'POST', 'url': '={{ $json.webhook_url }}', 'sendBody': True, 'specifyBody': 'json',
                        'jsonBody': '={{ JSON.stringify($json.webhook_body) }}',
                        'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 400}}, 'timeout': 15000,
                                    'response': {'response': {'fullResponse': True, 'neverError': True}}}},
         'id': nid(post_t), 'name': post_t, 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.5, 'position': [sx + 1100, sy],
         'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
    add({'parameters': {'jsCode': inline_kits(read_v5('code/Alert_Retry_Result.js')).replace('__PLAN__', plan_t)},
         'id': nid(result_t), 'name': result_t, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [sx + 1320, sy],
         'onError': 'continueRegularOutput'})
    add({'parameters': dt_update_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, [('alert_key', '={{ $json.alert_key }}')],
             {'delivered': '={{ $json.delivered }}', 'channels': '={{ $json.channels }}', 'severity': '={{ $json.severity }}',
              'attempts': '={{ $json.attempts }}', 'last_attempt_at': '={{ $json.last_attempt_at }}',
              'next_attempt_at': '={{ $json.next_attempt_at }}', 'attempt_log': '={{ $json.attempt_log }}', 'notes': '={{ $json.notes }}'}),
         'id': nid(save_t), 'name': save_t, 'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [sx + 1540, sy],
         'onError': 'continueRegularOutput', 'alwaysOutputData': True})
    for a, b in ((settle, ensure_t), (ensure_t, load_t), (load_t, plan_t), (plan_t, if_t), (post_t, result_t), (result_t, save_t)):
        o = conns.setdefault(a, {}).setdefault('main', [])
        while not o: o.append([])
        o[0] = [t for t in o[0] if t['node'] != b] + [{'node': b, 'type': 'main', 'index': 0}]
    g = conns.setdefault(if_t, {}).setdefault('main', [])
    while len(g) < 2: g.append([])
    g[0] = [{'node': post_t, 'type': 'main', 'index': 0}]
    wiring['alert_retry'] = {'from': settle, 'load': load_t, 'plan': plan_t, 'gate': if_t, 'post': post_t,
                             'result': result_t, 'save': save_t, 'table': OPS_ALERTS_TABLE}


#  B-A5 (2026-10-15, build section 62): a run cannot say what it truly cost unless it happens to be the only one in flight.
#  R28 put one free `appendix/user_data` reading on the RESERVE chain, which is enough to reconcile the DAY (CC.dfsDay) and says nothing
#  about any single run: a run can be out by 100% while the day still agrees. The settle chain now takes a SECOND free reading and loads
#  the ledger rows around this run's window, so CC.dfsRun can attribute the move between the two readings to this run when no other row
#  was open across it, and keep the run's per-task figure — saying why — when one was. Both nodes sit on the MAIN path in front of the
#  settle code, for the same reason R17 moved the reservation there: a side branch runs last, or not at all.
LEDGER_WINDOW_MS = 6 * 60 * 60 * 1000   # how far back the settle loads rows: longer than the longest run and than the stale-release limit


def _ledger_settle_chain(wfobj, wiring, tag, settle_code, conns, nodes):
    bal_end, load = 'DFS Balance End (' + tag + ')', 'Load Run Ledger (' + tag + ')'
    assert bal_end not in nodes and load not in nodes, 'B-A5: the settle chain of ' + str(wfobj.get('name')) + ' is already built'
    sx, sy = nodes[settle_code]['position']
    wfobj['nodes'].append({'parameters': {'method': 'GET', 'url': DFS_BALANCE_URL, 'authentication': 'genericCredentialType',
                                          'genericAuthType': 'httpBasicAuth',
                                          'options': {'timeout': 15000, 'response': {'response': {'neverError': True}}}},
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + bal_end)), 'name': bal_end,
                           'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.5, 'position': [sx - 440, sy],
                           'credentials': {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}},
                           'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True,
                           'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
    if wiring.get('no_dfs'): _no_dfs_probe(wfobj['nodes'][-1])
    wfobj['nodes'].append({'parameters': dt_get_all_where_params(RUN_LEDGER_TABLE, [
                               ('created_at', 'gte', '={{ new Date(Date.now() - ' + str(LEDGER_WINDOW_MS) + ').toISOString() }}')]),
                           'id': str(_uuid.uuid5(_LEDGER_NS, str(wfobj.get('id')) + ':' + load)), 'name': load,
                           'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': [sx - 220, sy],
                           'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
    nodes[bal_end], nodes[load] = wfobj['nodes'][-2], wfobj['nodes'][-1]
    # everything that fed the settle code now feeds the chain that ends in it
    fed = False
    for nm in list(conns.keys()):
        if nm in (bal_end, load): continue
        for lst in ((conns.get(nm) or {}).get('main') or []):
            for t in (lst or []):
                if t['node'] == settle_code: t['node'] = bal_end; fed = True
    assert fed, 'B-A5: nothing feeds ' + settle_code + ' in ' + str(wfobj.get('name'))
    conns.setdefault(bal_end, {})['main'] = [[{'node': load, 'type': 'main', 'index': 0}]]
    conns.setdefault(load, {})['main'] = [[{'node': settle_code, 'type': 'main', 'index': 0}]]
    src = nodes[settle_code]['parameters']['jsCode']
    assert '__BAL_END__' in src and '__LEDGER__' in src, 'B-A5: ' + settle_code + ' does not read the account or the ledger rows'
    nodes[settle_code]['parameters']['jsCode'] = src.replace('__BAL_END__', bal_end).replace('__LEDGER__', load)
    # the row keeps what the account said about this run, and when it settled
    upd = nodes[wiring['settle']]['parameters']['columns']['value']
    upd.update({'settled_at': '={{ $json.settled_at }}', 'dfs_balance_end': '={{ $json.dfs_balance_end }}',
                'dfs_source': '={{ $json.dfs_source }}'})
    wiring['balance_end'], wiring['ledger_load'] = bal_end, load


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
                   ('channels', 'string'), ('delivered', 'string'), ('notes', 'string'),
                   # B-A7 (2026-10-15, build section 64): R6 recorded WHETHER an alert was delivered and nothing ever acted on it — one
                   # attempt per channel, no second try, no escalation, and no ops alert has ever reached a human. These four columns are
                   # what the retry sweep in every scheduled workflow reads and writes: how many times this alert has been SENT (not
                   # sighted — `count` is sightings), when the last attempt was, the earliest moment it may be tried again, and one line
                   # per attempt so the row carries the whole history rather than only its last line.
                   # New columns reach an existing table only through sync_tables.py (apply_env.py runs it).
                   ('attempts', 'number'), ('last_attempt_at', 'string'), ('next_attempt_at', 'string'), ('attempt_log', 'string')]


# =============================================================================
# B-F5 (2026-10-15, FIX_PLAN §3.15): one id rule, so that a rebuild of unchanged sources is byte-identical
# -----------------------------------------------------------------------------
# `build_api.py` minted a fresh uuid4 for every node on every build, so SEO_Agent_API.json and SEO_Agent_Admin_API.json came out
# dirty after any rebuild whether or not anything had changed. That is not cosmetic: today's containment for the missing-.env
# hazard is "always rebuild in the main worktree after a merge and read the diff", and a defaults-bake cannot be told apart from id
# churn by eye.
# The rule: a node's id is uuid5(NS, '<workflow name>:<node name>') -- the natural key, since n8n requires node names to be unique
# inside a workflow and wires `connections` by name, never by id. The ids inside a node's parameters that n8n also wants unique (an
# IF node's conditions, an Assignment node's values) are keyed on the same pair plus where they sit.
# `webhookId` is NOT touched: it is a separate field, it is the public URL path of a Webhook or Form node, and a script-created
# webhook node must keep the one it was given (CLAUDE.md), so changing it would move a live endpoint.
_ID_NS = _uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
_ID_FIELDS = ('conditions', 'assignments', 'values', 'fields')


def node_id(workflow_name, node_name):
    return str(_uuid.uuid5(_ID_NS, str(workflow_name) + ':' + str(node_name)))


def _freeze_inner(obj, stem, path=''):
    """Re-key every `id` inside a node's parameters on (workflow, node, where it sits), so it too is the same on every build."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in _ID_FIELDS and isinstance(v, list):
                for i, el in enumerate(v):
                    if isinstance(el, dict) and isinstance(el.get('id'), str):
                        el['id'] = str(_uuid.uuid5(_ID_NS, stem + '|' + path + '/' + k + '[' + str(i) + ']'))
                    _freeze_inner(el, stem, path + '/' + k + '[' + str(i) + ']')
            else:
                _freeze_inner(v, stem, path + '/' + str(k))
    elif isinstance(obj, list):
        for i, el in enumerate(obj):
            _freeze_inner(el, stem, path + '[' + str(i) + ']')


def freeze_ids(workflow):
    """Called by every builder immediately before it writes a workflow. Returns the workflow."""
    name = workflow.get('name') or workflow.get('id') or ''
    seen = set()
    for n in workflow.get('nodes') or []:
        nm = n.get('name')
        assert nm not in seen, 'two nodes called %r in %r: a node name is the id key, so it must be unique' % (nm, name)
        seen.add(nm)
        n['id'] = node_id(name, nm)
        _freeze_inner(n.get('parameters') or {}, str(name) + ':' + str(nm))
    return workflow


def ids_are_frozen(workflow):
    """-> the nodes whose id is not the one the rule gives. Build section 69 asserts this over every generated workflow."""
    name = workflow.get('name') or workflow.get('id') or ''
    return sorted(n.get('name') for n in (workflow.get('nodes') or []) if n.get('id') != node_id(name, n.get('name')))


# ---- KW-SERP (2026-10-21, RV-12): one results-page reading per search and day, shared by every path ----
# serp_cache_wrap puts the seo_cache lookup around a DataForSEO SERP call that is ALREADY inside its in-200 gate (dfs_gate.splice):
#   <parent> -> SERP Cache Keys (L) -> Load SERP Cache (L) -> SERP Cache Split (L) -> Any SERP To Buy? (L) --yes--> <X> -> ... -> <X> Answers
#                                                                                                      --no (all read today)--+
#   <X> Answers -> SERP With Cache (L) [every request again, in order: today's reading or the answer] -> SERP Cache Rows (L) ->
#   New SERP Readings? (L) -> Save SERP Cache (L) -> Restore SERP (L) -> <what read <X> Answers before>
# The gate's Retry Plan pairs what was SENT (the split's output) with the answers; the readers downstream see the full list unchanged.
# `body_js` is a JS function (item json -> the request body object), so the key, the lookup and the stored row all use the request
# the call really sends. A hit costs nothing and is not stored again; a failed read is never stored (v5/code/_serp_cache.js).
def serp_cache_wrap(wf, http, label, body_js, sc_src, rt_src, what, unit='search', dx=200, dy=-240):
    name = wf.get('name') or ''
    nodes = wf['nodes']; conns = wf.setdefault('connections', {})
    by = {n['name']: n for n in nodes}
    ans_node, plan_node = http + ' Answers', http + ' Retry Plan'
    assert http in by and ans_node in by and plan_node in by, 'KW-SERP: %r is not inside its in-200 gate in %r' % (http, name)
    parents = [(s, bi) for s, o in conns.items() for bi, l in enumerate((o or {}).get('main') or []) for t in (l or []) if t.get('node') == http]
    assert len(parents) == 1, 'KW-SERP: %r must have exactly one parent, found %s' % (http, parents)
    parent, branch = parents[0]
    dsts = [dict(t) for l in ((conns.get(ans_node) or {}).get('main') or []) for t in (l or [])]
    assert dsts, 'KW-SERP: %r feeds nothing' % ans_node
    x, y = by[http]['position']
    K, LD, SP, IF_, WC, RW, NR, SV, RS = ('SERP Cache Keys (%s)' % label, 'Load SERP Cache (%s)' % label, 'SERP Cache Split (%s)' % label,
        'Any SERP To Buy? (%s)' % label, 'SERP With Cache (%s)' % label, 'SERP Cache Rows (%s)' % label, 'New SERP Readings? (%s)' % label,
        'Save SERP Cache (%s)' % label, 'Restore SERP (%s)' % label)
    for nm in (K, LD, SP, IF_, WC, RW, NR, SV, RS):
        assert nm not in by, 'KW-SERP: %r exists already' % nm
    head = sc_src + '\nconst BODY = ' + body_js + ';\n'

    def _n(nm, ntype, ver, params, pos, **extra):
        n = {'parameters': params, 'id': node_id(name, nm), 'name': nm, 'type': ntype, 'typeVersion': ver, 'position': pos}
        n.update(extra); nodes.append(n); return n

    def _code(nm, src, pos, **extra): return _n(nm, 'n8n-nodes-base.code', 2, {'jsCode': src}, pos, **extra)

    def _if(nm, expr, pos):
        return _n(nm, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
            'conditions': [{'id': node_id(name, nm + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
            'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)

    def _link(a, b, out=0):
        outs = conns.setdefault(a, {}).setdefault('main', [])
        while len(outs) <= out: outs.append([])
        if not any(t['node'] == b for t in outs[out]): outs[out].append({'node': b, 'type': 'main', 'index': 0})

    _code(K, head + "// KW-SERP: every request carries the seo_cache key of the results page it asks for (keyword, location, language, device)\n"
          "return $input.all().map(i => { const j = i.json || {}; return { json: { ...j, serp_cache_key: SC.key(BODY(j)) } }; });", [x - 3 * dx, y + dy])
    _n(LD, DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ $json.serp_cache_key || 'serp:none' }}"), [x - 2 * dx, y + dy],
       alwaysOutputData=True, onError='continueRegularOutput')
    _code(SP, head + "// KW-SERP: only the requests whose results page was NOT read today (deep enough, AI Overview when asked) go to DataForSEO;\n"
          "// when every one was, one item takes the other branch and nothing is bought.\n"
          "const all = $('" + K + "').all().map(i => i.json);\n"
          "const rows = $input.all().map(i => i.json).filter(r => r && r.key);\n"
          "const misses = all.filter(j => !SC.lookup(rows, BODY(j)).hit);\n"
          "if (!misses.length) return [{ json: { serp_cache_all_read: true, read_today: all.length } }];\n"
          "return misses.map(j => ({ json: j }));", [x - dx, y + dy])
    _if(IF_, '{{ $json.serp_cache_all_read !== true }}', [x, y + dy])
    _code(WC, rt_src + '\n' + head + "// KW-SERP: every request again, in its own order - today's reading (cost 0, task id cache:<paid id>) or the answer the gate\n"
          "// merged - so what reads this call downstream is unchanged. The evidence block counts only what was bought.\n"
          "const all = $('" + K + "').all().map(i => i.json);\n"
          "const rows = (() => { try { return $('" + LD + "').all().map(i => i.json).filter(r => r && r.key); } catch (e) { return []; } })();\n"
          "const ans = (() => { try { return $('" + ans_node + "').all().map(i => i.json); } catch (e) { return []; } })();\n"
          "let k = 0, hits = 0, at = '';\n"
          "const out = all.map(j => { const L = SC.lookup(rows, BODY(j)); if (L.hit) { hits++; at = at || L.text; return { ...L.response, __dfs_cost_usd: 0, serp_read_today: L.text }; } return ans[k++] || {}; });\n"
          "let ev = (ans[0] && ans[0].__dfs) || null;\n"
          "if (!ev) { ev = RT.evidence(" + _json.dumps(what) + ", RT.stats([], {}, [], []), { unit: " + _json.dumps(unit) + " }); ev.cost_usd = 0; ev.tasks = 0;\n"
          "  ev.cost_basis = 'nothing bought: every results page was ' + (at || 'read earlier today') + ' and used again at no cost.'; }\n"
          "ev = { ...ev, read_today: hits, read_today_note: hits ? hits + ' results page(s) were ' + at + ' and used again at no cost' : '' };\n"
          "return out.map(a => ({ json: { ...a, __dfs: ev } }));", [x + 6 * dx, y + dy])
    _code(RW, head + "// KW-SERP: every results page bought and read this run becomes today's reading for the other paths; a failed one is never stored\n"
          "const all = $('" + K + "').all().map(i => i.json);\n"
          "const got = $('" + WC + "').all().map(i => i.json);\n"
          "const byKey = new Map();\n"
          "all.forEach((j, i) => { const r = SC.rowFor(got[i], BODY(j), ''); if (r) byKey.set(r.key, r); });\n"
          "return byKey.size ? [...byKey.values()].map(r => ({ json: r })) : [{ json: { skip: true } }];", [x + 7 * dx, y + dy])
    _if(NR, '{{ !$json.skip }}', [x + 8 * dx, y + dy])
    _n(SV, DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [x + 9 * dx, y + dy - 80], onError='continueRegularOutput', alwaysOutputData=True)
    _code(RS, "// The run continues with every answer in order (a Data Table upsert outputs the stored rows, not the run's items).\nreturn $('" + WC + "').all().map(i => ({ json: i.json }));", [x + 10 * dx, y + dy])
    # rewire: parent -> keys ... -> IF -> http ; answers -> with cache -> rows -> ... -> restore -> dsts
    pl = conns[parent]['main'][branch]
    pl[:] = [t for t in pl if t['node'] != http] + [{'node': K, 'type': 'main', 'index': 0}]
    for a, b in ((K, LD), (LD, SP), (SP, IF_), (WC, RW), (RW, NR), (SV, RS)):
        _link(a, b)
    _link(IF_, http, 0); _link(IF_, WC, 1); _link(NR, SV, 0); _link(NR, RS, 1)
    conns[ans_node]['main'] = [[{'node': WC, 'type': 'main', 'index': 0}]]
    conns[RS] = {'main': [[dict(t) for t in dsts]]}
    # the gate pairs what was SENT with what came back
    plan = by[plan_node]['parameters']
    old = "$('" + parent + "')" + ('.all()' if not branch else '.all(%d)' % branch)
    assert plan['jsCode'].count(old) == 1, 'KW-SERP: %s does not read its requests from %s' % (plan_node, parent)
    plan['jsCode'] = plan['jsCode'].replace(old, "(() => { try { return $('" + SP + "').all(); } catch (e) { return " + old + "; } })()")   # a run with no split (an older caller) pairs as before
    return {'keys': K, 'load': LD, 'split': SP, 'if': IF_, 'with_cache': WC, 'rows': RW, 'new': NR, 'save': SV, 'restore': RS, 'dsts': [t['node'] for t in dsts]}
