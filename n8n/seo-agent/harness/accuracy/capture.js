// G18 — capture one site's real audit evidence as an accuracy-set fixture.
//
// NOT run by the harness (the harness is offline). Run it by hand inside the n8n container when a site is added to the set:
//
//   docker cp accuracy/capture.js n8n-n8n-1:/tmp/capture.js
//   docker exec n8n-n8n-1 node /tmp/capture.js techand.ai /power-platform-analytics-uae /industries > sites/techand-ai.json
//
// It performs only free public GETs: the host probes (apex / www, http / https, redirects NOT followed), the content probes
// (homepage twice, robots.txt, sitemap.xml, llms.txt, Markdown accept) and the 11 crawler-access probes — exactly the probe plan
// of "Build Probes" / "Content Probes" — plus one GET of each extra page given on the command line. No paid API is called.
//
// What is stored (nothing else, because nothing else is read by the audit code):
//  * per probe: status, the headers the audit reads, and the measured body length;
//  * for the homepage: its <head> with the <script> blocks removed (the audit counts <meta> tags and reads <link rel=canonical>);
//  * robots.txt and llms.txt as served, the sitemap's <loc> list and whether it is an index;
//  * per page: the measurements "Build Site Issues" reads (title, description, canonical, h1/h2/h3, og / twitter tags, word count).
// Every stored string is run through a redaction pass (e-mail addresses and telephone numbers), because the repository is public.
const DOMAIN = process.argv[2];
if (!DOMAIN) { console.error('usage: node capture.js <domain> [extra page paths...]'); process.exit(1); }
const EXTRA = process.argv.slice(3);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BOTS = {
  'GPTBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'ClaudeBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'PerplexityBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'CCBot': 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Amazonbot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',
  'Applebot': 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
  'Meta-ExternalAgent': 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
};
const KEEP = ['location', 'cache-control', 'content-type', 'server', 'strict-transport-security', 'content-security-policy',
  'x-content-type-options', 'x-frame-options', 'referrer-policy', 'x-vercel-cache', 'cf-cache-status', 'x-cache', 'content-encoding'];
const ent = (s) => String(s == null ? '' : s).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;|&#160;/gi, ' ').replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(Number(d)); } catch (e) { return m; } });
const redact = (s) => String(s == null ? '' : s)
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
  .replace(/(?:tel:)?\+?\d[\d\s().-]{7,}\d/g, '[redacted-phone]');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function get(url, { ua = CHROME, accept = 'text/html', follow = true } = {}) {
  try {
    const r = await fetch(url, { redirect: follow ? 'follow' : 'manual', headers: { 'user-agent': ua, accept } });
    const body = await r.text();
    const headers = {};
    for (const k of KEEP) { const v = r.headers.get(k); if (v) headers[k] = v; }
    return { status: r.status, headers, body, body_len: body.length, final_url: r.url || url };
  } catch (e) { return { status: 0, headers: {}, body: '', body_len: 0, error: String(e.message || e).slice(0, 160) }; }
}
// the <head> as the audit reads it: <script> and <style> blocks dropped (they hold no audited tag and may hold personal data)
const headOf = (html) => {
  const m = String(html || '').match(/^[\s\S]*?<head[^>]*>[\s\S]*?<\/head>/i);
  const raw = m ? m[0] : String(html || '').slice(0, 20000);
  return redact(raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, ''));
};
const tagText = (html, tag) => [...String(html || '').matchAll(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi'))]
  .map(x => redact(ent(x[1].replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ').trim()).filter(Boolean);
const metaOf = (html, name) => { const re = new RegExp('<meta\\b[^>]*(?:name|property)\\s*=\\s*["\']' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>', 'i');
  const t = (String(html || '').match(re) || [])[0] || ''; const c = (t.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1]; return c == null ? null : redact(ent(c)); };
const words = (html) => redact(String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;

// internal / external <a href> counts, as a crawler reports them (the audit uses them for "too many links" and for articles that cite no sources)
const linkCounts = (url, html) => {
  const host = (String(url).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '';
  const reg = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
  let internal = 0, external = 0;
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const u = m[1].trim();
    if (/^(#|mailto:|tel:|javascript:)/i.test(u)) continue;
    const h = (u.match(/^https?:\/\/([^\/?#]+)/i) || [])[1];
    if (!h) { internal++; continue; }
    reg(h) === reg(host) ? internal++ : external++;
  }
  return { internal_links_count: internal, external_links_count: external };
};
const pageMeta = (url, html) => {
  const canonTag = (String(html || '').match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
  const social = {};
  for (const k of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:image']) { const v = metaOf(html, k); if (v != null) social[k] = v; }
  return {
    title: redact(ent(((String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''))).replace(/\s+/g, ' ').trim(),
    description: metaOf(html, 'description') || '',
    canonical: (canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '',
    htags: { h1: tagText(html, 'h1').slice(0, 5), h2: tagText(html, 'h2').slice(0, 12), h3: tagText(html, 'h3').slice(0, 12) },
    social_media_tags: social,
    ...linkCounts(url, html),
    content: { plain_text_word_count: words(html) }
  };
};

(async () => {
  const probes = {};
  const home = 'https://' + DOMAIN + '/';
  // host probes: redirects NOT followed
  const hostProbe = async (url) => { const r = await get(url, { follow: false }); return { status: r.status, headers: r.headers, body_len: r.body_len, ...(r.error ? { error: r.error } : {}) }; };   // the audit reads only the status and the Location header of these
  probes.home = await hostProbe(home);
  probes.www_https = await hostProbe('https://www.' + DOMAIN + '/');
  probes.www_http = await hostProbe('http://www.' + DOMAIN + '/');
  probes.apex_http = await hostProbe('http://' + DOMAIN + '/');
  // content probes: redirects followed
  const hc = await get(home);
  // the host a crawler ends up on (apex or www): page URLs are stored on it, as DataForSEO's crawl reports them
  const siteHost = (String(hc.final_url || home).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || DOMAIN;
  const hr = await get(home);
  const robots = await get('https://' + DOMAIN + '/robots.txt', { accept: 'text/plain' });
  const sitemap = await get('https://' + DOMAIN + '/sitemap.xml', { accept: 'application/xml' });
  const llms = await get('https://' + DOMAIN + '/llms.txt', { accept: 'text/plain' });
  const markdown = await get(home, { accept: 'text/markdown' });
  probes.home_content = { status: hc.status, headers: hc.headers, body_len: hc.body_len, head: headOf(hc.body) };
  probes.home_repeat = { status: hr.status, headers: hr.headers, body_len: hr.body_len };
  probes.robots = { status: robots.status, headers: robots.headers, body_len: robots.body_len, text: redact(robots.body).slice(0, 20000) };
  probes.sitemap = { status: sitemap.status, headers: sitemap.headers, body_len: sitemap.body_len,
    is_index: /<sitemapindex/i.test(sitemap.body),
    locs: (sitemap.body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim()).slice(0, 2000) };
  probes.llms = { status: llms.status, headers: llms.headers, body_len: llms.body_len, has_html: /<html/i.test(llms.body), text: llms.body.length < 8000 ? redact(llms.body) : '' };
  probes.markdown = { status: markdown.status, headers: markdown.headers, body_len: markdown.body_len };
  for (const [name, ua] of Object.entries(BOTS)) { await sleep(300); const r = await get(home, { ua }); probes['bot:' + name] = { status: r.status, headers: { 'content-type': r.headers['content-type'] || '' }, body_len: r.body_len }; }

  const siteHome = 'https://' + siteHost + '/';
  const pages = [{ url: siteHome, status_code: hc.status, resource_type: 'html', click_depth: 0, checks: {}, meta: pageMeta(siteHome, hc.body) }];
  for (const path of EXTRA) { await sleep(300); const u = 'https://' + siteHost + path; const r = await get(u);
    pages.push({ url: u, status_code: r.status, resource_type: 'html', click_depth: 1, checks: {}, meta: pageMeta(u, r.body) }); }

  process.stdout.write(JSON.stringify({
    domain: DOMAIN,
    site_host: siteHost,
    fetched_at: new Date().toISOString().slice(0, 10),
    captured_by: 'harness/accuracy/capture.js (free public GETs only)',
    probes, pages,
    crawl: { domain_info: { checks: {}, ssl_info: {} }, page_metrics: {} }   // DataForSEO's own crawl flags are not captured: the set only labels what our code decides from our own fetches
  }, null, 1) + '\n');
})();
