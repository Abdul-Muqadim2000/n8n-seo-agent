// D22 (2026-10-11, system review FIX_PLAN): the homepage AND the menu pages that were read, as one input for the Site Describer. A page that
// failed, was blocked, redirected to something empty or came back nearly text-free is skipped (never an error, never a half-read page in the
// prompt). Each page is trimmed to CONFIG.chars and the whole extra block to CONFIG.total, so the describer stays a cheap Haiku call. The
// headings of every page read become `site_facts`: what this website says about itself, which the critic may not call invented (Parse Critique).
// Both branches of "Nav Pages To Read?" end here, so the homepage path still works when there was nothing to read.
const CONFIG = { chars: 2600, total: 11000, min_words: 25, max_facts: 60, fact_chars: 120 };
const home = $('Clean Site Text').first().json;
let plan = []; try { plan = $('Nav Pages Plan').all().map(i => i.json).filter(p => p && p.url); } catch (e) { plan = []; }
let res = []; try { res = $('Read Nav Pages').all().map(i => i.json); } catch (e) { res = []; }

const stripMd = (s) => String(s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[\s*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*/g, '').replace(/[`_]+/g, '').replace(/[ \t]+/g, ' ').trim();
const headingsOf = (text) => [...new Set(String(text || '').split('\n')
  .filter(l => /^#{1,3}\s/.test(l.trim()))
  .map(l => stripMd(l.replace(/^#+\s*/, '')).replace(/\s+/g, ' ').trim())
  .filter(h => h.length >= 3 && h.length <= CONFIG.fact_chars))];
// the raw Jina answer of one page -> clean text, or null when there is nothing usable
const clean = (raw) => {
  let t = String(raw || '');
  const title = (t.match(/^Title:\s*(.+)$/m) || [])[1] || '';
  if (/access denied|forbidden|captcha|cloudflare|just a moment|enable javascript/i.test(t.slice(0, 500))) return null;
  t = stripMd(t.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:\s*$/m, ''))
    .replace(/\n\s*\n+/g, '\n\n').trim();
  if (t.split(/\s+/).filter(Boolean).length < CONFIG.min_words) return null;
  return { title: title.trim(), text: t };
};

// R52 (2026-10-16): the reader's `Title:` line is the application's generic title on a client-rendered site (exec 606: all five menu pages
// came back as "Tech& | Enterprise Automation & Digital Transformation Solutions", the homepage as another generic one), and the description
// page printed "Pages read:" with that one title five times. A reader title that the homepage already carries, or that two pages of this read
// share, is the site's, not the page's: the page is then named by its menu link text, else by its first heading, else by its path.
const normT = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const firstHeading = (text) => { const m = String(text || '').split('\n').find(l => /^#{1,3}\s+\S/.test(l.trim()) && !/^#{1,3}\s*\d/.test(l.trim())); return m ? stripMd(m.replace(/^\s*#+\s*/, '')).replace(/\s+/g, ' ').trim().slice(0, 90) : ''; };
const pathTitle = (u) => { const seg = String(u || '').replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || ''; return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim(); };
const readerTitles = plan.map((p, i) => { const r = res[i] || {}; const raw = r.page_text != null ? r.page_text : (r.data != null ? r.data : r.body); return normT(((String(raw || '').match(/^Title:\s*(.+)$/m) || [])[1]) || ''); });
const titleCount = {}; readerTitles.forEach(t => { if (t) titleCount[t] = (titleCount[t] || 0) + 1; });
const pageTitle = (i, p, c) => {
  const t = normT(c.title);
  const generic = !t || t === normT(home.page_title) || titleCount[t] > 1;
  if (!generic) return c.title.trim();
  const link = String(p.text || '').replace(/\s+/g, ' ').trim();
  return (link.length >= 4 ? link : '') || firstHeading(c.text) || link || pathTitle(p.url) || String(p.path || '');
};
const site_pages = [{ url: 'https://' + String(home.domain || '').replace(/^https?:\/\//, ''), title: home.page_title || '', kind: 'homepage', words: String(home.site_text || '').split(/\s+/).filter(Boolean).length }];
const site_facts = headingsOf(home.site_text);
const pages_failed = [];
let block = '', used = 0;
plan.forEach((p, i) => {
  const r = res[i] || {};
  const raw = r.page_text != null ? r.page_text : (r.data != null ? r.data : r.body);   // responseFormat text: the body arrives under the named property, else data
  if (r.error || !raw) { pages_failed.push({ url: p.url, reason: r.error ? String(r.error.message || r.error).slice(0, 120) : 'empty response' }); return; }
  const c = clean(raw);
  if (!c) { pages_failed.push({ url: p.url, reason: 'blocked or too little text' }); return; }
  if (used >= CONFIG.total) { pages_failed.push({ url: p.url, reason: 'skipped: enough text already' }); return; }
  const body = c.text.slice(0, Math.min(CONFIG.chars, CONFIG.total - used));
  used += body.length;
  const title = pageTitle(i, p, c);
  block += '\n--- PAGE: ' + title + ' (' + p.url + ') ---\n' + body + '\n';
  site_pages.push({ url: p.url, title, kind: 'nav', words: body.split(/\s+/).filter(Boolean).length });
  for (const h of headingsOf(c.text)) if (!site_facts.includes(h)) site_facts.push(h);
});

return [{ json: { ...home, site_text: home.site_text, pages_text: block.trim(), site_pages, site_facts: site_facts.slice(0, CONFIG.max_facts),
  pages_failed, pages_read_count: site_pages.length } }];
