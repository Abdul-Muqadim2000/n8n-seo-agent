// Fast validation so callers get an immediate, useful 400. The full validation happens again in the main workflow.
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
} }];