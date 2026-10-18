// F-L (2026-10-18, re-rating 2026-10-17 C-1 follow-up): the "ran late" notice for the scheduled workflows that have no Callback Ledger —
// the Audit Scheduler (its audits report through the main workflow, so the notice rides in each audit's body) and the Page Watch (its
// callback is the alert digest). Same rule and words as v5/code/Callback_Ledger.js: CU.lateRun on what started this run — the
// catch-up's payload on the manual entry (`trigger: 'catchup'`, `scheduled_for`, `why`) or the schedule trigger's own timestamp — against
// the workflow's schedule (SCHED, baked by monitor_cost.bake_ran_late). An on-demand run is never late. Needs CU (_catchup.js) and SCHED.
const RL = (() => {
  const of = (sched, entries) => {
    const sc = sched || {};
    let trig = {}, fired = '';
    for (const n of (entries || ['Manual Run'])) { try { const t = $(n).first(); if (t && t.json) { trig = t.json; break; } } catch (e) {} }
    if (trig.body && typeof trig.body === 'object') trig = { ...trig, ...trig.body };
    if (sc.trigger) { try { const t = $(sc.trigger).first(); if (t && t.json) fired = String(t.json.timestamp || ''); } catch (e) {} }
    try { return CU.lateRun({ trigger: trig.trigger, scheduled_for: trig.scheduled_for, why: trig.why, started_at: trig.started_at, fired_at: fired,
      cron: sc.cron, tz: sc.tz, kind: sc.kind }); } catch (e) { return { late: false }; }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const subjectTag = (subject, rl) => (rl && rl.late && typeof subject === 'string' && subject && !/\(ran late/.test(subject))
    ? subject + ' (ran late — due ' + String(rl.due || '').slice(0, 10) + ')' : subject;
  const box = (rl) => '<div class="ran-late" style="border:1px solid #b45309;background:#fffbeb;color:#78350f;padding:10px 14px;margin:0 0 14px;font:14px/1.5 sans-serif"><strong>Ran late.</strong> ' + esc(rl && rl.text) + '</div>';
  // the same marks Callback Ledger puts on a callback item: `ran_late`, the box first in its HTML, the tag on its subject
  const mark = (j, rl) => {
    if (!rl || !rl.late) return j;
    const o = { ...j, ran_late: rl };
    if (typeof o.html === 'string' && o.html) o.html = /<body[^>]*>/i.test(o.html) ? o.html.replace(/<body[^>]*>/i, (b) => b + box(rl)) : box(rl) + o.html;
    if (typeof o.subject === 'string') o.subject = subjectTag(o.subject, rl);
    return o;
  };
  return { of, subjectTag, box, mark };
})();
