// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
})();
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

// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['AI Demand (Retry)', 'AI SERP (Retry)', 'Ask LLMs (Retry)', 'Backlink Gap (Retry)', 'Backlink Summary (Retry)', 'Candidate SERP (Retry)', 'DataForSEO Whois (Retry)', 'Domain Overview (Retry)', 'Fallback SERP (Retry)', 'Fetch GBP (Retry)', 'Find Competitors (Retry)', 'Get Crawled Pages (Retry)', 'Keyword Ideas (Retry)', 'Ranked Keywords (Retry)', 'Run Competitor Keywords (Retry)', 'Run Crawl Extras (Retry)', 'Run Ladder Research (Retry)', 'Run Reach Requests (Retry)', 'Run Research (Retry)', 'Site Authority (Retry)', 'Start Crawl (Retry)', 'SERP Top 10', 'SERP Top 10 (Retry)', 'SERP Top 10 (Light Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP', 'Run Ladder Cluster SERP', 'Run Ladder Cluster SERP (Retry)', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Fetch GBP'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer', 'Keyword Relevance', 'Critic'];

// R28: a task is counted on its first sighting, by its own id; a repeat is counted as a repeat, and a task with no id is counted (nothing
// identifies it) and reported, so the figure is never quietly wrong in either direction.
const __dfsSeen = new Set(); const __dfsRepeats = { n: 0, no_id: 0 };
const __dfsOnce = (t) => {
  const cost = Number((t && t.cost) || 0); if (!cost) return 0;
  const id = String((t && t.id) || '');
  if (!id) { __dfsRepeats.no_id++; return cost; }
  if (__dfsSeen.has(id)) { __dfsRepeats.n++; return 0; }
  __dfsSeen.add(id); return cost;
};
const run_ledger = { dataforseo_usd: 0, dataforseo_calls: 0, by_node: {}, ai_calls: 0, ai_nodes: [], started_at: null, finished_at: new Date().toISOString(), duration_min: null };
for (const n of __LEDGER_NODES) {
  let items = []; try { items = $(n).all(); } catch (e) { continue; }
  for (const it of items) {
    const j = (it && it.json) || {}; let c = 0;
    // R28 (2026-10-14, FIX_PLAN §3.12): count a task's cost ONCE. DataForSEO bills a crawl when the task is created and then repeats the
    // same `tasks[].cost` in every later answer about that task, so every poll of the on_page nodes charged the engine for the same $0.09
    // again: window C of 2026-10-14 reported $0.0900 against $0.0520 of real money (+73%), window A $0.6145 against $0.5506 (+11.6%).
    if (Array.isArray(j.tasks)) { for (const t of j.tasks) c += __dfsOnce(t); } else if (j.cost) { c += Number(j.cost) || 0; }
    run_ledger.dataforseo_calls++;
    if (c) { run_ledger.dataforseo_usd += c; run_ledger.by_node[n] = +((run_ledger.by_node[n] || 0) + c).toFixed(4); }
  }
}
for (const n of __AI_NODES) { try { const k = $(n).all().length; if (k) { run_ledger.ai_calls += k; run_ledger.ai_nodes.push(n); } } catch (e) {} }
try { run_ledger.started_at = $('Normalize Input').first().json.started_at || null; } catch (e) {}
if (run_ledger.started_at) run_ledger.duration_min = +(((Date.now() - new Date(run_ledger.started_at)) / 60000).toFixed(1));
run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);
run_ledger.dataforseo_tasks = __dfsSeen.size;
run_ledger.dataforseo_tasks_repeated = __dfsRepeats.n;   // answers about a task already paid for (a crawl is billed once, at creation)
run_ledger.dataforseo_tasks_unidentified = __dfsRepeats.no_id;

// R32 (2026-10-14, FIX_PLAN §3.13): a crawl is billed for the pages it crawls, not for the pages it was asked for. DataForSEO quotes the
// task when it is created (audit 588: $0.0900 for the 200 pages requested) and repeats that same quote in every later answer about it,
// while the account fell $0.0320 for the 47 pages the crawl actually did. The quote is therefore not a measurement: the crawl is priced
// pro rata from what the crawl itself reported and labelled ESTIMATED, with the quote, the pages asked for and the pages crawled in its
// basis. `dataforseo_estimated_usd` is the part of this run's DataForSEO money that is an estimate; the rest is what each task reported.
run_ledger.dataforseo_estimated_usd = 0;
const __crawlQuote = Number(run_ledger.by_node['Start Crawl'] || 0);
if (__crawlQuote > 0) {
  let __crawlDone = null, __crawlAsked = 0;
  try {
    const __cc = $('Check Crawl').all(); const __cj = (__cc[__cc.length - 1] || {}).json || {};
    if (__cj.pages_crawled !== undefined && __cj.pages_crawled !== null) __crawlDone = Number(__cj.pages_crawled);
    __crawlAsked = Number(__cj.crawl_max_pages) || 0;
  } catch (e) {}
  if (!__crawlAsked) { try { __crawlAsked = Number($('Normalize Input').first().json.crawl_max_pages) || 0; } catch (e) {} }
  const __cp = CC.crawlCost({ quoted: __crawlQuote, pages_crawled: __crawlDone, pages_requested: __crawlAsked });
  run_ledger.crawl_cost = __cp;
  run_ledger.by_node['Start Crawl'] = __cp.usd;
  run_ledger.dataforseo_usd = +(run_ledger.dataforseo_usd - __crawlQuote + __cp.usd).toFixed(4);
  run_ledger.dataforseo_estimated_usd = __cp.usd;   // a quote is never measured money
}


// ---- what Claude cost this run (G23, 2026-10-13): priced per call from what the run can actually see ----
// A streaming call reports no token usage, so there is nothing to read; what the run does know is the prompt it built, the answer it got
// and the thinking budget of the node's effort level. Every figure here is an ESTIMATE and says so (ai_cost.estimated / .basis), and the
// per-model correction factors the monthly reconciliation writes into seo_cache are applied before the prices are.
const __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Seeds)", "count_answer": "Count Answer (Keyword Seeds)", "count_per_item": false, "count_rounds": 1, "model_node": "Anthropic Chat Model", "think_model": "seen"}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 4953, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false, "count_prompt": "Count Prompt (Competitor Analyzer)", "count_answer": "Count Answer (Competitor Analyzer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Competitor Analyzer", "think_model": "seen"}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false, "count_prompt": "Count Prompt (Content Reviewer)", "count_answer": "Count Answer (Content Reviewer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Content Reviewer", "think_model": "seen"}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 13480, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "goal", "keyword", "language_name", "page_contract", "page_type", "pricing_facts", "proof_context", "regulatory", "role_writer", "site_description", "spelling", "timeline_facts", "tone", "verdict_exclusions", "video_context"], "from": [["Collect Regulatory Facts", "regulatory"]], "loop": false, "count_prompt": "Count Prompt (Copywriter)", "count_answer": "Count Answer (Copywriter)", "count_rounds": 1, "model_node": "Claude \u2014 Copywriter", "think_model": 3277}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 6737, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_contract"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": false, "count_prompt": "Count Prompt (Critic)", "count_answer": "Count Answer (Critic)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Critic", "think_model": "seen"}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 5839, "input": "Needs Revision?", "fields": ["business_facts", "case_facts_text", "content_brief", "content_qa", "keyword", "language_name", "page_contract", "page_fix", "page_type", "pricing_facts", "spelling", "timeline_facts"], "from": [], "loop": true, "count_prompt": "Count Prompt (Editor)", "count_answer": "Count Answer (Editor)", "count_rounds": 1, "model_node": "Claude \u2014 Editor", "think_model": 3277}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "low", "streaming": true, "template_chars": 3052, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Relevance)", "count_answer": "Count Answer (Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Keyword Relevance", "think_model": "seen"}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "low", "streaming": true, "template_chars": 3052, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Ladder Keyword Relevance)", "count_answer": "Count Answer (Ladder Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Ladder Relevance", "think_model": "seen"}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false, "count_prompt": "Count Prompt (Site Describer)", "count_answer": "Count Answer (Site Describer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Site Describer", "think_model": 0}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 16152, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_contract", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "regulatory", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_exclusions", "verdict_reasons", "verdict_score", "video_context"], "from": [["Collect Regulatory Facts", "regulatory"]], "loop": false, "count_prompt": "Count Prompt (Strategy Brief)", "count_answer": "Count Answer (Strategy Brief)", "count_rounds": 1, "model_node": "Claude \u2014 Strategy Brief", "think_model": 2458}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 128000, "effort": "medium", "streaming": true, "template_chars": 6229, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "existing_page_facts_text", "goal", "keyword", "keyword_data", "language_name", "own_coverage_text", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false, "count_prompt": "Count Prompt (Verdict Agent)", "count_answer": "Count Answer (Verdict Agent)", "count_per_item": false, "count_rounds": 1, "model_node": "Verdict Chat Model", "think_model": "seen"}];
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __jsonOf = (n) => { try { return ($(n).all() || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
// R46 (2026-10-16): a `loop` node is the Editor, and it runs once per QA round AFTER the first — QA round N follows N - 1 editor calls, which
// Content QA states as `editor_rounds`. Live (exec 616) one editor call was priced twice from `qa_round: 2`. At least 1: the node ran.
const __qaRounds = () => { try { const q = $('Content QA').first().json || {}; const e = Number(q.editor_rounds); return Math.max(1, Number.isFinite(e) && q.editor_rounds != null ? e : (Number(q.qa_round) || 1) - 1); } catch (e) { return 1; } };
const __countOf = (n) => { let sum = 0, k = 0; for (const j of (__jsonOf(n) || [])) { const v = Number((j || {}).input_tokens); if (Number.isFinite(v) && v > 0) { sum += v; k++; } } return { sum: sum, n: k }; };
const __costCalls = [];
// R57: how many calls a model node made in THIS execution. A Code node cannot read its data (it rides `ai_languageModel`), but
// `$node[…].runIndex` is the index of its last run; 0 when the node never ran or the proxy is not there (the offline harness).
const __modelRuns = (n) => { try { if (!n || typeof $node === 'undefined') return 0; const r = Number($node[n].runIndex); return Number.isFinite(r) && r >= 0 ? r + 1 : 0; } catch (e) { return 0; } };
for (const c of __AI_CALLS) {
  const answers = __jsonOf(c.node);
  if (!answers || !answers.length) continue;   // the node did not run in this execution
  let prompt_chars = c.template_chars;
  const own = c.input ? (__jsonOf(c.input) || [])[0] : null;
  for (const f of c.fields) prompt_chars += __chars(__at(own || {}, f));
  for (const p of c.from) prompt_chars += __chars(__at((__jsonOf(p[0]) || [])[0] || {}, p[1]));
  const output_chars = answers.reduce((s, j) => s + (typeof j.output === 'string' ? j.output.length : __chars(j)), 0);
  // B-A8 / B-F1 (2026-10-15): the free Anthropic token counter answered for this node on the main path — the prompt it really
  // rendered (*Count Prompt (…)*) and that prompt plus the answer it really got (*Count Answer (…)*). The difference is the
  // answer's own tokens. A node that answers once per ITEM has one pair of counts per call (the keyword screen runs once per
  // chunk of 80 candidates), so the counts are SUMMED and `rounds` says how many calls the sum covers; `count_rounds` is the
  // most the main path can show — 1 for a looping agent, because only the Editor's LAST round is on it — and a count that
  // covers more than that is refused rather than spread. The two counts must cover the same number of calls, or their
  // difference is not this node's answer tokens. Anything else leaves `counted` null and the call falls back to characters,
  // with the old basis: a count that failed is never a measurement.
  let counted = null;
  if (c.count_prompt && c.count_answer) {
    const p = __countOf(c.count_prompt), t = __countOf(c.count_answer), cap = Number(c.count_rounds || 0);
    if (p.n > 0 && p.n === t.n && p.sum > 0 && t.sum > p.sum && (!cap || p.n <= cap))
      counted = { prompt_tokens: p.sum, total_tokens: t.sum, rounds: p.n, source: 'Anthropic /v1/messages/count_tokens' };
  }
  // R57 (2026-10-16, re-rating A-24): a parser that refused the format re-ran the agent (retryOnFail), n8n kept ONE answer and the loop
  // priced one call — exec 616's Strategy Brief made two Opus calls. The model node records every call as a run of its own.
  const __base104 = answers.length * (c.loop ? __qaRounds() : 1), __runs104 = __modelRuns(c.model_node);
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, think_model: c.think_model, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, counted, calls: Math.max(__base104, __runs104), retries: Math.max(0, __runs104 - __base104) });
}
// CT-FIX2 (2026-10-22, section 148): the promise judge (Claude Haiku over HTTP, once per QA round). Anthropic reports the tokens of each answer,
// so this call is MEASURED, every round summed (a run index the node never reached ends the walk).
{ let inT = 0, outT = 0, n = 0; for (let r = 0; r < 12; r++) { let a = null; try { a = $('Promise Judge').all(0, r); } catch (e) { break; } if (!a || !a.length) break;
    for (const i of a) { const u = (i && i.json && i.json.usage) || null; if (u && (Number(u.input_tokens) || Number(u.output_tokens))) { inT += Number(u.input_tokens) || 0; outT += Number(u.output_tokens) || 0; n++; } } }
  if (n) __costCalls.push({ node: 'Promise Judge', model: 'claude-haiku-4-5-20251001', max_tokens: 4000, effort: '', streaming: false, prompt_chars: 0, output_chars: 0, usage: { promptTokens: inT, completionTokens: outT }, calls: n }); }
// W0-H (2026-10-29, section 158): the blind second read of the delivered page (Claude Sonnet 5.5 over HTTP, once a page run). Anthropic reports
// the tokens of the answer (thinking included in output_tokens), so this call is MEASURED.
{ let inT = 0, outT = 0, n = 0; let a = null; try { a = $('Second Read').all(); } catch (e) { a = null; }
  for (const i of (a || [])) { const u = (i && i.json && i.json.usage) || null; if (u && (Number(u.input_tokens) || Number(u.output_tokens))) { inT += Number(u.input_tokens) || 0; outT += Number(u.output_tokens) || 0; n++; } }
  if (n) __costCalls.push({ node: 'Second Read', model: 'claude-sonnet-5-5', max_tokens: 16000, effort: 'medium', streaming: false, prompt_chars: 0, output_chars: 0, usage: { promptTokens: inT, completionTokens: outT }, calls: n }); }
run_ledger.ai_cost = CC.runCost(__costCalls, CC.readCal(__calRows()).factors);
run_ledger.ai_usd = run_ledger.ai_cost.usd;
run_ledger.ai_cost_estimated = run_ledger.ai_cost.estimated;

const d = $input.first().json;
const a = d.site_audit || {};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toISOString().slice(0, 10);

const SEV = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const SEV_COLOR = { Critical: '#B91C1C', High: '#EA580C', Medium: '#CA8A04', Low: '#2563EB', Info: '#64748B' };
const scoreColor = (s) => s >= 90 ? '#15803D' : s >= 75 ? '#65A30D' : s >= 60 ? '#CA8A04' : '#B91C1C';

const bar = (s) => `<table class="bar"><tr>
  <td style="width:${s}%;background:${scoreColor(s)}">&nbsp;</td>
  <td style="width:${100 - s}%;background:#E2E8F0">&nbsp;</td></tr></table>`;

const counts = a.issue_counts || {};
// ---- Search Console & site structure section (v4.3) ----
const scSection = (a, num) => {
  const sc = a.search_console || {}, st = a.site_structure || {};
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const n2 = (v) => (Number(v) || 0).toLocaleString('en-GB');
  // R59 (2026-10-16): a path alone only where the host is the site's own canonical one. Any other host is printed in full: stripping it
  // listed "/" twice in the top-page table (14 clicks on https://techand.ai/, 3 on https://www.techand.ai/) and hid the split.
  const h2 = String(((sc.host_split || {}).canonical_host) || a.canonical_host || '').toLowerCase();
  const p2 = (u) => { const m = String(u || '').match(/^https?:\/\/([^\/?#]+)(.*)$/i); if (!m) return String(u || '') || '/'; return (!h2 || m[1].toLowerCase() === h2) ? (m[2] || '/') : String(u); };
  let h = `<h2 class="pb">${num}. Search Console &amp; Site Structure</h2>`;
  if (st.crawled_pages != null) {
    const db = st.depth_buckets || {}; const sm = st.sitemap || {};
    h += `<h3>Site structure (from the crawl)</h3><p>${n2(st.crawled_pages)} pages crawled, ${n2(st.indexable_pages)} indexable${st.within_3_clicks_pct != null ? '; ' + st.within_3_clicks_pct + '% of pages are within 3 clicks of the homepage' : ''}.</p>` + (st.crawl_coverage && st.crawl_coverage.text ? `<p>${e2(st.crawl_coverage.text)}.${st.crawl_coverage.coverage_pct != null && st.crawl_coverage.coverage_pct < 90 ? ' Every share below is a share of the pages that were crawled, not of the whole site.' : ''}</p>` : '') +
      `<table class="ct"><tr><th>Clicks from home</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4+</th>${db.unlinked ? '<th>No link reaches it</th>' : ''}</tr><tr><td>Pages</td><td>${n2(db[0])}</td><td>${n2(db[1])}</td><td>${n2(db[2])}</td><td>${n2(db[3])}</td><td>${n2(db['4+'])}</td>${db.unlinked ? '<td>' + n2(db.unlinked) + '</td>' : ''}</tr></table>` +
      ((st.sections || []).length ? `<table class="ct"><tr><th>Section</th><th>Pages crawled</th></tr>` + st.sections.map(s => `<tr><td>${e2(s.section)}</td><td>${n2(s.pages)}</td></tr>`).join('') + `</table>` : '') +
      `<p>XML sitemap: ${sm.status === 200 ? n2(sm.urls) + ' URLs' + (sm.is_index ? ' (index of ' + n2(sm.children) + ' sitemaps)' : '') : 'not readable at ' + e2(sm.url)}${st.indexable_not_in_sitemap ? '; ' + n2(st.indexable_not_in_sitemap) + ' indexable pages missing from it' : ''}${st.sitemap_only ? '; ' + n2(st.sitemap_only) + ' sitemap URLs that no internal link reaches' : ''}${st.sitemap_broken ? '; ' + n2(st.sitemap_broken) + ' sitemap URLs not returning 200' : ''}.</p>`;
  }
  h += `<h3>Google Search Console</h3>`;
  if (!sc.connected) h += `<p>Not connected (${e2(sc.error || 'no access')}). Add the service account as a Full user of the property in Search Console to get submitted-sitemap status, index coverage and search performance in this audit.</p>`;
  else {
    const t = sc.totals;
    h += `<p>Property <b>${e2(sc.property)}</b> (${e2(sc.permission)}).</p>`;
    if (t) h += `<p>Last 28 days (${e2(t.period.start)} to ${e2(t.period.end)}): <b>${n2(t.clicks)}</b> clicks, <b>${n2(t.impressions)}</b> impressions, CTR ${(t.ctr * 100).toFixed(2)}%, average position ${t.position}; ${n2(sc.pages_with_impressions)} pages and ${n2(sc.queries_with_impressions)} queries with impressions.</p>`;
    const hs2 = sc.host_split || null;   // R59: the two addresses Google shows, side by side
    if (hs2 && hs2.found) h += `<p><b>Google shows this site under two addresses.</b> ` + (hs2.hosts || []).map(o => `https://${e2(o.host)}: ${n2(o.pages)} pages, ${n2(o.clicks)} clicks, ${n2(o.impressions)} impressions (${n2(o.impressions_pct)}%)`).join('; ') + `. The site itself names https://${e2(hs2.canonical_host)} as its address (see the www and non-www finding).</p>`;
    h += `<table class="ct"><tr><th>Submitted sitemap</th><th>URLs</th><th>Last read</th><th>Errors</th><th>Warnings</th></tr>` + ((sc.sitemaps || []).length ? sc.sitemaps.map(s => `<tr><td>${e2(s.path)}</td><td>${n2(s.urls)}</td><td>${e2(String(s.downloaded || '').slice(0, 10) || (s.pending ? 'pending' : '—'))}</td><td>${n2(s.errors)}</td><td>${n2(s.warnings)}</td></tr>`).join('') : `<tr><td colspan="5">none submitted${sc.sitemaps_error ? ' (' + e2(sc.sitemaps_error) + ')' : ''}</td></tr>`) + `</table>`;
    const covRows = Object.entries(sc.coverage || {});
    if (covRows.length) h += `<p>Index coverage of ${n2((sc.inspections || []).length)} inspected pages: ` + covRows.map(([k, v]) => `${n2(v)} × ${e2(k)}`).join(', ') + ((sc.rich_results || []).length ? `. Rich results detected: ${e2(sc.rich_results.join(', '))}` : '') + `.</p>`;
    h += indexSection(sc);   // G25: page by page — in Google's index, the canonical it chose, its last crawl, mobile usability, rich results
    if ((sc.not_indexed || []).length) h += `<table class="ct"><tr><th>Not indexed</th><th>Reason</th></tr>` + sc.not_indexed.slice(0, 10).map(x => `<tr><td>${e2(p2(x.url))}</td><td>${e2(x.reason)}${x.shown_as ? ' — shown by Google as ' + e2(x.shown_as) + ' (' + n2(x.shown_impressions) + ' impressions)' : ''}</td></tr>`).join('') + `</table>`;
    if ((sc.top_queries || []).length) h += `<table class="ct"><tr><th>Top query</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr>` + sc.top_queries.slice(0, 10).map(q => `<tr><td>${e2(q.query)}</td><td>${n2(q.clicks)}</td><td>${n2(q.impressions)}</td><td>${q.position}</td></tr>`).join('') + `</table>`;
    if ((sc.scraper_queries || {}).count) h += `<p class="small">${n2(sc.scraper_queries.count)} scraper ${sc.scraper_queries.count === 1 ? 'query' : 'queries'} (search operators such as site: or inurl:, ${n2(sc.scraper_queries.impressions)} impressions) left out of the top queries: they come from SEO tools and scrapers, not from customers.</p>`;
    if ((sc.top_pages || []).length) h += `<table class="ct"><tr><th>Top page</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr>` + sc.top_pages.slice(0, 10).map(q => `<tr><td>${e2(p2(q.page))}</td><td>${n2(q.clicks)}</td><td>${n2(q.impressions)}</td><td>${q.position}</td></tr>`).join('') + `</table>`;
  }
  return h;
};
// ---- v4.5 sections: since the last audit, internal links to add, brand & entity, fix pack ----
const v45Section = (a, num) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p2 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  const D = a.audit_diff || {}; const IL = a.internal_links || []; const E = a.entity || {}; const FP = a.fix_pack || {};
  let h = `<h2 class="pb">${num}. Progress, Links, Brand & Fix Pack</h2><h3>Since the last audit</h3>`;
  if (D.baseline !== false) h += `<p>${e2(D.summary || 'First audit stored.')}</p>`;
  else {
    h += `<p>Previous audit ${e2(String(D.previous.audited_at).slice(0, 10))} (${D.days_since} days ago): score ${D.previous.health_score} → <b>${a.health_score}</b> (${D.score_delta > 0 ? '+' : ''}${D.score_delta}). ${e2(D.summary).replace(/\.$/, '')}.</p>`;
    const rows = [...D.fixed.slice(0, 15).map(f => ['<span class="ok">fixed</span>', f.severity, f.title]), ...D.new.slice(0, 15).map(f => ['<span class="bad">new</span>', f.severity, f.title]), ...D.open.slice(0, 15).map(f => ['still open', f.severity + (f.was && f.was !== f.severity ? ' (was ' + f.was + ')' : ''), f.title + (f.sample_changed ? ' — not compared: ' + (f.sample_note || 'measured on a different number of pages') : (f.affected != null && f.affected_before != null && f.affected !== f.affected_before ? ' — ' + f.affected_before + ' → ' + f.affected + ' affected' : ''))])];
    if (rows.length) h += `<table class="ct"><tr><th>Status</th><th>Severity</th><th>Finding</th></tr>` + rows.map(r => `<tr><td>${r[0]}</td><td>${e2(r[1])}</td><td>${e2(r[2])}</td></tr>`).join('') + `</table>`;
  }
  h += `<h3>Internal links to add</h3>`;
  h += IL.length ? `<p>Pages with few or no links pointing to them, and strong pages on the same topic that can link to them (also in the fix pack as internal-links.csv).</p><table class="ct"><tr><th>On page</th><th>Link to</th><th>Anchor text</th><th>Why</th></tr>` + IL.slice(0, 15).map(l => `<tr><td>${e2(p2(l.from_url))}</td><td>${e2(p2(l.to_url))}</td><td>${e2(l.anchor)}</td><td>${e2(l.reason)}</td></tr>`).join('') + `</table>` : `<p>No page needs extra internal links.</p>`;
  h += `<h3>Brand & entity consistency</h3>`;
  if (!E.business_name) h += `<p>Not checked: no business name on file. Set up the business profile so name, address and phone can be compared with Google Business Profile.</p>`;
  else { const g = E.gbp; h += `<table class="ct"><tr><th></th><th>Google Business Profile</th><th>Your site / profile</th></tr><tr><td>Name</td><td>${e2(g ? g.title : 'not found')}</td><td>${e2(E.business_name)}</td></tr><tr><td>Phone</td><td>${e2(g ? g.phone : '—')}</td><td>${e2([(E.homepage_org || {}).telephone, ...(E.homepage_phones || [])].filter(Boolean).slice(0, 2).join(', ') || '—')}</td></tr><tr><td>Website</td><td>${e2(g ? g.website : '—')}</td><td>${e2(a.domain)}</td></tr>` + (g ? `<tr><td>Rating</td><td>${e2(g.rating != null ? g.rating + '★ (' + (g.reviews || 0) + ' reviews)' : '—')}${g.claimed ? '' : ' · <span class="bad">unclaimed</span>'}</td><td></td></tr>` : '') + `<tr><td>Official profiles (sameAs)</td><td colspan="2">${e2(((E.homepage_org || {}).sameAs || []).join(', ') || 'none in the homepage schema')}</td></tr></table>`; }
  h += `<h3>Fix pack (attached)</h3>` + ((FP.files || []).length ? `<table class="ct"><tr><th>File</th><th>What to do with it</th></tr>` + FP.files.map(f => `<tr><td>${e2(f.name)}</td><td>${e2(f.purpose)}</td></tr>`).join('') + `</table>` : `<p>No files.</p>`);
  return h;
};
// ---- Core Web Vitals per template, from real Chrome users (G7, 2026-10-12) ----
const cwvSection = (a) => {
  const c = a.crux || null;
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p2 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  let h = `<h3>Core Web Vitals per template (real Chrome users)</h3>`;
  if (!c) return h + `<p>Not measured per template in this run.</p>`;
  const TH = c.thresholds || { lcp: 2500, inp: 200, cls: 0.1 };
  if (!c.available) return h + `<p><b>Not available:</b> ${e2(c.not_available)}.${c.not_available_fix ? ' ' + e2(c.not_available_fix) : ''}</p>`
    + `<p class="small">Source: Chrome UX Report (field data). Limits: LCP ${(TH.lcp / 1000).toFixed(1)} s, INP ${TH.inp} ms, CLS ${TH.cls.toFixed(2)} at the 75th percentile.</p>`;
  const cell = (v, limit, fmt) => v == null ? '<td>—</td>' : `<td${v > limit ? ' style="color:#b91c1c;font-weight:bold"' : ''}>${fmt(v)}</td>`;
  const secs = (ms) => (Math.round(ms / 100) / 10).toFixed(1) + ' s';
  const rows = [];
  for (const t of (c.templates || [])) for (const ff of ['phone', 'desktop']) {
    const d = t.devices ? t.devices[ff] : null;
    if (!d) continue;
    rows.push(d.available
      ? `<tr><td>${e2(t.label)}</td><td>${e2(p2(t.url))}</td><td>${ff}</td>` + cell(d.lcp_ms, TH.lcp, secs) + cell(d.inp_ms, TH.inp, (v) => Math.round(v) + ' ms') + cell(d.cls, TH.cls, (v) => Number(v).toFixed(2))
        + `<td>${d.verdict ? (d.verdict.pass ? '<span class="ok">passes</span>' : '<span class="bad">fails ' + d.verdict.failed.join(', ').toUpperCase() + '</span>') : '—'}</td>`
        + `<td class="small">${d.level === 'origin' ? 'whole site (this page has too little traffic)' : 'this page'}${d.period && d.period.last ? ', ' + e2(d.period.first) + ' to ' + e2(d.period.last) : ''}</td></tr>`
      : `<tr><td>${e2(t.label)}</td><td>${e2(p2(t.url))}</td><td>${ff}</td><td colspan="5" class="small">${e2(d.not_available || 'no field data')}</td></tr>`);
  }
  h += rows.length ? `<table class="ct"><tr><th>Template</th><th>Page</th><th>Device</th><th>LCP</th><th>INP</th><th>CLS</th><th>Verdict</th><th>Source</th></tr>` + rows.join('') + `</table>` : `<p>No template could be measured.</p>`;
  h += `<p class="small">Source: <b>Chrome UX Report field data</b> — what real Chrome users measured, at the 75th percentile of the 28 days`
    + `${c.collection_period && c.collection_period.last ? ' ending ' + e2(c.collection_period.last) : ''}. Google's limits: LCP ${(TH.lcp / 1000).toFixed(1)} s, INP ${TH.inp} ms, CLS ${TH.cls.toFixed(2)}.`
    + `${(c.templates_missing || []).length ? ' No page of these templates was found in the crawl: ' + e2(c.templates_missing.join(', ')) + '.' : ''}`
    + ` These figures carry a low weight in the health score; lab measurements (Lighthouse / PageSpeed) are shown separately where this report has them.</p>`;
  return h;
};
// ---- why the first fix is first (G26, 2026-10-12) ----
const prioNote = (a) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return a.priority_first ? `<p class="small"><b>Ordered by likely impact.</b> ${e2(a.priority_first)}</p>` : '';
};
// ---- the minor band folded into one line (G18-2, 2026-10-12) ----
const minorOf = (list) => (list || []).filter(f => f && f.minor === true);
const minorBlock = (list, where) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const m = minorOf(list);
  if (!m.length) return '';
  const row = (f) => `<tr><td><b>${e2(f.title)}</b></td><td class="small">${e2(f.category)} · ${e2(f.severity)}</td>`
    + `<td class="small">${f.scope === 'site' ? 'Whole website' : e2((f.affected_count || 0) + ' page' + ((f.affected_count || 0) === 1 ? '' : 's'))}</td>`
    + `<td class="small">${e2(f.fix || '')}${f.evidence ? '<br>' + e2(f.evidence) : ''}</td></tr>`;
  return `<details open class="minorfold"><summary><b>Minor items (${m.length})</b> — true, and the lowest impact of this audit`
    + `${where ? ' in ' + e2(where) : ''}: one line each instead of a section each, so the list above is the one to act on. Nothing is left out of the score or of the stored findings.</summary>`
    + `<table class="ct"><tr><th>Item</th><th>Area</th><th>Pages</th><th>What to do</th></tr>${m.map(row).join('')}</table></details>`;
};
// ---- what Google says about each key page (G25, 2026-10-13) ----
const indexSection = (sc) => {
  const e3 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p3 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  // R59 (2026-10-16): Google's canonical is printed with its host whenever the host differs from the page's — as a bare path it read
  // "/d365-…-rollout-uae" for the page /d365-…-rollout-uae, a canonical identical to the page, while Google had chosen https://techand.ai
  const h3 = (u) => (String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '';
  const p3c = (g, u) => (h3(g) && h3(u) && h3(g).toLowerCase() !== h3(u).toLowerCase()) ? String(g) : p3(g);
  const ic = sc.index_coverage || null;
  if (!ic) return '';
  let h = `<h3>Google's index view of the key pages (URL Inspection)</h3><p>${e3(ic.text)}.</p>`;
  if ((ic.pages || []).length) {
    h += `<table class="ct"><tr><th>Page</th><th>In Google</th><th>State</th><th>Google's canonical</th><th>Last crawl</th><th>Mobile</th><th>Rich results</th></tr>`
      + ic.pages.slice(0, 25).map(p => `<tr><td>${e3(p3(p.url))}</td><td>${p.indexed === true ? '<span class="ok">yes</span>' : p.indexed === false ? '<span class="bad">no</span>' : '—'}</td><td>${e3(p.coverage || p.verdict || '—')}</td>`
        + `<td>${p.canonical_ok === false ? '<span class="bad">' + e3(p3c(p.google_canonical, p.url)) + '</span>' : p.canonical_ok === true ? 'same as ours' : '—'}</td>`
        + `<td>${e3(String(p.last_crawl || '').slice(0, 10) || '—')}</td><td>${p.mobile_usable === true ? 'ok' : p.mobile_usable === false ? '<span class="bad">issues</span>' : '—'}</td>`
        + `<td>${e3((p.rich_results || []).join(', ') || '—')}</td></tr>`).join('') + `</table>`;
    if (ic.pages.length > 25) h += `<p class="small">${ic.pages.length - 25} more inspected pages are in the data behind this report.</p>`;
  }
  if ((ic.not_checked_pages || []).length) h += `<p class="small"><b>Not checked (${ic.not_checked}):</b> ` + ic.not_checked_pages.slice(0, 8).map(x => e3(p3(x.url))).join(', ')
    + (ic.not_checked_pages.length > 8 ? ' …' : '') + ` — ${e3(ic.not_checked_reason || ic.not_checked_pages[0].reason)}. Nothing is claimed about these pages.</p>`;
  if (ic.mobile_note) h += `<p class="small"><b>Mobile usability:</b> ${e3(ic.mobile_note)} Nothing is claimed about it either way.</p>`;   // R10 (2026-10-13): "no data" is not "not mobile-friendly"
  if (ic.quota_note) h += `<p class="small">${e3(ic.quota_note)}</p>`;
  return h;
};
// ---- how a fix is verified (G11, 2026-10-13) ----
const fixWatchNote = () => `<p class="small"><b>After you fix something:</b> mark it done in the dashboard and the daily key-page watch re-checks that exact item on your key pages within a day (status, noindex, canonical, title, robots.txt) and shows the result — it does not wait for the next monthly audit.</p>`;
// ---- what crawlers see before JavaScript runs (G14, 2026-10-13) ----
const renderDiffSection = (a) => {
  const rdf = a.render_diff || null;
  const e3 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const val = (v) => { const s = String(v == null ? '' : v); return s ? e3(s).slice(0, 110) : '—'; };
  let h = `<h3>What crawlers see before JavaScript runs</h3>`;
  if (!rdf) return h + `<p>Not checked in this run.</p>`;
  if (!rdf.available) return h + `<p><b>Not checked:</b> ${e3(rdf.not_available)}.</p>`;
  const rows = []; const notCmp128 = [], rawMore128 = [];
  for (const p of (rdf.pages || [])) {
    if (!p.checked) { rows.push(`<tr><td>${e3(p.path)}</td><td colspan="4" class="small"><b>not checked</b> — ${e3(p.not_checked)}</td></tr>`); continue; }
    for (const f of (p.figures || [])) {
      if (f.state === 'same' || f.state === 'absent') continue;
      if (f.state === 'not_compared' || f.state === 'raw_more') { (f.state === 'raw_more' ? rawMore128 : notCmp128).push(p.path + ' ' + f.key); continue; }
      rows.push(`<tr><td>${e3(p.path)}</td><td>${e3(f.figure)}</td><td>${val(f.raw)}</td><td>${val(f.rendered)}</td><td class="small">${e3(f.from)}</td></tr>`);
    }
  }
  h += rows.length
    ? `<table class="ct"><tr><th>Page</th><th>Figure</th><th>In the first response</th><th>After JavaScript</th><th>Taken from</th></tr>` + rows.join('') + `</table>`
    : `<p><span class="ok">No difference</span> on any of the ${rdf.pages_checked} ${rdf.paired_with_crawl ? '' : 'key '}page(s) checked: title, main heading, canonical link, robots rule, links and text are all in the first response.</p>`;
  if (notCmp128.length || rawMore128.length) h += `<p class="small">${notCmp128.length ? notCmp128.length + ' figure(s) on ' + new Set(notCmp128.map(x => x.split(' ')[0])).size + ' page(s) paired with the JavaScript crawl were not compared: the crawl counts links and words its own way and keeps its own robots rule, so those differences are of method, not of content. ' : ''}${rawMore128.length ? rawMore128.length + ' count(s) are higher in the first response than after JavaScript: nothing is hidden from a crawler there. ' : ''}</p>`;
  h += `<p class="small">${e3(rdf.method)} ${rdf.pages_checked} page(s) read twice${rdf.pages_not_checked ? `, ${rdf.pages_not_checked} not checked (the reason is in the table)` : ''}${rdf.rendered_source === 'crawl_js' ? '; the rendered reading came from the JavaScript crawl' : ''}${rdf.paired_with_crawl ? '; ' + rdf.paired_with_crawl + ' of them were paired with the JavaScript crawl instead of being rendered again' : (rdf.crawl_js === false && rdf.paired_note ? '; ' + e3(rdf.paired_note) : '')}. AI crawlers do not run JavaScript, so anything listed as coming from the rendered page is invisible to them.</p>`;
  return h;
};
// ---- the links nothing can follow (B5-1, 2026-10-15, benchmark area 5) ----
const uncrawlableSection = (a) => {
  const rdf = a.render_diff || null; const u = rdf && rdf.uncrawlable_links;
  if (!u || !u.total) return '';
  const e4 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = (rdf.pages || []).filter(p => p.uncrawlable).map(p =>
    `<tr><td>${e4(p.path)}</td><td>${p.uncrawlable}</td><td class="small">${e4((p.uncrawlable_samples || []).map(x => '<' + x.tag + '>' + (x.detail ? ' -> ' + x.detail : '')).join(', '))}</td></tr>`).join('');
  return `<h3>Links nothing can follow</h3><table class="ct"><tr><th>Page</th><th>Found</th><th>Examples</th></tr>${rows}</table>`
    + `<p class="small">${e4(u.method)}${u.orphan_pages ? ' The crawl found ' + u.orphan_pages + ' orphan page(s) with no crawlable internal link.' : ''}</p>`;
};
// ---- B5-4 (2026-10-16): the language versions the site declares. Not printed at all when no page read declares any. ----
const hreflangSection = (a) => {
  const hl = a.render_diff && a.render_diff.hreflang; if (!hl) return '';
  const e6 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const L = { invalid: 'Codes that are not valid', relative: 'Addresses that are not absolute', no_self: 'Pages that do not list themselves', no_return: 'Alternates that do not link back',
    duplicate: 'One language, two addresses', no_default: 'Sets without an x-default' };
  const rows = Object.keys(L).map(k => `<tr><td>${L[k]}</td><td>${Number((hl.problems || {})[k]) || 0}</td></tr>`).join('');
  return `<h3>Language versions (hreflang)</h3><p>${hl.declared_on} of ${hl.pages_read} page(s) read declare hreflang.</p><table class="ct"><tr><th>Check</th><th>Pages</th></tr>${rows}</table><p class="small">${e6(hl.method)}</p>`;
};
// ---- R67 (2026-10-16): the severity table counts findings the score does not use; it says so ----
const unscoredNote = (a) => {
  const u = (a.findings || []).filter(f => f && f.scoring === false); if (!u.length) return '';
  const k = u.filter(f => f.source === 'ai_review').length; const n = u.length;
  const label = k === n ? 'AI-review finding' : 'unscored finding';
  return `<p class="small">${n} ${label}${n === 1 ? '' : 's'} counted in this table ${n === 1 ? 'is' : 'are'} not part of the score${k && k < n ? ' (' + k + ' of them from the AI review)' : ''}.</p>`;   // B-17: a sentence
};
// ---- the known URLs the crawl never reached (B5-5, 2026-10-15, benchmark area 5) ----
const notCrawledSection = (a) => {
  const nc = a.not_crawled_check || null;
  const e5 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!nc) return '';
  let h = `<h3>The pages the crawl never reached</h3>`;
  if (!nc.available) return h + `<p><b>Not checked:</b> ${e5(nc.not_available)}.</p>`;
  const LABEL = { live: 'live and indexable', gone: 'gone (404 / 410)', error: 'server error', redirect: 'redirects elsewhere',
    noindex: 'set to noindex', canonical_elsewhere: 'canonical points elsewhere' };
  const detail5 = (p) => p.state === 'redirect' ? ('→ ' + (p.redirect_to || 'an unnamed address'))
    : p.state === 'canonical_elsewhere' ? ('canonical → ' + p.canonical) : (p.title || '—');
  const rows = (nc.pages || []).map(p => !p.checked
    ? `<tr><td>${e5(p.path)}</td><td colspan="3" class="small"><b>not read</b> — ${e5(p.not_checked)}</td></tr>`
    : `<tr><td>${e5(p.path)}</td><td>${p.status}</td><td>${e5(LABEL[p.state] || p.state)}</td><td class="small">${e5(detail5(p))}</td></tr>`).join('');
  h += `<table class="ct"><tr><th>Address</th><th>Answered</th><th>What it is</th><th>Detail</th></tr>${rows}</table>`;
  h += `<p class="small">${e5(nc.basis)}. ${e5(nc.method)}${nc.order_note ? ' ' + e5(nc.order_note) : ''}</p>`;
  return h;
};
const findings = a.findings || [];
const top = findings.filter(f => f.severity === 'Critical' || f.severity === 'High').slice(0, 6);

// ---------- Cover ----------
let html = `
<div class="cover">
  <div class="brand">Site Audit Report</div>
  <h1 class="title">${esc(a.domain)}</h1>
  <p class="sub">${esc(a.pages_crawled)} pages crawled &nbsp;•&nbsp; ${esc(a.crawl_date || today)}</p>
  <table class="scorebox"><tr>
    <td class="big" style="color:${scoreColor(a.health_score)}">${esc(a.health_score)}<span>/100</span></td>
    <td><div class="grade">${esc(a.grade)}</div><div class="lbl">Site Health Score (technical)</div></td>
  </tr></table>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`;

// ---------- Contents ----------
html += `<h2>Contents</h2><ol class="toc">
<li>Executive Summary</li><li>Scores by Category</li><li>What Works Well</li>
<li>Issues Found</li><li>Action Plan</li><li>Search Console &amp; Site Structure (5b)</li><li>Progress, Links, Brand &amp; Fix Pack (5c)</li><li>Not Assessed in This Audit</li><li>Where these numbers come from (6a)</li><li>Methodology</li></ol>`;

// ---------- 1. Executive summary ----------
html += `<h2 class="pb">1. Executive Summary</h2>
<p>We crawled <b>${esc(a.pages_crawled)}</b> pages of <b>${esc(a.domain)}</b> and ran additional checks on security, caching, crawler access and the sitemap. We found:</p>
<table class="ct"><tr>${SEV.map(s => `<th style="background:${SEV_COLOR[s]}">${s}</th>`).join('')}</tr>
<tr>${SEV.map(s => `<td style="text-align:center;font-size:14pt"><b>${counts[s] || 0}</b></td>`).join('')}</tr></table>
${unscoredNote(a)}
${a.score_cap_reason ? `<div class="note"><b>Score limit applied:</b> ${esc(a.score_cap_reason)}. Calculated score before the limit: ${esc(a.raw_score)}/100.</div>` : ''}
${top.length ? '<h3>Fix These First</h3>' + prioNote(a) + fixWatchNote() + '<ol>' + top.map(f => `<li><b>${esc(f.title)}</b> <span class="badge" style="background:${SEV_COLOR[f.severity]}">${esc(f.severity)}</span>${f.evidence ? ' <span class="small">(' + esc(f.evidence) + ')</span>' : ''}<br>${esc(f.fix)}${f.impact_basis ? '<br><span class="small">Why here: ' + esc(f.impact_basis) + ' · impact score ' + esc(f.impact) + '</span>' : ''}</li>`).join('') + '</ol>' : '<p>No critical or high-priority issues found.</p>'}`;

// ---------- Key measurements ----------
const ms = a.measurements || {};
const msRows = [
  ['Homepage server response', ms.homepage_ttfb_ms != null ? ms.homepage_ttfb_ms + ' ms' : 'N/A'],
  ['Cache-Control header', ms.cache_control || 'N/A'],
  ['CDN cache status', (ms.cache_status || []).join(' / ') || 'N/A'],
  ['URLs in sitemap', ms.sitemap_urls != null ? ms.sitemap_urls : 'N/A'],
  ['URLs the crawl reached', ms.crawled_urls != null ? (ms.crawled_urls + (Number(ms.crawled_urls) !== Number(a.pages_crawled) ? ' (' + a.pages_crawled + ' pages analysed; the others are redirects or not HTML)' : '')) : a.pages_crawled],
  ['Server', a.server || ms.server || 'N/A']
];
html += `<h3>Key Measurements</h3><table class="kv">` + msRows.map(r => `<tr><td class="k">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + `</table>`;
html += notCrawledSection(a);
html += uncrawlableSection(a);
html += hreflangSection(a);
html += cwvSection(a);
html += renderDiffSection(a);

// ---------- 2. Category scores ----------
html += `<h2>2. Scores by Category</h2><table class="ct"><tr><th>Category</th><th style="width:60px">Score</th><th style="width:60px">Weight</th><th style="width:45%"></th></tr>` +
  Object.entries(a.category_scores || {}).map(([cat, s]) =>
    `<tr><td>${esc(cat)}</td><td><b style="color:${scoreColor(s)}">${s}</b></td><td>${esc((a.weights || {})[cat])}%</td><td>${bar(s)}</td></tr>`).join('') +
  `</table>`;

// ---------- 3. What works ----------
html += `<h2>3. What Works Well</h2><ul class="good">` +
  (a.what_works || []).map(w => `<li>${esc(w)}</li>`).join('') + `</ul>`;

// ---------- 4. Findings ----------
html += `<h2 class="pb">4. Issues Found</h2>`;
const mainFindings = findings.filter(f => f.minor !== true);
if (minorOf(findings).length) html += `<p class="small">${esc(a.minor_note || '')}</p>`;
for (const sev of SEV) {
  const list = mainFindings.filter(f => f.severity === sev);
  if (!list.length) continue;
  html += `<h3 style="color:${SEV_COLOR[sev]}">${sev} Priority (${list.length})</h3>`;
  for (const f of list) {
    const scope = f.scope === 'site' ? 'Whole website'
      : `${f.affected_count} of ${f.affected_of || a.pages_crawled} ${f.affected_of ? (f.affected_unit || 'items') : 'pages'} (${f.affected_pct}%)`;
    const urls = f.sample_urls || [];
    html += `<div class="finding" style="border-left-color:${SEV_COLOR[sev]}">
      <div class="ftitle"><span class="badge" style="background:${SEV_COLOR[sev]}">${sev}</span> ${esc(f.title)}</div>
      <div class="fmeta">${esc(f.category)} &nbsp;•&nbsp; ${esc(scope)}</div>
      ${f.evidence ? '<p><b>Evidence:</b> ' + esc(f.evidence) + '</p>' : ''}
      <p><b>Why it matters:</b> ${esc(f.why)}</p>
      <p><b>How to fix:</b> ${esc(f.fix)}</p>
      ${urls.length ? '<p class="small"><b>Affected pages:</b><br>' + urls.map(esc).join('<br>') + (f.affected_count > urls.length ? '<br>…and ' + (f.affected_count - urls.length) + ' more' : '') + '</p>' : ''}
    </div>`;
  }
}

html += minorBlock(findings);

// ---------- 5. Action plan ----------
const phase = (title, sevs, when) => {
  const list = findings.filter(f => sevs.includes(f.severity) && f.minor !== true);
  if (!list.length) return '';
  return `<h3>${title} <span class="small">(${when})</span></h3><ul>` + list.map(f => `<li>${esc(f.title)}</li>`).join('') + `</ul>`;
};
html += `<h2 class="pb">5. Action Plan</h2>` +
  phase('Phase 1 — Urgent', ['Critical', 'High'], 'this week') +
  phase('Phase 2 — Important', ['Medium'], 'next 2-4 weeks') +
  phase('Phase 3 — Polish', ['Low', 'Info'], 'when time allows') +
  (minorOf(findings).length ? `<p class="small">Plus ${minorOf(findings).length} minor item(s), folded into one line in section 4.</p>` : '');

html += scSection(a, '5b');
html += v45Section(a, '5c');

// ---------- 6. Not assessed ----------
html += `<h2>6. Not Assessed in This Audit</h2>
<p>This is a technical site audit. The following areas are part of the Full SEO Report and are not included in this score:</p>
<ul>` + (a.not_assessed || []).map(x => `<li>${esc(x)}</li>`).join('') + `</ul>`;

// INVARIANTS rule 1 (2026-10-15): the figure groups of a technical audit with their source, period and sample (LN, v5/code/_lineage.js).
// G29 gave the full report this table and left the audit without one, so the same crawl, the same Search Console numbers and the
// same Lighthouse scores were printed here with nothing to tell them apart.
const _sc72 = a.search_console || {};
const _ins72 = _sc72.inspection_stats || {};
const lineage = [
  LN.of('Health score, the grade and the category scores', 'crawl', { basis: 'modelled', period: LN.asOf(a.audited_at || today), sample: LN.sample(a.pages_crawled, 'pages crawled'),
    note: 'our own 0-100 score: points off per finding by severity (section 7), not a Google figure' }),
  LN.of('The findings and how many pages each one affects', 'crawl', { basis: 'measured', period: LN.asOf(a.audited_at || today), sample: LN.sample(a.pages_crawled, 'pages crawled'),
    note: 'each finding states the pages it was measured on; a finding with nothing to show for it is left out and named in the notes' }),
  _sc72.connected
    ? LN.of('Clicks, impressions and index coverage', 'gsc', { basis: 'measured', period: 'the last 28 days', sample: LN.sample((_sc72.totals || {}).impressions, 'impressions'), note: 'property ' + String(_sc72.property || '') })
    : LN.unknown('Clicks, impressions and index coverage', String(_sc72.error || 'Search Console is not connected for this site')),
  _ins72.asked
    ? LN.of('What Google says about each key page', 'inspection', { basis: 'measured', period: LN.asOf(today), sample: LN.sample(_ins72.checked, 'of ' + _ins72.asked + ' pages Google answered for'), note: String(_ins72.note || '') })
    : LN.unknown('What Google says about each key page', 'no URL inspection ran for this audit'),
  // R73 (2026-10-16): the Chrome UX Report is a known source that ANSWERED ("no field data"), not "source not recorded"; and a
  // technical audit runs no PageSpeed test, so it prints no Lighthouse row (it printed one unconditionally)
  (a.crux && a.crux.available !== false)
    ? LN.of('Core Web Vitals (real users)', 'crux', { basis: 'measured', period: 'the last 28 days of Chrome visits', sample: 'all Chrome visitors Google could aggregate' })
    : a.crux ? LN.of('Core Web Vitals (real users)', 'crux', { basis: 'reported', period: 'the last 28 days of Chrome visits', sample: 'no field data',
        note: 'the Chrome UX Report answered: ' + String(a.crux.not_available || a.crux.note || 'too few real-user visits for field data') })
    : LN.unknown('Core Web Vitals (real users)', 'the Chrome UX Report was not asked in this audit'),
  ...((((d.pagespeed || {}).rows) || []).some(r => r && r.score != null) ? [LN.of('Lighthouse scores and speed savings', 'pagespeed', { basis: 'one_sample', period: LN.asOf(today), sample: 'one simulated mobile load per page tested' })] : []),
  LN.of('Crawler access for search and AI bots', 'own_check', { basis: 'measured', period: LN.asOf(today), sample: '11 user agents requested', note: 'what the live robots.txt and the server answered us' }),
];
html += `<h2>6a. Where these numbers come from</h2>` + LN.block(lineage, { title: '' });

// ---------- 7. Methodology ----------
html += `<h2>7. Methodology</h2>
<p>${esc(a.scoring_method)}</p>
${a.priority_method ? '<p><b>How the fix list is ordered:</b> ' + esc(a.priority_method) + '</p>' : ''}
<table class="ct"><tr><th>Severity</th><th>Points deducted</th></tr>
<tr><td>Critical</td><td>30</td></tr><tr><td>High</td><td>15</td></tr><tr><td>Medium</td><td>7</td></tr><tr><td>Low</td><td>3</td></tr><tr><td>Info</td><td>1</td></tr></table>
<h3>Data Sources</h3>
<table class="ct"><tr><th>Source</th><th>Used for</th></tr>
<tr><td>Full site crawl (DataForSEO On-Page)</td><td>Page-level checks on up to ${esc(d.crawl_max_pages || 200)} pages, including sitemap URLs; duplicate tags, non-indexable pages and redirect chains reports</td></tr>
<tr><td>Direct HTTP checks</td><td>www/HTTPS, caching, security headers, robots.txt, sitemap, llms.txt</td></tr>
<tr><td>Crawler simulation</td><td>Access for 11 search and AI crawlers (user-agent based)</td></tr></table>
${(a.notes || []).map(n => '<p class="small">' + esc(n) + '</p>').join('')}`;

const css = `
@page { margin: 0.8in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 28pt; margin: 6px 0; color: #fff; }
.sub { color: #CBD5E1; margin: 0 0 14px; }
.scorebox td { vertical-align: middle; padding-right: 18px; color: #fff; }
.big { font-size: 44pt; font-weight: bold; }
.big span { font-size: 14pt; color: #CBD5E1; }
.grade { font-size: 16pt; font-weight: bold; color: #fff; }
.lbl { color: #93C5FD; font-size: 10pt; }
.by { color: #93C5FD; margin: 14px 0 0; font-size: 10pt; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
p { margin: 0 0 8px; }
.toc li { margin-bottom: 4px; }
.ct { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 7px; text-align: left; }
.ct td { padding: 7px; border: 1px solid #CBD5E1; vertical-align: middle; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; }
.kv .k { width: 220px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.bar { width: 100%; border-collapse: collapse; }
.bar td { height: 10px; padding: 0; border: none; font-size: 4pt; }
.good li { color: #15803D; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.finding { border-left: 5px solid #CBD5E1; background: #F8FAFC; padding: 10px 14px; margin: 12px 0; }
.ftitle { font-weight: bold; font-size: 11.5pt; color: #0F172A; }
.badge { color: #fff; font-size: 8pt; padding: 2px 6px; font-weight: bold; }
.fmeta { font-size: 9pt; color: #64748B; margin: 3px 0 8px; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;

const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Site Audit — ${esc(a.domain)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head><body>${html}</body></html>`;

const fileName = 'site-audit-' + String(a.domain).replace(/[^a-z0-9]+/gi, '-') + '-' + today + '.doc';

return [{
  json: {
    run_ledger,
    brand: d.brand || 'Dev SEO',
    report_title: 'Site Audit',
    domain: a.domain,
    email: d.email,
    request_id: d.request_id || null,
    callback_url: d.callback_url || '',
    via_webhook: !!d.via_webhook,
    health_score: a.health_score,
    lineage,
    search_console: a.search_console ? (({ page_traffic, page_traffic_complete, ...rest }) => rest)(a.search_console) : null,
    crux: a.crux || null,
    render_diff: a.render_diff || null,
    priority_method: a.priority_method || '',
    priority_first: a.priority_first || '',
    minor_count: a.minor_count || 0,
    minor_note: a.minor_note || '',
    site_structure: a.site_structure || null,
    grade: a.grade,
    issue_counts: counts,
    top_issues: top.map(f => f.title),
    file_name: fileName
  },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + doc, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];