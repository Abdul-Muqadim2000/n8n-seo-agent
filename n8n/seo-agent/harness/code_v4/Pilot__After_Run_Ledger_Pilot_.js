// R17 (2026-10-14, system review FIX_PLAN 3.12): the run ledger reserves its row on the MAIN path now, before the first paid call -
// it used to hang off the plan node as a side branch and n8n's v1 order ran it last, after all the spending. A Data Table node answers with
// the row it wrote rather than with its input, so this node hands AI Plan's own items back to the pipeline, unchanged and in order.
// B-A9 (2026-10-15, build section 64): and it is the gate. R17 put the reservation in front of the spending; nothing ever LOOKED at what was
// already running, so a scheduled monitor could not be refused for concurrency however much was in flight - the one guard every API run
// passes (*Rate Limit*) had no counterpart here. The rules are shared with it (v5/code/_run_guard.js): a run of the same monitor still in
// flight, a heavy crawl of the same site, too many analyses at once, or an account that cannot pay for this run. A refusal costs nothing -
// it happens after the row exists and before the first paid node, and the row is marked `refused` so it never holds a cent of the day.
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
  // 2026-10-23 (techand.ai on production): a dispatcher that sweeps but is in plan_only starts nothing either. Production stayed there for
  // two days after a deploy (no seo_cache row cycle:mode), two clients' cycle 0 sat at 0 of 8 jobs, and this watchdog said "sweeping".
  // So: when the last sweep says plan_only AND it would have started work, alarm once that has lasted `plan_only_minutes`.
  const CW_DEFAULTS = { stale_minutes: 20, alarm_every_hours: 6, plan_only_minutes: 60 };
  const cycleWatchdog = (o) => {
    const c = o || {}, cfg = { ...CW_DEFAULTS, ...(c.config || {}) }, now = ms(c.now) || Date.now(), st = parseValue(c.state || {}), wf = c.wf || {};
    const lastAt = ms(c.last && c.last.updated_at), age = lastAt ? (now - lastAt) / MIN : null;
    const since = wf.ok ? ms(wf.updatedAt) : 0;
    const sweep = parseValue((c.last && c.last.value) || {});
    const waiting = Array.isArray(sweep.would_start) ? sweep.would_start : [];
    const held = String(sweep.mode || '') === 'plan_only' && waiting.length > 0;
    const heldSince = held ? (ms(st.plan_only_since) || lastAt || now) : 0;
    const problems = [];
    if (wf.ok && wf.active === false) problems.push('the Cycle Dispatcher (SEOagentCycleDsp) is not active: no website\'s cycle is started (publish it - a deploy imports it inactive; deploy_manifest.json publishes it)');
    if (lastAt && age > cfg.stale_minutes) problems.push('its last sweep (seo_cache cycle:last) was ' + dur(age) + ' ago, at ' + iso(lastAt) + ' (it sweeps every 5 minutes)');
    else if (!lastAt && (!wf.ok || wf.active !== false) && since && (now - since) / MIN > cfg.stale_minutes) problems.push('it has written no sweep record (seo_cache cycle:last) in the ' + dur((now - since) / MIN) + ' since it was last updated');
    if (held && (now - heldSince) / MIN > cfg.plan_only_minutes) {
      const named = new Map((Array.isArray(sweep.sites) ? sweep.sites : []).map(s => [S(s && s.site_id), S(s && s.domain)]));
      const domains = [...new Set(waiting.map(w => S(w && w.key).split(':')[1] || '').filter(Boolean).map(id => named.get(id) || id.replace(/^site_/, '')))];
      problems.push('it is in plan_only (' + (S(sweep.mode_reason) || 'seo_cache cycle:mode') + ') for ' + dur((now - heldSince) / MIN) + ' while ' + waiting.length + ' job(s) wait to start ('
        + domains.slice(0, 5).join(', ') + (domains.length > 5 ? ' and ' + (domains.length - 5) + ' more' : '') + '): no client\'s scheduled work runs. Add the seo_cache row key cycle:mode, kind cycle, value {"mode":"start"} (RUNBOOK.md section 4)');
    }
    const keep = { plan_only_since: held ? iso(heldSince) : '' };
    const base = { checked_at: iso(now), last_sweep_at: lastAt ? iso(lastAt) : '', active: wf.ok ? wf.active !== false : null, read: wf.ok ? '' : (S(wf.error) || 'no answer'), mode: S(sweep.mode), waiting: waiting.length };
    if (c.test) return { ...base, verdict: 'test', alarm: false, reason: 'a test run of the catch-up does not judge the dispatcher', state: st };
    if (!problems.length) return { ...base, verdict: wf.ok ? (held ? 'plan_only' : 'sweeping') : 'blind', alarm: false, problems: [], reason: wf.ok ? 'active, last sweep ' + (lastAt ? dur(age) + ' ago' : 'none yet (updated ' + (since ? iso(since) : '?') + ')')
      + (held ? '; plan_only with ' + waiting.length + ' job(s) waiting since ' + iso(heldSince) + ' (alarm after ' + cfg.plan_only_minutes + ' min)' : '')
      : 'the dispatcher workflow could not be read (' + base.read + '); its last sweep was ' + (lastAt ? dur(age) + ' ago' : 'never recorded'), state: { ...st, ...keep, down_since: '', last_alarm_at: '' } };
    const down = ms(st.down_since) || now;
    if (c.entry === 'init') return { ...base, verdict: 'starting', alarm: false, problems, reason: 'n8n has just started: the dispatcher\'s own Instance Started sweep comes next, so this is judged at the next catch-up sweep', state: st };
    const lastAlarm = ms(st.last_alarm_at), due = !lastAlarm || now - lastAlarm >= cfg.alarm_every_hours * H;
    return { ...base, verdict: 'down', alarm: due, problems, down_since: iso(down),
      reason: problems.join('; ') + (due ? '' : ' (alerted at ' + iso(lastAlarm) + '; again after ' + cfg.alarm_every_hours + ' h)'),
      state: { ...st, ...keep, down_since: iso(down), last_alarm_at: due ? iso(now) : S(st.last_alarm_at) } };
  };
  return { plan, lastDue, nextDue, parse, zonedToUtc, offset, stalePlan, lateRun, wall, dur, watchdog, watchdogResult, cycleWatchdog, DEFAULTS, DEAD, WD_DEFAULTS, CW_DEFAULTS, CYCLE_LATE_MIN };
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
const plan = $('AI Plan').all();
let rows = []; try { rows = $('Load Open Runs (Pilot)').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { rows = []; }
let mine = {}; try { mine = $('Reserve Run Ledger (Pilot)').first().json || {}; } catch (e) { mine = {}; }
if (mine && mine.error) mine = {};
// R77 (2026-10-16, re-rating C-1): the run that started this one, by identity. The front door's own row has the same mode and is still
// `reserved` when an on-demand monitor reads the ledger, so the mode alone made the child refuse itself (exec 624). The child's row names
// its parent in its key (Monitor_Ledger_Row: `parent:<id>`), and the trigger item carries it too; a genuine twin is still refused.
// R116: and the refusal knows who is waiting for it — an on-demand run's trigger carries the caller's callback and request id.
let __trig = {};
for (const __n of ['Manual Run', 'Watch Run']) { try { const __t = $(__n).first(); if (__t && __t.json) { __trig = __t.json; break; } } catch (e) {} }
if (__trig.body && typeof __trig.body === 'object') __trig = { ...__trig, ...__trig.body };
let __row = {}; try { __row = $('Run Ledger Row (Pilot)').first().json || {}; } catch (e) { __row = {}; }
const __S = (v) => String(v == null ? '' : v).trim();
const parent_run_id = RG.parentOf(mine) || RG.parentOf(__row) || __S(__trig.parent_run_id);
// R94 follow-up (2026-10-16, A14): a run started by its OWN Schedule Trigger whose latest due slot the catch-up already ran (seo_cache
// `catchup:<workflow id>:<due ISO>`, written before it starts) is the delayed timer of a week that is done - a sleeping Mac delivers a
// fire hours late, and the catch-up starts it after 6 h, so without this the week ran twice. A catch-up start enters through the Execute
// Workflow Trigger, so the Schedule Trigger node has no data in it and nothing is checked.
const __SCHED = {};
let __caught = null;
if (__SCHED.trigger && __SCHED.cron) {
  let __fire = null; try { const __t = $(__SCHED.trigger).first(); __fire = __t && __t.json ? __t.json : null; } catch (e) { __fire = null; }
  if (__fire) {
    try {
      const __ft = Date.parse(String(__fire.timestamp || '')) || Date.now();
      const __due = CU.lastDue(__SCHED.cron, __SCHED.tz, __ft);
      let __recs = []; try { __recs = $('Load Catch-up Records (Pilot)').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { __recs = []; }
      __caught = RG.caughtUp({ records: __recs, workflow_id: __SCHED.wf, due: __due ? new Date(__due).toISOString() : '' });
    } catch (e) { __caught = null; }   // fail OPEN: a scheduled run is never refused for a lookup that did not work
  }
}
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): the twin rule is per website for a run that names one - a cycle job or an on-demand start
// (trigger `domain`, or `site_id` with the domain on this run's row). A run that names none (the daily batch pulse / page watch) keeps the
// mode-only rule. A cycle job's capacity refusal is retried by the Cycle Dispatcher, so its wording says so instead of "skipped".
const __site = __S(__trig.domain) || (__S(__trig.site_id) ? __S((mine && mine.domain) || (__row && __row.domain)) : '');   // RG.gate normalises the host
const __cycle = __S(__trig.trigger) === 'cycle';
const g = RG.gate({ rows, mine, mode: 'ai_pilot', where: 'SEO Agent — AI Repeat Pilot', run_id: String($execution.id), site: __site, cycle: __cycle, caught_up: __caught, parent_run_id });
if (g.allowed || false) return plan;   // W3-F: a synchronous caller is waiting (the Reply Reader): it keeps its row but is never refused by what else is running
let __dom = __S(__trig.domain);
if (!__dom) { try { __dom = __S((plan[0] && plan[0].json || {}).domain); } catch (e) { __dom = ''; } }
return [{ json: { run_refused: true, run_id: String($execution.id), refused_at: new Date().toISOString(),
  // 2026-10-19: the reason code first, so the Cycle Dispatcher (which reads only the ledger row) tells a capacity refusal it retries
  // (`same_mode`, `heavy_busy`, `too_many_open`) from one it does not (`account_low`, `caught_up`)
  cost_basis: ('refused before any spending (' + g.reason + '): ' + g.refusal + ' [' + g.basis + ']').slice(0, 400),
  retry: !!g.retry, cycle_key: __cycle ? __S(__trig.cycle_key) : '', site: g.site || '',
  reason: g.reason, refusal: g.refusal, basis: g.basis, open_runs: g.open_runs, open: g.open, max_open: g.max_open,
  stale_ignored: g.stale_ignored, mode: g.mode, where: g.where, parent_run_id,
  // R116: who to tell. Only a run started by hand (a Manual Run with a callback) has someone waiting; a scheduled refusal has nobody.
  callback_url: __S(__trig.callback_url), request_id: __S(__trig.request_id), domain: __dom.toLowerCase(),
  monitor: __S(__trig.monitor) || g.mode, on_demand: !!__S(__trig.callback_url) } }];
