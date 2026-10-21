// KWL-RES follow-up: what the pages Research Status Requests opened answered, handed to Rank Keywords. The relevance screen's items pass
// through unchanged (Rank Keywords reads them as its input); the first carries
//   page_status: { ran: true, asked, not_asked, cap, read_at, skip_reason, pages: [{ url, key, state, http_status, reason, to }] }
// state: 'live' (200 with a page of its own), 'gone' (404 / 410, or a 200 whose title or H1 says it was not found: a soft 404),
// 'redirected' (to another page or website: the address no longer answers itself), 'unknown' (no answer, a timeout, a bot wall, a 5xx:
// the research could not check it, and never calls it live or gone).
const reqs = (() => { try { return $('Research Status Requests').all().map(i => i.json).filter(r => r && r.status_check); } catch (e) { return []; } })();
const first = (() => { try { return $('Research Status Requests').first().json || {}; } catch (e) { return {}; } })();
const answers = (() => { try { return $('Read Research Pages').all().map(i => i.json); } catch (e) { return []; } })();
const hops = (() => { try { return $('Research Status Hops').all().map(i => i.json).filter(h => h && h.hop); } catch (e) { return []; } })();
const hopAnswers = (() => { try { return $('Read Research Pages (Redirect)').all().map(i => i.json); } catch (e) { return []; } })();
const hostOf = (u) => String((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/:\d+$/, '');
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
const pathKey = (u) => String(u || '').replace(/^https?:\/\/[^\/?#]*/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
const abs = (loc, from) => { const l = String(loc || '').trim(); if (!l) return ''; if (/^https?:\/\//i.test(l)) return l; if (/^\/\//.test(l)) return 'https:' + l;
  const o = (String(from || '').match(/^https?:\/\/[^\/?#]+/i) || [''])[0]; return l.startsWith('/') ? o + l : o + '/' + l; };
const dec = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const SOFT404 = /^\W*(error\s*)?(404\b|page not found|not found\b|page (does not|doesn't) exist|this page (does not|doesn't) exist)/i;
const codeOf = (a) => Number((a || {}).statusCode || (a || {}).status || 0);
const judge = (q, a) => {
  if (!a) return { state: 'unknown', reason: 'no answer' };
  if (a.error) return { state: 'unknown', reason: String((a.error && a.error.message) || a.error).slice(0, 120) };
  const code = codeOf(a);
  if (code >= 300 && code < 400) { const h = a.headers || {}; const to = abs(h.location || h.Location || '', q.url); return to ? { redirect: to, code } : { state: 'unknown', reason: 'answered ' + code + ' with no address to go to', http_status: code }; }
  if (code === 404 || code === 410) return { state: 'gone', reason: 'answered ' + code, http_status: code };
  if (!code || code < 200 || code >= 300) return { state: 'unknown', reason: code ? 'answered ' + code : 'no status in the answer', http_status: code || 0 };
  const body = String(a.body ?? a.data ?? '').slice(0, 400000);
  const title = dec((body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]), h1 = dec((body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
  if (SOFT404.test(title) || SOFT404.test(h1)) return { state: 'gone', reason: 'answered ' + code + ' but the page says it was not found', http_status: 404, soft: true };
  return { state: 'live', reason: 'answered ' + code, http_status: code };
};
const pages = reqs.map((q, i) => {
  let j = judge(q, answers[i]);
  if (j.redirect) {
    const samePage = bare(hostOf(j.redirect)) === bare(hostOf(q.url)) && pathKey(j.redirect) === pathKey(q.url);
    if (!samePage) j = { state: 'redirected', reason: bare(hostOf(j.redirect)) === bare(hostOf(q.url)) ? 'forwards to another page of the site' : 'forwards to another website', to: j.redirect, http_status: j.code };
    else { const hi = hops.findIndex(h => h.of_url === q.url); const j2 = hi >= 0 ? judge({ url: j.redirect }, hopAnswers[hi]) : { state: 'unknown', reason: 'forwards to ' + j.redirect + ', not followed' };
      j = j2.redirect ? { state: 'redirected', reason: 'forwards more than once', to: j2.redirect, http_status: j2.code } : j2; }
  }
  return { url: q.url, key: q.key, keywords: q.keywords || [], state: j.state, http_status: Number(j.http_status) || 0, reason: j.reason || '', ...(j.to ? { to: j.to } : {}), ...(j.soft ? { soft_404: true } : {}) };
});
const page_status = { ran: true, asked: reqs.length, not_asked: Number(first.not_asked) || 0, cap: Number(first.cap) || 0, skip_reason: reqs.length ? '' : String(first.skip_reason || ''),
  read_at: new Date().toISOString(), pages };
const pass = (() => { try { return $('After Count (Keyword Relevance)').all(); } catch (e) { return []; } })();
return pass.length ? pass.map((it, i) => ({ json: i === 0 ? { ...(it.json || {}), page_status } : it.json })) : [{ json: { page_status } }];
