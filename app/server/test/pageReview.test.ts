import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildN8nPayload, cmsReadiness, compactBody, deliveryDecision, RUN_SCHEMAS, type ContentLogRow, type PageReviewView } from '@seo/shared';

// H3 (2026-10-28, docs/content-quality-2026-10-27): the review of a written page end to end on PGlite, the engine in memory. The client
// answers the page's questions (each one a business fact of the website, stored once, sent to the engine, never asked again), edits
// the page (sanitised, checked again for free), asks for the final version (a small charged run: the engine's answer becomes a new
// report that the delivery rule and the CMS accept), and approves it. Client text is anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  admin: [] as Record<string, unknown>[],
  finalize: [] as Record<string, unknown>[],
  checks: [] as Record<string, unknown>[],
  finalizeAnswer: null as null | { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: Record<string, unknown>; error: string | null },
  checkAnswer: { kind: 'answered', status: 200, json: { ok: true, publishable: false, reasons: ['A bracket left in the text: [Price]'] }, error: null } as { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: Record<string, unknown>; error: string | null },
  log: [] as import('@seo/shared').ContentLogRow[],
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => ({ ...(await orig<typeof import('../src/lib/mailer')>()), sendMail: vi.fn(async () => true) }));
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async (table: string) => (table === 'contentLog' ? t.log : [])),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => undefined),
    deleteRows: vi.fn(async () => true),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => (t.admin.push(b), { ok: true, action: String(b.action), affected: 1, error: null })),
    publishCheckCall: vi.fn(async (b: Record<string, unknown>) => (t.checks.push(b), t.checkAnswer)),
    finalizeCall: vi.fn(async (b: Record<string, unknown>) => (t.finalize.push(b), t.finalizeAnswer ?? { kind: 'unreachable', status: 0, json: {}, error: 'off' })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const svc = await import('../src/services/pageReview');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;

const Q1 = {
  id: 'q1', rank: 1, impact: 0.85, kind: 'process', category: 'service', fact_key: 'service.business_discovery_assess', source: 'claim',
  question: 'Is this true for Nova&? "Before we recommend a product, we run business discovery in our Assess phase."', why: 'Nothing on file says it.',
  original: 'Before we recommend a product, we run business discovery in our Assess phase.', neutral: 'A sound selection starts with business discovery.',
  in_page: 'neutral', section: 'How to choose', answer_type: 'choice', prefill: 'Assess and Shape: business discovery and gap-fit analysis.', prefill_source: 'https://www.novaand-demo.com/whatwedo/assess-shape',
};
const Q2 = { id: 'q2', rank: 2, impact: 0.9, kind: 'proof', category: 'proof', fact_key: 'proof.client_result_publish', source: 'brief', question: 'Is there a client result you are happy to publish?', why: 'Stronger with it.', original: '', neutral: '', in_page: 'left_out', section: '', answer_type: 'text', prefill: '', prefill_source: '' };
const Q3 = { id: 'q3', rank: 3, impact: 0.8, kind: 'credential', category: 'credential', fact_key: 'credential.partner_designation', source: 'bracket', question: 'Please confirm the Microsoft partner designation.', why: 'The writer needed it.', original: '', neutral: '', in_page: 'left_out', section: '', answer_type: 'text', prefill: 'Microsoft Solutions Partner', prefill_source: 'your business facts' };
const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
const MD = `# ERP systems in the UAE\n\nA sound selection starts with business discovery. ${words}\n\n## How to choose\n\nCompare the options.\n`;
const payload = (o: Record<string, unknown> = {}) => ({
  stage: 'content',
  keyword: 'erp systems in uae',
  domain: 'novaand-demo.com',
  request_id: '2575',
  markdown: MD,
  html: `<article><h1>ERP systems in the UAE</h1><p>${words}</p></article>`,
  meta: { title: 'ERP Systems in UAE: How to Choose', meta_description: 'How to choose an ERP system in the UAE.', slug: 'erp-systems-uae', h1: 'ERP systems in the UAE', primary_keyword: 'erp systems in uae', page_type: 'Service Page', domain: 'novaand-demo.com', schema_blocks: [] },
  qa_delivery_status: 'ready_with_questions',
  qa_client_questions: [Q1, Q2, Q3],
  qa_grade: { score: 91, first_draft_review: 62 },
  qa_blocking: [],
  qa_advisory: [],
  qa_publishable: true,
  qa_not_ready: false,
  cost_usd: 1.04,
  ...o,
});

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.admin = [];
  t.finalize = [];
  t.checks = [];
  t.finalizeAnswer = null;
  t.log = [];
});

let seq = 0;
async function setup(o: { payload?: Record<string, unknown>; tracked?: boolean } = {}) {
  const n = ++seq;
  const email = `owner${n}@page-review.test`;
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Page Review ${n}` })).body as { id: string };
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain: `novaand-demo${n}.com`, country: 'United Arab Emirates', businessFacts: 'Microsoft partner; offices in Ajman', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: o.tracked === false ? 'not_started' : 'active' })
    .returning();
  const p0 = o.payload ?? payload();
  const p1 = { ...p0, domain: site!.domain, meta: { ...(p0.meta as object), domain: site!.domain } };
  const [report] = await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'content', status: 'completed', title: 'ERP systems in UAE', requestId: '2575', payload: p1 }).returning();
  const base = `/api/orgs/${org.id}/reports/${report!.id}/review`;
  return { u, org, site: site!, report: report!, base };
}
const view = (r: { body: unknown }) => r.body as PageReviewView;

async function waitFinal(c: { get: (u: string) => Promise<{ body: unknown }> }, url: string): Promise<PageReviewView> {
  for (let i = 0; i < 60; i++) {
    const v = view(await c.get(url));
    if (v.finalize.status !== 'running') return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('finalize still running');
}

describe('reading the review', () => {
  it('shows the delivered status, the ranked questions, the quote, and that nothing is to finalise yet', async () => {
    const s = await setup();
    const v = view(await s.u.c.get(s.base));
    expect(v.delivery).toMatchObject({ status: 'ready_with_questions', grade: 91, firstDraftReview: 62, headline: 'Ready, and stronger with your input (3 questions)' });
    expect(v.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(v.questions.every((q) => q.stored === null)).toBe(true);
    expect(v.stage).toBe('questions');
    expect(v.finalize).toMatchObject({ status: 'none', needed: false, quote: { usd: 0.1 } });
    expect(v.finalize.quote.credits).toBeGreaterThan(0);
    expect(v.finalize.reason).toMatch(/Answer a question or edit the page first/);
    expect(v.delivered.slug).toBe('erp-systems-uae');
    expect(v.publish.status).toBe('not_published');
    expect(v.isFinal).toBe(false);
  });
  it('another company gets 404, and a report without a page is not a page review', async () => {
    const s = await setup();
    const other = await setup();
    expect((await other.u.c.get(s.base)).status).toBe(404);
    const [plain] = await db.insert(schema.reports).values({ orgId: s.org.id, siteId: s.site.id, stage: 'content', status: 'completed', title: 'Verdict', payload: { verdict: 'GO' } }).returning();
    expect((await s.u.c.get(`/api/orgs/${s.org.id}/reports/${plain!.id}/review`)).status).toBe(404);
  });
  it('a viewer reads but cannot answer', async () => {
    const s = await setup();
    const viewerMail = `viewer${seq}@page-review.test`;
    const v = await signUp(app, viewerMail);
    const [vu] = await db.select().from(schema.users).where(eq(schema.users.email, viewerMail));
    await db.insert(schema.memberships).values({ orgId: s.org.id, userId: vu!.id, role: 'viewer' });
    expect((await v.c.get(s.base)).status).toBe(200);
    expect((await v.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] })).status).toBe(403);
  });
});

describe('answering: saved per question, kept as business facts, never asked again', () => {
  it('yes / leave general / not now are saved; facts stored once and sent to the engine; the page now needs a final version', async () => {
    const s = await setup();
    const r = await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }, { questionId: 'q2', decision: 'general' }, { questionId: 'q3', decision: 'skip' }] });
    expect(r.status).toBe(200);
    const v = view(r);
    expect(Object.keys(v.answers).sort()).toEqual(['q1', 'q2', 'q3']);
    expect(v.answers.q1).toMatchObject({ decision: 'yes', factKey: 'service.business_discovery_assess' });
    expect(v.finalize.needed).toBe(true);
    expect(v.stage).toBe('questions');   // q3 is still open (not now)
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, s.site.id));
    expect(Object.keys(site!.factAnswers).sort()).toEqual(['proof.client_result_publish', 'service.business_discovery_assess']);
    expect(site!.factAnswers['service.business_discovery_assess']).toMatchObject({ decision: 'yes', text: Q1.original, reportId: s.report.id });
    expect(site!.factAnswers['proof.client_result_publish']).toMatchObject({ decision: 'general', text: '' });
    expect(t.admin).toHaveLength(1);
    expect(t.admin[0]).toMatchObject({ action: 'facts', domain: s.site.domain, business_facts: 'Microsoft partner; offices in Ajman' });
    expect(t.admin[0]!.fact_answers).toEqual({ 'proof.client_result_publish': { decision: 'general', text: '' }, 'service.business_discovery_assess': { decision: 'yes', text: Q1.original } });
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'page.answered')));
    expect(audits).toHaveLength(1);
  });
  it('a website the engine does not track keeps the facts in the app only', async () => {
    const s = await setup({ tracked: false });
    expect((await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'remove' }] })).status).toBe(200);
    expect(t.admin).toHaveLength(0);
  });
  it('refuses a choice the question does not offer, and an edit without words', async () => {
    const s = await setup();
    expect((await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'answer', text: 'x' }] })).status).toBe(400);
    const r = await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'edit', text: '  ' }] });
    expect(r.status).toBe(400);
    expect(r.body.error ?? r.body.message).toMatch(/Write your wording/);
    expect((await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'zz', decision: 'yes' }] })).status).toBe(400);
  });
  it('a later page shows a stored fact as answered and carries it to the engine', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'edit', text: 'We start every project with discovery.' }] });
    const [later] = await db.insert(schema.reports).values({ orgId: s.org.id, siteId: s.site.id, stage: 'content', status: 'completed', title: 'ERP partner', payload: payload({ keyword: 'erp partner uae', request_id: '2600', qa_client_questions: [{ ...Q1, id: 'q1' }, Q2] }) }).returning();
    const v = view(await s.u.c.get(`/api/orgs/${s.org.id}/reports/${later!.id}/review`));
    expect(v.questions.find((q) => q.id === 'q1')!.stored).toMatchObject({ decision: 'edit', text: 'We start every project with discovery.' });
    expect(v.stage).toBe('questions');   // q2 is still open
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, s.site.id));
    const { siteContext } = await import('../src/services/runs');
    const input = RUN_SCHEMAS.keyword.parse({ mode: 'keyword', siteId: s.site.id, keyword: 'erp partner uae', country: 'United Arab Emirates' });
    const body = compactBody(buildN8nPayload(input, siteContext(site!), { callbackUrl: 'http://x', email: '' }));
    expect(body.business_facts_kv).toEqual({ 'service.business_discovery_assess': 'We start every project with discovery.' });
    expect(body.stored_fact_keys).toEqual(['service.business_discovery_assess']);
    const keys = Object.keys(body);
    expect(keys.indexOf('business')).toBeLessThan(keys.indexOf('business_facts'));
    expect(keys.indexOf('business_facts')).toBeLessThan(keys.indexOf('business_facts_kv'));
  });
  it('accept all suggestions answers every open question that has one', async () => {
    const s = await setup();
    const v = view(await s.u.c.post(`${s.base}/accept-prefilled`, {}));
    expect(v.answers.q1).toMatchObject({ decision: 'yes', fromPrefill: true });
    expect(v.answers.q3).toMatchObject({ decision: 'answer', text: 'Microsoft Solutions Partner' });
    expect(v.answers.q2).toBeUndefined();
    expect((await s.u.c.post(`${s.base}/accept-prefilled`, {})).status).toBe(400);   // nothing left with a suggestion
  });
});

describe('the client version (the editor)', () => {
  it('is sanitised, checked for free and can be undone', async () => {
    const s = await setup();
    const md = `${MD}\nMore text <script>alert(1)</script> and [a link](javascript:alert(1)).\n`;
    const v = view(await s.u.c.put(`${s.base}/version`, { markdown: md }));
    expect(v.clientVersion!.markdown).not.toMatch(/script|javascript/);
    expect(v.clientVersion!.markdown).toContain('More text  and a link.');
    expect(v.clientVersion!.check).toMatchObject({ status: 'not_ready', ran: true, blocking: [{ text: 'A bracket left in the text: [Price]' }] });
    expect(t.checks[0]).toMatchObject({ keyword: 'erp systems in uae', domain: s.site.domain });
    expect(String(t.checks[0]!.markdown)).toMatch(/^Title: ERP Systems in UAE: How to Choose\nMeta Description: /);
    expect(v.finalize.needed).toBe(true);
    const back = view(await s.u.c.del(`${s.base}/version`));
    expect(back.clientVersion).toBeNull();
    expect(back.finalize.needed).toBe(false);
  });
  it('says so when the free check could not run', async () => {
    const s = await setup();
    const keep = t.checkAnswer;
    t.checkAnswer = { kind: 'unreachable', status: 0, json: {}, error: 'down' };
    const v = view(await s.u.c.put(`${s.base}/version`, { markdown: MD }));
    t.checkAnswer = keep;
    expect(v.clientVersion!.check).toMatchObject({ ran: false, status: 'unknown' });
  });
});

describe('the final version', () => {
  const ok = (o: Record<string, unknown> = {}) => ({
    kind: 'answered' as const,
    status: 200,
    error: null,
    json: {
      ok: true,
      request_id: 'x',
      markdown: MD.replace('A sound selection starts with business discovery.', 'Before we recommend a product, we run business discovery in our Assess phase.'),
      applied: [{ id: 'q1', how: 'kept_original', section: 's0' }],
      sections_rewritten: [],
      changes: [{ section: 's0', what: 'kept your sentence', before: 'A sound selection starts with business discovery.', after: 'Before we recommend a product, we run business discovery in our Assess phase.' }],
      delivery_status: 'ready',
      delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 94 } },
      client_questions: [],
      grade: { score: 94 },
      cost: { claude_usd: 0.03, dfs_usd: 0, estimated: true, model_calls: 1 },
      ...o,
    },
  });
  it('is refused when nothing would change', async () => {
    const s = await setup();
    const r = await s.u.c.post(`${s.base}/finalize`, {});
    expect(r.status).toBe(409);
    expect(t.finalize).toHaveLength(0);
  });
  it('sends the answers and the client version, becomes a new report the delivery rule and the CMS accept, and settles the run', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }, { questionId: 'q2', decision: 'answer', text: 'A distributor cut month-end close from 9 to 4 days.' }] });
    t.finalizeAnswer = ok();
    const started = view(await s.u.c.post(`${s.base}/finalize`, {}));
    expect(['running', 'done']).toContain(started.finalize.status);
    const v = await waitFinal(s.u.c, s.base);
    expect(v.finalize.status).toBe('done');
    expect(v.stage).toBe('final_ready');
    expect(v.finalize.needed).toBe(false);
    expect(v.delivered.markdown).toContain('we run business discovery in our Assess phase');
    // the engine got exactly what changes the page
    const body = t.finalize[0]!;
    expect(body).toMatchObject({ mode: 'finalize', domain: s.site.domain, keyword: 'erp systems in uae', client_edited: false, content_request_id: '2575' });
    expect((body.answers as { id: string; decision: string; text: string }[]).map((a) => [a.id, a.decision])).toEqual([['q1', 'yes'], ['q2', 'answer']]);
    expect(body.stored_fact_keys).toEqual(['proof.client_result_publish', 'service.business_discovery_assess']);
    // the new report
    const finalId = v.finalize.reportId!;
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, finalId));
    expect(rep!.title).toBe('Final version: "erp systems in uae"');
    const p = rep!.payload as Record<string, unknown>;
    expect(p.finalized_from).toBe(s.report.id);
    expect(p.cost_usd).toBeUndefined();
    expect(deliveryDecision({ stage: rep!.stage, status: rep!.status, payload: p }).deliver).toBe(true);
    expect(cmsReadiness({ stage: rep!.stage, status: rep!.status, payload: p, siteDomain: s.site.domain }).liveAllowed).toBe(true);
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, rep!.runId!));
    expect(run).toMatchObject({ mode: 'finalize', status: 'completed', actualCostUsd: 0.03, actualCostEstimated: true });
    expect(run!.quotedCredits).toBeGreaterThan(0);
    // the final report's own review
    const fv = view(await s.u.c.get(`/api/orgs/${s.org.id}/reports/${finalId}/review`));
    expect(fv).toMatchObject({ isFinal: true, finalOf: s.report.id, stage: 'final_ready' });
    // the delivered page's question left unanswered is still open on the final version (the engine sends only new ones)
    expect(fv.delivery).toMatchObject({ status: 'ready_with_questions', grade: 94, headline: 'Ready, and stronger with your input (1 question)' });
    expect(fv.questions.filter((q) => !q.stored).map((q) => q.id)).toEqual(['q3']);
    // a second click with nothing new is refused
    expect((await s.u.c.post(`${s.base}/finalize`, {})).status).toBe(409);
  });
  it('a failed engine answer fails the run (not charged) and says so', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'remove' }] });
    t.finalizeAnswer = { kind: 'answered', status: 500, json: {}, error: null };
    await s.u.c.post(`${s.base}/finalize`, {});
    const v = await waitFinal(s.u.c, s.base);
    expect(v.finalize.status).toBe('failed');
    expect(v.finalize.error).toMatch(/Nothing was charged/);
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, v.finalize.runId!));
    expect(run!.status).toBe('failed');
    expect(v.finalize.needed).toBe(true);   // the client can try again
  });
});

describe('approval', () => {
  it('refuses a page that is not ready, with its reason', async () => {
    const s = await setup({ payload: payload({ qa_delivery_status: 'not_ready', qa_publishable: false, qa_not_ready: true, qa_blocking: [{ code: 'duplicate_page', text: 'This website already has a page for the same search' }], qa_client_questions: [] }) });
    const r = await s.u.c.post(`${s.base}/approve`, {});
    expect(r.status).toBe(409);
    expect(r.body.error ?? r.body.message).toMatch(/already has a page for the same search/);
  });
  it('records who approved which version, in the review and the audit log', async () => {
    const s = await setup();
    const v = view(await s.u.c.post(`${s.base}/approve`, {}));
    expect(v.approval).toMatchObject({ reportId: s.report.id });
    expect(v.stage).toBe('approved');
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'page.approved')));
    expect(audits).toHaveLength(1);
  });
  it('names the people behind every id the review returns (name, else e-mail, else "a team member"), never an id alone', async () => {
    const s = await setup();
    const [owner] = await db.update(schema.users).set({ name: 'Sara Haddad' }).where(eq(schema.users.email, `owner${seq}@page-review.test`)).returning();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
    const approved = view(await s.u.c.post(`${s.base}/approve`, {}));
    expect(approved.approval!.approvedBy).toBe(owner!.id);
    expect(approved.people[owner!.id]).toBe('Sara Haddad');
    // a colleague without a name saved the client version; an answer was given by a person since deleted
    const mail = `noname${seq}@page-review.test`;
    await signUp(app, mail);
    const [mate] = await db.update(schema.users).set({ name: '  ' }).where(eq(schema.users.email, mail)).returning();
    const gone = '00000000-1111-4222-8333-444444444444';
    const [row] = await db.select().from(schema.pageReviews).where(eq(schema.pageReviews.reportId, s.report.id));
    await db
      .update(schema.pageReviews)
      .set({ clientMarkdown: MD, clientSavedAt: new Date(), clientSavedBy: mate!.id, answers: { ...row!.answers, q2: { questionId: 'q2', factKey: 'x.y', decision: 'general', text: '', at: new Date().toISOString(), by: gone } } })
      .where(eq(schema.pageReviews.id, row!.id));
    const v = view(await s.u.c.get(s.base));
    expect(v.clientVersion!.savedBy).toBe(mate!.id);
    expect(v.people).toEqual({ [owner!.id]: 'Sara Haddad', [mate!.id]: mail, [gone]: 'a team member' });
    expect(v.answers.q1!.by).toBe(owner!.id);
    // every *_by / by the view carries has a name
    for (const id of [v.approval!.approvedBy, v.clientVersion!.savedBy, ...Object.values(v.answers).map((a) => a.by), ...v.questions.map((q) => q.stored?.by)]) if (id) expect(v.people[id]).toBeTruthy();
  });
  it('reads where the page stands on the website from the content log (a live check) or the CMS', async () => {
    const s = await setup();
    t.log = [{ keyword: 'erp systems in uae', request_id: '2575', status: 'published', published_url: `https://www.${s.site.domain}/erp-systems-uae/`, published_at: '2026-10-28', publish_note: '' } as unknown as ContentLogRow];
    const v = view(await s.u.c.get(s.base));
    expect(v.publish.status).toBe('live_verified');
    expect(v.stage).toBe('live_verified');
  });
});

describe('the website business details', () => {
  it('lists, changes and removes a fact, synced to the engine', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
    const url = `/api/orgs/${s.org.id}/sites/${s.site.id}/facts`;
    expect(Object.keys((await s.u.c.get(url)).body.facts)).toEqual(['service.business_discovery_assess']);
    const put = await s.u.c.put(`${url}/service.business_discovery_assess`, { decision: 'edit', text: 'We start with discovery.' });
    expect(put.status).toBe(200);
    expect(put.body.facts['service.business_discovery_assess']).toMatchObject({ decision: 'edit', text: 'We start with discovery.' });
    expect((await s.u.c.put(`${url}/bad key`, { decision: 'edit', text: 'x' })).status).toBe(400);
    expect((await s.u.c.put(`${url}/service.x`, { decision: 'edit', text: '' })).status).toBe(400);
    const del = await s.u.c.del(`${url}/service.business_discovery_assess`);
    expect(del.body.facts).toEqual({});
    expect((await s.u.c.del(`${url}/service.business_discovery_assess`)).status).toBe(404);
    expect(t.admin.at(-1)).toMatchObject({ action: 'facts', fact_answers: {} });
  });
});

describe('the Pipeline and the content board', () => {
  it('lists a page with open questions as one Needs-you item, gone once approved', async () => {
    const s = await setup();
    const items = await svc.questionNeedsYou(s.org.id, s.site);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'questions', severity: 'info', title: '3 questions on "erp systems in uae"', action: { label: 'Answer them', reportId: s.report.id } });
    expect(items[0]!.detail).toContain('First: Is this true for Nova&?');
    await s.u.c.post(`${s.base}/approve`, {});
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, s.site.id));
    expect(await svc.questionNeedsYou(s.org.id, site!)).toHaveLength(0);
  });
  it('the board summary of a content-log row', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, s.site.id));
    const sr = await svc.siteReviews(s.org.id, site!);
    const log = { keyword: 'erp systems in uae', request_id: '2575', status: 'written', published_url: '', published_at: '', publish_note: '' } as unknown as ContentLogRow;
    const page = sr.pageFor(log)!;
    expect(page.id).toBe(s.report.id);
    expect(sr.summaryOf(page, log)).toEqual({ reportId: s.report.id, stage: 'questions', label: 'Ready, stronger with your input', questions: 3, answered: 1, grade: 91 });
  });
});

describe('pure rules', () => {
  it('answers are kept per report', () => {
    const all = { q1: { decision: 'yes' }, 'fin-1/q1': { decision: 'remove' } } as never;
    expect(Object.keys(svc.answersFor(all, 'orig', 'orig'))).toEqual(['q1']);
    expect(svc.answersFor(all, 'orig', 'fin-1')).toEqual({ q1: { decision: 'remove' } });
    expect(svc.answerKey('orig', 'fin-1', 'q2')).toBe('fin-1/q2');
  });
  it('finalize state: running, stale after 15 minutes, failed, done', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    const started = new Date(now - 60_000);
    expect(svc.finalizeStateOf(null, null, now).status).toBe('none');
    expect(svc.finalizeStateOf({ finalRunId: 'r', finalReportId: null, finalError: null, finalStartedAt: started }, { status: 'running' }, now)).toEqual({ status: 'running', stale: false });
    expect(svc.finalizeStateOf({ finalRunId: 'r', finalReportId: null, finalError: null, finalStartedAt: new Date(now - 16 * 60_000) }, { status: 'running' }, now)).toEqual({ status: 'failed', stale: true });
    expect(svc.finalizeStateOf({ finalRunId: 'r', finalReportId: null, finalError: 'x', finalStartedAt: started }, { status: 'failed' }, now).status).toBe('failed');
    expect(svc.finalizeStateOf({ finalRunId: 'r', finalReportId: 'f', finalError: null, finalStartedAt: started }, { status: 'completed' }, now).status).toBe('done');
  });
  it('the engine answer: ok, refused, off, unreachable', () => {
    expect(svc.interpretFinalize({ kind: 'answered', status: 200, json: { ok: true, markdown: 'x'.repeat(60) } }).ok).toBe(true);
    expect(svc.interpretFinalize({ kind: 'answered', status: 200, json: { ok: true, markdown: 'short' } }).ok).toBe(false);
    expect(svc.interpretFinalize({ kind: 'answered', status: 400, json: { error: 'markdown required' } })).toMatchObject({ ok: false, error: expect.stringContaining('markdown required') });
    expect(svc.interpretFinalize({ kind: 'answered', status: 404, json: {} })).toMatchObject({ error: expect.stringContaining('not switched on') });
    expect(svc.interpretFinalize({ kind: 'timeout', status: 0, json: {} })).toMatchObject({ error: expect.stringContaining('Nothing was charged') });
  });
  it('publish state: verified live, confirmed by the owner, live or draft in the CMS, not published', () => {
    const d = new Date('2026-10-28T00:00:00Z');
    expect(svc.publishStateOf({ log: { status: 'published', published_url: 'https://a/x', published_at: '2026-10-28', publish_note: '' }, cms: [] }).status).toBe('live_verified');
    expect(svc.publishStateOf({ log: { status: 'published', published_url: 'https://a/x', published_at: '', publish_note: 'owner confirmed' }, cms: [] }).status).toBe('published');
    expect(svc.publishStateOf({ log: null, cms: [{ remoteStatus: 'published', remoteUrl: 'https://a/x', updatedAt: d }] }).status).toBe('published');
    expect(svc.publishStateOf({ log: null, cms: [{ remoteStatus: 'draft', remoteUrl: '', updatedAt: d }] }).status).toBe('sent_draft');
    expect(svc.publishStateOf({ log: null, cms: [] }).status).toBe('not_published');
  });
  it('a hand-set fact needs words unless it is a decision', () => {
    expect(svc.setFact({}, 'proof.x', { decision: 'general' }, null, 't')).toMatchObject({ facts: { 'proof.x': { decision: 'general', text: '', category: 'proof' } } });
    expect(svc.setFact({}, 'proof.x', { decision: 'answer', text: '' }, null, 't')).toMatchObject({ error: expect.stringContaining('Write the detail') });
    expect(svc.setFact({}, 'proof x', { decision: 'general' }, null, 't')).toMatchObject({ error: 'Unknown business detail.' });
  });
});

// W0-A (2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 1): production page 3299 stored "Slug: ms-365-erp-uae" as its
// meta description (the engine's claim check emptied it and a reader took the next line); the app showed it and sent it back to finalize.
describe('a broken meta description (W0-A)', () => {
  const broken = () => payload({ meta: { ...(payload().meta as object), meta_description: 'Slug: erp-systems-uae' } });
  const REBUILT = 'ERP systems in the UAE: how to choose between the main products, what to check for VAT and e-invoicing, and the questions to ask a partner.';
  it('is repaired when the review is read: shown as missing, with what to do', async () => {
    const s = await setup({ payload: broken() });
    const v = view(await s.u.c.get(s.base));
    expect(v.delivered.metaDescription).toBe('');
    expect(v.delivered.metaDescriptionNote).toMatch(/^Missing\. Make the final version/);
    const good = await setup();
    const g = view(await good.u.c.get(good.base));
    expect(g.delivered.metaDescription).toBe('How to choose an ERP system in the UAE.');   // short but the page's own: shown as it is
    expect(g.delivered.metaDescriptionNote).toBe('');
  });
  it('is never sent back to the engine, and the final version keeps the description the engine wrote', async () => {
    const s = await setup({ payload: broken() });
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
    t.finalizeAnswer = {
      kind: 'answered',
      status: 200,
      error: null,
      json: {
        ok: true,
        request_id: 'x',
        markdown: MD.replace('A sound selection starts with business discovery.', 'Before we recommend a product, we run business discovery in our Assess phase.'),
        applied: [{ id: 'q1', how: 'kept_original', section: 's0' }],
        sections_rewritten: [],
        changes: [],
        delivery_status: 'ready',
        delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 92 } },
        client_questions: [],
        grade: { score: 92 },
        cost: { claude_usd: 0, dfs_usd: 0, estimated: false, model_calls: 0 },
        meta: { title: 'ERP Systems in UAE: How to Choose', meta_description: REBUILT, slug: 'erp-systems-uae' },
      },
    };
    await s.u.c.post(`${s.base}/finalize`, {});
    const v = await waitFinal(s.u.c, s.base);
    expect(v.finalize.status).toBe('done');
    expect((t.finalize[0]!.meta as Record<string, unknown>).meta_description).toBe('');
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, v.finalize.reportId!));
    expect(((rep!.payload as Record<string, unknown>).meta as Record<string, unknown>).meta_description).toBe(REBUILT);
  });
});
