// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the Sentiment Reader's jobs - EVERY answer of this run that names the business
// (no 24-job cap for this step), 20 passages to a Claude Haiku call. Runs in the run's last execution only (where AI Metrics measures the week):
// this execution's answers (Parse AI Answers, with their full text) and the ones earlier executions of a split run stored (Load AI Run Answers).
// At most 40 calls a run (800 answers, ~4 minutes): the answers past that are not read and the report says how many.
/*__AI_STATS__*/
/*__AI_MEASURE__*/
/*__AI_SENTIMENT__*/
const CONFIG = { per_job: 20, max_jobs: 40 };
const rd = (n) => { try { return $(n).all().map(i => i.json).filter(Boolean); } catch (e) { return []; } };
const plans = rd('AI Plan').filter(p => !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const out = [];
for (const p of plans) {
  const mine = (r) => r && r.site_id === p.site_id && (!r.run_id || r.run_id === p.run_id);
  const rows = [...rd('Parse AI Answers').filter(r => !r.skip && r.engine).filter(mine), ...rd('Load AI Run Answers').filter(mine)];
  const named = SENT.namedAnswers(rows, { business: p.business_name || p.domain, named: AVM.named });
  const J = SENT.jobsOf(named, { per: CONFIG.per_job, max_jobs: CONFIG.max_jobs });
  J.jobs.forEach((items, k) => out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, job: k + 1, jobs: J.jobs.length, not_sent: J.not_sent, business: p.business_name || p.domain, keys: items.map(i => i.key),
    items: items.map(i => ({ n: i.n, key: i.key, engine: i.engine })),
    items_text: items.map(i => 'PASSAGE ' + i.n + ' [' + i.engine + '] rivals: ' + (i.rivals.join(', ') || 'none') + '\nQ: ' + i.question + '\n' + i.text).join('\n\n') } }));
}
return out.length ? out : [{ json: { skip: true } }];
