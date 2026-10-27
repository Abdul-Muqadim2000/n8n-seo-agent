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
// R9 (2026-10-13): settles this monitor run's seo_run_ledger reservation. `dfs_usd` is the DataForSEO cost the run really measured where it
// knows it: the monitors add up the `cost` of every DataForSEO task they sent (AI Metrics / Pulse Metrics / Growth Metrics / Parse Backlinks
// all carry it as `cost_usd`). A run that measures nothing says so, so the figure is never silently invented.
//
// R31 (2026-10-14, FIX_PLAN §3.13): the Claude figure used to be `row.est_usd` unconditionally — so the `free_only` backlink check of
// exec 586 settled $0.05 of Claude although **no model node ran at all** (the Link Analyst's queue was empty), while telling the caller
// `cost_usd: 0`. The ledger and the customer-facing figure have to be the same number. AI_NODES is every Claude node of this workflow,
// written in at build time from the workflow itself; when none of them produced anything in this execution the run settles **nothing**
// for Claude and says why (CC.aiRun). When one did run, the figure is still the reservation and is still labelled an ESTIMATE: a monitor's
// agents report no token usage, which is the whole reason _cost_cal.js exists.
//
// B-A5 (2026-10-15, build section 62): the day was reconciled against the account, the RUN never was — and a run cannot say what it
// truly cost unless it happens to be the only one in flight. *DFS Balance End (…)* takes a second free `appendix/user_data` reading on
// the settle chain and *Load Run Ledger (…)* loads the rows around this run's window, so CC.dfsRun can attribute the move between the
// two readings to this run when no other row was open across it — and say so plainly when one was.
//
// B-C2 (2026-10-15, build section 84): and the Claude half stops being a reservation in the clothes of a measurement. R31 settled
// `row.est_usd` whenever any model node had run, which is the GUARD's figure and not this run's. Anthropic's free
// `/v1/messages/count_tokens` now sits on the MAIN path behind every agent of this workflow (*Prompt For Count (…)* →
// *Count Prompt (…)* → *Count Answer (…)* → *After Count (…)*), and AI_CALLS below — baked from this workflow's own agent nodes —
// says how to price each one. See the block itself for what stays modelled and why.
// MEASURED / ROW / AI_NODES / BAL_END / LEDGER / AI_CALLS / CAL are written in by the builder at build time.
// Shared cost kit (G23 + the estimate recalibration, 2026-10-13; FIX_PLAN G23, RESULTS §0b / §2.10).
//
// Two things were wrong with the money this engine reports.
//
// 1. **Claude's cost was a range, not a number.** Three Opus nodes stream (`streaming: true`, required above ~21k tokens because the
//    Anthropic SDK's 10-minute rule: `calculateNonstreamingTimeout` throws above 128000 * 10/60 = 21,333), and n8n records only
//    `tokenUsageEstimate` for them — which a Code node cannot read either, nor can it read the real `tokenUsage` of the non-streaming
//    nodes, because usage rides the `ai_languageModel` connection and the data proxy only ever reads `main`. The re-rating could put
//    Claude's spend no closer than "$1.6-3.0", and `seo_run_ledger.settled_usd` stored the per-mode *reservation* while every reader took
//    it for a measured cost. CC.callCost / CC.runCost price every Claude call from what the run really knows — the characters the prompt
//    actually interpolates, the characters the node answered with, and the thinking budget of its effort level — and every figure they
//    return carries `estimated: true` and a one-line basis. Nothing measured is ever folded into an estimate without saying so.
//
// 2. **The per-mode estimates were far from the money**, which is why the guard refused five customer runs that would have cost a
//    fraction of what it reserved (RESULTS §0b: `ai_visibility` reserved $0.06 and cost $0.79; backlinks $0.04 for $0.37; the full report
//    $0.25 for $0.41; the written page reserved $1.23 and cost about $0.46). CC.pick resolves one request to its estimate, and CC.readCal
//    / CC.calRow make that estimate **self-correcting**: when a run settles, the mode's rolling figure in `seo_cache` (`cost:<kind>:<mode>`)
//    moves toward what that run cost, and the estimate the guard then uses is `max(rolling x CC.HEADROOM, the recent maximum)` — so an
//    estimate can fall as a mode gets cheaper but can **never** sit below what the mode has actually cost recently. The shipped tables
//    stay the fallback for a mode with no history, and CC.CAP stops one freak run from locking the guard.
//
// 3. **The monthly reconciliation.** The character-based figure is an estimate, so it needs a reality check the engine cannot do by
//    itself: once a month the owner downloads the Anthropic Console usage export and `reconcile_claude_cost.py` compares it with the
//    month's ledger rows per model, then writes one correction factor per model family into `seo_cache` (`cost:factor:claude`).
//    CC.readCal picks those factors up and CC.callCost applies them, so the next month's estimates are already corrected.
//
// 4. **B-A8 / B-A5 (2026-10-15, build section 62).** Two of those figures stopped being estimates. The free Anthropic token counter now
//    counts the exact prompt and the exact answer of the three streaming Opus nodes on the main path, where a Code node can read them
//    (CC.countUsage, section 0b below), so only the thinking those calls did is still modelled; and every settle takes a second free
//    `appendix/user_data` reading so a run that was ALONE in flight is costed from the account itself (CC.dfsRun, section 5c).
//
// Used by: Rate Limit and Run Ledger Row (the guard), the five report builders' run ledger, Run Ledger Settle, Cost Calibration Row,
// the monitors' ledger settle, reconcile_claude_cost.py and harness scenarios S60 and S72.
const CC = (() => {
  // Anthropic list prices per MILLION tokens (the baseline the re-rating priced its token counts at). A model we do not know is priced
  // at the dearest one we use: an unknown model must never make a run look cheaper than it is.
  const PRICES = {
    'claude-opus-5-5': { in: 4, out: 20 }, 'claude-opus-5': { in: 4, out: 20 },
    'claude-sonnet-5-5': { in: 2, out: 10 }, 'claude-sonnet-5': { in: 2, out: 10 },
    'claude-haiku-4-5-20251001': { in: 1, out: 5 }, 'claude-haiku-4-5': { in: 1, out: 5 },
  };
  const UNKNOWN = { in: 4, out: 20 };
  // English prose and the JSON the prompts interpolate both sit near 3.7 characters a token for Claude's tokeniser; a lower figure would
  // flatter the estimate, so this is the conservative end of what the live runs showed.
  const CHARS_PER_TOKEN = 3.7;
  // adaptive thinking spends part of maxTokensToSample before the answer, and it counts as OUTPUT tokens (CLAUDE.md: thinking tokens count
  // against maxTokensToSample). Share of the budget by effort, from the three Opus nodes of exec 521 (27,365 in / 16,426 out reported as
  // `tokenUsageEstimate` against ~11k tokens of real answer).
  const THINK_SHARE = { low: 0.05, medium: 0.1, high: 0.2 };
  // B-8 / A-27 (re-rating 2026-10-17): that budget share is right for nothing we can check. On the NON-streaming adaptive-thinking
  // nodes n8n records the real `tokenUsage`, whose output count INCLUDES the thinking (Anthropic bills thinking as output), and on
  // execs 760 / 764 / 765 / 767 / 770 it exceeded the counted answer by about 50 tokens a call (Content Reviewer 2,258 vs 2,208;
  // 3,959 vs 3,909; 1,535 vs 1,484) — while the budget share added 1,638-3,277 per node and put the ledger 19-31% above n8n. Adaptive
  // thinking at low / medium effort mostly does not think on these tasks. So a non-streaming call is modelled at the thinking it was
  // SEEN to do, a little above the measured gap; only a streaming call (where n8n reports no usage, so nothing can check it) keeps the
  // budget share, and its basis says so.
  const THINK_SEEN = 64;
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r4 = (v) => +n0(v).toFixed(4);
  const family = (model) => {
    const m = String(model || '').toLowerCase();
    return /opus/.test(m) ? 'opus' : /sonnet/.test(m) ? 'sonnet' : /haiku/.test(m) ? 'haiku' : 'other';
  };
  const priceOf = (model) => PRICES[String(model || '')] || PRICES[String(model || '').replace(/-\d{8}$/, '')] || UNKNOWN;
  const tokensOf = (chars) => Math.ceil(n0(chars) / CHARS_PER_TOKEN);

  // ---- 0b. B-A8 (2026-10-15): the tokens Anthropic itself counted -------------------------------------------------------------
  // Everything below used to be an estimate, because nothing a Code node can reach reports token usage. That was checked against the
  // running instance on 2026-10-15 rather than assumed, and the three places it dies are:
  //   * `@langchain/anthropic` 1.5.6 `_generate`: for a STREAMING call it returns `{ generations: [{ text, message }] }` with **no
  //     `llmOutput`** at all — the usage Anthropic sends on `message_delta` survives only on `message.usage_metadata`;
  //   * n8n's `LmChatAnthropic` reads `result?.llmOutput?.usage`, finds nothing and falls back to `{input_tokens: 0, output_tokens: 0}`,
  //     so `N8nLlmTracing` records `tokenUsageEstimate` (a tiktoken guess) instead of `tokenUsage`;
  //   * and even for the NON-streaming nodes, where n8n does record real `tokenUsage`, it lands on the model node's `ai_languageModel`
  //     connection — and `WorkflowDataProxy` only ever reads `taskData.data.main`, so `$('Claude - Critic')` throws "No data found from
  //     `main` input". No Code node in any workflow can read a single reported token.
  // So the measurement has to arrive on the main path, and it does: *Count Prompt (…)* / *Count Answer (…)* ask Anthropic's **free**
  // `/v1/messages/count_tokens` endpoint to count the exact prompt the run rendered and that prompt plus the exact answer it got back.
  // `counted` carries the two answers; the difference is the answer's own tokens, counted by the same tokeniser that bills them.
  // What a counter cannot see is the THINKING the model did before answering: those tokens are billed as output and are never returned.
  // They stay modelled from the node's effort budget and are the only part of such a call that is still an estimate — Rule 1: a figure
  // is measured and says what measured it, modelled and says from what, or not available and says why.
  const COUNTER = 'Anthropic /v1/messages/count_tokens';
  const countUsage = (c) => {
    const o = (c || {}).counted;
    if (!o || typeof o !== 'object') return null;
    const p = Math.round(n0(o.prompt_tokens)), t = Math.round(n0(o.total_tokens));
    if (!(p > 0) || !(t > p)) return null;          // one of the two probes did not answer: nothing usable, fall back and say so
    return { in_tokens: p, out_tokens: t - p, source: String(o.source || COUNTER) };
  };

  // ---- 1. one Claude call ----------------------------------------------------------------------------------------------------
  // `call`: { node, model, prompt_chars, output_chars, max_tokens, effort, streaming, calls, usage, counted }
  // Three ways to price it, best first, and the answer always says which one it used:
  //   `usage`    — reported token usage (promptTokens / completionTokens). Whole call MEASURED, characters ignored. n8n never hands
  //                this to a Code node today (see above), but a call that ever does report it must never be replaced by an estimate.
  //   `counted`  — B-A8 / B-F1: { prompt_tokens, total_tokens, rounds } from the free token counter — the TOTAL it answered with and
  //                how many of this node's calls that total covers. Input and answer are MEASURED; only the thinking budget stays
  //                modelled, and only that part lands in `estimated_usd`.
  //   characters — the fallback, everything estimated, exactly as before.
  const callCost = (call, factors) => {
    const c = call || {}, f = factors || {};
    const model = String(c.model || ''), fam = family(model), price = priceOf(model);
    const factor = n0(f[fam]) > 0 ? Number(f[fam]) : 1;
    const calls = Math.max(1, Math.round(n0(c.calls) || 1));
    const u = c.usage && (n0(c.usage.promptTokens) || n0(c.usage.completionTokens)) ? c.usage : null;
    let cnt = u ? null : countUsage(c);
    // R47 / R69 / R80 (2026-10-16, re-rating 2026-10-15): the counter was sent `String(output)`, so every STRUCTURED answer reached it as
    // the 15 characters "[object Object]" and came back as 4-6 answer tokens labelled "measured" — 16 agents, 15-67% low. The builders
    // now send the answer as the model wrote it (JSON for a parsed object); this is the net under that fix. A count that saw far fewer
    // answer tokens than the answer's own characters can hold (under a quarter of the characters-a-token figure, on an answer of more
    // than 200 characters a call) did not see the answer, so it is not a measurement: the call falls back to characters and says why.
    let unseen = '';
    if (cnt) {
      const cov = Math.max(1, Math.round(n0((c.counted || {}).rounds) || 1));
      const perChars = n0(c.output_chars) / cov, perCounted = cnt.out_tokens / cov;
      if (perChars > 200 && perCounted < (perChars / CHARS_PER_TOKEN) * 0.25) {
        unseen = 'the token counter answered for ' + cnt.out_tokens + ' answer token(s) where the answer holds ' + Math.round(n0(c.output_chars))
          + ' characters, so it did not see the answer and is not used';
        cnt = null;
      }
    }
    // R57 (2026-10-16): an agent that n8n re-ran after a failed answer (a parser that refused the format; `retryOnFail`) called its model
    // twice and kept one answer. `retries` is how many extra model runs the model node itself recorded; they are in `calls` and priced
    // as repeats of the call the run can see.
    const retries = Math.max(0, Math.round(n0(c.retries)));
    // how many of this node's `calls` the two counts actually cover, and what ONE of those calls cost in tokens.
    // B-F1 (2026-10-15, build section 76): `counted` carries the TOTAL the counter answered with and `rounds` says how many calls
    // that total covers, because a node may answer once per item — the keyword screen runs once per chunk of 80 candidates, so its
    // counter chain fires once per chunk and the chunks are summed. With one call the two readings are the same number, which is
    // why every figure section 62 measured is unchanged. The Editor still runs once per QA round with only the LAST round on the
    // main path, so the rest are REPEATED from it and stay modelled, not measured.
    const covers = cnt ? Math.max(1, Math.round(n0((c.counted || {}).rounds) || 1)) : 0;
    const rounds = cnt ? Math.min(calls, covers) : 0;
    const perIn = cnt ? cnt.in_tokens / covers : 0, perOut = cnt ? cnt.out_tokens / covers : 0;
    // LLM-LIMITS (2026-10-27, llm_limits.py): every Claude node now has a ceiling far above what it writes (thinking + the whole output
    // must always fit), so the ceiling is room, not spend. The call table carries `think_model`, the thinking one call is priced at:
    // 'seen' = the measured THINK_SEEN figure, a number = the effort budget the node was priced at before the ceiling was raised.
    // A call without it (an older table, a hand-built spec) keeps the rule it always had.
    const tm = c.think_model;
    const seenThink = !!c.effort && (tm === 'seen' || ((tm === undefined || tm === null || tm === '') && !c.streaming));   // B-8 / A-27: a non-streaming call is modelled at the thinking it was seen to do
    const declaredThink = !seenThink && tm !== undefined && tm !== null && tm !== '' && Number.isFinite(Number(tm)) ? Math.max(0, Math.round(Number(tm))) : null;
    const budget = !c.effort ? 0 : seenThink ? THINK_SEEN * calls
      : (declaredThink !== null ? declaredThink : Math.round(n0(c.max_tokens) * (THINK_SHARE[String(c.effort)] || 0))) * calls;
    const think = u ? 0 : budget;
    const inTok = u ? n0(u.promptTokens) : cnt ? Math.round(perIn * calls) : tokensOf(c.prompt_chars) * calls;
    const outTok = u ? n0(u.completionTokens) : (cnt ? Math.round(perOut * calls) : tokensOf(c.output_chars) * calls) + think;
    const price1 = (i, o) => r4((n0(i) / 1e6) * price.in * factor + (n0(o) / 1e6) * price.out * factor);
    const usd = price1(inTok, outTok);
    // which half of THIS call is a measurement. A reported usage measures everything; a counted call measures the rounds the counter
    // saw, minus the thinking it cannot see; a character-priced call measures nothing.
    const measured_usd = u ? usd : cnt ? price1(Math.round(perIn * rounds), Math.round(perOut * rounds)) : 0;
    const estimated_usd = r4(usd - measured_usd);
    const retried = retries > 0 ? '; ' + retries + ' of the ' + calls + ' model call(s) were a retry after a failed answer (n8n asked again), priced as a repeat' : '';
    return { node: String(c.node || ''), model, family: fam, calls, retries, in_tokens: inTok, out_tokens: outTok, think_tokens: think,
      usd, measured_usd, estimated_usd, measured: !!(u || cnt) && estimated_usd <= 0,
      counted: !!cnt, counted_rounds: rounds, counter: cnt ? cnt.source : '', streaming: !!c.streaming, factor, count_unseen: !!unseen,
      basis: u ? 'measured: the token usage this call reported' + retried
        : cnt ? 'measured: ' + cnt.source + ' counted ' + cnt.in_tokens + ' prompt and ' + cnt.out_tokens + ' answer token(s)'
            + (covers > 1 ? ' across ' + covers + ' call(s)' : '')
            + (calls > rounds ? ', repeated for the ' + (calls - rounds) + ' round(s) the counter did not see' : '')
            + (think > 0 ? '; the ' + think + ' thinking token(s) it cannot see are modelled ' + (seenThink
              ? 'at the ' + THINK_SEEN + ' a call n8n\'s reported output was seen to exceed the counted answer by (2026-10-17)'
              : 'from the ' + String(c.effort) + ' effort budget') : '')
            + retried
            + (estimated_usd > 0 ? ' ($' + estimated_usd.toFixed(4) + ' of $' + usd.toFixed(4) + ' is modelled)' : '')
        : 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token'
            + (think > 0 ? ' plus the thinking budget' : '') + retried + (unseen ? '; ' + unseen : '') };
  };

  // ---- 2. one run's Claude cost ---------------------------------------------------------------------------------------------
  // Measured and estimated money are kept apart and both are reported; `estimated` is true as soon as one cent of it is an estimate.
  // B-A8 (2026-10-15): the split is now taken PER CALL, not per call-bucket. A node whose tokens Anthropic counted contributes its
  // prompt and answer to `measured_usd` and only its modelled thinking budget to `estimated_usd` — before this, one estimated cent
  // anywhere in a call threw the whole call's money into the estimated half.
  const runCost = (calls, factors) => {
    const out = { usd: 0, measured_usd: 0, estimated_usd: 0, estimated: false, calls: 0, in_tokens: 0, out_tokens: 0,
      by_node: {}, models: {}, streaming_nodes: [], counted_nodes: [], think_usd: 0, basis: '' };
    const charNodes = [];
    for (const c of (calls || [])) {
      const r = callCost(c, factors);
      if (!r.usd && !r.calls) continue;
      out.usd = r4(out.usd + r.usd);
      out.measured_usd = r4(out.measured_usd + r.measured_usd);
      out.estimated_usd = r4(out.estimated_usd + r.estimated_usd);
      out.calls += r.calls; out.in_tokens += r.in_tokens; out.out_tokens += r.out_tokens;
      if (r.node) out.by_node[r.node] = { usd: r.usd, model: r.model, in_tokens: r.in_tokens, out_tokens: r.out_tokens,
        measured_usd: r.measured_usd, estimated_usd: r.estimated_usd, estimated: !r.measured, counted: r.counted, basis: r.basis };
      out.models[r.family] = r4((out.models[r.family] || 0) + r.usd);
      if (r.counted) { if (r.node) out.counted_nodes.push(r.node); out.think_usd = r4(out.think_usd + r.estimated_usd); }
      else if (r.measured_usd <= 0 && r.node) charNodes.push(r.node);
      // "reports no token usage" is only true of a streaming node nothing measured; a counted one reports its tokens through the counter
      if (r.streaming && !r.counted && !r.measured && r.node) out.streaming_nodes.push(r.node);
    }
    out.estimated = out.estimated_usd > 0;
    out.measured_share = out.usd > 0 ? +((out.measured_usd / out.usd) * 100).toFixed(1) : null;
    const counted = out.counted_nodes.length
      ? '; $' + out.measured_usd.toFixed(4) + ' of it is measured — ' + COUNTER + ' counted the prompt and the answer of '
        + out.counted_nodes.length + ' node(s) (' + out.counted_nodes.join(', ') + ')'
        + (out.think_usd > 0 ? ' and only their $' + out.think_usd.toFixed(4) + ' of thinking is modelled from the effort budget' : '')
      : '';
    out.basis = out.estimated
      ? (charNodes.length || !out.counted_nodes.length
          ? 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token plus the thinking budget, at the Anthropic list prices'
            + (out.streaming_nodes.length ? ' (' + out.streaming_nodes.length + ' streaming node(s) report no token usage: ' + out.streaming_nodes.join(', ') + ')' : '')
            + (counted ? counted : (out.measured_usd > 0 ? '; $' + out.measured_usd.toFixed(4) + ' of it is measured token usage' : ''))
          : 'measured: ' + COUNTER + ' counted the prompt and the answer of every call (' + out.counted_nodes.join(', ')
            + '); the $' + out.think_usd.toFixed(4) + ' of thinking no counter can see is modelled from the effort budget')
      : out.usd > 0 ? 'measured: reported token usage at the Anthropic list prices' : 'no Claude call ran';
    return out;
  };

  // ---- 3. the per-mode estimates the guard reserves -------------------------------------------------------------------------
  // Shipped defaults, recalibrated on 2026-10-13 from the measured runs of docs/system-review-2026-10-13/RESULTS.md (both passes).
  // `ai` = Claude money, `dfs` = DataForSEO money. Every value is ABOVE the measured figure beside it and never below it.
  const EST = {               // measured Claude cost of that run →
    content: 0.8,             // 0.587 (exec 521; $0.438 of it the three Opus streaming nodes) — was 1.20
    report: 0.16,             // 0.105 (exec 519, the follow-up keyword report) — was 0.30
    verdict: 0.16,            // 0.108 (exec 486) — was 0.20
    discover: 0.24,           // 0.165 (exec 518) — was 0.35
    ladder: 0.18,             // 0.115 (exec 495) — was 0.55
    full: 0.08,               // 0.049 (exec 523) — was 0.25
    site_audit: 0,            // 0     (execs 497 / 513: an audit calls no model)
    describe: 0.03,           // 0.012 (exec 485)
    ai_visibility: 0.14,      // 0.095 (exec 526) — was 0.06, the worst of the five refusals
    backlinks: 0.06,          // 0     this run; the Link Analyst does run on a full check — was 0.04
    track: 0, published: 0, checkin: 0, profile: 0, case_study: 0,   // these spawn the work that costs; each spawn reserves its own row
  };
  const DFS_EST = {           // measured DataForSEO cost of that run →
    crawl: 0.09,              // 0.09   (execs 497 and 513, both exactly)
    full: 0.55,               // 0.4094 (exec 523) — was 1.00, set before D7 stopped the report paying for WHOIS
    content: 0.04,            // 0.0221 (exec 521) — was 0.08
    verdict: 0.04,            // 0.0221 (exec 486) — was 0.06
    report: 0.04,             // 0.0221 (exec 519)
    discover: 0.40,           // 0.2552 (exec 518) + 16 live checks now 30 deep with the AI Overview (+$0.004 each, KW-SERP 2026-10-21) = 0.3192 — was 0.34
    ladder: 0.31,             // 0.1162 (exec 495) + 24 results-page calls at $0.006 (30 deep + AI Overview, KW-SERP 2026-10-21) = 0.2602 — was 0.21
    ai_visibility: 0.95,      // 0.7946 (exec 526) — was 0.60, below the money
    backlinks: 0.5,           // 0.3727 (execs 528 / 529)
    assess: 0.04,             // 0.0254 per check (execs 487-489) + its results page 30 deep with the AI Overview ($0.006, KW-SERP 2026-10-21) = 0.0314 — was 0.034
  };
  const ALPHA = 0.3;          // how fast the rolling figure follows the last settle
  const HEADROOM = 1.25;      // the guard reserves a quarter more than the rolling figure
  const KEEP = 8;             // the recent window whose maximum the estimate may never fall below
  const CAP = 5;              // and never more than five times the shipped default: one freak run may not lock the guard
  const PANEL_QUOTE_MAX = 150;   // W2-FIX: an on-demand AI panel quote is taken up to AIP's max_run_usd (v5/code/_ai_panel.js LIMITS), never above
  const calKey = (kind, mode) => 'cost:' + kind + ':' + mode;
  const FACTOR_KEY = 'cost:factor:claude';
  const MODEL_PREFIX = 'cost:model:';   // one row per model family: what this engine thinks it spent on it THIS month

  // which estimate keys a request uses. One source for Rate Limit, Run Ledger Row, Run Ledger Settle and the reconciliation.
  const keysFor = (kind, d) => {
    const r = d || {}, m = String(r.mode || '');
    if (kind === 'ai') {
      const k = m === 'site_description' ? ['describe']
        : m === 'audit' ? [r.include_full_report ? 'full' : 'site_audit']
        : m === 'discover' ? ['discover']
        : m === 'keyword' ? [r.verdict_only ? 'verdict' : (r.include_content ? 'content' : 'report')]
        : m === 'backlinks' ? (r.free_only ? [] : ['backlinks'])
        : (m && EST[m] !== undefined) ? [m] : [];
      // R101 (2026-10-16, re-rating D-5): a describe run keeps `need_site_description` on (Use Cached Description leaves it set for
      // `site_description`), so its estimate was describe + describe ($0.06 for a $0.03 mode). The extra key is for OTHER modes only.
      if (r.need_site_description && !k.includes('describe')) k.push('describe');
      return k;
    }
    return m === 'audit' ? (r.include_full_report ? ['full'] : ['crawl'])
      : m === 'discover' ? (r.include_full_report ? ['discover', 'full'] : ['discover'])
      : m === 'keyword' ? [r.verdict_only ? 'verdict' : (r.include_content ? 'content' : 'report')]
      : m === 'backlinks' ? (r.free_only ? [] : ['backlinks'])
      : (m && DFS_EST[m] !== undefined) ? [m] : [];
  };

  // the stored rows of seo_cache (kind 'cost') as one object: a stat per mode per kind, plus the reconciliation's model factors
  const readCal = (rows) => {
    const cal = { ai: {}, dfs: {}, models: {}, factors: {}, factor_note: '', rows: 0 };
    for (const row of (rows || [])) {
      const key = String((row || {}).key || '');
      let v = {}; try { v = JSON.parse(String(row.value || '{}')) || {}; } catch (e) { v = {}; }
      if (key.indexOf(MODEL_PREFIX) === 0) {
        cal.models[key.slice(MODEL_PREFIX.length)] = { month: String(v.month || ''), usd: n0(v.usd), runs: n0(v.runs), updated_at: String(v.updated_at || '') };
        cal.rows++;
        continue;
      }
      if (key === FACTOR_KEY) {
        for (const f of ['opus', 'sonnet', 'haiku', 'other']) if (n0(v[f]) > 0) cal.factors[f] = Number(v[f]);
        cal.factor_note = String(v.note || v.month || '');
        cal.rows++;
        continue;
      }
      const m = key.match(/^cost:(ai|dfs):(.+)$/);
      if (!m) continue;
      cal[m[1]][m[2]] = { mean: n0(v.mean), max: n0(v.max), last: n0(v.last), n: n0(v.n),
        recent: (Array.isArray(v.recent) ? v.recent : []).map(n0), measured: !!v.measured, updated_at: String(v.updated_at || row.updated_at || '') };
      cal.rows++;
    }
    return cal;
  };

  // the estimate for ONE key: the shipped default until the mode has history, then the rolling figure with headroom, and never below
  // what the mode cost in its last CC.KEEP settles.
  const estOf = (kind, key, cal) => {
    const def = n0((kind === 'ai' ? EST : DFS_EST)[key]);
    const st = ((cal || {})[kind] || {})[key];
    if (!st || !st.n) return { usd: def, source: 'default', floor: 0, def };
    // the floor is what the mode has actually cost in its last CC.KEEP settles and is absolute: an estimate may never sit below it.
    // CC.CAP bounds only the rolling part, so a runaway average cannot lock the guard while a genuinely dearer mode still reserves
    // what it costs.
    const recentMax = Math.max(n0(st.max), ...(st.recent || []).map(n0));
    const rolling = +(n0(st.mean) * HEADROOM).toFixed(4);
    const capped = def > 0 ? Math.min(rolling, def * CAP) : rolling;
    return { usd: r4(Math.max(capped, recentMax)), source: 'calibrated', floor: r4(recentMax), def, n: st.n };
  };

  // B-9: how many 200-page plain crawls an audit's crawl is. DataForSEO on-page charges per crawled page, and a page rendered with
  // JavaScript costs 4x (exec 739: $0.36 quoted for 200 pages against $0.09). Pages default to 200, as Normalize Input does.
  const CRAWL_BASE_PAGES = 200, CRAWL_JS_MULT = 4;
  const crawlFactor = (d) => { const r = d || {}; const pages = n0(r.crawl_max_pages) > 0 ? n0(r.crawl_max_pages) : CRAWL_BASE_PAGES;
    const js = r.crawl_js === true || /^(true|yes|1)$/i.test(String(r.crawl_js || ''));
    return +((pages / CRAWL_BASE_PAGES) * (js ? CRAWL_JS_MULT : 1)).toFixed(4); };

  // one request -> what it reserves. `room` is the extra the case-study intake holds back for the page run it spawns.
  const pick = (kind, d, cal) => {
    const keys = keysFor(kind, d);
    let usd = 0, source = 'default', floor = 0;
    // B-9 (re-rating 2026-10-17): the crawl figure is one 200-page plain crawl, whatever the request asked for. Exec 739 asked for a
    // JavaScript crawl ($0.36 quoted for 200 pages, 4x the plain one) and was told $0.11. An audit's crawl is now scaled by the pages it
    // may crawl and by JavaScript (CC.crawlFactor) — the same formula as the app's app/shared/src/cost.ts `crawlFactor`.
    const cf = (kind === 'dfs' && String((d || {}).mode) === 'audit') ? crawlFactor(d) : 1;
    for (const k of keys) { const e = estOf(kind, k, cal); usd += e.usd; floor += e.floor; if (e.source === 'calibrated') source = 'calibrated';
      if (cf !== 1 && k === 'crawl') usd += e.usd * (cf - 1);
      if (cf !== 1 && k === 'full') usd += n0(DFS_EST.crawl) * (cf - 1); }
    const room = (kind === 'ai' && String((d || {}).mode) === 'case_study') ? estOf('ai', 'content', cal).usd : 0;
    // W2-FIX (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-FIX.md item 4): an on-demand AI visibility check asks the website's WHOLE panel
    // (its size, engines and options), not the 8-question run the table above was measured on. The web app quotes that panel with the engine's
    // own formula (aiOnDemandRunCost = AIP.cost's full run) and sends it as panel_quote_dfs_usd / panel_quote_ai_usd; the reservation takes the
    // quote when it is LARGER (a caller can only make the guard stricter), never more than PANEL_QUOTE_MAX (AIP's max_run_usd).
    let quoted = 0;
    if (String((d || {}).mode) === 'ai_visibility') {
      const q = n0(kind === 'dfs' ? (d || {}).panel_quote_dfs_usd : (d || {}).panel_quote_ai_usd);
      if (q > usd) { quoted = Math.min(q, PANEL_QUOTE_MAX); usd = Math.max(usd, quoted); }
    }
    // `key` is the PRIMARY estimate key and the one the rolling figure is stored under, so what a settle teaches is read back by the next
    // run of the same shape; `label` names every key the request used (a run that also needs a site description adds `describe`, which
    // only makes that mode's figure a shade conservative — the safe direction).
    return { usd: r4(usd), keys, key: keys[0] || '', label: keys.join('+'), source, floor: r4(floor), room: r4(room),
      crawl_factor: cf,
      basis: (keys.length ? (source === 'calibrated' ? 'calibrated from this mode\'s last settled runs (never below $' + r4(floor).toFixed(4) + ', what it recently cost)' : 'the shipped estimate for ' + keys.join(' + ') + ' (no settled run of this mode yet)') : 'this mode spends nothing here')
        + (cf !== 1 ? '; the crawl scaled x' + cf + ' (up to ' + (n0((d || {}).crawl_max_pages) || CRAWL_BASE_PAGES) + ' pages'
          + (crawlFactor({ crawl_max_pages: CRAWL_BASE_PAGES, crawl_js: (d || {}).crawl_js }) > 1 ? ', rendered with JavaScript at 4x a page' : '') + ')' : '')
        + (quoted ? '; the website\'s whole panel as quoted ($' + r4(quoted).toFixed(4) + (n0((d || {}).panel_quote_panel) ? ', ' + n0((d || {}).panel_quote_panel) + ' questions' : '') + ', its engines and options)' : ''),
      panel_quoted: r4(quoted) };
  };

  // what a settle writes back: the rolling figure moves toward this run's amount, the recent window keeps the floor honest.
  const calStat = (prev, amount, measured) => {
    const a = r4(amount), p = prev && n0(prev.n) ? prev : null;
    const recent = [...((p && p.recent) || []), a].slice(-KEEP);
    return { n: (p ? n0(p.n) : 0) + 1, last: a, mean: r4(p ? n0(p.mean) + ALPHA * (a - n0(p.mean)) : a),
      max: r4(Math.max(p ? n0(p.max) : 0, a)), recent, measured: !!measured, updated_at: new Date().toISOString() };
  };
  // the exact seo_cache row (columns key / kind / site_id / value / updated_at)
  const calRow = (kind, mode, amount, cal, measured) => {
    const stat = calStat(((cal || {})[kind] || {})[mode], amount, measured);
    return { key: calKey(kind, mode), kind: 'cost', site_id: '', value: JSON.stringify(stat), updated_at: stat.updated_at };
  };

  // what the engine thinks it spent on one model family this month, so reconcile_claude_cost.py has something to compare the owner's
  // Anthropic Console export WITH. The figure resets when the month turns; nothing but this engine's own estimates goes into it.
  const monthRow = (family, usd, prev, month) => {
    const same = prev && String(prev.month || '') === String(month);
    const v = { month: String(month), usd: r4((same ? n0(prev.usd) : 0) + n0(usd)), runs: (same ? n0(prev.runs) : 0) + 1,
      estimated: true, updated_at: new Date().toISOString() };
    return { key: MODEL_PREFIX + family, kind: 'cost', site_id: '', value: JSON.stringify(v), updated_at: v.updated_at };
  };

  // ---- 4. the honest split a settled row carries ---------------------------------------------------------------------------
  // Each side is { usd, measured, basis } and may carry its own `measured_usd` when part of it IS reported usage (a content run
  // measures its Sonnet calls and can only estimate its three streaming Opus ones). Nothing is ever rounded into the wrong half.
  const part = (x) => {
    const o = x || {}, usd = r4(o.usd);
    const m = r4(Math.min(usd, o.measured_usd != null ? n0(o.measured_usd) : (o.measured ? usd : 0)));
    return { usd, measured_usd: m, estimated_usd: r4(usd - m) };
  };
  // R31 (2026-10-14): "nothing spent" carries its reason when there is one — a free run has to say WHY it settles nothing, or the row
  // reads exactly like a run whose figure was never computed.
  const word = (p, basis) => p.usd <= 0 ? 'nothing spent' + (basis ? ' (' + basis + ')' : '')
    : p.estimated_usd <= 0 ? 'measured'
    : p.measured_usd <= 0 ? 'ESTIMATED (' + (basis || 'per-mode estimate') + ')'
    : 'PARTLY ESTIMATED: $' + p.measured_usd.toFixed(4) + ' measured, $' + p.estimated_usd.toFixed(4) + ' estimated (' + (basis || 'per-mode estimate') + ')';
  // the one line a settled ledger row carries, so nobody reads an estimate as a measured cost
  const costBasis = (ai, dfs) => {
    const a = part(ai), d = part(dfs);
    return ('Claude $' + a.usd.toFixed(4) + ' ' + word(a, (ai || {}).basis)
      + '; DataForSEO $' + d.usd.toFixed(4) + ' ' + word(d, (dfs || {}).basis)).slice(0, 500);
  };
  const split = (ai, dfs) => {
    const a = part(ai), d = part(dfs);
    return { measured_usd: r4(a.measured_usd + d.measured_usd), estimated_usd: r4(a.estimated_usd + d.estimated_usd),
      cost_basis: costBasis(ai, dfs) };
  };

  // ---- 5. the DataForSEO money: each task once, and the day checked against the account ------------------------------------
  // R28 (2026-10-14, FIX_PLAN §3.12; RESULTS §0): the engine's own "measured" DataForSEO figures did not reconcile with the balance —
  // window C moved $0.0520 while the runs in it reported $0.0900 (+73%), window A $0.5506 against $0.6145 (+11.6%). Two causes, both here.
  //
  // (a) **A task was counted on every answer about it.** DataForSEO bills a crawl when the task is CREATED and then repeats the same
  //     `tasks[].cost` in every later answer about that task, so a polled on_page task was charged again on every poll. `dfsAdd` counts a
  //     task on its first sighting, by its own id, and keeps the repeats visible rather than silently dropping them.
  const dfsLedger = () => {
    const seen = new Set();
    const st = { usd: 0, tasks: 0, repeated: 0, no_id: 0 };
    // one DataForSEO answer: adds what has not been counted yet and returns that amount
    const add = (j) => {
      let c = 0;
      const ts = j && Array.isArray(j.tasks) ? j.tasks : null;
      if (ts) {
        for (const t of ts) {
          const cost = n0(t && t.cost); if (!cost) continue;
          const id = String((t && t.id) || '');
          if (!id) { st.no_id++; c += cost; continue; }   // nothing identifies it: counted, and said so
          if (seen.has(id)) { st.repeated++; continue; }
          seen.add(id); st.tasks++; c += cost;
        }
      } else if (j && n0(j.cost)) { c += n0(j.cost); }
      st.usd = r4(st.usd + c);
      return r4(c);
    };
    return { add, state: st, seen };
  };

  // (a2) R32 (2026-10-14, FIX_PLAN §3.13): **a crawl was settled at the price it was QUOTED, labelled "measured".** Audit 588 settled
  //      `dfs_usd 0.09 measured` — what DataForSEO quotes when an on_page task is created for the **200 pages it was asked for** — while
  //      47 were crawled and the account fell $0.031950 (+181%). DataForSEO bills a crawl for the work it does and never reports that
  //      final amount per task (every later answer repeats the creation quote), so the run cannot measure it. What the run does know is
  //      the quote, the pages it asked for and the pages the crawl reported: the figure is priced pro rata from those and is labelled an
  //      ESTIMATE with all three numbers in its basis. Nothing here is ever called measured.
  const crawlCost = (c) => {
    const o = c || {};
    const quoted = r4(o.quoted), req = Math.round(n0(o.pages_requested)), got = Math.round(n0(o.pages_crawled));
    const out = { applies: false, usd: quoted, quoted, pages_requested: req, pages_crawled: got, per_page: 0, estimated: false, basis: '' };
    if (quoted <= 0) { out.usd = 0; out.basis = 'no crawl was billed in this run'; return out; }
    out.applies = true; out.estimated = true;
    if (!(req > 0) || o.pages_crawled == null || !Number.isFinite(Number(o.pages_crawled))) {
      out.pages_crawled = null;
      out.basis = 'the crawl was quoted $' + quoted.toFixed(4) + ' when the task was created and never reported how many pages it crawled, '
        + 'so the quote stands and is an ESTIMATE (DataForSEO bills a crawl for the pages it does, not for the pages it was asked for)';
      return out;
    }
    const capped = Math.max(0, Math.min(got, req));
    out.pages_crawled = capped;
    out.per_page = +(quoted / req).toFixed(6);
    out.usd = r4(quoted * (capped / req));
    out.basis = 'the crawl was quoted $' + quoted.toFixed(4) + ' for the ' + req + ' pages it asked for and crawled ' + capped
      + ', so it is priced at $' + out.usd.toFixed(4) + ' ($' + out.per_page + ' a page) — ESTIMATED: DataForSEO bills a crawl for the pages '
      + 'it does and reports only the quote (audit 588 settled the $0.0900 quote as measured while the account fell $0.0320)';
    return out;
  };

  // ---- 5b. the Claude money a run settles: what it priced, nothing at all, or the reservation (and it says which) -------------------
  // R31 / R33 (2026-10-14, FIX_PLAN §3.13): a settle used to take the per-mode RESERVATION whenever the branch carried no priced figure —
  // so a `free_only` backlink run that called no model at all settled $0.05 while telling the caller $0, and `describe` settled the $0.06
  // it reserved where its own Haiku node reported 4,874 / 1,306 tokens ($0.0114). A reservation is a guard; a settlement is a measurement.
  // `ran` is the model nodes of THIS execution that produced items, `checked` how many the workflow has: when a workflow has model nodes
  // and none of them ran, the run spent nothing on Claude and settles nothing.
  const aiRun = (o) => {
    const x = o || {}, fig = x.figure || null, reserved = r4(x.reserved);
    const ran = (x.ran || []).map(String).filter(Boolean);
    const checked = Math.max(Math.round(n0(x.checked)), ran.length);
    // a priced figure wins: calls it counted are calls that happened, whatever the node-by-node sweep could see
    if (fig && n0(fig.calls) > 0) return { usd: r4(fig.usd), measured: fig.estimated === false, measured_usd: r4(fig.measured_usd),
      source: 'priced', ran, checked, basis: String(fig.basis || '') };
    // R82 (2026-10-16, re-rating C-6): a workflow that HAS no Claude node (the AI Pulse, the Rank Tracker) settled its per-mode Claude
    // reservation ($0.004 a day for the pulse) because the rule below only fired when the workflow had model nodes. `checked: 0`, said
    // explicitly by a caller that looked, is a measurement too: nothing can have been spent on Claude.
    if (x.checked != null && Math.round(n0(x.checked)) === 0 && !ran.length) return { usd: 0, measured: true, measured_usd: 0, source: 'none',
      ran, checked: 0, basis: 'this workflow has no Claude node, so no model call can have run'
        + (reserved > 0 ? ' and nothing is settled against the $' + reserved.toFixed(4) + ' it reserved' : '') };
    if (checked > 0 && !ran.length) return { usd: 0, measured: true, measured_usd: 0, source: 'none', ran, checked,
      basis: 'no model call ran in this run (all ' + checked + ' Claude node(s) of this workflow were checked)'
        + (reserved > 0 ? ', so nothing is settled against the $' + reserved.toFixed(4) + ' it reserved' : '') };
    return { usd: reserved, measured: false, measured_usd: 0, source: 'reserved', ran, checked,
      basis: 'the per-mode reservation: ' + (ran.length
        ? ran.length + ' model node(s) ran (' + ran.slice(0, 4).join(', ') + ') and this branch prices no call of its own'
        : 'this branch priced no model call of its own') };
  };

  // (b) **Nothing checked the sum against the money.** Every reservation now records the free `appendix/user_data` balance reading
  //     (seo_run_ledger.dfs_balance), so the day's reported spend can be held against the only measurement that cannot be argued with:
  //     how far the account actually fell between the day's first reading and the latest one. `rows` are the day's ledger rows,
  //     `mine` is this run's own reserved row (its reading is the latest). Nothing is corrected automatically — the engine says so.
  const RECONCILE_TOLERANCE = 0.1;    // 10% of the move, or 2 cents, whichever is larger: DataForSEO rounds to 4 decimals per task
  const RECONCILE_FLOOR = 0.02;
  const dfsDay = (rows, mine) => {
    const me = mine || {};
    const day = String(me.created_at || '').slice(0, 10);
    const read = (rows || []).filter(r => r && String(r.created_at || '').slice(0, 10) === day && n0(r.dfs_balance) > 0)
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const mineBalance = n0(me.dfs_balance);
    const from = read[0] || null;
    const to = mineBalance > 0 ? { created_at: String(me.created_at || ''), dfs_balance: mineBalance } : (read.length > 1 ? read[read.length - 1] : null);
    const out = { comparable: false, day, readings: read.length + (mineBalance > 0 && (!read.length || read[read.length - 1].created_at !== me.created_at) ? 1 : 0),
      from: from ? String(from.created_at) : '', to: to ? String(to.created_at) : '',
      balance_usd: 0, engine_usd: 0, diff_usd: 0, diff_pct: null, within: true, basis: '' };
    if (!from || !to || String(from.created_at) >= String(to.created_at)) {
      out.basis = read.length ? 'the day has only one balance reading so far, so nothing can be compared yet'
        : 'no balance reading for the day (appendix/user_data was not answered), so the figures are the engine\'s own sums only';
      return out;
    }
    // what the engine says the runs between the two readings cost, settled rows only (a reserved row has spent nothing yet)
    const between = (rows || []).filter(r => r && String(r.status || '') === 'done'
      && String(r.created_at || '') >= String(from.created_at) && String(r.created_at || '') < String(to.created_at));
    out.engine_usd = r4(between.reduce((s, r) => s + n0(r.dfs_usd), 0));
    out.balance_usd = r4(Math.max(0, n0(from.dfs_balance) - n0(to.dfs_balance)));
    out.diff_usd = r4(out.engine_usd - out.balance_usd);
    out.diff_pct = out.balance_usd > 0 ? +((out.diff_usd / out.balance_usd) * 100).toFixed(1) : null;
    out.within = Math.abs(out.diff_usd) <= Math.max(RECONCILE_FLOOR, out.balance_usd * RECONCILE_TOLERANCE);
    out.comparable = true;
    out.settled_rows = between.length;
    out.basis = 'the account fell $' + out.balance_usd.toFixed(4) + ' between ' + out.from.slice(11, 19) + ' and ' + out.to.slice(11, 19)
      + ' while ' + between.length + ' settled run(s) report $' + out.engine_usd.toFixed(4)
      + (out.within ? ' — they agree' : ' — they do NOT agree ($' + out.diff_usd.toFixed(4) + (out.diff_pct == null ? '' : ', ' + out.diff_pct + '%') + '); the account is the figure to believe');
    return out;
  };

  // (c) B-A5 (2026-10-15): **only the DAY was reconciled, never the run.** `dfsDay` holds the day's settled rows against how far the
  //     account fell, which is the right check for the day and says nothing about any single run: a run could be out by 100% and the
  //     day still agree. A run CAN be measured against the account, but only when it was alone — so every settle takes a second free
  //     `appendix/user_data` reading and this decides whether the move between the two readings belongs to this run.
  //     A row was OPEN during this run's window when it was reserved before this run settled and had not already settled before this
  //     run reserved. If any was, the account's move is shared and this run keeps the cost its own tasks reported — and says so.
  //     Nothing here ever invents a figure: when the account cannot settle the question (a reading missing, the account not moved, or
  //     moved far more than every task reported, which means something outside this engine spends on the same account) it says which.
  const RUN_OVERSPEND = 10;       // the account moved more than ten times what every task reported: not this run's money
  const dfsRun = (o) => {
    const x = o || {}, mine = x.mine || {};
    const start = n0(mine.dfs_balance), end = n0(x.end_balance);
    const from = String(mine.created_at || ''), to = String(x.settled_at || '');
    const engine = r4(x.engine_usd);
    const out = { attributed: false, alone: false, comparable: false, usd: 0, engine_usd: engine, account_usd: 0,
      diff_usd: 0, diff_pct: null, within: true, overlapped: [], overlapped_n: 0, from, to,
      start_balance: +start.toFixed(6), end_balance: +end.toFixed(6), source: 'tasks', basis: '' };
    const mineId = String(mine.run_id || '');
    // R81 parts 2-3 (2026-10-16, re-rating C-5): the request that STARTED this run is not another run. A monitor started by the main
    // workflow's front door names that run in its own key (`parent:<id>`, Monitor_Ledger_Row / R77); the parent spends nothing itself and
    // settles $0 as a hand-off (`dfs_source: handoff`, R81 part 1), so neither its row nor any hand-off row can share this run's money.
    const mineKey = String(mine.key || '');
    const parentId = mineKey.indexOf('parent:') === 0 ? mineKey.slice(7).trim() : String(x.parent_run_id || '').trim();
    // when a row CLOSED. A settled row stamps `settled_at`; a refused or released row was closed when it was marked (its `settled_at`
    // when the refusal stamped one); and a `done` row with no stamp (the Keyword Check settled without one until 2026-10-16, and old
    // rows never had the column) closed when the table last wrote it (`updatedAt`) — or, failing that, when it was reserved. A row
    // with no end at all was "open for ever", which named finished runs as "in flight" all day (598, 599, 600, 624).
    const closedAt = (r) => String(r.settled_at || r.updatedAt || r.updated_at || r.created_at || '');
    // every other row that was open while this run was in flight
    const open = (x.rows || []).filter((r) => {
      if (!r || !r.run_id || r.error || String(r.run_id) === mineId) return false;
      if (String(r.dfs_source || '') === 'handoff' || (parentId && String(r.run_id) === parentId)) return false;
      const c = String(r.created_at || '');
      if (!c || (to && c >= to)) return false;                       // reserved after this run had already settled
      const st = String(r.status || '');
      if (st === 'reserved' || st === '') return true;               // still reserved: it was open the whole time
      const s = closedAt(r);
      return !from || s > from;                                      // closed, but only after this run reserved: it overlapped
    });
    out.overlapped = open.map((r) => String(r.run_id)).slice(0, 20);
    out.overlapped_n = open.length;
    if (!(start > 0) || !(end > 0) || !from || !to || from >= to) {
      out.basis = 'the account was not read at both ends of this run' + (start > 0 ? ' (no reading when it settled)' : ' (no reading when it reserved)')
        + ', so its DataForSEO figure is the cost its own tasks reported';
      return out;
    }
    out.comparable = true;
    out.account_usd = r4(Math.max(0, start - end));
    if (open.length) {
      out.basis = open.length + ' other run(s) were in flight at the same time (' + out.overlapped.slice(0, 4).join(', ')
        + '), so the $' + out.account_usd.toFixed(4) + ' the account moved is shared and cannot be attributed to this run; '
        + 'its figure stays the $' + engine.toFixed(4) + ' its own tasks reported';
      return out;
    }
    out.alone = true;
    // a run that sent no paid task cannot have moved the account, however alone it was: whatever moved it came from somewhere else
    // (the owner's own probe, another tool on the same account). Attributing it here would invent a cost out of thin air.
    if (x.calls != null && Math.round(n0(x.calls)) <= 0) {
      out.basis = 'this run sent no paid DataForSEO task, so the $' + out.account_usd.toFixed(4) + ' the account moved while it ran is '
        + 'not its money — nothing is attributed to it';
      return out;
    }
    if (out.account_usd <= 0) {
      out.basis = 'this run was the only one in flight but the account had not moved when it settled (DataForSEO posts a charge a '
        + 'moment later), so its figure stays the $' + engine.toFixed(4) + ' its own tasks reported';
      return out;
    }
    if (engine > 0 && out.account_usd > Math.max(0.5, engine * RUN_OVERSPEND)) {
      out.basis = 'this run was the only one of ours in flight, but the account fell $' + out.account_usd.toFixed(4)
        + ' against the $' + engine.toFixed(4) + ' its tasks reported — something outside this engine is spending on the same account, '
        + 'so nothing is attributed to this run and the gap is reported instead';
      return out;
    }
    out.attributed = true;
    out.source = 'account';
    out.usd = out.account_usd;
    out.diff_usd = r4(engine - out.account_usd);
    out.diff_pct = out.account_usd > 0 ? +((out.diff_usd / out.account_usd) * 100).toFixed(1) : null;
    out.within = Math.abs(out.diff_usd) <= Math.max(RECONCILE_FLOOR, out.account_usd * RECONCILE_TOLERANCE);
    out.basis = 'measured against the account: this run was the only one in flight between ' + from.slice(11, 19) + ' and '
      + to.slice(11, 19) + ', and the balance fell $' + out.account_usd.toFixed(4) + ' — its own tasks report $' + engine.toFixed(4)
      + (out.within ? ', which agrees' : ' ($' + out.diff_usd.toFixed(4) + (out.diff_pct == null ? '' : ', ' + out.diff_pct + '%')
        + ' out); the account is the figure to believe');
    return out;
  };

  return { PRICES, UNKNOWN, CHARS_PER_TOKEN, THINK_SHARE, THINK_SEEN, crawlFactor, CRAWL_BASE_PAGES, CRAWL_JS_MULT, EST, DFS_EST, ALPHA, HEADROOM, KEEP, CAP, FACTOR_KEY, MODEL_PREFIX,
    RECONCILE_TOLERANCE, RECONCILE_FLOOR, RUN_OVERSPEND, COUNTER, countUsage, dfsLedger, dfsDay, dfsRun, crawlCost, aiRun,
    family, priceOf, tokensOf, callCost, runCost, keysFor, readCal, estOf, pick, calKey, calStat, calRow, monthRow, part, costBasis, split };
})();
const ROW = 'Run Ledger Row (Pulse)';
const MEASURED = 'Pulse Metrics';   // '' when this workflow has no measured figure
const AI_NODES = [];     // every Claude node of this workflow (the agents a model node is wired to), '[]' when it calls none
const BAL_END = 'DFS Balance End (Pulse)';     // the free balance probe on the settle chain
const LEDGER = 'Load Run Ledger (Pulse)';       // the run-ledger rows around this run's window
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
let row = {}; try { row = $(ROW).first().json || {}; } catch (e) { row = {}; }
// R82 (2026-10-16, re-rating C-6): MEASURED may name several nodes ('A|B'), and a leading '!' says they are EVERY paid DataForSEO call of
// this workflow — so a run in which none of them ran sent no paid task and settles $0, instead of the per-mode reservation (the Site
// Tracker settled $0.0100 "ESTIMATED" while its SERP checks and Trends lookups reported $0.0310, row 98). A gated call's *… Answers* node
// carries the call's whole cost on every item's `__dfs` (`cost_usd`: both attempts, each task once by its own id), so that figure is read
// ONCE per node — never added up per item, and never read as one item's cost.
const MEASURED_ALL = MEASURED.charAt(0) === '!';
const MEASURED_NODES = MEASURED.replace(/^!/, '').split('|').map(s => s.trim()).filter(Boolean);
const costOf = (x) => {
  if (!x || typeof x !== 'object') return null;
  const direct = n0(x.cost_usd); if (direct != null) return direct;
  for (const k of Object.keys(x)) { if (k === '__dfs') continue; const v = x[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { const n = n0(v.cost_usd); if (n != null) return n; } }
  return null;
};
let measured = null;
for (const __mn of MEASURED_NODES) {
  let __items = null;
  try { __items = $(__mn).all().map(i => i.json || {}); } catch (e) { __items = null; }   // this call did not run in this execution
  if (!__items) continue;
  // a node that states its own cost (AI Metrics, Pulse Metrics, Parse Backlinks, Growth Metrics) is read as it always was
  const __direct = __items.map(costOf).filter(v => v != null);
  const __gate = __items.find(j => j && j.__dfs && typeof j.__dfs === 'object' && n0(j.__dfs.cost_usd) != null);
  const vals = __direct.length ? __direct : (__gate ? [n0(__gate.__dfs.cost_usd)] : []);
  if (vals.length) measured = +((measured || 0) + vals.reduce((s, v) => s + v, 0)).toFixed(4);
}
if (measured == null && MEASURED_ALL && MEASURED_NODES.length) measured = 0;   // none of this workflow's paid calls ran: it sent no paid task
// which Claude nodes actually ran in THIS execution (a node that never ran has no data and throws)
const ranAi = AI_NODES.filter(n => { try { return ($(n).all() || []).length > 0; } catch (e) { return false; } });

// ---- B-C2: what Claude really cost this run, counted by the tokeniser that bills it ----------------------------------------------
// Until today a monitor settled the per-mode RESERVATION whenever a model node had run: a guard figure, labelled ESTIMATED, standing
// in for a measurement nobody took. AI_CALLS is this workflow's own Claude agents, baked from the model nodes at build time (so a
// renamed or added agent reaches the money), and for each one the two FREE probes on the main path behind it: the prompt the run really
// rendered, and that prompt plus the answer it really got. The difference is the answer's own tokens.
//   * a monitor agent answers once per SITE (one job item each), so every call is counted and the counts are SUMMED; `rounds` says how
//     many calls the sum covers, and `callCost` refuses a pair that does not cover the same number of calls — their difference would
//     not be this node's answer tokens.
//   * the THINKING a model does before answering is billed as output and is never returned by any counter. It stays modelled from the
//     node's effort budget and is the only estimate left in a counted call (INVARIANTS rule 1: the basis says exactly that).
//   * a probe that did not answer leaves its call on prompt/answer CHARACTERS with that basis — a count that failed is never a
//     measurement, and the counter can never fail the run (neverError + continueRegularOutput + the retry rule).
// With no table at all (a workflow whose builder has not been taught this) AI_CALLS is `[]`, nothing is priced and the settle keeps the
// reservation exactly as R31 left it.
const AI_CALLS = [];
const CAL = "Load Cost Factors (Pulse)";   // the stored per-model correction factors the monthly reconciliation writes ('' when this workflow reads none)
const __jsonOf = (n, idx) => { try { return ((idx == null ? $(n).all() : $(n).all(idx)) || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __countOf = (n) => { let sum = 0, k = 0; for (const j of (__jsonOf(n) || [])) { const v = Number((j || {}).input_tokens); if (Number.isFinite(v) && v > 0) { sum += v; k++; } } return { sum: sum, n: k }; };
// R57 (2026-10-16, re-rating A-24): an agent n8n re-ran after a failed answer (its parser refused the format; `retryOnFail`) called its model
// twice and kept ONE answer, so `answers.length` priced one call. The model node itself records every call it made as a run of its own;
// a Code node cannot read that node's data (it rides `ai_languageModel`, not `main`), but `$node[…].runIndex` is the index of its last run.
const __modelRuns = (n) => { try { if (!n || typeof $node === 'undefined') return 0; const r = Number($node[n].runIndex); return Number.isFinite(r) && r >= 0 ? r + 1 : 0; } catch (e) { return 0; } };
const __costCalls = [];
// LLM-LIMITS (2026-10-27): an answer that stopped before its end (its JSON cut off) or that could not be read even after n8n's one retry is
// never a silent empty answer: every one is named on the row's basis line, first, so ops see it (CK.answer, v5/code/_complete.js)
const __llmCut = [];
for (const c of AI_CALLS) {
  const answers = __jsonOf(c.node);
  if (!answers || !answers.length) continue;   // this agent did not run in this execution
  { let bad = 0, why = ''; for (const a of answers) { const k = CK.answer(a, 'json'); if (!k.complete) { bad++; why = why || k.reason; } }
    if (bad) __llmCut.push(c.node + ' ' + bad + ' of ' + answers.length + ' (' + why + ')'); }
  // an n8n agent answers once per input item, and these are fed one job per site — plus any retry its model node recorded (R57)
  const __answered = answers.length, __runs = __modelRuns(c.model_node);
  const calls = Math.max(__answered, __runs);
  // the characters are the FALLBACK, and they are read per call: the job items differ per site, so one item's fields are not the run's.
  // The output index is spelled out — `$('X').all()` would otherwise default to the output the ACTIVE node is connected to, and the
  // settle is connected to none of these (the trap that caught build section 62 out with *Keyword Seeds* on output 1).
  const fed = c.input ? (__jsonOf(c.input, c.branch) || []) : [];
  let prompt_chars = 0;
  for (let k = 0; k < __answered; k++) {
    let pc = c.template_chars;
    const own = fed[k] || fed[0] || {};
    for (const f of (c.fields || [])) pc += __chars(__at(own, f));
    prompt_chars += pc;
  }
  for (const p of (c.from || [])) prompt_chars += __chars(__at((__jsonOf(p[0]) || [])[0] || {}, p[1])) * __answered;
  const output_chars = answers.reduce((s, j) => s + (typeof j.output === 'string' ? j.output.length : __chars(j)), 0);
  let counted = null;
  if (c.count_prompt && c.count_answer) {
    const p = __countOf(c.count_prompt), t = __countOf(c.count_answer), cap = Number(c.count_rounds || 0);
    if (p.n > 0 && p.n === t.n && p.sum > 0 && t.sum > p.sum && (!cap || p.n <= cap))
      counted = { prompt_tokens: p.sum, total_tokens: t.sum, rounds: p.n, source: 'Anthropic /v1/messages/count_tokens' };
  }
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, think_model: c.think_model, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, counted, calls, retries: Math.max(0, calls - __answered) });
}
// the same per-model correction factors the main workflow prices with, so one engine reports one price (seo_cache `cost:factor:claude`,
// written by reconcile_claude_cost.py). Unreadable or absent, the list prices stand.
let __factors = {};
if (CAL) { try { __factors = CC.readCal(($(CAL).all() || []).map(i => i.json).filter(r => r && r.key && !r.error)).factors; } catch (e) { __factors = {}; } }
const aiFig = __costCalls.length ? CC.runCost(__costCalls, __factors) : null;
// G23 (2026-10-13): the settled row says which part of its money was measured and which is an estimate.
const ai = CC.aiRun({ figure: aiFig, reserved: row.est_usd, ran: ranAi, checked: AI_NODES.length });
const ai_usd = ai.usd;
const taskUsd = measured == null ? (n0(row.dfs_est_usd) || 0) : measured;

// ---- B-A5: this run against the account, when the account can answer for this run alone ----
const settled_at = new Date().toISOString();
let endBalance = 0;
try { const b = $(BAL_END).first().json || {}; const t = (b.tasks || [])[0] || {}; const r = (t.result || [])[0] || {};
  const v = Number((r.money || {}).balance); if (Number.isFinite(v) && v > 0) endBalance = +v.toFixed(6); } catch (e) {}
let ledgerRows = [];
try { ledgerRows = $(LEDGER).all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { ledgerRows = []; }
// `calls`: this workflow reports a measured figure only when it sent paid tasks, so a measured $0 means it sent none and the account
// cannot be charged to it. A workflow with no measured figure at all passes null and the other guards decide.
const dfsAtt = CC.dfsRun({ rows: ledgerRows, mine: row, end_balance: endBalance, settled_at, engine_usd: taskUsd,
  calls: measured == null ? null : (measured > 0 ? 1 : 0) });

const dfs_usd = dfsAtt.attributed ? dfsAtt.usd : taskUsd;
const taskBasis = measured == null ? 'this workflow reports no cost of its own' : 'the cost of every task it sent';
// the reconciliation only speaks when it has something to say: both readings taken. Nothing is added to the row when the account was
// never read, because "we could not check" is not information the customer needs on every free run.
const dfs = { usd: dfs_usd, measured: dfsAtt.attributed || measured != null,
  basis: dfsAtt.attributed ? dfsAtt.basis + ' (its own tasks: ' + taskBasis + ')'
    : dfsAtt.comparable ? taskBasis + '. ' + dfsAtt.basis : taskBasis };
const split = CC.split(ai, dfs);
return [{ json: { run_id: String($execution.id), mode: String(row.mode || ''), status: 'done',
  settled_usd: ai_usd, ai_usd, ai_measured: ai.measured, ai_basis: ai.basis, ai_source: ai.source,
  ai_nodes_ran: ranAi, ai_nodes_checked: AI_NODES.length,
  // B-C2: what the counter answered for, so a reader can tell a measurement from a model without reading the basis
  ai_calls: aiFig ? aiFig.calls : 0, ai_counted_nodes: aiFig ? aiFig.counted_nodes : [],
  ai_measured_usd: ai.measured_usd, ai_measured_share: aiFig ? aiFig.measured_share : null,
  ai_think_usd: aiFig ? aiFig.think_usd : 0, ai_by_node: aiFig ? aiFig.by_node : {},
  cost_mode: String(row.cost_mode || row.mode || ''),
  dfs_usd: +Number(dfs_usd).toFixed(4), dfs_measured: dfs.measured, dfs_est_usd: +Number(row.dfs_est_usd || 0).toFixed(4),
  // B-A5: what the account said about THIS run, and which figure the row therefore carries
  settled_at, dfs_balance_end: endBalance, dfs_source: dfsAtt.source, dfs_run: dfsAtt, dfs_tasks_usd: +Number(taskUsd).toFixed(4),
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd, cost_basis: (__llmCut.length ? 'Claude answer incomplete: ' + __llmCut.join('; ') + '. ' : '') + split.cost_basis } }];
