// FU-R1 (page-quality programme 2026-10-29): after the rendered homepage, the next pages to read. A client-rendered site has no sitemap the
// run can read (the app answers every address with the same script shell), so the page run knew none of its pages: the rendered homepage's
// own links are that list. Read next, rendered too: the page that lists what the business does (services / platform / solutions ...) and the
// page closest to the search (half its words or more), never more than CRK.CONFIG.max_pages renders in the whole run. Input: Render Client
// Pages (one answer per item of Client Render Plan, in order).
const plan = $('Client Render Plan').all().map(i => i.json || {});
const res = $input.all().map(i => i.json || {});
let ctx = {}; try { ctx = $('Collect Site URLs').first().json || {}; } catch (e) { ctx = {}; }
const reqs = $('Client Page Requests').all().map(i => i.json || {});
const homeAt = plan.findIndex(p => p && p.kind === 'home');
const home = homeAt >= 0 ? CRK.rendered(res[homeAt]) : { ok: false };
const room = Math.min(CRK.CONFIG.more_pages, CRK.CONFIG.max_pages - plan.filter(p => p && !p.skip).length);
if (!home.ok || room <= 0) return [{ json: { skip: true, more_plan: { why: !home.ok ? 'the homepage was not rendered' : 'no renders left in this run' } } }];
const links = CRK.links(home.html, plan[homeAt].url, ctx.domain);
const more = CRK.pickMore(links, ctx.keyword || '', reqs.map(r => r.url), room);
if (!more.length) return [{ json: { skip: true, more_plan: { why: 'no services page and no page close to the search among the homepage\'s ' + links.length + ' link(s)', links_found: links.length } } }];
return more.map(m => ({ json: { ...m, stage: 2 } }));
