// Where new opportunities come from this week (free): journalist requests on Bluesky (#journorequest — public API, weekly; matched to the
// site's topics later), and monthly: resource / "useful links" pages on the site's topics (web search, plain phrases: our SearXNG's site:
// searches return nothing since its Brave / DuckDuckGo engines are rate-limited — probe 2026-10-10), best-effort searches for the brand on
// the listing platforms, and our own old URLs in the Wayback Machine (CDX; those that now 404 get a redirect suggestion).
/*__LISTINGS__*/
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const enc = encodeURIComponent; const out = [];
const add = (p, kind, url, extra = {}) => out.push({ json: { site_id: p ? p.site_id : '', kind, url, ...extra } });
add(null, 'press', 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' + enc('#journorequest') + '&sort=latest&limit=100');
for (const p of plans) {
  for (const t of p.topics.slice(0, 3)) { const w = t.split(/\s+/).filter(x => x.length > 3).slice(0, 2).join(' '); if (w) add(p, 'press', 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' + enc('journorequest ' + w) + '&sort=latest&limit=50', { topic: t }); }
  if (p.due.resources) for (const t of p.topics.slice(0, 2)) {
    add(p, 'resource_search', 'http://searxng:8080/search?format=json&q=' + enc('"' + t + '" "useful links"'), { topic: t });
    add(p, 'resource_search', 'http://searxng:8080/search?format=json&q=' + enc(t + (p.country && !t.includes(p.country.toLowerCase()) ? ' ' + p.country : '') + ' resources links'), { topic: t });
  }
  if (p.due.listings) { const kind = siteKind(p.profile.business_type, p.topics.join(' ')); for (const l of listingsFor(kind, p.country_iso, p.topics.join(' ') + ' ' + p.profile.business_type, '').filter(l => l.re && !l.list).slice(0, 8))
    add(p, 'listing_search', 'http://searxng:8080/search?format=json&q=' + enc('"' + p.brand + '" ' + l.name.split(/[\s(—/]/)[0]), { listing_id: l.id }); }
  if (p.due.wayback) add(p, 'wayback', 'https://web.archive.org/cdx/search/cdx?url=' + enc(p.domain) + '&matchType=domain&output=json&fl=original,statuscode,timestamp&collapse=urlkey&filter=statuscode:200&limit=3000');
}
return out;
