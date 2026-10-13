// G11 (2026-10-13): today's reading against the stored one, per site. What counts as a change: the page is gone or answers 5xx, it started
// redirecting, it asks not to be indexed, robots.txt started blocking it, its canonical moved or was removed, its title changed — and
// robots.txt itself changed (its fingerprint lives in seo_cache, as the sitemap fingerprints do). An unchanged page says nothing and costs
// one GET. A page whose fetch failed is "not checked": no alert, and its stored reading is kept exactly as it was.
// The same reading answers the re-check queue ("I fixed this"), so a finding the watch can judge is answered within a day instead of at the
// next monthly audit; one it cannot judge says so (PW.recheck).
/*__PAGE_WATCH__*/
const reads = $input.all().map(i => i.json).filter(r => r && r.site_id);
const bySite = new Map();
for (const r of reads) { if (!bySite.has(r.site_idx)) bySite.set(r.site_idx, []); bySite.get(r.site_idx).push(r); }
const S = (v) => String(v == null ? '' : v).trim();
const nowIso = new Date().toISOString();
const out = [];
for (const [site_idx, items] of bySite) {
  const site = (items.find(i => i.site) || {}).site || {};
  const robotsItem = items.find(i => i.kind === 'robots') || null;
  const robots = (robotsItem && robotsItem.robots) || { ok: false, status: 0, hash: '', error: 'robots.txt was not read' };
  const robotsChange = PW.robotsChange(site.robots_hash_prev, robots);
  const pages = items.filter(i => i.kind !== 'robots');
  const checked = pages.filter(p => p.ok !== false);
  const notChecked = pages.filter(p => p.ok === false);
  const changes = [];
  const pageStates = pages.map(p => {
    const prev = p.prev || null;
    const ch = PW.compare(prev, p, { url: p.url, robots_blocked: p.robots_blocked, robots_blocked_before: prev ? prev.robots_blocked === true : false });
    for (const c of ch) changes.push({ ...c, url: p.url, kind: p.kind });
    const first = !prev || !S(prev.checked_at);
    return { url: p.url, kind: p.kind, weight: p.weight, ok: p.ok !== false, status: p.status, location: S(p.location), noindex: !!p.noindex, noindex_source: S(p.noindex_source),
      canonical: S(p.canonical), canonical_ok: p.ok === false ? null : (!S(p.canonical) ? null : PW.helpers.same(p.canonical, p.url)),
      title: S(p.title), titles: p.titles || 0, description: S(p.description), h1: S(p.h1), h1s: p.h1s || 0, robots_blocked: p.robots_blocked,
      error: S(p.error), first_seen: first, state: PW.state(ch, p), changes: ch,
      // the Google view of this page as it was stored (written by the weekly URL Inspection, G25): carried, never re-claimed here
      inspect: prev ? { inspect_at: S(prev.inspect_at), index_state: S(prev.index_state), indexed: S(prev.indexed), coverage: S(prev.coverage),
        google_canonical: S(prev.google_canonical), last_crawl: S(prev.last_crawl), mobile: S(prev.mobile), rich_results: S(prev.rich_results), inspect_error: S(prev.inspect_error) } : null,
      prev: prev ? { checked_at: S(prev.checked_at), status: Number(prev.status) || 0, noindex: prev.noindex === true, canonical: S(prev.canonical), title: S(prev.title),
        state: S(prev.state), last_change_at: S(prev.last_change_at), changed_count: Number(prev.changed_count) || 0, robots_hash: S(prev.robots_hash) } : null };
  });
  if (robotsChange) changes.push({ ...robotsChange, url: robotsItem ? robotsItem.url : '', kind: 'robots' });
  // the re-checks this site asked for, answered on the pages that were just read
  const rechecks = (site.rechecks || []).map(f => { const r = PW.recheck(f, pageStates.filter(p => p.ok).map(p => ({ ...p, url: p.url }))); return { ...f, ...r, checked_at: nowIso }; });
  const real = changes.filter(c => c.severity !== 'info');
  const indexable = pageStates.filter(p => p.ok && Number(p.status) >= 200 && Number(p.status) < 300 && !p.noindex && p.robots_blocked !== true).length;
  out.push({ json: {
    site_idx, site_id: site.site_id || items[0].site_id, domain: site.domain || items[0].domain, checked_at: nowIso, on_demand: !!site.on_demand,
    email: S(site.email), callback_url: S(site.callback_url), last_checked_at: S(site.last_checked_at),
    pages: pageStates, changes, alerts: changes, rechecks,
    robots: { ok: robots.ok !== false, status: robots.status || 0, hash: S(robots.hash), prev_hash: S(site.robots_hash_prev), length: robots.length || 0, error: S(robots.error), changed: !!robotsChange,
      blocks_key_pages: pageStates.filter(p => p.robots_blocked === true).map(p => p.url) },
    summary: { pages_watched: pages.length, pages_checked: checked.length, pages_not_checked: notChecked.length, pages_known: Number(site.pages_known) || 0,
      indexable, changed: real.length, critical: changes.filter(c => c.severity === 'critical').length, high: changes.filter(c => c.severity === 'high').length,
      first_run: pageStates.every(p => p.first_seen), worst: PW.worst(changes), rechecks: rechecks.length, cap: Number(site.max_watch_pages) || PW.helpers.n0(site.pages_watched),
      cost_usd: 0, requests: items.length },
    not_checked: notChecked.map(p => ({ url: p.url, error: S(p.error) })),
    stage: 'page_watch',
  } });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing was read in this watch' } }];
