// __WHAT__ (FX-L 2026-11-08, REVIEW_PERF_SAFETY H2): the plain GETs follow NO redirect themselves. A first answer that is a redirect is read
// once more at its target only when we checked that target (KIW.hopOf): https, a public host (no IP literal, no internal or wildcard-DNS
// name, no credentials) and the SAME registrable domain as the address asked (apex <-> www, http -> https). Every other redirect is an
// answer, not a page. One hop at most.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const REQS = '__REQS__', ANS = '__ANS__';
const reqs = all(REQS).filter(r => r && !r.skip && r.url);
const ans = all(ANS);
const out = [];
reqs.forEach((q, i) => { const hop = KIW.hopOf(q.url, ans[i] || {}); if (hop) out.push({ json: { domain: q.domain, url: hop, first_index: i } }); });
return out.length ? out : [{ json: { skip: true, reason: 'no redirect to follow' } }];
