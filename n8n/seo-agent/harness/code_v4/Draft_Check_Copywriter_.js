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
// LLM-LIMITS (2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): is the Copywriter's page complete?
// n8n hands an answer the model stopped mid-way (its max_tokens ceiling, a stream that ended early) on as a success, so nothing upstream
// can tell. This node reads the page itself (CK.text):
//   complete                 -> on to the editorial review, unchanged (route `ok`)
//   cut off, first attempt   -> the Copywriter writes the page once more from the same brief (route `retry`); the second call is a run
//                               of its model node, so the cost settle prices it as a retry (R57: calls = the model node's runs)
//   cut off, second attempt  -> the run stops here with a plain reason: a cut page is never delivered, and no later step can repair it
const brief = $('Parse Brief').first().json || {};
const items = $input.all();
const attempt = ($runIndex || 0) + 1;
const out0 = items.length ? (items[0].json || {}) : {};
const md = typeof out0.output === 'string' ? out0.output : '';
const tw = Number(brief.target_word_count || (brief.content_brief || {}).target_word_count || (brief.content_brief || {}).word_count || 0) || 0;
const t = CK.text(md, { min_words: tw > 0 ? Math.round(tw * 0.35) : 0 });
if (t.complete) {
  const note = attempt > 1 ? 'The page writer\'s first answer stopped before the end of the page; it wrote the page again and the second answer is complete.' : '';
  return items.map(i => ({ json: { ...i.json, llm_check: { node: 'Copywriter', kind: 'page', complete: true, attempt, note, words: t.words } } }));
}
const why = t.reasons.join('; ');
if (attempt < 2) {
  return [{ json: { ...brief, llm_check: { node: 'Copywriter', kind: 'page', complete: false, retry: true, attempt, reasons: t.reasons, last_line: t.last_line, words: t.words,
    note: 'The page writer\'s answer stopped before the end of the page (' + why + '); it was asked to write the page again.' } } }];
}
throw new Error('The page could not be written in full: the writer stopped before the end of the page twice (' + why + '). No page was delivered and nothing was published. Start the page again.');
