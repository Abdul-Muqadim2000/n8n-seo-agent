// Index coverage (fix wave 1, FIX_CONTRACT.md decision 1 / X1): the dispatch starts today's chain - the FIRST website's own execution,
// through this workflow's Manual Run, with the rest of the list and today's Google news (read once, here). Each website's execution saves its
// rows and starts the next one (Next Index Part), so one website runs at a time.
// Fix wave 2 (N5): a chain is only as long as its links - a time-out, a crash or an n8n restart in one website's execution stops the chain
// there. What saves the day is the WATCH: 50 minutes after this dispatch (Index Watch Plan -> Wait (Index Watch)) the dispatch runs again as
// `ix_watch` and restarts the chain for the websites with no finished run today (seo_index_runs); a refused dispatch is retried the same
// way (Retry Index Part). A website whose run broke twice today waits for tomorrow.
const S = (v) => String(v == null ? '' : v).trim();
let plan = {}; try { plan = $('Index Plan').first().json || {}; } catch (e) { plan = {}; }
let g = {}; try { g = $('Google Events').first().json || {}; } catch (e) { g = {}; }
const ids = Array.isArray(plan.chain) ? plan.chain.map(S).filter(Boolean) : [];
if (!plan.dispatch || !ids.length) return [{ json: { skip: true, reason: 'no website to start' } }];
const slim = (e) => ({ event_id: S(e.event_id), title: S(e.title), kind: S(e.kind), status: S(e.status), started_at: S(e.started_at), ended_at: S(e.ended_at) });
const news = { started: (g.started || []).map(slim).slice(0, 10), completed: (g.completed || []).map(slim).slice(0, 10), policy: g.policy_news ? slim(g.policy_news) : null };
const nowIso = new Date().toISOString();
return [{ json: { trigger: 'ix_chain', parent_run_id: String($execution.id), site_id: ids[0],
  ix_chain: { date: nowIso.slice(0, 10), started_at: nowIso, dispatch_id: String($execution.id), rest: ids.slice(1), part: 1, of: ids.length, attempt: 0, news } } }];
