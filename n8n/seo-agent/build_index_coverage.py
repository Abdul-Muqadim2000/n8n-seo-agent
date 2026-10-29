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
                           dt_upsert_params, dt_upsert_params_keys, dt_update_params, read_v5, engine_tz,
                           SITES_TABLE, MONITORS_TABLE, PAGES_TABLE, PAGE_WATCH_TABLE, LOG_TABLE,
                           INDEX_PAGES_TABLE, INDEX_PAGES_COLS, INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS, INDEX_RUNS_TABLE, INDEX_RUNS_COLS,
                           GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS, UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS,
                           RUN_LEDGER_TABLE, RUN_LEDGER_COLS, monitor_ledger_js, LEDGER_EST, ledger_mainline, OPS_ALERTS_TABLE)

HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentIndexCv1', 'SEO Agent — Index Coverage', 'SEO_Agent_Index_Coverage.json'
TAG, MODE = 'Index', 'index_coverage'
SCHEDULE = {'hour': 5, 'minute': 15}   # free slot: Page Watch 05:45, AI Pulse 06:30, the catch-up sweeps :07/:22/:37/:52, the dispatcher every 5 min
NS = uuid.UUID('3b7c1e52-9a40-4f0e-8d6b-1dc0e0a1c0de')
nid = lambda name: str(uuid.uuid5(NS, 'indexcov:' + name))
GOOGLE = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}   # read-only scope (sync_credentials.py); never changed here
INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
INCIDENTS_URL = 'https://status.search.google.com/incidents.json'
POLICY_URL = 'https://developers.google.com/search/docs/essentials/spam-policies'
UA = 'Mozilla/5.0 (compatible; SEO-Agent/4.16; +index-coverage)'

PW_SRC = read_v5('code/_page_watch.js').rstrip('\n')
IX_SRC = read_v5('code/_index_kit.js').rstrip('\n')
TZ = engine_tz()
rd = lambda f, **kw: _fill(read_v5('code/' + f), **kw)


def _fill(src, round_no=None):
    s = src.replace('/*__PAGE_WATCH__*/', PW_SRC).replace('/*__INDEX_KIT__*/', IX_SRC).replace('__ENGINE_TZ__', TZ)
    if round_no is not None:
        s = s.replace('__ROUND__', str(round_no))
    for ph in ('/*__PAGE_WATCH__*/', '/*__INDEX_KIT__*/', '__ENGINE_TZ__', '__ROUND__'):
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
def text_get(url, follow=True, batch=5, interval=250, timeout=30000):
    o = {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout,
         'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}
    if not follow: o['redirect'] = {'redirect': {'followRedirects': False}}
    return {'method': 'GET', 'url': url, 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': UA},
            {'name': 'Accept', 'value': 'text/html,application/xhtml+xml,application/xml,text/xml,application/json,text/plain,*/*'}]}, 'options': o}

# ---- row 0: doors, own tables, loads, plan ----
node('Daily Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'days', 'daysInterval': 1, 'triggerAtHour': SCHEDULE['hour'], 'triggerAtMinute': SCHEDULE['minute']}]}}, at(0, 0))
node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
OWN = [('Ensure Index Pages Table', INDEX_PAGES_TABLE, INDEX_PAGES_COLS), ('Ensure Index History Table', INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS),
       ('Ensure Index Runs Table', INDEX_RUNS_TABLE, INDEX_RUNS_COLS), ('Ensure Google Events Table', GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS),
       ('Ensure Update Impact Table', UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS)]
for i, (nm, t, cols) in enumerate(OWN):
    node(nm, DT_TYPE, DT_VERSION, dt_create_params(t, cols), at(1 + i, 0), onError='continueRegularOutput', executeOnce=True)
LOADS = [('Load Sites (Index)', dt_get_all_params(SITES_TABLE)), ('Load Monitors (Index)', dt_get_all_params(MONITORS_TABLE)),
         ('Load Pages (Index)', dt_get_all_params(PAGES_TABLE)), ('Load Page Watch (Index)', dt_get_all_params(PAGE_WATCH_TABLE)),
         # our own pages: the content log's published rows (the ladder pages too - publish detection and "I published it" write both tables). seo_ladders
         # is not read: its rows are keyword rungs, a read path the fit gate guards (gate_lint), and the content log already carries every published URL
         ('Load Content Log (Index)', dt_get_where_params(LOG_TABLE, 'status', 'eq', 'published')),
         ('Load Index Pages', dt_get_all_params(INDEX_PAGES_TABLE)),
         # today's runs only (the cap is a day's): two days back covers every time zone
         ('Load Index Runs', dt_get_all_where_params(INDEX_RUNS_TABLE, [('run_at', 'gte', '={{ new Date(Date.now() - 2 * 864e5).toISOString() }}')])),
         ('Load Google Events', dt_get_all_params(GOOGLE_EVENTS_TABLE)), ('Load Update Impact', dt_get_all_params(UPDATE_IMPACT_TABLE))]
for i, (nm, params) in enumerate(LOADS):
    node(nm, DT_TYPE, DT_VERSION, params, at(6 + i, 0), **LOAD)
code('Index Plan', rd('IX_Plan.js'), at(16, 0))
# ---- row 1: Google's news (once per run) ----
node('Fetch Google Incidents', 'n8n-nodes-base.httpRequest', 4.5, text_get(INCIDENTS_URL, batch=1, interval=0), at(17, 1), executeOnce=True, **HTTP_X)
node('Fetch Spam Policies', 'n8n-nodes-base.httpRequest', 4.5, text_get(POLICY_URL, batch=1, interval=0), at(18, 1), executeOnce=True, **HTTP_X)
code('Google Events', rd('IX_Google_Events.js'), at(19, 1))
code('Google Event Rows', "// Index coverage: the seo_google_events rows that are new or changed (exact columns: the upsert maps every input field).\n"
     "const g = ($('Google Events').first() || {}).json || {};\nconst rows = g.rows || [];\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no event changed' } }];\n", at(20, 1))
iff('Any Event Rows?', '{{ !$json.skip }}', at(21, 1))
node('Save Google Events', DT_TYPE, DT_VERSION, dt_upsert_params(GOOGLE_EVENTS_TABLE, GOOGLE_EVENTS_COLS, 'event_id'), at(22, 0), **SAVE)
node('GSC Sites (Index)', 'n8n-nodes-base.httpRequest', 4.5, google('GET', 'https://www.googleapis.com/webmasters/v3/sites'), at(23, 1), credentials=GOOGLE, executeOnce=True, **HTTP_X)
code('Index Sites', rd('IX_Sites.js'), at(24, 1))
iff('Any Sites (Index)?', "{{ !$('Index Sites').first().json.skip }}", at(25, 1))
node('Nothing To Do (Index)', 'n8n-nodes-base.noOp', 1, {}, at(26, 2))
# ---- row 2: Search Console (submitted sitemaps, pages with impressions) ----
code('Sitemaps List Requests', rd('IX_Sitemaps_List_Requests.js'), at(26, 1)); iff('Any Sitemaps List?', '{{ !$json.skip }}', at(27, 1))
node('GSC Sitemaps List', 'n8n-nodes-base.httpRequest', 4.5, google('GET', '={{ $json.url }}'), at(28, 0), credentials=GOOGLE, **HTTP_X)
code('Pages Query Requests', rd('IX_Pages_Query_Requests.js'), at(29, 1)); iff('Any Pages Query?', '{{ !$json.skip }}', at(30, 1))
node('GSC Pages Query', 'n8n-nodes-base.httpRequest', 4.5, google('POST', '={{ $json.url }}'), at(31, 0), credentials=GOOGLE, **HTTP_X)
# ---- row 3: the sitemap tree, three rounds ----
for r in (1, 2, 3):
    x = 31 + (r - 1) * 4
    code('Sitemap Requests ' + str(r), rd('IX_Sitemap_Requests.js', round_no=r), at(x + 1, 3))
    iff('Any Sitemaps ' + str(r) + '?', '{{ !$json.skip }}', at(x + 2, 3))
    node('Fetch Sitemaps ' + str(r), 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}'), at(x + 3, 2), **HTTP_X)
    code('Sitemap Read ' + str(r), rd('IX_Sitemap_Read.js', round_no=r), at(x + 4, 3))
# ---- row 4: inventory, plan, inspections, our own reads ----
code('Index Inventory', rd('IX_Inventory.js'), at(44, 4))
code('Index Probe Requests', rd('IX_Probe_Requests.js'), at(45, 4)); iff('Any Probes?', '{{ !$json.skip }}', at(46, 4))
node('Inspect URL (Probe)', 'n8n-nodes-base.httpRequest', 4.5, google('POST', INSPECT_URL), at(47, 3), credentials=GOOGLE, **HTTP_X)
code('Index Inspect Requests', rd('IX_Inspect_Requests.js'), at(48, 4)); iff('Any Inspections (Index)?', '{{ !$json.skip }}', at(49, 4))
node('Inspect URL (Index)', 'n8n-nodes-base.httpRequest', 4.5, google('POST', INSPECT_URL), at(50, 3), credentials=GOOGLE, **HTTP_X)
code('Page Fetch Requests', rd('IX_Page_Fetch_Requests.js'), at(51, 4)); iff('Any Page Fetches?', '{{ !$json.skip }}', at(52, 4))
node('Fetch Page (Index)', 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', follow=False, timeout=20000), at(53, 3), **HTTP_X)
code('Fetch Hop Requests', rd('IX_Fetch_Hop_Requests.js'), at(54, 4)); iff('Any Hops?', '{{ !$json.skip }}', at(55, 4))
node('Fetch Page (Final)', 'n8n-nodes-base.httpRequest', 4.5, text_get('={{ $json.url }}', timeout=20000), at(56, 3), **HTTP_X)
# ---- row 5: diagnosis, saves, update impact, run rows, report ----
code('Index Diagnose', rd('IX_Diagnose.js'), at(57, 5))
code('Index Page Rows', rd('IX_Page_Rows.js'), at(58, 5)); iff('Any Index Rows?', '{{ !$json.skip }}', at(59, 5))
node('Save Index Pages', DT_TYPE, DT_VERSION, dt_upsert_params_keys(INDEX_PAGES_TABLE, INDEX_PAGES_COLS, ['site_id', 'url']), at(60, 4), **SAVE)
code('Index History Rows', rd('IX_History_Rows.js'), at(61, 5)); iff('Any History Rows?', '{{ !$json.skip }}', at(62, 5))
node('Save Index History', DT_TYPE, DT_VERSION, dt_insert_params(INDEX_HISTORY_TABLE, INDEX_HISTORY_COLS), at(63, 4), **SAVE)
code('Update Impact Requests', rd('IX_Impact_Requests.js'), at(64, 5)); iff('Any Impact Queries?', '{{ !$json.skip }}', at(65, 5))
node('GSC Impact Query', 'n8n-nodes-base.httpRequest', 4.5, google('POST', '={{ $json.url }}'), at(66, 4), credentials=GOOGLE, **HTTP_X)
code('Update Impact Rows', rd('IX_Impact_Rows.js'), at(67, 5)); iff('Any Update Impact?', '{{ !$json.skip }}', at(68, 5))
node('Save Update Impact', DT_TYPE, DT_VERSION, dt_upsert_params_keys(UPDATE_IMPACT_TABLE, UPDATE_IMPACT_COLS, ['site_id', 'event_id']), at(69, 4), **SAVE)
code('Index Run Rows', rd('IX_Run_Rows.js'), at(70, 5)); iff('Any Run Rows?', '{{ !$json.skip }}', at(71, 5))
node('Save Index Runs', DT_TYPE, DT_VERSION, dt_insert_params(INDEX_RUNS_TABLE, INDEX_RUNS_COLS), at(72, 4), **SAVE)
code('Index Report', rd('IX_Report.js'), at(73, 5))
iff('Has Callback (Index)?', '{{ !!$json.callback_url }}', at(74, 5))
node('POST Index Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json',
     'jsonBody': "={{ JSON.stringify({ stage: 'index_coverage', status: $json.status || 'complete', domain: $json.domain, site_id: $json.site_id, request_id: $json.request_id, "
                 "summary: $json.summary, report_markdown: $json.report_markdown, cost: $json.cost || { usd: 0 }, run_ledger: $json.run_ledger || null, "
                 "...($json.ran_late && $json.ran_late.late ? { ran_late: $json.ran_late } : {}) }) }}", 'options': {'timeout': 30000}},
     at(75, 5), onError='continueRegularOutput')
node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': """## SEO Agent — Index Coverage (2026-10-29)
Every day at **05:15** (n8n's clock) and on demand (*Manual Run* `{ domain | site_id, callback_url?, request_id?, cap? }`). **Free**: Google's Search Console APIs (read-only) and plain GETs, no DataForSEO, no Claude; a $0 run-ledger row.
Per website with Search Console and `seo_monitors.index_watch` not off: the full sitemap tree, the submitted sitemaps, the pages with impressions (90 days), the Site Tracker's inventory and our own published pages -> **one cause per page** (DESIGN §4), its action (`site_fix`, `links`, `quality`, `duplicate`, `wait`, `leave_out`) and one plain sentence. **URL Inspection within a cap** (`index_daily_cap`, default 300 a day, 20-1,200; 2 probes first: a quota / access answer stops the site for the day; 150 ms apart); a Site Tracker reading of the last 3 days is reused; impressions in the last 28 days count as indexed without spending quota. Our own read (<= 60 pages a day) of the pages Google does not have.
Google's **Search Status Dashboard** and the **spam-policies page** once a run (`seo_google_events`): a core / spam update rolling out freezes quality suggestions; 7 days after it finishes the site's pages are compared before / after (`seo_update_impact`).
Writes only `seo_index_pages`, `seo_index_history`, `seo_index_runs`, `seo_google_events`, `seo_update_impact`. Callback `index_coverage` on Mondays, or the day a page drops out or an update starts / finishes. Never submits to Google, never changes a site, never says a page "will be indexed".""",
     'height': 420, 'width': 1300, 'color': 5}, [16 * 220 - 40, -560])

# ---- wiring ----
chain('Daily Schedule', OWN[0][0]); link('Manual Run', OWN[0][0])
chain(*[o[0] for o in OWN], *[l[0] for l in LOADS], 'Index Plan', 'Fetch Google Incidents', 'Fetch Spam Policies', 'Google Events', 'Google Event Rows', 'Any Event Rows?')
link('Any Event Rows?', 'Save Google Events', 0); link('Any Event Rows?', 'GSC Sites (Index)', 1); link('Save Google Events', 'GSC Sites (Index)')
chain('GSC Sites (Index)', 'Index Sites', 'Any Sites (Index)?')
link('Any Sites (Index)?', 'Sitemaps List Requests', 0); link('Any Sites (Index)?', 'Nothing To Do (Index)', 1)
def gate(req, cond, http, nxt):
    chain(req, cond); link(cond, http, 0); link(cond, nxt, 1); link(http, nxt)
gate('Sitemaps List Requests', 'Any Sitemaps List?', 'GSC Sitemaps List', 'Pages Query Requests')
gate('Pages Query Requests', 'Any Pages Query?', 'GSC Pages Query', 'Sitemap Requests 1')
for r in (1, 2, 3):
    gate('Sitemap Requests %d' % r, 'Any Sitemaps %d?' % r, 'Fetch Sitemaps %d' % r, 'Sitemap Read %d' % r)
    link('Sitemap Read %d' % r, 'Sitemap Requests %d' % (r + 1) if r < 3 else 'Index Inventory')
link('Index Inventory', 'Index Probe Requests')
gate('Index Probe Requests', 'Any Probes?', 'Inspect URL (Probe)', 'Index Inspect Requests')
gate('Index Inspect Requests', 'Any Inspections (Index)?', 'Inspect URL (Index)', 'Page Fetch Requests')
gate('Page Fetch Requests', 'Any Page Fetches?', 'Fetch Page (Index)', 'Fetch Hop Requests')
gate('Fetch Hop Requests', 'Any Hops?', 'Fetch Page (Final)', 'Index Diagnose')
link('Index Diagnose', 'Index Page Rows')
gate('Index Page Rows', 'Any Index Rows?', 'Save Index Pages', 'Index History Rows')
gate('Index History Rows', 'Any History Rows?', 'Save Index History', 'Update Impact Requests')
gate('Update Impact Requests', 'Any Impact Queries?', 'GSC Impact Query', 'Update Impact Rows')
gate('Update Impact Rows', 'Any Update Impact?', 'Save Update Impact', 'Index Run Rows')
gate('Index Run Rows', 'Any Run Rows?', 'Save Index Runs', 'Index Report')
chain('Index Report', 'Has Callback (Index)?'); link('Has Callback (Index)?', 'POST Index Report', 0)

# the code nodes read each other by these names; a rename that misses one must fail here, not in production
_src = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
_names = {n['name'] for n in N}
for _n, _s in _src.items():
    for _ref in re.findall(r"\$\('([^']+)'\)", _s):
        assert _ref in _names or _ref.startswith('Sitemap Read ') or _ref.startswith('Sitemap Requests ') or _ref.startswith('Fetch Sitemaps '), _n + ' reads a node that does not exist: ' + _ref
for _n in ('Index Plan', 'Google Events', 'Index Inventory', 'Index Diagnose', 'Index Report', 'Update Impact Rows', 'Index Run Rows', 'Index Probe Requests', 'Index Inspect Requests',
           'Page Fetch Requests', 'Update Impact Requests', 'Sitemap Requests 1', 'Sitemap Read 1'):
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

WIRING = ledger_nodes('Index Plan', ['Index Report', 'Nothing To Do (Index)'], at(16, 7))
wfobj = {'id': WID, 'name': NAME, 'active': False,
         'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 3600, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'},
         'tags': [], 'nodes': N, 'connections': C}
_declared = list(WIRING['settle_from'])
ledger_mainline(wfobj, WIRING)
monitor_cost.callback_after_settle(wfobj, WIRING, 'Has Callback (Index)?', 'POST Index Report', V5, _declared)
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
for n in N:
    if n['type'] == 'n8n-nodes-base.httpRequest' and 'googleapis.com' in str(n['parameters'].get('url')) + str(n['parameters'].get('url')):
        assert n.get('credentials') == GOOGLE, n['name'] + ': the Google calls use the shared read-only service account'
    if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('method') in ('PUT', 'DELETE', 'PATCH'):
        raise AssertionError(n['name'] + ': Index Coverage never changes anything outside its tables')
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
           'callback': {'has': 'Has Callback (Index)?', 'post': 'POST Index Report', 'body': by['POST Index Report']['parameters']['jsonBody']},
           'page_cols': [c for c, _ in INDEX_PAGES_COLS], 'run_cols': [c for c, _ in INDEX_RUNS_COLS], 'impact_cols': [c for c, _ in UPDATE_IMPACT_COLS],
           'event_cols': [c for c, _ in GOOGLE_EVENTS_COLS], 'history_cols': [c for c, _ in INDEX_HISTORY_COLS]},
          open(os.path.join(HERE, 'harness', 'index_wiring.json'), 'w'), indent=1, sort_keys=True)
# R9 / R31: the ledger wiring, merged after the workflow is written (ledger_mainline filled `ai_nodes`, `balance`, `guard` ...)
_lw = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw)) if os.path.exists(_lw) else {}
_lwj.setdefault('monitors', {})[NAME] = WIRING
json.dump(_lwj, open(_lw, 'w'), indent=1, sort_keys=True)
