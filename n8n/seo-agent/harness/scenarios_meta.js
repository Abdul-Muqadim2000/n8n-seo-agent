// S-META1..S-META9 (W0-A, 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 1; R4 D1 / D2 / G22 / G27; REVIEW_CODE H4): the meta
// description is never claim-checked, never emptied by a sentence removal and never misread from the next line; PF.meta rebuilds a broken
// one (field check, then the brief, then the Quick answer), in a page run AND in the final version; a description the pipeline cannot
// repair is a publish error. Acceptance on the anonymised replays of production page run 3299 and its finalize 3336, and the owner's guard
// on the guide that ranks (949): its meta is left exactly as it is, it gets no new blocker and its grade does not fall below 3299's.
// Called from scenarios_v5.js before the report (one line). Fixtures: harness/fixtures (README "PRC contract", scenarios_replay.js).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const note = (label, v) => console.log('   AFTER ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const FX = {};
  const fx = (name) => FX[name] || (FX[name] = name.endsWith('.gz') ? R.load(name) : JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')));
  const pf = async (fn, args) => (await run('PF Kit', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const metaLine = (md) => { const m = String(md || '').match(/^Meta Description:[ \t]*(.*)$/im); return m ? m[1].trim() : null; };
  const setMeta = (md, v) => String(md).replace(/^Meta Description:[ \t]*.*$/im, 'Meta Description: ' + v);
  const BRIEF_META = 'MS 365 ERP explained for UAE firms: pick Business Central or Finance and SCM, check VAT and e-invoicing needs, then book a consultation with Nova&.';
  const LABEL = /^(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords|URL|Page Type)\s*:/i;
  const BAD = /[—–“”…]/;
  const docOf = (r) => { const b = ((r.out[0] || {}).binary || {}).article_html; return b && b.data ? Buffer.from(b.data, 'base64').toString('utf8') : ''; };   // the package's HTML file (head included)

  // ---------- S-META1 the claim check never reads the meta description (acceptance a) ----------
  await guard('S-META1 meta not a claim', async () => {
    const SN = 'S-META1 (W0-A, Fix 1.1 / 1.6) the meta description is not a claim and never a client question: 3299 round 1 replayed, and an Acme call to action';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const r0 = await R.replay(F, 'Content QA', 0);
    const q0 = r0.first.content_qa || {}; const rec0 = r0.recordedFirst.content_qa || {};
    const flagged = (q) => (q.business_promises || []).concat(q.business_claims || []).map(b => String(b.sentence || ''));
    check('production flagged the meta description as a claim (the defect)', flagged(rec0).some(s => s.startsWith('MS 365 ERP explained for UAE firms')), J(flagged(rec0)));
    check('today the meta description is not a claim, and the body claim of that round is still found', !flagged(q0).some(s => s.startsWith('MS 365 ERP explained for UAE firms')) && flagged(q0).some(s => /sector focus is banking/.test(s)), J(flagged(q0)));
    check('the meta line leaves the check as it came in (no [Confirm: ...] around it)', metaLine(r0.first.output) === BRIEF_META, metaLine(r0.first.output));
    // a draft whose meta ends "then book a consultation with Acme."
    const ACME = 'MS 365 ERP explained for UAE firms: pick Business Central or Finance and SCM, check VAT and e-invoicing needs, then book a consultation with Acme.';
    const input = clone(r0.input); input[0].json.output = setMeta(input[0].json.output, ACME);
    const pfi = R.nodeItems(F, 'Page Fix', 0); pfi[0].json.output = input[0].json.output;
    const ra = await R.replay(F, 'Content QA', 0, { input, mocks: { 'Page Fix': pfi, 'Promise Candidates': null } });
    const qa = ra.first.content_qa || {};
    check('"... then book a consultation with Acme." in the meta yields no claim', !flagged(qa).some(s => /Acme/.test(s)), J(flagged(qa)));
    const claims = flagged(qa).map(s => ({ sentence: s, kind: 'process' })).concat([{ sentence: ACME, kind: 'process', where: 'head' }, { sentence: 'Nova& reviews every ERP quote within two days of the request.', kind: 'timeline', where: 'meta' }]);
    const qs = await pf('questions', [{ claims, brief: [], brackets: [], business: 'Acme', final_md: ra.first.output, docs: [], stored: [] }]);
    check('... and no client question: a head statement (where meta / title / head, or a sentence in the head) is never asked', !qs.some(q => /Acme\.|within two days/.test(q.original)) && qs.every(q => 'where' in q), J(qs.map(q => [q.id, q.where, q.original.slice(0, 60)])));
    const qsHead = await pf('questions', [{ claims: [{ sentence: ACME, kind: 'process', where: '' }], brief: [], brackets: [], business: 'Acme', final_md: ra.first.output, docs: [], stored: [] }]);
    check('a claim with no "where" whose sentence stands in the page head is not asked either (state carried from an older round)', qsHead.length === 0, J(qsHead));
    const qsBody = await pf('questions', [{ claims: [{ sentence: 'Nova& keeps a support team on call around the clock.', kind: 'process', where: 's3', section: 'Support' }], brief: [], brackets: [], business: 'Nova&', final_md: '# X\n\nText.\n', docs: [], stored: [] }]);
    check('a body claim is still asked, and says where it stood', qsBody.length === 1 && qsBody[0].where === 's3', J(qsBody));
  });

  // ---------- S-META2 one line is one field; PF.meta rebuilds a broken description (acceptance b) ----------
  await guard('S-META2 meta reader and PF.meta', async () => {
    const SN = 'S-META2 (W0-A, Fix 1.2 / 1.4) "Meta Description:" followed by "Slug: x" reads as empty, and PF.meta writes a 120-155 character description';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const r2 = await R.replay(F, 'Content QA', 2);
    check('production page 3299, final check: the input meta line is empty and the next line is the slug', /^Meta Description:\nSlug: ms-365-erp-uae$/m.test(r2.input[0].json.output) && (r2.recordedFirst.meta || {}).description === 'Slug: ms-365-erp-uae', J(r2.recordedFirst.meta));
    check('Content QA reads the empty field as empty (metaOf(\'Meta Description\') === \'\') and keeps the slug', (r2.first.meta || {}).description === '' && (r2.first.meta || {}).slug === 'ms-365-erp-uae', J(r2.first.meta));
    check('... and says so as a publish error the page pipeline reads (meta_error)', (r2.first.content_qa || {}).meta_error === 'The meta description is missing', (r2.first.content_qa || {}).meta_error);
    const svc = (r2.first.schema_blocks || []).find(b => b.type === 'Service');
    check('the Service schema never carries "Slug: ..." as its description', svc && !/^Slug:/.test(String(svc.json.description || '')), J(svc && svc.json.description));
    const md = r2.input[0].json.output;
    const noBrief = await pf('meta', [md, { keyword: 'ms 365 erp', own_text: '' }]);
    check('PF.meta without a brief: written from the Quick answer, 120-155 characters, with the keyword, one line, no field label', noBrief.how === 'quick_answer' && noBrief.description.length >= 120 && noBrief.description.length <= 155 && /ms 365 erp/i.test(noBrief.description) && !LABEL.test(noBrief.description) && !/\n/.test(noBrief.description) && !BAD.test(noBrief.description),
      J({ how: noBrief.how, d: noBrief.description, n: noBrief.description.length }));
    check('... in the page: the meta line carries it and the slug line is untouched', metaLine(noBrief.md) === noBrief.description && /^Slug: ms-365-erp-uae$/m.test(noBrief.md) && noBrief.problem === '', noBrief.md.split('\n').slice(0, 4).join(' | '));
    note('3299 description written from the Quick answer', noBrief.description);
    const withBrief = await pf('meta', [md, { keyword: 'ms 365 erp', own_text: '', brief_meta: BRIEF_META }]);
    check('PF.meta with the brief\'s description (it passes the field check): the brief\'s words, unchanged', withBrief.how === 'brief' && withBrief.description === BRIEF_META, J(withBrief));
    const again = await pf('meta', [withBrief.md, { keyword: 'ms 365 erp', own_text: '', brief_meta: BRIEF_META }]);
    check('PF.meta is idempotent: a description that passes is left exactly as it is', again.how === 'kept' && again.md === withBrief.md && again.fixes.length === 0, J(again.fixes));
    const label = await pf('meta', [setMeta(md, 'Slug: ms-365-erp-uae'), { keyword: 'ms 365 erp', own_text: '' }]);
    check('a description that IS a field label ("Slug: ...", the 3336 request) is rebuilt', label.how === 'quick_answer' && !LABEL.test(label.description) && label.description.length >= 120, J(label));
    const missingLine = await pf('meta', [md.replace(/^Meta Description:.*\n/m, ''), { keyword: 'ms 365 erp', own_text: '' }]);
    check('a page with no meta description line gets one, right under the title', /^Title: .+\nMeta Description: .{120,155}\nSlug: /m.test(missingLine.md), missingLine.md.split('\n').slice(0, 4).join(' | '));
    // the two copies of the field rule agree (PF.metaProblem in the page pipeline, Content QA's in the quality check)
    const CASES = ['', 'Slug: x', 'A short guide.', 'x'.repeat(69), 'MS 365 ERP explained: which Dynamics 365 product fits a UAE company and what to check before you sign a contract.', 'y'.repeat(156), 'MS 365 ERP [Confirm: explained] for UAE companies that want to choose between the two Dynamics 365 ERP products.'];
    const qaProblem = []; const pfProblem = [];
    for (const c of CASES) { const input = clone(r2.input); input[0].json.output = setMeta(input[0].json.output, c);
      const pfi = R.nodeItems(F, 'Page Fix', 2); pfi[0].json.output = input[0].json.output;
      const q = (await R.replay(F, 'Content QA', 2, { input, mocks: { 'Page Fix': pfi, 'Promise Candidates': null } })).first.content_qa || {};
      qaProblem.push(!!q.meta_error); pfProblem.push(!!(await pf('metaProblem', [c]))); }
    check('Content QA\'s field rule and PF.metaProblem agree on every case (missing, a label, short, 69 / 156 characters, a bracket, a good one)', J(qaProblem) === J(pfProblem) && J(pfProblem) === J([true, true, true, true, false, true, true]), J({ qaProblem, pfProblem }));
  });

  // ---------- S-META3 the package, the HTML head and the WordPress draft (acceptance c) ----------
  await guard('S-META3 package readers', async () => {
    const SN = 'S-META3 (W0-A, Fix 1.2, R4 G27) Blog Package and Build WP Draft read each field on its own line: the slug is kept, no description starts with "Slug:"';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const bp = await R.replay(F, 'Blog Package', 0);
    const am = bp.first.article_meta || {}; const ram = bp.recordedFirst.article_meta || {};
    check('production: the package carried "Slug: ms-365-erp-uae" as its description (the defect)', /^Slug:/.test(String(ram.meta_description)), J(ram.meta_description));
    check('today: the slug is the slug and the description is not "Slug: ..."', am.slug === 'ms-365-erp-uae' && !/^Slug:/i.test(String(am.meta_description || '')), J({ slug: am.slug, d: am.meta_description }));
    const doc = docOf(bp);
    check('... nor in the HTML head or Open Graph (the schema comes from Content QA: S-META2 / S-META7)', doc.length > 500 && /<head>/.test(doc) && !/content="Slug:/i.test(doc) && !/^Slug:/.test(String((am.open_graph || {})['og:description'] || '')), (doc.match(/<meta name="description"[^>]*>/) || ['(no description tag)'])[0]);
    const md = R.nodeItems(F, 'Page Fix', 2)[0].json.output;
    const wp = (await run('Build WP Draft', [{ json: { keyword: 'ms 365 erp', page_markdown: md, wordpress_url: 'https://www.novaand.example/', schema_blocks: [] } }]))[0].json;
    check('Build WP Draft: slug x kept, the excerpt and the SEO plugins\' description are not "Slug: ..."', wp.wp_payload.slug === 'ms-365-erp-uae' && !/^Slug:/i.test(wp.wp_payload.excerpt) && !/^Slug:/i.test(wp.wp_payload.meta._yoast_wpseo_metadesc), J({ slug: wp.wp_payload.slug, ex: wp.wp_payload.excerpt }));
    const wp2 = (await run('Build WP Draft', [{ json: { keyword: 'ms 365 erp', page_markdown: setMeta(md, 'Slug: ms-365-erp-uae'), wordpress_url: 'https://www.novaand.example/', schema_blocks: [] } }]))[0].json;
    check('... and a description that is a field label on its own line is never used as one', wp2.wp_payload.excerpt === '', J(wp2.wp_payload.excerpt));
  });

  // ---------- S-META4 a sentence removal never edits a meta line ----------
  await guard('S-META4 removals skip meta lines', async () => {
    const SN = 'S-META4 (W0-A, Fix 1.3) removeAt and both neutralSentence paths (call to action, reworded) never touch a meta line; a review mark in the head is unwrapped';
    reset(); begin(SN); const check = mkCheck(SN);
    const S1 = 'Book a consultation with [Nova&](https://www.novaand.example/contact) and get a plan for your ERP project.';
    const page = 'Title: ERP partner in the UAE | Nova&\nMeta Description: ' + S1 + '\nSlug: erp-partner-uae\n\n# ERP partner in the UAE\n\nIntro sentence about ERP partners in the UAE. ' + S1 + '\n';
    const at = page.indexOf(S1);
    check('removeAt on a meta line changes nothing', (await pf('removeAt', [page, at, S1.length])) === page);
    const cta = await pf('neutralSentence', [page, S1, 'novaand.example', null]);
    check('neutralSentence (call-to-action path) finds the sentence in the meta first and leaves it: not done, page unchanged', cta.done === false && cta.md === page, J(cta));
    const rw = await pf('neutralSentence', [page.replace(S1 + '\n', S1.replace(/\[([^\]]+)\]\([^)]+\)/, '$1') + '\n'), S1.replace(/\[([^\]]+)\]\([^)]+\)/, '$1'), 'novaand.example', { action: 'reword', neutral: 'A good partner starts with a plan for your ERP project.' }]);
    check('neutralSentence (reworded path) leaves a meta line alone too', rw.done === false, J(rw));
    const body = 'Title: ERP partner in the UAE\nMeta Description: Short.\n\n# ERP partner in the UAE\n\nIntro text. ' + S1 + '\n';
    const cb = await pf('neutralSentence', [body, S1, 'novaand.example', null]);
    check('... while the same sentence in the body is still rewritten (call to action keeps its link)', cb.done === true && cb.how === 'cta' && /Next step: \[Nova&\]/.test(cb.md) && /^Meta Description: Short\.$/m.test(cb.md), J(cb));
    const marked = 'Title: ERP partner [Confirm: in the UAE] | Nova&\nMeta Description: [Confirm: Nova& has run 40 ERP projects in the UAE, so book a consultation with our team to plan your ERP project, its data move and its training.]\nSlug: erp-partner-uae\n\n# ERP partner in the UAE\n\n**Quick answer:** An ERP partner in the UAE should know VAT, e-invoicing and Arabic reporting, and show you how they will move your data and train your team.\n\nMore text about choosing an ERP partner in the UAE.\n';
    const fx1 = await pf('fix', [marked, { keyword: 'erp partner uae', own_text: '' }]);
    const d = metaLine(fx1.md);
    check('PF.fix: no bracket is left in the head, nothing is "removed" from it, the meta line is never emptied', !/\[/.test(fx1.md.split('\n').slice(0, 3).join('\n')) && !fx1.removed.length && d && d.length >= 70, J({ d, removed: fx1.removed, head: fx1.md.split('\n').slice(0, 3) }));
    note('a marked head after PF.fix', d);
    check('... and the unsupported number in it ("40 ERP projects", on file nowhere) is dropped by the field check, the rest kept', !/40/.test(d) && /book a consultation/i.test(d), d);
  });

  // ---------- S-META5 the narrow field check ----------
  await guard('S-META5 field check', async () => {
    const SN = 'S-META5 (W0-A, Fix 1.1) the narrow field check: a price, a guarantee, a timeline or a number nothing on file and nothing on the page states is dropped; the rest of the description is kept';
    reset(); begin(SN); const check = mkCheck(SN);
    const D = 'Compare Dynamics 365 ERP options for UAE firms, get a free consultation and go live in 6 weeks with a money-back guarantee.';
    const none = await pf('fieldCheck', [D, 'Dynamics 365 ERP options for UAE firms.']);
    check('nothing on file: the free consultation, the 6 weeks and the guarantee clauses go, the advice stays', none.text === 'Compare Dynamics 365 ERP options for UAE firms.' && none.dropped.length === 2 && none.dropped.some(x => /free consultation/.test(x)) && none.dropped.some(x => /6 weeks/.test(x) && /guarantee/.test(x)), J(none));
    const onFile = await pf('fieldCheck', [D, 'Dynamics 365 ERP options. We offer a free consultation. Projects go live in 6 weeks. A money-back guarantee applies.']);
    check('everything on file: the description is kept word for word', onFile.text === D && !onFile.dropped.length, J(onFile));
    const priceWorld = await pf('fieldCheck', ['Business Central costs from USD 70 per user a month in the UAE: what the licence includes and what it does not.', 'Business Central Essentials is listed at USD 70 per user a month (Microsoft price list).']);
    check('a price the page itself states (a sourced fact about a product) is kept', !priceWorld.dropped.length, J(priceWorld));
    const year = await pf('fieldCheck', ['UAE e-invoicing in 2026: who joins first and what finance teams should prepare before the first reporting month.', 'The mandate starts in 2026 for the first wave.']);
    check('a year the page states is kept', !year.dropped.length, J(year));
  });

  // ---------- S-META6 the owner's guard: the guide that ranks (949) ----------
  await guard('S-META6 ranking guide 949 untouched', async () => {
    const SN = 'S-META6 (W0-A, owner priority 2026-10-29) the guide that ranks (949): its meta description is left exactly as it is, no meta blocker, its grade not below the 3299 service page';
    reset(); begin(SN); const check = mkCheck(SN);
    const G = fx('ranking_guide_949.json'); const F = fx('replay_3299.json.gz');
    const ctxG = await pf('ctxOf', [{ ...clone(G.brief), keyword: G.keyword }]);
    const before = metaLine(G.live_markdown);
    const m = await pf('meta', [G.live_markdown, ctxG]);
    check('PF.meta keeps the guide\'s description: how "kept", the page byte for byte', m.how === 'kept' && m.md === G.live_markdown && m.description === before && m.problem === '', J({ how: m.how, fixes: m.fixes }));
    const fixed = await pf('fix', [G.live_markdown, ctxG]);
    check('PF.fix leaves the guide\'s meta description line exactly as it is', metaLine(fixed.md) === before && !fixed.fixes.some(f => /meta description/i.test(f)), J(fixed.fixes));
    // the guide through today's Content QA in the 3299 context (as RPL4), then the page pipeline's one rule
    const pb = clone(F.nodes['Parse Brief']['0'].items[0].json);
    Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
      ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [],
      length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
    pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
    const rec = F.runs['Content QA'][2];
    const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: G.live_markdown, qa_round: 1 };
    const pfi = clone(F.nodes['Page Fix']['2'].items); pfi[0].json.output = G.live_markdown;
    const g = await R.replay(F, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pfi, 'Promise Candidates': null }, runIndex: 0 });
    const qg = g.first.content_qa || {};
    check('Content QA: the guide\'s meta passes the field rule (no meta_error) and the structure points keep the meta check', qg.meta_error === '' && (g.first.meta || {}).description === before, J({ e: qg.meta_error, d: (g.first.meta || {}).description }));
    const cls = await pf('classify', [qg, g.first.output, ctxG]);
    check('PF.classify adds no meta blocker to the guide', !cls.blocking.some(b => b.code === 'meta'), J(cls.blocking.map(b => b.code)));
    const s = await R.replay(F, 'Content QA', 2, { mocks: { 'Promise Candidates': null } });
    check('the guide does not grade below the 3299 service page in the same check', qg.content_score >= (s.first.content_qa || {}).content_score, qg.content_score + ' vs ' + (s.first.content_qa || {}).content_score);
    note('949 guide content score / structure', { content_score: qg.content_score, structure: (qg.score_breakdown || {}).structure });
  });

  // ---------- S-META7 the 3299 chain: Page Fix -> Content QA -> Originality Check -> Page Candidates -> Blog Package (acceptance d, e) ----------
  await guard('S-META7 replay 3299 chain', async () => {
    const SN = 'S-META7 (W0-A, Fix 1 acceptance d / e) page run 3299 replayed through the chain on today\'s code: a 120-155 character meta description reaches the package and the schema, and no meta question';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const pfx = await R.replay(F, 'Page Fix', 2);
    check('Page Fix (final round) rebuilds the emptied meta description from the brief', metaLine(pfx.first.output) === BRIEF_META && /^Slug: ms-365-erp-uae$/m.test(pfx.first.output), metaLine(pfx.first.output));
    const pfItems = [{ json: pfx.first }];
    const qa = await R.replay(F, 'Content QA', 2, { input: pfItems, mocks: { 'Page Fix': pfItems, 'Promise Candidates': null } });
    const q = qa.first.content_qa || {};
    check('Content QA reads it: description = the brief\'s, meta_description_length 120-155, no meta_error', (qa.first.meta || {}).description === BRIEF_META && q.meta_description_length >= 120 && q.meta_description_length <= 155 && q.meta_error === '', J({ d: (qa.first.meta || {}).description, n: q.meta_description_length, e: q.meta_error }));
    const svc = (qa.first.schema_blocks || []).find(b => b.type === 'Service');
    check('the Service schema description equals the meta description (acceptance d)', svc && svc.json.description === BRIEF_META, J(svc && svc.json.description));
    const oc = await R.replay(F, 'Originality Check', 2, { input: qa.out });
    const pc = await R.replay(F, 'Page Candidates', 2, { input: oc.out, mocks: { 'Page Fix': pfItems } });
    const cq = pc.first.content_qa || {};
    check('Page Candidates keeps the description in the delivered page', metaLine(pc.first.output) === BRIEF_META, metaLine(pc.first.output));
    const qs = cq.client_questions || [];
    check('no client question about the meta description (production asked it as q4)', !qs.some(x => /MS 365 ERP explained for UAE firms/.test(String(x.original || ''))) && ((pc.recordedFirst.content_qa || {}).client_questions || []).some(x => /MS 365 ERP explained for UAE firms/.test(String(x.original || ''))),
      J(qs.map(x => [x.id, x.where, String(x.original).slice(0, 50)])));
    check('every question says where its sentence stood', qs.every(x => 'where' in x), J(qs.map(x => x.where)));
    check('no meta blocker in the delivered status', !((cq.delivery || {}).blocking || []).some(b => b.code === 'meta'), J(((cq.delivery || {}).blocking || []).map(b => b.code)));
    const bin = clone(F.runs['Blog Package'][0].input); bin[0].json.page_markdown = pc.first.output; bin[0].json.schema_blocks = qa.first.schema_blocks;
    const bp = await R.replay(F, 'Blog Package', 0, { input: bin });
    const am = bp.first.article_meta || {};
    check('Blog Package: meta_description_length 120-155, the slug kept (acceptance e)', am.meta_description === BRIEF_META && am.meta_description_length >= 120 && am.meta_description_length <= 155 && am.slug === 'ms-365-erp-uae', J({ d: am.meta_description, n: am.meta_description_length, slug: am.slug }));
    const doc = docOf(bp);
    check('... in the HTML head and Open Graph too', doc.includes('<meta name="description" content="' + BRIEF_META.replace(/&/g, '&amp;') + '">') && (am.open_graph || {})['og:description'] === BRIEF_META, (doc.match(/<meta name="description"[^>]*>/) || ['']).join(' ') + ' | ' + J(am.open_graph));
    note('3299 chain', { meta: am.meta_description_length, questions: qs.length, blocking: ((cq.delivery || {}).blocking || []).map(b => b.code), content_score: cq.content_score });
  });

  // ---------- S-META8 the finalize of that page (acceptance f) ----------
  await guard('S-META8 replay 3336 finalize', async () => {
    const SN = 'S-META8 (W0-A, Fix 1 acceptance f, REVIEW_CODE H4) finalize 3336 from the app\'s request (meta "Slug: ms-365-erp-uae"): a rebuilt description comes back and the meta never blocks';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3336.json.gz');
    const wb = F.nodes['Finalize Webhook']['0'].items[0].json;
    check('the request the app sent carries the broken description', (wb.body.meta || {}).meta_description === 'Slug: ms-365-erp-uae', J(wb.body.meta));
    const pb = await R.replay(F, 'Parse Brief', 0);
    const mf = ((pb.first.finalize || {}).meta_fix) || {};
    check('Parse Brief runs PF.meta once the head is built: written from the Quick answer, 120-155 characters', mf.how === 'quick_answer' && metaLine(pb.first.output) === mf.description && mf.description.length >= 120 && mf.description.length <= 155 && !LABEL.test(mf.description), J(mf));
    note('3336 description written in the final version', mf.description);
    const P = [{ json: pb.first }];
    const ap = await R.replay(F, 'Finalize Apply', 0, { input: P, mocks: { 'Parse Brief': P } });
    const mg = await R.replay(F, 'Finalize Merge', 0, { input: ap.out, mocks: { 'Finalize Apply': ap.out } });
    const qa = await R.replay(F, 'Content QA', 0, { input: mg.out, mocks: { 'Parse Brief': P } });
    check('the final check reads the rebuilt description (no meta_error)', (qa.first.content_qa || {}).meta_error === '' && (qa.first.meta || {}).description === mf.description, J({ e: (qa.first.content_qa || {}).meta_error, d: (qa.first.meta || {}).description }));
    const oc = await R.replay(F, 'Originality Check', 0, { input: qa.out });
    const fv = await R.replay(F, 'Finalize Verdict', 0, { input: oc.out, mocks: { 'Parse Brief': P, 'Finalize Apply': ap.out, 'Finalize Merge': mg.out } });
    const b = fv.first.body || {};
    check('the answer returns the rebuilt description (body.meta) and its title and slug', (b.meta || {}).meta_description === mf.description && (b.meta || {}).slug === 'ms-365-erp-uae' && !!(b.meta || {}).title, J(b.meta));
    check('the meta is not a blocker of the final version', !((b.delivery || {}).blocking || []).some(x => x.code === 'meta'), J(((b.delivery || {}).blocking || []).map(x => x.code)));
    check('the Markdown it returns has no meta lines (the app sent none)', !/^(Title|Meta Description|Slug):/m.test(String(b.markdown || '')), String(b.markdown || '').slice(0, 200));
    const bad = clone(wb); bad.body.meta = { ...bad.body.meta, meta_description: '' }; bad.body.markdown = bad.body.markdown.replace(/^\*\*Quick answer:\*\*.*$/m, '');
    const pb2 = await R.replay(F, 'Parse Brief', 0, { input: [{ json: bad }] });
    note('3336 description from the introduction', ((pb2.first.finalize || {}).meta_fix || {}).description);
    check('no description sent and no Quick answer: written from the introduction', ((pb2.first.finalize || {}).meta_fix || {}).how === 'introduction' && !((pb2.first.finalize || {}).meta_fix || {}).problem, J((pb2.first.finalize || {}).meta_fix));
  });

  // ---------- S-META9 a description the pipeline cannot repair is a publish error ----------
  await guard('S-META9 meta publish error', async () => {
    const SN = 'S-META9 (W0-A, Fix 1.5, R4 G22) a meta description Page Fix could not repair blocks (hard), with a plain next step; a good one adds nothing';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = 'Title: X\nMeta Description: Short.\nSlug: x\n\n# X\n\nText.\n';
    const bad = await pf('classify', [{ meta_error: 'The meta description is under 70 characters', warnings: [] }, md, {}]);
    const m = bad.blocking.find(x => x.code === 'meta');
    check('meta_error -> a hard blocker "meta", not a 0.25 advisory', m && m.tier === 'hard' && /could not be written from the brief or the Quick answer/.test(m.text) && bad.hard >= 1, J(bad.blocking));
    const del = await pf('deliver', [bad, { questions: [] }]);
    check('the delivered status is not ready, with the action in plain words', del.status === 'not_ready' && /meta description of 120 to 155 characters/.test(del.next_step) && !/[—–“”…]/.test(del.next_step + del.label), J(del));
    const good = await pf('classify', [{ meta_error: '', warnings: [] }, md, {}]);
    check('no meta_error: no meta blocker', !good.blocking.some(x => x.code === 'meta'), J(good.blocking));
  });
};
