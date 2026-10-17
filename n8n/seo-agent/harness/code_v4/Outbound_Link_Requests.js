// ---- outbound link kit (A-14, 2026-10-17; inlined through the OUTBOUND marker) ----
// Live (exec 771) the delivered page linked https://u.ae/en/information-and-services/business/business-licensing and
// https://www.adgm.com/office-of-data-protection — both 404 — while the quality check only said "u.ae, difc.com, adgm.com — verify each
// one": it never fetched a link. Every outbound link of every draft is now fetched (GET, redirects followed, three tries on a network
// error) between *Content QA* and *Originality Check*, and read by one rule:
//   * dead     — 404 / 410, a domain that does not resolve, or a 200 page that says it is not found (title or H1 "page not found" / 404);
//   * unknown  — a bot challenge or a block (401 / 403 / 429 / 999, Cloudflare / Vercel / captcha pages), a server error, a timeout,
//                anything else we could not read: "could not be checked", never "dead";
//   * ok       — anything else that answered 2xx.
// A dead link is a refusal reason, named by URL, with a replacement when the run holds one (a source of the evidence plan or the facts
// whose words carry the link's anchor), else "remove the link".
// Regex only (the n8n Code sandbox has no URL constructor).
const OB = (() => {
  const S = (v) => String(v == null ? '' : v);
  const MAX = 25;
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const keyOf = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/#.*$/, '').replace(/\/+$/, '');
  // the links to fetch: every distinct external URL of the draft, in page order, at most MAX
  const requests = (links, round) => {
    const seen = new Set(); const out = [];
    for (const l of (Array.isArray(links) ? links : [])) {
      const url = S(l && l.url).trim(); if (!/^https?:\/\//i.test(url)) continue;
      const k = keyOf(url); if (seen.has(k)) continue; seen.add(k);
      out.push({ url, anchor: S(l.anchor), host: hostOf(url), round: Number(round) || 1 });
      if (out.length >= MAX) break;
    }
    return out;
  };
  const CHALLENGE = /just a moment\.\.\.|attention required!? \| cloudflare|cf-chl-|challenge-platform|vercel security checkpoint|_vercel\/security|captcha|are you a robot|access denied|request unsuccessful\. incapsula|ddos-guard|perimeterx|px-captcha/i;
  const NOT_FOUND = /\b(?:404|page not found|not found|page (?:does not|doesn['’]t|cannot be found|could not be found)|no longer (?:exists|available)|page you (?:are|were) looking for)\b/i;
  const titleOf = (html) => { const m = S(html).match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const h1Of = (html) => { const m = S(html).match(/<h1[^>]*>([\s\S]{0,400}?)<\/h1>/i); return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''; };
  // one fetched answer (an HTTP Request item: fullResponse, neverError, text; or an error item) -> { state, status, reason }
  const classify = (r) => {
    const x = r || {};
    const err = x.error ? S(typeof x.error === 'object' ? (x.error.message || x.error.code || JSON.stringify(x.error)) : x.error) : '';
    const status = Number(x.statusCode || x.status || (x.error && x.error.httpCode)) || 0;
    const body = S(x.body ?? x.data ?? '');
    if (!status) {
      if (/ENOTFOUND|getaddrinfo ENOTFOUND|NXDOMAIN/i.test(err)) return { state: 'dead', status: 0, reason: 'the domain does not resolve' };
      return { state: 'unknown', status: 0, reason: err ? 'could not be fetched (' + err.slice(0, 80) + ')' : 'no answer' };
    }
    if (status === 404 || status === 410) return { state: 'dead', status, reason: 'answers ' + status };
    if (status === 401 || status === 403 || status === 429 || status === 999 || CHALLENGE.test(body.slice(0, 20000)))
      return { state: 'unknown', status, reason: 'blocked or behind a bot check (' + status + '), so it could not be checked' };
    if (status >= 500) return { state: 'unknown', status, reason: 'server error ' + status + ', which may be temporary' };
    if (status >= 300) return { state: 'unknown', status, reason: 'redirects could not be followed (' + status + ')' };
    if (status >= 200) {
      const t = titleOf(body), h = h1Of(body);
      if ((NOT_FOUND.test(t) || NOT_FOUND.test(h)) && body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length < 6000)
        return { state: 'dead', status, reason: 'answers ' + status + ' with a "not found" page ("' + (h || t).slice(0, 60) + '")' };
      return { state: 'ok', status, reason: 'answers ' + status };
    }
    return { state: 'unknown', status, reason: 'unexpected answer ' + status };
  };
  const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who uae dubai'.split(' '));
  const toks = (t) => S(t).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  // a replacement for a dead link: a source this run holds (evidence plan, facts) that is not dead itself and whose text carries at
  // least half of the dead link's anchor words — on the same site first
  const suggest = (dead, candidates, deadKeys) => {
    const A = toks(dead.anchor); if (!A.length) return null;
    const pool = (Array.isArray(candidates) ? candidates : []).filter(c => c && /^https?:\/\//i.test(S(c.url)) && !(deadKeys || new Set()).has(keyOf(c.url)) && keyOf(c.url) !== keyOf(dead.url));
    const score = (c) => { const T = new Set(toks(S(c.text) + ' ' + S(c.title) + ' ' + S(c.url).replace(/[\/_.-]+/g, ' '))); return A.filter(w => T.has(w)).length / A.length; };
    const ranked = pool.map(c => ({ c, s: score(c), same: hostOf(c.url) === hostOf(dead.url) })).filter(x => x.s >= 0.5)
      .sort((a, b) => (b.same - a.same) || (b.s - a.s));
    return ranked.length ? S(ranked[0].c.url) : null;
  };
  return { MAX, requests, classify, suggest, hostOf, keyOf };
})();
// A-14 (2026-10-17): one item per distinct outbound link of THIS round's draft (Content QA lists them all as `outbound_links`), for
// *Fetch Outbound Links*. With no outbound link the single item says so and *Any Outbound Links?* goes straight to the check, which
// then reports "no outbound link". Every item carries the QA round, so the check never reads an earlier round's fetch.
const d = $input.first().json || {};
const qa = d.content_qa || {};
const round = Number(d.qa_round || qa.round) || 1;
const reqs = OB.requests(qa.outbound_links || [], round);
if (!reqs.length) return [{ json: { skip: true, round } }];
return reqs.map(r => ({ json: r }));
