// Production 2026-11-10 (devaicon.com): "Re-check page" kept answering "sent at another address than the page it updates" after the client had
// redirected every old address to its new one with a permanent (301) redirect. *Publish Check* now asks how the page the draft updates
// answers, WITHOUT following redirects (*Fetch Updated Address*). This node finds that address the way Publish Check finds the draft's
// content-log row (the request id, else the keyword), and skips the read when the draft updates no page or the address is the one sent.
const d = $('Normalize Input').first().json || {};
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(x => x && typeof x === 'object' && !x.error); } catch (e) { return []; } };
const logs = rowsOf('Load Content Log (Published)');
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hostless = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const domain = normD(d.domain); const kw = norm(d.keyword); const rid = String(d.content_request_id || '').trim();
const log = (rid ? logs.find(l => normD(l.domain) === domain && String(l.request_id) === rid) : null) || (kw ? logs.find(l => normD(l.domain) === domain && norm(l.keyword) === kw) : null) || null;
const old = String((log || {}).existing_page_url || '').trim();
// only an address of this website, over http(s), and not the address that was sent (that page is read by Fetch Published Page already)
const ok = /^https?:\/\/[^\s]+$/i.test(old) && normD(old) === domain && hostless(old) !== hostless(d.published_url);
return [{ json: { skip: !ok, old_url: ok ? old : '' } }];
