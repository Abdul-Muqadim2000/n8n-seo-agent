/*__REGULATORS__*/
/*__REGULATORY__*/
// W0-F (2026-10-29, PLAN Fix 6): the pages to read when SearXNG was down and DataForSEO searched instead (*Regulatory SERP*, behind its
// in-200 gate: this node reads the merged answers, one per topic in the order *Regulatory Candidates* asked them). Same choice as the free
// path (REG.pick): the official text on file, the official pages found, two or three independent secondary sources, the client's own posts.
const __main = () => {
  const asked = $('Regulatory Candidates').all().map(i => i.json || {}).filter(x => x.dfs_fallback);
  const answers = $input.all().map(i => i.json || {});
  const plan = (asked[0] || {}).regulatory_plan || {};
  const market = REG.marketOf(REGULATORS, plan.market);
  const results = asked.map((q, i) => { const a = answers[i] || {}; const items = ((((a.tasks || [])[0] || {}).result || [])[0] || {}).items || [];
    return items.filter(it => it && it.type === 'organic').map(it => ({ url: it.url, title: it.title, content: it.description })); });
  const picked = REG.pick(plan, asked.map(q => ({ topic: q.topic, kind: 'deadline' })), results, REGULATORS, market);
  const searched = { searches: asked.length, answered: results.filter(r => r.length).length, results: results.reduce((n, r) => n + r.length, 0), engine: 'dataforseo' };
  if (!picked.reads.length) return [{ json: { skip: true, reason: 'the free search was down and the paid search found no official or independent page to read', regulatory_plan: plan, hints: [], searched } }];
  return picked.reads.map(r => ({ json: { ...r, regulatory_plan: plan, hints: picked.hints, searched } }));
};
try { return __main(); } catch (e) {
  return [{ json: { skip: true, reason: 'choosing the pages to read failed and the page goes on without them: ' + String((e && e.message) || e).slice(0, 200), regulatory_plan: (() => { try { return ($('Regulatory Plan').first().json || {}).regulatory_plan || null; } catch (e2) { return null; } })() } }];
}
