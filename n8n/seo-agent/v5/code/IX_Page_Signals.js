// Index coverage (fix wave 1, E10 / X2): what our reads found, per page, WITHOUT the page bodies: status, where a redirect points, noindex,
// the canonical, the words and the title (IX.readFetch). Every later step reads this node, never the raw answers, so no page body travels
// past the node that parses it. A bot wall, a challenge page, a 401 / 403 / 429 / 503 or a language redirect from our side is `blocked`
// (E2): we could not read the page, which is neither a cause nor a fix.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const fq = grab('Page Fetch Requests').filter(q => q && !q.skip); const f1 = grab('Fetch Page (Index)');
const hq = grab('Fetch Hop Requests').filter(q => q && !q.skip); const f2 = grab('Fetch Page (Final)');
const finals = new Map(); hq.forEach((q, i) => finals.set(q.first_index, f2[i] || {}));
const out = fq.map((q, i) => ({ json: { site_id: q.site_id, url: q.page_url || q.url, f: IX.readFetch(q.url, f1[i] || {}, finals.get(i) || null) } }));
return out.length ? out : [{ json: { skip: true, reason: 'no page read' } }];
