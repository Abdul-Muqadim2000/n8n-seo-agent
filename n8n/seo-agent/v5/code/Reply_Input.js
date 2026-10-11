// Reply Reader (v4.13, LINK_BUILDER_SPEC.md §2): one reply to a link-building e-mail, sent by the web app as JSON. Checked and trimmed here;
// pages it names on the prospect's site (or the page we pitched) are fetched next to check for our link at once.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const s = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, n);
const domain = normD(b.domain), prospect = normD(b.prospect_domain);
const errors = [];
if (!domain) errors.push('domain is required'); if (!s(b.reply_text, 10).trim()) errors.push('reply_text is required');
const text = s(b.reply_text, 6000);
// the facts the answer may state (D14): the owner's business facts + the business profile (author / reviewer / NAP) sent by the app; `facts` alone still works
const profileLines = (pr) => { if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return []; const f = (k) => s(pr[k], 200).trim(); const L = [];
  if (f('business_name')) L.push('Business: ' + f('business_name') + (f('business_type') ? ' — ' + f('business_type') : '')); else if (f('business_type')) L.push('Business type: ' + f('business_type'));
  if (f('author_name')) L.push('Spokesperson / author: ' + [f('author_name'), f('author_job_title'), f('author_credentials')].filter(Boolean).join(', '));
  if (f('reviewer_name')) L.push('Reviewer: ' + [f('reviewer_name'), f('reviewer_job_title')].filter(Boolean).join(', '));
  const addr = [f('street_address'), f('city'), f('region'), f('postal_code'), f('country') || f('country_code')].filter(Boolean).join(', '); if (addr) L.push('Address: ' + addr);
  if (f('phone')) L.push('Phone: ' + f('phone')); if (f('public_email')) L.push('E-mail: ' + f('public_email')); if (f('service_areas')) L.push('Service areas: ' + f('service_areas'));
  return L; };
const facts = [s(b.business_facts, 1500).trim(), s(b.facts, 1500).trim(), ...profileLines(b.profile)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('\n').slice(0, 2500);
const urls = [...new Set([...(text.match(/https?:\/\/[^\s<>"')\]]+/gi) || []).map(u => u.replace(/[.,;:!?]+$/, '')).filter(u => prospect && (normD(u) === prospect || normD(u).endsWith('.' + prospect))), ...(b.page_url ? [s(b.page_url, 500)] : [])])].slice(0, 3);
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, prospect_domain: prospect, business: s(b.business || domain, 120), signer: s(b.signer || '[Your name]', 160), facts,
  our_subject: s(b.our_subject, 200), our_body: s(b.our_body, 3000), reply_from: s(b.reply_from, 200), reply_subject: s(b.reply_subject, 200), reply_text: text, received_at: s(b.received_at, 40), urls } }];
