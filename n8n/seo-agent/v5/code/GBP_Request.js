// Brand / entity check in the audit: the business name to look up on Google Business Profile (DataForSEO Business Data, $0.0054): from the
// business profile, else the homepage's Organization / LocalBusiness schema, else og:site_name. No name = no lookup.
const base = $('Check Crawl').first().json; const domain = base.domain;
const site_id = 'site_' + String(domain).toLowerCase().replace(/[^a-z0-9]+/g, '-');
let prof = {}; try { prof = $('Load Profile (Audit)').all().map(i => i.json).find(x => x && x.site_id === site_id) || {}; } catch (e) {}
let html = ''; try { const ps = $('Content Probes').all().map(i => i.json), rs = $('Run Content Probes').all().map(i => i.json); const i = ps.findIndex(p => p.id === 'home_content'); const r = rs[i] || {}; html = String(r.body || r.data || ''); } catch (e) {}
const ld = []; for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { const j = JSON.parse(m[1].trim()); const arr = Array.isArray(j) ? j : (j['@graph'] ? j['@graph'] : [j]); ld.push(...arr.filter(x => x && typeof x === 'object')); } catch (e) {} }
const types = (x) => [].concat(x['@type'] || []).map(String);
const org = ld.find(x => types(x).some(t => /Organization|LocalBusiness|Corporation|ProfessionalService|Store|Service$/.test(t) && t !== 'Service')) || null;
const ogName = (html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
const name = String(prof.business_name || (org && org.name) || ogName || '').trim();
const city = String(prof.city || (org && org.address && (org.address.addressLocality || '')) || '').trim();
const out = { site_id, domain, business_name: name, city, profile: prof.site_id ? prof : null, homepage_org: org ? { name: org.name || '', type: types(org).join('/'), telephone: org.telephone || '', sameAs: [].concat(org.sameAs || []), address: org.address || null, logo: typeof org.logo === 'string' ? org.logo : ((org.logo || {}).url || '') } : null,
  homepage_phones: [...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1].trim()))].slice(0, 5), homepage_social: [...new Set([...html.matchAll(/href=["'](https?:\/\/(?:[a-z]+\.)?(?:linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com)\/[^"'#?]+)["']/gi)].map(m => m[1]))].slice(0, 8) };
if (!name) return [{ json: { ...out, skip: true } }];
// two lookups when the name and the domain differ (live finding: "Tech& Dubai" found nothing; symbols in a name defeat the search)
const label = domain.split('.')[0]; const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const keys = [...new Set([name + (city ? ' ' + city : ''), ...(norm(label) !== norm(name) && label.length >= 4 ? [label + (city ? ' ' + city : '')] : [])])];
return keys.map((k, i) => ({ json: { ...out, skip: false, lookup: k, endpoint: 'https://api.dataforseo.com/v3/business_data/google/my_business_info/live', body: [{ keyword: k, location_code: base.location_code || 2840, language_code: base.language_code || 'en' }] } }));
