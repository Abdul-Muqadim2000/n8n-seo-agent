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

  // ---- P1 (2026-11-12, prod review S1-01): page runs take a WRITING SLOT ----
  // On 2026-11-12 the Content Cadence started three page runs of one website within 11 seconds; all three ran into the time limit at
  // 90-100% done and none was delivered. Measured on production: one page alone takes 16.5-21 minutes, two at once 17.8 and 33.2,
  // three at once more than 60 each. Nothing capped them: this gate covered the schedules only, and n8n's own concurrency limit does
  // not count sub-executions. Every page run now takes one of `limit` slots before its first paid node and waits for one otherwise.
  //   limit           pages written at the same time (seo_cache `slots:page` {"limit": n} overrides it; 0 holds every page run)
  //   poll_seconds    how often a waiting run looks again (a Wait of >= 65 s is saved to the database and holds no memory)
  //   max_wait_hours  after this long in line the run gives up, charged nothing
  //   run_hours       a page run's time limit (= STALE_HOURS = the main workflow's executionTimeout, asserted by the build)
  //   page_minutes    what one page takes alone (for the estimate the customer is shown)
  //   handoff_minutes n8n measures a resumed execution's time limit from its ORIGINAL start (read in n8n 2.41.4: wait-tracker.js passes
  //                   the stored startedAt, workflow-runner.js subtracts the time since it, and setRunning keeps the first startedAt), so
  //                   a run may wait inside its own execution only this long; past it, it hands its place in line to a new execution of
  //                   itself (the page then still has run_hours - handoff_minutes of its own limit left: 80 minutes, a page takes 17-33)
  //   max_hops        a backstop on those hand-offs (6 h of waiting needs about 9)
  const PAGE = { limit: 2, poll_seconds: 120, max_wait_hours: 6, run_hours: 2, page_minutes: 20, handoff_minutes: 40, max_hops: 12 };
  const PAGE_KEY = 'slots:page';
  // a page run: the same test as the cost kit's `content` key (CC.keysFor), started through the API door (a form run cannot hand off)
  const isPage = (d) => { const x = d || {}; return S(x.mode) === 'keyword' && yesNo(x.include_content) && !yesNo(x.verdict_only) && yesNo(x.via_webhook) && !S(x.validation_error); };

  // P34-5's rule, in one place: a reservation that never settled must not hold anything for ever. `stale` is what *Release Stale Runs*
  // writes; a row still `reserved` past the window counts as stale whether that update got through or not.
  // P1: a row still `waiting` longer than anyone may wait (max_wait_hours + a quarter of an hour) belongs to a run that is gone.
  const isStale = (r, nowMs, hours) => {
    const st = S(r && r.status);
    if (st === 'stale') return true;
    const h = n0(hours) > 0 ? n0(hours) : STALE_HOURS;
    const t = ms(r && r.created_at);
    if (st === 'waiting') return t > 0 && t < (nowMs || Date.now()) - (PAGE.max_wait_hours + 0.25) * 3600000;
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

  // ---- P1: the writing-slot decision of one page run ----
  // rows: seo_run_ledger rows (the page runs of the last hours); mine: this run's own row (id, run_id, created_at, queued_at). Page rows are
  // inserted `waiting`; the run that is admitted flips its own row to `reserved` with created_at = the moment it was admitted, so every
  // clock that reads created_at (the stale rule, Release Stale Runs, the dispatcher) counts from the start of the writing.
  //   running = page rows `reserved` and not stale (a crashed writer frees its slot after run_hours, or at once through the dispatcher)
  //   ahead   = page rows `waiting`, not stale, that joined the line before mine (queued_at, then row id: a hand-off keeps its place)
  // admit when running + ahead < limit; first in line first (FIFO), and two runs inserted at the same moment can never both take the last
  // slot (the later row counts the earlier one as ahead, whether it is still waiting or already writing). Fails OPEN: with no row of its
  // own or an unreadable ledger the run is admitted and the basis says so (a stuck line is worse than one page too many).
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const WAITER_MARGIN_MIN = 6;
  const waiterAlive = (r, nowMs, handoffMin, pollS) => { const t = ms(r && r.created_at);
    return t > 0 && t >= (nowMs || Date.now()) - ((n0(handoffMin) || PAGE.handoff_minutes) + 2 * (n0(pollS) || PAGE.poll_seconds) / 60 + WAITER_MARGIN_MIN) * 60000; };
  const pageSlot = (o) => {
    const c = o || {}, now = ms(c.now) || Date.now(), mine = c.mine || {};
    const num = (v, d) => (v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
    const limit = (c.limit !== '' && c.limit != null && Number.isFinite(Number(c.limit)) && Number(c.limit) >= 0) ? Math.floor(Number(c.limit)) : PAGE.limit;
    const maxWaitH = num(c.max_wait_hours, PAGE.max_wait_hours), runH = num(c.run_hours, PAGE.run_hours), pageMin = num(c.page_minutes, PAGE.page_minutes);
    const pollS = num(c.poll_seconds, PAGE.poll_seconds), handoffMin = num(c.handoff_minutes, PAGE.handoff_minutes), maxHops = num(c.max_hops, PAGE.max_hops);
    const hops = Math.max(0, Math.floor(n0(c.hops)));
    const myRun = S(mine.run_id) || S(c.run_id), myId = n0(mine.id);
    const queuedOf = (r) => ms(r && r.queued_at) || ms(r && r.created_at);
    const myQ = ms(c.queued_at) || queuedOf(mine) || now;
    const execStart = ms(c.exec_started_at) || ms(mine.created_at) || now;
    const waited = Math.max(0, Math.round((now - myQ) / 60000));
    const execAge = Math.max(0, (now - execStart) / 60000);
    const src = S(c.limit_source) || 'config';
    const base = { limit, limit_source: src, waited_minutes: waited, exec_minutes: Math.round(execAge), hops, max_hops: maxHops, poll_seconds: pollS,
      max_wait_hours: maxWaitH, queued_at: new Date(myQ).toISOString(), checked_at: new Date(now).toISOString() };
    const STARTED = 'A writing slot is free: your page is being written now (about ' + pageMin + ' minutes).';
    if (c.read_failed || !(myId > 0)) return { ...base, slot: 'admit', ahead: 0, running: 0, running_ids: [], ahead_ids: [], eta_minutes: pageMin, fail_open: true,
      basis: 'admitted without a check (fail open): ' + (c.read_failed ? 'the run ledger could not be read' : 'this run has no ledger row of its own') + '; limit ' + limit + ' (' + src + ')',
      note: STARTED, validation_error: '' };
    const pages = (c.rows || []).filter(r => r && !r.error && S(r.run_id) && S(r.run_id) !== myRun && (myId > 0 ? n0(r.id) !== myId : true) && yesNo(r.page));
    const running = pages.filter(r => S(r.status) === 'reserved' && !isStale(r, now, runH));
    const before = (r) => { const q = queuedOf(r); return q < myQ || (q === myQ && n0(r.id) < myId); };
    // review S2 (2026-11-12): a live waiter writes a fresh row at least every handoff_minutes (it hands its wait on), so a `waiting` row older
    // than that plus two looks and a margin belongs to a run that died while in line: it no longer holds anyone back (6 h 15 min was too long:
    // two dead waiters stopped every page until all of them gave up)
    const ahead = pages.filter(r => S(r.status) === 'waiting' && waiterAlive(r, now, handoffMin, pollS) && before(r));
    const admit = limit > 0 && running.length + ahead.length < limit;
    const eta = limit > 0 ? (admit ? pageMin : Math.ceil((ahead.length + 1) / limit) * pageMin + pageMin) : null;
    const giveUp = !admit && (waited >= maxWaitH * 60 || hops >= maxHops);
    const handoff = !admit && !giveUp && execAge + pollS / 60 >= handoffMin;
    const slot = admit ? 'admit' : giveUp ? 'give_up' : handoff ? 'handoff' : 'wait';
    const basis = running.length + ' page run(s) writing (' + (running.map(r => S(r.run_id)).join(', ') || 'none') + '), ' + ahead.length + ' waiting ahead ('
      + (ahead.map(r => S(r.run_id)).join(', ') || 'none') + '); limit ' + limit + ' (' + src + '); waited ' + waited + ' min, this execution ' + Math.round(execAge)
      + ' min old, hand-offs ' + hops + ' -> ' + slot;
    const twoAtATime = limit === 1 ? 'Pages are written one at a time' : 'Pages are written ' + limit + ' at a time';
    const note = admit ? STARTED
      : giveUp ? ''
      : limit === 0 ? 'Page writing is paused. Your page keeps its place in line and starts as soon as writing resumes; if it has not started within ' + plural(maxWaitH, 'hour', 'hours') + ' it is stopped and nothing is charged.'
      : 'Your page is waiting for a writing slot. ' + twoAtATime + ': ' + plural(running.length, 'page is', 'pages are') + ' being written now and '
        + plural(ahead.length, 'is', 'are') + ' ahead of yours. It starts as soon as a slot is free, in about ' + eta + ' minutes. Nothing is charged while it waits.';
    const validation_error = giveUp ? 'No writing slot became free in ' + plural(Math.max(1, Math.round(waited / 60)), 'hour', 'hours') + ' ('
      + plural(running.length + ahead.length, 'page was', 'pages were') + ' ahead of this one). Nothing was charged and nothing was written. Start it again when you like; '
      + 'a page from the weekly plan is picked again in its next cycle.' : '';
    return { ...base, slot, ahead: ahead.length, running: running.length, running_ids: running.map(r => S(r.run_id)), ahead_ids: ahead.map(r => S(r.run_id)),
      eta_minutes: eta, fail_open: false, basis, note, validation_error };
  };
  // P1: a run that continues another execution's place in line. Trusted only when the ledger holds that execution's row, marked
  // `handed_off`, for the same request: a body that merely carries `slot_handoff` (an API caller) proves nothing and skips nothing.
  const handoffOf = (d, rows) => {
    const h = d && d.slot_handoff;
    if (!h || typeof h !== 'object') return null;
    const from = S(h.from_run_id);
    if (!/^\d+$/.test(from) || !S(d.request_id)) return null;
    return (rows || []).find(r => r && !r.error && S(r.run_id) === from && S(r.status) === 'handed_off' && S(r.request_id) === S(d.request_id) && yesNo(r.page)) || null;
  };

  // review S3 / N2 (2026-11-12): after *Take Page Slot* the run reads the ledger once more. Two runs that took the last slot at nearly the same
  // moment (a hand-off keeps an older queued_at, two starts can insert out of order) both see each other's row `reserved` now: of the page
  // rows writing, the first `limit` by ADMISSION order (created_at, set by the take, then row id) keep their slot and a later one steps back to
  // waiting. A run whose own row is not `reserved` (the take did not get through) does not write either: it waits and takes again.
  // Fails open when the ledger cannot be read (the take itself was the best evidence).
  const slotHeld = (o) => {
    const c = o || {}, now = ms(c.now) || Date.now(), myRun = S(c.run_id);
    const limit = (c.limit !== '' && c.limit != null && Number.isFinite(Number(c.limit)) && Number(c.limit) >= 0) ? Math.floor(Number(c.limit)) : PAGE.limit;
    const runH = n0(c.run_hours) > 0 ? n0(c.run_hours) : PAGE.run_hours;
    if (c.read_failed) return { keep: true, rank: 0, writing: 0, limit, basis: 'kept without a check: the run ledger could not be read after the take' };
    const rows = (c.rows || []).filter(r => r && !r.error && S(r.run_id) && yesNo(r.page));
    const mine = rows.find(r => S(r.run_id) === myRun);
    if (!mine || S(mine.status) !== 'reserved') return { keep: false, rank: -1, writing: 0, limit, retake: true,
      basis: 'this run\'s ledger row is ' + (mine ? '`' + S(mine.status) + '`' : 'missing') + ' after the take: it waits and takes the slot again' };
    const writing = rows.filter(r => S(r.status) === 'reserved' && !isStale(r, now, runH))
      .sort((a, b) => (ms(a.created_at) - ms(b.created_at)) || (n0(a.id) - n0(b.id)));
    const rank = writing.findIndex(r => S(r.run_id) === myRun);
    const keep = limit > 0 && rank >= 0 && rank < limit;
    return { keep, rank, writing: writing.length, limit, retake: false,
      basis: writing.length + ' page run(s) writing after the take (' + writing.map(r => S(r.run_id)).join(', ') + '), this run is number ' + (rank + 1) + ' by admission; limit ' + limit + (keep ? ' -> keeps its slot' : ' -> steps back to waiting') };
  };

  return { gate, liveRuns, heavyBusy, isStale, parentOf, caughtUp, sameSite, pageSlot, slotHeld, isPage, handoffOf, waiterAlive, PAGE, PAGE_KEY, STALE_HOURS, MAX_OPEN };
})();
return $input.all().map(i => { const j = i.json || {}; const fn = String(j.call || '');
  if (fn === 'gate') return { json: RG.gate(j.args || {}) };
  if (fn === 'isStale') return { json: { stale: RG.isStale(j.row || {}, Date.parse(j.now) || Date.now(), j.stale_hours) } };
  if (fn === 'heavyBusy') return { json: { busy: RG.heavyBusy(j.rows || [], j.args || {}) } };
  if (fn === 'live') return { json: { live: RG.liveRuns(j.rows || [], j.args || {}).map(r => r.run_id) } };
  return { json: { STALE_HOURS: RG.STALE_HOURS, MAX_OPEN: RG.MAX_OPEN } };
});
