// v4.14 (2026-10-11, FIX_PLAN D1): this execution's reservation in the run ledger (seo_run_ledger, exact columns), inserted BEFORE Rate Limit
// counts. Parallel executions used to overwrite each other's static-data counters (8 app runs and 3 spawns counted as 5, $0.67 of ≈ $3.0);
// with one appended row per run, Rate Limit counts every row with a lower id than this one. The key and the Claude estimate below are the
// Rate Limit's own lines, copied in by build_v4.py at build time (one source: a mode added there reaches this node automatically).
const d = $('Normalize Input').first().json || {};
// Internal spawns (ladder page runs, content cadence) are keyed by their marker, not the owner's e-mail: they are capped by the AI budget guard and their own weekly limits.
const internal = /^(ladder|cadence|tracker|casestudy|audit):/.test(String(d.client_ip || ''));
const fromApp = /^app:[a-z0-9-]{6,64}$/i.test(String(d.client_ip || ''));   // the web app: one key per company, whoever's e-mail gets the copy
const key = ((internal || fromApp) ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();
// ---- estimated Claude spend guard ----
// Conservative per-run estimates (USD) for the AI steps only; DataForSEO spend is tracked separately in run_ledger.
const EST = { content: 1.2, discover: 0.35, verdict: 0.2, full: 0.25, site_audit: 0, describe: 0.03, ladder: 0.55, report: 0.3, track: 0, published: 0, checkin: 0, profile: 0, case_study: 0, ai_visibility: 0.06, backlinks: 0.04 };   // monitors: DataForSEO is the main cost (~$0.60 / ~$0.30 per check); Claude writes the questions, the brief and outreach drafts   // track: the Site Tracker's brief runs in its own execution (~$0.03 per site per week)   // ladder = verdict + relevance screen; its page runs are separate executions and are counted on their own
let est = 0;
if (d.mode === 'site_description') est = EST.describe;
else if (d.mode === 'audit') est = d.include_full_report ? EST.full : EST.site_audit;
else if (d.mode === 'discover') est = EST.discover;   // report / content / audit follow-ups run as their own executions and are counted there
else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : (d.include_content ? EST.content : EST.report);
else if (d.mode === 'ladder') est = EST.ladder;
else if (d.mode === 'track') est = EST.track;
else if (d.mode === 'published') est = EST.published;
else if (d.mode === 'checkin') est = EST.checkin;
else if (d.mode === 'profile') est = EST.profile;
else if (d.mode === 'case_study') est = EST.case_study;
else if (d.mode === 'ai_visibility') est = EST.ai_visibility;
else if (d.mode === 'backlinks') est = d.free_only ? 0 : EST.backlinks;   // v4.10: free sources only = no paid call   // the page itself runs as its own execution and is counted there
if (d.need_site_description) est += EST.describe;


// ---- estimated DataForSEO spend (R9, 2026-10-13) ----
// The ledger counted Claude money only: both technical audits of the re-rating run carried est_usd 0 although each 200-page crawl cost $0.09
// measured, and nothing recorded what a run spends at DataForSEO. Measured on techand.ai (2026-10-11 and 2026-10-13): a 200-page crawl $0.09,
// a full report about $1.00 (crawl + Labs + competitors + domain ages), a content run $0.08, a verdict $0.06, discovery $0.15, a ladder $0.12,
// an on-demand AI check $0.60, a paid backlink check $0.50 (free_only: nothing). `ai_budget_usd` still guards Claude money only — this is
// carried on the row, settled with the measured run_ledger.dataforseo_usd and reported, so the real spend per day is finally countable.
const DFS_EST = { crawl: 0.09, full: 1.0, content: 0.08, verdict: 0.06, discover: 0.15, ladder: 0.12, ai_visibility: 0.6, backlinks: 0.5 };
let dfs_est = 0;
if (d.mode === 'audit') dfs_est = d.include_full_report ? DFS_EST.full : DFS_EST.crawl;
else if (d.mode === 'discover') dfs_est = DFS_EST.discover + (d.include_full_report ? DFS_EST.full : 0);
else if (d.mode === 'keyword') dfs_est = d.verdict_only ? DFS_EST.verdict : DFS_EST.content;
else if (d.mode === 'ladder') dfs_est = DFS_EST.ladder;
else if (d.mode === 'ai_visibility') dfs_est = DFS_EST.ai_visibility;
else if (d.mode === 'backlinks') dfs_est = d.free_only ? 0 : DFS_EST.backlinks;
dfs_est = +Number(dfs_est).toFixed(4);
// P34-5: the row says which site the run is working on and whether it is a heavy crawl, so Rate Limit can refuse a second large
// audit of the same site while one is running (two 200-page audits of techand.ai at once stalled the n8n task runner, 2026-10-12).
const HEAVY_PAGES = Number(d.heavy_audit_pages) > 0 ? Number(d.heavy_audit_pages) : 100;
const heavy = d.mode === 'audit' && (Number(d.crawl_max_pages) || 0) >= HEAVY_PAGES;
return [{ json: { run_id: String($execution.id), key, mode: String(d.mode || ''), est_usd: +Number(est || 0).toFixed(4), created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0,
  domain: String(d.domain || '').toLowerCase(), heavy, dfs_est_usd: dfs_est, dfs_usd: 0 } }];
