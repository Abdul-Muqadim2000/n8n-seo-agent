// Free link and mention sources (v4.10, no key, $0), one GET per item for *Fetch Sources*:
// - Wikipedia (MediaWiki exturlusage, English + the site's language, full runs): articles that cite the site (namespace 0 kept; asking the
//   API for namespace 0 with a wildcard returns an empty first batch). Nofollow, but the source AI assistants and journalists trust most.
//   Wikimedia's robot policy: one request at a time, a descriptive User-Agent (*Fetch Sources* sends one).
// - Hacker News (Algolia, full runs): stories that link to the site.
// - Web search through the stack's own SearXNG (full runs): pages naming the brand outside the site (unlinked mentions are checked later by
//   fetching the page) and "best <topic> in <country>" list pages (which competitors they name, and whether they name you).
// GDELT news is fetched separately (*News Requests*: its API allows one request every 5 seconds). Reddit refuses unauthenticated requests
// (403 since May 2026; its API needs an approved app and a commercial agreement) and Google News RSS is for personal, non-commercial use
// only: neither is used.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
const add = (p, kind, url, extra = {}) => out.push({ json: { site_id: p.site_id, domain: p.domain, kind, url, ...extra } });
const enc = encodeURIComponent;
for (const p of plans) {
  if (p.mode !== 'full') continue;
  const langs = [...new Set(['en', String(p.language_code || 'en').slice(0, 2).toLowerCase()])].filter(l => /^[a-z]{2}$/.test(l));
  for (const lang of langs) for (const q of [p.domain])   // the plain domain also matches its subdomains (checked live 2026-10-08)
    add(p, 'wiki', 'https://' + lang + '.wikipedia.org/w/api.php?action=query&list=exturlusage&format=json&euprop=ids|title|url&eulimit=500&euquery=' + enc(q), { lang });
  add(p, 'hn', 'https://hn.algolia.com/api/v1/search?restrictSearchableAttributes=url&tags=story&hitsPerPage=100&query=' + enc(p.domain));
  add(p, 'searx_mention', 'http://searxng:8080/search?format=json&q=' + enc('"' + p.brand_query + '" -site:' + p.domain));
  if (p.brand_query !== p.domain) add(p, 'searx_mention', 'http://searxng:8080/search?format=json&q=' + enc('"' + p.domain + '" -site:' + p.domain));
  for (const t of (p.topics || []).slice(0, 2)) add(p, 'searx_list', 'http://searxng:8080/search?format=json&q=' + enc('best ' + t + (p.country_name && !t.includes(p.country_name.toLowerCase()) ? ' ' + p.country_name : '')), { topic: t });
}
return out.length ? out : [{ json: { skip: true } }];
