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
const title = ((raw.match(/^Title:\s*(.+)$/m) || [])[1] || S(g.title)).trim().slice(0, 300);
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
const okRead = !err && status === 200 && target < 400 && words >= 80;
const reason = err ? 'the page reader failed (' + err + ')' : status !== 200 ? 'the page reader answered ' + (status || 'nothing') : target >= 400 ? 'the live page answered ' + target : words < 80 ? 'the page reader returned only ' + words + ' words' : '';
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
