#!/usr/bin/env python3
"""Builds the ladder extras: SEO Agent — Rank Tracker (weekly), SEO Agent — Publish to WordPress (optional, inactive),
SEO Agent — Test Runner (local testing only). Code nodes are also written to harness/code_v4 for the offline harness."""
import json, os, re, uuid, sys
from ladder_common import LADDER_TABLE, HISTORY_TABLE, LADDER_COLS, HISTORY_COLS, DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
nid = lambda name: str(uuid.uuid5(NS, 'extras:' + name))
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
from env_settings import SENDER, BRAND, OPS_EMAIL, SA_EMAIL   # from n8n/.env at build time (run apply_env.py after editing .env)

def wf(wid, name, nodes, conns, settings=None):
    return {'id': wid, 'name': name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 1800, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all', **(settings or {})}, 'tags': [], 'nodes': nodes, 'connections': conns}
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
        for lst in outs['main']:
            for t in lst: assert t['node'] in names, t['node']
    json.dump([wfobj], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
    os.makedirs(CODE, exist_ok=True)
    for n in wfobj['nodes']:
        if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
    print('wrote', fname + ':', len(wfobj['nodes']), 'nodes')

# =============================================================================
# 1. SEO Agent — Rank Tracker (weekly; recommend-only)
# =============================================================================
DFS_HTTP = {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 300}}, 'timeout': 90000}}
tracker_report = rd('code/Tracker_Report.js').replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL)
N = []; C = {}
N.append(node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': 8, 'triggerAtMinute': 0}]}}, [0, 0]))
N.append(node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, [0, 220]))
N.append(node('Ensure Ladder Table', DT_TYPE, DT_VERSION, dt_create_params(LADDER_TABLE, LADDER_COLS), [240, 100], onError='continueRegularOutput'))
N.append(node('Ensure History Table', DT_TYPE, DT_VERSION, dt_create_params(HISTORY_TABLE, HISTORY_COLS), [460, 100], onError='continueRegularOutput'))
N.append(node('Load Ladders', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), [680, 100], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
N.append(node('Load History', DT_TYPE, DT_VERSION, dt_get_all_params(HISTORY_TABLE), [900, 100], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
N.append(code('Tracker Plan', rd('code/Tracker_Plan.js'), [1120, 100]))
N.append(iff('Any Checks?', '{{ !$json.nothing_to_do }}', [1340, 100]))
N.append(node('SERP Check', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP, [1560, 0], credentials=DFS, onError='continueRegularOutput', retryOnFail=True, maxTries=2, waitBetweenTries=3000))
N.append(code('Parse Positions', rd('code/Parse_Positions.js'), [1780, 0]))
N.append(node('Save History', DT_TYPE, DT_VERSION, dt_insert_params(HISTORY_TABLE, HISTORY_COLS), [2000, 0], onError='continueRegularOutput'))
N.append(code('Tracker Report', tracker_report, [2220, 0], executeOnce=True))
N.append(iff('Has Report?', '{{ !$json.nothing_to_do }}', [2440, 0]))
N.append(iff('Has Email (Tracker)?', '{{ !!$json.email }}', [2660, -100]))
N.append(node('Send Progress Email', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False}}, [2880, -100], credentials=SMTP, onError='continueRegularOutput'))
N.append(iff('Has Callback (Tracker)?', '{{ !!$json.callback_url }}', [2660, 120]))
N.append(node('POST Progress', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ JSON.stringify({ status: 'progress', stage: 'rank_tracker', request_id: $json.request_id || null, ladder_id: $json.ladder_id, domain: $json.domain, head_keyword: $json.head_keyword, checked_at: $json.checked_at, positions: $json.positions, rungs: $json.rungs, gains: $json.gains, drops: $json.drops, next_step: $json.next_step, api_body: $json.api_body, done: $json.done }) }}", 'options': {'timeout': 20000}}, [2880, 120], onError='continueRegularOutput'))
N.append(node('Nothing To Track', 'n8n-nodes-base.noOp', 1, {}, [1560, 260]))
N.append(sticky('Note', f"""## SEO Agent — Rank Tracker
Runs **weekly (Monday 08:00)** and on demand through *Manual Run* (Execute Workflow Trigger). Reads every ladder from the Data Table `{LADDER_TABLE}` (written by the ladder mode of SEO Agent v4; both tables are created on first use), checks the Google top 50 for each page's primary keyword and the head term (DataForSEO SERP live, about $0.015 per keyword; a 9-page ladder costs about $0.60 per month), appends `{HISTORY_TABLE}`, and sends one progress e-mail / callback per ladder: positions vs the previous check, rungs in the top 10 / top 3, drops of 5+ positions, and the **recommended next rung** with a form link and a ready-to-send API body (recommend-only mode).
Guardrails: at most 15 keywords per ladder and 120 checks per run; a ladder stops being tracked once its top page has held the top 3 for 4 consecutive checks.
Form: {FORM_URL} · API: {API_URL}""", [-40, -420], 900, 330))
for a, b in [('Weekly Schedule', 'Ensure Ladder Table'), ('Manual Run', 'Ensure Ladder Table'), ('Ensure Ladder Table', 'Ensure History Table'), ('Ensure History Table', 'Load Ladders'), ('Load Ladders', 'Load History'), ('Load History', 'Tracker Plan'), ('Tracker Plan', 'Any Checks?'), ('SERP Check', 'Parse Positions'), ('Parse Positions', 'Save History'), ('Save History', 'Tracker Report'), ('Tracker Report', 'Has Report?')]:
    link(C, a, b)
link(C, 'Any Checks?', 'SERP Check', 0); link(C, 'Any Checks?', 'Nothing To Track', 1)
link(C, 'Has Report?', 'Has Email (Tracker)?', 0); link(C, 'Has Report?', 'Has Callback (Tracker)?', 0)
link(C, 'Has Email (Tracker)?', 'Send Progress Email', 0); link(C, 'Has Callback (Tracker)?', 'POST Progress', 0)
write(wf('SEOagentTracker1', 'SEO Agent — Rank Tracker', N, C), 'SEO_Agent_Rank_Tracker.json')

# =============================================================================
# 2. SEO Agent — Publish to WordPress (optional; stays inactive, called through Execute Workflow)
# =============================================================================
N = []; C = {}
N.append(node('From Content Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, [0, 0]))
N.append(code('Build WP Draft', rd('code/Build_WP_Draft.js'), [240, 0]))
N.append(node('Create WP Draft', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': "={{ $json.wordpress_url + '/wp-json/wp/v2/posts' }}", 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'wordpressApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.wp_payload) }}', 'options': {'timeout': 60000, 'response': {'response': {'neverError': True}}}}, [480, 0], credentials={'wordpressApi': {'id': 'SEOcredWordPress', 'name': 'WordPress (SEO Agent)'}}, onError='continueRegularOutput'))
N.append(code('WP Result', """// Normalised result of the draft creation (inspect it in the execution; nothing else depends on it).
const r = $input.first().json || {};
const src = $('Build WP Draft').first().json;
const ok = !!r.id && !r.error && !r.code;
return [{ json: { ok, post_id: r.id || null, link: r.link || null, status: r.status || null, slug: r.slug || null, edit_link: ok ? src.wordpress_url + '/wp-admin/post.php?post=' + r.id + '&action=edit' : null,
  error: ok ? null : String((r.error && (r.error.message || r.error)) || r.message || r.code || 'no post id returned').slice(0, 300), keyword: src.keyword, ladder_id: src.ladder_id, request_id: src.request_id } }];""", [720, 0]))
N.append(sticky('Note', """## SEO Agent — Publish to WordPress (optional)
Called by SEO Agent v4 after a page is finished when `CONFIG.wordpress_publish` is true **and** the request carries `wordpress_url` (API field; add a form field if needed). Creates a **draft** post through the WordPress REST API: title, slug, excerpt (meta description), HTML content with internal links, JSON-LD blocks, and Yoast / RankMath meta keys (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `rank_math_title`, `rank_math_description`; the plugin must expose them to the REST API, otherwise WordPress ignores the `meta` object silently).
Credential: **WordPress (SEO Agent)** (id SEOcredWordPress): site URL, username and an Application Password. The sub-workflow must be **published** (n8n 2.x refuses to execute unpublished sub-workflows).""", [-40, -300], 820, 240, 7))
for a, b in [('From Content Run', 'Build WP Draft'), ('Build WP Draft', 'Create WP Draft'), ('Create WP Draft', 'WP Result')]: link(C, a, b)
write(wf('SEOagentWordPres', 'SEO Agent — Publish to WordPress', N, C), 'SEO_Agent_Publish_WordPress.json')

# =============================================================================
# 3. SEO Agent — Test Runner (local testing: starts any SEO Agent workflow with a JSON body; own test key; delete when done)
# =============================================================================
N = []; C = {}
N.append(node('Test Webhook', 'n8n-nodes-base.webhook', 2, {'httpMethod': 'POST', 'path': 'seo-test-run', 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {}}, [0, 0], webhookId='3f1c8e2a-5b7d-5c4e-9a1f-7e2d4b6c8a01', credentials={'httpHeaderAuth': {'id': 'SEOcredApiTest01', 'name': 'SEO API Key (test)'}}))
N.append(code('Route Test', """// body.workflow picks the target (default: SEO Agent v4); the rest of the body is forwarded like the API does.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object') ? raw.body : {};
const target = String(b.workflow || 'SEOagentV4Full01');
const request_id = String(b.request_id || $execution.id);
return [{ json: { target, request_id, forward: { headers: raw.headers || {}, body: { ...b, workflow: undefined, request_id, client_ip: 'test-runner' } } } }];""", [240, 0]))
N.append(node('Respond Started', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ status: 'started', target: $json.target, request_id: $json.request_id }) }}", 'options': {'responseCode': 202}}, [480, 0]))
N.append(code('Prepare Forward', 'return [{ json: $input.first().json.forward }];', [720, 0]))
N.append(node('Run Target', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': "={{ $('Route Test').first().json.target }}"}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [960, 0]))
N.append(sticky('Note', """## SEO Agent — Test Runner (testing only)
`POST /webhook/seo-test-run` with header `X-API-Key` = credential **SEO API Key (test)**. Body: the normal API body plus optional `workflow` (default SEOagentV4Full01; `SEOagentTracker1` runs the rank tracker now). Answers 202 and starts the target in the background. It bypasses the API front door's Quick Validate on purpose. **Deactivate or delete after testing.**""", [-40, -260], 760, 200, 3))
for a, b in [('Test Webhook', 'Route Test'), ('Route Test', 'Respond Started'), ('Respond Started', 'Prepare Forward'), ('Prepare Forward', 'Run Target')]: link(C, a, b)
write(wf('SEOagentTestRun1', 'SEO Agent — Test Runner', N, C, {'errorWorkflow': 'SEOagentErrHandl'}), 'SEO_Agent_Test_Runner.json')
