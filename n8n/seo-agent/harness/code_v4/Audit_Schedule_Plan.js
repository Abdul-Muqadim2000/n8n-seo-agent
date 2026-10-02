// Monthly technical re-audit, step 2 (v4.6 — no repeated audits): a site is re-crawled only when it changed. The sitemap fingerprint (URLs +
// lastmod dates, or the sitemap index entries) is compared with the one stored at the last check (seo_cache 'sitemap:<site>').
// Audit when: on demand · never audited · the fingerprint changed · 60+ days since the last audit (safety net for changes a sitemap does not
// show: theme, plugins, server, links) · no readable sitemap, or a sitemap index without lastmod dates, and 25+ days (change cannot be
// detected: monthly as before). Otherwise skip; the weekly Site Tracker keeps watching indexing in
// Search Console between audits. Each started audit compares itself with the previous one and delivers report + fix pack.
const CONFIG = { min_days_between: 25, safety_net_days: 60 };
const cands = $('Audit Candidates').all().map(i => i.json).filter(c => !c.nothing_to_do);
const maps = $input.all().map(i => i.json || {});
let cache = []; try { cache = $('Load Cache (Audit)').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const ym = new Date().toISOString().slice(0, 7).replace('-', ''); const now = new Date().toISOString();
const fingerprint = (r) => { const status = Number(r.statusCode) || 0; const body = String(r.body != null ? r.body : (r.data != null ? r.data : ''));
  if (status !== 200 || !/<(urlset|sitemapindex)/i.test(body)) return null;
  const entries = [...body.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)].map(m => { const loc = (m[1].match(/<loc>\s*([^<\s]+)/i) || [])[1] || ''; const lm = (m[1].match(/<lastmod>\s*([^<\s]+)/i) || [])[1] || ''; return loc + '|' + lm; }).filter(x => x.length > 1).sort();
  const lastmods = entries.map(e => e.split('|')[1]).filter(Boolean).sort();
  const index = /<sitemapindex/i.test(body); if (!entries.length || (index && !lastmods.length)) return null;   // an index without dates hides page changes
  return { fp: hash(entries.join('\n')), entries: entries.length, index, latest_lastmod: lastmods[lastmods.length - 1] || '' }; };
// The stored fingerprint is replaced only when an audit starts now (or none is stored yet): a skipped site keeps the old one, so a change made
// after the last audit is still caught next month.
const out = [];
cands.forEach((c, i) => {
  const fp = fingerprint(maps[i] || {}); const stored = cache.find(r => r.key === 'sitemap:' + c.site_id); let prev = null; try { prev = stored ? JSON.parse(stored.value) : null; } catch (e) {}
  const days = c.last_audit ? Math.floor((Date.now() - new Date(c.last_audit.audited_at).getTime()) / 864e5) : null;
  let run, why;
  if (c.on_demand) { run = true; why = 'on demand'; }
  else if (days == null) { run = true; why = 'never audited'; }
  else if (days < CONFIG.min_days_between) { run = false; why = 'audited ' + days + ' days ago'; }
  else if (days >= CONFIG.safety_net_days) { run = true; why = days + ' days since the last audit (safety net)'; }
  else if (!fp) { run = true; why = 'no readable sitemap (or an index without dates): change cannot be detected, monthly audit'; }
  else if (!prev) { run = false; why = 'fingerprint stored now; the next change to the site triggers an audit'; }
  else if (prev.fp !== fp.fp) { run = true; why = 'site changed since the last check (' + (fp.entries - (prev.entries || 0) >= 0 ? '+' : '') + (fp.entries - (prev.entries || 0)) + ' sitemap entries' + (fp.latest_lastmod && fp.latest_lastmod !== prev.latest_lastmod ? ', pages updated ' + fp.latest_lastmod.slice(0, 10) : '') + ')'; }
  else { run = false; why = 'no change since ' + String(c.last_audit.audited_at).slice(0, 10) + ' (next safety audit after ' + CONFIG.safety_net_days + ' days)'; }
  const pages = c.settings.audit_js ? Math.min(500, c.settings.audit_pages) : c.settings.audit_pages;
  out.push({ json: { site_id: c.site_id, domain: c.domain, run, why, days_since_audit: days, fingerprint: fp, cache_row: fp && (run || !prev || prev.fp === fp.fp) ? { key: 'sitemap:' + c.site_id, kind: 'sitemap', site_id: c.site_id, value: JSON.stringify({ ...fp, url: c.sitemap_url, checked_at: now }), updated_at: now } : null,
    body: run ? { mode: 'audit', domain: c.domain, country: c.country, report_type: 'Site Audit (technical issues only)', email: c.email, callback_url: c.callback_url, request_id: c.request_id || ('aud_' + ym + '_' + c.site_id.replace(/^site_/, '')), client_ip: 'audit:' + c.site_id, crawl_pages: pages, crawl_js: c.settings.audit_js, scheduled: true, audit_reason: why } : null, skipped: c.skipped } });
});
return out;
