import { describe, expect, it } from 'vitest';
import { cmsReadiness } from './cms';
import { deliveryDecision } from './report-delivery';
import {
  allowedDecisions,
  answerProblem,
  answerText,
  carryOpenQuestions,
  deliveryHeadline,
  deliveryOf,
  diffBlocks,
  factOf,
  factsForEngine,
  finalizeBody,
  finalizeCostUsd,
  finalizeNeeded,
  finalReportPayload,
  joinBlocks,
  isOwnWrittenPage,
  openQuestions,
  pageCheckOf,
  pageUrlKey,
  pageMarkdownWithMeta,
  parseBlocks,
  plainWords,
  prefilledAnswer,
  questionsOf,
  renderArticleHtml,
  renderMarkdown,
  reviewStage,
  reviewSummaryOf,
  safeUrl,
  sanitizeMarkdown,
  storedFactFor,
  type ClientQuestion,
  type FactAnswers,
  type FinalizeResult,
  type PageAnswer,
} from './page-review';

// H3 (2026-10-28): the page review contract between the engine's callback (H1: qa_delivery_status, qa_client_questions, qa_grade,
// qa_blocking, qa_advisory), the server and the screens. Client text in these fixtures is anonymised (Nova&, novaand-demo.com).

const Q_CLAIM = {
  id: 'q1', rank: 1, impact: 0.85, kind: 'process', category: 'service', fact_key: 'service.assess_shape_phase', source: 'claim',
  question: 'Is this true for Nova&? "Before we recommend a product, we run business discovery in our Assess phase."',
  why: 'Nothing on file says it, so the page does not claim it.', original: 'Before we recommend a product, we run business discovery in our Assess phase.',
  neutral: 'A sound selection starts with business discovery.', in_page: 'neutral', section: 'How to choose', choices: ['yes', 'edit', 'remove'], answer_type: 'choice',
  prefill: 'Assess and Shape: business discovery and gap-fit analysis.', prefill_source: 'https://www.novaand-demo.com/whatwedo/assess-shape', use_for_future_pages: true, blocks: false,
};
const Q_BRIEF = {
  id: 'q2', rank: 2, impact: 0.9, kind: 'proof', category: 'proof', fact_key: 'proof.client_result_publish', source: 'brief',
  question: 'Is there a client result you are happy to publish?', why: 'The brief found that this would make the page more convincing.',
  original: '', neutral: '', in_page: 'left_out', section: '', choices: ['answer', 'skip'], answer_type: 'text', prefill: '', prefill_source: '', use_for_future_pages: true,
};
const Q_BRACKET = {
  id: 'q3', rank: 3, impact: 0.8, kind: 'credential', category: 'credential', fact_key: 'credential.partner_designation', source: 'bracket',
  question: 'Please confirm for Nova\u0026: the Microsoft partner designation.', why: 'The writer needed this.', original: '', neutral: '', in_page: 'left_out', section: '',
  answer_type: 'text', prefill: 'Nova\u0026 is a Microsoft Solutions Partner \u2014 Business Applications.', prefill_source: 'your business facts',
};

const PAYLOAD_READY_Q = {
  stage: 'content',
  keyword: 'erp systems in uae',
  domain: 'novaand-demo.com',
  markdown: '# ERP systems in the UAE\n\nA sound selection starts with business discovery.\n\n## How to choose\n\nCompare the options.\n',
  html: '<article><h1>ERP systems in the UAE</h1></article>',
  meta: { title: 'ERP Systems in UAE', meta_description: 'How to choose an ERP system in the UAE.', slug: 'erp-systems-uae', h1: 'ERP systems in the UAE', primary_keyword: 'erp systems in uae', page_type: 'Service Page', schema_blocks: [{ type: 'Article', json: { '@type': 'Article', headline: 'x</script><script>alert(1)</script>' } }] },
  qa_delivery_status: 'ready_with_questions',
  qa_client_questions: [Q_BRACKET, Q_CLAIM, Q_BRIEF],
  qa_grade: { score: 91.4, of: 100, first_draft_review: 62 },
  qa_blocking: [],
  qa_advisory: [{ code: 'length', text: 'The main content is 1985 words, over the 900-1800 band' }],
  qa_publishable: true,
  qa_not_ready: false,
  request_id: '2575',
  cost_usd: 1.04,
  run_ledger: { ai_usd: 1.0, dataforseo_usd: 0.04 },
};

describe('the delivered status', () => {
  it('reads H1 fields: ready with questions, the delivered grade (not the first draft review), advice', () => {
    const d = deliveryOf(PAYLOAD_READY_Q);
    expect(d.status).toBe('ready_with_questions');
    expect(d.headline).toBe('Ready, and stronger with your input (3 questions)');
    expect(d.grade).toBe(91);
    expect(d.firstDraftReview).toBe(62);
    expect(d.advisory).toHaveLength(1);
    expect(d.blocking).toEqual([]);
    expect(d.questionCount).toBe(3);
    expect(d.nextStep).toBe('');
  });
  it('ready with no questions waits for the OK', () => {
    const d = deliveryOf({ ...PAYLOAD_READY_Q, qa_delivery_status: 'ready', qa_client_questions: [] });
    expect(d.status).toBe('ready');
    expect(d.headline).toBe('Ready to publish, waiting for your OK');
  });
  it('a "ready" page that still has questions reads as ready with questions', () => {
    expect(deliveryOf({ ...PAYLOAD_READY_Q, qa_delivery_status: 'ready' }).status).toBe('ready_with_questions');
  });
  it('not ready names the blocking reason, what we did and what the client does', () => {
    const d = deliveryOf({
      ...PAYLOAD_READY_Q,
      qa_delivery_status: 'not_ready',
      qa_blocking: [{ code: 'duplicate_page', text: 'This website already has a page for the same search: https://www.novaand-demo.com/insights/x', action: 'publish it as an update' }],
      qa_next_step: 'Finish this draft by hand: publish it as an update.',
    });
    expect(d.status).toBe('not_ready');
    expect(d.headline).toMatch(/^Not ready: this website already has a page for the same search/);
    expect(d.detail).toContain('We kept the text as it is.');
    expect(d.detail).toContain('What you do: publish it as an update of your existing page');
    expect(d.nextStep).toContain('Finish this draft by hand');
  });
  it('falls back for reports written before H1: not ready from qa_not_ready with the reasons, ready from publishable, unknown otherwise', () => {
    const old = deliveryOf({ markdown: 'x', qa_not_ready: true, qa_reasons: ['3 placeholders left'], meta: { content_score: 70 } });
    expect(old.status).toBe('not_ready');
    expect(old.blocking[0]!.text).toBe('3 placeholders left');
    expect(old.grade).toBe(70);
    expect(deliveryOf({ qa_publishable: true }).status).toBe('ready');
    expect(deliveryOf({ meta: { quality: { not_ready: true, reasons: ['x'] } } }).status).toBe('not_ready');
    const u = deliveryOf({});
    expect(u.status).toBe('unknown');
    expect(u.headline).toMatch(/not available/);
  });
  it('reads the questions from meta.json when the callback field is absent', () => {
    expect(deliveryOf({ meta: { delivery_status: 'ready', client_questions: [Q_CLAIM], grade: { score: 88 } } })).toMatchObject({ status: 'ready_with_questions', grade: 88, questionCount: 1 });
  });
  it('headlines use plain words (no em dash, curly quotes or ellipsis)', () => {
    for (const st of ['ready', 'ready_with_questions', 'not_ready', 'unknown'] as const) {
      const h = deliveryHeadline(st, 1, { code: 'claim', text: 'A statement \u201Cx\u201D \u2014 y\u2026' });
      expect(h.headline + h.detail).not.toMatch(/[\u2014\u2013\u201C\u201D\u2018\u2019\u2026]/);
    }
    expect(deliveryHeadline('ready_with_questions', 1).headline).toBe('Ready, and stronger with your input (1 question)');
    expect(plainWords('a \u2014 b \u201Cc\u201D d\u2026')).toBe('a: b "c" d...');
  });
});

describe('the client questions', () => {
  const qs = questionsOf(PAYLOAD_READY_Q);
  it('are ranked, typed by source and cleaned', () => {
    expect(qs.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(qs[0]!.answer_type).toBe('choice');
    expect(qs[1]!.answer_type).toBe('text');
    expect(qs[2]!.source).toBe('bracket');
    expect(qs[2]!.prefill).toBe('Nova& is a Microsoft Solutions Partner: Business Applications.');
    expect(qs[2]!.in_page).toBe('left_out');
    expect(qs[2]!.use_for_future_pages).toBe(true);
  });
  it('drops empty and duplicate questions and fills missing ids, ranks and keys', () => {
    const r = questionsOf({ qa_client_questions: [{ question: 'A?' }, { id: 'x', question: 'B?' }, { id: 'x', question: 'B again?' }, { question: '' }] });
    expect(r.map((q) => q.id)).toEqual(['q1', 'x']);
    expect(r[0]!.fact_key).toBe('detail.q1');
  });
  it('choices: a claim offers yes / edit / remove / leave general / not now; a text question answer / leave general / not now', () => {
    expect(allowedDecisions(qs[0]!)).toEqual(['yes', 'edit', 'remove', 'general', 'skip']);
    expect(allowedDecisions(qs[1]!)).toEqual(['answer', 'general', 'skip']);
  });
  it('validates answers', () => {
    expect(answerProblem(qs[0]!, 'yes', '')).toBe('');
    expect(answerProblem(qs[0]!, 'answer', 'x')).toMatch(/not available/);
    expect(answerProblem(qs[0]!, 'edit', '  ')).toMatch(/Write your wording/);
    expect(answerProblem(qs[1]!, 'answer', 'x'.repeat(601))).toMatch(/600/);
    expect(answerProblem(qs[1]!, 'answer', '<script>')).toMatch(/Plain text/);
    expect(answerProblem(qs[1]!, 'general', '')).toBe('');
  });
  it('the text an answer puts in the page', () => {
    expect(answerText(qs[0]!, 'yes', 'ignored')).toBe(qs[0]!.original);
    expect(answerText(qs[0]!, 'edit', ' Our own \u2014 wording ')).toBe('Our own: wording');
    expect(answerText(qs[0]!, 'remove', 'x')).toBe('');
    expect(answerText(qs[0]!, 'general', 'x')).toBe('');
  });
  it('prefilled answers: a claim is kept, a text question takes the suggestion, none without a prefill', () => {
    expect(prefilledAnswer(qs[0]!)).toEqual({ decision: 'yes', text: '' });
    expect(prefilledAnswer(qs[2]!)).toEqual({ decision: 'answer', text: qs[2]!.prefill });
    expect(prefilledAnswer(qs[1]!)).toBeNull();
  });
});

describe('answers become business facts, kept once and reused', () => {
  const qs = questionsOf(PAYLOAD_READY_Q);
  const at = '2026-10-28T09:00:00.000Z';
  it('factOf: yes stores the original, edit the wording, general and remove a decision, skip nothing', () => {
    expect(factOf(qs[0]!, { decision: 'yes', text: '', at, by: 'u1' }, 'r1')).toMatchObject({ decision: 'yes', text: qs[0]!.original, category: 'service', reportId: 'r1', by: 'u1' });
    expect(factOf(qs[0]!, { decision: 'general', text: 'x', at, by: null }, 'r1')).toMatchObject({ decision: 'general', text: '' });
    expect(factOf(qs[0]!, { decision: 'remove', text: '', at, by: null }, 'r1')).toMatchObject({ decision: 'remove', text: '' });
    expect(factOf(qs[0]!, { decision: 'skip', text: '', at, by: null }, 'r1')).toBeNull();
    expect(factOf({ ...qs[0]!, use_for_future_pages: false }, { decision: 'yes', text: '', at, by: null }, 'r1')).toBeNull();
  });
  it('factsForEngine: texts for confirmed facts, every decided key stored (never asked again), bad keys dropped', () => {
    const facts: FactAnswers = {
      'service.assess_shape_phase': { decision: 'yes', text: 'We run discovery first.', question: '', category: 'service', at, by: null, reportId: null },
      'proof.client_result_publish': { decision: 'general', text: '', question: '', category: 'proof', at, by: null, reportId: null },
      'credential.partner_designation': { decision: 'answer', text: 'Microsoft Solutions Partner', question: '', category: 'credential', at, by: null, reportId: null },
      'bad key with spaces': { decision: 'yes', text: 'x', question: '', category: 'detail', at, by: null, reportId: null },
    };
    const f = factsForEngine(facts);
    expect(f.business_facts_kv).toEqual({ 'credential.partner_designation': 'Microsoft Solutions Partner', 'service.assess_shape_phase': 'We run discovery first.' });
    expect(f.stored_fact_keys).toEqual(['credential.partner_designation', 'proof.client_result_publish', 'service.assess_shape_phase']);
    expect(factsForEngine(null)).toEqual({ business_facts_kv: {}, stored_fact_keys: [] });
  });
  it('a stored fact is not asked again: openQuestions leaves out answered and stored questions, keeps skipped ones', () => {
    const facts: FactAnswers = { 'proof.client_result_publish': { decision: 'general', text: '', question: '', category: 'proof', at, by: null, reportId: null } };
    expect(storedFactFor(qs[1]!, facts)?.decision).toBe('general');
    const answers: Record<string, PageAnswer> = { q1: { questionId: 'q1', factKey: qs[0]!.fact_key, decision: 'yes', text: '', at, by: null }, q3: { questionId: 'q3', factKey: '', decision: 'skip', text: '', at, by: null } };
    expect(openQuestions(qs, answers, facts).map((q) => q.id)).toEqual(['q3']);
    expect(openQuestions(qs, null, null)).toHaveLength(3);
  });
  it('finalizeNeeded: only answers that change the page, or the client\'s own edits', () => {
    expect(finalizeNeeded([{ decision: 'general' }, { decision: 'skip' }], false)).toBe(false);
    expect(finalizeNeeded([{ decision: 'general' }], true)).toBe(true);
    for (const d of ['yes', 'edit', 'remove', 'answer'] as const) expect(finalizeNeeded([{ decision: d }], false)).toBe(true);
  });
});

describe('the finalize request', () => {
  const qs = questionsOf(PAYLOAD_READY_Q);
  const at = '2026-10-28T09:00:00.000Z';
  const answers: Record<string, PageAnswer> = {
    q1: { questionId: 'q1', factKey: qs[0]!.fact_key, decision: 'edit', text: 'We start every project with discovery.', at, by: null },
    q2: { questionId: 'q2', factKey: qs[1]!.fact_key, decision: 'skip', text: '', at, by: null },
    q3: { questionId: 'q3', factKey: qs[2]!.fact_key, decision: 'answer', text: 'Microsoft Solutions Partner', at, by: null },
  };
  const body = finalizeBody({ requestId: 'app-fin-1', domain: 'novaand-demo.com', siteId: 'site_novaand-demo-com', payload: PAYLOAD_READY_Q, markdown: 'edited', clientEdited: true, questions: qs, answers, businessFacts: 'Microsoft partner', facts: {} });
  it('carries the version, the delivered text, the answers that change something and the stored facts', () => {
    expect(body).toMatchObject({ mode: 'finalize', request_id: 'app-fin-1', keyword: 'erp systems in uae', page_type: 'Service Page', markdown: 'edited', delivered_markdown: PAYLOAD_READY_Q.markdown, client_edited: true, content_request_id: '2575' });
    expect(body.meta).toEqual({ title: 'ERP Systems in UAE', meta_description: 'How to choose an ERP system in the UAE.', slug: 'erp-systems-uae', h1: 'ERP systems in the UAE' });
    expect(body.answers.map((a) => [a.id, a.decision, a.text])).toEqual([
      ['q1', 'edit', 'We start every project with discovery.'],
      ['q3', 'answer', 'Microsoft Solutions Partner'],
    ]);
    expect(body.answers[0]).toMatchObject({ original: qs[0]!.original, neutral: qs[0]!.neutral, in_page: 'neutral', section: 'How to choose', source: 'claim' });
    expect(body.business_facts_kv).toEqual({});
  });
  it('the cost an answer reports is bounded and estimated unless it says otherwise', () => {
    expect(finalizeCostUsd({ cost: { claude_usd: 0.031, dfs_usd: 0, estimated: false, model_calls: 1 } })).toEqual({ total: 0.031, claude: 0.031, dfs: 0, estimated: false });
    expect(finalizeCostUsd({ cost: { claude_usd: -3, dfs_usd: 99, estimated: true, model_calls: 0 } }).total).toBe(5);
    expect(finalizeCostUsd(null).estimated).toBe(true);
  });
});

describe('the final version report payload', () => {
  const result: FinalizeResult = {
    ok: true,
    request_id: 'app-fin-1',
    markdown: '# ERP systems in the UAE\n\nWe start every project with discovery.\n\n## How to choose\n\nCompare the options.\n',
    applied: [{ id: 'q1', how: 'client_wording', section: 's0' }],
    sections_rewritten: [],
    changes: [{ section: 's0', what: 'your wording', before: 'A sound selection starts with business discovery.', after: 'We start every project with discovery.' }],
    delivery_status: 'ready',
    delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 93 } },
    client_questions: [],
    grade: { score: 93 },
    cost: { claude_usd: 0.02, dfs_usd: 0, estimated: true, model_calls: 0 },
  };
  const p = finalReportPayload(PAYLOAD_READY_Q, result, { originalReportId: 'rep-1', requestId: 'app-fin-1' });
  it('keeps the page package, replaces the text, its HTML, the status and the grade, and drops the original run\'s cost', () => {
    expect(p.markdown).toBe(result.markdown);
    expect(String(p.html)).toContain('<p>We start every project with discovery.</p>');
    expect(p.qa_delivery_status).toBe('ready');
    expect(p.qa_publishable).toBe(true);
    expect(p.qa_not_ready).toBe(false);
    expect(p.finalized_from).toBe('rep-1');
    expect(p.request_id).toBe('app-fin-1');
    expect(p.cost_usd).toBeUndefined();
    expect(p.run_ledger).toEqual({ dataforseo_usd: 0, ai_usd: 0.02, ai_cost_estimated: true });
    expect((p.meta as Record<string, unknown>).slug).toBe('erp-systems-uae');
    expect((p.meta as Record<string, unknown>).content_score).toBe(93);
    expect(deliveryOf(p)).toMatchObject({ status: 'ready', grade: 93, headline: 'Ready to publish, waiting for your OK' });
  });
  it('passes the delivery rule and the CMS rule (draft and live)', () => {
    expect(deliveryDecision({ stage: 'content', status: 'completed', payload: p }).deliver).toBe(true);
    const r = cmsReadiness({ stage: 'content', status: 'completed', payload: p, siteDomain: 'novaand-demo.com' });
    expect(r.blockers).toEqual([]);
    expect(r.liveAllowed).toBe(true);
  });
  it('a not ready final version stays refused, with its reason', () => {
    const q = finalReportPayload(PAYLOAD_READY_Q, { ...result, delivery_status: 'not_ready', delivery: { ...result.delivery, status: 'not_ready', blocking: [{ code: 'figure', text: 'A figure its cited source does not state: "40%"' }] } }, { originalReportId: 'rep-1', requestId: 'x' });
    expect(q.qa_not_ready).toBe(true);
    expect(q.qa_reasons).toEqual(['A figure its cited source does not state: "40%"']);
    expect(deliveryDecision({ stage: 'content', status: 'completed', payload: q }).deliver).toBe(false);
    expect(cmsReadiness({ stage: 'content', status: 'completed', payload: q, siteDomain: 'novaand-demo.com' }).draftAllowed).toBe(false);
  });
});

describe('where a page stands', () => {
  const base = { delivery: { status: 'ready' as const }, openQuestions: 0, finalize: { status: 'none' as const }, isFinal: false, approved: false, publish: 'not_published' as const };
  it('follows the one order: live, published, draft sent, approved, finalising, not ready, final, questions, ready', () => {
    expect(reviewStage(base)).toBe('ready');
    expect(reviewStage({ ...base, openQuestions: 2 })).toBe('questions');
    expect(reviewStage({ ...base, delivery: { status: 'not_ready' } })).toBe('not_ready');
    expect(reviewStage({ ...base, finalize: { status: 'running' } })).toBe('finalising');
    expect(reviewStage({ ...base, finalize: { status: 'done' } })).toBe('final_ready');
    expect(reviewStage({ ...base, isFinal: true, openQuestions: 1 })).toBe('final_ready');
    expect(reviewStage({ ...base, approved: true })).toBe('approved');
    expect(reviewStage({ ...base, approved: true, publish: 'sent_draft' })).toBe('sent_draft');
    expect(reviewStage({ ...base, publish: 'published' })).toBe('published');
    expect(reviewStage({ ...base, publish: 'live_verified' })).toBe('live_verified');
  });
  it('the board summary counts answered questions, stored facts included', () => {
    const s = reviewSummaryOf('r1', PAYLOAD_READY_Q, { answers: { q1: { decision: 'yes' } }, facts: { 'proof.client_result_publish': { decision: 'general', text: '', question: '', category: 'proof', at: '', by: null, reportId: null } } });
    expect(s).toEqual({ reportId: 'r1', stage: 'questions', label: 'Ready, stronger with your input', questions: 3, answered: 2, grade: 91 });
  });
});

describe('the free check of the client version', () => {
  it('maps the publish check: publishable, refused with its reasons, or did not run', () => {
    expect(pageCheckOf({ ran: true, json: { publishable: true, advice: ['Add a table'] } }, 2, 't')).toMatchObject({ status: 'ready_with_questions', blocking: [], ran: true, advisory: [{ text: 'Add a table' }] });
    expect(pageCheckOf({ ran: true, json: { publishable: true } }, 0, 't').status).toBe('ready');
    expect(pageCheckOf({ ran: true, json: { publishable: false, reasons: ['2 placeholders left'] } }, 0, 't')).toMatchObject({ status: 'not_ready', blocking: [{ text: '2 placeholders left' }] });
    expect(pageCheckOf({ ran: true, json: { publishable: false, label: 'Not ready' } }, 0, 't').blocking).toEqual([{ code: 'other', text: 'Not ready' }]);
    const off = pageCheckOf({ ran: false, note: '' }, 0, 't');
    expect(off).toMatchObject({ status: 'unknown', ran: false });
    expect(off.note).toMatch(/could not run/);
  });
  it('gives the checks the meta lines they read, once', () => {
    expect(pageMarkdownWithMeta('# H\n\nText', { title: 'T', meta_description: 'D', slug: 's' })).toBe('Title: T\nMeta Description: D\nSlug: s\n\n# H\n\nText');
    expect(pageMarkdownWithMeta('Title: T\n\n# H', { title: 'X' })).toBe('Title: T\n\n# H');
    expect(pageMarkdownWithMeta('# H', {})).toBe('# H');
  });
});

describe('the editor: sanitising and safe HTML', () => {
  it('removes scripts, iframes, styles, comments and raw tags, keeping their text where it is text', () => {
    const md = 'Intro <b>bold</b> text<script>alert(1)</script>\n<iframe src="https://evil.example"></iframe>\n<style>p{}</style><!-- note -->\n<img src=x onerror=alert(1)>\nEnd';
    const out = sanitizeMarkdown(md);
    expect(out).toBe('Intro bold text\n\n\n\nEnd');
    expect(out).not.toMatch(/<|alert/);
  });
  it('keeps safe links and images, drops javascript:, data: and vbscript: targets but keeps the words', () => {
    const md = '[ok](https://novaand-demo.com/a) [rel](/contact) [mail](mailto:hi@novaand-demo.com) [bad](javascript:alert(1)) [d](data:text/html;base64,xx) ![pic](images/hero.webp "Hero") ![x](vbscript:msgbox)';
    expect(sanitizeMarkdown(md)).toBe('[ok](https://novaand-demo.com/a) [rel](/contact) [mail](mailto:hi@novaand-demo.com) bad d ![pic](images/hero.webp "Hero") x');
    expect(safeUrl('JavaScript:alert(1)')).toBe(false);
    expect(safeUrl('#section')).toBe(true);
    expect(safeUrl('https://a.example/"onmouseover=')).toBe(false);
  });
  it('removes control characters and caps the length', () => {
    expect(sanitizeMarkdown('a\u0000b\u0007c\r\nd')).toBe('abc\nd');
    expect(sanitizeMarkdown('x'.repeat(300_000))).toHaveLength(200_000);
  });
  it('renders escaped HTML: headings, paragraphs, lists, tables, quotes, emphasis, links', () => {
    const md = 'Title: Meta line\n# Head & "co"\n\nPara with **bold**, *em* and `code` and [a link](https://x.example/?a=1&b=2).\nSecond line.\n\n- one\n- two\n\n1. first\n\n| A | B |\n|---|---|\n| 1 | <b>2</b> |\n\n> quoted';
    const html = renderMarkdown(md);
    expect(html).not.toContain('Meta line');
    expect(html).toContain('<h1>Head &amp; &quot;co&quot;</h1>');
    expect(html).toContain('<p>Para with <strong>bold</strong>, <em>em</em> and <code>code</code> and <a href="https://x.example/?a=1&amp;b=2" rel="noopener noreferrer">a link</a>. Second line.</p>');
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>first</li>\n</ol>');
    expect(html).toContain('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody></table>');
    expect(html).toContain('<blockquote><p>quoted</p></blockquote>');
    expect(renderMarkdown('a <img src=x onerror=alert(1)> & b')).toBe('<p>a  &amp; b</p>');
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>x</p>');
  });
  it('the final HTML carries the JSON-LD with no way to close its script', () => {
    const html = renderArticleHtml('# H', PAYLOAD_READY_Q.meta.schema_blocks);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('\\u003c/script>');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(renderArticleHtml('# H')).toBe('<article>\n<h1>H</h1>\n</article>');
  });
});

describe('the editor: blocks and the comparison', () => {
  const md = 'Title: T\n\n# Head\n\nIntro line one\nline two\n\n## Section\n\n- a\n- b\n  continued\n\n| x | y |\n|---|---|\n\n> q\n\n![img](images/a.webp)\n';
  it('round-trips a page through blocks exactly', () => {
    expect(joinBlocks(parseBlocks(md))).toBe(md);
    const kinds = parseBlocks(md).filter((b) => b.kind !== 'blank').map((b) => b.kind + (b.level ? b.level : ''));
    expect(kinds).toEqual(['meta', 'heading1', 'paragraph', 'heading2', 'list', 'table', 'quote', 'image']);
    expect(parseBlocks('a\r\nb').map((b) => b.text)).toEqual(['a\nb']);
  });
  it('compares versions block by block: same, changed, added, removed', () => {
    const before = '# H\n\nOne.\n\nTwo.\n\nThree.';
    const after = '# H\n\nOne changed.\n\nThree.\n\nFour.';
    expect(diffBlocks(before, after)).toEqual([
      { kind: 'same', before: '# H', after: '# H' },
      { kind: 'changed', before: 'One.', after: 'One changed.' },
      { kind: 'removed', before: 'Two.', after: '' },
      { kind: 'same', before: 'Three.', after: 'Three.' },
      { kind: 'added', before: '', after: 'Four.' },
    ]);
    expect(diffBlocks(before, before).every((d) => d.kind === 'same')).toBe(true);
  });
});

describe('existing_page_ours: a page the engine wrote itself', () => {
  it('matches a published address of the content log whatever its scheme, www, query or trailing slash', () => {
    expect(pageUrlKey('https://www.Novaand-demo.com/insights/x/?utm=1#top')).toBe('novaand-demo.com/insights/x');
    const log = [{ published_url: 'https://novaand-demo.com/insights/x/', status: 'published' }, { published_url: '', status: 'written' }];
    expect(isOwnWrittenPage(log, 'http://www.novaand-demo.com/insights/x')).toBe(true);
    expect(isOwnWrittenPage(log, 'https://novaand-demo.com/insights/y')).toBe(false);
    expect(isOwnWrittenPage(log, '')).toBe(false);
    expect(isOwnWrittenPage([], 'https://novaand-demo.com/insights/x')).toBe(false);
  });
});

describe('a question built from a claim keeps its sentence in context', () => {
  it('original, neutral wording, section and where it sits in the page', () => {
    const q: ClientQuestion = questionsOf({ qa_client_questions: [{ ...Q_CLAIM, in_page: 'cta' }] })[0]!;
    expect(q).toMatchObject({ in_page: 'cta', section: 'How to choose', neutral: 'A sound selection starts with business discovery.' });
  });
});

describe('carryOpenQuestions: the final version keeps what is still open', () => {
  it('keeps unanswered questions of the delivered page, drops answered and stored ones, adds the new ones, re-ranks by impact', () => {
    const base = questionsOf({ qa_client_questions: [Q_CLAIM, Q_BRIEF, Q_BRACKET] });
    const [first, second, third] = base;
    const fresh = [{ id: 'f1', fact_key: 'service.new_claim', impact: 0.99, question: 'Is this new sentence true?', source: 'claim' }, { id: 'f2', fact_key: third!.fact_key, impact: 0.2, question: 'dup' }];
    const out = carryOpenQuestions(base, fresh, [first!.id], [second!.fact_key]);
    expect(out.map((q) => q.id)).toEqual(['f1', third!.id]);
    expect(out.map((q) => q.rank)).toEqual([1, 2]);
    expect(questionsOf({ qa_client_questions: out }).map((q) => q.id)).toEqual(['f1', third!.id]);
  });
  it('nothing open and nothing new gives no questions', () => {
    const base = questionsOf({ qa_client_questions: [Q_CLAIM] });
    expect(carryOpenQuestions(base, [], [base[0]!.id], [])).toEqual([]);
  });
});
