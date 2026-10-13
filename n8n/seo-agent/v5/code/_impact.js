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
  // ---- G18-2 (2026-10-12, measured by the accuracy set): the minor band, folded into one line ----
  // Precision over the labelled set is 100%, but 10 of the 40 findings shown were true and still not worth a customer's time
  // ("useful precision 75%", ACCURACY_SET.md section 6). Three rules produce most of them: "Too many links on one page" fires on every
  // nav-heavy page (173 links on a homepage), "Title longer than 60 characters" fires one character over, and "Light content" fires on
  // section index pages whose job is to link onwards; "Long or messy URLs" asks for a rename that would cost a published page its rankings.
  // Such a finding is MINOR: still measured, still stored, still in the report — but folded into one "Minor items (N)" line instead of a
  // card of its own, so the list a customer reads is the list they can act on. Only Low / Info severities can fold, never an index blocker,
  // and anything whose impact is above MINOR_MAX stays in the main list even when its rule is on the list (a light content page that earns
  // real traffic is not minor). Nothing is ever dropped: fold() returns both halves and the count.
  const MINOR_RULES = /too many links on one page|title longer than \d+ characters|light content|long or messy urls/i;
  const MINOR_MAX = 0.9;        // the same ceiling the cosmetic cap uses, so a cosmetic finding is always minor
  const MINOR_RULE_MAX = 3;     // a rule on the list above stays in the main list where it sits on pages that earn real traffic
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

  // G18-2: is this finding minor (foldable)? Derived from the severity and the impact weight alone, so the app can apply the same rule to a
  // stored seo_audit_findings row without a new column.
  const isMinor = (f) => {
    if (!f || f.impact_blocker === true) return false;
    const sev = S(f.severity);
    if (sev !== 'Low' && sev !== 'Info') return false;
    const imp = f.impact == null ? null : n0(f.impact);
    if (f.impact_cosmetic === true) return true;
    if (MINOR_RULES.test(S(f.title))) return imp == null || imp <= MINOR_RULE_MAX;   // one of the measured low-value rules, unless it sits on pages with real traffic
    return imp != null && imp <= MINOR_MAX;
  };
  // the two halves of a finding list plus the count, for a report or a page that folds the minor ones into one line
  const fold = (findings) => { const list = Array.isArray(findings) ? findings : [];
    const minor = list.filter(f => (f.minor == null ? isMinor(f) : f.minor === true));
    const main = list.filter(f => !minor.includes(f));
    return { main, minor, folded: minor.length }; };

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
      // R10 (2026-10-13, re-rating §3.11): the site average per page multiplied by the pages affected claimed "about 720 clicks and
      // 22,860 impressions in the last 28 days" for a property that measured 38 clicks and 5,295 in that period (the mobile-usability
      // finding, 45 of 47 pages). No finding can put more traffic at risk than the whole property has, so every basis — measured,
      // scaled or averaged — is capped at Search Console's own 28-day totals, and the line says when the cap bit.
      let capped = false;
      if (totals) {
        const totC = n0(totals.clicks), totI = n0(totals.impressions);
        if (clicks > totC) { clicks = totC; capped = true; }
        if (impressions > totI) { impressions = totI; capped = true; }
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
      f.impact_traffic = sc ? { clicks, impressions, estimated: !measured && !siteWide, capped, period_days: 28,
        property_totals: totals ? { clicks: n0(totals.clicks), impressions: n0(totals.impressions) } : null } : null;
      f.minor = isMinor(f);   // G18-2: folded in the reports and in the app, never removed
      f.impact_basis = [
        blocker ? 'Google cannot index or follow these pages' : '',
        siteWide ? 'the whole website' : affected + ' of ' + total + ' crawled pages',
        sc ? (measured || siteWide ? 'about ' : 'an estimated ') + fmt(clicks) + ' clicks and ' + fmt(impressions) + ' impressions in the last 28 days'
          + (capped ? ' (capped at everything the whole website measured in that period: the pages affected cannot put more at risk)' : '') : 'no Search Console data, so the pages affected and their place in the site decide the order',
        onKeyPage && !siteWide ? 'the homepage or a key page is affected' : '',
        f.severity + ' severity',
        cosmetic ? 'cosmetic, so it is never ranked first' : ''
      ].filter(Boolean).join(' · ');
    }
    list.sort((a, b) => (b.impact_band - a.impact_band) || (b.impact - a.impact)
      || (SEV_ORD[a.severity] - SEV_ORD[b.severity]) || ((b.affected_pct || 0) - (a.affected_pct || 0)));
    return list;
  };

  const method = 'The fix list is ordered by likely impact: the severity of the finding × the share of pages it affects × the clicks and impressions those pages got in Search Console over the last 28 days (the site average per page where Search Console does not name them) × whether the homepage or a key page is among them. Findings that stop Google indexing or following a page are ranked first whatever else is in the list, cosmetic items are never ranked first, and notes about data that could not be collected stay last. The severity labels are unchanged and are shown next to each finding. Low and Info findings of the lowest impact — a title one character too long, the link count of a page whose job is navigation, a cosmetic tag — are folded into one "Minor items" line instead of a section each; they are still measured, still counted in the score and still listed there.';
  const foldNote = (n) => n ? n + ' minor ' + (n === 1 ? 'item is' : 'items are') + ' folded into one line below (true, but the lowest impact: cosmetic tags, a title a character too long, the link count of a navigation page). Nothing is left out of the score or of the stored findings.' : '';

  // one sentence for the report: why the first item is first
  const firstReason = (findings) => {
    const list = (findings || []).filter(f => f.impact != null);
    if (!list.length) return '';
    const f = list[0], next = list[1];
    return '"' + S(f.title) + '" is first because ' + S(f.impact_basis).replace(/ · /g, ', ')
      + (next ? ' — impact score ' + f.impact + ' against ' + next.impact + ' for "' + S(next.title) + '"' : '') + '.';
  };

  return { rank, method, firstReason, isMinor, fold, foldNote, MINOR_RULES, MINOR_MAX, MINOR_RULE_MAX, SEV_W, BLOCKER, COSMETIC };
})();
