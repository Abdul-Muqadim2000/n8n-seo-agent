// Index coverage: our own read of the pages Google does not have (DESIGN §1.5): status, X-Robots-Tag, meta robots, the canonical the page
// names, the words of its main text and its title. The pages read today: every page an inspection (ours today, or the Site Tracker's reused
// one) says is not indexed; then (fix wave 1, X7) the pages with a step on the client's site whose last read is a day old, so a fix is seen
// the next day; then stored not-indexed pages last read more than a week ago - new pages first, sitemap pages next - at most IX.CFG.fetch_cap a
// website a day. Listing / filter / account pages and removed pages nothing points to are not read; robots.txt blocks are checked against
// robots.txt itself. E11: the address is rebuilt from its strict parse and must be on the site's own domain; no fetch follows a redirect.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const inv = $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access);
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const pq = grab('Index Probe Requests').filter(q => q && !q.skip);
const fresh = IX.readingsOf([[pq, grab('Inspect URL (Probe)').slice(0, pq.length)], [grab('Index Inspect Requests').filter(q => q && !q.skip), grab('Inspect URL (Index)')],
  [grab('Inspect Retry Requests').filter(q => q && !q.skip), grab('Inspect URL (Retry)'), true]]);
const out = [];
for (const v of inv) {
  const cands = [];
  for (const p of (v.pages || [])) {
    if (IX.isLowValue(p.url, p) || IX.isGone(p) || S(p.cause) === 'robots_blocked' || S(p.cause) === 'robots_intended') continue;
    const url = IX.safe(p.url, v.site); if (!url) continue;
    const r = fresh.get(v.site_id + '|' + IX.key(p.url)) || p._reuse || null;
    const notIdx = (x) => x && x.ok !== false && !(S(x.verdict) === 'PASS' || IX.covCause(x.coverage) === 'indexed');
    if (r && r.ok === false) continue;
    const age = !S(p.fetch_at) ? Infinity : now - Date.parse(p.fetch_at);
    const siteFix = S(p.action) === 'site_fix' || !!S(p.fix_seen_at);
    if (r ? notIdx(r) : siteFix ? age > 20 * 3600e3 : ((S(p.state) === 'not_indexed' || S(p.state) === 'excluded') && age > IX.CFG.fetch_refresh_days * IX.DAY))
      cands.push({ p, url, rank: r ? 0 : siteFix ? 1 : 2 });
  }
  cands.sort((a, b) => (a.rank - b.rank) || ((b.p.lane === 'new') - (a.p.lane === 'new')) || ((!!b.p.in_sitemap) - (!!a.p.in_sitemap)) || S(a.p.url).localeCompare(S(b.p.url)));
  for (const c of cands.slice(0, IX.CFG.fetch_cap)) out.push({ json: { site_id: v.site_id, url: c.url, page_url: c.p.url } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no page to read today' } }];
