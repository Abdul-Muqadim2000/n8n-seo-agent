// AIR P5 (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §6.6, CONTRACTS.md §4-§6 + D24): the integrations. AI1-AI10, every one on the GENERATED
// AI Growth workflow (harness/air_graph_exec.js) with synthetic answers in the providers' own shapes (harness/fixtures_air_integ.js):
//   AI1  off by default: a site off or in shadow reads NOTHING from outside (paid, keyed or free), whatever its flags; `on` with every flag off
//        makes no paid and no Brave call (the free Bing stats / Common Crawl only) and settles the same DataForSEO money as the off run
//   AI2  on + flag (+ key for Brave) runs: LLM Mentions (2 tasks, monthly), fan-out results pages within ai_rank_fanout_n (Google, and Bing for a
//        site that asks Copilot), Brave within its weekly cap; the request bodies are the sandbox-confirmed shapes
//   AI3  the money: AI Rank Fetched's cost_usd is every DataForSEO task once by its id (a task id two answers share is counted once), the
//        ledger settle carries it, and Brave's estimate never enters it
//   AI4  reuse: a second run of the same week / month pays nothing again (markers in seo_cache, exact columns); a new month reads LLM Mentions again
//   AI5  the SERP cache: a reading of the last 7 days costs $0 and is handed on as cached; an older one is read again
//   AI6  Bing Webmaster stats parsed into the positions map (impression-weighted, last 35 days), pages, crawl issues, crawl stats; a Bing results
//        page only for a search Webmaster has no position for; a site outside the Bing account gets no Bing call
//   AI7  no Brave key: the node and its credential reference are in the workflow, it is never executed, even with ai_rank_brave on
//   AI8  Common Crawl: captures counted, "No Captures" = 0, an error = not read (no row, the stored reading kept); read every 28 days
//   AI9  the shapes reach the kits: CONTRACTS §6 keys and types; the Google fan-out reads reach ARD.diagnose (D24), Bing positions reach Copilot,
//        Brave reaches Claude, an LLM Mentions page reaches the source graph as `llm_mentions`
//   AI10 static: no SerpApi, no Gemini grounding; paid nodes gated with no node retry; free / keyed nodes on the retry rule; every node of the
//        chain fails closed and is an AIR node; the credential entry exists and no key is in any generated file
const fs = require('fs'); const path = require('path');
const IX = require('./fixtures_air_integ');
const J = (x) => String(JSON.stringify(x));
const AIR_NODE = /^(AI Rank |Any AI Rank|Ensure AI Rank |Load AI Rank |Save AI Rank |Prune AI Rank |Set Core Until$|Patch AI Growth Actions$)|\(Rank\)$/;   // as scenarios_air_plumb.js
const P5_CALL = /^AI Rank (Mentions Call|Bing Call|SERP Call|CC Collections|CC Index Call|Brave Call)( \(Retry\))?$/;
const COPILOT = 'chatgpt,perplexity,gemini,claude,ai_overview,ai_mode,copilot';
const NV = 'site_nova-ai-example';

module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  await guard('air integ', async () => {
    const SN = 'AIR P5 (2026-11-06, DESIGN 6.6): integrations - LLM Mentions, fan-out results pages, Bing stats, Common Crawl, Brave';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const p5 = (calls) => calls.filter(c => /^AI Rank (Mentions Call|Bing Call|SERP Call|CC Collections|CC Index Call|Brave Call)/.test(c));   // every request of the AIR read chain
    const of = (calls, re) => calls.filter(c => re.test(c));
    const settle = (res) => ((res.last('Ledger Settle (Growth)') || [])[0] || {}).json || {};
    const f0 = (res) => res.fetched.find(f => f.site_id === NV) || null;
    const ALL_FLAGS = { fanout_n: 6, mentions: true, brave: true, engines: COPILOT };

    // ---------------- AI1 off by default ----------------
    const off = await IX.runOn({ nova: { mode: '', ...ALL_FLAGS }, acme: { mode: 'off', fanout_n: 20, mentions: true } }, { braveKey: true });
    const sh = await IX.runOn({ nova: { mode: 'shadow', ...ALL_FLAGS }, acme: { mode: 'shadow', fanout_n: 20, mentions: true, brave: true } }, { braveKey: true });
    const on0 = await IX.runOn({ nova: { mode: 'on' } }, { braveKey: true });
    check('AI1 every site off (flags set, Brave key built in): no AIR request node runs and no AIR call is made',
      !Object.keys(off.counts).some(n => /^AI Rank (Requests|Fetched|.*Call|CC Collections)$/.test(n)) && !p5(off.calls).length, J(p5(off.calls)).slice(0, 300));
    check('AI1 shadow with every flag on and the Brave key built in: the planner plans nothing, no call node runs, the outside requests are the off run\'s exactly, nothing is stored in seo_cache by AIR',
      J(sh.calls) === J(off.calls) && !p5(sh.calls).length && ((sh.last('AI Rank Requests') || [])[0] || {}).json.skip === true && ((sh.last('AI Rank Fetched') || [])[0] || {}).json.skip === true
      && !sh.r.writes.some(w => w.node === 'Save AI Rank Fetch Cache') && !Object.keys(sh.counts).some(n => P5_CALL.test(n)), J({ calls: p5(sh.calls), req: (sh.last('AI Rank Requests') || [])[0] }).slice(0, 400));
    check('AI1 on with every flag off: no paid call (no LLM Mentions, no results page), no Brave call; only the free Bing stats / Common Crawl reads; $0 and the settle\'s DataForSEO figure equal to the off run\'s',
      !of(on0.calls, /llm_mentions|serp\/(google|bing)\/organic|search\.brave\.com/).filter(c => /^AI Rank/.test(c)).length && of(on0.calls, /^AI Rank (Bing Call|CC Collections|CC Index Call) GET/).length > 0
      && f0(on0) && f0(on0).cost_usd === 0 && settle(on0).dfs_usd === settle(off).dfs_usd && !on0.r.errors.length, J({ c: p5(on0.calls), cost: (f0(on0) || {}).cost_usd, s: [settle(on0).dfs_usd, settle(off).dfs_usd] }).slice(0, 400));

    // ---------------- AI2 on + flags (+ key) ----------------
    const noKey = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: false });
    const full = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: true });
    const mCalls = of(full.calls, /^AI Rank Mentions Call POST .*llm_mentions/); const gCalls = of(full.calls, /^AI Rank SERP Call POST .*serp\/google/); const bCalls = of(full.calls, /^AI Rank SERP Call POST .*serp\/bing/);
    const brCalls = of(full.calls, /^AI Rank Brave Call GET https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search\?q=/);
    const mReq = ((full.last('AI Rank Mention Requests') || []).map(i => i.json));
    const pagesBody = ((mReq.find(r => r.kind === 'pages') || {}).body || [])[0] || {}; const metricsBody = ((mReq.find(r => r.kind === 'metrics') || {}).body || [])[0] || {};
    const sReq = (full.last('AI Rank SERP Requests') || []).map(i => i.json);
    check('AI2 on + ai_rank_mentions: top_mentioned_pages + target_metrics once each, in the sandbox-confirmed shape (target [{ keyword, search_scope }] / [{ domain }], location, language, platform google, limit)',
      mCalls.length === 2 && Array.isArray(pagesBody.target) && pagesBody.target.length >= 1 && pagesBody.target.every(t => t.keyword && J(t.search_scope) === '["answer"]') && pagesBody.location_code === 2784
      && pagesBody.language_code === 'en' && pagesBody.platform === 'google' && pagesBody.limit === 50 && J(metricsBody.target) === '[{"domain":"nova-ai.example"}]' && metricsBody.platform === 'google', J({ mCalls, pagesBody, metricsBody }).slice(0, 500));
    check('AI2 on + ai_rank_fanout_n 6 for a site that asks Copilot: at most 6 paid results pages a week, Google first (half), Bing for the rest; depth 10 in the site\'s market; one request per search',
      gCalls.length + bCalls.length <= 6 && gCalls.length >= 1 && bCalls.length >= 1 && sReq.every(r => r.body[0].depth === 10 && r.body[0].location_code === 2784 && r.body[0].language_code === 'en')
      && new Set(sReq.map(r => r.engine + '|' + r.key)).size === sReq.length, J({ g: gCalls.length, b: bCalls.length, sReq: sReq.map(r => [r.engine, r.key]) }).slice(0, 400));
    check('AI2 Brave: with the key built in and ai_rank_brave on, at most 10 searches a week (count 20, a supported country or ALL); without the key: none, the node never runs',
      brCalls.length >= 1 && brCalls.length <= 10 && brCalls.every(c => /&count=20&country=(ALL|[A-Z]{2})&search_lang=en/.test(c)) && !of(noKey.calls, /search\.brave\.com/).length && !noKey.counts['AI Rank Brave Call']
      && !!f0(full).brave && f0(noKey).brave === null, J({ n: brCalls.length, nk: of(noKey.calls, /brave/) }).slice(0, 300));
    const flagOff = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS, brave: false } }, { braveKey: true });
    check('AI2 Brave: the key built in but ai_rank_brave off -> no Brave search', !of(flagOff.calls, /search\.brave\.com/).length && !flagOff.counts['AI Rank Brave Call'], J(of(flagOff.calls, /brave/)));

    // ---------------- AI3 money ----------------
    const paidTasks = mCalls.length + gCalls.length + bCalls.length;
    const want = +(0.15 + 0.101 + 0.002 * (gCalls.length + bCalls.length)).toFixed(4);
    const F = f0(full);
    check('AI3 cost_usd = every DataForSEO task this run once, at what it reported ($' + want + ' for ' + paidTasks + ' tasks); the plan\'s cost and the ledger settle carry it; Brave is an estimate beside it, never in it',
      F && F.cost_usd === want && /measured: 8 DataForSEO task/.test(F.cost_basis) === (paidTasks === 8) && F.brave_usd_est === +(0.005 * brCalls.length).toFixed(4)
      && Math.abs((settle(full).dfs_usd || 0) - (settle(on0).dfs_usd || 0) - want) < 1e-9 && J(((full.last('AI Rank Plan') || []).find(i => i.json.site_id === NV) || { json: {} }).json.air.cost.usd) === J(want),
      J({ cost: F && F.cost_usd, want, s: [settle(full).dfs_usd, settle(on0).dfs_usd], b: F && F.brave_usd_est }).slice(0, 300));
    const dup = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: false, dupTask: true });
    check('AI3 two results pages that answer with one task id are counted once (R28: a task is money once)', f0(dup) && f0(dup).cost_usd === +(0.251 + 0.002).toFixed(4), J((f0(dup) || {}).cost_usd));

    // ---------------- AI4 reuse (the same week, then a new month) ----------------
    const rows = full.r.writes.filter(w => w.node === 'Save AI Rank Fetch Cache').flatMap(w => w.rows);
    const TC = require('./table_cols.json');
    check('AI4 the markers are seo_cache rows with exactly its columns: the month\'s LLM Mentions (AIRF.mentionsKey), the week\'s budget and readings, the Common Crawl reading (kind air), the Google readings (kind serp, with the site id)',
      rows.some(r => r.key === 'air:mentions:' + NV + ':2026-11' && r.kind === 'air') && rows.some(r => r.key === 'air:week:' + NV + ':2026-W45' && r.kind === 'air') && rows.some(r => r.key === 'air:cc:' + NV)
      && rows.filter(r => /^serp:/.test(r.key)).length === gCalls.length && rows.filter(r => /^serp:/.test(r.key)).every(r => r.kind === 'serp' && r.site_id === NV)
      && rows.every(r => J(Object.keys(r).sort()) === J(TC.CACHE.slice().sort())), J(rows.map(r => [r.key, r.kind, r.site_id])).slice(0, 500));
    const mRow = rows.find(r => r.key === 'air:mentions:' + NV + ':2026-11') || { value: '{}' }; const mVal = JSON.parse(mRow.value);
    check('AI4 the month\'s LLM Mentions marker keeps the pages, the metrics and what its two tasks cost ($0.251, not the whole run)', mVal.cost_usd === 0.251 && mVal.pages.length === F.mentions_pages.length && mVal.target_metrics.mentions === 3, J(mVal).slice(0, 300));
    const again = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: true, tables: full.r.tables });
    const A = f0(again);
    check('AI4 a second run of the same week and month pays nothing again: no LLM Mentions, no results page, no Bing stats, no Common Crawl, no Brave call; $0; the readings are handed on as cached',
      !p5(again.calls).length && A && A.cost_usd === 0 && A.mentions_pages.length === F.mentions_pages.length && A.target_metrics && A.target_metrics.mentions === 3 && A.cc_captures === F.cc_captures
      && A.bing_stats && A.bing_stats.from === 'this week' && A.serp_reads.some(x => x.cached && x.source === 'this week') && A.serp_reads.every(x => x.cached)
      && A.brave && Object.keys(A.brave).length >= 1 && Object.keys(A.brave).every(k => k in F.brave),   // the second run asks about the treated core only (stored now), a subset of the first run's searches
      J({ c: p5(again.calls), cost: A && A.cost_usd, from: A && A.bing_stats && A.bing_stats.from }).slice(0, 400));
    const nextMonth = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: false, tables: full.r.tables, now: Date.parse('2026-12-07T10:00:00.000Z') });
    check('AI4 a new month reads LLM Mentions again (and a new week has its own budget)', of(nextMonth.calls, /^AI Rank Mentions Call POST/).length === 2 && of(nextMonth.calls, /^AI Rank SERP Call POST/).length >= 1, J(p5(nextMonth.calls)).slice(0, 300));

    // ---------------- AI5 the SERP cache ----------------
    const cached = F.serp_reads.filter(x => x.cached && x.source === 'serp cache');
    const askedG = sReq.filter(r => r.engine === 'google').map(r => r.key);
    check('AI5 a Google reading of the last 7 days in the shared cache costs $0: it is not asked again and is handed on as cached (the fixture has three, read 4 days ago)',
      cached.length === 3 && cached.every(x => !askedG.includes(x.key) && x.engine === 'google' && x.results.length > 0), J({ cached: cached.map(x => x.key), askedG }));
    const oldTables = IX.clone(full.F.tables); for (const r of oldTables.seo_cache) if (/^serp:/.test(r.key)) { const v = JSON.parse(r.value); v.at = '2026-10-20T10:00:00.000Z'; v.day = '2026-10-20'; r.value = JSON.stringify(v); }
    const stale = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS, engines: '' } }, { braveKey: false, tables: oldTables });
    const sReq2 = (stale.last('AI Rank SERP Requests') || []).map(i => i.json);
    check('AI5 a reading older than 7 days is read again (one paid read each, within the budget); with no Copilot every read is Google',
      cached.every(c => sReq2.some(r => r.key === c.key && r.engine === 'google')) && sReq2.length === 6 && sReq2.every(r => r.engine === 'google'), J(sReq2.map(r => [r.engine, r.key])));

    // ---------------- AI6 Bing ----------------
    const bs = F.bing_stats || {};
    const bReqKeys = sReq.filter(r => r.engine === 'bing').map(r => r.key);
    check('AI6 Bing Webmaster: positions impression-weighted over the last 35 days (6 x 10 + 9 x 30 over 40 = 8.3; an August row left out), pages by url_key, crawl issues labelled, the newest crawl stats',
      bs.positions && bs.positions['custom software development dubai 2026'] === 8.3 && bs.positions_basis['custom software development dubai 2026'] === 'webmaster' && !('nova ai' in bs.positions)
      && bs.pages['nova-ai.example/services/custom-software'] && bs.pages['nova-ai.example/services/custom-software'].impressions === 40
      && J(bs.crawl_issues.map(x => x.issue)) === J(['client error (4xx)', 'blocked by robots.txt']) && bs.crawl_stats && bs.crawl_stats.date === '2026-10-31' && bs.crawl_stats.in_index === 6, J(bs).slice(0, 600));
    check('AI6 a Bing results page is read only for a search Webmaster has no position for, and fills it (the site\'s best position, 0 = read and not in the results)',
      bReqKeys.length >= 1 && !bReqKeys.includes('custom software development dubai 2026') && bReqKeys.every(k => bs.positions[k] != null && /^bing results page/.test(bs.positions_basis[k]))
      && bReqKeys.some(k => bs.positions[k] === 4) && Object.entries(bs.positions).every(([k, v]) => v > 0 || /not in the/.test(bs.positions_basis[k])), J({ bReqKeys, pos: bs.positions, basis: bs.positions_basis }).slice(0, 500));
    const notIn = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: false, bingSites: ['https://acme-erp.example/'] });
    check('AI6 a website outside this Bing account: no Bing Webmaster call (the reason is on the item)', !of(notIn.calls, /^AI Rank Bing Call/).length && /not in this Bing Webmaster account/.test(f0(notIn).basis.bing), J(f0(notIn).basis));

    // ---------------- AI7 no Brave key ----------------
    const wf = IX.readWf('SEO_Agent_AI_Growth.json');
    const bn = wf.nodes.find(n => n.name === 'AI Rank Brave Call') || {};
    const flags = wf.nodes.filter(n => /const BRAVE_ON = (true|false);/.test((n.parameters || {}).jsCode || '')).map(n => (n.parameters.jsCode.match(/const BRAVE_ON = (true|false);/) || [])[1]);
    check('AI7 the Brave node is built in whatever the key (credential reference SEOcredBraveApi1, header auth), the build flag is one value in the planner and the six request nodes, and with it false the node never runs even when the site asks for Brave',
      bn.type === 'n8n-nodes-base.httpRequest' && J(Object.keys(bn.credentials || {})) === '["httpHeaderAuth"]' && bn.credentials.httpHeaderAuth.id === 'SEOcredBraveApi1' && bn.parameters.genericAuthType === 'httpHeaderAuth'
      && flags.length === 7 && new Set(flags).size === 1 && !noKey.counts['AI Rank Brave Call'] && /no Brave Search key/.test(((noKey.last('AI Rank Brave Requests') || [])[0] || {}).json.reason || ''), J({ flags, cred: bn.credentials }));

    // ---------------- AI8 Common Crawl ----------------
    const none = await IX.runOn({ nova: { mode: 'on' } }, { cc: 'none' }); const err = await IX.runOn({ nova: { mode: 'on' } }, { cc: 'error' });
    const ccRows = (res) => res.r.writes.filter(w => w.node === 'Save AI Rank Fetch Cache').flatMap(w => w.rows).filter(r => /^air:cc:/.test(r.key));
    check('AI8 Common Crawl: the newest crawl (collinfo.json first entry) is asked; 3 captures counted; "No Captures" = 0 (a reading, stored); an error = not read (null, nothing stored)',
      of(on0.calls, /CC-MAIN-2026-43-index\?url=nova-ai\.example&matchType=domain/).length === 1 && f0(on0).cc_captures === 3 && f0(on0).cc.crawl === 'CC-MAIN-2026-43'
      && f0(none).cc_captures === 0 && ccRows(none).length === 1 && f0(err).cc_captures === null && !ccRows(err).length, J([f0(on0).cc_captures, f0(none).cc_captures, f0(err).cc_captures, ccRows(err).length]));
    const errStored = await IX.runOn({ nova: { mode: 'on' } }, { cc: 'error', tables: on0.r.tables, now: Date.parse('2026-12-07T10:00:00.000Z') });
    check('AI8 read every 28 days: the second run of the week asks nothing (AI4); 35 days later it asks again, and when that read fails the stored count is kept, labelled not fresh',
      of(errStored.calls, /^AI Rank CC Index Call/).length === 1 && f0(errStored).cc_captures === 3 && f0(errStored).cc.fresh === false, J(f0(errStored).cc));

    // ---------------- AI9 the shapes reach the kits ----------------
    const KEYS = ['site_id', 'cost_usd', 'mentions_pages', 'target_metrics', 'bing_stats', 'serp_reads', 'cc_captures', 'brave'];
    const typeOk = F && typeof F.site_id === 'string' && typeof F.cost_usd === 'number' && Array.isArray(F.mentions_pages) && F.mentions_pages.every(m => m.url && 'title' in m && typeof m.mentions === 'number' && m.platform)
      && typeof F.target_metrics === 'object' && F.target_metrics.month === '2026-11' && typeof F.target_metrics.mentions === 'number' && 'ai_search_volume' in F.target_metrics
      && typeof F.bing_stats.read_at === 'string' && typeof F.bing_stats.positions === 'object' && typeof F.bing_stats.pages === 'object' && Array.isArray(F.bing_stats.crawl_issues)
      && F.serp_reads.every(x => typeof x.query === 'string' && typeof x.location_code === 'number' && Array.isArray(x.results) && typeof x.read_at === 'string' && typeof x.cached === 'boolean')
      && typeof F.cc_captures === 'number' && Object.values(F.brave).every(l => Array.isArray(l) && l.every(x => x.url && x.pos));
    check('AI9 AI Rank Fetched carries the CONTRACTS §6 keys with their types; mentions pages: utm stripped, one per url_key (40 + 12 mentions = 52), the client\'s own page left out',
      KEYS.every(k => k in F) && typeOk && F.mentions_pages[0].url === 'https://top-software-firms.example/best-custom-software-companies-uae' && F.mentions_pages[0].mentions === 52 && !F.mentions_pages.some(m => /nova-ai\.example/.test(m.url)),
      J(Object.fromEntries(KEYS.map(k => [k, J(F && F[k]).slice(0, 80)]))));
    // D24: the fan-out reads reach ARD.diagnose. Without any stored results page, the Google cells have no rank basis; with this run's reads they do
    const noSerp = IX.clone(full.F.tables); noSerp.seo_cache = noSerp.seo_cache.filter(r => !/^serp:/.test(r.key));
    const planOf = (res) => (((res.last('AI Rank Plan') || []).find(i => i.json.site_id === NV) || { json: {} }).json.air || {});
    const cellsOf = (air, group) => (air.diag || []).flatMap(d => Object.entries(d.engines || {}).filter(([e]) => group.includes(e)).map(([, c]) => c));
    const G3 = ['ai_overview', 'ai_mode', 'gemini'];
    const readsNone = await IX.runOn({ nova: { mode: 'on', fanout_n: 0, engines: COPILOT } }, { tables: noSerp });
    const readsAll = await IX.runOn({ nova: { mode: 'on', fanout_n: 20, engines: '' } }, { tables: noSerp });
    const pr = (res) => cellsOf(planOf(res), G3).filter(c => c.basis === 'proxy_rank').length;
    const readKeys = new Set((readsAll.last('AI Rank SERP Requests') || []).map(i => i.json.key));
    const g3 = cellsOf(planOf(readsAll), G3); const serpEv = g3.flatMap(c => c.evidence || []).filter(e => e.kind === 'serp' && readKeys.has(e.query));
    const s2 = g3.filter(c => c.stage === 'S2' && c.basis === 'proxy_rank' && (c.evidence || []).some(e => e.kind === 'serp' && /^2026-11-02/.test(String(e.at)) && Number(e.pos) === 3));
    check('AI9 (D24) the Google fan-out reads of this run reach the diagnosis: with no stored results page the Google cells have no rank basis; with ai_rank_fanout_n 20 they read proxy_rank on this run\'s searches, and a search the client ranks 3rd for lifts the cell to S2 with that reading as evidence',
      pr(readsNone) === 0 && pr(readsAll) > 0 && serpEv.length > 0 && s2.length > 0, J({ none: pr(readsNone), all: pr(readsAll), ev: serpEv.slice(0, 2), s2: s2.length }));
    const fullAir = planOf(full);
    const cop = cellsOf(fullAir, ['copilot']).filter(c => c.basis === 'proxy_rank' && (c.evidence || []).some(e => e.kind === 'bing'));
    const cla = cellsOf(fullAir, ['claude']).filter(c => c.basis === 'proxy_rank' && (c.evidence || []).some(e => e.kind === 'brave'));
    const src = (fullAir.sources || []).filter(s => s.from === 'llm_mentions');
    check('AI9 Bing positions reach the Copilot cells and Brave results the Claude cells (proxy_rank, evidence kind bing / brave); an LLM Mentions page no answer cited enters the source graph as llm_mentions',
      cop.length > 0 && cla.length > 0 && src.some(s => s.url_key === 'uae-tech-review.example/top-ai-development-firms-2026'), J({ cop: cop.length, cla: cla.length, src: src.map(s => s.url_key) }));
    check('AI9 no node error in any run, and Growth Report runs exactly once in each', [off, sh, on0, noKey, full, flagOff, dup, again, nextMonth, stale, notIn, none, err, errStored, readsNone, readsAll].every(x => !x.r.errors.length && x.counts['Growth Report'] === 1),
      J([off, sh, on0, full].map(x => x.r.errors)).slice(0, 300));

    // ---------------- proved to bite: three sabotaged copies of the generated workflow, each caught by the check that guards it ----------------
    const sab = (mut) => { const w = IX.clone(wf); mut(w); return w; };
    const nodeOf = (w, n) => w.nodes.find(x => x.name === n);
    const swap = (w, n, a, b) => { const nd = nodeOf(w, n); if (nd.parameters.jsCode.split(a).length !== 2) throw new Error('bite: anchor not found once in ' + n + ': ' + a); nd.parameters.jsCode = nd.parameters.jsCode.replace(a, b); };
    const w1 = sab(w => swap(w, 'AI Rank Requests', 'const pay = sites.filter(g => AIRF.mayPay(', 'const pay = sites.filter(g => AIRF.runs('));
    const b1 = await IX.runOn({ nova: { mode: 'shadow', ...ALL_FLAGS } }, { braveKey: true, wf: w1 });
    const w2 = sab(w => swap(w, 'AI Rank Fetched', 'if (ids.length && ids.every(id => seenTask.has(id))) return 0;', ''));
    const b2 = await IX.runOn({ nova: { mode: 'on', ...ALL_FLAGS } }, { braveKey: false, dupTask: true, wf: w2 });
    const w3 = sab(w => swap(w, 'AI Rank Plan', 'serp: serpS,', 'serp,'));
    const b3 = await IX.runOn({ nova: { mode: 'on', fanout_n: 20, engines: '' } }, { tables: noSerp, wf: w3 });
    check('AI bites: a planner that plans for shadow sites makes outside calls in shadow (AI1 catches it); a cost counted per answer instead of per task id doubles the shared task (AI3); a plan that ignores serp_reads loses the rank basis (AI9)',
      p5(b1.calls).length > 0 && J(b1.calls) !== J(off.calls) && f0(b2) && f0(b2).cost_usd !== +(0.251 + 0.002).toFixed(4) && pr(b3) === 0, J({ b1: p5(b1.calls).length, b2: f0(b2) && f0(b2).cost_usd, b3: pr(b3) }));

    // ---------------- AI10 static ----------------
    const WF_DIR = path.join(__dirname, '..', 'workflows');
    const files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.json')); const srcs = files.map(f => fs.readFileSync(path.join(WF_DIR, f), 'utf8'));
    check('AI10 no generated workflow calls SerpApi or Gemini grounding (generativelanguage.googleapis.com)', srcs.length > 10 && !srcs.some(s => /serpapi\.com/i.test(s) || /generativelanguage\.googleapis\.com/i.test(s)), '');
    const N = (n) => wf.nodes.find(x => x.name === n) || null; const C = wf.connections;
    const RETRY = (n) => n && n.retryOnFail === true && n.maxTries >= 3 && n.waitBetweenTries >= 5000;
    const gated = ['AI Rank Mentions Call', 'AI Rank SERP Call'].every(h => N(h) && !N(h).retryOnFail && N(h + ' (Retry)') && !N(h + ' (Retry)').retryOnFail && N(h + ' Retry Plan') && N(h + ' Answers')
      && J(C[h].main[0].map(t => t.node)) === J([h + ' Retry Plan']) && (N(h).credentials || {}).httpBasicAuth.id === 'SEOcredDataForSE');
    const fetchedJs = (N('AI Rank Fetched').parameters || {}).jsCode || '';
    check('AI10 the two paid DataForSEO calls sit in the in-200 gate with no node-level retry (N3), and AI Rank Fetched reads their merged answers', gated && /'AI Rank Mentions Call Answers'/.test(fetchedJs) && /'AI Rank SERP Call Answers'/.test(fetchedJs)
      && !/'AI Rank (Mentions|SERP) Call'\)/.test(fetchedJs), '');
    check('AI10 the free calls carry the retry rule (3 tries, 5 s); Bing with SEOcredBingWebm (query auth), Common Crawl with no credential',
      ['AI Rank Bing Call', 'AI Rank CC Collections', 'AI Rank CC Index Call'].every(n => RETRY(N(n))) && N('AI Rank Bing Call').credentials.httpQueryAuth.id === 'SEOcredBingWebm'
      && !N('AI Rank CC Collections').credentials && !N('AI Rank CC Index Call').credentials, '');
    // the paid Brave call takes the N3 rule of the paid DataForSEO nodes (retry_lint PAID_KEYED_MARK): no node-level retry, a failure is an item
    const RWj = require('./retry_wiring.json'); const st = RWj.selftest || {};
    const bw = ((RWj.workflows || {})['SEO Agent — AI Growth'] || []).find(x => x.name === 'AI Rank Brave Call') || {};
    check('AI10 the paid Brave call has no node-level retry (n8n would re-send and re-bill every search when the first fails): recorded paid and per-item; the lint flags a Brave node WITH a retry, passes it without, strips it, and does not count it as DataForSEO',
      N('AI Rank Brave Call').retryOnFail !== true && N('AI Rank Brave Call').onError === 'continueRegularOutput' && bw.paid === true && bw.per_item === true && bw.retryOnFail === false
      && st.flags_paid_keyed_multi_with_retry === true && st.passes_paid_keyed_per_item === true && st.apply_strips_paid_keyed_retry === true && st.paid_keyed_not_dfs === true, J({ bw, st }).slice(0, 400));
    const chain = ['AI Rank Requests', 'AI Rank Fetched', 'AI Rank Fetch Rows', 'Any AI Rank Fetch Rows?', 'Save AI Rank Fetch Cache'];
    for (const h of ['AI Rank Mention Requests', 'AI Rank Bing Requests', 'AI Rank SERP Requests', 'AI Rank CC Requests', 'AI Rank CC Index Requests', 'AI Rank Brave Requests']) chain.push(h);
    const p5Nodes = wf.nodes.filter(n => chain.includes(n.name) || /^(Any )?AI Rank (Mentions Call|SERP Call|Bing|CC|Brave|Mentions\?|SERP\?)/.test(n.name) || /^Wait Before AI Rank/.test(n.name));
    check('AI10 every node of the read chain fails closed (onError continueRegularOutput) and, the gate\'s Wait nodes aside, is an AIR node by name',
      p5Nodes.length >= 30 && p5Nodes.every(n => n.onError === 'continueRegularOutput') && p5Nodes.filter(n => !/^Wait Before /.test(n.name)).every(n => AIR_NODE.test(n.name)), J(p5Nodes.filter(n => n.onError !== 'continueRegularOutput' || (!/^Wait/.test(n.name) && !AIR_NODE.test(n.name))).map(n => n.name)));
    const settleJs = ((N('Ledger Settle (Growth)') || {}).parameters || {}).jsCode || '';
    const plan = ((N('AI Rank Plan') || {}).parameters || {}).jsCode || '';
    check('AI10 the ledger settle reads AI Rank Fetched (measured), and AI Rank Plan merges its results pages (D24)', /const MEASURED = 'Growth Metrics\|AI Rank Fetched';/.test(settleJs) && /const serpS = serpFor\(fetched\);/.test(plan) && /serp: serpS,/.test(plan), '');
    const here = path.join(__dirname, '..'); const sync = fs.readFileSync(path.join(here, 'sync_credentials.py'), 'utf8'); const envs = fs.readFileSync(path.join(here, 'env_settings.py'), 'utf8');
    const EG = require('./env_guard.json');
    check('AI10 the Brave credential is created only from SEO_BRAVE_API_KEY (fixed id SEOcredBraveApi1, header X-Subscription-Token); the build flag reads the same variable; no key in any generated file',
      /\('SEOcredBraveApi1', 'Brave Search API', 'httpHeaderAuth', \{'value': 'SEO_BRAVE_API_KEY'\}, \{'name': 'X-Subscription-Token'\}\)/.test(sync) && /BRAVE_ENABLED = bool\(\(ENV\.get\('SEO_BRAVE_API_KEY'\)/.test(envs)
      && (EG.flags || []).includes('SEO_BRAVE_API_KEY') && !srcs.some(s => /X-Subscription-Token"\s*:\s*"[A-Za-z0-9_-]{16,}"|BSA[A-Za-z0-9_-]{20,}/.test(s)), '');
  });
};
