// Keyword Check daily limits (v4.14, FIX_PLAN D1): counted from the run ledger (seo_run_ledger, today's rows with mode 'assess'), no longer from
// static data that parallel requests overwrote. Every request reserved its row first (Run Ledger Row (Assess) -> Reserve Run Ledger (Assess));
// only rows with a LOWER id than this request's count, so row order decides ties and a request can never slip past the limit while another is
// still counting. Refused rows never count. 40 a day per caller (the web app's X-Forwarded-For app:<company>), 400 a day in total -> 429.
const LIMITS = { per_key_per_day: 40, global_per_day: 400 };
const v = $('Assess Validate').first().json || {};
let mine = {}; try { mine = $('Reserve Run Ledger (Assess)').first().json || {}; } catch (e) {}
let rows = []; try { rows = $('Load Run Ledger (Assess)').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const myId = Number(mine.id);
const today = String(mine.created_at || new Date().toISOString()).slice(0, 10);
const earlier = rows.filter(r => r.mode === 'assess' && r.status !== 'refused' && String(r.created_at || '').slice(0, 10) === today && (myId > 0 ? Number(r.id) < myId : String(r.run_id) !== String($execution.id)));
const key = String(v.caller || 'anon').toLowerCase();
const used = earlier.filter(r => String(r.key || '').toLowerCase() === key).length;
let limited = '';
if (used >= LIMITS.per_key_per_day) limited = 'The daily limit of ' + LIMITS.per_key_per_day + ' keyword checks is reached. Please try again tomorrow.';
else if (earlier.length >= LIMITS.global_per_day) limited = 'The daily limit of ' + LIMITS.global_per_day + ' keyword checks for all callers is reached. Please try again tomorrow.';
return [{ json: { ...v, ok: !limited, status: limited ? 429 : 200, error: limited, checks_today: used + 1 } }];
