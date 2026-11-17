// G11 (2026-10-13): one alert per change the daily watch found, written to seo_console_alerts the same day — the table the app's Alerts page
// and the Monday report already read, so the customer sees it where every other notice about their site appears (`kind: page_watch`,
// `source: page_watch`). The message id holds the site, the page, the kind of change and the day, so one change is recorded once however
// often the watch runs. Good news (the page answers again, the noindex is gone) is recorded as `info`: it is how a fix shows up.
// Build section 194 (client report 2026-11-17, devaicon.com F5): eight High alerts stayed open for weeks, four of them about redirects the
// client made on our advice, and nothing ever closed one. Now one alert per condition (`condition_key`): seen again = the same row with
// `last_seen_at` and `count`; gone = `status: resolved` with `resolved_at` and the sentence why; good news with nothing open = a resolved
// notice. "Mark as seen" in the app (ack_by / ack_at) is carried, never overwritten.
/*__PAGE_WATCH__*/
/*__RAN_LATE__*/
const ran_late = RL.of(SCHED, ['Watch Run']);   // F-L: a late watch says so on the alerts it records
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = [];
for (const s of sites) {
  const day = S(s.checked_at).slice(0, 10);
  // build section 194: one open alert per condition, updated while it lasts and resolved when the watch sees it gone (PW.lifecycle)
  const lc = PW.lifecycle({ site_id: s.site_id, domain: s.domain, now: s.checked_at, changes: s.changes || [], pages: s.pages || [], robots: s.robots || null,
    open: s.open_alerts || [], moved: s.moved || [], ran_late: ran_late.late ? ran_late.text : '' });
  rows.push(...lc.rows);
  // a re-check that answers "fixed" closes the loop for the person who pressed "I fixed this" (G11 / criterion 1.10): a resolved notice
  for (const r of (s.rechecks || []).filter(r => r.state === 'fixed')) {
    rows.push({ site_id: s.site_id, domain: s.domain, kind: 'page_watch', severity: 'info',
      subject: ('Fixed: ' + S(r.title)).slice(0, 200), summary: (S(r.note) + ' Re-checked the day after you marked it fixed, not at the next monthly audit.').slice(0, 1000),
      received_at: s.checked_at, message_id: ('watch:' + s.site_id + ':recheck:' + PW.hash(S(r.finding_key)) + ':' + day).slice(0, 200), status: 'resolved', source: 'page_watch',
      condition_key: '', last_seen_at: s.checked_at, count: 1, resolved_at: s.checked_at, resolution: 'Fixed on the key pages we checked.', ack_by: '', ack_at: '' });
  }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'nothing changed on the key pages today' } }];
