// What free RDAP answered; the domains it could not answer go to DataForSEO WHOIS (one request each).
const asked = $('Age Lookup Plan').all().map(i => i.json);
const rd = $input.all().map(i => i.json || {});
const regOf = (r) => { const e = ((r && r.events) || []).find(x => /registration/i.test(x.eventAction || '')); return e && e.eventDate ? String(e.eventDate).slice(0, 10) : null; };
const left = asked.filter((a, i) => a.domain && !regOf(rd[i]));
return left.length ? left.map(a => ({ json: { domain: a.domain } })) : [{ json: { skip: true } }];
