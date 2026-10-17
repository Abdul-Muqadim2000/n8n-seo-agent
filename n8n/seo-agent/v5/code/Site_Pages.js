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
// A-4 (2026-10-17, re-rating exec 758): the generic-title fallback named /industries "Banking Financial Services" - the MENU text of an
// anchor inside it (/industries#bfsi) - while the page's own HTML title is "Industries We Serve | Tech&". The site's page inventory
// (seo_pages, read from each page's HTML by the weekly site check; carried by the site model) holds that title, so it comes first now;
// the link text, the first heading and the path stay the fallbacks for a page the inventory has not read.
const MODEL = (() => { try { const m = $('Site Model').first().json.site_model; return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } })();
const keyOf = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const noBrand = (t) => String(t || '').replace(/\s*[|–—]\s*[^|–—]{1,30}$/, '').trim();   // "Industries We Serve | Tech&" -> the page's own words
const invTitle = new Map(((MODEL && MODEL.pages) || []).filter(x => x && x.url && noBrand(x.title)).map(x => [keyOf(x.url), noBrand(x.title)]));
// every URL this node prints is on the host the site serves (the model's canonical host), never the bare domain that redirects
const CANON = String((MODEL && MODEL.canonical_host) || '').toLowerCase();
const canonUrl = (u) => { const m = String(u || '').match(/^https?:\/\/([^\/?#]+)(.*)$/i); if (!m || !CANON) return String(u || '');
  const h = m[1].toLowerCase(); return (h.replace(/^www\./, '') === CANON.replace(/^www\./, '')) ? 'https://' + CANON + (m[2] || '/') : String(u); };
const pageTitle = (i, p, c) => {
  const t = normT(c.title);
  const generic = !t || t === normT(home.page_title) || titleCount[t] > 1;
  if (!generic) return c.title.trim();
  const inv = invTitle.get(keyOf(p.url)); if (inv && normT(inv) !== normT(home.page_title)) return inv;
  const link = String(p.text || '').replace(/\s+/g, ' ').trim();
  return (link.length >= 4 ? link : '') || firstHeading(c.text) || link || pathTitle(p.url) || String(p.path || '');
};
const site_pages = [{ url: canonUrl('https://' + String(home.domain || '').replace(/^https?:\/\//, '').replace(/\/?$/, '/')), title: home.page_title || '', kind: 'homepage', words: String(home.site_text || '').split(/\s+/).filter(Boolean).length }];
// A-4: `site_facts` is what the site says about ITSELF (the critic may not call those invented). A heading is not a fact when it is a
// section label ("What We Do", "Industries We Serve", "Insights"), a call to action or a question ("Ready to Transform Your Business?"),
// or the title of one of the site's own articles (an /insights/ page of the inventory): those are left out, and counted.
const ARTICLE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts)\/[^/]+/i;
const slugOf = (t) => String(t || '').toLowerCase().replace(/&/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const articles = ((MODEL && MODEL.pages) || []).map(x => String((x && x.url) || '').replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '')).filter(u => ARTICLE.test(u));
const articleSlugs = new Set(articles.map(u => u.replace(/\/+$/, '').split('/').pop()));
const articleTitles = new Set(((MODEL && MODEL.pages) || []).filter(x => x && ARTICLE.test(String(x.url || '').replace(/^https?:\/\/[^/]+/i, ''))).map(x => normT(noBrand(x.title))).filter(Boolean));
const LABEL = /^(?:what we do|who we are|about(?: us)?|our (?:services|solutions|approach|clients|partners|team|story|mission|vision|values|work)|industries(?: we serve)?|services|solutions|capabilities|insights|blog|news|resources|case studies|testimonials|contact(?: us)?|get in touch|why (?:choose )?us|proven track record|global partner|strong client base|regional expertise|industry context|common pain points|available:?|latest .*|featured .*|tech&? capabilities)$/i;
const notFact = (h) => { const n = normT(h).replace(/[.:!]+$/, ''); return LABEL.test(n) || /\?/.test(h) || /^(?:ready to|let'?s|talk to|book|request|have questions)/i.test(n) || articleTitles.has(n)
  || [...articleTitles].some(a => a.length >= 25 && (a.startsWith(n) || n.startsWith(a)))
  || (slugOf(h).length >= 20 && [...articleSlugs].some(sl => sl === slugOf(h) || (sl.length >= 25 && (sl.startsWith(slugOf(h)) || slugOf(h).startsWith(sl))))); };
let facts_dropped = 0;
const keepFact = (h) => { if (notFact(h)) { facts_dropped++; return false; } return true; };
const site_facts = headingsOf(home.site_text).filter(keepFact);
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
  site_pages.push({ url: canonUrl(p.url), title, kind: 'nav', words: body.split(/\s+/).filter(Boolean).length });
  for (const h of headingsOf(c.text)) if (!site_facts.includes(h) && keepFact(h)) site_facts.push(h);
});

// A-4: a "Read more about ..." article link is not a menu page, and every menu URL is on the canonical host
const nav_pages = Array.isArray(home.nav_pages) ? home.nav_pages.filter(n => n && !/^\s*(?:read more|learn more|continue reading|view more|see more)\b/i.test(String(n.text || ''))).map(n => ({ ...n, url: canonUrl(n.url) })) : home.nav_pages;
return [{ json: { ...home, ...(nav_pages !== undefined ? { nav_pages } : {}), site_text: home.site_text, pages_text: block.trim(), site_pages, site_facts: site_facts.slice(0, CONFIG.max_facts),
  site_facts_dropped: facts_dropped, pages_failed, pages_read_count: site_pages.length } }];
