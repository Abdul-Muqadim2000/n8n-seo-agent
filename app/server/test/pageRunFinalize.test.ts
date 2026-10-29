import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliveryOf, type PageReviewView } from '@seo/shared';

// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2 / M8, owner decision D2) on PGlite, the engine in memory: the final version
// keeps every blocker of the page run. The finalize request carries the page-run context of the ORIGINAL report (a second finalize too),
// the final version keeps a copy, and "this website already has a page for the same search" is answered by the client: rewrite that page
// as an update (a page run) or say how this page differs (saved once for the review, sent with the next final version). Client text is
// anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  finalize: [] as Record<string, unknown>[],
  finalizeAnswer: null as null | { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: Record<string, unknown>; error: string | null },
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
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => undefined),
    deleteRows: vi.fn(async () => true),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    publishCheckCall: vi.fn(async () => ({ kind: 'answered', status: 200, json: { ok: true, publishable: true, reasons: [] }, error: null })),
    finalizeCall: vi.fn(async (b: Record<string, unknown>) => (t.finalize.push(b), t.finalizeAnswer ?? { kind: 'unreachable', status: 0, json: {}, error: 'off' })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const BC = 'https://www.novaand-demo.com/dynamics-365-business-central-uae';
const DUP_TEXT = `This website already has a page for the same search: ${BC}. Publish this text as an update of that page, or tell us how the new page differs`;
const Q1 = {
  id: 'q1', rank: 1, impact: 0.85, kind: 'process', category: 'service', fact_key: 'service.business_discovery_assess', source: 'claim',
  question: 'Is this true for Nova&? "Before we recommend a product, we run business discovery in our Assess phase."', why: 'Nothing on file says it.',
  original: 'Before we recommend a product, we run business discovery in our Assess phase.', neutral: 'A sound selection starts with business discovery.',
  in_page: 'neutral', section: 'How to choose', answer_type: 'choice', prefill: '', prefill_source: '',
};
const Q3 = { id: 'q3', rank: 2, impact: 0.8, kind: 'credential', category: 'credential', fact_key: 'credential.partner_designation', source: 'bracket', question: 'Please confirm the Microsoft partner designation.', why: 'The writer needed it.', original: '', neutral: '', in_page: 'left_out', section: '', answer_type: 'text', prefill: '', prefill_source: '' };
const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
const MD = `# MS 365 ERP for UAE businesses\n\nA sound selection starts with business discovery. ${words}\n\n## How to choose\n\nCompare the options.\n`;
/** a page run delivered with the duplicate-page blocker (3299's shape, old format: no page_run) */
const DUP_PAYLOAD = {
  stage: 'content',
  keyword: 'ms 365 erp',
  domain: 'novaand-demo.com',
  country: 'United Arab Emirates',
  request_id: '3298',
  verdict: 'GO_WITH_CHANGES',
  score: 42,
  score_withheld: false,
  markdown: MD,
  html: `<article><h1>MS 365 ERP</h1><p>${words}</p></article>`,
  meta: {
    title: 'MS 365 ERP in the UAE', meta_description: 'Microsoft 365, Dynamics 365 and ERP in the UAE: what each one does and how to choose the system your business needs.', slug: 'ms-365-erp-uae',
    h1: 'MS 365 ERP for UAE businesses', primary_keyword: 'ms 365 erp', page_type: 'Service Page', domain: 'novaand-demo.com', schema_blocks: [],
    originality: { passed: true, threshold_pct: 15, duplicate_targets: [{ url: BC, title: 'Business Central ERP Solutions in UAE', keyword_words_shared_pct: 100 }], top_overlaps: [] },
  },
  qa_delivery_status: 'not_ready',
  qa_client_questions: [Q1, Q3],
  qa_grade: { score: 92, of: 100, breakdown: { structure: 25, coverage: 25, readability: 15, specificity: 10, clean_language: 10, length: 7 } },
  qa_blocking: [{ code: 'duplicate_page', text: DUP_TEXT, action: 'publish it as an update of your existing page for this search, or tell us how the new page differs' }],
  qa_advisory: [],
  qa_publishable: false,
  qa_not_ready: true,
};

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.finalize = [];
  t.finalizeAnswer = null;
});

let seq = 0;
async function setup(o: { payload?: Record<string, unknown> } = {}) {
  const n = ++seq;
  const email = `owner${n}@page-run.test`;
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Page Run ${n}` })).body as { id: string };
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain: `novaand-demo${n}.com`, country: 'United Arab Emirates', businessFacts: 'Microsoft partner; offices in Ajman', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'none' })
    .returning();
  const p0 = o.payload ?? DUP_PAYLOAD;
  const [report] = await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'content', status: 'completed', title: 'ms 365 erp', requestId: '3298', payload: { ...p0, domain: site!.domain } }).returning();
  return { u, org, site: site!, report: report!, base: `/api/orgs/${org.id}/reports/${report!.id}/review` };
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
/** the engine's answer: the duplicate page still open (as W0-B's Finalize Verdict keeps it), or resolved by the client's reason */
const engine = (o: { resolved?: boolean } = {}) => ({
  kind: 'answered' as const,
  status: 200,
  error: null,
  json: {
    ok: true, request_id: 'x', markdown: MD, applied: [], sections_rewritten: [], changes: [],
    delivery_status: o.resolved ? 'ready' : 'not_ready',
    delivery: o.resolved
      ? { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [{ code: 'duplicate_decision', text: 'You chose to publish this as a separate page' }], next_step: '', grade: { score: 90 } }
      : { status: 'not_ready', label: 'Not ready', blocking: [{ code: 'duplicate_page', text: DUP_TEXT, action: 'rewrite it as an update of that page' }], advisory: [], next_step: 'x', grade: { score: 90 } },
    client_questions: [], grade: { score: 90 }, cost: { claude_usd: 0.02, dfs_usd: 0, estimated: true, model_calls: 1 },
    decision: o.resolved ? { code: 'duplicate_page', choice: 'differs', url: '', reason: 'r', pages: [BC] } : null,
    page_run: { received: true, gating_missing: [], grading_missing: ['length_band'], kept_open: o.resolved ? [] : ['duplicate_page'], resolved: o.resolved ? ['duplicate_page'] : [] },
  },
});

describe('the finalize request carries the page run of the original report (PLAN Fix 2)', () => {
  it('the first finalize sends the original\'s blockers; the final version keeps a copy; a second finalize from it still sends the original\'s', async () => {
    const s = await setup();
    await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
    t.finalizeAnswer = engine();
    await s.u.c.post(`${s.base}/finalize`, {});
    const v = await waitFinal(s.u.c, s.base);
    expect(v.finalize.status).toBe('done');
    const b1 = t.finalize[0]!;
    const pr1 = b1.page_run as Record<string, unknown>;
    expect((pr1.qa_blocking as { code: string }[]).map((x) => x.code)).toEqual(['duplicate_page']);
    expect(pr1).toMatchObject({ verdict: 'GO_WITH_CHANGES', score: 42, page_type: 'Service Page', length_points: 7, missing: [], content_request_id: '3298' });
    expect(b1.content_request_id).toBe('3298');
    // the final version: not ready because of the duplicate, and it keeps the page-run context
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, v.finalize.reportId!));
    const fp = rep!.payload as Record<string, unknown>;
    expect(deliveryOf(fp).status).toBe('not_ready');
    expect(fp.page_run_context).toEqual(pr1);
    // a second finalize, made from the final version after a new answer on it
    const finalBase = `/api/orgs/${s.org.id}/reports/${rep!.id}/review`;
    await s.u.c.put(`${finalBase}/answers`, { answers: [{ questionId: 'q3', decision: 'answer', text: 'Microsoft Solutions Partner' }] });
    t.finalizeAnswer = engine();
    await s.u.c.post(`${finalBase}/finalize`, {});
    await waitFinal(s.u.c, finalBase);
    const b2 = t.finalize[1]!;
    expect(b2.page_run).toEqual(pr1);
    expect(b2.delivered_markdown).toBe(MD);
  });
});

describe('this website already has a page for the same search (D2)', () => {
  it('the review names the page and offers the update run; a reason is saved once, sent with the next final version and can be taken back', async () => {
    const s = await setup();
    const v0 = view(await s.u.c.get(s.base));
    expect(v0.duplicate).toEqual({ pages: [{ url: BC, title: 'Business Central ERP Solutions in UAE' }], decision: null, rewrite: { keyword: 'ms 365 erp', pageType: 'Service Page', country: 'United Arab Emirates' } });
    expect(v0.finalize.needed).toBe(false);
    // too short, refused with the reason in plain words
    const bad = await s.u.c.put(`${s.base}/decision`, { choice: 'differs', reason: 'it is different' });
    expect(bad.status).toBe(400);
    const reason = 'This page is about the Microsoft 365 apps we license; the other one is about Business Central projects.';
    const v1 = view(await s.u.c.put(`${s.base}/decision`, { choice: 'differs', reason }));
    expect(v1.duplicate?.decision).toMatchObject({ choice: 'differs', reason });
    expect(v1.people[v1.duplicate!.decision!.by!]).toBeTruthy();
    expect(Object.keys(v1.answers)).not.toContain('@duplicate_page');
    expect(v1.finalize.needed).toBe(true);
    t.finalizeAnswer = engine({ resolved: true });
    await s.u.c.post(`${s.base}/finalize`, {});
    const v2 = await waitFinal(s.u.c, s.base);
    expect(t.finalize[0]!.duplicate_decision).toEqual({ choice: 'differs', reason });
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, v2.finalize.reportId!));
    expect((rep!.payload as Record<string, unknown>).finalize_decision).toMatchObject({ choice: 'differs' });
    // taken back: the page waits for the client's choice again
    const v3 = view(await s.u.c.put(`${s.base}/decision`, { choice: null }));
    expect(v3.duplicate?.decision).toBeNull();
    const audit = await db.query.auditEvents.findFirst({ where: and(eq(schema.auditEvents.orgId, s.org.id), eq(schema.auditEvents.action, 'page.duplicate_decision')) });
    expect(audit).toBeTruthy();
  });
  it('a page with no duplicate shows no duplicate card and refuses a reason', async () => {
    const s = await setup({ payload: { ...DUP_PAYLOAD, qa_blocking: [], qa_delivery_status: 'ready_with_questions', qa_not_ready: false, qa_publishable: true } });
    const v = view(await s.u.c.get(s.base));
    expect(v.duplicate).toBeNull();
    const r = await s.u.c.put(`${s.base}/decision`, { choice: 'differs', reason: 'This page is about something else entirely, for other buyers.' });
    expect(r.status).toBe(400);
  });
});
