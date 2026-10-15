// Page-claims kit (R38 / R48, 2026-10-16; inlined by build sections 102 and 103).
// A statement about what the CUSTOMER'S OWN page lacks is a statement about their property, and the verdict made three false ones in one
// sentence (exec 608: "no mandate dates, no tables, no author or date" - the page has all three). `Collect Client Pages` now measures the
// page's facts on the whole page (`existing_page_digest`); this kit is the deterministic half: a negative claim about the page that the
// digest contradicts, or that the digest says could not be checked, is not allowed to reach the customer as a fact.
//   PC.topics(text)            which parts of a page a sentence is about: dates, pubdate, table, author, cta
//   PC.claimsAbsence(text)     does it say something is missing / absent
//   PC.judge(text, digest, o)  { drop, why } - o.scoped: every line is about the client's page (the analyzer's `existing_page_gaps`)
//   PC.filterLines(lines, d, o) -> { lines, dropped }   one line = one statement (arrays of reasons / gaps)
//   PC.filterText(text, d, o)   -> { text, dropped }    sentence by sentence (a paragraph)
//   PC.fta(text)               R48: "FTA-accredited" -> the Ministry of Finance (the UAE's e-invoicing accreditation is the Ministry's)
const PC = (() => {
  const S = (x) => String(x == null ? '' : x);
  const NEG = /\b(?:no|not|without|lacks?|lacking|lack of|missing|absent|doesn['’]?t|does not|isn['’]?t|is not|aren['’]?t|are not|never|zero|nothing|none|yet to|fails? to|omits?)\b/i;
  const HEDGE = /\b(?:in the excerpt|excerpt provided|text provided|provided text|provided excerpt|first part|visible in the text provided|in the text we (?:read|were given))\b/i;
  const TOPIC = [
    ['table', /\btables?\b|comparison (?:chart|matrix)|\bmatrix\b/i],
    ['author', /\bauthors?\b|\bbylines?\b|written by|author box|\bexpert (?:name|bio|credit)/i],
    ['pubdate', /\b(?:publish(?:ed|ing)?|updated?|modified|last[- ]updated|revised|freshness)\b[^.;]{0,30}\bdates?\b|\bdates?\b[^.;]{0,20}\b(?:published|updated|modified)\b|\bpublication dates?\b|\bdatestamps?\b|\bdated\b/i],
    ['dates', /\b(?:mandate|deadline|implementation|compliance|timeline|key|regulatory|go-live|rollout|roll-out)\s+dates?\b|\bdates?\b|\b(?:19|20)\d{2}\b[^.;]{0,20}\b(?:deadline|mandate)\b/i],
    ['cta', /\bCTAs?\b|call[- ]to[- ]action|contact (?:form|details|button|link)|lead (?:form|capture|magnet)|enquiry form|inquiry form|conversion (?:element|path)/i]
  ];
  const CLIENT_REF = /\b(?:existing|current|client['’]?s?|your|our|target (?:url|page)|the (?:insights |blog |service )?(?:page|article|post)|this (?:page|article|post)|its (?:visible |own |current )?(?:text|content|copy)|the url)\b/i;
  const COMP_ONLY = /\b(?:competitors?|rivals?|top[- ]?(?:3|5|10)|ranking pages|the serp|results pages?)\b/i;
  const topics = (text) => {
    const t = S(text), out = [];
    for (const [k, re] of TOPIC) if (re.test(t)) out.push(k);
    // "no author or date" is a statement about the byline and its date
    if (out.indexOf('author') >= 0 && /\bor\s+(?:a\s+)?(?:publication |publish |update )?dates?\b/i.test(t) && out.indexOf('pubdate') < 0) out.push('pubdate');
    return out;
  };
  const claimsAbsence = (text) => NEG.test(S(text));
  const dig = (d) => (d && typeof d === 'object' && d.url !== undefined) ? d : null;
  // one statement, judged against the page's facts; the `why` is the sentence the owner can read in the report
  const judge = (text, digest, o) => {
    const d = dig(digest), t = S(text), opts = o || {};
    if (!d || !t) return { drop: false };
    if (!claimsAbsence(t)) return { drop: false };
    const tp = topics(t);
    if (!tp.length) return { drop: false };
    // a sentence that does not name the client's page (competitors, the results page) is not a claim about it
    if (!opts.scoped && (!CLIENT_REF.test(t) || (COMP_ONLY.test(t) && !/\b(?:existing|current|client['’]?s?|your|our)\b/i.test(t)))) return { drop: false };
    const dates = (d.dates || []), structure = !!d.structure_reliable;
    for (const k of tp) {
      if (k === 'dates' && (dates.length || d.published)) return { drop: true, topic: k, why: 'the page states dates in its text (' + (dates.slice(0, 3).join('; ') || d.published) + ')' };
      if (k === 'table') { if (d.tables > 0) return { drop: true, topic: k, why: 'the page has ' + d.tables + ' table(s)' }; if (!structure) return { drop: true, topic: k, why: 'tables could not be checked: the text reader flattens them and the page\'s HTML was not read in full' }; }
      if (k === 'author') { if (d.author) return { drop: true, topic: k, why: 'the page names its author (' + d.author + ')' }; if (!structure) return { drop: true, topic: k, why: 'a byline could not be checked: the text reader drops it and the page\'s HTML was not read in full' }; }
      if (k === 'pubdate') { if (d.published || d.modified) return { drop: true, topic: k, why: 'the page carries a publication date (' + (d.published || d.modified) + ')' }; if (!structure) return { drop: true, topic: k, why: 'a publication date could not be checked: the page\'s HTML was not read in full' }; }
      if (k === 'cta') { if (d.cta === true) return { drop: true, topic: k, why: 'the page has a call to action' }; if (!structure && d.cta !== false) return { drop: true, topic: k, why: 'a call to action could not be checked: the page\'s HTML was not read in full' }; }
    }
    // a negative claim that rests on "the excerpt provided" is a guess about the rest of the page, whatever it is about
    if (HEDGE.test(t)) return { drop: true, topic: tp[0], why: 'it rests on an excerpt of the page, not on the page' };
    return { drop: false };
  };
  const filterLines = (lines, digest, o) => {
    const kept = [], dropped = [];
    for (const l of (Array.isArray(lines) ? lines : [])) {
      const j = judge(l, digest, o);
      if (j.drop) dropped.push({ text: S(l).slice(0, 300), topic: j.topic, why: j.why }); else kept.push(l);
    }
    return { lines: kept, dropped };
  };
  const filterText = (text, digest, o) => {
    const t = S(text), parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/), kept = [], dropped = [];
    for (const p of parts) {
      const j = judge(p, digest, o);
      if (j.drop) dropped.push({ text: p.slice(0, 300), topic: j.topic, why: j.why }); else kept.push(p);
    }
    return { text: kept.join(' ').trim(), dropped };
  };
  // R48: in the UAE the Ministry of Finance accredits e-invoicing service providers (the Federal Tax Authority administers the tax); vendors' own pages say "FTA-accredited"
  const fta = (text) => S(text)
    .replace(/\bFTA[-\s]accredited\b/g, 'Ministry of Finance-accredited').replace(/\bFTA[-\s]accredit(ation)\b/gi, 'Ministry of Finance accreditation')
    .replace(/\baccredited by the (?:UAE )?(?:Federal Tax Authority|FTA)\b/gi, 'accredited under the Ministry of Finance\'s e-invoicing framework');
  return { topics, claimsAbsence, judge, filterLines, filterText, fta };
})();
