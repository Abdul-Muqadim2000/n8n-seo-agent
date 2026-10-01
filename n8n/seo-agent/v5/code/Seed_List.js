// Accepts an object (from the Structured Output Parser) or a string with/without code fences
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  return {};
};
const base = $('Route Mode').first().json;
const ai = parseAgentJson($input.first().json.output);
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const norm = (s) => String(s || '').toLowerCase().replace(/[^\w\s&\-]/g, ' ').replace(/\s+/g, ' ').trim();
const groups = ai.seed_groups && typeof ai.seed_groups === 'object' ? ai.seed_groups : {};
const ordered = [];
// primary + services first, then problems, comparisons, pricing, local, audience, then anything else the model returned
const order = ['services', 'problems', 'comparisons', 'pricing', 'local', 'audience'];
const push = (s) => { const k = norm(s); const w = k.split(' ').length; if (!k || w < 2 || w > 6) return; if (brand.length > 3 && k.includes(brand)) return; if (!ordered.includes(k)) ordered.push(k); };
if (ai.primary_seed) push(ai.primary_seed);
for (const g of order) (groups[g] || []).forEach(push);
(ai.seeds || []).forEach(push);
(((base.site_description || {}).seed_keywords) || []).forEach(push);
if (!ordered.length && base.business) push(String(base.business).split(/[.,]/)[0].slice(0, 60));
const seed_groups = {};
for (const g of Object.keys(groups)) seed_groups[g] = (groups[g] || []).map(norm).filter(Boolean).slice(0, 8);
return [{ json: { ...base, seeds: ordered.slice(0, 30), primary_seed: ordered[0] || '', seed_groups, services: ai.services || [] } }];
