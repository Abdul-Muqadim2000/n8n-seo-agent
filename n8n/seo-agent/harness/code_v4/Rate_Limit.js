// Abuse and spend guard: limits runs per requester and per day. v4.14 (D1): counted from the run ledger (seo_run_ledger, one appended row per
// execution), so parallel executions cannot overwrite each other's counts (they did with workflow static data until 2026-10-11).
const LIMITS = { per_key_per_day: 6, global_per_day: 150, per_app_company_per_day: 40 };   // app: requests from the web app, keyed per company (v4.7)

const d = { ...$('Normalize Input').first().json };   // v4.14: the input is the run ledger (Load Run Ledger); the request comes from Normalize Input
if (d.validation_error) return [{ json: d }];          // pass validation errors straight through
const today = new Date().toISOString().slice(0, 10);
// Internal spawns (ladder page runs, content cadence) are keyed by their marker, not the owner's e-mail: they are capped by the AI budget guard and their own weekly limits.
const internal = /^(ladder|cadence|tracker|casestudy|audit):/.test(String(d.client_ip || ''));
const fromApp = /^app:[a-z0-9-]{6,64}$/i.test(String(d.client_ip || ''));   // the web app: one key per company, whoever's e-mail gets the copy
const key = ((internal || fromApp) ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();
const perKey = fromApp ? LIMITS.per_app_company_per_day : LIMITS.per_key_per_day;

// v4.14 (D1): this execution reserved its ledger row before this check (Run Ledger Row -> Reserve Run Ledger); only the rows with a LOWER id
// count, so row order decides ties and no run slips past while another is counting. Refused rows and the Keyword Check's rows never count.
let mine = {}; try { mine = $('Reserve Run Ledger').first().json || {}; } catch (e) {}
let ledger = []; try { ledger = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const myId = Number(mine.id);
const earlier = ledger.filter(r => r.mode !== 'assess' && r.status !== 'refused' && (myId > 0 ? Number(r.id) < myId : String(r.run_id) !== String($execution.id)));
const todayRows = earlier.filter(r => String(r.created_at || '').slice(0, 10) === today);
const used = todayRows.filter(r => String(r.key || '').toLowerCase() === key && !['published', 'checkin', 'profile'].includes(r.mode)).length;
if (todayRows.length >= LIMITS.global_per_day) {
  return [{ json: { ...d, validation_error: 'This service has reached its daily capacity. Please try again tomorrow.' } }];
}
if (used >= perKey && !['published', 'checkin', 'profile'].includes(d.mode)) {   // reporting a published page or a check-in costs nothing and is never blocked
  return [{ json: { ...d, validation_error: 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.' } }];
}

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
const period = (d.ai_budget_period === 'day') ? today : today.slice(0, 7);
const spent_est = +earlier.filter(r => String(r.created_at || '').startsWith(period)).reduce((s, r) => s + (r.status === 'done' ? (Number(r.settled_usd) || 0) : (Number(r.est_usd) || 0)), 0).toFixed(2);   // a finished run counts what it settled, a running or crashed one its reservation
const budget = Number(d.ai_budget_usd || 0);
const __room = d.mode === 'case_study' ? EST.content : 0;   // reject the intake at once when the case-study page could not run today
if (budget > 0 && spent_est + est + __room > budget) {
  return [{ json: { ...d, validation_error: 'The AI budget for this ' + (d.ai_budget_period || 'month') + ' is used up (estimated $' + spent_est.toFixed(2) + ' of $' + budget + '; this run would add about $' + (est + __room).toFixed(2) + '). Raise ai_budget_usd in Normalize Input when you are ready to continue.' } }];
}
d.ai_spend_estimate_usd = est;
d.ai_budget_used_est_usd = +(spent_est + est).toFixed(2);

return [{ json: { ...d, run_number_today: used + 1 } }];
