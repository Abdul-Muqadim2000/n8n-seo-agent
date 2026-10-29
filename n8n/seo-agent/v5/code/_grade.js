// ---- grade kit (W0-C, page-quality programme 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 3, 2.6, 2.9; REVIEW_CODE H3 / L1 / L5;
// REVIEW_EVIDENCE H2 / H3 / M1; inlined through the GRADE marker into Content QA, Page Candidates, Apply Second Read and the Finalize
// workflow's Finalize Verdict). Production page run 3299 ("ms 365 erp") was graded 92 and its final version 100 "Ready to publish" while the
// client's expert reviewer gave it 63: the grade counted structure, term coverage, readability, specificity, filler words and LENGTH, and
// nothing a reviewer takes points off for (figures resting on an agency blog and a tracker, one label for two different lists, a keyword our
// own verdict scored 42, a page the website already had). The only part that moved 92 -> 100 was length.
//
// The interim grade, deterministic and free, on ONE scale out of 100 (a subset of the Wave 2 rubric, so nothing is thrown away):
//   structure 20       today's structure checks scaled; -3 per repetition cluster (one statement made 3+ times across sections, up to
//                      -8); -2 per label used for two different lists (up to -4); a statement made 4+ times caps structure at 50%
//   coverage 15        today's term coverage, scaled
//   readability 10     today's readability, scaled
//   specificity 10     today's specificity
//   clean language 10  today's filler-phrase check
//   sources 15         share of the cited sentences and figures resting on an official body, a research house, major press or vendor
//                      documentation; -1/3 of the part per market, adoption, cost or compliance figure whose only source is weak; such a
//                      compliance figure caps sources at 8 of 15. Nothing to source (no figure, no citation) is "not checked" at 12 of
//                      15 (4/5): never full marks, so deleting a citation never pays (WAVE0_REVIEW M2). A sentence resting only on a weak
//                      source with no market / cost / compliance figure counts half a strong one (none while such a figure rests only
//                      on a weak source), and while nothing on the page is an
//                      unsourced or weak-only figure the part never falls below "not checked": citing a vendor or agency page is never
//                      worse than citing nothing. The digits of a phone number, opening hours, a postcode / PO box or a street, office
//                      or floor number are contact details, never a figure to source (WAVE0_REVIEW H1)
//   fit 20             half for the verdict (>= 50 full, 30-49 two fifths, < 30 none, no score full and "not checked"), half for no open
//                      duplicate page. A verdict under 50 caps fit at 40%, also after "Write it anyway"; an open duplicate caps it at 30%.
//                      The shapes of the results page are recorded (serp_shapes, Parse Analysis), no points yet
//   length 0           advice only (Google says not to aim at a word count)
// Every cap is a SHARE of its part, so a page-type weighting (Wave 2) cannot break it. Any open blocker -> total <= 59; shown as "95+" from 95.
// READY needs no blocker AND every part at or above half its maximum. Exceptions, so a page we should write is never held back:
//   * fit is waived after an explicit acknowledgement ("Write it anyway") and for pages a search score says nothing about (a page of the
//     client's keyword ladder, a case study, an AI answer page, a refresh): shown as the client's or the plan's choice, the cap kept;
//   * for runs the system started by itself (cadence, ladder, tracker), the fit floor is only recorded (shadow, owner decision D17).
// A failed floor is ADVICE in this wave: the page is "Needs work: <part>" (delivery status `needs_work`), never "Ready to publish", and
// nothing stops the client from approving and publishing it. A blocker is still the only thing that makes a page "not ready".
// The guide that ranks (production exec 949, owner priority) passes every floor: harness/scenarios_w0c.js.
// Regex and token code only (the n8n Code sandbox has no URL constructor and no-ops Object.defineProperty). No literal dash, curly quote
// or ellipsis character in this file: they are built with String.fromCharCode.
const GR = (() => {
  const VERSION = 'w0c-1';
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const r1 = (x) => Math.round(x * 10) / 10;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const CH = (...c) => String.fromCharCode(...c);
  const RE_DASH = new RegExp('\\s*[' + CH(0x2014, 0x2013) + ']\\s*', 'g'), RE_DQ = new RegExp('[' + CH(0x201C, 0x201D) + ']', 'g'), RE_SQ = new RegExp('[' + CH(0x2018, 0x2019) + ']', 'g'), RE_ELL = new RegExp(CH(0x2026), 'g');
  const clean = (s) => S(s).replace(RE_DASH, ': ').replace(RE_DQ, '"').replace(RE_SQ, "'").replace(RE_ELL, '...').replace(/:\s*:/g, ':').trim();
  const MAX = { structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 };
  const DIMS = ['structure', 'coverage', 'readability', 'specificity', 'clean_language', 'sources', 'fit'];
  const LABEL = { structure: 'structure', coverage: 'topic coverage', readability: 'readability', specificity: 'specificity', clean_language: 'plain language', sources: 'sources', fit: 'fit with the search' };
  // caps as shares of their part (REVIEW_EVIDENCE M1): verdict under 50 -> fit 40%; open duplicate -> fit 30%; a statement made 4+ times ->
  // structure 50%; a weak-only compliance figure -> sources 8 of 15
  const SHARE = { fit_verdict: 0.4, fit_duplicate: 0.3, structure_repeat: 0.5, sources_compliance: 8 / 15, weak_figure: 1 / 3, verdict_partial: 0.4, sources_none: 0.8, weak_cite: 0.5 };
  const CFG = { sim: 0.6, min_words: 4, cluster: 3, cluster_cap: 4, blocker_cap: 59, verdict_bar: 50, display_top: 95, floor: 0.5 };
  const STOP = new Set(('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them '
    + 'than then into over under more most can will does do not but any all one two also very just only such been being has have had was were each per may must should would '
    + 'could other some many much here there where while if so as up out own same both few no nor too yes use used using get gets make makes made need needs '
    + 'first second third new well like via within without across between before after because usually often typically').split(' '));
  const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const stem = (w) => { let x = w; if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|ly|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const plain = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = (t, keep) => S(t).toLowerCase().replace(RE_SQ, '').replace(/'/g, '').split(keep ? /[^\p{L}\p{N}&_]+/u : /[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const HEAD = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const BYLINE = /^[*_]+\s*(?:written by|by|reviewed by|updated)\b/i;   // the italic byline line, never a sentence that starts "By 2027, ..."
  const SKIP_SECTION = /\babout the author\b|^author\b|\bsources\b|\breferences\b|\bfurther reading\b/i;
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const SOCIAL = /(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp\.com|calendly\.com)$/;
  const maxOf = (m) => { const o = { ...MAX }; for (const k of DIMS) if (m && Number.isFinite(Number(m[k])) && Number(m[k]) >= 0) o[k] = Number(m[k]); return o; };

  // ---------- the page as sections, paragraphs, sentences, list items and table rows (head lines, byline, images, author box left out) ----------
  const units = (md0) => {
    const out = []; let section = 0, heading = '', skip = false, para = 0, qa = false;
    const lines = S(md0).replace(/\r/g, '').split('\n');
    let listId = 0, inList = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) { para++; continue; }   // a blank line between two items does not end a list (a numbered list written "1.", blank, "1.")
      if (HEAD.test(l)) continue;
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { if (h[1].length >= 2) { section++; heading = plain(h[2]); skip = SKIP_SECTION.test(heading); } para++; inList = false; out.push({ kind: 'heading', section, heading, text: plain(h[2]), level: h[1].length, line: i }); continue; }
      if (skip) continue;
      if (/^!\[/.test(l) || /^```/.test(l) || BYLINE.test(l)) continue;
      if (/^\|/.test(l)) { inList = false; if (/^\|?\s*:?-{2,}/.test(l)) continue; out.push({ kind: 'row', section, heading, para, text: l, line: i }); continue; }
      const li = l.match(/^(?:>\s*)?(?:[-*+]|\d{1,3}[.)])\s+(.*)$/);
      if (li) { if (!inList) { listId++; inList = true; } out.push({ kind: 'li', list: listId, section, heading, para, text: li[1], line: i }); continue; }
      inList = false;
      const body = l.replace(/^>\s*/, '');
      qa = /^\**\s*quick answer\b/i.test(body);
      for (const s of body.split(/(?<=[.!?]["')*_]*)\s+(?=[A-Z0-9"'(*\[])/)) if (s.trim()) out.push({ kind: 'sentence', section, heading, para, text: s.trim(), qa, line: i });
    }
    return out;
  };

  // ---------- 1. repetition: one statement made again and again ----------
  // Statements (sentences and list items under an H2 / H3, not the introduction, the Quick answer, questions, images or review notes) are
  // reduced to their content words: the keyword's and the brand's words are taken out (they are on every line of a good page) and a name
  // of several capitalised words is ONE word ("Accredited Service Provider", "Supply Chain Management"), since a product name alone says
  // nothing about WHICH point a sentence makes (without that, every sentence naming the same two products was one "cluster" on the guide
  // that ranks). Two statements in different sections with a Dice overlap of CFG.sim or more say the same thing; linked statements form a
  // cluster; a cluster of 3+ statements across 2+ sections is one point made three times. Calibrated on production pages 3299 / 3336 and
  // the guide that ranks (exec 949): none of the three has such a cluster, the pairs each page makes twice stay pairs, and one statement
  // restated in six sections is found (harness/scenarios_w0c.js). Deliberately conservative: a paraphrase is the Wave 2 judge's work.
  const repetition = (md, ctx) => {
    const c = ctx || {};
    const drop = new Set(toks([c.keyword].concat(c.brand_names || []).join(' ')).map(stem));
    const U = units(md).filter(u => (u.kind === 'sentence' || u.kind === 'li') && !u.qa && u.section > 0 && !/^\[(?:Image|Confirm|Owner)\b/i.test(u.text) && !/\?["')*_]*$/.test(u.text.trim()));
    const entity = (t) => plain(t).replace(/\b(?:The|A|An|This|That|These|Your|Our)\s+(?=[A-Z])/g, '').replace(/\b[A-Z][\w&]*(?:\s+[A-Z][\w&]*)+/g, (m) => m.replace(/\s+/g, '_'));
    const items = [];
    for (const u of U) { const set = [...new Set(toks(entity(u.text), true).map(stem).filter(w => !drop.has(w)))]; if (set.length >= CFG.min_words) items.push({ ...u, set: new Set(set), n: set.length }); }
    const parent = items.map((x, i) => i); const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const near = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.section === b.section) continue;
      let inter = 0; for (const w of a.set) if (b.set.has(w)) inter++;
      const sim = 2 * inter / (a.n + b.n);
      if (c.debug && sim >= 0.4) near.push({ sim: Math.round(sim * 100) / 100, a: plain(a.text).slice(0, 110), b: plain(b.text).slice(0, 110) });
      if (sim >= CFG.sim) { const x = find(i), y = find(j); if (x !== y) parent[x] = y; } }
    const groups = new Map();
    items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
    const clusters = [...groups.values()].filter(g => g.length >= CFG.cluster && new Set(g.map(x => x.section)).size >= 2)
      .map(g => ({ size: g.length, sections_n: new Set(g.map(x => x.section)).size, sections: [...new Set(g.map(x => x.heading))].slice(0, 8),
        sample: plain(g[0].text).slice(0, 160), members: g.slice(0, 8).map(x => plain(x.text).slice(0, 140)) })).sort((a, b) => b.size - a.size);
    return { clusters, count: clusters.length, worst: clusters.length ? clusters[0].size : 0, compared: items.length, ...(c.debug ? { near: near.sort((x, y) => y.sim - x.sim).slice(0, 25) } : {}) };
  };

  // ---------- 2. one label for two different lists ("five questions" before two lists, then "use the five questions") ----------
  const listLabels = (md) => {
    const U = units(md); const LBL = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+([a-z]{3,})\b/i;
    const norm = (m) => (NUMW[m[1].toLowerCase()] || Number(m[1])) + ' ' + stem(m[2].toLowerCase());
    const leads = new Map();
    for (let i = 0; i < U.length; i++) {
      const u = U[i]; if (u.kind !== 'li') continue; if (i > 0 && U[i - 1].kind === 'li' && U[i - 1].list === u.list) continue;   // the first item of a list
      const lead = i > 0 && (U[i - 1].kind === 'sentence' || U[i - 1].kind === 'heading') ? U[i - 1] : null;   // the line right before it
      const m = lead ? plain(lead.text).match(LBL) : null; if (!m) continue;
      const k = norm(m); if (!leads.has(k)) leads.set(k, { lists: new Set(), text: plain(lead.text).slice(0, 120) }); leads.get(k).lists.add(u.list); }
    const collisions = [...leads.entries()].filter(([, v]) => v.lists.size >= 2).map(([label, v]) => ({ label, lists: v.lists.size, lead: v.text }));
    return { collisions, count: collisions.length };
  };

  // ---------- 3. sources: what the cited sentences and the figures rest on ----------
  // A unit is a sentence, list item or table row that cites an outside page, names its source ("according to ..."), or carries a figure.
  // Strong: it links an official body, a research house, major press or vendor documentation (`opts.tier` = Content QA's SRC.tier: anything
  // but 'weak'), or names an official body or one of those houses; a figure with no link of its own takes its paragraph's citation. A figure
  // the business states about itself (on file: `own_text`), a year, or a standard's or a law's number is not a sourcing question. The
  // client's own pages and social profiles are not citations.
  const OFFICIAL = /\b(?:ministry|authority|federal|government|central bank|commission|council|agency|department|bureau|regulator|parliament|court|statistics|census|united nations|world bank|oecd|imf|european union|eurostat)\b/i;
  const ATTR = /\b(?:according to|as reported by|reported by|research (?:by|from)|(?:a|the) (?:study|survey|report|analysis) (?:by|from))\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})/;
  const ATTR_FIG = /\b(?:data from|figures from)\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})|\b((?:the\s+)?[A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})(?:'s)?\s+(?:found|finds|reports?|reported|estimates?|estimated|states?|stated|counts?|counted)\b/;
  const FIG_TOPIC = /\bmarket|\bshare\b|\bindustr|\brevenue|\bvalued?\b|\bworth\b|\bcagr\b|\bgrow|\bsize\b|\bforecast|\bspend|\bcompan(?:y|ies)\b|\bbusinesses\b|\borgani[sz]ations?\b|\bfirms?\b|\benterprises?\b|\bcustomers?\b|\busers?\b|\bclients?\b|\bsmes?\b|\badopt|\buse[sd]?\b|\busing\b|\bdeploy|\bimplement|\bcost|\bprice|\bpricing|\bfees?\b|\bbudget|\bsav(?:e|es|ed|ing|ings)\b|\broi\b|\binvest|\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const COMPLIANCE = /\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const STD = /\b(?:ISO|IEC|EN|BS|SOC|PCI|IAS|IFRS|ASC|Article|Section|Law|Decree|No\.?|Resolution|Circular|Decision)\s?(?:\/IEC)?$/i;
  // H1 (WAVE0_REVIEW 2026-10-30): where a page states how to reach the business, its digits are contact details. BEFORE run K6 (the page
  // both judges rated best) had one source unit, the last four digits of the phone number in its call to action, and graded sources 0 of 15:
  // "Needs work: sources" on a guide that cites nothing it needs to. Every Local page carries a NAP block (v4.4), so every one would have.
  // The spans below are phone numbers (an international prefix, or a phone word before a run of 7+ digits with separators or a leading 0),
  // opening hours (0900-1800), a PO box / postcode / ZIP, and a street, office, suite, floor or building number. A figure inside one is
  // not a sourcing question ("P.O. Box 123456" is cut into two sentences at "P.O.", so a capital "Box" with its number counts alone, as does a
  // number in the local form 0X XXX XXXX). Each match must hold enough digits to be what it says (a phone 7+), so "call 1,200 customers" stays a figure.
  const NAP_RES = [
    [/(?:\+|\b00)\d{1,4}[\s.\-]?(?:\(\d{1,4}\)[\s.\-]?)?(?:\d{1,5}[\s.\-]?){1,5}\d{1,5}\b/g, 8],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?(?:\(\d{1,5}\)\s?|\b0)\d[\d\s.\-]{4,}\d/gi, 7],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?\b\d{2,5}(?:[\s.\-]\d{2,5}){1,4}\b/gi, 7],
    [/\(\+?\d{1,5}\)\s?\d[\d\s.\-]{4,}\d/g, 7],
    [/\b0\d{1,3}[\s.\-]\d{3,4}[\s.\-]?\d{3,4}\b/g, 8],
    [/\bBox\s*[:#]?\s*\d[\d\-]{1,10}/g, 3],
    [/\b(?:open(?:ing)?|hours|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[^\n.]{0,40}?\b(?:[01]\d|2[0-3])[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b0\d[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b(?:p\.?\s?o\.?\s?box|post\s?box|postcode|post(?:al)?\s?code|zip(?:\s?code)?|pin\s?code)\s*[:#.]?\s*[A-Z]{0,2}\d[\d\s\-]{1,10}/gi, 2],
    [/,\s*[A-Z]{2}\s\d{5}(?:-\d{4})?\b/g, 5],
    [/\b(?:Office|Suite|Unit|Floor|Level|Building|Bldg|Tower|Villa|Shop|Flat|Apartment|Apt|Room|Plot|Block|Warehouse|Street|Road|Avenue)\s*(?:No\.?|Number|#)?\s*\d{1,6}[A-Za-z]?\b(?![,.]\d)/g, 1],
    [/\b\d{1,6}[A-Za-z]?,?\s+(?:[A-Z][\w'\-]*\s+){0,4}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Highway|Hwy|Square)(?=[\s,.;]|$)/g, 1]
  ];
  const napSpans = (t) => { const out = []; const s = S(t);
    for (const [re, minDigits] of NAP_RES) for (const m of s.matchAll(re)) if ((m[0].match(/\d/g) || []).length >= minDigits) out.push([m.index, m.index + m[0].length]);
    return out; };
  const strongName = (name, tier) => { const n = S(name).replace(/^the\s+/i, '').replace(/[.,;:]+$/, '').trim(); if (!n) return false; if (OFFICIAL.test(n)) return true;
    if (typeof tier !== 'function') return false; const sq = n.toLowerCase().replace(/'s$/, '').replace(/[^a-z0-9]+/g, ''); return sq.length >= 2 && tier('https://' + sq + '.com/') !== 'weak'; };
  const sources = (md, ctx, opts) => {
    const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max); const tier = typeof o.tier === 'function' ? o.tier : null; const figs = typeof o.figures === 'function' ? o.figures : null;
    const d = S(c.domain).toLowerCase().replace(/^www\./, ''); const own = (h) => !!d && (h === d || h.endsWith('.' + d));
    const ownText = S(c.own_text).toLowerCase();
    const U = units(md).filter(u => u.kind !== 'heading' && !u.qa);
    const linkTier = (u) => { const h = hostOf(u); if (!h || own(h) || SOCIAL.test(h)) return null; return tier ? tier(u) : 'weak'; };
    const linksOf = (t) => [...S(t).matchAll(/\[([^\[\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map(m => ({ url: m[2], tier: linkTier(m[2]) })).filter(x => x.tier);
    const paraLinks = new Map(); for (const u of U) { const k = u.section + ':' + u.para; const ls = linksOf(u.text); if (ls.length) paraLinks.set(k, (paraLinks.get(k) || []).concat(ls)); }
    // H1: the client's own phone and address on file (own_text: Content QA adds the profile's and the site model's NAP) are theirs in any
    // spelling: the run of digits a figure sits in (spaces, dots, dashes and brackets between them) equals one on file, or the two share
    // their last 7 digits (a number written with and without its country code or trunk 0)
    const ownRuns = [...S(c.own_text).matchAll(/\+?\d[\d\s.()\-]{2,}\d/g)].map(m => m[0].replace(/\D+/g, '')).filter(x => x.length >= 4);
    const runAt = (p, x) => { let a = x.index, b = x.index + S(x.raw).length; while (a > 0 && /[\d\s.()+\-]/.test(p[a - 1])) a--; while (b < p.length && /[\d\s.()\-]/.test(p[b])) b++; return p.slice(a, b).replace(/\D+/g, ''); };
    const ownNum = (p, x) => { if (!ownRuns.length) return false; const dg = runAt(p, x); return dg.length >= 4 && ownRuns.some(o => o === dg || (o.length >= 7 && dg.length >= 7 && o.slice(-7) === dg.slice(-7))); };
    const figureIn = (p) => { if (!figs) return null; const nap = napSpans(p);
      const f = (figs(p) || []).filter(x => x && !x.year && !STD.test(p.slice(Math.max(0, x.index - 16), x.index).trim())
        && !nap.some(([a, b]) => x.index >= a && x.index < b));
      const left = f.filter(x => !(ownText && ownText.includes(S(x.raw).toLowerCase())) && !ownNum(p, x)); return left.length ? left[0] : null; };
    const list = []; let strong = 0, weakOnly = 0, weakCompliance = 0, weakCited = 0, unsourced = 0;
    for (const u of U) {
      const text = plain(u.text); if (!text) continue;
      const links = linksOf(u.text); const fig = figureIn(text);
      const am = text.match(ATTR) || (fig ? text.match(ATTR_FIG) : null); const named = am ? S(am[1] || am[2]) : '';
      if (!links.length && !fig && !named) continue;
      const ls = links.length ? links : (fig ? paraLinks.get(u.section + ':' + u.para) || [] : []);
      const isStrong = ls.some(x => x.tier !== 'weak') || (!!named && strongName(named, tier));
      const onlyWeak = !isStrong && ls.length > 0 && ls.every(x => x.tier === 'weak');
      const unit = { text: text.slice(0, 200), strong: isStrong, figure: fig ? S(fig.raw) : '', named: named.slice(0, 80), weak_only: false, compliance: false };
      if (fig && onlyWeak && FIG_TOPIC.test(text)) { unit.weak_only = true; weakOnly++; if (COMPLIANCE.test(text)) { unit.compliance = true; weakCompliance++; } }
      // M2: a sentence that rests on a weak source (no market / cost / compliance figure of its own) is cited, only not by an authority: half a
      // strong one. A figure resting on nothing at all is unsourced: no credit.
      else if (!isStrong && (ls.length || named)) { unit.weak_cite = true; weakCited++; }
      else if (!isStrong && fig) { unit.unsourced = true; unsourced++; }
      if (isStrong) strong++;
      list.push(unit);
    }
    const n = list.length; const none = M.sources * SHARE.sources_none;
    if (!n) return { units: 0, strong: 0, share: null, weak_only: 0, weak_compliance: 0, weak_cited: 0, unsourced: 0, points: r1(none), capped: false, not_checked: true,
      note: 'Sources not checked: the page cites no outside page and states no figure that needs one (4 of 5 of the part: citing an official body, a research house, major press or vendor documentation earns the rest)', list: [] };
    const share = strong / n;
    // the half credit holds while no market, cost or compliance figure rests only on a weak source: on a page that leans on weak sources for
    // its figures (3336, the expert's 63), its other weak citations are the same problem and earn nothing (PLAN 5.2 pin 2 stays <= 72)
    const half = weakOnly ? 0 : SHARE.weak_cite;
    let pts = clamp(M.sources * (strong + half * weakCited) / n - M.sources * SHARE.weak_figure * weakOnly, 0, M.sources); let capped = false; let floored = false;
    // M2: citing only weak pages is never worse than citing nothing, while no figure on the page is unsourced or weak-only (those cost the share)
    if (!weakOnly && !unsourced && pts < none) { pts = none; floored = true; }
    if (weakCompliance && pts > M.sources * SHARE.sources_compliance) { pts = M.sources * SHARE.sources_compliance; capped = true; }
    return { units: n, strong, share: Math.round(share * 100), weak_only: weakOnly, weak_compliance: weakCompliance, weak_cited: weakCited, unsourced, points: r1(pts), capped, floored,
      note: strong + ' of the ' + n + ' cited sentences and figures rest on an official body, a research house, major press or vendor documentation'
        + (weakCited ? '; ' + weakCited + ' cite' + (weakCited === 1 ? 's' : '') + ' a page with no independent authority (' + (half ? 'half credit' : 'no credit while a figure rests only on such a page') + (floored ? ', and never less than citing nothing' : '') + ')' : '')
        + (unsourced ? '; ' + unsourced + ' figure' + (unsourced === 1 ? ' has' : 's have') + ' no source' : '')
        + (weakOnly ? '; ' + weakOnly + ' market, cost or compliance figure' + (weakOnly === 1 ? ' rests' : 's rest') + ' only on a source with no independent authority' : ''),
      list: list.filter(x => !x.strong).slice(0, 8) };
  };

  // ---------- 4. fit with the search: the verdict, and the page the website already has ----------
  // fitOf(prev): from a content run's Parse Brief item (verdict_score, verdict_acknowledged, hold_exempt / the page's own fields) or from the
  // Finalize brief (prc.gating: score, verdict, verdict_acknowledged). A withheld or missing score is null: "not checked", full points.
  const fitOf = (prev) => {
    const p = prev || {}; const g = ((p.prc || {}).gating) || {};
    const withheld = p.score_withheld === true || g.score_withheld === true || /^NOT_CHECKED$/i.test(S(p.verdict || g.verdict));
    const score = withheld ? null : (num(p.verdict_score) != null ? num(p.verdict_score) : num(g.score));
    const ack = p.verdict_acknowledged === true || g.verdict_acknowledged === true || !!(p.hold_ack && typeof p.hold_ack === 'object');
    const ex0 = S(p.hold_exempt).match(/score:\s*([^;]+)/);
    const ladder = !!S(p.ladder_id) && p.ladder_rung != null && p.ladder_rung !== '';
    const caseStudy = !!S(p.case_id) || S(p.page_role) === 'case_study' || /case stud/i.test(S(p.page_type));
    const aiPage = !!(p.ai_target && typeof p.ai_target === 'object' && S(p.ai_target.question));
    const refresh = !!S(p.existing_page_url);
    const exempt = ex0 ? ex0[1].trim() : caseStudy ? 'a case study: its keyword is the case name' : aiPage ? 'a page written to be cited in AI answers'
      : refresh ? 'a refresh of a page your website already has' : ladder ? 'a page of your keyword ladder: the ladder checked its main keyword when it was planned' : '';
    const automatic = /^(cadence|ladder|tracker|casestudy|audit):/i.test(S(p.client_ip));
    return { verdict_score: score, withheld, acknowledged: ack, exempt, automatic };
  };
  const fit = (f0, dup, max) => {
    const f = f0 || {}; const sc = num(f.verdict_score); const D = dup || {}; const M = Number.isFinite(Number(max)) ? Number(max) : MAX.fit; const half = M / 2;
    const vp = sc == null || sc >= CFG.verdict_bar ? half : sc >= 30 ? half * SHARE.verdict_partial : 0;
    const dp = D.open || D.differs ? 0 : half;
    let pts = vp + dp; const caps = [];
    if (sc != null && sc < CFG.verdict_bar && pts > M * SHARE.fit_verdict) { pts = M * SHARE.fit_verdict; caps.push({ dim: 'fit', share: SHARE.fit_verdict, why: 'our verdict scored this search ' + sc + ' out of 100, under ' + CFG.verdict_bar }); }
    if ((D.open || D.differs) && pts > M * SHARE.fit_duplicate) { pts = M * SHARE.fit_duplicate; caps.push({ dim: 'fit', share: SHARE.fit_duplicate, why: D.open ? 'your website already has a page for this search' : 'published beside the page your website has for this search' }); }
    const band = sc == null ? 'not_checked' : sc >= CFG.verdict_bar ? 'full' : sc >= 30 ? 'partial' : 'none';
    const note = sc == null ? 'Fit not checked: ' + (f.withheld ? 'the verdict could not score this search' : 'no verdict score was kept with this page') + ', so fit takes its full points'
      : 'Our verdict scored this search ' + sc + ' out of 100' + (sc < CFG.verdict_bar ? (f.acknowledged ? ', and you chose to write it anyway' : f.exempt ? ' (' + f.exempt + ')' : '') : '');
    return { points: r1(pts), verdict_points: r1(vp), duplicate_points: r1(dp), band, caps, note };
  };

  // ---------- 5. the page-local grade (Content QA) ----------
  // parts: what Content QA already measures, as fractions or on their old scales: structure_frac (0-1), coverage_ratio (0-1),
  // readability_pts (of 15), specificity_pts (of 10), clean_pts (of 10). ctx: keyword, brand_names, domain, own_text, prev (the brief item).
  // opts: tier / figures (Content QA's SRC kit), max (a page-type weighting; the default is MAX).
  const local = (parts, md, ctx, opts) => {
    const P = parts || {}; const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max);
    const rep = repetition(md, c); const lab = listLabels(md); const src = sources(md, c, { ...o, max: M }); const F = fitOf(c.prev || {}); const fi = fit(F, null, M.fit);
    const caps = fi.caps.slice();
    let structure = clamp(M.structure * clamp(Number(P.structure_frac) || 0, 0, 1) - Math.min(8, 3 * rep.count) * M.structure / 20 - Math.min(4, 2 * lab.count) * M.structure / 20, 0, M.structure);
    if (rep.worst >= CFG.cluster_cap && structure > M.structure * SHARE.structure_repeat) { structure = M.structure * SHARE.structure_repeat; caps.push({ dim: 'structure', share: SHARE.structure_repeat, why: 'one statement is made ' + rep.worst + ' times' }); }
    if (src.capped) caps.push({ dim: 'sources', share: SHARE.sources_compliance, why: 'a compliance figure rests only on a source with no independent authority' });
    const raw = { structure, coverage: M.coverage * clamp(Number(P.coverage_ratio) || 0, 0, 1), readability: M.readability * clamp((Number(P.readability_pts) || 0) / 15, 0, 1),
      specificity: M.specificity * clamp((Number(P.specificity_pts) || 0) / 10, 0, 1), clean_language: M.clean_language * clamp((Number(P.clean_pts) || 0) / 10, 0, 1), sources: src.points, fit: fi.points, length: 0 };
    const breakdown = {}; for (const k of Object.keys(raw)) breakdown[k] = Math.round(raw[k]);
    const notes = [fi.note, src.note, 'Length is advice only: it carries no points'];
    if (rep.count) notes.push(rep.count + ' statement' + (rep.count === 1 ? ' is' : 's are') + ' made three or more times: ' + rep.clusters.slice(0, 3).map(x => '"' + x.sample + '" (' + x.size + ' times)').join('; '));
    if (lab.count) notes.push('The same label introduces two different lists: ' + lab.collisions.map(x => '"' + x.lead + '"').join(', '));
    return { version: VERSION, score: DIMS.reduce((s, k) => s + breakdown[k], 0), of: 100, breakdown, max: M, caps,
      items: { repetition: { count: rep.count, worst: rep.worst, clusters: rep.clusters.slice(0, 5) }, list_labels: lab.collisions,
        sources: { units: src.units, strong: src.strong, share: src.share, weak_only: src.weak_only, weak_compliance: src.weak_compliance, weak_cited: src.weak_cited, unsourced: src.unsourced, not_checked: !!src.not_checked, weak: src.list },
        fit: { verdict_score: F.verdict_score, band: fi.band, acknowledged: F.acknowledged, exempt: F.exempt, automatic: F.automatic, verdict_points: fi.verdict_points, duplicate_points: fi.duplicate_points } },
      notes: notes.map(clean) };
  };

  // ---------- 6. the delivered grade: blockers, the duplicate page, the floors (Page Candidates, Finalize Verdict, Apply Second Read) ----------
  // grade0: the grade object those nodes build (score / breakdown from Content QA's content_score / score_breakdown; `w0c` = Content QA's
  // grade_detail). blocking: the delivered blocking items ({ code }). o.decision: the client's duplicate-page decision (W0-B, D2).
  // A grade without `w0c` (a check from before this kit) is returned as it was, with its display.
  const cap = (grade0, blocking, o0) => {
    const g = { ...(grade0 || {}) }; const o = o0 || {}; const W = g.w0c || o.w0c || null;
    if (!W || !g.breakdown || g.score == null) return { ...g, display: display(g.score) };
    const M = maxOf(W.max); const b = { ...g.breakdown }; const caps = (W.caps || []).slice(); const F = (W.items || {}).fit || {};
    const codes = (blocking || []).map(x => S(x && x.code)).filter(Boolean);
    const dupOpen = codes.includes('duplicate_page'); const differs = !!(o.decision && o.decision.choice === 'differs');
    if (dupOpen || differs) { const fi = fit(F, { open: dupOpen, differs }, M.fit); for (const x of fi.caps) if (!caps.some(y => y.dim === x.dim && y.share === x.share)) caps.push(x); b.fit = Math.round(fi.points); }
    let total = DIMS.reduce((s, k) => s + (Number(b[k]) || 0), 0);
    if (codes.length && total > CFG.blocker_cap) { total = CFG.blocker_cap; caps.push({ dim: 'total', to: CFG.blocker_cap, why: codes.length + ' point' + (codes.length === 1 ? '' : 's') + ' still stop' + (codes.length === 1 ? 's' : '') + ' this page' }); }
    const failing = [], waived = [], shadow = [];
    for (const k of DIMS) {
      if (!M[k] || (Number(b[k]) || 0) >= M[k] * CFG.floor) continue;
      if (k === 'fit' && !dupOpen && !differs && (F.acknowledged || F.exempt)) { waived.push({ dim: k, why: F.acknowledged ? 'your choice: low search demand (you chose to write it anyway)' : 'chosen by your plan: ' + F.exempt }); continue; }
      if (k === 'fit' && !dupOpen && !differs && F.automatic) { shadow.push({ dim: k, why: 'started automatically: recorded, not applied yet' }); continue; }
      failing.push({ dim: k, label: LABEL[k], points: Number(b[k]) || 0, max: M[k], fix: clean(FIX[k](W)) });
    }
    const score = Math.round(total);
    return { ...g, score, display: display(score), breakdown: b, max: M, scale: VERSION, caps,
      floors: { ok: failing.length === 0, failing, waived, shadow, rule: 'Ready needs no open blocker and every part at or above half its points' },
      ready: codes.length === 0 && failing.length === 0 };
  };
  const FIX = {
    structure: (W) => { const r = ((W.items || {}).repetition || {}); const l = (W.items || {}).list_labels || [];
      return r.count ? 'Say each point once: "' + S((r.clusters || [])[0] && r.clusters[0].sample).slice(0, 90) + '" is made ' + r.worst + ' times'
        : l.length ? 'Give each list its own label: "' + S(l[0].lead).slice(0, 90) + '" introduces two lists' : 'Give the page its headings, Quick answer, table and links back'; },
    coverage: () => 'Cover the topics the pages that rank cover (the missing terms are in the advice)',
    readability: () => 'Use shorter sentences and plainer words',
    specificity: () => 'Add concrete examples, steps or decision rules in place of general statements',
    clean_language: () => 'Rewrite the filler phrases listed in the advice in plain, specific words',
    sources: (W) => { const s = ((W.items || {}).sources || {}); return 'Cite an official body, a research house, major press or vendor documentation'
      + ((s.weak || []).length ? ' for "' + S(s.weak[0].text).slice(0, 90) + '"' + (s.weak.length > 1 ? ' and ' + (s.weak.length - 1) + ' more' : '') : ''); },
    fit: (W) => { const f = ((W.items || {}).fit || {}); return f.verdict_score != null && f.verdict_score < CFG.verdict_bar ? 'Our verdict scored this search ' + f.verdict_score + ' out of 100: improve a page your website already has, or choose "Write it anyway" to keep this one' : 'Publish this text as an update of the page your website has for this search'; }
  };
  // the delivered status: a page with no blocker that fails a floor is "Needs work: <parts>", never "Ready to publish". It stays publishable
  // (nothing stops the client): the status and label change, the items say what to improve, and a not-ready page is left as it is.
  const deliver = (del0, grade) => {
    const del = { ...(del0 || {}) }; const fl = (grade || {}).floors || null;
    if (!fl || fl.ok || del.status === 'not_ready') return del;
    const parts = fl.failing.map(x => x.label);
    return { ...del, status: 'needs_work', label: clean('Needs work: ' + parts.join(', ')),
      needs_work: fl.failing.map(x => ({ code: 'needs_work', dim: x.dim, text: clean(x.label.charAt(0).toUpperCase() + x.label.slice(1) + ' scored ' + x.points + ' of ' + x.max + ', under half its points'), action: x.fix })),
      next_step: clean('Nothing stops you publishing this page, but ' + (parts.length === 1 ? 'one part is' : parts.length + ' parts are') + ' under half marks (' + parts.join(', ') + '). '
        + fl.failing.map(x => x.fix.replace(/[.\s]+$/, '')).join('. ') + '. Change it in the editor and make the final version, or approve it as it is.') };
  };
  const display = (n) => n == null || n === '' || !Number.isFinite(Number(n)) ? '' : Math.round(Number(n)) >= CFG.display_top ? CFG.display_top + '+' : String(Math.round(Number(n)));
  const basis = 'structure 20 (a statement made three or more times and one label for two lists cost points), topic coverage 15, readability 10, specificity 10, plain language 10, sources 15, fit with the search 20; length is advice only';
  return { VERSION, MAX, DIMS, LABEL, SHARE, CFG, units, repetition, listLabels, sources, fitOf, fit, local, cap, deliver, display, basis };
})();
