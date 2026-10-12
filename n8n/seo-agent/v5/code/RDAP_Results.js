// What free RDAP answered; only the domains it could not answer go to DataForSEO WHOIS (one paid request each).
/*__RDAP__*/
const asked = $('Age Lookup Plan').all().map(i => i.json);
const rd = $input.all().map(i => i.json || {});
const left = asked.filter((a, i) => a.domain && !regOf(rd[i]));
return left.length ? left.map(a => ({ json: { domain: a.domain } })) : [{ json: { skip: true } }];
