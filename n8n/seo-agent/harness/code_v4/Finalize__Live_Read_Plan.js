// Client reports 2026-11-11 (devaicon.com, build section 185): "I fixed every issue the tool listed and published the page, but the card
// still shows the old score". The grade on the card was the grade of the version WE delivered; nothing ever graded the page the client put
// live. The app now asks this webhook to grade the live page: the usual finalize body of the page's newest version with `grade_only: true`
// and `grade_live: { url, h1, title }`. This node decides whether the live page is read (*Read Live Page*, the page reader) before *Parse Brief*;
// any other request passes through unchanged. The address must be on the request's own domain, over http(s).
const it = $input.first().json || {};
const b = (it.body && typeof it.body === 'object' && !Array.isArray(it.body)) ? it.body : {};
const S = (v) => String(v == null ? '' : v);
const g = (b.grade_live && typeof b.grade_live === 'object' && !Array.isArray(b.grade_live)) ? b.grade_live : null;
const host = (u) => (S(u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || '';
const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
const domain = bare(S(b.domain).trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, ''));
const url = g ? S(g.url).trim() : '';
const ok = !!g && /^https?:\/\/[^\s]+$/i.test(url) && url.length <= 600 && !!domain && bare(host(url)) === domain;
return [{ json: { ...it, live_plan: { read: ok, url: ok ? url : '', asked: !!g, refused: !!g && !ok ? 'the live address must be a page of ' + (domain || 'this website') : '' } } }];
