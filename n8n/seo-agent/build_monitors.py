#!/usr/bin/env python3
"""Builds the growth monitors (v4.5): SEO Agent — AI Visibility Tracker (weekly, Monday 07:00), SEO Agent — Backlink Monitor (weekly watch,
Monday 07:30, full report on the first run of each month) and SEO Agent — Audit Scheduler (monthly technical re-audit, 1st of the month 06:00).
All three read the sites from seo_sites + seo_ladders and their settings from seo_monitors, run on demand through *Manual Run*
({ domain | site_id, email?, callback_url?, country?, location_code?, competitors? }) and write their Code nodes to harness/code_v4."""
import json, os, re, uuid
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_upsert_params, dt_upsert_params_keys,
                           SITES_TABLE, SITES_COLS, LADDER_TABLE, LADDER_COLS, LOG_TABLE, LOG_COLS, PROFILE_TABLE, PROFILE_COLS, CASE_TABLE, CASE_COLS,
                           MONITORS_TABLE, MONITORS_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS, AI_ANSWERS_TABLE, AI_ANSWERS_COLS, AI_VIS_TABLE, AI_VIS_COLS,
                           BL_SNAP_TABLE, BL_SNAP_COLS, PROSPECT_TABLE, PROSPECT_COLS, AUDITS_TABLE, AUDITS_COLS, CACHE_TABLE, CACHE_COLS, dt_get_where_params,
                           AI_DAILY_TABLE, AI_DAILY_COLS, QUERY_TABLE, dt_get_all_where_params, dt_delete_where_params,
                           LINKS_TABLE, LINKS_COLS, LINK_IMPORTS_TABLE, LINK_IMPORTS_COLS, LINK_GRAPH_TABLE, LINK_GRAPH_COLS)
from env_settings import SENDER, ENV, BRAND, OPS_EMAIL
BING_ON = bool((ENV.get('SEO_BING_WEBMASTER_API_KEY') or '').strip())   # v4.10: optional free sources, baked in at build time (apply_env.py rebuilds)
AHREFS_ON = bool((ENV.get('SEO_AHREFS_API_KEY') or '').strip())
HERE = os.path.dirname(os.path.abspath(__file__)); V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
_NI = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
_COUNTRIES = re.search(r"\nconst COUNTRIES = \{.*?\n\};", _NI, re.S); assert _COUNTRIES, 'Normalize Input: COUNTRIES not found'
def src(p):   # a Code node source with the shared snippets inlined
    s = rd('code/' + p)
    s = s.replace('/*__MONITOR_SITES__*/', rd('code/_monitor_sites.js')).replace('/*__REPORT_KIT__*/', rd('code/_report_kit.js')).replace('/*__AI_STATS__*/', rd('code/_ai_stats.js'))
    s = s.replace('/*__LINK_KIT__*/', rd('code/_link_kit.js')).replace('__BING_ENABLED__', 'true' if BING_ON else 'false').replace('__AHREFS_ENABLED__', 'true' if AHREFS_ON else 'false')
    s = s.replace('/*__COUNTRIES__*/', "// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----" + _COUNTRIES.group(0))
    assert '/*__' not in s and '_ENABLED__' not in s, p + ': placeholder left'
    return s.replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL)
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
ANTHROPIC = {'anthropicApi': {'id': 'SEOcredAnthropic', 'name': 'Anthropic (SEO Agent)'}}
GOOGLE = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}
ARR = {'type': 'array', 'items': {'type': 'string'}}
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
HTTP_X = dict(onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=3000)

class WF:
    def __init__(self, wid, name, prefix, timeout, code_prefix=''):   # code_prefix: harness file prefix when node names repeat another workflow's (AI Pulse)
        self.wid, self.name, self.prefix, self.timeout, self.N, self.C, self.code_prefix = wid, name, prefix, timeout, [], {}, code_prefix
    def nid(self, name): return str(uuid.uuid5(NS, self.prefix + ':' + name))
    def node(self, name, ntype, ver, params, pos, **extra):
        n = {'parameters': params, 'id': self.nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); self.N.append(n); return n
    def code(self, name, file, pos, **extra): return self.node(name, 'n8n-nodes-base.code', 2, {'jsCode': src(file) if file.endswith('.js') else file}, pos, **extra)
    def iff(self, name, expr, pos):
        return self.node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': self.nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
    def ensure(self, name, table, cols, pos): return self.node(name, DT_TYPE, DT_VERSION, dt_create_params(table, cols), pos, onError='continueRegularOutput')
    def load(self, name, table, pos): return self.node(name, DT_TYPE, DT_VERSION, dt_get_all_params(table), pos, **LOAD)
    def dfs_http(self, name, pos, batch=1, interval=300, timeout=90000):
        return self.node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
            'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout}}, pos, credentials=DFS, **HTTP_X)
    def agent(self, name, prompt, schema, pos, max_tokens=8192):
        self.node(name, '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + rd('prompts/' + prompt), 'hasOutputParser': True, 'options': {}}, pos, retryOnFail=True, maxTries=2, waitBetweenTries=3000, onError='continueRegularOutput')
        self.node('Claude — ' + name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': 'claude-sonnet-5-5', 'cachedResultName': 'Claude Sonnet 5.5'}, 'options': {'maxTokensToSample': max_tokens, 'thinking': True, 'thinkingMode': 'adaptive', 'effort': 'low'}}, [pos[0] - 100, pos[1] + 200], credentials=ANTHROPIC)
        self.node('Parser — ' + name, '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps(schema)}, [pos[0] + 120, pos[1] + 200])
        self.C['Claude — ' + name] = {'ai_languageModel': [[{'node': name, 'type': 'ai_languageModel', 'index': 0}]]}
        self.C['Parser — ' + name] = {'ai_outputParser': [[{'node': name, 'type': 'ai_outputParser', 'index': 0}]]}
    def pdf_chain(self, tag, pos, keep_extra=False):
        x, y = pos
        self.code('Prepare PDF ' + tag, "// Copy of each report HTML named index.html for the PDF renderer (Gotenberg requires that exact file name); one item per site.\nreturn $input.all().map(item => { const doc = (item.binary || {}).data; if (!doc) return item; return { json: item.json, binary: { ...(item.binary || {}), html: { ...doc, fileName: 'index.html', mimeType: 'text/html', fileExtension: 'html' } } }; });", [x, y])
        self.node('Render PDF ' + tag, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': 'http://gotenberg:3000/forms/chromium/convert/html', 'sendBody': True, 'contentType': 'multipart-form-data',
            'bodyParameters': {'parameters': [{'parameterType': 'formBinaryData', 'name': 'files', 'inputDataFieldName': 'html'}, {'name': 'paperWidth', 'value': '8.27'}, {'name': 'paperHeight', 'value': '11.69'}, {'name': 'marginTop', 'value': '0.5'}, {'name': 'marginBottom', 'value': '0.5'}, {'name': 'marginLeft', 'value': '0.5'}, {'name': 'marginRight', 'value': '0.5'}, {'name': 'printBackground', 'value': 'true'}]},
            'options': {'timeout': 120000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'pdf'}}}}, [x + 220, y], onError='continueRegularOutput')
        self.code('Attach PDF ' + tag, "// Attach the PDF (when the renderer succeeded) next to the report's other files, per site; a renderer failure never fails the run.\nconst src = $('Prepare PDF " + tag + "').all(); const got = $input.all();\nreturn src.map((s, i) => { const g = got[i] || {}; const pdf = (g.binary && g.binary.pdf && !(g.json && g.json.error)) ? g.binary.pdf : null;\n  const name = String(s.json.file_name || 'report.html').replace(/\\.html?$/i, '') + '.pdf'; const binary = { ...(s.binary || {}) }; delete binary.html;\n  if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };\n  return { json: { ...s.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null }, binary }; });", [x + 440, y])
    def deliver(self, tag, pos, attach_expr):
        x, y = pos
        self.iff('Has Email (' + tag + ')?', '{{ !!$json.email }}', [x, y])
        self.node('Send ' + tag + ' Report', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False, **({'fileAttachments': attach_expr} if attach_expr else {})}}, [x + 220, y], credentials=SMTP, onError='continueRegularOutput', retryOnFail=True, maxTries=3, waitBetweenTries=5000)
        self.iff('Has Callback (' + tag + ')?', '{{ !!$json.callback_url }}', [x + 220, y + 200])
        self.node('POST ' + tag + ' Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json) }}', 'options': {'timeout': 30000}}, [x + 440, y + 200], onError='continueRegularOutput')
        self.link('Has Email (' + tag + ')?', 'Send ' + tag + ' Report'); self.link('Has Callback (' + tag + ')?', 'POST ' + tag + ' Report')
    def sticky(self, content, pos, w, h, color=5): return self.node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': content, 'height': h, 'width': w, 'color': color}, pos)
    def link(self, a, b, out=0):
        outs = self.C.setdefault(a, {}).setdefault('main', [])
        while len(outs) <= out: outs.append([])
        outs[out].append({'node': b, 'type': 'main', 'index': 0})
    def chain(self, *names):
        for a, b in zip(names, names[1:]): self.link(a, b)
    def write(self, fname):
        names = {n['name'] for n in self.N}; assert len(names) == len(self.N), 'duplicate node names in ' + fname
        for s, outs in self.C.items():
            assert s in names, s
            for lists in outs.values():
                for lst in lists:
                    for t in lst: assert t['node'] in names, t['node']
        for n in self.N:   # every DataForSEO node and model node carries its credential
            if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'genericCredentialType': assert n.get('credentials'), n['name']
            if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': assert n.get('credentials'), n['name']
            if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'predefinedCredentialType': assert n.get('credentials'), n['name']
        w = {'id': self.wid, 'name': self.name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': self.timeout, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'}, 'tags': [], 'nodes': self.N, 'connections': self.C}
        json.dump([w], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
        os.makedirs(CODE, exist_ok=True)
        for n in self.N:
            if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, self.code_prefix + re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
        print('wrote', fname + ':', len(self.N), 'nodes')
at = lambda c, r: [c * 220, r * 220]
TRIGGER = lambda w, hour, minute: w.node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': hour, 'triggerAtMinute': minute}]}}, at(0, 0))

# =============================================================================
# 1. AI VISIBILITY TRACKER (v4.5; v4.9: bigger panel with stages / clusters / demand, daily pulse samples, Answer Analyst, GA4 revenue, crawler access, market-wide index)
# =============================================================================
A = WF('SEOagentAIVisib1', 'SEO Agent — AI Visibility Tracker', 'aivis', 3600)
TRIGGER(A, 7, 0); A.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Prompts Table', AI_PROMPTS_TABLE, AI_PROMPTS_COLS), ('Ensure AI Answers Table', AI_ANSWERS_TABLE, AI_ANSWERS_COLS), ('Ensure AI Visibility Table', AI_VIS_TABLE, AI_VIS_COLS),
       ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure AI Daily Table', AI_DAILY_TABLE, AI_DAILY_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): A.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE), ('Load AI Visibility', AI_VIS_TABLE), ('Load Link Prospects', PROSPECT_TABLE)]
for i, (nm, t) in enumerate(loads): A.load(nm, t, at(1 + i, 1))
SINCE = lambda days: '={{ new Date(Date.now() - ' + str(days) + ' * 864e5).toISOString() }}'
A.node('Load AI Daily', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_DAILY_TABLE, [('checked_at', 'gte', SINCE(15))]), at(8, 1), **LOAD)
A.node('Load Cache (AI)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(9, 1), **LOAD)
A.node('Load Query History', DT_TYPE, DT_VERSION, dt_get_all_where_params(QUERY_TABLE, [('checked_at', 'gte', SINCE(35))]), at(10, 1), **LOAD)
loads += [('Load AI Daily', None), ('Load Cache (AI)', None), ('Load Query History', None)]
A.code('AI Plan', 'AI_Plan.js', at(11, 1)); A.iff('Any Sites (AI)?', '{{ !$json.nothing_to_do }}', at(12, 1)); A.node('Nothing To Do (AI)', 'n8n-nodes-base.noOp', 1, {}, at(13, 2))
A.code('Site Text Jobs', 'Site_Text_Jobs.js', at(13, -2)); A.iff('Need Site Text?', '{{ !$json.skip }}', at(14, -2))
A.node('Read Site (AI)', 'n8n-nodes-base.httpRequest', 4.5, {'url': '=https://r.jina.ai/https://{{ $json.domain }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'X-Retain-Images', 'value': 'none'}]}, 'options': {'response': {'response': {'responseFormat': 'text', 'outputPropertyName': 'site_text'}}, 'timeout': 30000}}, at(15, -3), credentials={'httpHeaderAuth': {'id': 'SEOcredJinaReade', 'name': 'Jina Reader'}}, onError='continueRegularOutput')
A.code('Discovery Requests', 'Discovery_Requests.js', at(16, -2)); A.iff('Any Discovery?', '{{ !$json.skip }}', at(17, -2)); A.dfs_http('Run Discovery', at(18, -3), batch=4, interval=300, timeout=120000)
A.code('Prompt Jobs', 'Prompt_Jobs.js', at(19, -2)); A.iff('Any Prompt Jobs?', '{{ !$json.skip }}', at(20, -2))
A.agent('Prompt Writer', 'ai_prompts.txt', {'type': 'object', 'properties': {'prompts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prompt': {'type': 'string'}, 'kind': {'type': 'string'}, 'stage': {'type': 'string'}, 'cluster': {'type': 'string'}, 'keyword': {'type': 'string'}, 'origin': {'type': 'string'}}, 'required': ['prompt']}}}, 'required': ['prompts']}, at(21, -3))
A.code('Prompt Rows', 'Prompt_Rows.js', at(22, -2)); A.iff('Any Prompt Rows?', '{{ !$json.skip }}', at(23, -2))
A.node('Save Prompts', DT_TYPE, DT_VERSION, dt_upsert_params(AI_PROMPTS_TABLE, AI_PROMPTS_COLS, 'prompt_id'), at(24, -3), onError='continueRegularOutput')
A.code('Traffic Requests', 'Traffic_Requests.js', at(13, 0)); A.iff('Any GA4 (AI)?', '{{ !$json.skip }}', at(14, 0))
A.node('GA4 AI Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.url }}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}, at(15, -1), credentials=GOOGLE, **HTTP_X)
A.code('Access Requests', 'Access_Requests.js', at(16, 0)); A.iff('Any Access?', '{{ !$json.skip }}', at(17, 0))
A.node('Fetch Access', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': '={{ $json.ua }}'}, {'name': 'Accept', 'value': 'text/html,text/plain,*/*'}]},
    'options': {'batching': {'batch': {'batchSize': 4, 'batchInterval': 200}}, 'timeout': 20000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, at(18, -1), onError='continueRegularOutput')
A.code('AI Access', 'AI_Access.js', at(19, 0))
A.code('AI Requests', 'AI_Requests.js', at(20, 0)); A.iff('Any AI Requests?', '{{ !$json.skip }}', at(21, 0))
A.dfs_http('Run AI Requests', at(22, -1), batch=10, interval=200, timeout=150000)
A.code('Parse AI Answers', 'Parse_AI_Answers.js', at(23, 0))
A.code('Analyst Jobs', 'Analyst_Jobs.js', at(24, 0)); A.iff('Any Analyst Jobs?', '{{ !$json.skip }}', at(25, 0))
A.agent('Answer Analyst', 'answer_analyst.txt', {'type': 'object', 'properties': {'answers': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'brands': {'type': 'array', 'items': {'type': 'object', 'properties': {'name': {'type': 'string'}, 'domain': {'type': 'string'}}, 'required': ['name']}}, 'sentiment': {'type': 'string'}, 'why': {'type': 'string'}, 'wrong': {'type': 'array', 'items': {'type': 'object', 'properties': {'claim': {'type': 'string'}, 'correct': {'type': 'string'}}, 'required': ['claim']}}}, 'required': ['n']}}, 'descriptors': ARR}, 'required': ['answers']}, at(26, -1))
A.code('Apply Analysis', 'Apply_Analysis.js', at(27, 0)); A.iff('Any Answer Rows?', '{{ !$json.skip }}', at(28, 0))
A.node('Save AI Answers', DT_TYPE, DT_VERSION, dt_insert_params(AI_ANSWERS_TABLE, AI_ANSWERS_COLS), at(29, -1), onError='continueRegularOutput')
A.code('AI Metrics', 'AI_Metrics.js', at(10, 3)); A.code('AI Vis Rows', 'AI_Vis_Rows.js', at(11, 3))
A.node('Save AI Visibility', DT_TYPE, DT_VERSION, dt_insert_params(AI_VIS_TABLE, AI_VIS_COLS), at(12, 3), onError='continueRegularOutput')
A.code('AI Prospect Rows', 'AI_Prospect_Rows.js', at(13, 3)); A.iff('Any AI Prospects?', '{{ !$json.skip }}', at(14, 3))
A.node('Save AI Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(15, 2), onError='continueRegularOutput')
A.code('AI Cache Rows', 'AI_Cache_Rows.js', at(16, 3)); A.iff('Any Cache Rows?', '{{ !$json.skip }}', at(17, 3))
A.node('Save AI Cache', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(18, 2), onError='continueRegularOutput')
A.node('Prune Old Answers', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_ANSWERS_TABLE, [('checked_at', 'lt', SINCE(400))]), at(19, 3), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
A.code('AI Brief Input', 'AI_Brief_Input.js', at(20, 3))
A.agent('AI Brief', 'ai_brief.txt', {'type': 'object', 'properties': {'headline': {'type': 'string'}, 'summary': {'type': 'string'}, 'actions': {'type': 'array', 'items': {'type': 'object', 'properties': {'priority': {'type': 'number'}, 'action': {'type': 'string'}, 'why': {'type': 'string'}}, 'required': ['action']}}, 'watch': ARR}, 'required': ['headline', 'summary', 'actions']}, at(21, 3))
A.code('AI Report', 'AI_Report.js', at(22, 3)); A.pdf_chain('AI', at(23, 3))
A.code('Build AI Callback', 'Build_AI_Callback.js', at(26, 4)); A.deliver('AI', at(26, 3), "={{ $binary.pdf ? 'pdf' : 'data' }}")
A.chain('Weekly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'AI Plan', 'Any Sites (AI)?'); A.link('Manual Run', ens[0][0])
A.link('Any Sites (AI)?', 'Site Text Jobs', 0); A.chain('Site Text Jobs', 'Need Site Text?'); A.link('Need Site Text?', 'Read Site (AI)', 0); A.link('Need Site Text?', 'Discovery Requests', 1); A.link('Read Site (AI)', 'Discovery Requests'); A.link('Any Sites (AI)?', 'Nothing To Do (AI)', 1)
A.chain('Discovery Requests', 'Any Discovery?'); A.link('Any Discovery?', 'Run Discovery', 0); A.link('Any Discovery?', 'Prompt Jobs', 1); A.link('Run Discovery', 'Prompt Jobs')
A.chain('Prompt Jobs', 'Any Prompt Jobs?'); A.link('Any Prompt Jobs?', 'Prompt Writer', 0); A.link('Any Prompt Jobs?', 'Prompt Rows', 1); A.link('Prompt Writer', 'Prompt Rows')
A.chain('Prompt Rows', 'Any Prompt Rows?'); A.link('Any Prompt Rows?', 'Save Prompts', 0); A.link('Any Prompt Rows?', 'Traffic Requests', 1); A.link('Save Prompts', 'Traffic Requests')
A.chain('Traffic Requests', 'Any GA4 (AI)?'); A.link('Any GA4 (AI)?', 'GA4 AI Report', 0); A.link('Any GA4 (AI)?', 'Access Requests', 1); A.link('GA4 AI Report', 'Access Requests')
A.chain('Access Requests', 'Any Access?'); A.link('Any Access?', 'Fetch Access', 0); A.link('Any Access?', 'AI Access', 1); A.link('Fetch Access', 'AI Access')
A.chain('AI Access', 'AI Requests', 'Any AI Requests?'); A.link('Any AI Requests?', 'Run AI Requests', 0); A.link('Any AI Requests?', 'Parse AI Answers', 1); A.link('Run AI Requests', 'Parse AI Answers')
A.chain('Parse AI Answers', 'Analyst Jobs', 'Any Analyst Jobs?'); A.link('Any Analyst Jobs?', 'Answer Analyst', 0); A.link('Any Analyst Jobs?', 'Apply Analysis', 1); A.link('Answer Analyst', 'Apply Analysis')
A.chain('Apply Analysis', 'Any Answer Rows?'); A.link('Any Answer Rows?', 'Save AI Answers', 0); A.link('Any Answer Rows?', 'AI Metrics', 1); A.link('Save AI Answers', 'AI Metrics')
A.chain('AI Metrics', 'AI Vis Rows', 'Save AI Visibility', 'AI Prospect Rows', 'Any AI Prospects?'); A.link('Any AI Prospects?', 'Save AI Prospects', 0); A.link('Any AI Prospects?', 'AI Cache Rows', 1); A.link('Save AI Prospects', 'AI Cache Rows')
A.chain('AI Cache Rows', 'Any Cache Rows?'); A.link('Any Cache Rows?', 'Save AI Cache', 0); A.link('Any Cache Rows?', 'Prune Old Answers', 1); A.link('Save AI Cache', 'Prune Old Answers')
A.chain('Prune Old Answers', 'AI Brief Input', 'AI Brief', 'AI Report', 'Prepare PDF AI', 'Render PDF AI', 'Attach PDF AI', 'Has Email (AI)?'); A.link('Attach PDF AI', 'Build AI Callback'); A.link('Build AI Callback', 'Has Callback (AI)?')
A.sticky(f"""## SEO Agent — AI Visibility Tracker (v4.5, v4.9)
**Every Monday 07:00** (before the Site Tracker, whose report shows the summary) and on demand (*Manual Run* `{{ domain | site_id, email?, callback_url?, country?, location_code?, competitors?, topics? }}`; form option "Check my AI visibility" / API `mode: ai_visibility`). The **AI Pulse** workflow asks the same panel every other day on the fast engines; this run adds its samples to the week's figures.
Per site (`seo_sites` + ladder domains; settings in `{MONITORS_TABLE}`: engines, questions (3-50, default 20), daily pulse, competitors, brand names): a stable **question panel** (`{AI_PROMPTS_TABLE}`: buyer stage, topic cluster, monthly AI search volume; written by Claude from the topics, **real questions from the AI-answer database** and the site's long Search Console queries; custom ones through Site Admin `ai_prompts`) is asked to **ChatGPT** and **Gemini** (the real chat interfaces, LLM scraper $0.004), **Perplexity** (sonar, localised, $0.006), **Google AI Mode** ($0.004) and the **AI Overview** of the matching search ($0.002); **Claude** (Haiku + web search, $0.025), the brand question, question discovery and the **market-wide index** (LLM Mentions: your share vs the competitors across the 387M-question database) on the month's first run.
*Answer Analyst* (Claude) reads the answers that matter: brands named in order (a competitor without a website counts; learned names in `{CACHE_TABLE}` `ai_brands:`), sentiment, **wrong claims** vs the business profile. *AI Metrics*: 7-day rates with **95% ranges** (weekly + pulse samples), changes tested for significance, **visibility score** (position + demand weighted), share of voice, stages / topics, fan-out searches, perception, **AI referral visits / key events / revenue** (GA4, service account), **AI crawler access** (robots.txt per bot, llms.txt, CDN block test), lost questions with demand and ready API bodies, alerts, actions → `{AI_VIS_TABLE}` (+ `ai_source` prospects) → Claude brief → report (e-mail + PDF + callback `stage: ai_visibility`). Answers older than 400 days are pruned.""", [-40, -1000], 1500, 460)
A.write('SEO_Agent_AI_Visibility.json')

# =============================================================================
# 1b. AI PULSE (v4.9): the question panel on the fast engines every day except Monday
# =============================================================================
Q = WF('SEOagentAIPulse1', 'SEO Agent — AI Pulse', 'aipulse', 2400, code_prefix='Pulse__')
Q.node('Daily Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': '30 6 * * 0,2-6'}]}}, at(0, 0))
Q.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Answers Table', AI_ANSWERS_TABLE, AI_ANSWERS_COLS), ('Ensure AI Daily Table', AI_DAILY_TABLE, AI_DAILY_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): Q.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE), ('Load AI Visibility', AI_VIS_TABLE)]
for i, (nm, t) in enumerate(loads): Q.load(nm, t, at(1 + i, 1))
Q.node('Load AI Daily', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_DAILY_TABLE, [('checked_at', 'gte', SINCE(15))]), at(7, 1), **LOAD)
Q.node('Load Cache (AI)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(8, 1), **LOAD)
Q.code('AI Plan', 'Pulse_Plan.js', at(9, 1)); Q.iff('Any Sites (Pulse)?', '{{ !$json.nothing_to_do }}', at(10, 1)); Q.node('Nothing To Do (Pulse)', 'n8n-nodes-base.noOp', 1, {}, at(11, 2))
Q.code('AI Requests', 'AI_Requests.js', at(11, 0)); Q.iff('Any AI Requests?', '{{ !$json.skip }}', at(12, 0))
Q.dfs_http('Run AI Requests', at(13, -1), batch=10, interval=200, timeout=150000)
Q.code('Parse AI Answers', 'Parse_AI_Answers.js', at(14, 0)); Q.code('Pulse Metrics', 'Pulse_Metrics.js', at(15, 0))
Q.code('Pulse Answer Rows', "// Today's answer rows for seo_ai_answers (run_kind pulse; exact columns, short excerpts; kept 35 days).\nconst rows = $('Pulse Metrics').all().flatMap(i => i.json.answer_rows || []);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(16, 0))
Q.iff('Any Pulse Answers?', '{{ !$json.skip }}', at(17, 0))
Q.node('Save AI Answers', DT_TYPE, DT_VERSION, dt_insert_params(AI_ANSWERS_TABLE, AI_ANSWERS_COLS), at(18, -1), onError='continueRegularOutput')
Q.code('AI Daily Rows', "// One seo_ai_daily row per site and day (upsert by site + date; exact columns). The weekly AI visibility run adds them to its figures.\nconst rows = $('Pulse Metrics').all().map(i => i.json.daily_row).filter(r => r && r.samples > 0);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(19, 0))
Q.iff('Any Daily Rows?', '{{ !$json.skip }}', at(20, 0))
Q.node('Save AI Daily', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_DAILY_TABLE, AI_DAILY_COLS, ['site_id', 'date']), at(21, -1), onError='continueRegularOutput')
Q.node('Prune Pulse Answers', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_ANSWERS_TABLE, [('run_kind', 'eq', 'pulse'), ('checked_at', 'lt', SINCE(35))]), at(22, 0), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
Q.code('Pulse Alerts', "// Sites with something to report (an alert, or an on-demand run): the e-mail and the callback (stage ai_pulse). Quiet days send nothing.\nconst out = $('Pulse Metrics').all().map(i => i.json).filter(m => (m.alerts || []).length || m.on_demand).map(m => { const { daily_row, answer_rows, ...rest } = m; return { json: rest }; });\nreturn out.length ? out : [{ json: { skip: true } }];", at(23, 0))
Q.iff('Any Pulse Alerts?', '{{ !$json.skip }}', at(24, 0)); Q.deliver('Pulse', at(25, -1), None)
Q.chain('Daily Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'Load AI Daily', 'Load Cache (AI)', 'AI Plan', 'Any Sites (Pulse)?'); Q.link('Manual Run', ens[0][0])
Q.link('Any Sites (Pulse)?', 'AI Requests', 0); Q.link('Any Sites (Pulse)?', 'Nothing To Do (Pulse)', 1)
Q.chain('AI Requests', 'Any AI Requests?'); Q.link('Any AI Requests?', 'Run AI Requests', 0); Q.link('Any AI Requests?', 'Parse AI Answers', 1); Q.link('Run AI Requests', 'Parse AI Answers')
Q.chain('Parse AI Answers', 'Pulse Metrics', 'Pulse Answer Rows', 'Any Pulse Answers?'); Q.link('Any Pulse Answers?', 'Save AI Answers', 0); Q.link('Any Pulse Answers?', 'AI Daily Rows', 1); Q.link('Save AI Answers', 'AI Daily Rows')
Q.chain('AI Daily Rows', 'Any Daily Rows?'); Q.link('Any Daily Rows?', 'Save AI Daily', 0); Q.link('Any Daily Rows?', 'Prune Pulse Answers', 1); Q.link('Save AI Daily', 'Prune Pulse Answers')
Q.chain('Prune Pulse Answers', 'Pulse Alerts', 'Any Pulse Alerts?'); Q.link('Any Pulse Alerts?', 'Has Email (Pulse)?', 0); Q.link('Any Pulse Alerts?', 'Has Callback (Pulse)?', 0)
Q.sticky(f"""## SEO Agent — AI Pulse (v4.9)
**Every day 06:30 except Monday** (cron `30 6 * * 0,2-6`; Monday's AI Visibility Tracker asks the same engines) and on demand (*Manual Run* `{{ domain | site_id, email?, callback_url? }}`). Per site with AI visibility and `ai_pulse` on (`{MONITORS_TABLE}`; default on): the whole question panel (`{AI_PROMPTS_TABLE}`, no brand question) on **ChatGPT** and **Gemini** (the real chat interfaces) and **Google AI Mode** — $0.004 each, about $0.24 a day for 20 questions. AI answers change from one ask to the next; seven samples a week per question and engine give rates with a narrow 95% range and catch a real change within a day.
Shares *AI Requests* and *Parse AI Answers* with the weekly tracker (same node names). *Pulse Metrics* → one `{AI_DAILY_TABLE}` row per site and day (counts per engine / question / competitor / source; the weekly report adds them) + the answers (`{AI_ANSWERS_TABLE}`, run_kind pulse, kept 35 days). **Alerts only when something really changed** (z-test at 99% vs the past week, a business suddenly named in 30%+ of answers, a question where you were named first for 3 days and are now missing) → e-mail + callback `stage: ai_pulse`. Quiet days send nothing.""", [-40, -560], 1300, 330)
Q.write('SEO_Agent_AI_Pulse.json')

# =============================================================================
# 2. BACKLINK MONITOR
# =============================================================================
B = WF('SEOagentBacklnk1', 'SEO Agent — Backlink Monitor', 'blmon', 3600)
TRIGGER(B, 7, 30); B.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Snapshots Table', BL_SNAP_TABLE, BL_SNAP_COLS), ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS),
       ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure Case Table', CASE_TABLE, CASE_COLS), ('Ensure Log Table', LOG_TABLE, LOG_COLS),
       ('Ensure Backlinks Table', LINKS_TABLE, LINKS_COLS), ('Ensure Link Imports Table', LINK_IMPORTS_TABLE, LINK_IMPORTS_COLS), ('Ensure Link Graph Table', LINK_GRAPH_TABLE, LINK_GRAPH_COLS)]
for i, (nm, t, c) in enumerate(ens): B.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Backlink Snapshots', BL_SNAP_TABLE), ('Load Link Prospects', PROSPECT_TABLE), ('Load Content Log', LOG_TABLE), ('Load Case Studies', CASE_TABLE),
         ('Load Backlinks', LINKS_TABLE), ('Load Link Imports', LINK_IMPORTS_TABLE), ('Load Link Graph', LINK_GRAPH_TABLE)]
for i, (nm, t) in enumerate(loads): B.load(nm, t, at(1 + i, 1))
B.code('BL Plan', 'BL_Plan.js', at(12, 1)); B.iff('Any Sites (BL)?', '{{ !$json.nothing_to_do }}', at(13, 1)); B.node('Nothing To Do (BL)', 'n8n-nodes-base.noOp', 1, {}, at(14, 2))
# DataForSEO (as before + v4.10 link details, anchors, most-linked pages, competitors' new links)
B.code('BL Requests', 'BL_Requests.js', at(14, 0)); B.dfs_http('Run BL Requests', at(15, 0), batch=4, interval=300, timeout=120000)
B.code('Gap Requests', 'Gap_Requests.js', at(16, 0)); B.iff('Any Gap?', '{{ !$json.skip }}', at(17, 0)); B.dfs_http('Run Gap Requests', at(18, -1), timeout=120000)
# v4.10 free sources (BACKLINKS_SPEC.md §3): Wikipedia, Hacker News, web search, GDELT news, Bing Webmaster Tools, GA4 referrals
BOT_UA = 'SEOAgentLinkMonitor/4.10 (' + BRAND + '; backlink monitor; mailto:' + OPS_EMAIL + ')'
BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
def get_http(name, pos, url='={{ $json.url }}', batch=1, interval=300, timeout=30000, headers=None, cred=None, text=False, out_prop=None, method='GET', body=None):
    params = {'method': method, 'url': url, 'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 10}},
        'response': {'response': ({'fullResponse': True, 'neverError': True, 'responseFormat': 'text'} if text else {'neverError': True, **({'responseFormat': 'text', 'outputPropertyName': out_prop} if out_prop else {})})}}}
    if headers: params.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    if body: params.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': body})
    extra = {}
    if cred: kind, cid, cname = cred; params.update({'authentication': 'genericCredentialType', 'genericAuthType': kind}); extra['credentials'] = {kind: {'id': cid, 'name': cname}}
    return B.node(name, 'n8n-nodes-base.httpRequest', 4.5, params, pos, onError='continueRegularOutput', **extra)
BING = ('httpQueryAuth', 'SEOcredBingWebm', 'Bing Webmaster API')
AHREFS = ('httpHeaderAuth', 'SEOcredAhrefsDR', 'Ahrefs (free Domain Rating)')
JINA = ('httpHeaderAuth', 'SEOcredJinaReade', 'Jina Reader')
B.code('Source Requests', 'Source_Requests.js', at(19, 0)); B.iff('Any Sources?', '{{ !$json.skip }}', at(20, 0)); get_http('Fetch Sources', at(21, -1), headers={'User-Agent': BOT_UA, 'Accept': 'application/json'})
B.code('News Requests', 'News_Requests.js', at(22, 0)); B.iff('Any News?', '{{ !$json.skip }}', at(23, 0)); get_http('Fetch News', at(24, -1), interval=5500, headers={'User-Agent': BOT_UA})
B.code('Bing Sites', 'Bing_Sites.js', at(25, 0)); B.iff('Any Bing Sites?', '{{ !$json.skip }}', at(26, 0)); get_http('Fetch Bing Sites', at(27, -1), cred=BING)
B.code('Bing Requests', 'Bing_Requests.js', at(28, 0)); B.iff('Any Bing?', '{{ !$json.skip }}', at(29, 0)); get_http('Fetch Bing Counts', at(30, -1), interval=400, cred=BING)
B.code('Bing Link Requests', 'Bing_Link_Requests.js', at(31, 0)); B.iff('Any Bing Links?', '{{ !$json.skip }}', at(32, 0)); get_http('Fetch Bing', at(33, -1), interval=400, cred=BING)
B.code('Referral Requests', 'Referral_Requests.js', at(34, 0)); B.iff('Any GA4 (BL)?', '{{ !$json.skip }}', at(35, 0))
B.node('GA4 Referrals', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.url }}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}, at(36, -1), credentials=GOOGLE, **HTTP_X)
# one list of referrers, the pages to check, the check itself (fetch + render), authority, the Link Analyst
B.code('Link Merge', 'Link_Merge.js', at(37, 0))
B.code('Locate Requests', 'Locate_Requests.js', at(38, 0)); B.iff('Any Locate?', '{{ !$json.skip }}', at(39, 0)); get_http('Fetch Locate', at(40, -1), batch=2, interval=500)
B.code('Verify Requests', 'Verify_Requests.js', at(41, 0)); B.iff('Any Verify?', '{{ !$json.skip }}', at(42, 0))
get_http('Fetch Linking Pages', at(43, -1), batch=8, interval=250, timeout=20000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8'})
B.code('Render Requests', 'Render_Requests.js', at(44, 0)); B.iff('Any Render?', '{{ !$json.skip }}', at(45, 0))
get_http('Render Pages', at(46, -1), url='={{ $json.render_url }}', batch=2, interval=500, timeout=60000, out_prop='data', cred=JINA, headers={'X-Return-Format': 'html', 'X-Timeout': '25'})
B.code('Verify Links', 'Verify_Links.js', at(47, 0))
B.code('Authority Requests', 'Authority_Requests.js', at(48, 0)); B.iff('Any Authority?', '{{ !$json.skip }}', at(49, 0)); B.dfs_http('Run Authority', at(50, -1), timeout=120000)
B.code('DR Requests', 'DR_Requests.js', at(51, 0)); B.iff('Any DR?', '{{ !$json.skip }}', at(52, 0)); get_http('Fetch DR', at(53, -1), method='POST', body='={{ JSON.stringify($json.body) }}', timeout=60000, cred=AHREFS)
B.code('Link Analyst Jobs', 'Link_Analyst_Jobs.js', at(54, 0)); B.iff('Any Link Analyst?', '{{ !$json.skip }}', at(55, 0))
B.agent('Link Analyst', 'link_analyst.txt', {'type': 'object', 'properties': {'links': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'type': {'type': 'string'}, 'relevance': {'type': 'number'}, 'note': {'type': 'string'}}, 'required': ['n', 'type']}}}, 'required': ['links']}, at(56, -1))
B.code('Parse Backlinks', 'Parse_Backlinks.js', at(57, 0))
# outreach: jobs (new drafts by score + follow-ups), contacts from the prospects' own pages, the writer, the pipeline
B.code('Outreach Jobs', 'Outreach_Jobs.js', at(58, 0)); B.code('Contact Requests', 'Contact_Requests.js', at(59, 0)); B.iff('Any Contacts?', '{{ !$json.skip }}', at(60, 0))
get_http('Fetch Contacts', at(61, -1), batch=6, interval=250, timeout=15000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,*/*;q=0.8'})
B.code('Outreach Input', 'Outreach_Input.js', at(62, 0)); B.iff('Any Outreach?', '{{ !$json.skip }}', at(63, 0))
B.agent('Outreach Writer', 'outreach.txt', {'type': 'object', 'properties': {'drafts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prospect_domain': {'type': 'string'}, 'followup': {'type': 'number'}, 'subject': {'type': 'string'}, 'body': {'type': 'string'}}, 'required': ['prospect_domain', 'body']}}}, 'required': ['drafts']}, at(64, -1))
B.code('Prospect Rows', 'Prospect_Rows.js', at(65, 0)); B.iff('Any Prospect Rows?', '{{ !$json.skip }}', at(66, 0))
B.node('Save Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(67, -1), onError='continueRegularOutput')
B.code('Ledger Rows', 'Ledger_Rows.js', at(68, 0)); B.iff('Any Ledger Rows?', '{{ !$json.skip }}', at(69, 0))
B.node('Save Backlinks', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LINKS_TABLE, LINKS_COLS, ['site_id', 'ref_domain']), at(70, -1), onError='continueRegularOutput')
B.code('BL Snapshot Rows', 'BL_Snapshot_Rows.js', at(14, 3)); B.node('Save BL Snapshot', DT_TYPE, DT_VERSION, dt_insert_params(BL_SNAP_TABLE, BL_SNAP_COLS), at(15, 3), onError='continueRegularOutput')
B.code('BL Report', 'BL_Report.js', at(16, 3)); B.pdf_chain('BL', at(17, 3))
B.code('Build BL Callback', 'Build_BL_Callback.js', at(20, 4)); B.deliver('BL', at(20, 3), "={{ ['pdf', 'prospects_csv', 'disavow_txt'].filter(k => $binary[k]).join(',') || 'data' }}")
B.chain('Weekly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'BL Plan', 'Any Sites (BL)?'); B.link('Manual Run', ens[0][0])
B.link('Any Sites (BL)?', 'BL Requests', 0); B.link('Any Sites (BL)?', 'Nothing To Do (BL)', 1)
def step(code, iff, http, nxt):   # code -> IF -> (http) -> next; the IF's false branch skips the request
    B.link(code, iff); B.link(iff, http, 0); B.link(iff, nxt, 1); B.link(http, nxt)
B.iff('Any BL Requests?', '{{ !$json.skip }}', at(15, 1))   # v4.10: none on a free-sources-only check
step('BL Requests', 'Any BL Requests?', 'Run BL Requests', 'Gap Requests')
step('Gap Requests', 'Any Gap?', 'Run Gap Requests', 'Source Requests')
step('Source Requests', 'Any Sources?', 'Fetch Sources', 'News Requests')
step('News Requests', 'Any News?', 'Fetch News', 'Bing Sites')
step('Bing Sites', 'Any Bing Sites?', 'Fetch Bing Sites', 'Bing Requests')
step('Bing Requests', 'Any Bing?', 'Fetch Bing Counts', 'Bing Link Requests')
step('Bing Link Requests', 'Any Bing Links?', 'Fetch Bing', 'Referral Requests')
step('Referral Requests', 'Any GA4 (BL)?', 'GA4 Referrals', 'Link Merge')
B.link('Link Merge', 'Locate Requests')
step('Locate Requests', 'Any Locate?', 'Fetch Locate', 'Verify Requests')
step('Verify Requests', 'Any Verify?', 'Fetch Linking Pages', 'Render Requests')
step('Render Requests', 'Any Render?', 'Render Pages', 'Verify Links')
B.link('Verify Links', 'Authority Requests')
step('Authority Requests', 'Any Authority?', 'Run Authority', 'DR Requests')
step('DR Requests', 'Any DR?', 'Fetch DR', 'Link Analyst Jobs')
step('Link Analyst Jobs', 'Any Link Analyst?', 'Link Analyst', 'Parse Backlinks')
B.chain('Parse Backlinks', 'Outreach Jobs', 'Contact Requests')
step('Contact Requests', 'Any Contacts?', 'Fetch Contacts', 'Outreach Input')
step('Outreach Input', 'Any Outreach?', 'Outreach Writer', 'Prospect Rows')
step('Prospect Rows', 'Any Prospect Rows?', 'Save Prospects', 'Ledger Rows')
step('Ledger Rows', 'Any Ledger Rows?', 'Save Backlinks', 'BL Snapshot Rows')
B.chain('BL Snapshot Rows', 'Save BL Snapshot', 'BL Report', 'Prepare PDF BL', 'Render PDF BL', 'Attach PDF BL', 'Has Email (BL)?'); B.link('Attach PDF BL', 'Build BL Callback'); B.link('Build BL Callback', 'Has Callback (BL)?')
B.sticky(f"""## SEO Agent — Backlink Monitor (v4.5; v4.10 every source merged + our own link check — BACKLINKS_SPEC.md)
**Every Monday 07:30**: a light watch (links lost / new since the last check, spam, the valuable links re-checked on their pages) that e-mails only when an **important link was lost** (two misses in a row) or spam arrived; the **first run of each month** is the full report. On demand: *Manual Run* `{{ domain | site_id, light?, email?, callback_url? }}`; form option "Check my backlinks" / API `mode: backlinks`.
**Sources**: DataForSEO Backlinks (summary, lost, new; full runs: referring domains, one link per domain with details, anchors, most-linked pages, broken, history, Content Analysis mentions, competitors' new links, the quarterly gap); **free**: Bing Webmaster Tools (GetUrlLinks; when SEO_BING_WEBMASTER_API_KEY is set: {'on' if BING_ON else 'off'}), the Search Console Links exports uploaded in the app (`{LINK_IMPORTS_TABLE}`), GA4 referrals (links that send visits), the Common Crawl web graph (`{LINK_GRAPH_TABLE}`, monthly linkgraph job), Wikipedia, Hacker News, GDELT news, web search (SearXNG: mentions, "best X" lists, `site:` lookups); Ahrefs Domain Rating (free key; {'on' if AHREFS_ON else 'off'}).
**Link check**: the linking pages are fetched (browser user agent; Jina renders bot-blocked / JavaScript pages): found / missing / gone / blocked, rel, placement, noindex, canonical. **Lost = two misses in a row**, with the reason. *Link Analyst* (Claude) labels the link type and relevance. Values per link: SEO / referral / brand. Ledger → `{LINKS_TABLE}` (changed rows only).
Prospects (`{PROSPECT_TABLE}`): lost / mention (checked on the page) / list / comp_new / gap (DataForSEO + Common Crawl) / reclaim / ai_source, scored value × likelihood; contacts from the prospects' own pages; first drafts (8 a month) + follow-ups after 7 and 14 days; **won** only when the link is found. Snapshot → `{BL_SNAP_TABLE}`. Report: e-mail + PDF + `prospects.csv` + `disavow-candidates.txt` (review only) + callback `stage: backlinks`.""", [-40, -760], 1500, 440)
B.write('SEO_Agent_Backlink_Monitor.json')

# =============================================================================
# 3. AUDIT SCHEDULER
# =============================================================================
S = WF('SEOagentAuditSc1', 'SEO Agent — Audit Scheduler', 'audsc', 900)
S.node('Monthly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': '0 6 1 * *'}]}}, at(0, 0))
S.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Audits Table', AUDITS_TABLE, AUDITS_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t_, c) in enumerate(ens): S.ensure(nm, t_, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Audits', AUDITS_TABLE)]
for i, (nm, t_) in enumerate(loads): S.load(nm, t_, at(1 + i, 1))
S.node('Load Cache (Audit)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'sitemap'), at(6, 1), **LOAD)
S.code('Audit Candidates', 'Audit_Candidates.js', at(7, 1)); S.iff('Any Candidates?', '{{ !$json.nothing_to_do }}', at(8, 1))
S.node('Fetch Sitemap (Schedule)', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.sitemap_url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.6)'}, {'name': 'Accept', 'value': 'application/xml,text/xml,*/*'}]},
    'options': {'timeout': 45000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, at(9, 0), onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=3000)
S.code('Audit Schedule Plan', 'Audit_Sched_Plan.js', at(10, 1))
S.code('Fingerprint Rows', "// The sitemap fingerprints to store (seo_cache, upsert by key; exact columns), for started and skipped sites alike.\nconst rows = $('Audit Schedule Plan').all().map(i => i.json.cache_row).filter(Boolean);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(11, 1))
S.iff('Any Fingerprints?', '{{ !$json.skip }}', at(12, 1))
S.node('Save Fingerprints', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(13, 0), onError='continueRegularOutput', alwaysOutputData=True)
S.code('Audits To Start', "// Only the audits that are due; the others are listed with the reason they were skipped.\nconst plan = $('Audit Schedule Plan').all().map(i => i.json); const due = plan.filter(p => p.run && p.body);\nreturn due.length ? due.map(p => ({ json: { body: p.body, domain: p.domain, why: p.why } })) : [{ json: { nothing_to_do: true, skipped: plan.map(p => p.domain + ': ' + p.why) } }];", at(14, 1))
S.iff('Any Audits Due?', '{{ !$json.nothing_to_do }}', at(15, 1))
S.node('Start Scheduled Audits', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(16, 0), onError='continueRegularOutput')
S.code('Audits Started', "// What was started (each audit delivers its own report, diff and fix pack) and what was skipped, with the reason.\nconst plan = $('Audit Schedule Plan').all().map(i => i.json);\nreturn [{ json: { started: plan.filter(p => p.run).map(p => p.domain + ': ' + p.why), skipped: plan.filter(p => !p.run).map(p => p.domain + ': ' + p.why), at: new Date().toISOString() } }];", at(17, 0))
S.node('Nothing Due', 'n8n-nodes-base.noOp', 1, {}, at(16, 2))
S.chain('Monthly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'Load Cache (Audit)', 'Audit Candidates', 'Any Candidates?'); S.link('Manual Run', ens[0][0])
S.link('Any Candidates?', 'Fetch Sitemap (Schedule)', 0); S.link('Any Candidates?', 'Nothing Due', 1)
S.chain('Fetch Sitemap (Schedule)', 'Audit Schedule Plan', 'Fingerprint Rows', 'Any Fingerprints?'); S.link('Any Fingerprints?', 'Save Fingerprints', 0); S.link('Any Fingerprints?', 'Audits To Start', 1); S.link('Save Fingerprints', 'Audits To Start')
S.chain('Audits To Start', 'Any Audits Due?'); S.link('Any Audits Due?', 'Start Scheduled Audits', 0); S.link('Any Audits Due?', 'Audits Started', 1); S.link('Start Scheduled Audits', 'Audits Started')
S.sticky(f"""## SEO Agent — Audit Scheduler (v4.6: no repeated audits)
**1st of every month, 06:00** (cron `0 6 1 * *`) and on demand (*Manual Run* `{{ domain | site_id }}` always audits). Per site with `audit_monthly` on (`{MONITORS_TABLE}`): the sitemap is read (free) and its fingerprint (URLs + lastmod dates, or the sitemap index entries) compared with the one stored at the last check (`{CACHE_TABLE}`, key `sitemap:<site>`). **Audit only when** the site changed, 60+ days passed since the last audit (safety net for theme / plugin / server changes a sitemap does not show), the site was never audited, or no sitemap (or an index without dates) is readable (then monthly as before). Unchanged sites are skipped — the weekly Site Tracker keeps watching indexing in Search Console. Started audits run as their own executions (internal key `audit:`), compare themselves with the previous audit and deliver the report with the **fix pack**.""", [-40, -420], 1150, 240)
S.write('SEO_Agent_Audit_Scheduler.json')
