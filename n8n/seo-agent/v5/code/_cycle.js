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
    const ladderRowDomains = new Set(clean(c.ladders).map(l => normD(l.domain)).filter(Boolean));   // domains with ladder rungs (the dispatcher hands in the fit-gated ones)
    const ladderDomains = new Set(ladderRowDomains);
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
      const finish = () => { const before = raw.__new ? null : cycleRowOf(raw);
        if (!before || CYCLE_FIELDS.some(f => S(before[f]) !== S(next[f])) || normD(before.domain) !== domain) cycleRows.push(cycleRowOf({ ...next, updated_at: nowIso })); };
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
        out.jobs = ck ? jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: rd.skip_jobs, rank_only: rankOnly }).map(j => { const r = byKey.get(ck + ':' + j.job); return { job: j.job, verdict: r ? S(r.status) : 'paused', reason: r ? S(r.reason) : paused }; }) : [];
        finish(); continue; }
      if (!ck) { say('not_due', 'cycle 0 is due ' + next.next_due_at); finish(); continue; }
      // ---- the jobs of the current cycle, in order: a job starts only when every earlier one is done, skipped or gave up ----
      const list = jobsFor({ settings, zero: zeroNow, monthly: monthlyNow, skip_jobs: rd.skip_jobs, rank_only: rankOnly });
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

  return { plan, deployWindow, outcome, refusalOf, refusedSince, settingsOf, jobsFor, payload, newCycleRow, cycleRow, anchorOf, ANCHOR, siteIdOf, read, nextAfter, mostRecent, local, validTz, dueAt,
    dateAdd, weekdayOf, cycleKey, dateOfKey, requestId, ledgerKey, periodKey, monthlyDayOf, jobRow, cycleRowOf, JOBS, PREVIEW, BY_JOB, NAMES, DEFAULTS, TERMINAL, LIVE, DEAD, CAPACITY };
})();
