/*__SITE_MODEL__*/
// D7 (paid run 2026-10-21, exec 15): at onboarding the app starts Track my site and the ladder together, so the ladder read seo_pages
// BEFORE the Site Tracker stored any title ("19 of the 19 pages have no title on file yet ... judged by their address only") and a live
// page that already answers the plan's searches could be missed. The ladder does not rely on that order: when pages of the site have no
// title on file, it reads the <title> / <h1> of the few that could overlap the plan's keywords itself (free GETs of the client's own
// pages, at most CAP), and Ladder Plan judges the overlap with what was read and says so.
//   Which pages: those whose ADDRESS shares a word with the main keyword (slug first), then those sharing a word with the pool's
// keywords, then the pages in a services-type section ("what we do", "services", "solutions" ...). The homepage is not read here: the
// site model already reads it. One item per page; none when every page has a title (then the GET is skipped and nothing is spent).
const CAP = 8;
const base = $('Parse Verdict').first().json;
const pool = (() => { try { return $('Ladder Pool').first().json || {}; } catch (e) { return {}; } })();
const head = String(base.keyword || '').toLowerCase().trim();
const domain = String(base.domain || '').toLowerCase();
let model = null; try { const m = $('Site Model').first().json.site_model; if (m && typeof m === 'object') model = m; } catch (e) { model = null; }
const inv = [...(base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })),
  ...((base.internal_link_candidates || []).filter(c => c && c.url && c.title).map(c => ({ url: c.url, title: c.title, source: 'sitemap' })))];
const pm = SM.withPages(model || SM.from({ domain }, {}), inv);
const own = SM.helpers.bare(domain);
const untitled = SM.pages(pm).filter(p => p && p.url && !String(p.title || '').trim() && !String(p.h1 || '').trim()
  && !!SM.helpers.hostOf(p.url) && SM.helpers.bare(SM.helpers.hostOf(p.url)) === own   // the site's own pages only, www or bare host alike
  && SM.helpers.pathOf(p.url).replace(/[?#].*$/, '').replace(/\/+$/, '') !== '');
const skip = (why) => [{ json: { title_check: false, skip_reason: why, untitled: untitled.length, asked: 0, cap: CAP } }];
if (!head || !untitled.length) return skip(untitled.length ? 'no main keyword' : 'every page of the site already has a title on file');
const T = (s) => SM.helpers.matchTerms(s);
const headT = new Set(T(head));
const poolT = new Set(((pool.research || {}).candidates || []).slice(0, 60).flatMap(k => T(k && k.keyword)));
const SECTION = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:what-?we-?do|services?|solutions?|capabilit(?:y|ies)|offerings?|expertise|consulting|practices?|industries)(?:\/|$)/i;
const scored = untitled.map(p => {
  const path = SM.helpers.pathOf(p.url).replace(/[?#].*$/, '');
  const slugT = T(path.replace(/\.[a-z]{2,5}$/i, ''));
  const h = slugT.filter(t => headT.has(t)).length, k = slugT.filter(t => poolT.has(t)).length;
  const sec = SECTION.test(path) ? 1 : 0;
  return { url: p.url, path, score: h * 10 + k * 2 + sec, why: h ? 'its address shares a word with "' + head + '"' : k ? 'its address shares a word with a keyword of this plan' : sec ? 'it is in a services section of the site' : '' };
}).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.path.length - b.path.length);
if (!scored.length) return skip('none of the ' + untitled.length + ' untitled page(s) could overlap this plan by its address or section');
const pick = scored.slice(0, CAP);
// KW-LADDER (review item 9): a client-rendered site answers every address with the same app-shell title ("Tech& | Enterprise Automation &
// Digital Transformation Solutions", no H1), which is the homepage's title and not the page's. Ladder Titles discards a title equal to the
// homepage's, so the homepage title is needed: the one on file, else the homepage is read once more as a reference (free, not in the cap,
// never a page of the plan).
const homeOnFile = SM.pages(pm).find(p => p && p.url && SM.helpers.bare(SM.helpers.hostOf(p.url) || '') === own && SM.helpers.pathOf(p.url).replace(/[?#].*$/, '').replace(/\/+$/, '') === '' && String(p.title || '').trim());
const home_title = homeOnFile ? String(homeOnFile.title).trim() : '';
const items = pick.map((x, i) => ({ json: { title_check: true, url: x.url, why: x.why, n: i + 1, of: pick.length, untitled: untitled.length, candidates: scored.length, cap: CAP, home_title } }));
if (!home_title) items.push({ json: { title_check: true, home_ref: true, url: SM.siteUrl(model || SM.from({ domain }, {}), '/'), why: 'the homepage, to recognise a site-wide title', n: pick.length + 1, of: pick.length, untitled: untitled.length, candidates: scored.length, cap: CAP, home_title: '' } });
return items;
