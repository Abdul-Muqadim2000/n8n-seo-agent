// EQA1-EQA7 (2026-10-21, engine fixer E-QA): the paid pre-launch run wrote one ladder page for techand.ai ("ai consultant", exec 42) and
// its quality check gave the client wrong advice. Replayed from harness/fixtures_eqa_42.json.gz (exec 42's own node data: the competitor
// pages read, the Parse Brief item, the Editor's round-2 draft, the Build Word File item, the Blog Package's article; secrets, callback
// and billing fields scrubbed). Every check runs the GENERATED code (harness/code_v4) and fails on the code before the fix:
//   EQA1 D5 / RV-9: usaii.org's certification course is not a service page; a page nothing classifies is not one either; the course's
//        sales headings are never subtopics; with no service page readable, the comparison is said to be impossible (bell-integration.com
//        blocked by a CAPTCHA) and no subtopic is asked of the page.
//   EQA2 Content QA round 2 of exec 42, on the plan stored before the fix: no "Program Fee" / "Alumni Speak" demand, each heading dropped with
//        its reason; the page is not ready only for its two brackets, each named with what to do (the fee band: delete, no price facts);
//        the next step is an edit by hand and never a re-run; one URL in the site's own form; Person + WebPage schema for the service page;
//        the ladder's other keywords off the secondary keywords; no em dash, "..." character or arrow in the text the client reads.
//   EQA3 the placeholder gate: brackets alone keep a page "not ready" even when the copy passed (round 1 included), a page with none passes.
//   EQA4 Brief Context drops the verdict's skipped topics from the subtopics before the brief reads them, and sets the compact author line.
//   EQA5 Blog Package: the compact expert line, og:image height = the hero's, one secondary-keyword list, no false "already link to it".
//   EQA6 Image Cards / Attach Images: no "..." cut, the H3 phases as the card's points, alt text from what the card shows (HTML + Markdown).
//   EQA7 Ladder Plan: planned URLs follow the site's own trailing-slash form.
// Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  // the owner's copy rule (2026-10-19): no em dash, no en dash, no "…" character and no arrow in what the client reads
  const TELL = /[—–…→]/;
  const tells = (list) => list.filter(Boolean).map(String).filter(t => TELL.test(t));
  const COURSE = /Program Fee|Alumni Speak|self-study kit|Program Eligibility|Program Curriculum|Ready for your Next Step/i;
  const KW = 'ai consultant';
  const comp = (d) => FX.collect_facts.competitors.find(c => c.domain === d);
  const SITE_MODEL = { site_model: { ...(FX.parse_brief.site_model || {}), domain: 'techand.ai', canonical_host: 'www.techand.ai' } };

  await guard('EQA1 D5 a course page is not the service page to beat', async () => {
    const SN = 'EQA1 D5 / RV-9 — exec 42: usaii.org\'s certification course was "the best service page"; its fee and alumni headings became subtopics';
    reset(); begin(SN); const check = mkCheck(SN);
    const { CVG } = kits('Parse_Analysis.js', ['CVG']);
    const kinds = Object.fromEntries(FX.collect_facts.competitors.map(c => [c.domain, CVG.kindOf(c, KW)]));
    console.log('   kinds ->', J(kinds));
    check('kind: usaii.org "Certified Artificial Intelligence Consultant | CAIC" is a course page (other), not a service page', kinds['usaii.org'] === 'other', J(kinds));
    check('kind: iaaic.org (an association\'s member directory) is other, never a service page by default', kinds['iaaic.org'] === 'other', J(kinds));
    check('kind: consultancy-me.com\'s ranking is a list, opsiocloud.com\'s explainer a guide', kinds['consultancy-me.com'] === 'list' && kinds['opsiocloud.com'] === 'guide', J(kinds));
    check('kind: the keyword\'s own word is not the evidence ("Consultant" in the title) but an offer in the title still is',
      CVG.kindOf({ title: 'AI Consultant | Acme', url: 'https://acme.example/ai-consultant' }, KW) === 'service'   // CT-FIX (review item 3): a page whose title names the search itself is a service page; was 'unknown', which left real service pages with nothing of their kind to beat
      && CVG.kindOf({ title: 'Certified Artificial Intelligence Consultant | CAIC(TM)', url: 'https://www.usaii.org/ai-certifications/caic' }, KW) !== 'service'
      && CVG.kindOf({ title: 'AI Consulting Services | ATI Lab', url: 'https://atilab.example/ai' }, 'ai consulting') === 'service'
      && CVG.kindOf({ title: 'AI Consultant Services in Dubai | Kinetic', url: 'https://kinetic.example/ai' }, KW) === 'service',
      J([CVG.kindOf({ title: 'AI Consultant | Acme', url: 'https://acme.example/ai-consultant' }, KW), CVG.kindOf({ title: 'AI Consulting Services | ATI Lab', url: 'https://atilab.example/ai' }, 'ai consulting')]));
    check('kind: a search for the course itself is not refused for being one ("ai consultant certification")', CVG.kindOf(comp('usaii.org'), 'ai consultant certification') !== 'other', CVG.kindOf(comp('usaii.org'), 'ai consultant certification'));
    const promo = ['Program Fee: US $894 (All Inclusive)', 'Alumni Speak', 'Get your latest self-study kit worth up to US $794 FREE that includes', 'Program Eligibility', 'Program Curriculum', 'Ready for your Next Step?', 'Am I eligible for Speedster discount?'];
    check('sales headings are never subtopics: fee, price, FREE, alumni, eligibility, curriculum, "ready for your next step"', promo.every(h => CVG.isPromo(h, 'other')), J(promo.filter(h => !CVG.isPromo(h, 'other'))));   // CT-FIX (review item 5): the course's sales words count on the course page (kind other)
    check('topical headings stay subtopics', ['How to choose an AI consultant', 'What skills define a strong AI consultant?', 'Free zones and data residency in the UAE'].every(h => !CVG.isPromo(h)), 'a topic was taken for promotion');
    mock('Collect Facts', [{ json: clone(FX.collect_facts) }]);
    const T = (await run('Parse Analysis', [{ json: { output: { recommended_word_count: 1800 } } }]))[0].json;
    const C = T.coverage_target;
    console.log('   coverage_target ->', J({ best: C && C.best, match: C && C.type_match, subs: C && C.subtopics, basis: C && C.basis }));
    check('exec 42: the page to beat is not usaii.org, and no page of another kind passes as a service page (type_match false)', C && C.best.domain !== 'usaii.org' && C.type_match === false, J(C && C.best));
    check('exec 42: no subtopic is asked of the page (none came from a service page), and none is a course heading', C && Array.isArray(C.subtopics) && C.subtopics.length === 0 && !COURSE.test(T.coverage_digest), J({ subs: C && C.subtopics, digest: T.coverage_digest }));
    check('exec 42: the basis says the comparison with a service page was not possible and names the result that could not be read (bell-integration.com, CAPTCHA)',
      /comparison with a page of the same kind was not possible/.test(C.basis) && /bell-integration\.com \(blocked by captcha/.test(C.basis) && /course, job or directory page\(s\) left out \(usaii\.org/.test(C.basis), C.basis);
    // only a course and a list read: no target at all, said in plain words
    mock('Collect Facts', [{ json: { ...clone(FX.collect_facts), competitors: [comp('usaii.org'), comp('consultancy-me.com')] } }]);
    const T2 = (await run('Parse Analysis', [{ json: { output: { recommended_word_count: 1800 } } }]))[0].json;
    check('only a course page and a list read: no coverage target, and the reason says the comparison was not possible', T2.coverage_target === null && /comparison with a competitor page was not possible/.test(T2.coverage_unavailable) && !COURSE.test(T2.coverage_digest),
      J({ ct: T2.coverage_target, why: T2.coverage_unavailable, digest: T2.coverage_digest }));
    reset();
  });

  // Content QA round 2 of exec 42, on the plan stored before the fix (its coverage_target still names usaii.org and its subtopics)
  const qa42 = async (over, draft, runIndex) => {
    mock('Parse Brief', [{ json: { ...clone(FX.parse_brief), ...(over || {}) } }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: clone(FX.analyze_competitors) } }]);
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    return (await run('Content QA', [{ json: { output: draft == null ? FX.draft_round2 : draft, critique: null } }], { runIndex: runIndex == null ? 1 : runIndex }))[0].json;
  };
  const BANK = '[Tech& banking or public sector reference, to confirm]', FEE = '[Tech& assessment duration and fee band, to confirm]';

  await guard('EQA2 D5 Content QA round 2 of exec 42 gives the right advice', async () => {
    const SN = 'EQA2 — exec 42 round 2: the client was told to add "Program Fee: US $894" and "Alumni Speak", and to "fix it and run it again"';
    reset(); begin(SN); const check = mkCheck(SN);
    const out = await qa42(); const Q = out.content_qa, QL = Q.quality;
    console.log('   label ->', Q.quality_label, '| reasons ->', J(Q.not_ready_reasons), '| next ->', QL.next_step);
    const said = [Q.quality_label, ...(Q.not_ready_reasons || []), ...(Q.warnings || []), QL.next_step, QL.placeholder_note, Q.coverage && Q.coverage.basis, ...(Q.eeat_notes || [])].join(' | ');
    check('no reason, warning or note asks for a course heading (Program Fee, Alumni Speak, self-study kit, Program Eligibility)', !COURSE.test(said) && !(Q.missing_subtopics || []).length, said.slice(0, 900));
    check('the stored plan\'s course headings are dropped with their reason (the page to beat is a course page)',
      (Q.subtopics_dropped || []).some(x => /Program Fee/.test(x.subtopic) && /course, job or directory page/.test(x.reason)), J(Q.subtopics_dropped));
    // E-CLAIM (2026-10-21): the page's promises in Tech&'s name are the second reason (scenarios_claims.js asserts them one by one)
    check('the page is not ready for its two brackets, both named, with "fill in or delete", and for its unsupported promises',
      Q.not_ready === true && Q.passed === false && Q.placeholder_count === 2 && (Q.not_ready_reasons || []).length === 2 && /Confirm each one is true or delete it/.test(Q.not_ready_reasons[1])
      && Q.not_ready_reasons[0].includes(BANK) && Q.not_ready_reasons[0].includes(FEE) && /Fill in or delete each one/.test(Q.not_ready_reasons[0]), J(Q.not_ready_reasons));
    const fee = (QL.owner_edits || []).find(e => e.token === FEE), bank = (QL.owner_edits || []).find(e => e.token === BANK);
    check('each bracket has its edit: the fee band is to be deleted (no price facts on file), the banking reference filled in or deleted',
      fee && fee.action === 'delete' && /no price facts are on file/.test(fee.text) && bank && bank.action === 'fill_or_delete', J(QL.owner_edits));
    check('the next step is an edit by hand and never a paid re-run', /^Finish this draft by hand/.test(QL.next_step) && /You do not need a new run/.test(QL.next_step) && !/run it again/i.test(QL.next_step) && QL.fix_by === 'edit', QL.next_step);
    check('the label reads "did not pass the quality check, so it is not ready to publish"', Q.quality_label === 'did not pass the quality check, so it is not ready to publish', Q.quality_label);
    const tl = tells([Q.quality_label, ...(Q.not_ready_reasons || []), ...(Q.warnings || []), QL.next_step, QL.note, QL.placeholder_note, Q.coverage && Q.coverage.basis, ...(Q.eeat_notes || []), ...(Q.auto_fixes || [])]);
    check('no em dash, en dash, "…" or arrow in the text the client reads (label, reasons, next step, notes, coverage basis, fixes)', !tl.length, J(tl));
    const svc = (out.schema_blocks || []).find(b => b.type === 'Service'), per = (out.schema_blocks || []).find(b => b.type === 'Person'), wp = (out.schema_blocks || []).find(b => b.type === 'WebPage');
    check('one URL in the site\'s own form: techand.ai\'s sitemap writes no trailing slash, so the page is https://www.techand.ai/ai-consultant everywhere', Q.page_url === 'https://www.techand.ai/ai-consultant' && svc && svc.json.url === Q.page_url, J({ page_url: Q.page_url, svc: svc && svc.json.url }));
    check('serviceType is the service\'s name ("AI Consultant"), not the raw keyword', svc && svc.json.serviceType === 'AI Consultant', svc && svc.json.serviceType);
    check('RV-10: the service page names its author in the schema: Person (job title) and WebPage (author, dateModified)',
      per && per.json.name === 'Test Author (Live Run)' && per.json.jobTitle === 'AI and Dynamics 365 Consultant' && wp && wp.json.author && wp.json.author.name === 'Test Author (Live Run)' && /^\d{4}-\d{2}-\d{2}$/.test(wp.json.dateModified), J({ per: per && per.json, wp: wp && wp.json }));
    const sec = (out.output.match(/^Secondary Keywords:.*$/m) || [''])[0];
    check('M1 / M2: the ladder\'s other pages\' keywords are off the secondary keywords (ai consulting, ai consultant dubai, ai consulting firm)',
      /ai consultant uae/.test(sec) && !/(?:^|[:,]\s*)ai consulting(?:,|$)/.test(sec) && !/ai consultant dubai/.test(sec) && !/ai consulting firm/.test(sec), sec);
    reset();
  });

  await guard('EQA3 the placeholder gate', async () => {
    const SN = 'EQA3 — any bracket left in the body keeps the page "not ready to publish" (the app\'s CMS rule refuses it too); none left, it passes';
    reset(); begin(SN); const check = mkCheck(SN);
    // the copy passes (no subtopic left to ask for); only the two brackets are left, in round 1: no editor round can fill them in
    const noSubs = { coverage_target: { ...clone(FX.parse_brief.coverage_target), subtopics: [] } };
    const r1 = (await qa42(noSubs, null, 0)).content_qa;
    console.log('   round 1 ->', J({ passed_copy: r1.passed_copy, passed: r1.passed, not_ready: r1.not_ready, editor: r1.editor_needed, label: r1.quality_label }));
    check('round 1, the copy passed and two brackets are left: not publishable, final at once ("not ready to publish", no editor round)',
      r1.passed_copy === true && r1.passed === false && r1.publishable === false && r1.editor_needed === false && r1.not_ready === true && /not ready to publish/.test(r1.quality_label)
      && /No editing round could change it/.test(r1.quality.note), J({ pc: r1.passed_copy, p: r1.passed, nr: r1.not_ready, note: r1.quality.note }));
    // E-CLAIM (2026-10-21): the page's promises in Tech&'s name nothing on file supports keep it not ready too; they are taken out here
    const PROMISES = ['You receive a prioritised use-case backlog', 'We test a proof of concept', 'You receive a working solution', 'This phase covers adoption tracking', 'You receive a runbook',
      'Admins learn security', 'Makers learn to extend', 'You keep a self-study pack', 'If out-of-the-box Copilot covers', 'We design permissions', 'Sometimes a rule-based Power Platform workflow'];
    const FILL = 'A short review closes each step before the next one starts.';
    const unpromise = (d) => PROMISES.reduce((x, p) => x.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*?[.!?](?=\\s|$)'), FILL), d);
    const filled = unpromise(FX.draft_round2.split(BANK).join('a regional bank').split(FEE).join('a fixed scope')).split('**AI strategy:** candidate use cases ranked by value and risk.').join('**Data foundations:** predictive models and the data platform beneath them.');   // CT-FIX (2026-10-22): a list item under "Enterprise AI work at Tech& falls into four groups:" inherits the lead-in; "candidate use cases ranked by value and risk" is the same unsupported deliverable as the prioritised use-case backlog, so it is taken out too
    // CT-FIX2 (2026-10-22): image captions are read too, and this brief's caption "Each phase ends with defined deliverables and planned knowledge
    // transfer to your team." is a promise nothing on file carries; it is taken out like the body's promises (CTX covers captions)
    const r2 = (await qa42({ ...noSubs, content_brief: { ...clone(FX.parse_brief.content_brief || {}), image_suggestions: ((FX.parse_brief.content_brief || {}).image_suggestions || []).map(im => ({ ...im, caption: '' })) } }, filled, 1)).content_qa;
    console.log('   no brackets ->', J({ passed: r2.passed, brackets: r2.body_brackets, warnings: r2.warnings }));
    check('the same page with its two brackets filled in passes and is publishable', r2.body_brackets === 0 && r2.passed === true && r2.publishable === true && r2.not_ready === false, J({ p: r2.passed, b: r2.body_brackets, w: r2.warnings }));
    const note = FX.draft_round2.split(BANK).join('a regional bank').split(FEE).join('[Confirm: the assessment runs four weeks]');
    const r3 = (await qa42(noSubs, note, 1)).content_qa;
    check('a [Confirm: ...] note left by the writer is an open bracket too: not ready, named, with what to do', r3.passed === false && r3.not_ready === true
      && (r3.quality.owner_edits || []).some(e => /\[Confirm: the assessment runs four weeks\]/.test(e.token)), J({ p: r3.passed, edits: r3.quality.owner_edits, reasons: r3.not_ready_reasons }));
    reset();
  });

  await guard('EQA4 Brief Context drops the skipped topics and sets the author line', async () => {
    const SN = 'EQA4 — the verdict said to skip "AI consultant certification" / "course"; the brief was still asked to cover "Program Eligibility" and "Program Curriculum"';
    reset(); begin(SN); const check = mkCheck(SN);
    const ct = clone(FX.brief_context_coverage_target);
    const base = 'TARGET: use at least 90% of the shared terms above.';
    mock('Load Profile (Brief)', [{ json: { site_id: 'site_techand-ai', author_name: 'Test Author (Live Run)', author_job_title: 'AI and Dynamics 365 Consultant', author_bio: FX.parse_brief.author.bio } }]);
    mock('Parse Verdict', [{ json: { ...clone(FX.parse_brief), coverage_target: ct, coverage_digest_base: base, coverage_digest: base + '\nSUBTOPICS THAT PAGE COVERS (cover each one, in our own structure and words; do not copy its headings):\n- ' + ct.subtopics.join('\n- ') } }]);
    const B = (await run('Brief Context', [{ json: {} }]))[0].json;
    console.log('   subtopics ->', J(B.coverage_target.subtopics), '| excluded ->', J((B.subtopics_excluded || []).slice(0, 2)));
    check('every subtopic of a page to beat that is about an excluded topic is dropped before the brief reads it, with its reason',
      B.coverage_target.subtopics.length === 0 && (B.subtopics_excluded || []).length === ct.subtopics.length && /certification/i.test(B.subtopics_excluded[0].topic) && !COURSE.test(B.coverage_digest), J({ subs: B.coverage_target.subtopics, digest: B.coverage_digest }));
    check('RV-10: a service page with an author on file gets the compact author line (article_like stays false)', B.author_line === 'compact' && B.article_like === false, J({ line: B.author_line, al: B.article_like }));
    reset();
  });

  await guard('EQA5 Blog Package', async () => {
    const SN = 'EQA5 — exec 42\'s package: no byline although the page was held for the author, og:image 630 for a 675 hero, two secondary-keyword lists, a false "already link to it"';
    reset(); begin(SN); const check = mkCheck(SN);
    // exec 42's Build Word File item, with what this build's Content QA says of the same round-2 draft (the fields Build Word File copies)
    const out = await qa42(); const Q = out.content_qa;
    const bw = { ...clone(FX.build_word_file), page_markdown: out.output, ladder_links: clone(FX.ladder_links), qa_page_url: Q.page_url, qa_next_step: Q.quality.next_step, qa_owner_edits: Q.quality.owner_edits,
      qa_label: Q.quality_label, qa_reasons: Q.not_ready_reasons, qa_quality: Q.quality, qa_not_ready: Q.not_ready, qa_publishable: Q.publishable, content_coverage: Q.coverage, schema_blocks: out.schema_blocks, eeat_notes: Q.eeat_notes };
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    const P = (await run('Blog Package', [{ json: bw }]))[0].json; const M = P.article_meta;
    console.log('   byline ->', (P.article_html.match(/<p class="byline[^>]*>.*?<\/p>/) || [''])[0].slice(0, 220));
    check('RV-10: the service page carries the compact expert line (author, job title, Updated date) and no author box',
      /<p class="byline expert-line">Written by Test Author \(Live Run\), AI and Dynamics 365 Consultant · <time datetime="\d{4}-\d{2}-\d{2}">Updated /.test(P.article_html) && !/author-box/.test(P.article_html)
      && /^\*Written by Test Author \(Live Run\)/m.test(P.article_markdown) && M.author && M.author.compact === true && M.author.placeholder === false, J(M.author));
    check('L3: og:image width and height are the hero\'s own (1200 x 675)', M.open_graph['og:image:width'] === 1200 && M.open_graph['og:image:height'] === 675, J(M.open_graph));
    const line = (bw.page_markdown.match(/^Secondary Keywords:\s*(.*)$/m) || [, ''])[1].split(/,\s*/).filter(Boolean);
    check('M2: meta.json lists the secondary keywords the page was written with (the draft\'s own line, the list the PDF / Word print)', J(M.secondary_keywords) === J(line), J({ meta: M.secondary_keywords, draft: line }));
    const pub = (M.publish_checklist || []).find(x => /^Publish it at/.test(x)) || '';
    check('L2 / RV-17: "Publish it at https://www.techand.ai/ai-consultant" and no claim that other pages already link to it (none is published)',
      /^Publish it at https:\/\/www\.techand\.ai\/ai-consultant: /.test(pub) && !/already link to it/.test(pub) && /not published yet/.test(pub) && M.suggested_url === 'https://www.techand.ai/ai-consultant', J({ pub, url: M.suggested_url }));
    const nr = (M.publish_checklist || []).find(x => /did not pass the quality check/.test(x)) || '';
    check('the checklist says what to do with a draft: the edit by hand, not "finish those points" with an em dash', /Finish this draft by hand/.test(nr) && !/DID NOT PASS/.test(nr), nr);
    const tl = tells([...(M.publish_checklist || []), ...(M.quality_notes || []), ...(M.images || []).map(i => i.subject), M.image_notes]);
    check('no em dash, "…" or arrow in the checklist, the quality notes or the image plan', !tl.length, J(tl));
    reset();
  });

  await guard('EQA6 Image cards say what they show', async () => {
    const SN = 'EQA6 — exec 42\'s cards: "Assess & Envision: find the use cases worth funding This phase covers discovery", two points cut with "…", Run & Optimize missing, a title card with a photo\'s alt text';
    reset(); begin(SN); const check = mkCheck(SN);
    const cards = await run('Image Cards', [{ json: clone(FX.image_cards_in) }]);
    const html = (i) => Buffer.from(cards[i].binary.html.data, 'base64').toString('utf8');
    const ph = html(1);
    check('no card is cut with "…"', cards.every((c, i) => !/…/.test(html(i))), 'a card carries …');
    check('the phases card shows the section\'s H3 phases as its points, all three, never run into a sentence',
      /Assess &amp; Envision: find the use cases worth funding</.test(ph) && /Build &amp; Implement/.test(ph) && /Run &amp; Optimize/.test(ph) && !/funding This phase covers/.test(ph), ph.replace(/<style>[\s\S]*?<\/style>/, '').slice(0, 900));
    check('the alt text says what each card shows: the hero is a title card, the phases card names the phases',
      /^Title card: AI Consultant for UAE and GCC Enterprises/.test(cards[0].json.card_alt) && /Run & Optimize/.test(cards[1].json.card_alt), J(cards.map(c => c.json.card_alt)));
    // Attach Images: the article carries the same alt text as meta.json
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    const P = (await run('Blog Package', [{ json: { ...clone(FX.build_word_file), ladder_links: clone(FX.ladder_links) } }]))[0];
    store['Blog Package'] = [P];
    const fake = Buffer.alloc(2048, 7).toString('base64');
    const A = (await run('Attach Images', cards.map(() => ({ json: {}, binary: { image: { data: fake, mimeType: 'image/webp' } } }))))[0];
    const hero = A.json.article_meta.images[0], oldAlt = P.json.article_meta.images[0].alt_text;
    const artHtml = Buffer.from(A.binary.article_html.data, 'base64').toString('utf8');
    check('Attach Images: the hero\'s alt text is the card\'s, the planned photo text is kept as alt_text_for_a_photo, and the article HTML / Markdown carry the new alt',
      /^Title card:/.test(hero.alt_text) && hero.alt_text_for_a_photo === oldAlt && artHtml.includes('alt="' + hero.alt_text.replace(/&/g, '&amp;') + '"') && !artHtml.includes('alt="' + oldAlt + '"')
      && A.json.article_markdown.includes('![' + hero.alt_text.replace(/[\[\]]/g, '') + ']('), J({ alt: hero.alt_text, old: oldAlt }));
    check('no em dash in the image note', !TELL.test(A.json.article_meta.image_notes || ''), A.json.article_meta.image_notes);
    reset();
  });

  await guard('EQA7 Ladder Plan follows the site\'s trailing-slash form', async () => {
    const SN = 'EQA7 RV-17 — every planned URL ended in "/" while techand.ai\'s sitemap writes none and the site 308-redirects the slash away';
    reset(); begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(CD, 'Ladder_Plan.js'), 'utf8');
    const a = src.indexOf('const slashFormLP = (() => {'), b = src.indexOf('const plannedUrl = (kw) =>', a), c = src.indexOf('\n', b);
    check('Ladder Plan carries the slash rule', a > 0 && b > a, 'missing');
    const mk = (urls) => new Function('base', 'homeUrl', 'slug', src.slice(a, c) + '\nreturn plannedUrl;')({ site_urls: urls }, 'https://www.techand.ai/', (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const techand = FX.parse_brief.site_urls;
    check('techand.ai (no slash in its sitemap): https://www.techand.ai/ai-consulting', mk(techand)('ai consulting') === 'https://www.techand.ai/ai-consulting', mk(techand)('ai consulting'));
    check('a WordPress-style sitemap (slashes): the slash is kept', mk(['https://x.example/a/', 'https://x.example/b/', 'https://x.example/c/'])('ai consulting') === 'https://www.techand.ai/ai-consulting/', 'slash dropped');
    check('too few pages to tell: as before, with the slash', mk(['https://x.example/a'])('ai consulting') === 'https://www.techand.ai/ai-consulting/', 'changed');
    reset();
  });
};
