// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the Sentiment Reader's jobs - EVERY answer of this run that names the business
// (no 24-job cap for this step), 20 passages to a Claude Haiku call. Runs in the run's last execution only (where AI Metrics measures the week):
// this execution's answers (Parse AI Answers, with their full text) and the ones earlier executions of a split run stored (Load AI Run Answers).
// At most 40 calls a run (800 answers): the answers past that are not read and the report says how many.
// R-E8 (2026-10-23, REVIEW_ENGINE.md): past the cap the reader gets a SAMPLE spread over the whole week (every engine its share, a seeded shuffle of
// the questions inside each; SENT.sampleOf), never this part's answers first, and the report says it is a sample of n.
// R-E5 (2026-10-23, REVIEW_ENGINE.md): the calls are also held to the time this execution has left (the plan's start, the 60-minute limit, the tail
// that still has to run: the metrics, the saves, the options, the brief, the report and the PDF), so the reader can never cost the week: it reads
// fewer answers, and says so, rather than run past the limit before the week is stored.
/*__AI_STATS__*/
/*__AI_MEASURE__*/
/*__AI_SENTIMENT__*/
/*__AI_PANEL__*/
const CONFIG = { per_job: 20, max_jobs: 40 };
const rd = (n) => { try { return $(n).all().map(i => i.json).filter(Boolean); } catch (e) { return []; } };
const plans = rd('AI Plan').filter(p => !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const nowMs = Date.now();
// the time left for the reader, shared by the sites of this execution
const startMs = Math.min(...plans.map(p => Date.parse((p.chunk || {}).plan_at || '') || nowMs), nowMs);
const tail = AIP.TIME.sentiment_tail_s + Math.max(0, ...plans.map(p => Number((p.chunk || {}).extra_s) || 0));
const leftS = Math.max(0, AIP.TIME.exec_limit_s - (nowMs - startMs) / 1000 - tail);
let jobsByTime = Math.floor(leftS / AIP.TIME.sentiment_call_s);
const out = []; const markers = [];
for (const p of plans) {
  const mine = (r) => r && r.site_id === p.site_id && (!r.run_id || r.run_id === p.run_id);
  const rows = [...rd('Parse AI Answers').filter(r => !r.skip && r.engine).filter(mine), ...rd('Load AI Run Answers').filter(mine)];
  const named = SENT.namedAnswers(rows, { business: p.business_name || p.domain, named: AVM.named });
  const maxJ = Math.max(0, Math.min(CONFIG.max_jobs, jobsByTime));
  const S0 = SENT.sampleOf(named, maxJ * CONFIG.per_job, p.run_id);
  const J = SENT.jobsOf(S0.list, { per: CONFIG.per_job, max_jobs: maxJ });
  jobsByTime -= J.jobs.length;
  const sample = S0.sample ? { ...S0.sample, calls_max: maxJ, by_time: maxJ < CONFIG.max_jobs, left_s: Math.round(leftS) } : null;
  const not_sent = named.length - J.sent;
  J.jobs.forEach((items, k) => out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, job: k + 1, jobs: J.jobs.length, not_sent, sample, business: p.business_name || p.domain, keys: items.map(i => i.key),
    items: items.map(i => ({ n: i.n, key: i.key, engine: i.engine })),
    items_text: items.map(i => 'PASSAGE ' + i.n + ' [' + i.engine + '] rivals: ' + (i.rivals.join(', ') || 'none') + '\nQ: ' + i.question + '\n' + i.text).join('\n\n') } }));
  // a site whose answers could not be read at all for lack of time is named to AI Metrics (never an item of its own: every item goes to the reader)
  if (!J.jobs.length && named.length) markers.push({ site_id: p.site_id, run_id: p.run_id, no_time: true, not_sent, sample: { n: 0, of: named.length, calls_max: 0, by_time: true, left_s: Math.round(leftS), method: 'no time left in this execution' } });
}
if (out.length) { out[0].json.markers = markers; return out; }
return [{ json: { skip: true, markers } }];
