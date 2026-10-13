// G11 (2026-10-13): one seo_page_watch row per key page that was read today (exact table columns — the Data Table node auto-maps every field
// it is given). A page whose fetch failed is left out: its stored reading stays as it was, so one timeout can never erase the baseline a
// change is measured against. The Google view (inspect_*, written by the weekly URL Inspection, G25) is carried over untouched.
/*__PAGE_WATCH__*/
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = [];
for (const s of sites) {
  for (const p of (s.pages || [])) {
    if (!p.ok) continue;
    const real = (p.changes || []).filter(c => c.severity !== 'info');
    const ins = p.inspect || {};
    rows.push({
      site_id: s.site_id, domain: s.domain, url: S(p.url).slice(0, 500), kind: S(p.kind), weight: Number(p.weight) || 0, checked_at: s.checked_at,
      status: Number(p.status) || 0, location: S(p.location).slice(0, 500), noindex: !!p.noindex, noindex_source: S(p.noindex_source),
      canonical: S(p.canonical).slice(0, 500), canonical_ok: p.canonical_ok === true, title: S(p.title).slice(0, 300), title_hash: PW.hash(S(p.title)),
      titles: Number(p.titles) || 0, description: S(p.description).slice(0, 400), h1: S(p.h1).slice(0, 300), h1s: Number(p.h1s) || 0,
      robots_blocked: p.robots_blocked === true, robots_hash: S(s.robots.hash) || S((p.prev || {}).robots_hash),
      state: S(p.state), changes: real.map(c => c.code).join(','),
      last_change_at: real.length ? s.checked_at : S((p.prev || {}).last_change_at),
      changed_count: Number((p.prev || {}).changed_count || 0) + (real.length ? 1 : 0), error: '',
      inspect_at: S(ins.inspect_at), index_state: S(ins.index_state), indexed: S(ins.indexed), coverage: S(ins.coverage),
      google_canonical: S(ins.google_canonical), last_crawl: S(ins.last_crawl), mobile: S(ins.mobile), rich_results: S(ins.rich_results), inspect_error: S(ins.inspect_error),
    });
  }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no key page could be read in this watch' } }];
