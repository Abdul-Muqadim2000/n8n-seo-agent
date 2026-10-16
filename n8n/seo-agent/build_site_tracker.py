#!/usr/bin/env python3
"""Builds SEO Agent — Site Tracker (weekly, plus on demand): per registered site, Search Console (totals, query/page movers, striking-distance
queries, CTR gaps, decaying pages, tracked keywords, URL inspection of ladder pages), GA4 (organic sessions / key events / landing pages,
property auto-detected), Google Trends (DataForSEO) and live SERP checks for the site's own keywords -> Data Table history -> one Claude
brief -> HTML e-mail + PDF + callback with ready-to-send API bodies. Code nodes are also written to harness/code_v4 for the offline harness."""
import json, os, re, uuid, sys
import url_lint   # D15 (2026-10-11 system review): the canonical-host lint
import retry_lint   # G1 (2026-10-11 system review): one retry rule for every external HTTP node
import dfs_gate     # B-A10 (2026-10-15): INVARIANTS rule 3 — the in-200 retry gate, one shape for every DataForSEO call
from ladder_common import (dt_schema, LADDER_TABLE, LADDER_COLS, HISTORY_TABLE, HISTORY_COLS, SITES_TABLE, METRICS_TABLE, QUERY_TABLE, SITES_COLS, METRICS_COLS, QUERY_COLS,
                           LOG_TABLE, LOG_COLS, TRENDS_TABLE, TRENDS_COLS, CADENCE_TABLE, CADENCE_COLS, ALERTS_TABLE, ALERTS_COLS, CHECKIN_TABLE, CHECKIN_COLS,
                           MONITORS_TABLE, MONITORS_COLS, AI_VIS_TABLE, AI_VIS_COLS, BL_SNAP_TABLE, BL_SNAP_COLS, AUDITS_TABLE, AUDITS_COLS, PROSPECT_TABLE, PROSPECT_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS,
                           LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS, CASE_TABLE, CASE_COLS, AI_TARGETS_TABLE, AI_TARGETS_COLS,
                           PROFILE_TABLE, PROFILE_COLS, PAGES_TABLE, PAGES_COLS, AI_PAGES_TABLE, AI_PAGES_COLS, CACHE_TABLE, CACHE_COLS,
                           DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_upsert_params, dt_get_where_params, dt_upsert_params_keys, dt_update_params, dt_get_recent_params)
from ladder_common import PAGE_WATCH_TABLE, PAGE_WATCH_COLS, AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS, OPS_ALERTS_TABLE, OPS_ALERTS_COLS   # G11 + G25 (2026-10-13, FIX_PLAN): the daily key-page watch
from ladder_common import RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_update_params, monitor_ledger_js, LEDGER_EST   # R9 (2026-10-13): every scheduled run reserves and settles a ledger row
from ladder_common import ledger_mainline, ALERT_WEBHOOK_PLACEHOLDER   # R17 / R29 (2026-10-14)

# R9 (2026-10-13, re-rating): the reserve / settle side branch, the same one build_monitors.py's WF.run_ledger builds. It hangs BESIDE the plan
# node, never in the data path, because a Data Table node answers with the row it wrote rather than with its input.
def ledger_nodes(N_, C_, mode, tag, plan, ends, pos):
    x, y = pos
    row = 'Run Ledger Row (' + tag + ')'
    res_js, set_js = monitor_ledger_js(V5, mode, plan, row, '')
    N_.append(node('Ensure Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x, y], onError='continueRegularOutput', executeOnce=True))
    N_.append(node(row, 'n8n-nodes-base.code', 2, {'jsCode': res_js}, [x + 220, y], executeOnce=True))
    N_.append(node('Reserve Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x + 440, y], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True))
    N_.append(node('Ledger Settle (' + tag + ')', 'n8n-nodes-base.code', 2, {'jsCode': set_js}, [x + 220, y + 160], executeOnce=True))
    N_.append(node('Settle Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS,
        [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
        # R31 (2026-10-14, FIX_PLAN §3.13): these workflows wrote back only the status and two figures, so the honest split the settle
        # computes (G23) never reached the row — the same columns build_monitors.py has always written are written here too.
        {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}',
         'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
         'cost_basis': '={{ $json.cost_basis }}'}),
        [x + 440, y + 160], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True))
    for a_, b_ in ([(plan, 'Ensure Run Ledger (' + tag + ')'), ('Ensure Run Ledger (' + tag + ')', row), (row, 'Reserve Run Ledger (' + tag + ')'),
                    ('Ledger Settle (' + tag + ')', 'Settle Run Ledger (' + tag + ')')] + [(e, 'Ledger Settle (' + tag + ')') for e in ends]):
        link(C_, a_, b_)
    return {'mode': mode, 'plan': plan, 'reserve': row, 'settle': 'Settle Run Ledger (' + tag + ')', 'settle_from': list(ends), 'measured': '', 'est': LEDGER_EST[mode],
            'resume': 'After Run Ledger (' + tag + ')'}   # R17 (2026-10-14): the node that hands the plan's items back to the pipeline

LEDGER_WIRING = {}   # R9: merged into harness/ledger_wiring.json after the last workflow is written
from env_settings import ENV as _ENV_PW
# D25b's channel: the watch pushes the serious changes to it as well. R29 / R30 (2026-10-14): this build reads SEO_ALERT_WEBHOOK_URL not at
# all — neither the value (a secret, and this repository is public) nor whether it is set (that made the generated files depend on the
# building machine). ALERT_WEBHOOK_PLACEHOLDER is baked; apply_env.py substitutes the real value into the copy it imports.
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
_rdt = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
SITE_MODEL_SRC = _rdt('code/_site_model.js').rstrip('\n')   # G19 (SITE_MODEL_SPEC.md): the one site model, one copy per node that asks for it
import seo_events   # 2026-10-13 (G12 / G29): the dated event registry and the lineage / annotation / change-test kits
SITE_STATS_SRC = seo_events.inline(_rdt('code/_site_stats.js').rstrip('\n'))     # G28 (FIX_PLAN 2026-10-12): the statistical test behind every traffic alert (its Google-update dates come from v5/data/seo_events.json)
GSC_QUERIES_SRC = _rdt('code/_gsc_queries.js').rstrip('\n')   # G9 / D24: scraper queries, the brand split and the anonymised share, shared with the audit
SERP_OBS_SRC = _rdt('code/_serp_obs.js').rstrip('\n')        # D26: a results-page feature is one observation at one moment, never a fact about the query
RANK_SERP_SRC = _rdt('code/_rank_serp.js').rstrip('\n')      # G6 (FIX_PLAN 2026-10-12): the whole results page of one rank check (features, page 1, share of voice, snapshot)
PAGE_WATCH_SRC = _rdt('code/_page_watch.js').rstrip('\n')    # G11 + G25 (FIX_PLAN 2026-10-13): the daily key-page watch and URL Inspection within Google's quota
FIT_GATE_SRC = _rdt('code/_fit_gate.js').rstrip('\n')        # R16 (build_v4.py section 53): the fit gate, also over the rungs stored before it existed (fitStored)
rd = lambda p: (seo_events.inline(_rdt(p)).replace('/*__SITE_MODEL__*/', SITE_MODEL_SRC).replace('/*__SITE_STATS__*/', SITE_STATS_SRC).replace('/*__GSC_QUERIES__*/', GSC_QUERIES_SRC)
                .replace('/*__SERP_OBS__*/', SERP_OBS_SRC).replace('/*__RANK_SERP__*/', RANK_SERP_SRC).replace('/*__PAGE_WATCH__*/', PAGE_WATCH_SRC)
                .replace('/*__FIT_GATE__*/', FIT_GATE_SRC))
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
nid = lambda name: str(uuid.uuid5(NS, 'sitetracker:' + name))
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
GOOGLE = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}
ANTHROPIC = {'anthropicApi': {'id': 'SEOcredAnthropic', 'name': 'Anthropic (SEO Agent)'}}
from env_settings import SENDER, BRAND, OPS_EMAIL, SA_EMAIL   # from n8n/.env at build time (run apply_env.py after editing .env)
WF_ID = 'SEOagentSiteTrk1'

def wf(wid, name, nodes, conns):
    return {'id': wid, 'name': name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 1800, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'}, 'tags': [], 'nodes': nodes, 'connections': conns}
def node(name, ntype, ver, params, pos, **extra):
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); return n
def code(name, src, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': src}, pos, **extra)
def iff(name, expr, pos):
    return node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
def sticky(name, content, pos, w, h, color=5): return node(name, 'n8n-nodes-base.stickyNote', 1, {'content': content, 'height': h, 'width': w, 'color': color}, pos)
def link(conns, a, b, out=0):
    outs = conns.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
def write(wfobj, fname):
    # R17 (2026-10-14, FIX_PLAN §3.12): the reserve chain goes on the MAIN path, now that every connection of this workflow is made
    if wfobj.get('name') in LEDGER_WIRING: ledger_mainline(wfobj, LEDGER_WIRING[wfobj['name']])
    url_lint.check(wfobj, wfobj.get('name') or fname)   # D15: no node builds a site URL by hand (url_lint.py)
    retry_lint.check(wfobj, wfobj.get('name') or fname)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
    for _n in wfobj['nodes']:   # e-mails retry a transient SMTP / DNS failure (live finding 2026-10-02: EAI_AGAIN smtp.gmail.com)
        if _n['type'] == 'n8n-nodes-base.emailSend': _n.update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
    names = {n['name'] for n in wfobj['nodes']}
    for src, outs in wfobj['connections'].items():
        assert src in names, src
        for ctype, lists in outs.items():
            for lst in lists:
                for t in lst: assert t['node'] in names, t['node']
    json.dump([wfobj], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
    os.makedirs(CODE, exist_ok=True)
    for n in wfobj['nodes']:
        if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
    print('wrote', fname + ':', len(wfobj['nodes']), 'nodes')

GOOGLE_GET = lambda url: {'method': 'GET', 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}
GOOGLE_POST = lambda url: {'method': 'POST', 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}
DFS_HTTP = {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 300}}, 'timeout': 90000}}
HTTP_X = dict(onError='continueRegularOutput', **retry_lint.RETRY)   # G1: one retry rule (3 tries, 5 s apart) for every external HTTP node
at = lambda c, r: [c * 220, r * 220]
urls = lambda s: s.replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL).replace('__SA_EMAIL__', SA_EMAIL or 'devai-seo@techand-site.iam.gserviceaccount.com')

N = []; C = {}
# ---- row 0: triggers, tables, loads, plan ----
N.append(node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': 9, 'triggerAtMinute': 0}]}}, at(0, 0)))
N.append(node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1)))
N.append(node('Ensure Sites Table', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), at(1, 0), onError='continueRegularOutput'))
N.append(node('Ensure Metrics Table', DT_TYPE, DT_VERSION, dt_create_params(METRICS_TABLE, METRICS_COLS), at(2, 0), onError='continueRegularOutput'))
N.append(node('Ensure Query Table', DT_TYPE, DT_VERSION, dt_create_params(QUERY_TABLE, QUERY_COLS), at(3, 0), onError='continueRegularOutput'))
N.append(node('Ensure History Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(HISTORY_TABLE, HISTORY_COLS), at(4, 0), onError='continueRegularOutput'))
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
N.append(node('Ensure Trends Table', DT_TYPE, DT_VERSION, dt_create_params(TRENDS_TABLE, TRENDS_COLS), at(4, 1), onError='continueRegularOutput'))
N.append(node('Ensure Log Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(LOG_TABLE, LOG_COLS), at(5, 1), onError='continueRegularOutput'))
N.append(node('Load Content Log', DT_TYPE, DT_VERSION, dt_get_all_params(LOG_TABLE), at(9, 1), **LOAD))
N.append(node('Ensure Alerts Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(ALERTS_TABLE, ALERTS_COLS), at(6, 1), onError='continueRegularOutput'))
N.append(node('Ensure Checkin Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(CHECKIN_TABLE, CHECKIN_COLS), at(7, 1), onError='continueRegularOutput'))
N.append(node('Load Console Alerts', DT_TYPE, DT_VERSION, dt_get_all_params(ALERTS_TABLE), at(10, 1), **LOAD))
N.append(node('Load Check-ins', DT_TYPE, DT_VERSION, dt_get_all_params(CHECKIN_TABLE), at(11, 1), **LOAD))
# v4.5: the latest AI-visibility, backlink and audit results for the Monday summary (written by the monitor workflows)
N.append(node('Ensure AI Visibility Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(AI_VIS_TABLE, AI_VIS_COLS), at(8, 2), onError='continueRegularOutput'))
N.append(node('Ensure Snapshots Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(BL_SNAP_TABLE, BL_SNAP_COLS), at(9, 2), onError='continueRegularOutput'))
N.append(node('Ensure Audits Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(AUDITS_TABLE, AUDITS_COLS), at(10, 2), onError='continueRegularOutput'))
N.append(node('Load AI Visibility (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(AI_VIS_TABLE), at(8, 3), **LOAD))
N.append(node('Load Backlink Snapshots (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(BL_SNAP_TABLE), at(9, 3), **LOAD))
N.append(node('Load Audits (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(AUDITS_TABLE), at(10, 3), **LOAD))
N.append(node('Load Trends (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(TRENDS_TABLE), at(11, 3), **LOAD))   # v4.6: trends younger than 25 days are reused, not bought again
# G19 (SITE_MODEL_SPEC.md): what the weekly site-model resolver reads besides the site row - the business profile (name, NAP, logo) and the
# monitor settings (brand names, competitors). seo_pages (the page inventory D11 fills) is created here so every install has it.
N.append(node('Ensure Profile Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(PROFILE_TABLE, PROFILE_COLS), at(5, 6), onError='continueRegularOutput'))
N.append(node('Load Profiles (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(PROFILE_TABLE), at(6, 6), **LOAD))
N.append(node('Ensure Monitors Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(MONITORS_TABLE, MONITORS_COLS), at(7, 6), onError='continueRegularOutput'))
N.append(node('Load Monitors (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(MONITORS_TABLE), at(8, 6), **LOAD))
N.append(node('Ensure Pages Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(PAGES_TABLE, PAGES_COLS), at(9, 6), onError='continueRegularOutput'))
# D11 (2026-10-12, FIX_PLAN): the page inventory the site model carries - what is already stored, plus AI Growth's key pages (their titles)
N.append(node('Load Pages (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(PAGES_TABLE), at(10, 6), **LOAD))
N.append(node('Ensure AI Pages Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(AI_PAGES_TABLE, AI_PAGES_COLS), at(11, 6), onError='continueRegularOutput'))
N.append(node('Load AI Pages (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(AI_PAGES_TABLE), at(12, 6), **LOAD))
# P2-2 (2026-10-12, Phase 2 live check): the stored site descriptions (seo_cache 'desc:<domain>', written by the main workflow's describer) are
# the only place the services live, so the weekly model takes them from here -> seo_sites.services_json -> the brief's facts.website.services.
N.append(node('Ensure Cache Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), at(13, 6), onError='continueRegularOutput'))
N.append(node('Load Descriptions (Site)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'desc'), at(14, 6), **LOAD))
N.append(node('Ensure Page Watch Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(PAGE_WATCH_TABLE, PAGE_WATCH_COLS), at(15, 6), onError='continueRegularOutput'))
N.append(node('Load Page Watch (Site)', DT_TYPE, DT_VERSION, dt_get_all_params(PAGE_WATCH_TABLE), at(16, 6), **LOAD))   # G25: each key page's last inspection decides the rotation order
N.append(node('Load Watch Cache (Site)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'watch'), at(17, 6), **LOAD))   # G11: the daily watch's own fingerprint per site
N.append(node('Load Sites', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), at(5, 0), **LOAD))
N.append(node('Load Ladders', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), at(6, 0), **LOAD))
N.append(node('Load Rank History', DT_TYPE, DT_VERSION, dt_get_all_params(HISTORY_TABLE), at(7, 0), **LOAD))
N.append(node('Load Site Metrics', DT_TYPE, DT_VERSION, dt_get_all_params(METRICS_TABLE), at(8, 0), **LOAD))
N.append(node('Load Query History', DT_TYPE, DT_VERSION, dt_get_where_params(QUERY_TABLE, 'tracked', 'isTrue'), at(9, 0), **LOAD))
# D25c (2026-10-12, system review FIX_PLAN): a check-in marked as a test never satisfies the month, so the reminder keeps asking. The rule
# lives in v5/code/_checkin_test.js and is applied to the row filter here, because v5/code/Site_Plan.js belongs to parallel work this session.
CHECKIN_TEST_SRC = rd('code/_checkin_test.js').rstrip('\n')
_SITE_PLAN_SRC = urls(rd('code/Site_Plan.js'))
_D25C_OLD = "const checkinRows = rowsOf('Load Check-ins').filter(r => r.site_id && r.month);"
assert _SITE_PLAN_SRC.count(_D25C_OLD) == 1, 'D25c: the check-in row filter in Site_Plan.js moved'
_SITE_PLAN_SRC = CHECKIN_TEST_SRC + '\n' + _SITE_PLAN_SRC.replace(
    _D25C_OLD,
    "const checkinRows = rowsOf('Load Check-ins').filter(r => r.site_id && r.month && !CK.isTest(r));   // D25c: a test check-in is kept out of the monthly check (_checkin_test.js), so the reminder keeps asking")
N.append(code('Site Plan', _SITE_PLAN_SRC, at(10, 0)))
N.append(iff('Any Sites?', '{{ !$json.nothing_to_do }}', at(11, 0)))
N.append(node('Nothing To Track (Site)', 'n8n-nodes-base.noOp', 1, {}, at(12, 1)))
# ---- v4.8 publish detection (PIPELINE_FEATURE_SPEC §6.5, phase 4): pages written but not published are looked for in the site's sitemap
# (planned slug, then <title> / first <h1>) and, when found, stored exactly like "I published a page" — plain HTTP only, $0; a site with no
# waiting page makes no request. Shared code inlined: the word rules of _reach.js (rule R1 section) and the published-page rows (_publish_rows.js).
_REACH_SRC = rd('code/_reach.js'); OVERLAP = _REACH_SRC[_REACH_SRC.index('// rule R1'):].rstrip('\n')
assert 'const overlapTokens' in OVERLAP and 'const overlapScore' in OVERLAP, 'overlap rules not found in _reach.js'
PUBLISH_ROWS = rd('code/_publish_rows.js').rstrip('\n')
dsrc = lambda p: rd(p).replace('/*__OVERLAP__*/', OVERLAP).replace('/*__PUBLISH_ROWS__*/', PUBLISH_ROWS)
PLAIN_GET = lambda url, accept, timeout, batch: {'method': 'GET', 'url': url, 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.8)'}, {'name': 'Accept', 'value': accept}]},
    'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': 200}}, 'timeout': timeout, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}
XML, HTML = 'application/xml,text/xml,*/*', 'text/html,application/xhtml+xml'
SAFE = dict(onError='continueRegularOutput')   # a failing detection step never stops the weekly report (Site Metrics reads the errors)
N.append(code('Publish Candidates', dsrc('code/Publish_Candidates.js'), at(12, -2), **SAFE))
N.append(iff('Any Detect Candidates?', '{{ !$json.skip && !$json.error }}', at(13, -2)))
N.append(node('Fetch Sitemap (Detect)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN_GET('={{ $json.sitemap_url }}', XML, 30000, 5), at(14, -3), alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Sitemap Children (Detect)', dsrc('code/Sitemap_Children_Detect.js'), at(15, -3), **SAFE))
N.append(iff('Any Child Sitemaps?', '{{ !$json.skip && !$json.error }}', at(16, -3)))
N.append(node('Fetch Child Sitemaps (Detect)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN_GET('={{ $json.url }}', XML, 30000, 5), at(17, -4), alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Match Slugs (Detect)', dsrc('code/Match_Slugs_Detect.js'), at(18, -3), **SAFE))
N.append(iff('Any Page Fetches?', '{{ !!$json.fetch }}', at(19, -3)))
N.append(node('Fetch Pages (Detect)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN_GET('={{ $json.url }}', HTML, 20000, 5), at(20, -4), alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Detect Published', dsrc('code/Detect_Published.js'), at(21, -3), **SAFE))
N.append(code('Detected Log Rows', dsrc('code/Detected_Log_Rows.js'), at(22, -3), **SAFE))
N.append(iff('Any Detected?', '{{ !$json.skip && !$json.error }}', at(23, -3)))
N.append(node('Save Detected (Log)', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LOG_TABLE, LOG_COLS, ['site_id', 'keyword']), at(24, -4), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Detected Case Rows', dsrc('code/Detected_Case_Rows.js'), at(25, -4), **SAFE))
N.append(iff('Any Case Studies Detected?', '{{ !$json.skip && !$json.error }}', at(26, -4)))
N.append(node('Mark Case Study Published (Detect)', DT_TYPE, DT_VERSION, dt_update_params(CASE_TABLE, CASE_COLS, [('site_id', '={{ $json.site_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': 'published', 'page_url': '={{ $json.page_url }}'}), at(27, -5), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Detected Ladder Rows', dsrc('code/Detected_Ladder_Rows.js'), at(28, -4), **SAFE))
N.append(iff('Any Ladder Detected?', '{{ !$json.skip && !$json.error }}', at(29, -4)))
N.append(node('Mark Ladder Published (Detect)', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS, [('ladder_id', '={{ $json.ladder_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': '={{ $json.status }}', 'target_url': '={{ $json.target_url }}', 'page_exists': '={{ $json.page_exists }}'}), at(30, -5), onError='continueRegularOutput', alwaysOutputData=True))
# ---- G19: the weekly site-model resolver (canonical host, name / NAP / logo, services, nav pages) ----
N.append(code('Model Targets (Site)', rd('code/Model_Targets.js'), at(12, -1), **SAFE))
N.append(iff('Need Homepage (Site)?', '{{ !$json.skip }}', at(13, -1)))
N.append(node('Fetch Homepage (Site)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN_GET('={{ $json.url }}', HTML, 20000, 3), at(14, -1), alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Site Model (Site)', rd('code/Site_Model_Site.js'), at(15, -1), **SAFE))
N.append(sticky('Note Site Model', """## One site model (G19, v4.15)
Per site, once a week: the **canonical host** (the homepage as a browser gets it, redirects followed, plus its `rel=canonical` and the site's own live URLs), the business **name / logo / NAP** (`seo_profiles` -> the homepage Organization / LocalBusiness schema -> Google Business Profile -> the app's fields), the **services**, the **nav pages**, the business facts, the brand names and the competitors (`seo_monitors`). *Site Metrics* merges `SM.toRow(model)` into the `seo_sites` row, so every workflow reads the same facts; a model younger than 7 days is kept and no request is made. The page inventory lives in `seo_pages` (D11). Kit: `v5/code/_site_model.js`, spec: `SITE_MODEL_SPEC.md`.""", [12 * 220 - 40, -2 * 220 - 60], 1100, 200, 5))
N.append(sticky('Note Detection', f"""## Publish detection (v4.8)
Before the Google part, per site with pages **written but not published** (`{LOG_TABLE}` status started, no URL, last 120 days; `{LADDER_TABLE}` status writing): `/sitemap.xml` is read (an index: its 5 newest child sitemaps) and every URL compared host-agnostically — **slug** (planned path / planned slug / keyword slug) first, then for up to 10 unmatched pages the **title / first H1** of up to 15 pages per site whose slug holds 60%+ of the keyword's words (80%+ needed in the title or H1). A page improving an existing URL counts when its sitemap `lastmod` is after it was written. Found pages are stored like "I published a page" (content log + ladder row + case study), inspected in Search Console in this run, and listed in the report and the callback (`detected_published`). Plain HTTP, no paid call; no waiting page = no request.""", [12 * 220 - 40, -7 * 220], 1500, 260, 4))
# ---- row 1: Search Console ----
N.append(node('GSC Sites', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_GET('https://www.googleapis.com/webmasters/v3/sites'), at(12, 0), credentials=GOOGLE, executeOnce=True, **HTTP_X))
N.append(code('Resolve Properties', rd('code/Resolve_Properties.js'), at(13, 0)))
N.append(code('GSC Requests', rd('code/GSC_Requests.js'), at(14, 0)))
N.append(iff('Any GSC?', '{{ !$json.skip }}', at(15, 0)))
N.append(node('GSC Query', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_POST('={{ $json.url }}'), at(16, 0), credentials=GOOGLE, **HTTP_X))
# G9 (2026-10-12, FIX_PLAN): the query / page kinds are read in full — the first request asks for 25,000 rows, and any kind that came back full
# gets its next pages here (startRow), up to CONFIG.max_gsc_pages. Free (Google quota); a kind that came back short costs no extra request.
N.append(code('GSC More Requests', rd('code/GSC_More_Requests.js'), at(16, -1)))
N.append(iff('Any More GSC?', '{{ !$json.skip }}', at(17, -1)))
N.append(node('GSC Query (More)', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_POST('={{ $json.url }}'), at(18, -1), credentials=GOOGLE, **HTTP_X))
N.append(code('Parse GSC', rd('code/Parse_GSC.js'), at(17, 0)))
# ---- row 2: GA4 (detect property, reports) ----
N.append(iff('Need GA4 Detect?', "{{ $('Resolve Properties').all().some(i => !i.json.ga4_property_id) }}", at(12, 2)))
N.append(node('GA4 Accounts', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_GET('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200'), at(13, 2), credentials=GOOGLE, executeOnce=True, **HTTP_X))
N.append(code('Stream Requests', rd('code/Stream_Requests.js'), at(14, 2)))
N.append(iff('Any Streams?', '{{ !$json.skip }}', at(15, 2)))
N.append(node('GA4 Streams', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_GET('={{ $json.url }}'), at(16, 2), credentials=GOOGLE, **HTTP_X))
N.append(code('GA4 Requests', rd('code/GA4_Requests.js'), at(17, 2)))
N.append(iff('Any GA4?', '{{ !$json.skip }}', at(18, 2)))
N.append(node('GA4 Report', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_POST('={{ $json.url }}'), at(19, 2), credentials=GOOGLE, **HTTP_X))
N.append(code('Parse GA4', rd('code/Parse_GA4.js'), at(20, 2)))
# ---- row 3: URL inspection + Google Trends ----
N.append(code('Inspect Requests', rd('code/Inspect_Requests.js'), at(12, 3)))
N.append(iff('Any Inspections?', '{{ !$json.skip }}', at(13, 3)))
N.append(node('Inspect URL', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_POST('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'), at(14, 3), credentials=GOOGLE, **HTTP_X))
N.append(code('Parse Inspection', rd('code/Parse_Inspection.js'), at(15, 3)))
N.append(code('Inspect Rows (Site)', rd('code/Inspect_Rows_Site.js'), at(15, 2), **SAFE))   # G25: what Google said, on the page's own seo_page_watch row
N.append(iff('Any Inspect Rows?', '{{ !$json.skip }}', at(16, 2)))
N.append(node('Save Page Watch (Site)', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PAGE_WATCH_TABLE, PAGE_WATCH_COLS, ['site_id', 'url']), at(17, 2), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Trends Requests', rd('code/Trends_Requests.js'), at(16, 3)))
N.append(iff('Any Trends?', '{{ !$json.skip }}', at(17, 3)))
N.append(node('Google Trends', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP, at(18, 3), credentials=DFS, **HTTP_X))
N.append(code('Parse Trends', rd('code/Parse_Trends.js'), at(19, 3)))
# ---- row 4: live SERP checks, metrics, storage ----
N.append(code('Site SERP Requests', rd('code/Site_SERP_Requests.js'), at(12, 4)))
N.append(iff('Any SERP?', '{{ !$json.skip }}', at(13, 4)))
N.append(node('SERP Check (Site)', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP, at(14, 4), credentials=DFS, **HTTP_X))
N.append(code('Parse Site SERP', rd('code/Parse_Site_SERP.js'), at(15, 4)))
N.append(node('Save Site Rank History', DT_TYPE, DT_VERSION, dt_insert_params(HISTORY_TABLE, HISTORY_COLS), at(16, 4), onError='continueRegularOutput'))
# D11: the week's page inventory (sitemap + Search Console pages and their queries + AI Growth's key pages + the pages found live) ->
# the site model (SM.withPages) and seo_pages (only the rows that changed)
N.append(code('Page Inventory (Site)', rd('code/Page_Inventory_Site.js'), at(16, 4), **SAFE))
N.append(code('Page Rows (Site)', rd('code/Page_Rows_Site.js'), at(16, 5), **SAFE))
N.append(iff('Any Page Rows?', '{{ !$json.skip }}', at(16, 6)))
N.append(node('Save Pages (Site)', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PAGES_TABLE, PAGES_COLS, ['site_id', 'url']), at(16, 7), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Site Metrics', urls(rd('code/Site_Metrics.js')), at(17, 4)))
N.append(code('Metrics Rows', "// The insert gets exactly the table's columns: the Site Metrics item carries the whole report (live finding 2026-10-03: every insert failed on the nested `period` and continueRegularOutput hid it, so seo_site_metrics stayed empty).\nreturn $input.all().map(i => ({ json: i.json.metrics_row }));", at(17, 5)))
N.append(node('Save Site Metrics', DT_TYPE, DT_VERSION, dt_insert_params(METRICS_TABLE, METRICS_COLS), at(18, 4), onError='continueRegularOutput'))
N.append(code('Query Rows', rd('code/Query_Rows.js'), at(19, 4)))
N.append(iff('Any Query Rows?', '{{ !$json.skip }}', at(20, 4)))
N.append(node('Save Query Rows', DT_TYPE, DT_VERSION, dt_insert_params(QUERY_TABLE, QUERY_COLS), at(21, 4), onError='continueRegularOutput'))
N.append(code('Trend Rows', rd('code/Trend_Rows.js'), at(22, 4)))
N.append(iff('Any Trend Rows?', '{{ !$json.skip }}', at(23, 4)))
N.append(node('Save Trends', DT_TYPE, DT_VERSION, dt_insert_params(TRENDS_TABLE, TRENDS_COLS), at(24, 4), onError='continueRegularOutput'))
N.append(code('Site Rows', rd('code/Site_Rows.js'), at(25, 4)))
N.append(node('Save Sites', DT_TYPE, DT_VERSION, dt_upsert_params(SITES_TABLE, SITES_COLS, 'site_id'), at(26, 4), onError='continueRegularOutput'))
# ---- row 5: AI brief, report, PDF, delivery ----
N.append(code('Brief Input', rd('code/Brief_Input.js'), at(12, 5)))
N.append(node('Site Brief', '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + rd('prompts/site_brief.txt'), 'hasOutputParser': True, 'options': {}}, at(13, 5), retryOnFail=True, maxTries=2, waitBetweenTries=3000, onError='continueRegularOutput'))
N.append(node('Claude — Site Brief', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': 'claude-sonnet-5-5', 'cachedResultName': 'Claude Sonnet 5.5'}, 'options': {'maxTokensToSample': 8192, 'thinking': True, 'thinkingMode': 'adaptive', 'effort': 'low'}}, [13 * 220 - 100, 5 * 220 + 200], credentials=ANTHROPIC))
ARR = {'type': 'array', 'items': {'type': 'string'}}
N.append(node('Parser — Site Brief', '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps({'type': 'object', 'properties': {'headline': {'type': 'string'}, 'summary': {'type': 'string'}, 'highlights': ARR,
    'actions': {'type': 'array', 'items': {'type': 'object', 'properties': {'priority': {'type': 'number'}, 'action': {'type': 'string'}, 'why': {'type': 'string'}, 'keyword': {'type': 'string'}, 'url': {'type': 'string'}}, 'required': ['action']}}, 'watch': ARR}, 'required': ['headline', 'summary', 'actions']})}, [13 * 220 + 120, 5 * 220 + 200]))
C['Claude — Site Brief'] = {'ai_languageModel': [[{'node': 'Site Brief', 'type': 'ai_languageModel', 'index': 0}]]}
C['Parser — Site Brief'] = {'ai_outputParser': [[{'node': 'Site Brief', 'type': 'ai_outputParser', 'index': 0}]]}
N.append(code('Site Report', urls(rd('code/Site_Report.js')), at(14, 5)))
PREP = """// Copy of each report HTML named index.html for the PDF renderer (Gotenberg requires that exact file name); one item per site.
return $input.all().map(item => { const doc = (item.binary || {}).data; if (!doc) return item; return { json: item.json, binary: { data: doc, html: { ...doc, fileName: 'index.html', mimeType: 'text/html', fileExtension: 'html' } } }; });"""
ATTACH = """// Attach the PDF (when the renderer succeeded) next to the HTML file, per site; a renderer failure never fails the run.
const src = $('Prepare PDF Site').all(); const got = $input.all();
return src.map((s, i) => { const g = got[i] || {}; const pdf = (g.binary && g.binary.pdf && !(g.json && g.json.error)) ? g.binary.pdf : null;
  const name = String(s.json.file_name || 'seo-performance.html').replace(/\\.html?$/i, '') + '.pdf'; const binary = {};
  if (s.binary && s.binary.data) binary.data = s.binary.data; if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };
  return { json: { ...s.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null }, binary }; });"""
N.append(code('Prepare PDF Site', PREP, at(15, 5)))
N.append(node('Render PDF Site', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': 'http://gotenberg:3000/forms/chromium/convert/html', 'sendBody': True, 'contentType': 'multipart-form-data',
    'bodyParameters': {'parameters': [{'parameterType': 'formBinaryData', 'name': 'files', 'inputDataFieldName': 'html'}, {'name': 'paperWidth', 'value': '8.27'}, {'name': 'paperHeight', 'value': '11.69'}, {'name': 'marginTop', 'value': '0.5'}, {'name': 'marginBottom', 'value': '0.5'}, {'name': 'marginLeft', 'value': '0.5'}, {'name': 'marginRight', 'value': '0.5'}, {'name': 'printBackground', 'value': 'true'}]},
    'options': {'timeout': 120000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'pdf'}}}}, at(16, 5), onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Attach PDF Site', ATTACH, at(17, 5)))
N.append(iff('Has Email (Site)?', '{{ !!$json.email }}', at(18, 5)))
N.append(node('Send Site Report', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False, 'fileAttachments': "={{ $binary.pdf ? 'pdf' : 'data' }}"}}, at(19, 5), credentials=SMTP, onError='continueRegularOutput'))
N.append(code('Build Site Callback', rd('code/Build_Site_Callback.js'), at(18, 6)))
N.append(iff('Has Callback (Site)?', '{{ !!$json.callback_url }}', at(19, 6)))
N.append(node('POST Site Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json) }}', 'options': {'timeout': 30000}}, at(20, 6), onError='continueRegularOutput'))
N.append(sticky('Note', f"""## SEO Agent — Site Tracker (v4.3)
Runs **every Monday 09:00** (after the Rank Tracker) and on demand through *Manual Run* (`{{ site_id | domain, on_demand: true }}`; the main workflow calls it right after "Track my site"). Sites come from the Data Table `{SITES_TABLE}` plus every domain with a keyword ladder (tracked automatically). All tables are created on first use.
**Google (free, service account):** `GSC Sites` finds the Search Console property the service account can read (sc-domain first) → Search Analytics for the last 28 complete days vs the 28 before and the same period a year ago (totals by day, top queries with page, pages, each tracked keyword as an exact query) → **URL Inspection** of the ladder pages (indexed?). GA4: property id from the registration or **detected** from the web stream URL (`GA4 Accounts` → `GA4 Streams`) → organic channel totals, organic landing pages, organic sessions by day.
**Paid (DataForSEO):** Google Trends for up to 4 head terms per site ($0.011 each, measured) and a live top-50 check for the site's own keywords (~$0.015 each, max 20; ladder keywords are read from the Rank Tracker's history).
**Site Metrics** computes deltas, winners/losers/new/lost queries, striking-distance queries (4-20), CTR gaps, decaying pages, index status, alerts and ranked actions with API bodies; rows go to `{METRICS_TABLE}` (one row per site per run), `{QUERY_TABLE}` (tracked keywords + top 100 queries), `{TRENDS_TABLE}` (for the Content Cadence) and back into `{SITES_TABLE}`. Pages written by the Content Cadence (`{LOG_TABLE}`) are tracked as "blog" keywords; published ones are inspected; pages without a publish link are listed as waiting — or, since v4.8, found live through the sitemap and recorded automatically (*Publish detection*, the nodes above). Search Console **notices** (`{ALERTS_TABLE}`, from the Console Alerts mail watcher and the monthly check-in) and the latest **check-in** (`{CHECKIN_TABLE}`) appear as alerts, actions and a report section; a missing check-in for the month is reminded every Monday. **Site Brief** (Claude Sonnet 5.5, ~$0.03 per site) words the week for the owner; **Site Report** builds the e-mail (KPI tiles, actions, tracked keywords, ladder index status, movers, opportunities, traffic, trends) + PDF; delivery by e-mail and/or callback (`stage: site_tracker`).
Credential **Google Service Account (SEO Agent)** (`googleApi`, "Set up for use in HTTP Request node" on, scopes `https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly`). The owner adds the service-account e-mail to Search Console (Full) and GA4 (Viewer); put that e-mail into `CONFIG.service_account_email` in *Site Plan* so the connect instructions name it. Not connected = the report still runs (trends, live checks) and explains the two steps.
Form: {FORM_URL} · API: {API_URL} (`mode: track`)""", [-40, -560], 1180, 500))
for a, b in [('Weekly Schedule', 'Ensure Sites Table'), ('Manual Run', 'Ensure Sites Table'), ('Ensure Sites Table', 'Ensure Metrics Table'), ('Ensure Metrics Table', 'Ensure Query Table'), ('Ensure Query Table', 'Ensure History Table (Site)'), ('Ensure History Table (Site)', 'Ensure Trends Table'), ('Ensure Trends Table', 'Ensure Log Table (Site)'), ('Ensure Log Table (Site)', 'Ensure Alerts Table (Site)'), ('Ensure Alerts Table (Site)', 'Ensure Checkin Table (Site)'), ('Ensure Checkin Table (Site)', 'Ensure AI Visibility Table (Site)'), ('Ensure AI Visibility Table (Site)', 'Ensure Snapshots Table (Site)'), ('Ensure Snapshots Table (Site)', 'Ensure Audits Table (Site)'), ('Ensure Audits Table (Site)', 'Load Sites'),
             ('Load Sites', 'Load Ladders'), ('Load Ladders', 'Load Rank History'), ('Load Rank History', 'Load Site Metrics'), ('Load Site Metrics', 'Load Query History'), ('Load Query History', 'Load Content Log'), ('Load Content Log', 'Load Console Alerts'), ('Load Console Alerts', 'Load Check-ins'), ('Load Check-ins', 'Load AI Visibility (Site)'), ('Load AI Visibility (Site)', 'Load Backlink Snapshots (Site)'), ('Load Backlink Snapshots (Site)', 'Load Audits (Site)'), ('Load Audits (Site)', 'Load Trends (Site)'), ('Load Trends (Site)', 'Ensure Profile Table (Site)'), ('Ensure Profile Table (Site)', 'Load Profiles (Site)'), ('Load Profiles (Site)', 'Ensure Monitors Table (Site)'), ('Ensure Monitors Table (Site)', 'Load Monitors (Site)'), ('Load Monitors (Site)', 'Ensure Pages Table (Site)'), ('Ensure Pages Table (Site)', 'Load Pages (Site)'), ('Load Pages (Site)', 'Ensure AI Pages Table (Site)'), ('Ensure AI Pages Table (Site)', 'Load AI Pages (Site)'), ('Load AI Pages (Site)', 'Ensure Cache Table (Site)'), ('Ensure Cache Table (Site)', 'Load Descriptions (Site)'), ('Load Descriptions (Site)', 'Ensure Page Watch Table (Site)'), ('Ensure Page Watch Table (Site)', 'Load Page Watch (Site)'), ('Load Page Watch (Site)', 'Load Watch Cache (Site)'), ('Load Watch Cache (Site)', 'Site Plan'), ('Site Plan', 'Any Sites?'),
             ('GSC Sites', 'Resolve Properties'), ('Resolve Properties', 'GSC Requests'), ('GSC Requests', 'Any GSC?'), ('GSC Query', 'GSC More Requests'), ('GSC More Requests', 'Any More GSC?'), ('GSC Query (More)', 'Parse GSC'), ('Parse GSC', 'Need GA4 Detect?'),
             ('GA4 Accounts', 'Stream Requests'), ('Stream Requests', 'Any Streams?'), ('GA4 Streams', 'GA4 Requests'), ('GA4 Requests', 'Any GA4?'), ('GA4 Report', 'Parse GA4'), ('Parse GA4', 'Inspect Requests'),
             ('Inspect Requests', 'Any Inspections?'), ('Inspect URL', 'Parse Inspection'), ('Parse Inspection', 'Inspect Rows (Site)'), ('Inspect Rows (Site)', 'Any Inspect Rows?'), ('Save Page Watch (Site)', 'Trends Requests'), ('Trends Requests', 'Any Trends?'), ('Google Trends', 'Parse Trends'), ('Parse Trends', 'Site SERP Requests'),
             ('Site SERP Requests', 'Any SERP?'), ('SERP Check (Site)', 'Parse Site SERP'), ('Parse Site SERP', 'Save Site Rank History'), ('Save Site Rank History', 'Page Inventory (Site)'),
             ('Page Inventory (Site)', 'Page Rows (Site)'), ('Page Rows (Site)', 'Any Page Rows?'), ('Save Pages (Site)', 'Site Metrics'),
             ('Site Metrics', 'Metrics Rows'), ('Metrics Rows', 'Save Site Metrics'), ('Save Site Metrics', 'Query Rows'), ('Query Rows', 'Any Query Rows?'), ('Save Query Rows', 'Trend Rows'), ('Trend Rows', 'Any Trend Rows?'), ('Save Trends', 'Site Rows'), ('Site Rows', 'Save Sites'), ('Save Sites', 'Brief Input'), ('Brief Input', 'Site Brief'), ('Site Brief', 'Site Report'),
             ('Site Report', 'Prepare PDF Site'), ('Prepare PDF Site', 'Render PDF Site'), ('Render PDF Site', 'Attach PDF Site'), ('Attach PDF Site', 'Has Email (Site)?'), ('Attach PDF Site', 'Build Site Callback'), ('Build Site Callback', 'Has Callback (Site)?')]:
    link(C, a, b)
link(C, 'Any Sites?', 'Model Targets (Site)', 0); link(C, 'Any Sites?', 'Nothing To Track (Site)', 1)
# G19: the site model is resolved first (one homepage read per stale site), then the publish detection runs as before
link(C, 'Model Targets (Site)', 'Need Homepage (Site)?'); link(C, 'Need Homepage (Site)?', 'Fetch Homepage (Site)', 0); link(C, 'Need Homepage (Site)?', 'Site Model (Site)', 1)
link(C, 'Fetch Homepage (Site)', 'Site Model (Site)'); link(C, 'Site Model (Site)', 'Publish Candidates')
# v4.8 publish detection chain; every exit leads to GSC Sites (executeOnce), exactly one fires per run
link(C, 'Publish Candidates', 'Any Detect Candidates?'); link(C, 'Any Detect Candidates?', 'Fetch Sitemap (Detect)', 0); link(C, 'Any Detect Candidates?', 'GSC Sites', 1)
link(C, 'Fetch Sitemap (Detect)', 'Sitemap Children (Detect)'); link(C, 'Sitemap Children (Detect)', 'Any Child Sitemaps?')
link(C, 'Any Child Sitemaps?', 'Fetch Child Sitemaps (Detect)', 0); link(C, 'Any Child Sitemaps?', 'Match Slugs (Detect)', 1); link(C, 'Fetch Child Sitemaps (Detect)', 'Match Slugs (Detect)')
link(C, 'Match Slugs (Detect)', 'Any Page Fetches?'); link(C, 'Any Page Fetches?', 'Fetch Pages (Detect)', 0); link(C, 'Any Page Fetches?', 'Detect Published', 1); link(C, 'Fetch Pages (Detect)', 'Detect Published')
link(C, 'Detect Published', 'Detected Log Rows'); link(C, 'Detected Log Rows', 'Any Detected?'); link(C, 'Any Detected?', 'Save Detected (Log)', 0); link(C, 'Any Detected?', 'GSC Sites', 1)
link(C, 'Save Detected (Log)', 'Detected Case Rows'); link(C, 'Detected Case Rows', 'Any Case Studies Detected?'); link(C, 'Any Case Studies Detected?', 'Mark Case Study Published (Detect)', 0); link(C, 'Any Case Studies Detected?', 'Detected Ladder Rows', 1)
link(C, 'Mark Case Study Published (Detect)', 'Detected Ladder Rows'); link(C, 'Detected Ladder Rows', 'Any Ladder Detected?'); link(C, 'Any Ladder Detected?', 'Mark Ladder Published (Detect)', 0); link(C, 'Any Ladder Detected?', 'GSC Sites', 1)
link(C, 'Mark Ladder Published (Detect)', 'GSC Sites')
link(C, 'Any GSC?', 'GSC Query', 0); link(C, 'Any GSC?', 'Need GA4 Detect?', 1)
link(C, 'Any More GSC?', 'GSC Query (More)', 0); link(C, 'Any More GSC?', 'Parse GSC', 1)   # G9: no kind came back full -> straight to Parse GSC
link(C, 'Need GA4 Detect?', 'GA4 Accounts', 0); link(C, 'Need GA4 Detect?', 'GA4 Requests', 1)
link(C, 'Any Streams?', 'GA4 Streams', 0); link(C, 'Any Streams?', 'GA4 Requests', 1)
link(C, 'Any GA4?', 'GA4 Report', 0); link(C, 'Any GA4?', 'Inspect Requests', 1)
link(C, 'Any Inspections?', 'Inspect URL', 0); link(C, 'Any Inspections?', 'Trends Requests', 1)
link(C, 'Any Inspect Rows?', 'Save Page Watch (Site)', 0); link(C, 'Any Inspect Rows?', 'Trends Requests', 1)
link(C, 'Any Trends?', 'Google Trends', 0); link(C, 'Any Trends?', 'Parse Trends', 1)   # all trends stored -> Parse Trends returns them from seo_trends
link(C, 'Any SERP?', 'SERP Check (Site)', 0); link(C, 'Any SERP?', 'Page Inventory (Site)', 1)
link(C, 'Any Page Rows?', 'Save Pages (Site)', 0); link(C, 'Any Page Rows?', 'Site Metrics', 1)
link(C, 'Any Query Rows?', 'Save Query Rows', 0); link(C, 'Any Query Rows?', 'Trend Rows', 1)
link(C, 'Any Trend Rows?', 'Save Trends', 0); link(C, 'Any Trend Rows?', 'Site Rows', 1)
link(C, 'Has Email (Site)?', 'Send Site Report', 0); link(C, 'Has Callback (Site)?', 'POST Site Report', 0)
# every Google / DataForSEO HTTP node and the model node must carry a credential slot
for n in N:
    if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') in ('predefinedCredentialType', 'genericCredentialType'): assert n.get('credentials'), 'http node without credential: ' + n['name']
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': assert n.get('credentials'), 'model without credential: ' + n['name']
_code = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
for _n in ('Match Slugs (Detect)', 'Detect Published'): assert 'const overlapTokens' in _code[_n], _n + ': word rules not inlined'
# R34 (2026-10-16, build_v4.py section 88): the same plain GET of the site's own pages reads the titles the inventory lacks (bounded, free),
# and the inventory names the pages still judged by their address only. *Fetch Pages (Detect)* is the one HTTP node for both reads.
assert "grab('Load Pages (Site)')" in _code['Match Slugs (Detect)'] and 'title_fill_per_site' in _code['Match Slugs (Detect)'] and 'title_fill' in _code['Match Slugs (Detect)'], 'R34: Match Slugs (Detect) does not read the missing titles'
assert 'SM.titleGap(merged)' in _code['Page Inventory (Site)'] and 'title_unknown' in _code['Page Inventory (Site)'], 'R34: the page inventory does not name the pages without a title'
assert any(n['name'] == 'Fetch Pages (Detect)' and n.get('retryOnFail') for n in N), 'R34: the title read must keep the retry rule (retry_lint)'
assert 'function publishedRows(' in _code['Detect Published'], 'Detect Published: published-page rows not inlined'
assert not any(('/*__OVERLAP__*/' in c_) or ('/*__PUBLISH_ROWS__*/' in c_) for c_ in _code.values()), 'placeholder left in the Site Tracker'
# FIX_PLAN 2026-10-12: G9 (every Search Console row, the anonymised share, brand vs non-brand, the audit's scraper rule), G28 (a traffic alert
# fires on a two-sample Poisson z-test, not on a fixed percentage) and D21 (a sparse Trends series carries no percentage into the brief)
for _n in ('Parse GSC',): assert 'const GQ = (() => {' in _code[_n], _n + ': the Search Console query rules are not inlined'
for _n in ('Site Metrics', 'Brief Input'): assert 'const ST = (() => {' in _code[_n], _n + ': the site statistics are not inlined'
assert 'startRow' in _code['GSC More Requests'] and "$('GSC Query (More)')" in _code['Parse GSC'], 'G9: the second page of Search Console rows is not read'
assert 'ST.change(' in _code['Site Metrics'] and 'alert_min_click_events' in _code['Site Metrics'], 'G28: the alerts do not use the statistical test'
assert 'too little search data' in _code['Brief Input'] and 'sparse ? null : change' in _code['Parse Trends'], 'D21: a sparse trend can still reach the brief as a percentage'
assert not any(('/*__SITE_STATS__*/' in c_) or ('/*__GSC_QUERIES__*/' in c_) for c_ in _code.values()), 'statistics / query-rule placeholder left in the Site Tracker'
# G28 follow-up (2026-10-13, build_v4.py section 53): the keyword-position alert is volume-gated and says what was tested
assert 'ST.position(' in _code['Site Metrics'] and 'ST.tested(' in _code['Site Metrics'], 'G28: the position alert is still a fixed number of places'
for _n in ('Inspect Requests', 'Parse Inspection', 'Inspect Rows (Site)', 'Site Metrics'): assert 'const PW = (() => {' in _code[_n], _n + ': the page-watch kit is not inlined'
assert not any('/*__PAGE_WATCH__*/' in c_ for c_ in _code.values()), 'page-watch placeholder left in the Site Tracker'
assert 'PW.inspectBudget(' in _code['Inspect Requests'] and 'inspect_at' in _code['Inspect Requests'], 'G25: the inspections do not rotate within the quota'
assert 'index_coverage' in _code['Site Metrics'] and 'page_watch: watch' in _code['Site Metrics'], 'G11 / G25: the weekly item carries neither the index view nor the watch'
LEDGER_WIRING['SEO Agent — Site Tracker'] = ledger_nodes(N, C, 'site_tracker', 'Site', 'Site Plan', ['Site Report'], at(11, 9))
# ---- B-A10 (2026-10-15, INVARIANTS rule 3): the two paid DataForSEO calls of the week go through the in-200 retry gate ----
# Both reading sides were already honest about a task error inside a 200 (Parse Trends -> `DataForSEO <code>`, Parse Site SERP ->
# RS.read -> position -1, "check failed" and never "not in the top 50"); what neither had was a second attempt. A trend that
# fails is a week of a head term's demand missing from the brief, and a position that fails is a hole in the site's own history.
_wf_site = wf(WF_ID, 'SEO Agent — Site Tracker', N, C)
for _h10, _w10, _u10 in (('Google Trends', 'the 12-month search interest for this term', 'term'),
                         ('SERP Check (Site)', "the live Google results for one of the site's own keywords", 'keyword check')):
    _gs10 = dfs_gate.splice(_wf_site, _h10, V5, what=_w10, unit=_u10, code_dir=CODE)
    retry_lint.record_gate('SEO Agent — Site Tracker', _gs10['chain'])
retry_lint.check_in200(_wf_site)
write(_wf_site, 'SEO_Agent_Site_Tracker.json')

# =============================================================================
# SEO Agent — Site Admin: delete / pause / resume / cadence / unpublish for a tracked site (published sub-workflow; run through the Test Runner or Execute Workflow)
# =============================================================================
SWITCH_VER = next(n['typeVersion'] for n in MAIN_WF['nodes'] if n['name'] == 'Route Mode')
def switch(name, cases, pos):
    return node(name, 'n8n-nodes-base.switch', SWITCH_VER, {'rules': {'values': [{'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid(name + ':' + k), 'leftValue': '=' + e, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': k} for k, e in cases]}, 'looseTypeValidation': True, 'options': {}}, pos)
N = []; C = {}
N.append(node('Admin Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, [0, 0]))
N.append(node('Ensure Cadence Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(CADENCE_TABLE, CADENCE_COLS), [160, 0], onError='continueRegularOutput'))
N.append(node('Ensure Log Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(LOG_TABLE, LOG_COLS), [320, 0], onError='continueRegularOutput'))
N.append(node('Ensure Sites Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), [480, -160], onError='continueRegularOutput'))
N.append(node('Ensure Monitors Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(MONITORS_TABLE, MONITORS_COLS), [480, -320], onError='continueRegularOutput'))
N.append(node('Ensure Prospects Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(PROSPECT_TABLE, PROSPECT_COLS), [480, -480], onError='continueRegularOutput'))
N.append(node('Ensure AI Prompts Table (Admin)', DT_TYPE, DT_VERSION, dt_create_params(AI_PROMPTS_TABLE, AI_PROMPTS_COLS), [480, -640], onError='continueRegularOutput'))
N.append(code('Admin Action', rd('code/Admin_Action.js'), [640, 0]))
ALOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
N.append(node('Load Monitors (Admin)', DT_TYPE, DT_VERSION, dt_get_where_params(MONITORS_TABLE, 'site_id', 'eq', '={{ $json.site_id }}'), [760, 400], **ALOAD))
N.append(code('Monitor Row (Admin)', rd('code/Monitor_Row_Admin.js'), [1000, 400]))
N.append(node('Set Monitors', DT_TYPE, DT_VERSION, dt_upsert_params(MONITORS_TABLE, MONITORS_COLS, 'site_id'), [1240, 400], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(node('Load Link Prospects (Admin)', DT_TYPE, DT_VERSION, dt_get_where_params(PROSPECT_TABLE, 'site_id', 'eq', '={{ $json.site_id }}'), [760, 560], **ALOAD))
N.append(code('Prospect Rows (Admin)', rd('code/Prospect_Rows_Admin.js'), [1000, 560]))
N.append(node('Set Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), [1240, 560], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(node('Load AI Prompts (Admin)', DT_TYPE, DT_VERSION, dt_get_where_params(AI_PROMPTS_TABLE, 'site_id', 'eq', '={{ $json.site_id }}'), [760, 720], **ALOAD))
N.append(code('AI Prompt Rows (Admin)', rd('code/AI_Prompt_Rows_Admin.js'), [1000, 720]))
N.append(node('Set AI Prompts', DT_TYPE, DT_VERSION, dt_upsert_params(AI_PROMPTS_TABLE, AI_PROMPTS_COLS, 'prompt_id'), [1240, 720], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(switch('Admin Route', [('delete', "{{ $json.action === 'delete' }}"), ('status', "{{ $json.action === 'pause' || $json.action === 'resume' }}"), ('cadence', "{{ $json.action === 'cadence' }}"), ('unpublish', "{{ $json.action === 'unpublish' }}"), ('monitors', "{{ $json.action === 'monitors' }}"), ('prospect', "{{ $json.action === 'prospect' }}"), ('ai_prompts', "{{ $json.action === 'ai_prompts' }}")], [480, 0]))
N.append(node('Delete Site', DT_TYPE, DT_VERSION, {'resource': 'row', 'operation': 'deleteRows', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': SITES_TABLE}, 'matchType': 'allConditions', 'filters': {'conditions': [{'keyName': 'site_id', 'condition': 'eq', 'keyValue': '={{ $json.site_id }}'}]}, 'options': {}}, [760, -240], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(node('Set Site Status', DT_TYPE, DT_VERSION, dt_update_params(SITES_TABLE, SITES_COLS, [('site_id', '={{ $json.site_id }}')], {'status': '={{ $json.status }}'}), [760, -80], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(code('Cadence Row (Admin)', rd('code/Cadence_Row_Admin.js'), [760, 80]))
N.append(node('Set Cadence', DT_TYPE, DT_VERSION, dt_upsert_params(CADENCE_TABLE, CADENCE_COLS, 'site_id'), [1000, 80], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(node('Unpublish Log', DT_TYPE, DT_VERSION, dt_update_params(LOG_TABLE, LOG_COLS, [('site_id', '={{ $json.site_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': 'started', 'published_url': '', 'published_at': ''}), [760, 240], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(node('Unpublish Ladder', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS, [('domain', "={{ $('Admin Action').first().json.domain }}"), ('keyword', "={{ $('Admin Action').first().json.keyword }}")], {'status': 'writing', 'page_exists': 'false'}), [1000, 240], alwaysOutputData=True, onError='continueRegularOutput'))
N.append(code('Admin Result', rd('code/Admin_Result.js'), [1240, 0]))
N.append(sticky('Note', """## SEO Agent — Site Admin
Manages a tracked site without the n8n UI. Body: `{ action, site_id | domain, ... }` through the Test Runner (`workflow: SEOagentSiteAdm1`) or an Execute Workflow node:
`pause` / `resume` set `status` in `seo_sites` (the weekly runs skip paused sites; on-demand runs still work) · `delete` removes the site row (history stays) · `cadence` + `pages_per_week` (0-3) sets the Content Cadence for the site (`seo_cadence`) · `unpublish` + `keyword` reverts a published page to "started" (content log + ladder row) · `monitors` (v4.5) sets the growth monitors (`ai_visibility`, `ai_engines`, `ai_prompts_max` (3-50), `ai_pulse` (daily AI Pulse), `backlinks`, `audit_monthly`, `audit_pages`, `audit_js`, `competitors`, `brand_names`; given fields replace, others kept) · `prospect` + `prospect_domain` + `status` (new / contacted / won / rejected / ignored) and/or `note` updates the link-prospect pipeline · `ai_prompts` + `add` (questions) / `remove` (prompt ids or texts) manages the tracked AI questions.
**Must be published** (n8n 2.x refuses to execute an unpublished sub-workflow: live finding 2026-10-02).""", [-40, -520], 900, 240, 7))
for a, b in [('Admin Run', 'Ensure Cadence Table (Admin)'), ('Ensure Cadence Table (Admin)', 'Ensure Log Table (Admin)'), ('Ensure Log Table (Admin)', 'Ensure Sites Table (Admin)'), ('Ensure Sites Table (Admin)', 'Ensure Monitors Table (Admin)'), ('Ensure Monitors Table (Admin)', 'Ensure Prospects Table (Admin)'), ('Ensure Prospects Table (Admin)', 'Ensure AI Prompts Table (Admin)'), ('Ensure AI Prompts Table (Admin)', 'Admin Action'), ('Admin Action', 'Admin Route'), ('Delete Site', 'Admin Result'), ('Set Site Status', 'Admin Result'), ('Cadence Row (Admin)', 'Set Cadence'), ('Set Cadence', 'Admin Result'), ('Unpublish Log', 'Unpublish Ladder'), ('Unpublish Ladder', 'Admin Result')]: link(C, a, b)
link(C, 'Admin Route', 'Delete Site', 0); link(C, 'Admin Route', 'Set Site Status', 1); link(C, 'Admin Route', 'Cadence Row (Admin)', 2); link(C, 'Admin Route', 'Unpublish Log', 3); link(C, 'Admin Route', 'Load Monitors (Admin)', 4); link(C, 'Admin Route', 'Load Link Prospects (Admin)', 5); link(C, 'Admin Route', 'Load AI Prompts (Admin)', 6)
for a, b in [('Load Monitors (Admin)', 'Monitor Row (Admin)'), ('Monitor Row (Admin)', 'Set Monitors'), ('Set Monitors', 'Admin Result'), ('Load Link Prospects (Admin)', 'Prospect Rows (Admin)'), ('Prospect Rows (Admin)', 'Set Prospects'), ('Set Prospects', 'Admin Result'), ('Load AI Prompts (Admin)', 'AI Prompt Rows (Admin)'), ('AI Prompt Rows (Admin)', 'Set AI Prompts'), ('Set AI Prompts', 'Admin Result')]: link(C, a, b)
write(wf('SEOagentSiteAdm1', 'SEO Agent — Site Admin', N, C), 'SEO_Agent_Site_Admin.json')

# =============================================================================
# SEO Agent — Content Cadence (weekly, Monday 10:00, plus Manual Run): the configured number of blog pages per site, written by the
# content pipeline and delivered as HTML + Markdown + meta.json; the owner publishes in any framework and reports the URL ("I published a page").
# =============================================================================
N = []; C = {}
N.append(node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': 10, 'triggerAtMinute': 0}]}}, at(0, 0)))
N.append(node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1)))
N.append(node('Ensure Log Table', DT_TYPE, DT_VERSION, dt_create_params(LOG_TABLE, LOG_COLS), at(1, 0), onError='continueRegularOutput'))
N.append(node('Ensure Cadence Table', DT_TYPE, DT_VERSION, dt_create_params(CADENCE_TABLE, CADENCE_COLS), at(2, 0), onError='continueRegularOutput'))
N.append(node('Ensure Trends Table (Cadence)', DT_TYPE, DT_VERSION, dt_create_params(TRENDS_TABLE, TRENDS_COLS), at(3, 0), onError='continueRegularOutput'))
N.append(node('Load Sites', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), at(4, 0), **LOAD))
N.append(node('Load Cadence', DT_TYPE, DT_VERSION, dt_get_all_params(CADENCE_TABLE), at(5, 0), **LOAD))
N.append(node('Load Ladders', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), at(6, 0), **LOAD))
N.append(node('Load Query History', DT_TYPE, DT_VERSION, dt_get_all_params(QUERY_TABLE), at(7, 0), **LOAD))
N.append(node('Load Trends', DT_TYPE, DT_VERSION, dt_get_all_params(TRENDS_TABLE), at(8, 0), **LOAD))
N.append(node('Load Content Log', DT_TYPE, DT_VERSION, dt_get_all_params(LOG_TABLE), at(9, 0), **LOAD))
# v4.8 (Pipeline phase 2): ladder settings written by the web app (Auto / Manual, priority, status, website defaults) and the main keywords' rank checks
# (rung 4 rows of seo_rank_history, newest first, bounded) for the main-page gate and Won; a missing table only means "no settings" / "no ranks yet"
N.append(node('Ensure Ladder Settings Table', DT_TYPE, DT_VERSION, dt_create_params(LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS), at(4, 2), onError='continueRegularOutput'))
N.append(node('Load Ladder Settings', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_SETTINGS_TABLE), at(9, 2), **LOAD))
# R16 (2026-10-13, FIX_PLAN §3.11, build_v4.py section 53): the ranks of EVERY rung, not only the main keyword (rung 4). The won / gate
# rules still read the main keyword's own rows; the rung rows carry the results pages the Rank Tracker stored two hours earlier
# (`competitors_json`, G6), which is the evidence the fit gate needs to recognise a competitor's brand in a stored rung.
N.append(node('Load Main Keyword Ranks', DT_TYPE, DT_VERSION, dt_get_recent_params(HISTORY_TABLE, 'rung', 'gte', '0', 5000), at(10, 2), **LOAD))
# v4.12 (AI_GROWTH_SPEC.md): the AI targets queued by the AI Growth loop and the sites' AI pages a month (seo_monitors ai_pages_month)
N.append(node('Ensure AI Targets Table (Cadence)', DT_TYPE, DT_VERSION, dt_create_params(AI_TARGETS_TABLE, AI_TARGETS_COLS), at(5, 2), onError='continueRegularOutput'))
N.append(node('Load AI Targets (Cadence)', DT_TYPE, DT_VERSION, dt_get_where_params(AI_TARGETS_TABLE, 'status', 'eq', 'queued'), at(11, 2), **LOAD))
# B9-6 (2026-10-15, INVARIANTS rule 4): the rows an EARLIER run left `writing`. *AI Target Settle* moves each one to `written`
# against the seo_content_log row for its own run, and leaves the rest alone (the 14-day requeue is the read half's, in AI Growth).
N.append(node('Load AI Targets Writing (Cadence)', DT_TYPE, DT_VERSION, dt_get_where_params(AI_TARGETS_TABLE, 'status', 'eq', 'writing'), at(11, 3), **LOAD))
N.append(node('Load Monitors (Cadence)', DT_TYPE, DT_VERSION, dt_get_all_params(MONITORS_TABLE), at(12, 2), **LOAD))
# D11: the website's page inventory, so a search a live page already answers is refreshed, not written as a second page
N.append(node('Ensure Pages Table (Cadence)', DT_TYPE, DT_VERSION, dt_create_params(PAGES_TABLE, PAGES_COLS), at(13, 2), onError='continueRegularOutput'))
N.append(node('Load Pages (Cadence)', DT_TYPE, DT_VERSION, dt_get_all_params(PAGES_TABLE), at(14, 2), **LOAD))
# R90 (2026-10-16, re-rating 2026-10-15): the names AI uses for other companies (seo_cache rows of kind 'ai', key ai_brands:<site_id>), so
# the fit gate of the stored rungs can recognise another company's brand the way Ladder Pool and Rank Keywords already do
N.append(node('Load AI Brands (Cadence)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(15, 2), **LOAD))
N.append(code('Cadence Plan', rd('code/Cadence_Plan.js'), at(10, 0)))
N.append(iff('Any Pages?', '{{ !$json.nothing_to_do }}', at(11, 0)))
N.append(iff('Site Notes?', '{{ !!$json.report_only && !$json.dry_run }}', at(12, 1)))
N.append(node('Nothing To Write', 'n8n-nodes-base.noOp', 1, {}, at(13, 2)))
N.append(code('Cadence Status', urls(rd('code/Cadence_Status.js')), at(19, 2)))
N.append(iff('Dry Run?', '{{ !!$json.dry_run }}', at(12, 0)))
N.append(node('Planned Only', 'n8n-nodes-base.noOp', 1, {}, at(13, -1)))
N.append(node('Start Content Runs', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(13, 0), onError='continueRegularOutput'))
N.append(code('Log Rows', rd('code/Log_Rows.js'), at(14, 0)))
N.append(node('Save Content Log', DT_TYPE, DT_VERSION, dt_insert_params(LOG_TABLE, LOG_COLS), at(15, 0), onError='continueRegularOutput'))
N.append(code('Ladder Marks', rd('code/Ladder_Marks.js'), at(16, 0)))
N.append(iff('Any Ladder Marks?', '{{ !$json.skip }}', at(17, 0)))
N.append(node('Mark Ladder Writing', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS, [('ladder_id', '={{ $json.ladder_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': '={{ $json.status }}'}), at(18, 0), alwaysOutputData=True, onError='continueRegularOutput'))
N.append(code('AI Target Marks', rd('code/AI_Target_Marks.js'), at(18, 1)))
N.append(iff('Any AI Marks?', '{{ !$json.skip }}', at(18, 2)))
# B9-6: the status and the reason come from the item now - a spawn that failed writes the row back to `queued` instead of
# leaving it claiming work in progress, and the row that IS marked carries, in its own words, that nothing exists yet.
N.append(node('Mark AI Target Writing', DT_TYPE, DT_VERSION, dt_update_params(AI_TARGETS_TABLE, AI_TARGETS_COLS, [('target_id', '={{ $json.target_id }}')], {'status': '={{ $json.status }}', 'request_id': '={{ $json.request_id }}', 'written_at': '={{ $json.written_at }}', 'updated_at': '={{ $json.at }}', 'reason': '={{ $json.reason }}'}), at(18, 3), alwaysOutputData=True, onError='continueRegularOutput'))
# B9-6: and the exit from `writing` - `written`, only against the content-log row of the run that was supposed to write it
N.append(code('AI Target Settle', rd('code/AI_Target_Settle.js'), at(18, 4)))
N.append(iff('Any AI Settles?', '{{ !$json.skip }}', at(18, 5)))
N.append(node('Settle AI Targets', DT_TYPE, DT_VERSION, dt_update_params(AI_TARGETS_TABLE, AI_TARGETS_COLS, [('target_id', '={{ $json.target_id }}')], {'status': '={{ $json.status }}', 'written_at': '={{ $json.written_at }}', 'updated_at': '={{ $json.at }}', 'reason': '={{ $json.reason }}'}), at(18, 6), alwaysOutputData=True, onError='continueRegularOutput'))
N.append(code('Cadence Note', urls(rd('code/Cadence_Note.js')), at(19, 0)))
N.append(iff('Has Email (Cadence)?', '{{ !!$json.email }}', at(20, -1)))
N.append(node('Send Cadence Note', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False}}, at(21, -1), credentials=SMTP, onError='continueRegularOutput'))
N.append(iff('Has Callback (Cadence)?', '{{ !!$json.callback_url }}', at(20, 1)))
N.append(node('POST Cadence Note', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ JSON.stringify({ status: 'progress', stage: 'content_cadence', request_id: $json.request_id, site_id: $json.site_id, domain: $json.domain, week: $json.week, pages: $json.pages, upcoming: $json.upcoming, pending_publish: $json.pending_publish, candidates: $json.candidates, paused_reason: $json.paused_reason || '', waiting_publish: $json.waiting_publish || 0, max_waiting: $json.max_waiting || 0, awaiting_approval: $json.awaiting_approval || [], suggestions: $json.suggestions || [], queued_ladders: $json.queued_ladders || [], won_ladders: $json.won_ladders || [], waiting_for_support: $json.waiting_for_support || [] }) }}", 'options': {'timeout': 20000}}, at(21, 1), onError='continueRegularOutput'))
N.append(sticky('Note', f"""## SEO Agent — Content Cadence (v4.3, pipeline rules v4.8)
Runs **every Monday 10:00** (after the trackers) and on demand through *Manual Run* (`{{ site_id | domain, pages?, dry_run?, force? }}`). For every site with a cadence in `{CADENCE_TABLE}` (set by "Track my site" / API `blogs_per_week`, or Site Admin `cadence`; 1-3 per week) it picks the week's topics in this order: the keyword ladder's next **planned** pages (rung order, with the ladder's internal links), **striking-distance** queries from `{QUERY_TABLE}` (positions 4-20 with impressions: the page that already ranks gets strengthened), **rising** related searches from `{TRENDS_TABLE}`. Keywords written in the last 90 days, written/published ladder pages, brand queries and paused sites are skipped.
Each pick starts a content run in SEO Agent v4 (`mode: keyword`, `force_content`, internal rate-limit key `cadence:<site>`) that delivers the PDF/Word report **plus the blog package** (article HTML, Markdown, meta.json) by e-mail / callback (`stage: content`). The run is logged in `{LOG_TABLE}` (status started), ladder rows go to *writing*, and one note per site goes out (`stage: content_cadence`): this week's pages and why, what comes next, pages still waiting for a publish link.
**An AI target says `writing` only while a run is on record, and `written` only when a page is (B9-6, INVARIANTS rule 4).** *AI Target Marks* marks a `{AI_TARGETS_TABLE}` row `writing` with the run's id and the plain reason that nothing exists yet; a spawn that **failed** puts the row back to `queued` with its error, so the question is picked again instead of claiming work in progress for ever. *AI Target Settle* is the only exit: a row moves to `written` against a `{LOG_TABLE}` row for that same run saying `written` or `published` — R1's rule, in the one table R1 did not cover. A row with no such log row is left alone; AI Growth queues the question again after 14 days with its reason and a medium alert.
**Pipeline rules (v4.8)** from `{LADDER_SETTINGS_TABLE}` (written by the web app; one row per ladder + a `_site` row with the website defaults; no row = the site's default mode or Auto, active, priority by start date): only **Auto** ladders with status active / queued are written, at most `max_active` (default 2) at a time in **priority** order (ladder 1's pages before ladder 2's; plan type *direct* writes the main page first); the **main page waits** until half of the supporting pages are published or the main keyword ranks 1-30; a ladder whose main keyword held the **top 3 for 4 checks** gets no more pages; with `max_waiting` (default 3) pages written but not published the site is **paused** (`paused_reason: pileup`; on demand `force: true` bypasses it); opportunity posts only when `opportunities` is Auto (else listed as `suggestions`); **Manual** ladders' next pages are listed in `awaiting_approval`. Sites without a page but with news get a *Cadence Status* note (same callback stage).
The owner publishes in any CMS and reports the URL ("I published a page" in the form, or API `mode: published`): the page is checked live, logged as published, the ladder row gets the real URL, and the Site Tracker inspects indexing and positions from the next Monday. `dry_run: true` only plans. Cost: about $1.20 of AI per page.
Form: {FORM_URL} · API: {API_URL}""", [-40, -700], 1180, 560))
for a, b in [('Weekly Schedule', 'Ensure Log Table'), ('Manual Run', 'Ensure Log Table'), ('Ensure Log Table', 'Ensure Cadence Table'), ('Ensure Cadence Table', 'Ensure Trends Table (Cadence)'), ('Ensure Trends Table (Cadence)', 'Ensure Ladder Settings Table'), ('Ensure Ladder Settings Table', 'Ensure AI Targets Table (Cadence)'), ('Ensure AI Targets Table (Cadence)', 'Load Sites'), ('Load Sites', 'Load Cadence'), ('Load Cadence', 'Load Ladders'), ('Load Ladders', 'Load Query History'), ('Load Query History', 'Load Trends'), ('Load Trends', 'Load Content Log'), ('Load Content Log', 'Load Ladder Settings'), ('Load Ladder Settings', 'Load Main Keyword Ranks'), ('Load Main Keyword Ranks', 'Load AI Targets (Cadence)'), ('Load AI Targets (Cadence)', 'Load AI Targets Writing (Cadence)'), ('Load AI Targets Writing (Cadence)', 'Load Monitors (Cadence)'), ('Load Monitors (Cadence)', 'Ensure Pages Table (Cadence)'), ('Ensure Pages Table (Cadence)', 'Load Pages (Cadence)'), ('Load Pages (Cadence)', 'Load AI Brands (Cadence)'), ('Load AI Brands (Cadence)', 'Cadence Plan'), ('Cadence Plan', 'Any Pages?'),
             ('Start Content Runs', 'Log Rows'), ('Log Rows', 'Save Content Log'), ('Save Content Log', 'Ladder Marks'), ('Ladder Marks', 'Any Ladder Marks?'), ('Mark Ladder Writing', 'AI Target Marks'), ('AI Target Marks', 'Any AI Marks?'), ('Mark AI Target Writing', 'AI Target Settle'), ('AI Target Settle', 'Any AI Settles?'), ('Settle AI Targets', 'Cadence Note'), ('Cadence Note', 'Has Email (Cadence)?'), ('Cadence Note', 'Has Callback (Cadence)?')]: link(C, a, b)
link(C, 'Any Pages?', 'Dry Run?', 0); link(C, 'Any Pages?', 'Site Notes?', 1)
link(C, 'Site Notes?', 'Cadence Status', 0); link(C, 'Site Notes?', 'Nothing To Write', 1)
link(C, 'Cadence Status', 'Has Email (Cadence)?'); link(C, 'Cadence Status', 'Has Callback (Cadence)?')
link(C, 'Dry Run?', 'Planned Only', 0); link(C, 'Dry Run?', 'Start Content Runs', 1)
link(C, 'Any Ladder Marks?', 'Mark Ladder Writing', 0); link(C, 'Any Ladder Marks?', 'AI Target Marks', 1)
link(C, 'Any AI Marks?', 'Mark AI Target Writing', 0); link(C, 'Any AI Marks?', 'AI Target Settle', 1)
link(C, 'Any AI Settles?', 'Settle AI Targets', 0); link(C, 'Any AI Settles?', 'Cadence Note', 1)
link(C, 'Has Email (Cadence)?', 'Send Cadence Note', 0); link(C, 'Has Callback (Cadence)?', 'POST Cadence Note', 0)
LEDGER_WIRING['SEO Agent — Content Cadence'] = ledger_nodes(N, C, 'content_cadence', 'Cadence', 'Cadence Plan', ['Cadence Note'], at(11, 4))
# R31 (2026-10-14): the merge into harness/ledger_wiring.json moved to the END of this builder — ledger_mainline() fills each entry's
# `ai_nodes` and `balance` at write time, and the Page Watch's entry does not exist until its own workflow is built below.
# R16 (2026-10-13, FIX_PLAN §3.11, build_v4.py section 53): the cadence runs the fit gate over the STORED rungs, so a competitor's brand
# planned before the gate existed is set aside with its reason instead of written, and the row is marked `set_aside` for everything else.
_cadcode = {n['name']: n['parameters']['jsCode'] for n in N if n['type'] == 'n8n-nodes-base.code'}
assert 'const fitStored = ' in _cadcode['Cadence Plan'] and 'fitStored(l, { ...fitCtx' in _cadcode['Cadence Plan'] and 'const serpFor = ' in _cadcode['Cadence Plan'], 'R16: the Content Cadence does not run the fit gate over the stored rungs'
assert not any('/*__FIT_GATE__*/' in c_ for c_ in _cadcode.values()), 'R16: fit-gate placeholder left in the Content Cadence'
# R87 / R90 / R111 (2026-10-16): one stored reading per position, the ladder's own results pages and the AI brand names reach the gate; a
# set-aside head pauses its ladder; a draft that failed its quality check is counted by the pile-up guard as needing a fix
assert 'const RS = (() => {' in _cadcode['Cadence Plan'] and 'RS.serpHosts(h, 10)' in _cadcode['Cadence Plan'] and 'ladderDoms.get(l.ladder_id)' in _cadcode['Cadence Plan'] \
    and "rowsOf('Load AI Brands (Cadence)')" in _cadcode['Cadence Plan'], 'R90: the cadence judges a stored rung without its ladder\'s results pages or the AI brand names'
assert 'head_aside' in _cadcode['Cadence Plan'] and 'paused_ladders:' in _cadcode['Cadence Plan'], 'R87: a ladder whose main keyword is set aside is still written'
assert "const WAITS = new Set(['written', 'not_ready']);" in _cadcode['Cadence Plan'] and 'needs_fix_keywords' in _cadcode['Cadence Plan'], 'R111: a failed draft is not counted, or not labelled, by the pile-up guard'
assert "status: 'set_aside'" in _cadcode['Ladder Marks'], 'R16: a set-aside rung is not written back to the ladder row'
for _n in ('Cadence Note', 'Cadence Status'): assert 'Set aside' in _cadcode[_n], _n + ': the set-aside rungs are not reported'
write(wf('SEOagentCadence1', 'SEO Agent — Content Cadence', N, C), 'SEO_Agent_Content_Cadence.json')

# =============================================================================
# SEO Agent — Console Alerts: watches the agent's mailbox (IMAP) for Google Search Console notification e-mails — manual actions, security
# issues, site-wide indexing / Core Web Vitals / rich-result / sitemap notices — which the API does not expose. The agent's Gmail address must
# be added as a user of the property in Search Console. Urgent notices are e-mailed / posted at once; everything lands in seo_console_alerts.
# =============================================================================
IMAP = {'imap': {'id': 'SEOcredImapGmail', 'name': 'Gmail IMAP (SEO Agent)'}}
N = []; C = {}
N.append(node('Mailbox Trigger', 'n8n-nodes-base.emailReadImap', 2.2, {'mailbox': 'INBOX', 'postProcessAction': 'nothing', 'downloadAttachments': False, 'format': 'simple', 'options': {}}, [0, 0], credentials=IMAP))
N.append(code('Classify Notification', rd('code/Classify_Notification.js'), [240, 0]))
N.append(iff('Relevant?', '{{ !!$json.relevant }}', [480, 0]))
N.append(node('Ignore', 'n8n-nodes-base.noOp', 1, {}, [720, 200]))
N.append(node('Ensure Alerts Table', DT_TYPE, DT_VERSION, dt_create_params(ALERTS_TABLE, ALERTS_COLS), [720, 0], onError='continueRegularOutput'))
N.append(node('Load Sites (Alerts)', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), [960, 0], **LOAD))
N.append(node('Load Ladders (Alerts)', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), [1200, 0], **LOAD))
N.append(code('Alert Row', rd('code/Alert_Row.js'), [1440, 0]))
N.append(node('Save Alert', DT_TYPE, DT_VERSION, dt_upsert_params(ALERTS_TABLE, ALERTS_COLS, 'message_id'), [1680, 0], onError='continueRegularOutput', alwaysOutputData=True))
N.append(iff('Urgent?', "{{ $('Classify Notification').first().json.severity === 'critical' }}", [1920, 0]))
N.append(code('Alert Target', rd('code/Alert_Target.js'), [2160, -100]))
N.append(iff('Has Email (Alert)?', '{{ !!$json.email }}', [2400, -200]))
N.append(node('Email Owner (Alert)', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject_line }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False}}, [2640, -200], credentials=SMTP, onError='continueRegularOutput'))
N.append(iff('Has Callback (Alert)?', '{{ !!$json.callback_url }}', [2400, 0]))
N.append(node('POST Alert', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ JSON.stringify({ status: 'alert', stage: 'console_alert', domain: $json.domain, site_id: $json.site_id, kind: $json.kind, severity: $json.severity, subject: $json.subject, summary: $json.summary, received_at: $json.received_at }) }}", 'options': {'timeout': 20000}}, [2640, 0], onError='continueRegularOutput'))
N.append(node('Stored', 'n8n-nodes-base.noOp', 1, {}, [2160, 160]))
N.append(sticky('Note', f"""## SEO Agent — Console Alerts (v4.3)
Google exposes **no API** for manual actions, security issues, the site-wide Pages (index coverage) report, Core Web Vitals and rich-result issue reports — but it **e-mails every user of the property** when they appear. This workflow reads the agent's mailbox over IMAP (credential **Gmail IMAP (SEO Agent)**: imap.gmail.com, 993, SSL, the agent's Gmail address + App Password) and turns Search Console notifications into typed alerts in `{ALERTS_TABLE}` (upsert by message id; other mails are ignored and never marked read).
**Set-up per site:** add the agent's Gmail address as a user (Restricted is enough) of the property in Search Console → Settings → Users and permissions, so Google sends it the notices.
Manual actions and security issues are e-mailed / posted to the owner immediately with the fix steps; all notices appear in the Monday report and the brief for 35 days. The monthly **Search Console check-in** (form / API `mode: checkin`) is the manual safety net for the same items and for the Pages report export.""", [-40, -420], 1100, 340))
for a, b in [('Mailbox Trigger', 'Classify Notification'), ('Classify Notification', 'Relevant?'), ('Ensure Alerts Table', 'Load Sites (Alerts)'), ('Load Sites (Alerts)', 'Load Ladders (Alerts)'), ('Load Ladders (Alerts)', 'Alert Row'), ('Alert Row', 'Save Alert'), ('Save Alert', 'Urgent?'), ('Alert Target', 'Has Email (Alert)?'), ('Alert Target', 'Has Callback (Alert)?')]: link(C, a, b)
link(C, 'Relevant?', 'Ensure Alerts Table', 0); link(C, 'Relevant?', 'Ignore', 1)
link(C, 'Urgent?', 'Alert Target', 0); link(C, 'Urgent?', 'Stored', 1)
link(C, 'Has Email (Alert)?', 'Email Owner (Alert)', 0); link(C, 'Has Callback (Alert)?', 'POST Alert', 0)
write(wf('SEOagentConsole1', 'SEO Agent — Console Alerts', N, C), 'SEO_Agent_Console_Alerts.json')

# =============================================================================
# SEO Agent — Page Watch (G11, 2026-10-13, system review FIX_PLAN.md): the daily key-page watch, and the re-check behind "I fixed this".
#     A monthly audit cannot see a page that went noindex on the 3rd — the leaders (ContentKing / Conductor Website Monitoring) check the
#     key pages continuously and alert within hours. This workflow does the same for free: every morning it fetches each site's key pages
#     raw (one plain GET per page, no JavaScript, no paid API) plus /robots.txt, compares status, a redirect that appeared, `noindex`, the
#     canonical, the title and the robots.txt fingerprint with what was stored, and raises an alert the same day when something that matters
#     changed. An unchanged page says nothing. A page whose fetch failed is "not checked": its stored reading is kept, so one timeout can
#     never erase the baseline (and never fake a change the next day).
#     It is its own workflow, not a branch of the Site Tracker: the Site Tracker is weekly, loads twenty Data Tables, calls Claude and costs
#     money per run, while this has to run every day, touch a handful of tables and cost nothing. Its own schedule also means a day that
#     fails retries tomorrow without touching the weekly report.
#     The second half of G11 (criterion 1.10, fix verification): "I fixed this" in the app sets seo_audit_findings.recheck_state to
#     `requested`; this run answers that one finding on the pages it just read (`fixed` / `still_open` / `not_checked` with the reason) and
#     writes the answer back on the finding row — days instead of waiting for the next monthly audit.
#     Alerts take the path D25b built: recorded first (seo_console_alerts for the customer, seo_ops_alerts for the serious ones), then
#     pushed to SEO_ALERT_WEBHOOK_URL (Slack / Teams / any POST endpoint, no SMTP). The same change inside the dedupe window is counted, not
#     re-sent. The app shows it on the Alerts page and on the technical page (seo_page_watch), and the Monday report lists the week's changes.
# =============================================================================
OPS_ALERT_SRC = _rdt('code/_ops_alert.js').rstrip('\n')
# R29 (2026-10-14, FIX_PLAN §3.12, secret handling): a placeholder is baked, never the real Slack URL — this repository is public and the
# generated JSON and harness code are both tracked. apply_env.py substitutes the value from n8n/.env into the JSON it imports.
ALERT_RETRY_SRC = _rdt('code/_alert_retry.js').rstrip('\n')   # B-A7 (2026-10-15, build section 64): the retry / escalation rules
wsrc = lambda p: rd(p).replace('/*__OPS_ALERT__*/', OPS_ALERT_SRC).replace('/*__ALERT_RETRY__*/', ALERT_RETRY_SRC).replace('__ALERT_WEBHOOK_URL__', ALERT_WEBHOOK_PLACEHOLDER)
WATCH_GET = {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True,
             'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.16; +page-watch)'}, {'name': 'Accept', 'value': 'text/html,application/xhtml+xml,text/plain,*/*'}]},
             # redirects are NOT followed: a key page that starts redirecting is itself the change we are watching for
             'options': {'batching': {'batch': {'batchSize': 5, 'batchInterval': 250}}, 'timeout': 20000,
                         'redirect': {'redirect': {'followRedirects': False}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}
N = []; C = {}
N.append(node('Daily Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'days', 'daysInterval': 1, 'triggerAtHour': 5, 'triggerAtMinute': 45}]}}, at(0, 0)))
N.append(node('Watch Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1)))
N.append(node('Ensure Sites Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), at(1, 0), onError='continueRegularOutput'))
N.append(node('Ensure Pages Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(PAGES_TABLE, PAGES_COLS), at(2, 0), onError='continueRegularOutput'))
N.append(node('Ensure Page Watch Table', DT_TYPE, DT_VERSION, dt_create_params(PAGE_WATCH_TABLE, PAGE_WATCH_COLS), at(3, 0), onError='continueRegularOutput'))
N.append(node('Ensure Cache Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), at(4, 0), onError='continueRegularOutput'))
N.append(node('Ensure Alerts Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(ALERTS_TABLE, ALERTS_COLS), at(5, 0), onError='continueRegularOutput'))
N.append(node('Ensure Findings Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS), at(6, 0), onError='continueRegularOutput'))
N.append(node('Ensure Ops Alerts Table (Watch)', DT_TYPE, DT_VERSION, dt_create_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS), at(7, 0), onError='continueRegularOutput'))
WLOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
N.append(node('Load Sites (Watch)', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), at(8, 0), **WLOAD))
N.append(node('Load Ladders (Watch)', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), at(9, 0), **WLOAD))
N.append(node('Load Pages (Watch)', DT_TYPE, DT_VERSION, dt_get_all_params(PAGES_TABLE), at(10, 0), **WLOAD))
N.append(node('Load Page Watch', DT_TYPE, DT_VERSION, dt_get_all_params(PAGE_WATCH_TABLE), at(11, 0), **WLOAD))
N.append(node('Load Watch Cache', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'watch'), at(12, 0), **WLOAD))
# only the findings somebody asked about: the filter runs in n8n, so a big findings table costs nothing here
N.append(node('Load Recheck Requests', DT_TYPE, DT_VERSION, dt_get_where_params(AUDIT_FINDINGS_TABLE, 'recheck_state', 'eq', 'requested'), at(13, 0), **WLOAD))
N.append(node('Load Ops Alerts (Watch)', DT_TYPE, DT_VERSION, dt_get_all_params(OPS_ALERTS_TABLE), at(14, 0), **WLOAD))
N.append(code('Watch Plan', rd('code/Watch_Plan.js'), at(15, 0)))
N.append(iff('Any Watch Targets?', '{{ !$json.skip }}', at(16, 0)))
N.append(node('Nothing To Watch', 'n8n-nodes-base.noOp', 1, {}, at(17, 1)))
N.append(node('Fetch Watch Page', 'n8n-nodes-base.httpRequest', 4.5, WATCH_GET, at(17, 0), alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Watch Read', rd('code/Watch_Read.js'), at(18, 0)))
N.append(code('Watch Compare', rd('code/Watch_Compare.js'), at(19, 0)))
N.append(code('Watch Rows', rd('code/Watch_Rows.js'), at(20, 0), **SAFE))
N.append(iff('Any Watch Rows?', '{{ !$json.skip }}', at(21, 0)))
N.append(node('Save Page Watch', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PAGE_WATCH_TABLE, PAGE_WATCH_COLS, ['site_id', 'url']), at(22, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Watch Cache Rows', rd('code/Watch_Cache_Rows.js'), at(23, 0), **SAFE))
N.append(node('Save Watch Cache', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(24, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Watch Recheck Rows', rd('code/Watch_Recheck_Rows.js'), at(25, 0), **SAFE))
N.append(iff('Any Rechecks?', '{{ !$json.skip }}', at(26, 0)))
N.append(node('Save Finding Recheck', DT_TYPE, DT_VERSION, dt_update_params(AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS,
    [('site_id', '={{ $json.site_id }}'), ('audit_id', '={{ $json.audit_id }}'), ('finding_key', '={{ $json.finding_key }}')],
    {'recheck_state': '={{ $json.recheck_state }}', 'recheck_at': '={{ $json.recheck_at }}', 'recheck_rule': '={{ $json.recheck_rule }}', 'recheck_note': '={{ $json.recheck_note }}'}),
    at(27, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Watch Alerts', rd('code/Watch_Alerts.js'), at(28, 0), **SAFE))
N.append(iff('Any Watch Alerts?', '{{ !$json.skip }}', at(29, 0)))
N.append(node('Save Watch Alerts', DT_TYPE, DT_VERSION, dt_upsert_params(ALERTS_TABLE, ALERTS_COLS, 'message_id'), at(30, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Watch Ops Alert', wsrc('code/Watch_Ops_Alert.js'), at(31, 0), **SAFE))
N.append(iff('Any Ops Alerts (Watch)?', '{{ !$json.skip }}', at(32, 0)))
N.append(node('Save Watch Ops Alert', DT_TYPE, DT_VERSION, dt_upsert_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, 'alert_key'), at(33, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(code('Watch Ops Channels', wsrc('code/Watch_Ops_Channels.js'), at(34, 0), **SAFE))
N.append(iff('Send Watch Webhook?', '{{ $json.send_webhook }}', at(35, 0)))
# B-A7 (2026-10-15, build section 64): fullResponse, so the POST's status code is on the item. Without it a 404 from a revoked webhook
# arrived as an item with no error and the digest counted as delivered (INVARIANTS rule 4).
N.append(node('Post Watch Alert', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.webhook_url }}', 'sendBody': True, 'specifyBody': 'json',
    'jsonBody': '={{ JSON.stringify($json.webhook_body) }}', 'options': {'timeout': 15000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
    at(36, 0), onError='continueRegularOutput', **retry_lint.RETRY))
# B-A7: the watch posted its digest and wrote nothing back, so every row it raised stayed `pending` for ever - indistinguishable from a post
# that never arrived, and the retry sweep would have re-sent a digest that had already landed.
N.append(code('Watch Ops Delivery', wsrc('code/Watch_Ops_Delivery.js'), at(37, 0), **SAFE))
N.append(node('Save Watch Ops Delivery', DT_TYPE, DT_VERSION, dt_update_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, [('alert_key', '={{ $json.alert_key }}')],
    {'delivered': '={{ $json.delivered }}', 'channels': '={{ $json.channels }}', 'severity': '={{ $json.severity }}', 'attempts': '={{ $json.attempts }}',
     'last_attempt_at': '={{ $json.last_attempt_at }}', 'next_attempt_at': '={{ $json.next_attempt_at }}', 'attempt_log': '={{ $json.attempt_log }}',
     'notes': '={{ $json.notes }}'}), at(38, 0), onError='continueRegularOutput', alwaysOutputData=True))
N.append(node('Watched', 'n8n-nodes-base.noOp', 1, {}, at(36, 1)))
N.append(sticky('Note Watch', f"""## SEO Agent — Page Watch (G11, v4.16)
Runs **every day at 05:45** (n8n's clock) and on demand through *Watch Run* (`{{ domain | site_id, finding_key? }}`; the web app uses it for a single re-check). Free: one plain **GET** per key page plus `/robots.txt`, no JavaScript, no paid API, at most 25 pages a site.
**The key pages** come from the one site model and the page inventory `{PAGES_TABLE}` (home page, the menu, the pages Search Console brings impressions for, the published ladder pages, the AI pages) — never a fresh crawl.
**What is watched:** HTTP status, a redirect that appeared, `noindex` (meta or `X-Robots-Tag`), the canonical, the `<title>`, and the fingerprint of `/robots.txt` (`{CACHE_TABLE}` key `watch:<site_id>`, beside the sitemap fingerprints). Also stored for the re-checks: the meta description and the H1s. A change that matters raises an alert **the same day** in `{ALERTS_TABLE}` (`kind: page_watch` — the app's Alerts page and the Monday report read it); a page gone, noindexed, blocked or re-canonicalised also goes to `{OPS_ALERTS_TABLE}` and to `SEO_ALERT_WEBHOOK_URL` (Slack / Teams, no SMTP), deduped as D25b dedupes. A fetch that failed is **not checked**: the stored reading stays, nothing is claimed.
**"I fixed this"** (criterion 1.10): the app sets `{AUDIT_FINDINGS_TABLE}.recheck_state = requested`; the next run judges that finding on the pages it just read and writes back `fixed`, `still_open`, or `not_checked` with the reason it needs the full audit. Rules: `v5/code/_page_watch.js`.
**Google's view** of the same pages (`{PAGE_WATCH_TABLE}.inspect_*`) is written by the weekly Site Tracker: URL Inspection rotates through every key page, oldest first, inside Google's 2,000-a-day quota (G25).""", [15 * 220 - 40, -620], 1400, 520, 4))
for a, b in [('Daily Schedule', 'Ensure Sites Table (Watch)'), ('Watch Run', 'Ensure Sites Table (Watch)'),
             ('Ensure Sites Table (Watch)', 'Ensure Pages Table (Watch)'), ('Ensure Pages Table (Watch)', 'Ensure Page Watch Table'),
             ('Ensure Page Watch Table', 'Ensure Cache Table (Watch)'), ('Ensure Cache Table (Watch)', 'Ensure Alerts Table (Watch)'),
             ('Ensure Alerts Table (Watch)', 'Ensure Findings Table (Watch)'), ('Ensure Findings Table (Watch)', 'Ensure Ops Alerts Table (Watch)'),
             ('Ensure Ops Alerts Table (Watch)', 'Load Sites (Watch)'), ('Load Sites (Watch)', 'Load Ladders (Watch)'), ('Load Ladders (Watch)', 'Load Pages (Watch)'),
             ('Load Pages (Watch)', 'Load Page Watch'), ('Load Page Watch', 'Load Watch Cache'), ('Load Watch Cache', 'Load Recheck Requests'),
             ('Load Recheck Requests', 'Load Ops Alerts (Watch)'), ('Load Ops Alerts (Watch)', 'Watch Plan'), ('Watch Plan', 'Any Watch Targets?'),
             ('Fetch Watch Page', 'Watch Read'), ('Watch Read', 'Watch Compare'), ('Watch Compare', 'Watch Rows'), ('Watch Rows', 'Any Watch Rows?'),
             ('Save Page Watch', 'Watch Cache Rows'), ('Watch Cache Rows', 'Save Watch Cache'), ('Save Watch Cache', 'Watch Recheck Rows'),
             ('Watch Recheck Rows', 'Any Rechecks?'), ('Save Finding Recheck', 'Watch Alerts'), ('Watch Alerts', 'Any Watch Alerts?'),
             ('Save Watch Alerts', 'Watch Ops Alert'), ('Watch Ops Alert', 'Any Ops Alerts (Watch)?'), ('Save Watch Ops Alert', 'Watch Ops Channels'),
             ('Watch Ops Channels', 'Send Watch Webhook?'), ('Post Watch Alert', 'Watch Ops Delivery'), ('Watch Ops Delivery', 'Save Watch Ops Delivery')]:
    link(C, a, b)
link(C, 'Any Watch Targets?', 'Fetch Watch Page', 0); link(C, 'Any Watch Targets?', 'Nothing To Watch', 1)
link(C, 'Any Watch Rows?', 'Save Page Watch', 0); link(C, 'Any Watch Rows?', 'Watch Cache Rows', 1)
link(C, 'Any Rechecks?', 'Save Finding Recheck', 0); link(C, 'Any Rechecks?', 'Watch Alerts', 1)
link(C, 'Any Watch Alerts?', 'Save Watch Alerts', 0); link(C, 'Any Watch Alerts?', 'Watch Ops Alert', 1)
link(C, 'Any Ops Alerts (Watch)?', 'Save Watch Ops Alert', 0); link(C, 'Any Ops Alerts (Watch)?', 'Watched', 1)
link(C, 'Send Watch Webhook?', 'Post Watch Alert', 0); link(C, 'Send Watch Webhook?', 'Watched', 1)
# R32's companion (2026-10-14, FIX_PLAN §3.13, the live check's third observation): Page Watch kept no ledger row at all — it was the one
# workflow invisible to the spend guard, to the concurrency guard and to the day's reconciliation. It is free today (25 plain GETs), which
# is exactly why it reserves $0 and settles $0: the row proves the run happened and costs nothing, and the day a check here starts calling
# a paid API the guard already sees it. Its ends are the three places a watch run finishes.
LEDGER_WIRING['SEO Agent — Page Watch'] = ledger_nodes(N, C, 'page_watch', 'Watch', 'Watch Plan',
                                                       ['Watched', 'Nothing To Watch', 'Save Watch Ops Delivery'], at(15, 4))
_wcode = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
for _n in ('Watch Plan', 'Watch Read', 'Watch Compare', 'Watch Rows', 'Watch Alerts'):
    assert 'const PW = (() => {' in _wcode[_n], _n + ': the page-watch kit is not inlined'
assert 'const SM = (() => {' in _wcode['Watch Plan'], 'Watch Plan: the site model kit is not inlined'
for _n in ('Watch Ops Alert', 'Watch Ops Channels', 'Watch Ops Delivery'):
    assert 'const OA = (() => {' in _wcode[_n], _n + ': the ops-alert kit is not inlined'
assert 'const AR = (() => {' in _wcode['Watch Ops Delivery'], 'Watch Ops Delivery: the alert-retry kit is not inlined'
assert '/*__ALERT_RETRY__*/' not in _wcode['Watch Ops Delivery'], 'Watch Ops Delivery: marker left'
assert not any(('/*__PAGE_WATCH__*/' in c_) or ('/*__OPS_ALERT__*/' in c_) for c_ in _wcode.values()), 'placeholder left in the Page Watch'
write(wf('SEOagentPageWch1', 'SEO Agent — Page Watch', N, C), 'SEO_Agent_Page_Watch.json')

# what the harness checks (S53): the watch's wiring, its schedule and the quota the inspections live inside
json.dump({'workflow': 'SEOagentPageWch1', 'table': PAGE_WATCH_TABLE, 'cache_kind': 'watch', 'schedule': {'hour': 5, 'minute': 45, 'every': 'day'},
           'webhook_setting': 'SEO_ALERT_WEBHOOK_URL', 'webhook_placeholder': ALERT_WEBHOOK_PLACEHOLDER,   # R30: never whether the setting is filled - that made this tracked fixture depend on the building machine's .env
           'nodes': [n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote'],
           'connections': {s_: [[t_['node'] for t_ in l_] for l_ in o_.get('main', [])] for s_, o_ in C.items()},
           'fetch': {'name': 'Fetch Watch Page', 'follows_redirects': False, 'response_format': 'text', 'retries': retry_lint.RETRY['maxTries']},
           'site_tracker_inspections': {'cap': 150, 'quota_per_day': 2000, 'rotation': 'oldest inspection first'}},
          open(os.path.join(HERE, 'harness', 'page_watch_wiring.json'), 'w'), indent=1, sort_keys=True)

# R9 / R31: the ledger wiring of every workflow this builder makes, AFTER they are written — ledger_mainline() fills `resume`,
# `ai_nodes` (R31: the Claude nodes the settle checks before it settles a cent) and `balance` (R32: the free account reading) at write time.
_lw9 = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw9)) if os.path.exists(_lw9) else {}
_lwj.setdefault('monitors', {}).update(LEDGER_WIRING)
json.dump(_lwj, open(_lw9, 'w'), indent=1, sort_keys=True)
