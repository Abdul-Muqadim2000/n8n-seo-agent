// Index coverage: our own read of the pages Google does not have (DESIGN §1.5): status after redirects, X-Robots-Tag, meta robots, the
// canonical the page names, the words of its main text and its title. The pages read today: every page an inspection (ours today, or the
// Site Tracker's reused one) says is not indexed, then stored not-indexed pages last read more than a week ago - new pages first, sitemap pages
// next - at most IX.CFG.fetch_cap a website a day. Listing / filter / account pages and removed pages nothing points to are not read. Plain GETs.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const inv = $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access);
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const reqs = grab('Index Probe Requests').filter(q => q && !q.skip).concat(grab('Index Inspect Requests').filter(q => q && !q.skip));
const res = grab('Inspect URL (Probe)').slice(0, grab('Index Probe Requests').filter(q => q && !q.skip).length).concat(grab('Inspect URL (Index)'));
const fresh = new Map(); reqs.forEach((q, i) => fresh.set(q.site_id + '|' + IX.key(q.inspect_url), IX.readInspection(res[i] || {})));
const out = [];
for (const v of inv) {
  const cands = [];
  for (const p of (v.pages || [])) {
    if (IX.isLowValue(p.url) || IX.isGone(p)) continue;
    const r = fresh.get(v.site_id + '|' + IX.key(p.url)) || p._reuse || null;
    const notIdx = (x) => x && x.ok !== false && !(S(x.verdict) === 'PASS' || IX.covCause(x.coverage) === 'indexed');
    if (r && r.ok === false) continue;
    const stale = !S(p.fetch_at) || now - Date.parse(p.fetch_at) > IX.CFG.fetch_refresh_days * IX.DAY;
    if (r ? notIdx(r) : ((S(p.state) === 'not_indexed' || S(p.state) === 'excluded') && stale)) cands.push({ p, fresh: !!r });
  }
  cands.sort((a, b) => (b.fresh - a.fresh) || ((b.p.lane === 'new') - (a.p.lane === 'new')) || ((!!b.p.in_sitemap) - (!!a.p.in_sitemap)) || S(a.p.url).localeCompare(S(b.p.url)));
  for (const c of cands.slice(0, IX.CFG.fetch_cap)) out.push({ json: { site_id: v.site_id, url: c.p.url } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no page to read today' } }];
