// Fix pack for every audit: ready-to-deploy files built from the audit's own data — robots.txt (current rules kept, sitemap line, AI search
// crawlers allowed, blocking "Disallow: /" removed for search engines), llms.txt (site summary + key pages by section), a redirect map for broken
// pages (CSV + nginx + Apache), Organization / LocalBusiness / WebSite schema from the business profile, Google Business Profile and homepage,
// internal links to add (CSV) and a README. Files are binaries (zipped by the next node for the e-mail) and plain text in fix_pack for the API.
const d = $('Audit Diff').first().json; const a = d.site_audit || {};
const base = $('Check Crawl').first().json; const domain = base.domain;
const m = a.measurements || {}; const host = m.canonical_host || domain; const home = 'https://' + host + '/';
const pages = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.resource_type === 'html');
const E = a.entity || {}; const P = (() => { try { return $('Load Profile (Audit)').all().map(i => i.json).find(x => x && x.site_id === d.site_id) || {}; } catch (e) { return {}; } })();
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const files = [];
const add = (name, prop, mime, purpose, content) => files.push({ name, prop, mime, purpose, content });
const today = new Date().toISOString().slice(0, 10);
// ---- robots.txt ----
const cur = String(m.robots_txt || '');
const AI_SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
const TRAINING = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'];
const blocks = cur ? cur.replace(/\r/g, '').split(/\n(?=\s*user-agent\s*:)/i) : [];
const changes = []; const keep = [];
for (const b of blocks) { const agents = (b.match(/user-agent\s*:\s*(.+)/gi) || []).map(x => x.split(':')[1].trim());
  const all = /disallow\s*:\s*\/\s*($|\n)/i.test(b);
  if (all && agents.some(x => x === '*')) { keep.push(b.replace(/^\s*disallow\s*:\s*\/\s*$/gim, '# Disallow: /   <- removed: it blocked every search engine').trim()); changes.push('removed "Disallow: /" for all crawlers'); continue; }
  if (all && agents.some(x => AI_SEARCH.map(y => y.toLowerCase()).includes(x.toLowerCase()))) { changes.push('stopped blocking AI search crawler(s): ' + agents.join(', ')); continue; }
  if (!/^\s*sitemap\s*:/im.test(b) || agents.length) keep.push(b.replace(/^\s*sitemap\s*:.*$/gim, '').trim()); }
const sitemapLines = [...new Set([...(cur.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map(x => x.split(/:\s*/).slice(1).join(':').trim()), home + 'sitemap.xml'])];
if (!/sitemap\s*:/i.test(cur)) changes.push('added the Sitemap line');
const hasAiGroup = AI_SEARCH.every(b => new RegExp('user-agent\\s*:\\s*' + b, 'i').test(cur));
if (!hasAiGroup) changes.push('added an explicit allow group for AI search crawlers (they fetch pages to cite them in answers)');
const robots = '# robots.txt for ' + host + ' — proposed by the SEO audit on ' + today + '\n# Changes: ' + (changes.length ? changes.join('; ') : 'none needed') + '\n\n' + (keep.length ? keep.join('\n\n') + '\n\n' : 'User-agent: *\nAllow: /\n\n') +
  (hasAiGroup ? '' : '# AI search crawlers: they fetch a page when a user asks, so your pages can be cited in ChatGPT, Perplexity and Claude answers\n' + AI_SEARCH.map(b => 'User-agent: ' + b).join('\n') + '\nAllow: /\n\n') +
  '# AI training crawlers (' + TRAINING.join(', ') + ') are left as they were. To opt out of model training, add:\n# User-agent: GPTBot\n# Disallow: /\n\n' + sitemapLines.map(s => 'Sitemap: ' + s).join('\n') + '\n';
add('robots.txt', 'fix_robots', 'text/plain', 'Replace /robots.txt (' + (changes.length ? changes.length + ' change(s)' : 'no change needed, only comments') + ')', robots);
// ---- llms.txt ----
const titleOf = (p) => String(((p.meta || {}).htags || {}).h1?.[0] || (p.meta || {}).title || '').replace(/\s+[|–—-]\s+[^|–—]+$/, '').trim();
const good = pages.filter(p => p.status_code === 200 && !(p.checks || {}).is_redirect && (p.meta || {}).canonical !== undefined && !/(\?|\/(tag|category|author|page|feed)\b|privacy|terms|cookie|login|cart|checkout)/i.test(p.url))
  .sort((x, y) => (Number(x.click_depth) || 9) - (Number(y.click_depth) || 9) || (Number((y.meta || {}).inbound_links_count) || 0) - (Number((x.meta || {}).inbound_links_count) || 0)).slice(0, 60);
const homePage = good.find(p => pathOf(p.url) === '/') || pages.find(p => pathOf(p.url) === '/') || {};
const siteName = P.business_name || (E.homepage_org && E.homepage_org.name) || E.business_name || titleOf(homePage) || domain;
const summary = String((homePage.meta || {}).description || '').trim() || 'Website of ' + siteName + '.';
const sections = new Map();
for (const p of good) { if (pathOf(p.url) === '/') continue; const seg = (pathOf(p.url).split('/').filter(Boolean)[0] || 'pages'); const key = /blog|news|insight|article|resource|guide/i.test(seg) ? 'Guides and articles' : /service|solution|product|offer/i.test(seg) ? 'Services' : /case|work|project|client/i.test(seg) ? 'Case studies' : /about|team|contact|career/i.test(seg) ? 'Company' : 'Pages';
  if (!sections.has(key)) sections.set(key, []); const t = titleOf(p); if (t && sections.get(key).length < 15) sections.get(key).push('- [' + t.replace(/[\[\]]/g, '') + '](' + p.url + ')' + ((p.meta || {}).description ? ': ' + String(p.meta.description).replace(/\s+/g, ' ').slice(0, 160) : '')); }
const ORDER = ['Services', 'Guides and articles', 'Case studies', 'Pages', 'Company'];
const llms = '# ' + siteName + '\n\n> ' + summary.replace(/\s+/g, ' ') + '\n\n' + (P.city || P.phone ? (P.city ? 'Based in ' + [P.city, P.country_code].filter(Boolean).join(', ') + '. ' : '') + (P.phone ? 'Phone: ' + P.phone + '. ' : '') + 'Website: ' + home + '\n\n' : '') +
  ORDER.filter(k => (sections.get(k) || []).length).map(k => '## ' + k + '\n\n' + sections.get(k).join('\n')).join('\n\n') + '\n';
add('llms.txt', 'fix_llms', 'text/markdown', m.llms_txt_present ? 'A refreshed /llms.txt (you already have one: compare first)' : 'Publish at /llms.txt (a clean map of the site for AI tools)', llms);
// ---- redirect map for broken pages ----
const live = good.filter(p => pathOf(p.url) !== '/');
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2);
const broken = pages.filter(p => (p.checks || {}).is_broken || Number(p.status_code) >= 400).slice(0, 100);
const map = broken.map(b => { const bt = new Set(toks(pathOf(b.url))); let best = home, score = 0; for (const l of live) { const s = toks(pathOf(l.url)).filter(t => bt.has(t)).length; if (s > score) { score = s; best = l.url; } } return { from: pathOf(b.url), to: pathOf(best), status: b.status_code, match: score ? 'same topic' : 'homepage (no close match: pick a better page if you have one)' }; });
if (map.length) {
  add('redirects.csv', 'fix_redirects_csv', 'text/csv', map.length + ' broken URL(s) → closest live page (301)', 'from,to,http_status_now,match\n' + map.map(r => [r.from, r.to, r.status, r.match].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
  add('redirects-nginx.conf', 'fix_redirects_nginx', 'text/plain', 'The same map for nginx (server block)', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'location = ' + r.from.replace(/\?.*$/, '') + ' { return 301 ' + r.to + '; }').join('\n') + '\n');
  add('redirects.htaccess', 'fix_redirects_htaccess', 'text/plain', 'The same map for Apache / .htaccess', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'Redirect 301 ' + r.from.replace(/\?.*$/, '') + ' ' + r.to).join('\n') + '\n');
}
// ---- schema: Organization (+ LocalBusiness when an address exists) and WebSite ----
const sameAs = [...new Set([...((E.homepage_org || {}).sameAs || []), ...(E.homepage_social || []), ...(E.gbp && E.gbp.cid ? ['https://maps.google.com/?cid=' + E.gbp.cid] : [])].filter(u => /^https?:\/\//.test(u)))];
const org = { '@context': 'https://schema.org', '@type': 'Organization', '@id': home + '#organization', name: siteName, url: home, ...(P.logo_url || (E.homepage_org || {}).logo ? { logo: P.logo_url || E.homepage_org.logo } : { logo: '[Logo URL, 112x112 px or larger]' }),
  ...(P.phone || (E.gbp || {}).phone || (E.homepage_org || {}).telephone ? { contactPoint: { '@type': 'ContactPoint', telephone: P.phone || (E.gbp || {}).phone || E.homepage_org.telephone, contactType: 'customer service', ...(P.public_email ? { email: P.public_email } : {}) } } : {}), sameAs: sameAs.length ? sameAs : ['[LinkedIn company page URL]', '[Google Business Profile URL]'] };
add('organization.jsonld', 'fix_schema_org', 'application/ld+json', 'Organization schema for the homepage (' + (sameAs.length ? sameAs.length + ' official profiles in sameAs' : 'fill in the sameAs placeholders') + ')', '<script type="application/ld+json">\n' + JSON.stringify(org, null, 2) + '\n</script>\n');
const HA = (E.homepage_org && E.homepage_org.address && typeof E.homepage_org.address === 'object') ? E.homepage_org.address : {};
if (P.street_address || (E.gbp && E.gbp.address) || HA.streetAddress) {
  const lb = { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': home + '#business', name: siteName, url: home, telephone: P.phone || (E.gbp || {}).phone || (E.homepage_org || {}).telephone || '[Phone]', address: { '@type': 'PostalAddress', streetAddress: P.street_address || HA.streetAddress || (E.gbp || {}).address || '[Street address]', addressLocality: P.city || HA.addressLocality || '[City]', ...((P.region || HA.addressRegion) ? { addressRegion: P.region || HA.addressRegion } : {}), ...((P.postal_code || HA.postalCode) ? { postalCode: P.postal_code || HA.postalCode } : {}), addressCountry: P.country_code || HA.addressCountry || base.country_iso || '[Country code]' },
    ...(P.opening_hours ? { openingHours: P.opening_hours } : {}), ...(sameAs.length ? { sameAs } : {}), parentOrganization: { '@id': home + '#organization' } };
  add('localbusiness.jsonld', 'fix_schema_local', 'application/ld+json', 'LocalBusiness schema for the contact / location page (name, address and phone must match Google Business Profile)', '<script type="application/ld+json">\n' + JSON.stringify(lb, null, 2) + '\n</script>\n');
}
add('website.jsonld', 'fix_schema_website', 'application/ld+json', 'WebSite schema for the homepage (site name shown in Google results)', '<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': home + '#website', name: siteName, url: home, publisher: { '@id': home + '#organization' } }, null, 2) + '\n</script>\n');
// ---- internal links ----
const il = a.internal_links || [];
if (il.length) add('internal-links.csv', 'fix_internal_links', 'text/csv', il.length + ' internal links to add (from page → to page, with an anchor)', 'from_page,to_page,anchor_text,why\n' + il.map(l => [l.from_url, l.to_url, l.anchor, l.reason].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
const readme = 'FIX PACK for ' + domain + ' — SEO audit of ' + today + '\n\n' + files.map(f => '* ' + f.name + ': ' + f.purpose).join('\n') + '\n\nHow to use: robots.txt and llms.txt go to the site root; add the redirects in your server or CDN (test a few URLs afterwards); paste the .jsonld blocks into the page <head> (organization + website on the homepage, localbusiness on the contact page), replace any [placeholder]; add the internal links in the page copy, with the anchor text or a natural variant. The next audit checks the result and lists what was fixed.\n';
add('README.txt', 'fix_readme', 'text/plain', 'What each file is and how to deploy it', readme);
const binary = {}; for (const f of files) binary[f.prop] = { data: Buffer.from(f.content, 'utf8').toString('base64'), mimeType: f.mime, fileName: f.name, fileExtension: f.name.split('.').pop() };
return [{ json: { ...d, site_audit: { ...a, fix_pack: { files: files.map(f => ({ name: f.name, purpose: f.purpose, bytes: Buffer.byteLength(f.content, 'utf8') })), robots_changes: changes } }, fix_pack: { generated_at: today, files: files.map(f => ({ name: f.name, purpose: f.purpose, content: f.content })) }, fix_props: files.map(f => f.prop) }, binary }];
