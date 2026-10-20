// R115 (2026-10-16, re-rating 2026-10-15 D-19): the callback waits for the settle and carries what it settled.
// *Ledger Join (…)* (a Merge node, append) holds the callback items that reached it (input 0) until the settle's answer (input 1) is there
// too — n8n's v1 order runs a two-input node only when both inputs have data — so this node runs after the settle and puts the settled
// figure on every callback item as `run_ledger` (v5/code/_ledger_cb.js has the shape).
// Each run of the Join carries exactly the callback items of ONE arrival, so every item is posted once: the Content Cadence has two
// builders (Cadence Note, Cadence Status) that one weekly run can both use, and a branch that reaches the settle twice sends a second
// settle answer with no callback items behind it — that run posts nothing. When n8n has nothing else left to run it releases a Join that
// still waits for the settle (the settle failed): the report still goes out, saying it carries no settled figure.
// SETTLE / PREDS / HAS_CALLBACK are written in by monitor_cost.callback_after_settle() at build time.
/*__LEDGER_CB__*/
const SETTLE = '__SETTLE__';
const PREDS = __PREDS__;          // [[node, output index], …] — the nodes that build the callback items (recorded for the build's proof)
const HAS_CALLBACK = '__HAS_CALLBACK__';
// the settle's own answer rides input 1; a callback item never carries these two ledger columns
const isSettle = (j) => !!j && Object.prototype.hasOwnProperty.call(j, 'settled_usd') && Object.prototype.hasOwnProperty.call(j, 'cost_mode');
const all = $input.all();
const items = all.filter((it) => !isSettle((it && it.json) || null));
if (!items.length) return [];
let settled = (all.find((it) => isSettle((it && it.json) || null)) || {}).json || null;
if (!settled) { try { settled = $(SETTLE).first().json || null; } catch (e) { settled = null; } }
const run_ledger = settled ? LCB.fromSettle(settled)
  : { settled: false, cost_basis: 'this run could not be settled, so no cost figure is given (see the run ledger row)' };
// C-1 (re-rating 2026-10-17): a run that ran late says so in its report - started by the schedule catch-up for a slot it missed (the
// payload's `trigger: 'catchup'`, `scheduled_for`, `why`) or fired by its own schedule hours after the slot (the Mac asleep). The slot,
// how late and why go on the callback as `ran_late`, first in the report's HTML and in its subject. An on-demand run is never "late".
/*__CATCHUP__*/
/*__SITE_TIME__*/
const SCHED = __SCHED_JSON__;
let __trig = {}, __fired = '';
for (const __n of ['Manual Run', 'Watch Run']) { try { const __t = $(__n).first(); if (__t && __t.json) { __trig = __t.json; break; } } catch (e) {} }
if (__trig.body && typeof __trig.body === 'object') __trig = { ...__trig, ...__trig.body };
if (SCHED.trigger) { try { const __t = $(SCHED.trigger).first(); if (__t && __t.json) __fired = String(__t.json.timestamp || ''); } catch (e) {} }
let ran_late = { late: false };
try { ran_late = CU.lateRun({ trigger: __trig.trigger, scheduled_for: __trig.scheduled_for, why: __trig.why, started_at: __trig.started_at, fired_at: __fired,
  cron: SCHED.cron, tz: ST.okTz(__trig.tz) ? __trig.tz : (SCHED.tz || ST.engineTz()), kind: SCHED.kind }); } catch (e) { ran_late = { late: false }; }
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.5 / §14.2): a callback of a cycle run says so - `trigger: 'cycle'`, `cycle_key`, `cycle_date` (the
// cycle's local due date) and `cycle_week` - and its report is dated by the cycle ("Week of Wed 15 Oct"), never by a Monday it did not run on.
const __cyc = ST.cycleOf(__trig);
const __cycFields = ST.callbackFields(__cyc);
const __esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const cycleMark = (j) => {
  if (!__cyc || !__cyc.key) return j;
  const o = { ...j, ...__cycFields };
  if (__cyc.label && typeof o.subject === 'string' && o.subject && o.subject.indexOf(__cyc.label) < 0) o.subject = o.subject + ' · ' + __cyc.label;
  const line = '<p class="cycle-week" style="margin:0 0 10px;color:#64748b;font:13px/1.5 sans-serif">' + __esc(__cyc.label) + ': this website\'s weekly cycle.</p>';
  if (__cyc.label && typeof o.html === 'string' && o.html && o.html.indexOf('class="cycle-week"') < 0) o.html = /<body[^>]*>/i.test(o.html) ? o.html.replace(/<body[^>]*>/i, (b) => b + line) : line + o.html;
  return o;
};
const lateMark = (j) => {
  if (!ran_late.late) return j;
  const box = '<div class="ran-late" style="border:1px solid #b45309;background:#fffbeb;color:#78350f;padding:10px 14px;margin:0 0 14px;font:14px/1.5 sans-serif"><strong>Ran late.</strong> ' + __esc(ran_late.text) + '</div>';
  const o = { ...j, ran_late };
  if (typeof o.html === 'string' && o.html) o.html = /<body[^>]*>/i.test(o.html) ? o.html.replace(/<body[^>]*>/i, (b) => b + box) : box + o.html;
  if (typeof o.subject === 'string' && o.subject && !/\(ran late/.test(o.subject)) o.subject = o.subject + ' (ran late — due ' + ran_late.due.slice(0, 10) + ')';
  return o;
};
return items.map((it) => {
  const out = { json: lateMark(cycleMark({ ...((it && it.json) || {}), run_ledger })) };
  if (it && it.binary) out.binary = it.binary;
  return out;
});
