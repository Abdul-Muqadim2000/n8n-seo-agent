// PFX1-PFX8 (H1, 2026-10-27, docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md, R2_MARKET_RESEARCH.md): the page pipeline on the
// GENERATED code and on trimmed fixtures of the four production page runs (harness/fixtures/page_pipeline_4runs.json: excerpts of each
// draft and the quality records of each round of executions 949, 2195, 2552 and 2575; no competitor text). Every model call is MOCKED:
// the Editor's answers are the production answers (a full page) or a deterministic section answer written here. One scenario per root
// cause of R1 §3: the contract (3.2), the deterministic fixes (3.1, 3.5), one score and keep-best (3.1: the 949 regression, the 2195 /
// 2552 cut-offs), the section-targeted edit (3.1), real sources (3.6), blocking vs advisory and the delivered grade (3.4, 3.7), the
// client questions (owner decision 2026-10-28). Called from scenarios_v5.js before the report (one line).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'page_pipeline_4runs.json'), 'utf8')).runs;
  const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'page_fix_wiring.json'), 'utf8'));
  const pf = async (fn, args, termRe) => (await run('PF Kit', [{ json: { fn, args, with_term_re: !!termRe } }], { code: '_page_fix' }))[0].json.r;
  const ck = async (md) => (await run('Complete Kit', [{ json: { fn: 'text', args: [md] } }], { code: '_complete' }))[0].json.r;
  const BAD = /[—–“”…]/;
  const IDS = ['949', '2195', '2552', '2575'];
  // the brief item of a run, as the content pipeline carries it (page_contract added the way Brief Context adds it)
  const briefOf = async (id) => { const b = clone(FX[id].brief); b.page_contract = await pf('contract', [b]); return b; };
  const mocksFor = async (id, extra) => { const b = await briefOf(id); mock('Parse Brief', [{ json: b }]); mock('Site Model', [{ json: clone(FX[id].site_model) }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]); mock('Parse Critique', [{ json: { critique: clone(FX[id].critique) } }]);
    if (extra) for (const [k, v] of Object.entries(extra)) mock(k, v); return b; };
  // a production quality record of round r, with the cut-off check the current code adds (it predates LLM-LIMITS)
  const roundItem = async (id, r, b) => { const R = FX[id].rounds[r]; const qa = clone(R.qa); const c = await ck(R.md); qa.cut_off = c.cut_off; qa.round = r + 1;
    return { ...b, output: R.md, qa_round: r + 1, content_qa: qa }; };
  const pcRun = async (id, item, pageFixItem) => { mock('Page Fix', [{ json: pageFixItem }]); return (await run('Page Candidates', [{ json: item }]))[0].json; };

  // ---------- PFX1 the contract: one rule for length, brackets and claims in every prompt ----------
  await guard('PFX1 contract', async () => {
    const SN = 'PFX1 (H1, R1 3.2) one contract in the brief, the copywriter, the critic and the editor: the length is a band, no brackets, claims only from what is on file';
    reset(); begin(SN); const check = mkCheck(SN);
    const c949 = await pf('contract', [FX['949'].brief]);
    check('949: the band is the ranking pages\' 1,800-3,000, judged as a band, length is advice', c949.band && c949.band.low === 1800 && c949.band.high === 3000 && /judged as a band, 1800-3000/.test(c949.text) && /Length is advice/.test(c949.text), J(c949.band));
    const c2195 = await pf('contract', [FX['2195'].brief]);
    check('2195: the page-type band (900-2,400) when too few service pages rank; the service-page targets', c2195.band && c2195.band.source === 'page_type' && c2195.kind === 'service' && /4 to 8 H2 sections/.test(c2195.text), J(c2195.band));
    check('the contract says no brackets, the claim rule and what blocks', ['BRACKETS: none in the page', 'never as "we do"', 'WHAT BLOCKS PUBLISHING'].every(x => c949.text.includes(x)) && !BAD.test(c949.text), c949.text.slice(0, 300));
    for (const p of ['Strategy Brief', 'Copywriter', 'Critic', 'Editor']) {
      const t = W.prompts[p];
      check(p + ': prints the page contract and keeps no "within 10%" or "keep the [Author insight]" rule', /page_contract/.test(t) && !/within 10%/.test(t) && !/Keep every bracketed \[Author insight/.test(t) && !/stays as a bracketed line/.test(t), t.slice(0, 160));
    }
    check('the brief asks for questions_for_client and plans no bracketed author prompt or first-person experience', /questions_for_client/.test(W.prompts['Strategy Brief']) && !/else a bracketed prompt for the author/.test(W.prompts['Strategy Brief']));
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_v4.json'), 'utf8')); const WF = Array.isArray(wf) ? wf[0] : wf;
    const sch = JSON.parse(WF.nodes.find(n => n.name === 'Parser — Strategy Brief').parameters.inputSchema);
    check('the brief\'s parser schema carries questions_for_client', sch.properties.questions_for_client && sch.properties.questions_for_client.type === 'array');
    check('Brief Context puts the contract on the brief item', /page_contract: PF\.contract\(/.test(WF.nodes.find(n => n.name === 'Brief Context').parameters.jsCode));
  });

  // ---------- PFX2 the deterministic fixes ----------
  await guard('PFX2 fixes', async () => {
    const SN = 'PFX2 (H1, R1 3.1 / 3.5 / rec. 2) the deterministic fixes on the production Copywriter drafts: no bracket left (each one a question), lossless sections, keyword, meta, Quick answer, snippet heading, brand';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const id of IDS) {
      const md = FX[id].copywriter_excerpt; const sp = await pf('split', [md]); const joined = await pf('join', [sp]);
      check(id + ': split then join gives the page back byte for byte (' + sp.parts.length + ' sections)', joined === md && sp.parts.length >= 2, J({ a: md.length, b: joined.length }));
      const c = await pf('ctxOf', [FX[id].brief]);
      const before = await pf('bracketsIn', [md]); const F = await pf('fix', [md, c], true); const after = await pf('bracketsIn', [F.md]);
      const gone = (tok) => F.removed.some(r => r.token === tok || String(r.sentence || '').includes(tok.slice(1, 30)));
      check(id + ': ' + before.length + ' bracket(s) in the Copywriter draft, none after the fixes; each one recorded (alone, or with the sentence that held it), the client ones as a question', before.length > 0 && after.length === 0 && before.every(b => gone(b.token))
        && F.removed.filter(r => r.kind !== 'research').every(r => r.question || /^\[(Price|Statistic|Number|Date)\]$/i.test(r.token)) && !BAD.test(F.removed.map(r => r.question).join(' ')), J({ before: before.map(b => b.token), removed: F.removed }));
    }
    const c949 = await pf('ctxOf', [FX['949'].brief]);
    const F949 = await pf('fix', [FX['949'].copywriter_excerpt, c949], true);
    const ai = F949.removed.find(r => /^\[Author insight/i.test(r.token));
    check('949: an [Author insight: ...] prompt becomes an experience question, never a line in the page', ai && ai.kind === 'experience' && /^From your own work:/.test(ai.question) && !/Author insight/.test(F949.md), J(ai));
    // the keyword: a question keyword missing from the H1 and the first 100 words (synthetic page, real 949 keyword)
    const syn = 'Title: Dynamics 365 explained for UAE finance teams and their auditors\nMeta Description: A short guide.\nSlug: Is_Dynamics-365 ERP\nPrimary Keyword: is microsoft dynamics 365 an erp system\n\n# Dynamics 365 for UAE companies\n\nMicrosoft Dynamics 365 is a family of business apps that UAE companies use for finance and operations.\n\n' + 'Filler sentence about planning. '.repeat(30) + '\n\n**Quick answer:** Microsoft Dynamics 365 includes ERP apps, Business Central and Finance, alongside CRM apps, so the answer depends on which apps you license.\n\n## Licensing\n\nText about licensing.\n\n## Contact\n\n[Talk to us](https://www.novaand-demo.com/contact-us)\n';
    const S1 = await pf('fix', [syn, { ...c949, planned_slug: false, snippet_targets: [{ question: 'How does Dynamics 365 licensing work?' }] }], true);
    check('a question keyword goes into the H1 and opens the introduction, with the page\'s own capitals ("Microsoft", "ERP")', /^# Is Microsoft Dynamics 365 an ERP system\?$/m.test(S1.md) && /\n\nIs Microsoft Dynamics 365 an ERP system\? Microsoft Dynamics 365 is a family/.test(S1.md), S1.md.slice(0, 500));
    check('the meta title gets the keyword at the start and stays within 60 characters, the slug becomes lowercase words with hyphens', (S1.md.match(/^Title: (.+)$/m) || [, ''])[1].length <= 60 && /^Slug: is-dynamics-365-erp$/m.test(S1.md), S1.md.split('\n').slice(0, 3).join(' | '));
    check('the Quick answer that came after 120+ words moves up to right after the first paragraph', S1.md.indexOf('**Quick answer:**') < S1.md.indexOf('Filler sentence'), S1.fixes.join(' | '));
    check('a snippet question from the brief becomes the heading it nearly is ("## Licensing" is not enough: overlap under 60% leaves it to the editor)', !/## How does Dynamics 365 licensing work\?/.test(S1.md));
    const S2 = await pf('fix', ['# X\n\nIntro.\n\n## How Dynamics 365 licensing works\n\nText.\n', { snippet_targets: [{ question: 'How does Dynamics 365 licensing work?' }] }], true);
    check('... and a heading that shares its words becomes the question', /^## How does Dynamics 365 licensing work\?$/m.test(S2.md), S2.md);
    // the brand: novaand-demo.com stores "Nova& (legal name: Novaand systems LLC)"; the production check flagged "Novaand" inside the stored form
    const c2575 = await pf('ctxOf', [FX['2575'].brief]);
    const r1 = FX['2575'].rounds[0];
    const hits = await pf('brandHits', [r1.md, c2575]);
    check('2575: the production "Brand name: Novaand (3)" warning was the stored legal name itself: 0 real wrong forms once the stored name and the legal name are set aside (not a blocker here)', r1.qa.warnings.some(w => /^Brand name:/.test(w)) && hits === 0, J({ hits, brand: c2575.brand, keep: c2575.keep_forms }));
    const B = await pf('fix', ['# Nova& ERP\n\nNovaand helps. Nova& (legal name: Novaand systems LLC) is in Dubai. Mail info@novaand-demo.com or visit www.novaand-demo.com.\n', c2575], true);
    check('a wrong form in prose is written as the business writes it; the "(legal name: ...)" note goes (H2: the display name in prose); the e-mail and the domain are untouched', /Nova& helps\./.test(B.md) && /Nova& is in Dubai\./.test(B.md) && !/legal name/.test(B.md) && /info@novaand-demo\.com/.test(B.md) && /www\.novaand-demo\.com/.test(B.md), B.md);
    const T = await pf('fix', ['Title: ERP Systems in UAE | Nova& (legal name: Novaand systems LLC) and partners\n\n# ERP systems in UAE\n\nIntro on erp systems in uae.\n', { ...c2575, wrong_forms: [] }], true);
    check('2575: the 77-character production title is cut back to 60 or fewer and keeps the keyword', (T.md.match(/^Title: (.+)$/m) || [, ''])[1].length <= 60 && /ERP Systems in UAE/.test(T.md), T.md.split('\n')[0]);
  });

  // ---------- PFX3 one score, keep the best: the production regressions ----------
  const decisions = {};
  await guard('PFX3 keep best', async () => {
    const SN = 'PFX3 (H1, R1 3.1 / rec. 1) one score for every candidate and the best one kept: 949\'s complete but worse edit, 2195 and 2552\'s cut edits are set aside, 2575\'s better edit is kept';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const id of IDS) {
      const b = await mocksFor(id);
      const i1 = await roundItem(id, 0, b);
      const pc1 = await pcRun(id, i1, { ...i1, page_fix_applied: { fixes: [], removed: [] } });
      const st1 = pc1.page_fix;
      check(id + ': round 1 (the Copywriter draft) is the best so far and an edit is planned for the sections with a problem only (' + st1.edit_job.sections.length + ' of ' + ((await pf('split', [i1.output])).parts.length) + ')',
        st1.next === 'edit' && st1.best.source === 'copywriter draft' && st1.edit_job.sections.length > 0 && st1.edit_job.sections.every(s => s.problems.length), J(st1.history));
      check(id + ': the page given to the editor carries none of the quality check\'s [Confirm: ...] marks', !/\[Confirm: [^\]]{20,}[.!?]\]/.test(pc1.output), pc1.output.slice(0, 200));
      const i2 = await roundItem(id, 1, b);
      const pc2 = await pcRun(id, i2, { ...i2, page_fix: { ...st1, came_from: 'edit', edits: 1, edit_job: null }, page_fix_applied: { fixes: [], removed: [] } });
      const h = pc2.page_fix.history[1];
      decisions[id] = { r1: pc2.page_fix.history[0], r2: h, next: pc2.page_fix.next, stop: pc2.page_fix.stop_reason || '', best: pc2.page_fix.best.source, pc2 };
      console.log('   ' + id + ' -> ' + J({ r1: pc2.page_fix.history[0], r2: h, next: pc2.page_fix.next, stop: pc2.page_fix.stop_reason }));
    }
    check('949: the production edit (complete, 3,481 words) is set aside: more unsupported statements, two dead links, the keyword out of the first 100 words; the Copywriter draft is kept and the editing stops (it improved nothing)',
      !decisions['949'].r2.kept && decisions['949'].best === 'copywriter draft' && decisions['949'].next === 'finalize' && /did not improve/.test(decisions['949'].stop), J(decisions['949'].r2));
    for (const id of ['2195', '2552']) check(id + ': the production edit that stops mid-way (a cut-off page) is set aside, whatever it removed; the complete Copywriter draft is kept',
      !decisions[id].r2.kept && decisions[id].best === 'copywriter draft' && decisions[id].r2.hard >= 10 && decisions[id].next === 'finalize', J(decisions[id].r2));
    check('2575: the production edit is better (fewer unsupported statements and brackets, coverage 85% -> 100%) and is kept; a second, section-targeted edit is planned',
      decisions['2575'].r2.kept && decisions['2575'].best === 'edit 1' && decisions['2575'].next === 'edit', J(decisions['2575']));
    // the protected properties: an edit that loses the call to action is never better, whatever it fixed
    const a = { score: { hard: 0, soft: 0, adv: 0 }, protect: { cta: false, quick_answer: true, h2: 8, words: 1500 }, cls: { band: { low: 900, high: 2400 } } };
    const bq = { score: { hard: 0, soft: 5, adv: 3 }, protect: { cta: true, quick_answer: true, h2: 8, words: 1600 }, cls: { band: { low: 900, high: 2400 } } };
    const cmp = await pf('better', [a, bq]);
    check('an edit that fixes every claim but loses the call to action is not better (R1 rec. 1 protected properties)', cmp.better === false && /call to action/.test(cmp.why), J(cmp));
  });

  // ---------- PFX4 the section-targeted edit ----------
  await guard('PFX4 sections', async () => {
    const SN = 'PFX4 (H1, R1 3.1 / rec. 2) the editor edits sections: only the listed sections change, every other byte is kept, a guessed URL is unlinked, an unfinished block is retried then left out';
    reset(); begin(SN); const check = mkCheck(SN);
    const d = decisions['2575']; if (!d) throw new Error('PFX3 did not run');
    const vs = clone(d.pc2); const job = vs.page_fix.edit_job; const base = vs.output;
    await mocksFor('2575');
    mock('Verified Sources', [{ json: vs }]);
    // the deterministic stand-in for the model: each listed section comes back with its flagged sentences deleted and one guessed link added
    const flagged = job.sections.flatMap(s => s.problems.map(p => (p.match(/: "(.+)"$/) || [])[1]).filter(Boolean));
    const answerFor = (ids, cutLast) => ids.map((id, k) => { const s = job.sections.find(x => x.id === id); let t = String(s.text).trim();
      for (const f of flagged) { const i = t.indexOf(f.slice(0, 60)); if (i >= 0) { const e = t.indexOf('.', i + 20); t = t.slice(0, i) + t.slice(e < 0 ? t.length : e + 1); } }
      t += '\n\nSee [the localisation notes](https://learn.microsoft.com/en-us/dynamics365/guessed-page-404).';
      return '=== SECTION ' + id + ' ===\n' + t + (cutLast && k === ids.length - 1 ? '' : '\n=== END ' + id + ' ==='); }).join('\n\n');
    const ids = job.sections.map(s => s.id);
    const out = (await run('Edit Check (Editor)', [{ json: { output: answerFor(ids, false) } }]))[0].json;
    const spB = await pf('split', [base]), spA = await pf('split', [out.output]);
    const same = spB.parts.filter(p => !ids.includes(p.id)).every(p => (spA.parts.find(q => q.id === p.id) || {}).text === p.text);
    check('every section the job did not list is byte-identical after the merge (' + (spB.parts.length - ids.length) + ' kept, ' + ids.length + ' edited)', same && spA.head === spB.head, J({ ids }));
    check('the guessed Microsoft Learn URL (not in the page, the evidence plan, the facts or the verified sources) is unlinked, its words kept', !/guessed-page-404/.test(out.output) && /the localisation notes/.test(out.output) && out.page_fix.last_edit.unlinked.length === ids.length, J(out.page_fix.last_edit));
    check('the state counts one more editing round and says it came from an edit', out.page_fix.edits === 2 && out.page_fix.came_from === 'edit' && out.llm_check.complete === true, J({ e: out.page_fix.edits, c: out.llm_check }));
    const r1 = (await run('Edit Check (Editor)', [{ json: { output: answerFor(ids, true) } }]))[0].json;
    check('a block that stops before its closing line: the editor is asked once more', r1.llm_check && r1.llm_check.retry === true && /stopped inside section/.test(r1.llm_check.reasons.join(' ')), J(r1.llm_check));
    if (ids.length > 1) {
      mock('Edit Check (Editor)', [{ json: r1 }]);
      const r2 = (await run('Edit Check (Editor)', [{ json: { output: answerFor(ids, true) } }], { runIndex: 1 }))[0].json;
      const sp2 = await pf('split', [r2.output]); const lastId = ids[ids.length - 1];
      check('... and when it stops again, the finished sections are used and the unfinished one keeps its text', r2.llm_check.kept_draft === false && (sp2.parts.find(p => p.id === lastId) || {}).text === (spB.parts.find(p => p.id === lastId) || {}).text, J(r2.llm_check));
    }
    // the production 2195 answer (a whole page that stops mid-word) still goes through the full-page guard
    await mocksFor('2195');
    const vs95 = clone(decisions['2195'].pc2); vs95.page_fix = { ...vs95.page_fix, next: 'edit', edit_job: { sections: [{ id: 's1', heading: 'x', text: 'x', problems: ['x'] }] } }; vs95.output = FX['2195'].rounds[0].md;
    mock('Verified Sources', [{ json: vs95 }]);
    const c95 = (await run('Edit Check (Editor)', [{ json: { output: FX['2195'].editor_excerpt } }]))[0].json;
    check('2195: the production answer (no section blocks, ends "' + FX['2195'].editor_tail.slice(-24) + '") is read as a whole page and caught as cut off', c95.llm_check && c95.llm_check.retry === true, J(c95.llm_check));
  });

  // ---------- PFX5 real sources ----------
  await guard('PFX5 sources', async () => {
    const SN = 'PFX5 (H1, R1 3.6 / rec. 7) real sources before an edit: free searches on SearXNG, pages that answer and state the figure, the only links the editor may add, and the figure check reads them';
    reset(); begin(SN); const check = mkCheck(SN);
    const b = await mocksFor('949');
    const qa = { ...clone(FX['949'].rounds[1].qa), unverified_figures: [{ figure: '93,301', sources: ['6sense.com'], context: 'over 93,301 companies use Microsoft Dynamics 365 worldwide' }], unverified_statistics: ['about 10 people'] };
    const item = { ...b, output: FX['949'].rounds[1].md, page_fix: { round: 2, edits: 0, best: { content_qa: qa }, removed: [{ kind: 'research', research: 'Ask Microsoft whether your specific Dynamics 365 apps are hosted in a UAE region.' }], searched: [] } };
    const plan = (await run('Page Source Plan', [{ json: item }])).map(i => i.json);
    check('the figure, the unsourced number, the writer\'s note about Microsoft\'s product and the reviewer\'s "cite Microsoft Learn" become free SearXNG searches (at most 6, none repeated)',
      plan.length >= 3 && plan.length <= 6 && plan.every(t => /^http:\/\/searxng:8080\/search\?format=json/.test(t.url)) && plan.some(t => t.kind === 'figure' && t.figure === '93,301') && plan.some(t => t.kind === 'research'), J(plan.map(t => [t.kind, t.query])));
    mock('Page Source Plan', plan.map(json => ({ json })));
    const res = plan.map((t, i) => ({ json: i === 0 ? { results: [{ url: 'https://www.novaand-demo.com/insights/x', title: 'own' }, { url: 'https://www.linkedin.com/posts/x', title: 'social' }, { url: 'https://iesgp.com/dynamics', title: 'rival' }, { url: 'https://learn.microsoft.com/en-us/dynamics365/customers', title: 'Microsoft Learn' }, { url: 'https://www.6sense.com/tech/erp/dynamics', title: 'vendor blog' }] }
      : { results: [{ url: 'https://learn.microsoft.com/en-us/azure/regions-uae', title: 'Azure regions' }] } }));
    b.competitors = [{ url: 'https://iesgp.com/dynamics', domain: 'iesgp.com' }]; mock('Parse Brief', [{ json: b }]);
    const cands = (await run('Page Source Candidates', res)).map(i => i.json);
    check('the pages worth reading: never the client\'s own site, a competitor or a social page; an official / documentation page before a weak one', cands.length >= 1 && cands.every(c => !/novaand-demo\.com|linkedin|iesgp/.test(c.url)) && cands[0].url === 'https://learn.microsoft.com/en-us/dynamics365/customers', J(cands.map(c => c.url)));
    mock('Page Source Candidates', cands.map(json => ({ json })));
    mock('Page Candidates', [{ json: { ...item, page_fix: { ...item.page_fix, round: 2 } } }]);
    const fetched = cands.map((c, i) => ({ json: i === 0 ? { statusCode: 200, body: '<html><title>Customers</title><p>More than 93,301 companies run Microsoft Dynamics 365 apps today, Microsoft says.</p></html>' } : { statusCode: 404, body: '<title>Page not found</title>' } }));
    mock('Fetch Page Sources', fetched);
    const vs = (await run('Verified Sources', fetched))[0].json;
    const v = vs.page_fix.sources;
    check('only the page that answers 200 AND states 93,301 is a source; the 404 is not; every task is marked searched', v.length === 1 && v[0].figure === '93,301' && /93,301/.test(v[0].evidence) && vs.page_fix.searched.length === plan.length && !BAD.test(v[0].evidence), J({ v, not: vs.page_fix.source_round.not_used }));
    check('the editor prompt lists the verified sources with the passage that states the figure', /SOURCES YOU MAY CITE/.test(W.prompts.Editor) && /page_fix \|\| \{\}\)\.sources/.test(W.prompts.Editor));
    // the figure check reads the verified source: a sentence citing it with its figure is not held, another figure is
    const md = '# Dynamics 365\n\nIntro text about Dynamics 365 and ERP for UAE companies here.\n\n## Who uses it\n\nOver 93,301 companies use it, per [Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/customers). Also 55,000 partners exist, per [Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/customers).\n';
    mock('Page Fix', [{ json: { output: md, page_fix: { came_from: 'edit', edits: 1, sources: v } } }]);
    mock('Promise Candidates', [{ json: { output: md, promise_judge: { skip: true, off: true, candidates: [] } } }]);
    const q = (await run('Content QA', [{ json: { output: md } }], { runIndex: 1 }))[0].json.content_qa;
    check('Content QA checks a figure against the source the source step read today: 93,301 passes, 55,000 is held', !q.unverified_figures.some(f => /93,301/.test(f.figure)) && q.unverified_figures.some(f => /55,000/.test(f.figure)), J(q.unverified_figures));
    check('the editing rounds come from the pipeline\'s state (an edit round counted once, the final check none)', q.editor_rounds === 1, J(q.editor_rounds));
  });

  // ---------- PFX6 / PFX7 the final version through the real quality check, and what the client receives ----------
  const verdicts = {};
  const finalOf = async (id, pcItem, round) => {
    await mocksFor(id);
    const fixed = (await run('Page Fix', [{ json: pcItem }]))[0].json;
    const pcd = (await run('Promise Candidates', [{ json: fixed }]))[0].json;
    const qa = (await run('Content QA', [{ json: pcd }], { runIndex: round - 1 }))[0].json;
    const reqs = (await run('Outbound Link Requests', [{ json: qa }])).map(i => i.json);
    if (!reqs[0].skip) mock('Fetch Outbound Links', reqs.map(() => ({ json: { statusCode: 200, body: '<title>ok</title><p>ok</p>' } })));
    const olc = (await run('Outbound Link Check', [{ json: qa }]))[0].json;
    const orig = (await run('Originality Check', [{ json: olc }]))[0].json;
    return (await run('Page Candidates', [{ json: orig }]))[0].json;
  };
  await guard('PFX6 final', async () => {
    const SN = 'PFX6 (H1, R1 3.3 / 3.4 / 3.7, R2 6.2) the final version of each production page through the real quality check: no bracket, every soft blocker rewritten or removed by the system, blocking vs advisory, the grade of the delivered page';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const id of IDS) {
      const d = decisions[id]; if (!d) throw new Error('PFX3 did not run');
      let pc = clone(d.pc2); let round = 3;
      if (pc.page_fix.next === 'edit') {   // 2575: no second editor answer in this replay: the planned edit is answered with the sections unchanged (an edit that improves nothing)
        await mocksFor(id); mock('Verified Sources', [{ json: pc }]);
        const ans = pc.page_fix.edit_job.sections.map(s => '=== SECTION ' + s.id + ' ===\n' + String(s.text).trim() + '\n=== END ' + s.id + ' ===').join('\n\n');
        const ec = (await run('Edit Check (Editor)', [{ json: { output: ans } }]))[0].json;
        pc = await finalOf(id, ec, round); round++;
        check(id + ': an edit that changes nothing is not better: the editing stops and the final version is prepared', pc.page_fix.next === 'finalize' && /did not improve/.test(pc.page_fix.stop_reason), J(pc.page_fix.history));
      }
      check(id + ': the final version handed to the last check has no bracket and none of the round\'s unsupported statements', (await pf('bracketsIn', [pc.output])).length === 0
        // W0-A (2026-10-29, page-quality PLAN Fix 1): a statement production flagged in the META DESCRIPTION (2195, 2575 round 2) is search-result
        // copy, not a claim: no removal edits a meta line any more (PF.meta owns it), so it stays in the head and only the body ones must go
        && (pc.page_fix.best.content_qa.business_promises || []).every(p => !pc.output.includes(p.sentence) || (/^Meta Description:.*$/m.exec(pc.output) || [''])[0].includes(p.sentence)), J(pc.page_fix.removed_final.map(r => [r.code, r.how])));
      const fin = await finalOf(id, pc, round);
      const q = fin.content_qa;
      verdicts[id] = { old: 'not_ready (' + FX[id].rounds[1].qa.warnings.length + ' warnings, critic ' + FX[id].critique.score + ')', status: q.delivery_status, label: q.quality_label, grade: q.delivery.grade.score,
        blocking: q.delivery.blocking.map(x => x.code), advice: q.delivery.advisory.length, questions: q.client_questions.length, from: q.delivery.delivered_from, edits: q.delivery.edits };
      console.log('   VERDICT ' + id + ' ' + J(verdicts[id]));
      check(id + ': the delivered page has no bracket and its status, label, reasons and quality object agree', (await pf('bracketsIn', [fin.output])).length === 0 && q.quality.delivery_status === q.delivery_status
        && q.not_ready === (q.delivery_status === 'not_ready') && q.publishable === !q.not_ready && (q.not_ready ? q.not_ready_reasons.length > 0 : q.not_ready_reasons.length === 0), J({ s: q.delivery_status, r: q.not_ready_reasons }));
      check(id + ': the grade is the content score of the delivered page (measured by the last check), and the first-draft review score is labelled as such', (q.delivery.blocking.length ? q.delivery.grade.score <= Math.min(59, q.content_score) : q.delivery.grade.score <= q.content_score) && q.delivery.grade.first_draft_review === FX[id].critique.score && /first draft/.test(q.delivery.grade.first_draft_review_note), J(q.delivery.grade));
      check(id + ': length, coverage and structure are advice and never block', q.delivery.blocking.every(x => !['length', 'coverage', 'subtopics', 'table', 'h2', 'kw_count'].includes(x.code)), J(q.delivery.blocking));
      check(id + ': plain customer wording (no em dash, curly quote or ellipsis character) in the label, the reasons, the questions and the next step', !BAD.test([q.quality_label, ...q.not_ready_reasons, q.delivery.next_step, ...q.client_questions.map(x => x.question + x.why + x.original + x.neutral)].join(' ')), q.quality_label);
    }
    check('949: delivered from the Copywriter draft (the worse edit discarded), with no blocker: ready to publish, with questions', verdicts['949'].from === 'copywriter draft' && verdicts['949'].status === 'ready_with_questions', J(verdicts['949']));
    check('2195: the complete Copywriter draft is delivered (not half a page); it stays "not ready" only for a hard reason the client must decide: this site already has a page for the same search', verdicts['2195'].from === 'copywriter draft' && verdicts['2195'].status === 'not_ready' && J(verdicts['2195'].blocking) === J(['duplicate_page']), J(verdicts['2195']));
    check('2552: the complete Copywriter draft is delivered (not half a page): ready to publish, with questions', verdicts['2552'].from === 'copywriter draft' && verdicts['2552'].status === 'ready_with_questions', J(verdicts['2552']));
    check('2575: the better edit is delivered: ready to publish, with questions', verdicts['2575'].from === 'edit 1' && verdicts['2575'].status === 'ready_with_questions', J(verdicts['2575']));
  });

  await guard('PFX7 questions', async () => {
    const SN = 'PFX7 (H1, owner decision 2026-10-28) every unsupported statement about the client is a client question with the specific sentence, the neutral wording in the page and yes / edit / remove; ranked, prefilled, keyed to a business fact, never blocking';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const id of IDS) {
      const d = decisions[id]; const seen = d ? (d.pc2.page_fix.claims_seen || []) : [];
      const v = verdicts[id]; if (!v) continue;
      // W05-C (2026-10-30, BEFORE_AFTER: 20 questions on one page): every flagged statement is a question, except a heading or a label (never
      // a statement), an ask that repeats the same question in the same section a third time, or one past the eight most useful
      const own = await pf('questions', [{ claims: seen, brief: [], brackets: [], business: 'the business', final_md: '', docs: [], stored: [] }]);
      const left = []; for (const c of seen) { const o = await pf('clean', [await pf('plain', [c.sentence])]); if (own.some(q => q.original === o)) continue;
        left.push({ s: String(c.sentence).slice(0, 90), heading: await pf('headingLike', [c.sentence]) }); }
      if (left.length) console.log('   PFX7 ' + id + ' statements not asked: ' + J(left));
      check(id + ': the delivered page asks every question its flagged statements (' + seen.length + ') make, at most 8 of them, near-duplicates and labels left out', v.questions >= own.length && own.length <= 8 && own.length >= Math.min(1, seen.length - left.filter(x => x.heading).length), J({ seen: seen.length, own: own.length, q: v.questions, left }));
    }
    const cs = [{ sentence: 'We are a Microsoft partner, so weigh our view of SAP with that in mind.', kind: 'credential', section: 'How does Dynamics 365 compare' },
      { sentence: 'Book a consultation and we will test your shortlist against these criteria: [speak to our ERP consultants](https://www.novaand-demo.com/contact-us).', kind: 'process', how: 'cta', neutral: 'Next step: [speak to our ERP consultants](https://www.novaand-demo.com/contact-us).' }];
    const docs = [{ source: 'https://www.novaand-demo.com/', text: 'Nova& is a Microsoft partner in the UAE. We deliver Dynamics 365.' }];
    const Q = await pf('questions', [{ claims: cs, brief: ['Is there a client result you can publish?'], brackets: [{ kind: 'credential', token: '[Exact Microsoft partner designation]', question: 'Please confirm for Nova&: exact Microsoft partner designation.' }], business: 'Nova&', final_md: 'Nova& helps UAE firms pick an edition.', docs, stored: [] }]);
    const c1 = Q.find(q => q.source === 'claim' && /Microsoft partner, so/.test(q.original));
    check('a claim question: the original sentence, what the page says instead, choices yes / edit / remove, never blocking', c1 && J(c1.choices) === J(['yes', 'edit', 'remove']) && c1.blocks === false && c1.in_page === 'left_out' && c1.answer_type === 'choice', J(c1));
    const c2 = Q.find(q => q.source === 'claim' && q.in_page === 'cta');
    check('the call to action keeps its link as the neutral wording until the client answers', c2 && /^Next step: \[speak to our ERP consultants\]/.test(c2.neutral), J(c2));
    check('prefilled from the client\'s own page when it says something close, with the source', c1.prefill === 'Nova& is a Microsoft partner in the UAE.' && c1.prefill_source === 'https://www.novaand-demo.com/', J({ p: c1.prefill, s: c1.prefill_source }));
    check('ranked by impact, every question with id, rank, impact and the business-fact key its answer fills (no limit on the count)', Q.every((q, i) => q.rank === i + 1 && q.id === 'q' + (i + 1) && q.impact > 0 && /^[a-z]+\.[\p{L}\p{N}_&]+$/u.test(q.fact_key)) && Q.every((q, i) => !i || Q[i - 1].impact >= q.impact) && Q.length === 4, J(Q.map(q => [q.rank, q.impact, q.fact_key])));
    const Q2 = await pf('questions', [{ claims: cs, business: 'Nova&', final_md: '', docs: [], stored: [c1.fact_key] }]);
    check('a question whose fact is already stored is not asked again on a later page', !Q2.some(q => q.fact_key === c1.fact_key) && Q2.length === 1, J(Q2.map(q => q.fact_key)));
    const del = await pf('deliver', [{ blocking: [], advisory: [{ code: 'length', text: 'x' }] }, { questions: Q }]);
    check('questions never block: no blocker + questions = ready_with_questions, publishable', del.status === 'ready_with_questions' && /^Ready to publish/.test(del.label) && !del.next_step, J(del));
  });

  // ---------- PFX8 the wiring ----------
  await guard('PFX8 wiring', async () => {
    const SN = 'PFX8 (H1) the generated wiring: Page Fix before every check, Page Candidates after it, edit / finalise / deliver, the source step before the Editor, free and retried';
    reset(); begin(SN); const check = mkCheck(SN);
    const C = W.connections;
    check('Refresh Sources and a complete edit go through Page Fix, then Promise Candidates', J(C['Refresh Sources']) === J([['Page Fix']]) && J(C['Edit Complete? (Editor)'][0]) === J(['Page Fix']) && J(C['Page Fix']) === J([['Promise Candidates']]), J([C['Refresh Sources'], C['Edit Complete? (Editor)']]));
    check('Originality Check -> Page Candidates -> Needs Revision? (edit) -> Page Source Plan / (else) Finalize Page? -> Page Fix (final check) or Build Word File',
      J(C['Originality Check']) === J([['Page Candidates']]) && J(C['Page Candidates']) === J([['Needs Revision?']]) && J(C['Needs Revision?']) === J([['Page Source Plan'], ['Finalize Page?']]) && J(C['Finalize Page?']) === J([['Page Fix'], ['Build Word File']]), J([C['Needs Revision?'], C['Finalize Page?']]));
    check('every route of the source step ends in Verified Sources, which alone feeds the Editor; the Editor\'s counted prompt reads it', J(C['Any Page Sources?']) === J([['Search Page Sources'], ['Verified Sources']]) && J(C['Any Source Pages?']) === J([['Fetch Page Sources'], ['Verified Sources']])
      && J(C['Verified Sources']) === J([['Editor']]) && W.editor_count_prompt_reads === 'Verified Sources', J(C['Verified Sources']));
    check('the IFs route on the pipeline\'s own decision', W.needs_revision === "={{ !!($json.page_fix && $json.page_fix.next === 'edit') }}" && W.finalize === "={{ !!($json.page_fix && $json.page_fix.next === 'finalize') }}");
    check('the two new HTTP nodes retry 3 times, 5 s apart, and never stop the run', Object.values(W.http).every(h => h.retryOnFail && Number(h.maxTries) === 3 && Number(h.waitBetweenTries) === 5000 && h.onError === 'continueRegularOutput'), J(W.http));
    const pfFix = fs.readFileSync(path.join(__dirname, 'code_v4', 'Page_Candidates.js'), 'utf8');
    check('at most 3 editing rounds, and the loop stops when a round improves nothing', /const EDIT_MAX = 3;/.test(pfFix) && /the last edit did not improve the page/.test(pfFix));
  });
};
