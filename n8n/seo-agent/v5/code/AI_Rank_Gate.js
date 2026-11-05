// AIR gate (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §4 / §5, package P4): which of this run's websites the AI-ranking algorithm runs
// for. One item per site whose `ai_rank_mode` is shadow or on (AIRF.runs), or [{ skip: true }] when none is, which is every site until the owner
// switches one through Site Admin `monitors`. With every site off this node and its IF are the only AIR nodes that run (harness AIRG2), and it
// changes nothing upstream: it reads the plan this run made (Growth Plan) and the stored seo_monitors rows, and writes nothing.
// The mode is read with the one rule every node uses (AIRF.settingsOf, the same call _monitor_sites.js makes for `s.settings.rank`); the gate
// reads the monitor row directly instead of inlining the whole site list, so a run whose sites are all off pays for one small node only.
// The global kill switch (seo_cache `air:kill`) is read right after the IF (AI Rank Live), so an off run never reads it (CONTRACTS.md D17).
/*__AI_RANK_FLAGS__*/
const nowMs = Date.now();
const all = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const plans = all('Growth Plan').filter(p => p.site_id && !p.nothing_to_do);
const mons = all('Load Monitors').filter(m => m && m.site_id);
const out = [];
for (const p of plans) {   // only the websites AI Growth worked on in this run, once each
  if (out.some(o => o.json.site_id === p.site_id)) continue;
  const rank = AIRF.settingsOf(mons.find(m => m.site_id === p.site_id) || {});
  if (!AIRF.runs(rank, false)) continue;
  out.push({ json: { site_id: p.site_id, domain: p.domain || '', mode: rank.mode, rank, run_id: AIRF.runId(p.site_id, nowMs) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website of this run has the AI-ranking mode shadow or on' } }];
