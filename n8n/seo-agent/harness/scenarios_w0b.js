// W0B1-W0B9 (page-quality programme 2026-10-29, W0-B: PLAN Fix 2 and §2.10; REVIEW_CODE H2 / M8; owner decision D2; owner priority of
// 2026-10-29). The final version keeps every blocker of the page run, and is judged with the page run's context instead of against itself.
// Tested on the recorded production runs (anonymised fixtures, harness/README.md "Replay fixtures"):
//   * finalize 3336 (the final version of page run 3299, "ms 365 erp") said "Ready" at 100 because the app sent none of the page run's
//     blockers: with the gating fields the app now derives from the ORIGINAL report (3299's stored callback, old format) it is not ready
//     because of the duplicate page, not because something was "not checked"; without them it is never ready;
//   * the grading fields (Build Webhook Response `page_run`, new): missing ones are advice only;
//   * the client's decision on the duplicate (D2): an update of that page (its address and slug) or a recorded reason (the fit limit kept);
//   * the other page-run blockers this check cannot see stay open until they are gone;
//   * the guide that ranks (exec 949) is never held back by any of it.
// The Finalize Editor's answer is the one recorded in production (no model call). Called from scenarios_v5.js before the report.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W0-B ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const F99 = R.load('replay_3299.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const PRCX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prc_example.json'), 'utf8'));
  const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;   // 3299's content callback = the stored ORIGINAL report (old format)
  const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;   // the app's finalize request of 3336 (old format: no page run)
  const EDITOR = F36.nodes['Finalize Editor']['0'].items;               // the Finalize Editor's recorded answer
  const BC = 'https://www.novaand.example/dynamics-365-business-central-uae';
  // the gating fields as the app derives them from a stored content payload (app/shared/src/page-review.ts pageRunOf)
  const gatingOf = (p) => { const m = p.meta || {}; const o = m.originality || {};
    return { qa_blocking: Array.isArray(p.qa_blocking) ? p.qa_blocking : null, duplicate_targets: Array.isArray(o.duplicate_targets) ? o.duplicate_targets : null,
      verdict: p.verdict == null ? null : p.verdict, score: p.score == null ? null : p.score, score_withheld: p.score_withheld === true, page_type: m.page_type || '',
      verdict_acknowledged: p.verdict_acknowledged === true, copied_passages: [], content_request_id: p.request_id || '',
      length_points: (((p.qa_grade || m.grade || {}).breakdown || {}).length ?? null) }; };
  const GRADING = (() => { const g = clone(PRCX.grading); return g; })();
  const chain = async (body, opts = {}) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    if (ap[0].json.needs_editor) mock('Finalize Editor', clone(opts.editor || EDITOR));
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, ap: ap[0].json, qa: qa[0].json.content_qa || {}, body: vd[0].json.body };
  };
  const codes = (list) => (list || []).map(x => x.code);
  const len = (b) => ((b.grade || {}).breakdown || {}).length;

  // ---------- W0B1 the page run hands its context on: Build Webhook Response `page_run` ----------
  await guard('W0B1 page_run in the callback', async () => {
    const SN = 'W0B1 (W0-B, REVIEW_CODE H2) every content callback carries page_run, the grading fields of the page-run context (from Parse Brief and the delivered page\'s final check); a run with no page sends null';
    begin(SN); const check = mkCheck(SN);
    reset();
    mock('Parse Brief', clone(F99.nodes['Parse Brief']['0'].items));
    mock('Page Candidates', clone(F99.runs['Page Candidates'][2].output));
    const d = { request_id: '3298', keyword: 'ms 365 erp', domain: 'novaand.example', verdict: CB.verdict, verdict_score: CB.score, score_withheld: false, article_markdown: CB.markdown,
      article_meta: CB.meta, qa_blocking: CB.qa_blocking, qa_advisory: CB.qa_advisory, run_ledger: { ai_usd: 1, dfs_usd: 0.1 } };
    const cb = (await run('Build Webhook Response', [{ json: d }]))[0].json;
    const pr = cb.page_run || {};
    show('3299 page_run', { length_band: pr.length_band, terms: (pr.terms || []).length, facts: (pr.facts || []).length, sources_cited: (pr.sources_cited || []).length, site_urls: (pr.site_urls || []).length, style: (pr.style_guide || {}).brand_form, reg: (pr.regulatory_facts || []).length, crid: pr.content_request_id });
    check('page_run is there with every grading field of the PRC contract', !!cb.page_run && ['length_band', 'coverage_target', 'terms', 'facts', 'sources_cited', 'style_guide', 'site_urls', 'serp_shapes', 'regulatory_facts', 'content_request_id'].every(k => k in pr), J(Object.keys(pr)));
    check('the length band is the final check\'s (900-2,400, the page-type band 3299 was judged against) and carries the brief\'s target (1,500)', pr.length_band && pr.length_band.low === 900 && pr.length_band.high === 2400 && pr.length_band.source === 'page_type' && pr.length_band.target === 1500, J(pr.length_band));
    check('terms, site URLs and the style guide are the run\'s own (the same as the anonymised PRC example of this run)', J((pr.terms || []).map(t => t.term)) === J(PRCX.grading.terms.map(t => t.term)) && J((pr.site_urls || []).slice(0, PRCX.grading.site_urls.length)) === J(PRCX.grading.site_urls) && pr.site_urls.length === 46 && (pr.style_guide || {}).brand_form === 'Nova&', J({ t: (pr.terms || []).length, u: (pr.site_urls || []).length }));
    check('facts and the cited sources carry their addresses; the coverage target names the page to beat', (pr.facts || []).length >= 5 && pr.facts.every(f => f.url || f.claim) && (pr.sources_cited || []).length >= 1 && pr.sources_cited.every(x => /^https?:/.test(x.url))
      && ((pr.coverage_target || {}).best || {}).domain === 'erpsoftwareblog.com', J({ f: (pr.facts || []).length, s: (pr.sources_cited || []).length }));
    check('content_request_id falls back to the request id (3299 was a form run)', pr.content_request_id === '3298', pr.content_request_id);
    check('the gating fields are where they were (qa_blocking, meta.originality.duplicate_targets, verdict, score, page type)', J(codes(cb.qa_blocking)) === J(['duplicate_page']) && cb.meta.originality.duplicate_targets[0].url === BC && cb.verdict === 'GO_WITH_CHANGES' && cb.score === 42 && cb.meta.page_type === 'Service Page', '');
    check('the callback stays small enough to store (page_run under 60 KB)', J(pr).length < 60000, J(pr).length);
    reset();
    const held = (await run('Build Webhook Response', [{ json: { request_id: 'x', keyword: 'ms 365 erp', verdict: 'GO_WITH_CHANGES', verdict_score: 42 } }]))[0].json;
    check('a run that wrote no page (a hold, a verdict-only run) sends page_run null', held.page_run === null, J(held.page_run));
  });

  // ---------- W0B2 the acceptance pin: 3336 with an OLD-format original report ----------
  let grade3336 = null, grade3336new = null;
  await guard('W0B2 3336 old-format page run', async () => {
    const SN = 'W0B2 (W0-B, PLAN Fix 2 acceptance) finalize 3336 with the page run derived from 3299\'s stored report (old format, no grading fields): not ready because of the duplicate page, not because of "not checked"; length is advice only';
    begin(SN); const check = mkCheck(SN);
    const r = await chain({ ...clone(BODY), page_run: gatingOf(CB) });
    const b = r.body; grade3336 = b.grade;
    show('3336 final (old-format page run)', { status: b.delivery_status, blocking: codes(b.delivery.blocking), grade: b.grade.score, breakdown: b.grade.breakdown, advisory: codes(b.delivery.advisory) });
    check('not ready (production said "ready" at 100)', b.delivery_status === 'not_ready' && b.delivery.status === 'not_ready', b.delivery_status);
    check('because of the page run\'s duplicate page: the first blocking point, naming the website\'s page and the two ways out', b.delivery.blocking[0].code === 'duplicate_page' && b.delivery.blocking[0].text.includes(BC)
      && /update of that page/.test(b.delivery.blocking[0].action) && /how this page differs/.test(b.delivery.blocking[0].action), J(b.delivery.blocking[0]));
    check('not because something was not checked: no not_checked blocker (the gating fields were all there)', !codes(b.delivery.blocking).includes('not_checked') && b.page_run.gating_missing.length === 0, J(b.page_run));
    check('the missing grading fields are advice ("Not checked: ..."), never a block', b.delivery.advisory.filter(a => a.code === 'not_checked').length >= 3 && b.delivery.advisory.some(a => /^Not checked: the length of the pages that rank/.test(a.text)), J(b.delivery.advisory));
    // W0-C (section 159): on the grade kit's scale length carries no points at all (advice only), so neither 15 of 15 against the page itself
    // nor the page run's 7 come back into the number; the page run's band is still what the length advice is measured against
    check('length is advice only, and no longer 15 of 15 against the page itself: no length points in the grade (W0-C), the band from the page run\'s first check', !codes(b.delivery.blocking).includes('length') && len(b) === 0
      && r.pb.prc.length_from === 'first_check', J({ b: b.grade.breakdown, from: r.pb.prc.length_from }));
    const r0 = await chain({ ...clone(BODY), page_run: { ...gatingOf(CB), length_points: null } });
    check('a report with no stored grade either: judged against the usual band for a service page (900-2,400)', r0.pb.prc.length_from === 'page_type' && r0.pb.length_band.low === 900 && r0.pb.length_band.high === 2400 && r0.body.delivery_status === 'not_ready', J(r0.pb.length_band));
    check('the next step says what to do about the duplicate (not "finish it by hand: no new run needed")', /already has a page for this search/.test(b.delivery.next_step) && /rewrite this as an update/.test(b.delivery.next_step) && !/do not need a new run/.test(b.delivery.next_step), b.delivery.next_step);
    check('the grade says what it was measured against', /length as the first check measured it/.test(b.grade.basis), b.grade.basis);
    check('what the client reads is plain (no em dash, curly quote or ellipsis character)', !PLAIN.test(J(b.delivery)), '');
  });

  // ---------- W0B3 no page run at all: never ready ----------
  await guard('W0B3 no page run', async () => {
    const SN = 'W0B3 (W0-B, PLAN Fix 2.3) the request 3336 actually sent (no page run): a missing gating field can never produce Ready';
    begin(SN); const check = mkCheck(SN);
    const b = (await chain(clone(BODY))).body;
    show('3336 final (no page run)', { status: b.delivery_status, blocking: codes(b.delivery.blocking), grade: b.grade.score });
    check('not ready, with the reason in plain words and what to do', b.delivery_status === 'not_ready' && b.delivery.blocking[0].code === 'not_checked' && /could not read what stopped the page in its first check/.test(b.delivery.blocking[0].text)
      && /make the final version again/.test(b.delivery.blocking[0].action), J(b.delivery.blocking[0]));
    check('its next step says to make the final version again from the content list (not "finish it by hand")', /Make the final version again from the page in your content list/.test(b.delivery.next_step) && !/by hand/.test(b.delivery.next_step), b.delivery.next_step);
    const g1 = (await chain({ ...clone(BODY), page_run: { ...gatingOf(CB), qa_blocking: null } })).body;
    check('one blocking gating field missing (qa_blocking) is enough to stop Ready', g1.delivery_status === 'not_ready' && codes(g1.delivery.blocking).includes('not_checked'), J(codes(g1.delivery.blocking)));
    const g2 = (await chain({ ...clone(BODY), page_run: { ...gatingOf(CB), qa_blocking: [], duplicate_targets: [], missing: ['duplicate_targets'] } })).body;
    check('a gating field the app says the stored report lacks (duplicate_targets) is missing too', g2.delivery_status === 'not_ready' && codes(g2.delivery.blocking).includes('not_checked'), J(codes(g2.delivery.blocking)));
  });

  // ---------- W0B4 grading fields missing, nothing blocking: advice, not a block ----------
  await guard('W0B4 grading missing is advice', async () => {
    const SN = 'W0B4 (W0-B, PLAN Fix 2 acceptance) gating fields present with no blocker and no grading field: the final version can be ready, the missing fields are advice "not checked"';
    begin(SN); const check = mkCheck(SN);
    const pr = { ...gatingOf(CB), qa_blocking: [], duplicate_targets: [] };
    const b = (await chain({ ...clone(BODY), page_run: pr })).body;
    show('3336 final (no blocker on file, no grading)', { status: b.delivery_status, blocking: codes(b.delivery.blocking), advisory: codes(b.delivery.advisory), grade: b.grade.score });
    check('not "not ready" because of what was not checked', b.delivery_status !== 'not_ready' && !codes(b.delivery.blocking).includes('not_checked'), J(b.delivery.blocking));
    check('the advice names each field that was not checked', ['length of the pages that rank', 'topic coverage', 'figures against the sources', 'style guide', 'links to your own pages'].every(w => b.delivery.advisory.some(a => a.code === 'not_checked' && a.text.includes(w))), J(b.delivery.advisory.map(a => a.text)));
    check('the grade keeps the fields it could not judge out of its basis', /research was not kept/.test(b.grade.basis), b.grade.basis);
  });

  // ---------- W0B5 / W0B6 / W0B7 a new-format page run, and the client's decision (D2) ----------
  const NEW = () => ({ ...clone(BODY), page_run: { ...gatingOf(CB), ...clone(GRADING) } });
  await guard('W0B5 new-format page run', async () => {
    const SN = 'W0B5 (W0-B) finalize 3336 with the full page-run context (gating + grading, as a page run from W0-B on sends it): judged with the run\'s band, terms and sources; the duplicate still blocks';
    begin(SN); const check = mkCheck(SN);
    const r = await chain(NEW()); const b = r.body; grade3336new = b.grade;
    show('3336 final (full page run)', { status: b.delivery_status, blocking: codes(b.delivery.blocking), grade: b.grade.score, breakdown: b.grade.breakdown, coverage: r.qa.coverage_pct, target: r.qa.coverage_target_pct });
    check('the duplicate page still blocks', b.delivery_status === 'not_ready' && b.delivery.blocking[0].code === 'duplicate_page', J(codes(b.delivery.blocking)));
    check('the run\'s topic terms are measured (the coverage list is the page run\'s, not empty)', (r.qa.term_coverage || []).length >= 20 && r.qa.coverage_target_pct > 0, J({ n: (r.qa.term_coverage || []).length, t: r.qa.coverage_target_pct }));
    check('the run\'s facts, cited sources and style guide are on the check\'s context; no "not checked" advice for them', r.pb.facts.length >= 5 && r.pb.content_brief.evidence_plan.length >= 1 && r.pb.style_guide.brand_form === 'Nova&'
      && !b.delivery.advisory.some(a => a.code === 'not_checked'), J(b.delivery.advisory.filter(a => a.code === 'not_checked')));
    check('the length band is the page run\'s, with a target inside it', r.pb.length_band.low === 900 && r.pb.length_band.high === 2400 && r.pb.content_brief.target_word_count >= 900 && r.pb.content_brief.target_word_count <= 2400, J(r.pb.length_band));
    check('the grade says it was measured against the page run', /against the length band, topic terms and sources of the page run/.test(b.grade.basis), b.grade.basis);
  });

  await guard('W0B6 decision differs', async () => {
    const SN = 'W0B6 (W0-B, owner decision D2) the client says how this page differs: the duplicate blocker is resolved, the reason is recorded and shown, the fit limit is kept';
    begin(SN); const check = mkCheck(SN);
    const reason = 'This page is about the Microsoft 365 apps we license, the other one is about Business Central projects.';
    const b = (await chain({ ...NEW(), duplicate_decision: { choice: 'differs', reason } })).body;
    show('3336 final (differs)', { status: b.delivery_status, blocking: codes(b.delivery.blocking), decision: b.decision, fit: b.grade.fit_cap });
    check('the duplicate no longer blocks', !codes(b.delivery.blocking).includes('duplicate_page') && b.page_run.resolved.includes('duplicate_page'), J(codes(b.delivery.blocking)));
    check('the decision is recorded with the reason and the page it differs from', b.decision && b.decision.choice === 'differs' && b.decision.reason === reason && b.decision.pages.includes(BC), J(b.decision));
    check('and shown first in the advice, saying the two pages can compete and the grade keeps its fit limit', b.delivery.advisory[0].code === 'duplicate_decision' && b.delivery.advisory[0].text.includes(reason) && /compete/.test(b.delivery.advisory[0].text), J(b.delivery.advisory[0]));
    check('the fit limit is kept for the grade kit (W0-C)', b.grade.fit_cap && b.grade.fit_cap.kept === true, J(b.grade.fit_cap));
    const noDup = (await chain({ ...clone(BODY), page_run: { ...gatingOf(CB), qa_blocking: [], duplicate_targets: [] }, duplicate_decision: { choice: 'differs', reason } })).body;
    check('a decision on a page with no duplicate changes nothing (no decision recorded)', noDup.decision === null && !noDup.grade.fit_cap, J({ d: noDup.decision }));
  });

  await guard('W0B7 decision update', async () => {
    const SN = 'W0B7 (W0-B, D2, REVIEW_CODE M8) the client chooses to publish it as an update of the website\'s page: resolved, the final version takes that page\'s address and slug; a wrong address or a short reason is refused';
    begin(SN); const check = mkCheck(SN);
    const b = (await chain({ ...NEW(), duplicate_decision: { choice: 'update', url: BC } })).body;
    check('resolved, recorded, and the meta carries the target address and its slug', !codes(b.delivery.blocking).includes('duplicate_page') && b.decision.choice === 'update' && b.meta.target_url === BC && b.meta.slug === 'dynamics-365-business-central-uae', J({ m: b.meta, d: b.decision }));
    check('the advice says to publish it at that address, not as a new page', /publish it at that address/.test(b.delivery.advisory[0].text), J(b.delivery.advisory[0]));
    const bad = await chain({ ...NEW(), duplicate_decision: { choice: 'update', url: 'https://www.novaand.example/some-other-page' } });
    check('an address the first check did not name is refused (400 with the pages it did name)', bad.bad && /must be one of the pages/.test(bad.bad.error) && bad.bad.error.includes(BC), J(bad.bad && bad.bad.error));
    const shortR = await chain({ ...NEW(), duplicate_decision: { choice: 'differs', reason: 'it is different' } });
    check('a reason under 20 characters is refused', shortR.bad && /20 to 600 characters/.test(shortR.bad.error), J(shortR.bad && shortR.bad.error));
    const badC = await chain({ ...NEW(), duplicate_decision: { choice: 'publish' } });
    check('an unknown choice is refused', badC.bad && /update or differs/.test(badC.bad.error), J(badC.bad && badC.bad.error));
  });

  // ---------- W0B8 the other page-run blockers this check cannot see ----------
  await guard('W0B8 carried blockers', async () => {
    const SN = 'W0B8 (W0-B, R4 D3) the page run\'s blockers this check cannot measure stay open until they are gone (copied passages, a dead link, a left-out section, an unknown blocker, the business name without the style guide); the ones it measures again are not carried';
    begin(SN); const check = mkCheck(SN);
    const md = BODY.markdown;
    const sent = md.split('\n').map(l => l.trim()).find(l => /^[A-Z][^#|*\[]{80,}\.$/.test(l)) || '';
    const passage = sent.split(/\s+/).slice(0, 12).join(' ');
    const link = (md.match(/\]\((https?:\/\/[^)\s]+)\)/) || [])[1] || '';
    const heading = ((md.match(/^##\s+(.+)$/m) || [])[1] || '').trim();
    const pr = (blk, extra) => ({ ...gatingOf(CB), qa_blocking: blk, duplicate_targets: [], ...(extra || {}) });
    const B = (code, text) => ({ code, text, action: 'x' });
    const r1 = (await chain({ ...clone(BODY), page_run: pr([B('copied', 'Part of the text repeats another page word for word (example.com, 31%)')], { copied_passages: [passage] }) })).body;
    check('copied: kept while a passage the first check found is still on the page', !!passage && codes(r1.delivery.blocking).includes('copied') && r1.delivery_status === 'not_ready', J({ passage, b: codes(r1.delivery.blocking) }));
    const r2 = (await chain({ ...clone(BODY), page_run: pr([B('copied', 'Part of the text repeats another page word for word (example.com, 31%)')], { copied_passages: ['this passage was rewritten by the client and is no longer anywhere on the page at all'] }) })).body;
    check('copied: resolved once none of the passages is left', !codes(r2.delivery.blocking).includes('copied') && r2.page_run.resolved.includes('copied'), J(r2.page_run));
    const r3 = (await chain({ ...clone(BODY), page_run: pr([B('copied', 'Part of the text repeats another page word for word')]) })).body;
    check('copied with no passages on file: kept, saying why', codes(r3.delivery.blocking).includes('copied') && /cannot compare with the other page/.test(r3.delivery.blocking.find(x => x.code === 'copied').text), J(r3.delivery.blocking));
    const r4 = (await chain({ ...clone(BODY), page_run: pr([B('dead_link', 'A link to a missing page: ' + link), B('dead_link', 'A link to a missing page: https://gone.example/page')]) })).body;
    check('dead link: kept while the page still links it, resolved when the link is gone', !!link && r4.delivery.blocking.filter(x => x.code === 'dead_link').length === 1 && r4.delivery.blocking.find(x => x.code === 'dead_link').text.includes(link), J(r4.delivery.blocking));
    const r5 = (await chain({ ...clone(BODY), page_run: pr([B('off_topic', 'A section about a topic the verdict said to leave out: "' + heading + '"'), B('off_topic', 'A section about a topic the verdict said to leave out: "A heading that is not there"')]) })).body;
    check('left-out section: kept while its heading is on the page', !!heading && r5.delivery.blocking.filter(x => x.code === 'off_topic').length === 1, J({ heading, b: r5.delivery.blocking }));
    const r6 = (await chain({ ...clone(BODY), page_run: pr([B('something_new', 'A problem a later check found')]) })).body;
    check('a blocker this check does not know is kept (never dropped silently)', codes(r6.delivery.blocking).includes('something_new'), J(codes(r6.delivery.blocking)));
    const r7 = (await chain({ ...clone(BODY), page_run: pr([B('brand', 'The business name is written in a form you do not use (2 places)')]) })).body;
    check('business name without the style guide: kept, saying it is not checked again', codes(r7.delivery.blocking).includes('brand') && /not checked again/.test(r7.delivery.blocking.find(x => x.code === 'brand').text), J(r7.delivery.blocking));
    const r8 = (await chain({ ...clone(BODY), page_run: { ...pr([B('brand', 'The business name is written in a form you do not use (2 places)')]), style_guide: clone(GRADING.style_guide) } })).body;
    check('business name with the style guide: measured again on this version, not carried', r8.page_run.resolved.includes('brand:rechecked') && !r8.page_run.kept_open.includes('brand'), J(r8.page_run));
    const r9 = (await chain({ ...clone(BODY), page_run: pr([B('cut_off', 'The page stops before its end'), B('meta', 'Meta description missing'), B('author_profile', 'The author box needs details'), B('claim', 'A statement')]) })).body;
    check('what this check measures on the page itself (cut off, meta, author box, statements) is not carried: the final check decides', ['cut_off', 'meta', 'author_profile', 'claim'].every(c => r9.page_run.resolved.includes(c + ':rechecked')) && !r9.page_run.kept_open.length, J(r9.page_run));
  });

  // ---------- W0B9 the guide that ranks (owner priority) ----------
  await guard('W0B9 ranking guide 949', async () => {
    const SN = 'W0B9 (owner priority 2026-10-29) the published guide that ranks (exec 949) through the final version: never held back, never its own duplicate, a grade not below the 3299 service page\'s';
    begin(SN); const check = mkCheck(SN);
    const gate = { qa_blocking: [], duplicate_targets: [], verdict: null, score: null, score_withheld: false, page_type: 'Guide', verdict_acknowledged: false, copied_passages: [], content_request_id: 'exec-949' };
    const body = { mode: 'finalize', request_id: 'app-fin-949', domain: 'novaand.example', site_id: 'site_novaand-example', keyword: G.keyword, country: 'United Arab Emirates', page_type: 'Guide',
      markdown: G.live_markdown, delivered_markdown: G.live_markdown, client_edited: false, meta: { title: '', meta_description: '', slug: '', h1: '' }, answers: [],
      business_facts: BODY.business_facts, business_facts_kv: clone(BODY.business_facts_kv), stored_fact_keys: clone(BODY.stored_fact_keys), content_request_id: 'exec-949' };
    // the live capture ends with the page's author box and tag line ("Microsoft Dynamics 365 and AI Consulting Team", "Dynamics 365ERPBusiness
    // Central..."), which the cut-off check reads as a page that stops mid-way; that is Content QA's rule on a live capture (the delivered draft
    // ended on its call to action), not one of W0-B's gates, so the guide is also checked ending on its last complete line
    const lines = G.live_markdown.replace(/\s+$/, '').split('\n'); const tagLine = lines[lines.length - 1];
    let lastOk = lines.length - 1; while (lastOk > 0 && !/[.!?]["')\]*_]*$|\]\([^()\s]*\)$/.test(lines[lastOk].trim())) lastOk--;
    const trimmed = lines.slice(0, lastOk + 1).join('\n') + '\n';
    check('the guide without its author box still ends on its own text (only ' + (lines.length - 1 - lastOk) + ' chrome lines dropped)', lines.length - 1 - lastOk <= 6 && trimmed.split(/\s+/).length > 3000, lines.slice(lastOk + 1).join(' | '));
    const NEWG = { ...gate, length_band: { low: 1800, high: 3000, source: 'ranking_pages', sample: 5, basis: 'five ranking guides', target: 2900 },
      style_guide: clone(GRADING.style_guide), site_urls: clone(GRADING.site_urls), facts: [], terms: [], sources_cited: [] };
    const runs = [['old-format page run (no verdict score, no stored grade)', { ...body, page_run: gate }], ['new-format page run (its own band 1,800-3,000)', { ...body, page_run: NEWG }],
      ['old-format, without the live author box', { ...body, markdown: trimmed, delivered_markdown: trimmed, page_run: gate }], ['new-format, without the live author box', { ...body, markdown: trimmed, delivered_markdown: trimmed, page_run: NEWG }]];
    const bar = Math.max(grade3336 ? grade3336.score : 0, grade3336new ? grade3336new.score : 0);
    for (const [n, req] of runs) {
      const b = (await chain(req)).body;
      show('949 guide final, ' + n, { status: b.delivery_status, blocking: codes(b.delivery.blocking), grade: b.grade.score, breakdown: b.grade.breakdown, kept_open: b.page_run.kept_open, s3336: [grade3336 && grade3336.score, grade3336new && grade3336new.score] });
      check(n + ': no W0-B gate fires (nothing carried, no "not checked" block, never its own duplicate)', b.page_run.kept_open.length === 0 && !codes(b.delivery.blocking).some(c => ['not_checked', 'duplicate_page', 'copied', 'dead_link', 'off_topic'].includes(c)) && !b.decision, J(b.delivery.blocking));
      check(n + ': its grade is not below the 3299 service page\'s final version (' + bar + ')', typeof b.grade.score === 'number' && b.grade.score >= bar, J({ guide: b.grade.score, bar }));
      if (/without the live author box/.test(n)) check(n + ': ready to publish (not held back)', b.delivery_status !== 'not_ready', J(b.delivery.blocking));
      else check(n + ': the only blocking point, if any, is the cut-off check on the live tag line ("' + tagLine.slice(0, 40) + '")', b.delivery.blocking.every(x => x.code === 'cut_off'), J(b.delivery.blocking));
    }
  });
};
