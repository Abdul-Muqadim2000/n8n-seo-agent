#!/usr/bin/env python3
"""Builds SEO Agent - Keyword Intelligence (SEOagentKIntel1): Competitors and Keyword research (docs/keyword-intel-2026-11-08/DESIGN.md §2-§5,
§7, frozen in CONTRACTS.md). Run at the end of build_v4.py with the other sub-builds.

E2 (2026-11-08) replaces W0's skeleton with the worker. The API front door (build_api.py) hands it the requests of modes `competitors` and
`keyword_research` (Execute Workflow, no wait, after the 202). The run:

  1. reads the request (`{ headers, body }`), the website's seo_monitors row (ki_mode), the kill switch (seo_cache `ki:kill`, any read error =
     killed) and its seo_sites row (the main market); refuses - before any spend, no ledger row - when killed, Off, or asked for another country
     than the site's market (`market_mismatch`), with the final KI callback, status `refused`;
  2. plans (KI Plan: seeds, the chosen set, every request priced, the estimate held under the quote) and reserves its seo_run_ledger row on the
     MAIN path (ledger_mainline: balance probe, open runs, the run guard RG), then applies the API front door's guards (KI Limit: the company's
     runs today under the same key as the main Rate Limit, the day's AI and search-data budgets, the balance floor); a refusal there is marked
     `refused` on its row and told to the caller;
  3. posts the started notice and runs one of the two pipelines, every DataForSEO call behind the in-200 gate (dfs_gate.splice; no node-level
     retry on these paid multi-item calls), the results-page day cache (`serp:*`, cost 0 on a hit) and the ki:* cache (KI.CONFIG lifetimes);
  4. writes seo_ki_competitors / seo_ki_keywords / seo_ki_gaps / seo_ki_runs (exactly their columns) and the cache rows, settles its ledger row at
     every end (the refusal ends are their own settle), and posts the final callback after the settle with its `run_ledger` (R115).

It calls no model. Kits inlined: KIW (v5/code/_ki_io.js, this worker's input / output), KI (v5/code/_ki.js, E1; until it lands the thin shim
v5/code/_ki_shim.js), SU (v5/code/_serp_url.js, the SERP-GOTO hotfix; until it lands the guarded shim v5/code/_su_shim.js), SC (_serp_cache.js),
RT (_dfs_retry.js), the fit gate (_fit_gate.js), SM (_site_model.js, page mapping) and COUNTRIES (the main workflow's Normalize Input).
Code nodes are also written to harness/code_v4 for the offline harness (scenarios_ki_w0.js, scenarios_ki_e2.js)."""
import json, os, re, uuid, math
import env_settings as _env   # B-F5: a build with no n8n/.env refuses, unless the offline build is deliberate
_env.require_settings('build_ki.py')
import url_lint      # D15: no node builds a site URL by hand
import retry_lint    # G1 / N3: one retry rule for every external HTTP node; paid multi-item calls are retried per item by their gate
import dfs_gate      # B-A10: the in-200 retry gate, spliced around every DataForSEO call
import monitor_cost  # R115: the callback waits for the settle and carries its figure
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_where_params, dt_get_where_params, dt_upsert_params,
                           dt_upsert_params_keys, dt_update_params, dt_delete_where_params, read_v5,
                           MONITORS_TABLE, CACHE_TABLE, CACHE_COLS, SITES_TABLE, QUERY_TABLE, LADDER_TABLE, AI_VIS_TABLE, AI_ANSWERS_TABLE, PAGES_TABLE,
                           KI_RUNS_TABLE, KI_RUNS_COLS, KI_COMP_TABLE, KI_COMP_COLS, KI_KW_TABLE, KI_KW_COLS, KI_GAPS_TABLE, KI_GAPS_COLS,
                           RUN_LEDGER_TABLE, RUN_LEDGER_COLS, monitor_ledger_js, LEDGER_EST, ledger_mainline, freeze_ids)

HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentKIntel1', 'SEO Agent - Keyword Intelligence', 'SEO_Agent_Keyword_Intelligence.json'
TAG, MODE = 'KI', 'keyword_research'   # the ledger chain's build-time mode; the row and the run guard read the run's own kind (below)
RULE_VERSION = 'ki-1'
KILL_KEY = 'ki:kill'
STAGES = {'competitors': 'ki_competitors', 'keyword_research': 'ki_research'}
NS = uuid.UUID('6c1e0b7a-4d2f-4a9e-b3c1-0000ce110de1')
nid = lambda name: str(uuid.uuid5(NS, 'kintel:' + name))
DFS_CRED = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
UA = 'Mozilla/5.0 (compatible; SEO-Agent/4.16; +keyword-intelligence)'

# ---- what is baked in: the main workflow's own figures, read from its generated nodes (one source, never retyped) ----
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json'), encoding='utf-8'))[0]
_NI = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
_RL = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Rate Limit')['parameters']['jsCode']
_COUNTRIES = re.search(r"\nconst COUNTRIES = \{.*?\n\};", _NI, re.S); assert _COUNTRIES, 'Normalize Input: COUNTRIES not found'
_cfg = lambda k: re.search(r"\n\s+" + k + r":\s*([^,]+),", _NI)
BUDGET = {}
for _k, _cast in (('ai_budget_usd', float), ('dfs_budget_usd', float), ('dfs_balance_floor_usd', float), ('run_stale_hours', float)):
    _m = _cfg(_k); assert _m, 'Normalize Input CONFIG: ' + _k + ' not found'; BUDGET[_k] = _cast(_m.group(1).strip())
_p = re.search(r"\n\s+ai_budget_period:\s*'(\w+)'", _NI); assert _p, 'Normalize Input CONFIG: ai_budget_period not found'; BUDGET['ai_budget_period'] = _p.group(1)
_lim = re.search(r"const LIMITS = \{ per_key_per_day: (\d+), global_per_day: (\d+), per_app_company_per_day: (\d+) \};", _RL); assert _lim, 'Rate Limit: LIMITS not found'
LIMITS = {'per_key_per_day': int(_lim.group(1)), 'global_per_day': int(_lim.group(2)), 'per_app_company_per_day': int(_lim.group(3))}
_CC = read_v5('code/_cost_cal.js')
def _est(table, key):
    blk = re.search(r"const " + table + r" = \{(.*?)\n  \};", _CC, re.S); assert blk, table + ' not found in _cost_cal.js'
    m = re.search(r"\n\s+" + key + r":\s*([0-9.]+)", blk.group(1)); assert m, table + '.' + key + ' not found'; return float(m.group(1))
QUOTE = {'competitors': _est('DFS_EST', 'competitors'), 'keyword_research': _est('DFS_EST', 'keyword_research')}
# a page the plan proposes is quoted in credits as the app quotes a content run: (Claude + search data) x markup 3 / $0.05 a credit
PAGE_CREDITS = int(math.ceil(round((_est('EST', 'content') + _est('DFS_EST', 'content')) * 3 / 0.05, 2) - 1e-9))
KI_COLS = {'KI_RUNS': [c for c, _ in KI_RUNS_COLS], 'KI_COMP': [c for c, _ in KI_COMP_COLS], 'KI_KW': [c for c, _ in KI_KW_COLS], 'KI_GAPS': [c for c, _ in KI_GAPS_COLS]}

# ---- the kits ----
_has = lambda f: os.path.exists(os.path.join(V5, 'code', f))
KI_KIT = '_ki.js' if _has('_ki.js') else '_ki_shim.js'          # E1's kit when it is merged, the thin shim until then
SU_KITS = (['_serp_url.js'] if _has('_serp_url.js') else []) + ['_su_shim.js']   # the hotfix kit when merged; the shim keeps SU.normalize either way
KIT_SRC = {
    'RT': read_v5('code/_dfs_retry.js').rstrip('\n'),
    'SC': read_v5('code/_serp_cache.js').rstrip('\n'),
    'SU': '\n'.join(read_v5('code/' + f).rstrip('\n') for f in SU_KITS),
    'KI': read_v5('code/' + KI_KIT).rstrip('\n'),
    'FIT': read_v5('code/_fit_gate.js').rstrip('\n'),
    'SM': read_v5('code/_site_model.js').rstrip('\n'),
    'COUNTRIES': "// ---- countries: copied from the main workflow's Normalize Input by build_ki.py (DataForSEO location code = 2000 + ISO numeric) ----" + _COUNTRIES.group(0),
    'KIW': read_v5('code/_ki_io.js').rstrip('\n').replace('__KI_QUOTE__', json.dumps(QUOTE, sort_keys=True)).replace('__KI_COLS__', json.dumps(KI_COLS)),
}
assert '__KI_' not in KIT_SRC['KIW'], 'a placeholder is left in _ki_io.js'
BASE_KITS = ['RT', 'SC', 'SU', 'KI', 'KIW']
def kits_for(names):
    order = ['COUNTRIES', 'FIT', 'SM', 'RT', 'SC', 'SU', 'KI', 'KIW']
    return '\n'.join(KIT_SRC[k] for k in order if k in names)
RAW = {}   # file -> the node's own code (before the kits), for the name check below
def src(f, kits=(), sub=None):
    s = read_v5('code/' + f)
    RAW[f] = s
    if '/*__KI_KITS__*/' in s: s = s.replace('/*__KI_KITS__*/', kits_for(set(BASE_KITS) | set(kits)))
    s = s.replace('__RULE_VERSION__', RULE_VERSION).replace('__KILL_KEY__', KILL_KEY).replace('__KI_LIMITS__', json.dumps(LIMITS, sort_keys=True)) \
         .replace('__KI_BUDGET__', json.dumps(BUDGET, sort_keys=True)).replace('__KI_PAGE_CREDITS__', str(PAGE_CREDITS))
    for k, v in (sub or {}).items(): s = s.replace(k, v)
    for ph in ('/*__KI_KITS__*/', '__RULE_VERSION__', '__KILL_KEY__', '__KI_LIMITS__', '__KI_BUDGET__', '__KI_PAGE_CREDITS__', '__WHAT__', '__TABLE__', '__FIELD__'):
        assert ph not in s, ph + ' left in ' + f
    return s

N, C = [], {}
def node(name, ntype, ver, params, pos, **extra):
    assert not any(n['name'] == name for n in N), 'duplicate node ' + name
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); N.append(n); return n
def code(name, s, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': s}, pos, **extra)
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
def dfs_post(name, pos, batch=5, interval=250, timeout=60000):
    # a paid call that can carry several items: no node-level retry (N3); a failed request becomes an { error } item its gate re-sends once
    return node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth',
        'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
        'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout}}, pos, credentials=DFS_CRED, onError='continueRegularOutput')
def callback(name, pos, body='={{ JSON.stringify($json.callback_body) }}'):
    return node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': body, 'options': {'timeout': 30000}}, pos, onError='continueRegularOutput')
def gated_step(req_node, if_node, http, nxt, row, col0, batch=5, interval=250):
    """<Requests> -> <Any X?> -(yes)-> <HTTP> -> (the gate, spliced later) -> <next>; -(no)-> <next>"""
    iff(if_node, '{{ !$json.skip }}', at(col0 + 1, row))
    dfs_post(http, at(col0 + 2, row), batch, interval)
    chain(req_node, if_node); link(if_node, http, 0); link(if_node, nxt, 1); link(http, nxt)
GATED = []   # (http node, what it reads, unit)

# ---- row 0: the door, the tables, the gate (nothing spends before the ledger) ----
node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 0))
code('KI Input', src('KI_Input.js'), at(1, 0))
OWN = [('Ensure KI Runs Table', KI_RUNS_TABLE, KI_RUNS_COLS), ('Ensure KI Competitors Table', KI_COMP_TABLE, KI_COMP_COLS),
       ('Ensure KI Keywords Table', KI_KW_TABLE, KI_KW_COLS), ('Ensure KI Gaps Table', KI_GAPS_TABLE, KI_GAPS_COLS)]
for i, (nm, t, cols) in enumerate(OWN):
    node(nm, DT_TYPE, DT_VERSION, dt_create_params(t, cols), at(2 + i, 0), onError='continueRegularOutput', executeOnce=True)
SID = "={{ $('KI Input').first().json.site_id }}"
node('Load Monitors (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(MONITORS_TABLE, [('site_id', 'eq', SID)]), at(6, 0), **LOAD)
node('Load Kill Switch (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(CACHE_TABLE, [('key', 'eq', KILL_KEY)]), at(7, 0), **LOAD)
node('Load Site (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(SITES_TABLE, [('site_id', 'eq', SID)]), at(8, 0), **LOAD)
code('KI Gate', src('KI_Gate.js', ['COUNTRIES']), at(9, 0), executeOnce=True)
iff('KI Refused?', '{{ $json.refused === true }}', at(10, 0))
iff('Has Callback (KI Refusal)?', '{{ !!$json.callback_url }}', at(11, -1))
callback('POST KI Refusal', at(12, -1))
chain('Manual Run', 'KI Input', *[o[0] for o in OWN], 'Load Monitors (KI)', 'Load Kill Switch (KI)', 'Load Site (KI)', 'KI Gate', 'KI Refused?')
link('KI Refused?', 'Has Callback (KI Refusal)?', 0); link('Has Callback (KI Refusal)?', 'POST KI Refusal', 0)
# ---- the loads the plan needs (free) ----
G = lambda f: "={{ $('KI Gate').first().json." + f + " }}"
LOADS = [('Load KI Cache', dt_get_all_where_params(CACHE_TABLE, [('kind', 'eq', 'ki'), ('site_id', 'eq', G('site_id'))])),
         ('Load KI Competitors', dt_get_all_where_params(KI_COMP_TABLE, [('site_id', 'eq', G('site_id'))])),
         ('Load KI Gaps', dt_get_all_where_params(KI_GAPS_TABLE, [('site_id', 'eq', G('site_id'))])),
         ('Load Query History (KI)', dt_get_all_where_params(QUERY_TABLE, [('site_id', 'eq', G('site_id')), ('period_end', 'gte', '={{ new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10) }}')])),
         ('Load Ladders (KI)', dt_get_all_where_params(LADDER_TABLE, [('domain', 'eq', G('domain'))])),
         ('Load AI Visibility (KI)', dt_get_all_where_params(AI_VIS_TABLE, [('site_id', 'eq', G('site_id')), ('checked_at', 'gte', '={{ new Date(Date.now() - 60 * 864e5).toISOString() }}')])),
         ('Load AI Answers (KI)', dt_get_all_where_params(AI_ANSWERS_TABLE, [('site_id', 'eq', G('site_id')), ('checked_at', 'gte', '={{ new Date(Date.now() - 60 * 864e5).toISOString() }}')])),
         ('Load Pages (KI)', dt_get_all_where_params(PAGES_TABLE, [('site_id', 'eq', G('site_id'))]))]
for i, (nm, params) in enumerate(LOADS):
    node(nm, DT_TYPE, DT_VERSION, params, at(11 + i, 1), **LOAD)
code('KI Plan', src('KI_Plan.js', ['FIT']), at(19, 1), executeOnce=True)
link('KI Refused?', LOADS[0][0], 1); chain(*[l[0] for l in LOADS], 'KI Plan')
# ---- after the reservation: the front door's guards, the started notice, the kind ----
node('Load Ledger Today (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(RUN_LEDGER_TABLE, [('created_at', 'gte', '={{ new Date().toISOString().slice(0, 10) }}')]), at(24, 1), **LOAD)
code('KI Limit', src('KI_Limit.js'), at(25, 1), executeOnce=True)
iff('KI Limited?', '{{ $json.limited === true }}', at(26, 1))
node('Refuse KI Limit (KI)', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
     {'status': 'refused', 'settled_usd': 0, 'dfs_usd': 0, 'measured_usd': 0, 'estimated_usd': 0, 'settled_at': "={{ $('KI Limit').first().json.refused_at }}",
      'cost_basis': "={{ $('KI Limit').first().json.cost_basis }}"}), at(27, 0), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
code('KI Limit Notice', src('KI_Limit_Notice.js'), at(28, 0), executeOnce=True)
code('KI Started', src('KI_Started.js'), at(27, 2), executeOnce=True)
iff('Has Callback (KI Started)?', '{{ !!$json.callback_url }}', at(28, 2))
callback('POST KI Started', at(29, 1))
iff('Route KI Kind?', "{{ $('KI Plan').first().json.kind === 'competitors' }}", at(30, 2))
link('KI Plan', 'Load Ledger Today (KI)')   # ledger_mainline moves this behind the reservation (plan -> Ensure Run Ledger -> ... -> Run Allowed? -> here)
chain('Load Ledger Today (KI)', 'KI Limit', 'KI Limited?'); link('KI Limited?', 'Refuse KI Limit (KI)', 0); link('KI Limited?', 'KI Started', 1)
chain('Refuse KI Limit (KI)', 'KI Limit Notice', 'Has Callback (KI Refusal)?')
chain('KI Started', 'Has Callback (KI Started)?'); link('Has Callback (KI Started)?', 'POST KI Started', 0); link('Has Callback (KI Started)?', 'Route KI Kind?', 1); link('POST KI Started', 'Route KI Kind?')

# ---- Competitors (rows 3-4) ----
code('Comp SERP Keys', src('KI_Comp_SERP_Keys.js'), at(31, 3))
node('Load SERP Cache (KI Comp)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ $json.serp_cache_key || 'serp:none' }}"), at(32, 3), onError='continueRegularOutput', alwaysOutputData=True)
code('Comp SERP Requests', src('KI_Comp_SERP_Requests.js'), at(33, 3), executeOnce=True)
code('Comp SERP Picture', src('KI_Comp_SERP_Picture.js'), at(37, 3), executeOnce=True)
link('Route KI Kind?', 'Comp SERP Keys', 0); chain('Comp SERP Keys', 'Load SERP Cache (KI Comp)', 'Comp SERP Requests')
gated_step('Comp SERP Requests', 'Any Comp SERPs?', 'Run Comp SERPs', 'Comp SERP Picture', 3, 33, batch=10, interval=100); GATED.append(('Run Comp SERPs', 'competitor seed results pages', 'results page'))
code('Comp Labs Requests', src('KI_Comp_Labs_Requests.js'), at(38, 3), executeOnce=True)
code('Comp Candidates', src('KI_Comp_Candidates.js'), at(42, 3), executeOnce=True)
link('Comp SERP Picture', 'Comp Labs Requests')
gated_step('Comp Labs Requests', 'Any Comp Labs?', 'Run Comp Labs', 'Comp Candidates', 3, 38); GATED.append(('Run Comp Labs', 'competitor overlap, sizes and referring domains', 'request'))
code('Comp Home Requests', src('KI_Comp_Home_Requests.js'), at(43, 3), executeOnce=True)
iff('Any Comp Homes?', '{{ !$json.skip }}', at(44, 3))
# a plain GET of the public homepage (fullResponse, neverError: a page that is down is an answer, not a failure); its HTML is DATA - only words are counted
node('Read Comp Homes', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': UA}, {'name': 'Accept', 'value': 'text/html,application/xhtml+xml'}]},
     'options': {'batching': {'batch': {'batchSize': 2, 'batchInterval': 500}}, 'timeout': 20000, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
     at(45, 3), onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)
code('Comp Profile Requests', src('KI_Comp_Profile_Requests.js'), at(46, 3), executeOnce=True)
chain('Comp Candidates', 'Comp Home Requests', 'Any Comp Homes?'); link('Any Comp Homes?', 'Read Comp Homes', 0); link('Any Comp Homes?', 'Comp Profile Requests', 1); link('Read Comp Homes', 'Comp Profile Requests')
code('Comp Sitemap Requests', src('KI_Comp_Sitemap_Requests.js'), at(50, 3), executeOnce=True)
gated_step('Comp Profile Requests', 'Any Comp Profiles?', 'Run Comp Profiles', 'Comp Sitemap Requests', 3, 46); GATED.append(('Run Comp Profiles', 'chosen competitors\' ranked keywords', 'request'))
iff('Any Comp Sitemaps?', '{{ !$json.skip }}', at(51, 3))
node('Read Comp Sitemaps', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': UA}]},
     'options': {'batching': {'batch': {'batchSize': 2, 'batchInterval': 500}}, 'timeout': 20000, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
     at(52, 3), onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)
code('Comp Result', src('KI_Comp_Result.js'), at(53, 3), executeOnce=True)
chain('Comp Sitemap Requests', 'Any Comp Sitemaps?'); link('Any Comp Sitemaps?', 'Read Comp Sitemaps', 0); link('Any Comp Sitemaps?', 'Comp Result', 1); link('Read Comp Sitemaps', 'Comp Result')
ROWS = lambda what, table, field: src('KI_Rows.js', sub={'__WHAT__': what, '__TABLE__': table, '__FIELD__': field})
code('KI Comp Rows', ROWS('KI Comp Rows', KI_COMP_TABLE, 'comp_rows'), at(54, 3), executeOnce=True)
iff('Any KI Comp Rows?', '{{ !$json.skip }}', at(55, 3))
node('Save KI Competitors', DT_TYPE, DT_VERSION, dt_upsert_params_keys(KI_COMP_TABLE, KI_COMP_COLS, ['site_id', 'market', 'comp_domain']), at(56, 3), **SAVE)
code('KI Comp Drops', ROWS('KI Comp Drops', KI_COMP_TABLE, 'comp_drops'), at(57, 3), executeOnce=True)
iff('Any KI Comp Drops?', '{{ !$json.skip }}', at(58, 3))
node('Drop KI Competitors', DT_TYPE, DT_VERSION, dt_delete_where_params(KI_COMP_TABLE, [('site_id', 'eq', '={{ $json.site_id }}'), ('market', 'eq', '={{ $json.market }}'), ('comp_domain', 'eq', '={{ $json.comp_domain }}')]), at(59, 3), **SAVE)
chain('Comp Result', 'KI Comp Rows', 'Any KI Comp Rows?'); link('Any KI Comp Rows?', 'Save KI Competitors', 0); link('Any KI Comp Rows?', 'KI Comp Drops', 1); link('Save KI Competitors', 'KI Comp Drops')
chain('KI Comp Drops', 'Any KI Comp Drops?')

# ---- Keyword research (rows 6-7) ----
code('Research Seed Keys', src('KI_Research_Seed_Keys.js'), at(31, 6))
node('Load SERP Cache (KI Seeds)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ $json.serp_cache_key || 'serp:none' }}"), at(32, 6), onError='continueRegularOutput', alwaysOutputData=True)
code('Research Discover Requests', src('KI_Research_Discover_Requests.js'), at(33, 6), executeOnce=True)
code('Research Candidates', src('KI_Research_Candidates.js', ['FIT']), at(37, 6), executeOnce=True)
link('Route KI Kind?', 'Research Seed Keys', 1); chain('Research Seed Keys', 'Load SERP Cache (KI Seeds)', 'Research Discover Requests')
gated_step('Research Discover Requests', 'Any Research Discover?', 'Run Research Discover', 'Research Candidates', 6, 33); GATED.append(('Run Research Discover', 'keyword discovery lists, competitor keywords and the gap', 'request'))
code('Research Enrich Requests', src('KI_Research_Enrich_Requests.js'), at(38, 6), executeOnce=True)
code('Research Picture', src('KI_Research_Picture.js'), at(42, 6), executeOnce=True)
link('Research Candidates', 'Research Enrich Requests')
gated_step('Research Enrich Requests', 'Any Research Enrich?', 'Run Research Enrich', 'Research Picture', 6, 38); GATED.append(('Run Research Enrich', 'search volumes and intents', 'request'))
code('Research SERP Keys', src('KI_Research_SERP_Keys.js'), at(43, 6), executeOnce=True)
node('Load SERP Cache (KI Research)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ $json.serp_cache_key || 'serp:none' }}"), at(44, 6), onError='continueRegularOutput', alwaysOutputData=True)
code('Research SERP Requests', src('KI_Research_SERP_Requests.js'), at(45, 6), executeOnce=True)
code('Research SERP Picture', src('KI_Research_SERP_Picture.js'), at(49, 6), executeOnce=True)
chain('Research Picture', 'Research SERP Keys', 'Load SERP Cache (KI Research)', 'Research SERP Requests')
gated_step('Research SERP Requests', 'Any Research SERPs?', 'Run Research SERPs', 'Research SERP Picture', 6, 45, batch=10, interval=100); GATED.append(('Run Research SERPs', 'keyword results pages and Google Ads volumes', 'request'))
code('Research Traffic Requests', src('KI_Research_Traffic_Requests.js'), at(50, 6), executeOnce=True)
code('Research Result', src('KI_Research_Result.js', ['FIT', 'SM']), at(54, 6), executeOnce=True)
link('Research SERP Picture', 'Research Traffic Requests')
gated_step('Research Traffic Requests', 'Any Research Traffic?', 'Run Research Traffic', 'Research Result', 6, 50); GATED.append(('Run Research Traffic', 'traffic potential of the #1 pages', 'request'))
code('KI KW Rows', ROWS('KI KW Rows', KI_KW_TABLE, 'kw_rows'), at(55, 6), executeOnce=True)
iff('Any KI KW Rows?', '{{ !$json.skip }}', at(56, 6))
node('Save KI Keywords', DT_TYPE, DT_VERSION, dt_upsert_params_keys(KI_KW_TABLE, KI_KW_COLS, ['site_id', 'market', 'kw_key']), at(57, 6), **SAVE)
code('KI Gap Rows', ROWS('KI Gap Rows', KI_GAPS_TABLE, 'gap_rows'), at(58, 6), executeOnce=True)
iff('Any KI Gap Rows?', '{{ !$json.skip }}', at(59, 6))
node('Save KI Gaps', DT_TYPE, DT_VERSION, dt_upsert_params_keys(KI_GAPS_TABLE, KI_GAPS_COLS, ['site_id', 'gap_id']), at(60, 6), **SAVE)
chain('Research Result', 'KI KW Rows', 'Any KI KW Rows?'); link('Any KI KW Rows?', 'Save KI Keywords', 0); link('Any KI KW Rows?', 'KI Gap Rows', 1); link('Save KI Keywords', 'KI Gap Rows')
chain('KI Gap Rows', 'Any KI Gap Rows?')

# ---- the shared end (row 5): cache rows, the run row, the report ----
code('KI Cache Rows', src('KI_Cache_Rows.js'), at(61, 5), executeOnce=True)
iff('Any KI Cache Rows?', '{{ !$json.skip }}', at(62, 5))
node('Save KI Cache', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(63, 5), **SAVE)
code('KI Run Row', src('KI_Run_Row.js'), at(64, 5), executeOnce=True)
node('Save KI Run', DT_TYPE, DT_VERSION, dt_insert_params(KI_RUNS_TABLE, KI_RUNS_COLS), at(65, 5), **SAVE)
code('KI Report', src('KI_Report.js'), at(66, 5), executeOnce=True)
iff('Has Callback (KI)?', '{{ !!$json.callback_url }}', at(67, 5))
callback('POST KI Report', at(68, 5), body='={{ JSON.stringify(Object.assign({}, $json.callback_body, { run_ledger: $json.run_ledger || null })) }}')
link('Any KI Comp Drops?', 'Drop KI Competitors', 0); link('Any KI Comp Drops?', 'KI Cache Rows', 1); link('Drop KI Competitors', 'KI Cache Rows')
link('Any KI Gap Rows?', 'Save KI Gaps', 0); link('Any KI Gap Rows?', 'KI Cache Rows', 1); link('Save KI Gaps', 'KI Cache Rows')
chain('KI Cache Rows', 'Any KI Cache Rows?'); link('Any KI Cache Rows?', 'Save KI Cache', 0); link('Any KI Cache Rows?', 'KI Run Row', 1); link('Save KI Cache', 'KI Run Row')
chain('KI Run Row', 'Save KI Run', 'KI Report', 'Has Callback (KI)?'); link('Has Callback (KI)?', 'POST KI Report', 0)

node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': """## SEO Agent - Keyword Intelligence (KI, E2 2026-11-08)
Started by the API front door (`SEOagentAPIentry`, Execute Workflow, no wait) for modes **competitors** and **keyword_research** (docs/keyword-intel-2026-11-08/DESIGN.md, CONTRACTS.md).

Refuses before any spend (no ledger row) when killed (seo_cache `ki:kill`), Off (seo_monitors.ki_mode) or asked for another country than the website's market. Then: plan + estimate (held under the quote), the run ledger on the main path, the front door's guards (company runs today, budgets, balance), the started notice, the pipeline (every DataForSEO call behind the in-200 gate, the results-page day cache and the ki:* cache), the four KI tables, the settle at every end, the final callback after the settle.

Calls no model. Writes only seo_ki_*, seo_cache (ki:* and serp:*) and the shared run-ledger / ops-alert rows.""", 'height': 360, 'width': 700, 'color': 4}, at(0, -3))

# ---- the in-200 gate around every DataForSEO call (B-A10) ----
wfobj = {'id': WID, 'name': NAME, 'active': False,
         'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 1800, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'},
         'tags': [], 'nodes': N, 'connections': C}
GATES = {}
for http, what, unit in GATED:
    g = dfs_gate.splice(wfobj, http, V5, what, unit=unit)
    retry_lint.record_gate(NAME, g['chain']); GATES[http] = g
ANSWERS = [http + ' Answers' for http, _w, _u in GATED]

# ---- the run ledger (R9 / R17 / B-A9 / R115) ----
ROW, SETTLE = 'Run Ledger Row (' + TAG + ')', 'Settle Run Ledger (' + TAG + ')'
_res_js, _set_js = monitor_ledger_js(V5, MODE, 'KI Plan', ROW, '!' + '|'.join(ANSWERS))
# the row is the run's own kind (competitors | keyword_research), so the self-correcting estimates and the run guard's twin rule are per kind,
# and its key is the caller's (app:<company id>), the key the main workflow's Rate Limit counts a company's runs by
_old_mode = "const MODE = '" + MODE + "';"
assert _res_js.count(_old_mode) == 1, 'Run Ledger Row: its MODE line moved'
_res_js = _res_js.replace(_old_mode, "const MODE = (() => { try { const k = String(($('KI Plan').first().json || {}).kind || ''); return k === 'competitors' || k === 'keyword_research' ? k : '" + MODE + "'; } catch (e) { return '" + MODE + "'; } })();   // KI: the run's own kind")
_old_key = ": (parent_run_id ? 'parent:' + parent_run_id : 'schedule:' + MODE);"
assert _res_js.count(_old_key) == 1, 'Run Ledger Row: its key line moved'
_res_js = _res_js.replace(_old_key, ": (parent_run_id ? 'parent:' + parent_run_id : (String(__trig.client_ip == null ? '' : __trig.client_ip).toLowerCase().trim() || 'schedule:' + MODE));   // KI: the caller's key")
node('Ensure Run Ledger (' + TAG + ')', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), at(20, 1), onError='continueRegularOutput', executeOnce=True)
code(ROW, _res_js, at(21, 1), executeOnce=True)
node('Reserve Run Ledger (' + TAG + ')', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), at(22, 1), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
code('Ledger Settle (' + TAG + ')', _set_js, at(67, 7), executeOnce=True)
node(SETTLE, DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
    {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}', 'cost_mode': '={{ $json.cost_mode }}',
     'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}', 'cost_basis': '={{ $json.cost_basis }}'}), at(68, 7), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
link('KI Plan', 'Ensure Run Ledger (' + TAG + ')'); chain('Ensure Run Ledger (' + TAG + ')', ROW, 'Reserve Run Ledger (' + TAG + ')')
link('Ledger Settle (' + TAG + ')', SETTLE); link('KI Report', 'Ledger Settle (' + TAG + ')')
assert 'competitors' in LEDGER_EST and MODE in LEDGER_EST, 'KI: the ledger estimates of both kinds are in ladder_common.LEDGER_EST'
WIRING = {'mode': MODE, 'plan': 'KI Plan', 'reserve': ROW, 'settle': SETTLE, 'settle_from': ['KI Report', 'Refuse KI Limit (KI)'], 'measured': '!' + '|'.join(ANSWERS),
          'est': LEDGER_EST[MODE], 'resume': 'After Run Ledger (' + TAG + ')'}
_declared = ['KI Report']
ledger_mainline(wfobj, WIRING)
monitor_cost.callback_after_settle(wfobj, WIRING, 'Has Callback (KI)?', 'POST KI Report', V5, _declared)
# the run guard judges the twin rule on the run's own kind (its row's mode), not on the chain's build-time mode
_after = next(n for n in N if n['name'] == 'After Run Ledger (' + TAG + ')')
_g_old = "mode: '" + MODE + "', where: '"
assert _after['parameters']['jsCode'].count(_g_old) == 1, 'After Run Ledger (KI): the gate call moved'
_after['parameters']['jsCode'] = _after['parameters']['jsCode'].replace(_g_old, "mode: String((mine && mine.mode) || (__row && __row.mode) || '" + MODE + "'), where: '")
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
_orphans = sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote' and n['name'] not in reach(['Manual Run']))
assert not _orphans, 'nodes no door reaches: ' + str(_orphans)
_paid = sorted(n['name'] for n in N if retry_lint.is_dfs(n) and n['name'] not in ('DFS Balance (' + TAG + ')', 'DFS Balance End (' + TAG + ')'))
_before = reach(['Manual Run'], blocked={'Reserve Run Ledger (' + TAG + ')'})
assert not [h for h in _paid if h in _before], 'a paid call runs before the run ledger reserves: ' + str([h for h in _paid if h in _before])
# nothing paid, external or written before the gate's refusal: the refusal path is free and writes nothing
_refusal = reach(['Has Callback (KI Refusal)?'])
assert not [x for x in _refusal if retry_lint.is_dfs(by[x]) or (by[x]['type'] == DT_TYPE and by[x]['parameters'].get('operation') != 'get')], 'the refusal path spends or writes: ' + str(sorted(_refusal))
# every paid call is gated and retried per item, never as a whole node (N3)
for http in [g for g, _w, _u in GATED]:
    assert http in GATES and not by[http].get('retryOnFail') and by[http].get('onError') == 'continueRegularOutput', http + ': the per-item pattern'
    assert http + ' (Retry)' in by and not by[http + ' (Retry)'].get('retryOnFail'), http + ' (Retry): the per-item pattern'
# it writes only its own tables, the cache and the shared ledger / ops-alert rows
_own = {t for _, t, _c in OWN} | {CACHE_TABLE}
_shared = {RUN_LEDGER_TABLE, 'seo_ops_alerts'}
_writes = {}
for n in N:
    if n['type'] != DT_TYPE: continue
    p_ = n['parameters']; t_ = (p_.get('dataTableId') or {}).get('value') or p_.get('tableName'); op_ = p_.get('operation')
    if op_ in ('insert', 'upsert', 'update', 'delete', 'deleteRows', 'create'): _writes.setdefault(t_, []).append(n['name'])
_foreign = {t: v for t, v in _writes.items() if t not in _own | _shared}
assert not _foreign, 'Keyword Intelligence writes a table that is not its own: ' + str(_foreign)
assert not any('langchain' in n['type'] or 'api.anthropic.com' in json.dumps(n.get('parameters') or {}) for n in N), 'KI E2: no model call in the worker'
assert 'Callback Ledger (' + TAG + ')' in by and outs('Callback Ledger (' + TAG + ')') == ['Has Callback (KI)?'], 'R115: the callback waits for the settle'
for nm in ('POST KI Report', 'POST KI Refusal', 'POST KI Started'): assert nm in retry_lint.ALLOW, nm + ': a callback POST must be on retry_lint.ALLOW (it inserts a report)'
# the code nodes read each other by these names; a rename that misses one must fail here, not in production
_src = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
for _f, _s in RAW.items():
    for _ref in re.findall(r"\$\('([^']+)'\)", _s):
        assert _ref in names, _f + ' reads a node that does not exist: ' + _ref
for _n, _s in _src.items():
    if 'KIW.' in _s: assert 'const KIW = (() => {' in _s and ('const KI = (() => {' in _s or 'KI.' not in _s.replace('KIW.', '')), _n + ': the KI kits are not inlined'

wfobj = freeze_ids(wfobj)
json.dump([wfobj], open(os.path.join(OUT, FILE), 'w'), indent=2, ensure_ascii=False)
os.makedirs(CODE, exist_ok=True)
# the harness reads every code node by name; a name another workflow already uses would overwrite its file
_others = set()
for fn in os.listdir(OUT):
    if fn.endswith('.json') and fn != FILE:
        for w in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            _others |= {n['name'] for n in w.get('nodes', []) if n.get('type') == 'n8n-nodes-base.code'}
_clash = sorted(n['name'] for n in wfobj['nodes'] if n['type'] == 'n8n-nodes-base.code' and n['name'] in _others)
assert not _clash, 'code node names shared with another workflow (harness/code_v4 would be overwritten): ' + str(_clash)
for n in wfobj['nodes']:
    if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
# what the harness checks (scenarios_ki_w0.js / scenarios_ki_e2.js): the wiring, the gates, the tables, the callbacks, the baked figures
json.dump({'workflow': WID, 'name': NAME, 'file': FILE, 'rule_version': RULE_VERSION, 'kill_key': KILL_KEY, 'stages': STAGES, 'kit': KI_KIT, 'su_kits': SU_KITS,
           'nodes': sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote'),
           'connections': {s_: [[t_['node'] for t_ in l_] for l_ in o_.get('main', [])] for s_, o_ in sorted(C.items())},
           'callback': {'post': 'POST KI Report', 'body': by['POST KI Report']['parameters']['jsonBody'], 'retry': bool(by['POST KI Report'].get('retryOnFail')),
                        'refusal_post': 'POST KI Refusal', 'started_post': 'POST KI Started'},
           'gates': {h: g['chain'] for h, g in GATES.items()}, 'answers': ANSWERS, 'paid': _paid,
           'writes': {t: sorted(v) for t, v in sorted(_writes.items())}, 'own_tables': sorted(_own), 'shared_tables': sorted(_shared),
           'limits': LIMITS, 'budget': BUDGET, 'quote': QUOTE, 'page_credits': PAGE_CREDITS, 'cols': KI_COLS,
           'refusal_path': sorted(_refusal), 'settings': wfobj['settings']},
          open(os.path.join(HERE, 'harness', 'ki_wiring.json'), 'w'), indent=1, sort_keys=True)
# R9 / R31: the ledger wiring, merged after the workflow is written (ledger_mainline filled `ai_nodes`, `balance`, `guard` ...)
_lw = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw)) if os.path.exists(_lw) else {}
_lwj.setdefault('monitors', {})[NAME] = WIRING
json.dump(_lwj, open(_lw, 'w'), indent=1, sort_keys=True)
print('wrote', FILE + ':', len(N), 'nodes (KI E2 worker: competitors + keyword research, ' + str(len(GATED)) + ' gated DataForSEO calls, kit ' + KI_KIT + ')')
