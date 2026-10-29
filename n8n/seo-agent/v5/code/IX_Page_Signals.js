// Index coverage (fix wave 1, E10 / X2): what our reads found, per page, WITHOUT the page bodies: status, where a redirect points, noindex,
// the canonical, the words and the title (IX.readFetch). Every later step reads this node, never the raw answers, so no page body travels
// past the node that parses it. A bot wall, a challenge page, a 401 / 403 / 429 / 503 or a language redirect from our side is `blocked`
// (E2): we could not read the page, which is neither a cause nor a fix.
// Fix wave 2 (X2): pages that answered are already read by Page First Reads; the redirect hops are read here from the files the second
// fetch wrote (this node's own input), at most 3 MB each, so no page body is kept in the run's saved data.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return null; } };
const fq = (grab('Page Fetch Requests') || []).filter(q => q && !q.skip);
const firsts = (grab('Page First Reads') || []).filter(x => x && !x.skip);
const hq = (grab('Fetch Hop Requests') || []).filter(q => q && !q.skip);
const f2 = grab('Fetch Page (Final)');
const ins = (() => { try { return f2 ? $input.all() : []; } catch (e) { return []; } })();
const helpers = (typeof this !== 'undefined' && this && this.helpers) ? this.helpers : null;
const finals = new Map();
for (let j = 0; j < hq.length; j++) {
  const r = (f2 || [])[j] || {};
  const a = await IX.answerText(r, f2 && ins.length === f2.length ? ins[j] : null, j, helpers, IX.CFG.page_read_bytes);
  finals.set(hq[j].first_index, { ...r, data: a.text, body: undefined });
}
let out;
if (firsts.length) {
  out = firsts.map(x => ({ json: { site_id: x.site_id, url: x.page_url || x.url, f: x.f || IX.readFetch(x.url, x.first || {}, finals.get(x.i) || null) } }));
} else {
  // a run without Page First Reads (an older harness path): the first answers are read from the fetch node's JSON
  const f1 = grab('Fetch Page (Index)') || [];
  out = fq.map((q, i) => ({ json: { site_id: q.site_id, url: q.page_url || q.url, f: IX.readFetch(q.url, f1[i] || {}, finals.get(i) || null) } }));
}
return out.length ? out : [{ json: { skip: true, reason: 'no page read' } }];
