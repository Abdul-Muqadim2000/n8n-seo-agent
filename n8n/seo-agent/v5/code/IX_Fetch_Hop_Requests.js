// Index coverage: a page that answered a redirect is read once more at the redirect's target, so its status is the status of the page the
// redirect ends on (a redirect to a 404 is gone, not "redirects elsewhere"). E11: only a target on the site's own domain is read, rebuilt
// from its strict parse, and that read does not follow redirects either (every hop is checked by us, never by the HTTP client).
// Fix wave 2 (X2): the first answers come from Page First Reads (headers only; no page body is carried).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return null; } };
const reqs = (grab('Page Fetch Requests') || []).filter(q => q && !q.skip);
const firsts = (grab('Page First Reads') || []).filter(x => x && !x.skip);
const res = firsts.length ? null : (grab('Fetch Page (Index)') || []);   // a run without Page First Reads (an older harness path) reads the fetch itself
const sites = grab('Index Sites') || [];
const out = [];
reqs.forEach((q, i) => {
  const first = res ? (res[i] || {}) : ((firsts.find(x => x.i === i) || {}).first || {});
  const site = sites.find(s => s.site_id === q.site_id) || {}; const hop = IX.hopOf(q.url, first, site);
  if (hop) out.push({ json: { site_id: q.site_id, url: hop, first_index: i } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no redirect to follow' } }];
