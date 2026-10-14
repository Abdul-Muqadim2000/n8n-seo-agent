// Shared cost kit (G23 + the estimate recalibration, 2026-10-13; FIX_PLAN G23, RESULTS §0b / §2.10).
//
// Two things were wrong with the money this engine reports.
//
// 1. **Claude's cost was a range, not a number.** Three Opus nodes stream (`streaming: true`, required above ~21k tokens because the
//    Anthropic SDK's 10-minute rule), and a streaming call reports no token usage at all — the run can see only `tokenUsageEstimate`,
//    which a Code node cannot read either (usage rides the `ai_languageModel` connection). The whole-system re-rating could therefore put
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
// Used by: Rate Limit and Run Ledger Row (the guard), the five report builders' run ledger, Run Ledger Settle, Cost Calibration Row,
// the monitors' ledger settle, reconcile_claude_cost.py and harness scenario S60.
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

  // ---- 1. one Claude call ----------------------------------------------------------------------------------------------------
  // `call`: { node, model, prompt_chars, output_chars, max_tokens, effort, streaming, calls, usage }
  // `usage` (promptTokens / completionTokens) is used when n8n ever reports it — then the call is MEASURED and no character estimate is
  // used. Streaming calls never report it, which is the whole reason this kit exists.
  const callCost = (call, factors) => {
    const c = call || {}, f = factors || {};
    const model = String(c.model || ''), fam = family(model), price = priceOf(model);
    const factor = n0(f[fam]) > 0 ? Number(f[fam]) : 1;
    const calls = Math.max(1, Math.round(n0(c.calls) || 1));
    const u = c.usage && (n0(c.usage.promptTokens) || n0(c.usage.completionTokens)) ? c.usage : null;
    const think = u ? 0 : (c.effort ? Math.round(n0(c.max_tokens) * (THINK_SHARE[String(c.effort)] || 0)) * calls : 0);
    const inTok = u ? n0(u.promptTokens) : tokensOf(c.prompt_chars) * calls;
    const outTok = u ? n0(u.completionTokens) : tokensOf(c.output_chars) * calls + think;
    const usd = r4((inTok / 1e6) * price.in * factor + (outTok / 1e6) * price.out * factor);
    return { node: String(c.node || ''), model, family: fam, calls, in_tokens: inTok, out_tokens: outTok, think_tokens: think,
      usd, measured: !!u, streaming: !!c.streaming, factor };
  };

  // ---- 2. one run's Claude cost ---------------------------------------------------------------------------------------------
  // Measured and estimated money are kept apart and both are reported; `estimated` is true as soon as one cent of it is an estimate.
  const runCost = (calls, factors) => {
    const out = { usd: 0, measured_usd: 0, estimated_usd: 0, estimated: false, calls: 0, in_tokens: 0, out_tokens: 0,
      by_node: {}, models: {}, streaming_nodes: [], basis: '' };
    for (const c of (calls || [])) {
      const r = callCost(c, factors);
      if (!r.usd && !r.calls) continue;
      out.usd = r4(out.usd + r.usd);
      if (r.measured) out.measured_usd = r4(out.measured_usd + r.usd); else out.estimated_usd = r4(out.estimated_usd + r.usd);
      out.calls += r.calls; out.in_tokens += r.in_tokens; out.out_tokens += r.out_tokens;
      if (r.node) out.by_node[r.node] = { usd: r.usd, model: r.model, in_tokens: r.in_tokens, out_tokens: r.out_tokens, estimated: !r.measured };
      out.models[r.family] = r4((out.models[r.family] || 0) + r.usd);
      if (r.streaming && !r.measured && r.node) out.streaming_nodes.push(r.node);
    }
    out.estimated = out.estimated_usd > 0;
    out.basis = out.estimated
      ? 'estimated: prompt and answer characters at ' + CHARS_PER_TOKEN + ' characters a token plus the thinking budget, at the Anthropic list prices'
        + (out.streaming_nodes.length ? ' (' + out.streaming_nodes.length + ' streaming node(s) report no token usage: ' + out.streaming_nodes.join(', ') + ')' : '')
        + (out.measured_usd > 0 ? '; $' + out.measured_usd.toFixed(4) + ' of it is measured token usage' : '')
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
    ladder: 0.16,             // 0.1162 (exec 495) — was 0.12
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
  const word = (p, basis) => p.usd <= 0 ? 'nothing spent'
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

  return { PRICES, UNKNOWN, CHARS_PER_TOKEN, THINK_SHARE, EST, DFS_EST, ALPHA, HEADROOM, KEEP, CAP, FACTOR_KEY, MODEL_PREFIX,
    RECONCILE_TOLERANCE, RECONCILE_FLOOR, dfsLedger, dfsDay,
    family, priceOf, tokensOf, callCost, runCost, keysFor, readCal, estOf, pick, calKey, calStat, calRow, monthRow, part, costBasis, split };
})();

// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Run Reach Requests'];
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

// ---- what Claude cost this run (G23, 2026-10-13): priced per call from what the run can actually see ----
// A streaming call reports no token usage, so there is nothing to read; what the run does know is the prompt it built, the answer it got
// and the thinking budget of the node's effort level. Every figure here is an ESTIMATE and says so (ai_cost.estimated / .basis), and the
// per-model correction factors the monthly reconciliation writes into seo_cache are applied before the prices are.
const __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4016, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 9555, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_text", "goal", "keyword", "language_name", "page_type", "proof_context", "role_writer", "site_description", "spelling", "tone", "video_context"], "from": [], "loop": false}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 6212, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": true}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 6153, "input": "Needs Revision?", "fields": ["content_brief", "content_qa.length_instruction", "content_qa.main_content_words", "content_qa.missing_terms", "content_qa.target_word_count", "content_qa.warnings", "critique", "keyword", "language_name", "output", "spelling"], "from": [], "loop": true}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 24576, "effort": "medium", "streaming": true, "template_chars": 12497, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_reasons", "verdict_score", "video_context"], "from": [], "loop": false}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4379, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "goal", "keyword", "keyword_data", "language_name", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false}];
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __jsonOf = (n) => { try { return ($(n).all() || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
const __qaRounds = () => { try { return Math.max(1, Number($('Content QA').first().json.qa_round) || 1); } catch (e) { return 1; } };
const __costCalls = [];
for (const c of __AI_CALLS) {
  const answers = __jsonOf(c.node);
  if (!answers || !answers.length) continue;   // the node did not run in this execution
  let prompt_chars = c.template_chars;
  const own = c.input ? (__jsonOf(c.input) || [])[0] : null;
  for (const f of c.fields) prompt_chars += __chars(__at(own || {}, f));
  for (const p of c.from) prompt_chars += __chars(__at((__jsonOf(p[0]) || [])[0] || {}, p[1]));
  const output_chars = answers.reduce((s, j) => s + (typeof j.output === 'string' ? j.output.length : __chars(j)), 0);
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, calls: answers.length * (c.loop ? __qaRounds() : 1) });
}
run_ledger.ai_cost = CC.runCost(__costCalls, CC.readCal(__calRows()).factors);
run_ledger.ai_usd = run_ledger.ai_cost.usd;
run_ledger.ai_cost_estimated = run_ledger.ai_cost.estimated;

const d = $input.first().json;
const today = new Date().toISOString().slice(0, 10);

const extras = [d.include_seo_report ? 'keyword report' : '', d.include_content ? 'page content' : '', d.include_audit ? (d.include_full_report ? 'full SEO report' : 'site audit') : ''].filter(Boolean);
const topKw = ((d.keyword_suggestions || {}).recommended || [])[0];
const note = extras.length && d.email
  ? '<div style="font-family:Arial;max-width:860px;margin:0 auto 20px;padding:14px 18px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46">Your ' + extras.join(', ') +
    ((d.include_seo_report || d.include_content) && topKw ? ' for the top keyword "' + String(topKw.keyword) + '"' : '') +
    ' will be emailed to ' + d.email + ' within about ' + (d.include_audit ? '20' : '5') + ' minutes.</div>'
  : '';

const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Keyword Ideas — ${String(d.domain || 'your business')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>@page { margin: 0.8in; } body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }</style>
</head><body>${d.result_html || '<p>No keyword ideas were generated.</p>'}${note}</body></html>`;

const safe = String(d.domain || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = 'keyword-ideas-' + safe + '-' + today + '.doc';

return [{
  json: { ...d, result_html: undefined, file_name: fileName, run_ledger },
  binary: {
    data: {
      data: Buffer.from('\ufeff' + doc, 'utf8').toString('base64'),
      mimeType: 'application/msword',
      fileName: fileName,
      fileExtension: 'doc'
    }
  }
}];