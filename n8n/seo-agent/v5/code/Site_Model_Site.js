// G19 (2026-10-12): the weekly resolver — one site model per site of this run, built from what the run already has: the stored seo_sites
// row, the business profile (seo_profiles), the monitor settings (seo_monitors: brand names, competitors) and, when the model was older
// than a week, the homepage as a browser gets it (redirects followed) for the canonical host, the Organization / LocalBusiness schema and
// the nav pages. Site Metrics merges SM.toRow(model) into the seo_sites row, so the next run and every other workflow read the same facts.
// The page inventory (seo_pages) is added later in the run, where the Search Console pages are known (SM.withPages; D11).
/*__SITE_MODEL__*/
const rowsOf = (nm) => { try { return $(nm).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const sites = $('Site Plan').all().map(i => i.json).filter(s => s && s.site_id && s.domain);
const siteRows = rowsOf('Load Sites').filter(r => r.site_id);
const profiles = rowsOf('Load Profiles (Site)').filter(r => r.site_id);
const monitors = rowsOf('Load Monitors (Site)').filter(r => r.site_id);
const targets = (() => { try { return $('Model Targets (Site)').all().map(i => i.json).filter(t => t && t.fetch); } catch (e) { return []; } })();
const answers = (() => { try { return $('Fetch Homepage (Site)').all().map(i => i.json); } catch (e) { return []; } })();
const bodyOf = (r) => String((r && (r.body != null ? r.body : r.data)) || '');   // responseFormat text + full response: the body sits under `data`
return sites.map(s => {
  const row = siteRows.find(r => r.site_id === s.site_id) || {};
  const idx = targets.findIndex(t => t.site_id === s.site_id);
  const res = idx >= 0 ? (answers[idx] || {}) : null;
  const status = res ? (Number(res.statusCode) || 0) : 0;
  const html = res && status >= 200 && status < 400 ? bodyOf(res) : '';
  const final_url = res ? String((res.headers || {}).location || '') : '';
  const fresh = idx >= 0 && !!html;
  const seen_hosts = (s.ladder_pages || []).map(p => p.url).filter(Boolean);
  const extras = { site_id: s.site_id, domain: s.domain, seen_hosts, profile: profiles.find(p => p.site_id === s.site_id) || {}, monitors: monitors.find(m => m.site_id === s.site_id) || {} };
  const model = fresh
    ? SM.from(row, { ...extras, html, final_url, updated_at: new Date().toISOString() })
    : (SM.stored(row) || SM.from(row, extras));
  return { json: { site_id: s.site_id, domain: s.domain, model, rebuilt: fresh, homepage_status: status, age_days: Math.round(SM.ageDays(model) * 10) / 10 } };
});
