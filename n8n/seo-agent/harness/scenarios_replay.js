// RPL1-RPL4 (page-quality programme 2026-10-29, PLAN §3.0 steps 2 and 4; REVIEW_CODE H2 / M9; owner priority of 2026-10-29): replays of
// recorded production runs on the CURRENT generated code, so every Wave 0 fix is tested on the page that went wrong (3299 / 3336) and on
// the page that ranks (949). Fixtures (anonymised: Nova& / novaand.example, no client page prose, no competitor bodies, no token):
//   fixtures/replay_3299.json.gz  page run 3299 ("ms 365 erp", Service Page, verdict 42): Page Fix, Content QA, Originality Check,
//                                 Page Candidates (3 rounds each) and Blog Package, with every node they read and the callback
//   fixtures/replay_3336.json.gz  the finalize of that page: Parse Brief, Finalize Apply, Finalize Merge (with the recorded Finalize
//                                 Editor answer), Content QA, Originality Check, Finalize Verdict, and the webhook body the app sent
//   fixtures/ranking_guide_949.json  the guide that ranks (319 impressions in its first week, one query at #12): the live page in the
//                                 draft format, the run's brief / site model / critique / QA rounds (page_pipeline_4runs.json) and
//                                 its search outcome. Its verdict score is NOT stored anywhere in the repo.
//   fixtures/prc_example.json     the page-run context contract (gating / grading fields), README "PRC contract"
// harness/replay.js does the replay. These checks pin what must hold through every wave; the BEFORE numbers (the defects Wave 0 fixes)
// are printed, not asserted, so a fix changes a printed line and never this file's pass count. A fix agent adds its own acceptance
// checks in its own scenario file, reading these fixtures with R.load / R.replay.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const before = (label, v) => console.log('   BEFORE ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const FX = {};
  const fx = (name) => FX[name] || (FX[name] = name.endsWith('.gz') ? R.load(name) : JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')));

  // ---------- RPL1 the fixtures are safe to keep in a public repo ----------
  await guard('RPL1 anonymised', async () => {
    const SN = 'RPL1 (2026-10-29) the replay fixtures carry no client identity, no hook token, no API key';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const f of ['replay_3299.json.gz', 'replay_3336.json.gz', 'ranking_guide_949.json', 'prc_example.json']) {
      const s = J(fx(f));
      const hit = [/techand/i, /\bTech&/, /Mughal|Aarish/, /702[\s-]?0541/, /\bDAFZA\b/, /\b[0-9a-f]{32,}\b/, /\/api\/hooks\/n8n\/(?!ANONYMISED)[A-Za-z0-9_-]{8,}/, /sk-ant-|xoxb-|AIza[0-9A-Za-z_-]{20}/]
        .filter(re => re.test(s)).map(String);
      check(f + ': nothing identifying or secret', !hit.length, hit.join(' '));
    }
  });

  // ---------- RPL2 the page that went wrong: 3299 replays on the current code ----------
  await guard('RPL2 replay 3299', async () => {
    const SN = 'RPL2 (2026-10-29, PLAN §3.0 step 4) page run 3299 replays on the current code: every recorded node run, in production order';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const order = ['Page Fix', 'Content QA', 'Originality Check', 'Page Candidates', 'Blog Package'];
    const ran = [];
    for (const node of order) for (const rec of F.runs[node]) {
      const r = await R.replay(F, node, rec.run);
      ran.push(node + '#' + rec.run);
      check(node + ' #' + rec.run + ' runs on the recorded input and answers one item', r.out.length === 1 && r.first && typeof r.first === 'object', J(r.out).slice(0, 300));
    }
    check('all 13 recorded runs replayed', ran.length === 13, ran.join(', '));
    const pc = (await R.replay(F, 'Page Candidates', 2)).first;
    const bp = (await R.replay(F, 'Blog Package', 0)).first;
    const q = pc.content_qa || {};
    before('3299 final content score / grade', { content_score: q.content_score, breakdown: q.score_breakdown, publishable: q.publishable, not_ready: q.not_ready });
    before('3299 blocking and grade (Page Candidates #2, content_qa.delivery)', { blocking: ((q.delivery || {}).blocking || []).map(b => b.code), grade: (q.delivery || {}).grade, status: (q.delivery || {}).status });
    before('3299 duplicate targets', ((q.originality || {}).duplicate_targets || []).map(d => d.url));
    before('3299 Blog Package meta description (Fix 1: a field label read as the value)', { value: (bp.article_meta || {}).meta_description, length: (bp.article_meta || {}).meta_description_length });
    before('3299 verdict on the brief', (({ verdict, verdict_score, force_content, pipeline_source, page_role }) => ({ verdict, verdict_score, force_content, pipeline_source, page_role }))(F.nodes['Parse Brief']['0'].items[0].json));
  });

  // ---------- RPL3 the finalize of that page: 3336 replays on the current code ----------
  await guard('RPL3 replay 3336', async () => {
    const SN = 'RPL3 (2026-10-29, PLAN §3.0 step 4) finalize 3336 replays on the current code, the Finalize Editor answer as recorded';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3336.json.gz');
    const order = ['Parse Brief', 'Finalize Apply', 'Finalize Merge', 'Content QA', 'Originality Check', 'Finalize Verdict'];
    for (const node of order) {
      const r = await R.replay(F, node, 0);
      check(node + ' runs on the recorded input and answers one item', r.out.length === 1 && r.first && typeof r.first === 'object', J(r.out).slice(0, 300));
    }
    const wb = F.nodes['Finalize Webhook']['0'].items[0].json;
    check('the webhook body is the app request (old format: no PRC gating fields)', wb.body && wb.body.mode && !('qa_blocking' in wb.body), Object.keys(wb.body || {}).join(','));
    before('3336 request meta (Fix 1)', (wb.body || {}).meta);
    const fv = (await R.replay(F, 'Finalize Verdict', 0)).first;
    const b = fv.body || fv;
    before('3336 final grade / status (Fix 2 / Fix 3)', { grade: b.grade, delivery: b.delivery || b.delivery_status, status: b.status });
  });

  // ---------- RPL4 the page that ranks: 949 through today's Content QA ----------
  // The guide's run context is not stored, so the 3299 run's context is used with the guide's own fields swapped in (keyword, type, role,
  // ladder, its length band 1,800-3,000 from five ranking guides). Every Wave 0 gate must pass on this page: not held, not a duplicate of
  // itself, a grade not below the 3299 service page's.
  await guard('RPL4 ranking guide 949', async () => {
    const SN = 'RPL4 (2026-10-29, owner priority) the published guide that ranks (exec 949) through the current Content QA';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz'); const G = fx('ranking_guide_949.json');
    check('the live guide is a whole page in the draft format', /^Title: .+\nMeta Description: .{70,}\nSlug: is-microsoft-dynamics-365-an-erp-system\n/.test(G.live_markdown) && G.live_words > 3000, G.live_markdown.slice(0, 300));
    const pb = clone(F.nodes['Parse Brief']['0'].items[0].json);
    Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
      ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [],
      length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
    pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
    const rec = F.runs['Content QA'][2];
    const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: G.live_markdown, qa_round: 1 };
    const pf = clone(F.nodes['Page Fix']['2'].items); pf[0].json.output = G.live_markdown;
    const g = await R.replay(F, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pf, 'Promise Candidates': null }, runIndex: 0 });   // W0-C: without this mock Content QA read 3299's own draft through Promise Candidates (PCJ), so the "guide" was 3299's page under the guide's keyword
    const s = await R.replay(F, 'Content QA', 2);
    const qg = g.first.content_qa || {}, qs = s.first.content_qa || {};
    before('949 guide content score / breakdown', { content_score: qg.content_score, breakdown: qg.score_breakdown, words: qg.main_content_words, not_ready_reasons: (qg.not_ready_reasons || []).length });
    before('3299 service page content score (same QA, same context)', { content_score: qs.content_score, breakdown: qs.score_breakdown });
    check('the guide is scored (a number, not withheld)', typeof qg.content_score === 'number', J(qg).slice(0, 300));
    // merge note 3 (2026-10-30): the score above is the guide's own text, not the 3299 draft read through Promise Candidates
    check('the page graded is the guide itself (its word count, not the 3299 draft\'s)', Math.abs((qg.main_content_words || 0) - G.live_words) <= 0.15 * G.live_words && qg.main_content_words !== qs.main_content_words,
      'graded ' + qg.main_content_words + ' words, guide ' + G.live_words + ', 3299 ' + qs.main_content_words);
    check('the guide that ranks does not score below the 3299 service page (owner priority: no gate may down-grade it)', qg.content_score >= qs.content_score,
      'guide ' + qg.content_score + ' vs 3299 ' + qs.content_score);
  });
};
