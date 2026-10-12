// ---- impact-weighted priority (G26, 2026-10-12, system review FIX_PLAN.md; CRITERIA_technical… 1.6) ----
// The audit used to order its fix list by severity label alone, so "Missing favicon" could sit above a noindex on the pages that earn the
// traffic, and a Critical on one unvisited page above a High on every page the site is found by. The leaders weight each finding by the
// traffic it puts at risk (Screaming Frog / Lumar / Sitebulb all join Search Console clicks to the issue). Priority here =
// severity x the share of pages affected x the clicks and impressions those pages actually get (Search Console, 28 days) x where they sit in
// the site, in bands: pages Google cannot index come first, cosmetic items can never be at the top, and notes about missing data stay last.
// The severity label is never replaced - it is shown next to the impact everywhere.
const IMP = (() => {
  const SEV_W = { Critical: 10, High: 6, Medium: 3, Low: 1.2, Info: 0.4 };
  const SEV_ORD = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
  // what stops Google indexing a page or sends it somewhere else: these come first whatever else is in the list
  const BLOCKER = /noindex|not indexable|non-indexable|blocked by robots|robots\.txt (blocks|disallow)|disallowed|broken pages|returning 4xx|server errors|canonical (points|to broken|to a redirect|chain)|recursive canonical|soft 404|redirect (loop|chain)|not indexed|index coverage|crawler access|meta refresh|www and non-www|duplicate host|HTTP does not redirect|sitemap is (missing|not)|no sitemap/i;
  // items that change nothing a visitor or a crawler acts on: they are worth fixing, never first
  const COSMETIC = /favicon|doctype|charset|deprecated html|readab|text-to-html|alt text|open graph|social (image|card)/i;
  const S = (v) => String(v == null ? '' : v);
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';
  const fmt = (v) => n0(v).toLocaleString('en-GB');

  // clicks + impressions per page from the audit's own Search Console block (28 days)
  const trafficIndex = (sc) => {
    const by = new Map();
    for (const r of ((sc || {}).top_pages || [])) {
      const p = pathOf(r.page || r.url);
      if (!p) continue;
      const cur = by.get(p) || { clicks: 0, impressions: 0 };
      by.set(p, { clicks: cur.clicks + n0(r.clicks), impressions: cur.impressions + n0(r.impressions) });
    }
    return by;
  };

  const rank = (findings, ctx) => {
    const list = Array.isArray(findings) ? findings : [];
    const total = Math.max(1, n0(ctx && ctx.total_pages) || 1);
    const sc = (ctx && ctx.search_console && ctx.search_console.connected) ? ctx.search_console : null;
    const totals = sc && sc.totals ? sc.totals : null;
    const by = trafficIndex(sc);
    const knownPages = Math.max(1, n0(sc && sc.pages_with_impressions) || by.size || total);
    const avgClicks = totals ? n0(totals.clicks) / knownPages : 0;
    const avgImpr = totals ? n0(totals.impressions) / knownPages : 0;
    const keyPaths = new Set([...((ctx && ctx.key_pages) || []).map(pathOf), '/']);

    for (const f of list) {
      const sev = SEV_W[f.severity] != null ? SEV_W[f.severity] : 1;
      const siteWide = f.scope === 'site';
      const affected = siteWide ? total : Math.max(1, Math.min(total, n0(f.affected_count) || Math.round(total * (n0(f.affected_pct) || 0) / 100) || 1));
      const reach = Math.min(1, affected / total);
      // the traffic those pages get: measured where Search Console names them, the site's average per page otherwise
      let clicks = 0, impressions = 0, measured = 0;
      if (sc) {
        if (siteWide && totals) { clicks = n0(totals.clicks); impressions = n0(totals.impressions); measured = knownPages; }
        else {
          for (const u of (f.sample_urls || [])) {
            const hit = by.get(pathOf(S(u).split(' — ')[0]));
            if (hit) { clicks += hit.clicks; impressions += hit.impressions; measured++; }
          }
          if (measured && affected > measured) { const k = affected / measured; clicks = Math.round(clicks * k); impressions = Math.round(impressions * k); }
          if (!measured) { clicks = Math.round(avgClicks * affected); impressions = Math.round(avgImpr * affected); }
        }
      }
      const traffic = clicks * 10 + impressions;
      const trafficFactor = sc ? 1 + Math.log10(1 + traffic) : 1;
      const onKeyPage = siteWide || (f.sample_urls || []).some(u => keyPaths.has(pathOf(S(u).split(' — ')[0])));
      const placeFactor = onKeyPage ? 1.3 : 1;
      const blocker = BLOCKER.test(S(f.title)) && (f.category === 'Crawlability & Indexing' || f.category === 'Security' || f.category === 'Technical');
      const cosmetic = !blocker && COSMETIC.test(S(f.title)) && (f.severity === 'Low' || f.severity === 'Info');
      const impact = Math.round(sev * (siteWide ? 1 : 0.4 + 0.6 * reach) * trafficFactor * placeFactor * (blocker ? 2.5 : 1) * 10) / 10;
      f.impact = cosmetic ? Math.min(impact, 0.9) : impact;
      f.impact_blocker = blocker;
      f.impact_cosmetic = cosmetic;
      // the blocker band is for blockers that matter: a Low "these pages are not indexable" (usually on purpose) must not outrank a
      // High somewhere else just because it touches indexing
      f.impact_band = f.severity === 'Info' ? 0 : (blocker && sev >= SEV_W.Medium) ? 3 : cosmetic ? 1 : 2;
      f.impact_traffic = sc ? { clicks, impressions, estimated: !measured && !siteWide, period_days: 28 } : null;
      f.impact_basis = [
        blocker ? 'Google cannot index or follow these pages' : '',
        siteWide ? 'the whole website' : affected + ' of ' + total + ' crawled pages',
        sc ? (measured || siteWide ? 'about ' : 'an estimated ') + fmt(clicks) + ' clicks and ' + fmt(impressions) + ' impressions in the last 28 days' : 'no Search Console data, so the pages affected and their place in the site decide the order',
        onKeyPage && !siteWide ? 'the homepage or a key page is affected' : '',
        f.severity + ' severity',
        cosmetic ? 'cosmetic, so it is never ranked first' : ''
      ].filter(Boolean).join(' · ');
    }
    list.sort((a, b) => (b.impact_band - a.impact_band) || (b.impact - a.impact)
      || (SEV_ORD[a.severity] - SEV_ORD[b.severity]) || ((b.affected_pct || 0) - (a.affected_pct || 0)));
    return list;
  };

  const method = 'The fix list is ordered by likely impact: the severity of the finding × the share of pages it affects × the clicks and impressions those pages got in Search Console over the last 28 days (the site average per page where Search Console does not name them) × whether the homepage or a key page is among them. Findings that stop Google indexing or following a page are ranked first whatever else is in the list, cosmetic items are never ranked first, and notes about data that could not be collected stay last. The severity labels are unchanged and are shown next to each finding.';

  // one sentence for the report: why the first item is first
  const firstReason = (findings) => {
    const list = (findings || []).filter(f => f.impact != null);
    if (!list.length) return '';
    const f = list[0], next = list[1];
    return '"' + S(f.title) + '" is first because ' + S(f.impact_basis).replace(/ · /g, ', ')
      + (next ? ' — impact score ' + f.impact + ' against ' + next.impact + ' for "' + S(next.title) + '"' : '') + '.';
  };

  return { rank, method, firstReason, SEV_W, BLOCKER, COSMETIC };
})();
