// Index coverage: a page that answered a redirect is read again with the redirects followed, so its status is the status of the page the
// redirect ends on (a redirect to a 404 is gone, not "redirects elsewhere"). The first answer keeps where the redirect pointed.
const reqs = (() => { try { return $('Page Fetch Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { return []; } })();
const res = (() => { try { return $('Fetch Page (Index)').all().map(i => i.json); } catch (e) { return []; } })();
const out = [];
reqs.forEach((q, i) => { const st = Number((res[i] || {}).statusCode) || 0; if (st >= 300 && st < 400) out.push({ json: { site_id: q.site_id, url: q.url, first_index: i } }); });
return out.length ? out : [{ json: { skip: true, reason: 'no redirect to follow' } }];
