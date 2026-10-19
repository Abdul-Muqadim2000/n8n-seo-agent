// Cycle Dispatcher (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4.6): what every website's cycle needs this sweep. The decision is the pure
// kit CYC (v5/code/_cycle.js, harness scenarios_cycle.js); this node only gathers its evidence - the schedule table (seo_cycles,
// seo_cycle_jobs), each website's own settings (seo_sites, seo_monitors, seo_cadence, its ladders), the run ledger of the last two days
// (a job is done when its row `cycle:<cycle_key>:<job>` settled) and n8n's executions of the runs it started. The room it starts into is
// the run guard's own rule (RG.liveRuns / RG.MAX_OPEN, v5/code/_run_guard.js), so it never starts a run the guard would refuse.
// The switch: seo_cache `cycle:mode` = {"mode":"start"} starts jobs; anything else (no row, {"mode":"plan_only"}, unreadable) only plans
// and reports - the safe default, flipped by the owner at go-live (plan §10 step 8).
// ---- R94 (2026-10-16, build section 98): the schedule catch-up planner. Pure: schedules x time zone x now x evidence -> missed fires ----
// Five of the ten schedules had never fired on their own (21 days to 2026-10-15), the rest fired late. Two mechanisms, both read in
// n8n's own code: a cron fire lives only in memory, and every restart / re-activation re-arms the cron for the NEXT future time, so a
// fire that was due and not yet delivered is thrown away (the 2026-10-12 16:38 deploy restart dropped five Monday runs); and while
// the Mac sleeps the VM's timers do not advance, so a fire is late by the sleep accumulated since the cron was armed.
// This kit decides, for each schedule, whether its latest due fire happened, and if not whether it is certainly LOST (the cron was
// re-armed after the due time: a restart, a deploy, a re-activation) or only LATE (the cron armed before the due time still holds
// it). A lost fire is started once; a late one is left to the schedule unless it is later than CFG.late_hours, because starting it
// AND letting the delayed timer fire would run the week twice.
//
// Evidence of a fire is the workflow's executions with mode `trigger` (n8n public API) - an on-demand run (`integrated`, `webhook`)
// is NOT the week's scheduled run unless CFG.count_on_demand says so (an owner decision) - and the catch-up's own record in seo_cache
// (`catchup:<workflow id>:<due ISO>`), written BEFORE the start, so a restart plus a sweep can never start the same fire twice.
// Nothing here reads the clock, the network or a table: every input is handed in, so the harness can replay 2026-10-12 exactly.
const CU = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const ms = (v) => { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const t = Date.parse(S(v)); return Number.isFinite(t) && t > 0 ? t : 0; };
  const iso = (t) => new Date(t).toISOString();
  const H = 3600000, MIN = 60000;
  const DEFAULTS = {
    // C-1 (re-rating 2026-10-17, High): a missed fire stays due for its whole PERIOD - a Monday run missed on Monday is still the week's
    // run on Thursday, a monthly one all month - until shortly before its next fire (then the next run covers it, and the skip is
    // recorded). Until 2026-10-17 only fires due in the last 36 h (weekly / monthly) or 20 h (daily) were caught up, so a week the Mac
    // slept through was lost for good (the five Monday 2026-10-12 runs were "out_of_window" from Tuesday night on).
    next_gap_hours: { daily: 2, weekly: 12, monthly: 48 },   // a slot whose next fire is this close is left to that fire (recorded, not started)
    grace_minutes: 1,          // a fire due less than this ago may still be on its way
    fired_slack_minutes: 5,    // a trigger execution this long BEFORE the due time still counts (the cron's second, clock skew)
    // C-1: a fire the schedule still holds is started once it is this late. It was 6 h, because starting it AND letting the delayed timer
    // fire would run the week twice; since 2026-10-16 the delayed timer of a slot the catch-up ran is refused by its own run guard
    // (RG.caughtUp -> `caught_up`) and a second start of one workflow by its twin gate, so the six hours protected nothing.
    late_minutes: 30,
    max_starts: 2,             // starts per sweep, spaced by the workflow; the rest wait for the next sweep (every 15 minutes)
    max_attempts: 3,           // a start that failed, was refused, never appeared or was cancelled under a sleeping Mac is tried again, then reported
    refusal_minutes: 20,       // a ledger row of the target's mode refused this soon after our start is our start's refusal
    confirm_minutes: 10,       // a record still "starting" this long after it was written, with no run of the workflow after it, was never started
    stale_plan_minutes: 10,    // a plan older than this when its start comes up is not acted on (the sweep was paused under it)
    count_on_demand: false,    // OWNER DECISION: does an on-demand run after the due time count as the week's scheduled run?
    max_open: 3,               // the run guard's limit (RG.MAX_OPEN); the planner never starts into a refusal it can see
  };
  // C-1: a run n8n stopped before it finished - `crashed` (n8n died under it) or `canceled` (exec 728: the execution time-out, counted in
  // wall-clock time, expired while the Mac slept mid-node) - is not the week's run.
  const DEAD = new Set(['crashed', 'canceled', 'cancelled']);
  // ---- time: a wall-clock time in a time zone -> UTC, with the platform's own tz database (Intl), no library ----
  const fmts = {};
  const fmt = (tz) => fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const parts = (tz, t) => { const o = {}; for (const p of fmt(tz).formatToParts(new Date(t))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second }; };
  const offset = (tz, t) => { const p = parts(tz, t); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000; };
  const zonedToUtc = (tz, y, mo, d, h, mi) => { const guess = Date.UTC(y, mo - 1, d, h, mi); let t = guess - offset(tz, guess);
    const o2 = offset(tz, t); if (guess - o2 !== t) t = guess - o2; return t; };
  // ---- cron: five fields (minute hour day-of-month month day-of-week), lists, ranges and steps; the ten schedules use nothing else ----
  const field = (src, lo, hi) => {
    const s = S(src); if (s === '*' || s === '?') return null;   // null = any
    const out = new Set();
    for (const part of s.split(',')) {
      const m = part.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/); if (!m) throw new Error('cron field "' + s + '" is not understood');
      const a = m[1] === '*' ? lo : +m[1], b = m[2] != null ? +m[2] : (m[1] === '*' || m[3] ? hi : a), st = m[3] ? +m[3] : 1;
      for (let v = a; v <= b; v += st) out.add(v);
    }
    return out;
  };
  const parse = (cron) => {
    const f = S(cron).split(/\s+/); const x = f.length === 6 ? f.slice(1) : f;   // a seconds field is dropped: the slack covers it
    if (x.length !== 5) throw new Error('cron "' + cron + '" does not have five fields');
    const dow = field(x[4], 0, 7); if (dow && dow.has(7)) dow.add(0);
    return { min: field(x[0], 0, 59), hour: field(x[1], 0, 23), dom: field(x[2], 1, 31), mon: field(x[3], 1, 12), dow };
  };
  const listOf = (set, lo, hi) => { const a = []; for (let v = hi; v >= lo; v--) if (!set || set.has(v)) a.push(v); return a; };   // descending
  const dayOk = (c, y, mo, d) => {
    if (c.mon && !c.mon.has(mo)) return false;
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    if (c.dom && c.dow) return c.dom.has(d) || c.dow.has(wd);   // cron's own rule when both are restricted
    if (c.dom) return c.dom.has(d);
    if (c.dow) return c.dow.has(wd);
    return true;
  };
  // the latest fire of `cron` in `tz` at or before `t` (0 when none in the last 62 days)
  const lastDue = (cron, tz, t) => {
    const c = typeof cron === 'string' ? parse(cron) : cron, p = parts(tz, t);
    const hours = listOf(c.hour, 0, 23), mins = listOf(c.min, 0, 59);
    for (let k = 0; k <= 62; k++) {
      const day = new Date(Date.UTC(p.y, p.mo - 1, p.d - k)); const y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, d = day.getUTCDate();
      if (!dayOk(c, y, mo, d)) continue;
      for (const h of hours) for (const mi of mins) { const u = zonedToUtc(tz, y, mo, d, h, mi); if (u <= t) return u; }
    }
    return 0;
  };
  // the first fire of `cron` in `tz` strictly after `t` (0 when none in the next 62 days)
  const nextDue = (cron, tz, t) => {
    const c = typeof cron === 'string' ? parse(cron) : cron, p = parts(tz, t);
    const hours = listOf(c.hour, 0, 23).reverse(), mins = listOf(c.min, 0, 59).reverse();
    for (let k = 0; k <= 62; k++) {
      const day = new Date(Date.UTC(p.y, p.mo - 1, p.d + k)); const y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, d = day.getUTCDate();
      if (!dayOk(c, y, mo, d)) continue;
      for (const h of hours) for (const mi of mins) { const u = zonedToUtc(tz, y, mo, d, h, mi); if (u > t) return u; }
    }
    return 0;
  };
  const dur = (m) => { const a = Math.abs(Math.round(m)); return a < 60 ? a + ' min' : a < 2880 ? Math.floor(a / 60) + ' h' + (a % 60 ? ' ' + (a % 60) + ' min' : '') : Math.round(a / 1440) + ' days'; };
  // C-1: a plan made more than `minutes` ago is not acted on - the VM was paused between the plan and the start (exec 728 sat 44 minutes
  // inside one short Code node), and what it read then (who fired, what is running) may no longer be true.
  const stalePlan = (planNow, now, minutes) => { const a = ms(planNow), b = ms(now) || Date.now(); return !a || b - a > (Number(minutes) || DEFAULTS.stale_plan_minutes) * MIN; };
  const parseValue = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || '{}'); } catch (e) { return {}; } };
  const live = (rows, now, staleH) => (rows || []).filter(r => r && !r.error && S(r.run_id) && S(r.mode) !== 'assess' && S(r.status) === 'reserved'
    && ms(r.created_at) > now - (staleH || 2) * H);

  // o: { schedules, tz, now, entry ('init' | 'sweep' | 'manual'), workflows {id: {ok, active, createdAt, updatedAt, error}},
  //      runs {id: {ok, full, oldest, data: [{id, mode, status, startedAt}], error}}, records [{key, value}], ledger [rows],
  //      instance_started_at, dry_run, plan_only, config, live_runs (optional: the run guard's own count) }
  const plan = (o) => {
    const c = o || {}, cc = c.config || {};
    const cfg = { ...DEFAULTS, ...cc, next_gap_hours: { ...DEFAULTS.next_gap_hours, ...(cc.next_gap_hours || {}) } };
    const now = ms(c.now) || Date.now(), entry = S(c.entry) || 'sweep', dry = c.dry_run === true, prefix = dry ? 'catchup_dry:' : 'catchup:';
    const recs = new Map((c.records || []).filter(r => r && S(r.key)).map(r => [S(r.key), parseValue(r.value)]));
    const armRec = recs.get('catchup:armed') || {}, instRec = recs.get('catchup:instance') || {};
    const armed = ms(armRec.armed_at) || now;   // never before the catch-up first ran on this instance; the first run arms and starts nothing
    const instance = entry === 'init' ? now : ms(c.instance_started_at) || ms(instRec.started_at);
    const ledger = (c.ledger || []).filter(r => r && !r.error);
    const open = c.live_runs != null ? (c.live_runs || []) : live(ledger, now);
    const rows = [], cands = [];
    for (const s of (c.schedules || [])) {
      const row = { workflow_id: s.id, label: s.label, mode: s.mode, cron: s.cron, kind: s.kind, due: '', verdict: '', reason: '' };
      rows.push(row);
      const say = (verdict, reason, extra) => { row.verdict = verdict; row.reason = reason; Object.assign(row, extra || {}); return row; };
      let due = 0, next = 0;
      try { due = lastDue(s.cron, s.tz || c.tz, now); next = due ? nextDue(s.cron, s.tz || c.tz, due) : 0; } catch (e) { say('blind', 'the schedule or its time zone could not be read: ' + S(e.message)); continue; }
      if (!due) { say('not_due', 'no fire due in the last 62 days'); continue; }
      row.due = iso(due); if (next) row.next_due = iso(next);
      // C-1: a slot is the period's run until its next fire (lastDue never returns an older one), so there is no other window: a Monday
      // run missed on Monday is still due on Thursday, the Tuesday-to-Sunday pulse's Sunday slot still due on Monday
      const age = now - due;
      if (age < cfg.grace_minutes * MIN) { say('not_due', 'due ' + Math.round(age / 1000) + ' s ago - it may still be on its way'); continue; }
      const wf = (c.workflows || {})[s.id] || {};
      if (!wf.ok) { say('blind', 'the workflow could not be read (' + (S(wf.error) || 'no answer') + '), so nothing was started'); continue; }
      if (wf.active === false) { say('inactive', 'the workflow is switched off, so its schedule is not expected to fire'); continue; }
      if (ms(wf.createdAt) > due) { say('not_created', 'the workflow did not exist yet when this fire was due'); continue; }
      if (due < armed) { say('before_arm', 'due before the catch-up was first armed (' + iso(armed) + ')'); continue; }
      const run = (c.runs || {})[s.id] || {};
      const key = prefix + s.id + ':' + iso(due), rec = recs.get(key);
      let attempt = 1;
      if (rec) {
        const att = Number(rec.attempts) || 1, st = S(rec.status), at = ms(rec.started_at);
        const mine = ledger.filter(r => S(r.mode) === s.mode && ms(r.created_at) >= at - 5000 && ms(r.created_at) <= at + cfg.refusal_minutes * MIN);
        const refused = mine.length > 0 && mine.every(r => S(r.status) === 'refused');
        // C-1: the record says what the catch-up meant to do; the workflow's executions say what happened. The run the catch-up started is
        // the first non-schedule execution of the workflow in the minutes after the record (n8n accepted it: `integrated`).
        const own = run.ok ? (run.data || []).filter(x => S(x.mode) !== 'trigger' && ms(x.startedAt) >= at - 5000 && ms(x.startedAt) <= at + cfg.confirm_minutes * MIN)
          .sort((a, b) => ms(a.startedAt) - ms(b.startedAt))[0] : null;
        let retry = '';
        if (st === 'start_failed') retry = 'start failed: ' + S(rec.error);
        else if (refused) retry = 'refused by the workflow\'s own gate';
        else if (own && DEAD.has(S(own.status))) retry = 'the run it started (execution ' + S(own.id) + ') was ' + S(own.status) + ' before it finished - n8n stopped it (a time-out while the computer slept, or a restart)';
        else if (!own && st === 'starting' && run.ok && now - at > cfg.confirm_minutes * MIN && !(run.full && ms(run.oldest) > at))
          retry = 'the sweep stopped between recording this fire and starting it (no run of the workflow appeared after ' + S(rec.started_at) + ')';
        if (retry) {
          if (att >= cfg.max_attempts) { say('gave_up', 'the catch-up ' + retry + ' - ' + att + ' attempt(s), no more'); continue; }
          attempt = att + 1; row.retry_of = retry;
        } else if (st === 'starting' && !own) {
          say('starting', 'claimed by a catch-up sweep at ' + S(rec.started_at) + (S(rec.claim) ? ' (execution ' + S(rec.claim) + ')' : '') + ' and not confirmed yet - looked at again next sweep', { key }); continue;
        } else { say('caught_up', 'already started by the catch-up at ' + S(rec.started_at) + ' (' + (S(rec.entry) || 'catch-up') + (own ? ', execution ' + S(own.id) + ' ' + S(own.status) : '') + ')', { key }); continue; }
      }
      if (!run.ok) { say('blind', 'its executions could not be read (' + (S(run.error) || 'no answer') + '), so nothing was started'); continue; }
      const after = (run.data || []).filter(x => ms(x.startedAt) >= due - cfg.fired_slack_minutes * MIN);
      const fire = after.filter(x => S(x.mode) === 'trigger' && !DEAD.has(S(x.status))).sort((a, b) => ms(a.startedAt) - ms(b.startedAt))[0];
      if (fire) { const late = Math.round((ms(fire.startedAt) - due) / MIN); say('fired', late > 5 ? 'fired ' + late + ' min late (execution ' + S(fire.id) + ')' : 'fired on time (execution ' + S(fire.id) + ')', { fired_at: S(fire.startedAt), late_min: Math.max(0, late) }); continue; }
      const other = after.filter(x => S(x.mode) !== 'trigger' && S(x.mode) !== 'manual');
      if (cfg.count_on_demand && other.length) { say('fired', 'an on-demand run counted as the scheduled one (execution ' + S(other[0].id) + ')'); continue; }
      if (run.full && ms(run.oldest) >= due - cfg.fired_slack_minutes * MIN) { say('blind', 'more executions since the due time than one page reads, so a fire could not be ruled out'); continue; }
      const dead = after.filter(x => S(x.mode) === 'trigger' && DEAD.has(S(x.status)))[0];
      // lost or late: the cron of this workflow was (re)armed at the later of the instance start and its last publish
      const armedW = entry === 'init' ? now : Math.max(instance || 0, ms(wf.updatedAt));
      const lost = due < armedW || !!dead;
      const why = dead ? 'the scheduled run (execution ' + S(dead.id) + ') was ' + S(dead.status) + ' before it finished - n8n stopped it (a time-out while the computer slept, or a restart)'
        : entry === 'init' ? 'n8n restarted after it was due, which re-arms every schedule for its next time'
        : lost ? 'the schedule was re-armed at ' + iso(armedW) + ', after it was due (a restart or a re-publish), so it will not fire'
        : 'it is ' + dur(age / MIN) + ' late and the schedule has not fired it (the computer was asleep)';
      if (!lost && age < cfg.late_minutes * MIN) { say('late_pending', 'the schedule still holds this fire (armed ' + (armedW ? iso(armedW) : 'before it was due') + '), it is ' + Math.round(age / MIN) + ' min late; it is left to the schedule until ' + cfg.late_minutes + ' min late (a delayed fire after the catch-up started it is refused by the workflow\'s own gate)'); continue; }
      // C-1: a slot whose next fire is close is left to that fire - a week is not run twice in a few hours; the skip is recorded
      const gap = (cfg.next_gap_hours[s.kind] || 0) * H;
      if (next && next - now < gap) { say('superseded', 'missed (' + why + '), but the next run is due ' + iso(next) + ', in ' + dur((next - now) / MIN) + ', so that run covers it and this one is skipped', { attempt }); continue; }
      const twin = open.find(r => S(r.mode) === s.mode);
      if (twin) { say('running', 'a ' + s.mode.replace(/_/g, ' ') + ' run is in flight now (execution ' + S(twin.run_id) + ') - it may be this fire, late; looked at again next sweep'); continue; }
      say('missed', why, { key, attempt, late_min: Math.round(age / MIN) });
      cands.push({ row, s, due, key, attempt, why });
    }
    // capacity: the run guard refuses a run when max_open others are live, so the planner never starts more than it can see room for
    cands.sort((a, b) => a.due - b.due);
    const room = Math.max(0, cfg.max_open - open.length), take = Math.min(cfg.max_starts, room);
    const start = [];
    for (const k of cands) {
      if (dry && !k.s.dry_run_ok) { k.row.verdict = 'dry_run_skipped'; k.row.reason = 'missed (' + k.why + ') - a dry run starts only the workflows with a dry-run switch'; continue; }
      if (start.length >= take) { k.row.verdict = 'missed_waiting'; k.row.reason = 'missed (' + k.why + ') - waits for the next sweep: ' + open.length + ' run(s) in flight, ' + take + ' start(s) this sweep'; continue; }
      if (c.plan_only) { k.row.verdict = 'missed_plan_only'; continue; }
      k.row.verdict = 'start';
      start.push({ workflow_id: k.s.id, label: k.s.label, mode: k.s.mode, entry_node: k.s.entry_node, scheduled_for: iso(k.due), key: k.key, attempt: k.attempt,
        why: k.why, entry, dry_run: dry, retry_of: k.row.retry_of || '', late_min: Math.round((now - k.due) / MIN), plan_now: iso(now) });
    }
    const counts = rows.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m; }, {});
    const blind = rows.filter(r => r.verdict === 'blind').length;
    return { entry, now: iso(now), tz: c.tz, armed_at: iso(armed), arm_new: !ms(armRec.armed_at), instance_started_at: instance ? iso(instance) : '',
      dry_run: dry, plan_only: !!c.plan_only, open_runs: open.length, max_open: cfg.max_open, room, rows, start, counts, blind,
      basis: rows.length + ' schedule(s) read; ' + start.length + ' start(s), ' + (counts.late_pending || 0) + ' late but still held by the schedule, '
        + (counts.starting || 0) + ' being started by another sweep, ' + blind + ' could not be read' };
  };
  // ---- C-1 (c): a run that ran late says so. Used by every scheduled workflow's callback (Callback Ledger), whichever door it came in by:
  // started by the catch-up (`trigger: 'catchup'`, `scheduled_for`, `why`) or fired by its own schedule after a sleep (the trigger's
  // timestamp, against the slot it belongs to). `late` only past `threshold_min`; the text names the slot in the schedule's time zone.
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const wall = (tz, t) => { const p = parts(tz, t), pad = (n) => String(n).padStart(2, '0');
    return WD[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()] + ' ' + p.d + ' ' + MO[p.mo - 1] + ' ' + p.y + ', ' + pad(p.h) + ':' + pad(p.mi) + ' (' + tz + ')'; };
  // 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.5): a job of a website's weekly cycle (`trigger: 'cycle'`, the Cycle Dispatcher) is late against
  // its cycle's due time (`scheduled_for`). Its jobs run one after the other (about 40-60 minutes for a whole cycle), so a cycle job is called
  // late only past CYCLE_LATE_MIN, not the 30 minutes a fixed slot allows; its words name the cycle, not a schedule.
  const CYCLE_LATE_MIN = 180;
  const lateRun = (o) => {
    const c = o || {}, tz = S(c.tz) || 'America/New_York';
    const via = S(c.trigger) === 'catchup' ? 'catchup' : S(c.trigger) === 'cycle' ? 'cycle' : S(c.fired_at) ? 'schedule' : '';
    if (!via) return { late: false, via: 'on_demand' };
    const thr = Number(c.threshold_min) > 0 ? Number(c.threshold_min) : (via === 'cycle' ? CYCLE_LATE_MIN : 30);
    let due = 0;
    try { due = (via === 'catchup' || via === 'cycle') ? ms(c.scheduled_for) : (c.cron ? lastDue(c.cron, tz, ms(c.fired_at)) : 0); } catch (e) { due = 0; }
    const started = ms(c.started_at) || ms(c.fired_at) || ms(c.now);
    if (!due || !started) return { late: false, via, reason: 'the due time could not be worked out' };
    const late_min = Math.max(0, Math.round((started - due) / MIN));
    const out = { late: late_min > thr, via, due: iso(due), started_at: iso(started), late_min, kind: S(c.kind) };
    if (!out.late) return out;
    const what = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' }[S(c.kind)] || 'scheduled';
    if (via === 'cycle') {
      out.why = S(c.why) || 'the cycle started after its due time (the engine was stopped, restarting or busy with other websites)';
      out.text = 'This is the run of this website\'s weekly cycle that was due ' + wall(tz, due) + '. It ran ' + dur(late_min) + ' late: ' + out.why + '. Its figures are as of when it ran, not as of the due time.';
      return out;
    }
    out.why = via === 'catchup' ? (S(c.why) || 'its scheduled time was missed') + '; the schedule catch-up started it'
      : 'the schedule fired late (the computer running the engine was asleep or restarting at the due time)';
    out.text = 'This is the ' + what + ' run that was due ' + wall(tz, due) + '. It ran ' + dur(late_min) + ' late: ' + out.why + '. Its figures are as of when it ran, not as of the due time.';
    return out;
  };
  // ---- C-16 (re-rating 2026-10-17): the Search Console mail watcher's IMAP trigger drops when the Mac wakes without DNS (2026-10-16 20:47;
  // 2026-10-17 12:22, 12:53, 18:31: "failed at runtime and was deactivated", then n8n's own reactivation fails with ENOTFOUND
  // imap.gmail.com and is never tried again), while the public API still says `active: true`. The flag is not the watcher's state; the
  // Error Handler's record of the drop is. A drop newer than the last time the watcher was (re)armed - the workflow's last publish or the
  // watchdog's last successful re-activation - means it is not listening: deactivate + activate through the public API, which makes n8n
  // open the IMAP connection again (and answer 400 when it cannot). A workflow the OWNER switched off is never touched.
  const WD_DEFAULTS = { retry_minutes: 30, alarm_after: 3, alarm_every: 4 };
  const watchdog = (o) => {
    const c = o || {}, cfg = { ...WD_DEFAULTS, ...(c.config || {}) }, now = ms(c.now) || Date.now(), st = parseValue(c.state || {}), wf = c.wf || {};
    const node = S(c.trigger_node) || 'Mailbox Trigger', name = S(c.workflow_name);
    const drops = (c.alerts || []).filter(a => a && !a.error && (!name || S(a.workflow) === name) && S(a.node) === node
      && /failed at runtime|was deactivated|could not be (re)?activated/i.test(S(a.message))).map(a => ms(a.last_seen_at)).filter(Boolean);
    const lastDrop = drops.length ? Math.max(...drops) : 0;
    const armedAt = Math.max(ms(st.reactivated_at), ms(wf.updatedAt));
    const base = { last_drop: lastDrop ? iso(lastDrop) : '', armed_at: armedAt ? iso(armedAt) : '', failures: Number(st.failures) || 0 };
    if (!wf.ok) return { ...base, action: 'none', verdict: 'blind', reason: 'the mail watcher\'s workflow could not be read (' + (S(wf.error) || 'no answer') + '), so nothing was done' };
    if (wf.active === false && !st.left_inactive) return { ...base, action: 'none', verdict: 'off', reason: 'the mail watcher is switched off (not by the watchdog), so it was not touched' };
    const recent = ms(st.last_try_at) && now - ms(st.last_try_at) < cfg.retry_minutes * MIN;
    if (wf.active === false) return recent ? { ...base, action: 'none', verdict: 'waiting', reason: 'left switched off by a failed re-activation at ' + S(st.last_try_at) + '; tried again after ' + cfg.retry_minutes + ' min' }
      : { ...base, action: 'activate', verdict: 'reactivate', reason: 'the watchdog\'s last re-activation failed (' + (S(st.last_error) || 'no reason') + ') and left it off: switching it on again' };
    if (lastDrop && lastDrop > armedAt) return recent ? { ...base, action: 'none', verdict: 'waiting', reason: 'dropped at ' + iso(lastDrop) + '; the last re-activation was tried at ' + S(st.last_try_at) + ', tried again after ' + cfg.retry_minutes + ' min' }
      : { ...base, action: 'reactivate', verdict: 'reactivate', reason: 'the IMAP trigger dropped at ' + iso(lastDrop) + ' (Error Handler record) and nothing has re-armed it since ' + (armedAt ? iso(armedAt) : 'it was published') + ' - the API\'s "active" flag does not say it is listening' };
    return { ...base, action: 'none', verdict: 'listening', reason: lastDrop ? 'last drop ' + iso(lastDrop) + ', re-armed at ' + iso(armedAt) : 'no drop on record since it was published' };
  };
  // what the re-activation did, as the next state of the watchdog's record (seo_cache `catchup:watchdog:<workflow id>`)
  const watchdogResult = (o) => {
    const c = o || {}, cfg = { ...WD_DEFAULTS, ...(c.config || {}) }, now = iso(ms(c.now) || Date.now()), st = parseValue(c.state || {}), d = c.decision || {};
    const code = (r) => Number(r && r.statusCode) || 0, bodyOf = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (e) { return {}; } };
    const errOf = (r) => { const b = bodyOf(r); return S(b.message || (r && r.error && (r.error.message || r.error)) || (code(r) ? 'HTTP ' + code(r) : 'no answer')).slice(0, 240); };
    const off = c.deactivate || null, on = c.activate || null;
    const offOk = !off || code(off) === 200, onOk = code(on) === 200 && bodyOf(on).active !== false;
    if (onOk) return { reactivated_at: now, failures: 0, left_inactive: false, last_try_at: now, last_result: 'listening again: re-activated through the public API (HTTP 200)', last_error: '', last_drop: S(d.last_drop), alarm: false };
    const failures = (Number(st.failures) || 0) + 1;
    const err = !offOk ? 'deactivate: ' + errOf(off) : 'activate: ' + errOf(on);
    return { reactivated_at: S(st.reactivated_at), failures, left_inactive: !!(off && offOk) || !!st.left_inactive, last_try_at: now, last_error: err, last_drop: S(d.last_drop),
      last_result: 'not listening: the re-activation failed (' + err + ') - attempt ' + failures,
      alarm: failures >= cfg.alarm_after && (failures - cfg.alarm_after) % cfg.alarm_every === 0 };
  };
  return { plan, lastDue, nextDue, parse, zonedToUtc, offset, stalePlan, lateRun, wall, dur, watchdog, watchdogResult, DEFAULTS, DEAD, WD_DEFAULTS, CYCLE_LATE_MIN };
})();
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
// ---- the per-website 7-day cycle (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4 / §7 / §14; build_cycle.py, build section 140) ----
// Every website gets its own week: cycle 0 starts the moment its tracking does, and every later cycle at 06:00 in the website's own time
// zone on its own weekday. The seven Monday crons are replaced by one table (seo_cycles: a row per website, seo_cycle_jobs: a row per
// website x cycle x job) and one sweep (SEO Agent - Cycle Dispatcher, every 5 minutes) that starts each website's jobs one after the other,
// in today's Monday order. This kit is the whole decision; the dispatcher's nodes only gather its evidence and write what it says.
// It is built from three parts we already trust: Site Kickoff's job list and its "read the site's own settings" rule, the catch-up's
// record-then-start (the job row is written BEFORE the start and read back, so two sweeps racing start a job once), and the run ledger as
// the record of what finished (a job is done when its row `cycle:<cycle_key>:<job>` in seo_run_ledger is settled).
// The four features every mature scheduler has (plan §3.2) are here: a persisted next-fire time (seo_cycles.next_due_at), a bounded
// catch-up that runs the most recent missed cycle once, an overlap policy (one job of a website at a time, capped starts, never into a
// refusal it can see) and an idempotency key per occurrence (the cycle key `cyc:<site_id>:<local due date>`).
// Nothing here reads the clock, the network or a table: every input is handed in, so the harness can replay any date (scenarios_cycle.js).
// Time is the catch-up kit's own (CU.zonedToUtc / CU.offset, built on Intl): the DST rule exists once. Intent is stored (weekday, local
// time, IANA zone) and the UTC instant derived each time; 7 x 24 h is never added to an instant.
const CYC = (() => {
  if (typeof CU === 'undefined' || !CU.zonedToUtc || !CU.offset) throw new Error('CYC needs the catch-up kit (CU) inlined before it: its zonedToUtc / offset are the one DST rule');
  const S = (v) => String(v == null ? '' : v).trim();
  const ms = (v) => { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const t = Date.parse(S(v)); return Number.isFinite(t) && t > 0 ? t : 0; };
  const iso = (t) => new Date(t).toISOString();
  const MIN = 60000, H = 3600000, DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const flag = (x, dflt) => (x === undefined || x === null || x === '') ? dflt : !(x === false || /^(false|0|no|off)$/i.test(String(x)));
  const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\s,;]+/)).map(x => S(x).toLowerCase()).filter(Boolean);
  // ---- the contract: app/shared/src/cycles.ts CYCLE_JOBS, in the same order (harness CY1 and build section 140 compare the two). `mode` is
  // the run ledger mode each workflow reserves under (the run guard's twin check), `heavy` a job that crawls the site.
  const JOBS = [
    { job: 'ai_visibility', workflow_id: 'SEOagentAIVisib1', mode: 'ai_visibility', label: 'AI visibility' },
    { job: 'backlinks', workflow_id: 'SEOagentBacklnk1', mode: 'backlinks', label: 'backlinks' },
    { job: 'rank_tracker', workflow_id: 'SEOagentTracker1', mode: 'rank_tracker', label: 'rank tracking' },
    { job: 'site_tracker', workflow_id: 'SEOagentSiteTrk1', mode: 'site_tracker', label: 'site tracking' },
    { job: 'ai_growth', workflow_id: 'SEOagentAIGrow1', mode: 'ai_growth', label: 'AI growth' },
    { job: 'content_cadence', workflow_id: 'SEOagentCadence1', mode: 'content_cadence', label: 'the content cadence' },
    { job: 'link_builder', workflow_id: 'SEOagentLinkBld1', mode: 'link_builder', label: 'link building' },
    { job: 'audit', workflow_id: 'SEOagentAuditSc1', mode: 'audit_schedule', label: 'the monthly audit', heavy: true },
  ];
  // the "Coming up" plan: the cadence in preview mode, 48 h before every cycle except cycle 0 (plan §5.7)
  const PREVIEW = { job: 'preview', workflow_id: 'SEOagentCadence1', mode: 'content_cadence', label: 'the "Coming up" preview' };
  const BY_JOB = Object.fromEntries([...JOBS, PREVIEW].map(j => [j.job, j]));
  const NAMES = JOBS.map(j => j.job);
  const DEFAULTS = {
    local_time: '06:00',        // cycles n >= 1 start at this local time (decision D1); cycle 0 starts at setup
    spacing_days: 3,            // a cycle is never due fewer than this many local days after the last one started (weekday change, D7)
    next_gap_hours: 12,         // a cycle due less than this before the next one is skipped (and recorded): that one covers it
    preview_hours: 48,          // the "Coming up" preview runs this long before each cycle n >= 1
    preview_min_lead_hours: 6,  // a preview that could not start until this close to its cycle is recorded as skipped (too late to read)
    max_starts: 2,              // starts per sweep (every 5 minutes)
    max_inflight: 2,            // dispatcher jobs starting or running at once, all websites together
    max_attempts: 3,            // a job that failed is started again, three attempts in all, then it gives up and alerts
    refusal_hours: 24,          // a job refused for capacity is retried without spending an attempt, for at most this long
    confirm_minutes: 10,        // a job recorded `starting` with no run of its workflow this long after was never started
    stale_hours: 2,             // the run guard's rule (RG.STALE_HOURS): a reservation older than this never settles - it crashed
    retention_days: 120,        // seo_cycle_jobs rows older than this are deleted
    max_open: 3,                // the run guard's limit (RG.MAX_OPEN): the dispatcher never starts into a refusal it can see
    engine_tz: 'America/New_York',
  };
  const TERMINAL = new Set(['done', 'skipped', 'gave_up']);
  const LIVE = new Set(['starting', 'running']);
  const DEAD = new Set(['crashed', 'canceled', 'cancelled']);
  const CAPACITY = new Set(['same_mode', 'too_many_open', 'heavy_busy']);
  // ---- time: local dates in a website's zone, with the catch-up kit's Intl rule ----
  const validTz = (tz) => { if (!S(tz)) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: S(tz) }).format(0); return true; } catch (e) { return false; } };
  const local = (tz, t) => { const d = new Date(t + CU.offset(tz, t));
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay(),
      date: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) }; };
  const ymd = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S(date)); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; };
  const dateAdd = (date, n) => { const p = ymd(date); const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const weekdayOf = (date) => { const p = ymd(date); return new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay(); };
  const onOrAfter = (date, wd) => dateAdd(date, (wd - weekdayOf(date) + 7) % 7);
  const hhmm = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(S(v)); return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], mi: +m[2], text: pad(+m[1]) + ':' + m[2] } : null; };
  const dueAt = (tz, date, time) => { const p = ymd(date), t = hhmm(time) || hhmm(DEFAULTS.local_time); return CU.zonedToUtc(tz, p.y, p.mo, p.d, t.h, t.mi); };
  const cycleKey = (siteId, date) => 'cyc:' + S(siteId) + ':' + S(date);
  const dateOfKey = (key) => { const m = /^cyc:.+:(\d{4}-\d{2}-\d{2})$/.exec(S(key)); return m ? m[1] : ''; };
  // §14.2: cyc_<site_id without site_>_<YYYYMMDD>_<job> - one id per website, cycle and job (the same on a retry)
  const requestId = (siteId, date, job) => 'cyc_' + S(siteId).replace(/^site_/, '') + '_' + S(date).replace(/-/g, '') + '_' + S(job);
  // the monthly date: the anchor's local day of the month, clamped to 28 so every month has one (plan §4.4)
  const monthlyDayOf = (tz, anchor) => Math.min(28, local(tz, anchor).d);
  // the monthly period a local date falls in: from monthly_day of month M to monthly_day of M+1, named by M ('YYYY-MM')
  const periodKey = (date, mday) => { const p = ymd(date); if (!p) return ''; let y = p.y, mo = p.mo; if (p.d < mday) { mo -= 1; if (mo < 1) { mo = 12; y -= 1; } } return y + '-' + pad(mo); };
  // the first local date on or after (the local date of the last cycle start + spacing) that is the cycle weekday, at the local time
  const nextAfter = (o) => { const c = o || {}, tz = S(c.tz), sp = c.spacing_days != null ? c.spacing_days : DEFAULTS.spacing_days;
    const date = onOrAfter(dateAdd(local(tz, ms(c.last)).date, sp), Number(c.weekday)); return { date, at: dueAt(tz, date, c.local_time) }; };
  // the stored row, read the way the kit uses it: the intent (zone, weekday, local time, monthly day) with its defaults filled in
  const read = (row, engineTz) => {
    const r = row || {}, out = { ok: true, problems: [] };
    out.tz = S(r.tz) || S(engineTz) || DEFAULTS.engine_tz;
    if (!validTz(out.tz)) return { ok: false, reason: 'its time zone "' + out.tz + '" is not one the engine knows' };
    out.anchor = ms(r.anchor_at);
    if (!out.anchor) return { ok: false, reason: 'it has no valid anchor_at (the moment its tracking started)' };
    const A = local(out.tz, out.anchor);
    out.anchor_date = A.date;
    const wd = Number(r.cycle_weekday); out.weekday = r.cycle_weekday !== '' && r.cycle_weekday != null && Number.isInteger(wd) && wd >= 0 && wd <= 6 ? wd : A.wd;
    out.local_time = (hhmm(r.local_time) || hhmm(DEFAULTS.local_time)).text;
    const md = Number(r.monthly_day); out.monthly_day = Number.isInteger(md) && md >= 1 && md <= 28 ? md : Math.min(28, A.d);
    out.last = ms(r.last_cycle_at); out.current_key = S(r.current_key); out.last_monthly_key = S(r.last_monthly_key);
    out.status = S(r.status).toLowerCase() || 'active'; out.skip_jobs = listOf(r.skip_jobs).filter(j => NAMES.includes(j));
    return out;
  };
  // a website's first seo_cycles row: written by Site Kickoff and by the dispatcher's adoption, so the two can never differ
  const newCycleRow = (o) => {
    const c = o || {}, tz = S(c.tz) || DEFAULTS.engine_tz, anchor = ms(c.anchor) || ms(c.now), now = ms(c.now) || anchor;
    const A = local(tz, anchor);
    return { site_id: S(c.site_id), domain: normD(c.domain), anchor_at: iso(anchor), tz, cycle_weekday: A.wd, local_time: DEFAULTS.local_time,
      monthly_day: Math.min(28, A.d), next_due_at: iso(anchor), next_preview_at: '', current_key: '', status: 'active',
      skip_jobs: listOf(c.skip_jobs).filter(j => NAMES.includes(j)).join(','), last_cycle_at: '', last_monthly_key: '', adopted: !!c.adopted, updated_at: iso(now) };
  };
  // ---- the chain of due cycles of one website: cycle 0 at the anchor, then the weekday rule, then every 7 local days ----
  // `first` is the earliest cycle not yet started; the most recent due one at `now` is found by walking forward (bounded).
  const chainFrom = (rd, cfg) => {
    const first = !rd.last ? { date: rd.anchor_date, at: rd.anchor, zero: true }
      : (() => { const n = nextAfter({ tz: rd.tz, weekday: rd.weekday, local_time: rd.local_time, last: rd.last, spacing_days: cfg.spacing_days }); return { ...n, zero: false }; })();
    const nextOf = (c) => { const date = c.zero ? onOrAfter(dateAdd(c.date, cfg.spacing_days), rd.weekday) : dateAdd(c.date, 7); return { date, at: dueAt(rd.tz, date, rd.local_time), zero: false }; };
    return { first, nextOf };
  };
  const mostRecent = (rd, now, cfg) => {
    const ch = chainFrom(rd, cfg);
    if (ch.first.at > now) return { due: null, next: ch.first, passed: 0 };
    let cur = ch.first, nxt = ch.nextOf(cur), passed = 0, guard = 0;
    while (nxt.at <= now && guard++ < 5000) { cur = nxt; nxt = ch.nextOf(cur); passed++; }
    return { due: cur, next: nxt, passed };
  };
  // ---- what a website runs: its own settings, read the way Site Kickoff read them ----
  const settingsOf = (o) => {
    const c = o || {}, m = c.monitors || {}, cad = c.cadence || null;
    const ai = flag(m.ai_visibility, true);
    const pages = cad ? Number(cad.pages_per_week) : 0;
    return { ai_visibility: ai, backlinks: flag(m.backlinks, true), ai_growth: ai && flag(m.ai_growth, true), link_builder: flag(m.link_builder, true),
      audit_monthly: flag(m.audit_monthly, true), cadence: !!cad && S(cad.status).toLowerCase() !== 'off' && Number.isFinite(pages) && pages > 0,
      pages_per_week: Number.isFinite(pages) ? pages : 0, cadence_off: !!cad && S(cad.status).toLowerCase() === 'off', has_ladder: !!c.has_ladder };
  };
  // the jobs of one cycle in order, each on or off with the plain reason
  const jobsFor = (o) => {
    const c = o || {}, st = c.settings || {}, zero = !!c.zero, monthly = !!c.monthly, skip = new Set(zero ? (c.skip_jobs || []) : []);
    const why = {
      ai_visibility: st.ai_visibility ? '' : 'AI visibility is switched off for this website',
      backlinks: st.backlinks ? '' : 'the backlink monitor is switched off for this website',
      rank_tracker: st.has_ladder ? '' : 'there is no keyword ladder to check yet',
      site_tracker: zero ? '"Track my site" already ran it when tracking was set up (cycle 0)' : '',
      ai_growth: !st.ai_visibility ? 'AI visibility is switched off, and AI growth reads its question panel' : st.ai_growth ? '' : 'AI growth is switched off for this website',
      content_cadence: st.cadence ? '' : st.cadence_off ? 'the content cadence is switched off' : 'no pages a week are set (0), so nothing is written',
      link_builder: st.link_builder ? '' : 'link building is switched off for this website',
      audit: !monthly ? 'the audit runs on the website\'s monthly cycle only' : st.audit_monthly ? '' : 'the monthly audit is switched off for this website',
    };
    return JOBS.map(j => {
      let reason = why[j.job] || '';
      if (!reason && skip.has(j.job)) reason = 'already run when tracking was set up (skip_jobs), so cycle 0 does not run it twice';
      return { ...j, on: !reason, why: reason, extra: j.job === 'backlinks' ? { light: !monthly } : {} };
    });
  };
  // the §14.2 payload of a cycle run, exactly (+ tz, agreed with E2): the job's Manual Run reads `trigger: 'cycle'` and runs scheduled
  // semantics for one site
  const payload = (o) => {
    const c = o || {}, p = { trigger: 'cycle', domain: normD(c.domain), site_id: S(c.site_id), cycle_key: S(c.cycle_key), job: S(c.job), monthly: !!c.monthly,
      scheduled_for: iso(ms(c.scheduled_for)), request_id: requestId(c.site_id, dateOfKey(c.cycle_key), c.job) };
    if (S(c.tz)) p.tz = S(c.tz);   // the website's zone: the job's ran-late notice names the slot in it
    if (c.job === 'backlinks') p.light = !c.monthly;
    if (c.job === 'preview') p.preview = true;
    return p;
  };
  const ledgerKey = (cycle_key, job) => 'cycle:' + S(cycle_key) + ':' + S(job);
  // ---- why the run guard refused a run, read off its ledger row. The resume node writes `cost_basis: 'refused before any spending: <its
  // sentence> [<basis>]'` (ladder_common.LEDGER_RESUME_JS); a code anywhere in it (`same_mode`, `refused (too_many_open)`) wins, else the
  // run guard's own sentences (_run_guard.js) are matched. Anything else is not a capacity refusal and spends an attempt.
  const refusalOf = (r) => {
    const txt = [S(r && r.reason), S(r && r.refusal), S(r && r.cost_basis)].join(' ');
    const code = /\b(same_mode|too_many_open|heavy_busy|account_low|caught_up)\b/.exec(txt);
    if (code) return code[1];
    if (/The previous .+ run \(execution [^)]*\b.*is still going/i.test(txt)) return 'same_mode';
    if (/A large audit of .+ is already running/i.test(txt)) return 'heavy_busy';
    if (/There are already \d+ analyses running/i.test(txt)) return 'too_many_open';
    if (/search-data account is too low/i.test(txt)) return 'account_low';
    if (/catch-up already ran this scheduled slot/i.test(txt)) return 'caught_up';
    return 'other';
  };
  const isStale = (r, now, h) => { const st = S(r && r.status); if (st === 'stale') return true; const t = ms(r && r.created_at); return st === 'reserved' && t > 0 && t < now - h * H; };
  const shortBasis = (r) => S(r && r.cost_basis).replace(/\s+/g, ' ').slice(0, 160);
  // ---- the outcome of a job the dispatcher started, from the ledger first and n8n's executions second ----
  // a: { row, ledger, runs: {workflow_id: {ok, full, oldest, data: [{id, mode, status, startedAt}]}}, claimed: Set of run ids other keys own, now, cfg }
  // -> { state: done | running | starting | refused | failed | blind, reason, run_id, finished_at, code }
  const outcome = (a) => {
    const c = a || {}, row = c.row || {}, cfg = c.cfg || DEFAULTS, now = c.now;
    const lk = S(row.ledger_key) || ledgerKey(row.cycle_key, row.job), T = ms(row.started_at) || ms(row.updated_at);
    const after = (r) => ms(r.created_at) >= T - 5000;
    const rows = (c.ledger || []).filter(r => r && S(r.key) === lk && after(r)).sort((x, y) => ms(x.created_at) - ms(y.created_at));
    const parts = (c.ledger || []).filter(r => r && S(r.key).startsWith(lk + ':part') && after(r)).sort((x, y) => ms(x.created_at) - ms(y.created_at));
    const run = (c.runs || {})[S(row.workflow_id)] || {};
    const execOf = (id) => run.ok ? (run.data || []).find(x => S(x.id) === S(id)) : null;
    const done = rows.filter(r => S(r.status) === 'done');
    // AI Visibility may settle the final key at $0 when it hands over to a chain that resumes, and that chain settles it again later: a
    // `:part<n>` row NEWER than the last settled final row means the job is still going (a key settling twice is fine: done stays done)
    const lastDone = done.length ? done[done.length - 1] : null;
    const resumed = lastDone ? parts.filter(p => ms(p.created_at) > ms(lastDone.created_at)) : [];
    if (resumed.length) { parts.splice(0, parts.length, ...resumed); rows.splice(0, rows.length); }
    else if (done.length) { const d = lastDone;
      return { state: 'done', run_id: S(d.run_id), finished_at: S(d.settled_at) || iso(now), reason: 'finished: its ledger row ' + lk + ' settled' + (S(d.settled_at) ? ' at ' + S(d.settled_at) : '') + ' (execution ' + S(d.run_id) + ')' + (S(d.dfs_source) === 'handoff' ? ', handed off' : '') }; }
    const live = rows.filter(r => S(r.status) === 'reserved' && !isStale(r, now, cfg.stale_hours));
    if (live.length) { const l = live[live.length - 1], x = execOf(l.run_id);
      if (x && DEAD.has(S(x.status))) return { state: 'failed', run_id: S(l.run_id), release: S(l.run_id), reason: 'its run (execution ' + S(l.run_id) + ') was ' + S(x.status) + ' by n8n before it finished (a restart, a deploy or a time-out)' };
      return { state: 'running', run_id: S(l.run_id), reason: 'running (execution ' + S(l.run_id) + ', ledger row reserved at ' + S(l.created_at) + ')' }; }
    if (rows.length) {
      const last = rows[rows.length - 1], st = S(last.status);
      if (st === 'refused') { const code = refusalOf(last);
        return { state: 'refused', code, run_id: S(last.run_id), refused_at: S(last.created_at), reason: 'refused by its run guard (' + code + '): ' + shortBasis(last).replace(/^refused before any spending:\s*/i, '') }; }
      if (isStale(last, now, cfg.stale_hours)) return { state: 'failed', run_id: S(last.run_id), reason: 'its run (execution ' + S(last.run_id) + ') reserved its ledger row at ' + S(last.created_at) + ' and never settled it (stale after ' + cfg.stale_hours + ' h: it crashed or was stopped)' };
      return { state: 'failed', run_id: S(last.run_id), reason: 'its ledger row ended "' + (st || 'empty') + '", which is not a finished run' };
    }
    // a run split over several executions: the part rows show progress, never completion (only the final key counts as done)
    if (parts.length) { const p = parts[parts.length - 1], pt = S(p.status);
      if (pt === 'refused') { const code = refusalOf(p); return { state: 'refused', code, run_id: S(p.run_id), refused_at: S(p.created_at), reason: 'a later part (' + S(p.key).slice(lk.length + 1) + ') was refused by its run guard (' + code + ')' }; }
      const x = execOf(p.run_id);
      if (pt === 'reserved' && x && DEAD.has(S(x.status))) return { state: 'failed', run_id: S(p.run_id), release: S(p.run_id), reason: 'part ' + S(p.key).slice(lk.length + 1) + ' (execution ' + S(p.run_id) + ') was ' + S(x.status) + ' by n8n' };
      if (isStale(p, now, cfg.stale_hours) || (pt === 'done' && now - (ms(p.settled_at) || ms(p.created_at)) > cfg.stale_hours * H))
        return { state: 'failed', run_id: S(p.run_id), reason: 'the split run stopped after ' + S(p.key).slice(lk.length + 1) + ' (no later part and no final ledger row for ' + cfg.stale_hours + ' h)' };
      return { state: 'running', run_id: S(p.run_id), reason: 'running in parts: ' + S(p.key).slice(lk.length + 1) + ' is ' + (pt === 'done' ? 'settled, the next part is on its way' : 'in flight') + ' (execution ' + S(p.run_id) + ')' };
    }
    // no ledger row yet: what n8n says about the workflow's runs after our start
    const age = now - T;
    if (!run.ok) {
      if (age > cfg.stale_hours * H) return { state: 'failed', reason: 'no ledger row under ' + lk + ' ' + Math.round(age / MIN) + ' min after the start, and n8n\'s executions could not be read (' + (S(run.error) || 'no answer') + ')' };
      return { state: 'blind', reason: 'no ledger row yet and n8n\'s executions could not be read (' + (S(run.error) || 'no answer') + '); looked at again next sweep' };
    }
    const mine = (run.data || []).filter(x => S(x.mode) !== 'trigger' && ms(x.startedAt) >= T - 5000 && ms(x.startedAt) <= T + cfg.confirm_minutes * MIN && !(c.claimed && c.claimed.has(S(x.id))))
      .sort((x, y) => ms(x.startedAt) - ms(y.startedAt));
    const alive = mine.filter(x => !DEAD.has(S(x.status)) && !['success', 'error'].includes(S(x.status)));
    if (alive.length) return { state: age > cfg.stale_hours * H ? 'failed' : 'running', run_id: S(alive[0].id), reason: age > cfg.stale_hours * H
      ? 'its run (execution ' + S(alive[0].id) + ') has reserved no ledger row in ' + Math.round(age / MIN) + ' min' : 'started (execution ' + S(alive[0].id) + '), no ledger row yet' };
    if (mine.length) { const x = mine[0];
      if (S(x.status) === 'success') return { state: 'done', run_id: S(x.id), finished_at: S(x.stoppedAt) || iso(now), reason: 'finished (execution ' + S(x.id) + ' success) but left no ledger row under ' + lk + ' - its plan node does not key cycle runs yet' };
      return { state: 'failed', run_id: S(x.id), reason: 'its run (execution ' + S(x.id) + ') ended "' + S(x.status) + '" before it reserved its ledger row' }; }
    if (run.full && ms(run.oldest) > T) return { state: 'blind', reason: 'more runs of the workflow since the start than one page of n8n\'s executions holds; looked at again next sweep' };
    if (age > cfg.confirm_minutes * MIN) return { state: 'failed', reason: 'no run of its workflow appeared in the ' + cfg.confirm_minutes + ' min after it was recorded (the sweep stopped between the record and the start, or n8n refused the start)' };
    return { state: 'starting', reason: 'recorded at ' + iso(T) + ', waiting for its run to appear' };
  };
  // the trailing run of capacity refusals of one ledger key: how long the job has been refused without a break
  const refusedSince = (ledger, lk) => {
    const rows = (ledger || []).filter(r => r && S(r.key) === lk).sort((x, y) => ms(x.created_at) - ms(y.created_at));
    let since = 0;
    for (let i = rows.length - 1; i >= 0; i--) { const r = rows[i]; if (S(r.status) === 'refused' && CAPACITY.has(refusalOf(r))) since = ms(r.created_at); else break; }
    return since;
  };
  const jobRow = (o) => ({ key: S(o.key), site_id: S(o.site_id), cycle_key: S(o.cycle_key), job: S(o.job), workflow_id: S(o.workflow_id), status: S(o.status),
    attempts: Number(o.attempts) || 0, run_id: S(o.run_id), ledger_key: S(o.ledger_key), monthly: !!yes(o.monthly), reason: S(o.reason).slice(0, 600),
    due_at: S(o.due_at), started_at: S(o.started_at), finished_at: S(o.finished_at), updated_at: S(o.updated_at) });
  const cycleRowOf = (o) => ({ site_id: S(o.site_id), domain: normD(o.domain), anchor_at: S(o.anchor_at), tz: S(o.tz), cycle_weekday: Number(o.cycle_weekday),
    local_time: S(o.local_time), monthly_day: Number(o.monthly_day), next_due_at: S(o.next_due_at), next_preview_at: S(o.next_preview_at), current_key: S(o.current_key),
    status: S(o.status) || 'active', skip_jobs: S(o.skip_jobs), last_cycle_at: S(o.last_cycle_at), last_monthly_key: S(o.last_monthly_key), adopted: !!yes(o.adopted), updated_at: S(o.updated_at) });
  const sameJob = (a, b) => !!a && !!b && S(a.status) === S(b.status) && Number(a.attempts || 0) === Number(b.attempts || 0) && S(a.run_id) === S(b.run_id) && !!yes(a.monthly) === !!yes(b.monthly);
  const CYCLE_FIELDS = ['anchor_at', 'tz', 'cycle_weekday', 'local_time', 'monthly_day', 'next_due_at', 'next_preview_at', 'current_key', 'status', 'skip_jobs', 'last_cycle_at', 'last_monthly_key'];

  // ===== the plan of one sweep =====
  // o: { now, entry, mode ('start' | 'plan_only'), dry_run, engine_tz, sites, cycles, jobs, monitors, cadence, ladders, ladder_settings, ledger,
  //      runs {workflow_id: {ok, full, oldest, data, error}}, config }
  const plan = (o) => {
    if (typeof RG === 'undefined') throw new Error('CYC.plan needs the run guard kit (RG) inlined: its live-run rule is the room the dispatcher starts into');
    const c = o || {}, cfg = { ...DEFAULTS, ...(c.config || {}) }, now = ms(c.now) || Date.now(), nowIso = iso(now);
    const engineTz = validTz(c.engine_tz) ? S(c.engine_tz) : DEFAULTS.engine_tz;
    const dry = c.dry_run === true, planOnly = dry || S(c.mode) !== 'start';
    const clean = (a) => (a || []).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length);
    const sites = clean(c.sites).filter(r => S(r.site_id) && S(r.domain)), cycles = clean(c.cycles).filter(r => S(r.site_id));
    const ledger = clean(c.ledger).filter(r => S(r.run_id) || S(r.key)), runs = c.runs || {};
    const loaded = clean(c.jobs).filter(r => S(r.key));
    const byKey = new Map(loaded.map(r => [S(r.key), jobRow(r)]));
    const orig = new Map(loaded.map(r => [S(r.key), jobRow(r)]));
    const siteOf = new Map(sites.map(s => [S(s.site_id), s]));
    const monOf = new Map(clean(c.monitors).filter(m => S(m.site_id)).map(m => [S(m.site_id), m]));
    const cadOf = new Map(clean(c.cadence).filter(m => S(m.site_id)).map(m => [S(m.site_id), m]));
    const ladderDomains = new Set(clean(c.ladders).map(l => normD(l.domain)).filter(Boolean));
    for (const s of clean(c.ladder_settings)) if (S(s.ladder_id) && S(s.ladder_id) !== '_site' && !/^(deleted|archived)$/i.test(S(s.status))) ladderDomains.add(normD(s.domain));
    // run ids another job's ledger row owns: an execution that belongs to someone else is never taken for ours
    const claimedBy = new Map(); for (const r of ledger) if (S(r.run_id) && S(r.key)) claimedBy.set(S(r.run_id), S(r.key));
    const rows = [], sitesOut = [], cycleRows = [], cands = [], gaveUp = [], adopted = [];
    const touch = new Set();   // job keys whose row this plan changed
    const evOf = new Map();    // job key -> what the evidence said this sweep
    // a reservation whose execution n8n reports crashed / canceled never settles: it would hold the run guard (and refuse the retry as its
    // own twin) for the 2 hours *Release Stale Runs* waits. It is released now - marked `stale`, exactly what that node writes - so the retry
    // can start this sweep; the plan leaves it out of the live runs it counts.
    const release = new Map();
    const put = (r) => { const jr = jobRow({ ...r, updated_at: nowIso }); byKey.set(jr.key, jr); touch.add(jr.key); return jr; };

    // ---- 1. every job row still open, whatever cycle it belongs to: what happened to it ----
    for (const r of [...byKey.values()]) {
      if (S(r.job) === 'cycle' || !LIVE.has(S(r.status))) continue;
      const lk = r.ledger_key || ledgerKey(r.cycle_key, r.job);
      const claimed = new Set([...claimedBy.entries()].filter(([, k]) => k !== lk && !k.startsWith(lk + ':part')).map(([id]) => id));
      const ev = outcome({ row: r, ledger, runs, claimed, now, cfg });
      if (ev.state === 'done') put({ ...r, status: 'done', run_id: ev.run_id || r.run_id, finished_at: ev.finished_at || nowIso, reason: ev.reason });
      else if (ev.state === 'running') { if (S(r.status) !== 'running' || S(r.run_id) !== S(ev.run_id)) put({ ...r, status: 'running', run_id: ev.run_id || r.run_id, reason: ev.reason }); }
      else if (ev.state === 'refused') {
        const since = refusedSince(ledger, lk) || ms(ev.refused_at) || now;
        if (ev.code === 'account_low') { put({ ...r, status: 'gave_up', run_id: ev.run_id || r.run_id, finished_at: nowIso, reason: 'gave up: ' + ev.reason + ' - topping up the search-data account is the fix; retrying would be refused the same way' }); gaveUp.push(r.key); }
        else if (ev.code === 'caught_up') { put({ ...r, status: 'gave_up', run_id: ev.run_id || r.run_id, finished_at: nowIso, reason: 'gave up: ' + ev.reason + ' - the run guard says this slot already ran, so it is not retried' }); gaveUp.push(r.key); }
        else if (!CAPACITY.has(ev.code)) {
          const att = Number(r.attempts) || 1;
          if (att >= cfg.max_attempts) { put({ ...r, status: 'gave_up', run_id: ev.run_id || r.run_id, finished_at: nowIso, reason: 'gave up after ' + att + ' attempt(s): ' + ev.reason }); gaveUp.push(r.key); }
          else put({ ...r, status: 'failed', run_id: ev.run_id || r.run_id, reason: 'attempt ' + att + ' failed: ' + ev.reason });
        } else if (now - since >= cfg.refusal_hours * H) { put({ ...r, status: 'gave_up', run_id: ev.run_id || r.run_id, finished_at: nowIso, reason: 'gave up: refused for capacity for ' + Math.round((now - since) / H) + ' h without a break (' + ev.reason + ')' }); gaveUp.push(r.key); }
        else put({ ...r, status: 'refused', run_id: ev.run_id || r.run_id, reason: ev.reason + ' - retried by the dispatcher without spending an attempt' });
      } else if (ev.state === 'failed') {
        const att = Number(r.attempts) || 1;
        if (att >= cfg.max_attempts) { put({ ...r, status: 'gave_up', run_id: ev.run_id || r.run_id, finished_at: nowIso, reason: 'gave up after ' + att + ' attempt(s): ' + ev.reason }); gaveUp.push(r.key); }
        else put({ ...r, status: 'failed', run_id: ev.run_id || r.run_id, reason: 'attempt ' + att + ' failed: ' + ev.reason });
      }
      // starting / blind: unchanged, looked at again next sweep
      evOf.set(r.key, ev);
      if (ev.release) release.set(S(ev.release), { run_id: S(ev.release), key: r.key, reason: ev.reason });
    }
    // a refused job waiting for room keeps its bound: 24 h of refusals in a row, then it gives up
    for (const r of [...byKey.values()]) {
      if (S(r.status) !== 'refused' || touch.has(r.key)) continue;
      const since = refusedSince(ledger, r.ledger_key || ledgerKey(r.cycle_key, r.job));
      if (since && now - since >= cfg.refusal_hours * H) { put({ ...r, status: 'gave_up', finished_at: nowIso, reason: 'gave up: refused for capacity for ' + Math.round((now - since) / H) + ' h without a break' }); gaveUp.push(r.key); }
    }

    // ---- 2. adoption: a tracked, active website with no cycle row gets one now (the kickoff's safety net, plan §4.7) ----
    const cyc = new Map(cycles.map(r => [S(r.site_id), r]));
    for (const s of sites) {
      if (cyc.has(S(s.site_id)) || S(s.status).toLowerCase() === 'paused') continue;
      const row = newCycleRow({ site_id: s.site_id, domain: s.domain, tz: engineTz, anchor: now, now, adopted: true });
      cyc.set(S(s.site_id), { ...row, __new: true }); adopted.push({ site_id: S(s.site_id), domain: normD(s.domain), anchor_at: row.anchor_at, tz: row.tz });
    }

    // ---- 3. each website's cycle ----
    for (const [siteId, raw] of cyc.entries()) {
      const out = { site_id: siteId, domain: normD(raw.domain), verdict: '', reason: '', cycle_key: S(raw.current_key), jobs: [] };
      sitesOut.push(out);
      const say = (v, why) => { out.verdict = v; out.reason = why; };
      const site = siteOf.get(siteId);
      const rd = read(raw, engineTz);
      if (!rd.ok) { say('blind', 'the cycle row of ' + (out.domain || siteId) + ' cannot be read: ' + rd.reason + ', so nothing was started'); continue; }
      const domain = normD((site && site.domain) || raw.domain); out.domain = domain;
      const next = { ...cycleRowOf(raw), domain, tz: rd.tz, cycle_weekday: rd.weekday, local_time: rd.local_time, monthly_day: rd.monthly_day };
      const finish = () => { const before = raw.__new ? null : cycleRowOf(raw);
        if (!before || CYCLE_FIELDS.some(f => S(before[f]) !== S(next[f])) || normD(before.domain) !== domain) cycleRows.push(cycleRowOf({ ...next, updated_at: nowIso })); };
      const st = { monitors: monOf.get(siteId) || {}, cadence: cadOf.get(siteId) || null, has_ladder: ladderDomains.has(domain) };
      const settings = settingsOf(st);
      // the cycle that is due now, if any (most recent only; the 12-hour gap)
      const mr = mostRecent(rd, now, cfg);
      let opened = null, skippedCycle = null;
      const paused = !site ? 'it is no longer tracked by the engine (no seo_sites row)' : S(site.status).toLowerCase() === 'paused' ? 'the website is paused'
        : rd.status === 'paused' ? 'its cycle is paused' : rd.status === 'off' ? 'its cycle is switched off' : '';
      if (mr.due && !paused) {
        const k = cycleKey(siteId, mr.due.date);
        if (mr.next.at - now < cfg.next_gap_hours * H) {
          skippedCycle = { key: k, due: mr.due, next: mr.next };
          const mk = k + ':cycle';
          if (!byKey.has(mk)) put({ key: mk, site_id: siteId, cycle_key: k, job: 'cycle', workflow_id: '', status: 'skipped', attempts: 0, run_id: '', ledger_key: '', monthly: false,
            reason: 'skipped: due ' + iso(mr.due.at) + ' and the next cycle is due ' + iso(mr.next.at) + ', in ' + CU.dur((mr.next.at - now) / MIN) + ', which covers it' + (mr.passed ? ' (' + mr.passed + ' earlier cycle(s) were not run either)' : ''),
            due_at: iso(mr.due.at), started_at: '', finished_at: nowIso });
          next.next_due_at = iso(mr.next.at);
        } else {
          const zero = mr.due.zero && mr.passed === 0;
          const pk = periodKey(mr.due.date, rd.monthly_day);
          const monthly = zero || pk !== rd.last_monthly_key;
          opened = { key: k, due: mr.due, zero, monthly, passed: mr.passed };
          // the cycle it replaces: its marker is closed; its open jobs are looked at below
          const prev = rd.current_key;
          next.current_key = k; next.last_cycle_at = nowIso; if (monthly) next.last_monthly_key = pk;
          put({ key: k + ':cycle', site_id: siteId, cycle_key: k, job: 'cycle', workflow_id: '', status: 'running', attempts: 0, run_id: '', ledger_key: '', monthly,
            reason: (zero ? 'cycle 0, opened at setup' : 'opened') + ' at ' + nowIso + (monthly ? ', the website\'s monthly cycle' : '') + (mr.passed ? '; ' + mr.passed + ' earlier cycle(s) were not run (the engine was down or the website paused): only the most recent runs' : '')
              + (prev && prev !== k ? '; it replaces ' + prev : ''), due_at: iso(mr.due.at), started_at: nowIso, finished_at: '' });
          rd.current_key = k; rd.last = now;
        }
      }
      // the cycle being worked on
      const ck = rd.current_key;
      const ckDate = dateOfKey(ck);
      const marker = ck ? byKey.get(ck + ':cycle') : null;
      const zeroNow = !!ck && ckDate === rd.anchor_date;
      const monthlyNow = opened ? opened.monthly : marker ? !!yes(marker.monthly)
        : zeroNow || [...byKey.values()].some(r => S(r.cycle_key) === ck && yes(r.monthly));
      // next due time (and the preview 48 h before it), from the last cycle start
      if (rd.last && !skippedCycle) { const n = nextAfter({ tz: rd.tz, weekday: rd.weekday, local_time: rd.local_time, last: rd.last, spacing_days: cfg.spacing_days }); next.next_due_at = iso(n.at); next.__next_date = n.date; }
      else if (!rd.last && !opened && !skippedCycle) next.next_due_at = iso(rd.anchor);
      const nextDue = ms(next.next_due_at), nextDate = next.__next_date || (nextDue ? local(rd.tz, nextDue).date : '');
      const pAt = nextDue - cfg.preview_hours * H;
      const previewOn = !!rd.last && settings.cadence && pAt > rd.last && !paused;
      next.next_preview_at = previewOn ? iso(pAt) : '';
      delete next.__next_date;
      out.cycle_key = ck; out.next_due_at = next.next_due_at; out.next_preview_at = next.next_preview_at; out.monthly = monthlyNow; out.cycle0 = zeroNow;
      if (opened) out.opened = { key: opened.key, due_at: iso(opened.due.at), monthly: opened.monthly, cycle0: opened.zero, not_run_before: opened.passed };
      if (skippedCycle) out.skipped_cycle = { key: skippedCycle.key, due_at: iso(skippedCycle.due.at), next_due_at: iso(skippedCycle.next.at) };
      // open jobs of a cycle that is no longer current: finished where they finished (above), set aside where they never ran. A job still
      // starting or running is left to finish; the next sweep reads its outcome and sets it aside then if it did not finish.
      const upcoming = nextDate ? cycleKey(siteId, nextDate) : '';
      for (const r of [...byKey.values()]) {
        if (S(r.site_id) !== siteId || !ck || S(r.job) === 'cycle' || TERMINAL.has(S(r.status)) || LIVE.has(S(r.status))) continue;
        if (S(r.cycle_key) === ck && S(r.job) !== 'preview') continue;
        if (S(r.job) === 'preview' && S(r.cycle_key) === upcoming) continue;   // the NEXT cycle's preview, waiting for a retry
        put({ ...r, status: 'skipped', finished_at: nowIso, reason: 'set aside: ' + (S(r.job) === 'preview' && S(r.cycle_key) === ck ? 'its cycle started before the preview could run'
          : 'cycle ' + ck + ' started before it could run') + ' (' + S(r.reason).slice(0, 200) + ')' });
      }
      for (const r of [...byKey.values()]) {   // the markers of replaced cycles are closed
        if (S(r.site_id) === siteId && S(r.job) === 'cycle' && S(r.status) === 'running' && S(r.cycle_key) !== ck) put({ ...r, status: 'done', finished_at: nowIso, reason: S(r.reason) + '; closed when ' + ck + ' started' });
      }
      if (paused) { say('paused', (out.domain || siteId) + ': ' + paused + ', so nothing starts' + (mr.due ? ' (a cycle has been due since ' + iso(mr.due.at) + '; it runs once on resume)' : ''));
        out.jobs = ck ? jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: rd.skip_jobs }).map(j => { const r = byKey.get(ck + ':' + j.job); return { job: j.job, verdict: r ? S(r.status) : 'paused', reason: r ? S(r.reason) : paused }; }) : [];
        finish(); continue; }
      if (!ck) { say('not_due', 'cycle 0 is due ' + next.next_due_at); finish(); continue; }
      // ---- the jobs of the current cycle, in order: a job starts only when every earlier one is done, skipped or gave up ----
      const list = jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: rd.skip_jobs });
      let blocker = '';
      for (const j of list) {
        const key = ck + ':' + j.job, r = byKey.get(key), lk = ledgerKey(ck, j.job);
        const v = { job: j.job, verdict: '', reason: '' }; out.jobs.push(v);
        if (r && TERMINAL.has(S(r.status))) { v.verdict = S(r.status); v.reason = S(r.reason); continue; }
        if (r && LIVE.has(S(r.status))) { v.verdict = S(r.status); v.reason = (evOf.get(key) || {}).reason || S(r.reason); blocker = blocker || j.label; continue; }
        if (blocker) { v.verdict = 'wait'; v.reason = 'waits for ' + blocker + ' to finish' + (j.on ? '' : '; then skipped: ' + j.why); continue; }
        if (r && S(r.status) === 'failed' && (Number(r.attempts) || 1) >= cfg.max_attempts) {   // a start that failed on its last attempt (the start itself)
          const gr = put({ ...r, status: 'gave_up', finished_at: nowIso, reason: 'gave up after ' + (Number(r.attempts) || 1) + ' attempt(s): ' + S(r.reason) }); gaveUp.push(key);
          v.verdict = 'gave_up'; v.reason = gr.reason; continue;
        }
        if (!j.on) {
          const sr = put({ key, site_id: siteId, cycle_key: ck, job: j.job, workflow_id: j.workflow_id, status: 'skipped', attempts: r ? r.attempts : 0, run_id: r ? r.run_id : '', ledger_key: lk,
            monthly: monthlyNow, reason: 'skipped: ' + j.why, due_at: iso(ms(marker && marker.due_at) || (opened && opened.due.at) || now), started_at: r ? r.started_at : '', finished_at: nowIso });
          v.verdict = 'skipped'; v.reason = sr.reason; continue;
        }
        // a start: the first attempt, a capacity refusal again (same attempt), or a failure again (next attempt)
        const attempt = !r ? 1 : S(r.status) === 'failed' ? (Number(r.attempts) || 1) + 1 : (Number(r.attempts) || 1);
        const dueCycle = ms(marker && marker.due_at) || (opened && opened.due.at) || ms(ckDate ? dueAt(rd.tz, ckDate, rd.local_time) : 0) || now;
        v.verdict = r ? (S(r.status) === 'failed' ? 'failed_retry' : 'refused_retry') : 'start'; v.reason = r ? S(r.reason) : 'next in the cycle';
        cands.push({ v, site: out, siteId, domain, tz: rd.tz, job: j, key, cycle_key: ck, attempt, monthly: monthlyNow, due: dueCycle, ledger_key: lk, prior: r || null,
          scheduled_for: dueCycle, extra: j.extra });
        blocker = j.label;
      }
      const left = list.filter(j => { const r = byKey.get(ck + ':' + j.job); return !r || !TERMINAL.has(S(r.status)); });
      if (!left.length && marker && S(marker.status) === 'running') {
        const n = list.map(j => S((byKey.get(ck + ':' + j.job) || {}).status)); const cnt = (s) => n.filter(x => x === s).length;
        put({ ...marker, status: 'done', finished_at: nowIso, reason: S(marker.reason) + '; finished at ' + nowIso + ': ' + cnt('done') + ' done, ' + cnt('skipped') + ' skipped, ' + cnt('gave_up') + ' gave up' });
      }
      say(left.length ? 'in_cycle' : 'cycle_done', left.length ? ck + ': ' + (list.length - left.length) + ' of ' + list.length + ' jobs finished' : ck + ': every job finished; next cycle ' + next.next_due_at);
      // ---- the "Coming up" preview of the NEXT cycle, 48 h before it (never for cycle 0, never when nothing would be written) ----
      if (previewOn && now >= pAt && now < nextDue) {
        const nk = upcoming, pkey = nk + ':preview', pr = byKey.get(pkey), plk = ledgerKey(nk, 'preview');
        const pv = { job: 'preview', verdict: '', reason: '' }; out.jobs.push(pv);
        if (pr && (TERMINAL.has(S(pr.status)) || LIVE.has(S(pr.status)))) { pv.verdict = S(pr.status); pv.reason = S(pr.reason); }
        else if (pr && S(pr.status) === 'failed' && (Number(pr.attempts) || 1) >= cfg.max_attempts) {
          const gr = put({ ...pr, status: 'gave_up', finished_at: nowIso, reason: 'gave up after ' + (Number(pr.attempts) || 1) + ' attempt(s): ' + S(pr.reason) }); gaveUp.push(pkey);
          pv.verdict = 'gave_up'; pv.reason = gr.reason;
        } else if (nextDue - now < cfg.preview_min_lead_hours * H) {
          const sr = put({ key: pkey, site_id: siteId, cycle_key: nk, job: 'preview', workflow_id: PREVIEW.workflow_id, status: 'skipped', attempts: pr ? pr.attempts : 0, run_id: pr ? pr.run_id : '',
            ledger_key: plk, monthly: false, reason: 'skipped: the preview could not run in time (' + CU.dur((nextDue - now) / MIN) + ' before the cycle, less than ' + cfg.preview_min_lead_hours + ' h)' + (pr ? ' - ' + S(pr.reason).slice(0, 200) : ''),
            due_at: iso(pAt), started_at: pr ? pr.started_at : '', finished_at: nowIso });
          pv.verdict = 'skipped'; pv.reason = sr.reason;
        } else {
          const attempt = !pr ? 1 : S(pr.status) === 'failed' ? (Number(pr.attempts) || 1) + 1 : (Number(pr.attempts) || 1);
          pv.verdict = pr ? (S(pr.status) === 'failed' ? 'failed_retry' : 'refused_retry') : 'start'; pv.reason = pr ? S(pr.reason) : 'the next cycle is due ' + iso(nextDue);
          cands.push({ v: pv, site: out, siteId, domain, tz: rd.tz, job: PREVIEW, key: pkey, cycle_key: nk, attempt, monthly: periodKey(nextDate, rd.monthly_day) !== S(next.last_monthly_key),
            due: pAt, ledger_key: plk, prior: pr || null, scheduled_for: nextDue, extra: {} });
        }
      }
      finish();
    }

    // ---- 4. capacity: at most max_starts a sweep, max_inflight dispatcher jobs at once, never into a refusal the run guard would give ----
    const open = [...byKey.values()].filter(r => S(r.job) !== 'cycle' && LIVE.has(S(r.status)));
    const live = RG.liveRuns(ledger.filter(r => !release.has(S(r.run_id))), { now: nowIso, run_id: 'cycle-dispatcher', stale_hours: cfg.stale_hours });
    const pending = open.filter(r => S(r.status) === 'starting' && !ledger.some(l => S(l.key) === (r.ledger_key || ledgerKey(r.cycle_key, r.job)) && ms(l.created_at) >= ms(r.started_at) - 5000)).length;
    const roomGuard = Math.max(0, cfg.max_open - live.length - pending);
    const take = Math.max(0, Math.min(cfg.max_starts, cfg.max_inflight - open.length, roomGuard));
    cands.sort((a, b) => a.due - b.due || a.siteId.localeCompare(b.siteId) || NAMES.indexOf(a.job.job) - NAMES.indexOf(b.job.job));
    const start = [], busy = new Set();
    for (const k of cands) {
      const twin = live.find(r => S(r.mode) === k.job.mode && normD(r.domain) === k.domain);
      const heavy = k.job.heavy ? live.find(r => yes(r.heavy) && normD(r.domain) === k.domain) : null;
      if (twin || heavy || busy.has(k.job.mode + '|' + k.domain)) { const x = twin || heavy;
        k.v.verdict = 'wait'; k.v.reason = x ? 'a ' + S(x.mode).replace(/_/g, ' ') + ' run of ' + k.domain + ' is in flight (execution ' + S(x.run_id) + '): starting now would be refused as its twin; looked at again next sweep' : 'another start of the same work for ' + k.domain + ' goes first this sweep'; continue; }
      if (start.length >= take) { k.v.verdict = 'capacity'; k.v.reason = 'ready, waits for room: ' + open.length + ' dispatcher job(s) in flight (limit ' + cfg.max_inflight + '), ' + live.length + ' run(s) holding the run guard (limit ' + cfg.max_open + '), ' + take + ' start(s) this sweep'; continue; }
      if (planOnly) { k.v.verdict = 'plan_only'; k.v.reason = 'would start now (attempt ' + k.attempt + ')' + (dry ? ': a dry run starts nothing' : ': the dispatcher is in plan_only mode (seo_cache cycle:mode)'); busy.add(k.job.mode + '|' + k.domain); start.push({ __would: true, k }); continue; }
      k.v.verdict = 'start'; busy.add(k.job.mode + '|' + k.domain);
      start.push({ k });
    }
    const starts = start.map(({ k, __would }) => ({ would: !!__would, key: k.key, site_id: k.siteId, cycle_key: k.cycle_key, job: k.job.job, workflow_id: k.job.workflow_id,
      attempts: k.attempt, ledger_key: k.ledger_key, monthly: !!k.monthly, due_at: iso(k.due), retry_of: k.prior ? S(k.prior.reason).slice(0, 300) : '',
      why: (k.prior ? (S(k.prior.status) === 'failed' ? 'attempt ' + k.attempt + ' (the last one failed)' : 'again after a capacity refusal (attempt ' + k.attempt + ')') : 'next in the cycle') + ' - ' + k.job.label + ' for ' + k.domain,
      payload: payload({ domain: k.domain, site_id: k.siteId, cycle_key: k.cycle_key, job: k.job.job, monthly: k.monthly, scheduled_for: k.scheduled_for, tz: k.tz }), plan_now: nowIso }));
    const realStarts = starts.filter(s => !s.would), wouldStarts = starts.filter(s => s.would);
    // ---- 5. what to write: only rows that changed (a sweep every 5 minutes writes nothing on a quiet day) ----
    const jobRows = [...touch].map(k => byKey.get(k)).filter(r => !orig.has(r.key) || !sameJob(r, orig.get(r.key))).map(r => jobRow(r));
    const counts = {}; for (const s of sitesOut) for (const j of s.jobs) counts[j.verdict] = (counts[j.verdict] || 0) + 1;
    const gave = [...new Set(gaveUp)].map(k => byKey.get(k)).filter(Boolean).map(r => ({ key: r.key, site_id: r.site_id, job: r.job, domain: (sitesOut.find(s => s.site_id === r.site_id) || {}).domain || '', reason: S(r.reason) }));
    return { now: nowIso, entry: S(c.entry) || 'sweep', mode: planOnly ? 'plan_only' : 'start', configured_mode: S(c.mode) === 'start' ? 'start' : 'plan_only', dry_run: dry, engine_tz: engineTz,
      sites: sitesOut, adopted, open_jobs: open.length, live_runs: live.length, room: take, max_inflight: cfg.max_inflight, max_open: cfg.max_open,
      cycle_rows: planOnly ? [] : cycleRows, job_rows: planOnly ? [] : jobRows, start: planOnly ? [] : realStarts.map(s => { const { would, ...x } = s; return x; }),
      would: planOnly ? { cycle_rows: cycleRows, job_rows: jobRows, release: [...release.values()], start: wouldStarts.map(s => { const { would, ...x } = s; return x; }) } : null,
      release: planOnly ? [] : [...release.values()], gave_up: planOnly ? [] : gave, retention: { before: iso(now - cfg.retention_days * DAY), days: cfg.retention_days, run: !planOnly },
      counts, basis: sitesOut.length + ' website(s) read (' + adopted.length + ' adopted); ' + (planOnly ? wouldStarts.length + ' start(s) planned, none made (' + (dry ? 'dry run' : 'plan_only') + ')' : realStarts.length + ' start(s)')
        + ', ' + open.length + ' job(s) in flight, ' + live.length + ' run(s) holding the run guard' };
  };

  // ===== the deploy guard's question (apply_env.py / deploy_engine.py ask the same one in Python: deploy_guard.py; build section 140
  // and harness CY12 hold the two to the same cases). Busy = a dispatcher job is starting or running (and not stale), or a cycle or a
  // preview of an active website is due in the next `minutes` (or became due in the last 10, so the sweep is about to start it).
  const deployWindow = (o) => {
    const c = o || {}, now = ms(c.now) || Date.now(), win = (Number(c.minutes) > 0 ? Number(c.minutes) : 15) * MIN;
    const staleMs = DEFAULTS.stale_hours * H + DEFAULTS.confirm_minutes * MIN, lookback = 10 * MIN;
    const open = (c.jobs || []).filter(r => r && S(r.job) !== 'cycle' && LIVE.has(S(r.status)));
    const fresh = (r) => now - (ms(r.updated_at) || ms(r.started_at)) <= staleMs;
    const inflight = open.filter(fresh).map(r => ({ key: S(r.key), job: S(r.job), status: S(r.status), since: S(r.updated_at) || S(r.started_at) }));
    const ignored = open.filter(r => !fresh(r)).map(r => S(r.key));
    const due = [];
    for (const r of (c.cycles || [])) {
      if (!r || (S(r.status).toLowerCase() || 'active') !== 'active') continue;
      for (const [what, at] of [['cycle', ms(r.next_due_at)], ['preview', ms(r.next_preview_at)]])
        if (at && at >= now - lookback && at <= now + win) due.push({ site_id: S(r.site_id), domain: normD(r.domain), what, at: iso(at) });
    }
    inflight.sort((a, b) => a.key.localeCompare(b.key)); due.sort((a, b) => a.at.localeCompare(b.at) || a.site_id.localeCompare(b.site_id));
    const busy = inflight.length > 0 || due.length > 0;
    const reason = busy ? [inflight.length ? inflight.length + ' dispatcher job(s) in flight (' + inflight.slice(0, 5).map(j => j.key + ' ' + j.status).join(', ') + ')' : '',
      due.length ? due.length + ' cycle / preview start(s) due by ' + iso(now + win) + ' (' + due.slice(0, 5).map(d => d.domain + ' ' + d.what + ' ' + d.at).join(', ') + ')' : ''].filter(Boolean).join('; ')
      : 'no dispatcher job in flight and nothing due in the next ' + Math.round(win / MIN) + ' min';
    return { busy, inflight, due, ignored_stale: ignored, minutes: Math.round(win / MIN), reason };
  };

  return { plan, deployWindow, outcome, refusalOf, refusedSince, settingsOf, jobsFor, payload, newCycleRow, read, nextAfter, mostRecent, local, validTz, dueAt,
    dateAdd, weekdayOf, cycleKey, dateOfKey, requestId, ledgerKey, periodKey, monthlyDayOf, jobRow, cycleRowOf, JOBS, PREVIEW, BY_JOB, NAMES, DEFAULTS, TERMINAL, LIVE, DEAD, CAPACITY };
})();
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
const fitTokens = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9.]+/).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).toLowerCase()
  .split(/[^a-z0-9]+/).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = t.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t));
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + ' — add it to your services if you do sell it', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  // 1. the website itself
  for (const l of fitLabels(ctx.own_domain, [])) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  else if (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) {
    const t = fitTopic(kw, ctx.topics, ctx); if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + ' — its page is already written, so it stays tracked; decide whether to keep it' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + ' — it was planned before this rule existed, so it is set aside instead of written' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" — ' + (x.detail || x.reason)).join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. They were planned before this rule existed; a page that is already written is kept and only flagged.';
  }
};
const TZ = 'America/New_York';
const CONFIG = {"confirm_minutes": 10, "engine_tz": "America/New_York", "local_time": "06:00", "max_attempts": 3, "max_inflight": 2, "max_starts": 2, "next_gap_hours": 12, "preview_hours": 48, "preview_min_lead_hours": 6, "refusal_hours": 24, "retention_days": 120, "spacing_days": 3};
const LIMIT = 100;
const e = $('Cycle Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
const body = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (x) { return {}; } };
const failed = (r) => { const st = Number(r && r.statusCode) || 0; return st ? 'HTTP ' + st : String((r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 160); };
// a table the plan cannot read must not be a quiet one: the run fails, and the Error Handler raises the ops alert
for (const [n, what] of [['Load Cycles', 'seo_cycles'], ['Load Cycle Jobs', 'seo_cycle_jobs'], ['Load Run Ledger (Cycle)', 'seo_run_ledger'], ['Load Sites (Cycle)', 'seo_sites']]) {
  const bad = all(n).find(r => r && r.error);
  if (bad) throw new Error('Cycle Dispatcher cannot read ' + what + ' (' + String(bad.error.message || bad.error).slice(0, 200) + '): nothing was started, so no website\'s cycle can be decided this sweep');
}
// the mode switch
let mode = 'plan_only', mode_reason = 'no seo_cache row cycle:mode, so the safe default (plan_only) applies';
const mrow = all('Load Cycle Mode').find(r => r && String(r.key || '') === 'cycle:mode');
if (mrow) {
  let v = null; try { v = typeof mrow.value === 'object' ? mrow.value : JSON.parse(String(mrow.value || '')); } catch (x) { v = null; }
  if (v && v.mode === 'start') { mode = 'start'; mode_reason = 'seo_cache cycle:mode says start (updated ' + String(mrow.updated_at || '?') + ')'; }
  else if (v && v.mode === 'plan_only') mode_reason = 'seo_cache cycle:mode says plan_only';
  else mode_reason = 'seo_cache cycle:mode is not {"mode":"start"|"plan_only"} (' + String(mrow.value || '').slice(0, 80) + '), so plan_only applies';
}
if (e.plan_only && mode === 'start') { mode = 'plan_only'; mode_reason += '; this manual run asked for plan_only'; }
// n8n's executions of the workflows that have a job in flight, in the order of *Cycle Exec Requests*
const targets = all('Cycle Exec Requests').filter(t => t && t.workflow_id && !t.skip), res = all('Read Executions (Cycle)');
const runs = {};
targets.forEach((t, i) => {
  const x = res[i] || {}, xb = body(x), data = Array.isArray(xb.data) ? xb.data : null;
  const rows = (data || []).map(d => ({ id: String(d.id || ''), mode: String(d.mode || ''), status: String(d.status || ''), startedAt: String(d.startedAt || ''), stoppedAt: String(d.stoppedAt || '') }));
  runs[t.workflow_id] = Number(x.statusCode) === 200 && data
    ? { ok: true, full: rows.length >= LIMIT, oldest: rows.map(r => r.startedAt).filter(Boolean).sort()[0] || '', data: rows }
    : { ok: false, error: failed(x) };
});
// the Rank Tracker job runs for a website that has a ladder rung the fit gate keeps (INVARIANTS rule 2: stored rungs are read back through
// the same gate that writes them, FITR - a website whose only rungs are a competitor's brand or a government portal buys no rank check)
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const siteRows = all('Load Sites (Cycle)').filter(s => s && s.site_id && s.domain), monRows = all('Load Monitors (Cycle)');
const byDom = {};
for (const r of all('Load Ladders (Cycle)')) { if (!r || r.error || !r.domain) continue; const d = normD(r.domain); (byDom[d] = byDom[d] || []).push(r); }
const ladders = [], ladders_set_aside = [];
for (const [d, rows] of Object.entries(byDom)) {
  const site = siteRows.find(s => normD(s.domain) === d) || {}, m = monRows.find(x => x && x.site_id === site.site_id) || {};
  const g = FITR.rungs(rows, FITR.ctx({ own_domain: d, competitors: listOf(m.competitors).map(normD), heads: [...new Set(rows.map(r => r.head_keyword).filter(Boolean))] }),
    { where: 'the cycle dispatcher (does this website have a ladder to rank-check?)' });
  if ((g.keep || []).length) ladders.push({ domain: d, rungs: g.keep.length });
  else ladders_set_aside.push({ domain: d, rungs: rows.length, note: 'every stored rung is set aside by the fit gate, so the cycle runs no rank check: ' + ((g.set_aside || [])[0] || {}).note });
}
const p = CYC.plan({ now: e.now, entry: e.entry, mode, dry_run: !!e.dry_run, engine_tz: TZ, sites: siteRows, cycles: all('Load Cycles'),
  jobs: all('Load Cycle Jobs'), monitors: monRows, cadence: all('Load Cadence (Cycle)'), ladders,
  ladder_settings: all('Load Ladder Settings (Cycle)'), ledger: all('Load Run Ledger (Cycle)'), runs, config: { ...CONFIG, max_open: RG.MAX_OPEN, stale_hours: RG.STALE_HOURS } });
return [{ json: { ...p, mode_reason, clock_moved: !!e.clock_moved, plan_only_input: !!e.plan_only, note: String(e.note || ''), ladders_set_aside } }];
