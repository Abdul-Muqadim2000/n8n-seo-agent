// F2 (2026-10-23, ENGINE_AUDIT.md E1): the record that comes BEFORE the money. Runs in the AI Visibility Tracker between *AI Requests* and
// *Run AI Requests*: per site of this execution it writes the run's state row (seo_cache `ai_run:<site_id>`, upsert by key, exact columns)
// with every key this part is about to send added to `asked_keys`, the part itself as `pending` (its keys, its execution, when), and the
// DataForSEO money it commits at the engine prices (`committed_dfs_usd`, held against the run's ceiling). *AI Requests Go* reads the saved
// row back and nothing is paid unless it is there. A later part (or a resume after a crash) therefore knows exactly what was sent, and
// AI Requests never sends a recorded key again: a run cannot pay twice for one answer, whatever happens to that answer afterwards.
/*__AI_PANEL__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.pulse_run && p.chunk && !p.stop);
let reqs = []; try { reqs = $('AI Requests').all().map(i => i.json).filter(r => r && r.engine && !r.skip); } catch (e) {}
const now = new Date().toISOString();
const out = [];
for (const p of plans) {
  const mine = reqs.filter(r => r.site_id === p.site_id && !/^(market|index)/.test(String(r.prompt_id)));
  const dbViews = reqs.filter(r => r.site_id === p.site_id && /^(market|index)/.test(String(r.prompt_id)));
  if (!mine.length && !dbViews.length) continue;
  const st0 = p.state_before || {};
  const keys = mine.map(r => AIP.reqKey(r.prompt_id, r.engine));
  const sent = AIP.unpackKeys(st0.asked_keys); for (const k of keys) sent.add(k);
  const est = +(AIP.keysUsd(keys) + dbViews.reduce((t, r) => t + (Number(r.est_cost) || 0), 0)).toFixed(4);
  const committedBefore = Math.max(Number(st0.spent_dfs_usd) || 0, Number(st0.committed_dfs_usd) || 0);
  const st = { ...st0, ...AIP.baseState(p), ceiling_dfs_usd: Number(p.ceiling_dfs_usd) || Number(st0.ceiling_dfs_usd) || null,
    updated_at: now, chunk: p.chunk.no, status: 'running', finishing: !!p.chunk.final_expected,
    asked: Number(st0.asked) || 0, total: Number(st0.total) || p.chunk.total_est, unavailable: Number(st0.unavailable) || 0,
    spent_dfs_usd: Number(st0.spent_dfs_usd) || 0, spent_ai_usd: Number(st0.spent_ai_usd) || 0,
    committed_dfs_usd: +(committedBefore + est).toFixed(4),
    lost: Number(p.chunk.lost_total) || 0, lost_parts: Number(p.chunk.lost_parts) || 0, halve_next: false,
    asked_keys: AIP.packKeys(sent),
    pending: { chunk: p.chunk.no, execution: String($execution.id), at: now, n: keys.length, est_usd: est, keys: AIP.packKeys(keys), db_views: dbViews.length },
    executions: Array.isArray(st0.executions) ? st0.executions : (p.chunk.executions || []), resumed: !!p.chunk.resumed };
  out.push({ json: AIP.stateRow(p.site_id, st, now) });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing this part sends for a weekly run' } }];
