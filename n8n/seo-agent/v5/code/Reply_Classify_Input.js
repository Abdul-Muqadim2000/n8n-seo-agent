// The reply for the Reply Reader, with what the link check found (a reply saying "done" is believed only when the link is on the page).
/*__LINK_KIT__*/
const r = $('Reply Input').first().json;
let reqs = [], resps = []; try { reqs = $('Reply Link Requests').all().map(i => i.json).filter(x => !x.skip); resps = $('Fetch Reply Pages').all().map(i => i.json || {}); } catch (e) {}
const checks = reqs.map((q, i) => { const v = LK.verify(resps[i] || {}, r.domain, { url: q.url }); return { url: q.url, verify: v.verify, rel: v.rel || '', anchor: v.anchor || '', placement: v.placement || '' }; });
const found = checks.find(c => c.verify === 'found') || null;
return [{ json: { ...r, link_found: !!found, link: found, checks, link_note: found ? 'OUR LINK IS LIVE on ' + found.url + ' (' + found.rel + ', anchor "' + found.anchor + '")' : (checks.length ? 'our link was NOT found on: ' + checks.map(c => c.url + ' (' + c.verify + ')').join(', ') : 'no page checked') } }];
