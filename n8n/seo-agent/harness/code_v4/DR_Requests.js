// Ahrefs Domain Rating (v4.10, free with an Ahrefs API key — a free Ahrefs account is enough; only when SEO_AHREFS_API_KEY is in n8n/.env):
// the authority score most clients know, for up to 1,000 domains per request (public/domain-rating-free). Its licence asks for a visible
// "Domain Rating by Ahrefs" credit linking to ahrefs.com wherever the score is shown (the report and the app do this), and forbids building a
// competing dataset from it: it is read for the site's own referrers and prospects only, once a month (full runs) and on demand.
const AHREFS = true;
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const merged = $('Link Merge').all().map(i => i.json).filter(m => !m.skip);
let ver = []; try { ver = $('Verify Links').all().map(i => i.json).filter(v => !v.skip); } catch (e) {}
const out = [];
if (AHREFS) for (const m of merged) {
  const p = plans.find(x => x.site_id === m.site_id) || {}; if (p.mode !== 'full') continue;
  const want = new Set([...m.entries.filter(e => e.kind === 'web').sort((a, b) => (b.visits - a.visits) || ((b.authority || 0) - (a.authority || 0))).map(e => e.ref_domain), ...ver.filter(v => v.site_id === m.site_id && v.ref_domain && (v.purpose === 'mention' || v.purpose === 'list')).map(v => v.ref_domain), ...(m.cc_gap || []).map(g => g.domain), ...(p.competitors || []), p.domain]);
  const targets = [...want].filter(d => d && d.includes('.')).slice(0, 1000);
  if (targets.length) out.push({ json: { site_id: m.site_id, targets, url: 'https://api.ahrefs.com/v3/public/domain-rating-free', body: { targets } } });
}
return out.length ? out : [{ json: { skip: true } }];
