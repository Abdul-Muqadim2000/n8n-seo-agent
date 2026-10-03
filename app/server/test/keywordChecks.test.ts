import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LadderRow } from '@seo/shared';

// The keyword check and the recommended keywords, with n8n, the database store and the access checks mocked: a stored answer of the
// last 7 days is free (no n8n call), the daily limit and the budget refuse before n8n is called, n8n's answers are mapped for people,
// and the reservation is removed when the engine never worked on the check (kept as failed when it may have).

type Row = { id: string; orgId: string; siteId: string; keyword: string; country: string; status: string; result: Record<string, unknown>; costUsd: number; createdAt: Date };

const st = vi.hoisted(() => ({
  role: 'member' as string,
  verified: true,
  site: { id: 'site-1', orgId: 'org-1', domain: 'techand.ai', country: 'United Arab Emirates', business: 'E-invoicing and ERP consulting in the UAE', verifiedAt: new Date() as Date | null },
  org: { id: 'org-1', monthlyBudgetUsd: 25, disabled: false },
  checks: [] as Row[],
  spentRuns: 0,
  calls: [] as { body: Record<string, unknown>; orgId: string; timeout: number }[],
  answer: { kind: 'answered', status: 200, json: {} as Record<string, unknown>, error: null as string | null },
  ladders: [] as LadderRow[],
  strategy: null as null | { report: { id: string; receivedAt: string }; payload: Record<string, unknown> },
}));

vi.mock('../src/auth/access', async () => {
  const { roleAtLeast } = await import('@seo/shared');
  const { forbidden } = await import('../src/lib/errors');
  return {
    siteAccess: vi.fn(async (_req: unknown, _o: unknown, _s: unknown, min = 'viewer') => {
      if (!roleAtLeast(st.role as never, min as never)) throw forbidden(`This needs the ${min} role or higher`);
      return { org: st.org, site: { ...st.site, verifiedAt: st.verified ? new Date() : null }, user: { id: 'user-1', emailVerifiedAt: new Date() }, role: st.role };
    }),
    requireVerified: vi.fn((site: { verifiedAt: Date | null; domain: string }) => {
      if (!site.verifiedAt) throw forbidden(`Verify that you own ${site.domain} to see its data and run site checks`);
    }),
  };
});
vi.mock('../src/services/keywordCheckStore', async () => {
  const real = await vi.importActual<typeof import('../src/services/keywordCheckStore')>('../src/services/keywordCheckStore');
  let n = 0;
  return {
    checkRefusal: real.checkRefusal,
    findRecentCheck: vi.fn(async (siteId: string, keyword: string, country: string, since: Date) =>
      st.checks.filter((c) => c.siteId === siteId && c.keyword === keyword && c.country === country && c.status === 'done' && c.createdAt >= since).sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null,
    ),
    // the real decision on the in-memory rows (as the SQL version counts them)
    reserveCheck: vi.fn(async (o: { org: typeof st.org; site: typeof st.site; keyword: string; country: string }) => {
      const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
      const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const refusal = real.checkRefusal({
        keyword: o.keyword,
        running: st.checks.some((c) => c.siteId === o.site.id && c.keyword === o.keyword && c.status === 'pending'),
        today: st.checks.filter((c) => c.orgId === o.org.id && c.createdAt >= today).length,
        spent: st.spentRuns + st.checks.filter((c) => c.orgId === o.org.id && c.createdAt >= month && c.status !== 'failed').reduce((t, c) => t + c.costUsd, 0),
        budget: o.org.monthlyBudgetUsd,
        platformToday: 0,
        platformDaily: 40,
      });
      if (refusal) throw refusal;
      const id = `chk-${++n}`;
      st.checks.push({ id, orgId: o.org.id, siteId: o.site.id, keyword: o.keyword, country: o.country, status: 'pending', result: {}, costUsd: 0.05, createdAt: new Date() });
      return id;
    }),
    finishCheck: vi.fn(async (id: string, result: Record<string, unknown>, costUsd: number) => {
      const r = st.checks.find((c) => c.id === id)!;
      Object.assign(r, { status: 'done', result, costUsd });
      return { ...r, userId: 'user-1' };
    }),
    dropCheck: vi.fn(async (id: string, reached: boolean) => {
      if (!reached) st.checks = st.checks.filter((c) => c.id !== id);
      else Object.assign(st.checks.find((c) => c.id === id)!, { status: 'failed', costUsd: 0 });
    }),
    recentChecks: vi.fn(async () => []),
  };
});
vi.mock('../src/n8n/client', () => ({
  assessCall: vi.fn(async (body: Record<string, unknown>, orgId: string, timeout: number) => (st.calls.push({ body, orgId, timeout }), st.answer)),
  siteRows: vi.fn(async (table: string) => (table === 'ladders' ? st.ladders : table === 'caseStudies' ? [{ service: 'Peppol onboarding' }, { service: 'Peppol onboarding' }, { service: 'ERP rollout' }] : [])),
}));
vi.mock('../src/services/runs', () => ({ latestReport: vi.fn(async () => st.strategy) }));

const { keywordRoutes } = await import('../src/routes/keywords');
const { HttpError } = await import('../src/lib/errors');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.status(err.statusCode).send({ error: err.message, code: err.code, fields: err.fields }) : reply.status(500).send({ error: String(err) })));
  await app.register(keywordRoutes);
});
afterAll(() => app.close());

const ANSWER = {
  ok: true,
  keyword: 'e invoicing software uae',
  country: 'United Arab Emirates',
  volume: 480,
  kd: 38,
  intent: 'commercial',
  cpc: 7.25,
  position: null,
  reach: 30,
  difficulty_for_you: 'reachable',
  plan_type: 'short',
  months: '4-8',
  fit: 2,
  navigational: false,
  alternatives: [],
  cost_usd: 0.042,
  label: 'Reachable for your site · Short ladder · 4-8 months',
  stretch: false,
  warnings: [],
};

beforeEach(() => {
  st.role = 'member';
  st.verified = true;
  st.org.monthlyBudgetUsd = 25;
  st.org.disabled = false;
  st.checks = [];
  st.spentRuns = 0;
  st.calls = [];
  st.answer = { kind: 'answered', status: 200, json: ANSWER, error: null };
  st.ladders = [
    { ladder_id: 'lad_inv', domain: 'techand.ai', head_keyword: 'e invoicing in uae', keyword: 'peppol uae', rung: 1 },
    { ladder_id: 'lad_inv', domain: 'techand.ai', head_keyword: 'e invoicing in uae', keyword: 'e invoicing in uae', rung: 4 },
  ] as LadderRow[];
  st.strategy = null;
});

const base = '/api/orgs/00000000-0000-0000-0000-000000000001/sites/00000000-0000-0000-0000-000000000002';
const assess = (payload: unknown) => app.inject({ method: 'POST', url: base + '/keywords/assess', payload: payload as object });

describe('keyword check', () => {
  it('asks n8n once with the website’s context and stores the answer with its reported cost', async () => {
    const r = await assess({ keyword: '  E Invoicing Software UAE ' });
    expect(r.statusCode).toBe(200);
    expect(st.calls).toHaveLength(1);
    expect(st.calls[0]).toMatchObject({ orgId: 'org-1', timeout: 45000 });
    expect(st.calls[0].body).toEqual({
      keyword: 'e invoicing software uae',
      country: 'United Arab Emirates',
      domain: 'techand.ai',
      business: 'E-invoicing and ERP consulting in the UAE',
      services: ['Peppol onboarding', 'ERP rollout'],
      existing_keywords: ['e invoicing in uae', 'peppol uae'],
    });
    const c = r.json();
    expect(c).toMatchObject({ keyword: 'e invoicing software uae', country: 'United Arab Emirates', cached: false, costUsd: 0.042 });
    expect(c.result).toMatchObject({ difficultyForYou: 'reachable', planType: 'short', months: '4-8', fit: 2, volume: 480, label: 'Reachable for your site · Short ladder · 4-8 months' });
    expect(st.checks.map((x) => [x.status, x.costUsd])).toEqual([['done', 0.042]]);
  });

  it('the same keyword and country within 7 days: the stored answer, free, no n8n call', async () => {
    st.checks.push({ id: 'old', orgId: 'org-1', siteId: 'site-1', keyword: 'e invoicing software uae', country: 'United Arab Emirates', status: 'done', result: ANSWER, costUsd: 0.042, createdAt: new Date(Date.now() - 6 * 864e5) });
    const r = await assess({ keyword: 'e invoicing software uae' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ id: 'old', cached: true });
    expect(st.calls).toHaveLength(0);
    // another country, or older than 7 days: a new check
    st.checks[0].createdAt = new Date(Date.now() - 8 * 864e5);
    expect((await assess({ keyword: 'e invoicing software uae' })).json().cached).toBe(false);
    expect((await assess({ keyword: 'e invoicing software uae', country: 'Saudi Arabia' })).json().cached).toBe(false);
    expect(st.calls).toHaveLength(2);
  });

  it('30 checks a day per company: the 31st is refused (429) before n8n is called; a cached one still answers', async () => {
    for (let i = 0; i < 30; i++)
      st.checks.push({ id: `c${i}`, orgId: 'org-1', siteId: 'site-1', keyword: `keyword ${i}`, country: 'United Arab Emirates', status: i % 5 ? 'done' : 'failed', result: ANSWER, costUsd: 0.02, createdAt: new Date() });
    const r = await assess({ keyword: 'e invoicing software uae' });
    expect(r.statusCode).toBe(429);
    expect(r.json().code).toBe('check_limit');
    expect(st.calls).toHaveLength(0);
    expect((await assess({ keyword: 'keyword 1' })).json().cached).toBe(true);
  });

  it('over the monthly budget (runs + keyword checks): 402 before n8n is called', async () => {
    st.spentRuns = 24.9;
    st.checks.push({ id: 'k', orgId: 'org-1', siteId: 'site-1', keyword: 'x y', country: 'United Arab Emirates', status: 'done', result: ANSWER, costUsd: 0.06, createdAt: new Date() });
    const r = await assess({ keyword: 'e invoicing software uae' });
    expect(r.statusCode).toBe(402);
    expect(r.json()).toMatchObject({ code: 'budget' });
    expect(r.json().error).toMatch(/This keyword check \(about \$0\.05\) would go over/);
    expect(st.calls).toHaveLength(0);
  });

  it('validation (400), roles (403), unverified websites (403): nothing reaches n8n', async () => {
    for (const body of [{}, { keyword: 'x' }, { keyword: 'a'.repeat(101) }, { keyword: 'erp dubai', country: 'Narnia' }]) expect((await assess(body)).statusCode).toBe(400);
    st.role = 'viewer';
    expect((await assess({ keyword: 'erp dubai' })).statusCode).toBe(403);
    st.role = 'member';
    st.verified = false;
    expect((await assess({ keyword: 'erp dubai' })).statusCode).toBe(403);
    st.verified = true;
    st.org.disabled = true;
    expect((await assess({ keyword: 'erp dubai' })).statusCode).toBe(403);
    expect(st.calls).toHaveLength(0);
    expect(st.checks).toHaveLength(0);
  });

  it('n8n answers are mapped: 400 with fields, 429, 502 / timeout (kept as failed), unreachable (removed)', async () => {
    st.answer = { kind: 'answered', status: 400, json: { ok: false, error: 'keyword must be 2-100 characters', errors: { keyword: 'keyword must be 2-100 characters' } }, error: null };
    let r = await assess({ keyword: 'erp dubai' });
    expect([r.statusCode, r.json().fields]).toEqual([400, { keyword: 'Use 2-100 characters' }]);
    expect(st.checks).toHaveLength(0);

    st.answer = { kind: 'answered', status: 429, json: { ok: false, error: 'The daily limit of 40 keyword checks is reached.' }, error: null };
    r = await assess({ keyword: 'erp dubai' });
    expect([r.statusCode, r.json().code]).toEqual([429, 'engine_limit']);
    expect(st.checks).toHaveLength(0);

    st.answer = { kind: 'answered', status: 502, json: { ok: false, error: 'DataForSEO keyword overview failed: 40501' }, error: null };
    r = await assess({ keyword: 'erp dubai' });
    expect(r.statusCode).toBe(502);
    expect(r.json().error).toMatch(/Try again in a few minutes/);
    expect(r.json().error).not.toMatch(/nothing was charged/i);
    expect(st.checks.map((c) => [c.status, c.costUsd])).toEqual([['failed', 0]]);

    st.answer = { kind: 'timeout', status: 0, json: {}, error: 'The operation was aborted due to timeout' };
    r = await assess({ keyword: 'erp abu dhabi' });
    expect(r.statusCode).toBe(502);
    expect(st.checks.filter((c) => c.status === 'failed')).toHaveLength(2);

    st.answer = { kind: 'unreachable', status: 0, json: {}, error: 'ECONNREFUSED' };
    r = await assess({ keyword: 'erp sharjah' });
    expect(r.statusCode).toBe(502);
    expect(r.json().error).toMatch(/Nothing was charged/);
    expect(st.checks).toHaveLength(2);

    st.answer = { kind: 'answered', status: 200, json: { ok: true }, error: null };
    expect((await assess({ keyword: 'erp ajman' })).statusCode).toBe(502);
  });
});

describe('recommended keywords', () => {
  it('none without a keyword strategy report', async () => {
    const r = await app.inject({ method: 'GET', url: base + '/keywords/recommended' });
    expect(r.json()).toEqual({ reportId: null, receivedAt: null, ageDays: null, stale: false, reach: null, country: null, keywords: [] });
  });

  it('the latest report’s keywords, best first, overlaps with the website’s ladders marked; stale after 90 days', async () => {
    st.role = 'viewer';
    st.strategy = {
      report: { id: 'rep-1', receivedAt: new Date(Date.now() - 10 * 864e5).toISOString() },
      payload: {
        country: 'United Arab Emirates',
        reach: { reach: 30 },
        priority: [
          { keyword: 'uae e-invoicing', difficulty_for_you: 'easy', plan_type: 'direct', months: '2-4' },
          { keyword: 'odoo partner uae', difficulty_for_you: 'reachable', plan_type: 'short', months: '4-8', why: 'Buyers compare partners' },
        ],
      },
    };
    let r = (await app.inject({ method: 'GET', url: base + '/keywords/recommended' })).json();
    expect(r).toMatchObject({ reportId: 'rep-1', ageDays: 10, stale: false, reach: 30, country: 'United Arab Emirates' });
    expect(r.keywords.map((k: { keyword: string; overlaps: unknown[] }) => [k.keyword, k.overlaps.length])).toEqual([
      ['odoo partner uae', 0],
      ['uae e-invoicing', 1],
    ]);
    expect(r.keywords[1].overlaps[0]).toEqual({ ladderId: 'lad_inv', head: 'e invoicing in uae', keyword: 'e invoicing in uae' });
    st.strategy.report.receivedAt = new Date(Date.now() - 91 * 864e5).toISOString();
    r = (await app.inject({ method: 'GET', url: base + '/keywords/recommended' })).json();
    expect(r.stale).toBe(true);
  });
});
