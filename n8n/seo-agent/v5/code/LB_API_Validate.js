// Link Builder on demand (POST /webhook/seo-link-builder, header X-API-Key; the web app's "Find opportunities now"): { domain | site_id,
// free_only?, callback_url?, request_id? } — answered at once (accepted), the run starts as its own execution through Manual Run.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(b.domain); const site_id = String(b.site_id || '').trim();
const errors = []; if (!domain && !site_id) errors.push('domain or site_id is required');
if (b.callback_url && !/^https?:\/\//i.test(String(b.callback_url))) errors.push('callback_url must be an http(s) URL');
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, site_id, free_only: /^(true|1|yes|on)$/i.test(String(b.free_only ?? '')), callback_url: String(b.callback_url || ''), email: '', request_id: String(b.request_id || ('lb-' + $execution.id)) } }];
