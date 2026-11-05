// ---- ARD: the AI-ranking diagnosis kit (inlined by build_monitors.py through its marker, after AIRF) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.A-§2.C, interface frozen in CONTRACTS.md §3.2). OWNER: package P1.
// W0 SKELETON: every function has its final signature and returns the documented EMPTY shape, with `unavailable: true` on every object result,
// so a caller built against it (package P4's AI Rank Plan) runs end to end and writes nothing it could not compute. P1 replaces the bodies,
// keeps the signatures and the shapes, and drops `unavailable` (or sets it false) where a real result is returned.
// Pure: no $(...), no network, no clock (time comes in as `now`, ms or ISO). n8n sandbox: no URL constructor, no Object.defineProperty /
// setPrototypeOf, no structuredClone. Needs AIRF (_ai_rank_flags.js) in scope; may use AVX (_ai_measure.js), FITR (_fit_gate.js, read
// only) and SM (_site_model.js) when the calling node inlines them. Engines in AIRF.EXCLUDED_ENGINES (gemini_api) are ignored everywhere.
const ARD = (() => {
  const VERSION = 'air-1';
  const WHY = 'not computed: the diagnosis kit is a W0 skeleton';
  const S = (v) => (v == null ? '' : String(v)).trim();
  // A1: the site's market. -> { cc, lang, location_code, second: { cc, share } | null, conflicts: [{ source, value }], basis }
  const market = ({ site, ladders, tracked, monitors, profile, gscCountries } = {}) =>
    ({ cc: '', lang: '', location_code: 0, second: null, conflicts: [], basis: WHY, unavailable: true });
  // A2: 'recommendation' | 'informational' | 'brand' | 'unknown'
  const intentOf = (prompt, answers28) => 'unknown';
  // A3 / A4: the frozen core set, questions to propose, core windows to extend
  const corePanel = ({ site, prompts, units60, stored, market, demand, now, cfg } = {}) =>
    ({ core: [], proposed: [], extend: [], comparable: false, why: WHY, unavailable: true });
  // A6: treatment / control arms (2:1 inside each stratum, seeded, never reshuffled) -> [{ prompt_id, arm, stratum, assigned_at }]
  const assignArms = ({ core, stored, seed, now } = {}) => [];
  // A7: minimum detectable effect and the first-appearance requirement
  const mde = ({ q_t, q_c, m, p, rho, alpha = 0.05, power = 0.8 } = {}) =>
    ({ prepost: null, did: null, n_eff_t: 0, n_eff_c: 0, p_used: null, first_appearance_k: null, basis: WHY, unavailable: true });
  // 2.B: the searches the engines ran for a question -> [{ query, n, engines: [] }]
  const fanoutOf = ({ prompt_id, answers8, evidence } = {}) => [];
  // 2.B: the stage per question x engine (+ W0 addition: the first / last dates the client was named or cited, ISO or '', for seo_ai_rank_questions)
  const diagnose = ({ site, prompt, answers8, units60, evidence, access, pages, index, serp, bingStats, brave, brandKnown, ourHosts, rivals, engines, now, cfg } = {}) =>
    ({ prompt_id: S((prompt || {}).prompt_id), intent: 'unknown', engines: {}, best_stage: 'unmeasured', parametric_share: {}, no_search: [], list_dominated: false, nobody_named: false,
      first_named_at: '', last_named_at: '', last_cited_at: '', unavailable: true });
  // 2.C: one page -> { page_type, author_kind, why }  (page_type 'unknown' and author_kind 'unknown' when it cannot be classified)
  const classifyPage = ({ url, title, host, rivals, ourHosts } = {}) => ({ page_type: 'unknown', author_kind: 'unknown', why: WHY });
  // 2.C: the source graph -> [{ url, url_key, host, page_type, author_kind, names_client, rivals_named, questions, engines, cites_28d, influence,
  //      placeability, placeability_why, contact_email, contact_url, from, last_seen }]
  const sources = ({ answers8, storedSources, mentionsPages, fetched, prompts, values, rivals, ourHosts, now } = {}) => [];
  // 2.B: evidence kept across weeks (seo_ai_rank_questions.evidence_json, at most 8 KB, entries older than 120 days dropped). The skeleton
  // returns what was stored, unchanged ('' when nothing was), so a stored history is never lost by a run of the skeleton.
  const rollEvidence = ({ stored, answers8, now } = {}) => (typeof stored === 'string' ? stored : '');
  return { VERSION, market, intentOf, corePanel, assignArms, mde, fanoutOf, diagnose, classifyPage, sources, rollEvidence };
})();
