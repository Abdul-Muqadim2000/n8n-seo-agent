/*__REGULATORS__*/
/*__REGULATORY__*/
// W0-F (page-quality programme 2026-10-29, PLAN §3 Fix 6): which local rules, dates and thresholds this page touches, and the free searches
// that find them on the official sites. Runs in front of the facts search (*Facts SERP*), so *Collect Facts* stays the one node the
// competitor analyzer, its token counter and *Parse Analysis* read: Analyze Competitor Pages -> Regulatory Plan -> SearXNG -> Regulatory
// Candidates -> (DataForSEO only when SearXNG is down) -> Read Regulatory Pages -> Collect Regulatory Facts -> Facts SERP -> Collect Facts.
// A topic is `core` when the keyword (or the AI question) names it and `context` when only the business's own facts, its own pages or the
// pages that rank name it (run 3299: "ms 365 erp" for a UAE ERP partner whose facts list "UAE e-invoicing (Peppol), VAT compliance").
// A market with no entry in v5/data/regulators.json, or a page that touches none of its topics, is not researched (one skip item).
const __main = () => {
  const prev = $input.first().json || {};
  const market = REG.marketOf(REGULATORS, prev.country_iso);
  const as_of = REG.asOfFor(prev.started_at, market ? market.utc_offset_hours : 0);
  const year = as_of.slice(0, 4);
  const urls = (Array.isArray(prev.site_urls) ? prev.site_urls : []).map(String);
  const pages = ((prev.site_model || {}).pages || []).filter(p => p && p.url);
  const own_titles = pages.map(p => [p.title, p.h1].filter(Boolean).join(' ')).concat(urls.map(u => u.replace(/^https?:\/\/[^\/]+/i, '')));
  const ctx = { keyword: String(prev.keyword || ''), ai_question: String(((prev.ai_target || {}).question) || ''), business_facts: [prev.business_facts, prev.business].filter(Boolean).join('\n'),
    own_titles, own_urls: urls.concat(pages.map(p => p.url)), terms: String(prev.term_digest || '') };
  const skip = (reason, extra) => [{ json: { skip: true, reason, regulatory_plan: { market: market ? market.iso : (prev.country_iso || ''), market_name: market ? market.name : (prev.country || ''), as_of, topics: [], own_posts: [], known_reads: [], ...(extra || {}) } } }];
  if (!market) return skip('no regulatory map for ' + (prev.country || prev.country_iso || 'this market') + ': nothing dated is researched or said');
  const topics = REG.topicsOf(market, ctx);
  if (!topics.length) return skip('the page touches none of the regulated topics on file for ' + market.name);
  // the client's own posts on the topic, read for consistency only (never the source of a date): at most two in all, the topic's first
  const ownSeen = new Set(), own_posts = [];
  for (const t of topics) for (const u of t.own_pages) { const k = REG.urlKey(u); if (ownSeen.has(k) || own_posts.length >= 2 || !/^https?:\/\//i.test(u)) continue; ownSeen.add(k); own_posts.push({ topic: t.id, url: u }); }
  // the official texts on file are read again live (the latest dated source wins, so a newer amendment found by the search still beats them)
  const known_reads = [];
  for (const t of topics) { const T = market.topics[t.id] || {}; const fresh = !T.fresh_until || T.fresh_until >= as_of;
    const u = [...new Set((T.known || []).filter(k => k && k.url).sort((a, b) => (String(a.source_date) < String(b.source_date) ? 1 : -1)).map(k => k.url))];
    if (fresh) u.slice(0, 1).forEach(url => known_reads.push({ topic: t.id, url })); }
  const regulatory_plan = { market: market.iso, market_name: market.name, as_of, topics: topics.map(t => ({ id: t.id, label: t.label, relevance: t.relevance, because: t.because, official: REG.officialOf(market, t.id) })),
    own_posts, known_reads };
  const tasks = [];
  for (const t of topics) for (const q of REG.queries(market, t.id, year)) {
    tasks.push({ id: 'rq' + (tasks.length + 1), topic: t.id, kind: q.kind, query: q.q, url: 'http://searxng:8080/search?format=json&safesearch=1&q=' + encodeURIComponent(q.q),
      location_code: prev.location_code, language_code: prev.language_code || 'en', regulatory_plan });
  }
  return tasks.map(t => ({ json: t }));
};
try { return __main(); } catch (e) {
  return [{ json: { skip: true, reason: 'the regulatory plan failed and the page goes on without it: ' + String((e && e.message) || e).slice(0, 200), regulatory_plan: null } }];
}
