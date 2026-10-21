// KWL-RES follow-up: Read Research Pages follows no redirect. A redirect is followed once here, and only when it stays on the same page of
// the client's own site (www or bare host, http or https, a trailing slash): techand.ai's bare host answers 308 to www, which is where the
// 404 is. One { hop: true, url, of_url } item per such follow-up; none -> one { hop: false } item and nothing more is fetched.
// Research Page Status reports every other redirect as `redirected`, with where it goes (never as the page answering).
const reqs = (() => { try { return $('Research Status Requests').all().map(i => i.json).filter(r => r && r.status_check); } catch (e) { return []; } })();
const answers = $input.all().map(i => i.json || {});
const hostOf = (u) => String((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/:\d+$/, '');
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
const pathKey = (u) => String(u || '').replace(/^https?:\/\/[^\/?#]*/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
const abs = (loc, from) => { const l = String(loc || '').trim(); if (!l) return ''; if (/^https?:\/\//i.test(l)) return l; if (/^\/\//.test(l)) return 'https:' + l;
  const o = (String(from || '').match(/^https?:\/\/[^\/?#]+/i) || [''])[0]; return l.startsWith('/') ? o + l : o + '/' + l; };
const out = [];
reqs.forEach((q, i) => {
  const a = answers[i] || {}; const code = Number(a.statusCode || a.status || 0);
  if (!(code >= 300 && code < 400)) return;
  const h = a.headers || {}; const to = abs(h.location || h.Location || '', q.url);
  if (to && bare(hostOf(to)) === bare(hostOf(q.url)) && pathKey(to) === pathKey(q.url) && to !== q.url) out.push({ json: { hop: true, url: to, of_url: q.url } });
});
return out.length ? out : [{ json: { hop: false } }];
