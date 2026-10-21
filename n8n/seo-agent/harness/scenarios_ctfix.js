// CTF1-CTF5 (CT-FIX, 2026-10-22): the content phase-2 fixes of the independent review (scratchpad review/CT_REVIEW.md) on the GENERATED
// code: the claims kit decides by subject (calls to action, guide narration, quotes, worked examples and third parties are not promises;
// contractions, passives, list items under a business lead-in, table rows and Arabic are), numbers are whole tokens, QA's own promise
// marks survive the next round, a true fine is never "deleted", the page's own call to action is the business's text, the coverage kinds
// need two signals, sales headings are dropped only on a course page, brackets in code / [sic] / [Updated 2026] are not gaps while an
// Arabic one is, the next step does not say "publish" beside a duplicate-target warning, the editor prompt names durations too, and the
// schema carries no "[Page URL]" @id. Every assertion here failed on 413cae9a. Called from scenarios_v5.js before the report (one line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const CODE = path.join(__dirname, 'code_v4', 'Content_QA.js');
  const kitOf = (name, end) => { const src = fs.readFileSync(CODE, 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' kit not found in the generated Content QA'); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const CL = kitOf('CL'), CVG = kitOf('CVG'), PH = kitOf('PH');
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FACTS = 'Tech& is a Microsoft partner based in Dubai. The website states 20+ years of industry experience and 24/7 support. Founded in 2010, 100 clients, 10x faster reporting.';
  const NAMES = ['Tech&', 'techand'];
  const flags = (md, facts) => { const B = CL.business(md, facts || FACTS, { names: NAMES }); return B.flags.concat(CL.commitments(md, facts || FACTS, { names: NAMES, skip: B.flags.map(f => f.sentence) }).flags).map(f => f.sentence); };
  const one = (heading, s, facts) => flags('## ' + heading + '\n\n' + s + '\n', facts);

  await guard('CTF1 claims kit: subject, not verb', async () => {
    const SN = 'CTF1 CT-FIX review items 1 2 6 9 10 12: calls to action, narration, quotes, examples and third parties are not promises; contractions, passives, list items, table rows, headings and Arabic are; numbers are whole tokens';
    reset(); begin(SN); const check = mkCheck(SN);
    const page = (body) => '## What it costs\n\nMost firms price discovery by phase.\n\n' + body;
    check('item 1: the closing call to action is not a promise ("Share your requirements and we will prepare a fixed-scope proposal.")',
      !flags(page('## Next step\n\nShare your requirements and we will prepare a fixed-scope proposal. Our team will review your setup and reply within two business days.\n')).length, J(flags(page('## Next step\n\nShare your requirements and we will prepare a fixed-scope proposal.\n'))));
    check('item 1: a call to action that names a price or a quote is still a term to confirm', one('Next step', 'Book a scoping call and we will send you a fixed quote within 48 hours.').length === 1);
    check('item 2: guide narration is not a promise', !one('What VAT registration involves', 'In this guide we cover the five steps the FTA asks for. Below we map each requirement to the law.').length);
    check('item 9: a third party acting, a quotation, a worked example and "we" in a relative clause are not promises',
      !flags('## How we handle your VAT registration\n\nWe prepare the application with you. You receive a Tax Registration Number from the FTA within 20 business days. "We review every application within 20 days," the FTA says.\n\n## A worked example\n\nSay we start with a 40-user retailer and a single warehouse. Most distributors we work with in Dubai still run spreadsheets.\n', FACTS + ' We prepare the application with you.').length,
      J(flags('## How we handle your VAT registration\n\nWe prepare the application with you. You receive a Tax Registration Number from the FTA within 20 business days. "We review every application within 20 days," the FTA says.\n\n## A worked example\n\nSay we start with a 40-user retailer and a single warehouse. Most distributors we work with in Dubai still run spreadsheets.\n', FACTS + ' We prepare the application with you.')));
    const ten = flags('## Our approach\n\nWe\'ll deliver a runbook at go-live. We\'re going to train your admins on every new workflow. Monitoring dashboards are included in every engagement. You will receive a weekly status report.\n\nOur engagement includes:\n\n- A quarterly roadmap review with your sponsor\n\n| Phase | What you get |\n|---|---|\n| Run | We deliver a monthly health check |\n\n### We deliver a migration plan in 10 days\n');
    for (const s of ['We\'ll deliver a runbook', 'We\'re going to train', 'Monitoring dashboards are included', 'You will receive a weekly status report', 'A quarterly roadmap review', 'We deliver a monthly health check', 'We deliver a migration plan in 10 days'])
      check('item 10: flagged: "' + s + '"', ten.some(f => f.includes(s)), J(ten));
    check('item 12: "within 10 days" is not supported by 2010, 100 or 10x on file', one('Managed Services', 'We respond to incidents within 10 days.').length === 1);
    check('item 12: number words and synonyms match ("over two decades", "round-the-clock")', !one('Why Tech&', 'We have been in the industry for over two decades and we provide round-the-clock support.').length,
      J(one('Why Tech&', 'We have been in the industry for over two decades and we provide round-the-clock support.')));
    check('Arabic: a first-person-plural guarantee nothing supports is flagged, a true 24/7 line is not',
      one('التزامنا', 'نضمن استرداد أموالك إذا لم يعمل النموذج التجريبي خلال ستة أسابيع.').length === 1 && !one('لماذا تك آند', 'نقدم الدعم على مدار الساعة طوال أيام الأسبوع.').length);
    const long = 'We deliver a governance runbook, ' + Array.from({ length: 30 }, (_, i) => 'a control checklist number ' + (i + 11)).join(', ') + ' and a final sign-off for every scheduled job.';
    const lf = one('Our approach', long);
    check('item 6: a promise longer than 300 characters comes back whole (it was cut mid-word and wrapped wrong)', lf.length === 1 && lf[0] === long, lf[0] && lf[0].length + ' of ' + long.length);
  });

  const SITE_MODEL = { site_model: { ...(FX.parse_brief.site_model || {}), domain: 'techand.ai', canonical_host: 'www.techand.ai' } };
  const noSubs = { coverage_target: { ...clone(FX.parse_brief.coverage_target), subtopics: [] } };
  const qa = async (over, draft, runIndex) => {
    mock('Parse Brief', [{ json: { ...clone(FX.parse_brief), ...noSubs, ...(over || {}) } }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    return (await run('Content QA', [{ json: { output: draft, critique: null } }], { runIndex: runIndex || 1 }))[0].json;
  };
  const base = FX.draft_round2.split('[Tech& banking or public sector reference, to confirm]').join('a regional bank').split('[Tech& assessment duration and fee band, to confirm]').join('a fixed scope');
  const addTo = (md, s) => md.replace(/(\n## [^\n]*\n)/, '$1\n' + s + '\n');

  await guard('CTF2 Content QA: marks across rounds, the call to action, fines, URL form, schema', async () => {
    const SN = 'CTF2 CT-FIX review items 1 7 8 18 20 on the Content QA node (exec 42 draft)';
    reset(); begin(SN); const check = mkCheck(SN);
    const CTA = 'We review your data estate in five working days.';
    const r1 = (await qa({ cta: 'Book an AI readiness session: we review your data estate in five working days.' }, addTo(base, CTA))).content_qa;
    check('item 1: a sentence the client\'s own call to action states is not flagged (prev.cta is the business\'s own text)', !(r1.business_promises || []).some(b => b.sentence === CTA), J((r1.business_promises || []).map(b => b.sentence)));
    const PROM = 'We test a proof of concept against your real data and live integrations.';
    const r2 = (await qa(null, base.split(PROM).join('[Confirm: ' + PROM + ']'), 2)).content_qa;
    check('item 7: QA\'s own [Confirm: <sentence>] mark kept by the editor stays a business promise next round, not a writer note',
      (r2.business_promises || []).some(b => b.sentence === PROM) && !(r2.writer_notes || []).some(n => n.token.includes(PROM)), J({ p: (r2.business_promises || []).map(b => b.sentence.slice(0, 50)), w: r2.writer_notes }));
    const r3 = (await qa({ pricing_facts: false, timeline_facts: false }, addTo(base, 'The FTA fine for late registration is AED 10,000.'))).content_qa;
    const fineEdit = ((r3.quality || {}).owner_edits || []).find(e => /AED 10,000/.test(e.token));
    check('item 8: QA\'s own amount mark on a true government fine is never "delete" (pricing_facts false)', !fineEdit || fineEdit.action !== 'delete', J(fineEdit));
    const out4 = await qa({ site_urls: ['https://www.techand.ai/a/', 'https://www.techand.ai/b', 'https://www.techand.ai/c', 'https://www.techand.ai/d', 'https://www.techand.ai/x.pdf', 'https://www.techand.ai/y.pdf', 'https://www.techand.ai/z.pdf', 'https://www.techand.ai/sitemap.xml'], ladder_id: '', existing_page: null, slug: 'ai-consultant' }, base);
    const pu = out4.content_qa.page_url || '';
    check('item 18: file URLs (.pdf, .xml) do not vote on the slash form: three of four pages have none, so the page URL has none', /ai-consultant$/.test(pu), pu);
    const out5 = await qa({ domain: '', site_model: null }, base);
    const ids = J(out5.schema_blocks || []);
    check('item 20: no schema @id is "[Page URL]" when the domain is unknown', !/"@id":"\[Page URL\]"/.test(ids), ids.slice(0, 300));
  });

  await guard('CTF3 coverage kinds and sales headings', async () => {
    const SN = 'CTF3 CT-FIX review items 3 4 5: service pages read as service, one word never makes a page "other", sales words drop a heading only on a course page';
    reset(); begin(SN); const check = mkCheck(SN);
    const K = 'ai consultant dubai';
    for (const t of ['AI Consultant in Dubai | Kinetic', 'Hire an AI Consultant in Dubai', 'AI Consulting Services Dubai'])
      check('item 3: "' + t + '" is a service page', CVG.kindOf({ title: t, url: 'https://x.ae/ai' }, K) === 'service', CVG.kindOf({ title: t, url: 'https://x.ae/ai' }, K));
    for (const [t, u, hs] of [['Microsoft Certified Dynamics 365 Partner UAE | Firm', '/dynamics-365', []], ['Active Directory & Azure Migration Services', '/azure', []], ['Shopify Development & Marketplace Integration', '/shopify', []],
      ['ERP Implementation UAE | Programme Delivery', '/erp', []], ['Salesforce Consulting Partner | Careers at scale', '/salesforce', []], ['Golden Visa UAE', '/golden-visa', ['H2: Eligibility for investors', 'H2: Eligibility for professionals']]])
      check('item 4: "' + t + '" is not a course / job / directory page', CVG.kindOf({ title: t, url: 'https://x.ae' + u, headings: hs }, 'erp implementation uae') !== 'other');
    check('item 4: a training company\'s competitors on /training/ are not "other" (power bi training dubai)', CVG.kindOf({ title: 'Power BI Training Courses Dubai', url: 'https://x.ae/training/power-bi' }, 'power bi training dubai') !== 'other');
    check('item 4: exec 42\'s certification course is still "other" (title, path and headings agree)', CVG.kindOf({ title: 'Certified Artificial Intelligence Consultant | CAIC(TM)', url: 'https://www.usaii.org/ai-certifications/certified-artificial-intelligence-consultant', headings: ['H2: Program Fee: US $894 (All Inclusive)', 'H2: Alumni Speak', 'H2: Program Eligibility'] }, 'ai consultant') === 'other');
    for (const h of ['Eligibility for small business relief', 'Volume discounts for multi-year licences', 'Projects under $50k: what to expect', 'Curriculum design for internal AI training', 'FREE trial versus paid pilot', 'Resource centre setup for support teams'])
      check('item 5: "' + h + '" is a topic on a service or guide page', !CVG.isPromo(h, 'service') && !CVG.isPromo(h, 'guide'));
    check('item 5: a fee label and a course\'s alumni heading are still dropped', CVG.isPromo('Program Fee: US $894 (All Inclusive)', 'service') && CVG.isPromo('Alumni Speak about the programme', 'other'));
  });

  await guard('CTF4 placeholders', async () => {
    const SN = 'CTF4 CT-FIX review item 11: code, [sic] and [Updated 2026] are not gaps; an Arabic placeholder is';
    reset(); begin(SN); const check = mkCheck(SN);
    check('item 11: brackets in inline and fenced code are not placeholders', PH.scan('Set `labels[sensitivity]` first.\n\n```\nrows[index] = 1\n```\n').placeholder_count === 0);
    check('item 11: [Updated 2026] and [sic] are not placeholders, [Phone number] beside them is', PH.scan('[Updated 2026] The FTA said "recieve" [sic]. Call [Phone number].').placeholder_count === 1);
    check('item 11: an Arabic placeholder is counted', PH.scan('تبلغ الرسوم [السعر] شهريا.').placeholder_count === 1);
  });

  await guard('CTF6 length judged against the ranking band', async () => {
    const SN = 'CTF6 CT-FIX + CT-DEPTH C8: with a length band from the ranking pages (ok) the length is judged against [low, high] and the reason names the band';
    reset(); begin(SN); const check = mkCheck(SN);
    const words = (await qa(null, base)).content_qa.main_content_words;
    const T = Math.round(words / 1.4);   // 1.4x the target: "too long" under the old rule
    const band = { ok: true, low: Math.round(T * 0.9), high: words + 200, median: T, target_word_count: T, sample: 5, basis: 'pages ranking for this run, 5 service pages' };
    const tb = (n) => ({ content_brief: { ...clone(FX.parse_brief.content_brief || {}), target_word_count: n } });
    const inBand = (await qa({ ...tb(T), length_band: band }, base)).content_qa;
    const noBand = (await qa({ ...tb(T), length_band: { ...band, ok: false } }, base)).content_qa;
    const tooLong = (Q) => (Q.warnings || []).some(w => /^Main content is too long/.test(w));
    check('a draft inside the ranking band is not "too long" (it is 1.4x the target)', !tooLong(inBand), J((inBand.warnings || []).filter(w => /Main content/.test(w))));
    check('without a usable band the old 1.25x rule still applies', tooLong(noBand));
    const shortW = (await qa({ ...tb(words + 300), length_band: { ...band, low: words + 100, high: words + 600, target_word_count: words + 300 } }, base)).content_qa;
    check('a draft under the band is short, and the warning names the band and its sample', (shortW.warnings || []).some(w => /^Main content is short/.test(w) && w.includes((words + 100) + '-' + (words + 600)) && w.includes('5 service pages')), J((shortW.warnings || []).filter(w => /Main content/.test(w))));
  });

  await guard('CTF5 next step and the editor prompt', async () => {
    const SN = 'CTF5 CT-FIX review item 14: no "publish it" beside a duplicate target';
    reset(); begin(SN); const check = mkCheck(SN);
    mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
    mock('Collect Client Pages', [{ json: { client_pages: [] } }]);
    mock('Site Model', [{ json: { site_model: { domain: 'techand.ai', canonical_host: 'www.techand.ai', pages: [{ url: 'https://www.techand.ai/ai-consultant-dubai', title: 'AI Consultant Dubai' }], pages_json: JSON.stringify([{ url: 'https://www.techand.ai/ai-consultant-dubai', title: 'AI Consultant Dubai' }]) } } }]);
    const o = (await run('Originality Check', [{ json: { keyword: 'ai consultant dubai', output: 'A short page about AI consultants in Dubai and what they do for a business.', content_qa: { passed: false, not_ready: true, rounds_left: 0, warnings: [],
      quality: { not_ready: true, next_step: 'Finish this draft by hand: fill in [Price]. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.' } } } }]))[0].json.content_qa;
    const ns = (o.quality || {}).next_step || '';
    check('item 14: with a duplicate target the next step names that page and no longer says "Then publish it."', (o.originality || {}).duplicate_targets && o.originality.duplicate_targets.length ? (!/Then publish it\./.test(ns) && ns.includes('ai-consultant-dubai')) : false, J({ ns, dup: (o.originality || {}).duplicate_targets }));
    // item 17 (the editor prompt names durations too) is asserted by the build: the harness carries no prompts
  });
};
