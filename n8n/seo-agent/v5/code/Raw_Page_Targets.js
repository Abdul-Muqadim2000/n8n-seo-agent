// G14 (2026-10-13): the second of the two readings. *Render Key Pages* has just rendered each key page; this node re-emits the same pages
// as plain requests so *Fetch Raw Pages* can ask the site itself for the **first response**, with no JavaScript run at all — what an AI
// crawler receives. The targets keep their order and index so *Render Diff* can line the two readings up without pairing expressions.
let reqs = [];
try { reqs = $('Render Diff Targets').all().map(i => i.json || {}); } catch (e) {}
const targets = reqs.filter(r => r && r.url && !r.skip);
if (!targets.length) return [{ json: { skip: true } }];
const out = targets.map((r, i) => ({ json: { url: r.url, kind: r.kind || 'page', title: r.title || '', index: Number(r.index) >= 0 ? Number(r.index) : i } }));
// B5-6 (2026-10-16): with a JavaScript crawl, more pages are only read raw (their rendered reading is the crawl itself); they follow the rendered ones, in order
const more = ((targets[0].render_plan || {}).raw_extra || []).filter(x => x && x.url);
more.forEach((x, j) => out.push({ json: { url: x.url, kind: x.kind || 'page', title: x.title || '', index: targets.length + j, raw_only: true } }));
return out;
