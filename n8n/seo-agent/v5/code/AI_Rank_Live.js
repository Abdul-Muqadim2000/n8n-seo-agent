// AIR kill switch (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §5, package P4): the seo_cache row `air:kill` (value 1 / true / on / yes)
// stops AIR for every website without a deploy. Read here, after the gate's IF, so a run whose sites are all off never reads it. Killed:
// [{ skip: true, killed: true }] and nothing of AIR runs further (no table is ensured, nothing is loaded or written). Otherwise the gate's items.
/*__AI_RANK_FLAGS__*/
const cacheRows = (() => { try { return $('Load AI Rank Cache').all().map(i => i.json || {}); } catch (e) { return []; } })();
const sites = (() => { try { return $('AI Rank Gate').all().map(i => i.json || {}).filter(x => x.site_id && !x.skip && !x.error); } catch (e) { return []; } })();
if (AIRF.killed(cacheRows)) return [{ json: { skip: true, killed: true, reason: 'the AI-ranking kill switch (seo_cache ' + AIRF.KILL_KEY + ') is on: AIR is stopped for every website' } }];
return sites.length ? sites.map(s => ({ json: s })) : [{ json: { skip: true, reason: 'no website to run' } }];
