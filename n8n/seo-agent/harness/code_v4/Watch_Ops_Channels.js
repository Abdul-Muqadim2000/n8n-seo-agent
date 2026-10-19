// G11 (2026-10-13): what to send after the serious changes are on record (D25b's rule: record first, then send). One POST with the day's
// digest — `text` works for Slack and Teams, `content` for Discord, `alerts` carries the structured changes for anything else. A change
// already alerted within the dedupe window is on its row as `deduped` and is not re-sent; an unset webhook is simply skipped, and neither
// the record nor the channel can fail the run.
// ---- the ops alert and its channels (D25b, 2026-10-12, system review FIX_PLAN.md) ----
// The Error Handler had a single channel: *Email Ops*. On 2026-10-10 and again on 2026-10-12 it failed with a connection error (the Console
// Alerts watcher triggers the handler), so a failed run told nobody. Now every alert is **recorded first** in the Data Table
// seo_ops_alerts - the record of last resort, which survives both channels being down - and then sent to two independent channels: a webhook
// (SEO_ALERT_WEBHOOK_URL: Slack, Teams or anything that takes a POST; no SMTP involved) and the e-mail. Repeats of the same failure within
// OA.DEDUPE_MINUTES are recorded (count + 1) but not re-sent, so one broken credential cannot flood either channel. An unset channel is
// simply skipped, and neither channel can fail the run.
const OA = (() => {
  const DEDUPE_MINUTES = 30;
  // B-A7 (2026-10-15): the moment a first attempt may be re-tried if nothing records a delivery. It must equal AR.RETRY_MINUTES — the
  // sweep (v5/code/_alert_retry.js) is what acts on it — and build section 64 fails if the two ever drift apart.
  const RETRY_MINUTES = 30;
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the identity of a failure: the workflow, the node and the message with numbers, ids and quoted values removed, so "timeout after 30012ms"
  // and "timeout after 31004ms" at the same node are one alert
  // R79 (2026-10-16, re-rating C-3): the slice used to keep a trailing space when the 160th character was one, so row 4 was stored under a
  // 207-character key ending in a space while every reader trimmed it to 206 — the retry's update matched no row and the alert was re-sent to
  // Slack on every run of every monitor (14 posts on 2026-10-15). The key is trimmed after the slice: ONE normal form, built here only.
  const keyOf = (a) => [S(a.workflow) || 'unknown workflow', S(a.node) || 'unknown node',
    S(a.message).toLowerCase().replace(/\d[\d.,:]*/g, '#').replace(/["'`][^"'`]*["'`]/g, '"x"').replace(/\s+/g, ' ').slice(0, 160).trim()].join(' | ');
  // R79: a stored row is matched on the normal form (trimmed), but it is WRITTEN BACK under the key it is stored with, byte for byte — rows
  // written before the trim (row 4) keep their trailing space, and a Data Table update / upsert filters on exact equality. Normalise on
  // read, write back the identity: no migration of the stored keys is needed, and no second row is ever created beside an old one.
  const storedKey = (r) => String(r == null || r.alert_key == null ? '' : r.alert_key);
  const severityOf = (a) => /credential|unauthor|forbidden|payment|credit|quota|balance/i.test(S(a.message)) ? 'critical' : 'high';
  // B-A7: a row is "carried" when `delivered` NAMES the channel that took it ('webhook', 'email', 'webhook,email'). Everything else -
  // pending, failed, not_sent, deduped - means the same thing to a human: nobody has it. The same rule as AR.carried.
  const carried = (r) => S(r && r.delivered).toLowerCase().split(',').map(x => x.trim()).some(x => x === 'webhook' || x === 'email');
  // R29 (2026-10-14, FIX_PLAN §3.12, secret handling): SEO_ALERT_WEBHOOK_URL is a bearer URL, so the build bakes a PLACEHOLDER and
  // apply_env.py substitutes the real value into the JSON it imports — the public repository never carries the secret. A node still
  // holding the placeholder (an un-applied build, and every harness run) has no webhook configured: it is not a URL, and posting to it
  // would be a request to nowhere. Anything that still looks like __A_PLACEHOLDER__ therefore reads as unset.
  const cfgUrl = (v) => { const s = S(v); return !s || /^__[A-Z0-9_]+__$/.test(s) ? '' : s; };

  const plan = (alert, rows, cfg) => {
    const a = alert || {}, c = cfg || {};
    const now = new Date();
    const nowIso = now.toISOString();
    const fresh = keyOf(a);
    const prior = (rows || []).filter(r => r && S(r.alert_key) === fresh)
      .sort((x, y) => S(y.last_seen_at).localeCompare(S(x.last_seen_at)))[0] || null;
    const alert_key = prior ? storedKey(prior) : fresh;   // R79: the row that exists, under the key it is stored with
    const sinceMin = prior && S(prior.last_seen_at) ? (now - new Date(S(prior.last_seen_at))) / 60000 : Infinity;
    const repeat = !!prior && Number.isFinite(sinceMin) && sinceMin < DEDUPE_MINUTES;
    const count = prior ? n0(prior.count) + 1 : 1;
    const webhook_url = cfgUrl(c.webhook_url);   // R29: an un-substituted placeholder is not a channel
    const email_to = S(c.email_to);
    const channels = [webhook_url ? 'webhook' : '', email_to ? 'email' : '', 'data_table'].filter(Boolean);
    const notify = !repeat;
    const plain = [S(a.workflow) + ' failed at "' + S(a.node) + '"', 'Execution ' + (S(a.execution_id) || '?') + (S(a.mode) ? ' (' + S(a.mode) + ')' : ''),
      S(a.execution_url), S(a.message)].filter(Boolean).join('\n');
    const row = {
      alert_key, workflow: S(a.workflow).slice(0, 200), node: S(a.node).slice(0, 200), message: S(a.message).slice(0, 800),
      execution_id: S(a.execution_id), execution_url: S(a.execution_url), mode: S(a.mode), severity: severityOf(a),
      first_seen_at: prior && S(prior.first_seen_at) ? S(prior.first_seen_at) : nowIso, last_seen_at: nowIso, count,
      channels: channels.join(','),
      // B-A7 (2026-10-15): a repeat used to write `deduped` over whatever the row said, including over the channels that had CARRIED the
      // alert — so a delivered alert looked undelivered and an undelivered one looked handled. A repeat of an alert something carried
      // keeps that state; only an alert nobody has is marked deduped.
      delivered: notify ? 'pending' : (prior && carried(prior) ? S(prior.delivered) : 'deduped'),
      notes: (repeat ? 'repeat within ' + DEDUPE_MINUTES + ' minutes (' + Math.round(sinceMin) + ' min after the last one), recorded but not re-sent' : count > 1 ? 'seen ' + count + ' times, last alert more than ' + DEDUPE_MINUTES + ' minutes ago' : 'first time').slice(0, 500),
      // B-A7: the retry state. `attempts` is 0 here on purpose — this row is written BEFORE anything is sent, and an attempt exists when it
      // is made, not when it is planned (INVARIANTS rule 4). *Alert Delivery* writes the real count and the log a moment later; if the
      // execution dies before it does, `next_attempt_at` has already booked the row for the next sweep, so the failure is not stranded.
      attempts: n0(prior && prior.attempts),
      last_attempt_at: S(prior && prior.last_attempt_at),
      next_attempt_at: notify ? new Date(now.getTime() + RETRY_MINUTES * 60000).toISOString() : S(prior && prior.next_attempt_at),
      attempt_log: S(prior && prior.attempt_log)
    };
    // the webhook payload: `text` works for Slack and Teams, `content` for Discord, and `alert` carries the structured fields for anything else
    const body = {
      text: S(a.subject) + '\n' + plain, content: S(a.subject) + '\n' + plain, summary: S(a.subject),
      alert: { key: alert_key, workflow: row.workflow, node: row.node, message: row.message, execution_id: row.execution_id,
        execution_url: row.execution_url, mode: row.mode, severity: row.severity, seen_count: count, at: nowIso, source: 'seo-agent-error-handler' }
    };
    return { row, notify, repeat, channels, webhook_url, email_to, webhook_body: body, plain, alert_key, severity: row.severity, DEDUPE_MINUTES };
  };

  return { plan, keyOf, storedKey, severityOf, cfgUrl, carried, DEDUPE_MINUTES, RETRY_MINUTES };
})();
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
const SCHED = {"trigger": "Daily Schedule", "cron": "45 5 * * *", "tz": "America/New_York", "wf": "SEOagentPageWch1", "kind": "daily"};
// F-L (2026-10-18, re-rating 2026-10-17 C-1 follow-up): the "ran late" notice for the scheduled workflows that have no Callback Ledger —
// the Audit Scheduler (its audits report through the main workflow, so the notice rides in each audit's body) and the Page Watch (its
// callback is the alert digest). Same rule and words as v5/code/Callback_Ledger.js: CU.lateRun on what started this run — the
// catch-up's payload on the manual entry (`trigger: 'catchup'`, `scheduled_for`, `why`) or the schedule trigger's own timestamp — against
// the workflow's schedule (SCHED, baked by monitor_cost.bake_ran_late). An on-demand run is never late. Needs CU (_catchup.js) and SCHED.
const RL = (() => {
  const of = (sched, entries) => {
    const sc = sched || {};
    let trig = {}, fired = '';
    for (const n of (entries || ['Manual Run'])) { try { const t = $(n).first(); if (t && t.json) { trig = t.json; break; } } catch (e) {} }
    if (trig.body && typeof trig.body === 'object') trig = { ...trig, ...trig.body };
    if (sc.trigger) { try { const t = $(sc.trigger).first(); if (t && t.json) fired = String(t.json.timestamp || ''); } catch (e) {} }
    try { return CU.lateRun({ trigger: trig.trigger, scheduled_for: trig.scheduled_for, why: trig.why, started_at: trig.started_at, fired_at: fired,
      cron: sc.cron, tz: sc.tz, kind: sc.kind }); } catch (e) { return { late: false }; }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const subjectTag = (subject, rl) => (rl && rl.late && typeof subject === 'string' && subject && !/\(ran late/.test(subject))
    ? subject + ' (ran late — due ' + String(rl.due || '').slice(0, 10) + ')' : subject;
  const box = (rl) => '<div class="ran-late" style="border:1px solid #b45309;background:#fffbeb;color:#78350f;padding:10px 14px;margin:0 0 14px;font:14px/1.5 sans-serif"><strong>Ran late.</strong> ' + esc(rl && rl.text) + '</div>';
  // the same marks Callback Ledger puts on a callback item: `ran_late`, the box first in its HTML, the tag on its subject
  const mark = (j, rl) => {
    if (!rl || !rl.late) return j;
    const o = { ...j, ran_late: rl };
    if (typeof o.html === 'string' && o.html) o.html = /<body[^>]*>/i.test(o.html) ? o.html.replace(/<body[^>]*>/i, (b) => b + box(rl)) : box(rl) + o.html;
    if (typeof o.subject === 'string') o.subject = subjectTag(o.subject, rl);
    return o;
  };
  return { of, subjectTag, box, mark };
})();
const S = (v) => String(v == null ? '' : v).trim();
const rows = (() => { try { return $('Watch Ops Alert').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sites = (() => { try { return $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip); } catch (e) { return []; } })();
const pending = rows.filter(r => S(r.delivered) === 'pending');
const webhook_url = OA.cfgUrl('__SEO_ALERT_WEBHOOK_URL__');   // R29 (2026-10-14): the build bakes a placeholder; apply_env.py substitutes the real URL at import time
let recorded = true, record_error = '';
try { const sv = ($('Save Watch Ops Alert').first() || {}).json || {}; if (sv.error) { recorded = false; record_error = String(sv.error.message || sv.error.description || sv.error).slice(0, 200); } }
catch (e) { recorded = false; record_error = 'the alert rows were not written: ' + String(e.message || e).slice(0, 160); }
const lines = pending.map(r => '• ' + S(r.node) + ' — ' + S(r.message));
const subject = pending.length
  ? 'SEO Agent key-page watch: ' + pending.length + ' change' + (pending.length === 1 ? '' : 's') + ' on ' + [...new Set(pending.map(r => S(r.node).split(' · ')[0]))].join(', ')
  : 'SEO Agent key-page watch: nothing new';
// F-L (2026-10-18, C-1 follow-up): a watch the schedule catch-up started for a missed day, or a schedule that fired hours late, says so
const ran_late = RL.of(SCHED, ['Watch Run']);
const subjectL = RL.subjectTag(subject, ran_late);
const plain = [subjectL, ...(ran_late.late ? ['Ran late: ' + ran_late.text] : []), ...lines].join('\n');
return [{ json: {
  send_webhook: !!(webhook_url && pending.length), webhook_url, subject: subjectL, plain, recorded, record_error, ran_late,
  alerts: pending.length, deduped: rows.length - pending.length, sites_checked: sites.length,
  webhook_body: { text: plain, content: plain, summary: subjectL, ...(ran_late.late ? { ran_late } : {}),
    alerts: pending.map(r => ({ key: S(r.alert_key), site: S(r.node), message: S(r.message), severity: S(r.severity), seen_count: Number(r.count) || 1, at: S(r.last_seen_at), source: 'seo-agent-page-watch' })) },
  note: pending.length
    ? (webhook_url ? 'posting the day\'s changes to the alert webhook' : 'no alert webhook is configured (SEO_ALERT_WEBHOOK_URL): the changes are on record in seo_ops_alerts and in the app')
    : 'nothing serious changed, or every change was alerted less than ' + OA.DEDUPE_MINUTES + ' minutes ago',
} }];
