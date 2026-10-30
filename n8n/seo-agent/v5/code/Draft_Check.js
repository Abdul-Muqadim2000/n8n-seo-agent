/*__COMPLETE__*/
// LLM-LIMITS (2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): is the Copywriter's page complete?
// n8n hands an answer the model stopped mid-way (its max_tokens ceiling, a stream that ended early) on as a success, so nothing upstream
// can tell. This node reads the page itself (CK.text):
//   complete                 -> on to the editorial review, unchanged (route `ok`)
//   cut off, first attempt   -> the Copywriter writes the page once more from the same brief (route `retry`); the second call is a run
//                               of its model node, so the cost settle prices it as a retry (R57: calls = the model node's runs)
//   cut off, second attempt  -> the run stops with a plain reason: a cut page is never delivered, and no later step can repair it. W06-B:
//                               the failed item goes to the failure path first (content-log row `failed`, ledger settled), then stops
const brief = $('Parse Brief').first().json || {};
const items = $input.all();
const attempt = ($runIndex || 0) + 1;
const out0 = items.length ? (items[0].json || {}) : {};
const md = typeof out0.output === 'string' ? out0.output : '';
const tw = Number(brief.target_word_count || (brief.content_brief || {}).target_word_count || (brief.content_brief || {}).word_count || 0) || 0;
// W06-B (2026-10-30, WAVE05 3.2, K4): the brief's call to action (the request's, then the brief's own) is a proper last line
const cta = [brief.cta, (brief.content_brief || {}).cta].filter(c => typeof c === 'string' && c.trim());
const t = CK.text(md, { min_words: tw > 0 ? Math.round(tw * 0.35) : 0, cta });
if (t.complete) {
  const note = attempt > 1 ? 'The page writer\'s first answer stopped before the end of the page; it wrote the page again and the second answer is complete.' : '';
  return items.map(i => ({ json: { ...i.json, llm_check: { node: 'Copywriter', kind: 'page', complete: true, attempt, note, words: t.words } } }));
}
const why = t.reasons.join('; ');
if (attempt < 2) {
  return [{ json: { ...brief, llm_check: { node: 'Copywriter', kind: 'page', complete: false, retry: true, attempt, reasons: t.reasons, last_line: t.last_line, words: t.words,
    note: 'The page writer\'s answer stopped before the end of the page (' + why + '); it was asked to write the page again.' } } }];
}
// W06-B (2026-10-30, WAVE05 3.2): the run used to throw HERE, so its run-ledger row stayed `reserved` at $0 (about $0.85 of Claude spent and
// never recorded) and the content-log row the app or the cadence opened at the start kept saying `started`, which the app then read as "a
// page was already written". The failed item now takes the failure path (*Draft Written? (Copywriter)* false): *Page Run Failed Row* marks
// this run's opening content-log row `failed`, the settle chain settles the ledger row with what the run spent, and *Stop Failed Run* then
// ends the execution with this same error, so the app's failure watcher and the error handler see the run exactly as before.
const error = 'The page could not be written in full: the writer stopped before the end of the page twice (' + why + '). No page was delivered and nothing was published. Start the page again.';
return [{ json: { ...brief, llm_check: { node: 'Copywriter', kind: 'page', complete: false, retry: false, failed: true, attempt, reasons: t.reasons, last_line: t.last_line, words: t.words,
  note: 'The page writer stopped before the end of the page twice (' + why + '); no page was written.', error } } }];
