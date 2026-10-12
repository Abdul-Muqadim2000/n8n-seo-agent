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
// P34-5: the row says which site the run is working on and whether it is a heavy crawl, so Rate Limit can refuse a second large
// audit of the same site while one is running (two 200-page audits of techand.ai at once stalled the n8n task runner, 2026-10-12).
const HEAVY_PAGES = Number(d.heavy_audit_pages) > 0 ? Number(d.heavy_audit_pages) : 100;
const heavy = d.mode === 'audit' && (Number(d.crawl_max_pages) || 0) >= HEAVY_PAGES;
return [{ json: { run_id: String($execution.id), key, mode: String(d.mode || ''), est_usd: +Number(est || 0).toFixed(4), created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0,
  domain: String(d.domain || '').toLowerCase(), heavy } }];
