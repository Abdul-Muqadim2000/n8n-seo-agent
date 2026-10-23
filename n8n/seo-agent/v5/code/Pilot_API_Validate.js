// W2-FIX (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-FIX.md item 2): the AI repeat pilot on demand (POST /webhook/seo-ai-pilot, header
// X-API-Key; the web app's "Repeat pilot" on the AI visibility page): { domain | site_id, confirm?, callback_url?, request_id? } - answered at once
// (accepted), the pilot starts as its own execution through its Manual Run. Without `confirm: true` the pilot only prices itself (callback stage
// ai_pilot_quote) and asks nothing; `confirm` is taken only as the literal true (a string "yes" or a 1 is not a confirmation to spend money).
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(b.domain); const site_id = String(b.site_id || '').trim();
const errors = []; if (!domain && !site_id) errors.push('domain or site_id is required');
if (b.callback_url && !/^https?:\/\//i.test(String(b.callback_url))) errors.push('callback_url must be an http(s) URL');
if (b.confirm !== undefined && b.confirm !== null && typeof b.confirm !== 'boolean') errors.push('confirm must be true or false');
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, site_id, confirm: b.confirm === true, callback_url: String(b.callback_url || ''), email: '', request_id: String(b.request_id || ('pilot-' + $execution.id)) } }];
