/*__REGULATORS__*/
/*__REGULATORY__*/
// W0-F (2026-10-29, PLAN Fix 6): the pages worth reading for each regulated topic, from the SearXNG answers (*Search Regulatory Pages*, one
// answer per search of *Regulatory Plan*, in the same order). The official text on file first, then the official pages the searches found
// (the newest dated upload first, so an amending decision is read beside the decision it amends), then independent secondary sources on
// different sites (the second tier needs two that agree), then the client's own posts on the topic (for consistency only). When SearXNG
// answered nothing at all (down, not merely empty), one DataForSEO search per topic is asked instead ($0.002 each, through the in-200 gate).
const __main = () => {
  const tasks = $('Regulatory Plan').all().map(i => i.json || {}).filter(t => !t.skip);
  const answers = $input.all().map(i => i.json || {});
  const plan = (tasks[0] || {}).regulatory_plan || {};
  const market = REG.marketOf(REGULATORS, plan.market);
  const down = tasks.length > 0 && answers.every(a => !Array.isArray(a.results));
  if (down) {
    const seen = new Set(), out = [];
    for (const t of tasks) { if (seen.has(t.topic) || t.kind !== 'deadline') continue; seen.add(t.topic);
      out.push({ dfs_fallback: true, topic: t.topic, kind: 'deadline', keyword: t.query, location_code: t.location_code, language_code: t.language_code || 'en', regulatory_plan: plan,
        reason: 'the free search answered nothing, so one paid search reads the official sites for ' + t.topic }); }
    if (out.length) return out.map(x => ({ json: x }));
  }
  const picked = REG.pick(plan, tasks, answers.map(a => a.results), REGULATORS, market);
  const searched = { searches: tasks.length, answered: answers.filter(a => Array.isArray(a.results)).length, results: answers.reduce((n, a) => n + (Array.isArray(a.results) ? a.results.length : 0), 0), engine: 'searxng' };
  if (!picked.reads.length) return [{ json: { skip: true, reason: 'the searches found no official or independent page to read', regulatory_plan: plan, hints: picked.hints, searched } }];
  return picked.reads.map(r => ({ json: { ...r, regulatory_plan: plan, hints: picked.hints, searched } }));
};
try { return __main(); } catch (e) {
  return [{ json: { skip: true, reason: 'choosing the pages to read failed and the page goes on without them: ' + String((e && e.message) || e).slice(0, 200), regulatory_plan: (() => { try { return ($('Regulatory Plan').first().json || {}).regulatory_plan || null; } catch (e2) { return null; } })() } }];
}
