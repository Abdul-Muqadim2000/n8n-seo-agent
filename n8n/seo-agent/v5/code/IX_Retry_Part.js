// Index coverage (fix wave 1, X1): a website of today's chain that the run guard refused because other runs were in flight (the same
// website on demand, or too many analyses at once) is started again five minutes later (at most 12 times, one hour), so one busy moment
// does not end the chain for every website after it.
// Fix wave 2 (N5): a refused DISPATCH (the 05:15 schedule, the catch-up, a watch) is not the end of the day either: it is started again as
// the day's watch (`ix_watch`) IX.CFG.watch_refused_minutes later - while a chain is still running that refusal is expected, and when the
// chain broke (its reservation goes stale after two hours) the watch restarts it for the websites not done today. A chain part refused 12
// times stops; the watch picks its website up. Any other refusal of a part, and an on-demand run, ends here.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
let t = {}; try { const x = $('Manual Run').first(); t = (x && x.json) || {}; } catch (e) { t = {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
let g = {}; try { g = $('After Run Ledger (Index)').first().json || {}; } catch (e) { g = {}; }
let plan = {}; try { plan = $('Index Plan').first().json || {}; } catch (e) { plan = {}; }
const capacity = ['same_mode', 'too_many_open', 'heavy_busy'].includes(S(g.reason));
if (plan.dispatch) {
  const n = (Number(plan.watch_n) || 0) + 1;
  if (n > IX.CFG.watch_max) return [{ json: { skip: true, reason: 'the dispatch was refused and the day was watched ' + IX.CFG.watch_max + ' times: tomorrow\'s dispatch takes the websites left first' } }];
  if (!capacity) return [{ json: { skip: true, reason: 'the dispatch was refused for ' + (S(g.reason) || 'an unknown reason') + ': not retried' } }];
  return [{ json: { trigger: 'ix_watch', ix_watch: { date: S(plan.today) || new Date().toISOString().slice(0, 10), n, after: 'refused' }, wait_minutes: IX.CFG.watch_refused_minutes } }];
}
const ch = t.ix_chain && typeof t.ix_chain === 'object' ? t.ix_chain : null;
if (!ch || !S(t.site_id)) return [{ json: { skip: true, reason: 'not a chain part' } }];
if (!capacity) return [{ json: { skip: true, reason: 'refused for ' + (S(g.reason) || 'an unknown reason') + ': not retried' } }];
const attempt = (Number(ch.attempt) || 0) + 1;
if (attempt > 12) return [{ json: { skip: true, reason: 'refused 12 times in a row: the chain stops here; the day\'s watch starts these websites again' } }];
return [{ json: { trigger: 'ix_chain', parent_run_id: String($execution.id), site_id: S(t.site_id), ix_chain: { ...ch, attempt }, wait_minutes: 5 } }];
