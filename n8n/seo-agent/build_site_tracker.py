#!/usr/bin/env python3
"""Builds SEO Agent — Site Tracker (weekly, plus on demand): per registered site, Search Console (totals, query/page movers, striking-distance
queries, CTR gaps, decaying pages, tracked keywords, URL inspection of ladder pages), GA4 (organic sessions / key events / landing pages,
property auto-detected), Google Trends (DataForSEO) and live SERP checks for the site's own keywords -> Data Table history -> one Claude
brief -> HTML e-mail + PDF + callback with ready-to-send API bodies. Code nodes are also written to harness/code_v4 for the offline harness."""
import json, os, re, uuid, sys
from ladder_common import (dt_schema, LADDER_TABLE, LADDER_COLS, HISTORY_TABLE, HISTORY_COLS, SITES_TABLE, METRICS_TABLE, QUERY_TABLE, SITES_COLS, METRICS_COLS, QUERY_COLS,
                           LOG_TABLE, LOG_COLS, TRENDS_TABLE, TRENDS_COLS, CADENCE_TABLE, CADENCE_COLS, ALERTS_TABLE, ALERTS_COLS, CHECKIN_TABLE, CHECKIN_COLS,
                           MONITORS_TABLE, MONITORS_COLS, AI_VIS_TABLE, AI_VIS_COLS, BL_SNAP_TABLE, BL_SNAP_COLS, AUDITS_TABLE, AUDITS_COLS, PROSPECT_TABLE, PROSPECT_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS,
                           DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_upsert_params, dt_get_where_params, dt_upsert_params_keys, dt_update_params)
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
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
HTTP_X = dict(onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=3000)
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
N.append(node('Load Sites', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), at(5, 0), **LOAD))
N.append(node('Load Ladders', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), at(6, 0), **LOAD))
N.append(node('Load Rank History', DT_TYPE, DT_VERSION, dt_get_all_params(HISTORY_TABLE), at(7, 0), **LOAD))
N.append(node('Load Site Metrics', DT_TYPE, DT_VERSION, dt_get_all_params(METRICS_TABLE), at(8, 0), **LOAD))
N.append(node('Load Query History', DT_TYPE, DT_VERSION, dt_get_where_params(QUERY_TABLE, 'tracked', 'isTrue'), at(9, 0), **LOAD))
N.append(code('Site Plan', urls(rd('code/Site_Plan.js')), at(10, 0)))
N.append(iff('Any Sites?', '{{ !$json.nothing_to_do }}', at(11, 0)))
N.append(node('Nothing To Track (Site)', 'n8n-nodes-base.noOp', 1, {}, at(12, 1)))
# ---- row 1: Search Console ----
N.append(node('GSC Sites', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_GET('https://www.googleapis.com/webmasters/v3/sites'), at(12, 0), credentials=GOOGLE, executeOnce=True, **HTTP_X))
N.append(code('Resolve Properties', rd('code/Resolve_Properties.js'), at(13, 0)))
N.append(code('GSC Requests', rd('code/GSC_Requests.js'), at(14, 0)))
N.append(iff('Any GSC?', '{{ !$json.skip }}', at(15, 0)))
N.append(node('GSC Query', 'n8n-nodes-base.httpRequest', 4.5, GOOGLE_POST('={{ $json.url }}'), at(16, 0), credentials=GOOGLE, **HTTP_X))
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
N.append(code('Site Metrics', urls(rd('code/Site_Metrics.js')), at(17, 4)))
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
    'options': {'timeout': 120000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'pdf'}}}}, at(16, 5), onError='continueRegularOutput'))
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
**Site Metrics** computes deltas, winners/losers/new/lost queries, striking-distance queries (4-20), CTR gaps, decaying pages, index status, alerts and ranked actions with API bodies; rows go to `{METRICS_TABLE}` (one row per site per run), `{QUERY_TABLE}` (tracked keywords + top 100 queries), `{TRENDS_TABLE}` (for the Content Cadence) and back into `{SITES_TABLE}`. Pages written by the Content Cadence (`{LOG_TABLE}`) are tracked as "blog" keywords; published ones are inspected; pages without a publish link are listed as waiting. Search Console **notices** (`{ALERTS_TABLE}`, from the Console Alerts mail watcher and the monthly check-in) and the latest **check-in** (`{CHECKIN_TABLE}`) appear as alerts, actions and a report section; a missing check-in for the month is reminded every Monday. **Site Brief** (Claude Sonnet 5.5, ~$0.03 per site) words the week for the owner; **Site Report** builds the e-mail (KPI tiles, actions, tracked keywords, ladder index status, movers, opportunities, traffic, trends) + PDF; delivery by e-mail and/or callback (`stage: site_tracker`).
Credential **Google Service Account (SEO Agent)** (`googleApi`, "Set up for use in HTTP Request node" on, scopes `https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly`). The owner adds the service-account e-mail to Search Console (Full) and GA4 (Viewer); put that e-mail into `CONFIG.service_account_email` in *Site Plan* so the connect instructions name it. Not connected = the report still runs (trends, live checks) and explains the two steps.
Form: {FORM_URL} · API: {API_URL} (`mode: track`)""", [-40, -560], 1180, 500))
for a, b in [('Weekly Schedule', 'Ensure Sites Table'), ('Manual Run', 'Ensure Sites Table'), ('Ensure Sites Table', 'Ensure Metrics Table'), ('Ensure Metrics Table', 'Ensure Query Table'), ('Ensure Query Table', 'Ensure History Table (Site)'), ('Ensure History Table (Site)', 'Ensure Trends Table'), ('Ensure Trends Table', 'Ensure Log Table (Site)'), ('Ensure Log Table (Site)', 'Ensure Alerts Table (Site)'), ('Ensure Alerts Table (Site)', 'Ensure Checkin Table (Site)'), ('Ensure Checkin Table (Site)', 'Ensure AI Visibility Table (Site)'), ('Ensure AI Visibility Table (Site)', 'Ensure Snapshots Table (Site)'), ('Ensure Snapshots Table (Site)', 'Ensure Audits Table (Site)'), ('Ensure Audits Table (Site)', 'Load Sites'),
             ('Load Sites', 'Load Ladders'), ('Load Ladders', 'Load Rank History'), ('Load Rank History', 'Load Site Metrics'), ('Load Site Metrics', 'Load Query History'), ('Load Query History', 'Load Content Log'), ('Load Content Log', 'Load Console Alerts'), ('Load Console Alerts', 'Load Check-ins'), ('Load Check-ins', 'Load AI Visibility (Site)'), ('Load AI Visibility (Site)', 'Load Backlink Snapshots (Site)'), ('Load Backlink Snapshots (Site)', 'Load Audits (Site)'), ('Load Audits (Site)', 'Site Plan'), ('Site Plan', 'Any Sites?'),
             ('GSC Sites', 'Resolve Properties'), ('Resolve Properties', 'GSC Requests'), ('GSC Requests', 'Any GSC?'), ('GSC Query', 'Parse GSC'), ('Parse GSC', 'Need GA4 Detect?'),
             ('GA4 Accounts', 'Stream Requests'), ('Stream Requests', 'Any Streams?'), ('GA4 Streams', 'GA4 Requests'), ('GA4 Requests', 'Any GA4?'), ('GA4 Report', 'Parse GA4'), ('Parse GA4', 'Inspect Requests'),
             ('Inspect Requests', 'Any Inspections?'), ('Inspect URL', 'Parse Inspection'), ('Parse Inspection', 'Trends Requests'), ('Trends Requests', 'Any Trends?'), ('Google Trends', 'Parse Trends'), ('Parse Trends', 'Site SERP Requests'),
             ('Site SERP Requests', 'Any SERP?'), ('SERP Check (Site)', 'Parse Site SERP'), ('Parse Site SERP', 'Save Site Rank History'), ('Save Site Rank History', 'Site Metrics'),
             ('Site Metrics', 'Save Site Metrics'), ('Save Site Metrics', 'Query Rows'), ('Query Rows', 'Any Query Rows?'), ('Save Query Rows', 'Trend Rows'), ('Trend Rows', 'Any Trend Rows?'), ('Save Trends', 'Site Rows'), ('Site Rows', 'Save Sites'), ('Save Sites', 'Brief Input'), ('Brief Input', 'Site Brief'), ('Site Brief', 'Site Report'),
             ('Site Report', 'Prepare PDF Site'), ('Prepare PDF Site', 'Render PDF Site'), ('Render PDF Site', 'Attach PDF Site'), ('Attach PDF Site', 'Has Email (Site)?'), ('Attach PDF Site', 'Build Site Callback'), ('Build Site Callback', 'Has Callback (Site)?')]:
    link(C, a, b)
link(C, 'Any Sites?', 'GSC Sites', 0); link(C, 'Any Sites?', 'Nothing To Track (Site)', 1)
link(C, 'Any GSC?', 'GSC Query', 0); link(C, 'Any GSC?', 'Need GA4 Detect?', 1)
link(C, 'Need GA4 Detect?', 'GA4 Accounts', 0); link(C, 'Need GA4 Detect?', 'GA4 Requests', 1)
link(C, 'Any Streams?', 'GA4 Streams', 0); link(C, 'Any Streams?', 'GA4 Requests', 1)
link(C, 'Any GA4?', 'GA4 Report', 0); link(C, 'Any GA4?', 'Inspect Requests', 1)
link(C, 'Any Inspections?', 'Inspect URL', 0); link(C, 'Any Inspections?', 'Trends Requests', 1)
link(C, 'Any Trends?', 'Google Trends', 0); link(C, 'Any Trends?', 'Site SERP Requests', 1)
link(C, 'Any SERP?', 'SERP Check (Site)', 0); link(C, 'Any SERP?', 'Site Metrics', 1)
link(C, 'Any Query Rows?', 'Save Query Rows', 0); link(C, 'Any Query Rows?', 'Trend Rows', 1)
link(C, 'Any Trend Rows?', 'Save Trends', 0); link(C, 'Any Trend Rows?', 'Site Rows', 1)
link(C, 'Has Email (Site)?', 'Send Site Report', 0); link(C, 'Has Callback (Site)?', 'POST Site Report', 0)
# every Google / DataForSEO HTTP node and the model node must carry a credential slot
for n in N:
    if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') in ('predefinedCredentialType', 'genericCredentialType'): assert n.get('credentials'), 'http node without credential: ' + n['name']
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': assert n.get('credentials'), 'model without credential: ' + n['name']
write(wf(WF_ID, 'SEO Agent — Site Tracker', N, C), 'SEO_Agent_Site_Tracker.json')

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
`pause` / `resume` set `status` in `seo_sites` (the weekly runs skip paused sites; on-demand runs still work) · `delete` removes the site row (history stays) · `cadence` + `pages_per_week` (0-3) sets the Content Cadence for the site (`seo_cadence`) · `unpublish` + `keyword` reverts a published page to "started" (content log + ladder row) · `monitors` (v4.5) sets the growth monitors (`ai_visibility`, `ai_engines`, `ai_prompts_max`, `backlinks`, `audit_monthly`, `audit_pages`, `audit_js`, `competitors`, `brand_names`; given fields replace, others kept) · `prospect` + `prospect_domain` + `status` (new / contacted / won / rejected / ignored) and/or `note` updates the link-prospect pipeline · `ai_prompts` + `add` (questions) / `remove` (prompt ids or texts) manages the tracked AI questions.
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
N.append(code('Cadence Plan', rd('code/Cadence_Plan.js'), at(10, 0)))
N.append(iff('Any Pages?', '{{ !$json.nothing_to_do }}', at(11, 0)))
N.append(node('Nothing To Write', 'n8n-nodes-base.noOp', 1, {}, at(12, 1)))
N.append(iff('Dry Run?', '{{ !!$json.dry_run }}', at(12, 0)))
N.append(node('Planned Only', 'n8n-nodes-base.noOp', 1, {}, at(13, -1)))
N.append(node('Start Content Runs', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(13, 0), onError='continueRegularOutput'))
N.append(code('Log Rows', rd('code/Log_Rows.js'), at(14, 0)))
N.append(node('Save Content Log', DT_TYPE, DT_VERSION, dt_insert_params(LOG_TABLE, LOG_COLS), at(15, 0), onError='continueRegularOutput'))
N.append(code('Ladder Marks', rd('code/Ladder_Marks.js'), at(16, 0)))
N.append(iff('Any Ladder Marks?', '{{ !$json.skip }}', at(17, 0)))
N.append(node('Mark Ladder Writing', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS, [('ladder_id', '={{ $json.ladder_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': '={{ $json.status }}'}), at(18, 0), alwaysOutputData=True, onError='continueRegularOutput'))
N.append(code('Cadence Note', urls(rd('code/Cadence_Note.js')), at(19, 0)))
N.append(iff('Has Email (Cadence)?', '{{ !!$json.email }}', at(20, -1)))
N.append(node('Send Cadence Note', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False}}, at(21, -1), credentials=SMTP, onError='continueRegularOutput'))
N.append(iff('Has Callback (Cadence)?', '{{ !!$json.callback_url }}', at(20, 1)))
N.append(node('POST Cadence Note', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ JSON.stringify({ status: 'progress', stage: 'content_cadence', request_id: $json.request_id, site_id: $json.site_id, domain: $json.domain, week: $json.week, pages: $json.pages, upcoming: $json.upcoming, pending_publish: $json.pending_publish, candidates: $json.candidates }) }}", 'options': {'timeout': 20000}}, at(21, 1), onError='continueRegularOutput'))
N.append(sticky('Note', f"""## SEO Agent — Content Cadence (v4.3)
Runs **every Monday 10:00** (after the trackers) and on demand through *Manual Run* (`{{ site_id | domain, pages?, dry_run? }}`). For every site with a cadence in `{CADENCE_TABLE}` (set by "Track my site" / API `blogs_per_week`, or Site Admin `cadence`; 1-3 per week) it picks the week's topics in this order: the keyword ladder's next **planned** pages (rung order, with the ladder's internal links), **striking-distance** queries from `{QUERY_TABLE}` (positions 4-20 with impressions: the page that already ranks gets strengthened), **rising** related searches from `{TRENDS_TABLE}`. Keywords written in the last 90 days, written/published ladder pages, brand queries and paused sites are skipped.
Each pick starts a content run in SEO Agent v4 (`mode: keyword`, `force_content`, internal rate-limit key `cadence:<site>`) that delivers the PDF/Word report **plus the blog package** (article HTML, Markdown, meta.json) by e-mail / callback (`stage: content`). The run is logged in `{LOG_TABLE}` (status started), ladder rows go to *writing*, and one note per site goes out (`stage: content_cadence`): this week's pages and why, what comes next, pages still waiting for a publish link.
The owner publishes in any CMS and reports the URL ("I published a page" in the form, or API `mode: published`): the page is checked live, logged as published, the ladder row gets the real URL, and the Site Tracker inspects indexing and positions from the next Monday. `dry_run: true` only plans. Cost: about $1.20 of AI per page.
Form: {FORM_URL} · API: {API_URL}""", [-40, -560], 1180, 420))
for a, b in [('Weekly Schedule', 'Ensure Log Table'), ('Manual Run', 'Ensure Log Table'), ('Ensure Log Table', 'Ensure Cadence Table'), ('Ensure Cadence Table', 'Ensure Trends Table (Cadence)'), ('Ensure Trends Table (Cadence)', 'Load Sites'), ('Load Sites', 'Load Cadence'), ('Load Cadence', 'Load Ladders'), ('Load Ladders', 'Load Query History'), ('Load Query History', 'Load Trends'), ('Load Trends', 'Load Content Log'), ('Load Content Log', 'Cadence Plan'), ('Cadence Plan', 'Any Pages?'),
             ('Start Content Runs', 'Log Rows'), ('Log Rows', 'Save Content Log'), ('Save Content Log', 'Ladder Marks'), ('Ladder Marks', 'Any Ladder Marks?'), ('Mark Ladder Writing', 'Cadence Note'), ('Cadence Note', 'Has Email (Cadence)?'), ('Cadence Note', 'Has Callback (Cadence)?')]: link(C, a, b)
link(C, 'Any Pages?', 'Dry Run?', 0); link(C, 'Any Pages?', 'Nothing To Write', 1)
link(C, 'Dry Run?', 'Planned Only', 0); link(C, 'Dry Run?', 'Start Content Runs', 1)
link(C, 'Any Ladder Marks?', 'Mark Ladder Writing', 0); link(C, 'Any Ladder Marks?', 'Cadence Note', 1)
link(C, 'Has Email (Cadence)?', 'Send Cadence Note', 0); link(C, 'Has Callback (Cadence)?', 'POST Cadence Note', 0)
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
