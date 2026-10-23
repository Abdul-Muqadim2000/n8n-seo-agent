// R-E1 (2026-10-23, docs/ai-visibility-2026-10-23/REVIEW_ENGINE.md): the record that comes BEFORE the options' money, the same rule F2 applies to
// the weekly requests (AI Asking State). Runs between *AI Extra Requests* and *Run AI Extra Requests*, in the run's last part, after the week is
// stored: per site it writes the run's state row (seo_cache `ai_run:<site_id>`, upsert by key, exact columns) as AI Metrics left it (`done`),
// with every option request this attempt is about to send added to `extras.keys`. *AI Extras Go* reads the saved row back and nothing is paid
// unless it is there. An attempt of the same run that reaches the options again (a resume after a crash in this window) finds the keys and
// never buys the same fan-out search, persona answer or market task twice.
/*__AI_PANEL__*/
/*__AI_W2E3__*/
const rd = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const plans = rd('AI Plan').filter(p => p && !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const reqs = rd('AI Extra Requests').filter(r => r && !r.skip && r.kind && r.site_id);
const metricsRows = rd('AI Metrics').flatMap(m => m.cache_rows || []);
const cacheRows = rd('Load Cache (AI)');
const now = new Date().toISOString();
const out = [];
for (const p of plans) {
  const mine = reqs.filter(r => r.site_id === p.site_id);
  if (!mine.length) continue;
  // the state as AI Metrics wrote it this execution (`done`), else as it stood when the execution started, else the plan's
  const key = AIP.stateKey(p.site_id);
  const fromMetrics = metricsRows.find(r => r && r.key === key);
  const st0 = (fromMetrics ? (() => { try { return JSON.parse(fromMetrics.value || '{}'); } catch (e) { return null; } })() : null) || AIP.stateOf(cacheRows, p.site_id) || p.state_before || { run_id: p.run_id, site_id: p.site_id, domain: p.domain };
  const recorded = new Set([...AIX.extrasRecorded(st0, p.run_id), ...AIX.extrasRecorded(AIP.stateOf(cacheRows, p.site_id), p.run_id), ...AIX.extrasRecorded(p.state_before, p.run_id)]);
  for (const r of mine) recorded.add(r.xkey || AIX.extraKey(r));
  const est = +mine.reduce((t, r) => t + (Number(r.est_cost) || 0), 0).toFixed(4);
  const st = { ...st0, run_id: st0.run_id || p.run_id, updated_at: now,
    extras: { run_id: p.run_id, keys: [...recorded], at: now, execution: String($execution.id), n: mine.length, est_usd: est } };
  out.push({ json: AIP.stateRow(p.site_id, st, now) });
}
return out.length ? out : [{ json: { skip: true, reason: 'no option request to record' } }];
