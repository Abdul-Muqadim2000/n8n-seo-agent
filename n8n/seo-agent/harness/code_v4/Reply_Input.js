// Reply Reader (v4.13, LINK_BUILDER_SPEC.md §2): one reply to a link-building e-mail, sent by the web app as JSON. Checked and trimmed here;
// pages it names on the prospect's site (or the page we pitched) are fetched next to check for our link at once.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const s = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, n);
const domain = normD(b.domain), prospect = normD(b.prospect_domain);
const errors = [];
if (!domain) errors.push('domain is required'); if (!s(b.reply_text, 10).trim()) errors.push('reply_text is required');
const text = s(b.reply_text, 6000);
const urls = [...new Set([...(text.match(/https?:\/\/[^\s<>"')\]]+/gi) || []).map(u => u.replace(/[.,;:!?]+$/, '')).filter(u => prospect && (normD(u) === prospect || normD(u).endsWith('.' + prospect))), ...(b.page_url ? [s(b.page_url, 500)] : [])])].slice(0, 3);
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, prospect_domain: prospect, business: s(b.business || domain, 120), signer: s(b.signer || '[Your name]', 160), facts: s(b.facts, 1500),
  our_subject: s(b.our_subject, 200), our_body: s(b.our_body, 3000), reply_from: s(b.reply_from, 200), reply_subject: s(b.reply_subject, 200), reply_text: text, received_at: s(b.received_at, 40), urls } }];
