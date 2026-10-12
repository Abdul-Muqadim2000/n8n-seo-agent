// D19 (system review of 2026-10-11, FIX_PLAN.md): the answers of *Run AI Requests* with every retried request's answer put back in its own
// place, so the item order still matches *AI Requests* one to one (*Parse AI Answers* and *AI Metrics* pair them by index). A retry replaces
// the first answer only when it really came back (task status 20000 with a result); otherwise the original failure is kept, with its message,
// and the run reports the failure instead of hiding it. The first item carries the counts for the report ("3 of 42 requests failed, 2 answered
// on the retry"). Shared by the AI Visibility Tracker and the AI Pulse.
const base = $('Run AI Requests').all().map(i => i.json || {});
let rq = [], rr = [];
try { rq = $('AI Retry Requests').all().map(i => i.json || {}).filter(q => !q.skip); } catch (e) {}
try { rr = $('Run AI Retries').all().map(i => i.json || {}); } catch (e) {}
const ok = (r) => { const t = ((r || {}).tasks || [])[0] || {}; return !(r || {}).error && Number(t.status_code) === 20000 && !!(t.result || [])[0]; };
const out = base.map(x => ({ ...x }));
let fixed = 0;
rq.forEach((q, k) => {
  const i = Number(q.retry_of); const r = rr[k];
  if (!(i >= 0) || i >= out.length || !r) return;
  if (!ok(r)) return;
  out[i] = { ...r, retried: true, retry_reason: q.retry_reason || '' };
  fixed++;
});
if (out.length) { out[0].retry_asked = rq.length; out[0].retry_answered = fixed; out[0].requests_failed = Number((rq[0] || {}).failed_total) || rq.length; }
return out.length ? out.map(j => ({ json: j })) : [{ json: {} }];
