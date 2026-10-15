// ---- B-A7 (2026-10-15, build section 64): an undelivered alert is re-attempted, escalated, and never called delivered ----
// D25b gave the alert a second channel and a row of its own; R6 put the delivery result back on that row. Nothing ever acted on it: one
// attempt per channel, no second try, no escalation — and the blunt evidence is that **no ops alert has ever reached a human**. Rule 3 of
// docs/system-review-2026-10-14/INVARIANTS.md ends on exactly this clause: *a failure that reaches no human is not handled.*
//
// What this kit decides, and nothing else does:
//  * **which rows are still open.** Not `delivered === 'pending'` — a row is open when nothing in `delivered` NAMES a channel that carried
//    it (AR.carried). `pending`, `failed`, `not_sent` and `deduped` all mean the same thing to a human: nobody has it. That matters because
//    OA.plan writes `deduped` over the state of a repeat, so judging on one magic word would have made a repeated failure unretryable.
//  * **when.** RETRY_MINUTES after the last attempt, flat — never exponential. The sweepers ARE the schedule (every run of every scheduled
//    workflow and every run of the Error Handler), so the interval only has to be long enough not to fight OA.DEDUPE_MINUTES.
//  * **how loud.** From ESCALATE_AFTER attempts the row is `critical` whatever it started as, and the payload leads with how long it has
//    been undelivered, so when it finally lands it lands as the outage it is.
//  * **when to stop.** MAX_ATTEMPTS, after which the row is `abandoned` with the reason. Rule 4: it is never marked delivered. Stopping is
//    not hiding — the row is the record of last resort and it still says, in words, that it reached nobody.
//  * **every attempt, not just the last.** `attempt_log` keeps one line per attempt; MAX_ATTEMPTS lines fit inside the cap, so the log a
//    row carries is complete, never a window onto the end of a longer history.
const AR = (() => {
  const RETRY_MINUTES = 30;    // N — see the note above OA.DEDUPE_MINUTES: a retry must never be a flood
  const ESCALATE_AFTER = 3;    // K — attempt 1 is the live send; 2 and 3 are catch-up. Three is no longer a blip, it is a broken channel.
  const MAX_ATTEMPTS = 10;
  const PER_SWEEP = 5;         // one run never posts more than this, so a bad day cannot turn into a hundred posts
  const LOG_MAX = 1200;        // 10 attempts x ~70 characters: the whole history fits, by construction
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const ms = (v) => { const t = Date.parse(S(v)); return Number.isFinite(t) && t > 0 ? t : 0; };
  const iso = (t) => new Date(t).toISOString();

  // R29 / R30: an un-substituted placeholder is not a URL and is not a channel (the same rule as OA.cfgUrl, repeated here so this kit can
  // be inlined on its own in a workflow that has no OA)
  const cfgUrl = (v) => { const s = S(v); return !s || /^__[A-Z0-9_]+__$/.test(s) ? '' : s; };
  // what counts as delivered: Alert Delivery writes the channels that carried it ('webhook', 'email', 'webhook,email').
  const carried = (r) => S(r && r.delivered).toLowerCase().split(',').map(x => x.trim()).some(x => x === 'webhook' || x === 'email');
  const abandoned = (r) => S(r && r.delivered).toLowerCase() === 'abandoned';
  const attemptsOf = (r) => Math.max(0, n0(r && r.attempts));
  // when this row may be tried again: what the last attempt booked, else the last attempt / sighting plus the interval. A row written
  // before this existed carries neither, so its `last_seen_at` is what schedules it — it is retried, not stranded.
  const dueAt = (r) => ms(r && r.next_attempt_at) || ((ms(r && r.last_attempt_at) || ms(r && r.last_seen_at)) + RETRY_MINUTES * 60000);
  const isOpen = (r) => !!(r && !r.error && S(r.alert_key) && !carried(r) && !abandoned(r));
  const retryable = (r, nowMs) => isOpen(r) && attemptsOf(r) < MAX_ATTEMPTS && dueAt(r) > 0 && dueAt(r) <= nowMs;
  const severityFor = (r, attempts) => (attempts >= ESCALATE_AFTER ? 'critical' : (S(r && r.severity) || 'high'));
  const ageMinutes = (r, nowMs) => { const t = ms(r && r.first_seen_at) || ms(r && r.last_seen_at); return t ? Math.round((nowMs - t) / 60000) : 0; };
  const ageText = (min) => min >= 1440 ? (Math.round(min / 144) / 10) + ' days' : min >= 60 ? (Math.round(min / 6) / 10) + ' hours' : min + ' minutes';

  // one line per attempt, oldest first; the newest is appended and nothing earlier is ever rewritten
  const logLines = (r) => S(r && r.attempt_log).split('\n').map(x => x.trim()).filter(Boolean);
  const addAttempt = (r, attempt, atIso, channel, ok, detail) => {
    const line = (attempt + ' ' + S(atIso).replace(/\.\d+Z$/, 'Z') + ' ' + channel + ' ' + (ok ? 'delivered' : 'failed') + (detail ? ': ' + S(detail) : '')).slice(0, 160);
    const lines = logLines(r).concat([line]);
    let out = lines.join('\n');
    while (out.length > LOG_MAX && lines.length > 1) { lines.splice(1, 1); out = lines.join('\n'); }   // the first attempt and the recent ones are what a reader needs
    return out;
  };

  // what the POST said. `fullResponse` + `neverError` means the node always answers with a status code, so delivery is judged on the
  // status and never on "the node did not throw" — a 404 from a revoked Slack hook used to read as a delivery (Rule 4).
  const posted = (item) => {
    const x = (item && item.json) || item || {};
    if (x.error) return { ok: false, detail: S(x.error.message || x.error.description || x.error).replace(/\s+/g, ' ').slice(0, 160) };
    const code = Number(x.statusCode);
    if (Number.isFinite(code) && code > 0) {
      if (code >= 200 && code < 300) return { ok: true, detail: 'HTTP ' + code };
      const body = typeof x.body === 'string' ? x.body : (x.body ? JSON.stringify(x.body) : '');
      return { ok: false, detail: ('HTTP ' + code + (body ? ': ' + body : '')).replace(/\s+/g, ' ').slice(0, 160) };
    }
    return { ok: false, detail: 'no status code came back, so nothing confirms it arrived' };
  };

  const payload = (r, attempt, severity, nowMs) => {
    const min = ageMinutes(r, nowMs);
    const head = (attempt >= ESCALATE_AFTER ? 'STILL UNDELIVERED after ' + attempt + ' attempts over ' + ageText(min) : 'Undelivered alert, attempt ' + attempt + ' of ' + MAX_ATTEMPTS);
    const subject = '[' + severity + '] ' + head + ' — ' + (S(r.workflow) || 'unknown workflow');
    const plain = [subject, S(r.workflow) + ' failed at "' + S(r.node) + '"',
      'Execution ' + (S(r.execution_id) || '?') + (S(r.mode) ? ' (' + S(r.mode) + ')' : ''), S(r.execution_url), S(r.message),
      'First seen ' + S(r.first_seen_at) + ', seen ' + n0(r.count) + ' time(s); this alert has reached nobody.'].filter(Boolean).join('\n');
    return { subject, plain, body: {
      text: plain, content: plain, summary: subject,
      alert: { key: S(r.alert_key), workflow: S(r.workflow), node: S(r.node), message: S(r.message), execution_id: S(r.execution_id),
        execution_url: S(r.execution_url), mode: S(r.mode), severity, seen_count: n0(r.count), first_seen_at: S(r.first_seen_at),
        attempt, of: MAX_ATTEMPTS, undelivered_for_minutes: min, escalated: attempt >= ESCALATE_AFTER, at: iso(nowMs),
        source: 'seo-agent-alert-retry' } } };
  };

  // the rows this sweep will re-send, oldest first. `where` names the workflow doing the sweeping, for the row's notes.
  const plan = (rows, cfg) => {
    const c = cfg || {};
    const nowMs = ms(c.now) || Date.now();
    const url = cfgUrl(c.webhook_url);
    const all = (rows || []).filter(r => r && !r.error && S(r.alert_key));
    const open = all.filter(isOpen);
    const ready = open.filter(r => retryable(r, nowMs)).sort((a, b) => dueAt(a) - dueAt(b));
    const spent = open.filter(r => isOpen(r) && attemptsOf(r) >= MAX_ATTEMPTS);
    const take = ready.slice(0, PER_SWEEP);
    const items = take.map(r => {
      const attempt = attemptsOf(r) + 1;
      const severity = severityFor(r, attempt);
      const p = payload(r, attempt, severity, nowMs);
      return { alert_key: S(r.alert_key), attempt, severity, escalated: attempt >= ESCALATE_AFTER, at: iso(nowMs),
        row: r, webhook_url: url, webhook_body: p.body, subject: p.subject, plain: p.plain, sweeper: S(c.where) };
    });
    return { items, open: open.length, due: ready.length, posting: url ? items.length : 0, spent: spent.length,
      webhook_url: url, now: iso(nowMs), where: S(c.where),
      reason: !open.length ? 'no alert is waiting for delivery'
        : !ready.length ? open.length + ' alert(s) are waiting, none of them due for another try yet (' + RETRY_MINUTES + ' minutes between tries)'
        : !url ? ready.length + ' alert(s) have reached nobody and there is no channel to try: SEO_ALERT_WEBHOOK_URL is not set'
        : 'retrying ' + items.length + ' of ' + ready.length + ' undelivered alert(s)' };
  };

  // what to write back after the POSTs: one row per attempt, with the whole history and the honest state.
  const settle = (planned, responses) => (planned || []).map((p, i) => {
    const r = p.row || {}, res = posted((responses || [])[i]);
    const attempt = n0(p.attempt), sev = S(p.severity) || 'high';
    const giveUp = !res.ok && attempt >= MAX_ATTEMPTS;
    const nowMs = ms(p.at) || Date.now();
    return {
      alert_key: S(p.alert_key),
      // Rule 4: delivered only on the evidence of a 2xx; otherwise the row keeps saying nobody has it.
      delivered: res.ok ? 'webhook' : giveUp ? 'abandoned' : 'failed',
      channels: S(r.channels) || 'data_table',
      severity: res.ok ? sev : severityFor(r, attempt),
      attempts: attempt,
      last_attempt_at: iso(nowMs),
      next_attempt_at: res.ok || giveUp ? '' : iso(nowMs + RETRY_MINUTES * 60000),
      attempt_log: addAttempt(r, attempt, iso(nowMs), 'webhook', res.ok, res.detail),
      notes: (res.ok
        ? 'delivered by webhook on attempt ' + attempt + ' (' + res.detail + '), re-sent by ' + (S(p.sweeper) || 'a later run')
        : giveUp
          ? 'given up after ' + attempt + ' attempts over ' + ageText(ageMinutes(r, nowMs)) + ' — this alert reached nobody and is on record here only (' + res.detail + ')'
          : 'attempt ' + attempt + ' of ' + MAX_ATTEMPTS + ' failed (' + res.detail + '), next try after ' + RETRY_MINUTES + ' minutes'
            + (attempt >= ESCALATE_AFTER ? '; raised to critical: ' + attempt + ' attempts over ' + ageText(ageMinutes(r, nowMs)) + ' have reached nobody' : '')
      ).slice(0, 500),
      ok: res.ok, detail: res.detail, escalated: !res.ok && attempt >= ESCALATE_AFTER, gave_up: giveUp
    };
  });

  return { plan, settle, posted, carried, isOpen, retryable, attemptsOf, dueAt, severityFor, addAttempt, logLines, cfgUrl, ageText,
           RETRY_MINUTES, ESCALATE_AFTER, MAX_ATTEMPTS, PER_SWEEP };
})();
