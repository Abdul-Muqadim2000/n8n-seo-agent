// Monthly technical re-audit, step 1: the sites with audits switched on (and an e-mail or callback to deliver to). Their sitemap is read next
// (free) so the plan can tell whether anything changed since the last audit.
/*__MONITOR_SITES__*/
const { list, on_demand, want, total } = monitorSites('audit');
const audits = rowsOf('Load Audits');
const out = []; const skipped = [];
for (const s of list.slice(0, 20)) {
  if (!s.email && !s.callback_url) { skipped.push(s.domain + ' (no e-mail or callback to deliver to)'); continue; }
  const last = audits.filter(a => a.site_id === s.site_id).sort((a, b) => String(b.audited_at).localeCompare(String(a.audited_at)))[0] || null;
  out.push({ json: { site_id: s.site_id, domain: s.domain, country: s.country || 'United States', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', settings: s.settings, on_demand,
    last_audit: last ? { audited_at: last.audited_at, health_score: Number(last.health_score) || 0, critical: Number(last.critical) || 0, high: Number(last.high) || 0 } : null, sitemap_url: 'https://' + s.domain + '/sitemap.xml', skipped } });
}
if (!out.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'no site to audit' : 'no sites yet'), skipped } }];
return out;
