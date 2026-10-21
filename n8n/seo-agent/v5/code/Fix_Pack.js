// Fix pack for every audit: ready-to-deploy files built from the audit's own data — robots.txt (current rules kept, sitemap line, AI search
// crawlers allowed, blocking "Disallow: /" removed for search engines), llms.txt (site summary + key pages by section), a redirect map for broken
// pages (CSV + nginx + Apache), Organization / LocalBusiness / WebSite schema from the business profile, Google Business Profile and homepage,
// internal links to add (CSV) and a README. Files are binaries (zipped by the next node for the e-mail) and plain text in fix_pack for the API.
// RV-1 (2026-10-21): the redirect map also carries every known address that no longer answers (the not-crawled check's gone list, with the
// page suggested for each), and the crawl's broken pages are read from every item (DataForSEO files a 404 under resource_type "broken",
// so the html-only list never held one and the README promised redirects that were not in the pack).
/*__GONE__*/
const d = $('Audit Diff').first().json; const a = d.site_audit || {};
const base = $('Check Crawl').first().json; const domain = base.domain;
const m = a.measurements || {}; const host = m.canonical_host || domain; const home = 'https://' + host + '/';
const crawlItems = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url);
const pages = crawlItems.filter(p => p.resource_type === 'html');
const E = a.entity || {}; const P = (() => { try { return $('Load Profile (Audit)').all().map(i => i.json).find(x => x && x.site_id === d.site_id) || {}; } catch (e) { return {}; } })();
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const files = [];
const add = (name, prop, mime, purpose, content) => files.push({ name, prop, mime, purpose, content });
const today = new Date().toISOString().slice(0, 10);
// ---- robots.txt (D17, 2026-10-11: the live file is EDITED, never rebuilt around an "Allow: /" group — a crawler named in its own group ignores
// the * group, so an allow-only group for the AI search bots opened /api/, /admin/ and /private/ to them) ----
// Rules: a site-wide "Disallow: /" for * is removed; an AI search crawler that a group blocks gets its own group WITH the * group's path rules
// copied in; a missing Sitemap line is added; anything else stays as it is. No change needed = the live file back, with a comment on top.
const cur = String(m.robots_txt || '').replace(/\r/g, '');
const AI_SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
const TRAINING = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'];
const isAiSearch = (agent) => AI_SEARCH.some(b => b.toLowerCase() === String(agent).trim().toLowerCase());
const isUA = (line) => /^\s*user-agent\s*:/i.test(line);
const blocks = []; let grp = null, prevUA = false;   // a group = its consecutive User-agent lines + the rules until the next group (the old split cut multi-agent groups apart)
for (const line of (cur ? cur.split('\n') : [])) { const ua = isUA(line); if (ua && !prevUA) { grp = []; blocks.push(grp); } if (!grp) { grp = []; blocks.push(grp); } grp.push(line); prevUA = ua || (prevUA && !line.trim()); }
const agentsOf = (b) => b.filter(isUA).map(x => x.split(':').slice(1).join(':').trim());
const rulesOf = (b) => b.filter(l => !isUA(l)).map(l => l.trim()).filter(l => l && !/^#/.test(l) && !/^\s*sitemap\s*:/i.test(l));
const blocksAll = (b) => b.some(l => /^\s*disallow\s*:\s*\/\s*$/i.test(l));
const star = blocks.find(b => agentsOf(b).includes('*'));
const starRules = star ? rulesOf(star).filter(l => /^(dis)?allow\s*:/i.test(l) && !/^disallow\s*:\s*\/\s*$/i.test(l)) : [];   // the * group's path rules (crawl-delay, host etc. stay with *)
const changes = []; const keep = []; const freed = [];
for (const b of blocks) { const agents = agentsOf(b); const text = b.join('\n');
  if (!agents.length) { if (!/^\s*sitemap\s*:/im.test(text) || b.some(l => l.trim() && !/^\s*(sitemap\s*:|#)/i.test(l))) keep.push(text.replace(/^\s*sitemap\s*:.*$/gim, '').trim()); continue; }   // lines before the first group (comments, Host); sitemap lines are re-added at the end
  if (blocksAll(b) && agents.includes('*')) { keep.push(text.replace(/^\s*disallow\s*:\s*\/\s*$/gim, '# Disallow: /   <- removed: it blocked every search engine').trim()); changes.push('removed "Disallow: /" for all crawlers'); continue; }
  const blockedAi = blocksAll(b) ? agents.filter(isAiSearch) : [];
  if (!blockedAi.length) { keep.push(text.replace(/^\s*sitemap\s*:.*$/gim, '').trim()); continue; }
  freed.push(...blockedAi);
  const rest = agents.filter(x => !isAiSearch(x));
  if (rest.length) keep.push(rest.map(x => 'User-agent: ' + x).join('\n') + '\n' + b.filter(l => !isUA(l)).join('\n').replace(/^\s*sitemap\s*:.*$/gim, '').trim());   // the other crawlers of that group keep their rules (training bots stay blocked)
}
const freedList = [...new Set(freed)];
if (freedList.length) changes.push('AI search crawler(s) ' + freedList.join(', ') + ' were blocked: they now get the same rules as every other crawler (' + (starRules.length ? starRules.length + ' path rule(s) copied from User-agent: *' : 'no path restrictions') + ')');
const sitemapLines = [...new Set((cur.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map(x => x.split(/:\s*/).slice(1).join(':').trim()))];
if (!cur) changes.push('created robots.txt (the site has none)');
if (!sitemapLines.length) { sitemapLines.push(home + 'sitemap.xml'); if (cur) changes.push('added the Sitemap line'); }
const header = '# robots.txt for ' + host + ' — reviewed by the SEO audit on ' + today + '\n# Changes: ' + (changes.length ? changes.join('; ') : 'none needed') + '\n\n';
const aiGroup = freedList.length ? '# AI search crawlers: they fetch a page when a user asks, so your pages can be cited in ChatGPT, Perplexity and Claude answers.\n# They get the same path rules as User-agent: * (a crawler named in its own group ignores the * group).\n' + freedList.map(b => 'User-agent: ' + b).join('\n') + '\n' + (starRules.length ? starRules.join('\n') : 'Allow: /') + '\n\n' : '';
const robots = changes.length
  ? header + (keep.filter(Boolean).length ? keep.filter(Boolean).join('\n\n') + '\n\n' : 'User-agent: *\nAllow: /\n\n') + aiGroup + '# AI training crawlers (' + TRAINING.join(', ') + ') are left as they were. To opt out of model training, add:\n# User-agent: GPTBot\n# Disallow: /\n\n' + sitemapLines.map(s => 'Sitemap: ' + s).join('\n') + '\n'
  : header + cur.trim() + '\n';
add('robots.txt', 'fix_robots', 'text/plain', changes.length ? 'Replace /robots.txt (' + changes.length + ' change(s): ' + changes.join('; ') + ')' : 'Keep /robots.txt as it is (no change needed; this copy only adds a comment on top)', robots);
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
const broken = crawlItems.filter(p => (p.resource_type === 'html' || p.resource_type === 'broken') && ((p.checks || {}).is_broken || Number(p.status_code) >= 400)).slice(0, 100);
const map = broken.map(b => { const bt = new Set(toks(pathOf(b.url))); let best = home, score = 0; for (const l of live) { const s = toks(pathOf(l.url)).filter(t => bt.has(t)).length; if (s > score) { score = s; best = l.url; } } return { from: pathOf(b.url), to: pathOf(best), status: b.status_code, match: score ? 'same topic' : 'homepage (no close match: pick a better page if you have one)' }; });
// RV-1: the known addresses that no longer answer (Search Console still shows most of them), each with the page suggested for it
for (const r of (((a.not_crawled_check || {}).redirects) || [])) { const from = GONE.pathOf(r.from_url || r.from); if (!from || from === '/' || map.some(m => GONE.pathOf(m.from) === from)) continue;
  map.push({ from, to: GONE.pathOf(r.to_url || r.to || '/'), status: r.status || 404, match: r.match || '' }); }
if (map.length) {
  add('redirects.csv', 'fix_redirects_csv', 'text/csv', map.length + ' broken URL(s) → closest live page (301)', 'from,to,http_status_now,match\n' + map.map(r => [r.from, r.to, r.status, r.match].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
  add('redirects-nginx.conf', 'fix_redirects_nginx', 'text/plain', 'The same map for nginx (server block)', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'location = ' + r.from.replace(/\?.*$/, '') + ' { return 301 ' + r.to + '; }').join('\n') + '\n');
  add('redirects.htaccess', 'fix_redirects_htaccess', 'text/plain', 'The same map for Apache / .htaccess', '# 301 redirects for broken URLs found by the audit on ' + today + '\n' + map.map(r => 'Redirect 301 ' + r.from.replace(/\?.*$/, '') + ' ' + r.to).join('\n') + '\n');
}
// ---- schema: Organization (+ LocalBusiness when an address exists) and WebSite ----
// 2026-10-13 (re-rating §3.2 "Also seen"): the fix pack asked the owner to add a `sameAs` profile the homepage already carries — the
// same LinkedIn page in two spellings (the schema's and the footer link's) survived the exact-string Set, and the purpose line counted
// both. Profiles are now deduped by identity (host without www, path without its trailing slash) in the spelling the page already uses,
// and the line says which are already on the page and which are genuinely new, so nothing is offered "to add" that is already there.
const profKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const onPageSame = [...((E.homepage_org || {}).sameAs || [])].filter(u => /^https?:\/\//.test(u));
const offPageSame = [...(E.homepage_social || []), ...(E.gbp && E.gbp.cid ? ['https://maps.google.com/?cid=' + E.gbp.cid] : [])].filter(u => /^https?:\/\//.test(u));
const sameAs = []; const sameSeen = new Set();
for (const u of [...onPageSame, ...offPageSame]) { const k = profKey(u); if (!k || sameSeen.has(k)) continue; sameSeen.add(k); sameAs.push(u); }
const onPageKeys = new Set(onPageSame.map(profKey));
const sameAs_new = sameAs.filter(u => !onPageKeys.has(profKey(u)));          // what this block really adds
const sameAs_kept = sameAs.filter(u => onPageKeys.has(profKey(u)));          // already in the homepage's Organization schema: kept, not "to add"
const sameNote = !sameAs.length ? 'fill in the sameAs placeholders'
  : sameAs_new.length ? sameAs_new.length + ' official profile(s) to add in sameAs' + (sameAs_kept.length ? ', ' + sameAs_kept.length + ' kept from the schema your homepage already has' : '')
  : 'the ' + sameAs_kept.length + ' official profile(s) your homepage already lists, unchanged — nothing new to add there';
const org = { '@context': 'https://schema.org', '@type': 'Organization', '@id': home + '#organization', name: siteName, url: home, ...(P.logo_url || (E.homepage_org || {}).logo ? { logo: P.logo_url || E.homepage_org.logo } : { logo: '[Logo URL, 112x112 px or larger]' }),
  ...(P.phone || (E.gbp || {}).phone || (E.homepage_org || {}).telephone ? { contactPoint: { '@type': 'ContactPoint', telephone: P.phone || (E.gbp || {}).phone || E.homepage_org.telephone, contactType: 'customer service', ...(P.public_email ? { email: P.public_email } : {}) } } : {}), sameAs: sameAs.length ? sameAs : ['[LinkedIn company page URL]', '[Google Business Profile URL]'] };
add('organization.jsonld', 'fix_schema_org', 'application/ld+json', 'Organization schema for the homepage (' + sameNote + ')', '<script type="application/ld+json">\n' + JSON.stringify(org, null, 2) + '\n</script>\n');
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
const readme = 'FIX PACK for ' + domain + ' (SEO audit of ' + today + ')\n\n' + files.map(f => '* ' + f.name + ': ' + f.purpose).join('\n') + '\n\nHow to use: robots.txt and llms.txt go to the site root; ' + (map.length ? 'add the redirects in your server or CDN (test a few URLs afterwards); ' : '') + 'paste the .jsonld blocks into the page <head> (organization + website on the homepage, localbusiness on the contact page), replace any [placeholder]; add the internal links in the page copy, with the anchor text or a natural variant. The next audit checks the result and lists what was fixed.\n';
add('README.txt', 'fix_readme', 'text/plain', 'What each file is and how to deploy it', readme);
const binary = {}; for (const f of files) binary[f.prop] = { data: Buffer.from(f.content, 'utf8').toString('base64'), mimeType: f.mime, fileName: f.name, fileExtension: f.name.split('.').pop() };
return [{ json: { ...d, site_audit: { ...a, fix_pack: { files: files.map(f => ({ name: f.name, purpose: f.purpose, bytes: Buffer.byteLength(f.content, 'utf8') })), robots_changes: changes } }, fix_pack: { generated_at: today, files: files.map(f => ({ name: f.name, purpose: f.purpose, content: f.content })) }, fix_props: files.map(f => f.prop) }, binary }];
