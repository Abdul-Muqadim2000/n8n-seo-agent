// FU-R1 (page-quality programme 2026-10-29, BEFORE run K7 / K8): which of the run's own pages need the renderer. Input: Read Client Page HTML
// (one item per page of Client Page Requests, in order). A page the text reader read (200 characters or more) is never rendered, so a
// server-rendered site goes on to Collect Client Pages exactly as before (one skip item down the "nothing to render" branch). A page whose
// reader text was empty AND whose HTML is a script shell is rendered (CRK.need), at most CRK.CONFIG.max_pages a run.
const reqs = $('Client Page Requests').all().map(i => i.json || {});
let reader = []; try { reader = $('Read Client Pages').all().map(i => i.json || {}); } catch (e) { reader = []; }
const html = $input.all().map(i => i.json || {});
let domain = ''; try { domain = String($('Collect Site URLs').first().json.domain || ''); } catch (e) { domain = ''; }
const checked = reqs.map((r, i) => ({ index: i, url: String(r.url || ''), kind: r.kind || '', ...CRK.need(reader[i], html[i], r.url, domain) }));
const todo = checked.filter(c => c.render);
if (!todo.length) return [{ json: { skip: true, render_plan: { needed: 0, pages: checked.map(c => ({ url: c.url, kind: c.kind, why: c.why })) } } }];
return todo.slice(0, CRK.CONFIG.max_pages).map(c => ({ json: { index: c.index, url: c.url, kind: c.kind, why: c.why, stage: 1 } }));
