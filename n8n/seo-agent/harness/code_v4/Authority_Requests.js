// Authority for the domains no index scored this run (v4.10): referrers found by Bing, Search Console, GA4, Common Crawl or the news, the
// mention / list pages and the Common Crawl gap. One DataForSEO bulk_ranks request per site (up to 1,000 domains, rank 0-1000, the same
// scale as the rest of the report) and, on full runs, bulk_spam_score for the same domains.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const merged = $('Link Merge').all().map(i => i.json).filter(m => !m.skip && !(plans.find(p => p.site_id === m.site_id) || {}).free_only);   // free_only: Common Crawl ranks only
let ver = []; try { ver = $('Verify Links').all().map(i => i.json).filter(v => !v.skip); } catch (e) {}
const API = 'https://api.dataforseo.com/v3/';
const out = [];
for (const m of merged) {
  const want = new Set();
  for (const e of m.entries) if (e.kind === 'web' && !(e.authority > 0) && !(e.prev && Number(e.prev.authority) > 0 && String(e.prev.updated_at || '').slice(0, 7) === String(new Date().toISOString()).slice(0, 7))) want.add(e.ref_domain);
  for (const v of ver) if (v.site_id === m.site_id && (v.purpose === 'mention' || v.purpose === 'list') && v.ref_domain) want.add(v.ref_domain);
  for (const g of (m.cc_gap || [])) want.add(g.domain);
  const targets = [...want].filter(d => d && d.includes('.')).slice(0, 1000);
  if (!targets.length) continue;
  out.push({ json: { site_id: m.site_id, kind: 'ranks', targets, endpoint: API + 'backlinks/bulk_ranks/live', body: [{ targets }] } });
  if (m.mode === 'full') out.push({ json: { site_id: m.site_id, kind: 'spam', targets, endpoint: API + 'backlinks/bulk_spam_score/live', body: [{ targets }] } });
}
return out.length ? out : [{ json: { skip: true } }];
