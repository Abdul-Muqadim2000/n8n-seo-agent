// ---- claims kit (D14, 2026-10-11; inlined by build_monitors.py): statements about the business that only the owner can vouch for. With no
// facts on file the Reply Reader's suggested answer invented "we're not directly accredited by the Ministry, but we work with accredited
// providers" (live 2026-10-11). A sentence that claims an accreditation, certification, partnership, licence, registration, approval, award,
// membership, founding year, location, age, size, client count, percentage or price is kept only when the facts on file carry the same word
// stem (or the same number); otherwise it is wrapped in [Owner: confirm — …] and the answer needs the owner. One list for every draft
// (CL.CLAIM_RE; L2 reuses it for the outreach sequences). Regex only, no model.
const CL = (() => {
  const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the piece of a claim that the facts must carry: its number, else the first word's stem (7 letters: "accredited" → "accredi", "authorised" / "authorized" → "authori")
  const keyOf = (m) => { const x = norm(m); const num = x.match(/\d[\d,.]*/); if (num) return num[0].replace(/[,.]+$/, '');
    const w = x.split(' ')[0]; const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, ''); return (st.length >= 5 ? st : w).slice(0, 7); };
  // L2 (2026-10-11): a claim is only ours when the sentence speaks about us -- "the date it was approved" on their own list says nothing
  // about our business. The outreach draft gate passes { ours: true, brand }, so a sentence about the prospect's page is left alone; the
  // Reply Reader checks every sentence (its whole answer is about us).
  const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
  // text: a draft; facts: what we know (any string); opts.skip: a string that is never a claim (the signature); opts.ours / opts.brand:
  // see above. Returns the text with every unsupported claim sentence wrapped and the list of what was wrapped.
  function check(text, facts, opts = {}) {
    const t = String(text || ''); if (!t.trim()) return { text: t, flags: [] };
    const F = norm(facts); const body = opts.skip ? t.split(String(opts.skip)).join(' ') : t;
    const flags = []; let out = t;
    for (const s0 of body.split(/(?<=[.!?])\s+|\n+/)) { const s = s0.trim(); if (s.length < 4 || /^\[[^\]]*\]$/.test(s)) continue;
      if (opts.ours && !(OURS_RE.test(s) || (opts.brand && s.toLowerCase().includes(String(opts.brand).toLowerCase())))) continue;
      let plain = s.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');   // a word in a URL is not a claim (our own slug says "accredited-service-providers")
      if (opts.ours) plain = plain.replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');   // L2: words inside quotation marks are THEIR words (a pitch quotes their page title), never our claim
      const bad = [...plain.matchAll(CLAIM_RE)].map(m => m[0]).filter(m => { const k = keyOf(m); return k && !F.includes(k); });
      if (!bad.length) continue;
      flags.push({ claim: bad[0], sentence: s.slice(0, 200) });
      if (out.includes(s)) out = out.replace(s, '[Owner: confirm — ' + s + ']'); }
    return { text: out, flags };
  }
  // ---- A-15 (2026-10-17, re-rating 2026-10-17): what a written PAGE says about the business's own terms and scope ----
  // Live (exec 771, business facts and profile empty) the page told buyers "We charge for advice and delivery. Licences sit on a separate
  // line of the quote, you can buy them through any channel …", "Some can, but Tech& does not [manage a complete office IT setup]" and
  // "Tech& does not handle company formation" — none of it on any of the site's 33 pages, and the quality check listed none of it.
  // CL.business(text, corpus, opts) reads every sentence that speaks about the business (we / our / us, or one of its names in
  // opts.names) and holds three kinds of statement against `corpus` (the business facts, the profile, the site model and the site's own
  // pages this run read):
  //   * its commercial terms — what it charges, quotes, bills, licenses, guarantees, refunds, discounts, how it contracts or resells;
  //   * its scope — what it does NOT do, NEVER or ONLY does ("Tech& does not handle company formation");
  //   * its credentials — accreditation, certification, partnership, awards, founding year, a count of years / clients / staff.
  // A statement is supported when ONE sentence of the corpus carries its trigger (the same number, the trigger's stem; for a scope
  // statement, a negation) and at least half of its own content words. Anything else is returned as unsupported, with the sentence; the
  // caller marks it [Confirm: …] for the owner. Sentences already holding a bracket are left alone (a note is never nested).
  // The subject must be the business: "we …", "<name> …", "our <team / prices / quotes …>" — "configuration does not meet your needs" and
  // "you can act on it with another partner" say nothing about it. Questions (a buyer's checklist) are never claims.
  const BIZ_TERMS = /\b(?:charg(?:e|es|ed|ing)|quot(?:e|es|ed|ing)|bill(?:s|ed|ing)?|invoice (?:you|clients|customers)|pricing|priced|fixed[- ]price|flat[- ](?:fee|rate)|fees?|retainers?|contracts?|lock[- ]?in|refund\w*|money[- ]back|guarantee[sd]?|warrant(?:y|ies)|discount\w*|commissions?|mark-?ups?|resell(?:er|ers|s|ing)?|sells?|payment terms|free of charge|at no (?:extra )?cost|no (?:hidden )?(?:fees|charges|costs))\b/i;
  const BIZ_CRED = /\b(?:accredit\w*|certified|certifications?|iso[ -]?\d{4,5}|(?:gold|silver|solutions|certified|official|premier|authori[sz]ed|preferred|cloud solution) partner(?:s|ship)?|partner of the year|award\w*|member(?:s|ship)? of|founded|since (?:19|20)\d\d|headquarter\w*|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|employees|staff|consultants|engineers|implementations?))\b/i;
  const BIZ_ADVICE = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\s+(?:need|have to|recommend|suggest|advise|expect|know|mean|matter|depend|apply|require you|replace|guarantee you)\b/i;   // advice to the reader, not a statement of our scope
  const OURS_PAGE = /\b(?:[Ww]e|[Ww]e['’](?:re|ve|ll|d)|[Oo]ur|[Oo]urs|us)\b/;
  const escR = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const STOPW = new Set('the a an and or of for to in on with by at from as is are was were be been it its this that these those you your they them their there here can could will would should may might must do does did not no never only also just than then so such some any all each other more most very into over under about through which who whom what when where why how our we us ours has have had'.split(' '));
  const stem = (w) => { let x = String(w).toLowerCase().replace(/licens/g, 'licenc'); if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const words = (s, drop) => norm(s).split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !(drop || []).includes(w)).map(stem);
  function business(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = (opts.names || []).map(n => String(n || '').trim()).filter(n => n.length >= 3);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const SUBJ = '(?:\\b[Ww]e|\\b[Oo]ur (?:team|consultants|engineers|people|firm|company|prices|fees|quotes|contracts|recommendations)' + names.map(n => '|' + (/^\w/.test(n) ? '\\b' : '') + escR(n)).join('') + ')';
    const SCOPE = new RegExp(SUBJ + '\\s+(?:(?:do|does|did|will|would|can|could)(?:\\s+not|n[\'’]t)\\b|(?:never|only)\\b)|(?:\\b[Ww]e[\'’]re|\\b[Ww]e are' + names.map(n => '|' + escR(n) + ' is').join('') + ')\\s+not\\s+an?\\b');
    const SUBJ_RE = new RegExp(SUBJ);
    const NEG_ANY = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\b|\b(?:never|only)\b|\bnot an?\b/i;
    const cs = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => ({ n: norm(s), w: new Set(words(s, nameWords)), neg: NEG_ANY.test(s) })).filter(x => x.n.length > 3);
    const lines = t.split('\n'); let prevLine = '';
    for (const line of lines) {
      const L = line.trim();
      if (!L || /^#{1,6}\s/.test(L) || /^\|/.test(L) || /^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { if (L) prevLine = L.replace(/^#+\s*/, ''); continue; }
      const sents = L.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
      for (let i = 0; i < sents.length; i++) {
        const s = sents[i].trim().replace(/^[-*]\s+/, '');
        if (s.length < 6 || /\?\s*$/.test(s) || /[\[\]]/.test(s.replace(/\[[^\[\]]*\]\([^)]*\)/g, ''))) continue;
        const plain = s.replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '');
        if (!(OURS_PAGE.test(plain) || SUBJ_RE.test(plain))) continue;
        let kind = null, trig = null, m;
        if ((m = plain.match(SCOPE)) && !BIZ_ADVICE.test(plain) && !/\b(?:what|whether|if)\s+$/i.test(plain.slice(0, m.index))) { kind = 'scope'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_TERMS))) { kind = 'terms'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_CRED))) { kind = 'credential'; trig = m[0]; }
        if (!kind) continue;
        out.checked++;
        // an elliptical sentence ("Some can, but Tech& does not.") is read with the sentence or heading before it
        let W = words(plain, nameWords);
        if (W.length < 2) W = [...new Set(W.concat(words(i > 0 ? sents[i - 1] : prevLine, nameWords)))];
        const key = kind === 'credential' ? keyOf(trig) : stem((norm(trig).split(' ').filter(w => !STOPW.has(w) && !nameWords.includes(w))[0]) || norm(trig));
        const supported = cs.some(c => {
          if (kind === 'scope' ? !c.neg : !(key && c.n.includes(key))) return false;
          if (kind === 'credential' && /\d/.test(key)) return true;   // the same number on the site's own pages: "20+ Years"
          const hit = W.filter(w => c.w.has(w)).length; return W.length ? hit / W.length >= 0.5 : false;
        });
        if (!supported) out.flags.push({ kind, trigger: trig, sentence: s.slice(0, 300) });
      }
      prevLine = L;
    }
    return out;
  }
  return { CLAIM_RE, keyOf, check, business };
})();
