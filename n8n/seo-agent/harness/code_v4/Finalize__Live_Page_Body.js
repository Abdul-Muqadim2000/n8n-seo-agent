// Client reports 2026-11-11 (build section 185): the live page as the version to grade. *Read Live Page* (the page reader, Markdown) read
// the address; this node puts that text in place of the request's markdown, so *Parse Brief* and everything after it grade the LIVE page
// with the rules a final version is graded by. The reader drops some heroes, so the page's own main heading (from the publish check, sent as
// grade_live.h1) is put back when the text has none. A read that failed or returned too little is never graded: the request then carries
// `live_read.ok: false` and Parse Brief answers 400 with the reason (grading our own text as if it were live would be the old defect again).
const plan = $('Live Read Plan').first().json || {};
const r = $input.first().json || {};
const S = (v) => String(v == null ? '' : v);
const b = { ...((plan.body && typeof plan.body === 'object') ? plan.body : {}) };
const g = (b.grade_live && typeof b.grade_live === 'object') ? b.grade_live : {};
// review D1: a page the reader refused but its fallback read (W07-A) carries no status code: it was read
const recovered = !!(r.reader_fallback && r.reader_fallback.via && r.reader_fallback.via !== 'none' && !r.error);
const status = Number(r.statusCode != null ? r.statusCode : r.status) || (recovered ? 200 : 0);
const raw = S(r.data != null ? r.data : r.body != null ? r.body : '');
const err = r.error ? S(r.error.message || r.error.description || r.error).slice(0, 160) : '';
// production review 2026-11-12 (S3-05, section 189): the page's own title is the one the publish check read from the live HTML (grade_live.title);
// the reader's "Title:" can be the site's generic title (it read a script-rendered head before the page set its own: a client's
// MS 365 ERP page was recorded under the site's home-page title). The reader's title is used only when none was sent.
const readerTitle = ((raw.match(/^Title:\s*(.+)$/m) || [])[1] || '').trim();
const title = (S(g.title).trim() || readerTitle).slice(0, 300);
let md = raw.includes('Markdown Content:') ? raw.split('Markdown Content:').slice(1).join('Markdown Content:') : raw;
md = md.replace(/\r\n?/g, '\n')
  .replace(/^\s*(?:On this page|Table of contents|Skip to (?:main )?content)\s*$/gim, '')   // page chrome the reader keeps
  .replace(/!\[([^\]]*)\]\(data:[^)]*\)/g, '')   // inline data images are not page images
  .replace(/\n{3,}/g, '\n\n').trim();
const words = md.split(/\s+/).filter(Boolean).length;
const h1 = S(g.h1).replace(/\s+/g, ' ').trim().slice(0, 300);
if (!/^#\s+\S/m.test(md) && h1) md = '# ' + h1 + '\n\n' + md;
// review D2: the reader answers 200 with "Warning: Target URL returned error 404" and the error page's own text: a removed page is never graded
const target = Number((raw.match(/^Warning:\s*Target URL returned error (\d{3})/m) || [])[1]) || 0;
// section 189: a read of ANOTHER page (the home page, a generic shell) is never graded as this one. It is another page when the reader's title
// differs from the page's own title AND the text has main headings of its own, none of them the page's own H1 (a reader that dropped the
// hero has no heading to compare, and is read as before)
const wordsOf = (t) => [...new Set(S(t).toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').split(/\s[|\u2013\u2014]\s|\s-\s/)[0].replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2))];
const near = (a, b2) => { const A = wordsOf(a), B = new Set(wordsOf(b2)); if (!A.length || !B.size) return true; const sh = A.length <= B.size ? A : [...B]; const lg = A.length <= B.size ? B : new Set(A); return sh.filter(w => lg.has(w)).length >= Math.ceil(0.6 * sh.length); };
const h1sRead = (md.match(/^#[ \t]+.+$/gm) || []).map(h => h.replace(/^#+\s*/, ''));
const otherPage = !!(S(g.title).trim() && readerTitle && !near(readerTitle, g.title) && h1 && h1sRead.length && !h1sRead.some(h => near(h, h1)));
const okRead = !err && status === 200 && target < 400 && words >= 80 && !otherPage;
const reason = err ? 'the page reader failed (' + err + ')' : status !== 200 ? 'the page reader answered ' + (status || 'nothing') : target >= 400 ? 'the live page answered ' + target : words < 80 ? 'the page reader returned only ' + words + ' words' : otherPage ? 'the page reader returned another page ("' + readerTitle.slice(0, 80) + '", not "' + S(g.title).trim().slice(0, 80) + '")' : '';
const live_read = { ok: okRead, url: S((plan.live_plan || {}).url), title, words, reason };
if (okRead) {
  b.markdown = md;
  b.client_edited = true;   // the live text is the client's own version: every sentence they wrote counts as theirs (Parse Brief)
  b.answers = [];
  b.grade_only = true;
  b.meta = { ...((b.meta && typeof b.meta === 'object') ? b.meta : {}), ...(title ? { title } : {}), ...(h1 ? { h1 } : {}) };
}
b.live_read = live_read;
return [{ json: { ...plan, body: b } }];
