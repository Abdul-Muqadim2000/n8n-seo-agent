// W05C1-W05C7 (W05-C, page-quality programme 2026-10-30, docs/page-quality-2026-10-29/BEFORE_AFTER.md K6 row, "Finalize" table, headline
// item 5; build section 172). The guide both blind judges liked best fell 3 points after Wave 0 and the final version still took 1.8 points
// off a page. Each cause was read off the BEFORE / AFTER executions and is pinned here on anonymised, K-shaped cases (Acme, Nova&, *.example;
// no client text) and on the ranking guide 949:
//   W05C1 a sourced figure is never made vague (K6: "39% to 66%" became "rose sharply" in editor round 3 on a "rewrite without the number"
//         job; the Critic's "drop the figure" too); Content QA records the figures a cited source states
//   W05C2 no padding: no subtopic while the page is over its length, never a rhetorical heading, a paragraph by default; the prompts
//   W05C3 the questions: near-duplicates go, a heading is never asked about, at most 8, ranked (K6 asked 20)
//   W05C4 the finalize kit: PF.fragment, PF.ctaSentence, PF.finalGuard on the five splices the judges named
//   W05C5 Finalize Apply / Merge end to end (mocked editor): a fragment or a heading is never put into prose, a list item keeps its bullet,
//         no second call to action, an edit that splices a label into a paragraph is refused
//   W05C6 the ranking guide 949 keeps every figure, section and link through all of it
//   W05C7 the wiring (build section 172) and the built prompts
// Called from scenarios_v5.js before the report.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const show = (label, v) => console.log('   W05-C ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const pf = async (fn, args) => (await run('PF Kit', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const WF = (f) => { const w = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
  const figsOf = (t) => (String(t).replace(/\]\([^)]*\)/g, ']').match(/\d[\d,.]*\s?%?/g) || []).map(x => x.replace(/\s/g, '').replace(/[.,]$/, ''));   // every number in the text (dates, counts, percentages), links aside
  const linksOf = (t) => (String(t).match(/\]\((https?:\/\/[^)\s]+)\)/g) || []);
  const headsOf = (t) => (String(t).match(/^#{1,4}\s.+$/gm) || []);

  // ---------- the K6 shape, anonymised ----------
  const SRC = 'https://www.vendorco.example/news/stories/ai-service-agents-survey/';
  const S_NAMED = 'Adoption of AI agents in customer service teams rose 1.7x from 2025 to 2026, from 39% to 66% ([Vendorco](' + SRC + ')).';
  const S_GENERIC = 'Adoption of AI agents in customer service teams rose 1.7x from 2025 to 2026, from 39% to 66% ([source](' + SRC + ')).';
  const S_VAGUE = 'Adoption of AI agents in customer service teams rose sharply from 2025 to 2026 ([Vendorco](' + SRC + ')).';
  const page = (s) => ['Title: How to build an AI support agent', 'Meta Description: How to build an AI agent for customer support, step by step, with the checks UAE teams need before launch.', 'Slug: ai-support-agent', '',
    '# How to build an AI agent for customer support', '', 'Support queues repeat the same few questions, which suits a language model. ' + s, '', '**Quick answer:** pick one request, ground the model, test it, then pilot it.', '',
    '## What is an AI support agent?', '', 'An AI support agent answers in natural language and takes allowed actions through your systems.', '',
    '## How do you test it?', '', 'Build a test set from past tickets before launch.', '', '## Start a project with Acme', '', 'To discuss your use case, [start a project](https://www.acme.example/contact-us).', ''].join('\n');
  const QA = { outbound_links: [{ url: SRC, tier: 'weak', host: 'vendorco.example' }], verified_figures: [{ figure: '39%', sources: ['vendorco.example'] }, { figure: '66%', sources: ['vendorco.example'] }], main_content_words: 120 };
  const CTX = { domain: 'acme.example', keyword: 'how to build an ai agent for customer support', names: ['Acme'], business: 'Acme' };

  await guard('W05C1 sourced figures', async () => {
    const SN = 'W05C1 (W05-C, BEFORE_AFTER K6) a figure its own linked source states is a sourced figure: advice, never "rewrite without the number"; a generic link is named after its source; an edit that drops it is not kept; the Critic\'s "drop the figure" is not passed on';
    reset(); begin(SN); const check = mkCheck(SN);
    const named = await pf('classify', [QA, page(S_NAMED), CTX]);
    check('the source named in the sentence and stating the figure: no blocker, one advisory line that keeps the number', !named.blocking.some(b => b.code === 'weak_figure') && named.advisory.some(a => a.code === 'weak_figure_named' && /kept as written/.test(a.text)), J({ b: named.blocking, a: named.advisory.map(a => a.code) }));
    const generic = await pf('classify', [QA, page(S_GENERIC), CTX]);
    const wf = generic.blocking.filter(b => b.code === 'weak_figure');
    check('a generic "[source]" link: still a soft blocker, marked verified', wf.length === 1 && wf[0].verified === true && wf[0].tier === 'soft', J(wf));
    const job = await pf('plan', [page(S_GENERIC), generic, QA, CTX]);
    const probs = job.sections.flatMap(s => s.problems).filter(p => /39%/.test(p));
    check('the editor is told to keep the number and name who measured it, never to rewrite it without the number or with a vague word', probs.length === 1 && /keep the number exactly as written/.test(probs[0]) && /Never replace the number with a vague word/.test(probs[0]) && !/rewrite the sentence without the number/.test(probs[0]), J(probs));
    const N = await pf('neutralize', [page(S_GENERIC), generic, CTX]);
    check('if it is still generic at the end, the system names the link after its source and keeps the figure (never takes the sentence out)', N.md.includes('from 39% to 66% ([vendorco.example](' + SRC + '))') && N.removed.some(r => r.code === 'weak_figure' && r.how === 'attributed'), J(N.removed));
    const res = await pf('residual', [generic, N.md]);
    check('after that no weak figure is open', !res.blocking.some(b => b.code === 'weak_figure'), J(res.blocking.map(b => b.code)));
    const unv = await pf('classify', [{ ...QA, verified_figures: [] }, page(S_GENERIC), CTX]);
    const ujob = await pf('plan', [page(S_GENERIC), unv, { ...QA, verified_figures: [] }, CTX]);
    const up = ujob.sections.flatMap(s => s.problems).filter(p => /39%/.test(p));
    check('a figure no source we read states (W0-H unchanged): rewrite without the number, and never with a vague word in its place', up.length === 1 && /rewrite the sentence without the number/.test(up[0]) && /never put a vague word such as "sharply"/.test(up[0]), J(up));
    // K6 round 3: the edit that turned the figure vague is not kept
    const best = { score: await pf('score', [named]), protect: await pf('protect', [page(S_NAMED), QA, CTX]), cls: { band: null } };
    const vagueQa = { ...QA, verified_figures: [] };
    const cand = { score: await pf('score', [await pf('classify', [vagueQa, page(S_VAGUE), CTX])]), protect: await pf('protect', [page(S_VAGUE), vagueQa, CTX]), cls: { band: null } };
    const cmp = await pf('better', [cand, best]);
    check('the K6 round-3 edit ("rose sharply") is set aside: it lost the sourced figures', cmp.better === false && /sourced figures? 39%, 66%/.test(cmp.why), J(cmp));
    const keep = { score: cand.score, protect: await pf('protect', [page(S_NAMED.replace('Adoption of', 'The adoption of')), QA, CTX]), cls: { band: null } };
    check('an edit that keeps the figure is judged as before (no false refusal)', !/sourced figure/.test((await pf('better', [keep, best])).why));
    const crit = { problems: [{ severity: 'high', location: 'Adoption of AI agents in customer service teams rose 1.7x', issue: 'A vendor page is the only source.', fix: 'Cite a research house page that states 39% to 66% exactly, or drop the figure and the attribution.' }] };
    const cj = await pf('plan', [page(S_NAMED), named, QA, { ...CTX, critique: crit }]);
    check('the Critic\'s "drop the figure" is not passed on for a sourced figure', !cj.sections.flatMap(s => s.problems).some(p => /drop the figure/.test(p)), J(cj.sections.map(s => s.problems)));
    const cu = await pf('plan', [page(S_NAMED), named, { ...QA, verified_figures: [] }, { ...CTX, critique: crit }]);
    check('... and still passed on when the figure was not found in its source', cu.sections.flatMap(s => s.problems).some(p => /drop the figure/.test(p)), J(cu.sections.map(s => s.problems)));
    // Content QA records the figures a cited source states (replay of page run 3299's first draft on the current code)
    const F99 = R.load('replay_3299.json.gz');
    const q0 = (await R.replay(F99, 'Content QA', 0)).first.content_qa || {};
    show('3299 first draft: figures its cited sources state', (q0.verified_figures || []).slice(0, 6));
    check('Content QA carries verified_figures (an array of { figure, sources }) beside unverified_figures', Array.isArray(q0.verified_figures) && Array.isArray(q0.unverified_figures) && q0.verified_figures.every(v => v && typeof v.figure === 'string' && Array.isArray(v.sources)), J(q0.verified_figures));
    check('no figure is both verified and unverified', !(q0.verified_figures || []).some(v => (q0.unverified_figures || []).some(u => String(u.figure) === String(v.figure))), J({ v: q0.verified_figures, u: q0.unverified_figures }));
  });

  await guard('W05C2 no padding', async () => {
    const SN = 'W05C2 (W05-C, BEFORE_AFTER K6) no padding: a competitor\'s rhetorical heading is never a subtopic, nothing is added while the page is over its length, a subtopic gets a paragraph by default';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = page(S_NAMED);
    const subs = ['Why Most Customer Support is Ripe for AI Disruption', 'The Strategic Importance of Automating Tier-1 and Tier-2 Support', 'LLMs: A Breakthrough in Conversation Quality', 'What is an AI support agent', 'Prepare and Train Your Data'];
    const qaU = { ...QA, main_content_words: 120, length_band: { low: 100, high: 400 }, coverage_pct: 40, coverage_target_pct: 70, missing_subtopics: subs, missing_terms: [] };
    const cU = await pf('classify', [qaU, md, CTX]);
    const pU = (await pf('plan', [md, cU, qaU, CTX])).sections.flatMap(s => s.problems).filter(p => /subtopic/i.test(p));
    show('subtopic jobs under the band', pU);
    check('only the real subtopic is asked for ("Prepare and Train Your Data"); the rhetorical headings and the one a heading already covers are not', pU.length === 1 && /Prepare and Train Your Data/.test(pU[0]), J(pU));
    check('... as a paragraph, a heading only when it is a step or decision of its own (never "a paragraph or an H3")', /in a paragraph inside this section/.test(pU[0]) && !/a paragraph or an H3/.test(pU[0]), pU[0]);
    const qaO = { ...qaU, main_content_words: 900 };
    const cO = await pf('classify', [qaO, md, CTX]);
    const jO = await pf('plan', [md, cO, qaO, CTX]);
    check('over its length band: no subtopic is added (the cut wins), and terms go into existing sentences', !jO.sections.flatMap(s => s.problems).some(p => /subtopic/i.test(p)), J(jO.sections.map(s => s.problems)));
  });

  await guard('W05C3 questions', async () => {
    const SN = 'W05C3 (W05-C, BEFORE_AFTER: K6 asked 20 questions) near-duplicates go, a heading is never asked about, at most 8, ranked';
    reset(); begin(SN); const check = mkCheck(SN);
    const sec = 'How do you stop an AI agent from giving wrong answers?';
    const items = ['Core intents in English, phrased the way customers actually write them.', 'Your core intents in English, phrased the way your customers actually write them.',
      'The same intents in Arabic, Gulf dialect and mixed language.', 'Those same intents in Arabic, Gulf dialect and mixed language.', 'Paraphrases, typos and voice-to-text errors.', 'Paraphrases, typos and voice-to-text errors for each intent.',
      'Every escalation trigger from your policy.', 'Every escalation trigger in your policy.', 'Out-of-scope questions the agent should decline.', 'Out-of-scope questions you expect the agent to decline.'];
    const claims = items.map(s => ({ sentence: s, kind: 'deliverable', section: sec, rewrite: { question: 'What does a client of Acme receive at this step? The page says: "' + s + '"' } }))
      .concat([{ sentence: 'Refund and policy edge cases, such as expired return windows.', kind: 'guarantee', section: sec }, { sentence: 'Refund and policy edge cases from your own rules, such as expired return windows.', kind: 'guarantee', section: sec },
        { sentence: 'If you are weighing a custom route, we can talk through your use case.', kind: 'process', section: 'Start a project with Acme' }, { sentence: 'How Acme measures up', kind: 'process', section: 'Why Acme' }]);
    const brief = [{ question: 'Can you share a publishable result from a support assistant you built?', category: 'proof', section: 'A six-week pilot' }, { question: 'Can you share a publishable result from an AI support assistant you have built?', category: 'proof', section: 'A six-week pilot' },
      { question: 'Have you delivered Arabic or Gulf-dialect language work for a client?', category: 'proof', section: 'Designing for UAE customers' }, { question: 'Which helpdesk and messaging integrations have you delivered?', category: 'detail', section: 'The architecture' },
      { question: 'Can you host conversation data inside the UAE?', category: 'detail', section: 'Designing for UAE customers' }, { question: 'What happens after someone clicks Start a Project?', category: 'terms', section: 'Start a project with Acme' }];
    const Q = await pf('questions', [{ claims, brief, brackets: [], business: 'Acme', names: ['Acme'], final_md: '', docs: [], stored: [] }]);
    show('questions asked', Q.map(q => [q.rank, q.source, q.impact, (q.original || q.question).slice(0, 60)]));
    check('at most 8, ranked by impact, ids and ranks in order', Q.length <= 8 && Q.every((q, i) => q.rank === i + 1 && q.id === 'q' + (i + 1)) && Q.every((q, i) => !i || Q[i - 1].impact >= q.impact), J(Q.map(q => [q.id, q.impact])));
    const what = (q) => (q.original || q.question).toLowerCase();
    check('no two asks say nearly the same thing (the two rounds\' wordings of one checklist line, the two "publishable result" questions)', !Q.some((q, i) => Q.some((k, j) => j < i && what(k).split(/\W+/).filter(w => w.length > 3).every(w => what(q).includes(w)))), J(Q.map(what)));
    check('a heading ("How Acme measures up") is never asked about as a statement', !Q.some(q => /measures up/.test(q.original || '')));
    check('the most useful are kept: the proof questions and the guarantee come first', Q[0].category === 'proof' && Q.some(q => q.category === 'guarantee'), J(Q.slice(0, 3)));
    check('plain words in every question', !Q.some(q => PLAIN.test(q.question + q.why)));
  });

  await guard('W05C4 finalize kit', async () => {
    const SN = 'W05C4 (W05-C, BEFORE_AFTER "Finalize") the finalize kit on the five splices the judges named: what is a sentence, what is an invitation, and the whole final version repaired against the page it was made from';
    reset(); begin(SN); const check = mkCheck(SN);
    const FR = ['How Acme measures up', 'The fixes planned for the next cycle, each with a named owner.', 'Branded impressions from Search Console, next to the leads your CRM shows as coming from an AI assistant.', 'Actions taken and their owners.', 'Branded impressions and self-reported AI leads.'];
    const OK = ['Each phase ends with a go or no-go decision, so you stop spending when the evidence turns against the idea.', 'To start, tell Acme about your use case, your data and the systems the AI must connect to.',
      'Book a consultation with Nova& to review your readiness.', 'Out-of-scope questions the agent should decline.', 'Engagements start with a consultation request, and we provide 24/7 support.', 'We serve teams in Dubai, Abu Dhabi and across the region.',
      'If you want to talk through your readiness before you appoint your provider, get in touch with Nova& ahead of your appointment date.', 'It is delivered as one platform covering financials, CRM, inventory and ecommerce.'];
    const fr = []; for (const t of FR) fr.push([t, await pf('fragment', [t])]); const ok = []; for (const t of OK) ok.push([t, await pf('fragment', [t])]);
    check('a heading, a label or a list line with no verb is a fragment (K5, K7)', fr.every(x => x[1] === true), J(fr));
    check('a full sentence is not (an opening phrase, a plural subject, a modal, an imperative)', ok.every(x => x[1] === false), J(ok.filter(x => x[1])));
    const NM = ['Nova&'];
    const inv = []; for (const t of ['To ask them, get in touch with Nova&.', 'You can book a consultation with Nova& to talk through your shortlist.', 'Contact us to start.', 'Start a project with us today.']) inv.push(await pf('ctaSentence', [t, NM]));
    const notInv = []; for (const t of ['Compare the answers side by side.', 'Ask each partner how they handle data migration.', 'Book-keeping rules changed in 2026.']) notInv.push(await pf('ctaSentence', [t, NM]));
    check('an invitation to get in touch is recognised, an ordinary instruction is not', inv.every(Boolean) && !notInv.some(Boolean), J({ inv, notInv }));
    // K2: the confirmed sentence swapped in, and the old bare invitation that now repeats it
    const ref2 = ['# Page', '', 'Intro sentence for the page.', '', '## Get in touch with Nova&', '', 'Before you appoint your provider, make sure your questions about Dynamics 365 are answered. To ask them, get in touch with Nova&. Call +971 50 000 0000 or email hello@novaand.example.', ''].join('\n');
    const fin2 = ref2.replace('Before you appoint your provider, make sure your questions about Dynamics 365 are answered.', 'If you want to talk through your readiness before you appoint your provider, get in touch with Nova& ahead of your appointment date.');
    const g2 = await pf('finalGuard', [ref2, fin2, NM]);
    check('K2: the old "To ask them, get in touch" goes, the confirmed sentence and the phone line stay', g2.cta === 1 && !g2.md.includes('To ask them') && g2.md.includes('ahead of your appointment date.') && g2.md.includes('Call +971 50 000 0000'), g2.md);
    // K3: a new bare invitation in a section that already invited the reader
    const ref3 = ['# Page', '', 'Intro sentence for the page.', '', '## Talk through your shortlist with Nova&', '', 'A structured conversation can test your scores against real requirements. Nova& is a Microsoft partner.', '', 'To get in touch, [book a consultation](https://www.novaand.example/contact-us) or call +971 50 000 0000.', ''].join('\n');
    const fin3 = ref3.replace('real requirements. Nova&', 'real requirements. You can book a consultation with Nova& to talk through your shortlist. Nova&');
    const g3 = await pf('finalGuard', [ref3, fin3, NM]);
    check('K3: the redundant call-to-action line before the existing one goes; the linked one stays', g3.cta === 1 && !g3.md.includes('You can book a consultation') && g3.md.includes('[book a consultation](https://www.novaand.example/contact-us)'), g3.md);
    // K6: a list item lost its bullet; K5: a heading joined to a paragraph
    const ref6 = ['# Page', '', 'Intro sentence for the page.', '', '## How do you test it?', '', 'Build the test set from:', '', '- Core intents in English, phrased the way customers write.', '- Out-of-scope questions the agent should decline.', '', '### How Acme measures up', '', 'Acme runs the same test set every week.', ''].join('\n');
    const fin6 = ref6.replace('- Out-of-scope questions the agent should decline.', 'Out-of-scope questions the agent should decline.').replace('Build the test set from:', 'Build the test set from: How Acme measures up').replace('### How Acme measures up\n\n', '');
    const g6 = await pf('finalGuard', [ref6, fin6, NM]);
    check('K6: the list item gets its bullet back', g6.markers === 1 && g6.md.includes('- Out-of-scope questions the agent should decline.'), g6.md);
    check('K5: the heading spliced to the end of a paragraph is back on its own line, at its level', g6.headings === 1 && /^### How Acme measures up$/m.test(g6.md) && g6.md.includes('Build the test set from:\n'), g6.md);
    const same = await pf('finalGuard', [ref6, ref6, NM]);
    check('a final version that changed none of this is returned byte for byte', same.changed === false && same.md === ref6);
  });

  // ---------- Finalize Apply / Merge end to end ----------
  const CTA = 'To discuss your shortlist, [book a consultation](https://www.novaand-demo.com/contact-us).';
  const DELIVERED = ['# How to choose a Dynamics 365 partner in the UAE', '',
    'Choosing a Dynamics 365 partner in the UAE decides how fast your ERP project goes live and how well it fits local VAT rules. This guide explains what to check before you sign.', '',
    '**Quick answer:** Pick a partner with current Microsoft credentials, UAE VAT experience and a clear support plan, and ask for references from companies of your size.', '',
    '## What a good partner brings', '', 'Look for a partner that holds a current Microsoft designation. A strong partner explains licensing in plain words and maps your processes before any configuration starts.', '',
    '## How to test a partner', '', 'Use these checks in every demo:', '', '- Ask for a reference from a company of your size.', '- Agree response times in writing.', '',
    '## How results are measured', '', 'Use three signals: referral sessions from AI assistants, branded query impressions in Search Console, and an AI option in your CRM\'s "how did you hear about us" field. Report them every month.', '',
    '## Talk to Nova&', '', 'Before you appoint a partner, make sure your questions are answered. ' + CTA, ''].join('\n');
  const base = (o) => ({ fact_key: 'service.x_' + o.id, question: 'Is this true for Nova&?', category: 'service', slot: '', anchor: null, ...o });
  const Qs = {
    k5: base({ id: 'q1', source: 'claim', original: 'How Nova& measures up', neutral: '', in_page: 'left_out', section: 'What a good partner brings' }),
    k7frag: base({ id: 'q2', source: 'claim', original: 'Branded impressions from Search Console, next to the leads your CRM shows.', neutral: 'Use three signals: referral sessions from AI assistants, branded query impressions in Search Console, and an AI option in your CRM\'s "how did you hear about us" field.', in_page: 'neutral', section: 'How results are measured' }),
    k6list: base({ id: 'q3', source: 'claim', original: 'Agree response times in writing before you sign.', neutral: '- Agree response times in writing.', in_page: 'neutral', section: 'How to test a partner' }),
    k3cta: base({ id: 'q4', source: 'claim', original: 'You can book a consultation with Nova& to talk through your shortlist.', neutral: '', in_page: 'left_out', section: 'Talk to Nova&' }),
    k7list: base({ id: 'q5', source: 'claim', original: 'A named owner for every fix.', neutral: '', in_page: 'left_out', section: 'How to test a partner', anchor: { section: 'How to test a partner', before: '', after: '', line_before: '- Ask for a reference from a company of your size.' } }),
    ok: base({ id: 'q6', source: 'claim', original: 'Nova& has been a Microsoft partner since 2015.', neutral: 'Look for a partner that holds a current Microsoft designation.', in_page: 'neutral', section: 'What a good partner brings' }),
    ans: base({ id: 'q7', source: 'brief', original: '', neutral: '', in_page: 'left_out', section: 'What a good partner brings', category: 'proof', question: 'Is there a client result you are happy to publish?' }) };
  const answer = (q, decision, text) => ({ ...q, decision, text: text != null ? text : decision === 'yes' ? q.original : '' });
  const bodyOf = (answers) => ({ mode: 'finalize', request_id: 'app-fin-w05c', domain: 'novaand-demo.com', site_id: 'site_novaand-demo-com', keyword: 'dynamics 365 partner uae', country: 'United Arab Emirates', page_type: 'Blog Post / Guide',
    markdown: DELIVERED, delivered_markdown: DELIVERED, client_edited: false, meta: { title: 'Dynamics 365 Partner UAE: How to Choose', meta_description: 'What to check before you choose a Dynamics 365 partner in the UAE: credentials, VAT experience, support and references.', slug: 'dynamics-365-partner-uae' },
    answers, business_facts: 'Nova& is a Microsoft partner based in Ajman. Contact is by consultation request.', business_facts_kv: {}, stored_fact_keys: [], content_request_id: 'exec-1',
    page_run: { qa_blocking: [], duplicate_targets: [], verdict: 'GO', score: 70, score_withheld: false, page_type: 'Blog Post / Guide', verdict_acknowledged: false, copied_passages: [], length_points: null, missing: [], content_request_id: 'exec-1' } });
  const finalize = async (body, editor) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    const jobs = ap[0].json.finalize_apply.jobs;
    if (ap[0].json.needs_editor && editor) { const s = editor(jobs); if (s !== undefined) mock('Finalize Editor', [{ json: { output: s == null ? '' : { sections: s } } }]); }
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { ap: ap[0].json, mg: mg[0].json, body: vd[0].json.body, jobs };
  };

  await guard('W05C5 finalize end to end', async () => {
    const SN = 'W05C5 (W05-C, BEFORE_AFTER "Finalize") Finalize Apply / Merge on the generated code: a heading or a fragment never goes into prose and never replaces a full sentence, a list item keeps its bullet and a list line goes back into its list, no second call to action, an edit that splices a label into a paragraph is refused';
    reset(); begin(SN); const check = mkCheck(SN);
    const A = await finalize(bodyOf([answer(Qs.k5, 'yes'), answer(Qs.k7frag, 'yes'), answer(Qs.k6list, 'yes'), answer(Qs.k3cta, 'yes'), answer(Qs.k7list, 'yes'), answer(Qs.ok, 'yes')]), () => { throw new Error('the editor must not be called'); });
    const md = A.body.markdown; const how = Object.fromEntries(A.body.applied.map(a => [a.id, a.how]));
    show('applied', how); show('notes', A.body.notes);
    check('K5: a heading answered "yes" is not put into a paragraph; reported not placed, with why', how.q1 === 'not_placed' && !/measures up/.test(md) && A.body.applied.find(a => a.id === 'q1').why && A.body.notes.some(n => /reads as a heading or a list line/.test(n)), J({ how, notes: A.body.notes }));
    check('K7: a full summary sentence is never replaced by a fragment', how.q2 === 'not_placed' && md.includes('Use three signals: referral sessions from AI assistants') && !md.includes('Branded impressions from Search Console, next to'), J(how));
    check('K6: a confirmed list item keeps its bullet', how.q3 === 'kept_original' && /^- Agree response times in writing before you sign\.$/m.test(md), md.slice(md.indexOf('## How to test'), md.indexOf('## How results')));
    check('K7: a list line goes back into its list as a list item, after the line it followed', how.q5 === 'kept_original' && /^- Ask for a reference from a company of your size\.\n- A named owner for every fix\.\n- Agree response times in writing before you sign\.$/m.test(md), md.slice(md.indexOf('## How to test'), md.indexOf('## How results')));
    check('K3: an invitation is not added to a page that already invites the reader', how.q4 === 'already_covered' && !md.includes('You can book a consultation') && (md.match(/book a consultation/gi) || []).length === 1 && A.body.notes.some(n => /^Already on the page/.test(n)), J(how));
    check('an ordinary yes still restores the specific sentence', how.q6 === 'kept_original' && md.includes('Nova& has been a Microsoft partner since 2015.'));
    check('no editor call; the page keeps every heading it had', A.ap.needs_editor === false && ['## What a good partner brings', '## How to test a partner', '## How results are measured', '## Talk to Nova&'].every(h => md.includes(h)));
    check('plain words in every note', !A.body.notes.some(n => PLAIN.test(n)), J(A.body.notes));
    // an editor that answers the client result but splices a label onto the end of the paragraph is refused (K5 shape)
    const RES = 'Nova& moved a 40-person distributor in Ajman to Business Central in 14 weeks.';
    const B = await finalize(bodyOf([answer(Qs.ans, 'answer', RES)]), (jobs) => jobs.map(j => ({ id: j.id, text: j.text.replace('Look for a partner that holds a current Microsoft designation.', 'Look for a partner that holds a current Microsoft designation. ' + RES).trimEnd() + ' How Nova& measures up\n' })));
    const bh = Object.fromEntries(B.body.applied.map(a => [a.id, a.how]));
    check('an edit that adds a label at a paragraph end is not used; the answer is reported not placed', B.body.sections_rewritten.length === 0 && bh.q7 === 'not_placed' && !/measures up/.test(B.body.markdown) && B.body.notes.some(n => /changed the page's shape/.test(n)), J({ bh, notes: B.body.notes }));
    const C = await finalize(bodyOf([answer(Qs.ans, 'answer', RES)]), (jobs) => jobs.map(j => ({ id: j.id, text: j.text.replace('Look for a partner that holds a current Microsoft designation.', 'Look for a partner that holds a current Microsoft designation. ' + RES) })));
    check('... and the same edit without the label is used (no false refusal of a good edit)', C.body.sections_rewritten.length === 1 && C.body.markdown.includes(RES), J({ rw: C.body.sections_rewritten, notes: C.body.notes }));
    const D = await finalize(bodyOf([answer(Qs.ans, 'answer', RES)]), (jobs) => jobs.map(j => ({ id: j.id, text: j.text.replace('Look for a partner that holds a current Microsoft designation.', 'Look for a partner that holds a current Microsoft designation. ' + RES) })).concat([]));
    check('the final version is guarded against the page it was made from (no repair needed on a clean edit)', D.mg.finalize_merge.guard === null, J(D.mg.finalize_merge.guard));
  });

  await guard('W05C6 ranking guide 949', async () => {
    const SN = 'W05C6 (owner priority 2026-10-29) the ranking guide 949 keeps every figure, section and link through every W05-C rule';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = G.live_markdown;
    const ctx = await pf('ctxOf', [{ keyword: G.keyword, domain: 'novaand.example', content_brief: G.brief || {} }, {}]);
    const qa = { main_content_words: G.live_words || 2000, outbound_links: linksOf(md).map(l => ({ url: l.slice(2, -1), tier: 'weak' })), verified_figures: (await pf('figKeysIn', [md])).map(f => ({ figure: f, sources: [] })) };   // the worst case: every link weak, every figure stated by its source
    const cls = await pf('classify', [qa, md, ctx]);
    check('every weak-figure item on the guide is a sourced one (advice, or a link to name), never a figure to take out', cls.blocking.filter(b => b.code === 'weak_figure').every(b => b.verified === true), J(cls.blocking.filter(b => b.code === 'weak_figure')));
    const N = await pf('neutralize', [md, cls, ctx]);
    check('the system\'s own rewrite keeps every figure, heading and link of the guide', J(figsOf(N.md)) === J(figsOf(md)) && J(headsOf(N.md)) === J(headsOf(md)) && linksOf(N.md).length === linksOf(md).length, J({ f: [figsOf(md).length, figsOf(N.md).length], h: [headsOf(md).length, headsOf(N.md).length], l: [linksOf(md).length, linksOf(N.md).length] }));
    const g = await pf('finalGuard', [md, md, ['Nova&']]);
    check('its final version against itself is returned byte for byte', g.changed === false && g.md === md);
    const p = await pf('protect', [md, qa, ctx]);
    check('every sourced figure of the guide is protected in an edit (the live text of the guide carries ' + linksOf(md).length + ' links)', Array.isArray(p.figs) && Array.isArray(p.nums) && p.figs.every(k => p.nums.includes(k)) && figsOf(md).length > 0, J({ figs: p.figs.slice(0, 8), nums: p.nums.length }));
    const job = await pf('plan', [md, cls, { ...qa, length_band: { low: 1200, high: 9000 }, coverage_pct: 40, coverage_target_pct: 70, missing_subtopics: ['Why Business Central Matters', 'The Importance of Choosing the Right ERP'] }, ctx]);
    check('no rhetorical subtopic becomes a job on the guide', !job.sections.flatMap(s => s.problems).some(p2 => /subtopic/i.test(p2)), J(job.sections.map(s => s.problems)));
    show('949 figures / headings / links', [figsOf(md).length, headsOf(md).length, linksOf(md).length]);
  });

  await guard('W05C7 wiring and prompts', async () => {
    const SN = 'W05C7 (W05-C, build section 172) the generated workflows carry the rules: the page kit in the content run and Page Finalize, the finalize guard, the built prompts';
    reset(); begin(SN); const check = mkCheck(SN);
    const main = WF('SEO_Agent_v4.json'); const fin = WF('SEO_Agent_Page_Finalize.json');
    const node = (w, n) => w.nodes.find(x => x.name === n) || {};
    const pc = String((node(main, 'Page Candidates').parameters || {}).jsCode || '');
    check('Page Candidates carries the new kit (sourced figures, no padding, at most 8 questions)', /weak_figure_named/.test(pc) && /const RHETORIC = /.test(pc) && /const QUESTION_MAX = 8;/.test(pc));
    const fa = String((node(fin, 'Finalize Apply').parameters || {}).jsCode || ''), fm = String((node(fin, 'Finalize Merge').parameters || {}).jsCode || '');
    check('Finalize Apply: fragments, list markers, one call to action', /PF\.fragment\(text\)/.test(fa) && /how: 'already_covered'/.test(fa) && /'- One call to action:/.test(fa));
    check('Finalize Merge: the shape check and the whole-page guard', /const broke = \(b, a\) =>/.test(fm) && /PF\.finalGuard\(ref0, md, NAMES\)/.test(fm));
    const cqa = String((node(main, 'Content QA').parameters || {}).jsCode || '');
    check('Content QA records verified_figures (both workflows run the same code)', /verified_figures/.test(cqa) && cqa === String((node(fin, 'Content QA').parameters || {}).jsCode || ''));
    const P = (n) => String((node(main, n).parameters || {}).text || '');
    check('the built Strategy Brief places client facts outside technical sections and plans no padding h3', /Client facts go where a reader decides who does the work/.test(P('Strategy Brief')) && /Every h3 answers a question/.test(P('Strategy Brief')));
    check('the built Copywriter: headings carry content, the business in its place, never a vague word for a sourced number (W0-H line kept)', /6c\. Headings carry content/.test(P('Copywriter')) && /6d\. The business in its place/.test(P('Copywriter')) && /Never put a vague word/.test(P('Copywriter'))
      && /A market, adoption, cost or compliance figure needs an official, research or major-press source/.test(P('Copywriter')));
    const ed = main.nodes.filter(n => /Editor/.test(n.name) && n.parameters && typeof n.parameters.text === 'string').map(n => n.parameters.text).join('\n');
    check('the built page Editor: a sourced figure stays as written, no heading unless asked, business lines in their place', /A figure that carries its source link stays exactly as written/.test(ed) && /Add no heading unless a problem asks for one by name/.test(ed) && /Lines about the business/.test(ed));
    check('plain words in the new customer-facing lines of the kit', !PLAIN.test(pc.slice(pc.indexOf('const finalGuard'), pc.indexOf('const finalGuard') + 6000)));
  });
};
