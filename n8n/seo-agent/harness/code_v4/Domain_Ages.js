// Registration dates for every benchmark domain: stored ones, RDAP answers, WHOIS answers. New answers are stored (seo_cache 'age:<domain>').
const CONFIG = { ttl_days: 365, unknown_ttl_days: 30 };
const list = $('Pick Competitors').all().map(i => i.json);
let cache = []; try { cache = $('Load Age Cache').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
let asked = [], rdaps = [], wasked = [], whois = [];
try { asked = $('Age Lookup Plan').all().map(i => i.json).filter(a => !a.skip); rdaps = $('RDAP Lookup').all().map(i => i.json || {}); } catch (e) {}
try { wasked = $('RDAP Results').all().map(i => i.json).filter(a => !a.skip); whois = $('DataForSEO Whois').all().map(i => i.json || {}); } catch (e) {}
const ages = {}; const now = new Date().toISOString();
for (const r of cache) { let v = null; try { v = JSON.parse(r.value); } catch (e) {} if (!v) continue; const days = (Date.now() - new Date(r.updated_at).getTime()) / 864e5;
  if (days < (v.registered ? CONFIG.ttl_days : CONFIG.unknown_ttl_days)) ages[String(r.key).slice(4)] = { registered: v.registered || null, source: (v.source || 'stored') + ', stored ' + String(r.updated_at).slice(0, 10) }; }
asked.forEach((a, i) => { const e = ((rdaps[i] || {}).events || []).find(x => /registration/i.test(x.eventAction || '')); if (e && e.eventDate) ages[a.domain] = { registered: String(e.eventDate).slice(0, 10), source: 'rdap' }; });
wasked.forEach((a, i) => { const w = ((((whois[i] || {}).tasks || [])[0] || {}).result || [])[0]; const it = ((w || {}).items || [])[0] || null; const reg = it && (it.created_datetime || it.created_date); if (reg) ages[a.domain] = { registered: String(reg).slice(0, 10), source: 'whois' }; });
const rows = [];
for (const a of asked) { if (!ages[a.domain]) ages[a.domain] = { registered: null, source: 'unknown' }; rows.push({ key: 'age:' + a.domain, kind: 'age', site_id: '', value: JSON.stringify({ registered: ages[a.domain].registered, source: ages[a.domain].source }), updated_at: now }); }
for (const c of list) { const d = String(c.domain || '').toLowerCase(); if (d && !ages[d]) ages[d] = { registered: null, source: 'unknown' }; }
return [{ json: { ages, rows, looked_up: asked.length, whois_requests: wasked.length } }];
