#!/usr/bin/env python3
"""Builds SEO Agent — Index Coverage (SEOagentIndexCv1): the daily, free index watch of every tracked website with Search Console connected
(docs/indexing-2026-10-29/DESIGN.md §1-§5, §7). Run at the end of build_v4.py, after build_monitors.py and before the Schedule Catch-up is built
(the catch-up reads this workflow's cron from the generated file).

Every day at 05:15 (n8n's clock) and on demand through *Manual Run* (`{ domain | site_id, callback_url?, request_id?, cap? }`):
  1. the run guard and a $0 run-ledger row (the Page Watch's chain: free, but the guard and the day's reconciliation see it ran);
  2. Google's own news, once per run: the Search Status Dashboard feed and the spam-policies page fingerprint -> seo_google_events, the freeze;
  3. per website: Search Console access, the submitted sitemaps (sitemaps.list), the pages with impressions (Search Analytics, 90 days, page x
     day, one request), the sitemap tree (robots.txt + /sitemap.xml + the submitted ones, 3 rounds, <= 50 sitemaps / 5,000 addresses),
     the merged inventory, the plan inside the day's cap (URL Inspection: 2 probes first, then the rest, 150 ms apart), our own read of the
     pages Google does not have (<= 60 a day), the diagnosis (one cause, one action, one sentence), the changed rows, the history, the run
     row, the impact of a finished Google update, and the callback `index_coverage` (Mondays, or the day a page drops out / an update starts or
     finishes; always to an on-demand caller).
It writes ONLY its own five tables (plus the shared run-ledger / ops-alert rows the ledger chain of every scheduled workflow writes) and reads
the Site Tracker's seo_pages / seo_page_watch and the content log. It never submits anything to Google and never changes a site.
Code nodes are also written to harness/code_v4 for the offline harness (scenarios_index.js)."""
import json, os, re, uuid
import env_settings as _env   # B-F5: a build with no n8n/.env refuses, unless the offline build is deliberate
_env.require_settings('build_index_coverage.py')
import url_lint      # D15: no node builds a site URL by hand
import retry_lint    # G1: one retry rule for every external HTTP node
import monitor_cost  # R115: the callback waits for the settle and carries its figure
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_get_where_params, dt_get_all_where_params,
                           dt_upsert_params, dt_upsert_params_keys, dt_update_params, dt_get_any_params, dt_delete_where_params, read_v5, engine_tz,
                           SITES_TABLE, MONITORS_TABLE, PAGES_TABLE, PAGE_WATCH_TABLE, LOG_TABLE,
                           INDEX_PAGES_TABLE, INDEX_PAGES_COLS, INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS, INDEX_RUNS_TABLE, INDEX_RUNS_COLS,
                           GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS, UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS,
                           RUN_LEDGER_TABLE, RUN_LEDGER_COLS, monitor_ledger_js, LEDGER_EST, ledger_mainline, OPS_ALERTS_TABLE, OPS_ALERTS_COLS, ALERT_WEBHOOK_PLACEHOLDER)

HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentIndexCv1', 'SEO Agent — Index Coverage', 'SEO_Agent_Index_Coverage.json'
TAG, MODE = 'Index', 'index_coverage'
SCHEDULE = {'hour': 5, 'minute': 15}   # free slot: Page Watch 05:45, AI Pulse 06:30, the catch-up sweeps :07/:22/:37/:52, the dispatcher every 5 min
NS = uuid.UUID('3b7c1e52-9a40-4f0e-8d6b-1dc0e0a1c0de')
nid = lambda name: str(uuid.uuid5(NS, 'indexcov:' + name))
GOOGLE = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}   # read-only scope (sync_credentials.py); never changed here
# wave 2 (DESIGN_WAVE2.md §2.5): the SAME service account with the write scope `webmasters`, used by ONE node only (Submit Sitemap (Index)),
# and only when the client switched sitemap submission on AND Google reports full access (Index Inventory, Sitemap Submit Requests)
GOOGLE_W = {'googleApi': {'id': 'SEOcredGoogleSvcW', 'name': 'Google Service Account, sitemap submission (SEO Agent)'}}
SUBMIT_NODE = 'Submit Sitemap (Index)'
from env_settings import ENV as _ENVS
SITEMAP_SUBMIT = 'off' if (_ENVS.get('SEO_SITEMAP_SUBMIT') or '').strip().lower() == 'off' else 'on'   # the kill switch, baked at build (default on)
INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
INCIDENTS_URL = 'https://status.search.google.com/incidents.json'
POLICY_URL = 'https://developers.google.com/search/docs/essentials/spam-policies'
UA = 'Mozilla/5.0 (compatible; SEO-Agent/4.16; +index-coverage)'

PW_SRC = read_v5('code/_page_watch.js').rstrip('\n')
IX_SRC = read_v5('code/_index_kit.js').rstrip('\n')
OA_SRC = read_v5('code/_ops_alert.js').rstrip('\n')
AR_SRC = read_v5('code/_alert_retry.js').rstrip('\n')   # R7 (fix wave 3): a failed self-start raises an ops alert on the shared path
TZ = engine_tz()
rd = lambda f, **kw: _fill(read_v5('code/' + f), **kw)


def _fill(src, round_no=None, start=None, sub=None):
    s = src.replace('/*__PAGE_WATCH__*/', PW_SRC).replace('/*__INDEX_KIT__*/', IX_SRC).replace('/*__OPS_ALERT__*/', OA_SRC).replace('__ENGINE_TZ__', TZ)
    if round_no is not None:
        s = s.replace('__ROUND__', str(round_no))
    if start is not None:
        s = s.replace('__START__', start)
    for k_, v_ in (sub or {}).items():
        s = s.replace(k_, v_)
    s = s.replace('/*__ALERT_RETRY__*/', AR_SRC).replace('__ALERT_WEBHOOK_URL__', ALERT_WEBHOOK_PLACEHOLDER)
    s = s.replace('__SITEMAP_SUBMIT__', SITEMAP_SUBMIT)
    for ph in ('/*__PAGE_WATCH__*/', '/*__INDEX_KIT__*/', '/*__OPS_ALERT__*/', '/*__ALERT_RETRY__*/', '__ENGINE_TZ__', '__ROUND__', '__START__', '__G__', '__LB__', '__ALERT_WEBHOOK_URL__', '__SITEMAP_SUBMIT__'):
        assert ph not in s, ph + ' left in a node of ' + NAME
    return s


N, C = [], {}
def node(name, ntype, ver, params, pos, **extra):
    assert not any(n['name'] == name for n in N), 'duplicate node ' + name
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); N.append(n); return n
def code(name, src, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': src}, pos, **extra)
def iff(name, expr, pos):
    return node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
        'conditions': [{'id': nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
        'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
def link(a, b, out=0):
    outs = C.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
def chain(*names):
    for a, b in zip(names, names[1:]): link(a, b)
at = lambda c, r: [c * 220, r * 220]
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
SAVE = dict(onError='continueRegularOutput', alwaysOutputData=True)
HTTP_X = dict(onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)   # G1: 3 tries, 5 s apart

def google(method, url, interval=150):
    p = {'method': method, 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi',
         'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': interval}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}
    if method == 'POST': p.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}'})
    return p
def text_get(url, follow=True, batch=5, interval=250, timeout=30000, as_file=False):
    # N7 / X2 (fix wave 2): `as_file` - the answer's body is written as a file (binary property `data`; the production instance keeps
    # binaries on disk, N8N_DEFAULT_BINARY_DATA_MODE=filesystem), so no sitemap or page body is kept in the run's saved data; the Code node
    # after the fetch reads it with this.helpers.getBinaryDataBuffer and passes on only what it found
    o = {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout,
         'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'file', 'outputPropertyName': 'data'} if as_file
                      else {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}
    if not follow: o['redirect'] = {'redirect': {'followRedirects': False}}
    return {'method': 'GET', 'url': url, 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': UA},
            {'name': 'Accept', 'value': 'text/html,application/xhtml+xml,application/xml,text/xml,application/json,text/plain,*/*'}]}, 'options': o}

# ---- row 0: doors, own tables, the few loads the plan needs ----
node('Daily Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'days', 'daysInterval': 1, 'triggerAtHour': SCHEDULE['hour'], 'triggerAtMinute': SCHEDULE['minute']}]}}, at(0, 0))
node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
OWN = [('Ensure Index Pages Table', INDEX_PAGES_TABLE, INDEX_PAGES_COLS), ('Ensure Index History Table', INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS),
       ('Ensure Index Runs Table', INDEX_RUNS_TABLE, INDEX_RUNS_COLS), ('Ensure Google Events Table', GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS),
       ('Ensure Update Impact Table', UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS)]
for i, (nm, t, cols) in enumerate(OWN):
    node(nm, DT_TYPE, DT_VERSION, dt_create_params(t, cols), at(1 + i, 0), onError='continueRegularOutput', executeOnce=True)
LOADS = [('Load Sites (Index)', dt_get_all_params(SITES_TABLE)), ('Load Monitors (Index)', dt_get_all_params(MONITORS_TABLE)),
         # today's runs only (the cap is a day's; the run before this one says whether it read the sitemap tree completely): two days back
         ('Load Index Runs', dt_get_all_where_params(INDEX_RUNS_TABLE, [('run_at', 'gte', '={{ new Date(Date.now() - 2 * 864e5).toISOString() }}')])),
         ('Load Google Events', dt_get_all_params(GOOGLE_EVENTS_TABLE))]
for i, (nm, params) in enumerate(LOADS):
    node(nm, DT_TYPE, DT_VERSION, params, at(6 + i, 0), **LOAD)
code('Index Plan', rd('IX_Plan.js'), at(16, 0))
# ---- row 1: Google's news - read by the dispatch and by an on-demand run; a chain part gets it from the dispatch ----
iff('Read Google News?', "{{ !!($('Index Plan').first().json.dispatch || $('Index Plan').first().json.on_demand) }}", at(16, 1))
node('Fetch Google Incidents', 'n8n-nodes-base.httpRequest', 4.5, text_get(INCIDENTS_URL, batch=1, interval=0), at(17, 1), executeOnce=True, **HTTP_X)
node('Fetch Spam Policies', 'n8n-nodes-base.httpRequest', 4.5, text_get(POLICY_URL, batch=1, interval=0), at(18, 1), executeOnce=True, **HTTP_X)
code('Google Events', rd('IX_Google_Events.js'), at(19, 1), executeOnce=True)
code('Google Event Rows', "// Index coverage: the seo_google_events rows that are new or changed (exact columns: the upsert maps every input field).\n"
     "const g = ($('Google Events').first() || {}).json || {};\nconst rows = g.rows || [];\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no event changed' } }];\n", at(20, 1))
iff('Any Event Rows?', '{{ !$json.skip }}', at(21, 1))
node('Save Google Events', DT_TYPE, DT_VERSION, dt_upsert_params(GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS, 'event_id'), at(22, 0), **SAVE)
# ---- the dispatch (X1): retention, then the first website's own execution ----
iff('Dispatch? (Index)', "{{ !!$('Index Plan').first().json.dispatch }}", at(23, 1))
CUT = lambda days: '={{ new Date(Date.now() - ' + str(days) + ' * 864e5).toISOString() }}'
node('Prune Index History', DT_TYPE, DT_VERSION, dt_delete_where_params(INDEX_HISTORY_TABLE, [('at', 'lt', CUT(400))]), at(24, 0), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
node('Prune Index Runs', DT_TYPE, DT_VERSION, dt_delete_where_params(INDEX_RUNS_TABLE, [('run_at', 'lt', CUT(400))]), at(25, 0), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
code('Dispatch Start', rd('IX_Dispatch_Start.js'), at(26, 0), executeOnce=True)
iff('Any Dispatch?', '{{ !$json.skip }}', at(27, 0))
SELF = lambda name, pos: node(name, 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': WID},
                                'mode': 'once', 'options': {'waitForSubWorkflow': False}}, pos, onError='continueRegularOutput', alwaysOutputData=True)
SELF('Start Index Part', at(28, -1))
# ---- one website: its own rows only (every load filtered by the site, server-side) ----
iff('Site To Check? (Index)', "{{ !$('Index Plan').first().json.nothing_to_do && !!$('Index Plan').first().json.site_id }}", at(24, 2))
SID = "={{ $('Index Plan').first().json.site_id }}"
DOM = "={{ $('Index Plan').first().json.domain }}"
SITE_LOADS = [('Load Index Pages', dt_get_all_where_params(INDEX_PAGES_TABLE, [('site_id', 'eq', SID)])),
              ('Load Pages (Index)', dt_get_all_where_params(PAGES_TABLE, [('site_id', 'eq', SID)])),
              ('Load Page Watch (Index)', dt_get_all_where_params(PAGE_WATCH_TABLE, [('site_id', 'eq', SID)])),
              # our own pages: the content log's rows of this site (published ones are kept by the code). seo_ladders is not read: its rows are
              # keyword rungs, a read path the fit gate guards (gate_lint), and the content log already carries every published URL
              ('Load Content Log (Index)', dt_get_any_params(LOG_TABLE, [('site_id', SID), ('domain', DOM), ('domain', "={{ 'www.' + $('Index Plan').first().json.domain }}")])),
              ('Load Update Impact', dt_get_all_where_params(UPDATE_IMPACT_TABLE, [('site_id', 'eq', SID)]))]
for i, (nm, params) in enumerate(SITE_LOADS):
    node(nm, DT_TYPE, DT_VERSION, params, at(25 + i, 3), **LOAD)
# R2 (fix wave 3): the run's ATTEMPT row, written once the run guard let the part in and before anything that can fail (sitemap rounds,
# Search Analytics): a part that dies early is counted, so the day's watches cannot restart it 30 times (IX_Plan.js doneToday)
code('Index Attempt', rd('IX_Attempt.js'), at(24, 3), executeOnce=True); iff('Any Attempt?', '{{ !$json.skip }}', at(24, 4))
node('Save Index Attempt', DT_TYPE, DT_VERSION, dt_upsert_params_keys(INDEX_RUNS_TABLE, INDEX_RUNS_COLS, ['site_id', 'run_at']), at(25, 4), **SAVE)
node('GSC Sites (Index)', 'n8n-nodes-base.httpRequest', 4.5, google('GET', 'https://www.googleapis.com/webmasters/v3/sites'), at(30, 1), credentials=GOOGLE, executeOnce=True, **HTTP_X)
code('Index Sites', rd('IX_Sites.js'), at(31, 1))
iff('Any Sites (Index)?', "{{ !$('Index Sites').first().json.skip }}", at(32, 1))
node('Nothing To Do (Index)', 'n8n-nodes-base.noOp', 1, {}, at(33, 2))
# ---- Search Console (submitted sitemaps, pages with impressions: by page per window, a second page when the first was full) ----
code('Sitemaps List Requests', rd('IX_Sitemaps_List_Requests.js'), at(33, 1)); iff('Any Sitemaps List?', '{{ !$json.skip }}', at(34, 1))
node('GSC Sitemaps List', 'n8n-nodes-base.httpRequest', 4.5, google('GET', '={{ $json.url }}'), at(35, 0), credentials=GOOGLE, **HTTP_X)
code('Pages Query Requests', rd('IX_Pages_Query_Requests.js'), at(36, 1)); iff('Any Pages Query?', '{{ !$json.skip }}', at(37, 1))
node('GSC Pages Query', 'n8n-nodes-base.httpRequest', 4.5, google('POST', '={{ $json.url }}'), at(38, 0), credentials=GOOGLE, **HTTP_X)
code('Pages Query More', rd('IX_Pages_Query_More.js'), at(39, 1)); iff('Any Pages Query More?', '{{ !$json.skip }}', at(40, 1))
node('GSC Pages Query 2', 'n8n-nodes-base.httpRequest', 4.5, google('POST', '={{ $json.url }}'), at(41, 0), credentials=GOOGLE, **HTTP_X)
# ---- the sitemap tree, ROUNDS rounds (no fetch follows a redirect: E11; N7: bounded batches, answers as files) ----
ROUNDS = 7
assert re.search(r'sitemap_rounds:\s*' + str(ROUNDS) + r'\b', IX_SRC), 'IX.CFG.sitemap_rounds must equal the rounds built here (Index Inventory reads the last one)'
for r in range(1, ROUNDS + 1):
    x = 41 + (r - 1) * 4
    code('Sitemap Requests ' + str(r), rd('IX_Sitemap_Requests.js', round_no=r), at(x + 1, 3))
    iff('Any Sitemaps ' + str(r) + '?', '{{ !$json.skip }}', at(x + 2, 3))
    node('Fetch Sitemaps ' + str(r), 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', follow=False, as_file=True), at(x + 3, 2), **HTTP_X)
    code('Sitemap Read ' + str(r), rd('IX_Sitemap_Read.js', round_no=r), at(x + 4, 3))
# ---- wave 2 (DESIGN_WAVE2.md §2.1): the website's own links - the home page (read by round 1) and up to 10 parent pages ----
code('Link Read Requests', rd('IX_Link_Read_Requests.js'), at(67, 5)); iff('Any Link Reads?', '{{ !$json.skip }}', at(68, 5))
node('Fetch Link Pages', 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', follow=False, timeout=20000, as_file=True), at(69, 6), **HTTP_X)
code('Site Links', rd('IX_Site_Links.js'), at(69, 5))
# ---- inventory, the reservation, inspections, our own reads ----
code('Index Inventory', rd('IX_Inventory.js'), at(70, 4))
code('Index Reservation', rd('IX_Reservation.js'), at(71, 4)); iff('Any Reservation?', '{{ !$json.skip }}', at(72, 4))
# R2 (fix wave 3): an upsert on site_id + run_at - the reservation replaces this run's attempt row (Save Index Attempt), never a second row
node('Save Index Reservation', DT_TYPE, DT_VERSION, dt_upsert_params_keys(INDEX_RUNS_TABLE, INDEX_RUNS_COLS, ['site_id', 'run_at']), at(73, 3), **SAVE)
# wave 2 (§2.5): the opt-in sitemap submission - the ONE write to a client's Search Console (sitemaps.submit), on the write-scope credential.
# neverError + fullResponse: a 4xx is an answer (recorded: a 403 holds the next try), never retried; the retry rule covers only a failed call
code('Sitemap Submit Requests', rd('IX_Sitemap_Submit_Requests.js'), at(73, 5)); iff('Any Sitemap Submit?', '{{ !$json.skip }}', at(73, 6))
node(SUBMIT_NODE, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'PUT', 'url': '={{ $json.url }}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi',
     'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 1000}}, 'timeout': 60000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
     at(73, 7), credentials=GOOGLE_W, **HTTP_X)
code('Index Probe Requests', rd('IX_Probe_Requests.js'), at(74, 4)); iff('Any Probes?', '{{ !$json.skip }}', at(75, 4))
node('Inspect URL (Probe)', 'n8n-nodes-base.httpRequest', 4.5, google('POST', INSPECT_URL), at(76, 3), credentials=GOOGLE, **HTTP_X)
code('Index Inspect Requests', rd('IX_Inspect_Requests.js'), at(77, 4)); iff('Any Inspections (Index)?', '{{ !$json.skip }}', at(78, 4))
node('Inspect URL (Index)', 'n8n-nodes-base.httpRequest', 4.5, google('POST', INSPECT_URL), at(79, 3), credentials=GOOGLE, **HTTP_X)
code('Inspect Retry Requests', rd('IX_Inspect_Retry_Requests.js'), at(80, 4)); iff('Any Rate Retry?', '{{ !$json.skip }}', at(81, 4))
node('Wait (Index Rate Limit)', 'n8n-nodes-base.wait', 1.1, {'amount': 61, 'unit': 'seconds'}, at(82, 3), webhookId=nid('Wait (Index Rate Limit):hook'), executeOnce=True)
node('Inspect URL (Retry)', 'n8n-nodes-base.httpRequest', 4.5, google('POST', INSPECT_URL, interval=400), at(83, 3), credentials=GOOGLE, **HTTP_X)
code('Page Fetch Requests', rd('IX_Page_Fetch_Requests.js'), at(84, 4)); iff('Any Page Fetches?', '{{ !$json.skip }}', at(85, 4))
node('Fetch Page (Index)', 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', follow=False, timeout=20000, as_file=True), at(86, 3), **HTTP_X)
code('Page First Reads', rd('IX_Page_First_Reads.js'), at(86, 5))   # X2: the first answers parsed here, no page body carried on
code('Fetch Hop Requests', rd('IX_Fetch_Hop_Requests.js'), at(87, 4)); iff('Any Hops?', '{{ !$json.skip }}', at(88, 4))
node('Fetch Page (Final)', 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', follow=False, timeout=20000, as_file=True), at(89, 3), **HTTP_X)
code('Page Signals', rd('IX_Page_Signals.js'), at(90, 4))
# ---- diagnosis, saves, moves, update impact, run rows, the next website, report ----
code('Index Diagnose', rd('IX_Diagnose.js'), at(91, 5))
code('Index Page Rows', rd('IX_Page_Rows.js'), at(92, 5)); iff('Any Index Rows?', '{{ !$json.skip }}', at(93, 5))
node('Save Index Pages', DT_TYPE, DT_VERSION, dt_upsert_params_keys(INDEX_PAGES_TABLE, INDEX_PAGES_COLS, ['site_id', 'url']), at(94, 4), **SAVE)
code('Index Delete Rows', rd('IX_Delete_Rows.js'), at(95, 5)); iff('Any Deletes?', '{{ !$json.skip }}', at(96, 5))
node('Delete Index Pages', DT_TYPE, DT_VERSION, dt_delete_where_params(INDEX_PAGES_TABLE, [('site_id', 'eq', '={{ $json.site_id }}'), ('url', 'eq', '={{ $json.url }}')]), at(97, 4), **SAVE)
code('Index History Moves', rd('IX_History_Moves.js'), at(98, 5)); iff('Any History Moves?', '{{ !$json.skip }}', at(99, 5))
node('Move Index History', DT_TYPE, DT_VERSION, dt_update_params(INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS, [('site_id', '={{ $json.site_id }}'), ('url', '={{ $json.from }}')], {'url': '={{ $json.to }}'}), at(100, 4), **SAVE)
code('Index History Rows', rd('IX_History_Rows.js'), at(101, 5)); iff('Any History Rows?', '{{ !$json.skip }}', at(102, 5))
node('Save Index History', DT_TYPE, DT_VERSION, dt_insert_params(INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS), at(103, 4), **SAVE)
code('Update Impact Requests', rd('IX_Impact_Requests.js'), at(104, 5)); iff('Any Impact Queries?', '{{ !$json.skip }}', at(105, 5))
node('GSC Impact Query', 'n8n-nodes-base.httpRequest', 4.5, google('POST', '={{ $json.url }}'), at(106, 4), credentials=GOOGLE, **HTTP_X)
code('Update Impact Rows', rd('IX_Impact_Rows.js'), at(107, 5)); iff('Any Update Impact?', '{{ !$json.skip }}', at(108, 5))
node('Save Update Impact', DT_TYPE, DT_VERSION, dt_upsert_params_keys(UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS, ['site_id', 'event_id']), at(109, 4), **SAVE)
code('Index Run Rows', rd('IX_Run_Rows.js'), at(110, 5)); iff('Any Run Rows?', '{{ !$json.skip }}', at(111, 5))
# E6: the run row replaces this run's reservation (same site_id + run_at)
node('Save Index Runs', DT_TYPE, DT_VERSION, dt_upsert_params_keys(INDEX_RUNS_TABLE, INDEX_RUNS_COLS, ['site_id', 'run_at']), at(112, 4), **SAVE)
code('Next Index Part', rd('IX_Next_Part.js'), at(113, 5), executeOnce=True); iff('Any Next Part?', '{{ !$json.skip }}', at(114, 5))
SELF('Start Next Index Part', at(115, 4))
code('Index Report', rd('IX_Report.js'), at(116, 5))
iff('Has Callback (Index)?', '{{ !!$json.callback_url }}', at(117, 5))
node('POST Index Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json',
     'jsonBody': "={{ JSON.stringify({ stage: 'index_coverage', status: $json.status || 'complete', domain: $json.domain, site_id: $json.site_id, request_id: $json.request_id, "
                 "summary: $json.summary, report_markdown: $json.report_markdown, cost: $json.cost || { usd: 0 }, run_ledger: $json.run_ledger || null, "
                 "...($json.ran_late && $json.ran_late.late ? { ran_late: $json.ran_late } : {}) }) }}", 'options': {'timeout': 30000}},
     at(118, 5), onError='continueRegularOutput')
# X1: a website of today's chain refused by the run guard for capacity is started again five minutes later (wired after the ledger chain exists)
code('Retry Index Part', rd('IX_Retry_Part.js'), at(20, 9), executeOnce=True); iff('Any Retry Part?', '{{ !$json.skip }}', at(21, 9))
# N5 (fix wave 2): the same wait serves a refused chain part (5 minutes) and a refused dispatch (the day's watch, 30 minutes)
node('Wait (Index Part Retry)', 'n8n-nodes-base.wait', 1.1, {'amount': '={{ Number($json.wait_minutes) || 5 }}', 'unit': 'minutes'}, at(22, 9), webhookId=nid('Wait (Index Part Retry):hook'), executeOnce=True)
SELF('Restart Index Part', at(23, 9))
# N5 (fix wave 2): the day's watch - 50 minutes after a dispatch, the dispatch runs again (ix_watch) and restarts the chain for the websites not
# done today (a chain broken by a crash, a time-out or a restart goes on). Wired after the settle, so the waiting execution holds no run-guard slot.
code('Index Watch Plan', rd('IX_Watch_Plan.js'), at(20, 11), executeOnce=True); iff('Any Index Watch?', '{{ !$json.skip }}', at(21, 11))
node('Wait (Index Watch)', 'n8n-nodes-base.wait', 1.1, {'amount': '={{ Number($json.wait_minutes) || 50 }}', 'unit': 'minutes'}, at(22, 11), webhookId=nid('Wait (Index Watch):hook'), executeOnce=True)
SELF('Start Index Watch', at(23, 11))
node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': """## SEO Agent — Index Coverage (2026-10-29, fix wave 1)
Every day at **05:15** (n8n's clock) and on demand (*Manual Run* `{ domain | site_id, callback_url?, request_id?, cap? }`). **Free**: Google's Search Console APIs (read-only, except the opt-in sitemap submission below) and plain GETs, no DataForSEO, no Claude; a $0 run-ledger row per execution.
**Wave 2 (2026-10-30, DESIGN_WAVE2.md):** the home page and up to 10 parent pages are read for the website's own links (`linked_by`, pages found there join the inventory); a page already linked that Google has not visited waits; a canonical to another page from a page with its own title is a site step; policy / utility pages are left out; "ask Google" is ranked by value and "I asked Google" is checked back. **Sitemap submission** (`Submit Sitemap (Index)`, credential `SEOcredGoogleSvcW`, the ONLY write to Search Console) runs only when the client switched `index_sitemap_submit` on AND Google reports full access; never an unchanged resubmit; `SEO_SITEMAP_SUBMIT=off` in n8n/.env switches it off for the engine.
**One execution per website.** The 05:15 run (or the catch-up, or a Manual Run naming no website) is the *dispatch*: it reads Google's news, prunes history older than 400 days and starts the first website's own execution (`ix_chain`); each website saves its rows, then starts the next one - one at a time. Before its first URL Inspection a website writes its **reservation** (`seo_index_runs` row with the planned count), replaced by the final row, so no crash or replay can spend past the daily cap (`index_daily_cap`, default 300, 20-1,200).
Per website: the sitemap tree (complete or not: only a complete read says "not in the sitemap"), the submitted sitemaps, Search Console pages (by page, four windows, paged), the inventory, our own pages -> **one cause per page** (DESIGN §4), its action and one sentence; Google's documented fields beat our own read; a bot wall is "could not check". `fix_seen_at` when our read sees the step done; `ask_google` on up to 5 pages a week.
Writes only `seo_index_pages`, `seo_index_history`, `seo_index_runs`, `seo_google_events`, `seo_update_impact`. Callback `index_coverage` on Mondays, or the day a page drops out or an update starts / finishes. Never submits a URL to Google (no Indexing API), never changes a site, never says a page "will be indexed".""",
     'height': 460, 'width': 1300, 'color': 5}, [16 * 220 - 40, -600])

# ---- wiring ----
chain('Daily Schedule', OWN[0][0]); link('Manual Run', OWN[0][0])
chain(*[o[0] for o in OWN], *[l[0] for l in LOADS], 'Index Plan', 'Read Google News?')
link('Read Google News?', 'Fetch Google Incidents', 0); link('Read Google News?', 'Google Events', 1)
chain('Fetch Google Incidents', 'Fetch Spam Policies', 'Google Events', 'Google Event Rows', 'Any Event Rows?')
link('Any Event Rows?', 'Save Google Events', 0); link('Any Event Rows?', 'Dispatch? (Index)', 1); link('Save Google Events', 'Dispatch? (Index)')
link('Dispatch? (Index)', 'Prune Index History', 0); link('Dispatch? (Index)', 'Site To Check? (Index)', 1)
chain('Prune Index History', 'Prune Index Runs', 'Dispatch Start', 'Any Dispatch?')
link('Any Dispatch?', 'Start Index Part', 0); link('Any Dispatch?', 'Index Report', 1); link('Start Index Part', 'Index Report')
link('Site To Check? (Index)', 'Index Attempt', 0); link('Site To Check? (Index)', 'Nothing To Do (Index)', 1)
chain('Index Attempt', 'Any Attempt?'); link('Any Attempt?', 'Save Index Attempt', 0); link('Any Attempt?', SITE_LOADS[0][0], 1); link('Save Index Attempt', SITE_LOADS[0][0])
chain(*[l[0] for l in SITE_LOADS], 'GSC Sites (Index)', 'Index Sites', 'Any Sites (Index)?')
link('Any Sites (Index)?', 'Sitemaps List Requests', 0); link('Any Sites (Index)?', 'Nothing To Do (Index)', 1)
link('Nothing To Do (Index)', 'Next Index Part')
def gate(req, cond, http, nxt):
    chain(req, cond); link(cond, http, 0); link(cond, nxt, 1); link(http, nxt)
gate('Sitemaps List Requests', 'Any Sitemaps List?', 'GSC Sitemaps List', 'Pages Query Requests')
gate('Pages Query Requests', 'Any Pages Query?', 'GSC Pages Query', 'Pages Query More')
gate('Pages Query More', 'Any Pages Query More?', 'GSC Pages Query 2', 'Sitemap Requests 1')
for r in range(1, ROUNDS + 1):
    gate('Sitemap Requests %d' % r, 'Any Sitemaps %d?' % r, 'Fetch Sitemaps %d' % r, 'Sitemap Read %d' % r)
    link('Sitemap Read %d' % r, 'Sitemap Requests %d' % (r + 1) if r < ROUNDS else 'Link Read Requests')
gate('Link Read Requests', 'Any Link Reads?', 'Fetch Link Pages', 'Site Links')
link('Site Links', 'Index Inventory')
link('Index Inventory', 'Index Reservation')
gate('Index Reservation', 'Any Reservation?', 'Save Index Reservation', 'Sitemap Submit Requests')
gate('Sitemap Submit Requests', 'Any Sitemap Submit?', SUBMIT_NODE, 'Index Probe Requests')
gate('Index Probe Requests', 'Any Probes?', 'Inspect URL (Probe)', 'Index Inspect Requests')
gate('Index Inspect Requests', 'Any Inspections (Index)?', 'Inspect URL (Index)', 'Inspect Retry Requests')
chain('Inspect Retry Requests', 'Any Rate Retry?'); link('Any Rate Retry?', 'Wait (Index Rate Limit)', 0); link('Any Rate Retry?', 'Page Fetch Requests', 1)
chain('Wait (Index Rate Limit)', 'Inspect URL (Retry)', 'Page Fetch Requests')
gate('Page Fetch Requests', 'Any Page Fetches?', 'Fetch Page (Index)', 'Page First Reads')
link('Page First Reads', 'Fetch Hop Requests')
gate('Fetch Hop Requests', 'Any Hops?', 'Fetch Page (Final)', 'Page Signals')
link('Page Signals', 'Index Diagnose')
link('Index Diagnose', 'Index Page Rows')
gate('Index Page Rows', 'Any Index Rows?', 'Save Index Pages', 'Index Delete Rows')
gate('Index Delete Rows', 'Any Deletes?', 'Delete Index Pages', 'Index History Moves')
gate('Index History Moves', 'Any History Moves?', 'Move Index History', 'Index History Rows')
gate('Index History Rows', 'Any History Rows?', 'Save Index History', 'Update Impact Requests')
gate('Update Impact Requests', 'Any Impact Queries?', 'GSC Impact Query', 'Update Impact Rows')
gate('Update Impact Rows', 'Any Update Impact?', 'Save Update Impact', 'Index Run Rows')
gate('Index Run Rows', 'Any Run Rows?', 'Save Index Runs', 'Next Index Part')
gate('Next Index Part', 'Any Next Part?', 'Start Next Index Part', 'Index Report')
chain('Index Report', 'Has Callback (Index)?'); link('Has Callback (Index)?', 'POST Index Report', 0)

# the code nodes read each other by these names; a rename that misses one must fail here, not in production
_src = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
_names = {n['name'] for n in N}
for _n, _s in _src.items():
    for _ref in re.findall(r"\$\('([^']+)'\)", _s):
        assert _ref in _names or _ref == 'After Run Ledger (' + TAG + ')' or _ref.startswith('Sitemap Read ') or _ref.startswith('Sitemap Requests ') or _ref.startswith('Fetch Sitemaps '), _n + ' reads a node that does not exist: ' + _ref
for _n in ('Index Plan', 'Google Events', 'Index Inventory', 'Index Diagnose', 'Index Report', 'Update Impact Rows', 'Index Run Rows', 'Index Probe Requests', 'Index Inspect Requests',
           'Page Fetch Requests', 'Update Impact Requests', 'Sitemap Requests 1', 'Sitemap Read 1', 'Link Read Requests', 'Site Links', 'Sitemap Submit Requests'):
    assert 'const IX = (() => {' in _src[_n] and 'const PW = (() => {' in _src[_n], _n + ': the index kit or the page-watch kit is not inlined'
# the kit's row is exactly the table's columns (the upsert maps every input field)
_kit_cols = re.search(r"const PAGE_COLS = \[([^\]]*)\]", IX_SRC).group(1)
assert [c.strip().strip("'") for c in _kit_cols.split(',') if c.strip()] == [c for c, _ in INDEX_PAGES_COLS], 'IX.PAGE_COLS differs from ladder_common.INDEX_PAGES_COLS'
assert 'index_coverage' in LEDGER_EST and LEDGER_EST['index_coverage'] == {'ai': 0.0, 'dfs': 0.0}, 'the index watch is free: its ledger estimate is $0'

# ---- the run ledger (R9 / R17 / B-A9 / R115): the Page Watch's chain, with no DataForSEO probe (no_dfs) ----
def ledger_nodes(plan, ends, pos):
    x, y = pos
    row = 'Run Ledger Row (' + TAG + ')'
    res_js, set_js = monitor_ledger_js(V5, MODE, plan, row, '')
    node('Ensure Run Ledger (' + TAG + ')', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x, y], onError='continueRegularOutput', executeOnce=True)
    node(row, 'n8n-nodes-base.code', 2, {'jsCode': res_js}, [x + 220, y], executeOnce=True)
    node('Reserve Run Ledger (' + TAG + ')', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x + 440, y], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
    node('Ledger Settle (' + TAG + ')', 'n8n-nodes-base.code', 2, {'jsCode': set_js}, [x + 220, y + 160], executeOnce=True)
    node('Settle Run Ledger (' + TAG + ')', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS,
        [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
        {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}',
         'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
         'cost_basis': '={{ $json.cost_basis }}'}),
        [x + 440, y + 160], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
    for a_, b_ in [(plan, 'Ensure Run Ledger (' + TAG + ')'), ('Ensure Run Ledger (' + TAG + ')', row), (row, 'Reserve Run Ledger (' + TAG + ')'),
                   ('Ledger Settle (' + TAG + ')', 'Settle Run Ledger (' + TAG + ')')] + [(e, 'Ledger Settle (' + TAG + ')') for e in ends]:
        link(a_, b_)
    return {'mode': MODE, 'plan': plan, 'reserve': row, 'settle': 'Settle Run Ledger (' + TAG + ')', 'settle_from': list(ends), 'measured': '', 'est': LEDGER_EST[MODE],
            'resume': 'After Run Ledger (' + TAG + ')', 'no_dfs': True}

WIRING = ledger_nodes('Index Plan', ['Index Report'], at(16, 7))
wfobj = {'id': WID, 'name': NAME, 'active': False,
         'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 3600, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'},
         'tags': [], 'nodes': N, 'connections': C}
_declared = list(WIRING['settle_from'])
ledger_mainline(wfobj, WIRING)
monitor_cost.callback_after_settle(wfobj, WIRING, 'Has Callback (Index)?', 'POST Index Report', V5, _declared)
# X1: the refusal of a chain part also tries the part again later (the refusal notice and its row are unchanged)
_ref = 'Refuse Run Ledger (' + TAG + ')'
assert _ref in {n['name'] for n in N}, 'X1: no refusal node to hang the retry on'
C[_ref]['main'][0].append({'node': 'Retry Index Part', 'type': 'main', 'index': 0})
chain('Retry Index Part', 'Any Retry Part?'); link('Any Retry Part?', 'Wait (Index Part Retry)', 0); chain('Wait (Index Part Retry)', 'Restart Index Part')
# N5: the watch hangs on the settle of the run (every path of the run ends there), as a second target beside the ops-alert sweep
_settle = 'Settle Run Ledger (' + TAG + ')'
assert _settle in {n['name'] for n in N}, 'N5: no settle node to hang the watch on'
C[_settle]['main'][0].append({'node': 'Index Watch Plan', 'type': 'main', 'index': 0})
chain('Index Watch Plan', 'Any Index Watch?'); link('Any Index Watch?', 'Wait (Index Watch)', 0); chain('Wait (Index Watch)', 'Start Index Watch')
# R7 (fix wave 3): every self-start is checked; a start n8n refused raises one ops alert (seo_ops_alerts, due at once: the retry sweep posts it)
# Each start: the alerts of this workflow already on record (OA.plan dedupes a repeat) -> its check. Two delivery groups, as Page Watch does
# (record first, post, settle the row from the POST's status code): the starts BEFORE the settle (the dispatch's first part, the chain's next
# part) go on to Index Report on every branch, so the run still settles (R31); the starts AFTER it (a refused part restarted, the day's watch)
# end at their own delivery.
STARTS = [('Start Index Part', 'Part', 'Before Settle'), ('Start Next Index Part', 'Next', 'Before Settle'), ('Restart Index Part', 'Restart', 'After Settle'),
          ('Start Index Watch', 'Watch', 'After Settle')]
for i, (st_, lb_, g_) in enumerate(STARTS):
    ld_, chk_ = 'Load Start Alerts (' + lb_ + ')', 'Index Start Alert (' + lb_ + ')'
    node(ld_, DT_TYPE, DT_VERSION, dt_get_all_where_params(OPS_ALERTS_TABLE, [('workflow', 'eq', NAME)]), at(24 + i * 2, 13), **LOAD)
    code(chk_, rd('IX_Start_Alert.js', start=st_, sub={'__LB__': lb_}), at(25 + i * 2, 13), executeOnce=True)
    if g_ == 'Before Settle': C[st_]['main'][0] = [t for t in C[st_]['main'][0] if t['node'] != 'Index Report']   # through its check now
    link(st_, ld_); link(ld_, chk_); link(chk_, 'Any Start Alert (' + g_ + ')?')
for j, g_ in enumerate(('Before Settle', 'After Settle')):
    y_ = 14 + j * 2; sub_ = {'__G__': g_}
    iff('Any Start Alert (' + g_ + ')?', '{{ !$json.skip }}', at(32, y_))
    node('Save Index Start Alert (' + g_ + ')', DT_TYPE, DT_VERSION, dt_upsert_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, 'alert_key'), at(33, y_ - 1), **SAVE)
    code('Index Start Send (' + g_ + ')', rd('IX_Start_Send.js', sub=sub_), at(34, y_), executeOnce=True)
    iff('Send Start Webhook? (' + g_ + ')', '{{ $json.send_webhook }}', at(35, y_))
    node('Post Index Start Alert (' + g_ + ')', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.webhook_url }}', 'sendBody': True, 'specifyBody': 'json',
         'jsonBody': '={{ JSON.stringify($json.webhook_body) }}', 'options': {'timeout': 15000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
         at(36, y_ - 1), onError='continueRegularOutput', **retry_lint.RETRY)
    code('Index Start Delivery (' + g_ + ')', rd('IX_Start_Delivery.js', sub=sub_), at(37, y_), executeOnce=True)
    iff('Any Start Delivery? (' + g_ + ')', '{{ !$json.skip }}', at(38, y_))
    node('Save Index Start Delivery (' + g_ + ')', DT_TYPE, DT_VERSION, dt_update_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, [('alert_key', '={{ $json.alert_key }}')],
        {'delivered': '={{ $json.delivered }}', 'channels': '={{ $json.channels }}', 'severity': '={{ $json.severity }}', 'attempts': '={{ $json.attempts }}',
         'last_attempt_at': '={{ $json.last_attempt_at }}', 'next_attempt_at': '={{ $json.next_attempt_at }}', 'attempt_log': '={{ $json.attempt_log }}',
         'notes': '={{ $json.notes }}'}), at(39, y_ - 1), **SAVE)
    link('Any Start Alert (' + g_ + ')?', 'Save Index Start Alert (' + g_ + ')', 0)
    chain('Save Index Start Alert (' + g_ + ')', 'Index Start Send (' + g_ + ')', 'Send Start Webhook? (' + g_ + ')')
    link('Send Start Webhook? (' + g_ + ')', 'Post Index Start Alert (' + g_ + ')', 0)
    chain('Post Index Start Alert (' + g_ + ')', 'Index Start Delivery (' + g_ + ')', 'Any Start Delivery? (' + g_ + ')')
    link('Any Start Delivery? (' + g_ + ')', 'Save Index Start Delivery (' + g_ + ')', 0)
    if g_ == 'Before Settle':   # every branch of the pre-settle group goes on to Index Report
        for nd_, out_ in (('Any Start Alert (Before Settle)?', 1), ('Send Start Webhook? (Before Settle)', 1), ('Any Start Delivery? (Before Settle)', 1), ('Save Index Start Delivery (Before Settle)', 0)):
            link(nd_, 'Index Report', out_)
url_lint.check(wfobj, NAME)
retry_lint.check(wfobj, NAME)
retry_lint.check_in200(wfobj, NAME)

# ---- proofs on the generated workflow ----
names = {n['name'] for n in N}; assert len(names) == len(N), 'duplicate node names in ' + NAME
by = {n['name']: n for n in N}
outs = lambda nd: [t['node'] for lst in ((C.get(nd) or {}).get('main') or []) for t in (lst or [])]
for s_, o_ in C.items():
    assert s_ in names, s_
    for lists in o_.values():
        for lst in lists:
            for t in lst: assert t['node'] in names, t['node']
def reach(starts, blocked=()):
    seen, todo = set(), list(starts)
    while todo:
        nd = todo.pop()
        if nd in seen or nd in blocked: continue
        seen.add(nd); todo.extend(outs(nd))
    return seen
_r = reach(['Daily Schedule', 'Manual Run'])
_orphans = sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote' and n['name'] not in _r)
assert not _orphans, 'nodes no door reaches: ' + str(_orphans)
assert sorted(outs('Daily Schedule')) == sorted(outs('Manual Run')), 'the manual entry must feed the schedule\'s own first node (catch-up)'
# nothing that calls Google or a website runs before the reservation
_external = sorted(n['name'] for n in N if n['type'] == 'n8n-nodes-base.httpRequest' and n['name'] not in ('DFS Balance (Index)', 'DFS Balance End (Index)'))
_before = reach(['Daily Schedule', 'Manual Run'], blocked={'Reserve Run Ledger (' + TAG + ')'})
assert not [h for h in _external if h in _before], 'an external call runs before the run ledger reserves: ' + str([h for h in _external if h in _before])
# it writes only its own tables (and the shared ledger / ops-alert rows every scheduled workflow's chain writes)
_own = {t for _, t, _ in OWN}
_shared = {RUN_LEDGER_TABLE, OPS_ALERTS_TABLE}
_writes = {}
for n in N:
    if n['type'] != DT_TYPE: continue
    p = n['parameters']; t = (p.get('dataTableId') or {}).get('value') or p.get('tableName')
    op = p.get('operation') if p.get('resource') == 'row' else ('create' if p.get('operation') == 'create' else p.get('operation'))
    if op in ('insert', 'upsert', 'update', 'delete', 'deleteRows', 'create'):
        _writes.setdefault(t, []).append(n['name'])
_foreign = {t: v for t, v in _writes.items() if t not in _own | _shared}
assert not _foreign, 'Index Coverage writes a table that is not its own: ' + str(_foreign)
assert 'DFS Balance (Index)' in by and by['DFS Balance (Index)']['type'] == 'n8n-nodes-base.code', 'no DataForSEO in this workflow: the balance probe is a no-op'
assert not any('dataforseo' in json.dumps(n.get('parameters')).lower() for n in N if n['type'] == 'n8n-nodes-base.httpRequest'), 'a DataForSEO call in Index Coverage'
assert not any('anthropic' in json.dumps(n.get('credentials') or {}).lower() or 'api.anthropic.com' in str((n.get('parameters') or {}).get('url')) or 'langchain' in n['type'] for n in N), 'a Claude call in Index Coverage'
_google_nodes = [n for n in N if n['type'] == 'n8n-nodes-base.httpRequest' and (n['parameters'].get('nodeCredentialType') == 'googleApi' or 'googleapis.com' in str(n['parameters'].get('url')))]
for n in N:
    if n['type'] != 'n8n-nodes-base.httpRequest': continue
    if n['name'] == SUBMIT_NODE:
        # wave 2 (§2.5): the one write, on the write-scope credential, a PUT to sitemaps.submit built by Sitemap Submit Requests, 4xx never retried
        assert n.get('credentials') == GOOGLE_W and n['parameters'].get('method') == 'PUT' and n['parameters'].get('url') == '={{ $json.url }}', SUBMIT_NODE + ': PUT on SEOcredGoogleSvcW only'
        assert n['parameters']['options']['response']['response'] == {'fullResponse': True, 'neverError': True}, SUBMIT_NODE + ': a 4xx is an answer, read with its status code'
        assert outs('Sitemap Submit Requests') == ['Any Sitemap Submit?'] and outs('Any Sitemap Submit?')[0] == SUBMIT_NODE, SUBMIT_NODE + ': only Sitemap Submit Requests feeds it'
        continue
    if n in _google_nodes:
        assert n.get('credentials') == GOOGLE, n['name'] + ': every other Google call uses the shared read-only service account'
    if n['parameters'].get('method') in ('PUT', 'DELETE', 'PATCH'):
        raise AssertionError(n['name'] + ': Index Coverage changes nothing outside its tables (the sitemap submission is the one PUT)')
assert [n['name'] for n in N if (n.get('credentials') or {}).get('googleApi', {}).get('id') == 'SEOcredGoogleSvcW'] == [SUBMIT_NODE], 'the write credential is on exactly one node'
_isrc = by['Sitemap Submit Requests']['parameters']['jsCode']
assert "const KILL_OFF = '" + SITEMAP_SUBMIT + "' === 'off';" in _isrc and 'webmasters/v3/sites/' in _isrc and '/sitemaps/' in _isrc, 'Sitemap Submit Requests: the kill switch is baked and only sitemaps.submit is built'
assert by['Inspect URL (Index)']['parameters']['options']['batching']['batch'] == {'batchSize': 1, 'batchInterval': 150}, '150 ms between inspections'
assert 'Callback Ledger (' + TAG + ')' in by and outs('Callback Ledger (' + TAG + ')') == ['Has Callback (Index)?'], 'R115: the callback waits for the settle'

json.dump([wfobj], open(os.path.join(OUT, FILE), 'w'), indent=2, ensure_ascii=False)
os.makedirs(CODE, exist_ok=True)
# the harness reads every code node by name; a name another workflow already uses would overwrite its file
_others = set()
for fn in os.listdir(OUT):
    if fn.endswith('.json') and fn != FILE:
        for w in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            _others |= {n['name'] for n in w.get('nodes', []) if n.get('type') == 'n8n-nodes-base.code'}
_clash = sorted(n['name'] for n in N if n['type'] == 'n8n-nodes-base.code' and n['name'] in _others)
assert not _clash, 'code node names shared with another workflow (harness/code_v4 would be overwritten): ' + str(_clash)
for n in N:
    if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
print('wrote', FILE + ':', len(N), 'nodes')

# what the harness checks (scenarios_index.js): the wiring, the schedule, the tables it writes, the callback
json.dump({'workflow': WID, 'name': NAME, 'file': FILE, 'schedule': dict(SCHEDULE, every='day'), 'tz': TZ, 'mode': MODE,
           'nodes': sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote'),
           'connections': {s_: [[t_['node'] for t_ in l_] for l_ in o_.get('main', [])] for s_, o_ in sorted(C.items())},
           'writes': {t: sorted(v) for t, v in sorted(_writes.items())}, 'own_tables': sorted(_own), 'shared_tables': sorted(_shared),
           'external': _external, 'inspect_batch': by['Inspect URL (Index)']['parameters']['options']['batching']['batch'],
           'write_credential': {'id': 'SEOcredGoogleSvcW', 'nodes': [n['name'] for n in N if (n.get('credentials') or {}).get('googleApi', {}).get('id') == 'SEOcredGoogleSvcW'],
                                'method': by[SUBMIT_NODE]['parameters']['method'], 'from': outs('Any Sitemap Submit?')[:1], 'kill_switch': SITEMAP_SUBMIT},
           'callback': {'has': 'Has Callback (Index)?', 'post': 'POST Index Report', 'body': by['POST Index Report']['parameters']['jsonBody']},
           'page_cols': [c for c, _ in INDEX_PAGES_COLS], 'run_cols': [c for c, _ in INDEX_RUNS_COLS], 'impact_cols': [c for c, _ in UPDATE_IMPACT_COLS],
           'event_cols': [c for c, _ in GOOGLE_EVENTS_COLS], 'history_cols': [c for c, _ in INDEX_HISTORY_COLS]},
          open(os.path.join(HERE, 'harness', 'index_wiring.json'), 'w'), indent=1, sort_keys=True)
# R9 / R31: the ledger wiring, merged after the workflow is written (ledger_mainline filled `ai_nodes`, `balance`, `guard` ...)
_lw = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw)) if os.path.exists(_lw) else {}
_lwj.setdefault('monitors', {})[NAME] = WIRING
json.dump(_lwj, open(_lw, 'w'), indent=1, sort_keys=True)
