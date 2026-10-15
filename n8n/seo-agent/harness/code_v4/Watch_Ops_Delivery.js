// B-A7 (2026-10-15, build section 64): the Page Watch posted its digest and wrote nothing back, so every row it raised stayed
// `delivered: "pending"` for ever — indistinguishable from a post that never arrived. R6 gave the Error Handler a delivery record; the
// watch never got one, and the retry sweep would have re-sent a digest that had already landed.
// The POST is `neverError` + `fullResponse`, so the status code is on the item: a 2xx is the evidence, anything else is a failure with its
// reason, and the row books the next attempt (INVARIANTS rule 4 — delivered only when it was delivered).
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
  const keyOf = (a) => [S(a.workflow) || 'unknown workflow', S(a.node) || 'unknown node',
    S(a.message).toLowerCase().replace(/\d[\d.,:]*/g, '#').replace(/["'`][^"'`]*["'`]/g, '"x"').replace(/\s+/g, ' ').slice(0, 160)].join(' | ');
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
    const alert_key = keyOf(a);
    const prior = (rows || []).filter(r => r && S(r.alert_key) === alert_key)
      .sort((x, y) => S(y.last_seen_at).localeCompare(S(x.last_seen_at)))[0] || null;
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

  return { plan, keyOf, severityOf, cfgUrl, carried, DEDUPE_MINUTES, RETRY_MINUTES };
})();
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
const S = (v) => String(v == null ? '' : v).trim();
const ch = (() => { try { return $('Watch Ops Channels').first().json || {}; } catch (e) { return {}; } })();
const rows = (() => { try { return $('Watch Ops Alert').all().map(i => i.json).filter(r => r && !r.skip && S(r.alert_key)); } catch (e) { return []; } })();
const sent = ((ch.webhook_body || {}).alerts || []).map(a => S(a.key)).filter(Boolean);
if (!sent.length) return [{ json: { skip: true, reason: 'nothing was posted' } }];
const res = AR.posted($input.first());
const now = new Date().toISOString();
return sent.map(key => {
  const r = rows.find(x => S(x.alert_key) === key) || { alert_key: key };
  const attempt = AR.attemptsOf(r) + 1;
  const giveUp = !res.ok && attempt >= AR.MAX_ATTEMPTS;
  return { json: {
    alert_key: key,
    delivered: res.ok ? 'webhook' : giveUp ? 'abandoned' : 'failed',
    channels: S(r.channels) || 'webhook,data_table',
    severity: res.ok ? (S(r.severity) || 'high') : AR.severityFor(r, attempt),
    attempts: attempt,
    last_attempt_at: now,
    next_attempt_at: res.ok || giveUp ? '' : new Date(Date.now() + AR.RETRY_MINUTES * 60000).toISOString(),
    attempt_log: AR.addAttempt(r, attempt, now, 'webhook', res.ok, res.detail),
    notes: (res.ok ? 'delivered by webhook with the day\'s key-page digest (' + res.detail + ')'
      : giveUp ? 'given up after ' + attempt + ' attempts — this change reached nobody and is on record here and in the app only (' + res.detail + ')'
      : 'the key-page digest did not arrive (' + res.detail + '); the next run of any workflow tries again after ' + AR.RETRY_MINUTES + ' minutes').slice(0, 500)
  } };
});
