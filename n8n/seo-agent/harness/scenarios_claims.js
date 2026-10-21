// CLM1-CLM4 (E-CLAIM, 2026-10-21): nothing is said about the client's business, offer, process, pricing, guarantees or deliverables
// unless a fact supports it. The paid pre-launch run (exec 42, techand.ai "ai consultant") promised deliverables the client never states
// ("a prioritised use-case backlog, data readiness findings", a proof of concept with "documented test results", "a runbook and monitoring
// dashboards", a training plan and "a self-study pack", "document each decision for your audit team", "we stop there"), and on 2026-10-17
// a page invented the billing terms ("We charge for advice and delivery. Licences sit on a separate line of the quote ..."). Content QA
// flagged none of them. Replayed on exec 42's round-2 draft (harness/fixtures_eqa_42.json.gz) through the GENERATED Content QA.
// Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const SITE_MODEL = { site_model: { ...(FX.parse_brief.site_model || {}), domain: 'techand.ai', canonical_host: 'www.techand.ai' } };
  const BANK = '[Tech& banking or public sector reference, to confirm]', FEE = '[Tech& assessment duration and fee band, to confirm]';
  const noSubs = { coverage_target: { ...clone(FX.parse_brief.coverage_target), subtopics: [] } };
  const qa = async (over, draft) => {
    mock('Parse Brief', [{ json: { ...clone(FX.parse_brief), ...noSubs, ...(over || {}) } }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: clone(FX.analyze_competitors) } }]);
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    return (await run('Content QA', [{ json: { output: draft, critique: null } }], { runIndex: 1 }))[0].json.content_qa;
  };
  const filled = FX.draft_round2.split(BANK).join('a regional bank').split(FEE).join('a fixed scope');
  // the promises the content review (2026-10-21, §1) found in exec 42, as the page says them
  const PROMISES = [
    'You receive a prioritised use-case backlog, data readiness findings and an ROI case for each candidate.',
    'We test a proof of concept against your real data and live integrations.',
    'You receive a working solution, integration with your systems and documented test results.',
    'This phase covers adoption tracking, model monitoring and MLOps, with optional Managed Services and 24/7 support.',
    'You receive a runbook and monitoring dashboards.',
    'Admins learn security and licence management.',
    'Makers learn to extend Copilot Studio and Power Platform solutions, and business users get role-based training.',
    'You keep a self-study pack of documentation, agent playbooks and the runbook.',
    'If out-of-the-box Copilot covers the requirement, we stop there.',
    'We design permissions, labels, logging and human review before any model touches live data, and document each decision for your audit team.',
    'Sometimes a rule-based Power Platform workflow solves the problem more cheaply than AI, and we will tell you so.'];
  // a neutral sentence in place of each promise keeps every section at its length (the length check is not what is tested here)
  const FILL = 'A short review closes each step before the next one starts.';
  // what is true (business facts, profile, the site's own pages) and what is generic: never flagged
  const TRUE = [/^Tech& is a Dubai-based Microsoft partner/, /^Tech& is based at Office 704/, /^We are a Microsoft partner with 20\+ years/, /^We are available Monday to Friday/,
    /^This phase covers discovery, requirements, gap-fit analysis/, /^We then build for production on Dynamics 365/, /^We treat data as a sovereign asset/, /our scope includes cloud and data/,
    /^We work in banking and financial services/];
  const GENERIC = [/^A data scientist analyses data/, /^Answer yes or no/, /^Ask for a fixed-scope readiness assessment/, /^Start with the least custom option/, /^An executive sponsor owns/, /^Each phase ends in a deliverable/];
  const flaggedOf = (Q) => [...(Q.business_promises || []), ...(Q.business_claims || [])].map(b => b.sentence);

  await guard('CLM1 exec 42: the promises in the business\'s name are flagged', async () => {
    const SN = 'CLM1 E-CLAIM: exec 42 promised a backlog, a proof of concept with test results, a runbook and dashboards, a training plan, a self-study pack and audit records; nothing on file says so';
    reset(); begin(SN); const check = mkCheck(SN);
    const Q = await qa(null, filled);
    const F = flaggedOf(Q);
    console.log('   flagged ->', J(F.map(x => x.slice(0, 70))));
    const missed = PROMISES.filter(p => !F.some(f => f === p || f.includes(p.slice(0, 50))));
    check('every promise of the 2026-10-21 content review is flagged (' + PROMISES.length + ')', !missed.length, J(missed));
    const fp = F.filter(f => TRUE.some(re => re.test(f)));
    check('the true facts are not flagged: the DAFZA address, 20+ years, 24/7 support, Microsoft partner, the hours, the phase names and services on file', !fp.length, J(fp));
    const gen = F.filter(f => GENERIC.some(re => re.test(f)));
    check('generic sentences and advice to the reader are not flagged (a data scientist, the checklist, the buyer\'s questions)', !gen.length, J(gen));
    check('nothing beyond the promises is flagged (no false positive on the rest of the page)', F.length <= PROMISES.length + 2, J(F));
    reset();
  });

  await guard('CLM2 exec 42: the page is not ready, with one owner edit per promise', async () => {
    const SN = 'CLM2 E-CLAIM: an unsupported promise keeps the page "not ready to publish" exactly like a bracket, and each one is an edit by hand';
    reset(); begin(SN); const check = mkCheck(SN);
    const Q = await qa(null, filled); const QL = Q.quality;
    const claims = (QL.owner_edits || []).filter(e => e.kind === 'claim');
    console.log('   label ->', Q.quality_label, '| claim edits ->', claims.length, '| reasons ->', J((Q.not_ready_reasons || []).map(r => r.slice(0, 90))));
    check('brackets filled in, promises left: not publishable, "did not pass the quality check, so it is not ready to publish", no editor round asked',
      Q.passed === false && Q.publishable === false && Q.not_ready === true && Q.editor_needed === false && Q.quality_label === 'did not pass the quality check, so it is not ready to publish',
      J({ p: Q.passed, nr: Q.not_ready, ed: Q.editor_needed, label: Q.quality_label, w: Q.warnings }));
    check('one owner edit per promise, each with the sentence and "Confirm it is true or delete it"',
      PROMISES.every(p => claims.some(e => e.sentence && e.sentence.includes(p.slice(0, 50)) && /^Confirm it is true or delete it: "/.test(e.text) && e.action === 'confirm_or_delete')), J(claims.map(e => e.text.slice(0, 120))));
    check('the reasons name the promises and say what to do', (Q.not_ready_reasons || []).some(r => /statement\(s\) about Tech&'s services, process or terms that nothing on file supports/.test(r) && /Confirm each one is true or delete it/.test(r)), J(Q.not_ready_reasons));
    check('the next step is an edit by hand, never a re-run', /^Finish this draft by hand/.test(QL.next_step) && /confirm it is true or delete it/.test(QL.next_step) && !/run it again/i.test(QL.next_step), QL.next_step);
    const tl = [QL.next_step, ...(Q.not_ready_reasons || []), ...claims.map(e => e.text)].filter(t => /[—–…→“”‘’]/.test(t));
    check('no em dash, en dash, "..." character, arrow or curly quote in what the owner reads', !tl.length, J(tl));
    // without the promises the same page passes: nothing else holds it
    const clean = PROMISES.reduce((d, p) => d.split(p).join(FILL), filled).split('**AI strategy:** candidate use cases ranked by value and risk.').join('**Data foundations:** predictive models and the data platform beneath them.');   // CT-FIX (2026-10-22): a list item under "Enterprise AI work at Tech& falls into four groups:" inherits the lead-in; "candidate use cases ranked by value and risk" is the same unsupported deliverable as the prioritised use-case backlog, so it is taken out too
    // CT-FIX2 (2026-10-22): image captions are read too; this brief's caption promise is taken out like the body's (CTX covers captions)
    const Q2 = await qa({ content_brief: { ...clone(FX.parse_brief.content_brief || {}), image_suggestions: ((FX.parse_brief.content_brief || {}).image_suggestions || []).map(im => ({ ...im, caption: '' })) } }, clean);
    check('the same page without the promises passes and is publishable', Q2.passed === true && Q2.not_ready === false && !(Q2.business_promises || []).length, J({ p: Q2.passed, prom: Q2.business_promises, w: Q2.warnings, r: Q2.not_ready_reasons }));
    reset();
  });

  await guard('CLM3 a promise the business states passes', async () => {
    const SN = 'CLM3 E-CLAIM: a supported claim (its key terms in the business facts) is not flagged';
    reset(); begin(SN); const check = mkCheck(SN);
    const facts = FX.parse_brief.business_facts + ' Run & Optimize: Tech& hands over a runbook and monitoring dashboards. Proof of concept: Tech& tests every proof of concept against the client\'s real data and live integrations.';
    const Q = await qa({ business_facts: facts }, filled);
    const F = flaggedOf(Q);
    check('"You receive a runbook and monitoring dashboards." and the proof of concept pass once the business facts say so', !F.some(f => /runbook and monitoring dashboards\.$/.test(f) || /^We test a proof of concept/.test(f)), J(F));
    check('the other promises are still flagged', F.some(f => /self-study pack/.test(f)) && F.some(f => /we stop there/.test(f)), J(F));
    reset();
  });

  await guard('CLM4 2026-10-17: invented billing terms', async () => {
    const SN = 'CLM4 E-CLAIM: "We charge for advice and delivery. Licences sit on a separate line of the quote" (2026-10-17) is flagged, both sentences, and keeps the page not ready';
    reset(); begin(SN); const check = mkCheck(SN);
    const clean = PROMISES.reduce((d, p) => d.split(p).join(FILL), filled);
    const draft = clean.replace('### Red flags to watch for', 'We charge for advice and delivery. Licences sit on a separate line of the quote, you can buy them through any channel. Most firms in the region price discovery work by phase.\n\n### Red flags to watch for');
    const Q = await qa(null, draft);
    const claims = (Q.quality.owner_edits || []).filter(e => e.kind === 'claim');
    console.log('   claim edits ->', J(claims.map(e => e.sentence)));
    check('both billing sentences are owner edits ("confirm it is true or delete it")', ['We charge for advice and delivery.', 'Licences sit on a separate line of the quote'].every(x => claims.some(e => e.sentence.startsWith(x))), J(claims));
    check('a sentence about the market ("Most firms in the region price ...") is not a claim', !claims.some(e => /^Most firms/.test(e.sentence)), J(claims));
    check('the page is not ready to publish', Q.passed === false && Q.not_ready === true, J({ p: Q.passed, nr: Q.not_ready }));
    reset();
  });
};
