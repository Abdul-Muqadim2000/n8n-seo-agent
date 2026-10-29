// Cleans the client's pages and extracts cheap trust signals (phone, email, years, certifications, counts).
// R38 (2026-10-16): the verdict told a customer their page "has no mandate dates, no tables, no author or date" about a page that has all
// three — three cuts (9,000 characters here, 3,500 in the analyzer's prompt, 5,000 in the copywriter's) and a reader (Jina, with the header /
// aside selectors removed) that flattens tables into plain lines and drops the byline. So this node now (1) keeps the whole existing page
// (CONFIG.existing_chars), (2) measures the page's FACTS on the whole of it — dates in the body text, headings, and, from the page's own HTML
// (the node *Read Client Page HTML* in front of this one), tables, byline, publication date, schema types, call to action — and (3) hands
// every later node that digest, so an absence is asserted only for what was actually read (and the verdict's post-check, `_page_claims.js`,
// refuses any claim the digest contradicts).
const CONFIG = { existing_chars: 24000, other_chars: 6000, headings: 30, dates: 8, table_rows: 6, tables_shown: 3, min_html_words: 120 };
const ctx = $('Collect Site URLs').first().json;
const reqs = $('Client Page Requests').all().map(i => i.json);
// the Jina answers: read from their own node when the HTML read sits between (as wired); a direct feed keeps working (harness, older wiring)
let jina = null, htmlRes = [];
try { jina = $('Read Client Pages').all().map(i => i.json); htmlRes = $input.all().map(i => i.json); } catch (e) { jina = null; }
const res = jina || $input.all().map(i => i.json);
const strip = (s) => String(s || '')
  .replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>]+/g, '').replace(/^#+\s*/gm, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ---- the page's facts, measured on the WHOLE page (R38) ----
const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_RES = [
  new RegExp('\\b\\d{1,2}(?:st|nd|rd|th)?\\s+' + MONTHS + '\\.?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  new RegExp('\\b' + MONTHS + '\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  new RegExp('\\b' + MONTHS + '\\.?\\s+(?:19|20)\\d{2}\\b', 'g'),
  /\b20\d{2}-\d{2}-\d{2}\b/g
];
const datesIn = (text) => {
  const out = [];
  for (const re of DATE_RES) for (const m of String(text || '').match(re) || []) { const d = m.replace(/\s+/g, ' ').trim(); if (!out.some(x => x.toLowerCase().indexOf(d.toLowerCase()) >= 0)) out.push(d); }
  return out.slice(0, CONFIG.dates);
};
const textOfHtml = (h) => String(h || '').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;|&rsquo;/gi, "'").replace(/&quot;/gi, '"').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const jsonLd = (html) => {
  const out = [];
  for (const m of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1].trim()); const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { out.push(x); if (x['@graph']) walk(x['@graph']); } }; walk(j); } catch (e) {}
  }
  return out;
};
const nameOf = (a) => Array.isArray(a) ? nameOf(a[0]) : (a && typeof a === 'object' ? String(a.name || '') : String(a || ''));
const tableRows = (t) => {
  const rows = [];
  for (const r of String(t).match(/<tr[\s>][\s\S]*?<\/tr>/gi) || []) {
    const cells = (r.match(/<t[hd][\s>][\s\S]*?<\/t[hd]>/gi) || []).map(c => textOfHtml(c)).filter(Boolean);
    if (cells.length) rows.push(cells.join(' | '));
  }
  return rows;
};
// what the page's own HTML says; `reliable` = the server sent the page's real text (a JavaScript shell says nothing about its tables or byline)
const htmlFacts = (html) => {
  const h = String(html || '');
  if (h.length < 1500 || /just a moment|access denied|captcha|attention required/i.test(h.slice(0, 1500).replace(/<[^>]+>/g, ' '))) return { read: false, reliable: false };
  const words = textOfHtml(h).split(/\s+/).filter(Boolean).length;
  const ld = jsonLd(h);
  const ldTypes = [...new Set(ld.map(x => [].concat(x['@type'] || [])).reduce((a, b) => a.concat(b), []).map(String))].slice(0, 8);
  const article = ld.find(x => [].concat(x['@type'] || []).some(t => /article|blogposting|newsarticle/i.test(String(t)))) || {};
  const tables = h.match(/<table[\s>][\s\S]*?<\/table>/gi) || [];
  const meta = (re) => ((h.match(re) || [])[1] || '').trim();
  let author = nameOf(article.author) || meta(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || meta(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
  if (!author) { const m = h.match(/<(?:a|span|p|div|address|strong|li)[^>]*(?:class|rel)=["'][^"']*(?:author|byline|by-line)[^"']*["'][^>]*>([\s\S]{1,300}?)<\/(?:a|span|p|div|address|strong|li)>/i); if (m) author = textOfHtml(m[1]); }
  author = textOfHtml(author).replace(/^\s*(?:by|written by|author)[:\s]+/i, '').trim();   // entities decoded (a byline read "Tech&amp;" live, 2026-10-16)
  if (author.length > 80 || /^(?:admin|administrator)$/i.test(author)) author = '';   // a platform's default login is not a byline
  const published = String(article.datePublished || meta(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) || meta(/<time[^>]+datetime=["']([^"']+)["']/i) || '').slice(0, 10);
  const modified = String(article.dateModified || meta(/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i) || '').slice(0, 10);
  // a call to action in the page's own content: not the site header / navigation / footer (those say "Contact" on every page)
  const body = h.replace(/<(header|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const cta = /href=["'](?:mailto:|tel:)/i.test(body) || [...body.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)].some(m => /\b(contact|get in touch|book a|book your|schedule a|request a|talk to|speak (?:to|with)|get a quote|free consultation|get started|enquir|inquir|demo)\b/i.test(textOfHtml(m[1])));
  return { read: true, reliable: words >= CONFIG.min_html_words, words, title: meta(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, ' ').slice(0, 160),
    tables: tables.length, tables_text: tables.slice(0, CONFIG.tables_shown).map(t => tableRows(t).slice(0, CONFIG.table_rows)),
    author, published, modified, cta, schema_types: ldTypes };
};
const headingsOf = (raw) => [...new Set(String(raw || '').split('\n').filter(l => /^#{1,4}\s/.test(l.trim())).map(l => l.replace(/^#+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()).filter(h => h.length >= 3))].slice(0, CONFIG.headings);

const digestOf = (req, raw, text, html, given) => {
  const hf = htmlFacts(html);
  const dates = datesIn(text);
  const structure = hf.read && hf.reliable;
  const d = { url: req.url, words: text.split(/\s+/).filter(Boolean).length, chars_total: text.length, chars_given: given, cut: given < text.length,
    headings: headingsOf(raw), dates, html_read: !!hf.read, structure_reliable: structure,
    html_title: hf.title || '', tables: structure ? hf.tables : null, tables_text: structure ? hf.tables_text : [],
    author: structure ? hf.author : '', published: structure ? hf.published : '', modified: structure ? hf.modified : '',
    cta: structure ? !!hf.cta : (/\b(contact us|get in touch|book a|request a|talk to|get a quote|free consultation)\b/i.test(text) ? true : null), schema_types: structure ? hf.schema_types : [] };
  // the same facts in words, for the prompts (the analyzer and the verdict read this block; an absence is only claimed from what it says)
  const L = [];
  L.push('PAGE FACTS, measured on the WHOLE page (' + d.words + ' words; the text shown to you carries ' + Math.min(given, d.chars_total) + ' of ' + d.chars_total + ' characters' + (d.cut ? ' - it is CUT: say nothing is missing from the part you cannot see' : '') + '):');
  L.push('- Dates written in the body text: ' + (dates.length ? dates.join('; ') : 'none found'));
  if (structure) {
    L.push('- Tables on the page: ' + d.tables + (d.tables ? ' (their rows follow in the text below)' : ''));
    L.push('- Author / byline: ' + (d.author || 'none found in the page\'s HTML'));
    L.push('- Publication / update date: ' + ([d.published && 'published ' + d.published, d.modified && 'updated ' + d.modified].filter(Boolean).join(', ') || 'none found in the page\'s HTML'));
    L.push('- Call to action in the page content: ' + (d.cta ? 'yes' : 'none found'));
    if (d.schema_types.length) L.push('- Structured data: ' + d.schema_types.join(', '));
  } else {
    L.push('- Tables, author, publication date, call to action: NOT CHECKED (the page\'s HTML could not be read in full, and the text reader drops tables and bylines). Never say the page lacks them.');
  }
  if (d.headings.length) L.push('- Headings: ' + d.headings.slice(0, 20).join(' | '));
  d.facts_text = L.join('\n');
  d.tables_block = (structure && d.tables_text.length) ? 'TABLES ON THE PAGE (from its HTML; the text reader flattened them):\n' + d.tables_text.map((t, i) => 'Table ' + (i + 1) + ':\n' + t.join('\n')).join('\n') : '';
  return d;
};

let existingDigest = null;
const pages = reqs.map((r, i) => {
  const j = res[i] || {};
  const rawText = String(j.page_text || j.data || '');
  const text = strip(rawText);
  if (j.error || text.length < 200 || /just a moment|access denied|captcha/i.test(text.slice(0, 400))) return null;
  const cap = r.kind === 'existing' ? CONFIG.existing_chars : CONFIG.other_chars;
  const h = htmlRes[i] || {};
  if (r.kind === 'existing' && !existingDigest) existingDigest = digestOf(r, rawText, text, h.error ? '' : (h.page_html != null ? h.page_html : (h.data != null ? h.data : h.body)), Math.min(cap, text.length));
  return { url: r.url, kind: r.kind, words: text.split(/\s+/).length, text: text.slice(0, cap) };
}).filter(Boolean);
const existing = pages.find(p => p.kind === 'existing');
// P2-5 (2026-10-12, Phase 2 live check §3): a page of the inventory that already answers this keyword (Client Page Requests -> SM.matchPage)
// becomes this run's existing page, whether or not the fetch of it succeeded. The verdict, the brief, the schema and the report then improve
// THAT URL — run 444 recommended a second page for "uae e invoicing penalties" although the site's own page had been live since August.
const matchedReq = reqs.find(r => r && r.kind === 'existing' && r.existing_page && r.existing_page.url) || null;
const inventoryPage = (!(ctx.existing_page && ctx.existing_page.url) && matchedReq) ? matchedReq.existing_page : null;
// H2 (2026-10-27, exec 2575): the ladder planned a new page, so a page the sitemap matched is not this run's page to rewrite
const ignoredReq = reqs.find(r => r && r.ignored_existing && r.ignored_existing.url) || null;
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
return [{ json: { ...ctx, ...(inventoryPage ? { existing_page: inventoryPage, existing_page_url: ctx.existing_page_url || inventoryPage.url } : {}),
  ...(ignoredReq ? { existing_page: null, existing_page_ignored: ignoredReq.ignored_existing } : {}),
  client_pages: pages, client_pages_read: pages.length, existing_page_text: existing ? existing.text : '', existing_page_tables: existingDigest ? existingDigest.tables_block : '', existing_page_digest: existingDigest,
  existing_page_facts_text: existingDigest ? existingDigest.facts_text : '', client_signals } }];
