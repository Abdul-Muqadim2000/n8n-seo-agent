// Site tracker plan: one job per tracked site. Sites come from the Data Table "seo_sites" (registered through the form option
// "Track my site" / API mode "track") plus every domain that has a keyword ladder (registered automatically, e-mail from the ladder).
// Google data is read for the last 28 complete days ending 3 days ago (Search Console data is final after about 3 days),
// against the 28 days before and the same 28 days a year earlier.
const CONFIG = {
  service_account_email: 'devai-seo@techand-site.iam.gserviceaccount.com',   // filled from n8n/.env (SEO_GOOGLE_SA_EMAIL) at build time; shown in the connect instructions
  max_sites_per_run: 25, max_tracked_keywords: 40, max_gsc_keyword_requests: 30, max_inspections: 20, max_trend_keywords: 4, max_serp_checks: 20,
  striking_min_impressions: 30,     // "striking distance": position 4-20 with at least this many impressions in 28 days
  ctr_gap_min_impressions: 100,     // CTR gap: top-10 position, at least this many impressions, CTR under half the expected rate for the position
  decay_drop_pct: 25,               // decaying page: clicks down by this much vs the previous 28 days (and at least 10 clicks before)
  alert_drop_pct: 30                // alert when site clicks / organic sessions drop by this much
};
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const kwList = (s) => String(s || '').split(/[\n,;]+/).map(k => k.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain);
const ladders = rowsOf('Load Ladders').filter(r => r.ladder_id && r.domain && r.keyword);
const history = rowsOf('Load Rank History').filter(r => r.keyword && r.checked_at);
const logRows = rowsOf('Load Content Log').filter(r => r.keyword && r.domain);   // pages written by the Content Cadence / reported as published
const alertRows = rowsOf('Load Console Alerts').filter(r => r.domain && r.kind);     // Search Console notification mails + check-in flags
const checkinRows = rowsOf('Load Check-ins').filter(r => r.site_id && r.month);     // monthly owner check-ins (manual action / security / Pages export)
const byDomain = new Map();
for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: kwList(s.keywords), virtual: false }); }
for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, gsc_property: '', ga4_property_id: '', country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', created_at: '', last_run_at: '', request_id: l.request_id || '', virtual: true }); }
// a registered site without an address inherits the ladder's e-mail / callback for the same domain (API registrations with callback only)
for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
const on_demand = !!want;
let list = [...byDomain.values()];
if (on_demand) list = list.filter(s => s.domain === want || s.site_id === want);
else list = list.filter(s => String(s.status || 'active') !== 'paused');
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no tracked site matches "' + want + '"' : 'no sites to track yet (register one through "Track my site" or plan a keyword ladder)', sites: byDomain.size } }];
const end = new Date(Date.now() - 3 * 864e5); end.setUTCHours(0, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10); const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const ranges = { current: { start: iso(addDays(end, -27)), end: iso(end) }, previous: { start: iso(addDays(end, -55)), end: iso(addDays(end, -28)) }, yoy: { start: iso(addDays(end, -27 - 364)), end: iso(addDays(end, -364)) } };
const now = new Date().toISOString();
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0) || (Number(a.page_no) || 0) - (Number(b.page_no) || 0));
  const tracked = []; const seen = new Set();
  for (const k of s.keywords) if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'site', rung: 0, ladder_id: '', head_keyword: '' }); }
  for (const l of lrows) { const k = String(l.keyword).toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'ladder', rung: Number(l.rung) || 0, ladder_id: l.ladder_id, head_keyword: String(l.head_keyword || '').toLowerCase() }); } }
  const pages = []; const seenU = new Set();
  for (const l of lrows) { const u = String(l.target_url || '').trim(); if (u && /^https?:\/\//.test(u) && !seenU.has(u)) { seenU.add(u); pages.push({ url: u, keyword: l.keyword, rung: Number(l.rung) || 0, status: l.status || '', ladder_id: l.ladder_id, page_exists: !!l.page_exists }); } }
  const blogs = logRows.filter(r => normD(r.domain) === s.domain);
  for (const b of blogs) { const k = String(b.keyword).toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); tracked.push({ keyword: k, source: 'blog', rung: 0, ladder_id: b.ladder_id || '', head_keyword: '' }); } }
  for (const b of blogs) { const u = String(b.published_url || '').trim(); if (u && /^https?:\/\//.test(u) && !seenU.has(u)) { seenU.add(u); pages.push({ url: u, keyword: b.keyword, rung: 0, status: 'published', ladder_id: b.ladder_id || '', page_exists: true, published_at: b.published_at || '' }); } }
  const pending_publish = blogs.filter(b => b.status === 'started' && !b.published_url).map(b => ({ keyword: b.keyword, started_at: b.started_at || '', days: Math.round((Date.now() - new Date(b.started_at || now).getTime()) / 864e5) }));
  const cutoff = new Date(Date.now() - 35 * 864e5).toISOString();
  const console_alerts = alertRows.filter(a => normD(a.domain) === s.domain && String(a.received_at) >= cutoff).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at))).slice(0, 10).map(a => ({ kind: a.kind, severity: a.severity, subject: a.subject, summary: a.summary, received_at: a.received_at, source: a.source || 'mail' }));
  const cks = checkinRows.filter(c => c.site_id === s.site_id).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  const last_checkin = cks[0] ? { month: cks[0].month, manual_action: !!cks[0].manual_action, security_issue: !!cks[0].security_issue, not_indexed_total: Number(cks[0].not_indexed_total), csv_kind: cks[0].csv_kind || 'none', coverage: (() => { try { return JSON.parse(cks[0].coverage_json || '{}'); } catch (e) { return {}; } })(), notes: cks[0].notes || '', submitted_at: cks[0].submitted_at || '' } : null;
  const checkin_due = !cks.some(c => c.month === now.slice(0, 7));
  const serp = {};
  for (const h of history) { if (normD(h.domain) !== s.domain) continue; const k = String(h.keyword).toLowerCase(); if (!serp[k] || String(h.checked_at) > String(serp[k].checked_at)) serp[k] = { position: Number(h.position), url: h.url || '', checked_at: h.checked_at }; }
  return { json: { site_id: s.site_id, domain: s.domain, gsc_property_hint: s.gsc_property || '', ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, ''), country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en',
    email: s.email || '', callback_url: s.callback_url || '', request_id: String(trigger.request_id || s.request_id || ''), source: s.source || 'form', status: s.status || 'active', created_at: s.created_at || now, first_run: !s.last_run_at, virtual: !!s.virtual,
    keywords: s.keywords, tracked: tracked.slice(0, CONFIG.max_tracked_keywords), ladder_pages: pages.slice(0, CONFIG.max_inspections), ladder_heads: [...new Set(lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()).filter(Boolean))],
    serp_positions: serp, pending_publish, console_alerts, last_checkin, checkin_due, ranges, on_demand, checked_at: now, config: CONFIG } };
});
