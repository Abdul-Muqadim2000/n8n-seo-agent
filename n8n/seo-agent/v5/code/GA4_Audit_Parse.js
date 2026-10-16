// B5-12: GA4's answer (key events and sessions per organic landing page, 28 days) as the `ga4_key_events` block the impact weight reads.
// connected:false always carries the reason; zero key events across the whole property is "none configured or none recorded", which is
// NOT usable as a weight (every page would be worth zero), so the weight falls back to clicks and impressions and says so.
let audit = {}; try { audit = $('Not Crawled Check').first().json || {}; } catch (e) {}
let plan = {}; try { plan = $('GA4 Key Events Plan').first().json || {}; } catch (e) {}
const out = (block) => [{ json: { ...audit, ga4_key_events: block } }];
if (plan.skip !== false) return out({ connected: false, reason: plan.reason || 'not requested' });
const r = $input.first().json || {};
const gErr = (x) => { if (!x) return 'no response'; const e = x.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const m = (e.message || e.description || (e.error && e.error.message) || ''); return String(m || JSON.stringify(e)).slice(0, 200); };
const err = gErr(r);
if (err) return out({ connected: false, property: plan.ga4_property_id, reason: 'GA4 answered: ' + err + ' (the service account needs Viewer on the property)' });
const rows = Array.isArray(r.rows) ? r.rows : [];
const by = new Map();
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/(.)\/$/, '$1') || '/';
for (const row of rows) {
  const p = pathOf(((row.dimensionValues || [])[0] || {}).value);
  const ke = Number(((row.metricValues || [])[0] || {}).value) || 0, se = Number(((row.metricValues || [])[1] || {}).value) || 0;
  const cur = by.get(p) || [p, 0, 0]; cur[1] += ke; cur[2] += se; by.set(p, cur);
}
const list = [...by.values()].sort((a, b) => b[1] - a[1]);
const tot = (r.totals && r.totals[0] && r.totals[0].metricValues) || [];
const totalKe = tot.length ? Number(tot[0].value) || 0 : list.reduce((n, x) => n + x[1], 0);
const totalSe = tot.length ? Number(tot[1].value) || 0 : list.reduce((n, x) => n + x[2], 0);
const complete = (Number(r.rowCount) || rows.length) <= rows.length;
const block = { connected: true, property: plan.ga4_property_id, period: plan.period, rows: list.slice(0, 250), rows_complete: complete,
  total_key_events: totalKe, total_sessions: totalSe, basis: 'GA4 key events on organic-search landing pages, last 28 complete days' };
if (!totalKe) return out({ ...block, usable: false, reason: 'GA4 recorded no key events from organic search in the last 28 days (none configured, or none happened), so they cannot rank the findings' });
return out({ ...block, usable: true });
