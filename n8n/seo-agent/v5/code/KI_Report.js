// KI Report (E2, CONTRACTS.md §4, app/shared/src/ki.ts KiCompetitorsCallback / KiResearchCallback): the final callback. Every base key, the
// sections (a section that could not be read says so - never "no demand" / "no competitors"), the counts, the basis legend, the estimate the
// run was held to, and the mode's lists (competitors: the top 20 as stored, the listings, the platforms; research: the top 50 cluster heads,
// striking distance, buyer questions, gap counts, the plan). The ledger figure (`run_ledger`) is added by *Callback Ledger (KI)* after the settle.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let r = {}; try { r = $(p.kind === 'keyword_research' ? 'Research Result' : 'Comp Result').first().json || {}; } catch (e) { r = {}; }
let run = {}; try { run = $('KI Run Row').first().json || {}; } catch (e) { run = {}; }
const status = KIW.S(r.status) || 'failed';
const body = { ...KIW.baseBody(p, status, KIW.S(r.reason) || (status === 'failed' ? 'the run could not finish its analysis' : '')),
  sections: r.sections || [], summary: r.summary || {}, notes: r.notes || [],
  run_cost_estimate_usd: KIW.r4(KIW.N(p.est_dfs_usd) || 0), run_cost_estimate_state: 'modelled', run_cost_estimate_basis: KIW.S(p.est_basis),
  cost_measured_usd: KIW.N(run.cost_dfs_usd), cost_measured_basis: 'measured: the cost every search-data task reported, each once by its own id across both attempts (cache hits cost 0)',
  ...KIW.emptyLists(p.kind), ...(r.lists || {}) };
return [{ json: { callback_url: p.callback_url || '', callback_body: body, status } }];
