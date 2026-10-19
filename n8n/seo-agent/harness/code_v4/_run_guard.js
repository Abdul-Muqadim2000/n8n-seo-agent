// harness shim (written by build_v4.py section 64, B-A9): the concurrency gate every scheduled run and every API run passes.
// { call: 'gate' | 'isStale' | 'heavyBusy' | 'live' | 'tables', ... }
// ---- B-A9 (2026-10-15, build section 64): the ten schedules go through the same gate the API runs use ----
// Every run started through the API passes *Rate Limit*: it reserves a seo_run_ledger row, counts the rows with a lower id, drops the stale
// ones, refuses a second heavy crawl of a site that is already being crawled, and refuses a run the DataForSEO account cannot pay for.
// The ten scheduled workflows reserved a row (R17 put that on the main path) and then checked **nothing**: a monitor could never be refused
// for concurrency, however much was already running. That is not theoretical — P34-5 exists because two 200-page audits of the same site,
// started two seconds apart, stalled the JavaScript task runner and were both cancelled at the 90-minute execution timeout; run one after
// the other they finished in 4 and 11 minutes.
//
// This kit is the shared half of that gate: the clauses that are about *what else is running*, in one place, used by the resume node of
// every scheduled workflow and by *Rate Limit* itself for its stale rule and its heavy-crawl rule, so the two can never drift (INVARIANTS
// rule 2 — a gate applied in one place is a gate that does not exist in the other).
//
// What it deliberately does NOT do: it never refuses a scheduled run for the Claude or DataForSEO BUDGET. The owner's position is that cost
// is not the constraint, the result is, and the weekly loop is the product — a budget refusal would silently cost a customer their week. The
// account balance is different: a run that runs out of credit half way through delivers half a report and charges for all of it, so an
// account that cannot cover the reservation refuses the run, exactly as it does on the API side.
const RG = (() => {
  const STALE_HOURS = 2;        // identical to Rate Limit's `run_stale_hours` default: a reservation older than this was a crashed run
  const MAX_OPEN = 3;           // other live reservations a scheduled run tolerates beside its own
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const ms = (v) => { const t = Date.parse(S(v)); return Number.isFinite(t) && t > 0 ? t : 0; };
  const yesNo = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));

  // P34-5's rule, in one place: a reservation that never settled must not hold anything for ever. `stale` is what *Release Stale Runs*
  // writes; a row still `reserved` past the window counts as stale whether that update got through or not.
  const isStale = (r, nowMs, hours) => {
    const st = S(r && r.status);
    if (st === 'stale') return true;
    const h = n0(hours) > 0 ? n0(hours) : STALE_HOURS;
    const t = ms(r && r.created_at);
    return st === 'reserved' && t > 0 && t < (nowMs || Date.now()) - h * 3600000;
  };
  // R77 (2026-10-16, re-rating C-1): the run that STARTED this one. An on-demand monitor is spawned by the main workflow's front door, whose
  // own ledger row carries the same `mode` and is still `reserved` while the child reads the ledger (exec 622 -> 624: the app's backlinks
  // request was refused by its own parent, 0.6 s after the AI visibility pair 620 -> 623 slipped through on timing alone). The child knows
  // its parent by identity: the front door passes `parent_run_id` (its own execution id) and the child's row stores it in its key
  // (`parent:<id>`). A parent is never "another run in flight" — it handed this run its work — but a genuine twin with any other id still is.
  const parentOf = (row) => { const m = /^parent:(.+)$/.exec(S(row && row.key)); return m ? S(m[1]) : ''; };
  // the runs that are genuinely in flight right now, mine (and the run that started mine) excluded
  const liveRuns = (rows, o) => {
    const c = o || {}, nowMs = ms(c.now) || Date.now(), myId = n0(c.my_id), myRun = S(c.run_id), parent = S(c.parent_run_id);
    return (rows || []).filter(r => r && !r.error && S(r.run_id)
      && S(r.mode) !== 'assess' && S(r.status) === 'reserved' && !isStale(r, nowMs, c.stale_hours)
      && (myId > 0 ? n0(r.id) < myId : S(r.run_id) !== myRun)   // row order decides ties, exactly as Rate Limit resolves them
      && S(r.run_id) !== myRun
      && !(parent && S(r.run_id) === parent));
  };
  // P34-5: a second heavy crawl of the same site while one is running
  const heavyBusy = (rows, o) => {
    const c = o || {}, dom = S(c.domain).toLowerCase();
    if (!dom || !yesNo(c.heavy)) return null;
    return liveRuns(rows, c).find(r => yesNo(r.heavy) && S(r.domain).toLowerCase() === dom) || null;
  };

  // R94 follow-up (2026-10-16): did the schedule catch-up already run this slot? `records` are seo_cache rows (key, value as JSON text),
  // `due` the slot's ISO time. A record whose start FAILED does not count (the planner tries it again); any other status does, exactly as
  // the planner reads it (_catchup.js: a record that is not start_failed / refused is `caught_up`).
  const caughtUp = (o) => {
    const c = o || {}, wf = S(c.workflow_id), due = S(c.due);
    if (!wf || !due) return null;
    const key = 'catchup:' + wf + ':' + due;
    const row = (c.records || []).find(r => r && S(r.key) === key);
    if (!row) return null;
    let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    v = v && typeof v === 'object' ? v : {};
    if (S(v.status) === 'start_failed') return null;
    return { key, due, started_at: S(v.started_at), status: S(v.status), entry: S(v.entry) };
  };

  const at = (r) => S(r && r.created_at).slice(11, 16);
  const host = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
  // 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §2.2 item 2 / §4.8): the twin rule is PER WEBSITE for a run that names one. With one Monday for
  // everyone, a run of a monitor was a run over every site, so "the same monitor is still running" was the whole rule. With a 7-day cycle per
  // website, two websites' AI Visibility runs are not twins and must not refuse each other; the same website twice still is. A run that names
  // no website (the daily batch AI Pulse and Page Watch, a manual start over every site) keeps the mode-only rule, and a live run that names
  // none (a batch run, which covers every site) is still the twin of any run of its mode.
  const sameSite = (r, site) => !site || !host(r && r.domain) || host(r && r.domain) === site;

  // the gate a scheduled run passes. `mine` is the row this run just reserved (its id breaks ties).
  const gate = (o) => {
    const c = o || {}, rows = c.rows || [], mine = c.mine || {};
    const nowMs = ms(c.now) || Date.now();
    const mode = S(c.mode) || S(mine.mode);
    const where = S(c.where) || mode;
    const site = host(c.site);              // '' = a run over every site (the mode-only rule)
    const cycle = c.cycle === true;         // a job of a website's weekly cycle: the Cycle Dispatcher retries a capacity refusal
    const parent_run_id = S(c.parent_run_id) || parentOf(mine);
    const ctx = { now: new Date(nowMs).toISOString(), my_id: n0(mine.id), run_id: S(c.run_id) || S(mine.run_id), stale_hours: c.stale_hours, parent_run_id };
    const live = liveRuns(rows, ctx);
    const stale = (rows || []).filter(r => r && !r.error && isStale(r, nowMs, c.stale_hours)).length;
    const max_open = n0(c.max_open) > 0 ? n0(c.max_open) : MAX_OPEN;
    const parentOpen = !!parent_run_id && (rows || []).some(r => r && S(r.run_id) === parent_run_id && S(r.status) === 'reserved');
    const basis = live.length + ' other run(s) in flight (' + (live.map(r => S(r.mode) + ' ' + at(r)).join(', ') || 'none') + ')'
      + (stale ? ', ' + stale + ' stale reservation(s) ignored' : '')
      + (parentOpen ? ', the run that started this one (execution ' + parent_run_id + ') not counted' : '') + '; the limit is ' + max_open;
    const refuse = (reason, detail) => ({ allowed: false, reason, refusal: detail, open_runs: live.length, open: live.map(r => ({ mode: S(r.mode), run_id: S(r.run_id), at: at(r) })),
      stale_ignored: stale, max_open, mode, where, basis, checked_at: ctx.now, parent_run_id, site,
      // a capacity refusal of a cycle job is not a lost week: the dispatcher starts it again at its next sweep, without spending an attempt
      retry: cycle && ['same_mode', 'heavy_busy', 'too_many_open'].includes(reason) });
    const RETRY = ' The website\'s weekly cycle starts it again in a few minutes, once the other run has finished; nothing of its week is lost.';

    // 0. R94 follow-up: this is the delayed timer of a slot the catch-up already ran - the week would run twice.
    if (c.caught_up) return refuse('caught_up', 'The catch-up already ran this scheduled slot (due ' + S(c.caught_up.due) + ', started ' + (S(c.caught_up.started_at) || 'earlier')
      + '), so this late fire of the same schedule was not run a second time. Nothing was charged and nothing was started.');

    // 1. the same monitor is still running. A weekly check that overlaps its own previous run reads the same tables twice, writes the same
    //    rows twice and bills the same APIs twice; the one still going is the one with the data.
    //    2026-10-19: of the same WEBSITE when this run names one (sameSite).
    const twin = live.find(r => S(r.mode) === mode && mode && sameSite(r, site));
    if (twin) return refuse('same_mode', 'The previous ' + mode.replace(/_/g, ' ') + ' run' + (site ? ' for ' + site : '') + ' (execution ' + S(twin.run_id) + ', started '
      + (at(twin) || 'earlier') + ' UTC) is still going. Nothing was charged and nothing was started: this run would have read the same data and written the same rows twice.' + (cycle ? RETRY : ''));

    // 2. P34-5, shared with Rate Limit: one heavy crawl of a site at a time.
    const busy = heavyBusy(rows, { ...ctx, domain: S(c.domain) || S(mine.domain), heavy: c.heavy != null ? c.heavy : mine.heavy });
    if (busy) return refuse('heavy_busy', 'A large audit of ' + (S(c.domain) || S(mine.domain)).toLowerCase() + ' is already running (execution '
      + S(busy.run_id) + ', started ' + (at(busy) || 'earlier') + ' UTC). Two big crawls of the same website at once overload the crawler and both time out, so this one was not started.' + (cycle ? RETRY : ''));

    // 3. too much in flight at once.
    //    2026-10-19: a cycle job is not skipped - the Cycle Dispatcher retries it (only a run with no dispatcher behind it waits for its next turn)
    if (live.length >= max_open) return refuse('too_many_open', 'There are already ' + live.length + ' analyses running (the limit is '
      + max_open + '). Nothing was charged and nothing was started: ' + (cycle ? 'this job of ' + (site || 'the website') + '\'s weekly cycle is retried by the dispatcher in a few minutes, so its week is not lost.'
        : 'this scheduled run is skipped and the next one goes ahead as usual.'));

    // 4. the account is the one cap nobody can argue with. Fail OPEN: a probe that did not answer is 0 and refuses nothing.
    const bal = n0(c.balance_usd != null ? c.balance_usd : mine.dfs_balance);
    const need = n0(c.dfs_est_usd != null ? c.dfs_est_usd : mine.dfs_est_usd);
    const floor = n0(c.balance_floor_usd);
    if (bal > 0 && need > 0 && bal - need < floor) return refuse('account_low', 'The search-data account is too low for this run ($'
      + bal.toFixed(2) + ' left; it needs about $' + need.toFixed(2) + (floor > 0 ? ' and $' + floor.toFixed(2) + ' has to stay for the other scheduled checks' : '')
      + '). Nothing was charged and nothing was started: a run that runs out of data credit half way through delivers half a report.');

    return { allowed: true, reason: 'ok', refusal: '', open_runs: live.length, open: live.map(r => ({ mode: S(r.mode), run_id: S(r.run_id), at: at(r) })),
      stale_ignored: stale, max_open, mode, where, basis, checked_at: ctx.now, parent_run_id, site, retry: false };
  };

  return { gate, liveRuns, heavyBusy, isStale, parentOf, caughtUp, sameSite, STALE_HOURS, MAX_OPEN };
})();
return $input.all().map(i => { const j = i.json || {}; const fn = String(j.call || '');
  if (fn === 'gate') return { json: RG.gate(j.args || {}) };
  if (fn === 'isStale') return { json: { stale: RG.isStale(j.row || {}, Date.parse(j.now) || Date.now(), j.stale_hours) } };
  if (fn === 'heavyBusy') return { json: { busy: RG.heavyBusy(j.rows || [], j.args || {}) } };
  if (fn === 'live') return { json: { live: RG.liveRuns(j.rows || [], j.args || {}).map(r => r.run_id) } };
  return { json: { STALE_HOURS: RG.STALE_HOURS, MAX_OPEN: RG.MAX_OPEN } };
});
