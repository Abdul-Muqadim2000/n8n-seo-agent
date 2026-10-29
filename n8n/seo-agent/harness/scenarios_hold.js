// W0D1-W0D9 (page-quality programme 2026-10-29, W0-D: PLAN Fix 4 and §2.1 "Duplicate before the brief"; REVIEW_CODE H1 / M1 / M3; owner
// decisions D1 / D2 / D17; owner priority of 2026-10-29). A page run is held for the client's OK BEFORE the brief when the verdict scored the
// keyword under 50 or the website already has a page for the search. Tested on the recorded production runs (anonymised fixtures):
//   * page run 3299 ("ms 365 erp", form run, verdict 42, the website's Business Central page and the ranking guide both carry its words): held;
//   * the guide that ranks (exec 949, a ladder page): never held, never the duplicate of itself, whatever its score, however it is started;
//   * the two service pages production's ladder wrote on 2026-10-29 for the guide's own searches: recognised as overlapping the guide, and
//     only logged (shadow mode) because a ladder started them.
// Plus the exemptions, the null score, the acknowledgement, the late check on the same rule, the content-log row and the cadence.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const F = R.load('replay_3299.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const PB = F.nodes['Parse Brief']['0'].items[0].json;   // 3299: every field Parse Verdict's input carried, and what the verdict decided
  const W = 'https://www.novaand.example';
  const BC = W + '/dynamics-365-business-central-uae';
  const GUIDE = W + '/insights/is-microsoft-dynamics-365-an-erp-system';
  const PLAIN = /[—–…‘’“”]|\.\.\./;   // no em dashes, curly quotes or "..." in what the client reads
  // Parse Verdict's input as 3299 had it (Merge Keyword Data), and the Verdict Agent's answer rebuilt from what Parse Verdict read
  const PREV = (() => { const p = clone(PB); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check']) delete p[k]; p.client_ip = 'app:0b1c2d3e-anon'; return p; })();
  const AGENT = { verdict: PB.verdict, score: PB.verdict_score, reasons: PB.verdict_reasons, risks: PB.verdict_risks, what_must_change: PB.verdict_changes,
    secondary_keywords: PB.secondary_keywords, recommended_page: 'Service Page', expected_monthly_visits_top3: 1, time_to_rank_months: 7 };
  const pv = async (over, agentOver) => {
    reset();
    mock('Merge Keyword Data', [{ json: { ...PREV, ...(over || {}) } }]);
    mock('Load Site Cache', [{ json: {} }]);
    return (await run('Parse Verdict', [{ json: { output: { ...AGENT, ...(agentOver || {}) } } }]))[0].json;
  };
  const urls = (a) => (a || []).map(x => x.url);
  // the guide as its run had it (ladder rung 2, started by the ladder), on 3299's site model, which holds the guide itself (a run today)
  const GUIDE_RUN = { keyword: G.keyword, page_type: G.page_type, pipeline_source: G.pipeline_source, force_content: true, ladder_id: 'lad_anon01', ladder_rung: G.ladder_rung,
    ladder_head: 'dynamics 365 erp system', ladder_target_url: G.ladder_target_url_at_run, client_ip: 'ladder:lad_anon01', existing_page: null, existing_page_url: '' };

  // ---------- W0D1 the page that went wrong: 3299 is held before the brief, with what to do instead ----------
  await guard('W0D1 3299 held', async () => {
    const SN = 'W0D1 (W0-D) run 3299 "ms 365 erp" (verdict 42, started by a person): held before the brief, with the score, the duplicate pages and three ways forward';
    begin(SN); const check = mkCheck(SN);
    const o = await pv();
    console.log('   3299 ->', J({ hold: o.verdict_hold, mode: o.hold_mode, kinds: (o.hold || {}).kinds, dups: urls((o.hold || {}).duplicates), alts: ((o.hold || {}).alternatives || []).map(a => a.kind + ':' + (a.keyword || '') + ' ' + (a.url || '')) }));
    check('held (verdict_hold true, mode enforce): no brief, no copy, no edit', o.verdict_hold === true && o.would_hold === true && o.hold_mode === 'enforce' && !!o.hold && o.hold_shadow === null, J({ h: o.verdict_hold, m: o.hold_mode }));
    check('for both reasons: the score 42 under 50, and the pages the website already has for the search', J(o.hold.kinds) === J(['score', 'duplicate']) && o.hold.score === 42 && o.hold.threshold === 50
      && urls(o.hold.duplicates).includes(BC) && urls(o.hold.duplicates).includes(GUIDE), J(o.hold));
    const alts = o.hold.alternatives;
    check('up to three ways forward: improve the existing page, the recommended target from the verdict\'s own change', alts.length >= 2 && alts.length <= 3 && alts[0].kind === 'improve' && alts[0].url === BC
      && alts.some(a => a.kind === 'retarget' && a.keyword === 'Microsoft Dynamics 365 ERP implementation partner UAE'), J(alts));
    check('the reasons name the score and the page; the rule and the next step are plain words', o.hold.reasons.length === 2 && /scored "ms 365 erp" 42 out of 100/.test(o.hold.reasons[0]) && o.hold.reasons[1].includes(BC)
      && !PLAIN.test(o.hold.rule + o.hold.next + o.hold.reasons[1] + alts.map(a => a.label + a.why).join(' ')) && /under 50/.test(o.hold.rule), J({ r: o.hold.reasons, rule: o.hold.rule, next: o.hold.next }));
    check('the verdict itself is unchanged (still GO_WITH_CHANGES 42; the report is delivered)', o.verdict === 'GO_WITH_CHANGES' && o.verdict_score === 42, J({ v: o.verdict, s: o.verdict_score }));
    // "Write it anyway": the same request with hold_ack
    const a = await pv({ hold_ack: { score: 42 } });
    check('with hold_ack (the client chose "Write it anyway") nothing is held and the run says it was acknowledged', a.verdict_hold === false && a.would_hold === false && a.hold === null && a.verdict_acknowledged === true
      && J(a.hold_ack) === J({ score: 42 }), J({ h: a.verdict_hold, w: a.would_hold, ack: a.hold_ack, va: a.verdict_acknowledged }));
    check('without it the run is not acknowledged', o.verdict_acknowledged === false && o.hold_ack === null, J({ va: o.verdict_acknowledged }));
    // a report-only run (verdict, keyword report) is never held: there is nothing to write
    const r = await pv({ include_content: false, verdict_only: true });
    check('a verdict-only run: the hold does not apply (mode off)', r.verdict_hold === false && r.would_hold === false && r.hold_mode === 'off' && r.duplicate_check === null, J({ m: r.hold_mode }));
    const ld = await pv({ mode: 'ladder' });
    check('a ladder plan run: not a page run, never held (the plan goes its own way after the verdict)', ld.verdict_hold === false && ld.hold_mode === 'off', J({ m: ld.hold_mode }));
  });

  // ---------- W0D2 automatic runs: shadow mode first (D17) ----------
  await guard('W0D2 shadow', async () => {
    const SN = 'W0D2 (W0-D, D17) the same keyword started automatically (cadence, tracker): logged as would_hold and reported, the page is written as before';
    begin(SN); const check = mkCheck(SN);
    for (const ip of ['cadence:site_novaand-example', 'tracker:site_novaand-example']) {
      const o = await pv({ client_ip: ip, force_content: true, pipeline_source: 'cadence' });
      check(ip.split(':')[0] + ': would_hold, shadow mode, not held, the shadow hold carries the reasons', o.would_hold === true && o.verdict_hold === false && o.hold_mode === 'shadow' && o.hold === null
        && !!o.hold_shadow && o.hold_shadow.held === false && J(o.hold_shadow.kinds) === J(['score', 'duplicate']) && /written as before/.test(o.hold_shadow.next), J({ w: o.would_hold, h: o.verdict_hold, m: o.hold_mode, s: o.hold_shadow && o.hold_shadow.next }));
    }
    const f = await pv({ client_ip: '0.0.0.0', pipeline_source: 'form' });
    check('the browser form (started by a person) is asked, as the app is', f.verdict_hold === true && f.hold_mode === 'enforce', J({ m: f.hold_mode }));
  });

  // ---------- W0D3 exemptions and the null rule (REVIEW_CODE H1) ----------
  await guard('W0D3 exemptions', async () => {
    const SN = 'W0D3 (W0-D, REVIEW_CODE H1) not held: a case study, an AI answer page, a refresh, a keyword-ladder page; a null score is "not checked", never a hold';
    begin(SN); const check = mkCheck(SN);
    const cs = await pv({ page_type: 'Case Study', case_id: 'cs_anon1', case_study: { client_name: 'A client' }, client_ip: 'casestudy:site_novaand-example', force_content: true });
    check('a case study: not held, and says why', cs.would_hold === false && cs.verdict_hold === false && /case study/.test(cs.hold_exempt), J({ w: cs.would_hold, e: cs.hold_exempt }));
    const ai = await pv({ ai_target: { question: 'Which Dynamics 365 partner helps UAE firms choose an ERP?', kind: 'answer', fanout: [], competitors: [], sources: [] } });
    check('an AI answer page started from the app: not held', ai.would_hold === false && ai.verdict_hold === false && /AI answers/.test(ai.hold_exempt), J({ w: ai.would_hold, e: ai.hold_exempt }));
    const rf = await pv({ existing_page_url: BC });
    check('a refresh of an own page: not held', rf.would_hold === false && rf.verdict_hold === false && /refresh/.test(rf.hold_exempt), J({ w: rf.would_hold, e: rf.hold_exempt }));
    // a ladder rung the app's "Write now" started, scored 42: exempt from the score; its duplicate check asks for ALL of its words on one page
    const lr = await pv({ keyword: 'dynamics 365 erp cost uae', ladder_id: 'lad_anon02', ladder_rung: 2, ladder_head: 'dynamics 365 erp system', force_content: true });
    console.log('   ladder rung ->', J({ w: lr.would_hold, exempt: lr.hold_exempt, partial: urls((lr.duplicate_check || {}).partial), targets: urls((lr.duplicate_check || {}).targets) }));
    check('a keyword-ladder page scored 42: not held (the ladder checked its main keyword when it was planned)', lr.would_hold === false && lr.verdict_hold === false && /keyword ladder/.test(lr.hold_exempt), J({ w: lr.would_hold, e: lr.hold_exempt }));
    check('its planned neighbour that shares most of its words is advice, not a duplicate', (lr.duplicate_check.targets || []).length === 0, J(lr.duplicate_check));
    // null score: the verdict gave none, or the results page could not be read (NOT_CHECKED)
    const ns = await pv({ site_model: { ...PB.site_model, pages: [] } }, { score: null });
    check('no score from the verdict: not held, and the run says it was not checked', ns.verdict_hold === false && ns.would_hold === false && /no score/.test(ns.hold_not_checked), J({ h: ns.verdict_hold, n: ns.hold_not_checked }));
    const nc = await pv({ site_model: { ...PB.site_model, pages: [] }, serp_features: { ...(PB.serp_features || {}), unavailable: true, error: 'no answer' } });
    check('NOT_CHECKED (the results page could not be read): no score, not held, the reason printed', nc.verdict === 'NOT_CHECKED' && nc.verdict_score === null && nc.verdict_hold === false && /could not score/.test(nc.hold_not_checked), J({ v: nc.verdict, n: nc.hold_not_checked }));
    const hi = await pv({ site_model: { ...PB.site_model, pages: [] } }, { score: 64, verdict: 'GO' });
    check('a score of 50 or more with no duplicate: written as before', hi.verdict_hold === false && hi.would_hold === false && hi.hold === null, J({ h: hi.verdict_hold }));
    const at50 = await pv({ site_model: { ...PB.site_model, pages: [] } }, { score: 50 });
    check('exactly 50 is not held (under 50 is)', at50.verdict_hold === false, J({ h: at50.verdict_hold }));
  });

  // ---------- W0D4 owner priority: the guide that ranks ----------
  await guard('W0D4 ranking guide 949', async () => {
    const SN = 'W0D4 (W0-D, owner priority 2026-10-29) the guide that ranks (exec 949): never held, never the duplicate of itself, at any score, however it is started';
    begin(SN); const check = mkCheck(SN);
    for (const [label, over] of [['as it ran (the ladder started it)', {}], ['from the app\'s "Write now"', { client_ip: 'app:0b1c2d3e-anon' }], ['from the cadence', { client_ip: 'cadence:site_novaand-example' }]]) {
      for (const score of [null, 30, 42, 94]) {
        const o = await pv({ ...GUIDE_RUN, ...over }, { score, recommended_page: 'Guide' });
        const ok = o.verdict_hold === false && o.would_hold === false && o.hold === null && o.hold_shadow === null && !urls((o.duplicate_check || {}).targets).includes(GUIDE);
        if (!ok || score === null) check(label + ', score ' + score + ': not held, no shadow hold, not its own duplicate', ok, J({ h: o.verdict_hold, w: o.would_hold, dc: o.duplicate_check }));
      }
    }
    const g = await pv(GUIDE_RUN, { score: null, recommended_page: 'Guide' });
    check('the guide\'s own page is recognised as its own (by its slug), not as a duplicate', urls(g.duplicate_check.self).includes(GUIDE) && !urls(g.duplicate_check.targets).length, J(g.duplicate_check));
    // the same keyword typed by a person, no ladder, no score stored: the Business Central page shares four of its five words, but only the
    // site's common product words ("microsoft", "dynamics", "365", "erp"), so it is NOT a page for the same search (the weighted share)
    const f = await pv({ ...GUIDE_RUN, ladder_id: '', ladder_rung: null, ladder_target_url: '', client_ip: 'app:0b1c2d3e-anon', force_content: false, site_model: { ...PB.site_model, pages: PB.site_model.pages.filter(p => p.url !== GUIDE) } }, { score: null, recommended_page: 'Guide' });
    check('typed by a person before it existed: the Business Central service page is not its duplicate (it shares only the site\'s common words)', f.verdict_hold === false && f.would_hold === false && !urls(f.duplicate_check.targets).includes(BC), J(f.duplicate_check));
  });

  // ---------- W0D5 the duplicates production wrote on 2026-10-29: recognised, shadow-logged ----------
  await guard('W0D5 production duplicates', async () => {
    const SN = 'W0D5 (W0-D) "microsoft dynamics erp" and "dynamics 365 erp system", written by the ladder on 2026-10-29 for the guide\'s own searches: recognised as overlapping the guide, logged in shadow mode';
    begin(SN); const check = mkCheck(SN);
    for (const [kw, rung] of [['microsoft dynamics erp', 3], ['dynamics 365 erp system', 4]]) {
      const auto = await pv({ ...GUIDE_RUN, keyword: kw, ladder_rung: rung, page_type: 'Service Page', ladder_target_url: W + '/' + kw.replace(/\s+/g, '-') }, { score: 55, recommended_page: 'Service Page' });
      console.log('   ' + kw + ' ->', J({ w: auto.would_hold, m: auto.hold_mode, dups: urls((auto.hold_shadow || {}).duplicates) }));
      check('"' + kw + '" from the ladder: would_hold for a duplicate of the guide, shadow mode, the page still written', auto.would_hold === true && auto.verdict_hold === false && auto.hold_mode === 'shadow'
        && !!auto.hold_shadow && J(auto.hold_shadow.kinds) === J(['duplicate']) && urls(auto.hold_shadow.duplicates).includes(GUIDE), J({ w: auto.would_hold, h: auto.verdict_hold, s: auto.hold_shadow }));
      const app = await pv({ ...GUIDE_RUN, keyword: kw, ladder_rung: rung, page_type: 'Service Page', ladder_target_url: '', client_ip: 'app:0b1c2d3e-anon' }, { score: 55, recommended_page: 'Service Page' });
      check('"' + kw + '" from the app\'s "Write now": asked first, "Improve the existing page" offered', app.verdict_hold === true && app.hold.alternatives[0].kind === 'improve'
        && urls(app.hold.duplicates).includes(GUIDE), J({ h: app.verdict_hold, alts: app.hold && app.hold.alternatives }));
    }
  });

  // ---------- W0D6 the late check asks the same kit, and only ever drops a match ----------
  await guard('W0D6 late check', async () => {
    const SN = 'W0D6 (W0-D) Originality Check (the late safety net) uses the same DUP kit: 3299 unchanged, the guide never flagged by the site\'s common words';
    begin(SN); const check = mkCheck(SN);
    for (const runIdx of [0, 1, 2]) {
      const r = await R.replay(F, 'Originality Check', runIdx);
      const now = urls(((r.first.content_qa || {}).originality || {}).duplicate_targets), then = urls(((r.recordedFirst.content_qa || {}).originality || {}).duplicate_targets);
      check('3299 round ' + runIdx + ': the duplicate targets are what production found (' + then.join(', ') + ')', J(now) === J(then) && then.includes(BC), J({ now, then }));
    }
    const base = await R.replay(F, 'Originality Check', 2);
    const inp = clone(base.input); inp[0].json.keyword = G.keyword;
    const g = await R.replay(F, 'Originality Check', 2, { input: inp });
    const gd = urls(((g.first.content_qa || {}).originality || {}).duplicate_targets);
    check('the guide\'s keyword on the same run: the Business Central page is not a duplicate (it shares the site\'s common words only)', !gd.includes(BC) && !gd.includes(GUIDE), J(gd));
    // the guide in the inventory and NOT read in this run: a run for its keyword improves it (Collect Client Pages sets it as the existing
    // page, SM.matchPage), so its own page is never its duplicate
    const inp2 = clone(base.input); inp2[0].json.keyword = G.keyword; inp2[0].json.existing_page = { url: GUIDE, title: 'Is Microsoft Dynamics 365 an ERP System?' };
    const g2 = await R.replay(F, 'Originality Check', 2, { input: inp2, mocks: { 'Collect Client Pages': [{ json: { client_pages: [] } }] } });
    const gd2 = urls(((g2.first.content_qa || {}).originality || {}).duplicate_targets);
    check('the guide unread, in the inventory: not its own duplicate', !gd2.includes(GUIDE), J(gd2));
  });

  // ---------- W0D7 the content log: a held run is `held`, never in place of a page that exists ----------
  await guard('W0D7 content log', async () => {
    const SN = 'W0D7 (W0-D, REVIEW_CODE M3) Content Log Row: a held run writes `held` with the score and the reason; a page that exists keeps its row; a shadow hold writes the page as before';
    begin(SN); const check = mkCheck(SN);
    const D = 'novaand.example', RID = 'cad_20261102_novaand-example_1';
    const NI = { domain: D, keyword: 'ms 365 erp', request_id: RID, client_ip: 'app:0b1c2d3e-anon', page_type: 'Service Page' };
    const held = await pv();
    const row = async (pvOut, pkg, stored) => { reset(); mock('Normalize Input', [{ json: NI }]); mock('Parse Verdict', [{ json: pvOut }]); mock('Blog Package', [{ json: pkg }]);
      mock('Load Content Log (Run)', stored && stored.length ? stored.map(j => ({ json: j })) : [{ json: {} }]); return (await run('Content Log Row', store['Load Content Log (Run)']))[0].json; };
    const r1 = await row(held, { keyword: 'ms 365 erp' }, [{ site_id: 'site_novaand-example', domain: D, keyword: 'ms 365 erp', source: 'app', status: 'started', request_id: RID, started_at: '2026-10-28T10:00:00.000Z' }]);
    check('held: status `held`, the score and the duplicate page in qa_reasons, the opening row\'s start kept', r1.status === 'held' && /verdict score 42 \(under 50\)/.test(r1.qa_reasons) && r1.qa_reasons.includes(BC)
      && r1.started_at === '2026-10-28T10:00:00.000Z' && !r1.skip, J(r1));
    const r2 = await row(held, { keyword: 'ms 365 erp' }, [{ site_id: 'site_novaand-example', domain: D, keyword: 'ms 365 erp', source: 'app', status: 'published', published_url: W + '/ms-365-erp-uae', request_id: 'old', started_at: '2026-10-20T10:00:00.000Z' }]);
    check('held while the keyword already has a published page: that row is left as it is', r2.skip === true && /keeps its row/.test(r2.reason), J(r2));
    const shadow = await pv({ client_ip: 'cadence:site_novaand-example', force_content: true });
    const r3 = await row(shadow, { article_html: '<h1>MS 365 ERP</h1><p>text</p>', page_markdown: '# MS 365 ERP', qa_not_ready: false }, []);
    check('shadow hold: the page was written, the row says `written` as before', r3.status === 'written' && r3.qa_reasons === '', J(r3));
    const r4 = await row({}, { keyword: 'x' }, []);
    check('a report-only run with no hold: skipped as before', r4.skip === true && /report only/.test(r4.reason), J(r4));
  });

  // ---------- W0D8 the cadence: a held keyword is skipped, the next candidate taken (D1) ----------
  await guard('W0D8 cadence', async () => {
    const SN = 'W0D8 (W0-D, D1, REVIEW_CODE M3) Content Cadence: a keyword held in the last 90 days is not picked again, the next candidate is; after 90 days it is checked again';
    begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
    const RealDate = Date; const frozen = async (iso, fn) => { const T = RealDate.parse(iso); class FD extends RealDate { constructor(...x) { if (x.length) super(...x); else super(T); } static now() { return T; } } global.Date = FD; try { return await fn(); } finally { global.Date = RealDate; } };
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const plan = async (c) => { reset(); const t = c.tables || {}; mock('Manual Run', [{ json: c.trigger || {} }]);
      for (const [k, v] of [['Load Sites', t.sites], ['Load Cadence', t.cadence], ['Load Ladders', t.ladders], ['Load Query History', t.query_history], ['Load Trends', t.trends], ['Load Content Log', t.content_log], ['Load Ladder Settings', t.ladder_settings],
        ['Load Main Keyword Ranks', t.ranks], ['Load AI Targets (Cadence)', t.ai_targets], ['Load AI Targets Writing (Cadence)', []], ['Load Monitors (Cadence)', t.monitors], ['Load Pages (Cadence)', t.pages], ['Load AI Brands (Cadence)', t.ai_brands],
        ['Load Skips (Cadence)', t.skips], ['Load Cost (Cadence)', t.cost], ['Load Cycle Jobs (Cadence)', t.cycle_jobs], ['Load Profiles (Cadence)', t.profiles]]) mock(k, items(v));
      return frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json).filter(j => j.body)); };
    let found = null;
    // a case with a spare candidate beyond the week's picks (so D1 can be seen taking the next one), else any case that picks a page
    for (const c of FX.cases) { const picks = await plan(c); if (!picks.length || picks[0].body.ai_target || picks[0].approved) continue;
      if (!found) found = { c, picks }; if ((Number(picks[0].candidates) || 0) > picks.length) { found = { c, picks }; break; } }
    check('a fixture case picks a page to write automatically', !!found);
    if (!found) return;
    const first = found.picks[0];
    const withHeld = (daysAgo) => { const c = clone(found.c); const s = c.tables.sites[0];
      c.tables.content_log = (c.tables.content_log || []).concat([{ site_id: s.site_id, domain: s.domain, keyword: first.keyword, source: 'cadence', status: 'held', request_id: 'cad_old_1',
        started_at: new Date(Date.parse(c.now) - daysAgo * 864e5).toISOString(), qa_reasons: 'held for your OK: verdict score 31 (under 50)', published_url: '', published_at: '' }]); return c; };
    const p30 = await plan(withHeld(30));
    console.log('   cadence ->', J({ before: found.picks.map(p => p.keyword), held30: p30.map(p => p.keyword) }));
    check('held 30 days ago: "' + first.keyword + '" is not picked again', !p30.some(p => p.keyword === first.keyword), J(p30.map(p => p.keyword)));
    const spare = (Number(first.candidates) || 0) > found.picks.length;   // another candidate exists beyond this week's picks
    check('D1: a fixture case has another candidate on hand beyond the week\'s picks', spare, J({ picks: found.picks.length, candidates: first.candidates }));
    check('D1: the held keyword does not use up the week: the next candidate is picked in its place', !spare || (p30.length === found.picks.length && p30.some(p => !found.picks.some(q => q.keyword === p.keyword))), J({ before: found.picks.map(p => p.keyword), after: p30.map(p => p.keyword), candidates: first.candidates }));
    const p100 = await plan(withHeld(100));
    check('held 100 days ago: checked again (picked)', p100.some(p => p.keyword === first.keyword), J(p100.map(p => p.keyword)));
    check('the cadence never sends hold_ack (only the client\'s "Write it anyway" does)', ![...found.picks, ...p30, ...p100].some(p => p.body && 'hold_ack' in p.body), '');
  });

  // ---------- W0D9 the callback: stage content with the hold; acknowledged is the PRC gating field ----------
  await guard('W0D9 callback', async () => {
    const SN = 'W0D9 (W0-D, REVIEW_CODE M1) Build Webhook Response: a held run answers on stage `content` with `hold`; a shadow hold travels as hold_shadow; verdict_acknowledged is the PRC field';
    begin(SN); const check = mkCheck(SN);
    const held = await pv();
    reset(); mock('Parse Verdict', [{ json: held }]);
    const d = { request_id: '3298', keyword: 'ms 365 erp', domain: 'novaand.example', verdict: held.verdict, verdict_score: held.verdict_score, score_withheld: false, run_ledger: { ai_usd: 0.12, dfs_usd: 0.016 } };
    const cb = (await run('Build Webhook Response', [{ json: d }]))[0].json;
    check('stage content (the app completes the run), the hold with its reasons and three ways forward, no page', cb.stage === 'content' && cb.status === 'completed' && !!cb.hold && cb.hold.score === 42
      && cb.hold.alternatives.length >= 2 && cb.markdown === null && cb.html === null && cb.hold_shadow === null && cb.verdict_acknowledged === false, J({ stage: cb.stage, hold: !!cb.hold, md: cb.markdown }));
    const ack = await pv({ hold_ack: { score: 42 } });
    reset(); mock('Parse Verdict', [{ json: ack }]);
    const cb2 = (await run('Build Webhook Response', [{ json: { ...d, ...ack } }]))[0].json;
    check('written anyway: no hold, verdict_acknowledged true', cb2.hold === null && cb2.verdict_acknowledged === true, J({ h: cb2.hold, a: cb2.verdict_acknowledged }));
    const sh = await pv({ client_ip: 'cadence:site_novaand-example', force_content: true });
    reset(); mock('Parse Verdict', [{ json: sh }]);
    const cb3 = (await run('Build Webhook Response', [{ json: d }]))[0].json;
    check('a shadow hold travels as hold_shadow (logged and reported), never as hold', cb3.hold === null && !!cb3.hold_shadow && cb3.hold_shadow.mode === 'shadow', J({ h: cb3.hold, s: !!cb3.hold_shadow }));
  });
};
