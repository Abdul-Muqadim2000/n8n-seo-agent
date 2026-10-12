// D19 / G1 (system review of 2026-10-11, FIX_PLAN.md; the retry-gate pattern of build_v4.py section 25): DataForSEO reports a task error
// *inside* an HTTP 200 (`status_code` 40000-50000, e.g. "Internal SE Server Error."), which n8n's `retryOnFail` never sees. In execution
// 362 / 363 seven of 42 requests failed that way (AI Mode and AI Overview x5, ChatGPT "no response" x2) and the week's figures were quietly
// computed on the rest. Every failed request is now re-sent ONCE, after a pause (*Wait Before AI Retry*), and *Merge AI Answers* puts the
// retry's answer in the failed one's place before *Parse AI Answers* reads them.
// Only the failed requests are re-sent (the bodies are the same items), so the retry can cost at most what the failures cost — a failed
// DataForSEO task is billed 0 — and never more than CONFIG.max_retries of them. Shared by the AI Visibility Tracker and the AI Pulse.
const CONFIG = { max_retries: 24 };
const reqs = $('AI Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
if (!reqs.length || reqs[0].skip) return [{ json: { skip: true, reason: 'nothing was asked' } }];
const out = []; let failed = 0;
reqs.forEach((q, i) => {
  const r = resps[i] || {}; const task = (r.tasks || [])[0] || {}; const res = (task.result || [])[0];
  const code = Number(task.status_code) || 0;
  let why = '';
  if (r.error) why = 'request failed: ' + String((r.error && (r.error.message || r.error)) || 'error').slice(0, 120);
  else if (!code) why = 'no response';
  else if (code >= 40000) why = 'task error ' + code + ': ' + String(task.status_message || '').slice(0, 100);
  else if (code === 20000 && !res) why = 'no answer in the task';   // an AI Overview that is simply not shown IS an answer: the task carries a result
  if (!why) return;
  failed++;
  if (out.length >= CONFIG.max_retries) return;
  out.push({ json: { ...q, retry_of: i, retry_reason: why, is_retry: true } });
});
if (!out.length) return [{ json: { skip: true, reason: failed ? 'nothing to retry' : 'every request answered', failed } }];
out[0].json.retry_total = out.length; out[0].json.failed_total = failed;
return out;
