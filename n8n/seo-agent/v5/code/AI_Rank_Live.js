// AIR kill switch (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §5, package P4): the seo_cache row `air:kill` (value 1 / true / on / yes)
// stops AIR for every website without a deploy. Read here, after the gate's IF, so a run whose sites are all off never reads it. Killed:
// [{ skip: true, killed: true }] and nothing of AIR runs further (no table is ensured, nothing is loaded or written). Otherwise the gate's items.
/*__AI_RANK_FLAGS__*/
// FX-B RB-4 (2026-11-06, REVIEW_B_SAFETY.md): the switch FAILS CLOSED. A load that errored (the Data Table node hands on [{ error }]) or did not run
// at all means the switch could not be read, and the day a switch is needed is exactly the day reads fail: AIR then stops for every website (no
// paid or keyed call, no sink write; the existing AI Growth report is unaffected). An empty table answers [{}] (alwaysOutputData): readable, not
// killed. The kill row is also read by its KEY (`Load AI Rank Kill`), so a row inserted by hand with another `kind` still stops AIR (RB-11 loads
// the kind = air markers separately).
const readLoad = (name) => { try { const a = $(name).all().map(i => i.json || {}); return { ok: a.length > 0 && !a.some(r => r && r.error), rows: a.filter(r => r && !r.error) }; } catch (e) { return { ok: false, rows: [] }; } };
const cacheLoad = readLoad('Load AI Rank Cache'), killLoad = readLoad('Load AI Rank Kill');
const cacheRows = [...cacheLoad.rows, ...killLoad.rows];
const sites = (() => { try { return $('AI Rank Gate').all().map(i => i.json || {}).filter(x => x.site_id && !x.skip && !x.error); } catch (e) { return []; } })();
if (!cacheLoad.ok || !killLoad.ok) return [{ json: { skip: true, killed: true, unreadable: true, reason: 'the AI-ranking kill switch (seo_cache ' + AIRF.KILL_KEY + ') could not be read: AIR is stopped for every website this run (it fails closed)' } }];
if (AIRF.killed(cacheRows)) return [{ json: { skip: true, killed: true, reason: 'the AI-ranking kill switch (seo_cache ' + AIRF.KILL_KEY + ') is on: AIR is stopped for every website' } }];
return sites.length ? sites.map(s => ({ json: s })) : [{ json: { skip: true, reason: 'no website to run' } }];
