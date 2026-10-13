// G14 (2026-10-13): the second of the two readings. *Render Key Pages* has just rendered each key page; this node re-emits the same pages
// as plain requests so *Fetch Raw Pages* can ask the site itself for the **first response**, with no JavaScript run at all — what an AI
// crawler receives. The targets keep their order and index so *Render Diff* can line the two readings up without pairing expressions.
let reqs = [];
try { reqs = $('Render Diff Targets').all().map(i => i.json || {}); } catch (e) {}
const targets = reqs.filter(r => r && r.url && !r.skip);
if (!targets.length) return [{ json: { skip: true } }];
return targets.map((r, i) => ({ json: { url: r.url, kind: r.kind || 'page', title: r.title || '', index: Number(r.index) >= 0 ? Number(r.index) : i } }));
