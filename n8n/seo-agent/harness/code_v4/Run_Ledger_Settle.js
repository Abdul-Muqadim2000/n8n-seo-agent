// G23 (2026-10-13, FIX_PLAN; RESULTS §2.10): what this run really cost, split into measured and estimated money, in one place before the
// seo_run_ledger row is settled. Until now `settled_usd` stored the per-mode RESERVATION and every reader — the guard, the app, the
// re-rating — took it for a measured cost; the three Opus nodes stream, so no token usage is reported at all and Claude's spend could be
// stated no closer than "$1.6-3.0". The report builders now price every Claude call from the characters its prompt really interpolated, the
// characters it answered with and the thinking budget of its effort level (v5/code/_cost_cal.js, on `run_ledger.ai_cost`), and this node
// writes that figure, the measured DataForSEO cost, the split and the one line that says which half is which.
//
// R33 (2026-10-14, FIX_PLAN §3.13): that pricing reached only the five report builders, so every other branch settled its RESERVATION —
// `describe` (exec 591) settled $0.06 where its own Haiku node reported 4,874 / 1,306 tokens = $0.0114, with `ai_measured: false` and
// "this branch priced no model call of its own". The same per-call pricing now runs HERE, over this run's own Claude nodes, so `describe`,
// `track`, `profile`, `published`, `checkin` and `case_study` settle what they used. R31: a run in which no model node ran at all settles
// **nothing** for Claude instead of the figure it reserved (CC.aiRun).
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
const ENDS = ["Build Audit Report", "Build Full Report", "Build Keyword File", "Build Ladder Report", "Build Word File"];   // the nodes that carry run_ledger (the five report builders), written in at build time
const first = (name) => { try { const it = $(name).first(); return (it && it.json) || null; } catch (e) { return null; } };
const row = first('Run Ledger Row') || {};
const req = first('Rate Limit') || first('Normalize Input') || {};
let led = null;
for (const n of ENDS) { const j = first(n); if (j && j.run_ledger) { led = j.run_ledger; break; } }
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r4 = (v) => +Number(num(v) || 0).toFixed(4);

// ---- Claude: this run's own calls, priced from what the run can see ----
// R33: the block below is written in by build_v4.py section 59 — the same call table the report builders use, baked from the real model
// nodes, so a branch that ends anywhere else still prices every Claude node that ran in it.
let __ownAi = null, __aiRan = [], __aiChecked = 0;
const run_ledger = {};   // R33 (2026-10-14, FIX_PLAN §3.13): this run's own Claude calls, priced exactly as a report builder prices them

// ---- what Claude cost this run (G23, 2026-10-13): priced per call from what the run can actually see ----
// A streaming call reports no token usage, so there is nothing to read; what the run does know is the prompt it built, the answer it got
// and the thinking budget of the node's effort level. Every figure here is an ESTIMATE and says so (ai_cost.estimated / .basis), and the
// per-model correction factors the monthly reconciliation writes into seo_cache are applied before the prices are.
const __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Seeds)", "count_answer": "Count Answer (Keyword Seeds)", "count_per_item": false, "count_rounds": 1, "model_node": "Anthropic Chat Model"}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4953, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false, "count_prompt": "Count Prompt (Competitor Analyzer)", "count_answer": "Count Answer (Competitor Analyzer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Competitor Analyzer"}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false, "count_prompt": "Count Prompt (Content Reviewer)", "count_answer": "Count Answer (Content Reviewer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Content Reviewer"}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 10243, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "goal", "keyword", "language_name", "page_type", "proof_context", "role_writer", "site_description", "spelling", "tone", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Copywriter)", "count_answer": "Count Answer (Copywriter)", "count_rounds": 1, "model_node": "Claude \u2014 Copywriter"}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 6212, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": false, "count_prompt": "Count Prompt (Critic)", "count_answer": "Count Answer (Critic)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Critic"}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 6153, "input": "Needs Revision?", "fields": ["content_brief", "content_qa.length_instruction", "content_qa.main_content_words", "content_qa.missing_terms", "content_qa.target_word_count", "content_qa.warnings", "critique", "keyword", "language_name", "output", "spelling"], "from": [], "loop": true, "count_prompt": "Count Prompt (Editor)", "count_answer": "Count Answer (Editor)", "count_rounds": 1, "model_node": "Claude \u2014 Editor"}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2468, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Relevance)", "count_answer": "Count Answer (Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Keyword Relevance"}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2468, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Ladder Keyword Relevance)", "count_answer": "Count Answer (Ladder Keyword Relevance)", "count_per_item": true, "count_rounds": 0, "model_node": "Claude \u2014 Ladder Relevance"}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false, "count_prompt": "Count Prompt (Site Describer)", "count_answer": "Count Answer (Site Describer)", "count_per_item": false, "count_rounds": 1, "model_node": "Claude \u2014 Site Describer"}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 24576, "effort": "medium", "streaming": true, "template_chars": 13048, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_reasons", "verdict_score", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Strategy Brief)", "count_answer": "Count Answer (Strategy Brief)", "count_rounds": 1, "model_node": "Claude \u2014 Strategy Brief"}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 5923, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "existing_page_facts_text", "goal", "keyword", "keyword_data", "language_name", "own_coverage_text", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false, "count_prompt": "Count Prompt (Verdict Agent)", "count_answer": "Count Answer (Verdict Agent)", "count_per_item": false, "count_rounds": 1, "model_node": "Verdict Chat Model"}];
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
__ownAi = run_ledger.ai_cost;
__aiRan = __costCalls.map(c => String(c.node));     // the Claude nodes that produced something in THIS execution
__aiChecked = __AI_CALLS.length;                     // and how many this workflow has, so 'none ran' is a measurement, not a guess

// Part of a content run IS measured (the Sonnet calls report usage) while its three streaming Opus nodes can only be estimated, so the
// run figure's own split travels through rather than the whole amount being labelled one or the other.
const fig = (led && led.ai_cost && num(led.ai_cost.calls) > 0) ? led.ai_cost : (__ownAi && num(__ownAi.calls) > 0 ? __ownAi : (led && led.ai_cost) || null);
const ai = CC.aiRun({ figure: fig, reserved: row.est_usd, ran: __aiRan, checked: __aiChecked });

// ---- DataForSEO: measured whenever a paid node answered with a cost, except the crawl, which is only ever quoted ----
// R32 (2026-10-14, FIX_PLAN §3.13): the on_page crawl is billed for the pages it crawls and DataForSEO reports only the quote for the
// pages it was ASKED for, so the report builders price it pro rata (CC.crawlCost) and hand the estimated part over as
// `run_ledger.dataforseo_estimated_usd`. Everything else in the figure is the cost each task reported.
// R31's shape on the DataForSEO side: a run whose ledger says no paid node ran spent nothing, and settles nothing — the reservation is
// only fallen back on where this branch carries no ledger at all and the run therefore cannot know.
const dfsKnown = !!(led && num(led.dataforseo_calls) != null);
const dfsM = dfsKnown && num(led.dataforseo_calls) > 0 && num(led.dataforseo_usd) != null;
const dfsEst = dfsM ? r4(led.dataforseo_estimated_usd) : 0;
const crawl = (led && led.crawl_cost) || null;
const dfs = { usd: dfsM ? r4(led.dataforseo_usd) : (dfsKnown ? 0 : r4(row.dfs_est_usd)), measured: dfsKnown && dfsEst <= 0,
  measured_usd: dfsM ? Math.max(0, r4(r4(led.dataforseo_usd) - dfsEst)) : 0,
  basis: dfsM
    ? ('the cost every DataForSEO task reported' + (dfsEst > 0 && crawl ? '; the crawl is priced from the pages it crawled — ' + String(crawl.basis || '') : ''))
    : dfsKnown ? 'no DataForSEO call ran in this run, so nothing is settled against the $' + r4(row.dfs_est_usd).toFixed(4) + ' it reserved'
    : r4(row.dfs_est_usd) > 0 ? 'the per-mode reservation: this branch carries no ledger of its own' : 'no DataForSEO money was reserved or spent' };

// R28 (2026-10-14, FIX_PLAN §3.12): the engine's own "measured" DataForSEO figures did not reconcile with the account — +73% in one window
// of the 2026-10-14 run, +11.6% in another. Every reservation now records the free `appendix/user_data` balance reading (*DFS Balance* ->
// seo_run_ledger.dfs_balance), so the day's settled rows can be held against the only measurement that cannot be argued with: how far the
// balance actually fell. Nothing is corrected automatically; when the two disagree the row says so and names the account as the truth.
let __ledgerRows = []; try { __ledgerRows = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const dfs_day = CC.dfsDay(__ledgerRows, row);

// B-A5 (2026-10-15, build section 62): the day is not the run. `dfsDay` holds the day's settled rows against the account, which says
// nothing about any single run — a run can be 100% out while the day still agrees, and *Load Run Ledger* ran at RESERVE time, so it
// cannot even see the runs that started after this one. *DFS Balance End* takes a second free `appendix/user_data` reading and
// *Load Run Ledger (Settle)* reloads the rows around this run's window, so the move between this run's two readings is attributed to
// this run when no other row was open across it — and the run keeps its per-task figure, saying why, when one was.
const settled_at = new Date().toISOString();
let __endBalance = 0;
try { const __b = $('DFS Balance End').first().json || {}; const __t = (__b.tasks || [])[0] || {}; const __r = (__t.result || [])[0] || {};
  const __v = Number((__r.money || {}).balance); if (Number.isFinite(__v) && __v > 0) __endBalance = +__v.toFixed(6); } catch (e) {}
let __nowRows = [];
try { __nowRows = $('Load Run Ledger (Settle)').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) { __nowRows = __ledgerRows; }
const dfs_run = CC.dfsRun({ rows: __nowRows.length ? __nowRows : __ledgerRows, mine: row, end_balance: __endBalance, settled_at,
  engine_usd: dfs.usd, calls: dfsKnown ? num(led.dataforseo_calls) : null });
if (dfs_run.attributed) {
  // the account is the measurement: it supersedes the per-task sum AND the crawl's pro-rata estimate, so nothing of this run's
  // DataForSEO money is an estimate any more.
  dfs.usd = dfs_run.usd; dfs.measured = true; dfs.measured_usd = dfs_run.usd;
  dfs.basis = dfs_run.basis + ' (its own tasks: ' + dfs.basis + ')';
} else if (dfs_run.comparable) {
  dfs.basis = dfs.basis + '. ' + dfs_run.basis;
}

// R81 part 1 (2026-10-16, re-rating C-5): a monitor request is a HAND-OFF. The front door (this run) reserved a row for `ai_visibility` /
// `backlinks`, started the monitor in its own execution (Monitor Start -> Start AI Visibility / Start Backlink Monitor) and spent nothing
// itself — the monitor reserves and settles its own row, whose key names this run (`parent:<this run>`, R77). This row used to settle the
// per-mode reservation ("$0.5000 ESTIMATED (the per-mode reservation: this branch carries no ledger of its own)", row 91) on top of the
// child's measured figure, so the day counted the request twice ($2.89 reported against $1.48 moved). It now settles $0, `done`, says
// where the money is, and teaches the cost calibration nothing.
const __started = first('Monitor Started');
const __handoff = !!__started && ['ai_visibility', 'backlinks'].includes(String(row.mode || req.mode || ''));
if (__handoff) {
  const __ms = first('Monitor Start') || {};
  const __kind = String(__ms.monitor || row.mode || req.mode || '');
  const __wf = __kind === 'ai_visibility' ? 'the AI Visibility Tracker (SEOagentAIVisib1)' : 'the Backlink Monitor (SEOagentBacklnk1)';
  const __ok = __started.started !== false && !__started.error;
  ai.usd = 0; ai.measured = true; ai.basis = 'no model call ran in this run: the work was handed off';
  dfs.usd = 0; dfs.measured = false; dfs.measured_usd = 0;
  dfs.basis = __ok
    ? 'handed off to ' + __wf + ', started from this run: that run reserves and settles its own ledger row (key parent:' + String($execution.id) + ') and carries this request\'s money, so nothing is counted here'
    : 'the monitor could not be started (' + String(__started.error || 'no execution was started').slice(0, 160) + '), so nothing was spent';
}
const split = CC.split(ai, dfs);
// `cost_mode` is "<Claude estimate key>|<DataForSEO estimate key>" — the two keys whose rolling figures this run settles into
// (Cost Calibration Row). It is on the reserved row already; it is rebuilt from the request when an older row has none.
const cost_mode = String(row.cost_mode || (CC.pick('ai', req).key + '|' + CC.pick('dfs', req).key));
const __out = {
  run_id: String($execution.id), mode: String(row.mode || req.mode || ''), status: 'done', cost_mode,
  // the guard counts Claude money, so `settled_usd` stays the Claude figure — now the run's own, not a flat per-mode guess
  settled_usd: ai.usd, ai_usd: ai.usd, ai_measured: ai.measured,
  // R115 (2026-10-16): the measured half of the Claude money, so a callback built from this row can split it (v5/code/_ledger_cb.js)
  ai_measured_usd: +Number(ai.measured_usd || 0).toFixed(4),
  dfs_usd: dfs.usd, dfs_measured: dfs.measured,
  measured_usd: split.measured_usd, estimated_usd: split.estimated_usd,
  // the day's reconciliation rides on the row's own basis line, so nobody has to go looking for it
  cost_basis: (dfs_day.comparable && !dfs_day.within ? split.cost_basis + '. Day check: ' + dfs_day.basis : split.cost_basis).slice(0, 500),
  dfs_balance: +Number(row.dfs_balance || 0).toFixed(6), dfs_day_reconciled: dfs_day.comparable && dfs_day.within,
  dfs_day: dfs_day,
  // B-A5: the run's own reconciliation — the second free reading, which figure the row carries and whether the account could answer
  // for this run alone
  settled_at, dfs_balance_end: __endBalance, dfs_source: dfs_run.source, dfs_run,
  dfs_run_reconciled: dfs_run.attributed && dfs_run.within, dfs_tasks_usd: dfsM ? r4(led.dataforseo_usd) : 0,
  // R32: what the crawl was quoted, what it crawled and what it was priced at — the three numbers behind the estimated half.
  // B-A5: when the account answered for this run, the crawl's pro-rata estimate is superseded and NO DataForSEO money is an estimate
  // any more; `crawl_cost` stays on the row as the record of what the crawl was quoted and what it did.
  dfs_estimated_usd: dfs_run.attributed ? 0 : dfsEst, crawl_cost: crawl,
  // for the execution, the callback and anyone reading it: never stored as if it were measured
  ai_calls: fig ? Number(fig.calls) || 0 : 0, ai_in_tokens: fig ? Number(fig.in_tokens) || 0 : 0, ai_out_tokens: fig ? Number(fig.out_tokens) || 0 : 0,
  ai_estimated: !ai.measured, ai_basis: ai.basis, ai_source: ai.source, ai_nodes_ran: ai.ran, ai_nodes_checked: ai.checked,
  ai_by_node: fig ? fig.by_node : {}, ai_models: fig ? fig.models : {},
  ai_streaming_nodes: fig ? (fig.streaming_nodes || []) : [],
};
if (__handoff) {
  // R81: the whole row says one thing — $0 here, the money on the child's row — and nothing on it reads as a measurement to learn from
  Object.assign(__out, { settled_usd: 0, ai_usd: 0, ai_measured: true, ai_measured_usd: 0, dfs_usd: 0, dfs_measured: false, measured_usd: 0, estimated_usd: 0,
    dfs_source: 'handoff', dfs_estimated_usd: 0, dfs_tasks_usd: 0, dfs_run_reconciled: false, dfs_day_reconciled: false,
    ai_calls: 0, ai_in_tokens: 0, ai_out_tokens: 0, ai_by_node: {}, ai_models: {},
    cost_basis: ('Claude $0.0000, DataForSEO $0.0000: ' + dfs.basis).slice(0, 500), handed_off: true });
}
return [{ json: __out }];
