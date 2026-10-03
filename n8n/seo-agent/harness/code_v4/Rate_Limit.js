// Simple abuse guard: limits runs per requester and per day (state lives in workflow static data;
// it persists only for active/production executions, not manual test runs).
const LIMITS = { per_key_per_day: 6, global_per_day: 150, per_app_company_per_day: 40 };   // app: requests from the web app, keyed per company (v4.7)

const d = $input.first().json;
if (d.validation_error) return [{ json: d }];          // pass validation errors straight through
const today = new Date().toISOString().slice(0, 10);
// Internal spawns (ladder page runs, content cadence) are keyed by their marker, not the owner's e-mail: they are capped by the AI budget guard and their own weekly limits.
const internal = /^(ladder|cadence|tracker|casestudy|audit):/.test(String(d.client_ip || ''));
const fromApp = /^app:[a-z0-9-]{6,64}$/i.test(String(d.client_ip || ''));   // the web app: one key per company, whoever's e-mail gets the copy
const key = ((internal || fromApp) ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();
const perKey = fromApp ? LIMITS.per_app_company_per_day : LIMITS.per_key_per_day;

let store;
try { store = $getWorkflowStaticData('global'); } catch (e) { store = {}; }
if (!store.rate || store.rate.day !== today) store.rate = { day: today, total: 0, keys: {} };

const used = store.rate.keys[key] || 0;
if (store.rate.total >= LIMITS.global_per_day) {
  return [{ json: { ...d, validation_error: 'This service has reached its daily capacity. Please try again tomorrow.' } }];
}
if (used >= perKey && !['published', 'checkin', 'profile'].includes(d.mode)) {   // reporting a published page or a check-in costs nothing and is never blocked
  return [{ json: { ...d, validation_error: 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.' } }];
}
if (!['published', 'checkin', 'profile'].includes(d.mode)) store.rate.keys[key] = used + 1;
store.rate.total += 1;

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
else if (d.mode === 'backlinks') est = EST.backlinks;   // the page itself runs as its own execution and is counted there
if (d.need_site_description) est += EST.describe;
const period = (d.ai_budget_period === 'day') ? today : today.slice(0, 7);
if (!store.ai_budget || store.ai_budget.period !== period) store.ai_budget = { period, spent_est: 0, runs: 0 };
const budget = Number(d.ai_budget_usd || 0);
const __room = d.mode === 'case_study' ? EST.content : 0;   // reject the intake at once when the case-study page could not run today
if (budget > 0 && store.ai_budget.spent_est + est + __room > budget) {
  return [{ json: { ...d, validation_error: 'The AI budget for this ' + (d.ai_budget_period || 'month') + ' is used up (estimated $' + store.ai_budget.spent_est.toFixed(2) + ' of $' + budget + '; this run would add about $' + (est + __room).toFixed(2) + '). Raise ai_budget_usd in Normalize Input when you are ready to continue.' } }];
}
store.ai_budget.spent_est = +(store.ai_budget.spent_est + est).toFixed(2);
store.ai_budget.runs += 1;
d.ai_spend_estimate_usd = est;
d.ai_budget_used_est_usd = store.ai_budget.spent_est;

return [{ json: { ...d, run_number_today: used + 1 } }];
