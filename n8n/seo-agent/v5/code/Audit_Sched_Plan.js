// Monthly technical re-audit (1st of the month 06:00, and on demand): one technical audit per site with audits switched on, unless the site was
// audited in the last 25 days. Each audit runs as its own execution through API Entry (internal key "audit:") and delivers itself: report +
// "since the last audit" diff + fix pack. The crawl size / JavaScript rendering come from the site's monitor settings.
/*__MONITOR_SITES__*/
const CONFIG = { max_sites_per_run: 20, min_days_between: 25 };
const { list, on_demand, want, total } = monitorSites('audit');
const audits = rowsOf('Load Audits');
const now = Date.now(); const ym = new Date().toISOString().slice(0, 7).replace('-', '');
const out = [], skipped = [];
for (const s of list.slice(0, CONFIG.max_sites_per_run)) {
  const last = audits.filter(a => a.site_id === s.site_id).sort((a, b) => String(b.audited_at).localeCompare(String(a.audited_at)))[0];
  const days = last ? Math.floor((now - new Date(last.audited_at).getTime()) / 864e5) : null;
  if (!on_demand && days != null && days < CONFIG.min_days_between) { skipped.push(s.domain + ' (audited ' + days + ' days ago)'); continue; }
  if (!s.email && !s.callback_url) { skipped.push(s.domain + ' (no e-mail or callback to deliver to)'); continue; }
  out.push({ json: { body: { mode: 'audit', domain: s.domain, country: s.country || 'United States', report_type: 'Site Audit (technical issues only)', email: s.email || '', callback_url: s.callback_url || '',
    request_id: s.request_id || ('aud_' + ym + '_' + s.site_id.replace(/^site_/, '')), client_ip: 'audit:' + s.site_id, crawl_pages: s.settings.audit_js ? Math.min(500, s.settings.audit_pages) : s.settings.audit_pages, crawl_js: s.settings.audit_js, scheduled: true },
    domain: s.domain, last_audit_days: days, skipped } });
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'no audit due' : 'no sites yet'), skipped } }];
return out;
