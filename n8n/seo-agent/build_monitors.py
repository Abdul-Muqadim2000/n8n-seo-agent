#!/usr/bin/env python3
"""Builds the growth monitors (v4.5): SEO Agent — AI Visibility Tracker (weekly, Monday 07:00), SEO Agent — Backlink Monitor (weekly watch,
Monday 07:30, full report on the first run of each month) and SEO Agent — Audit Scheduler (monthly technical re-audit, 1st of the month 06:00).
All three read the sites from seo_sites + seo_ladders and their settings from seo_monitors, run on demand through *Manual Run*
({ domain | site_id, email?, callback_url?, country?, location_code?, competitors? }) and write their Code nodes to harness/code_v4."""
import json, os, re, uuid
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_upsert_params, dt_upsert_params_keys,
                           SITES_TABLE, SITES_COLS, LADDER_TABLE, LADDER_COLS, LOG_TABLE, LOG_COLS, PROFILE_TABLE, PROFILE_COLS, CASE_TABLE, CASE_COLS,
                           MONITORS_TABLE, MONITORS_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS, AI_ANSWERS_TABLE, AI_ANSWERS_COLS, AI_VIS_TABLE, AI_VIS_COLS,
                           BL_SNAP_TABLE, BL_SNAP_COLS, PROSPECT_TABLE, PROSPECT_COLS, AUDITS_TABLE, AUDITS_COLS)
from env_settings import SENDER
HERE = os.path.dirname(os.path.abspath(__file__)); V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
def src(p):   # a Code node source with the shared snippets inlined
    s = rd('code/' + p)
    s = s.replace('/*__MONITOR_SITES__*/', rd('code/_monitor_sites.js')).replace('/*__REPORT_KIT__*/', rd('code/_report_kit.js'))
    return s.replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL)
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
ANTHROPIC = {'anthropicApi': {'id': 'SEOcredAnthropic', 'name': 'Anthropic (SEO Agent)'}}
ARR = {'type': 'array', 'items': {'type': 'string'}}
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
HTTP_X = dict(onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=3000)

class WF:
    def __init__(self, wid, name, prefix, timeout):
        self.wid, self.name, self.prefix, self.timeout, self.N, self.C = wid, name, prefix, timeout, [], {}
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
        self.node('Send ' + tag + ' Report', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False, 'fileAttachments': attach_expr}}, [x + 220, y], credentials=SMTP, onError='continueRegularOutput', retryOnFail=True, maxTries=3, waitBetweenTries=5000)
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
        w = {'id': self.wid, 'name': self.name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': self.timeout, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'}, 'tags': [], 'nodes': self.N, 'connections': self.C}
        json.dump([w], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
        os.makedirs(CODE, exist_ok=True)
        for n in self.N:
            if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
        print('wrote', fname + ':', len(self.N), 'nodes')
at = lambda c, r: [c * 220, r * 220]
TRIGGER = lambda w, hour, minute: w.node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': hour, 'triggerAtMinute': minute}]}}, at(0, 0))

# =============================================================================
# 1. AI VISIBILITY TRACKER
# =============================================================================
A = WF('SEOagentAIVisib1', 'SEO Agent — AI Visibility Tracker', 'aivis', 3600)
TRIGGER(A, 7, 0); A.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Prompts Table', AI_PROMPTS_TABLE, AI_PROMPTS_COLS), ('Ensure AI Answers Table', AI_ANSWERS_TABLE, AI_ANSWERS_COLS), ('Ensure AI Visibility Table', AI_VIS_TABLE, AI_VIS_COLS),
       ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS)]
for i, (nm, t, c) in enumerate(ens): A.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE), ('Load AI Visibility', AI_VIS_TABLE), ('Load Link Prospects', PROSPECT_TABLE)]
for i, (nm, t) in enumerate(loads): A.load(nm, t, at(1 + i, 1))
A.code('AI Plan', 'AI_Plan.js', at(8, 1)); A.iff('Any Sites (AI)?', '{{ !$json.nothing_to_do }}', at(9, 1)); A.node('Nothing To Do (AI)', 'n8n-nodes-base.noOp', 1, {}, at(10, 2))
A.code('Site Text Jobs', 'Site_Text_Jobs.js', at(10, -2)); A.iff('Need Site Text?', '{{ !$json.skip }}', at(11, -2))
A.node('Read Site (AI)', 'n8n-nodes-base.httpRequest', 4.5, {'url': '=https://r.jina.ai/https://{{ $json.domain }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'X-Retain-Images', 'value': 'none'}]}, 'options': {'response': {'response': {'responseFormat': 'text', 'outputPropertyName': 'site_text'}}, 'timeout': 30000}}, at(12, -3), credentials={'httpHeaderAuth': {'id': 'SEOcredJinaReade', 'name': 'Jina Reader'}}, onError='continueRegularOutput')
A.code('Prompt Jobs', 'Prompt_Jobs.js', at(13, -2)); A.iff('Any Prompt Jobs?', '{{ !$json.skip }}', at(11, 0))
A.agent('Prompt Writer', 'ai_prompts.txt', {'type': 'object', 'properties': {'prompts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prompt': {'type': 'string'}, 'kind': {'type': 'string'}, 'topic': {'type': 'string'}, 'keyword': {'type': 'string'}}, 'required': ['prompt']}}}, 'required': ['prompts']}, at(12, -1))
A.code('Prompt Rows', 'Prompt_Rows.js', at(13, 0)); A.iff('Any New Prompts?', '{{ !$json.skip }}', at(14, 0))
A.node('Save Prompts', DT_TYPE, DT_VERSION, dt_insert_params(AI_PROMPTS_TABLE, AI_PROMPTS_COLS), at(15, -1), onError='continueRegularOutput')
A.code('AI Requests', 'AI_Requests.js', at(16, 0)); A.iff('Any AI Requests?', '{{ !$json.skip }}', at(17, 0))
A.dfs_http('Run AI Requests', at(18, -1), batch=6, interval=300, timeout=150000)
A.code('Parse AI Answers', 'Parse_AI_Answers.js', at(19, 0)); A.iff('Any Answer Rows?', '{{ !$json.skip }}', at(20, 0))
A.node('Save AI Answers', DT_TYPE, DT_VERSION, dt_insert_params(AI_ANSWERS_TABLE, AI_ANSWERS_COLS), at(21, -1), onError='continueRegularOutput')
A.code('AI Metrics', 'AI_Metrics.js', at(10, 3)); A.code('AI Vis Rows', 'AI_Vis_Rows.js', at(11, 3))
A.node('Save AI Visibility', DT_TYPE, DT_VERSION, dt_insert_params(AI_VIS_TABLE, AI_VIS_COLS), at(12, 3), onError='continueRegularOutput')
A.code('AI Prospect Rows', 'AI_Prospect_Rows.js', at(13, 3)); A.iff('Any AI Prospects?', '{{ !$json.skip }}', at(14, 3))
A.node('Save AI Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(15, 2), onError='continueRegularOutput')
A.code('AI Brief Input', 'AI_Brief_Input.js', at(16, 3))
A.agent('AI Brief', 'ai_brief.txt', {'type': 'object', 'properties': {'headline': {'type': 'string'}, 'summary': {'type': 'string'}, 'actions': {'type': 'array', 'items': {'type': 'object', 'properties': {'priority': {'type': 'number'}, 'action': {'type': 'string'}, 'why': {'type': 'string'}}, 'required': ['action']}}, 'watch': ARR}, 'required': ['headline', 'summary', 'actions']}, at(17, 3))
A.code('AI Report', 'AI_Report.js', at(18, 3)); A.pdf_chain('AI', at(19, 3))
A.code('Build AI Callback', 'Build_AI_Callback.js', at(22, 4)); A.deliver('AI', at(22, 3), "={{ $binary.pdf ? 'pdf' : 'data' }}")
A.chain('Weekly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'AI Plan', 'Any Sites (AI)?'); A.link('Manual Run', ens[0][0])
A.link('Any Sites (AI)?', 'Site Text Jobs', 0); A.chain('Site Text Jobs', 'Need Site Text?'); A.link('Need Site Text?', 'Read Site (AI)', 0); A.link('Need Site Text?', 'Prompt Jobs', 1); A.link('Read Site (AI)', 'Prompt Jobs'); A.link('Any Sites (AI)?', 'Nothing To Do (AI)', 1)
A.chain('Prompt Jobs', 'Any Prompt Jobs?'); A.link('Any Prompt Jobs?', 'Prompt Writer', 0); A.link('Any Prompt Jobs?', 'Prompt Rows', 1); A.link('Prompt Writer', 'Prompt Rows')
A.chain('Prompt Rows', 'Any New Prompts?'); A.link('Any New Prompts?', 'Save Prompts', 0); A.link('Any New Prompts?', 'AI Requests', 1); A.link('Save Prompts', 'AI Requests')
A.chain('AI Requests', 'Any AI Requests?'); A.link('Any AI Requests?', 'Run AI Requests', 0); A.link('Any AI Requests?', 'Parse AI Answers', 1); A.link('Run AI Requests', 'Parse AI Answers')
A.chain('Parse AI Answers', 'Any Answer Rows?'); A.link('Any Answer Rows?', 'Save AI Answers', 0); A.link('Any Answer Rows?', 'AI Metrics', 1); A.link('Save AI Answers', 'AI Metrics')
A.chain('AI Metrics', 'AI Vis Rows', 'Save AI Visibility', 'AI Prospect Rows', 'Any AI Prospects?'); A.link('Any AI Prospects?', 'Save AI Prospects', 0); A.link('Any AI Prospects?', 'AI Brief Input', 1); A.link('Save AI Prospects', 'AI Brief Input')
A.chain('AI Brief Input', 'AI Brief', 'AI Report', 'Prepare PDF AI', 'Render PDF AI', 'Attach PDF AI', 'Has Email (AI)?'); A.link('Attach PDF AI', 'Build AI Callback'); A.link('Build AI Callback', 'Has Callback (AI)?')
A.sticky(f"""## SEO Agent — AI Visibility Tracker (v4.5)
**Every Monday 07:00** (before the Site Tracker, whose report shows the summary) and on demand (*Manual Run* `{{ domain | site_id, email?, callback_url?, country?, location_code?, competitors? }}`; form option "Check my AI visibility" / API `mode: ai_visibility`).
Per site (`seo_sites` + ladder domains; settings in `{MONITORS_TABLE}`: engines, questions per site, competitors, brand names): a stable set of **buyer questions** (`{AI_PROMPTS_TABLE}`; written once by Claude, template fallback; custom ones through Site Admin `ai_prompts`) is asked to **ChatGPT** (the real chatgpt.com answer, LLM scraper $0.004), **Perplexity** (sonar $0.006), **Gemini** (with Google search $0.035), **Claude** (Haiku with web search $0.025), **Google AI Mode** ($0.004), and the matching Google search is checked for an **AI Overview** ($0.002). Monthly market view: DataForSEO LLM Mentions top domains for the main topic ($0.115). About $0.60 per site per week at 8 questions.
*Parse AI Answers* → one row per answer (`{AI_ANSWERS_TABLE}`: named? cited? rank among the businesses named, competitors, sources). *AI Metrics* → mention rate, citation rate, share of voice, rank, per engine, competitors (configured + detected), **sources AI relies on** (also written to `{PROSPECT_TABLE}` as `ai_source` prospects for the Backlink Monitor's outreach), your cited pages, **lost questions** with ready API bodies, week-over-week change, alerts → `{AI_VIS_TABLE}` → Claude brief → report (e-mail + PDF + callback `stage: ai_visibility`).""", [-40, -700], 1300, 380)
A.write('SEO_Agent_AI_Visibility.json')

# =============================================================================
# 2. BACKLINK MONITOR
# =============================================================================
B = WF('SEOagentBacklnk1', 'SEO Agent — Backlink Monitor', 'blmon', 2400)
TRIGGER(B, 7, 30); B.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Snapshots Table', BL_SNAP_TABLE, BL_SNAP_COLS), ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS),
       ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure Case Table', CASE_TABLE, CASE_COLS), ('Ensure Log Table', LOG_TABLE, LOG_COLS)]
for i, (nm, t, c) in enumerate(ens): B.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Backlink Snapshots', BL_SNAP_TABLE), ('Load Link Prospects', PROSPECT_TABLE), ('Load Content Log', LOG_TABLE), ('Load Case Studies', CASE_TABLE)]
for i, (nm, t) in enumerate(loads): B.load(nm, t, at(1 + i, 1))
B.code('BL Plan', 'BL_Plan.js', at(9, 1)); B.iff('Any Sites (BL)?', '{{ !$json.nothing_to_do }}', at(10, 1)); B.node('Nothing To Do (BL)', 'n8n-nodes-base.noOp', 1, {}, at(11, 2))
B.code('BL Requests', 'BL_Requests.js', at(11, 0)); B.dfs_http('Run BL Requests', at(12, 0), batch=4, interval=300, timeout=120000)
B.code('Gap Requests', 'Gap_Requests.js', at(13, 0)); B.iff('Any Gap?', '{{ !$json.skip }}', at(14, 0)); B.dfs_http('Run Gap Requests', at(15, -1), timeout=120000)
B.code('Parse Backlinks', 'Parse_Backlinks.js', at(16, 0)); B.code('Outreach Jobs', 'Outreach_Jobs.js', at(17, 0)); B.iff('Any Outreach?', '{{ !$json.skip }}', at(18, 0))
B.agent('Outreach Writer', 'outreach.txt', {'type': 'object', 'properties': {'drafts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prospect_domain': {'type': 'string'}, 'subject': {'type': 'string'}, 'body': {'type': 'string'}}, 'required': ['prospect_domain', 'body']}}}, 'required': ['drafts']}, at(19, -1))
B.code('Prospect Rows', 'Prospect_Rows.js', at(20, 0)); B.iff('Any Prospect Rows?', '{{ !$json.skip }}', at(21, 0))
B.node('Save Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(22, -1), onError='continueRegularOutput')
B.code('BL Snapshot Rows', 'BL_Snapshot_Rows.js', at(11, 3)); B.node('Save BL Snapshot', DT_TYPE, DT_VERSION, dt_insert_params(BL_SNAP_TABLE, BL_SNAP_COLS), at(12, 3), onError='continueRegularOutput')
B.code('BL Report', 'BL_Report.js', at(13, 3)); B.pdf_chain('BL', at(14, 3))
B.code('Build BL Callback', 'Build_BL_Callback.js', at(17, 4)); B.deliver('BL', at(17, 3), "={{ ['pdf', 'prospects_csv', 'disavow_txt'].filter(k => $binary[k]).join(',') || 'data' }}")
B.chain('Weekly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'BL Plan', 'Any Sites (BL)?'); B.link('Manual Run', ens[0][0])
B.link('Any Sites (BL)?', 'BL Requests', 0); B.link('Any Sites (BL)?', 'Nothing To Do (BL)', 1)
B.chain('BL Requests', 'Run BL Requests', 'Gap Requests', 'Any Gap?'); B.link('Any Gap?', 'Run Gap Requests', 0); B.link('Any Gap?', 'Parse Backlinks', 1); B.link('Run Gap Requests', 'Parse Backlinks')
B.chain('Parse Backlinks', 'Outreach Jobs', 'Any Outreach?'); B.link('Any Outreach?', 'Outreach Writer', 0); B.link('Any Outreach?', 'Prospect Rows', 1); B.link('Outreach Writer', 'Prospect Rows')
B.chain('Prospect Rows', 'Any Prospect Rows?'); B.link('Any Prospect Rows?', 'Save Prospects', 0); B.link('Any Prospect Rows?', 'BL Snapshot Rows', 1); B.link('Save Prospects', 'BL Snapshot Rows')
B.chain('BL Snapshot Rows', 'Save BL Snapshot', 'BL Report', 'Prepare PDF BL', 'Render PDF BL', 'Attach PDF BL', 'Has Email (BL)?'); B.link('Attach PDF BL', 'Build BL Callback'); B.link('Build BL Callback', 'Has Callback (BL)?')
B.sticky(f"""## SEO Agent — Backlink Monitor (v4.5)
**Every Monday 07:30**: a light watch (links lost / new since the last check, spam) that e-mails only when an **important link was lost** or spam arrived; the **first run of each month** is the full report. On demand: *Manual Run* `{{ domain | site_id, light?, email?, callback_url? }}`; form option "Check my backlinks" / API `mode: backlinks`.
DataForSEO Backlinks ($0.024 per request): summary, lost (`backlinks_status_type: lost`, `last_seen` since the last check), new (`first_seen` since), and on full runs: links to **broken pages** (`is_broken` → 301 suggestion), referring domains, 12-month history, **unlinked brand mentions** (Content Analysis), competitors once (Labs), the **link gap** (`domain_intersection`, `intersection_mode: partial`: links to a competitor, not to you). About $0.10 per site for a light run, $0.25-0.35 for a full one.
Prospects (`{PROSPECT_TABLE}`; types lost / mention / gap / reclaim + the AI Visibility Tracker's ai_source): merged with the stored pipeline (status kept; Site Admin `prospect` sets contacted / won / rejected), **won** set automatically when the site starts linking, **outreach drafts** by Claude for up to 8 new prospects a month. Snapshot per run → `{BL_SNAP_TABLE}`. Report: e-mail + PDF + `prospects.csv` + `disavow-candidates.txt` (review only) + callback `stage: backlinks`.""", [-40, -700], 1300, 380)
B.write('SEO_Agent_Backlink_Monitor.json')

# =============================================================================
# 3. AUDIT SCHEDULER
# =============================================================================
S = WF('SEOagentAuditSc1', 'SEO Agent — Audit Scheduler', 'audsc', 600)
S.node('Monthly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': '0 6 1 * *'}]}}, at(0, 0))
S.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Audits Table', AUDITS_TABLE, AUDITS_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS)]
for i, (nm, t, c) in enumerate(ens): S.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Audits', AUDITS_TABLE)]
for i, (nm, t) in enumerate(loads): S.load(nm, t, at(1 + i, 1))
S.code('Audit Schedule Plan', 'Audit_Sched_Plan.js', at(6, 1)); S.iff('Any Audits Due?', '{{ !$json.nothing_to_do }}', at(7, 1))
S.node('Start Scheduled Audits', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(8, 0), onError='continueRegularOutput')
S.code('Audits Started', "// What was started (each audit delivers its own report, diff and fix pack by e-mail / callback).\nconst plan = $('Audit Schedule Plan').all().map(i => i.json);\nreturn [{ json: { started: plan.map(p => p.domain), skipped: (plan[0] || {}).skipped || [], at: new Date().toISOString() } }];", at(9, 0))
S.node('Nothing Due', 'n8n-nodes-base.noOp', 1, {}, at(8, 2))
S.chain('Monthly Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'Audit Schedule Plan', 'Any Audits Due?'); S.link('Manual Run', ens[0][0])
S.link('Any Audits Due?', 'Start Scheduled Audits', 0); S.link('Any Audits Due?', 'Nothing Due', 1); S.link('Start Scheduled Audits', 'Audits Started')
S.sticky(f"""## SEO Agent — Audit Scheduler (v4.5)
**1st of every month, 06:00** (cron `0 6 1 * *`) and on demand (*Manual Run* `{{ domain | site_id }}`). For every site with `audit_monthly` on (`{MONITORS_TABLE}`; default on) and no audit in the last 25 days, it starts a **technical audit** in its own execution through API Entry (internal key `audit:`, crawl size / JavaScript rendering from the site's settings). Each audit compares itself with the site's previous audit (`{AUDITS_TABLE}` + `seo_audit_findings`: fixed / new / still open, score change) and delivers the report with the **fix pack** (robots.txt, llms.txt, redirect map, schema, internal links) by e-mail and/or callback.""", [-40, -400], 1100, 220)
S.write('SEO_Agent_Audit_Scheduler.json')
