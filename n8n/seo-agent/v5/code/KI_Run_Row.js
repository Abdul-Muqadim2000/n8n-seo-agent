// KI Run Row (E2, CONTRACTS.md §2 KI_RUNS): one seo_ki_runs row for the run - its kind, market and mode, the sections that came back, the
// counts, and what it cost: the search-data money each gated call measured (both attempts, each task once by its own id, R28), Claude $0
// (this worker calls no model). The ledger row carries the same figure, settled against the account when it can be (B-A5).
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
let r = {}; try { r = $(p.kind === 'keyword_research' ? 'Research Result' : 'Comp Result').first().json || {}; } catch (e) { r = {}; }
const NODES = p.kind === 'keyword_research' ? ['Run Research Discover Answers', 'Run Research Enrich Answers', 'Run Research SERPs Answers', 'Run Research Traffic Answers']
  : ['Run Comp SERPs Answers', 'Run Comp Labs Answers', 'Run Comp Profiles Answers'];
let dfs = 0; for (const n of NODES) { try { dfs += KIW.measured($(n).all().map(i => i.json)); } catch (e) {} }
const row = KIW.shape('KI_RUNS', { site_id: p.site_id, domain: p.domain, run_id: p.run_id, request_id: p.request_id, kind: p.kind, market: p.market, location_code: p.location_code,
  language_code: p.language_code, mode: p.ki_mode, rule_version: KIW.RULE, started_at: p.started_at, finished_at: new Date().toISOString(), status: KIW.S(r.status) || 'failed', reason: KIW.S(r.reason),
  sections_json: r.sections || [], counts_json: r.summary || {}, cost_dfs_usd: KIW.r6(dfs), cost_claude_usd: 0,
  config_json: { rule_version: KIW.RULE, caps: KIW.CAPS, ttl_days: { serp: KIW.ttlOf('serp'), ranked: KIW.ttlOf('ranked'), volume: KIW.ttlOf('volume'), backlinks: KIW.ttlOf('backlinks'), homepage: KIW.ttlOf('homepage'), discovery: KIW.ttlOf('discovery') },
    quote_usd: p.quote, estimate_usd: p.est_dfs_usd, kit: (typeof KI === 'object' && KI.SHIM) ? 'shim' : 'ki', notes: p.notes || [] } });
return [{ json: row }];
