const base = $('Check Crawl').first().json;
const domain = base.domain;
const probes = [...$('Build Probes').all(), ...$('Content Probes').all()].map(i => i.json);
const results = [...$('Run Probes').all(), ...$('Run Content Probes').all()].map(i => i.json);
const crawled = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];

const R = {};
probes.forEach((p, i) => {
  const r = results[i] || {};
  R[p.id] = { url: p.url, status: r.statusCode || 0, headers: r.headers || {}, body: String(r.body || r.data || ''), error: r.error ? (r.error.message || JSON.stringify(r.error)).slice(0, 200) : '' };
});
const h = (id, name) => {
  const hs = (R[id] || {}).headers || {};
  const k = Object.keys(hs).find(x => x.toLowerCase() === name.toLowerCase());
  return k ? String(hs[k]) : '';
};
const MAIN = 'home_content';   // the homepage as browsers get it (redirects followed)

const findings = [];
const works = [];
const add = (category, severity, title, evidence, why, fix) =>
  findings.push({ category, severity, title, evidence, why, fix, affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });

// 1. Which host is canonical? Host probes did NOT follow redirects.
const home = R.home || {}, www = R.www_https || {};
const homeLoc = h('home', 'location');
const apexToWww = home.status >= 300 && home.status < 400 && /^https?:\/\/www\./i.test(homeLoc);
const canonical_host = apexToWww ? 'www.' + domain : domain;
if (apexToWww) {
  if (www.status === 200) works.push('One canonical host: https://' + domain + ' 301-redirects to https://www.' + domain);
  else if (!www.status || www.error) add('Security', 'Critical', 'Homepage redirects to www, but www does not load', 'https://' + domain + ' → ' + homeLoc + ' failed: ' + (www.error || 'no response'), 'Every visitor and crawler is sent to a host that does not answer, so the site is effectively down.', 'Fix the certificate/DNS for www.' + domain + ' or redirect apex to a host that works. Verify: https://www.' + domain + ' returns 200.');
  else if (www.status >= 300 && www.status < 400) add('Crawlability & Indexing', 'High', 'Redirect chain or loop between apex and www', 'https://' + domain + ' → ' + homeLoc + ' → ' + h('www_https', 'location'), 'Multi-hop redirects slow every first visit and can loop.', 'Make apex redirect in one hop to the final URL, and make sure the final URL returns 200.');
} else if (home.status >= 300 && home.status < 400 && homeLoc && !homeLoc.includes(domain)) {
  add('Crawlability & Indexing', 'High', 'Homepage redirects to a different domain', 'https://' + domain + '/ → ' + homeLoc, 'Ranking signals are handed to another host; the audit target may be the wrong domain.', 'Audit the destination domain instead, or remove the redirect if it is unintended.');
} else {
  if (!www.status || www.error) {
    const viaHttp = h('www_http', 'location');
    add('Security', 'High', 'The www version of the site fails to load securely',
      'https://www.' + domain + ' failed: ' + (www.error || 'no response') + (viaHttp ? '. http://www.' + domain + ' redirects to ' + viaHttp : ''),
      'Anyone who types www, or clicks a www link in an ad, email or business card, sees a browser security error instead of your site.',
      'Add the www hostname to your hosting/CDN so it gets a valid certificate and 301-redirects to https://' + domain + ', or remove the www DNS record. Verify: https://www.' + domain + ' should load or redirect without an SSL error.');
  } else if (www.status >= 300 && www.status < 400) {
    const loc = h('www_https', 'location');
    if (loc.includes('//' + domain)) works.push('www redirects to the main domain (' + www.status + ')');
    else add('Crawlability & Indexing', 'Medium', 'www redirects somewhere unexpected', 'https://www.' + domain + ' → ' + loc, 'Signals may be split between hosts.', 'Redirect www directly to https://' + domain + '/ with a 301.');
  } else if (www.status === 200) {
    add('Crawlability & Indexing', 'High', 'www and non-www both serve the site (duplicate host)', 'https://www.' + domain + ' and https://' + domain + ' both return 200', 'Two copies of every page split links and ranking signals.', 'Add a 301 redirect from www to https://' + domain + '/ (or the reverse) so only one host answers with 200.');
  }
}
const apexHttpLoc = h('apex_http', 'location');
if (R.apex_http && R.apex_http.status === 200) add('Security', 'High', 'HTTP version of the homepage does not redirect to HTTPS', 'http://' + domain + '/ returns 200', 'Browsers mark the page as not secure and two versions of the site can be indexed.', 'Add a sitewide 301 redirect from http:// to https://.');
else if (R.apex_http && R.apex_http.status >= 300 && R.apex_http.status < 400 && /^https:/i.test(apexHttpLoc)) works.push('HTTP redirects to HTTPS');

// 2. Caching & server response (measured on the page browsers actually receive)
const cc = h(MAIN, 'cache-control');
const cacheHdr = h(MAIN, 'x-vercel-cache') || h(MAIN, 'cf-cache-status') || h(MAIN, 'x-cache') || '';
const cacheHdr2 = h('home_repeat', 'x-vercel-cache') || h('home_repeat', 'cf-cache-status') || h('home_repeat', 'x-cache') || '';
const homePage = crawled.find(p => String(p.url || '').replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '') === domain) || {};
const rawT = homePage.page_timing ? homePage.page_timing.waiting_time : null;
const ttfb = rawT && rawT > 0 ? Math.round(rawT) : null;

if (/no-store|private/i.test(cc)) {
  add('Performance', 'High', 'HTML cannot be cached by the CDN (no-store / private)',
    'Cache-Control: ' + cc + (cacheHdr ? '; CDN cache status on two requests: ' + cacheHdr + ' / ' + cacheHdr2 : '') + (ttfb != null ? '; homepage server wait ' + ttfb + 'ms' : ''),
    'Every visit forces the server to rebuild the page from scratch, which slows the first byte for every user and hurts Core Web Vitals. This is sometimes intentional (carts, logged-in areas) — confirm before changing.',
    'Remove the setting that forces dynamic rendering (for Next.js: force-dynamic, or cookies()/headers() in server components) or enable revalidation so the CDN can cache HTML. Verify: repeat requests should show a cache HIT.');
} else if (cc) {
  works.push('HTML is cacheable (Cache-Control: ' + cc + ')');
}
if (ttfb != null) {
  if (ttfb > 800) add('Performance', 'High', 'Slow server response (TTFB)', 'Homepage server wait time ' + ttfb + 'ms (good is under 200ms)', 'A slow first byte delays everything else and hurts LCP.', 'Enable CDN/edge caching and host close to your main audience.');
  else if (ttfb > 500) add('Performance', 'Medium', 'Server response could be faster', 'Homepage server wait time ' + ttfb + 'ms', 'Slower first byte delays page rendering.', 'Enable caching and review hosting region.');
  else works.push('Fast server response (' + ttfb + 'ms)');
}

// 3. Security headers
const missing = [];
if (!h(MAIN, 'strict-transport-security')) missing.push('Strict-Transport-Security (HSTS)');
if (!h(MAIN, 'content-security-policy')) missing.push('Content-Security-Policy');
if (!h(MAIN, 'x-content-type-options')) missing.push('X-Content-Type-Options');
if (!h(MAIN, 'x-frame-options') && !/frame-ancestors/i.test(h(MAIN, 'content-security-policy'))) missing.push('X-Frame-Options');
if (!h(MAIN, 'referrer-policy')) missing.push('Referrer-Policy');
if (missing.length) {
  add('Security', missing.some(m => m.includes('HSTS')) ? 'Medium' : 'Low', 'Missing security headers',
    'Not found: ' + missing.join(', '), 'Security headers protect visitors. They are not a direct ranking factor but show a well-maintained site.',
    'Add the missing headers in your hosting or CDN configuration; start Content-Security-Policy in Report-Only mode.');
} else works.push('All key security headers are present');

// 4. robots.txt
const robotsText = R.robots.status === 200 ? R.robots.body : '';
const aiBlocked = [];
if (robotsText) {
  const blocks = robotsText.split(/\n(?=\s*user-agent\s*:)/i);
  for (const b of blocks) {
    const agents = (b.match(/user-agent\s*:\s*(.+)/gi) || []).map(x => x.split(':')[1].trim().toLowerCase());
    const disallowAll = /disallow\s*:\s*\/\s*($|\n)/i.test(b);
    if (!disallowAll) continue;
    if (agents.includes('*')) add('Crawlability & Indexing', 'Critical', 'robots.txt blocks all crawlers', 'User-agent: * with Disallow: /', 'Search engines are told not to crawl the site at all.', 'Remove "Disallow: /" for User-agent: * unless the site is intentionally hidden.');
    ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'google-extended', 'ccbot'].forEach(bot => { if (agents.includes(bot)) aiBlocked.push(bot); });
  }
  if (!/sitemap\s*:/i.test(robotsText)) add('Crawlability & Indexing', 'Low', 'robots.txt does not list the sitemap', 'No "Sitemap:" line found', 'Crawlers find the sitemap faster when it is listed.', 'Add "Sitemap: https://' + canonical_host + '/sitemap.xml" to robots.txt.');
  else works.push('robots.txt lists the sitemap');
} else if (R.robots.status && R.robots.status !== 404) {
  add('Crawlability & Indexing', 'Medium', 'robots.txt returns an unexpected status', '/robots.txt returned ' + R.robots.status, 'A 5xx or blocked robots.txt can make Google pause crawling the whole site.', 'Serve robots.txt with 200 (or 404 if you have none).');
}
if (aiBlocked.length) add('AI Search Readiness', 'Medium', 'robots.txt blocks some AI crawlers', 'Blocked: ' + aiBlocked.join(', '), 'Blocked AI crawlers cannot use your pages as sources in AI answers. This can be intentional, so confirm it is a business decision.', 'Allow search-related AI crawlers (e.g. OAI-SearchBot, PerplexityBot) if you want to be cited in AI answers.');

// 5. Sitemap
const norm = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const sm = R.sitemap;
const locs = sm.status === 200 ? (sm.body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim()) : [];
const isIndex = /<sitemapindex/i.test(sm.body);
if (locs.length && !isIndex) {
  works.push('XML sitemap lists ' + locs.length + ' URLs');
  const sitemapSet = new Set(locs.map(norm));
  const notInSitemap = crawled.filter(p => p.status_code === 200 && !sitemapSet.has(norm(p.url))).map(p => p.url);
  if (notInSitemap.length) {
    findings.push({ category: 'Crawlability & Indexing', severity: 'Low', title: 'Indexable pages missing from the sitemap',
      evidence: notInSitemap.length + ' live pages are not in sitemap.xml',
      why: 'Search engines rely on the sitemap to discover and prioritise pages.', fix: 'Add these URLs to the sitemap, or noindex them if they should not rank.',
      affected_count: notInSitemap.length, affected_pct: Math.round(notInSitemap.length / Math.max(1, crawled.length) * 100), sample_urls: notInSitemap.slice(0, 10), scope: 'page' });
  } else works.push('Every live page is listed in the sitemap');
} else if (isIndex) {
  works.push('Sitemap index found');
}

// 6. llms.txt & Markdown
const llms = R.llms;
if (llms.status === 200 && llms.body.length > 100 && !/<html/i.test(llms.body)) {
  works.push('llms.txt exists (' + llms.body.length + ' characters)');
} else {
  add('AI Search Readiness', 'Low', 'No llms.txt file', 'https://' + domain + '/llms.txt returned ' + (llms.status || 'no response'),
    'llms.txt gives AI tools a clean summary of your site. Google does not use it; it is a low-cost extra for AI agents, not a ranking lever.',
    'Optionally publish /llms.txt with a short site summary and links to your key pages.');
}
if (/markdown/i.test(h('markdown', 'content-type'))) works.push('Site serves Markdown to AI agents on request');

// 7. AI / search crawler access (compared with what a browser receives)
const browserLen = (R[MAIN] || {}).body.length || 1;
const bots = probes.filter(p => p.id.startsWith('bot:'));
const blockedBots = [];
for (const b of bots) {
  const r = R[b.id];
  const name = b.id.slice(4);
  const ratio = r.body.length / browserLen;
  if (!r.status || r.status >= 400 || ratio < 0.3) blockedBots.push(name + ' (' + (r.status || 'no response') + (r.status && r.status < 400 ? ', ' + Math.round(ratio * 100) + '% of content' : '') + ')');
}
if (blockedBots.length) {
  add('AI Search Readiness', 'High', 'Some search and AI crawlers are blocked or get less content',
    blockedBots.join('; '), 'Blocked crawlers cannot index or cite your pages in search and AI answers.',
    'Check firewall, bot-protection and CDN rules so these crawlers receive the same page as browsers.');
} else {
  works.push('All ' + bots.length + ' search and AI crawlers tested (GPTBot, ClaudeBot, PerplexityBot, Googlebot and more) receive the full page');
}

return [{
  json: {
    ...base,
    canonical_host,
    probe: {
      findings,
      what_works: works,
      measurements: {
        canonical_host,
        cache_control: cc || null,
        cache_status: [cacheHdr, cacheHdr2].filter(Boolean),
        homepage_ttfb_ms: ttfb,
        server: h(MAIN, 'server') || null,
        sitemap_urls: locs.length,
        crawled_urls: crawled.length
      },
      note: 'AI crawler checks use the crawler user-agent only; real crawlers are also verified by IP, so a pass here means no user-agent based blocking.'
    }
  }
}];