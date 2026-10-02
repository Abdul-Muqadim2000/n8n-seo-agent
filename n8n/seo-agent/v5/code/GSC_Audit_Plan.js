// Search Console + site-structure checks for the audit: keeps the incoming audit item, picks the pages to inspect in Search Console
// (home, shallow and well-linked indexable pages, max 25), lists the crawled URLs for the sitemap comparison, and the 28-day window.
const base = $input.first().json || {};
const crawl = $('Check Crawl').first().json || {};
const domain = String(crawl.domain || base.domain || '').toLowerCase();
let items = []; try { items = ($('Get Crawled Pages').first().json.tasks || [])[0].result[0].items || []; } catch (e) { items = []; }
const norm = (u) => String(u || '').trim().replace(/#.*$/, '');
const pages = items.filter(p => p && p.url && (p.resource_type || 'html') === 'html').map(p => ({ url: norm(p.url), status: Number(p.status_code) || 0, depth: p.click_depth == null ? null : Number(p.click_depth), inbound: Number((p.meta || {}).inbound_links_count ?? p.inbound_links_count ?? 0) || 0,
  canonical: String((p.meta || {}).canonical || ''), title: String((p.meta || {}).title || ''), orphan: !!(p.checks && p.checks.is_orphan_page), redirect: !!(p.checks && (p.checks.is_redirect || p.checks.redirect_loop)), broken: !!(p.checks && (p.checks.is_broken || p.checks.is_4xx_code || p.checks.is_5xx_code)) }));
const key = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');   // crawls report www while canonicals may use the bare domain (live finding 2026-10-02)
const indexable = pages.filter(p => p.status === 200 && !p.redirect && !p.broken && (!p.canonical || key(p.canonical) === key(p.url)));
const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u);
// Inspect the canonical URL when the page names one on this domain: crawls report www while Google indexes the canonical host (live finding 2026-10-02: 25 www URLs 'unknown to Google')
const onDomain = (u) => { const h = (String(u || '').match(/^https?:\/\/([^\/?#:]+)/i) || [])[1]; return !!h && (h.toLowerCase().replace(/^www\./, '') === domain || h.toLowerCase().endsWith('.' + domain)); };
const inspectUrl = (p) => (p.canonical && onDomain(p.canonical)) ? p.canonical : p.url;
const seenInspect = new Set();
const sample = [...indexable].sort((a, b) => (isHome(b.url) - isHome(a.url)) || ((a.depth ?? 9) - (b.depth ?? 9)) || (b.inbound - a.inbound)).filter(p => { const k = key(inspectUrl(p)); if (seenInspect.has(k)) return false; seenInspect.add(k); return true; }).slice(0, 25);
const end = new Date(Date.now() - 3 * 864e5); end.setUTCHours(0, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10);
return [{ json: { base, domain, crawl_pages: pages.length, crawl_indexable: indexable.length, crawl_limit: Number(crawl.crawl_max_pages) || 200, crawl_finished: !!crawl.crawl_finished, pages_crawled: Number(crawl.pages_crawled) || pages.length,
  pages: pages.map(p => ({ url: p.url, status: p.status, depth: p.depth, inbound: p.inbound, orphan: p.orphan, indexable: indexable.includes(p) })), sample: sample.map(inspectUrl),
  sitemap_url: 'https://' + domain + '/sitemap.xml', range: { start: iso(new Date(end.getTime() - 27 * 864e5)), end: iso(end) } } }];
