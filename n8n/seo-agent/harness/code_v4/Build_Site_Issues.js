const base = $('Check Crawl').first().json;
const input = $input.first().json;
const summary = base.crawl_summary || {};
const di = summary.domain_info || {};
const pm = summary.page_metrics || {};
const pages = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];
const probe = input.probe || { findings: [], what_works: [], measurements: {} };
let extras = { duplicate_title: [], duplicate_description: [], non_indexable: [], redirect_chains: [], errors: [] };
try { extras = { ...extras, ...($('Collect Crawl Extras').first().json.crawl_extras || {}) }; } catch (e) {}
const total = pages.length || base.pages_crawled || 1;
const isFull = base.audit_level === 'full';

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };

// ===== 1. DataForSEO page checks =====
const CATALOG = [
  { key: 'is_broken', cat: 'Crawlability & Indexing', sev: 'Critical', title: 'Broken pages (4xx, 5xx or timeout)', why: 'Pages that return errors waste crawl budget and lose any ranking signals pointing to them.', fix: 'Fix or 301-redirect broken URLs to the most relevant live page.' },
  { key: 'no_title', cat: 'On-Page', sev: 'Critical', title: 'Missing title tag', why: 'The title is the strongest on-page ranking signal and the headline shown in search results.', fix: 'Write a unique title (50-60 characters) with the main keyword for each page.' },
  { key: 'lorem_ipsum', cat: 'Content', sev: 'High', title: 'Placeholder (lorem ipsum) text is live', why: 'Dummy text signals an unfinished site and damages trust with users and search engines.', fix: 'Replace all placeholder text with real content before promoting the page.' },
  { key: 'no_h1_tag', cat: 'On-Page', sev: 'High', title: 'Missing H1 heading', why: 'The H1 tells users and search engines what the page is about.', fix: 'Add one clear H1 per page that includes the page topic.' },
  { key: 'is_orphan_page', cat: 'Crawlability & Indexing', sev: 'High', title: 'Orphan pages (no crawlable internal links)', why: 'These pages are only discoverable through the sitemap. They get little internal authority and are crawled less. Often caused by cards or buttons built without real <a href> links.', fix: 'Link to these pages with normal <a href> links from relevant hub pages and menus.' },
  { key: 'canonical_to_broken', cat: 'Crawlability & Indexing', sev: 'High', title: 'Canonical points to a broken URL', why: 'Search engines may ignore or de-index the page.', fix: 'Point the canonical tag to a live, indexable URL.' },
  { key: 'canonical_to_redirect', cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Canonical points to a redirect', why: 'Mixed signals slow down consolidation of ranking signals.', fix: 'Point canonicals directly to the final URL.' },
  { key: 'recursive_canonical', cat: 'Crawlability & Indexing', sev: 'High', title: 'Recursive canonical tags', why: 'Canonical loops confuse search engines about which URL to index.', fix: 'Make each canonical point to a single final URL.' },
  { key: 'https_to_http_links', cat: 'Security', sev: 'High', title: 'HTTPS pages link to HTTP URLs', why: 'Insecure links trigger warnings and leak trust.', fix: 'Update all internal links to HTTPS.' },
  { key: 'is_http', cat: 'Security', sev: 'High', title: 'Pages served over HTTP', why: 'Browsers mark HTTP pages as not secure.', fix: 'Force HTTPS with a 301 redirect sitewide.' },
  { key: 'high_loading_time', cat: 'Performance', sev: 'High', title: 'Slow page load time', why: 'Slow pages hurt Core Web Vitals, rankings and conversions.', fix: 'Optimise images, enable caching and reduce heavy scripts.' },
  { key: 'high_waiting_time', cat: 'Performance', sev: 'High', title: 'Slow server response (TTFB)', why: 'A slow server delays everything else on the page.', fix: 'Enable server/edge caching and review hosting region.' },
  { key: 'has_render_blocking_resources', cat: 'Performance', sev: 'Medium', title: 'Render-blocking CSS/JavaScript', why: 'The browser must wait for these files before showing the page, slowing first paint.', fix: 'Defer non-critical JavaScript and inline critical CSS.' },
  { key: 'large_page_size', cat: 'Performance', sev: 'Medium', title: 'Large page size', why: 'Heavy pages load slowly on mobile networks.', fix: 'Compress images, remove unused code and lazy-load below-the-fold media.' },
  { key: 'no_content_encoding', cat: 'Performance', sev: 'Medium', title: 'No compression (gzip/brotli)', why: 'Uncompressed pages take longer to download.', fix: 'Enable gzip or brotli compression on the server.' },
  { key: 'is_redirect', cat: 'Crawlability & Indexing', sev: 'Low', title: 'Internal URLs that redirect', why: 'Redirects add load time and dilute crawl efficiency.', fix: 'Link directly to the final URL.' },
  { key: 'redirect_chain', cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Redirect chains', why: 'Each extra hop slows users and loses some link value.', fix: 'Redirect straight to the final destination in one hop.' },
  { key: 'has_links_to_redirects', cat: 'Crawlability & Indexing', sev: 'Low', title: 'Links pointing to redirects', why: 'Extra hops for users and crawlers.', fix: 'Update links to point to the final URL.' },
  { key: 'no_description', cat: 'On-Page', sev: 'Medium', title: 'Missing meta description', why: 'Google writes its own snippet, often less compelling, lowering click-through rate.', fix: 'Write a unique 140-155 character description with a clear call to action.' },
  { key: 'duplicate_meta_tags', cat: 'On-Page', sev: 'Medium', title: 'Duplicate meta tags on the same page', why: 'Two versions of the same tag send conflicting signals. Usually a template or framework adds a tag twice.', fix: 'View the page source, find the repeated meta tag and keep a single instance in the template.' },
  { key: 'duplicate_title_tag', cat: 'On-Page', sev: 'Medium', title: 'More than one title tag on a page', why: 'Search engines may pick the wrong one.', fix: 'Remove the extra title tag from the template.' },
  { key: 'low_content_rate', cat: 'Content', sev: 'Medium', title: 'Low text-to-HTML ratio', why: 'Pages dominated by code (layout, scripts, framework data) with little readable text are harder to rank and slower to parse.', fix: 'Add useful, answer-focused text and reduce inline scripts and framework payload where possible.' },
  { key: 'low_character_count', cat: 'Content', sev: 'Medium', title: 'Very little text on the page', why: 'Pages with very little text rarely satisfy search intent.', fix: 'Expand these pages with helpful, specific content.' },
  { key: 'low_readability_rate', cat: 'Content', sev: 'Low', title: 'Hard-to-read content', why: 'Complex sentences reduce engagement.', fix: 'Use shorter sentences, sub-headings and bullet points.' },
  { key: 'no_image_alt', cat: 'Images', sev: 'Low', title: 'Pages with at least one image missing alt text', why: 'Meaningful images need alt text for image search and accessibility. Purely decorative images should have empty alt, so review before fixing.', fix: 'Add descriptive alt text to meaningful images (products, logos, diagrams); leave decorative shapes and backgrounds empty.' },
  { key: 'deprecated_html_tags', cat: 'Technical', sev: 'Low', title: 'Deprecated HTML tags', why: 'Outdated markup can render inconsistently.', fix: 'Replace deprecated tags with modern HTML/CSS.' },
  { key: 'no_favicon', cat: 'Technical', sev: 'Low', title: 'Missing favicon', why: 'Favicons appear in mobile search results and browser tabs.', fix: 'Add a favicon and reference it in the page head.' },
  { key: 'no_doctype', cat: 'Technical', sev: 'Low', title: 'Missing DOCTYPE', why: 'Browsers may render the page in quirks mode.', fix: 'Add <!DOCTYPE html> to the template.' },
  { key: 'has_micromarkup_errors', cat: 'Schema', sev: 'Medium', title: 'Structured data with errors', why: 'Search engines ignore structured data blocks that fail validation, so the page loses rich-result eligibility.', fix: 'Validate each page in the Rich Results Test / Schema Markup Validator and fix the reported properties.' },
  { key: 'irrelevant_title', cat: 'On-Page', sev: 'Medium', title: 'Title does not match the page content', why: 'A title that does not reflect the page confuses both users and ranking systems.', fix: 'Rewrite the title to describe the page topic with its main keyword.' },
  { key: 'irrelevant_description', cat: 'On-Page', sev: 'Low', title: 'Meta description does not match the page content', why: 'Google is more likely to replace an off-topic description with its own snippet.', fix: 'Write a description that summarises the page and its main benefit.' },
  { key: 'has_meta_refresh_redirect', cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Meta refresh redirects', why: 'Meta refresh is slower than a server redirect and passes signals less reliably.', fix: 'Replace meta refresh with a 301 redirect on the server.' },
  { key: 'size_greater_than_3mb', cat: 'Performance', sev: 'Medium', title: 'HTML larger than 3 MB', why: 'Huge documents are slow to download and parse, especially on mobile.', fix: 'Move inline data and scripts out of the HTML; paginate very long pages.' },
  { key: 'canonical_chain', cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Canonical chains', why: 'Canonical tags that point to pages with their own canonical dilute the signal.', fix: 'Point every canonical directly at the final URL.' },
  { key: 'is_link_relation_conflict', cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Conflicting canonical / alternate relations', why: 'Contradictory link relations make it unclear which URL should be indexed.', fix: 'Make canonical, hreflang and alternate tags agree on one indexable URL.' },
  { key: 'no_encoding_meta_tag', cat: 'Technical', sev: 'Low', title: 'Missing charset declaration', why: 'Browsers may guess the encoding and render special characters incorrectly.', fix: 'Add <meta charset="utf-8"> as the first element in <head>.' },
  { key: 'seo_friendly_url', cat: 'On-Page', sev: 'Low', title: 'URLs are not SEO-friendly', why: 'Dynamic parameters, long paths or non-descriptive URLs are harder to read and share.', fix: 'Use short, lowercase, hyphenated, descriptive URLs.', invert: true }
];

const findings = [];
const whatWorks = [];

for (const c of CATALOG) {
  const affected = pages.filter(p => {
    const v = p.checks ? p.checks[c.key] : undefined;
    if (v === undefined || v === null) return false;
    return c.invert ? v === false : v === true;
  });
  if (affected.length > 0) {
    // A handful of broken URLs on a big site is serious but not "Critical" unless the homepage or >=3% of pages are hit
    let sev = c.sev;
    if (sev === 'Critical' && affected.length / total < 0.03 && !affected.some(p => /^https?:\/\/[^\/]+\/?$/.test(p.url))) sev = 'High';
    findings.push({
      category: c.cat, severity: sev, title: c.title, why: c.why, fix: c.fix,
      evidence: affected.length + ' of ' + total + ' crawled pages',
      affected_count: affected.length,
      affected_pct: Math.round(affected.length / total * 100),
      sample_urls: affected.slice(0, 10).map(p => p.url),
      scope: 'page'
    });
  }
}

// ===== 2. Strict custom checks =====
const isLegal = (u) => /privacy|cookie|terms|security|legal|disclaimer/i.test(u || '');
const isArticle = (u) => /\/(insights|blog|news|articles?|guides?)\/./i.test(u || '');
const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u || '');

const RULES = [
  { cat: 'On-Page', sev: 'Low', title: 'Title shorter than 30 characters',
    why: 'Short titles waste space to include keywords and a reason to click.', fix: 'Expand to 50-60 characters with the main keyword and benefit.',
    test: (p, m) => { const l = (m.title || '').length; return l > 0 && l < 30 ? l + ' characters: "' + m.title + '"' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Title longer than 60 characters',
    why: 'Long titles get cut off in search results.', fix: 'Keep the important words in the first 60 characters.',
    test: (p, m) => { const l = (m.title || '').length; return l > 60 ? l + ' characters' : ''; } },
  { cat: 'On-Page', sev: 'Medium', title: 'Brand name repeated in the title',
    why: 'A doubled brand suffix wastes title space and usually means the template adds the brand twice.', fix: 'Fix the title template so the brand appears once.',
    test: (p, m) => { const parts = String(m.title || '').split(/\s[|\-–—]\s/).map(s => s.trim().toLowerCase()).filter(Boolean); const dup = parts.find((s, i) => parts.indexOf(s) !== i); return dup ? '"' + m.title + '"' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Meta description shorter than 70 characters',
    why: 'Too short to persuade searchers to click.', fix: 'Write 140-155 characters with a clear benefit and call to action.',
    test: (p, m) => { const l = (m.description || '').length; return l > 0 && l < 70 ? l + ' characters' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Meta description longer than 160 characters',
    why: 'Google cuts it off mid-sentence.', fix: 'Trim to about 155 characters.',
    test: (p, m) => { const l = (m.description || '').length; return l > 160 ? l + ' characters' : ''; } },
  { cat: 'On-Page', sev: 'Medium', title: 'More than one H1 on the page',
    why: 'Multiple H1s blur what the page is mainly about.', fix: 'Keep one H1; turn the others into H2s.',
    test: (p, m) => { const n = ((m.htags || {}).h1 || []).length; return n > 1 ? n + ' H1 tags' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Heading order skips a level',
    why: 'Skipping from H1 to H3 breaks the outline that search engines and screen readers use.', fix: 'Use H2 before H3, in a logical order.',
    test: (p, m) => { const h = m.htags || {}; return (h.h3 || []).length && !(h.h2 || []).length ? 'H3 used without any H2' : ''; } },
  { cat: 'On-Page', sev: 'Info', title: 'H1 is identical to the title tag',
    why: 'A slightly different H1 lets you target a second keyword variation.', fix: 'Optional: vary the H1 wording from the title.',
    test: (p, m) => { const h1 = (((m.htags || {}).h1 || [])[0] || '').trim().toLowerCase(); return h1 && h1 === String(m.title || '').trim().toLowerCase() ? 'Both: "' + m.title + '"' : ''; } },
  { cat: 'Content', sev: 'Medium', title: 'Thin content (under 300 words)',
    why: 'Very short pages rarely answer the searcher fully and struggle to rank.', fix: 'Add specific, useful information: process, pricing factors, examples, FAQs.',
    test: (p, m, c) => { const w = c.plain_text_word_count; return w != null && w < 300 && !isLegal(p.url) ? w + ' words' : ''; } },
  { cat: 'Content', sev: 'Low', title: 'Light content (300-500 words)',
    why: 'Commercial pages usually need more depth to compete.', fix: 'Expand with answers to the questions buyers ask before contacting you.',
    test: (p, m, c) => { const w = c.plain_text_word_count; return w != null && w >= 300 && w < 500 && !isLegal(p.url) ? w + ' words' : ''; } },
  { cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Missing canonical tag',
    why: 'Without a canonical, duplicate URL versions can compete with each other.', fix: 'Add a self-referencing canonical tag to every indexable page.',
    test: (p, m) => !m.canonical ? 'No canonical' : '' },
  { cat: 'Crawlability & Indexing', sev: 'Info', title: 'Canonical points to a different page',
    why: 'Fine if intentional, but this page will not rank on its own.', fix: 'Confirm each of these is intentional.',
    test: (p, m) => { const cn = String(m.canonical || '').replace(/\/$/, ''); return cn && cn !== String(p.url).replace(/\/$/, '') ? '→ ' + m.canonical : ''; } },
  { cat: 'Crawlability & Indexing', sev: 'Medium', title: 'Pages buried deep in the site (3+ clicks from home)',
    why: 'Deep pages get crawled less often and receive less internal authority.', fix: 'Link to them from the homepage, menus or hub pages.',
    test: (p) => p.click_depth != null && p.click_depth > 3 ? p.click_depth + ' clicks deep' : '' },
  { cat: 'Crawlability & Indexing', sev: 'Low', title: 'Few internal links pointing to the page',
    why: 'Pages with few internal links look less important to search engines.', fix: 'Add contextual links from related pages with descriptive anchor text.',
    test: (p, m) => { const n = m.inbound_links_count ?? p.inbound_links_count; return n != null && n < 3 && !isHome(p.url) && !isLegal(p.url) && !(p.checks && p.checks.is_orphan_page) ? n + ' internal links in' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Too many links on one page',
    why: 'Very high link counts dilute the value passed to each link.', fix: 'Trim repetitive navigation and footer links.',
    test: (p, m) => { const n = (m.internal_links_count || 0) + (m.external_links_count || 0); return n > 150 ? n + ' links' : ''; } },
  { cat: 'On-Page', sev: 'Low', title: 'Missing Open Graph tags',
    why: 'Without them, links shared on LinkedIn, WhatsApp or Facebook show a poor preview.', fix: 'Add og:title, og:description and og:image.',
    test: (p, m) => { const s = m.social_media_tags || {}; const miss = ['og:title', 'og:image'].filter(k => !s[k]); return miss.length ? 'Missing ' + miss.join(', ') : ''; } },
  { cat: 'On-Page', sev: 'Info', title: 'Missing Twitter/X card tags',
    why: 'Shared links on X show a plain preview.', fix: 'Add twitter:card and twitter:image tags.',
    test: (p, m) => { const s = m.social_media_tags || {}; return !s['twitter:card'] ? 'No twitter:card' : ''; } },
  { cat: 'Performance', sev: 'High', title: 'Very slow Largest Contentful Paint (over 4s)',
    why: 'LCP over 4 seconds is rated Poor by Google and hurts rankings and conversions.', fix: 'Optimise the main image, enable caching, reduce blocking scripts.',
    test: (p, m, c, t) => t.largest_contentful_paint > 4000 ? Math.round(t.largest_contentful_paint) + 'ms (lab)' : '' },
  { cat: 'Performance', sev: 'Medium', title: 'Slow Largest Contentful Paint (2.5-4s)',
    why: 'Google rates LCP above 2.5 seconds as Needs Improvement.', fix: 'Preload the main image and speed up server response.',
    test: (p, m, c, t) => t.largest_contentful_paint > 2500 && t.largest_contentful_paint <= 4000 ? Math.round(t.largest_contentful_paint) + 'ms (lab)' : '' },
  { cat: 'Performance', sev: 'Medium', title: 'Layout shift above 0.1 (CLS)',
    why: 'Content jumping while loading annoys users and fails Core Web Vitals.', fix: 'Set width/height on images and reserve space for embeds and banners.',
    test: (p, m) => { const v = m.cumulative_layout_shift; return v != null && v > 0.1 ? 'CLS ' + Number(v).toFixed(2) : ''; } },
  { cat: 'Performance', sev: 'Low', title: 'Slow to become interactive (over 5s)',
    why: 'Heavy JavaScript makes the page unresponsive after it appears.', fix: 'Reduce and defer JavaScript.',
    test: (p, m, c, t) => t.time_to_interactive > 5000 ? Math.round(t.time_to_interactive) + 'ms' : '' },
  { cat: 'Performance', sev: 'Medium', title: 'Slow server response on individual pages (over 800ms)',
    why: 'Slow first byte delays everything else.', fix: 'Enable caching for these pages and check heavy server-side work.',
    test: (p, m, c, t) => t.waiting_time > 800 ? Math.round(t.waiting_time) + 'ms' : '' },
  { cat: 'Performance', sev: 'Medium', title: 'Large image payload (over 1MB of images per page)',
    why: 'Large images are the most common cause of slow mobile pages. The figure is the total size of image files the page references (including responsive sizes), so the real download may be smaller, but it signals unoptimised images.', fix: 'Compress images, serve WebP/AVIF, and make sure image CDN optimisation (e.g. f_auto,q_auto) is on.',
    test: (p, m) => m.images_size > 1000000 ? (m.images_size / 1048576).toFixed(1) + 'MB of image files referenced' : '' },
  { cat: 'On-Page', sev: 'Low', title: 'Long or messy URLs',
    why: 'Long URLs, capitals or underscores are harder to read, share and remember.', fix: 'Use short, lowercase, hyphenated URLs.',
    test: (p) => { const path = String(p.url || '').replace(/^https?:\/\/[^\/]+/, ''); const issues = []; if (String(p.url).length > 100) issues.push(String(p.url).length + ' characters'); if (/[A-Z]/.test(path)) issues.push('capital letters'); if (/_/.test(path)) issues.push('underscores'); return issues.join(', '); } }
];

if (!isFull) {
  RULES.push({ cat: 'Content', sev: 'Low', title: 'Articles with no outbound links to sources',
    why: 'Articles that cite no sources are less trustworthy and less likely to be quoted by AI answers.', fix: 'Link key facts and statistics to their primary sources.',
    test: (p, m) => isArticle(p.url) && (m.external_links_count || 0) === 0 ? '0 external links' : '' });
}

for (const r of RULES) {
  const hits = [];
  for (const p of pages) {
    const m = p.meta || {};
    let detail = '';
    try { detail = r.test(p, m, m.content || {}, p.page_timing || {}); } catch (e) { detail = ''; }
    if (detail) hits.push({ url: p.url, detail });
  }
  if (hits.length) {
    findings.push({
      category: r.cat, severity: r.sev, title: r.title, why: r.why, fix: r.fix,
      evidence: hits.length + ' of ' + total + ' crawled pages',
      affected_count: hits.length,
      affected_pct: Math.round(hits.length / total * 100),
      sample_urls: hits.slice(0, 10).map(h => h.url + ' — ' + h.detail),
      scope: 'page'
    });
  }
}

// ===== 3. Domain-level checks =====
const dc = di.checks || {};
const addDomain = (cond, cat, sev, title, why, fix, evidence) => {
  if (cond) findings.push({ category: cat, severity: sev, title, why, fix, evidence: evidence || '', affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });
};
addDomain(dc.ssl === false, 'Security', 'Critical', 'Invalid SSL certificate', 'Browsers show a security warning and users leave.', 'Install a valid SSL certificate for all hostnames.');
addDomain(dc.test_https_redirect === false && !probe.findings.some(f => /HTTP version/i.test(f.title)), 'Security', 'High', 'HTTP does not redirect to HTTPS', 'Duplicate versions of the site can be indexed and users land on insecure pages.', 'Add a sitewide 301 redirect from HTTP to HTTPS.');
addDomain(dc.test_canonicalization === false, 'Crawlability & Indexing', 'High', 'www and non-www versions are not consolidated', 'If both versions do not resolve to one canonical host, links and signals are split.', 'Make the www version redirect (301) to the main domain with a valid certificate for both hostnames.', 'Crawler canonicalization test failed');
addDomain(dc.sitemap === false, 'Crawlability & Indexing', 'High', 'No XML sitemap found', 'Search engines discover pages more slowly.', 'Create sitemap.xml and reference it in robots.txt and Search Console.');
addDomain(dc.robots_txt === false, 'Crawlability & Indexing', 'Medium', 'No robots.txt file', 'Crawlers get no guidance and no sitemap reference.', 'Add a robots.txt file with a Sitemap line.');
addDomain(dc.test_page_not_found === false, 'Crawlability & Indexing', 'Medium', 'Missing pages do not return a real 404', 'Soft 404s waste crawl budget and can get junk URLs indexed.', 'Return a proper 404 status for non-existent URLs.');
addDomain(dc.test_directory_browsing === false, 'Security', 'Medium', 'Directory browsing is enabled', 'Visitors can list server folders, exposing files.', 'Disable directory listing on the server.');
addDomain(dc.http2 === false, 'Performance', 'Low', 'HTTP/2 not enabled', 'HTTP/2 loads multiple files faster.', 'Enable HTTP/2 on the server or CDN.');

const exp = di.ssl_info?.certificate_expiration_date;
if (exp) {
  const days = Math.round((new Date(exp) - new Date()) / 86400000);
  const issuer = String(di.ssl_info?.certificate_issuer || '');
  const autoRenew = /let'?s encrypt|zerossl|buypass|google trust|cloudflare|amazon|sectigo.*acme/i.test(issuer);   // 90-day certs renew ~30 days out
  const sev = days < 0 ? 'Critical' : days < 7 ? 'Critical' : (days < 14 || (!autoRenew && days < 30)) ? 'High' : null;
  if (sev) findings.push({ category: 'Security', severity: sev, title: days < 0 ? 'SSL certificate has expired' : 'SSL certificate expires in ' + days + ' days', why: 'An expired certificate blocks visitors with a security warning.', fix: autoRenew ? 'Check that automatic renewal (' + issuer + ') is still working.' : 'Renew the certificate or confirm auto-renewal is working.', evidence: 'Expiry date ' + exp.slice(0, 10) + (issuer ? ', issuer ' + issuer : ''), affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });
}

// ===== 3b. Crawl-summary metrics that are only reported as counts =====
const cnt = (v) => (v == null ? 0 : Number(v) || 0);
const addCount = (n, cat, sev, title, why, fix, evidence) => {
  if (n > 0) findings.push({ category: cat, severity: sev, title, why, fix, evidence: evidence || (n + ' found across the crawl'), affected_count: n, affected_pct: Math.min(100, Math.round(n / total * 100)), sample_urls: [], scope: 'site' });
};
addCount(cnt(pm.broken_links), 'Crawlability & Indexing', cnt(pm.broken_links) > 20 ? 'High' : 'Medium', 'Broken internal links', 'Links to pages that no longer exist waste crawl budget and send users to dead ends.', 'Export the broken links from the crawl and fix or remove each one; redirect deleted pages to the closest live page.', cnt(pm.broken_links) + ' broken links across ' + total + ' pages');
addCount(cnt(pm.broken_resources), 'Performance', 'Medium', 'Broken images, scripts or stylesheets', 'Missing resources cause layout breakage and slow the page while the browser waits.', 'Fix or remove references to resources that return errors.', cnt(pm.broken_resources) + ' broken resources referenced');
addCount(cnt(pm.duplicate_content), 'Content', 'Medium', 'Pages with duplicate content', 'Near-identical pages compete with each other and dilute ranking signals.', 'Consolidate duplicates with a canonical tag or a 301 redirect, or make each page substantively different.', cnt(pm.duplicate_content) + ' pages with duplicate content');
addCount(cnt(pm.redirect_loop), 'Crawlability & Indexing', 'Critical', 'Redirect loops', 'Looping redirects make pages unreachable for users and crawlers.', 'Break the loop so every redirect ends at a live 200 page.', cnt(pm.redirect_loop) + ' redirect loops');

// ===== 3c. Extra On-Page reports (duplicate tags, non-indexable, redirect chains) =====
if (extras.duplicate_title.length) {
  const pagesAff = extras.duplicate_title.reduce((s, x) => s + (x.count || 0), 0);
  findings.push({ category: 'On-Page', severity: 'Medium', title: 'Duplicate page titles across the site', why: 'Pages sharing a title look interchangeable to search engines and compete for the same query.', fix: 'Give every page a unique title that names its specific topic.',
    evidence: extras.duplicate_title.length + ' title(s) reused on ' + pagesAff + ' pages', affected_count: pagesAff, affected_pct: Math.min(100, Math.round(pagesAff / total * 100)),
    sample_urls: extras.duplicate_title.slice(0, 5).map(x => '"' + x.text + '" (' + x.count + ' pages): ' + x.urls.slice(0, 2).join(', ')), scope: 'page' });
}
if (extras.duplicate_description.length) {
  const pagesAff = extras.duplicate_description.reduce((s, x) => s + (x.count || 0), 0);
  findings.push({ category: 'On-Page', severity: 'Low', title: 'Duplicate meta descriptions across the site', why: 'Reused descriptions lower click-through and signal templated, low-effort pages.', fix: 'Write a unique description for each important page; leave it empty on pages that are not meant to rank rather than duplicating.',
    evidence: extras.duplicate_description.length + ' description(s) reused on ' + pagesAff + ' pages', affected_count: pagesAff, affected_pct: Math.min(100, Math.round(pagesAff / total * 100)),
    sample_urls: extras.duplicate_description.slice(0, 5).map(x => '"' + x.text.slice(0, 60) + '…" (' + x.count + ' pages)'), scope: 'page' });
}
if (extras.non_indexable.length) {
  const reasons = {};
  extras.non_indexable.forEach(x => { reasons[x.reason] = (reasons[x.reason] || 0) + 1; });
  findings.push({ category: 'Crawlability & Indexing', severity: 'Low', title: 'Crawled pages that are not indexable', why: 'Often intentional (noindex, canonicals to other pages), but every important page in this list is invisible to Google.', fix: 'Confirm each non-indexable page is meant to be excluded; remove noindex/canonical rules from pages that should rank.',
    evidence: extras.non_indexable.length + ' non-indexable pages — reasons: ' + Object.entries(reasons).map(([r, n]) => r + ' (' + n + ')').join(', '), affected_count: extras.non_indexable.length, affected_pct: Math.min(100, Math.round(extras.non_indexable.length / total * 100)),
    sample_urls: extras.non_indexable.slice(0, 10).map(x => x.url + ' — ' + x.reason), scope: 'page' });
}
if (extras.redirect_chains.length) {
  findings.push({ category: 'Crawlability & Indexing', severity: 'Medium', title: 'Redirect chains (2+ hops)', why: 'Each extra hop slows users and loses some link value; long chains may not be followed at all.', fix: 'Point every redirect straight at the final URL.',
    evidence: extras.redirect_chains.length + ' chains found', affected_count: extras.redirect_chains.length, affected_pct: Math.min(100, Math.round(extras.redirect_chains.length / total * 100)),
    sample_urls: extras.redirect_chains.slice(0, 8).map(x => x.chain.join(' → ')), scope: 'page' });
}

// ===== 4. Probe + Full-report module findings =====
if (probe.findings.some(f => /www/i.test(f.title))) {
  for (let i = findings.length - 1; i >= 0; i--) if (/www and non-www/i.test(findings[i].title)) findings.splice(i, 1);
}
if (probe.findings.some(f => /server response/i.test(f.title))) {
  for (let i = findings.length - 1; i >= 0; i--) {
    if (findings[i].title === 'Slow server response (TTFB)' && findings[i].scope === 'page') findings.splice(i, 1);
  }
}
findings.push(...probe.findings);
findings.push(...(input.extra_findings || []));

// ===== 5. What works =====
const ok = (cond, text) => { if (cond) whatWorks.push(text); };
ok(dc.ssl === true, 'Valid SSL certificate on the main domain' + (exp ? ' (expires ' + exp.slice(0, 10) + ')' : ''));
ok(dc.test_https_redirect === true, 'HTTP correctly redirects to HTTPS');
ok(dc.robots_txt === true, 'robots.txt is present');
ok(dc.http2 === true, 'HTTP/2 is enabled');
ok(dc.test_page_not_found === true, 'Missing pages return a proper 404');
ok(pm.broken_links === 0, 'No broken links found');
ok(pm.broken_resources === 0, 'No broken images, scripts or stylesheets');
ok(pm.duplicate_title === 0, 'No duplicate page titles');
ok(pm.duplicate_description === 0, 'No duplicate meta descriptions');
ok(pm.duplicate_content === 0, 'No duplicate content across pages');
ok(pm.redirect_loop === 0, 'No redirect loops');
ok(pm.non_indexable === 0, 'All crawled pages are indexable');
ok((pm.checks || {}).no_h1_tag === 0, 'Every page has an H1');
ok((pm.checks || {}).no_title === 0, 'Every page has a title tag');
for (const w of probe.what_works) if (!whatWorks.includes(w)) whatWorks.push(w);
for (const w of (input.extra_works || [])) if (!whatWorks.includes(w)) whatWorks.push(w);
if (dc.sitemap === true && !whatWorks.some(w => /sitemap lists/i.test(w))) whatWorks.push('XML sitemap is present');

const hasOrphans = findings.some(f => /orphan/i.test(f.title));
const drop = [/\(0ms\)/i];
if (hasOrphans) drop.push(/reachable through internal links/i);
for (let i = whatWorks.length - 1; i >= 0; i--) if (drop.some(r => r.test(whatWorks[i]))) whatWorks.splice(i, 1);

// ===== 6. Sort =====
findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || ((b.affected_pct || 0) - (a.affected_pct || 0)));

// ===== 7. Scoring =====
const PEN2 = { Critical: 30, High: 15, Medium: 7, Low: 3, Info: 1 };
const WEIGHTS = isFull ? {
  'Crawlability & Indexing': 15, 'On-Page': 14, 'Content': 16, 'Schema': 12,
  'Performance': 13, 'Security': 7, 'Images': 7, 'Technical': 6,
  'AI Search Readiness': 10, 'Authority': 12
} : {
  'Crawlability & Indexing': 22, 'On-Page': 18, 'Content': 13,
  'Performance': 15, 'Security': 10, 'Images': 7, 'Technical': 5,
  'AI Search Readiness': 10
};

const category_scores = {};
const DECAY = 0.7;   // each further finding of the same severity in a category counts 70% of the previous one
for (const cat of Object.keys(WEIGHTS)) {
  let score = 100;
  const seenSev = {};
  const list = findings.filter(f => f.category === cat && f.scoring !== false)
    .sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || ((b.affected_pct || 0) - (a.affected_pct || 0)));
  for (const f of list) {
    const pct = f.affected_pct == null ? 100 : f.affected_pct;
    const factor = f.scope === 'site' ? 1 : (0.6 + 0.4 * (pct / 100));
    const n = seenSev[f.severity] = (seenSev[f.severity] || 0) + 1;
    score -= (PEN2[f.severity] || 0) * factor * Math.pow(DECAY, n - 1);
  }
  category_scores[cat] = Math.max(0, Math.round(score));
}
const wSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
const raw_score = Math.round(Object.keys(WEIGHTS).reduce((s, cat) => s + category_scores[cat] * WEIGHTS[cat], 0) / wSum);

const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
findings.forEach(f => { if (counts[f.severity] != null) counts[f.severity]++; });

const scored = { Critical: 0, High: 0 };
findings.forEach(f => { if (f.scoring !== false && (f.severity === 'Critical' || f.severity === 'High')) scored[f.severity]++; });
let cap = 100, cap_reason = '';
if (scored.Critical >= 2) { cap = 60; cap_reason = scored.Critical + ' critical issues found — score capped at 60 until fixed'; }
else if (scored.Critical === 1) { cap = 70; cap_reason = '1 critical issue found — score capped at 70 until fixed'; }
else if (scored.High >= 5) { cap = 85; cap_reason = scored.High + ' high-priority issues found — score capped at 85 until fixed'; }
const health_score = Math.min(raw_score, cap);
const grade = health_score >= 90 ? 'Excellent' : health_score >= 75 ? 'Good' : health_score >= 60 ? 'Needs Improvement' : 'Poor';

// ===== 8. Kya naapa nahi gaya =====
const not_assessed = [];
if (!isFull) not_assessed.push('Structured data (schema) and HTML-level checks');
if (!isFull || !input.competitor_benchmark) not_assessed.push('Competitor benchmark (organic keywords, rankings, traffic, domain age)');
if (!input.pagespeed) not_assessed.push('Core Web Vitals (LCP, CLS, INP) from Google PageSpeed and real users');
if (!input.content_review) not_assessed.push('Content quality and E-E-A-T review (authors, case studies, claims, pricing)');
if (!input.authority) not_assessed.push('Backlinks and referring domains');
if (!input.site_keywords) not_assessed.push('Keyword rankings by search intent and keyword gap');
if (!input.ai_visibility) not_assessed.push('AI answer visibility (AI Overviews, ChatGPT brand mentions)');
if (!(input.search_console && input.search_console.connected)) not_assessed.push('Search Console: submitted sitemaps, index coverage and search performance (connect the service account to the property)');

return [{
  json: {
    ...base,
    ...input,
    crawl_summary: undefined,
    site_audit: {
      domain: base.domain,
      audit_level: isFull ? 'full' : 'site_audit',
      pages_crawled: total,
      crawl_date: (di.crawl_end || '').slice(0, 10),
      server: di.server || null,
      health_score, raw_score,
      score_cap: cap < 100 ? cap : null,
      score_cap_reason: cap_reason,
      grade, category_scores,
      weights: WEIGHTS,
      issue_counts: counts,
      findings,
      what_works: whatWorks,
      search_console: input.search_console || null,
      site_structure: input.site_structure || null,
      entity: input.entity || null,
      measurements: probe.measurements || {},
      sampled_pages: (input.html_analysis || {}).sampled_pages || [],
      competitor_benchmark: input.competitor_benchmark || null,
      not_assessed,
      dataforseo_onpage_score: pm.onpage_score ?? null,
      scoring_method: (isFull ? 'Full SEO health. ' : 'Technical site health only. ') + 'Each category starts at 100. Findings written by the AI content review, and notes about data that could not be collected, are listed but do not change the score. Each other finding deducts Critical 30, High 15, Medium 7, Low 3, Info 1 points, scaled by the share of pages affected (60%-100% of the penalty); site-wide issues take the full penalty. Within a category, each further finding of the same severity counts 70% of the previous one, so many small issues cannot zero a category on their own. The score is the weighted average of category scores, capped at 70 with one critical issue, 60 with two or more, and 85 with five or more high-priority issues.',
      notes: [probe.note, extras.errors.length ? 'Some extra crawl reports were unavailable: ' + extras.errors.join('; ') : '', (base.pages_crawled && total < base.pages_crawled) ? 'Only ' + total + ' of ' + base.pages_crawled + ' crawled pages were analysed in detail.' : ''].filter(Boolean)
    }
  }
}];