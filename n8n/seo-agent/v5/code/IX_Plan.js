// Index coverage (2026-10-29, docs/indexing-2026-10-29/DESIGN.md; fix wave 1, FIX_CONTRACT.md decision 1): what THIS execution does.
// One execution per website (X1 / E6): a run that held every site in one execution timed out past ~6 sites, saved nothing, and the catch-up
// replayed it, re-spending the cap. Three ways in:
//  * the DISPATCH (the daily schedule, the catch-up, or a Manual Run that names no website): the tracked websites whose index watch is on,
//    oldest checked first, minus the ones already checked today. It inspects nothing itself: it reads Google's news once and starts the
//    first website's own execution; each website's execution saves its rows and then starts the next one (`ix_chain`), so one website runs
//    at a time (plus the dispatch's few seconds: at most two at once) and each holds one run-guard slot.
//  * a CHAIN PART (`ix_chain` + `site_id` on the trigger): one website of today's chain, with the scheduled rules (Mondays, drop-outs, news).
//  * ON DEMAND (`domain` or `site_id`, no chain): one website now; its callback is always sent.
// The daily cap is the site's own (index_daily_cap, empty = 300, kept 20-1,200) minus what TODAY's runs of it already inspected or reserved
// (seo_index_runs: every run writes its reservation row BEFORE inspecting, so a crashed or replayed run counts what it may have spent).
// A run that hit Google's DAILY quota earlier today inspects nothing more today. Free: no paid API, no model.
// Fix wave 2 (N5 / N9): which websites are DONE today is read from today's seo_index_runs rows: a final run row (not a reservation), or two
// runs of the day that never finished (their reservations stand; the website is left for tomorrow, so one website that always crashes cannot
// hold the chain). A website whose only row today is the reservation of a run that crashed is not done: the next dispatch takes it again
// (inside the cap, which counts that reservation). The dispatch also runs as the day's WATCH (`ix_watch`, started 50 minutes after each
// dispatch by the dispatch itself): it restarts the chain for the websites not done yet - a chain that broke on a crash, a time-out, an n8n
// restart or a refused part goes on within the hour. A watch of another day does nothing. A chain part skips a website already done today
// (N9: a second dispatch while a chain is in flight never reads a website twice).
// Fix wave 3 (R2): every website part writes an ATTEMPT row (Index Attempt -> Save Index Attempt, an unfinished-run row: `sitemaps_json`
// `{ reservation: true, attempt: true }`, nothing inspected) as soon as the run guard lets it in, BEFORE the sitemap rounds and Search
// Analytics; the reservation and the final row replace it (same site_id + run_at). So a run that dies early (a Code node error in the sitemap
// rounds, a runner task killed, the 3,600 s limit) is counted like one that died after its reservation: two unfinished runs today = left for
// tomorrow (IX.CFG.gave_up_after), never restarted by each of the day's 30 watches. An attempt row is never the run before this one (E3).
// Fix wave 3 (R8): a chain part whose website was already checked today BY ANOTHER CHAIN (the final row carries the other dispatch's id in
// sitemaps_json.chain_id) stops its own chain there (`stop_chain`): two chains that met (a watch that started while a refused part was
// waiting to restart) become one again instead of walking the same list side by side.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) { trigger = {}; }
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const now = Date.now(); const today = new Date(now).toISOString().slice(0, 10); const run_at = new Date(now).toISOString();
const sites = rowsOf('Load Sites (Index)').filter(r => r.site_id && r.domain);
const mons = rowsOf('Load Monitors (Index)');
const runs = rowsOf('Load Index Runs').filter(r => r.site_id);
const chain = trigger.ix_chain && typeof trigger.ix_chain === 'object' ? trigger.ix_chain : null;
const want = normD(trigger.domain) || S(trigger.site_id);
const on_demand = !!want && !chain;
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const runsOf = (sid) => runs.filter(r => S(r.site_id) === sid).sort((a, b) => S(b.run_at).localeCompare(S(a.run_at)));
const json = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || '{}') || {}; } catch (e) { return {}; } };
const monOf = (s) => mons.find(x => S(x.site_id) === S(s.site_id)) || {};
const live = (s) => !/^(paused|deleted|inactive)$/i.test(S(s.status));
const isReservation = (r) => json(r.sitemaps_json).reservation === true;
const isAttempt = (r) => json(r.sitemaps_json).attempt === true;   // R2: written at the start of a part, before anything else could fail
const chainOf = (r) => S(json(r.sitemaps_json).chain_id);
const todayOf = (sid) => runsOf(sid).filter(r => S(r.run_at).slice(0, 10) === today);
const doneToday = (sid) => { const t = todayOf(sid); return t.some(r => !isReservation(r)) || t.filter(isReservation).length >= IX.CFG.gave_up_after; };
const watch = trigger.ix_watch && typeof trigger.ix_watch === 'object' ? trigger.ix_watch : null;

// ---- the dispatch: today's chain of websites ----
if (!want && !chain) {
  const wn = watch ? (Number(watch.n) || 0) : 0;
  if (watch && S(watch.date) !== today) return [{ json: { nothing_to_do: true, skip: true, reason: 'the watch of ' + S(watch.date) + ' ends with its day; today\'s dispatch checks the websites', watch_n: wn } }];
  const seen = new Set(); const list = []; const served = [];
  for (const s of sites) {
    const d = normD(s.domain); if (!d || seen.has(d)) continue; seen.add(d);
    if (!live(s) || !flag(monOf(s).index_watch, true)) continue;
    const mine = runsOf(S(s.site_id));
    if (doneToday(S(s.site_id))) { served.push(d); continue; }   // N5: done today (a final row, or two runs that never finished): a replay adds nothing
    list.push({ site_id: S(s.site_id), domain: d, last: S((mine.find(r => !isReservation(r)) || mine[0] || {}).run_at), retry: todayOf(S(s.site_id)).length > 0 });
  }
  // oldest check first (a chain broken yesterday goes first today); a website whose run of today did not finish goes last, and a watch
  // starts the list one place further each time, so a website that always breaks the chain never holds the others back
  list.sort((a, b) => (a.retry - b.retry) || a.last.localeCompare(b.last) || a.domain.localeCompare(b.domain));
  const fresh = list.filter(x => !x.retry);
  if (wn && fresh.length > 1) { const k = wn % fresh.length; fresh.push(...fresh.splice(0, k)); list.splice(0, fresh.length, ...fresh); }
  if (!list.length) return [{ json: { nothing_to_do: true, skip: true, reason: served.length ? 'every tracked website with the index watch on was already checked today (' + served.length + ')' : 'no tracked website has the index watch on', sites: sites.length, watch_n: wn } }];
  return [{ json: { dispatch: true, chain: list.map(x => x.site_id), domains: list.map(x => x.domain), served_today: served, run_at, trigger: S(trigger.trigger), today, watch_n: wn } }];
}

// ---- one website: a chain part or an on-demand run ----
const s = sites.find(x => normD(x.domain) === want || S(x.site_id) === want) || null;
const why = !s ? 'no tracked website matches "' + want + '"' : (chain && !live(s)) ? normD(s.domain) + ' is paused' : (chain && !flag(monOf(s).index_watch, true)) ? 'the index watch of ' + normD(s.domain) + ' is off'
  : (chain && doneToday(S(s.site_id))) ? normD(s.domain) + ' was already checked today' : '';   // N9: a chain part never reads a website twice in a day
// R8: the website was checked today by ANOTHER chain (its final row names another dispatch): that chain is alive and walks the same list, so this one stops
const myChain = chain ? S(chain.dispatch_id) : '';
const otherChain = !!(s && chain && myChain && todayOf(S(s.site_id)).some(r => !isReservation(r) && chainOf(r) && chainOf(r) !== myChain));
if (why) return [{ json: { nothing_to_do: true, skip: true, reason: why + (otherChain ? ' by another chain of today: this chain stops here' : ''), chain_part: chain ? (Number(chain.part) || 1) : 0, ...(otherChain ? { stop_chain: true } : {}) } }];
const m = monOf(s);
const sid = S(s.site_id);
const cap = IX.capOf(trigger.cap !== undefined && on_demand ? trigger.cap : m.index_daily_cap);
const mine = runsOf(sid);
const todays = mine.filter(r => S(r.run_at).slice(0, 10) === today);
const used_today = todays.reduce((t, r) => t + (Number(r.inspected) || 0), 0);
const quota_hit = todays.some(r => /daily URL Inspection quota/i.test(S(r.note)));
// E3: the run before this one, and whether it read the sitemap tree completely (a page first seen in a sitemap is `new` only after such a run)
const prev = mine.find(r => S(r.run_at) < run_at && !isAttempt(r)) || null;   // R2: an attempt row that never got further says nothing of the sitemap tree
const pj = prev ? json(prev.sitemaps_json) : {};
return [{ json: { site_id: sid, domain: normD(s.domain), canonical_host: S(s.canonical_host), gsc_property_hint: S(s.gsc_property),
  callback_url: S(trigger.callback_url) || S(s.callback_url), request_id: S(trigger.request_id) || S(s.request_id), cap, used_today, quota_hit, on_demand,
  index_watch: flag(m.index_watch, true), trigger: S(trigger.trigger), run_at,
  prev_complete: pj.complete === true, prev_complete_at: pj.complete === true ? S(prev.run_at) : '', home_host_prev: S(pj.home_host),
  chain_part: chain ? (Number(chain.part) || 1) : 0, chain_id: myChain } }];
