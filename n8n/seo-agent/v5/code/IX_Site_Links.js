// Index coverage wave 2 (2026-10-30, docs/indexing-2026-10-29/DESIGN_WAVE2.md §2.1): which pages the website itself links to, read once a
// run per website, free. Sources: the home page (read by the first sitemap round) and the parent pages read just before (Fetch Link Pages,
// files read here at most 3 MB each, IX.answerText; a 3xx, a 4xx / 5xx, a bot wall or a file above the limit is "not read", never "no links").
// Out, per website: `home_read` (false = the home page could not be read: nothing is concluded, every page's linked_by is 'unread'), the
// link index { key -> [source urls] } (IX.linkIndex: a link with a query also counts for the page without it), the pages linked that the
// run may add to the inventory (source `home`: never a file, a listing / account page or a utility page), and the titles of the parents read
// (the canonical check compares a page's title with the title of the page it names as canonical). No page body travels past this node.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return null; } };
const sites = (grab('Index Sites') || []).filter(s => s && s.site_id && s.gsc_connected);
let smState = []; for (let r = IX.CFG.sitemap_rounds; r >= 1 && !smState.length; r--) { try { smState = $('Sitemap Read ' + r).all().map(i => i.json).filter(x => x && x.site_id); } catch (e) { smState = []; } }
const reqs = (grab('Link Read Requests') || []).filter(q => q && !q.skip);
const res = grab('Fetch Link Pages');
const ins = (() => { try { return res ? $input.all() : []; } catch (e) { return []; } })();
const helpers = (typeof this !== 'undefined' && this && this.helpers) ? this.helpers : null;
const out = [];
for (const s of sites) {
  const st = smState.find(x => x.site_id === s.site_id) || {};
  const site = { ...s, home_host: S(st.home_host) || S(s.home_host_prev) };
  const sources = []; const titles = {}; const parents = [];
  if (st.home_read && S(st.home_url)) { sources.push({ url: IX.norm(st.home_url, site) || S(st.home_url), links: st.home_link_urls || [] }); if (S(st.home_title)) titles[IX.key(st.home_url)] = S(st.home_title); }
  for (let i = 0; i < reqs.length; i++) {
    const q = reqs[i]; if (q.site_id !== s.site_id) continue;
    const r = (res || [])[i] || {}; const status = n0(r.statusCode ?? r.status);
    let read = false, why = '';
    try {
      if (status >= 200 && status < 300) {
        const a = await IX.answerText(r, res && ins.length === res.length ? ins[i] : null, i, helpers, IX.CFG.page_read_bytes);
        if (a.too_large) why = 'larger than we read';
        else {
          const rf = IX.readFetch(q.url, { statusCode: status, headers: r.headers || {}, data: a.text }, null);
          if (rf.ok && !rf.blocked) { const url = IX.norm(q.url, site) || q.url; sources.push({ url, links: IX.pageLinks(a.text, q.url, site) }); read = true;
            const t = IX.titleOf(a.text); if (t) titles[IX.key(url)] = t; }
          else why = rf.block_reason || 'not read';
        }
      } else why = status ? 'answered ' + status : 'no answer';
    } catch (e) { why = 'not read'; }
    parents.push({ url: q.url, read, status, why });
  }
  const index = IX.linkIndex(sources);
  // the pages the website links to that the run may add (DESIGN_WAVE2 §2.1, source `home`); the 6,000 cap of the merge still holds
  const seen = new Set(); const linked = [];
  for (const src of sources) for (const u of (src.links || [])) { const k = IX.key(u); if (!k || seen.has(k)) continue; seen.add(k);
    if (IX.isLowValue(u) || IX.isUtility(u) || IX.depth(u) === 0) continue; linked.push(u); }
  out.push({ json: { site_id: s.site_id, home_read: !!st.home_read, home_url: S(st.home_url), sources: sources.map(x => ({ url: x.url, links: (x.links || []).length })),
    parents, index, linked: linked.slice(0, IX.CFG.pages_max), titles } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
