// Link Analyst jobs (v4.10, full and on-demand runs): Claude reads the links an index cannot judge — what kind of link it is (editorial,
// press, list, directory, profile, partner, forum, guest post, sponsored, scraper, spam) and how related the linking page is to the business
// (0-3) — from the page title, the placement, the anchor and the text around the link that the link check read. New and changed links first,
// then the most valuable; links already labelled in an earlier run keep their label. 20 links per job, 2 jobs per site, 8 per run (~$0.02 each).
const CONFIG = { per_job: 20, max_jobs_per_site: 2, max_jobs_per_run: 8 };
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const merged = $('Link Merge').all().map(i => i.json).filter(m => !m.skip);
let ver = []; try { ver = $('Verify Links').all().map(i => i.json).filter(v => !v.skip && v.verify === 'found' && (v.purpose === 'link' || v.purpose === 'mention')); } catch (e) {}
const out = [];
for (const p of plans) {
  if (p.mode !== 'full' || p.free_only || out.length >= CONFIG.max_jobs_per_run) continue;
  const m = merged.find(x => x.site_id === p.site_id); if (!m) continue;
  const byDomain = new Map(m.entries.map(e => [e.ref_domain, e]));
  const pick = ver.filter(v => v.site_id === p.site_id).map(v => ({ v, e: byDomain.get(v.ref_domain) || {} }))
    .filter(({ e, v }) => !(e.prev && e.prev.link_type && e.prev.from_url === v.url))
    .sort((a, b) => ((!b.e.prev) - (!a.e.prev)) || ((b.e.visits || 0) - (a.e.visits || 0)) || ((b.e.authority || 0) - (a.e.authority || 0)))
    .filter((x, i, a) => a.findIndex(y => y.v.ref_domain === x.v.ref_domain) === i).slice(0, CONFIG.per_job * CONFIG.max_jobs_per_site);
  for (let i = 0; i < pick.length && out.length < CONFIG.max_jobs_per_run; i += CONFIG.per_job) {
    const chunk = pick.slice(i, i + CONFIG.per_job);
    out.push({ json: { site_id: p.site_id, domain: p.domain, business: p.business_name || p.domain, topics: (p.topics || []).join(', '), ids: chunk.map(x => x.v.ref_domain),
      links: chunk.map((x, k) => (k + 1) + '. ' + x.v.ref_domain + ' — "' + String(x.v.title || '').slice(0, 110) + '" | ' + (x.v.placement || 'body') + (x.v.rel && x.v.rel !== 'follow' ? ' | ' + x.v.rel : '') + ' | anchor: "' + String(x.v.anchor || '').slice(0, 80) + '" | text: ' + String(x.v.context || '').slice(0, 300)).join('\n') } });
  }
}
return out.length ? out : [{ json: { skip: true } }];
