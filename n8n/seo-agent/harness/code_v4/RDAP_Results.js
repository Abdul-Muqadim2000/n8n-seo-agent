// What free RDAP answered; only the domains it could not answer go to DataForSEO WHOIS (one paid request each).
// ---- RDAP answers (shared; inlined by build_v4.py where /*__RDAP__*/ stands) ----
// The HTTP node hands application/rdap+json over as TEXT under `data` (or `body` with the full response), not as an object: seen in the
// live full report of 2026-10-11 (D7), when every domain went to paid WHOIS although RDAP had its registration date. A real object is used as is.
const rdapOf = (r) => {
  if (!r || typeof r !== 'object') return {};
  if (Array.isArray(r.events)) return r;
  const raw = r.body ?? r.data;
  if (typeof raw === 'string') { try { const o = JSON.parse(raw); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (e) { return {}; } }
  return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
};
const regOf = (r) => { const e = (rdapOf(r).events || []).find(x => x && /registration/i.test(x.eventAction || '')); return e && e.eventDate ? String(e.eventDate).slice(0, 10) : null; };
const asked = $('Age Lookup Plan').all().map(i => i.json);
const rd = $input.all().map(i => i.json || {});
const left = asked.filter((a, i) => a.domain && !regOf(rd[i]));
return left.length ? left.map(a => ({ json: { domain: a.domain } })) : [{ json: { skip: true } }];
