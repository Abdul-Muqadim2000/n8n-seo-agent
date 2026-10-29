// Index coverage: a page that answered a redirect is read once more at the redirect's target, so its status is the status of the page the
// redirect ends on (a redirect to a 404 is gone, not "redirects elsewhere"). E11: only a target on the site's own domain is read, rebuilt
// from its strict parse, and that read does not follow redirects either (every hop is checked by us, never by the HTTP client).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const reqs = (() => { try { return $('Page Fetch Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { return []; } })();
const res = (() => { try { return $('Fetch Page (Index)').all().map(i => i.json); } catch (e) { return []; } })();
const sites = (() => { try { return $('Index Sites').all().map(i => i.json); } catch (e) { return []; } })();
const out = [];
reqs.forEach((q, i) => { const site = sites.find(s => s.site_id === q.site_id) || {}; const hop = IX.hopOf(q.url, res[i] || {}, site); if (hop) out.push({ json: { site_id: q.site_id, url: hop, first_index: i } }); });
return out.length ? out : [{ json: { skip: true, reason: 'no redirect to follow' } }];
