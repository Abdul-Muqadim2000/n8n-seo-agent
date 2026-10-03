import json, uuid
nid = lambda: str(uuid.uuid4())
webhook = {"httpMethod": "POST", "path": "seo-keyword-check", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
QV = r"""// Fast validation so callers get an immediate, useful 400. The full validation happens again in the main workflow.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const hdr = raw.headers || {};
const client_ip = String(hdr['x-forwarded-for'] || hdr['x-real-ip'] || hdr['cf-connecting-ip'] || '').split(',')[0].trim();
const errors = [];
const mode = String(b.mode || 'keyword').toLowerCase();
if (!['keyword', 'verdict', 'check', 'audit', 'discover', 'describe', 'ladder', 'track', 'published', 'checkin', 'profile', 'case_study', 'ai_visibility', 'backlinks'].includes(mode)) errors.push('mode must be one of: keyword, verdict, audit, discover, describe, ladder, track, published, checkin, profile, case_study, ai_visibility, backlinks');
if (['keyword', 'verdict', 'check', 'ladder'].includes(mode) && !b.keyword) errors.push('keyword is required');
if (['audit', 'describe', 'ladder', 'track', 'published', 'checkin', 'profile', 'case_study', 'ai_visibility', 'backlinks'].includes(mode) && !b.domain) errors.push('domain is required');
if (b.crawl_pages != null && !(Number(b.crawl_pages) >= 50 && Number(b.crawl_pages) <= 1000)) errors.push('crawl_pages must be between 50 and 1000');
if (b.crawl_js && Number(b.crawl_pages || 200) > 500) errors.push('crawl_js (JavaScript rendering) allows at most 500 crawl_pages');
if (b.competitors != null && !Array.isArray(b.competitors) && typeof b.competitors !== 'string') errors.push('competitors must be an array of domains or a comma-separated string');
if (b.monitors != null && (typeof b.monitors !== 'object' || Array.isArray(b.monitors))) errors.push('monitors must be an object');
const cs = (b.case_study && typeof b.case_study === 'object') ? b.case_study : null;
if (mode === 'case_study' && !(cs && cs.challenge && (cs.solution || cs.what_we_did) && cs.results)) errors.push('case_study.challenge, case_study.solution and case_study.results are required');
if (mode === 'case_study' && !b.keyword && !(cs && cs.service)) errors.push('case_study.service (or keyword) is required');
if (mode === 'profile' && !((b.author && b.author.name) || b.business_name || b.street_address || (b.address && b.address.street) || b.phone || (b.reviewer && b.reviewer.name))) errors.push('profile needs at least author.name or the business details (business_name, address, phone)');
if (b.video != null && !(b.video && /^https?:\/\/\S+$/i.test(String(b.video.url || '')))) errors.push('video.url (https://...) is required when video is given');
if (b.video_url != null && !/^https?:\/\/\S+$/i.test(String(b.video_url))) errors.push('video_url must be a full https:// link');
if (mode === 'track' && b.blogs_per_week != null && !(Number(b.blogs_per_week) >= 0 && Number(b.blogs_per_week) <= 3)) errors.push('blogs_per_week must be 0, 1, 2 or 3');
if (mode === 'published' && !/^https?:\/\/\S+$/i.test(String(b.published_url || b.url || ''))) errors.push('published_url (https://...) is required');
if (mode === 'published' && !b.keyword && !b.content_request_id) errors.push('keyword or content_request_id is required');
if (mode === 'track' && b.keywords != null && !Array.isArray(b.keywords) && typeof b.keywords !== 'string') errors.push('keywords must be an array of strings or a comma-separated string');
if (mode === 'ladder' && b.pages_now != null && !(Number(b.pages_now) >= 1 && Number(b.pages_now) <= 3)) errors.push('pages_now must be 1, 2 or 3');
if (mode === 'discover' && !b.business && !b.domain) errors.push('business or domain is required');
if (!['describe', 'profile'].includes(mode) && !b.country) errors.push('country is required (name or ISO-2 code)');
if (!b.callback_url && !b.email) errors.push('callback_url (https) or email is required so the result can be delivered');
if (b.callback_url && !/^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/\S*)$/.test(String(b.callback_url))) errors.push('callback_url must be an https URL (http only for localhost while testing)');
const request_id = $execution.id;
const eta = mode === 'audit' ? 20 : (['verdict', 'check'].includes(mode) ? 4 : mode === 'ladder' ? 8 : mode === 'track' ? 3 : mode === 'published' || mode === 'checkin' || mode === 'profile' ? 1 : mode === 'case_study' ? 15 : mode === 'ai_visibility' ? 10 : mode === 'backlinks' ? 5 : 10);
return [{ json: {
  ok: errors.length === 0, error: errors.join('; '), request_id, mode, keyword: b.keyword || null, domain: b.domain || null, country: b.country || null,
  delivery: b.callback_url ? 'POST to callback_url when finished' : 'email when finished', estimated_minutes: eta,
  forward: { ...raw, body: { ...b, request_id, client_ip } }
} }];"""
wf = {"id": "SEOagentAPIentry", "name": "SEO Agent — API", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl"}, "tags": [],
 "nodes": [
  {"parameters": webhook, "id": nid(), "name": "Webhook Trigger", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "webhookId": "67a01e9b-0eb4-54ad-863e-005660fbaac7", "credentials": {"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}},
  {"parameters": {"jsCode": QV}, "id": nid(), "name": "Quick Validate", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
  {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3}, "conditions": [{"id": nid(), "leftValue": "={{ $json.ok }}", "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}], "combinator": "and"}, "looseTypeValidation": True, "options": {}}, "id": nid(), "name": "Valid?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [480, 0]},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ status: 'accepted', request_id: $json.request_id, mode: $json.mode, keyword: $json.keyword, domain: $json.domain, country: $json.country, delivery: $json.delivery, estimated_minutes: $json.estimated_minutes }) }}", "options": {"responseCode": 202}}, "id": nid(), "name": "Respond Accepted", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [720, -100]},
  {"parameters": {"jsCode": "return [{ json: $input.first().json.forward }];"}, "id": nid(), "name": "Prepare Payload", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [960, -100]},
  {"parameters": {"source": "database", "workflowId": {"__rl": True, "mode": "id", "value": "SEOagentV4Full01"}, "mode": "once", "options": {"waitForSubWorkflow": False}}, "id": nid(), "name": "Start SEO Run", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [1200, -100]},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ status: 'rejected', request_id: $json.request_id, error: $json.error }) }}", "options": {"responseCode": 400}}, "id": nid(), "name": "Respond Bad Request", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [720, 120]},
  {"parameters": {"content": "## SEO Agent — API front door\n`POST /webhook/seo-keyword-check` (header auth: credential **SEO API Key**, header `X-API-Key`).\n\nBody: `mode` (keyword | verdict | audit | discover | describe | **ladder** | **track** | **published** | **checkin**), `keyword`, `country` (name or ISO-2), `domain`, `business`, `customers`, `page_type`, `competitors`, `email`, `callback_url` (https). Ladder: `pages_now` (1-3, pages written now). Track: `domain`, optional `keywords` (array, up to 20), `ga4_property_id`, `blogs_per_week` (0-3, written every Monday by the Content Cadence and delivered as HTML + Markdown + meta.json in the `content` callback); answers `stage: site_tracker_setup`, then one `stage: site_tracker` callback per weekly report (Search Console, GA4, trends, live checks, actions, PDF) and `stage: content_cadence` notes. Published: `domain`, `published_url`, `keyword` or `content_request_id` → `stage: published` (live publish check, link suggestions, stored). Check-in: `domain`, `manual_action`, `security_issue` (booleans), optional `notes` and `pages_csv` (the Search Console Pages export as text) → `stage: console_checkin`. Profile (v4.4): `domain`, `author` {name, job_title, credentials, bio, url, same_as[], image_url, knows_about[]}, `reviewer` {name, job_title, url}, `business_name`, `business_type`, `address` {street, city, region, postal_code, country}, `phone`, `public_email`, `opening_hours` ('Mo-Fr 09:00-18:00'), `service_areas`, `map_url`, `logo_url` → `stage: profile` (empty fields keep the stored value, '-' clears). Case study: `domain`, `country`, `case_study` {client_name, client_public, industry, location, service, challenge, solution, timeline, results, quote, quote_by}, optional `keyword` → `stage: case_study_started`, then the page as a `content` callback. AI visibility / backlinks (v4.5): `domain`, `country`, optional `competitors` → `stage: ai_visibility_started` / `backlinks_started`, then the report as `stage: ai_visibility` / `backlinks`. Track: optional `competitors` and `monitors` {ai_visibility, ai_engines, ai_prompts_max, backlinks, audit_monthly, audit_pages, audit_js, brand_names}. Audit: optional `crawl_pages` (50-1000) and `crawl_js` (JavaScript rendering, max 500 pages); the callback carries `audit_diff`, `internal_links`, `entity` and `fix_pack`. Keyword runs also take `page_type` 'Pillar Page' / 'Local Page' (+ `local_area`) / 'Case Study', `video` {url, transcript, title, upload_date, duration, placement} or `video_url` + `video_transcript`, and an `author` / `reviewer` override. Optional everywhere: `wordpress_url` (draft publishing when enabled). Ladder callbacks: stage `ladder_plan` (plan JSON + PDF/Word), then one `content` callback per page with `ladder_id` and `ladder_rung`; the Rank Tracker later POSTs `stage: rank_tracker` progress.\n\nAnswers **202** `{status:'accepted', request_id, …}` at once and starts **SEO Agent v4** in the background (Execute Workflow, no wait). The finished result (verdict, keyword data, PDF + Word file as base64, run_ledger) is POSTed to `callback_url` with the same `request_id`, and/or emailed. Malformed requests get **400**; requests rejected later in the main run are POSTed as `{status:'rejected'}`.\n\nWhy separate: n8n rejects Respond-to-Webhook nodes downstream of a Form Trigger, and the main workflow is form-driven.", "height": 460, "width": 700, "color": 4}, "id": nid(), "name": "Note", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-40, -480]}
 ],
 "connections": {
  "Webhook Trigger": {"main": [[{"node": "Quick Validate", "type": "main", "index": 0}]]},
  "Quick Validate": {"main": [[{"node": "Valid?", "type": "main", "index": 0}]]},
  "Valid?": {"main": [[{"node": "Respond Accepted", "type": "main", "index": 0}], [{"node": "Respond Bad Request", "type": "main", "index": 0}]]},
  "Respond Accepted": {"main": [[{"node": "Prepare Payload", "type": "main", "index": 0}]]},
  "Prepare Payload": {"main": [[{"node": "Start SEO Run", "type": "main", "index": 0}]]}
 }}
import os
_here = os.path.dirname(os.path.abspath(__file__))
_out = os.path.join(_here, 'workflows', 'SEO_Agent_API.json') if os.path.isdir(os.path.join(_here, 'workflows')) else 'SEO_Agent_API.json'
json.dump([wf], open(_out, 'w'), indent=2, ensure_ascii=False)
print('API workflow written:', len(wf['nodes']), 'nodes')
# the harness runs Quick Validate too (scenario S23: the web app's request bodies)
_code = os.path.join(_here, 'harness', 'code_v4')
if os.path.isdir(_code):
    open(os.path.join(_code, 'Quick_Validate.js'), 'w').write(QV)

# =============================================================================
# SEO Agent — Admin API (v4.7, 2026-10-03): the web app's door to Site Admin. POST /webhook/seo-site-admin (same header credential as the
# API front door) with { action, site_id | domain, ... } runs the Site Admin sub-workflow, waits, and answers with its result (affected rows).
# =============================================================================
AV = r"""// Same rules as Admin Action (Site Admin), answered as a 400 instead of a failed execution.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const action = String(b.action || '').toLowerCase();
const errors = [];
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts'].includes(action)) errors.push('action must be delete, pause, resume, cadence, unpublish, monitors, prospect or ai_prompts');
if (!b.site_id && !b.domain) errors.push('site_id or domain is required');
if (action === 'cadence' && b.pages_per_week == null && b.blogs_per_week == null) errors.push('pages_per_week (0-3) is required for action cadence');
if (action === 'unpublish' && !b.keyword) errors.push('keyword is required for action unpublish');
if (action === 'prospect' && !b.prospect_domain) errors.push('prospect_domain is required for action prospect');
if (action === 'prospect' && b.status && !['new', 'contacted', 'won', 'rejected', 'ignored'].includes(String(b.status).toLowerCase())) errors.push('status must be new, contacted, won, rejected or ignored');
if (action === 'ai_prompts' && !(Array.isArray(b.add) && b.add.length) && !(Array.isArray(b.remove) && b.remove.length)) errors.push('add (questions to track) or remove (prompt ids or texts) is required for action ai_prompts');
return [{ json: { ok: errors.length === 0, error: errors.join('; '), action, forward: { ...b, action, request_id: String(b.request_id || ('admin-' + $execution.id)) } } }];"""
admin_hook = {"httpMethod": "POST", "path": "seo-site-admin", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
awf = {"id": "SEOagentAdminAPI", "name": "SEO Agent — Admin API", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl"}, "tags": [],
 "nodes": [
  {"parameters": admin_hook, "id": nid(), "name": "Admin Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "webhookId": "3f1d7c52-8a64-4e0b-9b7a-5c2e61d4a8f3", "credentials": {"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}},
  {"parameters": {"jsCode": AV}, "id": nid(), "name": "Admin Validate", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
  {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3}, "conditions": [{"id": nid(), "leftValue": "={{ $json.ok }}", "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}], "combinator": "and"}, "looseTypeValidation": True, "options": {}}, "id": nid(), "name": "Admin Valid?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [480, 0]},
  {"parameters": {"jsCode": "return [{ json: $input.first().json.forward }];"}, "id": nid(), "name": "Admin Payload", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [720, -100]},
  {"parameters": {"source": "database", "workflowId": {"__rl": True, "mode": "id", "value": "SEOagentSiteAdm1"}, "mode": "once", "options": {"waitForSubWorkflow": True}}, "id": nid(), "name": "Run Site Admin", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [960, -100], "onError": "continueErrorOutput"},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: !$json.error, action: $json.action, site_id: $json.site_id, domain: $json.domain, affected: Number($json.affected) || 0, error: $json.error || null }) }}", "options": {"responseCode": 200}}, "id": nid(), "name": "Respond Admin Result", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1200, -180]},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: false, action: $('Admin Validate').first().json.action, affected: 0, error: String(($json.error && ($json.error.message || $json.error)) || 'Site Admin failed').slice(0, 300) }) }}", "options": {"responseCode": 500}}, "id": nid(), "name": "Respond Admin Failed", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1200, 0]},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: false, action: $json.action, affected: 0, error: $json.error }) }}", "options": {"responseCode": 400}}, "id": nid(), "name": "Respond Admin Bad Request", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [720, 120]},
  {"parameters": {"content": "## SEO Agent — Admin API (v4.7)\n`POST /webhook/seo-site-admin` (header auth: credential **SEO API Key**, header `X-API-Key`). The web app (`app/`) manages tracked sites through it.\n\nBody: `{ action, site_id | domain, ... }` exactly as Site Admin takes it: `pause` / `resume` / `delete`, `cadence` + `pages_per_week`, `unpublish` + `keyword`, `monitors` (+ the monitor fields and `competitors`), `prospect` + `prospect_domain` + `status` / `note`, `ai_prompts` + `add` / `remove`.\n\nRuns Site Admin and **waits** (it takes about a second), then answers `200 { ok, action, site_id, affected, error }`; invalid bodies get **400**, a failing Site Admin **500**.", "height": 300, "width": 640, "color": 4}, "id": nid(), "name": "Note", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-40, -420]}
 ],
 "connections": {
  "Admin Webhook": {"main": [[{"node": "Admin Validate", "type": "main", "index": 0}]]},
  "Admin Validate": {"main": [[{"node": "Admin Valid?", "type": "main", "index": 0}]]},
  "Admin Valid?": {"main": [[{"node": "Admin Payload", "type": "main", "index": 0}], [{"node": "Respond Admin Bad Request", "type": "main", "index": 0}]]},
  "Admin Payload": {"main": [[{"node": "Run Site Admin", "type": "main", "index": 0}]]},
  "Run Site Admin": {"main": [[{"node": "Respond Admin Result", "type": "main", "index": 0}], [{"node": "Respond Admin Failed", "type": "main", "index": 0}]]}
 }}
_aout = os.path.join(os.path.dirname(_out), 'SEO_Agent_Admin_API.json')
json.dump([awf], open(_aout, 'w'), indent=2, ensure_ascii=False)
if os.path.isdir(_code):
    open(os.path.join(_code, 'Admin_Validate.js'), 'w').write(AV)
print('Admin API workflow written:', len(awf['nodes']), 'nodes')

# =============================================================================
# SEO Agent — Keyword Check (v4.8, 2026-10-03, PIPELINE_FEATURE_SPEC §5.2): POST /webhook/seo-keyword-assess (same header credential as the API
# front door), body { keyword, country, domain, business?, services?, existing_keywords? }. Synchronous like the Admin API: DataForSEO Labs (keyword
# overview, the site's position for the keyword, the site's reach when none is stored) in parallel, one small Claude Haiku call (topic fit,
# navigational / other brand, alternatives), then 200 { keyword, country, volume, kd, intent, cpc, position, reach, difficulty_for_you, plan_type,
# months, fit, navigational, alternatives, cost_usd, ... } — or 400 (field errors), 429 (daily limit), 502 (DataForSEO). Reach rules, country list
# and domain rules are the same code as the main workflow's (inlined below).
# =============================================================================
import re
from ladder_common import CACHE_TABLE, CACHE_COLS, DT_TYPE, DT_VERSION, dt_create_params, dt_get_any_params, dt_upsert_params
_V5 = os.path.join(_here, 'v5')
_rd5 = lambda p: open(os.path.join(_V5, p), encoding='utf-8').read()
_NI = next(n for n in json.load(open(os.path.join(os.path.dirname(_out), 'SEO_Agent_v4.json')))[0]['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
_m_c = re.search(r"\nconst COUNTRIES = \{.*?\n\};", _NI, re.S); _m_d = re.search(r"\nfunction cleanDomain\(v\) \{.*?\n\}", _NI, re.S); _m_o = re.search(r"\nconst domainOk = \(d\) => \{.*?\n\};", _NI, re.S)
assert _m_c and _m_d and _m_o, 'Normalize Input: COUNTRIES / cleanDomain / domainOk not found'
def _assess_code(f):
    s = _rd5('code/' + f).replace('/*__REACH__*/', _rd5('code/_reach.js').rstrip('\n'))
    s = s.replace('/*__COUNTRIES__*/', '// ---- countries: copied from the main workflow\'s Normalize Input by build_api.py (DataForSEO location code = 2000 + ISO numeric) ----' + _m_c.group(0))
    s = s.replace('/*__DOMAIN_RULES__*/', '// ---- domain rules: copied from Normalize Input (public hostnames only) ----' + _m_d.group(0) + _m_o.group(0))
    assert '/*__' not in s, f + ': placeholder left'
    return s
_NS_A = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
_aid = lambda name: str(uuid.uuid5(_NS_A, 'assess:' + name))
_DFS_CRED = {"httpBasicAuth": {"id": "SEOcredDataForSE", "name": "DataForSEO"}}
_LOAD = {'alwaysOutputData': True, 'executeOnce': True, 'onError': 'continueRegularOutput'}
def _an(name, ntype, ver, params, pos_, **extra):
    n = {'parameters': params, 'id': _aid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos_}; n.update(extra); return n
def _acode(name, f, pos_): return _an(name, 'n8n-nodes-base.code', 2, {'jsCode': _assess_code(f) if f.endswith('.js') else f}, pos_)
def _aif(name, expr, pos_):
    return _an(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': _aid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos_)
def _arespond(name, body, code, pos_): return _an(name, 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': body, 'options': {'responseCode': code}}, pos_)
assert '$json' not in _rd5('prompts/keyword_fit.txt'), 'keyword_fit.txt: read the context with $(\'Assess Result\'), not $json'
_FIT_SCHEMA = {'type': 'object', 'properties': {'fit': {'type': 'number'}, 'navigational': {'type': 'boolean'}, 'alternatives': {'type': 'array', 'items': {'type': 'string'}}}, 'required': ['fit', 'navigational']}
_assess_hook = {"httpMethod": "POST", "path": "seo-keyword-assess", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
_AN = [
  _an('Assess Webhook', 'n8n-nodes-base.webhook', 2, _assess_hook, [0, 0], webhookId='9b4e2f61-3c8a-4d7e-a5b2-7f1c0e6d9a24', credentials={"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}),
  _acode('Assess Validate', 'Assess_Validate.js', [220, 0]),
  _aif('Assess Valid?', '{{ $json.ok }}', [440, 0]),
  _aif('Assess Limited?', '{{ $json.status === 429 }}', [660, 220]),
  _arespond('Respond Assess Limited', "={{ JSON.stringify({ ok: false, error: $json.error }) }}", 429, [880, 160]),
  _arespond('Respond Assess Bad Request', "={{ JSON.stringify({ ok: false, error: $json.error, errors: $json.errors }) }}", 400, [880, 320]),
  _an('Ensure Cache Table (Assess)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), [660, -100], onError='continueRegularOutput', executeOnce=True),
  _an('Load Assess Cache', DT_TYPE, DT_VERSION, dt_get_any_params(CACHE_TABLE, [('key', "={{ 'reach:' + $('Assess Validate').first().json.site_id }}"), ('key', "={{ 'desc:' + $('Assess Validate').first().json.domain }}")]), [880, -100], **_LOAD),
  _acode('Assess Requests', 'Assess_Requests.js', [1100, -100]),
  _an('Run Assess Requests', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'timeout': 15000}}, [1320, -100], credentials=_DFS_CRED, onError='continueRegularOutput'),
  _acode('Assess Result', 'Assess_Result.js', [1540, -100]),
  _aif('DataForSEO OK?', '{{ $json.ok }}', [1760, -100]),
  _arespond('Respond Assess Upstream Error', "={{ JSON.stringify({ ok: false, error: $json.error }) }}", 502, [1980, 60]),
  _an('Keyword Fit', '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + _rd5('prompts/keyword_fit.txt'), 'hasOutputParser': True, 'options': {}}, [1980, -200], retryOnFail=True, maxTries=2, waitBetweenTries=1000, onError='continueRegularOutput'),
  _an('Claude — Keyword Fit', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': 'claude-haiku-4-5-20251001', 'cachedResultName': 'Claude Haiku 4.5'}, 'options': {'maxTokensToSample': 400}}, [1900, 0], credentials={"anthropicApi": {"id": "SEOcredAnthropic", "name": "Anthropic (SEO Agent)"}}),
  _an('Parser — Keyword Fit', '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps(_FIT_SCHEMA)}, [2100, 0]),
  _acode('Assess Response', 'Assess_Response.js', [2300, -200]),
  _arespond('Respond Assess', "={{ JSON.stringify($json.body) }}", 200, [2520, -200]),
  _acode('Reach Row (Assess)', "// After the answer: a newly measured reach goes to seo_cache ('reach:<site_id>', 30 days) for the ladder and discovery (exact columns).\nconst r = $('Assess Result').first().json.cache_row;\nreturn [{ json: r || { skip: true } }];", [2740, -200]),
  _aif('New Reach (Assess)?', '{{ !$json.skip }}', [2960, -200]),
  _an('Save Reach (Assess)', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [3180, -200], onError='continueRegularOutput'),
  _an('Note', 'n8n-nodes-base.stickyNote', 1, {'content': "## SEO Agent — Keyword Check (v4.8)\n`POST /webhook/seo-keyword-assess` (header auth: credential **SEO API Key**, header `X-API-Key`), synchronous (~5-15 s). The web app's keyword flow (PIPELINE_FEATURE_SPEC §5.2) checks one keyword before a ladder starts.\n\nBody: `{ keyword (2-100 chars), country (name or ISO-2), domain, business?, services? (array), existing_keywords? (array) }`.\n\nDataForSEO Labs in parallel: keyword overview (volume, difficulty, intent, CPC), the site's position for the keyword, and the site's **reach** (stored 30 days in `seo_cache` as `reach:<site_id>`, shared with the ladder and discovery; else measured: top-10 keywords + size). One **Claude Haiku** call: topic fit 0/1/2, navigational / other brand, up to 3 alternatives. Business context: the request, else the stored homepage description.\n\n**200** `{ keyword, country, volume, kd, intent, cpc, position, reach, difficulty_for_you, plan_type, months, fit, navigational, alternatives, cost_usd, label, stretch, position_url, reach_info, business_source, warnings }` · **400** `{ ok:false, error, errors: {field: message} }` · **429** daily limit (40 per caller — the app's `X-Forwarded-For: app:<company>` — and 400 in total) · **502** DataForSEO failed.\nCost: ~$0.02 with a stored reach, ~$0.05 without.", 'height': 400, 'width': 760, 'color': 4}, [-40, -520]),
]
_AC = {}
def _alink(a, b, out=0):
    outs = _AC.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
for _a, _b in [('Assess Webhook', 'Assess Validate'), ('Assess Validate', 'Assess Valid?'), ('Ensure Cache Table (Assess)', 'Load Assess Cache'), ('Load Assess Cache', 'Assess Requests'), ('Assess Requests', 'Run Assess Requests'),
               ('Run Assess Requests', 'Assess Result'), ('Assess Result', 'DataForSEO OK?'), ('Keyword Fit', 'Assess Response'), ('Assess Response', 'Respond Assess'), ('Respond Assess', 'Reach Row (Assess)'), ('Reach Row (Assess)', 'New Reach (Assess)?')]:
    _alink(_a, _b)
_alink('Assess Valid?', 'Ensure Cache Table (Assess)', 0); _alink('Assess Valid?', 'Assess Limited?', 1)
_alink('Assess Limited?', 'Respond Assess Limited', 0); _alink('Assess Limited?', 'Respond Assess Bad Request', 1)
_alink('DataForSEO OK?', 'Keyword Fit', 0); _alink('DataForSEO OK?', 'Respond Assess Upstream Error', 1)
_alink('New Reach (Assess)?', 'Save Reach (Assess)', 0)
_AC['Claude — Keyword Fit'] = {'ai_languageModel': [[{'node': 'Keyword Fit', 'type': 'ai_languageModel', 'index': 0}]]}
_AC['Parser — Keyword Fit'] = {'ai_outputParser': [[{'node': 'Keyword Fit', 'type': 'ai_outputParser', 'index': 0}]]}
_names = {n['name'] for n in _AN}
for _s, _o in _AC.items():
    assert _s in _names, _s
    for _lists in _o.values():
        for _l in _lists:
            for _t in _l: assert _t['node'] in _names, _t['node']
assert all(n.get('credentials') for n in _AN if n['type'] in ('@n8n/n8n-nodes-langchain.lmChatAnthropic', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.webhook')), 'keyword check: credential slot missing'
kwf = {"id": "SEOagentAssess", "name": "SEO Agent — Keyword Check", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl", "executionTimeout": 45}, "tags": [], "nodes": _AN, "connections": _AC}
json.dump([kwf], open(os.path.join(os.path.dirname(_out), 'SEO_Agent_Keyword_Check.json'), 'w'), indent=2, ensure_ascii=False)
if os.path.isdir(_code):
    for _n in _AN:
        if _n['type'] == 'n8n-nodes-base.code': open(os.path.join(_code, re.sub(r'[^A-Za-z0-9_.-]+', '_', _n['name']) + '.js'), 'w').write(_n['parameters']['jsCode'])
print('Keyword Check workflow written:', len(_AN), 'nodes')
