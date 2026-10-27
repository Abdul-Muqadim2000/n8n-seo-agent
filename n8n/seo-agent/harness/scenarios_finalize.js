// FIN1-FIN9 (H3, 2026-10-28, the page review; docs/content-quality-2026-10-27): "Make the final version" on the GENERATED code of the new
// workflow SEO Agent — Page Finalize (SEOagentFinalize, POST /webhook/seo-page-finalize) and the stored answers every later page carries.
// The model call (Finalize Editor, Claude Sonnet) is MOCKED: a section answer written here, a cut / unmarked one, or an answer that adds a
// claim nothing supports. The page is an anonymised guide (Nova&, novaand-demo.com); the request has the shape of the app's FinalizeBody
// (app/shared/src/page-review.ts). Called from scenarios_v5.js before the report (one line).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const WD = path.join(__dirname, '..', 'workflows');
  const wf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WD, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
  const BAD = /[—–“”…]/;
  const norm = (t) => String(t || '').replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%&]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const has = (md, t) => norm(md).includes(norm(t));

  // ---- the delivered page and the client's answers (anonymised) ----
  const CTA = 'Next step: [Book a consultation](https://www.novaand-demo.com/contact-us).';
  const DELIVERED = [
    '# How to choose a Dynamics 365 partner in the UAE', '',
    'Choosing a Dynamics 365 partner in the UAE decides how fast your ERP project goes live and how well it fits local VAT rules. This guide explains what to check before you sign.', '',
    '**Quick answer:** Pick a partner with current Microsoft credentials, UAE VAT experience and a clear support plan, and ask for references from companies of your size.', '',
    '## What a good partner brings', '',
    'Look for a partner that holds a current Microsoft designation. A strong partner explains licensing in plain words and maps your processes before any configuration starts. Many implementations take several months.', '',
    '## Choosing a partner', '',
    'Ask each partner how they handle data migration, training and the first month after go-live. Compare the answers side by side and keep notes for your finance team.', '',
    '## Support after go-live', '',
    'A good partner keeps a support team on call. Agree response times in writing and check who owns each fix. Check how releases are tested before they reach your users.', '',
    '## Talk to Nova&', '',
    CTA, ''].join('\n');
  const Q = {
    q1: { id: 'q1', fact_key: 'credential.microsoft_partner_since_2015', source: 'claim', original: 'Nova& has been a Microsoft partner since 2015.', neutral: 'Look for a partner that holds a current Microsoft designation.', in_page: 'neutral', section: 'What a good partner brings', question: 'Is this true for Nova&? "Nova& has been a Microsoft partner since 2015."' },
    q2: { id: 'q2', fact_key: 'service.book_consultation_review_erp', source: 'claim', original: 'Book a consultation and we will review your current ERP setup.', neutral: CTA, in_page: 'cta', section: 'Talk to Nova&', question: 'Is this true for Nova&?' },
    q3: { id: 'q3', fact_key: 'timeline.implementation_weeks', source: 'claim', original: 'Nova& implements Business Central in 8 weeks.', neutral: 'Many implementations take several months.', in_page: 'neutral', section: 'What a good partner brings', question: 'Is this true?' },
    q4: { id: 'q4', fact_key: 'service.support_team_on_call', source: 'claim', original: 'Nova& keeps a support team on call around the clock.', neutral: 'A good partner keeps a support team on call.', in_page: 'neutral', section: 'Support after go-live', question: 'Is this true?' },
    q5: { id: 'q5', fact_key: 'service.release_testing', source: 'claim', original: 'Nova& tests every release in a sandbox first.', neutral: 'Check how releases are tested before they reach your users.', in_page: 'neutral', section: 'Support after go-live', question: 'Is this true?' },
    q6: { id: 'q6', fact_key: 'proof.client_result_publish', source: 'brief', original: '', neutral: '', in_page: 'left_out', section: 'Choosing a partner', question: 'Is there a client result you are happy to publish?' },
    q7: { id: 'q7', fact_key: 'detail.office_hours', source: 'bracket', original: '', neutral: '', in_page: 'left_out', section: '', question: 'Please give us your office hours.' } };
  const RESULT = 'Nova& moved a 40-person distributor in Ajman to Business Central in 14 weeks.';
  const answer = (id, decision, text) => ({ ...Q[id], decision, text: text != null ? text : decision === 'yes' ? Q[id].original : '' });
  const bodyOf = (over) => ({ mode: 'finalize', request_id: 'app-fin-test', domain: 'novaand-demo.com', site_id: 'site_novaand-demo-com', keyword: 'dynamics 365 partner uae', country: 'United Arab Emirates', page_type: 'Blog Post / Guide',
    markdown: DELIVERED, delivered_markdown: DELIVERED, client_edited: false, meta: { title: 'Dynamics 365 Partner UAE: How to Choose', meta_description: 'What to check before you choose a Dynamics 365 partner in the UAE: credentials, VAT experience, support and references.', slug: 'dynamics-365-partner-uae', h1: 'How to choose a Dynamics 365 partner in the UAE' },
    answers: [], business_facts: 'Nova& is a Microsoft partner based in Ajman with offices in Faisalabad. Contact is by consultation request.', business_facts_kv: {}, stored_fact_keys: [], content_request_id: 'exec-1', ...(over || {}) });
  const editorSays = (sections) => mock('Finalize Editor', [{ json: { output: sections == null ? '' : { sections } } }]);
  const finalize = async (body, editor) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    let jobs = ap[0].json.finalize_apply.jobs;
    if (ap[0].json.needs_editor && editor) { const s = editor(jobs); if (s !== undefined) editorSays(s); }
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, ap: ap[0].json, mg: mg[0].json, qa: qa[0].json.content_qa, body: vd[0].json.body, jobs };
  };
  // a well-behaved section answer: the section with the task done (the fact as its own sentence at the end)
  const goodEditor = (extra) => (jobs) => jobs.map(j => ({ id: j.id, text: j.text.replace(/\s+$/, '') + '\n\n' + j.tasks.map(t => (t.match(/"([^"]+)"/) || [])[1]).filter(Boolean).join(' ') + (extra || '') }));
  const KEYS = ['ok', 'request_id', 'markdown', 'applied', 'sections_rewritten', 'changes', 'delivery_status', 'delivery', 'client_questions', 'grade', 'cost'];

  // ---------- FIN1 the workflow as generated ----------
  await guard('FIN1 wiring', async () => {
    const SN = 'FIN1 (H3) the Page Finalize workflow: header-auth webhook answering through Respond nodes (200 / 400), the content run\'s own Content QA and Originality Check, one Sonnet section editor behind the run ledger, no search data, no row but the ledger';
    reset(); begin(SN); const check = mkCheck(SN);
    const W = wf('SEO_Agent_Page_Finalize.json'); const N = Object.fromEntries(W.nodes.map(n => [n.name, n])); const C = W.connections;
    const hook = N['Finalize Webhook'];
    check('POST /webhook/seo-page-finalize, header auth with the SEO API Key credential, a fixed webhookId, answered by a Respond node', W.id === 'SEOagentFinalize' && hook.parameters.path === 'seo-page-finalize' && hook.parameters.authentication === 'headerAuth' && hook.parameters.responseMode === 'responseNode'
      && hook.credentials.httpHeaderAuth.id === 'SEOcredApiHeader' && !!hook.webhookId, J(hook.parameters));
    check('a bad request answers 400 with the reasons, the page answers 200', N['Respond Finalize Bad Request'].parameters.options.responseCode === 400 && N['Respond Finalize'].parameters.options.responseCode === 200 && C['Finalize OK?'].main[1][0].node === 'Respond Finalize Bad Request');
    const main = wf('SEO_Agent_v4.json').nodes;
    check('Content QA and Originality Check are the content run\'s own code, byte for byte', N['Content QA'].parameters.jsCode === main.find(n => n.name === 'Content QA').parameters.jsCode && N['Originality Check'].parameters.jsCode === main.find(n => n.name === 'Originality Check').parameters.jsCode);
    const model = N['Claude — Finalize Editor'];
    check('one Claude Sonnet model node (the section editor), declared in llm_limits (128,000, streaming, adaptive thinking, effort low)', model && model.parameters.model.value === 'claude-sonnet-5-5' && model.parameters.options.maxTokensToSample === 128000 && model.parameters.options.streaming === true && model.parameters.options.effort === 'low'
      && W.nodes.filter(n => n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic').length === 1, J(model && model.parameters.options));
    check('the editor runs only when an answer must be worked into the text (Needs Editor? false goes straight to the merge)', C['Needs Editor?'].main[0][0].node === 'Finalize Editor' && C['Needs Editor?'].main[1][0].node === 'Finalize Merge');
    const tables = [...new Set(W.nodes.filter(n => n.type === 'n8n-nodes-base.dataTable').map(n => ((n.parameters || {}).dataTableId || {}).value))];
    check('no DataForSEO call, no e-mail, no sub-workflow; the only tables it touches are the run ledger, its alert sweep and the cost factors', !W.nodes.some(n => n.type === 'n8n-nodes-base.httpRequest' && /dataforseo\.com\/v3\/(serp|dataforseo_labs|keywords_data|backlinks|on_page)/.test(String((n.parameters || {}).url || '')) || n.type === 'n8n-nodes-base.emailSend' || n.type === 'n8n-nodes-base.executeWorkflow')
      && tables.every(t => [undefined, 'seo_run_ledger', 'seo_ops_alerts', 'seo_cache'].includes(t)) && W.nodes.filter(n => n.type === 'n8n-nodes-base.dataTable' && !(n.parameters.dataTableId || {}).value).every(n => /^Ensure (Run Ledger|Ops Alerts) \(/.test(n.name)), J(tables));   // an Ensure node names its table in its own parameters
    const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deploy_manifest.json'), 'utf8'));
    check('deploy_manifest.json imports and publishes it', M.workflows.includes('SEO_Agent_Page_Finalize.json') && M.publish.includes('SEOagentFinalize') && !M.never_deploy.includes('SEOagentFinalize'));
    const LW = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger_wiring.json'), 'utf8')).monitors['SEO Agent — Page Finalize'];
    check('the ledger reserves a page_finalize row before the model call, never refuses a waiting caller (no_gate), buys no search data (no_dfs)', !!LW && LW.mode === 'page_finalize' && LW.no_gate === true && LW.no_dfs === true && LW.plan === 'Finalize Plan', J(LW && { mode: LW.mode, plan: LW.plan }));
    check('no em dash, curly quote or ellipsis character in the code this workflow adds (v5/code/Finalize_*.js, the stored-answers kit, the prompt)', ['code/Finalize_Parse_Brief.js', 'code/Finalize_Apply.js', 'code/Finalize_Merge.js', 'code/Finalize_Verdict.js', 'code/_fact_answers.js', 'prompts/finalize_editor.txt'].every(f => !BAD.test(fs.readFileSync(path.join(__dirname, '..', 'v5', f), 'utf8'))));
  });

  // ---------- FIN2 every decision ----------
  await guard('FIN2 decisions', async () => {
    const SN = 'FIN2 (H3) every decision: yes restores the specific sentence, a call-to-action keeps its link, edit takes the client\'s wording, remove deletes, general and skip change nothing, an answer is worked into its section by the editor';
    reset(); begin(SN); const check = mkCheck(SN);
    const answers = [answer('q1', 'yes'), answer('q2', 'yes'), answer('q3', 'edit', 'Our typical Business Central project takes 12 to 16 weeks.'), answer('q4', 'remove'), answer('q5', 'general'), answer('q6', 'answer', RESULT), answer('q7', 'skip')];
    const R = await finalize(bodyOf({ answers }), goodEditor());
    const md = R.body.markdown; const how = Object.fromEntries(R.body.applied.map(a => [a.id, a.how]));
    console.log('   applied ->', J(how), '| rewritten', J(R.body.sections_rewritten), '| status', R.body.delivery_status);
    check('yes: "Nova& has been a Microsoft partner since 2015." replaced the neutral wording', has(md, Q.q1.original) && !has(md, Q.q1.neutral) && how.q1 === 'kept_original', md.slice(0, 600));
    check('yes on a call to action: the specific sentence is back and the consultation link stays on the page', has(md, Q.q2.original) && /\]\(https:\/\/www\.novaand-demo\.com\/contact-us\)/.test(md) && how.q2 === 'kept_original', md.slice(-300));
    check('edit: the client\'s own wording, word for word, instead of the neutral sentence', has(md, 'Our typical Business Central project takes 12 to 16 weeks.') && !has(md, Q.q3.neutral) && how.q3 === 'client_wording');
    check('remove: the sentence is gone and nothing replaces it', !has(md, Q.q4.neutral) && !has(md, Q.q4.original) && how.q4 === 'removed');
    check('general and skip: nothing changes', has(md, Q.q5.neutral) && how.q5 === 'left_general' && how.q7 === 'skipped');
    check('answer: the editor worked the client result into "Choosing a partner" only', has(md, RESULT) && how.q6 === 'woven' && R.body.sections_rewritten.length === 1 && R.jobs.length === 1 && /Choosing a partner/.test(R.jobs[0].heading), J(R.jobs.map(j => j.heading)));
    check('every other section is as delivered', ['Ask each partner how they handle data migration'].every(t => md.includes(t)) && has(md, 'Agree response times in writing and check who owns each fix.'), md.slice(md.indexOf('## Support')));
    check('the answer has the FinalizeResult keys, writes nothing, and its words carry no em dash, curly quote or ellipsis character', KEYS.every(k => k in R.body) && R.body.writes === 'none' && !BAD.test(J(R.body.delivery) + J(R.body.client_questions)), J(Object.keys(R.body)));
    check('the meta lines the app did not send are not in the answer, the H1 is', !/^(Title|Meta Description|Slug):/m.test(md) && /^# How to choose a Dynamics 365 partner in the UAE$/m.test(md));
    check('nothing the client confirmed is flagged: ready (or ready with new questions), never not ready', R.body.delivery_status !== 'not_ready' && !R.body.delivery.blocking.length, J(R.body.delivery.blocking));
    check('one model call, priced by the cost kit and labelled estimated; no search data', R.body.cost.model_calls === 1 && R.body.cost.claude_usd > 0 && R.body.cost.dfs_usd === 0 && R.body.cost.estimated === true, J(R.body.cost));
    check('the grade is of this version (content score of the final check), with its basis', R.body.grade.score === R.qa.content_score && /final version/.test(R.body.grade.basis));
  });

  // ---------- FIN3 no editor needed ----------
  await guard('FIN3 swaps only', async () => {
    const SN = 'FIN3 (H3) answers that are sentence swaps need no model: no editor call, $0, model_calls 0, ready';
    reset(); begin(SN); const check = mkCheck(SN);
    const R = await finalize(bodyOf({ answers: [answer('q1', 'yes'), answer('q4', 'remove'), answer('q5', 'general')] }), () => { throw new Error('the editor must not be called'); });
    check('no edit job, no model call, cost 0', R.ap.needs_editor === false && R.body.cost.model_calls === 0 && R.body.cost.claude_usd === 0 && R.body.sections_rewritten.length === 0, J(R.body.cost));
    check('the swaps are applied', has(R.body.markdown, Q.q1.original) && !has(R.body.markdown, Q.q4.neutral) && R.body.delivery_status !== 'not_ready', J(R.body.delivery));
  });

  // ---------- FIN4 a cut or unusable editor answer ----------
  await guard('FIN4 cut editor', async () => {
    const SN = 'FIN4 (H3) a cut, unmarked or lossy editor answer never replaces a section: the deterministic page is kept and a confirmed sentence is still placed';
    reset(); begin(SN); const check = mkCheck(SN);
    const q1Left = { ...answer('q1', 'yes'), neutral: '', in_page: 'left_out' };
    for (const [label, editor] of [['no answer at all', () => null], ['an answer with no section', () => [{ id: 's9', text: '## Other\n\nText.' }]],
      ['a section cut short', (jobs) => jobs.map(j => ({ id: j.id, text: j.text.split('\n')[0] + '\n\nAsk each' }))],
      ['a section that dropped the confirmed sentence', (jobs) => jobs.map(j => ({ id: j.id, text: j.text }))]]) {
      const R = await finalize(bodyOf({ answers: [q1Left, answer('q6', 'answer', RESULT)] }), editor);
      const how = Object.fromEntries(R.body.applied.map(a => [a.id, a.how]));
      check(label + ': no section rewritten, the confirmed partner sentence still on the page, the client result reported as not placed', R.body.sections_rewritten.length === 0 && has(R.body.markdown, Q.q1.original) && how.q6 === 'not_placed'
        && R.body.markdown.includes('Ask each partner how they handle data migration, training and the first month after go-live.'), J({ how, rw: R.body.sections_rewritten }));
    }
  });

  // ---------- FIN5 the client's own words ----------
  await guard('FIN5 client text', async () => {
    const SN = 'FIN5 (H3) a sentence the client wrote in the editor is the client\'s word: on file for the claim check, never flagged, never rewritten, kept by the merge';
    reset(); begin(SN); const check = mkCheck(SN);
    const MINE = 'Nova& runs every Business Central project from its Ajman office with a named project lead.';
    const edited = DELIVERED.replace('Compare the answers side by side and keep notes for your finance team.', 'Compare the answers side by side and keep notes for your finance team. ' + MINE);
    const R = await finalize(bodyOf({ markdown: edited, client_edited: true, answers: [answer('q6', 'answer', RESULT)] }), (jobs) => jobs.map(j => ({ id: j.id, text: j.text.replace(MINE, 'Nova& runs projects.') + '\n\n' + RESULT })));
    check('the client\'s sentence is recorded as theirs and is in the facts the check reads', R.pb.finalize.client_sentences.some(s => s.includes('named project lead')) && R.pb.business_facts.includes('named project lead'), J(R.pb.finalize.client_sentences));
    check('an edit that changed the client\'s sentence is refused; the sentence stays word for word', R.body.markdown.includes(MINE) && R.body.sections_rewritten.length === 0, J(R.body.sections_rewritten));
    const flagged = (R.qa.business_promises || []).concat(R.qa.business_claims || []).map(b => b.sentence);
    check('the claim check does not flag it and nothing blocks', !flagged.some(s => /named project lead/.test(s)) && !R.body.delivery.blocking.some(b => /named project lead/.test(b.text)), J(flagged));
  });

  // ---------- FIN6 a claim the editor added ----------
  await guard('FIN6 system claim', async () => {
    const SN = 'FIN6 (H3) a statement the EDITOR added that nothing supports is taken back by the system and asked as a new question; stored and answered keys never come back';
    reset(); begin(SN); const check = mkCheck(SN);
    const ADDED = ' Nova& guarantees a live system within 30 days or refunds the project fee in full.';
    const R = await finalize(bodyOf({ answers: [answer('q6', 'answer', RESULT)] }), goodEditor(ADDED));
    console.log('   questions ->', J(R.body.client_questions.map(q => [q.id, q.fact_key])), '| status', R.body.delivery_status);
    check('the added guarantee is not on the delivered page', !has(R.body.markdown, 'refunds the project fee in full'), R.body.markdown.slice(-900));
    check('the client result the client gave is kept', has(R.body.markdown, RESULT));
    const fk = new Set(R.body.client_questions.map(q => q.fact_key));
    check('every new question has an id of its own (f1...) and is never one of the answered ids', R.body.client_questions.every(q => /^f\d+$/.test(q.id) && !['q6'].includes(q.id)));
    if (R.body.client_questions.length) {
      const R2 = await finalize(bodyOf({ answers: [answer('q6', 'answer', RESULT)], stored_fact_keys: [...fk] }), goodEditor(ADDED));
      check('with those fact keys stored on the website, the same run asks nothing again', R2.body.client_questions.length === 0, J(R2.body.client_questions));
    } else check('the guarantee went as a statement nobody may make (no question needed)', R.body.changes.some(c => /refunds the project fee/.test(c.before)), J(R.body.changes));
  });

  // ---------- FIN7 bad requests ----------
  await guard('FIN7 bad request', async () => {
    const SN = 'FIN7 (H3) a malformed request is refused with its reasons (the 400 the webhook answers), nothing runs';
    reset(); begin(SN); const check = mkCheck(SN);
    const cases = [['no domain', { domain: '' }, /domain is required/], ['no page', { markdown: '' }, /markdown is required/], ['a page too short', { markdown: '# X\n\nShort.' }, /fewer than 50 words/],
      ['an unknown decision', { answers: [{ ...Q.q1, decision: 'maybe', text: '' }] }, /decision must be one of/], ['an edit with no text', { answers: [{ ...Q.q3, decision: 'edit', text: '' }] }, /text is required for edit/],
      ['answers not a list', { answers: { q1: 'yes' } }, /answers must be an array/], ['HTML in an answer', { answers: [{ ...Q.q3, decision: 'edit', text: 'Our <b>team</b> is big.' }] }, /plain text/],
      ['the same id twice', { answers: [answer('q1', 'yes'), answer('q1', 'general')] }, /given twice/], ['a page over 200,000 characters', { markdown: 'word '.repeat(41000) }, /longer than 200000/]];
    for (const [label, over, re] of cases) { const R = await finalize(bodyOf(over)); check(label + ': refused', R.bad && R.bad.ok === false && re.test(R.bad.error), J(R.bad || R.body && R.body.delivery_status)); }
  });

  // ---------- FIN8 the stored answers reach every page run ----------
  await guard('FIN8 stored answers', async () => {
    const SN = 'FIN8 (H3) the stored answers: Normalize Input takes business_facts_kv / stored_fact_keys by their exact keys whatever the key order, the page run\'s facts carry them, they reach Parse Brief, Page Candidates never asks a stored key, PJ.ownText reads them';
    reset(); begin(SN); const check = mkCheck(SN);
    delete store['Start Form'];
    // key order on purpose: the kv object and the flag BEFORE business_facts / existing_page_url (the fuzzy picks look for "facts" and "existing")
    const body = { mode: 'keyword', keyword: 'dynamics 365 partner uae', country: 'United Arab Emirates', domain: 'novaand-demo.com', business: 'Dynamics 365 partner', customers: 'Finance teams',
      business_facts_kv: { 'credential.microsoft_partner_since_2015': 'Nova& has been a Microsoft partner since 2015.', 'bad key!': 'x' }, stored_fact_keys: ['credential.microsoft_partner_since_2015', 'service.release_testing', 'bad key!'],
      existing_page_ours: true, business_facts: 'Offices in Ajman and Faisalabad.', existing_page_url: 'https://www.novaand-demo.com/insights/old-page', receive: ['Keyword Report', 'Page Content'], callback_url: 'https://hooks.example.com/x', request_id: 'fin8' };
    const n = (await run('Normalize Input', { body }))[0].json;
    check('the kv and the keys are taken, validated (a bad key dropped)', J(n.business_facts_kv) === J({ 'credential.microsoft_partner_since_2015': 'Nova& has been a Microsoft partner since 2015.' }) && J(n.stored_fact_keys) === J(['credential.microsoft_partner_since_2015', 'service.release_testing']), J({ kv: n.business_facts_kv, k: n.stored_fact_keys }));
    check('business_facts is the text, never the kv object, and carries the confirmed answer', /^Offices in Ajman and Faisalabad\./.test(n.business_facts) && n.business_facts.includes('Microsoft partner since 2015') && !/object Object/.test(n.business_facts), n.business_facts);
    check('existing_page_url is the address, never the flag; existing_page_ours is carried', n.existing_page_url === 'https://www.novaand-demo.com/insights/old-page' && n.existing_page_ours === true, J({ u: n.existing_page_url, o: n.existing_page_ours }));
    const n2 = (await run('Normalize Input', { body: { ...body, business_facts_kv: 'not an object', stored_fact_keys: 'credential.a, proof.b', existing_page_ours: true, existing_page_url: '' } }))[0].json;
    check('a malformed kv is an empty one (never an error), keys as a comma list are read, ours without a page is false', J(n2.business_facts_kv) === '{}' && J(n2.stored_fact_keys) === J(['credential.a', 'proof.b']) && n2.existing_page_ours === false);
    // the data path Normalize Input -> Parse Brief: every Code node on it hands its predecessor's item on (a `...x` spread of $input or of $('Pred'))
    const W = wf('SEO_Agent_v4.json'); const N = Object.fromEntries(W.nodes.map(x => [x.name, x])); const pred = {};
    for (const [a, o] of Object.entries(W.connections)) for (const l of ((o.main) || [])) for (const t of (l || [])) (pred[t.node] = pred[t.node] || []).push(a);
    let cur = 'Parse Brief', hops = 0, reached = false; const walk = [];
    while (cur && hops++ < 120) { walk.push(cur); if (cur === 'Normalize Input') { reached = true; break; }
      const src = String((N[cur].parameters || {}).jsCode || '');
      const refs = [...src.matchAll(/const (\w+) = \$\('([^']+)'\)\.first\(\)\.json/g)].filter(m => new RegExp('\\.\\.\\.' + m[1] + '\\b').test(src)).map(m => m[2]);
      cur = refs[0] || (pred[cur] || [])[0]; }
    check('Parse Brief reads, through spreads and main connections, back to Normalize Input', reached, walk.join(' <- '));
    // Page Candidates (the final version) never asks a stored key
    const pf = async (fn, args) => (await run('PF Kit', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
    const claims = [{ sentence: 'Nova& has been a Microsoft partner since 2015.', kind: 'credential' }, { sentence: 'Nova& tests every release in a sandbox first.', kind: 'process' }];
    const all = await pf('questions', [{ claims, brief: [], brackets: [], business: 'Nova&', final_md: '', docs: [], stored: [] }]);
    const kept = await pf('questions', [{ claims, brief: [], brackets: [], business: 'Nova&', final_md: '', docs: [], stored: all.map(q => q.fact_key).slice(0, 1) }]);
    check('PF.questions skips a stored fact key', all.length === 2 && kept.length === 1 && kept[0].fact_key === all[1].fact_key, J({ all: all.map(q => q.fact_key), kept: kept.map(q => q.fact_key) }));
    const pc = String(N['Page Candidates'].parameters.jsCode);
    check('Page Candidates passes prev.stored_fact_keys to the question builder', /prev\.stored_fact_keys/.test(pc) && /stored \}\)/.test(pc));
    const PJ = (await run('PJ Kit', [{ json: { fn: 'ownText', args: [{ business_facts: 'x', business_facts_kv: { a: 'Nova& has been a Microsoft partner since 2015.' } }, null] } }], { code: '_promise_judge' }))[0].json.r;
    check('the claim corpus (PJ.ownText) reads the stored answers', /partner since 2015/.test(PJ), PJ);
    // the ladder's first pages carry them on, and say whether the page refreshed is ours
    const sp = String(N['Spawn Page Runs'].parameters.jsCode);
    check('Spawn Page Runs sends business_facts_kv, stored_fact_keys and existing_page_ours (from the ladder\'s content-log load)', /business_facts_kv: kvOf, stored_fact_keys: keysOf/.test(sp) && /existing_page_ours: !!\(p\.exists/.test(sp) && /Load Content Log \(Ladder\)/.test(sp));
  });

  // ---------- FIN9 Site Admin and the Content Cadence ----------
  await guard('FIN9 site admin + cadence', async () => {
    const SN = 'FIN9 (H3) Site Admin `facts` stores fact_answers (only when sent); the Content Cadence\'s page runs carry them and say when the page refreshed is one the system wrote';
    reset(); begin(SN); const check = mkCheck(SN);
    const FA_IN = { 'credential.microsoft_partner_since_2015': { decision: 'yes', text: 'Nova& has been a Microsoft partner since 2015.' }, 'service.release_testing': { decision: 'general', text: 'ignored' }, 'service.x': { decision: 'remove' }, 'bad key!': { decision: 'yes', text: 'x' }, 'proof.y': { decision: 'maybe', text: 'x' } };
    const a = (await run('Admin Action', { body: { action: 'facts', domain: 'novaand-demo.com', business_facts: 'Offices in Ajman.', fact_answers: FA_IN } }))[0].json;
    const stored = JSON.parse(a.fact_answers_json);
    check('the answers are stored as JSON: decisions kept, general / remove keep no text, bad keys and decisions dropped and counted', a.fact_answers_sent === true && J(Object.keys(stored).sort()) === J(['credential.microsoft_partner_since_2015', 'service.release_testing', 'service.x'])
      && stored['service.release_testing'].text === '' && a.fact_answers_dropped === 2, a.fact_answers_json);
    const a2 = (await run('Admin Action', { body: { action: 'facts', domain: 'novaand-demo.com', business_facts: 'Offices in Ajman.' } }))[0].json;
    check('a facts save without fact_answers does not touch the stored answers', a2.fact_answers_sent === false);
    let threw = false; try { await run('Admin Action', { body: { action: 'facts', domain: 'novaand-demo.com', business_facts: '', fact_answers: ['x'] } }); } catch (e) { threw = /fact_answers must be an object/.test(String(e.message)); }
    { const r = H.results[H.results.length - 1]; if (threw && r && r.node === 'Admin Action' && !r.ok) { r.ok = true; r.error = 'threw as expected: ' + String(r.error).slice(0, 90); } }
    check('a list instead of an object is refused', threw);
    const W = wf('SEO_Agent_Site_Admin.json'); const C = W.connections; const N = Object.fromEntries(W.nodes.map(x => [x.name, x]));
    check('Set Business Facts -> Fact Answers Sent? -> Set Fact Answers (seo_sites.fact_answers_json) -> Admin Result', C['Set Business Facts'].main[0][0].node === 'Fact Answers Sent?' && C['Fact Answers Sent?'].main[0][0].node === 'Set Fact Answers'
      && C['Fact Answers Sent?'].main[1][0].node === 'Admin Result' && J(N['Set Fact Answers'].parameters).includes('fact_answers_json'));
    const TC = require('./table_cols.json'); check('seo_sites has the column fact_answers_json', (TC.SITES || []).includes('fact_answers_json'), J(Object.keys(TC)));
    // the cadence: a fixture case whose pick refreshes an existing page, with that page in the content log as published and stored answers on the site
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
    const RealDate = Date; const frozen = async (iso, fn) => { const T = RealDate.parse(iso); class FD extends RealDate { constructor(...x) { if (x.length) super(...x); else super(T); } static now() { return T; } } global.Date = FD; try { return await fn(); } finally { global.Date = RealDate; } };
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const plan = async (c) => { reset(); const t = c.tables || {}; mock('Manual Run', [{ json: c.trigger || {} }]);
      for (const [k, v] of [['Load Sites', t.sites], ['Load Cadence', t.cadence], ['Load Ladders', t.ladders], ['Load Query History', t.query_history], ['Load Trends', t.trends], ['Load Content Log', t.content_log], ['Load Ladder Settings', t.ladder_settings],
        ['Load Main Keyword Ranks', t.ranks], ['Load AI Targets (Cadence)', t.ai_targets], ['Load AI Targets Writing (Cadence)', []], ['Load Monitors (Cadence)', t.monitors], ['Load Pages (Cadence)', t.pages], ['Load AI Brands (Cadence)', t.ai_brands],
        ['Load Skips (Cadence)', t.skips], ['Load Cost (Cadence)', t.cost], ['Load Cycle Jobs (Cadence)', t.cycle_jobs], ['Load Profiles (Cadence)', t.profiles]]) mock(k, items(v));
      return frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json).filter(j => j.body)); };
    let found = null;
    for (const c of FX.cases) { const picks = await plan(c); const p = picks.find(j => j.body.existing_page_url); if (p) { found = { c, p }; break; } }
    check('a fixture case refreshes an existing page', !!found);
    if (found) {
      const c = JSON.parse(JSON.stringify(found.c)); const url = found.p.body.existing_page_url; const host = url.replace(/^https?:\/\/(www\.)?/, 'https://www.');
      c.tables.sites = c.tables.sites.map(s => ({ ...s, fact_answers_json: a.fact_answers_json }));
      check('without a content-log row the page is not ours', found.p.body.existing_page_ours === false && J(found.p.body.business_facts_kv) === '{}' && J(found.p.body.stored_fact_keys) === '[]', J({ o: found.p.body.existing_page_ours }));
      c.tables.content_log = (c.tables.content_log || []).concat([{ site_id: c.tables.sites[0].site_id, domain: c.tables.sites[0].domain, keyword: 'an older page', source: 'cadence', status: 'published', published_url: host + '/', started_at: '2026-09-01T00:00:00.000Z', request_id: 'old1' }]);
      const p2 = (await plan(c)).find(j => j.body.existing_page_url === url);
      check('with the page live in the content log (www and a trailing slash do not matter) it is ours, and the stored answers travel with the run', !!p2 && p2.body.existing_page_ours === true
        && J(p2.body.business_facts_kv) === J({ 'credential.microsoft_partner_since_2015': 'Nova& has been a Microsoft partner since 2015.' }) && J(p2.body.stored_fact_keys) === J(['credential.microsoft_partner_since_2015', 'service.release_testing', 'service.x']), J(p2 && { o: p2.body.existing_page_ours, kv: p2.body.business_facts_kv, k: p2.body.stored_fact_keys }));
      const keys = Object.keys(p2 ? p2.body : {}); check('business_facts comes before business_facts_kv in the body (Normalize Input\'s pick looks for "facts")', keys.indexOf('business_facts') >= 0 && keys.indexOf('business_facts') < keys.indexOf('business_facts_kv'));
    }
  });
};
