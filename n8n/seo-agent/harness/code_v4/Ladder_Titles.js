// D7 (paid run 2026-10-21): the titles Ladder Title Requests asked for, read from the client's own pages. One item out:
// { page_titles: { asked, read: [{ url, title, h1, why }], failed: [{ url, reason, status }], redirected: [{ url, to, reason }], home_title,
//   shell_title, skip_reason } }. A page that did not answer 200 with HTML is `failed` with its reason - never a title, never "no page" - and
// Ladder Plan says how many could not be read.
// KW-LADDER (review 2026-10-21, items 9 / 10 / 15):
//   * redirects: Read Ladder Titles follows none. A redirect to the same page on the client's own host (www or bare, http or https, a trailing
//     slash) is followed once by Read Ladder Titles (Redirect) and its title is the page's; a redirect to ANOTHER page (a retired URL sent to
//     the homepage) or to another website is `redirected`, never titled with the target's title.
//   * 404 / 410 (and a page whose title or H1 says it was not found) is `failed` with `status`, so the plan's gone rule excludes it.
//   * app-shell titles: a title equal to the homepage's, or shared by most of the pages read, is the site's, not the page's. It is dropped;
//     a page left with no title and no H1 of its own is judged by its address (failed, "shows only the site-wide title").
const reqsAll = (() => { try { return $('Ladder Title Requests').all().map(i => i.json).filter(r => r && r.title_check); } catch (e) { return []; } })();
const first = (() => { try { return $('Ladder Title Requests').first().json || {}; } catch (e) { return {}; } })();
const answers = (() => { try { return $('Read Ladder Titles').all().map(i => i.json); } catch (e) { return []; } })();
const hops = (() => { try { return $('Ladder Title Hops').all().map(i => i.json).filter(h => h && h.hop); } catch (e) { return []; } })();
const hopAnswers = (() => { try { return $('Read Ladder Titles (Redirect)').all().map(i => i.json); } catch (e) { return []; } })();
const reqs = reqsAll.filter(r => !r.home_ref);
const out = { asked: reqs.length, read: [], failed: [], redirected: [], untitled: Number(first.untitled) || 0, cap: Number(first.cap) || 0, skip_reason: reqsAll.length ? '' : String(first.skip_reason || ''),
  home_title: String(first.home_title || ''), shell_title: '', read_at: new Date().toISOString() };
// KWL-LAD D11 (live run 2026-10-21): "AI & Automation | What We Do | Tech&" was quoted as "AI Automation | What We Do | Tech". Every entity is
// decoded now: named ones, decimal and hex (&#38; &#x26;), and a title encoded twice (&amp;amp;); an entity it does not know is left as written.
const ENT_LT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', hellip: '...', copy: '(c)', reg: '(R)', trade: '(TM)', middot: '.', bull: '.', laquo: '"', raquo: '"' };
const ent1 = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] !== '#') { const v = ENT_LT[e.toLowerCase()]; return v === undefined ? m : v; }
  const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; });
const dec = (s) => { let t = String(s || '').replace(/<[^>]*>/g, ' '); for (let k = 0; k < 2 && /&(#x[0-9a-f]+|#\d+|[a-z]+);/i.test(t); k++) t = ent1(t); return t.replace(/\s+/g, ' ').trim(); };
const hostOf = (u) => String((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/:\d+$/, '');
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
const pathKey = (u) => String(u || '').replace(/^https?:\/\/[^\/?#]*/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
const abs = (loc, from) => { const l = String(loc || '').trim(); if (/^https?:\/\//i.test(l)) return l; if (/^\/\//.test(l)) return 'https:' + l;
  const o = (String(from || '').match(/^https?:\/\/[^\/?#]+/i) || [''])[0]; return l.startsWith('/') ? o + l : o + '/' + l; };
const locOf = (a) => { const h = (a && a.headers) || {}; return String(h.location || h.Location || ''); };
const codeOf = (a) => Number((a || {}).statusCode || (a || {}).status || 0);
const SOFT404 = /^\W*(error\s*)?(404\b|page not found|not found\b|page (does not|doesn't) exist|this page (does not|doesn't) exist)/i;
const titleOf = (body) => { const head = String(body || '').slice(0, 400000);
  return { title: dec((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 200), h1: dec((head.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]).slice(0, 200) }; };
// one answer -> { ok, title, h1 } | { fail, reason, status } | { redirect: to }
const judge = (q, a) => {
  if (!a) return { fail: true, reason: 'no answer' };
  if (a.error) return { fail: true, reason: String((a.error && a.error.message) || a.error).slice(0, 120) };
  const code = codeOf(a);
  if (code >= 300 && code < 400) { const to = abs(locOf(a), q.url); return to ? { redirect: to, code } : { fail: true, reason: 'answered ' + code + ' with no address to go to' }; }
  if (code && (code < 200 || code >= 300)) return { fail: true, reason: 'answered ' + code, status: code };
  const body = String(a.body ?? a.data ?? '');
  const t = titleOf(body);
  if (!t.title && !t.h1) return { fail: true, reason: body ? 'no title or H1 in the page' : 'empty answer' };
  return { ok: true, title: t.title, h1: t.h1 };
};
const samePage = (a, b) => bare(hostOf(a)) === bare(hostOf(b)) && pathKey(a) === pathKey(b);
const homeReq = reqsAll.find(r => r.home_ref);
const results = [];
reqsAll.forEach((q, i) => {
  let j = judge(q, answers[i]);
  if (j.redirect) {
    const own = bare(hostOf(j.redirect)) === bare(hostOf(q.url));
    if (!own) { results.push({ q, redirected: { url: q.url, to: j.redirect, reason: 'redirects to another website' } }); return; }
    if (!samePage(j.redirect, q.url)) { results.push({ q, redirected: { url: q.url, to: j.redirect, reason: 'redirects to another page of the site' } }); return; }
    const hi = hops.findIndex(h => h.of_url === q.url);
    const j2 = hi >= 0 ? judge(q, hopAnswers[hi]) : { fail: true, reason: 'redirects to ' + j.redirect + ', not followed' };
    if (j2.redirect) j = samePage(j2.redirect, q.url) ? { fail: true, reason: 'redirects more than once' } : { redirect: j2.redirect };
    else j = j2;
    if (j.redirect) { results.push({ q, redirected: { url: q.url, to: j.redirect, reason: 'redirects to another page of the site' } }); return; }
  }
  results.push({ q, j });
});
// the homepage's title: on file, else the reference read
const homeRes = homeReq ? results.find(r => r.q === homeReq) : null;
// D11: the homepage title read just now wins over the one on file (the inventory's copy can have lost its "&"); both count as the site's title
const homeOnFile = out.home_title;
if (homeRes && homeRes.j && homeRes.j.ok && homeRes.j.title) out.home_title = homeRes.j.title;
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const pageRes = results.filter(r => r.q !== homeReq);
const okRes = pageRes.filter(r => r.j && r.j.ok);
const shared = (field) => { const c = new Map(); okRes.forEach(r => { const v = norm(r.j[field]); if (v) c.set(v, (c.get(v) || 0) + 1); });
  return new Set([...c.entries()].filter(([, n]) => n >= 2 && n * 2 > okRes.length).map(([v]) => v)); };
const shellT = shared('title'), shellH = shared('h1');
if (norm(out.home_title)) shellT.add(norm(out.home_title));
if (norm(homeOnFile)) shellT.add(norm(homeOnFile));
out.shell_title = [...shellT][0] || '';
for (const r of pageRes) {
  if (r.redirected) { out.redirected.push(r.redirected); continue; }
  const j = r.j;
  if (j.fail) { out.failed.push({ url: r.q.url, reason: j.reason, ...(j.status ? { status: j.status } : {}) }); continue; }
  // a soft 404: the page answered 200 but its title (or, under a site-wide title, its H1) begins with "404" / "page not found"
  const lead = (t) => SOFT404.test(String(t || ''));
  if (lead(j.title) || ((!j.title || shellT.has(norm(j.title))) && lead(j.h1))) { out.failed.push({ url: r.q.url, reason: 'the page says it was not found', status: 404 }); continue; }
  const title = shellT.has(norm(j.title)) ? '' : j.title, h1 = shellH.has(norm(j.h1)) ? '' : j.h1;
  if (!title && !h1) { out.failed.push({ url: r.q.url, reason: 'it shows only the site-wide title ("' + String(j.title || j.h1).slice(0, 80) + '"), not one of its own' }); continue; }
  out.read.push({ url: r.q.url, title, h1, why: r.q.why || '' });
}
return [{ json: { page_titles: out } }];
