// Monthly entity check (Wikidata, free): is the business an entity AI models and knowledge graphs can resolve — by its name, and by its website (P856).
/*__SITE_MODEL__*/
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.entity_due);
const API = 'https://www.wikidata.org/w/api.php?format=json&';
const out = [];
for (const p of plans) {
  const name = p.business_name || p.brand_names.find(b => !/\./.test(b)) || p.domain.split('.')[0];
  out.push({ json: { site_id: p.site_id, kind: 'name', url: API + 'action=wbsearchentities&language=en&limit=7&search=' + encodeURIComponent(name) } });
  // every host form a Wikidata statement may use, the canonical one first (D15: built through the site model, never glued together)
  const hostForms = [...new Set([SM.helpers.normHost(p.site_host || p.domain), SM.helpers.bare(p.domain), 'www.' + SM.helpers.bare(p.domain)])];
  for (const v of hostForms.flatMap(h => { const u = SM.siteUrl({ canonical_host: h }, '/'); return [u.replace(/\/$/, ''), u]; }))
    out.push({ json: { site_id: p.site_id, kind: 'site', url: API + 'action=query&list=search&srlimit=3&srsearch=' + encodeURIComponent('haswbstatement:P856=' + v) } });
}
return out.length ? out : [{ json: { skip: true } }];
