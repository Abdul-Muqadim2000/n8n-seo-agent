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
// A-14 (2026-10-17, re-rating 2026-10-17): every outbound link of the draft, as it answers today. Runs between *Content QA* and
// *Originality Check* on every QA round. Live (exec 771) two of the page's seven external links answered 404 and the quality check only
// asked the owner to "verify" three hosts it had never fetched. Now each link is fetched (*Fetch Outbound Links*) and read by one rule
// (OB.classify): a dead link (404 / 410, a domain that does not resolve, a "not found" page) FAILS the quality check — named by URL,
// with a replacement source from this run when one carries the anchor's words, else "remove it"; a link behind a bot check, a block or
// a server error is "could not be checked" and listed as such, never called dead. Like Originality Check, a failure here refuses: it
// changes `passed`, `publishable`, `not_ready`, the label and the reasons together (B3-3: a gate that only labels is no gate).
const d = { ...($('Content QA').first().json || {}) };
const qa = { ...(d.content_qa || {}) };
const warnings = Array.isArray(qa.warnings) ? [...qa.warnings] : [];
const round = Number(d.qa_round || qa.round) || 1;
let reqs = []; try { reqs = $('Outbound Link Requests').all().map(i => i.json || {}); } catch (e) { reqs = []; }
const live = reqs.filter(r => r && !r.skip && r.url && (Number(r.round) || 1) === round);
let resps = [];
if (live.length) { try { resps = $('Fetch Outbound Links').all().map(i => i.json || {}); } catch (e) { resps = []; } }
const results = live.map((r, i) => ({ url: r.url, anchor: r.anchor || '', host: r.host || OB.hostOf(r.url), ...(resps[i] ? OB.classify(resps[i]) : { state: 'unknown', status: 0, reason: 'not fetched' }) }));
const deadKeys = new Set(results.filter(x => x.state === 'dead').map(x => OB.keyOf(x.url)));
const brief = d.content_brief || {};
const candidates = [
  ...(brief.evidence_plan || []).map(e => ({ url: e && e.source_url, text: e && e.fact })),
  ...(d.facts || []).map(f => ({ url: f && f.url, text: [f && f.text, f && f.claim].filter(Boolean).join(' '), title: f && f.title })),
  ...results.filter(x => x.state === 'ok').map(x => ({ url: x.url, text: x.anchor }))
];
const dead = results.filter(x => x.state === 'dead').map(x => ({ ...x, suggestion: OB.suggest(x, candidates, deadKeys) }));
const unknown = results.filter(x => x.state === 'unknown');
const link_check = {
  round, checked: results.length, ok: results.filter(x => x.state === 'ok').length, dead, unknown: unknown.map(x => ({ url: x.url, status: x.status, reason: x.reason })),
  basis: !results.length ? 'the draft has no outbound link' : 'each of the draft\'s ' + results.length + ' outbound link(s) was fetched in this run (GET, redirects followed, three tries on a network error): a 404 / 410, a domain that does not resolve or a "not found" page is dead; a bot check, a block or a server error is "could not be checked", never dead'
};
qa.link_check = link_check;
if (dead.length) warnings.push('Dead links (fetched in this run): ' + dead.slice(0, 5).map(x => x.url + ' (' + x.reason + (x.suggestion ? '; use ' + x.suggestion + ' instead' : '; no live page in this run states it, so remove the link') + ')').join('; ')
  + ' — replace or remove each one; a page that links to a missing page is not ready to publish');
if (unknown.length) qa.link_check_note = unknown.length + ' outbound link(s) could not be checked: ' + unknown.slice(0, 4).map(x => x.url + ' (' + x.reason + ')').join('; ') + ' — open them once before publishing.';
qa.warnings = warnings;
if (dead.length) {
  qa.passed = false; qa.passed_copy = false; qa.editor_needed = true;
  const roundsLeft = Math.max(0, Number(qa.rounds_left) || 0);
  const reason = dead.length + ' outbound link(s) lead to a missing page: ' + dead.slice(0, 4).map(x => x.url + ' (' + x.reason + (x.suggestion ? '; replace with ' + x.suggestion : '; remove it') + ')').join('; ');
  qa.publishable = false;
  qa.not_ready = !roundsLeft;
  qa.quality_label = roundsLeft ? 'needs another editing round before it can be published' : 'did not pass the quality check — not ready to publish';
  qa.not_ready_reasons = !roundsLeft
    ? [reason, ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 7)
    : (Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : []);
  const er = Number(qa.editor_rounds) || 0;
  qa.quality = { ...(qa.quality && typeof qa.quality === 'object' ? qa.quality : {}),
    passed: false, publishable: false, not_ready: qa.not_ready, label: qa.quality_label, reasons: qa.not_ready_reasons,
    note: roundsLeft ? '' : (er ? 'The editor had ' + er + ' round' + (er === 1 ? '' : 's') : 'No editing round was left') + ' and the page still links to a missing page: it is delivered as a draft to finish by hand, not as a page to publish as it is.' };
}
return [{ json: { ...d, content_qa: qa } }];
