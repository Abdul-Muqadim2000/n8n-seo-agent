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
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_CRED)) && !(/^member/i.test(m[0]) && names.some(n => plain.slice(m.index + m[0].length).trim().toLowerCase().startsWith(n.toLowerCase())))) { kind = 'credential'; trig = m[0]; }   // CT-FIX: "membership of <the business>" is joining it, not a credential it holds
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
        if (!supported) out.flags.push({ kind, trigger: trig, sentence: s });   // CT-FIX: the whole sentence (Content QA finds and wraps it); a display cut is the reader's
      }
      prevLine = L;
    }
    return out;
  }
  // ---- E-CLAIM (2026-10-21, pre-launch run exec 42): what a page PROMISES in the business's name must be on file ----
  // Live (exec 42, techand.ai "ai consultant") the page promised "You receive a prioritised use-case backlog, data readiness findings and
  // an ROI case", "We test a proof of concept ... documented test results", "You receive a runbook and monitoring dashboards", a training
  // plan and "a self-study pack", "document each decision for your audit team" and "we stop there". The client states none of it.
  // CT-FIX (2026-10-22, labelled set harness/accuracy/claims.json): the first version listed commitment VERBS, so it missed every promise
  // phrased another way ("we have delivered 150 projects", "our fixed fee starts at USD 15,000", "training is included at no extra cost",
  // a verb-less deliverable under "What you get", every Arabic sentence) and flagged a page's own call to action and a guide's narration.
  // It now decides by SUBJECT, not by verb. A sentence is a commitment of the business when:
  //   * the business is its grammatical subject: "we / we'll / we're / we have", a sentence that opens with "our <anything>", the
  //     business's name in the first words ("Every Azdan implementation takes ...", "As a Microsoft partner, Tech& implements ..."), the
  //     name followed by a verb anywhere, or "with us / from us / by <name>";
  //   * in a section about the business (its H2 group names it, speaks as we / our in a subject, or is headed by a phase on file): an offer
  //     to the reader ("you will receive / your team gets ..."), a passive line ("is delivered / are included / are part of the service"),
  //     a cost or duration line ("Membership costs EUR 2,500"), a phase or training line;
  //   * a list item under a business lead-in ("Our engagement includes:", or a heading such as "What you get from Tech&"): each item
  //     inherits the lead-in, verb or not. Table rows, headings and the meta description are read the same way (subject rules only).
  // Never a commitment: a question; the page's call to action (an imperative in the closing / CTA section, "<imperative> and we will
  // ...", "our team will reply ..."), unless it names a price, quote, fee or guarantee; guide narration ("in this guide we cover ...",
  // "below we map ..."); words inside quotation marks; a worked example ("say we start with ..."); a sentence whose agent is a named third
  // party ("you receive a TRN from the FTA"); "we" inside a relative clause ("most distributors we work with ...").
  // Support: one corpus sentence (or two adjacent ones: a fact is often split over a line break) carries at least half of its content
  // words, every number it states is on file as a whole number (number words are digits, "two decades" = 20 years, "round-the-clock" =
  // 24/7), and every strong qualifier it uses (only, exclusive, platinum, gold, largest, leading, first ...) is on that same fact.
  // Arabic: normalised like the keyword gate (alef forms, ta marbuta, alef maqsura, diacritics, tatweel, Arabic-Indic digits); a sentence
  // in the first person plural ("نحن / نقدم / نضمن / لدينا / فريقنا ...") or an offer ("ستحصل") is a commitment; its business terms are
  // read through a small bilingual lexicon and held against the same facts with the same rule (fewer than two terms read = cannot be
  // checked = flagged for the owner).
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100 };
  // the same meaning in the words a writer or a site uses: applied to the claim and to the facts before anything is compared
  const canon = (s) => String(s || '')
    .replace(/\b(?:a|one) decade\b/gi, '10 years').replace(/\b(two|three|four|five) decades\b/gi, (m, n) => (NUMW[n.toLowerCase()] * 10) + ' years')
    .replace(/\b(?:a|one) dozen\b/gi, '12').replace(/\b(?:around|round)[- ]the[- ]clock\b|\b24\s*x\s*7\b|\b24 hours a day,? 7 days a week\b|\b24 hours a day\b/gi, '24/7')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred)\b/gi, (m) => String(NUMW[m.toLowerCase()]))
    .replace(/(\d)\s*-\s*(day|week|month|year|hour|minute)s?\b/gi, '$1 $2s');
  // whole numbers only: "within 10 days" is not supported by "2010", "100" or "10x"; a single digit counts only with its unit ("8 weeks")
  const UNIT = '(?:days?|weeks?|months?|years?|hours?|minutes?|business days|working days)';
  const numsOf = (s) => {
    const t = canon(s); const out = [];
    for (const m of t.matchAll(/(?<![\w.,])(\d[\d,]*(?:\.\d+)?)(?![\w])/g)) { const n = m[1].replace(/,/g, '').replace(/\.0+$/, '');
      if (/^\d$/.test(n)) { const u = t.slice(m.index + m[0].length).match(new RegExp('^\\+?\\s+(?:to \\d+\\s+)?(' + UNIT + ')', 'i')); if (u) out.push(n + ' ' + stem(u[1].split(' ').pop())); }
      else out.push(n); }
    return out;
  };
  const STRONG = /\b(?:only|sole|exclusive\w*|platinum|gold|silver|diamond|elite|premier|largest|biggest|leading|first|#1|number one|best|official|award[- ]winning)\b/gi;
  const ARABIC = /[؀-ۿ]/;
  const arNorm = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٬/g, ',');
  // business terms in Arabic (normalised, without the article) -> the English word the facts use; phrases first
  const AR_LEX = [['على مدار الساعه', '24/7'], ['طوال ايام الاسبوع', '24/7'], ['المنطقه الحره', 'freezone'], ['دليل تشغيل', 'runbook'], ['لوحات متابعه', 'monitoring dashboards'],
    ['نموذج تجريبي', 'pilot'], ['النموذج التجريبي', 'pilot'], ['نت سويت', 'netsuite'], ['ذكاء اصطناعي', 'ai'], ['عامين', '2 years'], ['سنتين', '2 years'],
    ['دعم', 'support'], ['خبره', 'experience'], ['عام', 'years'], ['عاما', 'years'], ['اعوام', 'years'], ['سنه', 'years'], ['سنوات', 'years'], ['قطاع', 'industry'],
    ['مكتب', 'office'], ['مقر', 'based'], ['مطار', 'airport'], ['دبي', 'dubai'], ['امارات', 'uae'], ['خليج', 'gcc'], ['سعوديه', 'ksa'], ['مصر', 'egypt'], ['شريك', 'partner'],
    ['مايكروسوفت', 'microsoft'], ['اوراكل', 'oracle'], ['تنفيذ', 'implementation'], ['ضمان', 'guarantee'], ['نضمن', 'guarantee'], ['استرداد', 'refund'], ['اموال', 'money'],
    ['شهاده', 'certification'], ['معتمد', 'certified'], ['رسوم', 'fee'], ['تكلفه', 'cost'], ['سعر', 'price'], ['درهم', 'aed'], ['تقييم', 'assessment'], ['جاهزيه', 'readiness'],
    ['اطلاق', 'go-live'], ['تدريب', 'training'], ['اسبوع', 'weeks'], ['اسابيع', 'weeks'], ['شهر', 'months'], ['اشهر', 'months'], ['يوم', 'days'], ['ايام', 'days'], ['مجاني', 'free'],
    ['مجانا', 'free'], ['خصم', 'discount'], ['مستشار', 'consultant'], ['مستشارون', 'consultants'], ['عملاء', 'clients'], ['مشروع', 'project'], ['مشاريع', 'projects'], ['ترخيص', 'licence'],
    ['بيانات', 'data'], ['واحد', '1'], ['اثنان', '2'], ['ثلاثه', '3'], ['اربعه', '4'], ['خمسه', '5'], ['سته', '6'], ['سبعه', '7'], ['ثمانيه', '8'], ['تسعه', '9'], ['عشره', '10'], ['عشرين', '20']]
    .map(([a, e]) => [arNorm(a).split(' ').map(w => w.replace(/^ال(?=\S{3,})/, '')).join(' '), e]);
  const AR_WE = new Set(['نحن', 'لدينا', 'عندنا', 'نقدم', 'نوفر', 'نضمن', 'نلتزم', 'نتعهد', 'نعمل', 'نساعد', 'نبني', 'نصمم', 'ننفذ', 'نسلم', 'نتقاضى', 'نفرض', 'ندير', 'نخدم', 'نختبر', 'ندرب', 'نراجع', 'نرد', 'سنقوم', 'سنقدم', 'سنوفر', 'سنرسل', 'سنسلم'].map(arNorm));
  const AR_OFFER = new Set(['ستحصل', 'تحصل', 'ستتلقى', 'تتلقى', 'ستستلم'].map(arNorm));
  const AR_CTA = /^(?:احجز|تواصل|اتصل|اطلب|ابدا|سجل|راسلنا|ارسل|انضم|جرب|تحدث)/;
  const AR_NOT_OURS = new Set(['هنا', 'احيانا', 'لنا'].map(arNorm));
  const arTokens = (s) => arNorm(s).replace(/[^؀-ۿ0-9a-z%\s]/gi, ' ').split(/\s+/).filter(Boolean);
  const arStrip = (w) => w.replace(/^(?:وال|بال|لل|فال|كال|ال|و|ب|ل|ف)(?=\S{3,})/, '');
  const arOurs = (s) => { const T = arTokens(s); if (AR_CTA.test(T[0] || '')) return null;
    if (T.some(w => AR_WE.has(w) || AR_WE.has(arStrip(w)) || (w.length >= 5 && /نا$/.test(w) && !AR_NOT_OURS.has(w)))) return 'we';
    if (T.some(w => AR_OFFER.has(w))) return 'offer'; return null; };
  const arToEnglish = (s) => { let t = ' ' + arTokens(s).map(arStrip).join(' ') + ' '; const hits = [];
    for (const [a, e] of AR_LEX) { const re = new RegExp('(?:^|\\s)(?:ال)?' + a.replace(/\s+/g, '\\s+(?:ال)?') + '(?:نا|ها|كم|ك)?(?=\\s)', 'g'); if (re.test(t)) { hits.push(e); t = t.replace(re, ' '); } }
    const digits = (s.match(/\d[\d,]*/g) || []).concat((arNorm(s).match(/\d[\d,]*/g) || []));
    const lat = (String(s).match(/[A-Za-z][A-Za-z0-9&-]+/g) || []);
    return { text: [...new Set(digits)].join(' ') + ' ' + lat.join(' ') + ' ' + hits.join(' '), terms: hits.length + lat.length };
  };
  const SAY_RE = /\b(?:says?|said|states?|stated|notes?|noted|told|according to|writes?|wrote|explains?|explained)\b/i;
  const NARR_OPEN = /^(?:in this (?:guide|article|post|page|section|piece|checklist)|in the (?:next|following) sections?|in the sections? below|below|above|here|next|throughout this (?:guide|article|page)|as we (?:saw|said|noted|explained|mentioned)|later in this (?:guide|article))\b/i;
  const NARR_VERB = /^(?:we|we['’]ll)\s+(?:will\s+)?(?:cover|explain|walk (?:you )?through|look at|outline|list|compare|answer|explore|discuss|break down|summari[sz]e|unpack|examine|describe|go through|show you)\s+(?:the|these|this|what|how|why|when|which|each|every|\d+|both|all)\b/i;
  const EXAMPLE_RE = /^(?:say|suppose|imagine|assume|picture|let['’]?s say|for (?:example|instance), (?:say|suppose|imagine|if))\b/i;
  const ADVICE_WE = /^(?:we|we['’]d)\s+(?:would\s+|always\s+|strongly\s+)?(?:recommend|suggest|advise|encourage|urge)\b/i;
  const CTA_START = /^(?:book|call|contact|talk|email|e-mail|schedule|get in touch|arrange|request|get a|get your|get started|share|send|ask|tell us|reach|start|join|sign up|try|download|visit|speak|let['’]s|fill in|message|claim|see how|find out|learn more|ready to)\b/i;
  const CTA_HEAD = /\b(?:next steps?|get started|getting started with us|contact|talk to|book|ready to|let['’]s talk|work with us|request|speak to|get in touch|start (?:your|a|with))\b/i;
  const CTA_FOLLOW = /\b(?:reply|replies|respond|responds|get back to you|call you back|be in touch|contact you|review (?:it|them|your|the details)|send (?:you )?(?:a |the )?(?:written )?(?:plan|proposal|summary|recommendation|outline|next steps)|prepare a (?:fixed-scope |short )?(?:proposal|plan)|set up a call|arrange a call)\b/i;
  const CTA_TERMS = /\b(?:quotes?|quoted|price[sd]?|pricing|fees?|cost|guarantee\w*|refund\w*|money[- ]back|warrant\w*|discount\w*)\b|(?:aed|usd|eur|gbp|sar|\$|€|£)\s?\d/i;
  const COMMIT_VERB = /\b(?:test|tests|build|builds|design|designs|deliver|delivers|provide|provides|offer|offers|document|documents|train|trains|run|runs|give|gives|hand|hands|include|includes|cover|covers|stop|stops|tell|tells|guarantee|guarantees|commit|commits|charge|charges|bill|bills|invoice|invoices|quote|quotes|set up|sets up|assign|assigns|monitor|monitors|support|supports|manage|manages|handle|handles|migrate|migrates|implement|implements|deploy|deploys|integrate|integrates|review|reviews|audit|audits|write|writes|create|creates|produce|produces|prepare|prepares|assess|assesses|track|tracks|measure|measures|refund|refunds|promise|promises|ensure|ensures|keep|keeps|work|works|serve|serves|start|starts|begin|begins|complete|completes|respond|responds|reply|replies|host|hosts|maintain|maintains|operate|operates|resell|resells|sell|sells|license|licenses|certif(?:y|ies)|has|have|had|is|are|was|were|holds?|employs?|costs?|takes?|lasts?|comes?|wins?|won)\b/;
  const OFFER_RE = /\b(?:you|your (?:team|teams|staff|people|users|admins|organisation|organization|business|company))\s+(?:will\s+|['’]ll\s+|also\s+|then\s+|always\s+)?(?:receive|receives|get|gets|keep|keeps|walk away with|leave with|are given|are handed|can expect|will have)\b|\b(?:business users|users|admins|makers)\s+(?:will\s+)?(?:get|gets|receive)\b/i;
  const TRAIN_RE = /^(?:admins|makers|(?:business )?users|staff|employees|your (?:team|staff|admins|users|people))\s+(?:learn|are trained|get trained|receive training)\b/i;
  const PHASE_RE = /^(?:this|each|every|the)\s+(?:phase|stage|step|engagement|service|workstream|programme|program|package|plan)\s+(?:covers|includes|ends|delivers|starts|runs|takes|comes with)\b/i;
  const PASSIVE_RE = /\b(?:is|are|will be|comes?|come)\s+(?:also\s+|always\s+)?(?:delivered|included|provided|offered|covered|handled|priced|billed|charged|backed|guaranteed|free of charge|at no (?:extra )?cost|part of (?:the|every|each|our|all)|available (?:to|for|with|at)|bundled|built in|supplied)\b/i;
  const COSTTIME_RE = /\b(?:costs?|starts? at|is priced at|takes|lasts|runs for)\s+(?:about\s+|around\s+|from\s+|just\s+|only\s+)?(?:(?:aed|usd|eur|gbp|sar|\$|€|£)\s?)?\d/i;
  const BILL_RE = /\b(?:quote|quotes|quoted|invoice\w*|billed|billing|line item|separate line|fees?|payment|deposit|retainer|hourly|day rate|licen[cs]es? (?:sit|are|is)|charged?)\b/i;
  const LEAD_HEAD = /\b(?:what you get|you get|you receive|deliverables?|includes?|included|what (?:we|\S+) (?:deliver|delivers|does|do|handles?|offers?|covers?|provides?)|our (?:services|engagement|approach|offer|packages?|scope))\b/i;
  // words that say nothing on their own about what is promised: they never count for or against support
  const GENERIC = new Set('you your receive get gets keep give gives offer provide include includes cover covers phase stage step engagement service then also each every well real live new own way part make makes work business client clients team teams solution solutions reason scope sometimes have has more than over typical typically'.split(' ').map(stem));
  // a name that is only part of a fuller name of the business names something else ("peppol" is the network, "OpenPeppol" the
  // organisation): only the full names are a subject
  const fullNames = (list) => { const ns = (list || []).map(n => String(n || '').trim()).filter(n => n.length >= 3); const k = (n) => norm(String(n).replace(/&/g, 'and')).replace(/ /g, '');
    return ns.filter(n => !ns.some(o => k(o) !== k(n) && k(o).includes(k(n)))); };
  function commitments(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = fullNames(opts.names);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const skip = new Set((opts.skip || []).map(s => norm(s)));
    const NAMES = names.map(n => (/^\w/.test(n) ? '\\b' : '') + escR(n) + (/\w$/.test(n) ? '\\b' : '')).join('|');
    const NAME_RE = NAMES ? new RegExp('(?:' + NAMES + ')', 'i') : null;
    const NAME_VERB = NAMES ? new RegExp('(?:' + NAMES + ')(?:[\'’]s)?(?:\\s+(?:also|then|now|always|typically|usually|will|can|has|have))*\\s+' + COMMIT_VERB.source.slice(2), 'i') : null;
    const NAME_BY = NAMES ? new RegExp('\\b(?:with|from|by|at)\\s+(?:' + NAMES + ')', 'i') : null;
    const WE_SUBJ = /(?:^|[,;:]\s*|\b(?:and|but|so|then|that|because|where|when|if|once|after|before|until|while|which|or)\s+)(?:we|we['’](?:ll|re|ve|d))\s+(?!recommend|suggest|advise|encourage|urge)\S/i;
    const OUR_SUBJ = /(?:^|\b(?:and|but|so|then|because|while)\s+|[;:]\s*)our\s+\S+(?:\s+\S+){0,5}?\s+(?:is|are|was|were|has|have|will|can|also|costs?|starts?|takes?|includes?|covers?|runs?|lets?|helps?|handles?|monitors?|provides?|delivers?|offers?|works?|holds?|builds?|designs?|comes?|begins?|ends?|means?|gives?|charges?|bills?|supports?|serves?|keeps?|treats?|does|did|consists?)\b/i;
    const WITH_US = /\b(?:with|from|by)\s+us\b/i;
    const lead = (s) => s.replace(/^(?:yes|no|in short|in practice|today|also|first|next|finally|then|so|and|but|instead|however|in addition|for that reason|as a result|on top of that|after go-live|unlike [^,]{3,60}|as an? [^,]{3,60}|for [^,]{3,40}|after [^,]{3,40}|once [^,]{3,40}|during [^,]{3,40}|in [^,]{3,40}|at [^,]{3,40}|with [^,]{3,40}|if [^,]{3,80}|when [^,]{3,60}|where [^,]{3,60}),\s+/i, '');
    const nameFirst = (s) => { if (!NAME_RE) return false; const w = s.split(/\s+/).slice(0, 4).join(' '); const m = w.match(NAME_RE); if (!m) return false;
      const before = w.slice(0, m.index).trim().toLowerCase(); return !/\b(?:of|for|to|with|from|about|by|at|than|like|on|in)$/.test(before); };
    const bizSubject = (p) => { const s = lead(p);
      if (WE_SUBJ.test(s) && !ADVICE_WE.test(s)) return 'we';
      if (OUR_SUBJ.test(s)) return 'our';
      if (nameFirst(s) || (NAME_VERB && NAME_VERB.test(s))) return 'name';
      if (WITH_US.test(s) || (NAME_BY && NAME_BY.test(s))) return 'with';
      return null; };
    const quoteless = (s) => s.replace(/["“][^"“”]{3,300}["”]/g, ' ').replace(/\s+/g, ' ').trim();
    // the third party who acts: "from the FTA", "issued by the Ministry", "<Org> says"
    const thirdParty = (s) => { const m = s.match(/\b(?:from|by|issued by|with)\s+(?:the\s+)?([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*)/); return !!(m && !(NAME_RE && NAME_RE.test(m[1])) && !/^(?:Us|Our|We)$/.test(m[1])); };
    const cnorm = norm(canon(corpus));
    const cnums = new Set(numsOf(corpus));
    const csents = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => canon(s)).filter(s => s.trim());
    const cs = []; for (let i = 0; i < csents.length; i++) { const one = csents[i]; const two = i + 1 < csents.length ? one + ' ' + csents[i + 1] : one;
      for (const x of (two === one ? [one] : [one, two])) { const w = new Set(words(x, nameWords)); if (w.size) cs.push({ w, low: x.toLowerCase() }); } }
    const support = (plain, english) => {
      const c0 = canon(english || plain);
      const W = [...new Set(words(c0, nameWords))].filter(w => !GENERIC.has(w));
      const nums = numsOf(c0);
      const numsOk = nums.every(n => cnums.has(n) || (/ /.test(n) && cnorm.includes(n.split(' ')[0] + ' ' + n.split(' ')[1].slice(0, 4))));
      const strong = [...new Set((c0.match(STRONG) || []).map(x => x.toLowerCase()))];
      let best = 0;
      for (const c of cs) { const r = W.length ? W.filter(w => c.w.has(w)).length / W.length : 0; if (r > best && strong.every(q => c.low.includes(q))) best = r; }
      return { W, best, numsOk, ok: numsOk && W.length > 0 && best >= 0.5 };
    };
    // sections: one H2 group = the H2 and the H3s under it; a list item remembers its lead-in
    const groups = []; let g = null, para = [], lastLead = null, headLead = null;
    const flushPara = () => { if (para.length && g) { const p = para.join(' '); g.items.push({ p, kind: 'para' }); lastLead = /:\s*$/.test(p) ? p : null; } para = []; };
    for (const line of t.split('\n')) {
      const L = line.trim();
      const h = L.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); if (h[1].length <= 2 || !g) { g = { heads: [], items: [] }; groups.push(g); } g.heads.push(h[2]); headLead = h[2]; lastLead = null; g.items.push({ p: h[2], kind: 'head' }); continue; }
      if (!g) { g = { heads: [], items: [] }; groups.push(g); }
      const meta = L.match(/^Meta Description:\s*(.*)$/i);
      if (meta) { flushPara(); g.items.push({ p: meta[1], kind: 'meta' }); continue; }
      if (!L || /^\[[^\]]*\]$/.test(L) || /^(?:Title|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { flushPara(); if (!L) { /* a blank line keeps the lead-in for the list below it */ } continue; }
      if (/^\|/.test(L)) { flushPara(); if (/^\|[\s:|-]+\|?$/.test(L)) { const hd = g.items[g.items.length - 1]; if (hd && hd.kind === 'table') g.items.pop(); continue; }   // the header row is labels, not a statement
        g.items.push({ p: L.replace(/^\||\|$/g, '').split('|').map(x => x.trim()).filter(Boolean).join('; ') + '.', kind: 'table' }); continue; }
      if (/^(?:[-*]|\d+[.)])\s+/.test(L)) { const leadIn = para.length ? para.join(' ') : null; flushPara(); g.items.push({ p: L.replace(/^(?:[-*]|\d+[.)])\s+/, ''), kind: 'li', lead: leadIn && /:\s*$/.test(leadIn) ? leadIn : lastLead, head: headLead }); continue; }
      para.push(L);
    }
    flushPara();
    const headOnFile = (hd) => { const pre = norm(String(hd).split(':')[0]); return pre.length >= 6 && cnorm.includes(pre); };
    const clean = (s) => s.replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
    const sentsOf = (p) => p.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"(\[“؀-ۿ])|(?<=[.!?؟])\s+/).map(s => s.trim()).filter(Boolean);
    const isLast = (G) => groups.filter(x => x.heads.length).slice(-1)[0] === G && groups.filter(x => x.heads.length).length >= 2;
    const ctaGroup = (G) => G.heads.some(hd => CTA_HEAD.test(hd) || /\?\s*$/.test(hd) && /\b(?:ready|want|need) to\b/i.test(hd)) || isLast(G);
    for (const G of groups) {
      const aboutBiz = G.heads.some(hd => headOnFile(hd) || (NAME_RE && NAME_RE.test(hd)) || /\b(?:we|our|us)\b/i.test(hd))
        || G.items.some(it => it.kind === 'para' && sentsOf(it.p).some(s => bizSubject(quoteless(clean(s)))));
      const cta = ctaGroup(G);
      for (const it of G.items) {
        if (it.kind === 'head' && !(WE_SUBJ.test(lead(clean(it.p))) || (NAME_VERB && NAME_VERB.test(clean(it.p))))) continue;   // a heading is read only when it is a sentence with the business as subject ("Why Tech&" is a label)
        const sents = (it.kind === 'li' || it.kind === 'table' || it.kind === 'head') ? [it.p] : sentsOf(it.p); let lastBill = false;
        for (const s of sents) {
          const plain0 = clean(s);
          const full = s.replace(/^[-*]\s+/, '');
          if (plain0.length < 12 || /[?؟]\s*$/.test(plain0) || /[\[\]]/.test(s.replace(/!?\[[^\[\]]*\]\([^)]*\)/g, '')) || skip.has(norm(s))) { lastBill = skip.has(norm(s)) && BILL_RE.test(plain0); continue; }
          if (ARABIC.test(plain0)) {   // Arabic: the first person plural or an offer; the same support rule through the lexicon
            const why = arOurs(plain0); if (!why || (why === 'offer' && !aboutBiz)) continue;
            out.checked++;
            const en = arToEnglish(plain0); const sp = support(plain0, en.text);
            if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain0.slice(0, 90), why: 'ar-' + why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
            if (sp.ok && en.terms >= 2) continue;
            const ek = en.text;
            out.flags.push({ kind: /guarantee|refund/.test(ek) ? 'guarantee' : /fee|cost|price|aed|discount|free/.test(ek) ? 'pricing' : /certif/.test(ek) ? 'credential' : /weeks|days|months/.test(ek) ? 'timeline' : why === 'offer' ? 'deliverable' : 'process',
              sentence: full, support: Math.round(100 * sp.best) });
            continue;
          }
          const hasQuote = /["“][^"“”]{3,300}["”]/.test(plain0);
          const plain = quoteless(plain0);
          if (hasQuote && SAY_RE.test(plain)) { lastBill = false; continue; }   // a quotation with its speaker: their words, not ours
          const L0 = lead(plain);
          if (NARR_OPEN.test(plain) || NARR_VERB.test(L0) || EXAMPLE_RE.test(plain) || ADVICE_WE.test(L0)) { lastBill = false; continue; }
          if (cta && (CTA_START.test(plain) || CTA_FOLLOW.test(plain)) && !CTA_TERMS.test(plain)) { lastBill = false; continue; }   // the call to action invites a conversation; a price or a guarantee in it is still a term
          if (CTA_START.test(plain) && !/\b(?:and|then)\s+(?:we|our team)\b/i.test(plain) && !CTA_TERMS.test(plain)) { lastBill = false; continue; }   // an imperative on its own is advice or an invitation
          let why = null; const subj = bizSubject(plain);
          if (subj) why = subj;
          else if (it.kind === 'li' && ((it.lead && (bizSubject(clean(it.lead)) || (NAME_RE && NAME_RE.test(it.lead)) || LEAD_HEAD.test(it.lead))) || (!it.lead && it.head && LEAD_HEAD.test(it.head) && (aboutBiz || (NAME_RE && NAME_RE.test(it.head)))))) why = 'list';
          else if (aboutBiz && it.kind !== 'head' && !thirdParty(plain)) {
            if (OFFER_RE.test(plain)) why = 'offer';
            else if (TRAIN_RE.test(plain) || PHASE_RE.test(plain)) why = 'phase';
            else if (PASSIVE_RE.test(plain) || COSTTIME_RE.test(plain)) why = 'passive';
            else if (lastBill && BILL_RE.test(plain)) why = 'billing';
          }
          if (why && (why === 'offer' || why === 'with') && thirdParty(plain)) why = null;
          lastBill = !!why && BILL_RE.test(plain);
          if (!why) continue;
          out.checked++;
          const sp = support(plain);
          if (opts.trace) out.trace = (out.trace || []).concat([{ s: plain.slice(0, 90), why, W: sp.W, best: Math.round(100 * sp.best), numsOk: sp.numsOk }]);
          if (sp.ok || !sp.W.length) continue;   // nothing but generic words: nothing to hold against the facts
          const kind = /\b(?:charg|bill|fee|price|pricing|quote|invoice|payment|licen[cs]es? (?:sit|are)|separate line|cost|free|discount)/i.test(plain) ? 'pricing'
            : /\b(?:guarantee|warrant|refund|promise)/i.test(plain) ? 'guarantee'
              : /\b(?:within|\d+\s*(?:days?|weeks?|months?|hours?|minutes?))\b|\b(?:days|weeks|months)\b/i.test(canon(plain)) ? 'timeline'
                : /\b(?:certified|certif|accredit|partner|iso)/i.test(plain) ? 'credential'
                  : /\b(?:stop|only|not|never|scope|covers|includes)\b/i.test(plain) ? 'scope'
                    : (why === 'offer' || why === 'phase' || why === 'list' || why === 'passive' || /\b(?:deliver|provide|runbook|pack|report|dashboard|document)/i.test(plain)) ? 'deliverable' : 'process';
          // E-CLAIM / CT-FIX: the WHOLE sentence is returned (Content QA finds and wraps it in the copy); a display cut belongs to the reader
          out.flags.push({ kind, sentence: full, support: Math.round(100 * sp.best) });
        }
      }
    }
    return out;
  }
  return { CLAIM_RE, keyOf, check, business, commitments, canon, numsOf, arNorm };
})();
