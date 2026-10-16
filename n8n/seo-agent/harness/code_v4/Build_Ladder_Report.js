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
    const cnt = u ? null : countUsage(c);
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
    return { node: String(c.node || ''), model, family: fam, calls, in_tokens: inTok, out_tokens: outTok, think_tokens: think,
      usd, measured_usd, estimated_usd, measured: !!(u || cnt) && estimated_usd <= 0,
      counted: !!cnt, counted_rounds: rounds, counter: cnt ? cnt.source : '', streaming: !!c.streaming, factor,
      basis: u ? 'measured: the token usage this call reported'
        : cnt ? 'measured: ' + cnt.source + ' counted ' + cnt.in_tokens + ' prompt and ' + cnt.out_tokens + ' answer token(s)'
            + (covers > 1 ? ' across ' + covers + ' call(s)' : '')
            + (calls > rounds ? ', repeated for the ' + (calls - rounds) + ' round(s) the counter did not see' : '')
            + (think > 0 ? '; the ' + think + ' thinking token(s) it cannot see are modelled from the '
              + String(c.effort) + ' effort budget' : '')
            + (estimated_usd > 0 ? ' ($' + estimated_usd.toFixed(4) + ' of $' + usd.toFixed(4) + ' is modelled)' : '')
        : 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token'
            + (think > 0 ? ' plus the thinking budget' : '') };
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
      if (r.need_site_description) k.push('describe');
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
    // every other row that was open while this run was in flight
    const open = (x.rows || []).filter((r) => {
      if (!r || !r.run_id || r.error || String(r.run_id) === mineId) return false;
      const c = String(r.created_at || '');
      if (!c || (to && c >= to)) return false;                       // reserved after this run had already settled
      if (String(r.status || '') !== 'done') return true;            // still reserved or stale: it was open the whole time
      const s = String(r.settled_at || '');
      return !s || !from || s > from;                                // settled, but only after this run reserved: it overlapped
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

// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['AI Demand (Retry)', 'AI SERP (Retry)', 'Ask LLMs (Retry)', 'Backlink Gap (Retry)', 'Backlink Summary (Retry)', 'Candidate SERP (Retry)', 'DataForSEO Whois (Retry)', 'Domain Overview (Retry)', 'Fallback SERP (Retry)', 'Fetch GBP (Retry)', 'Find Competitors (Retry)', 'Get Crawled Pages (Retry)', 'Keyword Ideas (Retry)', 'Ranked Keywords (Retry)', 'Run Competitor Keywords (Retry)', 'Run Crawl Extras (Retry)', 'Run Ladder Research (Retry)', 'Run Reach Requests (Retry)', 'Run Research (Retry)', 'Site Authority (Retry)', 'Start Crawl (Retry)', 'SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP', 'Run Ladder Cluster SERP', 'Run Ladder Cluster SERP (Retry)', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Run Ladder Research'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer', 'Keyword Relevance', 'Ladder Keyword Relevance', 'Critic'];

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
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Seeds)", "count_answer": "Count Answer (Keyword Seeds)", "count_per_item": false, "count_rounds": 1}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4953, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false, "count_prompt": "Count Prompt (Competitor Analyzer)", "count_answer": "Count Answer (Competitor Analyzer)", "count_per_item": false, "count_rounds": 1}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false, "count_prompt": "Count Prompt (Content Reviewer)", "count_answer": "Count Answer (Content Reviewer)", "count_per_item": false, "count_rounds": 1}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 10243, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_facts_text", "existing_page_tables", "existing_page_text", "goal", "keyword", "language_name", "page_type", "proof_context", "role_writer", "site_description", "spelling", "tone", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Copywriter)", "count_answer": "Count Answer (Copywriter)", "count_rounds": 1}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 6212, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": false, "count_prompt": "Count Prompt (Critic)", "count_answer": "Count Answer (Critic)", "count_per_item": false, "count_rounds": 1}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 6153, "input": "Needs Revision?", "fields": ["content_brief", "content_qa.length_instruction", "content_qa.main_content_words", "content_qa.missing_terms", "content_qa.target_word_count", "content_qa.warnings", "critique", "keyword", "language_name", "output", "spelling"], "from": [], "loop": true, "count_prompt": "Count Prompt (Editor)", "count_answer": "Count Answer (Editor)", "count_rounds": 1}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Keyword Relevance)", "count_answer": "Count Answer (Keyword Relevance)", "count_per_item": true, "count_rounds": 0}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false, "count_prompt": "Count Prompt (Ladder Keyword Relevance)", "count_answer": "Count Answer (Ladder Keyword Relevance)", "count_per_item": true, "count_rounds": 0}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false, "count_prompt": "Count Prompt (Site Describer)", "count_answer": "Count Answer (Site Describer)", "count_per_item": false, "count_rounds": 1}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 24576, "effort": "medium", "streaming": true, "template_chars": 13048, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_reasons", "verdict_score", "video_context"], "from": [], "loop": false, "count_prompt": "Count Prompt (Strategy Brief)", "count_answer": "Count Answer (Strategy Brief)", "count_rounds": 1}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 5394, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "existing_page_facts_text", "goal", "keyword", "keyword_data", "language_name", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false, "count_prompt": "Count Prompt (Verdict Agent)", "count_answer": "Count Answer (Verdict Agent)", "count_per_item": false, "count_rounds": 1}];
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __jsonOf = (n) => { try { return ($(n).all() || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
// R46 (2026-10-16): a `loop` node is the Editor, and it runs once per QA round AFTER the first — QA round N follows N - 1 editor calls, which
// Content QA states as `editor_rounds`. Live (exec 616) one editor call was priced twice from `qa_round: 2`. At least 1: the node ran.
const __qaRounds = () => { try { const q = $('Content QA').first().json || {}; const e = Number(q.editor_rounds); return Math.max(1, Number.isFinite(e) && q.editor_rounds != null ? e : (Number(q.qa_round) || 1) - 1); } catch (e) { return 1; } };
const __countOf = (n) => { let sum = 0, k = 0; for (const j of (__jsonOf(n) || [])) { const v = Number((j || {}).input_tokens); if (Number.isFinite(v) && v > 0) { sum += v; k++; } } return { sum: sum, n: k }; };
const __costCalls = [];
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
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, counted, calls: answers.length * (c.loop ? __qaRounds() : 1) });
}
run_ledger.ai_cost = CC.runCost(__costCalls, CC.readCal(__calRows()).factors);
run_ledger.ai_usd = run_ledger.ai_cost.usd;
run_ledger.ai_cost_estimated = run_ledger.ai_cost.estimated;

// ---- reach (v4.8, PIPELINE_FEATURE_SPEC §5.3-5.5): the keyword difficulty this website can already win. ONE copy, inlined by the build into
// Ladder Plan, Reach (Discovery), Rank Keywords, Build Keyword Strategy and the Keyword Check workflow (SEOagentAssess), so they all agree.
//   reach      = the 75th-percentile difficulty of the keywords the site ranks top 10 for (at least 5 of them; linear interpolation), else by
//                size (keywords in the top 10: 0-4 -> 10, 5-49 -> 20, 50-499 -> 35, 500+ -> 50); the larger of the two when both exist.
//   difficulty = easy (kd <= reach + 5, or the site already ranks 1-20 for the keyword) · reachable (<= reach + 20) · hard (<= reach + 40) ·
//   for you      very hard (above) · not realistic (navigational / another company's brand / verdict AVOID); an unknown kd counts as reach + 10.
//   plan       = easy -> direct (2-4 months) · reachable -> short (4-8) · hard -> full (9-15) · very hard -> full, stretch · not realistic -> none;
//                strong sites (100+ top-10 keywords, 1,000+ ranking keywords, or already top 20 for it): direct 2-3, short 3-6, full 6-12.
//   cache      = seo_cache 'reach:<site_id>' for 30 days and the same market (value: reach, method, p75, size_reach, sample, top10,
//                organic_keywords, location_code, and since B1-2 the EVIDENCE itself: `r` = the top-10 keywords it was measured on);
//                a reach that could not be measured (both calls failed) is never stored.
const REACH_CFG = { min_top10: 5, percentile: 0.75, ttl_days: 30, unknown_kd: 10, easy: 5, reachable: 20, hard: 40, easy_position: 20, sample: 100, sample_keep: 60 };
const REACH_MONTHS = { direct: [2, 4], short: [4, 8], full: [9, 15] }, REACH_MONTHS_STRONG = { direct: [2, 3], short: [3, 6], full: [6, 12] };
const REACH_DIFF_LABEL = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const REACH_PLAN_LABEL = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
// G3 (2026-10-11): the evidence behind "months, not weeks" and an estimated chance per plan. Ahrefs 2025 (REACH_BASE_RATE.url): 1.74% of new
// pages reached Google's top 10 within a year, and 40.8% of those did so within a month (the 2017 figure, 5.7%, is no longer cited). The chance
// bands are judgement calls relative to that base rate (a keyword within the site's reach is far from a random new page) and are UNCALIBRATED
// until G17 fits them to this system's own ladders — every text that shows them says so. The same values live in app/shared/src/keywords.ts.
const REACH_BASE_RATE = { year: 2025, source: 'Ahrefs', top10_within_year_pct: 1.74, of_those_within_month_pct: 40.8, url: 'https://ahrefs.com/blog/how-long-does-it-take-to-rank/' };
const REACH_CHANCE = { direct: { band: 'good', range: [50, 70] }, short: { band: 'fair', range: [30, 50] }, full: { band: 'low', range: [15, 30] }, stretch: { band: 'slim', range: [5, 15] }, none: { band: 'none', range: [0, 0] } };
const REACH_CHANCE_NOTE = 'an uncalibrated estimate until this system has measured its own ladders';
// { band, range, label }: "estimated chance good (50-70%, uncalibrated)"; '' label for no plan
const reachChance = (plan_type, stretch) => { const c = REACH_CHANCE[plan_type === 'none' ? 'none' : (stretch ? 'stretch' : plan_type)] || REACH_CHANCE.full;
  return { band: c.band, range: c.range.slice(), label: c.band === 'none' ? '' : 'estimated chance ' + c.band + ' (' + c.range[0] + '-' + c.range[1] + '%, uncalibrated)' }; };
const reachBaseRateText = () => 'Base rate (' + REACH_BASE_RATE.source + ', ' + REACH_BASE_RATE.year + '): only ' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach Google\'s top 10 within a year, and ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those do so within a month — the rest take months.';
// the sentence under a plan's month range: the chance band, that it is uncalibrated, and the 2025 base rate it is judged against
const reachChanceText = (plan) => (plan && plan.chance && plan.chance.label) ? 'Estimated chance of reaching the top 10 within ' + plan.months + ' months: ' + plan.chance.band + ' (' + plan.chance.range[0] + '-' + plan.chance.range[1] + '%) — ' + REACH_CHANCE_NOTE + '. ' + reachBaseRateText() : '';
const reachDomain = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
const reachSiteId = (d) => 'site_' + reachDomain(d).replace(/[^a-z0-9]+/g, '-');
const reachKey = (d) => 'reach:' + reachSiteId(d);
const reachNum = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
const reachSizeTier = (top10) => { const n = Number(top10) || 0; return n >= 500 ? 50 : n >= 50 ? 35 : n >= 5 ? 20 : 10; };
// ranked: [{ kd, position }] for the site (null = the call failed; only positions 1-10 count); authority: { top10, organic_keywords } (null = unknown)
function reachFrom(ranked, authority) {
  const top = (ranked || []).filter(r => { const p = reachNum(r && r.position); return p != null && p >= 1 && p <= 10; });
  const kds = top.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const known = !!(authority && reachNum(authority.top10) != null);
  const top10 = known ? reachNum(authority.top10) : top.length;
  const size_reach = reachSizeTier(top10);
  const reach = p75 != null ? Math.max(p75, size_reach) : size_reach;
  const method = (!ranked && !known) ? 'default' : (p75 != null && p75 >= size_reach) ? 'percentile' : 'size';
  return { reach, method, p75, size_reach, sample: kds.length, top10, organic_keywords: authority && reachNum(authority.organic_keywords) != null ? reachNum(authority.organic_keywords) : null, cached: false };
}
// the stored reach of this site for this market, when it is younger than 30 days (null otherwise). B1-2: the row also carries the
// keywords the number was measured on (`r`), so a run that reuses the cached reach can still answer "and what is it measured on?" and
// measure a reach on ITS OWN topic (reachTopic) without re-buying the pull. A row written before B1-2 has no `r`: `ranked` is then null
// and the caller says the evidence was not re-read, which is true, rather than reporting zero on-topic keywords, which is not.
function reachCached(rows, domain, location_code) {
  const key = reachKey(domain);
  const row = (rows || []).filter(r => r && !r.error && r.key === key).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!row) return null;
  let v = null; try { v = JSON.parse(row.value); } catch (e) { return null; }
  if (!v || reachNum(v.reach) == null) return null;
  if (reachNum(location_code) && reachNum(v.location_code) && Number(v.location_code) !== Number(location_code)) return null;
  const days = (Date.now() - new Date(row.updated_at).getTime()) / 864e5;
  if (!(days >= 0 && days < REACH_CFG.ttl_days)) return null;
  const { r: packed, ...rest } = v;
  const ranked = Array.isArray(packed) ? packed.map(x => ({ keyword: String((x || [])[0] || ''), kd: reachNum((x || [])[1]), position: reachNum((x || [])[2]) })).filter(x => x.keyword) : null;
  return { ...rest, reach: Number(v.reach), cached: true, cached_at: String(row.updated_at), ranked, ranked_from: ranked ? 'the stored measurement of ' + String(row.updated_at).slice(0, 10) : '' };
}
// the seo_cache row (exact columns) for a freshly measured reach. `ranked` (optional) is the evidence: [{ keyword, kd, position }] as
// the pull returned it, packed as [keyword, kd, position] triples and capped at REACH_CFG.sample_keep so one row stays small.
const reachPack = (ranked) => (Array.isArray(ranked) ? ranked : []).filter(r => r && r.keyword && reachNum(r.position) != null)
  .slice(0, REACH_CFG.sample_keep).map(r => [String(r.keyword).slice(0, 120), reachNum(r.kd), Number(r.position)]);
const reachCacheRow = (domain, info, location_code, ranked) => { const r = reachPack(ranked);
  return { key: reachKey(domain), kind: 'reach', site_id: reachSiteId(domain),
    value: JSON.stringify({ reach: info.reach, method: info.method, p75: info.p75, size_reach: info.size_reach, sample: info.sample, top10: info.top10, organic_keywords: info.organic_keywords, location_code: reachNum(location_code), ...(r.length ? { r } : {}) }),
    updated_at: new Date().toISOString() }; };
// o: { position (the site's rank for the keyword), navigational, other_brand, verdict }
function difficultyForYou(kd, reach, o) {
  o = o || {};
  if (o.navigational || o.other_brand || String(o.verdict || '').toUpperCase() === 'AVOID') return 'not_realistic';
  const pos = reachNum(o.position);
  if (pos != null && pos >= 1 && pos <= REACH_CFG.easy_position) return 'easy';
  const r = reachNum(reach) == null ? reachSizeTier(0) : Number(reach);
  const k = reachNum(kd) == null ? r + REACH_CFG.unknown_kd : Number(kd);
  return k <= r + REACH_CFG.easy ? 'easy' : k <= r + REACH_CFG.reachable ? 'reachable' : k <= r + REACH_CFG.hard ? 'hard' : 'very_hard';
}
// ---- B2-1 (2026-10-15, benchmark area 2): the reach measured on ONE TOPIC, not across the whole website ----
// `reach` above is a single number per site: the 75th-percentile difficulty of everything it ranks top 10 for, cached 30 days. The same
// number therefore decided two unrelated plans — "peppol uae" and "erp implementation dubai" (lad_mv5pjt5y4aoa, 2026-10-13: reach 10 from
// a cached 2026-10-08 measurement). The leaders personalise per TOPIC: MarketMuse subtracts a topic-level Topic Authority from the keyword
// difficulty ("If you have no Topic Authority, then your Personalized Difficulty = Keyword Difficulty",
// https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/), and Semrush measures the thematic distance between a
// domain's core topics and the target topic, lowering PKD the closer the match (https://www.semrush.com/blog/ai-keyword-research-updates/).
// reachTopic() does the same from data the run already paid for: the keywords the site ALREADY ranks for that are on this topic. It is used
// only when that evidence is as strong as the site-wide measurement demands (REACH_CFG.min_top10 keywords in the top 10 with a difficulty).
// Below that bar the site-wide reach stays and the caller is told WHY, so no plan quietly rests on a number measured on other topics. There
// is no third direction: absence of on-topic wins is not evidence of inability, so it never invents a penalty of its own.
const REACH_TOPIC_CFG = { max_examples: 6, max_other: 4 };
// the default on-topic test: half of the head's meaningful words (the shape `_radius.js` RAD.headFit uses; the ladder passes that kit in)
const reachTopicMatch = (head) => { const h = overlapTokens(head); const need = Math.max(1, Math.ceil(h.length / 2));
  return (kw) => { if (!h.length) return false; const t = overlapTokens(kw); return t.filter(x => h.includes(x)).length >= need; }; };
/**
 * ranked: [{ keyword, kd, position }] — every keyword the site ranks for that this run saw (null = the pull failed)
 * head: the topic's head keyword · domainReach: the site-wide reach · o: { match (the on-topic test), domain, reason_missing }
 * -> { used, reach, topic_reach, site_reach, on_topic, top10, sample, best, examples, other_topics, reason, note }
 */
function reachTopic(ranked, head, domainReach, o) {
  const opts = o || {};
  const site = reachNum(domainReach) == null ? reachSizeTier(0) : Number(domainReach);
  const match = typeof opts.match === 'function' ? opts.match : reachTopicMatch(head);
  const rows = (ranked || []).filter(r => r && r.keyword && reachNum(r.position) != null);
  const on = rows.filter(r => { try { return !!match(String(r.keyword)); } catch (e) { return false; } });
  const pos = (r) => Number(r.position);
  const top10 = on.filter(r => pos(r) >= 1 && pos(r) <= 10);
  const kds = top10.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const used = p75 != null;
  const best = on.slice().sort((a, b) => pos(a) - pos(b))[0] || null;
  const examples = top10.slice().sort((a, b) => pos(a) - pos(b)).slice(0, REACH_TOPIC_CFG.max_examples)
    .map(r => ({ keyword: String(r.keyword), position: pos(r), kd: reachNum(r.kd) }));
  const other_topics = rows.filter(r => pos(r) >= 1 && pos(r) <= 10 && on.indexOf(r) < 0).sort((a, b) => pos(a) - pos(b))
    .slice(0, REACH_TOPIC_CFG.max_other).map(r => String(r.keyword));
  const who = String(opts.domain || 'your site');
  const q = '"' + String(head || '') + '"';
  // B1-2: a caller that reuses a stored reach knows WHY there is no list (the pull was not made again); it says that instead of
  // "could not be read", which would blame a failure that never happened.
  const reason = ranked == null ? (String(opts.reason_missing || '') || 'the keywords ' + who + ' ranks for could not be read on this run')
    : !on.length ? 'nothing ' + who + ' ranks for is on this topic'
    : !top10.length ? on.length + ' keyword(s) on this topic rank for ' + who + ', none of them in the top 10 (best #' + (best ? pos(best) : '-') + ')'
    : top10.length + ' keyword(s) on this topic are in the top 10' + (kds.length < top10.length ? ', ' + kds.length + ' of them with a known difficulty' : '')
      + ' - fewer than the ' + REACH_CFG.min_top10 + ' needed to measure a reach on one topic';
  const note = used
    ? 'Measured on this topic: 75% of the ' + kds.length + ' keyword(s) about ' + q + ' that ' + who + ' ranks in the top 10 for have a difficulty of ' + p75
      + ' or lower, so this plan is measured against ' + p75 + ' and not against the site-wide reach of ' + site + '.'
    : 'This plan is measured against your site-wide reach (' + site + '), because ' + reason + '. A reach measured on other topics'
      + (other_topics.length ? ' (' + other_topics.map(k => '"' + k + '"').join(', ') + ')' : '') + ' is weaker evidence for this one: treat the months and the chance below as the optimistic case.';
  return { used, reach: used ? p75 : site, topic_reach: p75, site_reach: site, on_topic: on.length, top10: top10.length, sample: kds.length,
    best: best ? { keyword: String(best.keyword), position: pos(best) } : null, examples, other_topics, reason, note, head: String(head || '') };
}
const reachStrong = (authority, position) => { const p = reachNum(position); return !!(authority && ((Number(authority.top10) || 0) >= 100 || (Number(authority.organic_keywords) || 0) >= 1000)) || (p != null && p >= 1 && p <= REACH_CFG.easy_position); };
function reachPlan(difficulty, strong) {
  const plan_type = { easy: 'direct', reachable: 'short', hard: 'full', very_hard: 'full', not_realistic: 'none' }[difficulty] || 'full';
  const m = plan_type === 'none' ? null : (strong ? REACH_MONTHS_STRONG : REACH_MONTHS)[plan_type];
  return { plan_type, months: m ? m[0] + '-' + m[1] : '', months_range: m ? m.slice() : null, stretch: difficulty === 'very_hard', chance: reachChance(plan_type, difficulty === 'very_hard') };
}
const reachLabel = (difficulty, plan) => [REACH_DIFF_LABEL[difficulty] || '', plan ? REACH_PLAN_LABEL[plan.plan_type] + (plan.stretch ? ' (stretch)' : '') : '', plan && plan.months ? plan.months + ' months' : ''].filter(Boolean).join(' · ');
// DataForSEO Labs calls that measure reach on a cache miss (~$0.03): the site's top-10 keywords with their difficulty, and its size
const reachRequests = (domain, location_code, language_code) => {
  const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/', t = reachDomain(domain), lang = language_code || 'en';
  return [{ kind: 'reach_ranked', label: 'top-10 keywords of ' + t, endpoint: L + 'ranked_keywords/live',
      body: [{ target: t, location_code, language_code: lang, limit: REACH_CFG.sample, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 10]] }] },
    { kind: 'reach_overview', label: 'size of ' + t, endpoint: L + 'domain_rank_overview/live', body: [{ target: t, location_code, language_code: lang }] }];
};
const reachTaskOk = (x) => !!(x && !x.error && (((x.tasks || [])[0] || {}).status_code || 0) < 40000 && ((x.tasks || [])[0] || {}).status_code);
const reachError = (x) => { if (!x) return 'no response'; const e = x.error; if (e) return String((typeof e === 'object' ? (e.message || e.description || JSON.stringify(e)) : e)).slice(0, 200);
  const t = (x.tasks || [])[0] || {}; return String(t.status_message || x.status_message || 'no data').slice(0, 200) + (t.status_code ? ' (' + t.status_code + ')' : ''); };
// parses the answers of reachRequests (in any order: matched by kind) -> { ranked: [{ keyword, kd, position }] | null, authority | null, errors }
function reachParse(reqs, res) {
  let ranked = null, authority = null; const errors = [];
  (reqs || []).forEach((r, i) => {
    const x = (res || [])[i];
    if (!reachTaskOk(x)) { errors.push(r.label + ': ' + reachError(x)); return; }
    const r0 = ((x.tasks[0].result || [])[0]) || {};
    if (r.kind === 'reach_ranked') ranked = (r0.items || []).map(it => { const kd0 = it.keyword_data || {}; const se = (it.ranked_serp_element || {}).serp_item || {};
      return { keyword: String(kd0.keyword || '').toLowerCase(), kd: (kd0.keyword_properties || {}).keyword_difficulty ?? null, position: se.rank_group ?? null }; });
    if (r.kind === 'reach_overview') { const m = (((r0.items || [])[0] || {}).metrics || {}).organic; authority = m ? { organic_keywords: m.count ?? 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0) } : { organic_keywords: 0, top3: 0, top10: 0 }; }
  });
  return { ranked, authority, errors };
}
// rule R1 "one search, one page" — the same words as the web app (app/shared/src/ladders.ts): lower case, one-letter and stop words out, a light
// stem, place names kept; two keywords are the same search when their word sets are equal or 75%+ the same (Jaccard)
const OVERLAP_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const overlapTokens = (s) => { const out = []; for (const t of String(s || '').toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || OVERLAP_STOP.has(t)) continue;
  const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
const overlapScore = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const common = a.filter(t => sb.has(t)).length; return common / (a.length + b.length - common); };
const keywordsOverlap = (a, b) => overlapScore(overlapTokens(a), overlapTokens(b)) >= 0.75;
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
const d = $('Ladder Plan').first().json;   // v4.8: the reach cache row is saved in between; 2026-10-11: D26 (AI Overview as a timed observation), G3 (2025 base rate + chance band), D8 (refused brands listed)
const L = d.ladder || {};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const SHORT = { easy: 'easy for you', reachable: 'reachable', hard: 'hard', very_hard: 'very hard' };   // v4.8: difficulty relative to the site's reach
const kdLabel = (v) => v == null ? 'N/A' : v + (L.reach != null ? ' · ' + SHORT[difficultyForYou(v, L.reach, {})] : (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard'));
const posText = (p) => p ? '#' + p : 'not in top 60';
const months = (m) => Array.isArray(m) ? (m[0] === m[1] ? 'month ' + m[0] : 'months ' + m[0] + '-' + m[1]) : '—';
let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';
const kv = (rows) => '<table class="kv">' + rows.map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';
const today = new Date().toISOString().slice(0, 10);
const f = L.feasibility || {}; const head = L.head || {}; const top = L.top || {}; const st = L.stats || {};
const rungs = (L.rungs || []).filter(r => r.pages && r.pages.length);
const allPages = rungs.flatMap(r => r.pages);
const statusLabel = { winnable: 'Winnable', stretch: 'A stretch — possible with authority building', unrealistic: 'Not realistic as the top rung',
  not_checked: 'Not scored — the data this rests on was missing' }[f.status] || esc(f.status);   // R23 (2026-10-14)
const dv = f.serp_diversity || L.serp_diversity || null;   // B2-5: the destination's results page, and who owns it
const scl = L.serp_clusters || null;                        // B2-4: the rung keywords' own results pages, and the groups they made
// B2-5: a score that moved says so where it is printed, with the number it moved from and the reason
const scoreAdjNote = (f.score != null && f.score_adjustment) ? '<br><span class="small">' + Math.abs(f.score_adjustment) + ' point(s) below the verdict\'s ' + f.score_before
  + ': ' + esc(((f.serp_diversity || {}).domains) || 0) + ' different site(s) own the top ' + esc(((f.serp_diversity || {}).results) || 0) + ' results. A stated rule, not a measured effect.</span>' : '';
// v4.8: the plan for this site (reach, difficulty for you, plan type, order); a refused ladder (duplicate / not realistic) has no pages
const planned = L.planned !== false; const ri = L.reach_info || {};
const DIFF = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const PLAN = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
const planName = (PLAN[L.plan_type] || 'Full ladder') + (L.stretch ? ' (stretch)' : '');
const reachHow = ri.method === 'percentile' ? '75% of the ' + num(ri.sample) + ' keywords ' + esc(L.domain) + ' ranks in the top 10 for have a difficulty of ' + ri.p75 + ' or lower'
  : ri.method === 'size' ? esc(L.domain) + ' ranks in the top 10 for ' + num(ri.top10) + ' keyword' + (ri.top10 === 1 ? '' : 's') + (ri.sample ? ' (too few with a known difficulty to measure)' : '') + '; sites of that size usually win keywords up to difficulty ' + ri.size_reach
  : 'the site\'s rankings could not be read, so the starting value for a new site is used';
// B2-1 (2026-10-15): the site-wide reach is one number for the whole website; the plan above was measured against the reach for THIS topic
// when there was enough on-topic evidence to measure one, and `ta.note` says which of the two it was and why.
const ta = L.topic_authority || null;
const reachText = 'Your site\'s reach is difficulty <b>' + esc(ri.reach != null ? ri.reach : L.reach) + '</b>: ' + reachHow + (ri.cached ? ' (measured ' + esc(String(ri.cached_at || '').slice(0, 10)) + ', kept 30 days)' : '') + '.'
  + (ta && ta.note ? ' ' + esc(ta.note) : '');
const diffWhy = L.difficulty_for_you === 'not_realistic' ? 'people searching it look for one particular website or brand, or the verdict says to avoid it'
  : (head.your_position && head.your_position <= 20) ? 'you already rank #' + head.your_position + ' for it'
  : 'its difficulty is ' + (head.kd == null ? 'unknown (counted as ' + (Number(L.reach) + 10) + ')' : head.kd) + ' against your reach of ' + esc(L.reach);
const orderText = { direct: 'Write the main page first (it is within reach now), then ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) that link to it.',
  short: 'Write ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) first; the main page follows once half of them are live (or it already ranks in the top 30).',
  full: 'Climb rung by rung from the easiest pages; the main page comes last, once the rungs below support it.' + (L.stretch ? ' It is very hard for your site today, so consider the alternatives first.' : ''),
  none: '' }[L.plan_type] || '';
const mainOnly = L.planned && L.plan_type !== 'direct' && !((L.stats || {}).rung_pages);   // no supporting keywords in the data: the main page is written first
const orderLine = mainOnly ? 'No supporting keywords were found in the search data for this topic, so the main page is the whole ladder for now and is written first; supporting pages can be added as the site grows.' : orderText;
const chanceLine = planned && L.chance && L.chance.label ? '<p><b>Estimated chance</b> of reaching the top 10 within ' + esc(L.months) + ' months: <b>' + esc(L.chance.band) + '</b> (' + L.chance.range[0] + '-' + L.chance.range[1] + '%) — ' + esc(REACH_CHANCE_NOTE) + '. ' + esc(reachBaseRateText()) + '</p>' : '';
const refusedLine = (L.refused_keywords || []).length ? '<p class="small">Left out as other companies\' brands, government or portal searches, or navigational: ' + L.refused_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '" (' + esc(x.reason) + ')').join(', ') + (L.refused_keywords.length > 12 ? ' …' : '') + '.</p>' : '';
const whyPlan = () => h2('Why this plan') + '<p>' + reachText + '</p><p>"' + esc(head.keyword) + '" is <b>' + esc(DIFF[L.difficulty_for_you] || L.difficulty_for_you) + '</b>: ' + diffWhy + '.</p>' +
  (planned ? '<p><b>' + esc(planName) + ' — about ' + esc(L.months) + ' months.</b> ' + esc(orderLine) + '</p>' + chanceLine : '<div class="note"><b>No ladder planned.</b> ' + esc((L.refusal || {}).message || '') + '</div>') +
  ((L.excluded_keywords || []).length ? '<p class="small">Left out because another ladder of this site already covers them (one search, one page): ' + L.excluded_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '"').join(', ') + (L.excluded_keywords.length > 12 ? ' …' : '') + '.</p>' : '') + refusedLine +
  '<p class="small">Difficulty for your site: easy up to reach + 5 (or you already rank in the top 20), reachable up to reach + 20, hard up to reach + 40, very hard above. Easy → direct plan (2-4 months, estimated chance good), reachable → short ladder (4-8, fair), hard → full ladder (9-15, low), very hard → full ladder as a stretch (slim); a little faster for strong sites. The month ranges follow the 2025 Ahrefs study (' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach the top 10 within a year; ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those within a month); the chance bands are uncalibrated estimates until this system has measured its own ladders.</p>';
// D26: the results page at the time of the check — an observation, not a fact about the query
const sf = d.serp_features || null;
const serpObsLine = sf && !sf.unavailable ? '<p class="small">Results page in the check at ' + esc(obsClock(sf.checked_at || (sf.ai_overview || {}).seen_at)) + ': AI Overview ' + esc(aioObserved([{ seen: (sf.ai_overview || {}).present, at: sf.checked_at || (sf.ai_overview || {}).seen_at }]).text) + ((sf.ai_overview || {}).present && ((sf.ai_overview || {}).cited_domains || []).length ? ' In that check it cited ' + esc(sf.ai_overview.cited_domains.slice(0, 8).join(', ')) + '.' : '') + (sf.featured_snippet ? ' Featured snippet held by ' + esc(sf.featured_snippet.domain) + ' in that check.' : '') + '</p>'
  : sf && sf.unavailable ? '<p class="small">The live results page could not be read for this run (' + esc(sf.error || 'no answer') + '): whether an AI Overview or a featured snippet appears is unknown.</p>' : '';
const statusClass = f.status === 'winnable' ? 'ok' : (f.status === 'unrealistic' ? 'bad' : '');
const parts = [];

parts.push(`
<div class="cover">
  <div class="brand">Keyword Ladder Plan</div>
  <h1 class="title">${esc(head.keyword)}</h1>
  <p class="sub">${esc(L.domain)} &nbsp;•&nbsp; ${esc(L.country)} &nbsp;•&nbsp; ${today}</p>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`);

// 1. Summary
parts.push(h2('The plan in one page') + kv([
  ['Destination keyword', '<b>' + esc(head.keyword) + '</b> — ' + num(head.volume) + ' searches/mo, difficulty ' + kdLabel(head.kd) + (head.cpc != null ? ', CPC ' + String(Math.round(Number(head.cpc) * 100) / 100) : '')],
  ['Is it realistic?', '<span class="' + statusClass + '">' + statusLabel + '</span>' + (f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : (f.verdict === 'NOT_CHECKED' ? ' — not scored: the live Google results could not be read in this run, so the competition was never seen' : '')) + scoreAdjNote],
  ...(L.stretch && (f.alternatives || []).length ? [['Consider first', f.alternatives.map(a => '"' + esc(a) + '"').join(' · ') + ' — realistic alternatives; the full ladder below is a stretch']] : []),
  ['For your site', '<b>' + esc(DIFF[L.difficulty_for_you] || '—') + '</b> · reach ' + esc(L.reach) + ' · ' + (planned ? esc(planName) + ' · about ' + esc(L.months) + ' months' : 'no ladder planned')],
  ['Where you rank today', (head.your_position ? '#' + head.your_position + ' for the destination keyword' : 'not in the top 60 for the destination keyword') + (st.site_rankings_found ? '; the site ranks for ' + num(st.site_rankings_found) + ' keywords in the top 60' : '')],
  ['The ladder', planned ? num(st.pages_total) + ' pages: ' + rungs.map(r => r.pages.length + ' on rung ' + r.rung).join(', ') + (rungs.length ? ' and' : '') + ' the main page — ' + esc(L.order || '') : 'none — ' + esc((L.refusal || {}).short || ((L.refusal || {}).reason === 'duplicate' ? 'this website already has a ladder for this keyword' : 'not realistic for this site'))],
  ['Timeline', (L.timeline || []).map(t => esc(t.label) + ': ' + months(t.months)).join(' · ') || '—'],
  ['Traffic potential', planned ? '~' + num(st.traffic_potential_total) + ' visits/month across the ladder once the pages rank in the top 3' : '—'],
  // R1 (2026-10-13): the plan used to call these pages written and promise them as page content before the page run had even started — and a
  // run the day's AI budget refused then left nothing behind but a ladder row saying "writing" (live: execution 500).
  ['Started now', (L.write_now || []).length ? (L.write_now || []).map(w => '"' + esc(w.keyword) + '" (rung ' + w.rung + ')').join(', ') + ' — started as its own page run; each arrives as its own report. A run the day\'s AI budget refuses writes nothing and puts the page back to "planned" for the next weekly run.' : 'none'],
  ['Tracking', planned ? 'Positions checked ' + esc((L.tracker || {}).cadence || 'weekly') + '; progress e-mail with the next rung; once the top page holds the top 3 for 4 checks it is checked monthly' : 'nothing to track']
]) + ((L.notes || []).filter(n => !(L.refusal && n === L.refusal.message)).length ? '<div class="note">' + L.notes.filter(n => !(L.refusal && n === L.refusal.message)).map(esc).join('<br>') + '</div>' : ''));

// 2. Why this plan (v4.8)
parts.push(whyPlan());

// 3. Feasibility
parts.push(h2('Is the destination realistic?') +
  '<p>Google ranks the head term for the site with the most complete, trusted coverage of the topic. The ladder builds that coverage from the bottom: specific pages that are winnable now, linking up to one strong page for the head term.</p>' +
  '<h3>Why</h3>' + ul(f.reasons) + serpObsLine +
  ((f.what_must_change || []).length ? '<h3>What must change first</h3>' + ul(f.what_must_change) : '') +
  ((f.alternatives || []).length ? '<div class="note"><b>Realistic alternative top rungs:</b> ' + f.alternatives.map(esc).join(' · ') + '. ' + (f.status === 'unrealistic' ? 'Brand terms of other companies are navigational and out of reach; pick one of these as the destination instead.' : 'Consider one of these if authority building stalls.') + '</div>' : '') +
  kv([['Expected visits/month at #1-3', f.expected_visits_top3 != null ? num(f.expected_visits_top3) : 'N/A'], ['Time to rank', f.time_to_rank_months != null ? f.time_to_rank_months + ' months \u2014 the writing model\'s own estimate, not measured; the modelled range and its chance band are in the plan above' : 'not estimated'],
    // B2-5 (2026-10-15): domain diversity is Semrush's fifth ranking factor and it now moves this score - the count is measured, the
    // adjustment is a stated rule, and both are printed here so nobody has to take the number on trust.
    ...(dv ? [['Who owns the results page', (dv.checked ? '<b>' + num(dv.domains) + ' different site(s)</b> in the top ' + num(dv.results) + ' — ' + esc(dv.band) : 'not known: the results page could not be read')
      + '<br><span class="small">' + esc(dv.text) + '</span><br><span class="small">' + esc(dv.basis) + '</span>']] : [])]));

// B2-2 (2026-10-15, benchmark area 2): what the site already has on this topic, before the plan's new pages — the inventory the leaders
// open a content plan with (MarketMuse site inventory; its effort bands start at "optimise the page you have if it matches the topic").
const cov = ta && ta.coverage ? ta.coverage : null;
if (cov) {
  const covPages = (cov.pages || []).length
    ? '<table class="ct"><tr><th>Page you already have on this topic</th><th>Title</th></tr>'
      + cov.pages.map(p => '<tr><td>' + esc(p.url) + '</td><td>' + esc(p.title || '—') + '</td></tr>').join('') + '</table>'
    : '';
  parts.push(h2('What you already have on this topic') + '<p>' + esc(cov.summary) + '</p>' +
    kv([['Pages on this topic', num(cov.pages_on_site)],
      ['Searches you rank for on this topic', num(cov.ranked_keywords) + ' (' + num(cov.top10_keywords) + ' in the top 10)'],
      ['Best position today', cov.best_position ? '#' + cov.best_position + ' for "' + esc(cov.best_keyword) + '"' : 'nothing on this topic ranks yet'],
      ['This plan', num(cov.planned_total) + ' page(s): ' + num(cov.planned_improve) + ' improved, ' + num(cov.planned_new) + ' new']]) + covPages);
}

// B2-4 (2026-10-15, benchmark area 2, criterion K7): the searches Google answers with the SAME pages, and the ones that could not be
// compared. The convention is Keyword Insights' own: the top 7 results at a 40% shared-URL threshold (B2-6).
if (scl && scl.asked) {
  const clRows = (scl.clusters || []).slice(0, 12).map(c => '<tr><td><b>' + esc(c.head_keyword) + '</b></td><td>' + c.keyword_count + '</td><td>'
    + esc((c.keywords || []).slice(1).map(k => '"' + k.keyword + '" (' + k.shared_urls + ' shared)').join(', ') || '—') + '</td></tr>').join('');
  const ncRows = (scl.not_compared || []).slice(0, 10).map(x => '<li>"' + esc(x.keyword) + '" — ' + esc(x.reason) + (x.retried ? ' (asked twice)' : '') + '</li>').join('');
  parts.push(h2('Searches that share a results page') +
    '<p class="small">' + esc(scl.note) + '</p>' +
    (clRows ? '<table class="ct"><tr><th>One page for</th><th>Searches</th><th>Also covers</th></tr>' + clRows + '</table>' : '') +
    kv([['Results pages read', num(scl.compared) + ' of ' + num(scl.asked) + ' asked' + (scl.retried ? ' (' + num(scl.retried) + ' sent again, ' + num(scl.retry_answered) + ' answered)' : '')],
      ['How they were compared', 'the top ' + num(scl.top_n) + ' results, ' + num(scl.min_shared_urls) + ' shared URLs (' + num(scl.min_overlap_pct) + '%)'],
      ['What it cost', '$' + Number(scl.cost_usd || 0).toFixed(4) + '<br><span class="small">' + esc(scl.cost_basis) + '</span>']]) +
    (ncRows ? '<p class="small"><b>Could not be compared</b> — these keep their own group and nothing was merged on their behalf:</p><ul class="small">' + ncRows + '</ul>' : '') +
    (scl.left_uncompared ? '<p class="small">' + num(scl.left_uncompared) + ' further keyword(s) on this topic were below the cap of ' + num(scl.cap) + ' and were not compared.</p>' : ''));
} else if (scl && scl.skip_reason) {
  parts.push(h2('Searches that share a results page') + '<p>' + esc(scl.note || scl.skip_reason) + '</p>');
}

// 4. The ladder (only when pages were planned)
if (planned) {
let ladderHtml = h2('The ladder', true) + '<p class="small">One page per topic. Lower rungs are specific and winnable; each rung links up to the top page. Pages marked "improve" already exist on your site. "Why here" is the data that put the page in this position (B2-3).</p>';
for (const r of rungs) {
  ladderHtml += '<h3>' + esc(r.label) + ' — ' + months(r.months) + '</h3>' +
    '<table class="ct"><tr><th>#</th><th>Page (primary keyword)</th><th>Supporting keywords</th><th>Grouped by</th><th>Page type</th><th>Searches/mo</th><th>Difficulty</th><th>You today</th><th>Page on site</th></tr>' +
    r.pages.map(p => '<tr><td>' + p.page_no + '</td><td><b>' + esc(p.keyword) + '</b>' + (p.why ? '<br><span class="small">' + esc(p.why) + '</span>' : '') + '</td><td>' + esc((p.supporting || []).join(', ') || '—') + '</td><td>' + esc(p.grouped_by || 'topic label') + '</td><td>' + esc(p.page_type) + '</td><td>' + num(p.total_volume) + '</td><td>' + kdLabel(p.kd) + '</td><td>' + esc(posText(p.your_position)) + '</td><td>' + (p.exists ? '<span class="ok">improve</span><br><span class="small">' + esc(p.target_url) + '</span>' : 'new<br><span class="small">' + esc(p.target_url) + '</span>') + '</td></tr>').join('') + '</table>';
}
ladderHtml += '<h3>Top — ' + esc(top.keyword) + ' — ' + months(top.months) + '</h3>' + kv([
  ['Page', (top.exists ? '<span class="ok">improve</span> ' : 'new ') + esc(top.target_url)],
  ['Page type', esc(top.page_type)], ['Supporting keywords', esc((top.supporting || []).join(', ') || '—')],
  ['Searches/mo · difficulty', num(top.volume) + ' · ' + kdLabel(top.kd)], ['You today', esc(posText(top.your_position))], ['When', L.plan_type === 'direct' || mainOnly ? 'written first — ' + months(top.months) : months(top.months)],
  ...(top.why ? [['Why here', esc(top.why)]] : [])   // B2-3
]);
parts.push(ladderHtml);

// G32 / K12 (2026-10-13, FIX_PLAN): the site's topic radius — the topics of this ladder that are within reach today, the ones that are a
// stretch and the ones that are out of reach for now, each with the evidence behind the verdict (v5/code/_radius.js, built in Ladder Plan).
// It is shown, not enforced: the plan above is unchanged by it.
const radL = L.topic_radius || null;
const radRowsL = radL ? [...(radL.in_reach || []), ...(radL.stretch || []), ...(radL.far || [])] : [];
if (radRowsL.length) parts.push(h2('Your topic radius: what is within reach and what is a stretch') + '<p class="small">' + esc(radL.summary) + '</p>'
  + '<table class="ct"><tr><th>Topic</th><th>Verdict</th><th>Why</th><th>On what evidence</th></tr>'
  + radRowsL.slice(0, 20).map(t => '<tr><td><b>' + esc(t.topic) + '</b><br>' + esc(t.primary_keyword) + '</td><td>' + esc(t.verdict_label) + '</td><td>' + esc(t.reason) + '</td><td>' + esc((t.evidence || []).join('; ')) + '</td></tr>').join('')
  + '</table><p class="small">' + esc(radL.note) + '</p>');

// 5. Internal link map
parts.push(h2('Internal link map') + '<p class="small">Every rung page links up to the top page and sideways to one sibling; the top page links down to every rung page.</p>' +
  '<table class="ct"><tr><th>From</th><th>Links to</th><th>Type</th></tr>' + (L.link_map || []).slice(0, 60).map(l => '<tr><td>' + esc(l.from) + '</td><td>' + esc(l.to) + '</td><td>' + esc(l.type) + '</td></tr>').join('') + '</table>');

// 6. Write now
parts.push(h2('Pages written now') + ((L.write_now || []).length ? '<table class="ct"><tr><th>#</th><th>Keyword</th><th>Page type</th><th>URL</th><th>Links to</th></tr>' +
  L.write_now.map(w => '<tr><td>' + w.page_no + '</td><td><b>' + esc(w.keyword) + '</b></td><td>' + esc(w.page_type) + '</td><td>' + esc(w.target_url) + (w.exists ? ' (improve)' : ' (new)') + '</td><td>' + esc((w.links_to || []).map(x => x.keyword).join(', ')) + '</td></tr>').join('') + '</table>' +
  '<p>Each page runs through the full content pipeline (competitor analysis, verified facts, brief, copywriter, critic, QA, editor) and arrives as its own PDF and Word file' + (d.email ? ' at ' + esc(d.email) : '') + '. Publish it at the URL above, then the weekly tracker measures the climb.</p>' : '<p>No pages requested now.</p>'));

// 7. Requirements
parts.push(h2('What else is needed') + '<table class="ct"><tr><th>Item</th><th>Detail</th></tr>' + (L.requirements || []).map(r => '<tr><td><b>' + esc(r.item) + '</b></td><td>' + esc(r.detail) + '</td></tr>').join('') + '</table>');

// 8. Tracking
parts.push(h2('Tracking and next rungs') + '<p>The ladder is registered for ' + esc((L.tracker || {}).cadence || 'weekly') + ' position checks (Google top 100 for every page\'s primary keyword). The progress e-mail shows position changes, which rungs are in the top 10 / top 3, and the recommendation for the next rung with a ready-to-send request. ' +
  ((L.tracker || {}).auto_next_rung ? 'The next rung\'s pages are generated automatically.' : 'Pages for the next rung are written when you confirm (recommend-only mode).') + ' Once the top page has held the top 3 for 4 checks, the main keyword and the published pages are checked monthly, so a drop is noticed.</p>');
}

// 9. Later
if ((L.later || []).length) parts.push(h2(planned ? 'Keywords for later (difficulty above ' + (Number(L.reach) + 30) + ', or beyond this plan\'s pages)' : 'Keywords found around the main keyword') + '<table class="ct"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th></tr>' + L.later.map(k => '<tr><td>' + esc(k.keyword) + '</td><td>' + num(k.volume) + '</td><td>' + kdLabel(k.kd) + '</td></tr>').join('') + '</table>');

// 10. Method
parts.push(h2('How this was built') + '<p class="small">' + num(st.pool_size) + ' keywords were pulled around the head term (long-tail suggestions, related searches, keyword ideas for the head term and your services, and the keywords your site already ranks for). ' + num(st.ai_reviewed) + ' were screened by AI for topical relevance to the head term; ' + num(st.relevant) + ' survived. Rungs follow difficulty relative to your reach (' + esc(L.reach) + '): rung 1 up to the reach (long-tail, 20+ searches), rung 2 up to reach + 15, rung 3 up to reach + 30, the head term on top; keywords other ladders of this site already cover are left out. One page per topic cluster, 2-4 pages per rung; a direct plan keeps 2-3 supporting pages, a short ladder 3-5. Traffic potential = searches after SERP-feature click loss × a top-3 click share. Positions and metrics from DataForSEO for ' + esc(L.country) + '.' + ((st.research_failures || []).length ? ' Some data pulls failed: ' + esc(st.research_failures.join('; ')) + '.' : '') + '</p>');

// G29 (2026-10-13, FIX_PLAN): the same plan with every figure's source, period and sample, as a table and as structured fields
const lineage = [
  LN.of('Searches per month and difficulty', 'kwdata', { basis: 'estimated', period: 'the provider\'s latest 12-month average', sample: LN.sample(st.pool_size, 'keywords pulled'),
    note: 'a provider estimate for ' + String(L.country || '') + ', not a measurement of your site; a single keyword\'s volume can be well off' }),
  LN.of('Traffic potential per page', 'model', { basis: 'modelled', period: 'per month, once the page ranks', sample: LN.sample((L.rungs || []).length, 'rungs planned'),
    note: 'searches after results-page click loss × a top-3 click share — modelled, never measured clicks' }),
  LN.of('Difficulty for your site and the plan type', 'model', { basis: 'modelled', period: LN.asOf(today), sample: 'your site\'s reach ' + String(L.reach == null ? 'unknown' : L.reach),
    note: 'your reach against each keyword\'s difficulty; the month ranges and chances are modelled from published base rates, not from your own history yet' }),
  LN.of('Who ranks now and which results-page features show', 'serp', { basis: 'one_sample', period: LN.asOf(today), sample: LN.sample((d.live_checks && d.live_checks.done) || (L.rungs || []).length, 'keywords checked live on Google'),
    note: 'one results page per keyword at one moment, from ' + String(L.country || 'the chosen country') }),
];
parts.push(h2('Where these numbers come from') + '<table class="ct"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="small">A figure marked "modelled, not measured" is computed, not counted.</p>');

const css = `
@page { margin: 0.9in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 26pt; margin: 6px 0; color: #fff; border: none; }
.sub { color: #CBD5E1; margin: 0; }
.by { color: #93C5FD; margin: 10px 0 0; font-size: 10pt; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
p { margin: 0 0 9px; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; vertical-align: top; }
.kv .k { width: 190px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.ct { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 6px; text-align: left; border: 1px solid #1E3A8A; }
.ct td { padding: 6px; border: 1px solid #CBD5E1; vertical-align: top; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.ok { color: #15803D; font-weight: bold; }
.bad { color: #B91C1C; font-weight: bold; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;
const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(head.keyword)} — Keyword Ladder Plan</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>${parts.join('\n')}</body></html>`;
const safe = String(head.keyword || 'keyword').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = 'keyword-ladder-' + safe + '-' + today + '.doc';
// drop the large intermediate fields; keep what delivery, the store rows and the page runs need
const slim = { ...d, site_text: undefined, client_pages: undefined, existing_page_text: undefined, competitor_digest: undefined, term_digest: undefined, term_model: undefined,
  competitors_summary: undefined, competitor_questions: undefined, stats_seen: undefined, facts: undefined, extra_questions: undefined, serp_digest: undefined,
  site_urls: undefined, internal_link_candidates: undefined, research: undefined, competitor_analysis: undefined, serp_features: undefined, result_html: undefined, reach_cache_row: undefined };
return [{
  json: { ...slim, run_ledger, lineage, request_id: d.request_id || null, report_type: 'Keyword Ladder Plan', file_name: fileName, ladder_id: L.ladder_id, site_urls_count: (d.site_urls || []).length,
    qa_summary: 'Ladder plan: ' + num(st.pages_total) + ' pages, ' + (L.write_now || []).length + ' written now' },
  binary: { data: { data: Buffer.from('﻿' + html, 'utf8').toString('base64'), mimeType: 'application/msword', fileName, fileExtension: 'doc' } }
}];
