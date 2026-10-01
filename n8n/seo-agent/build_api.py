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
if (!['keyword', 'verdict', 'check', 'audit', 'discover', 'describe', 'ladder'].includes(mode)) errors.push('mode must be one of: keyword, verdict, audit, discover, describe, ladder');
if (['keyword', 'verdict', 'check', 'ladder'].includes(mode) && !b.keyword) errors.push('keyword is required');
if (['audit', 'describe', 'ladder'].includes(mode) && !b.domain) errors.push('domain is required');
if (mode === 'ladder' && b.pages_now != null && !(Number(b.pages_now) >= 1 && Number(b.pages_now) <= 3)) errors.push('pages_now must be 1, 2 or 3');
if (mode === 'discover' && !b.business && !b.domain) errors.push('business or domain is required');
if (mode !== 'describe' && !b.country) errors.push('country is required (name or ISO-2 code)');
if (!b.callback_url && !b.email) errors.push('callback_url (https) or email is required so the result can be delivered');
if (b.callback_url && !/^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/\S*)$/.test(String(b.callback_url))) errors.push('callback_url must be an https URL (http only for localhost while testing)');
const request_id = $execution.id;
const eta = mode === 'audit' ? 20 : (['verdict', 'check'].includes(mode) ? 4 : mode === 'ladder' ? 8 : 10);
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
  {"parameters": {"content": "## SEO Agent — API front door\n`POST /webhook/seo-keyword-check` (header auth: credential **SEO API Key**, header `X-API-Key`).\n\nBody: `mode` (keyword | verdict | audit | discover | describe | **ladder**), `keyword`, `country` (name or ISO-2), `domain`, `business`, `customers`, `page_type`, `competitors`, `email`, `callback_url` (https). Ladder: `pages_now` (1-3, pages written now). Optional everywhere: `wordpress_url` (draft publishing when enabled). Ladder callbacks: stage `ladder_plan` (plan JSON + PDF/Word), then one `content` callback per page with `ladder_id` and `ladder_rung`; the Rank Tracker later POSTs `stage: rank_tracker` progress.\n\nAnswers **202** `{status:'accepted', request_id, …}` at once and starts **SEO Agent v4** in the background (Execute Workflow, no wait). The finished result (verdict, keyword data, PDF + Word file as base64, run_ledger) is POSTed to `callback_url` with the same `request_id`, and/or emailed. Malformed requests get **400**; requests rejected later in the main run are POSTed as `{status:'rejected'}`.\n\nWhy separate: n8n rejects Respond-to-Webhook nodes downstream of a Form Trigger, and the main workflow is form-driven.", "height": 460, "width": 700, "color": 4}, "id": nid(), "name": "Note", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-40, -480]}
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
