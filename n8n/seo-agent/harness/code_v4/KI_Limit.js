// KI Limit (E2, 2026-11-08, CONTRACTS.md §3): the API guards of the main workflow's *Rate Limit*, applied to a keyword-intelligence run AFTER
// its ledger row exists and BEFORE its first paid call (the same order: insert, read, count only the rows with a lower id).
//   * the company's runs today: the row of this run carries the caller's key (`app:<company id>`, Run Ledger Row (KI)), the key the main
//     workflow's Rate Limit counts, so a company's keyword-intelligence and other runs share one daily allowance (LIMITS, baked from it);
//   * the day's estimated Claude and search-data spend against ai_budget_usd / dfs_budget_usd, and the account balance against its floor
//     (Normalize Input's CONFIG, baked by build_ki.py): a refused run is charged nothing, its row is marked `refused` and the caller is told why.
const LIMITS = {"global_per_day": 150, "per_app_company_per_day": 40, "per_key_per_day": 6};
const CONFIG = {"ai_budget_period": "day", "ai_budget_usd": 15.0, "dfs_balance_floor_usd": 0.5, "dfs_budget_usd": 15.0, "run_stale_hours": 2.0};
const S = (v) => (v == null ? '' : String(v)).trim();
const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const p = $('KI Plan').first().json || {};
let mine = {}; try { mine = $('Reserve Run Ledger (KI)').first().json || {}; } catch (e) { mine = {}; }
let rows = []; try { rows = $('Load Ledger Today (KI)').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { rows = []; }
const myId = n0(mine.id);
const today = new Date().toISOString().slice(0, 10);
const staleMs = n0(CONFIG.run_stale_hours || 2) * 36e5;
const isStale = (r) => S(r.status) === 'stale' || (S(r.status) === 'reserved' && Date.now() - Date.parse(S(r.created_at)) > staleMs);
const earlier = rows.filter(r => r.mode !== 'assess' && r.status !== 'refused' && !isStale(r) && (myId > 0 ? n0(r.id) < myId : S(r.run_id) !== S($execution.id)));
const todayRows = earlier.filter(r => S(r.created_at).slice(0, 10) === today);
const key = S(p.client_key).toLowerCase();
const fromApp = /^app:[a-z0-9-]{6,64}$/i.test(key);
const perKey = fromApp ? LIMITS.per_app_company_per_day : LIMITS.per_key_per_day;
const used = key ? todayRows.filter(r => S(r.key).toLowerCase() === key && !['published', 'checkin', 'profile'].includes(r.mode)).length : 0;
const period = CONFIG.ai_budget_period === 'day' ? today : today.slice(0, 7);
const inPeriod = earlier.filter(r => S(r.created_at).startsWith(period));
const aiSpent = +inPeriod.reduce((s, r) => s + (r.status === 'done' ? n0(r.settled_usd) : n0(r.est_usd)), 0).toFixed(2);
const dfsSpent = +inPeriod.reduce((s, r) => s + (r.status === 'done' ? n0(r.dfs_usd) : n0(r.dfs_est_usd)), 0).toFixed(2);
const est = n0(p.est_dfs_usd), aiEst = n0(p.est_ai_usd);
let balance = 0; try { balance = n0(($('Run Ledger Row (KI)').first().json || {}).dfs_balance); } catch (e) { balance = 0; }
const floor = n0(CONFIG.dfs_balance_floor_usd);
const again = CONFIG.ai_budget_period === 'day' ? 'tomorrow' : 'next month';
let reason = '', note = '';
if (todayRows.length >= LIMITS.global_per_day) { reason = 'capacity'; note = 'This service has reached its daily capacity. Please try again tomorrow.'; }
else if (key && used >= perKey) { reason = 'rate_limited'; note = 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.'; }
else if (n0(CONFIG.ai_budget_usd) > 0 && aiSpent + aiEst > n0(CONFIG.ai_budget_usd)) { reason = 'ai_budget'; note = 'The AI budget for this ' + (CONFIG.ai_budget_period || 'month') + ' is used up (estimated $' + aiSpent.toFixed(2) + ' of $' + n0(CONFIG.ai_budget_usd) + '). Nothing was charged and nothing was started: this analysis can run again ' + again + '.'; }
else if (n0(CONFIG.dfs_budget_usd) > 0 && dfsSpent + est > n0(CONFIG.dfs_budget_usd)) { reason = 'dfs_budget'; note = 'The search-data budget for this ' + (CONFIG.ai_budget_period || 'month') + ' is used up (estimated $' + dfsSpent.toFixed(2) + ' of $' + n0(CONFIG.dfs_budget_usd) + '; this run would add about $' + est.toFixed(2) + '). Nothing was charged and nothing was started: this analysis can run again ' + again + '.'; }
else if (balance > 0 && est > 0 && balance - est < floor) { reason = 'account_low'; note = 'The search-data account is too low for this run ($' + balance.toFixed(2) + ' left; it needs about $' + est.toFixed(2) + ' and $' + floor.toFixed(2) + ' has to stay for the scheduled checks). Nothing was charged and nothing was started.'; }
return [{ json: { limited: !!reason, reason, note, used_today: used, per_key: perKey, key, ai_spent_est_usd: aiSpent, dfs_spent_est_usd: dfsSpent, dfs_balance_usd: balance,
  refused_at: new Date().toISOString(), cost_basis: reason ? ('refused before any spending (' + reason + '): ' + note).slice(0, 400) : '' } }];
