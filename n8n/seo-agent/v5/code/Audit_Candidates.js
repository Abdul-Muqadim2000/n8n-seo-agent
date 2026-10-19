// Monthly technical re-audit, step 1: the sites with audits switched on (and an e-mail or callback to deliver to). Their sitemap is read next
// (free) so the plan can tell whether anything changed since the last audit.
/*__MONITOR_SITES__*/
/*__SITE_MODEL__*/
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.3 / §4.4, owner decision D2): the audit runs in each website's MONTHLY cycle - day one, then the first
// cycle on or after its monthly date. A cycle run (`trigger: 'cycle'`, job audit) with `monthly: false` audits nothing (the dispatcher only
// starts it on a monthly cycle; this is the guard if it ever does). The sitemap rules of Audit Schedule Plan still decide whether it re-crawls.
const { list, on_demand, want, total, cycle, cycle_why } = monitorSites('audit');
if (cycle && list.length && !cycle.monthly) return [{ json: { nothing_to_do: true, cycle, reason: 'the audit runs in ' + list[0].domain + '\'s monthly cycle; this cycle (' + (cycle.label || cycle.key) + ') is not one', skipped: [] } }];
const audits = rowsOf('Load Audits');
const out = []; const skipped = [];
for (const s of list.slice(0, 20)) {
  if (!s.email && !s.callback_url) { skipped.push(s.domain + ' (no e-mail or callback to deliver to)'); continue; }
  const last = audits.filter(a => a.site_id === s.site_id).sort((a, b) => String(b.audited_at).localeCompare(String(a.audited_at)))[0] || null;
  out.push({ json: { site_id: s.site_id, domain: s.domain, country: s.country || 'United States', ga4_property_id: String(s.ga4_property_id || ''), email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', settings: s.settings, on_demand,
    last_audit: last ? { audited_at: last.audited_at, health_score: Number(last.health_score) || 0, critical: Number(last.critical) || 0, high: Number(last.high) || 0 } : null, sitemap_url: SM.siteUrl(SM.stored(s) || { domain: s.domain }, '/sitemap.xml'), skipped, cycle } });
}
if (!out.length) return [{ json: { nothing_to_do: true, cycle, reason: cycle ? (cycle_why || (skipped.length ? 'nothing to deliver the audit to: ' + skipped.join('; ') : 'nothing to audit for this cycle')) : on_demand ? 'no site matches "' + want + '"' : (total ? 'no site to audit' : 'no sites yet'), skipped } }];
return out;
