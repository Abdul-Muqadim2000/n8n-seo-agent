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
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '—')
        + '</td><td ' + td + '>' + esc1(l.sample || '—') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
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
    const budget = c.effort ? Math.round(n0(c.max_tokens) * (THINK_SHARE[String(c.effort)] || 0)) * calls : 0;
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
            + (think > 0 ? '; the ' + think + ' thinking token(s) it cannot see are modelled from the '
              + String(c.effort) + ' effort budget' : '')
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
    discover: 0.34,           // 0.2552 (exec 518) — was 0.15, below the money
    ladder: 0.21,             // 0.1162 (exec 495) + 24 results-page calls at $0.002 = 0.1642 — was 0.16 before B2-4 (2026-10-15)
    ai_visibility: 0.95,      // 0.7946 (exec 526) — was 0.60, below the money
    backlinks: 0.5,           // 0.3727 (execs 528 / 529)
    assess: 0.034,            // 0.0254 per check (execs 487-489, $0.0761 for three) — was 0.024, below the money
  };
  const ALPHA = 0.3;          // how fast the rolling figure follows the last settle
  const HEADROOM = 1.25;      // the guard reserves a quarter more than the rolling figure
  const KEEP = 8;             // the recent window whose maximum the estimate may never fall below
  const CAP = 5;              // and never more than five times the shipped default: one freak run may not lock the guard
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

  // one request -> what it reserves. `room` is the extra the case-study intake holds back for the page run it spawns.
  const pick = (kind, d, cal) => {
    const keys = keysFor(kind, d);
    let usd = 0, source = 'default', floor = 0;
    for (const k of keys) { const e = estOf(kind, k, cal); usd += e.usd; floor += e.floor; if (e.source === 'calibrated') source = 'calibrated'; }
    const room = (kind === 'ai' && String((d || {}).mode) === 'case_study') ? estOf('ai', 'content', cal).usd : 0;
    // `key` is the PRIMARY estimate key and the one the rolling figure is stored under, so what a settle teaches is read back by the next
    // run of the same shape; `label` names every key the request used (a run that also needs a site description adds `describe`, which
    // only makes that mode's figure a shade conservative — the safe direction).
    return { usd: r4(usd), keys, key: keys[0] || '', label: keys.join('+'), source, floor: r4(floor), room: r4(room),
      basis: keys.length ? (source === 'calibrated' ? 'calibrated from this mode\'s last settled runs (never below $' + r4(floor).toFixed(4) + ', what it recently cost)' : 'the shipped estimate for ' + keys.join(' + ') + ' (no settled run of this mode yet)') : 'this mode spends nothing here' };
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

  return { PRICES, UNKNOWN, CHARS_PER_TOKEN, THINK_SHARE, EST, DFS_EST, ALPHA, HEADROOM, KEEP, CAP, FACTOR_KEY, MODEL_PREFIX,
    RECONCILE_TOLERANCE, RECONCILE_FLOOR, RUN_OVERSPEND, COUNTER, countUsage, dfsLedger, dfsDay, dfsRun, crawlCost, aiRun,
    family, priceOf, tokensOf, callCost, runCost, keysFor, readCal, estOf, pick, calKey, calStat, calRow, monthRow, part, costBasis, split };
})();
// ---- results-page observations (2026-10-11, FIX_PLAN D26): an AI Overview (and every other SERP feature) is what ONE Google query showed at
// ONE moment — live, the ladder plan said "no AI Overview" and the page run minutes later "cites 11 domains". Inlined by the build
// (the SERP_OBS placeholder) into Analyze Competitor Pages (the digest the verdict reads), Build Keyword Strategy (stored vs live checks) and Build
// Ladder Report; the keyword report's row is patched by build_v4.py. Every text says WHEN it was seen ("seen in the check at 15:58 UTC on
// 2026-10-11") or "seen in N of M checks", and that AI Overviews vary between searches — never "there is no AI Overview".
// the time of a DataForSEO SERP answer (result datetime "2026-10-11 15:58:12 +00:00", else the task time, else now) as ISO
const serpSeenAt = (res) => {
  try {
    const t0 = ((res || {}).tasks || [])[0] || {}; const r0 = (t0.result || [])[0] || {};
    const raw = String(r0.datetime || t0.time || r0.check_url_time || '');
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|([+-]\d{2}):?(\d{2}))?/);
    if (m) { const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + (m[4] ? m[4] + ':' + m[5] : 'Z')); if (!isNaN(d.getTime())) return d.toISOString(); }
  } catch (e) {}
  return new Date().toISOString();
};
// "15:58 UTC on 2026-10-11"
const obsClock = (iso) => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return 'an unknown time'; const z = d.toISOString(); return z.slice(11, 16) + ' UTC on ' + z.slice(0, 10); };
// obs: [{ seen: true | false | null, at: iso, source }] -> { count, seen, text }; null = that check could not read the results page (not counted)
const aioObserved = (obs) => {
  const known = (obs || []).filter(o => o && o.seen != null);
  if (!known.length) return { count: 0, seen: 0, text: 'unknown — the results page could not be read' };
  const seen = known.filter(o => o.seen);
  const one = (o) => (o.seen ? 'seen' : 'not seen') + ' in the check at ' + obsClock(o.at) + (o.source ? ' (' + o.source + ')' : '');
  if (known.length === 1) return { count: 1, seen: seen.length, text: one(known[0]) + ' — AI Overviews vary between searches, so this is one observation, not a fixed feature of the query' };
  return { count: known.length, seen: seen.length, text: 'seen in ' + seen.length + ' of ' + known.length + ' checks (' + known.map(one).join('; ') + ') — AI Overviews vary between searches' };
};

// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['AI Demand (Retry)', 'AI SERP (Retry)', 'Ask LLMs (Retry)', 'Backlink Gap (Retry)', 'Backlink Summary (Retry)', 'Candidate SERP (Retry)', 'DataForSEO Whois (Retry)', 'Domain Overview (Retry)', 'Fallback SERP (Retry)', 'Fetch GBP (Retry)', 'Find Competitors (Retry)', 'Get Crawled Pages (Retry)', 'Keyword Ideas (Retry)', 'Ranked Keywords (Retry)', 'Run Competitor Keywords (Retry)', 'Run Crawl Extras (Retry)', 'Run Ladder Research (Retry)', 'Run Reach Requests (Retry)', 'Run Research (Retry)', 'Site Authority (Retry)', 'Start Crawl (Retry)', 'SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP', 'Run Ladder Cluster SERP', 'Run Ladder Cluster SERP (Retry)', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand'];
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
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Seeds)", "count_answer": "Count Answer (Keyword Seeds)", "count_per_item": false, "count_rounds": 1, "model_node": "Anthropic Chat Model"}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4953, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false, "count_prompt": "Count Prompt (Competitor Analyzer)", "count_answer": "Count Answer (Competitor Analyzer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Competitor Analyzer"}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false, "count_prompt": "Count Prompt (Content Reviewer)", "count_answer": "Count Answer (Content Reviewer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Content Reviewer"}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 10243, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "goal", "keyword", "language_name", "page_type", "proof_context", "role_writer", "site_description", "spelling", "tone", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Copywriter)", "count_answer": "Count Answer (Copywriter)", "count_rounds": 1, "model_node": "Claude \u2014 Copywriter"}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 6212, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": false, "count_prompt": "Count Prompt (Critic)", "count_answer": "Count Answer (Critic)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Critic"}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 6153, "input": "Needs Revision?", "fields": ["content_brief", "content_qa.length_instruction", "content_qa.main_content_words", "content_qa.missing_terms", "content_qa.target_word_count", "content_qa.warnings", "critique", "keyword", "language_name", "output", "spelling"], "from": [], "loop": true, "count_prompt": "Count Prompt (Editor)", "count_answer": "Count Answer (Editor)", "count_rounds": 1, "model_node": "Claude \u2014 Editor"}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2468, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Relevance)", "count_answer": "Count Answer (Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Keyword Relevance"}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2468, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Ladder Keyword Relevance)", "count_answer": "Count Answer (Ladder Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Ladder Relevance"}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false, "count_prompt": "Count Prompt (Site Describer)", "count_answer": "Count Answer (Site Describer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Site Describer"}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 24576, "effort": "medium", "streaming": true, "template_chars": 13048, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_reasons", "verdict_score", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Strategy Brief)", "count_answer": "Count Answer (Strategy Brief)", "count_rounds": 1, "model_node": "Claude \u2014 Strategy Brief"}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 5394, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "existing_page_facts_text", "goal", "keyword", "keyword_data", "language_name", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false, "count_prompt": "Count Prompt (Verdict Agent)", "count_answer": "Count Answer (Verdict Agent)", "count_per_item": false, "count_rounds": 1, "model_node": "Verdict Chat Model"}];
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
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, counted, calls: Math.max(__base104, __runs104), retries: Math.max(0, __runs104 - __base104) });
}
run_ledger.ai_cost = CC.runCost(__costCalls, CC.readCal(__calRows()).factors);
run_ledger.ai_usd = run_ledger.ai_cost.usd;
run_ledger.ai_cost_estimated = run_ledger.ai_cost.estimated;

const d = $input.first().json;
const md = String(d.output || '');
const kd = d.keyword_data || {};
const ca = d.competitor_analysis || {};
const qa = d.content_qa || {};
const brief = d.content_brief || {};

const wantSeo = d.include_seo_report !== false;
const wantContent = !!d.include_content && md.length > 0;
const wantAudit = !!d.include_audit;
const wantVerdict = !!d.verdict;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' ? 'N/A' : Number(n).toLocaleString('en-GB'));

let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';

// Schema comes from the QA step (deterministic, page-type aware)
const scriptRe = new RegExp('<' + 'script type="application/ld\\+json">([\\s\\S]*?)<' + '/script>', 'gi');
const schemaBlocks = Array.isArray(d.schema_blocks) ? d.schema_blocks : [];
let content = md.replace(scriptRe, '').trim();
const sf = d.serp_features || null;

// Meta lines alag karo
const metaRe = /^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):\s*(.+)$/gim;
const meta = [];
let m;
while ((m = metaRe.exec(content)) !== null) meta.push({ label: m[1], value: m[2] });
content = content.replace(metaRe, '').trim();

function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/\[([^\[\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\[([^\[\]]+)\](?!\()/g, '<span class="ph">[$1]</span>');
  return t;
}

function mdToHtml(text) {
  const out = [];
  let list = null, table = null;
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const closeTable = () => { if (table) { out.push('</table>'); table = null; } };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('|')) {
      closeList();
      if (/^\|[\s:|-]+\|$/.test(l)) continue;
      const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { out.push('<table class="ct">'); table = 'open';
        out.push('<tr>' + cells.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr>'); }
      else out.push('<tr>' + cells.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      continue;
    }
    closeTable();
    if (!l) { closeList(); continue; }
    let x;
    if ((x = l.match(/^(#{1,4})\s+(.+)$/))) { closeList(); const h = x[1].length; out.push('<h' + h + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
    if ((x = l.match(/^>\s*(.+)$/))) { closeList(); out.push('<div class="callout">' + inline(x[1].replace(/^Note:\s*/i, '')) + '</div>'); continue; }
    if ((x = l.match(/^Q\d+:\s*(.+)$/))) { closeList(); out.push('<p class="fq">' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^A\d+:\s*(.+)$/))) { closeList(); out.push('<p class="fa">' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^[-*]\s+(.+)$/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    if ((x = l.match(/^\d+\.\s+(.+)$/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    closeList();
    out.push('<p>' + inline(l) + '</p>');
  }
  closeList(); closeTable();
  return out.join('\n');
}

const kv = (rows) => '<table class="kv">' + rows.map(r =>
  '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';

const today = new Date().toISOString().slice(0, 10);
const parts = [];

// ===== COVER =====
const reportType = [wantSeo ? 'SEO Report' : '', wantContent ? 'Page Content' : '', wantAudit ? 'Site Audit' : '',
  (wantVerdict && !wantSeo && !wantContent && !wantAudit) ? 'Keyword Verdict' : '']
  .filter(Boolean).join(' + ');
parts.push(`
<div class="cover">
  <div class="brand">${esc(reportType)}</div>
  <h1 class="title">${esc(d.keyword)}</h1>
  <p class="sub">${esc(d.page_type)} &nbsp;•&nbsp; ${esc(d.country)}${d.domain ? ' &nbsp;•&nbsp; ' + esc(d.domain) : ''} &nbsp;•&nbsp; ${today}</p>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`);

// ===== KEYWORD VERDICT =====
if (wantVerdict) {
  const verdictLabel = { GO: 'GO — Target This Keyword', GO_WITH_CHANGES: 'GO, WITH CHANGES', AVOID: 'AVOID', NOT_CHECKED: 'NOT CHECKED — the live Google results could not be read' }[d.verdict] || esc(d.verdict);
  const verdictClass = d.verdict === 'GO' ? 'ok' : (d.verdict === 'AVOID' ? 'bad' : '');
  parts.push(h2('Keyword Verdict') + kv([
    ['Verdict', '<span class="' + verdictClass + '">' + esc(verdictLabel) + '</span>'],
    ['Score', d.verdict_score != null ? d.verdict_score + '/100' : (d.score_withheld ? 'not scored — the live Google results could not be read' : 'N/A')],
    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')],
    ['Difficulty for your site', d.for_you ? esc(d.for_you.label) : (d.domain ? 'not measured for this request' : 'no website on this request')],
    ['Expected visits/month at #1-3', d.expected_visits ? (d.expected_visits.visits != null ? num(d.expected_visits.visits) + ' \u2014 ' + esc(d.expected_visits.basis_text) : esc(d.expected_visits.basis_text)) : (d.score_withheld ? 'not estimated' : 'N/A')],
    ['Time to rank', d.time_to_rank ? esc(d.time_to_rank.months) + ' months \u2014 ' + esc(LN.BASIS.modelled) + (d.time_to_rank.chance && d.time_to_rank.chance.label ? ', ' + esc(d.time_to_rank.chance.label) : '') : (d.score_withheld ? 'not estimated' : 'N/A')]
  ]) +
  ((d.for_you || d.time_to_rank || d.expected_visits) ? '<p class="muted">' + [d.for_you && d.for_you.note, d.time_to_rank && d.time_to_rank.note, d.expected_visits && d.expected_visits.note].filter(Boolean).map(esc).join(' ') + '</p>' : '') +
  '<h3>Why</h3>' + ul(d.verdict_reasons) +
  ((d.verdict_changes && d.verdict_changes.length) ? '<h3>What must change first</h3>' + ul(d.verdict_changes) : '') +
  ((d.verdict_risks && d.verdict_risks.length) ? '<h3>Risks / Watch-outs</h3>' + ul(d.verdict_risks) : '') +
  ((d.secondary_keywords && d.secondary_keywords.length) ? '<h3>Secondary Keywords Worth Targeting</h3>' + ul(d.secondary_keywords) : ''));
}

// ===== SEO REPORT =====
if (wantSeo) {
  const trend = kd.trend_yearly_pct;
  const trendTxt = trend == null ? 'N/A' : (trend > 0 ? '+' : '') + trend + '% (last 12 months)';
  const bl = kd.competitor_backlink_strength || {};

  parts.push(h2('Keyword Overview') + kv([
    ['Monthly Searches', num(kd.search_volume)],
    ['Keyword Difficulty', (kd.keyword_difficulty == null ? 'N/A' : kd.keyword_difficulty + '/100') + ' — ' + esc(kd.difficulty_label || '')],
    ['Cost Per Click', kd.cpc == null ? 'N/A' : esc(d.currency) + ' ' + kd.cpc],
    ['Ads Competition', esc(kd.ads_competition || 'N/A')],
    ['Search Intent', esc(ca.search_intent || kd.google_intent || 'N/A')],
    ['Search Trend', esc(trendTxt)],
    ['Competitor Link Strength', 'Avg ' + num(bl.avg_referring_domains) + ' referring domains, ' + num(bl.avg_backlinks) + ' backlinks']
  ]));

  if (d.existing_page && d.existing_page.url) {
    parts.push('<div class="note"><b>Existing page found:</b> ' + esc(d.existing_page.url) + (d.existing_page.source === 'sitemap' ? ' (matched from the sitemap)' : '') + '. The content below is written to improve that page rather than create a duplicate.</div>');
  }
  if (sf && sf.unavailable) {
    parts.push(h2('What the Results Page Looks Like') + '<div class="note">The live Google results could not be read for this run (search data provider: ' + esc(sf.error || 'no answer') + '). Featured snippet, People Also Ask, AI Overview and the competitor pages are unknown, not absent.</div>');
  } else if (sf) {
    const aio = sf.ai_overview || {};
    parts.push(h2('What the Results Page Looks Like') + kv([
      ['Featured snippet', sf.featured_snippet ? esc(sf.featured_snippet.domain) + ' — "' + esc(String(sf.featured_snippet.text).slice(0, 160)) + '"' : 'None'],
      ['AI Overview', esc(aioObserved([{ seen: aio.present == null ? null : !!aio.present, at: aio.seen_at || sf.checked_at }]).text.replace(/^./, c => c.toUpperCase())) + (aio.present ? '. In that check it cited ' + esc((aio.cited_domains || []).join(', ') || 'unknown sources') + '.' : '')],
      ['People Also Ask', (sf.people_also_ask || []).length ? esc(sf.people_also_ask.slice(0, 8).join(' • ')) : 'None'],
      ['Related searches', (sf.related_searches || []).length ? esc(sf.related_searches.slice(0, 8).join(' • ')) : 'None'],
      ['Other features', esc((sf.features_present || []).join(', ') || 'none')],
      ['Results for this query', num(sf.se_results_count)]
    ]) + ((ca.serp_feature_strategy) ? '<div class="callout"><b>How to win the features:</b> ' + esc(ca.serp_feature_strategy) + '</div>' : ''));
  }

  const kt = d.keyword_types;
  if (kt) {
    const groups = [
      ['Informational', 'People looking for information or answers', kt.informational],
      ['Navigational', 'People looking for a specific brand or website', kt.navigational],
      ['Commercial', 'People comparing options before buying', kt.commercial],
      ['Transactional', 'People ready to buy, book or order', kt.transactional]
    ];
    let html = h2('Keyword Research by Search Intent');
    for (const g of groups) {
      const rows = (g[2] || []).map(k =>
        `<tr><td>${esc(k.keyword)}</td><td>${num(k.search_volume)}</td><td>${k.keyword_difficulty == null ? 'N/A' : k.keyword_difficulty}</td><td>${k.cpc == null ? 'N/A' : k.cpc}</td></tr>`).join('');
      html += `<h3>${g[0]} Keywords</h3><p class="small">${g[1]}</p>`;
      html += rows
        ? `<table class="ct"><tr><th>Keyword</th><th>Monthly Searches</th><th>Difficulty</th><th>CPC</th></tr>${rows}</table>`
        : '<p>No keywords found for this intent.</p>';
    }
    parts.push(html);
  }

  const compRows = (d.competitors_summary || []).map(c =>
    `<tr><td>#${esc(c.rank)}</td><td>${esc(c.domain)}</td><td>${esc(c.title)}</td><td>${num(c.word_count)}</td></tr>`).join('');
  const strengths = (ca.competitor_strengths || []).map(s => `<li><b>${esc(s.domain)}:</b> ${esc(s.strength)}</li>`).join('');
  const weaknesses = (ca.competitor_weaknesses || []).map(s => `<li><b>${esc(s.domain)}:</b> ${esc(s.weakness)}</li>`).join('');
  parts.push(h2('Competitor Content Analysis') + `
<p>${esc(ca.intent_explanation || '')}</p>
<h3>Top Ranking Pages</h3>
<table class="ct"><tr><th>Rank</th><th>Domain</th><th>Page Title</th><th>Words</th></tr>${compRows}</table>
<h3>What Competitors Do Well</h3><ul>${strengths || '<li>N/A</li>'}</ul>
<h3>Where Competitors Are Weak</h3><ul>${weaknesses || '<li>N/A</li>'}</ul>
<h3>Content Gaps to Fill</h3>${ul(ca.content_gaps)}
<div class="callout"><b>Recommended Unique Angle:</b> ${esc(brief.unique_angle || ca.unique_angle || '')}</div>
<div class="note"><b>Ranking Feasibility:</b> ${esc(ca.feasibility_note || '')}</div>`);
}

// ===== PAGE CONTENT =====
if (wantContent) {
  parts.push(h2('Content Quality Check', true) + kv([
    ['Status', qa.passed ? '<span class="ok">Passed</span>' : qa.not_ready ? '<span class="bad">Did not pass \u2014 not ready to publish</span>' : '<span class="bad">Needs review</span>'],
    ...(qa.not_ready ? [['Why it is not ready', '<span class="bad">' + (qa.not_ready_reasons || []).map(esc).join('<br>') + '</span>']] : []),   // R11 (2026-10-13): the LAST round's reasons, on the page the owner reads first
    ...(qa.placeholder_note && !qa.not_ready ? [['Figures still masked', '<span class="bad">' + esc(qa.placeholder_note) + '</span>']] : []),   // R25 (2026-10-14): a masked figure in the body is named even when the page is otherwise deliverable
    ...((qa.sourced_amounts || []).length ? [['Amounts kept', esc((qa.sourced_amounts || []).slice(0, 6).map(a => a.amount + ' (' + a.source + ')').join(', ')) + ' \u2014 each one is stated by the source cited in the same sentence']] : []),   // B3-1 (2026-10-15)
    ...(qa.profile_placeholders ? [['Fields only you can fill', '<span class="bad">' + num(qa.profile_placeholders) + ' bracketed field(s) in the byline / author box / Person schema \u2014 set up the business profile</span>']] : []),
    ['Main Content Words', num(qa.main_content_words) + ' (target ' + num(qa.target_word_count) + ')'],
    ['FAQ Words', num(qa.faq_words)],
    ['Keyword Mentions', num(qa.keyword_mentions) + ' (density ' + (qa.keyword_density_pct == null ? 'N/A' : qa.keyword_density_pct) + '%)'],
    ['Sections (H2)', num(qa.h2_count)],
    ['FAQs', num(qa.faq_count)],
    ['Meta title / description length', num(qa.meta_title_length) + ' / ' + num(qa.meta_description_length) + ' characters'],
    ['Internal links to existing pages', num(qa.internal_links)],
    ['Quick answer block', qa.answer_block_words ? qa.answer_block_words + ' words' : 'Missing'],
    ['Editing rounds', num(qa.round || d.qa_round || 1)],
    ['Schema generated', esc((qa.schema_types || []).join(', ') || 'None')],
    ['Content score', qa.content_score != null ? '<b>' + qa.content_score + '/100</b>' + (qa.score_breakdown ? ' (structure ' + qa.score_breakdown.structure + '/25, topic coverage ' + qa.score_breakdown.coverage + '/25, readability ' + qa.score_breakdown.readability + '/15, specificity ' + qa.score_breakdown.specificity + '/10, clean language ' + qa.score_breakdown.clean_language + '/10, length ' + qa.score_breakdown.length + '/15)' : '') : 'N/A'],
    ['Topic coverage', qa.coverage && qa.coverage.basis ? esc(qa.coverage.basis) + (qa.coverage.subtopics_missing && qa.coverage.subtopics_missing.length ? ' · subtopics still missing: ' + esc(qa.coverage.subtopics_missing.slice(0, 3).join('; ')) : '') : (qa.coverage_pct != null ? qa.coverage_pct + '% of the terms top-ranking pages share' : 'N/A')],
    ['Originality', qa.originality ? (qa.originality.passed === null ? 'Could not be checked: no competitor or own page text was available in this run'
      : (qa.originality.highest_pct != null ? qa.originality.highest_pct + '% of the page matches ' + esc(qa.originality.highest_source || 'another page') + ' word for word (limit ' + qa.originality.threshold_pct + '%' + (qa.originality.passed ? '' : ' — EXCEEDED') + ')' : 'No overlap found')
        + ' · ' + esc(qa.originality.basis)) : 'N/A'],
    ['Readability', qa.readability ? 'Flesch ' + qa.readability.flesch + ' · ' + qa.readability.avg_sentence_words + ' words per sentence · passive voice ' + qa.readability.passive_pct + '%' : 'N/A'],
    ['Filler phrases left', (qa.banned_phrases || []).length ? esc(qa.banned_phrases.map(b => b.phrase).slice(0, 6).join(', ')) : 'none'],
    ['Editorial review', qa.critic_score != null ? qa.critic_score + '/100 — ' + esc(qa.critic_verdict || '') : 'N/A']
  ]) + ((qa.warnings && qa.warnings.length) ? '<h3>Warnings (please review before publishing)</h3>' + ul(qa.warnings) : '') +
  ((qa.auto_fixes && qa.auto_fixes.length) ? '<h3>Automatic fixes applied</h3>' + ul(qa.auto_fixes) : '') +
  '<p class="small">Text in <span class="ph">[square brackets]</span> must be replaced with your real business details before publishing.</p>');

  parts.push(h2('Page Content', true) +
    '<h3>SEO Meta Tags</h3>' + (meta.length ? kv(meta.map(x => [x.label, esc(x.value)])) : '') +
    '<div class="content">' + mdToHtml(content) + '</div>');

  const links = (brief.internal_link_suggestions || []).filter(l => l && l.url && content.includes('(' + String(l.url).trim() + ')'));
  if (links.length) {
    parts.push(h2('Internal Links Used') + '<table class="ct"><tr><th>Anchor text</th><th>Links to (existing page)</th></tr>' +
      links.map(l => '<tr><td>' + esc(l.anchor) + '</td><td>' + esc(l.url) + '</td></tr>').join('') + '</table>');
  }
  const imgs = (brief.image_suggestions || []).filter(i => i && i.alt_text);
  if (imgs.length) {
    parts.push(h2('Image Plan') + '<p>Three images per page: a hero (also the featured and Open Graph image, 1200×630 for sharing) and two in-body visuals. Save them as WebP under the suggested file names and keep the alt text.</p><table class="ct"><tr><th>Placement</th><th>Purpose</th><th>What it shows</th><th>Alt text</th><th>File name</th></tr>' +
      imgs.map(i => '<tr><td>' + esc(i.placement) + '</td><td>' + esc(i.purpose || '') + '</td><td>' + esc(i.subject || '') + (i.caption ? '<br><i>' + esc(i.caption) + '</i>' : '') + '</td><td>' + esc(i.alt_text) + '</td><td>' + esc(i.filename || '') + '</td></tr>').join('') + '</table>');
  }
  // ---- v4.4: author, trust and page extras ----
  const au = d.author || null, rv = d.reviewer || null, role = d.page_role || 'standard', vid = d.video || null, hp = d.hub_pages || [];
  const extraRows = [['Page role', esc({ hub: 'Hub / pillar page (table of contents, cluster summaries, "Guides in this series")', case_study: 'Case study (snapshot box, facts from the intake only)', local: 'Local page for ' + (d.local_area || '[City]') + ' (verified NAP block, LocalBusiness schema)', standard: 'Standard page' }[role] || role)],
    ['Author (byline, author box, Person schema)', au ? esc(au.name + (au.job_title ? ', ' + au.job_title : '')) + (au.url ? ' · ' + esc(au.url) : '') : '<span class="bad">No author on file — [placeholders] in the package; set up the business profile</span>'],
    ['Expert reviewer', rv ? esc(rv.name + (rv.job_title ? ', ' + rv.job_title : '')) : 'none'],
    ['Experience notes', (brief.experience_notes || []).length ? ul(brief.experience_notes) : 'none']];
  if (role === 'hub') extraRows.push(['Cluster pages linked', hp.length ? ul(hp.map(p => (p.keyword || p.url) + ' — ' + p.url + (p.planned ? ' (planned)' : ''))) : 'none found']);
  if (vid) extraRows.push(['Video', esc((vid.title || vid.url) + (vid.minutes ? ' · ' + vid.minutes + ' min' : '') + (vid.upload_date ? ' · uploaded ' + String(vid.upload_date).slice(0, 10) : '')) + ((vid.chapters || []).length ? ' · ' + vid.chapters.length + ' key moments' : '') + ' · transcript ' + (vid.transcript ? 'included' : '<span class="bad">missing</span>')]);
  if (d.case_study) extraRows.push(['Case study', esc((d.case_study.client_public === false ? 'anonymised client' : d.case_study.client_name) + ' · ' + (d.case_study.service || '') + (d.case_study.timeline ? ' · ' + d.case_study.timeline : ''))]);
  parts.push(h2('Author, Trust & Page Extras') + kv(extraRows) + ((qa.eeat_notes || []).length ? '<h3>Before publishing</h3>' + ul(qa.eeat_notes) : ''));
  // ---- G31: the customer's own style guide, and what the draft did with it ----
  const sg = qa.style_guide || null, st = qa.style || null;
  if (sg || (st && (st.notes || []).length)) {
    const sgRows = [];
    if (sg && sg.brand_form) sgRows.push(['Brand name is written', esc(sg.brand_form) + ((sg.wrong_forms || []).length ? ' <span class="small">(never ' + sg.wrong_forms.map(w => esc(w)).join(', ') + ')</span>' : '')]);
    if (sg && sg.spelling_effective) sgRows.push(['Spelling', esc(sg.spelling_effective) + ' <span class="small">(' + esc(sg.spelling_source || 'house style') + ')</span>']);
    if (sg && (sg.avoid || []).length) sgRows.push(['Words to avoid', esc(sg.avoid.join(', '))]);
    if (sg && sg.tone) sgRows.push(['Tone', esc(sg.tone)]);
    if (sg && sg.notes) sgRows.push(['Other rules', esc(sg.notes)]);
    const brandErr = st && (st.brand || []).length ? st.brand.map(b => 'The name was written "' + b.found + '" ' + b.count + ' time(s)') : [];
    parts.push(h2('Your Style Guide') + (sgRows.length ? kv(sgRows) : '<p>No style guide on file: set the brand\'s written form, the spelling variant, words to avoid and the tone once, and every page follows them.</p>')
      + (brandErr.length ? '<h3>Corrected before delivery</h3>' + ul(brandErr) : '')
      + ((st && (st.notes || []).length) ? '<h3>Style notes (advice, not blockers)</h3>' + ul(st.notes) : (sgRows.length ? '<p class="ok">The draft matches every mechanical rule of your style guide.</p>' : '')));
  }
  const tc = (qa.term_coverage || []);
  if (tc.length) parts.push(h2('Topic Coverage vs Top-Ranking Pages') + '<p class="small">Terms the top pages share and how often this page uses them.</p><table class="ct"><tr><th>Term</th><th>Target</th><th>Found</th><th></th></tr>' + tc.slice(0, 30).map(t => '<tr><td>' + esc(t.term) + '</td><td>' + t.target + '</td><td>' + t.found + '</td><td>' + (t.ok ? '<span class="ok">ok</span>' : '<span class="bad">add</span>') + '</td></tr>').join('') + '</table>');
  const srcs = (qa.sources_cited || []);
  if (srcs.length) parts.push(h2('Sources Cited') + '<table class="ct"><tr><th>Anchor</th><th>URL</th></tr>' + srcs.map(s => '<tr><td>' + esc(s.anchor) + '</td><td>' + esc(s.url) + '</td></tr>').join('') + '</table>');
  const tv = (brief.title_variants || []), mv = (brief.meta_variants || []);
  if (tv.length || mv.length) parts.push(h2('Title & Meta Alternatives') + (tv.length ? '<h3>Titles</h3>' + ul(tv) : '') + (mv.length ? '<h3>Meta descriptions</h3>' + ul(mv) : ''));
  if (d.critique && ((d.critique.strengths || []).length || (d.critique.problems || []).length)) parts.push(h2('Editorial Review') + kv([['Score', (d.critique.score != null ? d.critique.score + '/100' : 'N/A') + ' — ' + esc(d.critique.verdict || '')]]) + ((d.critique.strengths || []).length ? '<h3>Strengths</h3>' + ul(d.critique.strengths) : '') + ((d.critique.problems || []).length ? '<h3>Issues raised (addressed by the editor)</h3>' + ul(d.critique.problems.slice(0, 8).map(p => '[' + p.severity + '] ' + p.issue)) : ''));
  if (schemaBlocks.length) {
    parts.push(h2('Structured Data (JSON-LD)', true) +
      '<p class="small">Paste each block in the page\'s &lt;head&gt; or before &lt;/body&gt;. Replace every [square-bracket] value first.</p>' +
      schemaBlocks.map(b => '<h3>' + esc(b.type) + '</h3>' + (b.note ? '<p class="small">' + esc(b.note) + '</p>' : '') +
        '<pre class="code">' + esc('<' + 'script type="application/ld+json">\n' + JSON.stringify(b.json, null, 2) + '\n<' + '/script>') + '</pre>').join(''));
  }
}

// ===== SITE AUDIT =====
if (wantAudit) {
  if (d.site_audit) {
    parts.push(h2('Site Audit', true) + '<pre class="code">' + esc(JSON.stringify(d.site_audit, null, 2)) + '</pre>');
  } else {
    parts.push(h2('Site Audit', true) + '<div class="note">The site audit for ' + esc(d.domain) + ' runs separately and is emailed as its own report when it finishes.</div>');
  }
}


// ---- B-L3 (2026-10-15, INVARIANTS rule 1): where the numbers in THIS document came from. Every report type renders through this
// node — the keyword verdict, the keyword report, the written page and the audit attachment — and until today not one of them
// carried its sources into the .doc the customer opens. Only the sections this document actually contains are listed.
const lineage = [];
if (wantVerdict) lineage.push(d.score_withheld
  ? LN.unknown('The verdict, its score, expected visits and time to rank', 'the live Google results could not be read for this keyword, so nothing was scored')
  : LN.of('The verdict, its score, expected visits and time to rank', 'model', { basis: 'modelled', period: LN.asOf(today), sample: 'one keyword in ' + String(d.country || ''),
      note: 'our own 0-100 score from the demand, the difficulty and who ranks now; the visits are modelled from click-share curves, never measured clicks' }));
if (wantSeo) {
  lineage.push(LN.of('Monthly searches, keyword difficulty, cost per click and ads competition', 'kwdata', { basis: 'estimated', period: 'the provider\'s latest 12-month average',
    sample: 'one keyword in ' + String(d.country || ''), note: 'a provider estimate for a single keyword, not a measurement of your site' }));
  if (kd.competitor_backlink_strength) lineage.push(LN.of('Competitor link strength', 'backlink_index', { basis: 'reported', period: LN.asOf(today),
    sample: LN.sample((kd.competitor_backlink_strength || {}).pages_checked, 'top-ranking pages'), note: 'one crawler\'s index of the web: it finds much of the web, never all of it' }));
  lineage.push((sf && !sf.unavailable)
    ? LN.of('What the results page looks like, and who ranks now', 'serp', { basis: 'one_sample', period: LN.asOf(sf.checked_at || today), sample: 'one results page',
        note: 'read once, from ' + String(d.country || 'the chosen country') + ' on one device; a feature not seen in that one check is unknown, not absent' })
    : LN.unknown('What the results page looks like, and who ranks now', String((sf && sf.error) || 'no live results page was read in this run')));
  if ((ca.top_pages || []).length) lineage.push(LN.of('The competitor pages, their word counts and the content gaps', 'web', { basis: 'measured', period: LN.asOf(today),
    sample: LN.sample((ca.top_pages || []).length, 'competitor pages read'), note: 'pages we fetched and read ourselves; the strengths and gaps are an AI reading of those pages' }));
}
if (wantContent) {
  lineage.push(qa.content_score == null
    ? LN.unknown('Content score and its breakdown', 'the quality check produced no score for this page')
    : LN.of('Content score and its breakdown', 'model', { basis: 'modelled', period: LN.asOf(today), sample: LN.sample(qa.main_content_words, 'words of the finished draft'),
        note: 'our own score, not a Google figure: structure 25, topic coverage 25, readability 15, specificity 10, clean language 10, length 15'
          + (qa.round ? ' (quality round ' + qa.round + ' of ' + qa.max_rounds + ')' : '') }));
  lineage.push(qa.readability
    ? LN.of('Readability (Flesch, sentence length, passive voice)', 'draft', { basis: 'measured', period: LN.asOf(today), sample: LN.sample(qa.main_content_words, 'words'),
        note: 'counted in the finished draft itself' })
    : LN.unknown('Readability (Flesch, sentence length, passive voice)', 'the readability check did not run for this page'));
  lineage.push((qa.coverage && Number(qa.coverage.terms_total) > 0)
    ? LN.of('Topic coverage against the top-ranking pages', 'web', { basis: 'measured', period: LN.asOf(today),
        sample: LN.sample(qa.coverage.terms_total, 'shared terms' + (qa.coverage.pages_compared ? ', from ' + qa.coverage.pages_compared + ' competitor pages read' : '')), note: String(qa.coverage.basis || '') })
    : LN.unknown('Topic coverage against the top-ranking pages', String(((qa.coverage || {}).basis) || 'no competitor page could be read in this run, so coverage was not measured')));
  lineage.push((qa.originality && Number(qa.originality.pages_compared) > 0)
    ? LN.of('Originality (overlap with the pages this run read)', 'web', { basis: 'measured', period: LN.asOf(today),
        sample: LN.sample(qa.originality.pages_compared, 'pages compared'), note: String(qa.originality.basis || '') })
    : LN.unknown('Originality (overlap with the pages this run read)', String(((qa.originality || {}).basis) || 'no page text was available in this run, so nothing could be compared')));
}
if (wantAudit) lineage.push(d.site_audit
  ? LN.of('The site audit findings and its health score', 'crawl', { basis: 'modelled', period: LN.asOf(today), sample: LN.sample((d.site_audit || {}).pages_crawled, 'pages crawled'),
      note: 'our own 0-100 score: points off per finding by severity, not a Google figure' })
  : LN.unknown('The site audit findings and its health score', 'the site audit runs separately and is sent as its own report'));
parts.push(h2('Where these numbers come from', true)
  + '<table class="ct"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="small">A figure marked "' + esc(LN.BASIS.modelled) + '" is computed, not counted; "' + esc(LN.BASIS.estimated) + '" is the data provider\'s own estimate for a single keyword; "'
  + esc(LN.MISSING) + '" means the figure reached this document without its source and should be treated as unverified.</p>');

const css = `
@page { margin: 0.9in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 26pt; margin: 6px 0; color: #fff; border: none; }
.sub { color: #CBD5E1; margin: 0; }
.by { color: #93C5FD; margin: 10px 0 0; font-size: 10pt; }
h1 { color: #0F172A; font-size: 20pt; border-bottom: 3px solid #0F172A; padding-bottom: 6px; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
h4 { color: #334155; font-size: 11.5pt; }
p { margin: 0 0 9px; }
a { color: #1D4ED8; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; vertical-align: top; }
.kv .k { width: 190px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.ct { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 7px; text-align: left; border: 1px solid #1E3A8A; }
.ct td { padding: 7px; border: 1px solid #CBD5E1; }
.callout { border-left: 4px solid #1E3A8A; background: #F1F5F9; padding: 10px 14px; margin: 12px 0; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.ph { background: #FEF3C7; color: #92400E; }
.ok { color: #15803D; font-weight: bold; }
.bad { color: #B91C1C; font-weight: bold; }
.fq { font-weight: bold; color: #0F172A; margin-top: 12px; margin-bottom: 2px; }
.fa { margin-left: 14px; color: #334155; }
.small { font-size: 9pt; color: #64748B; }
.code { background: #0F172A; color: #E2E8F0; padding: 12px; font-family: Consolas, monospace; font-size: 8.5pt; white-space: pre-wrap; }
.pb { page-break-before: always; }`;

const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(d.keyword)} — ${esc(reportType)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>${parts.join('\n')}</body></html>`;

const prefix = wantSeo && wantContent ? 'seo-report-and-content'
  : wantSeo ? 'seo-report'
  : wantContent ? 'page-content'
  : wantAudit ? 'site-audit'
  : wantVerdict ? 'keyword-verdict'
  : 'report';
const safe = String(brief.slug || d.keyword || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = prefix + '-' + safe + '-' + today + (qa.not_ready ? '-DRAFT' : '') + '.doc';   // R11 (2026-10-13)

return [{
  json: {
    run_ledger,
    request_id: d.request_id || null,
    keyword: d.keyword,
    country: d.country,
    domain: d.domain || '',
    email: d.email || '',
    report_type: reportType,
    lineage,
    file_name: fileName,
    qa_passed: qa.passed,
    via_webhook: !!d.via_webhook,
    callback_url: d.callback_url || '',
    mode: d.mode,
    brand: d.brand || 'Dev SEO',
    existing_page: d.existing_page || null,
    // R11 (2026-10-13, re-rating §3.11): the summary is this (the LAST) round's, and when the rounds ran out with the gate still failing it says the page is not ready
    qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed'
      : qa.not_ready ? 'Did not pass the quality check \u2014 not ready to publish (round ' + qa.round + ' of ' + qa.max_rounds + '): ' + ((qa.not_ready_reasons || []).slice(0, 3).join('; ') || ((qa.warnings || []).length + ' item(s) to review'))
        : 'Quality check: ' + ((qa.warnings || []).length + (qa.profile_placeholders ? 1 : 0)) + ' item(s) to review'),
    qa_publishable: qa.passed == null ? null : !!qa.passed,
    qa_not_ready: !!qa.not_ready, qa_label: qa.quality_label || '', qa_reasons: qa.not_ready_reasons || [], qa_quality: qa.quality || null,
    qa_round: qa.round == null ? null : qa.round, qa_max_rounds: qa.max_rounds == null ? null : qa.max_rounds,
    qa_placeholders: qa.placeholders_total == null ? null : qa.placeholders_total,
    qa_placeholder_note: (qa.quality || {}).placeholder_note || '',   // R25 (2026-10-14): the app and the callback name the masked figures too
    qa_amounts: { removed: qa.masked_amounts || [], for_review: qa.flagged_amounts || [], kept_from_source: qa.sourced_amounts || [] },   // B3-1 / B3-2 (2026-10-15)
    content_links_to_add: qa.links_to_add_when_published || [],   // R15: every planned ladder / cluster link, for the package
    ladder_target_url: d.ladder_target_url || '',
    verdict: d.verdict,
    verdict_score: d.verdict_score,
    for_you: d.for_you || null, time_to_rank: d.time_to_rank || null, expected_visits: d.expected_visits || null,   // B1-1 (2026-10-15): the app shows the same labelled figures as the document
    verdict_reasons: d.verdict_reasons || [],
    verdict_risks: d.verdict_risks || [],
    recommended_page: d.recommended_page,
    secondary_keywords: d.secondary_keywords || [],
    keyword_data: d.keyword_data || null,
    ladder_id: d.ladder_id || '', ladder_rung: d.ladder_rung ?? null, ladder_head: d.ladder_head || '',
    publish_wordpress: !!d.publish_wordpress, wordpress_url: d.wordpress_url || '',
    content_originality: qa.originality || null, content_coverage: qa.coverage || null,
    page_markdown: md || undefined, content_brief_slug: brief.slug || '', schema_blocks: schemaBlocks, content_score: qa.content_score == null ? null : qa.content_score, language_name: d.language_name || 'English', language_code: d.language_code || 'en', content_images: Array.isArray(brief.image_suggestions) ? brief.image_suggestions : [],
    page_role: d.page_role || 'standard', article_like: d.article_like == null ? null : !!d.article_like, author: d.author || null, reviewer: d.reviewer || null, site_profile: d.site_profile || null, hub_pages: d.hub_pages || [], video: d.video || null, case_study: d.case_study || null, case_id: d.case_id || '', local_area: d.local_area || '', content_brief_video_placement: brief.video_placement || '', eeat_notes: qa.eeat_notes || [], style_notes: qa.style_notes || [], style_guide: qa.style_guide || null, page_type: d.page_type || ''
  },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + html, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];