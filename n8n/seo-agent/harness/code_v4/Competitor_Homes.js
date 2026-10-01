const comps = $('Pick Competitors').all().map(i => i.json).filter(c => !c.is_you);
if (!comps.length) return [{ json: { domain: '', url: 'https://example.com/', skip: true } }];
return comps.map(c => ({ json: { domain: c.domain, url: 'https://' + c.domain + '/', skip: false } }));