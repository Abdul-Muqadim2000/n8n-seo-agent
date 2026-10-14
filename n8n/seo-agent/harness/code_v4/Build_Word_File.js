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

  return { PRICES, UNKNOWN, CHARS_PER_TOKEN, THINK_SHARE, EST, DFS_EST, ALPHA, HEADROOM, KEEP, CAP, FACTOR_KEY, MODEL_PREFIX,
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
const __LEDGER_NODES = ['SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer', 'Keyword Relevance', 'Critic'];
const run_ledger = { dataforseo_usd: 0, dataforseo_calls: 0, by_node: {}, ai_calls: 0, ai_nodes: [], started_at: null, finished_at: new Date().toISOString(), duration_min: null };
for (const n of __LEDGER_NODES) {
  let items = []; try { items = $(n).all(); } catch (e) { continue; }
  for (const it of items) {
    const j = (it && it.json) || {}; let c = 0;
    if (Array.isArray(j.tasks)) { for (const t of j.tasks) c += Number((t && t.cost) || 0); } else if (j.cost) { c += Number(j.cost) || 0; }
    run_ledger.dataforseo_calls++;
    if (c) { run_ledger.dataforseo_usd += c; run_ledger.by_node[n] = +((run_ledger.by_node[n] || 0) + c).toFixed(4); }
  }
}
for (const n of __AI_NODES) { try { const k = $(n).all().length; if (k) { run_ledger.ai_calls += k; run_ledger.ai_nodes.push(n); } } catch (e) {} }
try { run_ledger.started_at = $('Normalize Input').first().json.started_at || null; } catch (e) {}
if (run_ledger.started_at) run_ledger.duration_min = +(((Date.now() - new Date(run_ledger.started_at)) / 60000).toFixed(1));
run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);

// ---- what Claude cost this run (G23, 2026-10-13): priced per call from what the run can actually see ----
// A streaming call reports no token usage, so there is nothing to read; what the run does know is the prompt it built, the answer it got
// and the thinking budget of the node's effort level. Every figure here is an ESTIMATE and says so (ai_cost.estimated / .basis), and the
// per-model correction factors the monthly reconciliation writes into seo_cache are applied before the prices are.
const __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };
const __AI_CALLS = [{"node": "Keyword Seeds", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 1913, "input": "Route Mode", "fields": ["audience", "business", "country", "domain", "goal", "language_name", "site_description"], "from": [], "loop": false}, {"node": "Competitor Analyzer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4016, "input": "Collect Facts", "fields": ["avg_competitor_words", "competitor_digest", "competitor_questions", "competitors_read", "country", "existing_page", "existing_page_text", "facts", "goal", "keyword", "language_name", "page_type", "serp_digest", "stats_seen", "term_digest"], "from": [], "loop": false}, {"node": "Content Reviewer", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 2388, "input": "Build Content Prompt", "fields": ["content_prompt_comp", "content_prompt_our", "country", "domain", "language_name"], "from": [], "loop": false}, {"node": "Copywriter", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 9555, "input": "Parse Brief", "fields": ["ai_target", "audience", "business", "business_facts", "content_brief", "country", "eeat_context", "existing_page", "existing_page_text", "goal", "keyword", "language_name", "page_type", "proof_context", "role_writer", "site_description", "spelling", "tone", "video_context"], "from": [], "loop": false}, {"node": "Critic", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 6212, "input": "Copywriter", "fields": ["output"], "from": [["Parse Brief", "audience"], ["Parse Brief", "business_facts"], ["Parse Brief", "case_facts_text"], ["Parse Brief", "content_brief.client_facts"], ["Parse Brief", "content_brief.evidence_plan"], ["Parse Brief", "content_brief.information_gain"], ["Parse Brief", "content_brief.objections"], ["Parse Brief", "content_brief.snippet_targets"], ["Parse Brief", "content_brief.target_audience"], ["Parse Brief", "content_brief.target_word_count"], ["Parse Brief", "content_brief.terms_to_use"], ["Parse Brief", "content_brief.unique_angle"], ["Parse Brief", "goal"], ["Parse Brief", "keyword"], ["Parse Brief", "page_type"], ["Parse Brief", "site_description"]], "loop": true}, {"node": "Editor", "model": "claude-opus-5-5", "max_tokens": 32768, "effort": "medium", "streaming": true, "template_chars": 5413, "input": "Needs Revision?", "fields": ["content_brief", "content_qa.main_content_words", "content_qa.missing_terms", "content_qa.target_word_count", "content_qa.warnings", "critique", "keyword", "language_name", "output", "spelling"], "from": [], "loop": true}, {"node": "Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false}, {"node": "Ladder Keyword Relevance", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "low", "streaming": false, "template_chars": 2242, "input": "Ladder Relevance Chunks", "fields": ["audience", "business", "chunk_index", "chunk_size", "chunk_total", "country", "goal", "keywords_text", "other_brands", "services"], "from": [], "loop": false}, {"node": "Site Describer", "model": "claude-haiku-4-5-20251001", "max_tokens": 4096, "effort": "", "streaming": false, "template_chars": 1881, "input": "Site Pages", "fields": ["domain", "page_title", "pages_text", "site_pages", "site_text"], "from": [], "loop": false}, {"node": "Strategy Brief", "model": "claude-opus-5-5", "max_tokens": 24576, "effort": "medium", "streaming": true, "template_chars": 12497, "input": "Brief Context", "fields": ["ai_target", "angle_rules", "audience", "business", "business_facts", "client_pages", "client_signals", "competitor_analysis", "competitors_summary", "country", "coverage_digest", "cta", "currency", "domain", "eeat_context", "existing_page", "facts", "facts_list", "goal", "internal_link_candidates", "keyword", "keyword_data", "ladder_head", "ladder_links", "ladder_rung", "language_name", "page_notes", "page_type", "planned_link_targets", "proof_context", "recommended_page", "role_brief", "serp_features", "site_description", "spelling", "term_digest", "tone", "verdict", "verdict_reasons", "verdict_score", "video_context"], "from": [], "loop": false}, {"node": "Verdict Agent", "model": "claude-sonnet-5-5", "max_tokens": 16384, "effort": "medium", "streaming": false, "template_chars": 4379, "input": "Merge Keyword Data", "fields": ["audience", "business", "competitor_analysis", "competitors_summary", "country", "domain", "existing_page", "goal", "keyword", "keyword_data", "language_name", "page_type", "serp_digest", "site_authority"], "from": [], "loop": false}];
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
    ['Expected visits/month at #1-3', d.expected_visits_top3 != null ? num(d.expected_visits_top3) : (d.score_withheld ? 'not estimated' : 'N/A')],
    ['Time to rank', d.time_to_rank_months != null ? d.time_to_rank_months + ' months' : (d.score_withheld ? 'not estimated' : 'N/A')]
  ]) +
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
    content_links_to_add: qa.links_to_add_when_published || [],   // R15: every planned ladder / cluster link, for the package
    ladder_target_url: d.ladder_target_url || '',
    verdict: d.verdict,
    verdict_score: d.verdict_score,
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