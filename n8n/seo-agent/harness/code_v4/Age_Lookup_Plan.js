// Domain age for the competitor benchmark (v4.6 — no repeated lookups): registration dates are kept in seo_cache ('age:<domain>', 365 days;
// a date nobody could answer is retried after 30 days) and looked up only when missing: first free RDAP, then paid DataForSEO WHOIS (~$0.12
// per domain) only for what RDAP cannot answer.
const CONFIG = { ttl_days: 365, unknown_ttl_days: 30 };
const list = $('Pick Competitors').all().map(i => i.json);
let cache = []; try { cache = $('Load Age Cache').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
const fresh = (r) => { let v = null; try { v = JSON.parse(r.value); } catch (e) {} if (!v) return null; const days = (Date.now() - new Date(r.updated_at).getTime()) / 864e5; return days < (v.registered ? CONFIG.ttl_days : CONFIG.unknown_ttl_days) ? v : null; };
const need = [...new Set(list.map(c => String(c.domain || '').toLowerCase()).filter(Boolean))].filter(d => { const r = cache.find(x => x.key === 'age:' + d); return !(r && fresh(r)); });
return need.length ? need.map(d => ({ json: { domain: d } })) : [{ json: { skip: true } }];
