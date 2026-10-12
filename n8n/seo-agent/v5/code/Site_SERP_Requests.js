// Live Google check (DataForSEO SERP, top 50, ~$0.015 each) for the site's own tracked keywords. Ladder keywords are checked by the
// Rank Tracker workflow and only read here; keywords without a market (location) are skipped. Max 20 per site.
// v4.6: a keyword Search Console already reports (position with impressions this period) is not bought again every week; it gets one live
// cross-check a month (SERP features, live vs average). Keywords without Search Console data are checked every week as before.
// G6 (2026-10-12): each check carries the site's competitor list (the one site model: seo_monitors + the seo_sites model column), so
// Parse Site SERP can record the competitors' positions and the share of voice from the same answer. No model = no competitor list.
const gscAll = (() => { try { return $('Parse GSC').all().map(i => i.json).filter(g => g && !g.skip); } catch (e) { return []; } })();
const models = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const competitorsFor = (s) => { const m = models.find(x => x.site_id === s.site_id) || null; return ((m && m.model && m.model.competitors) || []); };
const daysSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9;
const sites = $('Resolve Properties').all().map(i => i.json);
const out = [];
sites.forEach((s, idx) => {
  if (!(Number(s.location_code) > 0)) return;
  const g = gscAll.find(x => x.site_idx === idx || x.site_id === s.site_id); const gscPos = new Map(((g && g.tracked) || []).filter(k => Number(k.position) > 0).map(k => [k.keyword, k.position]));
  const competitors = competitorsFor(s);
  (s.tracked || []).filter(t => t.source === 'site').filter(t => !gscPos.has(t.keyword) || daysSince(((s.serp_positions || {})[t.keyword] || {}).checked_at) >= 28).slice(0, (s.config || {}).max_serp_checks || 20).forEach(t => out.push({ json: { site_idx: idx, site_id: s.site_id, domain: s.domain, keyword: t.keyword, competitors,
    endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: [{ keyword: t.keyword, location_code: Number(s.location_code), language_code: s.language_code || 'en', depth: 50, device: 'desktop', os: 'windows' }] } }));
});
return out.length ? out : [{ json: { skip: true, reason: 'no site keywords to check live' } }];
