// Discover mode: one item per DataForSEO Labs request (executed by "Run Research"). Sources:
//  ideas        - keyword_ideas for up to 20 seeds (relevance order, SERP features included)
//  suggestions  - keyword_suggestions (long-tail phrases that contain the seed) for the 3 main seeds
//  related      - related_keywords ("searches related to", depth 2) for the 2 main seeds
//  serp         - live SERP for the primary seed -> who ranks (competitor keywords are pulled next)
const d = $('Seed List').first().json;   // v4.8: the reach steps run in between
const seeds = (d.seeds || []).slice(0, 30);
const primary = d.primary_seed || seeds[0];
if (!primary) throw new Error('No seed keywords could be built from the business description or website.');
const loc = d.location_code, lang = d.language_code || 'en';
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const reqs = [];
reqs.push({ kind: 'ideas', label: 'keyword ideas for ' + Math.min(20, seeds.length) + ' seeds', endpoint: L + 'keyword_ideas/live',
  body: [{ keywords: seeds.slice(0, 20), location_code: loc, language_code: lang, limit: 600, include_serp_info: true, ignore_synonyms: true }] });
const heads = [primary, ...seeds.filter(s => s !== primary)].slice(0, 3);
heads.forEach(k => reqs.push({ kind: 'suggestions', label: 'long-tail for "' + k + '"', endpoint: L + 'keyword_suggestions/live',
  body: [{ keyword: k, location_code: loc, language_code: lang, limit: 300, include_serp_info: true, order_by: ['keyword_info.search_volume,desc'] }] }));
heads.slice(0, 2).forEach(k => reqs.push({ kind: 'related', label: 'related to "' + k + '"', endpoint: L + 'related_keywords/live',
  body: [{ keyword: k, location_code: loc, language_code: lang, depth: 2, limit: 200, include_serp_info: true }] }));
// competitor discovery uses the most local seed we have (e.g. "erp implementation dubai") so the competitors are the client's real market, not global brands
const localSeed = ((d.seed_groups || {}).local || []).find(Boolean) || primary;
reqs.push({ kind: 'serp', label: 'who ranks for "' + localSeed + '"', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
  body: [{ keyword: localSeed, location_code: loc, language_code: lang, depth: 30 }] });
return reqs.map(r => ({ json: { ...r, location_code: loc, language_code: lang } }));
