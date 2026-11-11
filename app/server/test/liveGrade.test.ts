import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentLogRow } from '@seo/shared';

// Client reports 2026-11-11 (devaicon.com: "I published the pages after fixing every issue the tool listed, but the card still shows the
// old score of the page"): the job that has the engine grade each live page after its publish check, on PGlite with the engine in memory.
// Client text is anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  answer: null as null | { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: Record<string, unknown>; error: string | null },
  log: [] as import('@seo/shared').ContentLogRow[],
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LIVE_GRADE_JOBS = 'false';
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
    finalizeCall: vi.fn(async (b: Record<string, unknown>) => (t.calls.push(b), t.answer ?? { kind: 'unreachable', status: 0, json: {}, error: 'off' })),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
const lg = await import('../src/services/liveGrade');
const data = await import('../src/services/data');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
const DAY = 86_400_000;
const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
const content = (o: Record<string, unknown> = {}) => ({
  stage: 'content', keyword: 'application & software development', request_id: '6453', markdown: `# Application and software development\n\n${words}\n`, html: `<article><p>${words}</p></article>`,
  meta: { title: 'Application & Software Development | Nova&', meta_description: 'Custom application and software development for UAE companies, from discovery to support.', slug: 'application-software-development', h1: 'Application and software development', primary_keyword: 'application & software development', page_type: 'Service Page' },
  qa_delivery_status: 'needs_work', qa_grade: { score: 59 }, qa_blocking: [], qa_advisory: [], qa_client_questions: [], qa_publishable: true, qa_not_ready: false, ...o,
});
const published = (o: Record<string, unknown> = {}) => ({
  stage: 'published', keyword: 'application & software development', content_request_id: '6453', published_url: '', live: true, recorded: true, passed: 10, checks: Array.from({ length: 16 }, () => ({})), failed: [],
  verify_evidence: { h1: 'Application &amp; Software Development Services', title: 'Application &amp; Software Development Services | Nova&' }, ...o,
});
const GRADED = (score: number) => ({
  kind: 'answered' as const, status: 200, error: null,
  json: { ok: true, grade_only: true, request_id: 'x', markdown: '# live', delivery_status: score >= 80 ? 'ready' : 'needs_work', grade: { score },
    delivery: { status: score >= 80 ? 'ready' : 'needs_work', label: 'Needs work: specificity', blocking: score < 60 ? [{ code: 'bracket', text: 'A bracket is left in the text: [Price]' }] : [], advisory: [{ code: 'a', text: 'x' }], next_step: '', grade: { score } },
    client_questions: [], live_read: { ok: true, url: 'https://x', title: 'Application & Software Development Services', words: 1840 } },
});

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  t.calls = [];
  t.answer = null;
  t.log = [];
  // every test starts with a platform of its own: earlier tests' websites are not candidates any more
  await db.update(schema.organizations).set({ disabled: true });
});

let seq = 0;
async function setup() {
  const n = ++seq;
  const email = `owner${n}@live-grade.test`;
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Live Grade ${n}` })).body as { id: string };
  const domain = `novaand-demo${n}.com`;
  const [site] = await db.insert(schema.sites).values({ orgId: org.id, domain, country: 'United Arab Emirates', businessFacts: 'Microsoft partner', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'active' }).returning();
  const url = `https://${domain}/services/application-software-development`;
  const [original] = await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'content', status: 'completed', title: 'Page', requestId: '6453', payload: content({ domain }) }).returning();
  const [final] = await db
    .insert(schema.reports)
    .values({ orgId: org.id, siteId: site!.id, stage: 'content', status: 'completed', title: 'Final version', requestId: 'app-fin-1', payload: content({ domain, finalized_from: original!.id, request_id: 'app-fin-1', markdown: `# Final version\n\n${words}\n` }) })
    .returning();
  await db.insert(schema.pageReviews).values({ orgId: org.id, siteId: site!.id, reportId: original!.id, finalReportId: final!.id });
  t.log = [{ id: 1, createdAt: '', updatedAt: '', site_id: `site_${domain.replace(/\./g, '-')}`, domain, keyword: 'application & software development', source: 'manual', page_type: 'Service Page', existing_page_url: '', rung: 0, ladder_id: '', request_id: '6453', started_at: '2026-11-02T09:51:48Z', status: 'published', published_url: url, published_at: '2026-11-11T09:48:43Z', week: '' } as ContentLogRow];
  const check = async (at: Date, o: Record<string, unknown> = {}) =>
    (await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'published', status: 'completed', title: 'Published', requestId: null, payload: published({ published_url: url, ...o }), receivedAt: at }).returning())[0]!;
  return { org, site: site!, original: original!, final: final!, url, check };
}
const reviewRow = async (reportId: string) => (await db.query.pageReviews.findFirst({ where: eq(schema.pageReviews.reportId, reportId) }))!;
const counts = async () => ({ runs: (await db.select().from(schema.runs)).length, reports: (await db.select().from(schema.reports)).length });

describe('the live-grade job', () => {
  it('grades the live page from its newest recorded check: the final version\'s finalize body, no answers, grade_only and the live address; free', async () => {
    const s = await setup();
    const c1 = await s.check(new Date('2026-11-11T09:48:43Z'));
    await s.check(new Date('2026-11-11T09:50:00Z'), { recorded: false });   // a refused re-check is not graded
    t.answer = GRADED(74);
    const before = await counts();
    const out = await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    expect(out.graded).toHaveLength(1);
    expect(t.calls).toHaveLength(1);
    const b = t.calls[0]!;
    expect(b).toMatchObject({ mode: 'finalize', domain: s.site.domain, answers: [], grade_only: true, content_request_id: '6453', client_edited: false });
    expect(b.markdown).toMatch(/^# Final version/);
    expect(b.grade_live).toEqual({ url: s.url, h1: 'Application & Software Development Services', title: 'Application & Software Development Services | Nova&' });
    expect(String(b.request_id)).toMatch(/^app-live-/);
    const row = await reviewRow(s.original.id);
    expect(row.liveGrade).toMatchObject({ score: 74, status: 'needs_work', published_report_id: c1.id, advisory_count: 1, words: 1840 });
    expect(row.liveGradedAt?.toISOString()).toBe('2026-11-11T09:48:43.000Z');
    // no run row, no report, nothing charged
    expect(await counts()).toEqual(before);

    // the board: the live grade on the card, nothing pending
    const org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, s.org.id) }))!;
    const item = (await data.contentData(org, s.site)).items[0]!;
    expect(item.review?.liveGrade).toMatchObject({ score: 74, publishedReportId: c1.id });
    expect(item.review?.liveGradePending).toBeUndefined();

    // nothing new: not asked again
    t.calls = [];
    await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    expect(t.calls).toHaveLength(0);

    // the client re-checks after another fix: pending on the board, then graded again
    const c2 = await s.check(new Date('2026-11-11T12:00:00Z'));
    expect((await data.contentData(org, s.site)).items[0]!.review?.liveGradePending).toBe(true);
    t.answer = GRADED(88);
    await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    expect(t.calls).toHaveLength(1);
    expect((await reviewRow(s.original.id)).liveGrade).toMatchObject({ score: 88, status: 'ready', published_report_id: c2.id, read_failed: null });
  });

  it('a page nobody opened gets its review row; a live page the engine could not read keeps the previous grade and says so', async () => {
    const s = await setup();
    await db.delete(schema.pageReviews).where(eq(schema.pageReviews.reportId, s.original.id));
    await s.check(new Date('2026-11-11T09:00:00Z'));
    t.answer = GRADED(70);
    await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    expect(t.calls[0]!.markdown).toMatch(/^# Application and software development/);   // no final version: the delivered page
    expect((await reviewRow(s.original.id)).liveGrade).toMatchObject({ score: 70 });
    const c2 = await s.check(new Date('2026-11-11T13:00:00Z'));
    t.answer = { kind: 'answered', status: 400, json: { ok: false, error: 'grade_live: the live page could not be read: the page reader answered 403' }, error: null };
    await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    const row = await reviewRow(s.original.id);
    expect(row.liveGrade).toMatchObject({ score: 70, read_failed: { published_report_id: c2.id, error: 'the live page could not be read: the page reader answered 403', attempts: 1 } });
    // review M1: the check stays pending (live_graded_at unchanged) so the read is tried again, 12 hours later, at most 3 times
    expect(row.liveGradedAt?.toISOString()).not.toBe('2026-11-11T13:00:00.000Z');
    t.calls = [];
    await lg.gradeLivePages(null, undefined, lg.newLiveGradeState());
    expect(t.calls).toHaveLength(0);   // not again within 12 hours
  });

  it('an engine that does not grade live pages yet: nothing stored, the job pauses; an unreachable engine is asked again later', async () => {
    const s = await setup();
    await s.check(new Date('2026-11-11T09:00:00Z'));
    const st = lg.newLiveGradeState();
    // the old engine makes a normal final version of the Markdown it was sent
    t.answer = { ...GRADED(91), json: { ...GRADED(91).json, grade_only: undefined, live_read: undefined } };
    const now = Date.parse('2026-11-11T14:00:00Z');
    const out = await lg.gradeLivePages(null, undefined, st, now);
    expect(out.skipped[0]?.why).toMatch(/does not grade live pages/);
    expect((await reviewRow(s.original.id)).liveGrade).toBeNull();
    t.calls = [];
    await lg.gradeLivePages(null, undefined, st, now + 5 * 60_000);
    expect(t.calls).toHaveLength(0);
    t.answer = null;   // unreachable
    await lg.gradeLivePages(null, undefined, st, now + lg.LIVE_GRADE_ENGINE_PAUSE_MS + 1);
    expect(t.calls).toHaveLength(1);
    expect((await reviewRow(s.original.id)).liveGrade).toBeNull();
    t.calls = [];
    await lg.gradeLivePages(null, undefined, st, now + lg.LIVE_GRADE_ENGINE_PAUSE_MS + 10 * 60_000);
    expect(t.calls).toHaveLength(0);   // the page waits an hour
    t.answer = GRADED(66);
    await lg.gradeLivePages(null, undefined, st, now + lg.LIVE_GRADE_ENGINE_PAUSE_MS + lg.LIVE_GRADE_PAGE_BACKOFF_MS + 2);
    expect((await reviewRow(s.original.id)).liveGrade).toMatchObject({ score: 66 });
  });
});

describe('selection (pure) and the cap', () => {
  const page = (id: string, requestId: string, keyword: string) => ({ id, requestId, receivedAt: new Date(), payload: { keyword, request_id: requestId } });
  const log = (keyword: string, request_id: string, o: Partial<ContentLogRow> = {}) => ({ keyword, request_id, status: 'published', published_url: `https://novaand-demo.com/${request_id}`, started_at: '2026-11-02T00:00:00Z', ...o }) as ContentLogRow;
  const chk = (id: string, requestId: string, keyword: string, receivedAt: string, o: Record<string, unknown> = {}) => ({ id, receivedAt, keyword, requestId, url: 'https://novaand-demo.com/p', passed: 10, total: 16, failed: [], live: true, recorded: true, ...o });

  it('only published pages with a recorded live check newer than their last grade, newest first', () => {
    const pages = { a: page('A', '1', 'alpha'), b: page('B', '2', 'beta'), c: page('C', '3', 'gamma'), d: page('D', '4', 'delta') };
    const rows: Record<string, { liveGradedAt: Date | null }> = { B: { liveGradedAt: new Date('2026-11-11T09:00:00Z') }, C: { liveGradedAt: new Date('2026-11-10T00:00:00Z') } };
    const reviews = {
      pageFor: (l: Pick<ContentLogRow, 'request_id' | 'keyword'>) => Object.values(pages).find((p) => p.requestId === l.request_id) ?? null,
      rowOf: (id: string) => (rows[id] ?? null) as never,
    };
    const targets = lg.pagesToGrade({
      logs: [log('alpha', '1'), log('beta', '2'), log('gamma', '3'), log('delta', '4', { status: 'written', published_url: '' })],
      reviews,
      checks: [chk('cA', '1', 'alpha', '2026-11-11T08:00:00Z'), chk('cB', '2', 'beta', '2026-11-11T09:00:00Z'), chk('cC', '3', 'gamma', '2026-11-11T10:00:00Z'), chk('cD', '4', 'delta', '2026-11-11T10:00:00Z')],
    });
    expect(targets.map((x) => `${x.page.id}:${x.check.id}`)).toEqual(['C:cC', 'A:cA']);
  });

  it('at most three pages a run for the whole platform', async () => {
    const logs = Array.from({ length: 5 }, (_, i) => log(`k${i}`, String(i)));
    const site = { id: 's1', orgId: 'o1', domain: 'novaand-demo.com', verifiedAt: new Date(), businessFacts: '', factAnswers: {} } as never;
    const stored: string[] = [];
    const deps = {
      candidates: async () => [{ siteId: 's1', orgId: 'o1', newest: 'x' }],
      site: async () => site,
      logs: async () => logs,
      reviews: async () => ({ pageFor: (l: Pick<ContentLogRow, 'request_id' | 'keyword'>) => page(`P${l.request_id}`, l.request_id, l.keyword), rowOf: () => null }),
      checks: async () => logs.map((l, i) => chk(`c${i}`, l.request_id, l.keyword, `2026-11-11T0${i}:00:00Z`)),
      report: async (_o: string, id: string) => ({ id, payload: content() }) as never,
      ensureRow: async (_o: string, _s: string, id: string) => ({ id: `row-${id}`, answers: {}, finalReportId: null, liveGrade: null }) as never,
      call: async () => GRADED(70),
      store: async (rowId: string) => void stored.push(rowId),
    };
    const st = lg.newLiveGradeState();
    const out = await lg.gradeLivePages(null, deps, st);
    expect(out.graded).toHaveLength(lg.LIVE_GRADE_PER_RUN);
    expect(stored).toEqual(['row-P4', 'row-P3', 'row-P2']);
    expect(st.siteDone.has('s1')).toBe(false);   // pages are left: the website is read again next run
  });
});
