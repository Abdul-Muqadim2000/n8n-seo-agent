import json, re, uuid
import url_lint   # D15 (2026-10-11 system review): the canonical-host lint
import retry_lint   # G1 (2026-10-11 system review): one retry rule for every external HTTP node
import dfs_gate     # B-A10 (2026-10-15): INVARIANTS rule 3 — the in-200 retry gate, one shape for every DataForSEO call
# B-A6 (2026-10-15, build section 63): the idempotency log lives in seo_cache, which is where this engine already keeps
# keyed-with-a-lifetime values (`sitemap:`, `age:`, `desc:`, `reach:`, `cost:`). See the long note beside the nodes for why NOT
# seo_run_ledger, which the brief for this work assumed.
from ladder_common import freeze_ids   # B-F5 (2026-10-15): one id rule, so an unchanged rebuild is byte-identical
import env_settings as _env   # B-F5: a build with no n8n/.env must refuse, not bake its fallbacks
_env.require_settings('build_api.py')
from ladder_common import (CACHE_TABLE, CACHE_COLS, DT_TYPE, DT_VERSION,
                           dt_create_params, dt_insert_params, dt_get_all_where_params, dt_delete_where_params)
from ladder_common import LADDER_TABLE as _LADDER_TABLE, LOG_TABLE as _LOG_TABLE   # R50 (A14): the Keyword Check names the ladder / page that already holds the search
from ladder_common import PAGES_TABLE as _PAGES_TABLE, LADDER_SETTINGS_TABLE as _LSET_TABLE   # A-1 / A-2 (2026-10-17): the page inventory and the ladder's own status
# B-F5 (2026-10-15): these ids are placeholders — freeze_ids() re-keys every one of them on (workflow, node) before the dump.
# They are generated in build order rather than at random all the same, so that even a half-built workflow dumped for debugging
# is the same twice, and so that the build-time lint for a random id (build_v4.py section 69) has nothing to find.
_NID_NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de'); _NID_SEQ = [0]
def nid():
    _NID_SEQ[0] += 1
    return str(uuid.uuid5(_NID_NS, 'build_api placeholder %d' % _NID_SEQ[0]))
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

// ---- B-A6 (2026-10-15, build section 63): the key a repeated POST is recognised by -------------------------------------------
// A POST that arrives twice — a caller that timed out and retried, a proxy or a webhook delivered twice, a double submit — started a
// SECOND run and spent a second time. That got dearer on 2026-10-15, when both daily ceilings went from $6 to $15.
// `request_id` could not be the key for it, whatever it looks like: it is minted HERE, `$execution.id` of this front-door run, and it
// overwrites anything the caller sent, so two deliveries of one request have two different ids by construction.
// So the key is the request itself. In order of preference:
//   1. what the caller calls it — `request_id` / `idempotency_key` in the body, or an `Idempotency-Key` header. A caller that wants a
//      genuinely new run sends a new key, which is the whole point of an idempotency key.
//   2. a fingerprint of the request: every field of the body (minus the three fields above) plus the caller's own identity, in a
//      canonical form so key order cannot change it. Identical body from the same caller = the same request. Anything different about
//      it — a different keyword, a different callback, a different company — is a different request and must run.
// `force_new: true` opts out entirely and is given a key nothing can match, so the row still records that the request arrived.
const IDEM_WINDOW_MIN = 5;   // see the sticky note: long enough to cover any "I never saw the answer" retry, short enough that a
                             // deliberate second run of the same analysis is not refused the reply it asked for.
const canon = (v) => {
  if (v === null || v === undefined) return 'n';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
};
// two independent 32-bit mixes of the same text, printed as 16 hex characters. No `crypto` and no `URL` (the n8n Code sandbox has
// neither), and a collision would have to land on the same caller inside the same five minutes to matter at all.
const fp = (s) => {
  let h1 = 0x811c9dc5, h2 = 0x7fffffff;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619) >>> 0;
    h2 = (Math.imul(h2 + ch, 2654435761) ^ (h2 >>> 13)) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
};
const IDEM_OWN = ['request_id', 'idempotency_key', 'force_new'];
const idemGiven = String(b.request_id || b.idempotency_key || hdr['idempotency-key'] || hdr['x-idempotency-key'] || '').trim();
const idemBody = Object.keys(b).filter(k => !IDEM_OWN.includes(k)).sort().reduce((o, k) => { o[k] = b[k]; return o; }, {});
const forceNew = b.force_new === true || /^(true|1|yes)$/i.test(String(b.force_new == null ? '' : b.force_new));
const idem_key = forceNew ? '' : (idemGiven ? 'k:' + idemGiven.slice(0, 80) : mode + ':' + fp(canon({ by: client_ip, body: idemBody })));

return [{ json: {
  ok: errors.length === 0, error: errors.join('; '), request_id, mode, keyword: b.keyword || null, domain: b.domain || null, country: b.country || null,
  delivery: b.callback_url ? 'POST to callback_url when finished' : 'email when finished', estimated_minutes: eta,
  idem_key, idem_window_min: IDEM_WINDOW_MIN, idem_source: forceNew ? 'force_new' : (idemGiven ? 'caller' : 'request fingerprint'),
  forward: { ...raw, body: { ...b, request_id, client_ip } }
} }];"""
# =============================================================================
# B-A6 (2026-10-15, build section 63): no idempotency on the front door.
#
# **What was wrong.** `POST /webhook/seo-keyword-check` answered 202 and started a run. Nothing looked at whether it had just started
# that same run: an app that timed out and retried, a proxy that re-delivered, a double submit, each bought a second run of the same
# analysis. The owner raised both daily ceilings from $6 to $15 on 2026-10-15, so a duplicate now costs more than it used to.
#
# **Where the log lives, and why it is not `seo_run_ledger`.** The obvious home is the run ledger, and it is the wrong one. Every row
# of that table is, by construction, a RUN that can be open or settled, and `CC.dfsRun` (v5/code/_cost_cal.js, B-A5, shipped the same
# day) decides whether a run may be costed against the DataForSEO account by asking whether any other ledger row was open across its
# window — `if (String(r.status || '') !== 'done') return true;`. A front-door row is not a run and has no status that answers that
# question honestly: 'accepted' reads as "still open", so every settle would find a neighbour and fall back to its per-task figure, and
# giving it `status: 'done'` would make a request that arrives mid-run look like an overlapping run instead. Either way a non-run row
# in that table silently takes B-A5's run-level attribution away. `seo_cache` is the engine's keyed store with a lifetime and nothing
# reads it as a run: its readers all filter on their own key prefixes, so `idem:` rows are invisible to every one of them.
#
# **How the race is settled.** The same idiom D1 established for the ledger, for the same reason: INSERT first, then read back, and the
# LOWEST id wins. Two deliveries that arrive in the same millisecond both insert; both then read the same two rows and both agree on
# which of them was first. A read-then-write check could not do that.
#
# **It fails open, every time it cannot be sure.** No id of its own (the insert did not get through), no row older than its own, a
# stored value it cannot read, no request id in it — each of those starts the run. Refusing a run the customer asked for, to save a
# duplicate we are not certain of, is the worse error of the two.
IDEM_ROW = r"""// B-A6: one seo_cache row per request that arrived, written BEFORE the 202 so a repeat can see it.
// Exactly the seo_cache columns, in the table's own order: the insert node auto-maps every field of this item.
const q = $('Quick Validate').first().json || {};
const now = new Date().toISOString();
// `force_new` (and only it) leaves idem_key empty. The row is still written — a request that arrived is worth recording — but under a
// key nothing else can ever carry, so it can neither be matched nor match anything.
const key = 'idem:' + (q.idem_key || ('none:' + q.request_id));
return [{ json: {
  key,
  kind: 'idem',
  site_id: String(q.domain || ''),
  value: JSON.stringify({ request_id: String(q.request_id || ''), mode: q.mode || '', domain: q.domain || null,
                          keyword: q.keyword || null, country: q.country || null, source: q.idem_source || '', at: now }).slice(0, 2000),
  updated_at: now,
} }];"""

IDEM_DECIDE = r"""// B-A6: is this the first delivery of this request, or a repeat of one already running?
// Insert-then-read-back, lowest id wins (the idiom D1 put on the run ledger, for the same concurrency reason). Everything below is
// written to FAIL OPEN: when it cannot be certain this is a repeat, it starts the run.
const q = $('Quick Validate').first().json || {};
let mine = {}; try { mine = $('Record Request').first().json || {}; } catch (e) {}
let rows = []; try { rows = $('Load Requests').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
const myKey = String(($('Request Row').first().json || {}).key || '');
const myId = Number(mine.id);

// every row under my own key that was written before mine. The Data Table read is already bounded to the window
// (updated_at >= now - idem_window_min), so anything that comes back is recent enough to be a retry of this request.
const before = (myId > 0 && myKey && !/^idem:none:/.test(myKey))
  ? rows.filter(r => String(r.key) === myKey && Number(r.id) > 0 && Number(r.id) < myId).sort((a, b) => Number(a.id) - Number(b.id))
  : [];
let first = null;
for (const r of before) {
  let v = null;
  try { v = JSON.parse(String(r.value || '')); } catch (e) { v = null; }
  // a row whose stored request id cannot be read is no use: the whole point is to answer with the FIRST run's id, and inventing one
  // would be worse than starting a second run.
  if (v && v.request_id) { first = { row: r, at: String(r.updated_at || ''), request_id: String(v.request_id) }; break; }
}

const win = Number(q.idem_window_min) || 5;
const out = { ...q, duplicate: false, first_seen_at: null, note: '', idem_rows_before: before.length };
if (first) {
  out.duplicate = true;
  out.first_seen_at = first.at || null;
  out.request_id = first.request_id;   // the caller gets the id of the run that is already doing this work
  out.note = 'This request was already received' + (first.at ? ' at ' + first.at : '')
    + ' and is being worked on, so it was not started a second time. `request_id` is that first run\'s id, and its result will be '
    + 'delivered as agreed. Send a different `request_id` (or `force_new: true`) to ask for a genuinely new run of the same analysis.';
} else {
  out.note = 'Accepted. A repeat of this exact request within ' + win + ' minutes returns this same run instead of starting another.';
}
return [{ json: out }];"""

wf = {"id": "SEOagentAPIentry", "name": "SEO Agent — API", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl"}, "tags": [],
 "nodes": [
  {"parameters": webhook, "id": nid(), "name": "Webhook Trigger", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "webhookId": "67a01e9b-0eb4-54ad-863e-005660fbaac7", "credentials": {"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}},
  {"parameters": {"jsCode": QV}, "id": nid(), "name": "Quick Validate", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
  {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3}, "conditions": [{"id": nid(), "leftValue": "={{ $json.ok }}", "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}], "combinator": "and"}, "looseTypeValidation": True, "options": {}}, "id": nid(), "name": "Valid?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [480, 0]},
  # ---- B-A6: the idempotency log, all of it in front of the 202 (see the note above) ----
  {"parameters": dt_create_params(CACHE_TABLE, CACHE_COLS), "id": nid(), "name": "Ensure Request Log", "type": DT_TYPE, "typeVersion": DT_VERSION, "position": [720, -100], "onError": "continueRegularOutput", "alwaysOutputData": True, "executeOnce": True},
  {"parameters": {"jsCode": IDEM_ROW}, "id": nid(), "name": "Request Row", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [900, -100]},
  {"parameters": dt_insert_params(CACHE_TABLE, CACHE_COLS), "id": nid(), "name": "Record Request", "type": DT_TYPE, "typeVersion": DT_VERSION, "position": [1080, -100], "onError": "continueRegularOutput", "alwaysOutputData": True},
  {"parameters": dt_get_all_where_params(CACHE_TABLE, [("key", "eq", "={{ $('Request Row').first().json.key }}"),
                                                       ("updated_at", "gte", "={{ new Date(Date.now() - (Number($('Quick Validate').first().json.idem_window_min) || 5) * 60000).toISOString() }}")]),
   "id": nid(), "name": "Load Requests", "type": DT_TYPE, "typeVersion": DT_VERSION, "position": [1260, -100], "onError": "continueRegularOutput", "alwaysOutputData": True, "executeOnce": True},
  {"parameters": {"jsCode": IDEM_DECIDE}, "id": nid(), "name": "First Or Repeat", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1440, -100]},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ status: 'accepted', request_id: $json.request_id, mode: $json.mode, keyword: $json.keyword, domain: $json.domain, country: $json.country, delivery: $json.delivery, estimated_minutes: $json.estimated_minutes, duplicate: $json.duplicate === true, first_seen_at: $json.first_seen_at, note: $json.note }) }}", "options": {"responseCode": 202}}, "id": nid(), "name": "Respond Accepted", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1620, -100]},
  {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3}, "conditions": [{"id": nid(), "leftValue": "={{ $json.duplicate }}", "rightValue": "", "operator": {"type": "boolean", "operation": "false", "singleValue": True}}], "combinator": "and"}, "looseTypeValidation": True, "options": {}}, "id": nid(), "name": "Start Needed?", "type": "n8n-nodes-base.if", "typeVersion": 2.3, "position": [1800, -100]},
  {"parameters": {"jsCode": "return [{ json: $input.first().json.forward }];"}, "id": nid(), "name": "Prepare Payload", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1980, -200]},
  {"parameters": {"source": "database", "workflowId": {"__rl": True, "mode": "id", "value": "SEOagentV4Full01"}, "mode": "once", "options": {"waitForSubWorkflow": False}}, "id": nid(), "name": "Start SEO Run", "type": "n8n-nodes-base.executeWorkflow", "typeVersion": 1.2, "position": [2160, -200]},
  # retention: the log only ever grows, and a row older than a day can answer nothing (the window is minutes). Last on both branches,
  # so it can never delay the 202 or the run.
  {"parameters": dt_delete_where_params(CACHE_TABLE, [("kind", "eq", "idem"), ("updated_at", "lt", "={{ new Date(Date.now() - 86400000).toISOString() }}")]),
   "id": nid(), "name": "Forget Old Requests", "type": DT_TYPE, "typeVersion": DT_VERSION, "position": [2340, -100], "onError": "continueRegularOutput", "alwaysOutputData": True, "executeOnce": True},
  {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ status: 'rejected', request_id: $json.request_id, error: $json.error }) }}", "options": {"responseCode": 400}}, "id": nid(), "name": "Respond Bad Request", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [720, 120]},
  {"parameters": {"content": "## SEO Agent — API front door\n`POST /webhook/seo-keyword-check` (header auth: credential **SEO API Key**, header `X-API-Key`).\n\nBody: `mode` (keyword | verdict | audit | discover | describe | **ladder** | **track** | **published** | **checkin**), `keyword`, `country` (name or ISO-2), `domain`, `business`, `customers`, `page_type`, `competitors`, `email`, `callback_url` (https). Ladder: `pages_now` (1-3, pages written now). Track: `domain`, optional `keywords` (array, up to 20), `ga4_property_id`, `blogs_per_week` (0-3, written every Monday by the Content Cadence and delivered as HTML + Markdown + meta.json in the `content` callback); answers `stage: site_tracker_setup`, then one `stage: site_tracker` callback per weekly report (Search Console, GA4, trends, live checks, actions, PDF) and `stage: content_cadence` notes. Published: `domain`, `published_url`, `keyword` or `content_request_id` → `stage: published` (live publish check, link suggestions, stored). Check-in: `domain`, `manual_action`, `security_issue` (booleans), optional `notes` and `pages_csv` (the Search Console Pages export as text) → `stage: console_checkin`. Profile (v4.4): `domain`, `author` {name, job_title, credentials, bio, url, same_as[], image_url, knows_about[]}, `reviewer` {name, job_title, url}, `business_name`, `business_type`, `address` {street, city, region, postal_code, country}, `phone`, `public_email`, `opening_hours` ('Mo-Fr 09:00-18:00'), `service_areas`, `map_url`, `logo_url` → `stage: profile` (empty fields keep the stored value, '-' clears). Case study: `domain`, `country`, `case_study` {client_name, client_public, industry, location, service, challenge, solution, timeline, results, quote, quote_by}, optional `keyword` → `stage: case_study_started`, then the page as a `content` callback. AI visibility / backlinks (v4.5): `domain`, `country`, optional `competitors` → `stage: ai_visibility_started` / `backlinks_started`, then the report as `stage: ai_visibility` / `backlinks`. Track: optional `competitors` and `monitors` {ai_visibility, ai_engines, ai_prompts_max, backlinks, audit_monthly, audit_pages, audit_js, brand_names}. Audit: optional `crawl_pages` (50-1000) and `crawl_js` (JavaScript rendering, max 500 pages); the callback carries `audit_diff`, `internal_links`, `entity` and `fix_pack`. Keyword runs also take `page_type` 'Pillar Page' / 'Local Page' (+ `local_area`) / 'Case Study', `video` {url, transcript, title, upload_date, duration, placement} or `video_url` + `video_transcript`, and an `author` / `reviewer` override. Optional everywhere: `wordpress_url` (draft publishing when enabled). Ladder callbacks: stage `ladder_plan` (plan JSON + PDF/Word), then one `content` callback per page with `ladder_id` and `ladder_rung`; the Rank Tracker later POSTs `stage: rank_tracker` progress.\n\nAnswers **202** `{status:'accepted', request_id, duplicate, first_seen_at, note, …}` at once and starts **SEO Agent v4** in the background (Execute Workflow, no wait). The finished result (verdict, keyword data, PDF + Word file as base64, run_ledger, and `run_cost_estimate_usd` + `run_cost_estimate_basis` + `run_cost_estimate_state: 'modelled'` — the engine's own calibrated figure for the whole run, the one its guard reserved) is POSTed to `callback_url` with the same `request_id`, and/or emailed. Malformed requests get **400**; requests rejected later in the main run are POSTed as `{status:'rejected'}`.\n\n**Sent twice? It runs once** (B-A6, 2026-10-15). Every request is logged to `seo_cache` (`idem:…`, kind `idem`) **before** the 202. A second POST of the same request within **5 minutes** is answered `202 {duplicate: true, request_id: <the first run's id>, first_seen_at, note}` and starts nothing — a caller that timed out and retried, a proxy that re-delivered or a double submit no longer buys a second run at up to $15 a day. The request is recognised by the caller's own `request_id` / `idempotency_key` in the body or an `Idempotency-Key` header; with none, by a fingerprint of the whole body plus the caller's identity, so anything genuinely different runs. **To ask for a real second run of the same analysis**, send a different `request_id` or `force_new: true`. Five minutes is long enough to cover any retry by a caller that never saw the answer and short enough that a deliberate repeat is not refused. Whenever it cannot be sure — the log write did not get through, no earlier row, a stored row it cannot read — it **starts the run**.\n\nWhy separate: n8n rejects Respond-to-Webhook nodes downstream of a Form Trigger, and the main workflow is form-driven.", "height": 460, "width": 700, "color": 4}, "id": nid(), "name": "Note", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-40, -480]}
 ],
 "connections": {
  "Webhook Trigger": {"main": [[{"node": "Quick Validate", "type": "main", "index": 0}]]},
  "Quick Validate": {"main": [[{"node": "Valid?", "type": "main", "index": 0}]]},
  # B-A6: every one of these runs before the 202, because the answer itself depends on the outcome — a repeat is told the id of the
  # run that is already doing the work, and `Start SEO Run` is never reached.
  "Valid?": {"main": [[{"node": "Ensure Request Log", "type": "main", "index": 0}], [{"node": "Respond Bad Request", "type": "main", "index": 0}]]},
  "Ensure Request Log": {"main": [[{"node": "Request Row", "type": "main", "index": 0}]]},
  "Request Row": {"main": [[{"node": "Record Request", "type": "main", "index": 0}]]},
  "Record Request": {"main": [[{"node": "Load Requests", "type": "main", "index": 0}]]},
  "Load Requests": {"main": [[{"node": "First Or Repeat", "type": "main", "index": 0}]]},
  "First Or Repeat": {"main": [[{"node": "Respond Accepted", "type": "main", "index": 0}]]},
  "Respond Accepted": {"main": [[{"node": "Start Needed?", "type": "main", "index": 0}]]},
  "Start Needed?": {"main": [[{"node": "Prepare Payload", "type": "main", "index": 0}], [{"node": "Forget Old Requests", "type": "main", "index": 0}]]},
  "Prepare Payload": {"main": [[{"node": "Start SEO Run", "type": "main", "index": 0}]]},
  "Start SEO Run": {"main": [[{"node": "Forget Old Requests", "type": "main", "index": 0}]]}
 }}
import os
_here = os.path.dirname(os.path.abspath(__file__))
_out = os.path.join(_here, 'workflows', 'SEO_Agent_API.json') if os.path.isdir(os.path.join(_here, 'workflows')) else 'SEO_Agent_API.json'
url_lint.check(wf)   # D15: no node builds a site URL by hand (url_lint.py)
retry_lint.check(wf)   # G1: every external HTTP node carries the retry rule (retry_lint.py)

# ---- B-A6: the build proves the order, the way section 55 proves the ledger's (INVARIANTS.md: the lint proves the class) ----
# A wiring mistake here is invisible in a harness scenario, which runs node code and not n8n's branch ordering — and it is exactly how
# R17 happened. So it is checked on the generated JSON: walk `main` forward from the trigger, refuse to pass the node that decides,
# and nothing that starts a run or answers the caller may still be reachable.
def _api_idem_order(wfobj):
    c = wfobj['connections']
    out = lambda nd: [t['node'] for lst in ((c.get(nd) or {}).get('main') or []) for t in (lst or [])]
    def reach(stop):
        seen, stack = {'Webhook Trigger'}, ['Webhook Trigger']
        while stack:
            cur = stack.pop()
            if cur == stop: continue
            for t in out(cur):
                if t not in seen: seen.add(t); stack.append(t)
        return seen
    early = reach('First Or Repeat')
    for n in ('Start SEO Run', 'Prepare Payload', 'Respond Accepted'):
        assert n not in early, 'B-A6: ' + n + ' can run before the front door has decided whether this request is a repeat'
    # the log is written before anything reads it, and read before anything decides on it
    assert reach('Record Request').isdisjoint({'Load Requests', 'First Or Repeat'}), 'B-A6: the request log is read before it is written'
    assert out('Start Needed?')[:1] == ['Prepare Payload'], 'B-A6: the "not a repeat" branch does not start the run'
    assert out('Start Needed?')[1:] == ['Forget Old Requests'], 'B-A6: the repeat branch starts something'
    assert out('Start SEO Run') == ['Forget Old Requests'], 'B-A6: retention does not run after the run is started'
_api_idem_order(wf)
assert "const request_id = $execution.id;" in QV and 'idem_key' in QV, 'B-A6: Quick Validate does not mint the idempotency key'

json.dump([freeze_ids(wf)], open(_out, 'w'), indent=2, ensure_ascii=False)
print('API workflow written:', len(wf['nodes']), 'nodes (B-A6: a repeat inside '
      + re.search(r'IDEM_WINDOW_MIN = (\d+)', QV).group(1) + ' minutes returns the first run)')
# the harness runs Quick Validate too (scenario S23: the web app's request bodies), and S73 runs the two idempotency nodes
_code = os.path.join(_here, 'harness', 'code_v4')
_fname = lambda n: re.sub(r'[^A-Za-z0-9_.-]+', '_', n) + '.js'   # the sanitiser build_v4.py and harness.js both use
if os.path.isdir(_code):
    open(os.path.join(_code, 'Quick_Validate.js'), 'w').write(QV)
    for _n in ('Request Row', 'First Or Repeat'):
        _src = next(x['parameters']['jsCode'] for x in wf['nodes'] if x['name'] == _n)
        open(os.path.join(_code, _fname(_n)), 'w').write(_src)

# =============================================================================
# SEO Agent — Admin API (v4.7, 2026-10-03): the web app's door to Site Admin. POST /webhook/seo-site-admin (same header credential as the
# API front door) with { action, site_id | domain, ... } runs the Site Admin sub-workflow, waits, and answers with its result (affected rows).
# =============================================================================
AV = r"""// Same rules as Admin Action (Site Admin), answered as a 400 instead of a failed execution.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const action = String(b.action || '').toLowerCase();
const errors = [];
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts', 'content_groups'].includes(action)) errors.push('action must be delete, pause, resume, cadence, unpublish, monitors, prospect, ai_prompts or content_groups');
if (action === 'content_groups' && !Array.isArray(b.content_groups)) errors.push('content_groups (a list of {name, pattern}; [] clears them) is required for action content_groups');
if (!b.site_id && !b.domain) errors.push('site_id or domain is required');
if (action === 'cadence' && b.pages_per_week == null && b.blogs_per_week == null) errors.push('pages_per_week (0-3) is required for action cadence');
if (action === 'unpublish' && !b.keyword) errors.push('keyword is required for action unpublish');
if (action === 'prospect' && !b.prospect_domain) errors.push('prospect_domain is required for action prospect');
if (action === 'prospect' && b.status && !['new', 'contacted', 'replied', 'won', 'rejected', 'ignored'].includes(String(b.status).toLowerCase())) errors.push('status must be new, contacted, replied, won, rejected or ignored');
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
url_lint.check(awf)   # D15: no node builds a site URL by hand (url_lint.py)
retry_lint.check(awf)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
json.dump([freeze_ids(awf)], open(_aout, 'w'), indent=2, ensure_ascii=False)
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
from ladder_common import RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_insert_params, dt_get_all_where_params, dt_update_params   # v4.14 (D1): the run ledger
_V5 = os.path.join(_here, 'v5')
_rd5 = lambda p: open(os.path.join(_V5, p), encoding='utf-8').read()
_NI = next(n for n in json.load(open(os.path.join(os.path.dirname(_out), 'SEO_Agent_v4.json')))[0]['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
_m_c = re.search(r"\nconst COUNTRIES = \{.*?\n\};", _NI, re.S); _m_d = re.search(r"\nfunction cleanDomain\(v\) \{.*?\n\}", _NI, re.S); _m_o = re.search(r"\nconst domainOk = \(d\) => \{.*?\n\};", _NI, re.S)
assert _m_c and _m_d and _m_o, 'Normalize Input: COUNTRIES / cleanDomain / domainOk not found'
def _assess_code(f):
    s = _rd5('code/' + f).replace('/*__REACH__*/', _rd5('code/_reach.js').rstrip('\n'))
    s = s.replace('/*__FIT_GATE__*/', _rd5('code/_fit_gate.js').rstrip('\n'))   # R50 (A14): the stored ladder rows it names pass the same gate every other read path uses
    s = s.replace('/*__SITE_MODEL__*/', _rd5('code/_site_model.js').rstrip('\n')).replace('/*__OWN_COVER__*/', _rd5('code/_own_cover.js').rstrip('\n'))   # A-1 (2026-10-17): the page inventory match, the same as the main workflow's
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
# R3 (2026-10-13, re-rating): *Parser — Keyword Fit* failed twice on "business central partner uae" ("the AI model returned an empty
# response to the Structured Output Parser") and the 200 shipped `fit: null` with $0.024 charged. The schema is now three scalars -- the
# alternatives travel as one comma-separated string, which Assess Response's `listOf` already splits -- the token budget is 1,200 instead of
# 400 (a Haiku preamble used to eat the answer), and *Keyword Fit (Text)* answers in one plain line when the parser still comes back empty.
_FIT_SCHEMA = {'type': 'object', 'properties': {'fit': {'type': 'number'}, 'navigational': {'type': 'boolean'}, 'alternatives': {'type': 'string'}}, 'required': ['fit', 'navigational']}
_FIT_RETURN = 'Return exactly: {"fit": 0 | 1 | 2, "navigational": true | false, "alternatives": "up to 3 keywords separated by commas, or an empty string"}'
_FIT_PLAIN = 'Answer with ONE line and nothing else, exactly in this form:\nfit=<0 or 1 or 2>; navigational=<yes or no>; alternatives=<up to 3 keywords separated by commas, or none>'
_assess_hook = {"httpMethod": "POST", "path": "seo-keyword-assess", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
_AN = [
  _an('Assess Webhook', 'n8n-nodes-base.webhook', 2, _assess_hook, [0, 0], webhookId='9b4e2f61-3c8a-4d7e-a5b2-7f1c0e6d9a24', credentials={"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}),
  _acode('Assess Validate', 'Assess_Validate.js', [220, 0]),
  _aif('Assess Valid?', '{{ $json.ok }}', [440, 0]),
  # v4.14 (FIX_PLAN D1): the daily limits are counted from the run ledger (seo_run_ledger, mode 'assess'), not from static data that parallel
  # requests overwrote: reserve a row, read today's rows once, count the rows with a lower id (Assess Limit), mark a refused row, settle at the end
  _an('Ensure Run Ledger (Assess)', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [660, -320], onError='continueRegularOutput', executeOnce=True),
  _acode('Run Ledger Row (Assess)', 'Assess_Ledger_Row.js', [880, -320]),
  _an('Reserve Run Ledger (Assess)', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [1100, -320], onError='continueRegularOutput', alwaysOutputData=True),
  _an('Load Run Ledger (Assess)', DT_TYPE, DT_VERSION, dt_get_all_where_params(RUN_LEDGER_TABLE, [('mode', 'eq', 'assess'), ('created_at', 'gte', "={{ String($('Run Ledger Row (Assess)').first().json.created_at).slice(0, 10) }}")]), [1320, -320], **_LOAD),
  _acode('Assess Limit', 'Assess_Limit.js', [1540, -320]),
  _aif('Assess Limited?', '{{ $json.status === 429 }}', [1760, -320]),
  _arespond('Respond Assess Limited', "={{ JSON.stringify({ ok: false, error: $json.error }) }}", 429, [1980, -460]),
  _an('Mark Run Refused (Assess)', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}')], {'status': 'refused'}), [2200, -460], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True),
  # P1-1 (2026-10-12): the settle update matches `status = reserved`, so a row settles once and a refused one stays refused; a request that
  # DataForSEO failed (502) settles too — it used to leave its row `reserved` at the estimate for ever
  # R28 (2026-10-14, FIX_PLAN §3.12): the row is settled with the money the 200 reported, not with the flat reservation — it used to
  # store `dfs_usd: 0` while telling the caller $0.026, so the one mode that knows what it spent threw the figure away.
  _acode('Ledger Settle (Assess)', 'Assess_Ledger_Settle.js', [2520, -400]),
  _an('Settle Run Ledger (Assess)', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
      {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'ai_usd': '={{ $json.ai_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}',
       'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
       'cost_basis': '={{ $json.cost_basis }}',
       # R81 part 2 (2026-10-16, re-rating C-5): Assess_Ledger_Settle.js stamped `settled_at` and `dfs_source` and this update dropped them,
       # so every Keyword Check row stayed `done` with no `settled_at` and every other run's settle counted it as in flight for ever
       'settled_at': '={{ $json.settled_at }}', 'dfs_source': '={{ $json.dfs_source }}'}), [2740, -400], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True),
  _arespond('Respond Assess Bad Request', "={{ JSON.stringify({ ok: false, error: $json.error, errors: $json.errors }) }}", 400, [660, 320]),
  _an('Ensure Cache Table (Assess)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), [660, -100], onError='continueRegularOutput', executeOnce=True),
  _an('Load Assess Cache', DT_TYPE, DT_VERSION, dt_get_any_params(CACHE_TABLE, [('key', "={{ 'reach:' + $('Assess Validate').first().json.site_id }}"), ('key', "={{ 'desc:' + $('Assess Validate').first().json.domain }}")]), [880, -100], **_LOAD),
  # R50 (2026-10-16, A14): the answer names the ladder / page that already holds the search. Assess_Response.js reads these two nodes by name.
  _an('Load Ladders (Assess)', DT_TYPE, DT_VERSION, dt_get_all_where_params(_LADDER_TABLE, [('domain', 'eq', "={{ $('Assess Validate').first().json.domain }}")]), [990, -100], **_LOAD),
  _an('Load Content Log (Assess)', DT_TYPE, DT_VERSION, dt_get_all_where_params(_LOG_TABLE, [('domain', 'eq', "={{ $('Assess Validate').first().json.domain }}")]), [1045, -100], **_LOAD),
  # A-1 / A-2 (2026-10-17, re-rating exec 750): "business central partner uae" came back `existing: null` beside the live Business Central page
  # (the check read the ladder table only), and a paused ladder was shown "planned". Assess_Response.js reads these two nodes by name.
  _an('Load Pages (Assess)', DT_TYPE, DT_VERSION, dt_get_all_where_params(_PAGES_TABLE, [('site_id', 'eq', "={{ $('Assess Validate').first().json.site_id }}")]), [1045, 60], **_LOAD),
  _an('Load Ladder Settings (Assess)', DT_TYPE, DT_VERSION, dt_get_all_where_params(_LSET_TABLE, [('domain', 'eq', "={{ $('Assess Validate').first().json.domain }}")]), [1045, 220], **_LOAD),
  _acode('Assess Requests', 'Assess_Requests.js', [1100, -100]),
  _an('Run Assess Requests', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'timeout': 15000}}, [1320, -100], credentials=_DFS_CRED, onError='continueRegularOutput', **retry_lint.RETRY),
  _acode('Assess Result', 'Assess_Result.js', [1540, -100]),
  _aif('DataForSEO OK?', '{{ $json.ok }}', [1760, -100]),
  _arespond('Respond Assess Upstream Error', "={{ JSON.stringify({ ok: false, error: $json.error }) }}", 502, [1980, 60]),
  _an('Keyword Fit', '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + _rd5('prompts/keyword_fit.txt'), 'hasOutputParser': True, 'options': {}}, [1980, -200], retryOnFail=True, maxTries=2, waitBetweenTries=1000, onError='continueRegularOutput'),
  _an('Claude — Keyword Fit', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': 'claude-haiku-4-5-20251001', 'cachedResultName': 'Claude Haiku 4.5'}, 'options': {'maxTokensToSample': 1200}}, [1900, 0], credentials={"anthropicApi": {"id": "SEOcredAnthropic", "name": "Anthropic (SEO Agent)"}}),   # R3: 400 left a Haiku preamble no room for the answer
  _an('Parser — Keyword Fit', '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps(_FIT_SCHEMA)}, [2100, 0]),
  _aif('Fit Parsed?', "{{ !$json.error && $json.output != null && JSON.stringify($json.output).includes('fit') }}", [2140, -200]),
  _an('Keyword Fit (Text)', '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + _rd5('prompts/keyword_fit.txt').replace(_FIT_RETURN, _FIT_PLAIN), 'options': {}}, [2140, -380], retryOnFail=True, maxTries=2, waitBetweenTries=1000, onError='continueRegularOutput'),
  _acode('Assess Response', 'Assess_Response.js', [2300, -200]),
  _arespond('Respond Assess', "={{ JSON.stringify($json.body) }}", 200, [2520, -200]),
  _acode('Reach Row (Assess)', "// After the answer: a newly measured reach goes to seo_cache ('reach:<site_id>', 30 days) for the ladder and discovery (exact columns).\nconst r = $('Assess Result').first().json.cache_row;\nreturn [{ json: r || { skip: true } }];", [2740, -200]),
  _aif('New Reach (Assess)?', '{{ !$json.skip }}', [2960, -200]),
  _an('Save Reach (Assess)', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [3180, -200], onError='continueRegularOutput'),
  _an('Note', 'n8n-nodes-base.stickyNote', 1, {'content': "## SEO Agent — Keyword Check (v4.8)\n`POST /webhook/seo-keyword-assess` (header auth: credential **SEO API Key**, header `X-API-Key`), synchronous (~5-15 s). The web app's keyword flow (PIPELINE_FEATURE_SPEC §5.2) checks one keyword before a ladder starts.\n\nBody: `{ keyword (2-100 chars), country (name or ISO-2), domain, business?, services? (array), existing_keywords? (array) }`.\n\nDataForSEO Labs in parallel: keyword overview (volume, difficulty, intent, CPC), the site's position for the keyword, and the site's **reach** (stored 30 days in `seo_cache` as `reach:<site_id>`, shared with the ladder and discovery; else measured: top-10 keywords + size). One **Claude Haiku** call: topic fit 0/1/2, navigational / other brand, up to 3 alternatives. Business context: the request, else the stored homepage description.\n\n**200** `{ keyword, country, volume, kd, intent, cpc, position, reach, difficulty_for_you, plan_type, months, fit, navigational, alternatives, cost_usd, label, stretch, position_url, reach_info, business_source, warnings }` · **400** `{ ok:false, error, errors: {field: message} }` · **429** daily limit (40 per caller — the app's `X-Forwarded-For: app:<company>` — and 400 in total) · **502** DataForSEO failed.\nCost: ~$0.02 with a stored reach, ~$0.05 without.\n\n**v4.14 (D1):** the daily limits are counted from `seo_run_ledger` (one row reserved per request before the count; rows with a lower id count; refused rows marked, settled at the end), so parallel requests cannot slip past them.", 'height': 460, 'width': 760, 'color': 4}, [-40, -580]),
]
_AC = {}
def _alink(a, b, out=0):
    outs = _AC.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
for _a, _b in [('Assess Webhook', 'Assess Validate'), ('Assess Validate', 'Assess Valid?'), ('Ensure Cache Table (Assess)', 'Load Assess Cache'), ('Load Assess Cache', 'Load Ladders (Assess)'), ('Load Ladders (Assess)', 'Load Content Log (Assess)'), ('Load Content Log (Assess)', 'Load Pages (Assess)'), ('Load Pages (Assess)', 'Load Ladder Settings (Assess)'), ('Load Ladder Settings (Assess)', 'Assess Requests'), ('Assess Requests', 'Run Assess Requests'),
               ('Run Assess Requests', 'Assess Result'), ('Assess Result', 'DataForSEO OK?'), ('Keyword Fit', 'Fit Parsed?'), ('Keyword Fit (Text)', 'Assess Response'), ('Assess Response', 'Respond Assess'), ('Respond Assess', 'Reach Row (Assess)'), ('Reach Row (Assess)', 'New Reach (Assess)?'),
               ('Ensure Run Ledger (Assess)', 'Run Ledger Row (Assess)'), ('Run Ledger Row (Assess)', 'Reserve Run Ledger (Assess)'), ('Reserve Run Ledger (Assess)', 'Load Run Ledger (Assess)'), ('Load Run Ledger (Assess)', 'Assess Limit'),
               ('Assess Limit', 'Assess Limited?'), ('Respond Assess Limited', 'Mark Run Refused (Assess)'),
               ('Respond Assess', 'Ledger Settle (Assess)'), ('Ledger Settle (Assess)', 'Settle Run Ledger (Assess)')]:
    _alink(_a, _b)
_alink('Assess Valid?', 'Ensure Run Ledger (Assess)', 0); _alink('Assess Valid?', 'Respond Assess Bad Request', 1)
_alink('Assess Limited?', 'Respond Assess Limited', 0); _alink('Assess Limited?', 'Ensure Cache Table (Assess)', 1)
_alink('DataForSEO OK?', 'Keyword Fit', 0); _alink('DataForSEO OK?', 'Respond Assess Upstream Error', 1)
_alink('Fit Parsed?', 'Assess Response', 0); _alink('Fit Parsed?', 'Keyword Fit (Text)', 1)   # R3: the plain-text fallback runs only when the parser came back empty
_alink('Respond Assess Upstream Error', 'Ledger Settle (Assess)')   # P1-1: an upstream failure settles its row too (it stayed reserved)
_alink('New Reach (Assess)?', 'Save Reach (Assess)', 0)
_AC['Claude — Keyword Fit'] = {'ai_languageModel': [[{'node': 'Keyword Fit', 'type': 'ai_languageModel', 'index': 0}, {'node': 'Keyword Fit (Text)', 'type': 'ai_languageModel', 'index': 0}]]}   # R3: one model node feeds both attempts
_AC['Parser — Keyword Fit'] = {'ai_outputParser': [[{'node': 'Keyword Fit', 'type': 'ai_outputParser', 'index': 0}]]}
_names = {n['name'] for n in _AN}
for _s, _o in _AC.items():
    assert _s in _names, _s
    for _lists in _o.values():
        for _l in _lists:
            for _t in _l: assert _t['node'] in _names, _t['node']
assert all(n.get('credentials') for n in _AN if n['type'] in ('@n8n/n8n-nodes-langchain.lmChatAnthropic', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.webhook')), 'keyword check: credential slot missing'
kwf = {"id": "SEOagentAssess", "name": "SEO Agent — Keyword Check", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl", "executionTimeout": 45}, "tags": [], "nodes": _AN, "connections": _AC}
# ---- B-A10 (2026-10-15, INVARIANTS rule 3): the keyword check's one DataForSEO call goes through the in-200 retry gate ----
# This is the synchronous answer a customer waits for: difficulty for your site, the plan type, the topic fit. *Assess Result*
# already refuses honestly when the overview fails (ok: false -> HTTP 502, never a verdict on nothing), so what was missing was
# only the second attempt — a 40101 inside a 200 turned a $0.01 question into "we could not check" with no one asking again.
_gk10 = dfs_gate.splice(kwf, 'Run Assess Requests', os.path.join(_here, 'v5'),
                        what='the search data behind this keyword check', unit='request', code_dir=_code if os.path.isdir(_code) else None)
retry_lint.record_gate('SEO Agent — Keyword Check', _gk10['chain'])
# R28: the price the caller is told is both attempts, each task counted once by its own id — the merged list alone would miss a
# first attempt that was billed and then replaced (a task answering 20000 with an empty result did the work).
_ar10 = next(n for n in _AN if n['name'] == 'Assess Result')
_old10 = "const dfs_cost = +res.reduce((s, x) => s + (x && Array.isArray(x.tasks) ? x.tasks.reduce((a, t) => a + (Number(t && t.cost) || 0), 0) : 0), 0).toFixed(4);"
assert _ar10['parameters']['jsCode'].count(_old10) == 1, 'B-A10: Assess Result no longer prices the run where it did'
_ar10['parameters']['jsCode'] = _ar10['parameters']['jsCode'].replace(_old10,
    "// B-A10 (2026-10-15, R28): what both attempts really cost, each task counted once by its own id — the gate's own figure.\n"
    "const __ev = (res.find(x => x && x.__dfs) || {}).__dfs || null;\n"
    "const dfs_cost = __ev && Number.isFinite(Number(__ev.cost_usd)) ? Number(__ev.cost_usd)\n"
    "  : +res.reduce((s, x) => s + (x && Array.isArray(x.tasks) ? x.tasks.reduce((a, t) => a + (Number(t && t.cost) || 0), 0) : 0), 0).toFixed(4);")
assert '__dfs' in _ar10['parameters']['jsCode'], 'B-A10: the keyword check does not price both attempts'
retry_lint.check_in200(kwf)
url_lint.check(kwf)   # D15: no node builds a site URL by hand (url_lint.py)
retry_lint.check(kwf)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
json.dump([freeze_ids(kwf)], open(os.path.join(os.path.dirname(_out), 'SEO_Agent_Keyword_Check.json'), 'w'), indent=2, ensure_ascii=False)
if os.path.isdir(_code):
    for _n in _AN:
        if _n['type'] == 'n8n-nodes-base.code': open(os.path.join(_code, re.sub(r'[^A-Za-z0-9_.-]+', '_', _n['name']) + '.js'), 'w').write(_n['parameters']['jsCode'])
# P1-1 (2026-10-12): the Keyword Check's half of harness/ledger_wiring.json (written by build_v4.py section 29, read by harness S36)
_by_name = {n['name']: n for n in _AN}
# R28: the two responders now reach the settle through *Ledger Settle (Assess)*, which prices the request; `settle_from` keeps naming the
# ends that settle the row (P1-1's meaning, asserted by harness S36), and `settle_via` names the node that computes the figures.
_assess_settle = sorted(s for s, o in _AC.items() for _l in (o.get('main') or []) for _t in (_l or []) if _t['node'] == 'Ledger Settle (Assess)')
assert _assess_settle == ['Respond Assess', 'Respond Assess Upstream Error'], _assess_settle
assert sorted(s for s, o in _AC.items() for _l in (o.get('main') or []) for _t in (_l or []) if _t['node'] == 'Settle Run Ledger (Assess)') == ['Ledger Settle (Assess)']
_lw_path = os.path.join(_here, 'harness', 'ledger_wiring.json')
if os.path.isfile(_lw_path):
    _lw = json.load(open(_lw_path))
    _sa, _ra = _by_name['Settle Run Ledger (Assess)']['parameters'], _by_name['Mark Run Refused (Assess)']['parameters']
    _lw['assess'] = {'settle_node': 'Settle Run Ledger (Assess)', 'settle_from': _assess_settle, 'settle_via': 'Ledger Settle (Assess)',
                     'settle_conditions': [[c['keyName'], c['keyValue']] for c in _sa['filters']['conditions']], 'settle_values': _sa['columns']['value'],
                     'refused_conditions': [[c['keyName'], c['keyValue']] for c in _ra['filters']['conditions']], 'refused_values': _ra['columns']['value']}
    # R3 (2026-10-13): the topic-fit call's token budget, its (simpler) schema and the plain-text retry that runs when the parser comes back empty
    _lw['assess']['fit'] = {'agent': 'Keyword Fit', 'gate': 'Fit Parsed?', 'fallback': 'Keyword Fit (Text)',
                            'max_tokens': _by_name['Claude - Keyword Fit'.replace(' - ', ' \u2014 ')]['parameters']['options']['maxTokensToSample'],
                            'schema': json.loads(_by_name['Parser - Keyword Fit'.replace(' - ', ' \u2014 ')]['parameters']['inputSchema']),
                            'fallback_has_parser': bool(_by_name['Keyword Fit (Text)']['parameters'].get('hasOutputParser')),
                            'to_response': sorted(s_ for s_, o_ in _AC.items() for l_ in (o_.get('main') or []) for t_ in (l_ or []) if t_['node'] == 'Assess Response')}
    json.dump(_lw, open(_lw_path, 'w'), indent=1)
print('Keyword Check workflow written:', len(_AN), 'nodes')

# =============================================================================
# SEO Agent — Pre-release Check (G27, 2026-10-13, system review FIX_PLAN.md; criterion TECH 1.8 = 0 — build_v4.py section 53):
#     `POST /webhook/seo-prerelease` (same header credential as the API front door), synchronous, free: the key-page checks the daily
#     watch runs (G11, v5/code/_page_watch.js) against a STAGING host or an explicit URL list, before the release goes live, with a
#     verdict a CI job can read in one line (`| jq -e '.exit_code == 0'`).
#     It is a READ. The workflow has no Data Table node and starts no sub-workflow, so a release candidate can never create a ladder
#     row, a content-log row or an audit for a site — asserted below. What a staging host cannot answer (index coverage, real-user
#     speed, positions) is returned as `not_checked` with the reason, never as "fine".
# =============================================================================
_PRE_GET = {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True,
            'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.16; +pre-release-check)'}, {'name': 'Accept', 'value': 'text/html,application/xhtml+xml,text/plain,*/*'}]},
            # redirects are NOT followed: a key page that redirects before a release is itself the finding
            'options': {'batching': {'batch': {'batchSize': 5, 'batchInterval': 250}}, 'timeout': 20000,
                        'redirect': {'redirect': {'followRedirects': False}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}
_PW_SRC = _rd5('code/_page_watch.js').rstrip('\n')
_pre_code = lambda f: _rd5('code/' + f).replace('/*__PAGE_WATCH__*/', _PW_SRC)
_pre_hook = {"httpMethod": "POST", "path": "seo-prerelease", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
_PN = [
  _an('Prerelease Webhook', 'n8n-nodes-base.webhook', 2, _pre_hook, [0, 0], webhookId='3f6c1d84-7b90-4e52-9a1d-26c8b5e71f03', credentials={"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}),
  _an('Prerelease Validate', 'n8n-nodes-base.code', 2, {'jsCode': _pre_code('Prerelease_Validate.js')}, [220, 0]),
  _aif('Prerelease Valid?', '{{ $json.ok }}', [440, 0]),
  _an('Fetch Release Pages', 'n8n-nodes-base.httpRequest', 4.5, _PRE_GET, [660, -100], alwaysOutputData=True, onError='continueRegularOutput', **retry_lint.RETRY),
  _an('Prerelease Verdict', 'n8n-nodes-base.code', 2, {'jsCode': _pre_code('Prerelease_Verdict.js')}, [880, -100]),
  _arespond('Respond Prerelease', "={{ JSON.stringify($json.body) }}", 200, [1100, -100]),
  _arespond('Respond Prerelease Bad Request', "={{ JSON.stringify({ ok: false, verdict: 'error', exit_code: 2, error: $json.error, errors: $json.errors, writes: 'none' }) }}", 400, [660, 140]),
  _an('Note (Pre-release)', 'n8n-nodes-base.stickyNote', 1, {'content': "## SEO Agent — Pre-release Check (G27, v4.16)\n`POST /webhook/seo-prerelease` (header auth: credential **SEO API Key**, header `X-API-Key`), synchronous (a few seconds), **free** — one plain GET per page plus `/robots.txt` per host, no paid API, nothing rendered.\n\nBody: `{ base_url: 'https://staging.example.com', paths: ['/', '/pricing'] }` or `{ urls: ['https://staging.example.com/pricing'] }` (max 25), optional `live_host` (the address the pages will have in production) and `staging: false`.\n\n**CI (B5-7):** `fail_on` (`any` default | `low` | `medium` | `high` | `critical`) makes only failures of that severity or above fail (the rest come back as `below_threshold`); `expected` lists the changes this release makes on purpose (`'/pricing'` or `'/pricing:canonical'`, or `{path, check, reason}`) so an intentional release does not fail its own check (they come back as `expected_changes`; an entry that matched nothing as `expected_unused`). Recipe: `docs/PRERELEASE_CI.md`.\n\nChecks, the same ones the daily **Page Watch** runs on live key pages: does the page answer 200, does it redirect, is it `noindex`, does `robots.txt` allow it, one canonical pointing at the right page, one `<title>`, one H1, a meta description. On a staging host `noindex` and a robots.txt disallow are the deliberate staging guard, so they are **warnings** naming the live page; `staging: false` makes them failures.\n\n**200** `{ ok, verdict: 'pass' | 'fail', exit_code: 0 | 1, summary, counts, failures: [{url, check, severity, detail}], warnings, not_checked: [{check, reason}], pages }` · **400** field errors (`exit_code: 2`).\nCI in one line: `curl -s -H \"X-API-Key: …\" -H 'Content-Type: application/json' -d @release.json $URL/webhook/seo-prerelease | jq -e '.exit_code == 0'`.\n\n**It writes nothing** (`writes: \"none\"`): no Data Table node, no sub-workflow, so a release candidate never creates ladder rows, content-log rows or audits. What a staging host cannot answer — index coverage (Google has never crawled the URL), real-user speed (no Chrome visitors), positions — comes back as `not_checked` **with the reason**, never as \"fine\".", 'height': 520, 'width': 760, 'color': 4}, [-40, -620]),
]
_PC = {}
def _plink(a, b, out=0):
    outs = _PC.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
for _a, _b in [('Prerelease Webhook', 'Prerelease Validate'), ('Prerelease Validate', 'Prerelease Valid?'), ('Fetch Release Pages', 'Prerelease Verdict'), ('Prerelease Verdict', 'Respond Prerelease')]:
    _plink(_a, _b)
_plink('Prerelease Valid?', 'Fetch Release Pages', 0); _plink('Prerelease Valid?', 'Respond Prerelease Bad Request', 1)
_pnames = {n['name'] for n in _PN}
for _s, _o in _PC.items():
    assert _s in _pnames, _s
    for _lists in _o.values():
        for _l in _lists:
            for _t in _l: assert _t['node'] in _pnames, _t['node']
_pcode = {n['name']: n['parameters']['jsCode'] for n in _PN if n['type'] == 'n8n-nodes-base.code'}
assert all('const PW = (() => {' in c for c in _pcode.values()) and not any('/*__PAGE_WATCH__*/' in c for c in _pcode.values()), 'G27: the page-watch kit is not inlined in the pre-release check'
assert "writes: 'none'" in _pcode['Prerelease Verdict'] and 'exit_code' in _pcode['Prerelease Verdict'], 'G27: the verdict is not machine-readable'
assert not any(n['type'] in (DT_TYPE, 'n8n-nodes-base.executeWorkflow') for n in _PN), 'G27: a pre-release check must write nothing — no Data Table node, no sub-workflow'
assert all(n.get('credentials') for n in _PN if n['type'] == 'n8n-nodes-base.webhook'), 'pre-release check: the webhook has no credential'
pwf = {"id": "SEOagentPreRel1", "name": "SEO Agent — Pre-release Check", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl", "executionTimeout": 120}, "tags": [], "nodes": _PN, "connections": _PC}
url_lint.check(pwf)   # D15: no node builds a site URL by hand (url_lint.py)
retry_lint.check(pwf)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
json.dump([freeze_ids(pwf)], open(os.path.join(os.path.dirname(_out), 'SEO_Agent_Prerelease.json'), 'w'), indent=2, ensure_ascii=False)
if os.path.isdir(_code):
    for _n in _PN:
        if _n['type'] == 'n8n-nodes-base.code': open(os.path.join(_code, re.sub(r'[^A-Za-z0-9_.-]+', '_', _n['name']) + '.js'), 'w').write(_n['parameters']['jsCode'])
# the wiring the harness checks (S62): the workflow JSON is not copied into the container, so what matters about it travels as data —
# that it answers synchronously, that its fetch does not follow redirects, and above all that it holds no node that could write anything
_pre_wiring = {'workflow': pwf['id'], 'path': _pre_hook['path'], 'authentication': _pre_hook['authentication'], 'response_mode': _pre_hook['responseMode'],
               'nodes': [n['name'] for n in _PN], 'node_types': sorted({n['type'] for n in _PN}),
               'writes': [n['name'] for n in _PN if n['type'] in (DT_TYPE, 'n8n-nodes-base.executeWorkflow', 'n8n-nodes-base.emailSend')],
               'responses': {n['name']: n['parameters']['options']['responseCode'] for n in _PN if n['type'] == 'n8n-nodes-base.respondToWebhook'},
               'fetch': {'name': 'Fetch Release Pages', 'follows_redirects': _PRE_GET['options']['redirect']['redirect']['followRedirects'],
                         'response_format': _PRE_GET['options']['response']['response']['responseFormat'], 'retries': retry_lint.RETRY['maxTries']},
               'connections': {k: [[t['node'] for t in (l or [])] for l in v['main']] for k, v in _PC.items()}}
if os.path.isdir(os.path.join(_here, 'harness')):
    json.dump(_pre_wiring, open(os.path.join(_here, 'harness', 'prerelease_wiring.json'), 'w'), indent=1)
print('Pre-release Check workflow written:', len(_PN), 'nodes')

# =============================================================================
# SEO Agent — Publish Check (B3-7, 2026-10-16, FIX_PLAN.md §3.16; benchmark area 3, BENCH_AREA3_content.md): "is this page
#     publishable?" without a $0.80 content run. `POST /webhook/seo-publish-check` (same header credential as the API front door),
#     synchronous, free: the DETERMINISTIC half of the content gate over Markdown the caller supplies — everything but the Claude calls.
#     One copy of every rule: *Content QA* and *Originality Check* here are the generated main workflow's own node code, copied from
#     workflows/SEO_Agent_v4.json after build_v4.py wrote it, and asserted byte-identical below. *Parse Brief* builds the context those
#     nodes read in a content run (Content QA reads `$('Parse Brief')`), with `qa_max_rounds: 1`, so "not ready" here is exactly what a
#     content run would deliver as "did not pass the quality check". It is a READ: no Data Table node, no sub-workflow, no HTTP node.
# =============================================================================
_PCW = json.load(open(os.path.join(os.path.dirname(_out), 'SEO_Agent_v4.json'), encoding='utf-8'))[0]
_PC_MAIN = {n['name']: n['parameters'].get('jsCode', '') for n in _PCW['nodes'] if n['type'] == 'n8n-nodes-base.code'}
assert _PC_MAIN.get('Content QA') and _PC_MAIN.get('Originality Check'), 'B3-7: the main workflow has no Content QA / Originality Check to reuse'
_pc_kit = lambda f: _rd5('code/' + f).replace('/*__COVERAGE__*/', _rd5('code/_coverage.js').rstrip('\n')).replace('/*__SITE_MODEL__*/', _rd5('code/_site_model.js').rstrip('\n')).replace('/*__FIT_GATE__*/', _rd5('code/_fit_gate.js').rstrip('\n'))   # A-16: the fit gate's brand labels for the subtopics
_PC_BRIEF = _pc_kit('PubCheck_Parse_Brief.js')
assert '/*__FIT_GATE__*/' not in _PC_BRIEF and 'const fitLabels' in _PC_BRIEF and not _PC_BRIEF.startswith('/*__') and _PC_BRIEF.count('const CVG = (() => {') == 1 and _PC_BRIEF.count('const SM = (() =>') == 1 and 'const CVG = (() => {' in _PC_BRIEF and 'const SM = (() =>' in _PC_BRIEF, 'B3-7: a kit placeholder is left in the publish check'
def _pcn(name, ntype, ver, params, pos_, **extra):
    n = {'parameters': params, 'id': str(uuid.uuid5(_NID_NS, 'pubcheck:' + name)), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos_}; n.update(extra); return n
_pc_hook = {"httpMethod": "POST", "path": "seo-publish-check", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}}
_PCN = [
  _pcn('Publish Check Webhook', 'n8n-nodes-base.webhook', 2, _pc_hook, [0, 0], webhookId='8c2b4e61-5d0f-4a3e-b7c9-41f6a2d95e07', credentials={"httpHeaderAuth": {"id": "SEOcredApiHeader", "name": "SEO API Key"}}),
  _pcn('Parse Brief', 'n8n-nodes-base.code', 2, {'jsCode': _PC_BRIEF}, [220, 0]),
  _pcn('Publish Check Valid?', 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': str(uuid.uuid5(_NID_NS, 'pubcheck:valid:c')), 'leftValue': '={{ $json.ok }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, [440, 0]),
  _pcn('Content QA', 'n8n-nodes-base.code', 2, {'jsCode': _PC_MAIN['Content QA']}, [660, -100]),
  _pcn('Originality Check', 'n8n-nodes-base.code', 2, {'jsCode': _PC_MAIN['Originality Check']}, [880, -100]),
  _pcn('Publish Check Verdict', 'n8n-nodes-base.code', 2, {'jsCode': _rd5('code/Publish_Check_Verdict.js')}, [1100, -100]),
  _pcn('Respond Publish Check', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify($json.body) }}", 'options': {'responseCode': 200}}, [1320, -100]),
  _pcn('Respond Publish Check Bad Request', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: false, verdict: 'error', exit_code: 2, error: $json.error, errors: $json.errors, writes: 'none' }) }}", 'options': {'responseCode': 400}}, [660, 140]),
  _pcn('Note (Publish Check)', 'n8n-nodes-base.stickyNote', 1, {'content': "## SEO Agent — Publish Check (B3-7, v4.17)\n`POST /webhook/seo-publish-check` (header auth: credential **SEO API Key**, header `X-API-Key`), synchronous (a second or two), **free** — no model, no fetch, no row written.\n\nIt runs the **deterministic half of the content gate** over the Markdown you send: *Content QA* and *Originality Check* are the content run's own node code, copied by the build and asserted identical, so a page that fails here is a page a content run would deliver as \"not ready to publish\". *Parse Brief* is named after the node of the content run whose part it plays (Content QA reads `$('Parse Brief')`).\n\nBody: `{ markdown, keyword, domain?, page_type?, target_words?, terms?, competitors?: [{url, content, rank?, title?}], sources?: [{url, text}], internal_links?, business_facts?, currency?, country?, ai_question?, ai_fanout? }`.\n\n**200** `{ ok, publishable, verdict: 'publishable' | 'not_publishable', exit_code: 0 | 1, label, summary, reasons, content_score, score_breakdown, warnings, advice, checks, fixed_markdown, auto_fixes, schema_types, not_checked: [{check, reason}], writes: 'none', cost_usd: 0 }` · **400** field errors (`exit_code: 2`).\nCI in one line: `curl -s -H \"X-API-Key: …\" -H 'Content-Type: application/json' -d @page.json $URL/webhook/seo-publish-check | jq -e '.exit_code == 0'`.\n\nWhat it cannot judge from what was sent (the editor's review — a model call —, figures without their source text, coverage without terms, originality without competitor pages, length without a target) is listed in `not_checked` **with the reason**, never as a pass.", 'height': 560, 'width': 780, 'color': 4}, [-40, -660]),
]
_PCC = {}
def _pclink(a, b, out=0):
    outs = _PCC.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
for _a, _b in [('Publish Check Webhook', 'Parse Brief'), ('Parse Brief', 'Publish Check Valid?'), ('Content QA', 'Originality Check'), ('Originality Check', 'Publish Check Verdict'), ('Publish Check Verdict', 'Respond Publish Check')]:
    _pclink(_a, _b)
_pclink('Publish Check Valid?', 'Content QA', 0); _pclink('Publish Check Valid?', 'Respond Publish Check Bad Request', 1)
_pcnames = {n['name'] for n in _PCN}
for _s, _o in _PCC.items():
    assert _s in _pcnames, _s
    for _lists in _o.values():
        for _l in _lists:
            for _t in _l: assert _t['node'] in _pcnames, _t['node']
_pccode = {n['name']: n['parameters']['jsCode'] for n in _PCN if n['type'] == 'n8n-nodes-base.code'}
# one copy of every rule: the gate here IS the content run's gate
assert _pccode['Content QA'] == _PC_MAIN['Content QA'] and _pccode['Originality Check'] == _PC_MAIN['Originality Check'], 'B3-7: the publish check runs a different gate from the content run'
assert "$('Parse Brief').first().json" in _pccode['Content QA'], 'B3-7: Content QA no longer reads its context from Parse Brief — the publish check would pass it nothing'
assert 'qa_max_rounds: 1' in _pccode['Parse Brief'] and "writes: 'none'" in _pccode['Publish Check Verdict'] and 'exit_code' in _pccode['Publish Check Verdict'], 'B3-7: the verdict is not machine-readable or allows a second round'
assert not re.search(r"\b(?:qa|content_qa|v)\s*(?:\.\s*(?:publishable|not_ready|passed|quality_label|not_ready_reasons|quality)|\[\s*['\"](?:publishable|not_ready)['\"]\s*\])\s*=[^=]", _pccode['Publish Check Verdict']), 'B3-7: the verdict node must read the gate, never change it'
assert not any(n['type'] in (DT_TYPE, 'n8n-nodes-base.executeWorkflow', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.emailSend') or 'langchain' in n['type'] for n in _PCN), 'B3-7: a publish check must write, fetch and call nothing'
assert all(n.get('credentials') and n.get('webhookId') for n in _PCN if n['type'] == 'n8n-nodes-base.webhook'), 'publish check: the webhook needs its credential and a webhookId'
pcwf = {"id": "SEOagentPubCheck", "name": "SEO Agent — Publish Check", "active": False, "settings": {"executionOrder": "v1", "errorWorkflow": "SEOagentErrHandl", "executionTimeout": 60}, "tags": [], "nodes": _PCN, "connections": _PCC}
url_lint.check(pcwf)   # D15: no node builds a site URL by hand (url_lint.py)
retry_lint.check(pcwf)   # G1: every external HTTP node carries the retry rule (there is none here)
json.dump([freeze_ids(pcwf)], open(os.path.join(os.path.dirname(_out), 'SEO_Agent_Publish_Check.json'), 'w'), indent=2, ensure_ascii=False)
if os.path.isdir(_code):
    # Content QA / Originality Check are the main workflow's files already (identical code); the two nodes of its own are prefixed so
    # they never overwrite the content run's *Parse Brief*
    open(os.path.join(_code, 'PubCheck__Parse_Brief.js'), 'w').write(_pccode['Parse Brief'])
    open(os.path.join(_code, 'Publish_Check_Verdict.js'), 'w').write(_pccode['Publish Check Verdict'])
_pc_wiring = {'workflow': pcwf['id'], 'path': _pc_hook['path'], 'authentication': _pc_hook['authentication'], 'response_mode': _pc_hook['responseMode'],
              'credential': 'SEOcredApiHeader', 'nodes': [n['name'] for n in _PCN], 'node_types': sorted({n['type'] for n in _PCN}),
              'writes': [n['name'] for n in _PCN if n['type'] in (DT_TYPE, 'n8n-nodes-base.executeWorkflow', 'n8n-nodes-base.emailSend', 'n8n-nodes-base.httpRequest')],
              'responses': {n['name']: n['parameters']['options']['responseCode'] for n in _PCN if n['type'] == 'n8n-nodes-base.respondToWebhook'},
              'same_gate_as_content_run': {'Content QA': True, 'Originality Check': True},
              'connections': {k: [[t['node'] for t in (l or [])] for l in v['main']] for k, v in _PCC.items()}}
if os.path.isdir(os.path.join(_here, 'harness')):
    json.dump(_pc_wiring, open(os.path.join(_here, 'harness', 'pubcheck_wiring.json'), 'w'), indent=1)
print('Publish Check workflow written:', len(_PCN), 'nodes')
