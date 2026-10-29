// ---- CK: is a model's answer complete? (LLM-LIMITS, 2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md) ----
// Production (techand.ai, execution 2195): the Editor's answer stopped mid-word ("Does the add-on cover gratu") when the model reached
// its max_tokens ceiling; n8n hands a stream cut that way on as a success (the stop reason is dropped, the agent outputs only `output`),
// so the run replaced a complete 1,804-word page with 749 words and delivered half a page. Nothing in the answer says it was cut, so this
// kit reads the answer itself, deterministically:
//   CK.text(md)            a long text (page, brief, e-mail, report) ends cleanly: not mid-word / mid-sentence, markdown balanced,
//                          no unfinished list item, table row or code block, no heading left without its text.
//   CK.edit(before, after) an edit of a complete text is itself complete AND did not lose the end: under 75% of the input's main-text
//                          words (40% when the edit was asked to cut) or two of its sections gone is a cut, not an edit.
//   CK.json(raw)           a JSON answer parses completely; an answer that stops inside its JSON is `truncated`, never an empty answer.
//   CK.answer(item, kind)  one agent item (n8n `{ output }`, or `{ error }` after its retry) -> { complete, truncated, reason }.
// Pure: no clock, no network, no n8n globals, so the harness replays it. Every `reason` is plain words a customer can read.
const CK = (() => {
  const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
  const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords|URL|Page Type)\s*:/i;
  const LIST = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
  const QUESTION_START = /^(?:\*\*[^*]{1,80}\*\*\s*:?\s*)?(?:does|do|did|is|are|was|were|can|could|will|would|should|shall|what|which|how|who|whom|whose|why|when|where|have|has)\b/i;
  const DANGLING = /\b(?:and|or|but|nor|the|a|an|of|to|for|with|in|on|at|by|from|that|which|who|is|are|was|were|be|as|than|then|if|so|such|into|onto|about|your|our|their|its|this|these|those|e\.g|i\.e)$/i;
  const SIGN_OFF = /^(?:best|kind|warm|many thanks|thanks|thank you|regards|cheers|sincerely|all the best|best wishes|with thanks)\b[^.!?]{0,30}[,.!]?$/i;
  const END_PUNCT = /[.!?]["'”’)\]*_]*$/;
  // a link, an address, or a bracketed call to action / field at the very end ("[Book my free call] · [Message us on WhatsApp]",
  // "[Credentials and years of experience]"): a cut answer almost never stops exactly on a closing bracket, so these end cleanly
  const LINK_END = /\]\([^()\s]*\)[*_]*[.!?]?$|<https?:\/\/[^>\s]+>$|^https?:\/\/\S+$|\][*_]*$/;
  const isTableRow = (l) => /^\s*\|/.test(l);
  const cells = (l) => String(l).trim().replace(/^\|/, '').replace(/\|$/, '').split('|').length;
  const unbalanced = (t) => {
    const s = String(t || '').replace(/`[^`]*`/g, '');
    const bold = (s.match(/\*\*/g) || []).length;
    if (bold % 2) return 'a bold phrase is not closed';
    const open = (s.match(/\[/g) || []).length, close = (s.match(/\]/g) || []).length;
    if (open > close) return 'a link or bracket is not closed';
    const lp = (s.match(/\]\(/g) || []).length, lpc = (s.match(/\]\([^()\s]*\)/g) || []).length;
    if (lp > lpc) return 'a link address is not closed';
    return '';
  };

  // the body without the meta lines the writers put at the top, trailing blanks dropped
  const bodyLines = (md) => {
    const lines = String(md == null ? '' : md).replace(/\r/g, '').split('\n');
    let i = 0; while (i < lines.length && (META.test(lines[i].trim()) || !lines[i].trim())) i++;
    const out = lines.slice(i); while (out.length && !out[out.length - 1].trim()) out.pop();
    return out;
  };

  // "Best regards," / "Thanks," then one or two short lines (the name, a title or company line): an e-mail that ends cleanly
  const signedOff = (lines) => { for (const k of [2, 3]) { if (lines.length < k) continue; const head = lines[lines.length - k].trim();
    if (!(SIGN_OFF.test(head) || (/,$/.test(head) && words(head) <= 4))) continue;
    if (lines.slice(lines.length - k + 1).every(l => l.trim() && words(l) <= 7 && !/[.!?]$/.test(l.trim()) && !LIST.test(l))) return true; }
    return false; };
  // the contiguous list block that ends at index `end`
  const listBlock = (lines, end) => { const out = []; for (let i = end; i >= 0 && LIST.test(lines[i]); i--) out.unshift(lines[i]); return out; };

  const text = (md, opts) => {
    const o = opts || {};
    const minWords = o.min_words == null ? 0 : Number(o.min_words);
    const lines = bodyLines(md);
    const reasons = [];
    const body = lines.join('\n');
    const n = words(body);
    if (!n) return { complete: false, cut_off: true, empty: true, words: 0, last_line: '', reasons: ['the answer is empty'] };
    if (minWords && n < minWords) reasons.push('the answer has ' + n + ' words, far below the ' + minWords + ' expected');
    const fences = lines.filter(l => /^\s*(```|~~~)/.test(l)).length;
    if (fences % 2) reasons.push('a code block is not closed');
    const last = lines[lines.length - 1].trim();
    const lastPlain = last.replace(/[*_`]+$/g, '').trim();
    if (/^#{1,6}\s/.test(last)) reasons.push('the last heading has no text under it');
    else if (isTableRow(last)) {
      let h = lines.length - 1; while (h > 0 && isTableRow(lines[h - 1])) h--;
      const want = cells(lines[h]);
      if (!/\|\s*$/.test(last)) reasons.push('the last table row is cut off');
      else if (cells(last) < want) reasons.push('the last table row has ' + cells(last) + ' of its ' + want + ' cells');
    } else if (/^\s*(```|~~~)\s*$/.test(last)) {
      // a closed code block: complete as far as this line goes
    } else if (/^!\[[^\]]*\]\([^()\s]+\)$/.test(last) || /^\[[^\]]+\]\([^()\s]+\)$/.test(lastPlain.replace(/^[*_]+/, ''))) {
      // an image or a link on its own line (a call to action): complete
    } else if (LIST.test(last)) {
      const item = last.replace(LIST, '').trim();
      const itemPlain = item.replace(/[*_`]+$/g, '').trim();
      const ub = unbalanced(item);
      if (ub) reasons.push('the last list item stops mid-way (' + ub + ')');
      else if (!END_PUNCT.test(itemPlain) && !LINK_END.test(itemPlain)) {
        const sib = listBlock(lines, lines.length - 2).map(l => l.replace(LIST, '').replace(/[*_`]+$/g, '').trim());
        const punct = sib.filter(s => END_PUNCT.test(s) || LINK_END.test(s)).length;
        if (QUESTION_START.test(itemPlain)) reasons.push('the last list item is a question that stops before its end');
        else if (DANGLING.test(itemPlain) || /[,:;–—-]$/.test(itemPlain)) reasons.push('the last list item stops mid-sentence');
        else if ((sib.length >= 2 && punct / sib.length >= 0.6) || (sib.length >= 1 && punct === sib.length)) reasons.push('the last list item stops mid-sentence (the items before it end with a full stop)');
      }
    } else if (signedOff(lines)) {
      // an e-mail's sign-off: "Best regards," then the sender's name (and a title / company line under it)
    } else {
      const ub = unbalanced(last);
      if (ub) reasons.push('the last paragraph stops mid-way (' + ub + ')');
      else if (!END_PUNCT.test(lastPlain) && !LINK_END.test(lastPlain)) reasons.push(/[,:;–—-]$/.test(lastPlain) || DANGLING.test(lastPlain)
        ? 'the last sentence stops mid-way' : 'the last sentence has no ending (it stops mid-word or mid-sentence)');
    }
    const cut_off = reasons.length > 0;
    return { complete: !cut_off, cut_off, empty: false, words: n, last_line: last.slice(-160), reasons };
  };

  const MAIN_STOP = /^#{1,3}\s+(?:faq|frequently asked questions|sources|references)\b/i;
  const mainWords = (md) => { const ls = bodyLines(md); const k = ls.findIndex(l => MAIN_STOP.test(l.trim())); return words((k >= 0 ? ls.slice(0, k) : ls).join('\n')); };
  const h2s = (md) => bodyLines(md).filter(l => /^##\s/.test(l)).map(l => l.replace(/^##\s+/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());

  const edit = (before, after, opts) => {
    const o = opts || {};
    const t = text(after);
    const reasons = t.reasons.slice();
    const wb = mainWords(before), wa = mainWords(after);
    const floor = o.cut_requested ? 0.4 : 0.75;
    if (wb >= 200 && wa < wb * floor) reasons.push('the edited page has ' + wa + ' words of main text where the page it was given had ' + wb
      + (o.cut_requested ? ' (a cut was asked for, but not this much)' : ' and no cut was asked for'));
    const hb = h2s(before), ha = new Set(h2s(after));
    const lost = hb.filter(h => !ha.has(h));
    if (hb.length >= 3 && hb.length - h2s(after).length >= 2 && wa < wb * 0.9) {
      const tail = lost.filter(h => hb.indexOf(h) >= hb.length - lost.length);
      reasons.push('the edited page stops before ' + (tail.length || lost.length) + ' of the sections the page it was given had');
    }
    const cut_off = reasons.length > 0;
    return { complete: !cut_off, cut_off, words_before: wb, words_after: wa, last_line: t.last_line, reasons };
  };

  // JSON: complete when it parses; `truncated` when it stops inside a string, an object or an array (the end of the answer was cut)
  const json = (raw) => {
    if (raw && typeof raw === 'object') return { complete: true, truncated: false, value: raw, reason: '' };
    const s0 = String(raw == null ? '' : raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!s0) return { complete: false, truncated: false, value: null, reason: 'the answer is empty' };
    try { return { complete: true, truncated: false, value: JSON.parse(s0), reason: '' }; } catch (e) {}
    const a = s0.search(/[{[]/);
    if (a < 0) return { complete: false, truncated: false, value: null, reason: 'the answer holds no JSON' };
    const s = s0.slice(a);
    let depth = 0, inStr = false, esc = false, closedAt = -1;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { closedAt = i; break; } }
    }
    if (closedAt < 0) return { complete: false, truncated: true, value: null, reason: 'the answer stops before its JSON is complete (cut off at the end)' };
    try { return { complete: true, truncated: false, value: JSON.parse(s.slice(0, closedAt + 1)), reason: '' }; }
    catch (e) { return { complete: false, truncated: false, value: null, reason: 'the answer is not valid JSON' }; }
  };

  // one agent item: n8n's structured parser hands an object; a parser that refused the text (twice: retryOnFail) leaves `{ error }`
  const answer = (item, kind) => {
    const j = (item && item.json) || item || {};
    if (j.error) {
      const m = String((j.error && j.error.message) || j.error);
      const trunc = /unterminated|unexpected end|end of (?:json|data)|max_tokens|cut off|incomplete/i.test(m);
      return { complete: false, truncated: trunc, reason: trunc ? 'the answer was cut off before its end, also after one retry' : 'the answer could not be read, also after one retry' };
    }
    if (kind === 'text') { const t = text(j.output); return { complete: t.complete, truncated: t.cut_off && !t.empty, reason: t.reasons.join('; ') }; }
    const r = json(j.output);
    return { complete: r.complete, truncated: r.truncated, reason: r.reason };
  };

  return { text, edit, json, answer, words, mainWords, bodyLines };
})();
// ---- PF: the page pipeline's one contract, its one score and its fixes (H1, 2026-10-27; inlined through the PAGE_FIX marker) ----
// docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md: the four production page runs (949, 2195, 2552, 2575) all came out "not ready
// to publish". One full-page Editor pass with no safety net made 3 of the 4 pages worse (two cut off, one regressed on keyword, coverage,
// claims and links), the Brief, the Copywriter, the Critic, the Editor and the quality check each held a different length / bracket /
// claim rule, every warning blocked, and the PDF printed the Critic's grade of the FIRST draft. R2_MARKET_RESEARCH.md: no leading tool
// blocks on SEO metrics; facts, trust and legal problems are what block. This kit is the one place those rules live:
//   PF.contract(prev)          the contract every writer prompt prints (length as a band, no brackets, the claim rule, page-type targets)
//   PF.split / PF.join         a page as its head (meta lines) + sections (s0 = H1 and introduction, s1.. = each H2); lossless
//   PF.fix(md, ctx)            the deterministic fixes, run before every quality check (no model, cannot invent anything)
//   PF.classify(qa, md, ctx)   BLOCKING (facts, trust, legal, a cut page) vs ADVISORY (length, coverage, structure, style)
//   PF.score / PF.better       ONE comparison for every candidate draft: hard blockers, then soft blockers, then advisory distance
//   PF.plan(md, cls, qa, ctx)  the section-targeted edit job: only the sections with a problem, each with its own problem list
//   PF.parseSections / merge   the editor's answer (one block per section) merged into the page, every other byte kept
//   PF.neutralize(md, cls)     the system's own neutral rewrite of whatever a fact would be needed for (delete / unlink / neutral CTA)
//   PF.deliver(...)            ready | ready_with_questions | not_ready, in plain customer words, with the client questions
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const PF = (() => {
  const S = (v) => String(v == null ? '' : v);
  const EDIT_MAX = 3;           // section-targeted editing rounds at most; the loop stops earlier as soon as a round improves nothing
  const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const words = (t) => S(t).split(/\s+/).filter(Boolean).length;
  const plain = (s) => S(s).replace(/\[([^\[\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]+/g, '').replace(/\s+/g, ' ').trim();
  const escRe = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // customer wording: no em / en dashes, curly quotes or the ellipsis character in anything this kit writes (owner rule, 2026-10-19)
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them than then into over under more most can will does do not but any all one two also very just only such been being has have had was were'.split(' '));
  const toks = (t) => S(t).toLowerCase().split(/[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w));
  const overlap = (a, b) => { const A = [...new Set(toks(a))]; if (!A.length) return 0; const B = new Set(toks(b)); return A.filter(w => B.has(w)).length / A.length; };
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const keyOf = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);
  const titleCase = (k) => S(k).split(/\s+/).filter(Boolean).map((w, i) => i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : /^[a-z]{2,4}$/.test(w) && /^(erp|crm|ai|uae|ksa|gcc|vat|seo|sap|hr|it|b2b|saas|api|ms|iot|ml|pdf|faq)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const QUESTION_KW = /^(is|are|can|does|do|what|which|how|why|when|where|who|should|will)\b/i;

  // ---------- 1. the contract ----------
  const PT_TARGETS = {
    guide: { h2: [5, 9], text: '5 to 9 H2 sections, at least 3 headings phrased as the questions readers ask with a 40-60 word answer right under each, a comparison table where options are compared, the call to action last' },
    service: { h2: [4, 8], text: '4 to 8 H2 sections: what the service covers, who it suits, how to decide, how to start; at least 2 question headings; the call to action last' },
    local: { h2: [4, 7], text: '4 to 7 H2 sections; the address, phone and service area only as the business profile gives them; the call to action last' },
    case_study: { h2: [4, 7], text: 'challenge, approach, result and what the reader can learn, every fact from the case study on file; nothing added' },
    other: { h2: [4, 9], text: '4 to 9 H2 sections, at least 3 question headings answered directly, the call to action last' }
  };
  const kindOf = (pageType, role) => { const t = S(pageType).toLowerCase(); if (S(role) === 'local') return 'local'; if (S(role) === 'case_study' || /case stud/.test(t)) return 'case_study';
    if (/service|landing|product|solution/.test(t)) return 'service'; if (/guide|blog|article|pillar|hub|how/.test(t)) return 'guide'; return 'other'; };
  const bandOf = (p) => { const LB = ((p || {}).competitor_analysis || {}).length_band || (p || {}).length_band || null;
    return LB && (LB.ok || LB.source === 'page_type') && Number(LB.low) > 0 && Number(LB.high) >= Number(LB.low)
      ? { low: Number(LB.low), high: Number(LB.high), source: LB.ok ? 'ranking_pages' : 'page_type', basis: clean(LB.basis) } : null; };
  const contract = (prev) => {
    const p = prev || {};
    const band = bandOf(p);
    const kind = kindOf(p.page_type, p.page_role);
    const biz = S((p.site_profile || {}).business_name || (p.site_description || {}).business_name || p.business_name || 'the business').trim() || 'the business';
    const length_text = band
      ? 'LENGTH: judged as a band, ' + band.low + '-' + band.high + ' words of main content' + (band.basis ? ' (' + band.basis + ')' : '') + '. Anywhere inside the band is right: aim for the brief\'s target word count, never pad to reach a number and never cut a complete answer to hit one. Length is advice, never a reason to refuse the page.'
      : 'LENGTH: aim for the brief\'s target word count; the check accepts anything from 80% to 125% of it. Never pad and never cut a complete answer to hit a number. Length is advice, never a reason to refuse the page.';
    const rules = [
      'THE PAGE CONTRACT (the brief, the writer, the reviewer, the editor and the quality check all apply these same rules)',
      length_text,
      'BRACKETS: none in the page. Never write a placeholder, a [Confirm: ...], an [Author insight: ...] or any other square-bracket note in the text (Markdown links and [Image: ...] lines are fine). When a fact is missing, write the sentence so it does not need it. A question for ' + biz + ' goes in the brief\'s questions_for_client list, never into the page.',
      'CLAIMS: say what ' + biz + ' does, offers, has done, holds or guarantees only when the business facts, the author profile, the case studies or its own pages state it. Write methods, steps and checklists as advice to the reader ("a sound migration starts with an inventory of ..."), never as "we do" or "our process". The call to action invites the reader to get in touch the way the facts say; it never promises a deliverable, a timeline, a price or a result that is not on file.',
      'NEVER: invented testimonials, reviews, quotes, client names, results, guarantees, certifications, team details or numbers about the business. A figure about the world is quoted exactly as a cited source states it, and the source is a page this run read.',
      'PAGE TYPE (' + (S(p.page_type) || kind) + '): ' + PT_TARGETS[kind].text + '.',
      'WHAT BLOCKS PUBLISHING: an unsupported statement about the business, a figure its source does not state, a bracket in the text, a dead link, a wrong brand name, copied text, a fake testimonial or guarantee, a page cut off before its end. Everything else (length, term coverage, headings, tables, readability) is advice.'
    ];
    return { version: 1, band, kind, h2_range: PT_TARGETS[kind].h2, business: biz, length_text, text: rules.join('\n') };
  };

  // ---------- 2. the page as sections ----------
  const split = (md) => {
    const src = S(md); const lines = src.split('\n'); const starts = []; let off = 0;
    for (const l of lines) { starts.push(off); off += l.length + 1; }
    let i = 0; while (i < lines.length && (META.test(lines[i].trim()) || !lines[i].trim())) i++;
    const headEnd = i < lines.length ? starts[i] : src.length;
    const cuts = [headEnd]; let fence = false;
    for (let k = i; k < lines.length; k++) {
      if (/^\s*(```|~~~)/.test(lines[k])) { fence = !fence; continue; }
      if (!fence && /^## /.test(lines[k]) && starts[k] !== cuts[cuts.length - 1]) cuts.push(starts[k]);
    }
    const parts = [];
    for (let c = 0; c < cuts.length; c++) { const a = cuts[c], b = c + 1 < cuts.length ? cuts[c + 1] : src.length; const text = src.slice(a, b);
      parts.push({ id: 's' + c, start: a, end: b, heading: c === 0 ? plain((text.match(/^# .*$/m) || [''])[0].replace(/^#\s*/, '')) : plain(text.split('\n')[0].replace(/^#+\s*/, '')), text }); }
    return { head: src.slice(0, headEnd), parts };
  };
  const join = (sp) => sp.head + sp.parts.map(p => p.text).join('');
  const partAt = (sp, at) => { const hl = sp.head.length; if (at < hl) return null; return sp.parts.find(p => at >= p.start && at < p.end) || sp.parts[sp.parts.length - 1] || null; };
  const isCta = (sp, part) => !!part && part === sp.parts[sp.parts.length - 1] && part.id !== 's0';

  // ---------- 3. sentences: find, remove, keep the page well formed ----------
  // link targets are shadowed so a full stop inside a URL never ends a sentence (the same trick as Content QA §3)
  const shadow = (t) => S(t).replace(/\]\(([^)\s]+)\)/g, (m) => '](' + 'x'.repeat(Math.max(0, m.length - 3)) + ')');
  const isEnd = (g, i) => { const c = g[i]; if (c === '\n' || c === '|') return true; if (c === '!' || c === '?') return true;
    if (c === '.') return !(/\d/.test(g[i - 1] || '') && /\d/.test(g[i + 1] || '')) && (i + 1 >= g.length || /[\s)*_"']/.test(g[i + 1])); return false; };
  const span = (md, at, len) => {
    const g = shadow(md); let a = at, b = at + len;
    while (a > 0 && !isEnd(g, a - 1)) a--;
    while (a < at && /[ \t]/.test(md[a])) a++;
    // H3 (2026-10-28): a span that already ends on a sentence end (the sentence passed with its full stop) stops there; it used to run on and
    // take the NEXT sentence with it
    while (b < g.length && !isEnd(g, b) && !(b > at && /[.!?]/.test(g[b - 1]) && isEnd(g, b - 1))) b++;
    if (b < g.length && /[.!?]/.test(g[b])) { b++; while (b < g.length && /[)*_"']/.test(g[b])) b++; }
    while (b < g.length && /[ \t]/.test(md[b])) b++;
    return [a, b];
  };
  const LIST_ONLY = /^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*(?:\*\*|__)?\s*(?:\*\*|__)?\s*$/;
  const tidy = (md) => {
    let out = S(md).split('\n').filter((l, i, a) => !(l.trim() && LIST_ONLY.test(l) && !/^\s*$/.test(l))).join('\n');
    // a heading (H2-H4) left with nothing under it before the next heading of its level or higher is removed with its section
    const lines = out.split('\n'); const keep = new Array(lines.length).fill(true);
    for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{2,4})\s/); if (!m) continue; const lvl = m[1].length; let j = i + 1, body = false;
      for (; j < lines.length; j++) { const h = lines[j].match(/^(#{1,6})\s/); if (h && h[1].length <= lvl) break; if (h) { body = true; break; } if (lines[j].trim() && !/^\[Image:/i.test(lines[j].trim())) { body = true; break; } }
      if (!body) keep[i] = false; }
    out = lines.filter((l, i) => keep[i]).join('\n');
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');
  };
  // remove what sits at [at, at+len): a whole sentence in prose, a table row (never the header row), only the text in a heading
  const removeAt = (md, at, len) => {
    const src = S(md); const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at + len); if (le < 0) le = src.length;
    const line = src.slice(ls, le);
    // W0-A (2026-10-29, page-quality PLAN Fix 1): a meta line is never edited by a sentence removal. Removing only the span left
    // "Meta Description:" empty (3299) and a reader then took the next line ("Slug: ...") as its value; PF.meta owns the meta lines
    if (META.test(line.trim())) return src;
    if (/^#{1,6}\s/.test(line)) return src.slice(0, at) + src.slice(at + len);
    if (/^\s*\|/.test(line)) {
      const next = src.slice(le + 1, (src.indexOf('\n', le + 1) + 1 || src.length + 1) - 1);
      if (/^\s*\|?\s*:?-{2,}/.test(next)) return src.slice(0, at) + src.slice(at + len);   // a header cell: the token only
      return src.slice(0, ls) + src.slice(Math.min(src.length, le + 1));
    }
    const [a, b] = span(src, at, len);
    return src.slice(0, a) + src.slice(b);
  };
  const removeText = (md, text) => { const t = S(text); if (!t) return { md, done: false }; const at = S(md).indexOf(t); if (at < 0) return { md, done: false }; return { md: removeAt(md, at, t.length), done: true }; };
  // W0-E (2026-10-29, page-quality PLAN Fix 5.3, R4 G15): where a removed statement stood, read BEFORE it goes: its section, the sentence
  // before it and the sentence after it on its own line, else (a sentence alone on its line) the last sentence of the line above. A later
  // "yes" from the client puts it back at this anchor and nowhere else; the page carries no guessed "neutral" sentence for it (3299 q5
  // matched an unrelated checklist item by word overlap and Finalize replaced that item with the confirmed claim)
  const sentencesOf = (t) => S(t).split(/(?<=[.!?]["')*_]*)\s+/).map(x => x.trim()).filter(Boolean);
  const LEAD = /^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/;
  const anchorAt = (md, at, len) => {
    const src = S(md); const sp = split(src); const part = partAt(sp, at);
    const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at + len); if (le < 0) le = src.length;
    const [a, b] = span(src, at, len);
    const lead = (src.slice(ls, Math.max(ls, a)).match(LEAD) || [''])[0].length;
    const pre = src.slice(ls + lead, Math.max(ls + lead, a)).trim(); const post = src.slice(Math.min(b, le), le).trim();
    const xs = sentencesOf(pre); const before = xs.length ? xs[xs.length - 1] : ''; const after = sentencesOf(post)[0] || '';
    let line_before = '';
    if (!before && !after) { const ok = (x) => x && !/^#{1,6}\s/.test(x) && !/^!\[/.test(x) && !/^\s*\|?\s*:?-{2,}/.test(x) && !META.test(x);
      const above = src.slice(part ? part.start : 0, ls).split('\n').map(x => x.trim()).filter(ok); const ys = sentencesOf((above[above.length - 1] || '').replace(LEAD, '')); line_before = ys.length ? ys[ys.length - 1] : ''; }
    return { section: part ? part.heading : '', section_id: part ? part.id : '', before: before.slice(0, 400), after: after.slice(0, 400), line_before: line_before.slice(0, 400) }; };
  // the sentence that holds a link to the business's own site keeps its link as a neutral next step; any other sentence goes
  const ownLinkIn = (sentence, domain) => { const d = S(domain).toLowerCase().replace(/^www\./, ''); if (!d) return null;
    for (const m of S(sentence).matchAll(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) { const h = hostOf(m[2]); if (h === d || h.endsWith('.' + d)) return { anchor: m[1], url: m[2] }; } return null; };
  const neutralSentence = (md, sentence, domain, rewrite) => {
    const src = S(md); const wrapped = '[Confirm: ' + sentence + ']';
    let at = src.indexOf(wrapped), len = wrapped.length; if (at < 0) { at = src.indexOf(sentence); len = S(sentence).length; }
    if (at < 0) return { md: src, done: false, how: '' };
    // W0-A: neither the call-to-action nor the reworded path (nor the removal) ever touches a meta line (PF.meta owns them)
    { const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at); if (le < 0) le = src.length; if (META.test(src.slice(ls, le).trim())) return { md: src, done: false, how: 'meta' }; }
    const link = ownLinkIn(sentence, domain);
    if (link) { const line = 'Next step: [' + link.anchor.replace(/^\s+|\s+$/g, '') + '](' + link.url + ').'; return { md: src.slice(0, at) + line + src.slice(at + len), done: true, how: 'cta', text: line }; }
    // H2's neutral wording (CL.neutral): a method in the business's voice kept as advice to the reader; a stance or a client fact goes
    const rw = rewrite || {}; const nt = S(rw.neutral).trim();
    if (rw.action === 'reword' && nt && !/\[/.test(nt)) { return { md: src.slice(0, at) + nt + src.slice(at + len), done: true, how: 'reworded', text: nt }; }
    return { md: removeAt(src, at, len), done: true, how: 'removed', anchor: anchorAt(src, at, len) };
  };

  // ---------- 4. brackets ----------
  const BRACKET = () => /(?<![!\\])\[(\p{L}[^\[\]\n]{0,399})\](?![(:])/gu;
  const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g;
  const MASK = /^(?:Price|Statistic|Number|Amount|Figure|Percentage|Timeline|Date)$/i;
  const NOT_GAP = /^(?:sic!?|x| |emphasis (?:added|mine|ours)|(?:last )?(?:updated|revised|edited|reviewed|published)\b[^\]]*\d{4}|(?:19|20)\d\d)$/i;
  // W0-A: the meta lines are read by PF.meta (a bracket there is unwrapped or the description rebuilt), never by the sentence removal
  const META_LINES = /^[ \t]*(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)[ \t]*:.*$/gim;
  const bracketsIn = (md) => { const t = S(md).replace(CODE, (m) => ' '.repeat(m.length)).replace(META_LINES, (m) => ' '.repeat(m.length)); const out = [];
    for (const m of t.matchAll(BRACKET())) { const inner = m[1].trim(); if (!inner || /^image\s*:/i.test(inner) || NOT_GAP.test(inner)) continue; out.push({ token: m[0], inner, at: m.index }); }
    return out; };
  const questionFor = (inner, biz) => {
    const x = S(inner).replace(/^(?:author insight|confirm|owner)\s*:\s*/i, '').replace(/\s+/g, ' ').trim().replace(/[.;:,]+$/, '');
    if (/^author insight/i.test(inner)) return { kind: 'experience', question: 'From your own work: ' + x.charAt(0).toLowerCase() + x.slice(1) + '? One real example in a sentence or two is enough.' };
    if (/^case stud/i.test(x) || /case study/i.test(x)) return { kind: 'proof', question: 'Is there a client result you are happy to publish (with or without the client\'s name)? ' + x.replace(/^case study\s*:\s*/i, '') };
    if (/partner|certif|accredit|designation|award|iso\s?\d/i.test(x)) return { kind: 'credential', question: 'Please confirm for ' + biz + ': ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
    if (/^date$/i.test(x)) return { kind: 'detail', question: '' };
    if (MASK.test(x) || /\b(price|fee|cost|rate|budget)\b/i.test(x)) return { kind: 'price', question: 'Do you want prices on this page? If so, give us the figure you are happy to publish.' };
    if (/\b(duration|timeline|weeks?|months?|how long)\b/i.test(x)) return { kind: 'timeline', question: 'Is there a typical timeline you are happy to publish? ' + x };
    return { kind: 'detail', question: 'Please give us this detail for the page: ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
  };
  // a writer's [Confirm: ...] about a third party's product is research, not a client question
  const aboutBusiness = (inner, names) => { const t = S(inner).toLowerCase(); if (/\b(we|our|us|your business|the business|the client)\b/.test(t)) return true; return (names || []).some(n => n && t.includes(S(n).toLowerCase())); };

  // ---------- 5. the deterministic fixes (before every quality check) ----------
  // the keyword as the page itself writes its words ("Microsoft", "ERP"), the first word capitalised
  const caseLike = (kw, md) => S(kw).split(/\s+/).filter(Boolean).map((w, i) => {
    const forms = new Map(); for (const m of S(md).matchAll(new RegExp('(?<![\\p{L}\\p{N}])' + escRe(w) + '(?![\\p{L}\\p{N}])', 'giu'))) forms.set(m[0], (forms.get(m[0]) || 0) + 1);
    const best = [...forms.entries()].filter(([f]) => f !== f.toLowerCase()).sort((a, b) => b[1] - a[1])[0];
    const f = best ? best[0] : w; return i === 0 ? f.charAt(0).toUpperCase() + f.slice(1) : f; }).join(' ');
  const unmark = (md, marks, figures) => { let out = S(md);
    for (const s of (marks || [])) if (s) out = out.split('[Confirm: ' + s + ']').join(s);
    for (const f of (figures || [])) if (f) out = out.split('[Confirm: ' + f + ']').join(f);
    return out; };
  // ---------- 5a. the meta description (W0-A, 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 1; R4 D1 / D2 / G22 / G27) ----------
  // Production page run 3299: the claim check read the meta description as a statement about the business, a removal emptied the line, and
  // two readers took the next line ("Slug: ms-365-erp-uae", 20 characters) as its value: in the HTML head, Open Graph, the Service schema
  // and the final version. The meta description is search-result copy written from the brief, so it is never claim-checked; it gets
  // ONE narrow field check instead: a clause naming a price, a guarantee, a timeline or a number that neither the facts on file nor the page
  // itself carries is dropped (code, no model). A description that is missing, under 70 characters, on more than one line, starting with a
  // field label or holding a bracket is rebuilt: from the brief's meta_description when it passes the field check, else from the Quick
  // answer (then the introduction), 120-155 characters with the keyword. A description that already passes is left exactly as it is.
  const META_LABEL = /^(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords|URL|Page Type)\s*:/i;
  const metaProblem = (d0) => { const d = S(d0).replace(/\s+$/, ''); const t = d.trim();
    if (!t) return 'missing'; if (/\n/.test(d)) return 'multi_line'; if (META_LABEL.test(t)) return 'label'; if (/[\[\]]/.test(t)) return 'bracket';
    if (t.length < 70) return 'short'; if (t.length > 155) return 'long'; return ''; };
  const META_PROBLEM_TEXT = { missing: 'is missing', multi_line: 'runs over more than one line', label: 'starts with a field label instead of a description',
    bracket: 'holds a bracket', short: 'is under 70 characters', long: 'is over 155 characters' };
  const F_PRICE = /(?:\b(?:aed|usd|eur|gbp|sar|qar|kwd|bhd|omr|inr|pkr|egp)\s?\d[\d,.]*|[$€£]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?|riyals?)\b|\bfree of charge\b|\bat no (?:extra )?cost\b|\bno (?:hidden )?(?:fees?|charges?)\b|\bfree (?:consultation|assessment|audit|quote|demo|call|review|session|estimate)s?\b|\bdiscount\w*|\b\d+\s?% off\b)/gi;
  const F_GUAR = /\b(?:guarantee\w*|money[- ]back|refund\w*|warrant(?:y|ies)|risk[- ]free)\b/gi;
  const F_TIME = /\b(?:in|within|under)\s+(?:just\s+|only\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)(?:\s*(?:-|to)\s*\d+)?\s*(?:hours?|days?|weeks?|months?)\b|\b\d+[- ](?:hour|day|week|month)s?\b/gi;
  const F_NUM = /\d[\d,.]*\d|\d/g;
  const numKey = (n) => S(n).replace(/,/g, '').replace(/\.+$/, '');
  // the narrow field check: what a clause names must be on file (the facts, the profile) or on the page itself (whose own statements the
  // claim and figure checks hold to their sources); the clauses that name something else are dropped, the rest of the sentence is kept
  const fieldCheck = (desc, corpus) => {
    const C = S(corpus).toLowerCase(); const nums = new Set((C.match(F_NUM) || []).map(numKey));
    const backed = (m) => { const ns = S(m).match(F_NUM); if (ns) return ns.every(n => nums.has(numKey(n)));
      const ws = S(m).toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w)); return ws.length > 0 && ws.every(w => C.includes(w)); };
    const bad = (t) => { for (const re of [F_PRICE, F_GUAR, F_TIME, F_NUM]) for (const x of S(t).matchAll(re)) if (!backed(x[0])) return x[0]; return ''; };
    const dropped = [];
    const kept = S(desc).split(/(?<=[.!?])\s+/).filter(x => x.trim()).map(sent => { if (!bad(sent)) return sent;
      const end = (sent.match(/[.!?]$/) || [''])[0]; const body = end ? sent.slice(0, -1) : sent;
      const pieces = body.split(/(,\s+|;\s+|\s+(?:and|then|so|or|plus)\s+|\s+[-:]\s+)/); let out = '';
      for (let i = 0; i < pieces.length; i += 2) { const cl = pieces[i]; if (!cl.trim()) continue;
        if (bad(cl)) { dropped.push(cl.trim()); continue; }
        out = out ? out + (pieces[i - 1] || ', ') + cl.trim() : cl.trim().replace(/^./, (x) => x.toUpperCase()); }
      return out ? out.replace(/[\s,;:-]+$/, '') + (end || '.') : ''; }).filter(Boolean);
    return { text: kept.join(' ').replace(/\s+/g, ' ').trim(), dropped };
  };
  // a review mark the head may carry from an older round: its words stay, the mark goes
  const unwrapHead = (t) => S(t).replace(/\[(?:Confirm|Owner)\s*:\s*(?:confirm\s*[-:\u2013\u2014]\s*)?([^\[\]]*)\]/gi, '$1').replace(/\s+/g, ' ').trim();
  // a text cut to a description: whole sentences up to 155 characters, at least 120 where the text allows (then cut at a comma or a word),
  // the keyword in it
  const fitMeta = (text, kwRe, KW) => {
    let t = clean(plain(S(text).replace(/^\**\s*Quick answer:?\**\s*/i, ''))).replace(/\s+/g, ' ').trim(); if (!t) return '';
    if (kwRe && KW && !kwRe.test(t)) t = QUESTION_KW.test(KW) ? KW.replace(/\?*$/, '?') + ' ' + t : KW + ': ' + t;
    let out = ''; for (const s of t.split(/(?<=[.!?])\s+/)) { const nx = out ? out + ' ' + s : s; if (nx.length <= 155) out = nx; else break; }
    if (out.length < 120 && t.length > out.length) {
      const win = t.slice(0, 153); let at = -1;
      for (const x of win.matchAll(/,\s|;\s|\s(?:and|or|but|with|while|so|because)\s/g)) if (x.index >= 120) at = x.index;
      let cut = at >= 0 ? win.slice(0, at) : win.replace(/\s+\S*$/, '');
      if (at < 0) cut = cut.replace(/(?:\s+(?:a|an|the|and|or|but|of|to|for|in|on|with|your|our|its|their|by|at|as|from|that|which|how|what))+$/i, '');
      if (cut.length > out.length) out = cut.replace(/[\s,;:&-]+$/, '') + (/[.!?]$/.test(cut) ? '' : '.'); }
    return out; };
  const meta = (md0, ctx) => {
    const c = ctx || {}; let md = S(md0); const fixes = [];
    const re = /^Meta Description:[ \t]*(.*)$/im;
    const kw = S(c.keyword).trim();
    const kwRe = !kw ? null : c.termRe ? c.termRe(kw, 'i') : new RegExp(escRe(kw).replace(/ /g, '[\\s-]+'), 'i');
    const KW = kw ? (QUESTION_KW.test(kw) ? caseLike(kw, md) : titleCase(caseLike(kw, md))) : '';
    const bodyMd = md.split('\n').filter(l => !META.test(l.trim())).join('\n');
    const corpus = [S(c.own_text), plain(bodyMd), kw].join('\n');
    const m = md.match(re); const was = m ? m[1].trim() : '';
    let desc = was; let how = 'kept';
    if (/\[/.test(desc)) { const u = unwrapHead(desc); if (u !== desc) { desc = u; how = 'unwrapped'; } }
    if (desc && !META_LABEL.test(desc)) { const fc = fieldCheck(desc, corpus);
      if (fc.dropped.length) { desc = fc.text; how = 'field_check'; fixes.push('Took ' + fc.dropped.length + ' clause(s) out of the meta description that name a price, a guarantee, a timeline or a number that nothing on file and nothing on the page states (' + fc.dropped.slice(0, 3).map(x => '"' + x.slice(0, 60) + '"').join(', ') + ')'); } }
    if (desc.length > 155 && !/^(label|bracket|multi_line)$/.test(metaProblem(desc))) { let d2 = desc.slice(0, 155); const lastStop = Math.max(d2.lastIndexOf('. '), d2.endsWith('.') ? d2.length - 1 : -1);
      d2 = lastStop >= 100 ? d2.slice(0, lastStop + 1) : d2.replace(/\s+\S*$/, '').replace(/[\s,;:&-]+$/, '') + '.';
      desc = d2; how = 'shortened'; fixes.push('Shortened the meta description to ' + d2.length + ' characters'); }
    if (metaProblem(desc)) {
      const sp = split(md); const s0 = sp.parts[0] ? sp.parts[0].text : '';
      const qaLine = (s0.match(/^\**\s*Quick answer:?\**[ \t]*(.+)$/im) || bodyMd.match(/^\**\s*Quick answer:?\**[ \t]*(.+)$/im) || [, ''])[1];
      const intro = s0.split('\n').filter(l => l.trim() && !/^(#|!\[|\[Image|\*\*\s*Quick answer|\*[^*]+\*\s*$|>|\||[-*+]\s|\d+[.)]\s)/i.test(l.trim())).join(' ');
      const brief = (() => { const b = unwrapHead(S(c.brief_meta)); return b ? fieldCheck(b, corpus).text : ''; })();
      for (const [src, text, fit, tag] of [['the brief', brief, false, 'brief'], ['the Quick answer', qaLine, true, 'quick_answer'], ['the introduction', intro, true, 'introduction']]) {
        if (!S(text).trim()) continue; const d = fit ? fitMeta(text, kwRe, KW) : clean(S(text)).replace(/\s+/g, ' ').trim();
        if (!metaProblem(d)) { fixes.push('Wrote the meta description from ' + src + ' (' + d.length + ' characters): the draft\'s ' + (was ? META_PROBLEM_TEXT[metaProblem(desc)] || 'did not pass the field check' : 'was missing'));
          desc = d; how = tag; break; } }
    }
    if (desc !== was) {
      const line = 'Meta Description: ' + desc;
      if (m) md = md.replace(re, () => line);
      else { const lines = md.split('\n'); const ti = lines.findIndex(l => /^Title[ \t]*:/i.test(l.trim()));
        if (ti >= 0) lines.splice(ti + 1, 0, line); else lines.splice(0, 0, ...(META.test(S(lines[0]).trim()) ? [line] : [line, ''])); md = lines.join('\n'); }
    }
    const problem = metaProblem(desc);
    return { md, description: desc, how: desc === was ? 'kept' : how, problem, problem_text: problem ? 'The meta description ' + META_PROBLEM_TEXT[problem] : '', fixes };
  };
  const fix = (md0, ctx) => {
    const c = ctx || {}; let md = S(md0); const fixes = [], removed = [];
    const kw = S(c.keyword).trim();
    const kwRe = !kw ? null : c.termRe ? c.termRe(kw, 'i') : new RegExp(escRe(kw).replace(/ /g, '[\\s-]+'), 'i');
    // a. the quality check's own [Confirm: ...] marks of an earlier round are taken off (the next check judges the words themselves); a
    //    writer's own [Confirm: ...] note is not one of them and goes with the brackets below
    const before = md;
    md = unmark(md, c.qa_marks, c.qa_figure_marks);
    if (md !== before) fixes.push('Took the review marks of the last check off the text (the next check reads the words themselves)');
    // b. brackets: none in the page. Each one goes, with the sentence that needs it; what only the client knows becomes a question
    const names = c.names || [];
    for (let guard = 0; guard < 60; guard++) {
      const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0];
      const q = questionFor(b.inner, c.business || 'your business');
      const research = /^(confirm|owner)\s*:/i.test(b.inner) && !aboutBusiness(b.inner, names);
      const ls = md.lastIndexOf('\n', b.at - 1) + 1; let le = md.indexOf('\n', b.at); if (le < 0) le = md.length;
      const line = md.slice(ls, le);
      const alone = line.replace(b.token, '').replace(/^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/, '').replace(/[*_\s.:;,]+/g, '') === '';
      const sentence = plain(md.slice(...span(md, b.at, b.token.length)));
      md = alone ? md.slice(0, ls) + md.slice(Math.min(md.length, le + 1)) : removeAt(md, b.at, b.token.length);
      removed.push({ token: b.token, sentence: alone ? '' : sentence, kind: research ? 'research' : q.kind, question: research || MASK.test(b.inner) && !/price/i.test(b.inner) ? '' : q.question, research: research ? b.inner.replace(/^(confirm|owner)\s*:\s*/i, '') : '' });
    }
    if (removed.length) fixes.push('Took ' + removed.length + ' bracket(s) out of the text with the words that needed them (' + removed.slice(0, 3).map(r => r.token.slice(0, 60)).join(', ') + (removed.length > 3 ? ' and ' + (removed.length - 3) + ' more' : '') + '): a page carries no brackets; what only you know is asked as a question instead');
    // c. meta lines
    const metaRe = (l) => new RegExp('^(' + l + '):[ \\t]*(.*)$', 'im');
    // W0-A: the sentence removal never edits a meta line (bracketsIn does not read them), so a review mark left in the title is unwrapped here
    { const t0 = md.match(metaRe('Title')); if (t0 && /[\[\]]/.test(t0[2])) { const t1 = unwrapHead(t0[2]).replace(/\[[^\[\]]*\]/g, '').replace(/\s+/g, ' ').trim(); if (t1 && t1 !== t0[2].trim()) { md = md.replace(metaRe('Title'), () => 'Title: ' + t1); fixes.push('Took the review mark off the meta title'); } } }
    const tm = md.match(metaRe('Title')); let title = tm ? tm[2].trim() : '';
    const KW = kw ? (QUESTION_KW.test(kw) ? caseLike(kw, md) : titleCase(caseLike(kw, md))) : '';
    if (title && kwRe && !kwRe.test(title)) { const t2 = KW + ': ' + title; title = t2.length <= 60 ? t2 : KW + (c.business && (KW.length + 3 + S(c.business).length) <= 60 ? ' | ' + c.business : '');
      md = md.replace(metaRe('Title'), 'Title: ' + title); fixes.push('Put the keyword at the start of the meta title'); }
    if (title.length > 60) { const parts = title.split(/\s+[|\-:]\s+/); let t2 = parts[0]; for (const p of parts.slice(1)) { if ((t2 + ' | ' + p).length <= 60) t2 += ' | ' + p; else break; }
      if (t2.length > 60 || (kwRe && !kwRe.test(t2))) { t2 = title.slice(0, 60).replace(/\s+\S*$/, '').replace(/[\s|:,;&-]+$/, ''); }
      if (t2 && t2.length <= 60 && (!kwRe || kwRe.test(t2))) { md = md.replace(metaRe('Title'), 'Title: ' + t2); fixes.push('Shortened the meta title to ' + t2.length + ' characters'); title = t2; } }
    // W0-A: the meta description by its one rule (PF.meta: the field check, the length, a rebuild from the brief or the Quick answer)
    { const MD = meta(md, c); md = MD.md; fixes.push(...MD.fixes); }
    const sm = md.match(metaRe('Slug'));
    if (sm && !c.planned_slug) { const s0 = sm[2].trim(); const s1 = s0.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (s1 && s1 !== s0.replace(/^\/+|\/+$/g, '')) { md = md.replace(metaRe('Slug'), 'Slug: ' + s1); fixes.push('Wrote the slug as lowercase words joined by hyphens (' + s1 + ')'); } }
    // d. the keyword in the H1 and, for a question keyword, as the first words of the introduction
    const h1m = md.match(/^# (.+)$/m);
    if (h1m && kwRe && !kwRe.test(h1m[1])) {
      const q = QUESTION_KW.test(kw); const h = q ? KW.replace(/\?*$/, '?') : (KW + ': ' + h1m[1]).length <= 90 ? KW + ': ' + h1m[1] : '';
      if (h) { md = md.replace(/^# .+$/m, '# ' + h); fixes.push('Put the keyword in the H1'); }
    }
    {
      const sp = split(md); const s0 = sp.parts[0];
      if (s0 && kwRe && QUESTION_KW.test(kw)) { const body = s0.text.replace(/^# .*$/m, ''); const first = plain(body).split(/\s+/).slice(0, 100).join(' ');
        if (!kwRe.test(first)) { const lines = s0.text.split('\n'); const pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image|\*\*\s*Quick answer)/i.test(l.trim()));
          if (pi > 0) { lines[pi] = KW.replace(/\?*$/, '?') + ' ' + lines[pi].trim(); s0.text = lines.join('\n'); md = join(sp); fixes.push('Opened the introduction with the question the page answers, so the keyword is in its first 100 words'); } } }
    }
    // e. the Quick answer within the first 120 words under the H1 (60 for an AI answer target)
    {
      const limit = c.ai_target ? 60 : 120; const sp = split(md); const s0 = sp.parts[0];
      if (s0) { const lines = s0.text.split('\n'); const qi = lines.findIndex(l => /^\**\s*Quick answer:?\**/i.test(l.trim()));
        if (qi > 0) { const beforeQ = plain(lines.slice(1, qi).filter(l => !/^#/.test(l)).join(' ')); const n = words(beforeQ);
          if (n > limit) { const qa = lines.splice(qi, 1)[0]; let pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image)/i.test(l.trim())); let pe = pi; while (pe >= 0 && pe < lines.length && lines[pe].trim()) pe++;
            if (pi > 0) { lines.splice(pe, 0, '', qa, ''); s0.text = lines.join('\n'); md = join(sp); fixes.push('Moved the Quick answer up to right after the first paragraph (it came after ' + n + ' words)'); } } } }
    }
    // f. a snippet question from the brief becomes the heading it already nearly is
    for (const st of (c.snippet_targets || [])) { const qn = plain(st && st.question).replace(/\?*$/, '?'); if (!qn || qn.length < 8) continue;
      if (new RegExp('^#{2,3}\\s*' + escRe(qn.replace(/\?$/, '')), 'im').test(md)) continue;
      const heads = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(m => ({ lvl: m[1], text: m[2], at: m.index, full: m[0] }));
      const best = heads.map(h => ({ h, s: Math.min(overlap(qn, h.text), overlap(h.text, qn)) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0];
      if (best && plain(best.h.text).replace(/\?$/, '').toLowerCase() !== qn.replace(/\?$/, '').toLowerCase()) { md = md.slice(0, best.h.at) + best.h.lvl + ' ' + qn + md.slice(best.h.at + best.h.full.length); fixes.push('Phrased the heading "' + plain(best.h.text) + '" as the question the brief targets: "' + qn + '"'); } }
    // g. internal links: none in the page, and a live page of the site whose name the text already uses: link the first mention
    if (c.domain && Array.isArray(c.internal_links) && c.internal_links.length) {
      const own = [...md.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].filter(m => m[1].startsWith('/') || hostOf(m[1]) === S(c.domain).replace(/^www\./, '') || hostOf(m[1]).endsWith('.' + S(c.domain).replace(/^www\./, ''))).length;
      if (!own) { let added = 0; const sp = split(md);
        for (const l of c.internal_links) { if (added >= 2) break; const anchor = S(l && (l.anchor || l.title)).trim(); const url = S(l && l.url).trim(); if (!anchor || anchor.length < 6 || !/^https?:\/\//.test(url)) continue;
          for (const p of sp.parts.slice(1)) { const re = new RegExp('(^|[^\\[\\w])(' + escRe(anchor) + ')(?![\\w\\]])', 'i'); const lines = p.text.split('\n'); let hit = false;
            for (let i = 1; i < lines.length && !hit; i++) { if (/^(#|\||!\[)/.test(lines[i].trim()) || /\[[^\]]*$/.test(lines[i])) continue; const m = lines[i].match(re);
              if (m && !/\]\(/.test(lines[i].slice(m.index, m.index + m[0].length + 3))) { lines[i] = lines[i].slice(0, m.index + m[1].length) + '[' + m[2] + '](' + url + ')' + lines[i].slice(m.index + m[0].length); hit = true; } }
            if (hit) { p.text = lines.join('\n'); added++; break; } } }
        if (added) { md = join(sp); fixes.push('Linked ' + added + ' mention(s) of the site\'s own live pages'); } }
    }
    // h0. H2: the legal name is not the brand: a "(legal name: ...)" note after the brand goes everywhere, and the legal name itself never
    //     stands in the title, the meta description or a heading (the display name does)
    { const before0 = md; md = md.replace(/\s*\(\s*(?:legal(?:ly)?(?: name)?|registered(?: name| as)?)\s*[:=-]?[^)\n]*\)/gi, '');
      if (c.legal_name && c.brand) md = md.replace(/^(Title:|Meta Description:|#{1,6} ).*$/gim, (line) => line.split(c.legal_name).join(S(c.brand)));
      if (md !== before0) fixes.push('Wrote the business name as "' + S(c.brand) + '" where the legal name or a "(legal name: ...)" note stood in the title, a heading or a sentence'); }
    // h. the brand as the business writes it: a wrong form outside the stored name (and outside a legal name) is corrected
    if (c.brand && (c.wrong_forms || []).length) { const brand = S(c.brand).replace(/\s*\([^)]*\)\s*$/, '').trim(); const keep = [...(c.keep_forms || []), S(c.brand)].filter(Boolean);
      let n = 0; const masked = []; let t = md; keep.sort((a, b) => b.length - a.length).forEach((k, i) => { t = t.split(k).join('\u0000' + i + '\u0000'); masked.push(k); });
      for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; const re = new RegExp('(^|[^\\p{L}\\p{N}@./-])(' + escRe(w) + ')(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu');
        t = t.replace(re, (m0, pre) => { n++; return pre + brand; }); }
      t = t.replace(/\u0000(\d+)\u0000/g, (m0, i) => masked[Number(i)]);
      if (n) { md = t; fixes.push('Wrote the business name as "' + brand + '" in ' + n + ' place(s)'); } }
    return { md: tidy(md), fixes, removed };
  };

  // ---------- 6. blocking vs advisory ----------
  const brandHits = (md, ctx) => { const c = ctx || {}; if (!c.brand || !(c.wrong_forms || []).length) return 0; let t = S(md);
    [S(c.brand), ...(c.keep_forms || [])].filter(Boolean).sort((a, b) => b.length - a.length).forEach(k => { t = t.split(k).join(' '); });
    t = t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ').replace(/\S+@\S+/g, ' ');
    let n = 0; for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; n += (t.match(new RegExp('(^|[^\\p{L}\\p{N}.@/-])' + escRe(w) + '(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu')) || []).length; } return n; };
  // a testimonial: a quoted sentence with a person's attribution that nothing on file carries (FTC rule on fake reviews, 2024)
  const testimonials = (md, own) => { const out = []; const O = S(own).toLowerCase();
    for (const m of S(md).matchAll(/(?:^>\s*)?["\u201C]([^"\u201D\n]{25,400})["\u201D]\s*(?:[-\u2013\u2014,]\s*|\n>?\s*[-\u2013\u2014]\s*)([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,3})(?:,\s*([^\n]{2,80}))?/gmu)) {
      const quote = m[1].trim(); if (O && O.includes(quote.toLowerCase().slice(0, 60))) continue; out.push({ quote: quote.slice(0, 200), who: m[2], text: m[0] }); }
    return out; };
  const W = (s) => clean(S(s));
  const classify = (qa0, md, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const blocking = [], advisory = [];
    const B = (code, text, tier, extra) => blocking.push({ code, text: W(text), tier, ...(extra || {}) });
    const A = (code, text, w) => advisory.push({ code, text: W(text), w: Number(w) || 0 });
    // hard: the system cannot make these go away by itself
    if (qa.cut_off) B('cut_off', 'The page stops before its end, so it cannot be published as it is', 'hard', { weight: 10 });
    const orig = qa.originality || {};
    if (orig.passed === false) { const f = (orig.failing || orig.worst || {}); B('copied', 'Part of the text repeats another page word for word' + (f.source ? ' (' + f.source + (f.overlap_pct != null ? ', ' + f.overlap_pct + '%' : '') + ')' : ''), 'hard'); }
    const dup = Array.isArray(orig.duplicate_targets) ? orig.duplicate_targets : [];
    if (dup.length) B('duplicate_page', 'This website already has a page for the same search: ' + dup.map(x => x.url).slice(0, 2).join(', ') + '. Publish this text as an update of that page, or tell us how the new page differs', 'hard', { urls: dup.map(x => x.url) });
    const brandWarn = (qa.warnings || []).find(w => /^Brand name:/.test(S(w)));
    const bh = brandWarn ? (c.brand ? brandHits(md, c) : 1) : 0;
    if (bh) B('brand', 'The business name is written in a form you do not use (' + bh + ' place' + (bh === 1 ? '' : 's') + ')', 'hard');
    // W0-A (PLAN Fix 1.5, R4 G22): a meta description PF.meta could not repair is a publish error (it reaches the HTML head, Open Graph and
    // the schema), no longer a 0.25 advisory; the check reads it from Content QA's field rule (content_qa.meta_error)
    if (S(qa.meta_error).trim()) B('meta', S(qa.meta_error).trim() + ', and it could not be written from the brief or the Quick answer', 'hard');
    if (Number(qa.profile_placeholders) > 0) B('author_profile', 'The author box needs the author\'s details (name, job title, short bio): add them once to the business profile', 'hard');
    // soft: facts and trust. The system rewrites or removes each one itself before delivery (PF.neutralize)
    const promises = (qa.business_promises || []).concat(qa.business_claims || []).filter(p => p && p.sentence);
    for (const p of promises) B('claim', 'A statement about the business that nothing on file supports: "' + plain(p.sentence).slice(0, 160) + '"', 'soft', { sentence: p.sentence, kind: p.kind || '', rewrite: p.rewrite || null });
    for (const f of (qa.unverified_figures || [])) B('figure', 'A figure its cited source does not state: "' + S(f.figure) + '"' + ((f.sources || []).length ? ' (' + f.sources.join(', ') + ')' : ''), 'soft', { figure: S(f.figure) });
    for (const a of (qa.flagged_amounts || [])) B('figure', 'An amount no source on file states: "' + S(a.amount) + '"', 'soft', { figure: S(a.amount) });
    for (const s of (qa.unverified_statistics || [])) B('statistic', 'A number with no source: "' + S(s) + '"', 'soft', { stat: S(s) });
    const marks = new Set(promises.map(p => '[Confirm: ' + p.sentence + ']').concat((qa.unverified_figures || []).map(f => '[Confirm: ' + f.figure + ']')).concat((qa.flagged_amounts || []).map(a => '[Confirm: ' + a.amount + ']')));
    for (const b of bracketsIn(md)) { if (marks.has(b.token)) continue; B('bracket', 'A bracket left in the text: ' + b.token.slice(0, 120), 'soft', { token: b.token }); }
    for (const x of ((qa.link_check || {}).dead || [])) B('dead_link', 'A link to a missing page: ' + S(x.url), 'soft', { url: S(x.url) });
    for (const x of (qa.excluded_sections || [])) B('off_topic', 'A section about a topic the verdict said to leave out: "' + S(x.heading).replace(/^#+\s*/, '') + '"', 'soft', { heading: S(x.heading) });
    const guar = (qa.warnings || []).find(w => /^Contains a guarantee claim/.test(S(w)));
    if (guar) { const m = S(guar).match(/"([^"]{5,200})"/); B('guarantee', 'A guarantee nothing on file states' + (m ? ': "' + m[1] + '"' : ''), 'soft', { quote: m ? m[1] : '' }); }
    for (const t of testimonials(md, c.own_text)) B('testimonial', 'A testimonial nothing on file carries: "' + t.quote.slice(0, 100) + '" (' + t.who + ')', 'soft', { text: t.text });
    // advisory: never blocks, weighted by how far the page is from its target
    const words0 = Number(qa.main_content_words) || 0; const LB = qa.length_band || null;
    const low = LB ? Number(LB.low) : Math.round((Number(qa.target_word_count) || 0) * 0.8), high = LB ? Number(LB.high) : Math.round((Number(qa.target_word_count) || 0) * 1.25);
    if (low && words0 < low) A('length', 'The main content is ' + words0 + ' words, under the ' + low + '-' + high + ' band of the pages that rank', 4 * (low - words0) / low);
    if (high && words0 > high) A('length', 'The main content is ' + words0 + ' words, over the ' + low + '-' + high + ' band of the pages that rank', 4 * (words0 - high) / high);
    const cp = Number(qa.coverage_pct), ct = Number(qa.coverage_target_pct);
    if (ct && cp < ct) A('coverage', 'Topic coverage ' + cp + '% against ' + ct + '% for the best page that ranks (terms missing: ' + (qa.missing_terms || []).slice(0, 6).join(', ') + ')', (ct - cp) / 10);
    if ((qa.missing_subtopics || []).length) A('subtopics', 'Subtopics the best page covers and this one does not: ' + qa.missing_subtopics.slice(0, 4).join('; '), Math.min(1, 0.25 * qa.missing_subtopics.length));
    const warn = (re) => (qa.warnings || []).filter(w => re.test(S(w)));
    const ADV = [[/^Primary keyword missing from the meta title/, 'kw_title', 0.5], [/^Primary keyword missing from H1/, 'kw_h1', 0.5], [/^Primary keyword not in the first 100 words/, 'kw_first100', 0.5],
      [/^Primary keyword used only/, 'kw_count', 0.25], [/^Keyword density is high/, 'kw_density', 0.5], [/^Meta title/, 'meta_title', 0.25], [/^Meta description/, 'meta_desc', 0.25], [/^Slug should/, 'slug', 0.25],
      [/^H1 missing/, 'h1', 1], [/^Only \d+ H2 sections/, 'h2', 0.5], [/^Quick answer block missing/, 'quick_answer', 1], [/^Quick answer is/, 'quick_answer_len', 0.25], [/^Answer first|^AI target: move the Quick answer/, 'answer_first', 0.5],
      [/^Only \d+ question\(s\) answered|^Phrase at least 2|^AI target: phrase/, 'question_headings', 0.5], [/^Snippet questions/, 'snippets', 0.5], [/^AI target: give these searches/, 'fanout', 0.5],
      [/^Comparison table missing/, 'table', 0.25], [/^The call to action should be the last/, 'cta_last', 0.5], [/^Sections far below/, 'thin', 0.25], [/^No internal links/, 'internal_links', 0.5],
      [/^Filler/, 'filler', 0.25], [/^Hard to read|sentences longer than|^Passive voice/, 'style', 0.1], [/^Too generic/, 'generic', 0.25], [/^External links to sources not in the evidence plan/, 'sources', 0.25],
      [/^A source with no independent authority/, 'weak_source', 0.25], [/^Topic coverage is thin/, 'coverage', 1], [/^Originality: \d+% of this draft also appears/, 'overlap_note', 0.1], [/^Too many placeholders/, 'placeholders', 0]];
    for (const [re, code, w] of ADV) for (const x of warn(re)) A(code, S(x).replace(/\s*\(the band of[^)]*\)\)?/, ''), w);
    const hard = blocking.filter(b => b.tier === 'hard').reduce((s, b) => s + (b.weight || 1), 0);
    const soft = blocking.filter(b => b.tier === 'soft').length;
    const adv = +advisory.reduce((s, a) => s + a.w, 0).toFixed(3);
    return { blocking, advisory, hard, soft, adv, words: words0, band: low ? { low, high } : null };
  };
  const score = (cls) => ({ hard: cls.hard, soft: cls.soft, adv: cls.adv });
  // what an edit may never lose, whatever else it fixes (R1 rec. 1): the call to action, the Quick answer, the sections, the length floor
  const protect = (md, qa, ctx) => { const sp = split(md); const last = sp.parts[sp.parts.length - 1]; const c = ctx || {};
    const d = S(c.domain).replace(/^www\./, '');
    const ctaLink = !!last && last.id !== 's0' && (/\]\((\/|https?:\/\/)/.test(last.text) && (!d || [...last.text.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].some(m => m[1].startsWith('/') || hostOf(m[1]) === d || hostOf(m[1]).endsWith('.' + d))));
    return { cta: ctaLink, quick_answer: /^\**\s*Quick answer:?\**/im.test(md), h2: sp.parts.length - 1, words: Number((qa || {}).main_content_words) || words(md) }; };
  const lostProtected = (a, b, band) => { const out = [];
    if (b.cta && !a.cta) out.push('the call to action'); if (b.quick_answer && !a.quick_answer) out.push('the Quick answer');
    if (b.h2 >= 3 && b.h2 - a.h2 >= 2) out.push((b.h2 - a.h2) + ' sections');
    if (band && band.low && b.words >= band.low * 0.9 && a.words < band.low * 0.75) out.push('a third of its length');
    return out; };
  // ONE comparison: is candidate `a` strictly better than `b`? A lost protected property makes it worse, whatever else it fixed
  const better = (a, b) => { if (!b) return { better: true, why: 'the first draft' };
    const lost = lostProtected(a.protect || {}, b.protect || {}, (a.cls || {}).band || (b.cls || {}).band);
    if (lost.length) return { better: false, why: 'it lost ' + lost.join(', ') };
    const x = a.score, y = b.score;
    if (x.hard !== y.hard) return { better: x.hard < y.hard, why: x.hard < y.hard ? 'fewer problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' : 'more problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' };
    if (x.soft !== y.soft) return { better: x.soft < y.soft, why: (x.soft < y.soft ? 'fewer' : 'more') + ' unsupported statements, figures, brackets or links (' + x.soft + ' against ' + y.soft + ')' };
    if (x.adv < y.adv - 0.05) return { better: true, why: 'closer to the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' };
    return { better: false, why: x.adv > y.adv + 0.05 ? 'further from the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' : 'no better than the draft it was given' }; };

  // ---------- 7. the section-targeted edit job ----------
  const plan = (md, cls, qa0, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const sp = split(md); const jobs = new Map();
    const add = (part, problem, weight) => { if (!part) return; const j = jobs.get(part.id) || { id: part.id, heading: part.heading, text: part.text, problems: [], weight: 0 }; const p = W(problem); if (!j.problems.includes(p)) { j.problems.push(p); j.weight += weight || 1; } jobs.set(part.id, j); };
    const at = (needle) => { const i = S(md).indexOf(S(needle)); return i < 0 ? null : partAt(sp, i); };
    const related = (text) => { const ranked = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, s: overlap(text, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s); return ranked.length ? ranked[0].p : sp.parts[0]; };
    for (const b of cls.blocking) {
      if (b.code === 'claim') { const rw = b.rewrite || {}; add(at(b.sentence), 'Rewrite as advice to the reader or as a neutral fact about the topic, or delete it (nothing on file says the business does this; never "we do" or "our process"): "' + plain(b.sentence).slice(0, 220) + '"'
        + (rw.action === 'reword' && rw.neutral ? '. A neutral wording that works: "' + plain(rw.neutral).slice(0, 220) + '"' : rw.action === 'delete' ? '. It adds nothing the reader can use: delete it' : ''), 3); }
      else if (b.code === 'figure') add(at(b.figure), 'The figure "' + b.figure + '" is not in the source the sentence cites: quote the number one of the SOURCES YOU MAY CITE states, with that link, or rewrite the sentence without the number', 2);
      else if (b.code === 'statistic') add(at(b.stat), 'The number "' + b.stat + '" has no source: cite one of the SOURCES YOU MAY CITE that states it, or rewrite the sentence without it', 2);
      else if (b.code === 'guarantee' && b.quote) add(at(b.quote.slice(0, 40)), 'Remove the guarantee or reword it so it promises nothing: "' + b.quote + '"', 2);
      else if (b.code === 'testimonial') add(at(b.text), 'Remove this testimonial: nothing on file says a client said it', 3);
      else if (b.code === 'copied') { const ps = ((qa.originality || {}).failing || {}).passages || []; for (const p of ps.slice(0, 3)) add(at(S(p.text).slice(0, 60)) || related(p.text), 'This passage repeats another page word for word; rewrite it in our own words, order and examples: "' + S(p.text).slice(0, 160) + '"', 3); }
    }
    const advCodes = new Set(cls.advisory.map(a => a.code));
    // length: cut from the sections furthest over their outline target, or expand the thinnest, with a number for each
    const LB = cls.band; const w0 = cls.words; const outline = c.outline || [];
    const target = (h) => { const o = outline.find(x => x && plain(x.h2).toLowerCase() === S(h).toLowerCase()); return o ? Number(o.target_words) || 0 : 0; };
    const body = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, words: words(plain(p.text)), target: target(p.heading) }));
    let length_note = '';
    if (LB && w0 > LB.high) { let need = w0 - LB.high; length_note = 'The page is ' + w0 + ' words, ' + need + ' over the ' + LB.low + '-' + LB.high + ' band: the sections below carry the cut.';
      for (const x of body.sort((a, b) => ((b.words - b.target) - (a.words - a.target)) || (b.words - a.words))) { if (need <= 0) break; const cut = Math.min(need, Math.max(40, Math.round(x.words * 0.35)));
        add(x.p, 'Cut about ' + cut + ' words (this section has ' + x.words + '): take out repetition and secondary detail; keep every fact with its source, every link and every heading', 1); need -= cut; } }
    else if (LB && w0 < LB.low) { let need = LB.low - w0; length_note = 'The page is ' + w0 + ' words, ' + need + ' under the ' + LB.low + '-' + LB.high + ' band: the sections below carry the extra depth.';
      for (const x of body.sort((a, b) => (a.words - (a.target || a.words)) - (b.words - (b.target || b.words)) || a.words - b.words)) { if (need <= 0) break; const more = Math.min(need, Math.max(60, Math.round((x.target || x.words) * 0.5)));
        add(x.p, 'Add about ' + more + ' words of specific, useful detail (an example, a step, a decision rule, a trade-off); never filler and never a fact that is not on file or in the sources', 1); need -= more; } }
    if (advCodes.has('coverage')) { const by = new Map(); for (const t of (qa.missing_terms || []).slice(0, 10)) { const p = related(t); const l = by.get(p.id) || { p, terms: [] }; l.terms.push(t); by.set(p.id, l); }
      for (const l of by.values()) add(l.p, 'Work these terms in where they belong, with substance around them: ' + l.terms.slice(0, 4).join(', '), 0.5); }
    if (advCodes.has('subtopics') && Number(qa.coverage_pct) < Number(qa.coverage_target_pct || 0)) for (const s of (qa.missing_subtopics || []).slice(0, 3)) add(related(s), 'Give this subtopic a paragraph or an H3 inside this section, in our own words: "' + s + '"', 0.5);
    const unanswered = (() => { const w = (qa.warnings || []).find(x => /^Snippet questions/.test(S(x))); return w ? S(w).replace(/^[^:]+:\s*/, '').split(' | ').map(x => x.trim()).filter(Boolean) : []; })();
    for (const q of unanswered.slice(0, 3)) add(related(q), 'Add an H3 "' + q + '" with a 40-60 word direct answer right under it', 0.75);
    const s0 = sp.parts[0];
    if (advCodes.has('quick_answer')) add(s0, 'Add a line starting with **Quick answer:** right after the introduction: 40-70 words that answer the page\'s question directly, no brackets', 1);
    if (advCodes.has('quick_answer_len')) add(s0, 'Bring the **Quick answer:** line to 40-70 words', 0.5);
    if (advCodes.has('kw_first100')) add(s0, 'Use the exact phrase "' + S(c.keyword) + '" once in the first two sentences of the introduction, naturally', 0.5);
    if (advCodes.has('question_headings')) { const flat = body.filter(x => !QUESTION_KW.test(x.p.heading)).slice(0, 2); for (const x of flat) add(x.p, 'Phrase this section\'s heading as the question a reader asks, and answer it in the 40-60 words right under it', 0.5); }
    if (advCodes.has('table') && body.length) { const p = related('compare comparison options versus choose which fits'); add(p, 'Add a small Markdown comparison table of what the reader can check for themselves (what each option covers, who it suits); no price or timeline column unless the facts state them', 0.25); }
    const filler = (qa.banned_phrases || []).map(b => b.phrase); for (const f of filler.slice(0, 6)) { const p = at(f); if (p) add(p, 'Rewrite the sentence with "' + f + '" in plain, specific words', 0.25); }
    // the Critic's review of the first draft: its high and medium problems for the sections already being edited, and its high ones anywhere
    const crit = (c.critique && Array.isArray(c.critique.problems)) ? c.critique.problems : [];
    for (const p of crit) { if (!p || !/high|medium/i.test(S(p.severity))) continue; const fixText = S(p.fix);
      if (/\b(placeholder|bracket|\[to confirm|confirm at|flagged for confirmation)\b/i.test(fixText + ' ' + S(p.issue))) continue;   // the contract: no brackets
      const part = p.location ? at(plain(S(p.location)).slice(0, 40)) || (overlap(p.location, md) > 0.6 ? related(p.location) : null) : null;
      if (!part || (!jobs.has(part.id) && !/high/i.test(S(p.severity)))) continue;
      add(part, 'Reviewer: ' + S(p.issue).replace(/[.;:]+$/, '') + (fixText ? '. Suggested fix: ' + fixText : '') + ' (apply it as advice to the reader; add no claim about the business and no number that is not in the sources)', /high/i.test(S(p.severity)) ? 0.75 : 0.25); }
    const sections = [...jobs.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const MAXS = 7; const chosen = sections.length > MAXS ? sections.slice().sort((a, b) => b.weight - a.weight).slice(0, MAXS).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))) : sections;
    return { sections: chosen.map(j => ({ id: j.id, heading: j.heading, text: j.text, problems: j.problems.slice(0, 12), cta: isCta(sp, sp.parts.find(p => p.id === j.id)) })),
      left_out: sections.length - chosen.length, length_note, page_words: w0, band: LB };
  };

  // ---------- 8. the editor's answer, merged back ----------
  const parseSections = (answer) => { const t = S(answer).replace(/\r/g, ''); const out = new Map(); const open = [];
    const re = /^=== SECTION (s\d+) ===[ \t]*\n([\s\S]*?)\n=== END \1 ===[ \t]*$/gm; let m;
    while ((m = re.exec(t))) out.set(m[1], m[2].replace(/^\n+|\s+$/g, ''));
    for (const s of t.matchAll(/^=== SECTION (s\d+) ===/gm)) if (!out.has(s[1])) open.push(s[1]);
    return { blocks: out, unfinished: open, marked: /^=== SECTION s\d+ ===/m.test(t) }; };
  // the external links the edit may use: the ones already in the page, the evidence plan, the run's facts, the verified sources
  const merge = (base, job, answer, opts) => {
    const o = opts || {}; const sp = split(base); const P = parseSections(answer); const log = { replaced: [], kept: [], unlinked: [], unfinished: P.unfinished.slice() };
    const allowed = new Set([...(o.allowed_urls || []), ...[...S(base).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1])].map(keyOf));
    const d = S(o.domain).replace(/^www\./, '');
    for (const j of (job.sections || [])) {
      const part = sp.parts.find(p => p.id === j.id); if (!part) continue;
      let t = P.blocks.has(j.id) ? P.blocks.get(j.id) : null;
      if (t == null || !t.trim() || P.unfinished.includes(j.id)) { log.kept.push(j.id); continue; }
      if (j.id === 's0') { if (!/^# /m.test(t)) { const h1 = (part.text.match(/^# .*$/m) || [''])[0]; if (h1) t = h1 + '\n\n' + t; } }
      else if (!/^## /.test(t)) t = part.text.split('\n')[0] + '\n\n' + t;
      // guessed URLs never survive: an external link that is neither in the page already nor in the sources of this run is unlinked
      t = t.replace(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m0, a, u) => { const h = hostOf(u); if ((d && (h === d || h.endsWith('.' + d))) || allowed.has(keyOf(u))) return m0; log.unlinked.push(u); return a; });
      const trail = (part.text.match(/\s*$/) || [''])[0] || '\n\n';
      part.text = t.replace(/\s+$/, '') + (trail.includes('\n\n') ? trail : '\n\n');
      log.replaced.push(j.id);
    }
    // the page's last line keeps its ending whitespace exactly as before
    const out = join(sp);
    return { md: /\n$/.test(S(base)) || !out.endsWith('\n\n') ? out : out.replace(/\n+$/, ''), log, marked: P.marked };
  };

  // ---------- 9. the system's own neutral rewrite ----------
  const unlinkDead = (md, dead, suggestions) => { let out = S(md); const done = [];
    for (const x of (dead || [])) { const u = S(x.url); if (!u) continue; const sug = S((suggestions || {})[u] || x.suggestion || '');
      const re = new RegExp('\\[([^\\[\\]]+)\\]\\(' + escRe(u) + '\\)', 'g'); let n = 0;
      out = out.replace(re, (m0, a) => { n++; return sug && /^https?:\/\//.test(sug) ? '[' + a + '](' + sug + ')' : a; });
      if (n) done.push({ url: u, replaced_with: sug && /^https?:\/\//.test(sug) ? sug : '', count: n }); }
    return { md: out, done }; };
  const deleteSection = (md, heading) => { const sp = split(md); const h = plain(S(heading).replace(/^#+\s*/, '')).toLowerCase();
    let hit = false; sp.parts = sp.parts.filter(p => { if (p.id !== 's0' && p.heading.toLowerCase() === h) { hit = true; return false; } return true; });
    if (!hit) { const re = new RegExp('^(#{3,4})\\s+' + escRe(S(heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm'); const src = S(md); const m = src.match(re);
      if (m) { const lvl = m[1].length; const a = m.index; const rest = src.slice(a + m[0].length); const nx = rest.search(new RegExp('^#{1,' + lvl + '}\\s', 'm')); const b = nx < 0 ? src.length : a + m[0].length + nx; return { md: src.slice(0, a) + src.slice(b), done: true }; }
      return { md, done: false }; }
    return { md: join(sp), done: true }; };
  const neutralize = (md0, cls, ctx) => {
    const c = ctx || {}; let md = S(md0); const removed = [];
    const take = (b, r) => { if (r.done) removed.push({ code: b.code, sentence: b.sentence || b.figure || b.stat || b.token || b.heading || b.url || b.quote || '', kind: b.kind || '', how: r.how || 'removed', text: r.text || '', rewrite: b.rewrite || null, ...(r.anchor ? { anchor: r.anchor } : {}) }); return r.md; };
    for (const b of cls.blocking.filter(x => x.tier === 'soft')) {
      if (b.code === 'claim') md = take(b, neutralSentence(md, b.sentence, c.domain, b.rewrite));
      else if (b.code === 'figure') { const tok = '[Confirm: ' + b.figure + ']'; const i = md.indexOf(tok) >= 0 ? md.indexOf(tok) : md.indexOf(b.figure); if (i >= 0) md = take(b, { md: removeAt(md, i, md.indexOf(tok) >= 0 ? tok.length : b.figure.length), done: true }); }
      else if (b.code === 'statistic') { const i = md.indexOf(b.stat); if (i >= 0) md = take(b, { md: removeAt(md, i, b.stat.length), done: true }); }
      else if (b.code === 'bracket') { const i = md.indexOf(b.token); if (i >= 0) md = take(b, { md: removeAt(md, i, b.token.length), done: true }); }
      else if (b.code === 'dead_link') { const r = unlinkDead(md, [{ url: b.url }], {}); md = take(b, { md: r.md, done: r.done.length > 0, how: 'unlinked' }); }
      else if (b.code === 'off_topic') md = take(b, deleteSection(md, b.heading));
      else if (b.code === 'guarantee' && b.quote) { const i = md.indexOf(b.quote.slice(0, 60)); if (i >= 0) md = take(b, { md: removeAt(md, i, Math.min(60, b.quote.length)), done: true }); }
      else if (b.code === 'testimonial') { const r = removeText(md, b.text); md = take(b, r); }
    }
    // [Price] and other masks the quality check left go with their sentence too
    for (let g = 0; g < 40; g++) { const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0]; md = removeAt(md, b.at, b.token.length); removed.push({ code: 'bracket', sentence: b.token, how: 'removed' }); }
    return { md: tidy(md), removed };
  };

  // ---------- 10. the client questions and the delivered status ----------
  // Owner decision (2026-10-28): EVERY statement about the business that nothing on file supports becomes a client question, with the
  // original specific sentence, the neutral wording the page carries until the client answers, and the choices yes (keep the specific
  // sentence) / edit (the client's own wording) / remove. Every other question that would genuinely strengthen the page (proof, numbers,
  // experience, credentials) is asked too. No limit: ranked by impact. Nothing blocks: an unanswered question leaves the page as it is.
  // Each question names the business-fact key its answer fills, so the answer is stored once and a later page never asks it again
  // (`stored` = the keys already on file), and is prefilled from the client's own pages or stored facts when they say something close.
  const CATEGORY = { proof: 'proof', experience: 'experience', credential: 'credential', deliverable: 'service', process: 'service', scope: 'service', terms: 'service',
    timeline: 'timeline', pricing: 'pricing', price: 'pricing', guarantee: 'guarantee', detail: 'detail', other: 'detail' };
  const IMPACT = { proof: 0.9, experience: 0.85, credential: 0.8, guarantee: 0.75, service: 0.7, pricing: 0.55, timeline: 0.55, detail: 0.45 };
  const slug = (t, n) => toks(plain(t)).filter(w => !/^\d+$/.test(w)).slice(0, n || 6).join('_').replace(/[^\p{L}\p{N}_&]+/gu, '').slice(0, 60) || 'item';
  const factKey = (category, text) => category + '.' + slug(text);
  // the category of a question from the brief, from its words (the brief may also name it, W0-E)
  const briefCategory = (t) => /result|case|client|outcome|project/i.test(t) ? 'proof' : /partner|certif|accredit|award|iso\b/i.test(t) ? 'credential' : /price|fee|cost/i.test(t) ? 'pricing'
    : /how long|week|month|timeline/i.test(t) ? 'timeline' : /experience|example|seen|lesson/i.test(t) ? 'experience' : 'detail';
  // W0-E (2026-10-29, page-quality PLAN Fix 5.4, R4 D6): what may be offered as an answer. 3299 offered "Deep UAE & GCC knowledge" (a
  // homepage slogan) as proof of UAE projects, "Does Microsoft Dynamics have ERP?" (a question) as the partner designations and "Dynamics 365
  // 8 min read" (blog listing chrome) twice; "Accept all" then stored them as business facts for every later page. A suggestion now has to
  // be a sentence (6 words or more, with a verb, not a question), not navigation or reading-time chrome, not from a listing page, not a
  // slogan (praise words, or the business name with no verb), and it has to answer the question's TYPE: proof names a project, client or
  // sector together with an outcome, or carries a number or a link; a credential names one (partner, certified, accredited, award, ISO...).
  // The business facts and the profile come first: the website is read only when they have nothing usable.
  const LISTING_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;   // = SM.isListing (_site_model.js)
  const isListingUrl = (u) => /^https?:\/\//i.test(S(u)) && LISTING_PATH.test(S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/[?#].*$/, '') || '/');
  const CHROME = /\b\d+\s*(?:min(?:ute)?s?)\.?\s*read\b|\bread (?:more|time)\b|\blearn more\b|\bshare (?:this|on)\b|\bposted (?:in|on|by)\b|all rights reserved|©|\bcopyright\b|\bsubscribe\b|\bnewsletter\b|\bcookies?\b|privacy policy|terms of (?:use|service)|\b(?:previous|next) (?:post|article)\b|^(?:tags?|categor(?:y|ies)|home|menu|search)\b|\s[|•·»>]\s.*\s[|•·»>]\s/i;
  const VERB = /\b(?:is|are|was|were|be|been|am|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must)\b|\b(?:we|i|they|you|it|he|she)\s+(?!and\b|or\b)\p{L}{2,}|\b\p{L}{3,}ed\b|\b(?:deliver|implement|help|serve|build|built|provide|support|migrate|run|ran|work|hold|held|offer|complete|reduce|cut|save|increase|achieve|win|won|certify|specialise|specialize|focus|design|develop|manage|use|cover|include|launch|grow|grew|make|made|take|took|bring|brought|lead|led|know|knew|become|became|get|got|give|gave|connect|integrate|host|deploy|start|cost|charge|need|require|keep|kept|go|went|move|cover|train|operate|partner|serve|handle|plan|test|audit|replace|upgrade)(?:s|es)?\b/iu;
  const SLOGAN = /\b(?:trusted|leading|premier|world[- ]class|best[- ]in[- ]class|award[- ]winning|cutting[- ]edge|innovative|one[- ]stop|seamless|unrivall?ed|unmatched|second to none|your (?:partner|trusted)|deep (?:\p{L}+ ){0,3}(?:knowledge|expertise)|proven expertise)\b/iu;
  const CREDENTIAL = /\b(?:partner(?:ship)?|certif\w*|accredit\w*|award(?:ed|s)?|iso\s?\d+|licen[cs]\w*|member(?:ship)?|badge|designation|registered|approved|chartered|qualified|specialization|specialisation|gold|silver)\b/i;
  const PROJECT = /\b(?:project|client|customer|implementation|rollout|roll-out|migration|deployment|go-live|case|engagement|bank|retail\w*|manufactur\w*|logistic\w*|health\w*|hospital\w*|government|public sector|trading|distribut\w*|financ\w*|insur\w*|construct\w*|hospitality|real estate|education|school|oil|energy|telecom\w*|pharma\w*|airline|aviation|ngo|charity)\b/i;
  const OUTCOME = /\b(?:reduc\w*|cut|sav\w*|increas\w*|improv\w*|faster|grew|growth|went live|go(?:es)? live|delivered|completed|achiev\w*|result\w*|outcome\w*|on time|on budget|within|down from|up from|from \S+ to)\b/i;
  const prefillProblem = (t, cat, names, source) => {
    const s0 = S(t).trim(); const n = s0.split(/\s+/).filter(Boolean).length;
    if (n < 6) return 'short'; if (/\?\s*$/.test(s0)) return 'question'; if (CHROME.test(s0)) return 'chrome'; if (isListingUrl(source)) return 'listing';
    if (!VERB.test(s0)) return 'no_verb';
    if (SLOGAN.test(s0) && !/\d/.test(s0)) return 'slogan';
    if (cat === 'proof' && !/\d|https?:\/\/|www\./i.test(s0) && !(PROJECT.test(s0) && OUTCOME.test(s0))) return 'not_proof';
    if (cat === 'credential' && !CREDENTIAL.test(s0)) return 'not_credential';
    return ''; };
  // the closest thing the client's own pages or stored facts already say: a sentence sharing at least half of the question's key words
  // `docs` are { source, text } (or plain strings); `opts` { category, names }: the category is read from the question when not given
  const prefillOf = (text, docs, opts) => { const o = opts || {}; const cat = S(o.category) || briefCategory(S(text)); const names = o.names || [];
    const list = (docs || []).map(d => typeof d === 'string' ? { source: '', text: d } : (d || {}));
    const first = (d) => /business facts|profile/i.test(S(d.source)) || !S(d.source);
    for (const group of [list.filter(first), list.filter(d => !first(d))]) { let best = null;
      for (const d of group) { const body = S(d.text); if (!body.trim() || isListingUrl(d.source)) continue;
        for (const sent of body.split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || t.length > 320) continue; const sc = Math.max(overlap(text, t), overlap(t, text));
          if (sc >= 0.5 && (!best || sc > best.score) && !prefillProblem(t, cat, names, d.source)) best = { prefill: t, source: S(d.source), score: +sc.toFixed(2) }; } }
      if (best) return best; }
    return null; };
  // the sentence in the delivered page that took the specific one's place (the editor's neutral rewrite), else none (left out). W0-E: only
  // inside the statement's own section when it is known (3299 q5's "neutral" was an unrelated checklist item two sections away)
  const neutralIn = (finalMd, sentence, section) => { let best = null; const h = plain(S(section)).toLowerCase();
    const part = h ? split(finalMd).parts.find(p => S(p.heading).toLowerCase() === h) : null; if (h && !part) return '';
    for (const sent of S(part ? part.text : finalMd).split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || /^#/.test(sent.trim())) continue; const sc = Math.min(overlap(sentence, t), overlap(t, sentence) + 0.2);
      if (sc >= 0.45 && (!best || sc > best.score)) best = { text: t, score: sc }; }
    return best ? best.text : ''; };
  // W0-E (PLAN Fix 5.1): each question has a home in the page, its SLOT, so an answer is worked into the sentence it changes instead of the
  // section that happens to share the most words: how an engagement starts, terms and consultations -> the call to action; a credential ->
  // the sentence that names the business (the partner or "why us" section); proof -> the decision section; pricing / timeline -> their
  // section; anything else -> the section the brief named (word overlap only breaks a tie inside the slot)
  const SLOT_CTA_Q = /\b(?:consult\w*|first (?:call|meeting|session|step)|discovery call|demo\b|free of charge|book(?:ing)?\b|get in touch|contact\w*|call to action|engagements? (?:start|begin)\w*|how (?:an |the |a )?(?:engagement|project|work) (?:start|begin)s?|terms|contract\w*|payment\w*|trial)\b/i;
  const slotOf = (q) => { const x = q || {}; const given = S(x.slot).toLowerCase(); if (/^(?:cta|credential|proof|pricing|timeline|named)$/.test(given)) return given;
    const cat = S(x.category || S(x.fact_key).split('.')[0]).toLowerCase(); const t = S(x.question);
    if (cat === 'terms' || SLOT_CTA_Q.test(t)) return 'cta'; if (cat === 'credential') return 'credential'; if (cat === 'proof' || cat === 'experience') return 'proof';
    if (cat === 'pricing' || cat === 'price') return 'pricing'; if (cat === 'timeline') return 'timeline'; return 'named'; };
  const SLOT_HEAD = { cta: /\b(?:talk to|contact|get started|next steps?|book|work with|get in touch|speak|consult\w*|let'?s talk|ready to)\b/i,
    credential: /\b(?:partner|why (?:choose|us|work)|about|who we are|our (?:team|experience|credentials|approach)|credential|certif\w*|accredit\w*)\b/i,
    proof: /\b(?:choos\w*|select\w*|partner|why|compare|which|results?|case|clients?|proof|experience|track record|our work)\b/i,
    pricing: /\b(?:cost|price|pricing|budget|fee|invest\w*|how much)\b/i, timeline: /\b(?:timeline|how long|time|duration|phase|steps?|process|implementation|plan\w*|roadmap)\b/i };
  const SLOT_SENT = { cta: /\b(?:consult\w*|contact|book|call|talk|get in touch|speak|demo|next step|reach|request|start)\b/i, credential: null, proof: null, pricing: /\b(?:cost|price|fee|budget|AED|USD|\$)\b/i, timeline: /\b(?:weeks?|months?|days?|phase|timeline|go-live)\b/i };
  // the section and the host sentence of a question's slot in a page (null when the page has no place for it)
  const slotIn = (md, q, names) => { const sp = split(md); const slot = slotOf(q); const hint = S(q.question) + ' ' + S(q.text); const nm = (names || []).filter(n => S(n).length >= 3);
    const body = sp.parts.filter(p => p.id !== 's0'); const last = sp.parts.length > 1 ? sp.parts[sp.parts.length - 1] : null;
    const named = (t) => nm.some(n => S(t).toLowerCase().includes(S(n).toLowerCase()));
    const byHeading = (h) => { const x = plain(S(h)).toLowerCase(); if (!x) return null; return sp.parts.find(p => S(p.heading).toLowerCase() === x) || (x.length > 8 ? sp.parts.find(p => S(p.heading).toLowerCase().includes(x) || x.includes(S(p.heading).toLowerCase())) : null) || null; };
    let part = null;
    if (slot === 'cta') part = (last && (SLOT_HEAD.cta.test(last.heading) || SLOT_SENT.cta.test(last.text) || /\]\(/.test(last.text)) ? last : null) || body.slice().reverse().find(p => SLOT_HEAD.cta.test(p.heading)) || null;
    else if (byHeading(q.section)) part = byHeading(q.section);   // the section the brief (or the question) named
    else if (slot !== 'named') { const cands = body.filter(p => p !== last || slot === 'credential').filter(p => SLOT_HEAD[slot].test(p.heading));
      const ranked = cands.map(p => ({ p, s: (named(p.text) ? 1 : 0) + overlap(hint, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s);
      part = ranked.length ? ranked[0].p : null;
      if (!part && (slot === 'credential' || slot === 'proof')) part = body.find(p => named(p.text) && p !== last) || null; }
    if (!part) return { slot, part: null, host: '' };
    // the host: the sentence of that section this answer changes (a call to action, the sentence naming the business, ...)
    const sents = []; for (const line of part.text.split('\n')) { const l = line.trim(); if (!l || /^#{1,6}\s/.test(l) || /^!\[/.test(l) || /^\s*\|/.test(l) || /^\[[^\]]+\]\([^)]+\)\.?$/.test(l)) continue;
      for (const s0 of sentencesOf(l.replace(LEAD, ''))) if (plain(s0).split(/\s+/).length >= 5) sents.push(s0); }
    const pref = slot === 'credential' || slot === 'proof' ? (t) => named(t) : SLOT_SENT[slot] ? (t) => SLOT_SENT[slot].test(t) : () => false;
    const scored = sents.map((t, i) => ({ t, i, s: (pref(t) ? 1 : 0) + overlap(hint, t) })).sort((a, b) => b.s - a.s || (slot === 'cta' ? b.i - a.i : a.i - b.i));
    const host = scored.length && scored[0].s >= 0.25 ? scored[0].t : '';   // a slot sentence, or one sharing a quarter of the question's words
    return { slot, part, host }; };
  // W0-E (PLAN Fix 5.2): an answer the editor only APPENDED: a new sentence at the end of its paragraph (or a paragraph of its own) whose
  // other sentences share under 20% of its content words. A host sentence the editor rewrote is not new (it keeps most of its old words).
  // Returns { sentence, share } or null.
  const appendedIn = (beforeText, afterText, answer) => {
    const lines = (t) => S(t).split('\n').map(l => l.trim()).filter(l => l && !/^#{1,6}\s/.test(l) && !/^!\[/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l));
    const beforeS = lines(beforeText).flatMap(l => sentencesOf(plain(l.replace(LEAD, ''))));
    const key = (x) => toks(x).join(' '); const seen = new Set(beforeS.map(key));
    let best = null;
    for (const l of lines(afterText)) { const ss = sentencesOf(plain(l.replace(LEAD, '')));
      ss.forEach((s0, i) => { const sc = overlap(answer, s0); if (sc > 0 && (!best || sc > best.sc)) best = { sc, s: s0, i, ss }; }); }
    if (!best || best.sc < 0.5 || seen.has(key(best.s))) return null;
    if (beforeS.some(b => overlap(b, best.s) >= 0.5 && overlap(best.s, b) >= 0.3)) return null;   // the host sentence, rewritten
    if (best.i !== best.ss.length - 1) return null;
    const share = overlap(best.s, best.ss.slice(0, best.i).join(' '));
    return share < 0.2 ? { sentence: best.s, share: +share.toFixed(2) } : null; };
  const questions = (o) => {
    const x = o || {}; const biz = S(x.business || 'your business'); const stored = new Set((x.stored || []).map(S));
    const out = []; const seen = new Set();
    const push = (q) => { const k = q.fact_key + '|' + S(q.original || q.question).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
      if (seen.has(k) || seen.has(q.fact_key + '|') || stored.has(q.fact_key)) return; seen.add(k); out.push(q); };
    // W0-A (PLAN Fix 1.6, R4 D2): a statement in the head (the meta description, the title) is search-result copy, never a client question;
    // every question says where its sentence stood
    const HEAD_WHERE = /^(?:meta|title|head)$/i; const headText = x.final_md ? plain(split(x.final_md).head) : '';
    const inHead = (c) => HEAD_WHERE.test(S(c.where)) || (!!headText && plain(c.sentence).length >= 12 && headText.includes(plain(c.sentence)));
    for (const c of (x.claims || [])) { if (!c || !c.sentence || inHead(c)) continue; const kind = S(c.kind || 'process'); const cat = CATEGORY[kind] || 'service';
      const rw = c.rewrite || {};
      // W0-E (PLAN Fix 5.3): a statement the system removed carries no neutral wording (c.neutral '') and its anchor; one with no record of
      // its removal is matched only inside its own section
      const original = clean(plain(c.sentence)); const neutral = c.neutral != null ? clean(c.neutral) : neutralIn(x.final_md, c.sentence, c.section);
      const pre = rw.suggestion ? { prefill: clean(plain(rw.suggestion)), source: 'your website or business facts' } : prefillOf(original, x.docs, { category: cat, names: x.names });
      push({ kind, category: cat, fact_key: factKey(cat, original), source: 'claim', blocks: false, action: rw.action || '', needs_client_fact: rw.needs_client_fact !== false,
        question: clean(rw.question ? rw.question : 'Is this true for ' + biz + '? "' + original + '"'),
        why: 'Nothing on file says it, so the page does not claim it' + (neutral ? ': it says "' + neutral.slice(0, 200) + '" instead' : ': it leaves it out') + '. Say yes and the specific sentence goes back in, and later pages can say it too.',
        original, neutral, in_page: neutral ? (c.how === 'cta' ? 'cta' : 'neutral') : 'left_out', section: S(c.section || ''), where: S(c.where || ''),
        ...(!neutral && c.anchor && typeof c.anchor === 'object' ? { anchor: { section: S(c.anchor.section).slice(0, 300), before: S(c.anchor.before).slice(0, 400), after: S(c.anchor.after).slice(0, 400), line_before: S(c.anchor.line_before).slice(0, 400) } } : {}),
        choices: ['yes', 'edit', 'remove'], answer_type: 'choice', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '',
        impact: Math.min(1, (IMPACT[cat] || 0.6) + (c.where === 's0' || c.cta ? 0.05 : 0)) }); }
    // W0-E (PLAN Fix 5.1, REVIEW_CODE M4): a brief question is { question, section, category } (the Strategy Brief's schema since section
    // 156); a plain string (a brief stored before it) is still read, its category from its words
    const BRIEF_CATS = { proof: 'proof', credential: 'credential', terms: 'terms', pricing: 'pricing', price: 'pricing', timeline: 'timeline', experience: 'experience', detail: 'detail' };
    for (const q0 of (x.brief || [])) { const o = q0 && typeof q0 === 'object' ? q0 : { question: q0 }; const t = clean(S(o.question).trim()); if (!t) continue;
      const kind = BRIEF_CATS[S(o.category).toLowerCase().trim()] || briefCategory(t); const cat = kind === 'terms' ? 'detail' : kind; const section = clean(plain(S(o.section))).slice(0, 200);
      const pre = prefillOf(t, x.docs, { category: cat, names: x.names });
      push({ kind, category: cat, fact_key: factKey(cat, t), source: 'brief', blocks: false, question: t, why: 'The brief found that this would make the page more convincing; the page is complete without it.',
        original: '', neutral: '', in_page: 'left_out', section, where: '', slot: slotOf({ category: kind, question: t }), choices: ['answer', 'skip'], answer_type: 'text', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.5 }); }
    for (const r of (x.brackets || [])) { if (!r || !r.question) continue; const cat = CATEGORY[r.kind] || 'detail'; const pre = prefillOf(r.question, x.docs, { category: cat, names: x.names });
      push({ kind: r.kind || 'detail', category: cat, fact_key: factKey(cat, S(r.token || r.question).replace(/^\[|\]$/g, '').replace(/^(author insight|confirm|owner)\s*:\s*/i, '')), source: 'bracket', blocks: false,
        question: clean(r.question), why: 'The writer needed this and nothing on file has it, so the page was written without it.',
        original: r.sentence ? clean(r.sentence) : '', neutral: '', in_page: 'left_out', section: '', where: '', slot: slotOf({ category: cat, question: r.question }), choices: ['answer', 'skip'], answer_type: 'text',
        prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.45 }); }
    out.sort((a, b) => b.impact - a.impact);
    return out.map((q, i) => ({ id: 'q' + (i + 1), rank: i + 1, use_for_future_pages: true, ...q, impact: +q.impact.toFixed(2) }));
  };
  const ACTION = {
    cut_off: 'start the page again (the complete draft could not be kept)',
    copied: 'rewrite the passages it repeats in your own words',
    duplicate_page: 'publish it as an update of your existing page for this search, or tell us how the new page differs',
    brand: 'write the business name the way you write it where the check found another form',
    author_profile: 'add the author\'s name, job title and a short bio to the business profile once',
    meta: 'write a meta description of 120 to 155 characters that says what the page answers',
    claim: 'delete the statement or confirm it in your business facts', figure: 'take out the figure or cite the page that states it',
    statistic: 'take out the number or cite the page that states it', bracket: 'fill in or delete the bracket', dead_link: 'replace or remove the link',
    off_topic: 'delete the section', guarantee: 'delete the guarantee', testimonial: 'delete the testimonial'
  };
  const deliver = (cls, opts) => {
    const o = opts || {};
    const blocking = cls.blocking.map(b => ({ code: b.code, text: b.text, action: ACTION[b.code] || '' }));
    const status = blocking.length ? 'not_ready' : (o.questions || []).length ? 'ready_with_questions' : 'ready';
    const label = status === 'ready' ? 'Ready to publish'
      : status === 'ready_with_questions' ? 'Ready to publish. A few answers from you would make it stronger'
        : 'Not ready to publish yet: ' + clean(blocking[0].text).replace(/^./, (x) => x.toLowerCase());
    const acts = [...new Set(blocking.map(b => b.action).filter(Boolean))];
    const next_step = status !== 'not_ready' ? '' : clean('Finish this draft by hand: ' + acts.join('; ') + '. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.');
    return { status, label, blocking, advisory: cls.advisory.map(a => ({ code: a.code, text: a.text })), next_step };
  };
  // what is still on the page of the blocking items after a deletion pass (a light re-check: a deletion can only take things away)
  const residual = (cls, md) => { const t = S(md); const left = cls.blocking.filter(b => {
      if (b.tier === 'hard') return b.code !== 'brand';
      if (b.code === 'claim') return t.includes(S(b.sentence));
      if (b.code === 'figure') return t.includes('[Confirm: ' + b.figure + ']');
      if (b.code === 'statistic') return t.includes(S(b.stat));
      if (b.code === 'bracket') return bracketsIn(t).some(x => x.token === b.token);
      if (b.code === 'dead_link') return t.includes('](' + b.url + ')');
      if (b.code === 'off_topic') return new RegExp('^#{2,4}\\s+' + escRe(S(b.heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm').test(t);
      if (b.code === 'guarantee') return !!b.quote && t.includes(b.quote.slice(0, 60));
      if (b.code === 'testimonial') return t.includes(S(b.text));
      return true; });
    const brand = cls.blocking.find(b => b.code === 'brand');
    return { ...cls, blocking: brand ? left.concat([brand]) : left, soft: left.filter(b => b.tier === 'soft').length }; };
  // everything a node needs to know about this run to apply the fixes, from the brief item (Parse Brief)
  const ctxOf = (prev, opts) => { const p = prev || {}; const b = p.content_brief || {}; const sg = p.style_guide || {}; const o = opts || {};
    // H2 (2026-10-27): the style guide holds the display name (`brand_form`) and the legal name (`legal_name`) apart; a row stored the old
    // way ("Nova& (legal name: Novaand systems LLC)") is read as the two here too
    const form = S(sg.brand_form).trim(); const legal = S(sg.legal_name).trim() || (form.match(/\(\s*legal(?: name)?\s*[:=-]?\s*([^)]+)\)/i) || [])[1] || '';
    const short = form.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const names = [...new Set([(p.site_profile || {}).business_name, (p.site_description || {}).business_name, short, S(p.domain).split('.')[0]].map(x => S(x).trim()).filter(x => x.length >= 3))];
    const live = new Set((p.internal_link_candidates || []).filter(x => x && !x.planned).map(x => keyOf(x.url)));
    const links = (b.internal_link_suggestions || []).filter(l => l && live.has(keyOf(l.url))).map(l => ({ url: S(l.url), anchor: S(l.anchor) }))
      .concat((p.internal_link_candidates || []).filter(x => x && !x.planned && x.title).map(x => ({ url: S(x.url), anchor: S(x.title).split(/\s+[|\-]\s+/)[0] })));
    return { keyword: S(p.keyword), domain: S(p.domain).toLowerCase().replace(/^www\./, ''), business: short || names[0] || S(p.domain) || 'your business', names,
      brand: short || form, wrong_forms: (sg.wrong_forms || []).map(S).filter(w => w.length >= 3 && w.length <= 40 && !/:/.test(w)), keep_forms: [legal.trim(), form !== short ? form : ''].filter(Boolean), legal_name: legal.trim(),
      brief_meta: S(b.meta_description).trim(),   // W0-A: PF.meta rebuilds a broken description from it first
      planned_slug: !!(p.ladder_id && S(p.ladder_target_url).trim()), ai_target: !!(p.ai_target && p.ai_target.question), snippet_targets: b.snippet_targets || [], outline: b.outline || [],
      internal_links: links, own_text: S(o.own_text || [p.business_facts, p.case_facts_text, p.proof_context].filter(Boolean).join(' ')), termRe: o.termRe || null,
      critique: o.critique || null, qa_marks: o.qa_marks || [], qa_figure_marks: o.qa_figure_marks || [] }; };
  return { EDIT_MAX, contract, bandOf, kindOf, split, join, span, removeAt, removeText, tidy, neutralSentence, bracketsIn, questionFor, fix, meta, metaProblem, fieldCheck, unmark, caseLike, brandHits, testimonials,
    classify, score, protect, better, plan, parseSections, merge, unlinkDead, deleteSection, neutralize, questions, deliver, residual, ctxOf, ACTION, prefillOf, prefillProblem, neutralIn, factKey, clean, words, plain, hostOf, keyOf, overlap,
    anchorAt, slotOf, slotIn, appendedIn, sentencesOf };
})();
// LLM-LIMITS (2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): is the Editor's page complete, and is it still the whole page?
// Production (techand.ai, exec 2195): the Editor answered 749 words that end mid-word ("Does the add-on cover gratu") where it was given a
// complete 1,804-word draft; the run took the cut answer as the new page and delivered half a page. The edit is now compared with the
// page it was given, CK.edit:
//   complete                 -> on to the quality check, as before (route `ok`)
//   cut off, first attempt   -> the Editor edits the same page once more (route `retry`; priced as a retry of its model node, R57)
//   cut off, second attempt  -> the page from before this edit is kept (it is complete; it already passed everything except the points
//                               this round asked to fix, which the quality check lists again for the owner) and the reason is recorded
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §6 rec. 2): the Editor now edits SECTIONS. It is given only the sections with a
// problem (*Page Candidates* -> *Verified Sources*, `page_fix.edit_job`) and answers one block per section; the blocks are merged into the
// page it was given and every other byte of that page is kept (PF.merge). A block that stops before its closing line is not used (the
// section keeps its text); an external link that is neither in the page already nor among the sources of this run (the evidence plan, the
// facts, the sources *Verified Sources* fetched) is unlinked, so a guessed address never reaches the page (exec 949: two guessed links,
// both 404). An answer with no section blocks is read as a whole page, as before.
const nr = (() => { try { const v = $('Verified Sources').first().json; if (v && typeof v.output === 'string' && v.page_fix) return v; } catch (e) {}
  try { return $('Needs Revision?').first().json || {}; } catch (e) { return {}; } })();
const items = $input.all();
const attempt = ($runIndex || 0) + 1;
const before = typeof nr.output === 'string' ? nr.output : '';
const out0 = items.length ? (items[0].json || {}) : {};
const answer = typeof out0.output === 'string' ? out0.output : '';
const qa = nr.content_qa || {};
const job = (nr.page_fix || {}).edit_job || null;
const P = PF.parseSections(answer);
const sectionMode = !!(job && (job.sections || []).length && P.marked);
let after = answer, merge_log = null;
if (sectionMode) {
  const brief = nr.content_brief || {};
  const allowed = [...(brief.evidence_plan || []).map(e => e && e.source_url), ...(nr.facts || []).map(f => f && f.url), ...(((nr.page_fix || {}).sources) || []).map(v => v && v.url)].filter(Boolean);
  const M = PF.merge(before, job, answer, { allowed_urls: allowed, domain: nr.domain });
  after = M.md; merge_log = M.log;
}
// was the edit ASKED to cut? Then a shorter page is the point, and only a much shorter one (or one that stops mid-way) is a cut-off
const askText = [qa.length_instruction, job && job.length_note, ...(Array.isArray(qa.warnings) ? qa.warnings : []), ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].join(' ');
const cut_requested = /\b(cut|shorten|trim|too long|over the (?:band|target)|above the (?:band|target)|reduce the length)\b/i.test(askText) || Number(qa.over_words || 0) > 0;
const e0 = CK.edit(before, after, { cut_requested });
// in section mode a block that stopped before its closing line is a cut answer too (the section kept its text, but the edit is incomplete)
const unfinished = sectionMode && merge_log && merge_log.unfinished.length ? merge_log.unfinished : [];
const e = unfinished.length && e0.complete ? { ...e0, complete: false, cut_off: true, reasons: ['the editor\'s answer stopped inside section ' + unfinished.join(', ') + ' before its closing line'] } : e0;
// The attempt of THIS quality round (the node runs once per round, plus once per retry). A retry loops straight back through the Editor
// to this node, so this node's previous run was a retry of this round exactly when it says so. If that run cannot be read, the count is
// taken from the runs n8n recorded (Editor runs beyond one per quality round are retries) and at most ONE retry is allowed in the whole
// run: whatever happens, this loop cannot run away.
let round_attempt = 1;
if ($runIndex > 0) {
  let readPrev = false;
  try { const prevRun = $('Edit Check (Editor)').all(0, $runIndex - 1); const p = prevRun && prevRun[0] && prevRun[0].json && prevRun[0].json.llm_check;
    if (p) { readPrev = true; if (p.retry) round_attempt = (Number(p.round_attempt) || 1) + 1; } } catch (err) { readPrev = false; }
  if (!readPrev) {
    const runsOf = (n) => { try { if (typeof $node === 'undefined') return 0; const r = Number($node[n].runIndex); return Number.isFinite(r) && r >= 0 ? r + 1 : 0; } catch (err) { return 0; } };
    const editorRuns = runsOf('Editor'), qaRounds = runsOf('Content QA');
    round_attempt = editorRuns > qaRounds && qaRounds > 0 ? 2 : 1;
  }
}
// the state the next quality check and *Page Candidates* read: one more editing round done, and what it changed
const pf = (kept) => ({ ...(nr.page_fix || {}), came_from: 'edit', edits: (Number((nr.page_fix || {}).edits) || 0) + 1, edit_job: null,
  last_edit: { mode: sectionMode ? 'sections' : 'page', kept_pre_edit_page: !!kept, ...(merge_log ? { replaced: merge_log.replaced, kept: merge_log.kept, unlinked: merge_log.unlinked, unfinished: merge_log.unfinished } : {}) } });
if (e.complete) {
  const note = round_attempt > 1 ? 'The editor\'s first answer stopped before the end of the page; it edited the page again and the second answer is complete.' : '';
  return items.map(i => ({ json: { ...i.json, output: after, page_fix: pf(false), llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: true, attempt, round_attempt, cut_requested, note, words_before: e.words_before, words_after: e.words_after } } }));
}
const why = e.reasons.join('; ');
if (round_attempt < 2) {
  return [{ json: { ...nr, llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: false, retry: true, attempt, round_attempt, cut_requested, reasons: e.reasons, last_line: e.last_line,
    words_before: e.words_before, words_after: e.words_after,
    note: 'The editor\'s answer stopped before the end of the page (' + why + '); it was asked to edit the page again.' } } }];
}
// second cut: in section mode the sections that came back complete are kept (the others keep their text) when the merged page is itself
// complete; otherwise the page from before this edit
const keepMerged = sectionMode && merge_log && merge_log.replaced.length > 0 && e0.complete;
if (!keepMerged && (!before || !CK.text(before).complete)) {
  throw new Error('The page could not be edited in full: the editor stopped before the end of the page twice (' + why + ') and there is no complete earlier version to keep. No page was delivered. Start the page again.');
}
return [{ json: { ...out0, output: keepMerged ? after : before, page_fix: pf(!keepMerged), llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: false, kept_draft: !keepMerged, attempt, round_attempt, cut_requested, reasons: e.reasons,
  last_line: e.last_line, words_before: e.words_before, words_after: e.words_after,
  note: keepMerged ? 'The editor\'s answer stopped inside a section twice (' + why + '): the sections it finished were used and the others kept their text.'
    : 'The editor\'s answer stopped before the end of the page twice (' + why + '), so the complete page from before that edit was kept. The points that edit was asked to fix are listed again below.' } } }];
