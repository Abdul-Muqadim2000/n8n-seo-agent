// Cleans the client's pages and extracts cheap trust signals (phone, email, years, certifications, counts).
const ctx = $('Collect Site URLs').first().json;
const reqs = $('Client Page Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const strip = (s) => String(s || '')
  .replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>]+/g, '').replace(/^#+\s*/gm, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const pages = reqs.map((r, i) => {
  const j = res[i] || {};
  const text = strip(j.page_text || j.data || '');
  if (j.error || text.length < 200 || /just a moment|access denied|captcha/i.test(text.slice(0, 400))) return null;
  return { url: r.url, kind: r.kind, words: text.split(/\s+/).length, text: text.slice(0, r.kind === 'existing' ? 9000 : 6000) };
}).filter(Boolean);
const existing = pages.find(p => p.kind === 'existing');
const all = pages.map(p => p.text).join('\n');
const uniq = (a) => [...new Set((a || []).map(s => s.trim()))];
const client_signals = {
  phone_shown: /\+?\d[\d\s().-]{7,}\d/.test(all),
  email_shown: /[\w.+-]+@[\w-]+\.[\w.]+/.test(all),
  years_claims: uniq(all.match(/\b\d{1,2}\+?\s*years?\b[^.\n]{0,40}/gi)).slice(0, 3),
  credentials: uniq(all.match(/\b(ISO\s?\d{4,5}|certified|accredited|licensed|award(?:ed|-winning)?|official partner|gold partner|silver partner)\b[^.\n]{0,60}/gi)).slice(0, 5),
  numbers: uniq(all.match(/\b\d[\d,.]*\+?\s?(clients?|customers?|projects?|users?|countries|offices|employees|staff|locations|installations?|reviews?)\b/gi)).slice(0, 6),
  locations: uniq(all.match(/\b(Dubai|Abu Dhabi|Sharjah|Riyadh|Jeddah|London|Manchester|New York|Toronto|Sydney|Singapore|Karachi|Lahore|Islamabad|Mumbai|Delhi|Bangalore|Berlin|Paris|Madrid|Amsterdam)\b/g)).slice(0, 5)
};
return [{ json: { ...ctx, client_pages: pages, client_pages_read: pages.length, existing_page_text: existing ? existing.text : '', client_signals } }];
