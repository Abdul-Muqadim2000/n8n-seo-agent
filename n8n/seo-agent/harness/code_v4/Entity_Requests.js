// Monthly entity check (Wikidata, free): is the business an entity AI models and knowledge graphs can resolve — by its name, and by its website (P856).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.entity_due);
const API = 'https://www.wikidata.org/w/api.php?format=json&';
const out = [];
for (const p of plans) {
  const name = p.business_name || p.brand_names.find(b => !/\./.test(b)) || p.domain.split('.')[0];
  out.push({ json: { site_id: p.site_id, kind: 'name', url: API + 'action=wbsearchentities&language=en&limit=7&search=' + encodeURIComponent(name) } });
  for (const v of ['https://' + p.domain, 'https://' + p.domain + '/', 'https://www.' + p.domain, 'https://www.' + p.domain + '/'])
    out.push({ json: { site_id: p.site_id, kind: 'site', url: API + 'action=query&list=search&srlimit=3&srsearch=' + encodeURIComponent('haswbstatement:P856=' + v) } });
}
return out.length ? out : [{ json: { skip: true } }];
