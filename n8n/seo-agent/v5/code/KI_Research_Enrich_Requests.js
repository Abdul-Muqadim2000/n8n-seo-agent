// Research Enrich Requests (E2, DESIGN.md §3.3, R5 §4): volume / CPC / KD for the candidates no list priced (Labs keyword_overview, up to 700 in
// one task) and the searcher's intent with its probability (Labs search_intent, keywords only: location and language are dropped silently,
// R5 §13 C8). Only the top N after the gate are asked; a value stored in the last 30 days is not asked again.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const c = $('Research Candidates').first().json || {};
const m = { location_code: p.location_code, language_code: p.language_code };
const reqs = [];
if ((c.need_overview || []).length) reqs.push(KIW.rq.overview(c.need_overview, m));
if ((c.need_intent || []).length) reqs.push(KIW.rq.intent(c.need_intent));
return reqs.length ? reqs.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every candidate already has its volume and intent (stored in the last 30 days)' } }];
