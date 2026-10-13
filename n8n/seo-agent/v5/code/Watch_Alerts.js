// G11 (2026-10-13): one alert per change the daily watch found, written to seo_console_alerts the same day — the table the app's Alerts page
// and the Monday report already read, so the customer sees it where every other notice about their site appears (`kind: page_watch`,
// `source: page_watch`). The message id holds the site, the page, the kind of change and the day, so one change is recorded once however
// often the watch runs. Good news (the page answers again, the noindex is gone) is recorded as `info`: it is how a fix shows up.
/*__PAGE_WATCH__*/
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = [];
for (const s of sites) {
  const day = S(s.checked_at).slice(0, 10);
  for (const c of (s.changes || [])) {
    const page = S(c.url);
    const id = 'watch:' + s.site_id + ':' + S(c.code) + ':' + PW.hash(PW.helpers.ukey(page)) + ':' + day;
    rows.push({ site_id: s.site_id, domain: s.domain, kind: 'page_watch', severity: S(c.severity),
      subject: (S(c.label).charAt(0).toUpperCase() + S(c.label).slice(1) + ': ' + (page.replace(/^https?:\/\//, '') || s.domain)).slice(0, 200),
      summary: (S(c.text) + (c.code === 'robots_changed' ? '' : ' Checked ' + S(s.checked_at).slice(0, 16).replace('T', ' ') + ' UTC by the daily key-page watch.')).slice(0, 1000),
      received_at: s.checked_at, message_id: id.slice(0, 200), status: 'new', source: 'page_watch' });
  }
  // a re-check that answers "fixed" closes the loop for the person who pressed "I fixed this" (G11 / criterion 1.10)
  for (const r of (s.rechecks || []).filter(r => r.state === 'fixed')) {
    rows.push({ site_id: s.site_id, domain: s.domain, kind: 'page_watch', severity: 'info',
      subject: ('Fixed: ' + S(r.title)).slice(0, 200), summary: (S(r.note) + ' Re-checked the day after you marked it fixed, not at the next monthly audit.').slice(0, 1000),
      received_at: s.checked_at, message_id: ('watch:' + s.site_id + ':recheck:' + PW.hash(S(r.finding_key)) + ':' + day).slice(0, 200), status: 'new', source: 'page_watch' });
  }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'nothing changed on the key pages today' } }];
