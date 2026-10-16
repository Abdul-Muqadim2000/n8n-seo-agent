/*__KW_INPUTS__*/
/*__RADIUS__*/
// B2-4 (2026-10-15, benchmark area 2, docs/system-review-2026-10-14/BENCH_AREA2_ladders.md gap 5, criterion K7): one results page per
// rung candidate, so the rungs can be grouped by what Google ACTUALLY answers each search with instead of by the AI's topic label.
//   Until today `Ladder_Pool` initialised `competitors: []` and never filled it (the ladder's four Labs pulls return `serp_info.
// serp_item_types` and no URL list), so `KWI.serpClusters` - which exists, and which discovery uses - had nothing to work on, and two
// searches Google answers with the same pages could become two pages. That is the duplication the "one search, one page" rule exists
// to prevent. The owner chose the DIRECT route (one SERP call per keyword, exact) over the competitor-domain approximation.
//   The bound, and why it is where it is: a full ladder plans at most 11 pages (rung limits 4 / 4 / 3) and a page carries at most 7
// keywords, so KWI.CFG.ladder_serp_checks (24) covers more than twice the pages a plan can hold, at 24 x $0.002 = $0.048 a ladder.
// Everything below the cap is the pool's own opportunity order, after the same two filters the rungs are chosen by (the fit gate, which
// `Ladder Pool` already applied, and RAD.headFit, which `Ladder Plan` applies) - so no call is ever bought for a keyword the plan would
// have thrown away. R54 (2026-10-16): exec 610 still bought "transfer pricing consulting", "supply chain consulting uk" and "supply
// chain consulting meaning" for the "ai consulting dubai" ladder, because RAD.headFit could not see "ai" (R39) and passed them on
// "consult" alone; the relevance screen rated all three 0 a step later. RAD.tokens now counts "ai" and RAD.headFit asks for the
// head's subject word, so the same test refuses them HERE, before the call. A `free_only` run, an explicit `ladder_serp_checks: 0` and a pool with fewer than two comparable keywords make no
// call at all, and the plan says which of those it was.
const d = $input.first().json;
const head = String(d.keyword || '').toLowerCase().trim();
const cands = ((d.research || {}).candidates || []).filter(k => k && k.keyword);
const cap = KWI.ladderChecks(d.ladder_serp_checks);
const freeOnly = d.free_only === true;
// the head term keeps the results page the run already bought (competitors_summary), so it is never re-bought here
const onTopic = cands.filter(k => String(k.keyword).toLowerCase() !== head).filter(k => { try { return RAD.headFit(head, k.keyword).ok; } catch (e) { return true; } });
const wanted = onTopic.slice(0, cap);
const plan = { asked: wanted.length, candidates: cands.length, on_topic: onTopic.length, cap, cap_basis: KWI.CFG.ladder_serp_checks === cap
    ? 'the standing cap of ' + KWI.CFG.ladder_serp_checks + ' keywords a ladder may buy a results page for' : 'the cap set for this run (' + cap + ')',
  cost_usd: KWI.checkCost(wanted.length), price_usd: KWI.CFG.serp_check_usd, top_n: 7, min_overlap: 0.4,
  left_uncompared: Math.max(0, onTopic.length - wanted.length) };
const skip = freeOnly ? 'this run was asked for free sources only, so no results page was bought and the rungs are grouped by topic instead'
  : cap <= 0 ? 'results-page comparison is switched off for this run (ladder_serp_checks 0), so the rungs are grouped by topic instead'
    : wanted.length < 2 ? 'only ' + wanted.length + ' rung candidate(s) are on this ladder\'s topic, and a comparison needs at least two, so nothing was bought'
      : '';
if (skip) return [{ json: { cluster_check: false, skip_reason: skip, ...plan, asked: 0, cost_usd: 0 } }];
return wanted.map((k, i) => ({ json: { cluster_check: true, keyword: k.keyword, location_code: d.location_code, language_code: d.language_code || 'en',
  n: i + 1, of: wanted.length, weight: k.pre_score ?? k.opportunity ?? 0, volume: k.volume ?? null, ...plan } }));
