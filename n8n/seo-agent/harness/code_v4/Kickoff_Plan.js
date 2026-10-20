// Site Kickoff: the website's seo_cycles row - cycle 0 due at the anchor (now, or the app's trackingStartedAt), in the owner's time zone,
// with what the app already ran left out of cycle 0. The row is built by the cycle kit's own newCycleRow (the dispatcher's adoption uses
// the same one), so the two can never differ: weekday = the anchor's local weekday, local time 06:00, monthly day = the anchor's day of the
// month clamped to 28. Refused, with the reason (and answered 409): a website the engine does not track, a paused one, one whose cycle
// already exists (unless `force`: cycle 0 starts again from the new anchor; on the same local day it is the same cycle, so a job already
// done is not run twice). A dry run writes nothing and answers with the row it would write.
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
  // ---- F-ENG (2026-10-20): the Cycle Dispatcher's watchdog. Every website's week is started by one workflow sweeping every 5 minutes; when it is
  // not published (a deploy imported it and left it inactive) or has stopped sweeping, no website's cycle runs and nothing else says so.
  // Its own record is the evidence: seo_cache `cycle:last` is written at the end of every real sweep (plan_only included). Alarm when the
  // workflow is inactive, or that record is older than `stale_minutes` (no record: older than that since the workflow was last updated),
  // rate-limited to one alarm every `alarm_every_hours` while it lasts; nothing on the door n8n has just started through (its own sweep
  // comes 45 s later) or in a test. o: { wf: {ok, active, updatedAt, error}, last: {updated_at} | null, state, now, entry, test }
  const CW_DEFAULTS = { stale_minutes: 20, alarm_every_hours: 6 };
  const cycleWatchdog = (o) => {
    const c = o || {}, cfg = { ...CW_DEFAULTS, ...(c.config || {}) }, now = ms(c.now) || Date.now(), st = parseValue(c.state || {}), wf = c.wf || {};
    const lastAt = ms(c.last && c.last.updated_at), age = lastAt ? (now - lastAt) / MIN : null;
    const since = wf.ok ? ms(wf.updatedAt) : 0;
    const problems = [];
    if (wf.ok && wf.active === false) problems.push('the Cycle Dispatcher (SEOagentCycleDsp) is not active: no website\'s cycle is started (publish it - a deploy imports it inactive; deploy_manifest.json publishes it)');
    if (lastAt && age > cfg.stale_minutes) problems.push('its last sweep (seo_cache cycle:last) was ' + dur(age) + ' ago, at ' + iso(lastAt) + ' (it sweeps every 5 minutes)');
    else if (!lastAt && (!wf.ok || wf.active !== false) && since && (now - since) / MIN > cfg.stale_minutes) problems.push('it has written no sweep record (seo_cache cycle:last) in the ' + dur((now - since) / MIN) + ' since it was last updated');
    const base = { checked_at: iso(now), last_sweep_at: lastAt ? iso(lastAt) : '', active: wf.ok ? wf.active !== false : null, read: wf.ok ? '' : (S(wf.error) || 'no answer') };
    if (c.test) return { ...base, verdict: 'test', alarm: false, reason: 'a test run of the catch-up does not judge the dispatcher', state: st };
    if (!problems.length) return { ...base, verdict: wf.ok ? 'sweeping' : 'blind', alarm: false, problems: [], reason: wf.ok ? 'active, last sweep ' + (lastAt ? dur(age) + ' ago' : 'none yet (updated ' + (since ? iso(since) : '?') + ')')
      : 'the dispatcher workflow could not be read (' + base.read + '); its last sweep was ' + (lastAt ? dur(age) + ' ago' : 'never recorded'), state: { ...st, down_since: '', last_alarm_at: '' } };
    const down = ms(st.down_since) || now;
    if (c.entry === 'init') return { ...base, verdict: 'starting', alarm: false, problems, reason: 'n8n has just started: the dispatcher\'s own Instance Started sweep comes next, so this is judged at the next catch-up sweep', state: st };
    const lastAlarm = ms(st.last_alarm_at), due = !lastAlarm || now - lastAlarm >= cfg.alarm_every_hours * H;
    return { ...base, verdict: 'down', alarm: due, problems, down_since: iso(down),
      reason: problems.join('; ') + (due ? '' : ' (alerted at ' + iso(lastAlarm) + '; again after ' + cfg.alarm_every_hours + ' h)'),
      state: { ...st, down_since: iso(down), last_alarm_at: due ? iso(now) : S(st.last_alarm_at) } };
  };
  return { plan, lastDue, nextDue, parse, zonedToUtc, offset, stalePlan, lateRun, wall, dur, watchdog, watchdogResult, cycleWatchdog, DEFAULTS, DEAD, WD_DEFAULTS, CW_DEFAULTS, CYCLE_LATE_MIN };
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
    exec_page: 250,             // n8n's public API page maximum (MAX_ITEMS_PER_PAGE, 2.41.4): one read of a 10-minute window of a workflow's runs
    max_exec_reads: 60,         // reads of n8n's executions one sweep may make (a window per job start, the running runs, a run by id)
    max_ledger_reads: 20,       // F-REH: reads of OTHER runs' reservations a sweep may make (any reserved ledger row younger than stale_hours, by id)
    init_quiet_minutes: 2,      // the Instance Started door stands down when a sweep finished this recently (two sweeps never plan from one snapshot)
    retention_days: 120,        // seo_cycle_jobs rows older than this are deleted
    max_open: 3,                // the run guard's limit (RG.MAX_OPEN): the dispatcher never starts into a refusal it can see
    engine_tz: 'America/New_York',
  };
  const TERMINAL = new Set(['done', 'skipped', 'gave_up']);
  const LIVE = new Set(['starting', 'running']);
  // the executions n8n has stopped for good. `error` is one of them (F-ENG 2026-10-20): an execution that ended in an error never settles its
  // ledger row, so a reservation it left would hold a start slot (and refuse the retry as its own twin) for the 2 hours of the stale rule
  const DEAD = new Set(['crashed', 'canceled', 'cancelled', 'error']);
  const CAPACITY = new Set(['same_mode', 'too_many_open', 'heavy_busy']);
  // F-REH: the key under which runsFrom() hands the plan what n8n said about each reservation's execution by id (no workflow has this id)
  const LEDGER_RUNS = '*ledger';
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
  // the site id every engine derives from a domain (Track my site, _monitor_sites.js's virtual sites, the Rank Tracker)
  const siteIdOf = (d) => 'site_' + normD(d).replace(/[^a-z0-9]+/g, '-');
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
  // ---- the anchor a request may set (2026-10-19, agent E4): cycle 0 is due AT the anchor, so it must be recent. The window is one rule for
  // the two writers of a cycle row: Site Kickoff refuses an anchor outside it (400), "Track my site" falls back to now and says why.
  const ANCHOR = { past_days: 6, ahead_hours: 1 };
  const anchorOf = (v, nowMs) => {
    const now = ms(nowMs) || Date.now(), s = S(v);
    if (!s) return { ok: false, given: false, at: now, problem: '', why: 'no tracking start was sent, so the cycle is anchored now' };
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return { ok: false, given: true, at: now, problem: 'not_a_date', why: 'the tracking start "' + s.slice(0, 40) + '" is not a date (ISO 8601 expected), so the cycle is anchored now' };
    if (t < now - ANCHOR.past_days * DAY) return { ok: false, given: true, at: now, problem: 'too_old', days: Math.floor((now - t) / DAY), why: 'the tracking start is ' + Math.floor((now - t) / DAY) + ' days old (cycle 0 starts at the anchor, so it must be within the last ' + ANCHOR.past_days + ' days), so the cycle is anchored now' };
    if (t > now + ANCHOR.ahead_hours * H) return { ok: false, given: true, at: now, problem: 'future', why: 'the tracking start is more than ' + ANCHOR.ahead_hours + ' h in the future (cycle 0 starts at the anchor), so the cycle is anchored now' };
    return { ok: true, given: true, at: t, problem: '', why: 'anchored at the tracking start the request sent (' + iso(t) + ')' };
  };
  // ---- a website's cycle row, ensured: the ONE builder behind Site Kickoff and "Track my site" (plan §4.7 / §14.3), so the two never drift.
  // o: { existing, site_id, domain, tz, anchor, now, skip_jobs, force }
  //  * no row, or `force` (the kickoff's restart): a new row (newCycleRow: anchor, zone, cycle 0 due at the anchor, skip_jobs). A cycle that
  //    is paused or switched off keeps that status through a restart: a restart is not a resume.
  //  * a row: its anchor, weekday, local time, monthly day, due times, current cycle and status are KEPT (a re-save never moves a website's
  //    week, and a paused website stays paused); an empty zone is filled with a valid one, and so is the engine zone of an ADOPTED row (the
  //    dispatcher guessed it, nobody chose it); an empty domain is filled. A row adopted for rank tracking only (a domain with ladders and no
  //    seo_sites row) is kept the same way: once the seo_sites row exists the dispatcher runs it as a normal cycle, from the same anchor.
  // -> { row, write, created, changed: [fields], why }
  const cycleRow = (o) => {
    const c = o || {}, now = ms(c.now) || Date.now(), ex = c.existing && typeof c.existing === 'object' && S(c.existing.site_id) ? c.existing : null;
    const tz = validTz(c.tz) ? S(c.tz) : '';
    if (!ex || c.force) {
      const row = newCycleRow({ site_id: c.site_id, domain: c.domain, tz: tz || S(c.engine_tz) || DEFAULTS.engine_tz, anchor: ms(c.anchor) || now, now, skip_jobs: c.skip_jobs, adopted: false });
      const kept = ex && /^(paused|off)$/i.test(S(ex.status)) ? S(ex.status).toLowerCase() : '';
      if (kept) row.status = kept;
      return { row, write: true, created: !ex, changed: Object.keys(row), why: (ex ? 'cycle 0 starts again from the new anchor (force)' : 'the website\'s first cycle row: cycle 0 is due at ' + row.anchor_at + ' in ' + row.tz)
        + (kept ? '; its cycle stays ' + kept + ' (a restart is not a resume)' : '') };
    }
    const row = cycleRowOf(ex), changed = [];
    if (!S(ex.domain) && normD(c.domain)) { row.domain = normD(c.domain); changed.push('domain'); }
    const guessed = !!yes(ex.adopted) && S(ex.tz) === (S(c.engine_tz) || DEFAULTS.engine_tz);
    if (tz && (!S(ex.tz) || !validTz(ex.tz) || (guessed && tz !== S(ex.tz)))) { row.tz = tz; changed.push('tz'); }
    if (changed.length) row.updated_at = iso(now);
    return { row, write: changed.length > 0, created: false, changed,
      why: 'the website already has its cycle (anchored ' + S(ex.anchor_at) + ', next due ' + (S(ex.next_due_at) || '?') + '): its anchor, weekday and due times are kept'
        + (S(ex.status) && S(ex.status).toLowerCase() !== 'active' ? ', and it stays ' + S(ex.status).toLowerCase() : '')
        + (changed.includes('tz') ? '; its time zone is now ' + row.tz + (S(ex.tz) ? ' (the ' + S(ex.tz) + ' it was adopted in was the engine\'s guess)' : ' (it had none)') : '') };
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
    // a rank-tracking-only cycle (a domain with keyword ladders and no seo_sites row): its ladders' rank check is the one job it has
    if (c.rank_only) return JOBS.map(j => { const on = j.job === 'rank_tracker' && !!st.has_ladder;
      return { ...j, on, why: on ? '' : j.job === 'rank_tracker' ? 'there is no keyword ladder to check any more'
        : 'this domain has keyword ladders but is not tracked ("Track my site" was never set up), so its cycle runs only their rank check', extra: {} }; });
    const why = {
      ai_visibility: st.ai_visibility ? '' : 'AI visibility is switched off for this website',
      backlinks: st.backlinks ? '' : 'the backlink monitor is switched off for this website',
      rank_tracker: st.has_ladder ? '' : 'there is no keyword ladder to check yet',
      // F-REH (2026-10-20): no longer off in every cycle 0. "Track my site" asks for it to be skipped (skip_jobs), and the plan honours that
      // only when the ledger shows the setup run DONE (skipEvidence) - a refused or failed setup run used to mean no site report for 7 days
      site_tracker: '',
      ai_growth: !st.ai_visibility ? 'AI visibility is switched off, and AI growth reads its question panel' : st.ai_growth ? '' : 'AI growth is switched off for this website',
      content_cadence: st.cadence ? '' : st.cadence_off ? 'the content cadence is switched off' : 'no pages a week are set (0), so nothing is written',
      link_builder: st.link_builder ? '' : 'link building is switched off for this website',
      audit: !monthly ? 'the audit runs on the website\'s monthly cycle only' : st.audit_monthly ? '' : 'the monthly audit is switched off for this website',
    };
    const ev = c.skip_evidence || {};
    return JOBS.map(j => {
      let reason = why[j.job] || '';
      if (!reason && skip.has(j.job)) { const e = ev[j.job];
        reason = 'already run when tracking was set up' + (e && S(e.run_id) ? ' (execution ' + S(e.run_id) + ', finished ' + (S(e.at) || 'earlier') + ')' : ' (skip_jobs)') + ', so cycle 0 does not run it twice'; }
      return { ...j, on: !reason, why: reason, extra: j.job === 'backlinks' ? { light: !monthly } : {} };
    });
  };
  // ---- F-REH (2026-10-20, real-credit rehearsal): a cycle-0 skip is a CLAIM ("the setup already ran it"), checked against the ledger ----
  // "Track my site" writes skip_jobs = site_tracker when it creates the cycle row, before it knows whether its own Site Tracker run worked; in
  // the rehearsal that run was refused (too_many_open) and the client had no site report for 7 days. A skip_jobs entry is honoured only when a
  // ledger row of that job's mode for this website is DONE (settled) since the anchor (less a 10-minute grace for the app's and the engine's
  // clocks). Anything else - refused, crashed, still running, no row at all - and the job runs in cycle 0 in its normal order (a setup run
  // still in flight is its twin, so the dispatcher waits for it and judges again). Only cycle 0 has skip_jobs.
  // The modes a job's run reserves under: its own workflow's, and for the audit also the main workflow's audit run (what the app's setup
  // starts) - the Audit Scheduler spawns its audits there and reserves nothing itself.
  const DONE_MODES = { audit: ['audit_schedule', 'audit'] };
  const SKIP_GRACE_MS = 10 * MIN;
  // o: { skip_jobs: [job], domain, anchor (ms), ledger } -> { honoured: [job], evidence: { job: { run_id, at } }, not: [{ job, why }] }
  const skipEvidence = (o) => {
    const c = o || {}, dom = normD(c.domain), from = (ms(c.anchor) || 0) - SKIP_GRACE_MS, out = { honoured: [], evidence: {}, not: [] };
    for (const job of (c.skip_jobs || [])) {
      const J = BY_JOB[job]; if (!J) continue;
      const modes = DONE_MODES[job] || [J.mode];
      const rows = (c.ledger || []).filter(r => r && modes.includes(S(r.mode)) && dom && normD(r.domain) === dom && ms(r.created_at) >= from)
        .sort((x, y) => ms(x.created_at) - ms(y.created_at));
      const done = rows.filter(r => S(r.status) === 'done');
      if (done.length) { const d = done[done.length - 1]; out.honoured.push(job); out.evidence[job] = { run_id: S(d.run_id), at: S(d.settled_at) || S(d.created_at) }; continue; }
      const last = rows[rows.length - 1];
      out.not.push({ job, why: !last ? 'the setup asked to skip ' + J.label + ' in cycle 0, but the ledger has no run of it for ' + (dom || 'this website') + ' since tracking started, so it runs in cycle 0'
        : 'the setup asked to skip ' + J.label + ' in cycle 0, but its run (execution ' + S(last.run_id) + ') ended "' + (S(last.status) || 'unknown') + '", not done, so it runs in cycle 0'
          + (S(last.status) === 'refused' ? ' (' + refusalOf(last) + ')' : '') });
    }
    return out;
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
  // a: { row, ledger, runs: {workflow_id: {ok, data: [{id, mode, status, startedAt, stoppedAt}], byId: {id: execution}, incomplete: [{from, to, oldest}],
  //      (legacy: full, oldest)}}, claimed: Set of run ids other keys own, now, cfg }
  // -> { state: done | running | starting | refused | failed | blind, reason, run_id, finished_at, code, release?, unsettled? }
  // F-ENG (2026-10-20, production-safety review): what n8n says about the execution behind a RESERVED row decides first. An execution that
  // ended in `error` (or was crashed / canceled) is failed at once and its reservation released, so it never holds a start slot for the 2 h
  // of the stale rule; one that ended in `success` with its row still reserved finished - its settle failed - so it is done (never paid for
  // twice) and named as unsettled money for the ops alert. A run that cannot be confirmed is `blind` for at most `stale_hours`, then failed.
  const outcome = (a) => {
    const c = a || {}, row = c.row || {}, cfg = c.cfg || DEFAULTS, now = c.now;
    const lk = S(row.ledger_key) || ledgerKey(row.cycle_key, row.job), T = ms(row.started_at) || ms(row.updated_at);
    const after = (r) => ms(r.created_at) >= T - 5000;
    const rows = (c.ledger || []).filter(r => r && S(r.key) === lk && after(r)).sort((x, y) => ms(x.created_at) - ms(y.created_at));
    const parts = (c.ledger || []).filter(r => r && S(r.key).startsWith(lk + ':part') && after(r)).sort((x, y) => ms(x.created_at) - ms(y.created_at));
    const run = (c.runs || {})[S(row.workflow_id)] || {};
    // an execution by id: the direct read (GET /executions/<id> lists a running one too), else the windowed list
    const execOf = (id) => { if (!S(id)) return null; const b = run.byId && run.byId[S(id)]; if (b) return b; return run.ok ? (run.data || []).find(x => S(x.id) === S(id)) || null : null; };
    const done = rows.filter(r => S(r.status) === 'done');
    // AI Visibility may settle the final key at $0 when it hands over to a chain that resumes, and that chain settles it again later: a
    // `:part<n>` row NEWER than the last settled final row means the job is still going (a key settling twice is fine: done stays done)
    const lastDone = done.length ? done[done.length - 1] : null;
    const resumed = lastDone ? parts.filter(p => ms(p.created_at) > ms(lastDone.created_at)) : [];
    if (resumed.length) { parts.splice(0, parts.length, ...resumed); rows.splice(0, rows.length); }
    else if (done.length) { const d = lastDone;
      return { state: 'done', run_id: S(d.run_id), finished_at: S(d.settled_at) || iso(now), reason: 'finished: its ledger row ' + lk + ' settled' + (S(d.settled_at) ? ' at ' + S(d.settled_at) : '') + ' (execution ' + S(d.run_id) + ')' + (S(d.dfs_source) === 'handoff' ? ', handed off' : '') }; }
    const reserved = rows.filter(r => S(r.status) === 'reserved');
    if (reserved.length) { const l = reserved[reserved.length - 1], id = S(l.run_id), x = execOf(id), xs = x ? S(x.status) : '';
      if (x && DEAD.has(xs)) return { state: 'failed', run_id: id, release: id, reason: xs === 'error'
        ? 'its run (execution ' + id + ') ended with an error before it settled its ledger row ' + lk + ' (n8n status "error")'
        : 'its run (execution ' + id + ') was ' + xs + ' by n8n before it finished (a restart, a deploy or a time-out)' };
      if (x && xs === 'success') return { state: 'done', run_id: id, release: id, finished_at: S(x.stoppedAt) || iso(now),
        unsettled: { run_id: id, ledger_key: lk, reserved_at: S(l.created_at), stopped_at: S(x.stoppedAt), mode: S(l.mode), domain: S(l.domain) },
        reason: 'the run finished (execution ' + id + ' ended "success") but its ledger row ' + lk + ' was not settled: its money is not on record (ops alert raised); the job is not run again' };
      if (!isStale(l, now, cfg.stale_hours)) return { state: 'running', run_id: id, reason: 'running (execution ' + id + ', ledger row reserved at ' + S(l.created_at) + (xs ? ', n8n says "' + xs + '"' : '') + ')' };
    }
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
      if (pt === 'reserved' && x && DEAD.has(S(x.status))) return { state: 'failed', run_id: S(p.run_id), release: S(p.run_id), reason: 'part ' + S(p.key).slice(lk.length + 1) + ' (execution ' + S(p.run_id) + ') was ' + (S(x.status) === 'error' ? 'stopped by an error' : S(x.status) + ' by n8n') };
      if (isStale(p, now, cfg.stale_hours) || (pt === 'done' && now - (ms(p.settled_at) || ms(p.created_at)) > cfg.stale_hours * H))
        return { state: 'failed', run_id: S(p.run_id), reason: 'the split run stopped after ' + S(p.key).slice(lk.length + 1) + ' (no later part and no final ledger row for ' + cfg.stale_hours + ' h)' };
      return { state: 'running', run_id: S(p.run_id), reason: 'running in parts: ' + S(p.key).slice(lk.length + 1) + ' is ' + (pt === 'done' ? 'settled, the next part is on its way' : 'in flight') + ' (execution ' + S(p.run_id) + ')' };
    }
    // no ledger row yet: what n8n says about the workflow's runs after our start
    const age = now - T, overdue = age > cfg.stale_hours * H;
    if (!run.ok) {
      if (overdue) return { state: 'failed', reason: 'no ledger row under ' + lk + ' ' + Math.round(age / MIN) + ' min after the start, and n8n\'s executions could not be read (' + (S(run.error) || 'no answer') + ')' };
      return { state: 'blind', reason: 'no ledger row yet and n8n\'s executions could not be read (' + (S(run.error) || 'no answer') + '); looked at again next sweep (at most ' + cfg.stale_hours + ' h)' };
    }
    const mine = (run.data || []).filter(x => S(x.mode) !== 'trigger' && ms(x.startedAt) >= T - 5000 && ms(x.startedAt) <= T + cfg.confirm_minutes * MIN && !(c.claimed && c.claimed.has(S(x.id))))
      .sort((x, y) => ms(x.startedAt) - ms(y.startedAt));
    const alive = mine.filter(x => !DEAD.has(S(x.status)) && S(x.status) !== 'success');
    if (alive.length) return { state: overdue ? 'failed' : 'running', run_id: S(alive[0].id), reason: overdue
      ? 'its run (execution ' + S(alive[0].id) + ') has reserved no ledger row in ' + Math.round(age / MIN) + ' min' : 'started (execution ' + S(alive[0].id) + ', n8n says "' + S(alive[0].status) + '"), no ledger row yet' };
    if (mine.length) { const x = mine[0];
      if (S(x.status) === 'success') return { state: 'done', run_id: S(x.id), finished_at: S(x.stoppedAt) || iso(now), reason: 'finished (execution ' + S(x.id) + ' success) but left no ledger row under ' + lk + ' - its plan node does not key cycle runs yet' };
      return { state: 'failed', run_id: S(x.id), reason: 'its run (execution ' + S(x.id) + ') ended "' + S(x.status) + '" before it reserved its ledger row' }; }
    // the reads could not cover the start: a full page (more runs than one read holds), or a read this sweep did not make. Not knowing is
    // `blind` - never "nothing started" - and blind is bounded: after stale_hours the job is failed (and retried, or given up)
    const cut = (run.full && ms(run.oldest) > T) || (run.incomplete || []).some(w => (!S(w.from) || T >= ms(w.from) - 5000) && (!S(w.to) || T <= ms(w.to) + 5000) && (!ms(w.oldest) || ms(w.oldest) > T));
    if (cut) return overdue
      ? { state: 'failed', reason: 'no ledger row under ' + lk + ' in ' + Math.round(age / MIN) + ' min, and n8n\'s executions around the start could not be read in full (more runs than one page holds) - not confirmed in ' + cfg.stale_hours + ' h, so it is treated as failed' }
      : { state: 'blind', reason: 'more runs of the workflow around the start than one read of n8n\'s executions holds; looked at again next sweep (at most ' + cfg.stale_hours + ' h)' };
    if (age > cfg.confirm_minutes * MIN) return { state: 'failed', reason: 'no run of its workflow appeared in the ' + cfg.confirm_minutes + ' min after it was recorded (the sweep stopped between the record and the start, or n8n refused the start)' };
    return { state: 'starting', reason: 'recorded at ' + iso(T) + ', waiting for its run to appear' };
  };
  // ---- n8n's executions the plan needs, as reads of the public API (n8n 2.41.4, dist/public-api/v1/controllers/executions.public.controller.js):
  //  * GET /executions lists FINISHED executions only unless `status=running` (`excludeRunning: query.status !== 'running'`), newest id first,
  //    at most 250 a page (`limit`), with a `nextCursor` when more match; `startedAfter` / `startedBefore` filter startedAt, both inclusive.
  //  * GET /executions/<id> returns one execution whatever its status (a running one too), 404 when it is gone (pruned).
  // So per workflow with a job starting or running: its RUNNING executions (the slow-to-reserve run the default list never shows), each
  // reservation's own execution by id, and a 10-minute window of finished runs after each start. Bounded: at most max_exec_reads a sweep;
  // a read not made is reported as `unread`, and the plan treats the start it covered as not confirmable (blind, bounded) - never as "none".
  // o: { jobs, ledger, known: [workflow ids], api, cfg } -> { reads: [{workflow_id, kind, url, from?, to?, run_id?}], unread: [...] }
  const execReads = (o) => {
    const c = o || {}, cfg = { ...DEFAULTS, ...(c.cfg || {}) }, known = new Set((c.known || []).map(S)), api = S(c.api).replace(/\/+$/, '');
    const page = Math.min(250, Math.max(1, Number(cfg.exec_page) || 250));
    const open = (c.jobs || []).filter(r => r && typeof r === 'object' && !r.error && S(r.key) && S(r.job) !== 'cycle' && LIVE.has(S(r.status)) && known.has(S(r.workflow_id)));
    const ledger = (c.ledger || []).filter(r => r && typeof r === 'object' && !r.error);
    const all = [], seen = new Set();
    const add = (x) => { if (seen.has(x.url)) return; seen.add(x.url); all.push(x); };
    const q = (v) => encodeURIComponent(v);
    for (const wf of [...new Set(open.map(r => S(r.workflow_id)))].sort()) {
      const mine = open.filter(r => S(r.workflow_id) === wf);
      const Ts = mine.map(r => ms(r.started_at) || ms(r.updated_at)).filter(Boolean).sort((x, y) => x - y);
      const from0 = Ts.length ? iso(Ts[0] - 5000) : '';
      add({ workflow_id: wf, kind: 'running', from: from0, to: '', url: api + '/executions?workflowId=' + q(wf) + '&status=running' + (from0 ? '&startedAfter=' + q(from0) : '') + '&limit=' + page });
      for (const r of mine) {
        const lk = S(r.ledger_key) || ledgerKey(r.cycle_key, r.job), T = ms(r.started_at) || ms(r.updated_at);
        for (const l of ledger) if ((S(l.key) === lk || S(l.key).startsWith(lk + ':part')) && S(l.status) === 'reserved' && /^\d+$/.test(S(l.run_id)) && ms(l.created_at) >= T - 5000)
          add({ workflow_id: wf, kind: 'id', run_id: S(l.run_id), url: api + '/executions/' + q(S(l.run_id)) });
      }
      // the windows of finished runs, overlapping ones merged
      const wins = Ts.map(t => [t - 5000, t + cfg.confirm_minutes * MIN + MIN]);
      const merged = []; for (const w of wins) { const m = merged[merged.length - 1]; if (m && w[0] <= m[1]) m[1] = Math.max(m[1], w[1]); else merged.push([...w]); }
      for (const [a, b] of merged) add({ workflow_id: wf, kind: 'window', from: iso(a), to: iso(b),
        url: api + '/executions?workflowId=' + q(wf) + '&startedAfter=' + q(iso(a)) + '&startedBefore=' + q(iso(b)) + '&limit=' + page });
    }
    const cap = Math.max(1, Number(cfg.max_exec_reads) || 60);
    // F-REH (2026-10-20, real-credit rehearsal): EVERY run still `reserved` in the ledger - not only the dispatcher's own jobs - is read by id.
    // A restart (every production deploy) crashes the runs in flight; their rows stayed `reserved` for the 2-hour stale rule and counted toward
    // the run guard's MAX_OPEN (3) for every other run (the rehearsal: a crashed `keyword` run refused the client's first Site Tracker run). A
    // row older than the stale window is already ignored by the guard (and marked by *Release Stale Runs*), so only younger rows are read,
    // oldest first, at most max_ledger_reads a sweep; a read the cap leaves out is reported in `unread` and judged at a later sweep.
    const now = ms(c.now) || 0, sh = Number(cfg.stale_hours) > 0 ? Number(cfg.stale_hours) : DEFAULTS.stale_hours;
    const ghosts = ledger.filter(l => S(l.status) === 'reserved' && /^\d+$/.test(S(l.run_id)) && (!now || !isStale(l, now, sh)))
      .sort((x, y) => ms(x.created_at) - ms(y.created_at) || Number(x.run_id) - Number(y.run_id));
    const greads = [];
    for (const l of ghosts) { const url = api + '/executions/' + q(S(l.run_id)); if (seen.has(url)) continue; seen.add(url); greads.push({ workflow_id: '', kind: 'ledger', run_id: S(l.run_id), key: S(l.key), url }); }
    const gcap = Math.max(0, Number.isFinite(Number(cfg.max_ledger_reads)) ? Number(cfg.max_ledger_reads) : DEFAULTS.max_ledger_reads);
    return { reads: [...all.slice(0, cap), ...greads.slice(0, gcap)], unread: [...all.slice(cap), ...greads.slice(gcap)] };
  };
  // what the reads answered, per workflow, in the shape outcome() reads. `responses[i]` is the HTTP node's full response to reads[i]
  // ({ statusCode, body }); a list answer is { data: [...], nextCursor }, a by-id answer the execution itself.
  const runsFrom = (reads, responses, unread) => {
    const code = (r) => Number(r && r.statusCode) || 0;
    const bodyOf = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(S(b) || '{}'); } catch (e) { return {}; } };
    const failed = (r) => code(r) ? 'HTTP ' + code(r) : S((r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 160);
    const ex = (d) => ({ id: S(d.id), mode: S(d.mode), status: S(d.status), startedAt: S(d.startedAt), stoppedAt: S(d.stoppedAt) });
    const runs = {};
    const of = (wf) => runs[wf] || (runs[wf] = { ok: true, data: [], byId: {}, incomplete: [], errors: [] });
    // F-REH: every by-id answer, whatever workflow it belongs to, under LEDGER_RUNS - what n8n says about each reservation's execution
    // (`byId`), the ones n8n no longer has (`gone`: a 404) and the reads that failed (no evidence either way)
    const G = { byId: {}, gone: {}, errors: [] };
    (reads || []).forEach((t, i) => {
      if (!t) return;
      const x = (responses || [])[i] || {}, b = bodyOf(x);
      if (t.kind === 'id' || t.kind === 'ledger') {
        if (code(x) === 200 && S(b.id)) G.byId[S(b.id)] = ex(b);
        else if (code(x) === 404 && S(t.run_id)) G.gone[S(t.run_id)] = true;
        else if (t.kind === 'ledger') G.errors.push('execution ' + S(t.run_id) + ': ' + failed(x));
      }
      if (!S(t.workflow_id)) return;
      const R = of(S(t.workflow_id));
      if (t.kind === 'id') {
        if (code(x) === 200 && S(b.id)) R.byId[S(b.id)] = ex(b);
        else if (code(x) !== 404) R.errors.push('execution ' + S(t.run_id) + ': ' + failed(x));   // 404 = pruned: no evidence, not an error
        return;
      }
      if (code(x) === 200 && Array.isArray(b.data)) {
        const rows = b.data.map(ex);
        for (const r of rows) if (!R.data.some(y => y.id === r.id)) R.data.push(r);
        if (b.nextCursor) R.incomplete.push({ kind: S(t.kind), from: S(t.from), to: S(t.to), oldest: rows.map(r => r.startedAt).filter(Boolean).sort()[0] || '' });
      } else { R.ok = false; R.error = failed(x); R.errors.push(failed(x) + (S(t.kind) ? ' (' + S(t.kind) + ' read)' : '')); }
    });
    for (const t of (unread || [])) if (t && S(t.workflow_id)) {
      const R = of(S(t.workflow_id));
      if (t.kind !== 'id') R.incomplete.push({ kind: S(t.kind), from: t.kind === 'running' ? '' : S(t.from), to: t.kind === 'running' ? '' : S(t.to), oldest: '', unread: true });
    }
    if (Object.keys(G.byId).length || Object.keys(G.gone).length || G.errors.length) runs[LEDGER_RUNS] = G;
    return runs;
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
    // F-ENG (2026-10-20): a table that could not be read is never read as an empty one. An error item from ANY load - the schedule, the job
    // rows, the ledger, the websites, or a website's own settings (monitors, cadence, ladders, ladder settings) - refuses the whole sweep:
    // read as empty, a missing monitors or cadence row would switch jobs off and skip paid work with a false reason ("switched off").
    const BAD = [['cycles', 'seo_cycles'], ['jobs', 'seo_cycle_jobs'], ['ledger', 'seo_run_ledger'], ['sites', 'seo_sites'], ['monitors', 'seo_monitors'],
      ['cadence', 'seo_cadence'], ['ladders', 'the keyword ladders (seo_ladders)'], ['ladder_settings', 'seo_ladder_settings']];
    for (const [k, what] of BAD) { const bad = (Array.isArray(c[k]) ? c[k] : []).find(r => r && typeof r === 'object' && r.error);
      if (bad) throw new Error('CYC.plan: ' + what + ' could not be read (' + S(bad.error && (bad.error.message || bad.error)).slice(0, 200) + '): nothing is planned from a partial picture, so no job is started or skipped this sweep'); }
    const clean = (a) => (a || []).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length);
    const sites = clean(c.sites).filter(r => S(r.site_id) && S(r.domain)), cycles = clean(c.cycles).filter(r => S(r.site_id));
    const ledger = clean(c.ledger).filter(r => S(r.run_id) || S(r.key)), runs = c.runs || {};
    const loaded = clean(c.jobs).filter(r => S(r.key));
    const byKey = new Map(loaded.map(r => [S(r.key), jobRow(r)]));
    const orig = new Map(loaded.map(r => [S(r.key), jobRow(r)]));
    const siteOf = new Map(sites.map(s => [S(s.site_id), s]));
    const monOf = new Map(clean(c.monitors).filter(m => S(m.site_id)).map(m => [S(m.site_id), m]));
    const cadOf = new Map(clean(c.cadence).filter(m => S(m.site_id)).map(m => [S(m.site_id), m]));
    const ladderRowDomains = new Set(clean(c.ladders).map(l => normD(l.domain)).filter(Boolean));   // domains with ladder rungs (the dispatcher hands in the fit-gated ones)
    const ladderDomains = new Set(ladderRowDomains);
    for (const s of clean(c.ladder_settings)) if (S(s.ladder_id) && S(s.ladder_id) !== '_site' && !/^(deleted|archived)$/i.test(S(s.status))) ladderDomains.add(normD(s.domain));
    // run ids another job's ledger row owns: an execution that belongs to someone else is never taken for ours
    const claimedBy = new Map(); for (const r of ledger) if (S(r.run_id) && S(r.key)) claimedBy.set(S(r.run_id), S(r.key));
    const rows = [], sitesOut = [], cycleRows = [], cands = [], gaveUp = [], adopted = [], unsettled = [];
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
      // a run that finished with its ledger row unsettled: its money is not on record - named once, the sweep its job turns done (the ops alert)
      if (ev.unsettled) unsettled.push({ key: r.key, site_id: S(r.site_id), job: S(r.job), domain: normD((siteOf.get(S(r.site_id)) || {}).domain) || normD(ev.unsettled.domain), ...ev.unsettled });
    }
    // a refused job waiting for room keeps its bound: 24 h of refusals in a row, then it gives up
    for (const r of [...byKey.values()]) {
      if (S(r.status) !== 'refused' || touch.has(r.key)) continue;
      const since = refusedSince(ledger, r.ledger_key || ledgerKey(r.cycle_key, r.job));
      if (since && now - since >= cfg.refusal_hours * H) { put({ ...r, status: 'gave_up', finished_at: nowIso, reason: 'gave up: refused for capacity for ' + Math.round((now - since) / H) + ' h without a break' }); gaveUp.push(r.key); }
    }
    // ---- 1b. F-REH (2026-10-20, real-credit rehearsal): ghost reservations of ANY run. An n8n restart crashed a `keyword` run of the main
    // workflow; its row stayed `reserved` until the 2-hour stale rule and held one of the run guard's MAX_OPEN slots for every other run, so
    // the client's first Site Tracker run was refused. Every reservation younger than the stale window is judged by what n8n says about its
    // execution (CYC.execReads read it by id): crashed / canceled / error = it can never settle; success = it finished without settling (its
    // settle failed); a 404 while no read lists it running = n8n no longer has it. Each is released (`stale`, the state *Release Stale Runs*
    // writes, with the reason in its cost_basis). No answer, or a run still running / waiting / new, is left alone (no evidence, no release).
    const ghosts = [];
    const LR = runs[LEDGER_RUNS] || null;
    if (LR) {
      const alive = new Set(); for (const [w, r] of Object.entries(runs)) if (w !== LEDGER_RUNS && r && Array.isArray(r.data)) for (const e of r.data) if (!DEAD.has(S(e.status)) && S(e.status) !== 'success') alive.add(S(e.id));
      for (const l of ledger) {
        const id = S(l.run_id);
        if (S(l.status) !== 'reserved' || !/^\d+$/.test(id) || release.has(id) || isStale(l, now, cfg.stale_hours)) continue;
        const x = LR.byId[id] || null, xs = x ? S(x.status) : '';
        const what = (S(l.mode) || 'a') + ' run' + (normD(l.domain) ? ' of ' + normD(l.domain) : '') + ' (execution ' + id + ', ledger row ' + (S(l.key) || '?') + ', reserved ' + (S(l.created_at) || '?') + ')';
        let why = '';
        if (x && DEAD.has(xs)) why = 'the ' + what + (xs === 'error' ? ' ended with an error' : ' was ' + xs + ' by n8n (a restart, a deploy or a time-out)') + ' before it settled its reservation';
        else if (x && xs === 'success') why = 'the ' + what + ' finished ("success") without settling its reservation';
        else if (!x && LR.gone[id] && !alive.has(id)) why = 'n8n no longer has the ' + what + ' and no read lists it running';
        if (!why) continue;
        why += ', so it no longer holds a run-guard slot (released by the cycle dispatcher, not after the ' + cfg.stale_hours + '-hour stale rule)';
        release.set(id, { run_id: id, key: S(l.key), reason: why, ghost: true });
        ghosts.push({ run_id: id, key: S(l.key), mode: S(l.mode), domain: normD(l.domain), status: xs || 'gone', reserved_at: S(l.created_at), reason: why });
      }
    }
    // the release carries the row's own cost_basis, so *Release Dead Runs* keeps what the reservation said beside why it was released
    for (const [id, v] of release) { const l = ledger.find(r => S(r.run_id) === id && S(r.status) === 'reserved'); if (l && !v.was) v.was = S(l.cost_basis).slice(0, 200); }

    // ---- 2. adoption: a tracked, active website with no cycle row gets one now (the kickoff's safety net, plan §4.7) ----
    const cyc = new Map(cycles.map(r => [S(r.site_id), r]));
    for (const s of sites) {
      if (cyc.has(S(s.site_id)) || S(s.status).toLowerCase() === 'paused') continue;
      const row = newCycleRow({ site_id: s.site_id, domain: s.domain, tz: engineTz, anchor: now, now, adopted: true });
      cyc.set(S(s.site_id), { ...row, __new: true }); adopted.push({ site_id: S(s.site_id), domain: normD(s.domain), anchor_at: row.anchor_at, tz: row.tz, rank_only: false });
    }
    // ... and a domain with keyword ladders but no seo_sites row (a ladder started through the API, or before "Track my site"): the Monday
    // Rank Tracker used to check every ladder; with no cron left, it gets a RANK-TRACKING-ONLY cycle (2026-10-19, agent E4). Anchored now, in
    // the engine zone, adopted. Only the rank check ever runs for it (jobsFor rank_only); the Rank Tracker takes the e-mail and callback from
    // the ladder rows, as it always did. When "Track my site" writes its seo_sites row, the same row is its normal cycle, same anchor.
    const siteDomains = new Set(sites.map(s => normD(s.domain)));
    const cycDomains = new Set(cycles.map(r => normD(r.domain)).filter(Boolean));
    for (const d of [...ladderRowDomains].sort()) {
      const sid = siteIdOf(d);
      if (siteDomains.has(d) || cyc.has(sid) || cycDomains.has(d)) continue;
      const row = newCycleRow({ site_id: sid, domain: d, tz: engineTz, anchor: now, now, adopted: true });
      cyc.set(sid, { ...row, __new: true }); adopted.push({ site_id: sid, domain: d, anchor_at: row.anchor_at, tz: row.tz, rank_only: true });
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
      // F-ENG (2026-10-20): a row that exists is UPDATED with only the fields this sweep changed (`changed`), so an app PATCH made mid-sweep
      // (Settings -> weekday) is never overwritten from this sweep's snapshot; only a new (adopted) row is written whole (`created`)
      const finish = () => { const before = raw.__new ? null : cycleRowOf(raw);
        const changed = before ? [...CYCLE_FIELDS.filter(f => S(before[f]) !== S(next[f])), ...(normD(before.domain) !== domain ? ['domain'] : [])] : [];
        if (!before || changed.length) cycleRows.push({ ...cycleRowOf({ ...next, updated_at: nowIso }), created: !before, changed: before ? changed : ['*'] }); };
      // no seo_sites row, but keyword ladders: a rank-tracking-only cycle (the monitors are off by definition: nobody set them up)
      const rankOnly = !site && ladderRowDomains.has(domain);
      out.rank_only = rankOnly;
      const st = rankOnly ? { monitors: {}, cadence: null, has_ladder: true } : { monitors: monOf.get(siteId) || {}, cadence: cadOf.get(siteId) || null, has_ladder: ladderDomains.has(domain) };
      const settings = settingsOf(st);
      // the cycle that is due now, if any (most recent only; the 12-hour gap)
      const mr = mostRecent(rd, now, cfg);
      let opened = null, skippedCycle = null;
      const paused = !site && !rankOnly ? 'it is no longer tracked by the engine (no seo_sites row, and no keyword ladder to rank-check)' : site && S(site.status).toLowerCase() === 'paused' ? 'the website is paused'
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
      // F-REH: cycle 0's skip_jobs, each checked against the ledger (a setup run that did not finish is not a reason to skip a job)
      const sk = zeroNow && rd.skip_jobs.length ? skipEvidence({ skip_jobs: rd.skip_jobs, domain, anchor: rd.anchor, ledger }) : { honoured: [], evidence: {}, not: [] };
      if (zeroNow && rd.skip_jobs.length) out.skip_checks = [...sk.honoured.map(j => ({ job: j, honoured: true, run_id: sk.evidence[j].run_id })), ...sk.not.map(x => ({ job: x.job, honoured: false, why: x.why }))];
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
        out.jobs = ck ? jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: sk.honoured, skip_evidence: sk.evidence, rank_only: rankOnly }).map(j => { const r = byKey.get(ck + ':' + j.job); return { job: j.job, verdict: r ? S(r.status) : 'paused', reason: r ? S(r.reason) : paused }; }) : [];
        finish(); continue; }
      if (!ck) { say('not_due', 'cycle 0 is due ' + next.next_due_at); finish(); continue; }
      // ---- the jobs of the current cycle, in order: a job starts only when every earlier one is done, skipped or gave up ----
      const list = jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: sk.honoured, skip_evidence: sk.evidence, rank_only: rankOnly });
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
    // ---- 5. what to write: only rows that changed (a sweep every 5 minutes writes nothing on a quiet day) ----
    const jobRows = [...touch].map(k => byKey.get(k)).filter(r => !orig.has(r.key) || !sameJob(r, orig.get(r.key))).map(r => jobRow(r));
    // F-ENG (2026-10-20, the claim): what each job's row must still hold when its start is recorded - the row this sweep wrote, else the row
    // it read (null: no row). *Cycle Record Row* reads the row again first and backs off when it changed (another sweep claimed it after
    // this plan was made); the claim it then writes carries a token no other sweep can produce, read back after the save.
    const written = new Map(jobRows.map(r => [r.key, r]));
    const expectOf = (key) => { const r = written.get(key) || orig.get(key); return r ? { status: S(r.status), run_id: S(r.run_id), updated_at: S(r.updated_at) } : null; };
    const starts = start.map(({ k, __would }) => ({ would: !!__would, key: k.key, expect: expectOf(k.key), site_id: k.siteId, cycle_key: k.cycle_key, job: k.job.job, workflow_id: k.job.workflow_id,
      attempts: k.attempt, ledger_key: k.ledger_key, monthly: !!k.monthly, due_at: iso(k.due), retry_of: k.prior ? S(k.prior.reason).slice(0, 300) : '',
      why: (k.prior ? (S(k.prior.status) === 'failed' ? 'attempt ' + k.attempt + ' (the last one failed)' : 'again after a capacity refusal (attempt ' + k.attempt + ')') : 'next in the cycle') + ' - ' + k.job.label + ' for ' + k.domain,
      payload: payload({ domain: k.domain, site_id: k.siteId, cycle_key: k.cycle_key, job: k.job.job, monthly: k.monthly, scheduled_for: k.scheduled_for, tz: k.tz }), plan_now: nowIso }));
    const realStarts = starts.filter(s => !s.would), wouldStarts = starts.filter(s => s.would);
    const counts = {}; for (const s of sitesOut) for (const j of s.jobs) counts[j.verdict] = (counts[j.verdict] || 0) + 1;
    const gave = [...new Set(gaveUp)].map(k => byKey.get(k)).filter(Boolean).map(r => ({ key: r.key, site_id: r.site_id, job: r.job, domain: (sitesOut.find(s => s.site_id === r.site_id) || {}).domain || '', reason: S(r.reason) }));
    return { now: nowIso, entry: S(c.entry) || 'sweep', mode: planOnly ? 'plan_only' : 'start', configured_mode: S(c.mode) === 'start' ? 'start' : 'plan_only', dry_run: dry, engine_tz: engineTz,
      sites: sitesOut, adopted, open_jobs: open.length, live_runs: live.length, room: take, max_inflight: cfg.max_inflight, max_open: cfg.max_open,
      cycle_rows: planOnly ? [] : cycleRows, job_rows: planOnly ? [] : jobRows, start: planOnly ? [] : realStarts.map(s => { const { would, ...x } = s; return x; }),
      would: planOnly ? { cycle_rows: cycleRows, job_rows: jobRows, release: [...release.values()], ghosts, unsettled, start: wouldStarts.map(s => { const { would, ...x } = s; return x; }) } : null,
      release: planOnly ? [] : [...release.values()], ghosts: planOnly ? [] : ghosts, gave_up: planOnly ? [] : gave, unsettled: planOnly ? [] : unsettled, retention: { before: iso(now - cfg.retention_days * DAY), days: cfg.retention_days, run: !planOnly },
      counts, basis: sitesOut.length + ' website(s) read (' + adopted.length + ' adopted); ' + (planOnly ? wouldStarts.length + ' start(s) planned, none made (' + (dry ? 'dry run' : 'plan_only') + ')' : realStarts.length + ' start(s)')
        + ', ' + open.length + ' job(s) in flight, ' + live.length + ' run(s) holding the run guard' + (ghosts.length ? ', ' + ghosts.length + ' dead reservation(s) of other runs ' + (planOnly ? 'found (not released: ' + (dry ? 'dry run' : 'plan_only') + ')' : 'released') : '') };
  };

  // ---- the claim (F-ENG 2026-10-20): is the job's row still what this sweep planned from? `current` = the rows a read of that key returned
  // just before the claim is written; `expect` = the plan's view ({status, run_id, updated_at}, or null for "no row yet"). Anything else
  // means another sweep (an Instance Started door landing on a cron sweep, say) recorded the job after this plan was made: back off.
  const claimFree = (expect, current) => {
    const all = Array.isArray(current) ? current : [current];
    const err = all.find(r => r && typeof r === 'object' && r.error);
    if (err) return { ok: false, reason: 'the job row could not be read before the claim (' + S(err.error && (err.error.message || err.error)).slice(0, 160) + '), so nothing is started; the next sweep decides again' };
    const cur = all.find(r => r && typeof r === 'object' && S(r.key)) || null;
    const show = (r) => '"' + S(r.status) + '", claim ' + (S(r.run_id) || 'none') + ', written ' + (S(r.updated_at) || '?');
    if (!expect) return cur ? { ok: false, reason: 'another dispatcher sweep recorded this job after this sweep planned (the row is now ' + show(cur) + '), so this one backs off' } : { ok: true, reason: '' };
    if (!cur) return { ok: false, reason: 'the job row this sweep planned from is gone, so nothing is started; the next sweep decides again' };
    if (S(cur.status) !== S(expect.status) || S(cur.run_id) !== S(expect.run_id) || S(cur.updated_at) !== S(expect.updated_at))
      return { ok: false, reason: 'the job row changed after this sweep planned (now ' + show(cur) + ', planned from ' + show(expect) + '): another sweep claimed it, so this one backs off' };
    return { ok: true, reason: '' };
  };
  // a claim nobody else can write: this execution, the moment and a random part (the read-back compares it exactly)
  const claimToken = (execId, at, rnd) => 'dsp:' + S(execId) + ':' + Number(ms(at) || Date.now()).toString(36) + ':' + S(rnd || Math.random().toString(36).slice(2, 10));

  // ===== the deploy guard's question (apply_env.py / deploy_engine.py ask it in Python: deploy_guard.py; n8n/deploy/release.mjs asks THIS
  // function, read out of the generated dispatcher; build section 140 and harness CY12 hold the two to the same cases).
  // F-ENG (2026-10-20, the rule made precise): a deploy restarts n8n or re-publishes the workflows, and that kills whatever is running.
  //  * REFUSE while a job is STARTING - between the dispatcher's claim and the run's ledger row - or a cycle or "Coming up" preview of an
  //    active website is due in the next `minutes` (15), or became due in the last 10 (the next sweep is about to start it). Those are the
  //    moments a restart can leave a start nobody can confirm, or push a due start into a refusal.
  //  * REPORT, never refuse, a job that is RUNNING: it is safe. A restart kills it, the dispatcher sees the dead run at its next sweep and
  //    starts it again (one of its three attempts). Refusing for it would refuse almost always once many websites run.
  // A `starting` row older than confirm_minutes + one sweep (15 min) is a start that never happened (the dispatcher fails it), and a
  // `running` row older than the stale rule + confirm (2 h 10 min) a crashed run: both are ignored, and counted.
  const DEPLOY = { window_minutes: 15, lookback_minutes: 10, starting_minutes: 15 };
  const deployWindow = (o) => {
    const c = o || {}, now = ms(c.now) || Date.now(), win = (Number(c.minutes) > 0 ? Number(c.minutes) : DEPLOY.window_minutes) * MIN;
    const staleRun = DEFAULTS.stale_hours * H + DEFAULTS.confirm_minutes * MIN, staleStart = DEPLOY.starting_minutes * MIN, lookback = DEPLOY.lookback_minutes * MIN;
    const open = (c.jobs || []).filter(r => r && S(r.job) !== 'cycle' && LIVE.has(S(r.status)));
    const age = (r) => { const t = ms(r.updated_at) || ms(r.started_at); return t ? now - t : Infinity; };
    const fresh = (r) => age(r) <= (S(r.status) === 'starting' ? staleStart : staleRun);
    const view = (r) => ({ key: S(r.key), job: S(r.job), status: S(r.status), since: S(r.updated_at) || S(r.started_at) });
    const starting = open.filter(r => S(r.status) === 'starting' && fresh(r)).map(view).sort((a, b) => a.key.localeCompare(b.key));
    const running = open.filter(r => S(r.status) === 'running' && fresh(r)).map(view).sort((a, b) => a.key.localeCompare(b.key));
    const ignored = open.filter(r => !fresh(r)).map(r => S(r.key));
    const due = [];
    for (const r of (c.cycles || [])) {
      if (!r || (S(r.status).toLowerCase() || 'active') !== 'active') continue;
      for (const [what, at] of [['cycle', ms(r.next_due_at)], ['preview', ms(r.next_preview_at)]])
        if (at && at >= now - lookback && at <= now + win) due.push({ site_id: S(r.site_id), domain: normD(r.domain), what, at: iso(at) });
    }
    due.sort((a, b) => a.at.localeCompare(b.at) || a.site_id.localeCompare(b.site_id));
    const busy = starting.length > 0 || due.length > 0;
    const why = [starting.length ? starting.length + ' dispatcher job(s) starting, between the claim and the run\'s ledger row (' + starting.slice(0, 5).map(j => j.key).join(', ') + ')' : '',
      due.length ? due.length + ' cycle / preview start(s) due by ' + iso(now + win) + ' (' + due.slice(0, 5).map(d => d.domain + ' ' + d.what + ' ' + d.at).join(', ') + ')' : ''].filter(Boolean).join('; ');
    const note = running.length ? running.length + ' job(s) running (' + running.slice(0, 5).map(j => j.key).join(', ') + '): not a reason to wait - a restart kills a running job, the dispatcher sees the dead run at its next sweep and starts it again (one of its three attempts)' : '';
    const reason = busy ? why : 'nothing starting and nothing due in the next ' + Math.round(win / MIN) + ' min';
    return { busy, starting, running, due, ignored_stale: ignored, minutes: Math.round(win / MIN), reason, note };
  };
  return { plan, deployWindow, DEPLOY, outcome, execReads, runsFrom, claimFree, claimToken, refusalOf, refusedSince, settingsOf, jobsFor, skipEvidence, LEDGER_RUNS, payload, newCycleRow, cycleRow, anchorOf, ANCHOR, siteIdOf, read, nextAfter, mostRecent, local, validTz, dueAt,
    dateAdd, weekdayOf, cycleKey, dateOfKey, requestId, ledgerKey, periodKey, monthlyDayOf, jobRow, cycleRowOf, JOBS, PREVIEW, BY_JOB, NAMES, DEFAULTS, TERMINAL, LIVE, DEAD, CAPACITY };
})();
const TZ = 'America/New_York';
const v = $('Kickoff Validate').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const want = v.domain || v.site_id;
const refuse = (code, reason, extra) => [{ json: { refused: true, code, reason, domain: v.domain || '', site_id: v.site_id || '', request_id: v.request_id, dry_run: !!v.dry_run, ...(extra || {}) } }];
let badLoad = null; try { badLoad = $('Load Cycles (Kickoff)').all().map(i => i.json).find(r => r && r.error) || null; } catch (e) { badLoad = null; }
if (badLoad) return refuse('unreadable', 'the cycle table could not be read (' + String(badLoad.error.message || badLoad.error).slice(0, 160) + '), so nothing was written; try again');
const site = rowsOf('Load Sites (Kickoff)').find(s => normD(s.domain) === v.domain || String(s.site_id || '') === (v.site_id || v.domain));
if (!site) return refuse('not_tracked', '"' + want + '" is not tracked by the engine (start "Track my site" first; the kickoff can be sent again once its tracking row exists)');
const domain = normD(site.domain), site_id = String(site.site_id);
if (String(site.status || 'active') === 'paused') return refuse('paused', domain + ' is paused: its automatic work does not start', { domain, site_id });
const existing = rowsOf('Load Cycles (Kickoff)').find(r => String(r.site_id || '') === site_id) || null;
if (existing && !v.force && !v.dry_run)
  return refuse('already_started', domain + ' already has its cycle (anchored ' + (existing.anchor_at || '?') + ', next due ' + (existing.next_due_at || '?') + '); send force: true to start cycle 0 again', { domain, site_id });
const now = Date.now(), anchor = v.anchor_at ? Date.parse(v.anchor_at) : now, tz = v.tz || TZ;
// the one row builder "Track my site" uses too (CYC.cycleRow): the kickoff always writes a fresh row (a new website, or `force`)
const row = CYC.cycleRow({ existing, force: true, site_id, domain, tz, anchor, now, skip_jobs: v.skip_jobs, engine_tz: TZ }).row;
const cycle_key = CYC.cycleKey(site_id, CYC.local(tz, anchor).date);
return [{ json: { refused: false, dry_run: !!v.dry_run, force: !!v.force, site_id, domain, cycle_key, next_due_at: row.next_due_at, request_id: v.request_id, row,
  exists: !!existing, replaces: existing ? { anchor_at: String(existing.anchor_at || ''), current_key: String(existing.current_key || ''), next_due_at: String(existing.next_due_at || '') } : null } }];
