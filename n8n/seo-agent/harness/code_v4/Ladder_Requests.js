// Ladder mode: research pulls around the head term (executed by "Run Ladder Research").
//  suggestions - long-tail phrases that contain the head term
//  related     - "searches related to" the head term, depth 2
//  ideas       - keyword ideas for the head term + the site's main services (topic neighbours)
//  ranked      - keywords the client's domain already ranks for (current positions for the rungs)
const d = $input.first().json;
const head = String(d.keyword || '').trim().toLowerCase();
if (!head) throw new Error('No destination keyword for the ladder.');
const loc = d.location_code, lang = d.language_code || 'en';
const sd = d.site_description || {};
const services = [...(sd.products_or_services || []), ...(d.secondary_keywords || [])]
  .map(s => String(s || '').toLowerCase().trim()).filter(s => s && s !== head && s.split(' ').length <= 5).slice(0, 4);
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const reqs = [
  { kind: 'suggestions', label: 'long-tail for "' + head + '"', endpoint: L + 'keyword_suggestions/live',
    body: [{ keyword: head, location_code: loc, language_code: lang, limit: 500, include_serp_info: true, order_by: ['keyword_info.search_volume,desc'] }] },
  { kind: 'related', label: 'related to "' + head + '"', endpoint: L + 'related_keywords/live',
    body: [{ keyword: head, location_code: loc, language_code: lang, depth: 2, limit: 300, include_serp_info: true }] },
  { kind: 'ideas', label: 'ideas around "' + head + '"' + (services.length ? ' and ' + services.length + ' service(s)' : ''), endpoint: L + 'keyword_ideas/live',
    body: [{ keywords: [head, ...services].slice(0, 5), location_code: loc, language_code: lang, limit: 400, include_serp_info: true, ignore_synonyms: true }] }
];
if (d.domain) reqs.push({ kind: 'ranked', label: 'keywords ' + d.domain + ' ranks for', domain: d.domain, endpoint: L + 'ranked_keywords/live',
  body: [{ target: d.domain, location_code: loc, language_code: lang, limit: 500, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 60]] }] });
return reqs.map(r => ({ json: { ...r, location_code: loc, language_code: lang } }));
