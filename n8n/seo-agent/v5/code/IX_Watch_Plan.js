// Index coverage (fix wave 2, N5): the day's WATCH. After a dispatch (the 05:15 schedule, the catch-up, a Manual Run naming no website, or a
// watch itself) has started today's chain, this execution waits 50 minutes (Wait (Index Watch): n8n keeps a waiting execution in its database,
// so a restart does not lose it) and starts the dispatch again as `ix_watch`. That dispatch restarts the chain for the websites not done
// today - after a crash, a time-out, an n8n restart (a deploy, the spot VM taken back) or a part the run guard refused 12 times - and, while
// a chain is still running, is refused by the run guard (the same mode is in flight) and tries again later (Retry Index Part). The watch
// ends when every website is done today (the dispatch has nothing to do), when the day ends (a watch of another day does nothing), or after
// IX.CFG.watch_max watches. Nothing here inspects, reads a website or spends anything.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
let plan = {}; try { plan = $('Index Plan').first().json || {}; } catch (e) { plan = {}; }
if (!plan.dispatch) return [{ json: { skip: true, reason: 'not a dispatch' } }];
const n = (Number(plan.watch_n) || 0) + 1;
if (n > IX.CFG.watch_max) return [{ json: { skip: true, reason: 'the day was watched ' + IX.CFG.watch_max + ' times; tomorrow\'s dispatch takes the websites left first' } }];
const today = S(plan.today) || new Date().toISOString().slice(0, 10);
return [{ json: { trigger: 'ix_watch', ix_watch: { date: today, n, after: 'started' }, wait_minutes: IX.CFG.watch_minutes } }];
