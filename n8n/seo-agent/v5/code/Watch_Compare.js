// G11 (2026-10-13): today's reading against the stored one, per site. What counts as a change: the page is gone or answers 5xx, it started
// redirecting, it asks not to be indexed, robots.txt started blocking it, its canonical moved or was removed, its title changed — and
// robots.txt itself changed (its fingerprint lives in seo_cache, as the sitemap fingerprints do). An unchanged page says nothing and costs
// one GET. A page whose fetch failed is "not checked": no alert, and its stored reading is kept exactly as it was.
// The same reading answers the re-check queue ("I fixed this"), so a finding the watch can judge is answered within a day instead of at the
// next monthly audit; one it cannot judge says so (PW.recheck).
// Build section 194 (client report 2026-11-17, devaicon.com F5 / F10): the severity is what Google does. robots.txt is a state (ok / missing /
// unreachable / a web page) compared as parsed rules; a redirect is judged by where it lands (Watch Hop Plan read the target): a permanent
// move to a working page of the site is Info and, seen on two reads, a confirmed move (`moved_to`: the watch reads the new address from the
// next run and our stored rows follow it); a canonical that now names the page itself is a fix; a title we just published is Info.
/*__PAGE_WATCH__*/
/*__MOVES__*/
const reads = (() => { try { return $('Watch Read').all().map(i => i.json); } catch (e) { return $input.all().map(i => i.json); } })().filter(r => r && r.site_id);
const S = (v) => String(v == null ? '' : v).trim();
const ukey = PW.helpers.ukey;
// the targets Watch Hop Plan read (only when it ran in this execution: its rows must name a page that redirects today)
const hops = new Map();
try {
  const hp = $('Watch Hop Plan').all().map(i => i.json).filter(h => h && !h.skip && S(h.for_url));
  let hr = []; try { hr = $('Fetch Watch Hop').all().map(i => i.json); } catch (e) { hr = []; }
  hp.forEach((h, i) => { hops.set(h.site_idx + '|' + h.kind + '|' + ukey(h.for_url), { plan: h, res: hr[i] || { error: { message: 'the target was not read' } } }); });
} catch (e) { /* no redirect today: nothing was read */ }
const hopOf = (r, kind) => {
  const h = hops.get(r.site_idx + '|' + kind + '|' + ukey(r.url));
  if (!h) return null;
  return (kind === 'robots' || ukey(h.plan.url) === ukey(PW.helpers.absUrl(r.location, r.url))) ? h : null;
};
const bySite = new Map();
for (const r of reads) { if (!bySite.has(r.site_idx)) bySite.set(r.site_idx, []); bySite.get(r.site_idx).push(r); }
const nowIso = new Date().toISOString();
const out = [];
for (const [site_idx, items] of bySite) {
  const site = (items.find(i => i.site) || {}).site || {};
  const robotsItem = items.find(i => i.kind === 'robots') || null;
  let robots = (robotsItem && robotsItem.robots) || { ok: false, status: 0, hash: '', error: 'robots.txt was not read' };
  let robotsLive = null;   // the parsed file with its `blocks` rule, when robots.txt was read at the end of a redirect chain here
  if (robotsItem && S(robots.state) === 'unresolved') {
    const h = hopOf(robotsItem, 'robots');
    if (h) { robotsLive = PW.robotsRead(h.res); const { blocks, ...plain } = robotsLive; robots = plain; }
  }
  const expected = (site.expected_moves || []);
  const own = new Set(site.own_titles || []);
  const pages = items.filter(i => i.kind !== 'robots');
  const checked = pages.filter(p => p.ok !== false);
  const notChecked = pages.filter(p => p.ok === false);
  const changes = [];
  const newly_blocked = [];
  // CR17-FX-INDEX (review R1 L2): today's own reads (no redirect followed) and the site's confirmed moves: a move is confirmed where the redirects end
  const readsByKey = new Map(pages.filter(p => p.ok !== false).map(p => [ukey(p.url), p]));
  const knownMoves = MV.fromWatch((site.moves_known || []).map(m => ({ url: S(m.from), moved_to: S(m.to) })));
  const pageStates = pages.map(p => {
    const prev = p.prev || null;
    const st = Number(p.status) || 0;
    // robots.txt read only after its redirect: decide here whether it blocks this page
    const blockedNow = (p.robots_blocked === null || p.robots_blocked === undefined) && robotsLive && robotsLive.ok ? robotsLive.blocks(p.url) : p.robots_blocked;
    if (blockedNow === true && prev && S(prev.checked_at) && prev.robots_blocked !== true) newly_blocked.push(p.url);
    let verdict = null, moved_to = '', redirect_to = '';
    if (p.ok !== false && st >= 300 && st < 400) {
      redirect_to = PW.helpers.absUrl(p.location, p.url);
      const h = hopOf(p, 'page');
      const hop = h ? PW.signals(h.res) : null;
      const exp = expected.some(e => ukey(e.from) === ukey(p.url) && ukey(e.to) === ukey(redirect_to));
      verdict = PW.redirectVerdict({ url: p.url, status: st, location: p.location, hop, expected: exp });
      const cf = MV.confirm({ url: p.url, status: st, location: p.location }, prev, verdict.verdict, { reads: readsByKey, moves: knownMoves });
      if (cf.ok) moved_to = cf.to;
    }
    // CR17-FX-INDEX (review R1 L3): a stored move stands while the address still redirects permanently to the same page (a target we could not
    // read today changes nothing); when the redirect is gone or points elsewhere, the move is cleared (the address is watched again from the next
    // run) and said once. Our ladder / content log / AI rows stay where they are: undoing a move is a person's decision.
    const storedMove = S((prev || {}).moved_to);
    let undone = false;
    if (p.ok !== false && storedMove && !moved_to) {
      if (MV.PERMANENT.includes(st) && (ukey(redirect_to) === ukey(storedMove) || ukey(MV.finalOf(redirect_to, knownMoves) || '') === ukey(storedMove))) moved_to = storedMove;
      else undone = true;
    }
    const ch = p.move_check ? [] : PW.compare(prev, { ...p, robots_blocked: blockedNow }, { url: p.url, robots_blocked: blockedNow, robots_blocked_before: prev ? prev.robots_blocked === true : false,
      redirect: verdict, own_title: own.has(ukey(p.url)) });
    if (undone) ch.push(PW.moveUndone(p.url, storedMove, st, redirect_to));
    for (const c of ch) changes.push({ ...c, url: p.url, kind: p.kind });
    const first = !prev || !S(prev.checked_at);
    return { url: p.url, kind: p.kind, weight: p.weight, ok: p.ok !== false, status: p.status, location: S(p.location), noindex: !!p.noindex, noindex_source: S(p.noindex_source),
      canonical: S(p.canonical), canonical_ok: p.ok === false ? null : (!S(p.canonical) ? null : PW.helpers.same(p.canonical, p.url)),
      title: S(p.title), titles: p.titles || 0, description: S(p.description), h1: S(p.h1), h1s: p.h1s || 0, robots_blocked: blockedNow,
      error: S(p.error), first_seen: first, state: PW.state(ch, p), changes: ch,
      verdict: verdict ? verdict.verdict : '', redirect_to, moved_to, redirect_text: verdict ? verdict.text : '', move_check: !!p.move_check, move_undone: undone,
      // the Google view of this page as it was stored (written by the weekly URL Inspection, G25): carried, never re-claimed here
      inspect: prev ? { inspect_at: S(prev.inspect_at), index_state: S(prev.index_state), indexed: S(prev.indexed), coverage: S(prev.coverage),
        google_canonical: S(prev.google_canonical), last_crawl: S(prev.last_crawl), mobile: S(prev.mobile), rich_results: S(prev.rich_results), inspect_error: S(prev.inspect_error) } : null,
      prev: prev ? { checked_at: S(prev.checked_at), status: Number(prev.status) || 0, noindex: prev.noindex === true, canonical: S(prev.canonical), title: S(prev.title),
        state: S(prev.state), last_change_at: S(prev.last_change_at), changed_count: Number(prev.changed_count) || 0, robots_hash: S(prev.robots_hash),
        // CR17-FX-INDEX: what Watch Rows carries when today cannot judge it (M1 redirect verdict, M2 robots.txt block)
        redirect_verdict: S(prev.redirect_verdict), robots_blocked: prev.robots_blocked === true } : null };
  });
  // robots.txt as a state of its own, compared with the last reading (and the key pages it newly blocks)
  const robotsChange = PW.robotsChange(site.robots_prev || site.robots_hash_prev, robots, { newly_blocked });
  if (robotsChange) changes.push({ ...robotsChange, url: robotsItem ? robotsItem.url : '', kind: 'robots' });
  // the re-checks this site asked for, answered on the pages that were just read
  const rechecks = (site.rechecks || []).map(f => { const r = PW.recheck(f, pageStates.filter(p => p.ok).map(p => ({ ...p, url: p.url }))); return { ...f, ...r, checked_at: nowIso }; });
  const real = changes.filter(c => c.severity !== 'info');
  const indexable = pageStates.filter(p => p.ok && Number(p.status) >= 200 && Number(p.status) < 300 && !p.noindex && p.robots_blocked !== true).length;
  const movesToday = pageStates.filter(p => S(p.moved_to) && ukey(p.moved_to) !== ukey(p.url) && !p.move_check).map(p => ({ from: p.url, to: p.moved_to }));
  const hopsHere = [...hops.values()].filter(h => h.plan.site_idx === site_idx).length;
  out.push({ json: {
    site_idx, site_id: site.site_id || items[0].site_id, domain: site.domain || items[0].domain, checked_at: nowIso, on_demand: !!site.on_demand,
    email: S(site.email), callback_url: S(site.callback_url), last_checked_at: S(site.last_checked_at),
    pages: pageStates, changes, alerts: changes, rechecks,
    robots: { ok: robots.ok !== false, state: S(robots.state) || (robots.ok === false ? 'not_read' : 'ok'), status: robots.status || 0, hash: S(robots.hash), prev_hash: S(site.robots_hash_prev),
      length: robots.length || 0, error: S(robots.error), changed: !!robotsChange, text: S(robots.text), facts: robots.facts || [], v: robots.v || 0,
      blocks_key_pages: pageStates.filter(p => p.robots_blocked === true).map(p => p.url) },
    robots_prev: site.robots_prev || null,
    // the alert lifecycle's inputs (Watch Alerts): the site's open alerts and the addresses the watch stopped reading because they moved
    open_alerts: site.open_alerts || [], moved: site.moved || [], moves_today: movesToday,
    summary: { pages_watched: pages.length, pages_checked: checked.length, pages_not_checked: notChecked.length, pages_known: Number(site.pages_known) || 0,
      indexable, changed: real.length, critical: changes.filter(c => c.severity === 'critical').length, high: changes.filter(c => c.severity === 'high').length,
      first_run: pageStates.every(p => p.first_seen), worst: PW.worst(changes), rechecks: rechecks.length, cap: Number(site.max_watch_pages) || PW.helpers.n0(site.pages_watched),
      moved: movesToday.length, cost_usd: 0, requests: items.length + hopsHere },
    not_checked: notChecked.map(p => ({ url: p.url, error: S(p.error) })),
    stage: 'page_watch',
  } });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing was read in this watch' } }];
