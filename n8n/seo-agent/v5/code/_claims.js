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
  // ---- E-CLAIM (2026-10-21, pre-launch run exec 42): what a page PROMISES in the business's name must be on file ----
  // Live (exec 42, techand.ai "ai consultant") the page promised "You receive a prioritised use-case backlog, data readiness findings and
  // an ROI case", "We test a proof of concept ... documented test results", "You receive a runbook and monitoring dashboards", a training
  // plan and "a self-study pack", "document each decision for your audit team" and "we stop there". The client states none of it, and
  // CL.business (terms / scope / credentials only) let every one through. CL.commitments(text, corpus, opts) reads the sentences that
  // commit the business to something:
  //   * "we / <name> / our team" + a doing verb (test, build, design, deliver, document, train, stop, tell, charge ...);
  //   * an offer to the reader in a section about the business ("you receive / get / keep ...", "business users get ...");
  //   * a phase or training line in such a section ("This phase covers ...", "Admins learn ...");
  //   * a billing line right after a billing sentence ("Licences sit on a separate line of the quote").
  // A section is about the business when its H2 group names the business, speaks as "we", or is headed by a phase or service the corpus
  // names. A statement is supported when its key terms are on file: one sentence of the corpus carries at least half of them (the words
  // scattered over a whole website do not count: every page says "data", "integration" and "test"), and every number it states is on file. Generic statements (no business subject) and advice to
  // the reader are never read. opts.names: the business names; opts.skip: sentences already flagged elsewhere.
  const COMMIT_VERB = '(?:test|tests|build|builds|design|designs|deliver|delivers|provide|provides|offer|offers|document|documents|train|trains|run|runs|give|gives|hand|hands|include|includes|cover|covers|stop|stops|tell|tells|guarantee|guarantees|commit|commits|charge|charges|bill|bills|invoice|invoices|quote|quotes|price|prices|set up|sets up|assign|assigns|monitor|monitors|support|supports|manage|manages|handle|handles|migrate|migrates|implement|implements|deploy|deploys|integrate|integrates|review|reviews|audit|audits|write|writes|create|creates|produce|produces|prepare|prepares|map|maps|assess|assesses|track|tracks|measure|measures|refund|refunds|promise|promises|ensure|ensures|keep|keeps|work with|works with|work in|works in|serve|serves|treat|treats|start|starts|begin|begins|finish|finishes|complete|completes|respond|responds|reply|replies|host|hosts|maintain|maintains|operate|operates|resell|resells|sell|sells|license|licenses|are available|is available|are certified|is certified|are accredited|is accredited)';
  const OFFER_RE = /\b(?:[Yy]ou|[Yy]our (?:team|teams|staff|people|users|admins|organisation|organization|business|company))\s+(?:will\s+|also\s+|then\s+)?(?:receive|get|keep|walk away with|leave with|are given|are handed)\b|\b(?:[Bb]usiness users|[Uu]sers|[Aa]dmins|[Mm]akers)\s+(?:will\s+)?(?:get|receive)\b/;
  const TRAIN_RE = /^(?:[Aa]dmins|[Mm]akers|(?:[Bb]usiness )?[Uu]sers|[Ss]taff|[Ee]mployees|[Yy]our (?:team|staff|admins|users|people))\s+(?:learn|are trained|get trained|receive training)\b/;
  const PHASE_RE = /^(?:[Tt]his|[Ee]ach|[Ee]very|[Tt]he)\s+(?:phase|stage|step|engagement|service|workstream|programme|program|package|plan)\s+(?:covers|includes|ends|delivers|starts|runs|takes|comes with)\b/;
  const CTA_RE = /^(?:[Bb]ook|[Cc]all|[Cc]ontact|[Tt]alk to|[Ee]mail|[Ss]chedule|[Gg]et in touch|[Aa]rrange|[Rr]equest a)\b/;
  const BILL_RE = /\b(?:quote|quotes|quoted|invoice\w*|billed|billing|line item|separate line|fees?|payment|deposit|retainer|hourly|day rate|licen[cs]es? (?:sit|are|is)|charged?)\b/i;
  // words that say nothing on their own about what is promised: they never count for or against support
  const GENERIC = new Set('you your receive get keep give gives offer provide include includes cover covers phase stage step engagement service then also each every well real live new own way part make makes work business client clients team teams solution solutions reason scope sometimes'.split(' ').map(stem));
  function commitments(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = (opts.names || []).map(n => String(n || '').trim()).filter(n => n.length >= 3);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const skip = new Set((opts.skip || []).map(s => norm(s)));
    const NAMES = names.map(n => (/^\w/.test(n) ? '\\b' : '') + escR(n)).join('|');
    const SUBJ = '(?:\\b[Ww]e|\\b[Oo]ur (?:team|teams|consultants|engineers|people|firm|company|scope|service|services|engagements?|approach|experts)' + (NAMES ? '|' + NAMES : '') + ')';
    const WE_RE = new RegExp(SUBJ + '(?:\\s+(?:will|also|then|always|typically|usually|can|then also|first|now))?(?:\\s+(?:will|also|then))?\\s+' + COMMIT_VERB + '\\b');
    const NAME_RE = NAMES ? new RegExp('(?:' + NAMES + ')') : null;
    const ABOUT_RE = new RegExp('\\b[Ww]e\\b|\\b[Oo]ur\\b' + (NAMES ? '|' + NAMES : ''));
    const cnorm = norm(corpus);
    const cs = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => new Set(words(s, nameWords))).filter(x => x.size);
    // sections: one H2 group = the H2 and the H3s under it
    const groups = []; let g = null, para = [];
    const flushPara = () => { if (para.length && g) g.paras.push(para.join(' ')); para = []; };
    for (const line of t.split('\n')) {
      const L = line.trim();
      const h = L.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); if (h[1].length <= 2 || !g) { g = { heads: [], paras: [] }; groups.push(g); } g.heads.push(h[2]); continue; }
      if (!g) { g = { heads: [], paras: [] }; groups.push(g); }
      if (!L || /^\|/.test(L) || /^\[[^\]]*\]$/.test(L) || /^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { flushPara(); continue; }
      if (/^[-*]\s+/.test(L)) { flushPara(); para.push(L); flushPara(); continue; }
      para.push(L);
    }
    flushPara();
    const headOnFile = (hd) => { const pre = norm(String(hd).split(':')[0]); return pre.length >= 6 && cnorm.includes(pre); };
    for (const G of groups) {
      const sentsOf = (p) => p.replace(/\*\*/g, '').replace(/^[-*]\s+/, '').split(/(?<=[.!?])\s+(?=[A-Z"(\[])/).map(s => s.trim());
      const clean = (s) => s.replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '');
      const aboutBiz = G.heads.some(hd => headOnFile(hd) || (NAME_RE && NAME_RE.test(hd))) || G.paras.some(p => ABOUT_RE.test(clean(p)));
      for (const p of G.paras) {
        const sents = sentsOf(p); let lastBill = false;
        for (const s of sents) {
          const plain = clean(s);
          if (plain.length < 12 || /\?\s*$/.test(plain) || /[\[\]]/.test(s.replace(/\[[^\[\]]*\]\([^)]*\)/g, '')) || skip.has(norm(s))) { lastBill = skip.has(norm(s)) && BILL_RE.test(plain); continue; }   // a billing sentence flagged by CL.business still carries the next line
          let why = null;
          if (CTA_RE.test(plain)) { lastBill = false; continue; }   // the page's call to action ("Book a scoping call and we will ...") invites a conversation, it is not a deliverable
          if (WE_RE.test(plain)) why = 'we';
          else if (aboutBiz && OFFER_RE.test(plain)) why = 'offer';
          else if (aboutBiz && (TRAIN_RE.test(plain) || PHASE_RE.test(plain))) why = 'phase';
          else if (lastBill && BILL_RE.test(plain) && !ABOUT_RE.test(plain)) why = 'billing';
          lastBill = !!why && BILL_RE.test(plain);
          if (!why) continue;
          out.checked++;
          const W = [...new Set(words(plain, nameWords))].filter(w => !GENERIC.has(w));
          const nums = (plain.match(/\d[\d,.:/+]*/g) || []).map(x => x.replace(/[,.]+$/, '')).filter(x => !/^\d$/.test(x));
          const numsOk = nums.every(n => cnorm.includes(norm(n)) || String(corpus || '').includes(n));
          const best = W.length ? Math.max(0, ...cs.map(c => W.filter(w => c.has(w)).length)) / W.length : 0;
          const supported = numsOk && W.length > 0 && best >= 0.5;
          if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain.slice(0, 90), why, W, best: Math.round(100 * best), numsOk }]);
          if (supported) continue;
          const kind = /\b(?:charg|bill|fee|price|pricing|quote|invoice|payment|licen[cs]es? (?:sit|are)|separate line|cost)/i.test(plain) ? 'pricing'
            : /\b(?:guarantee|warrant|refund|promise)/i.test(plain) ? 'guarantee'
              : /\b(?:within|\d+\s*(?:days?|weeks?|months?|hours?))\b/i.test(plain) ? 'timeline'
                : /\b(?:certified|accredit|partner)/i.test(plain) ? 'credential'
                  : /\b(?:stop|only|not|scope|covers|includes)\b/i.test(plain) ? 'scope'
                    : (why === 'offer' || why === 'phase' || /\b(?:deliver|provide|runbook|pack|report|dashboard|document)/i.test(plain)) ? 'deliverable' : 'process';
          out.flags.push({ kind, sentence: s.replace(/^[-*]\s+/, '').slice(0, 300), support: Math.round(100 * best) });
        }
      }
    }
    return out;
  }
  return { CLAIM_RE, keyOf, check, business, commitments };
})();
