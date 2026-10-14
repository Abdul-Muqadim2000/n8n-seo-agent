import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARE, shareDays, shareExpiry, shareRefusal, shareState, shareUrl, isShareToken, shareUsable } from '@seo/shared';

// G15 (system review 2026-10-11, criterion REP 3.7): expiring, revocable, read-only share links for ONE report.
// The rules (shared/src/share.ts) are tested directly; the routes are tested with the store, the database and the access check mocked,
// the way keywordChecks.test.ts does it: creation, the expiry, revocation, a wrong / revoked / expired token, the scope (it must never
// reach another report or another report's file) and the last-opened record.

const ORG = '00000000-0000-0000-0000-000000000001';
const REP = '00000000-0000-0000-0000-00000000aaa1';
const REP2 = '00000000-0000-0000-0000-00000000aaa2';
const REP_OTHER = '00000000-0000-0000-0000-0000000000ff';   // another company's report
const FILE1 = '00000000-0000-0000-0000-00000000f111';       // belongs to REP
const FILE2 = '00000000-0000-0000-0000-00000000f222';       // belongs to REP2
const SHARE_ID = '00000000-0000-0000-0000-00000000bbb1';

type Share = { id: string; orgId: string; reportId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; createdBy: string | null; createdAt: Date; lastOpenedAt: Date | null; opens: number };

const st = vi.hoisted(() => ({
  role: 'admin' as string,
  org: { id: 'org-1', name: 'Northwind' },
  user: { id: 'user-1', name: 'Dana Owner' },
  shares: [] as Share[],
  reports: [] as { id: string; orgId: string }[],
  files: [] as { id: string; reportId: string; orgId: string; kind: string; fileName: string; mimeType: string; size: number; data: Buffer }[],
  seq: 0,
}));

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

vi.mock('../src/config', () => ({ config: { appUrl: 'https://app.example.com', isProd: false, platformAdmins: [] } }));
vi.mock('../src/auth/access', async () => {
  const { roleAtLeast } = await import('@seo/shared');
  const { forbidden, notFound } = await import('../src/lib/errors');
  return {
    isUuid: (v: unknown) => typeof v === 'string' && UUID.test(v),
    orgAccess: vi.fn(async (_req: unknown, orgId: unknown, min = 'viewer') => {
      if (orgId !== ORG) throw notFound('Company not found');
      if (!roleAtLeast(st.role as never, min as never)) throw forbidden(`This needs the ${min} role or higher`);
      return { org: st.org, user: st.user, role: st.role };
    }),
  };
});
// the real decisions, run over in-memory rows (the service itself only reads and writes the database)
vi.mock('../src/services/shareLinks', async () => {
  const { shareExpiry: exp, shareState: state, SHARE: S } = await import('@seo/shared');
  const { HttpError, notFound } = await import('../src/lib/errors');
  const reportOf = (orgId: string, reportId: string) => {
    const r = st.reports.find((x) => x.id === reportId && x.orgId === orgId);
    if (!r) throw notFound('Report not found');
    return r;
  };
  const toLink = (s: Share) => ({
    id: s.id, reportId: s.reportId, state: state(s), expiresAt: s.expiresAt.toISOString(), createdAt: s.createdAt.toISOString(),
    createdByName: s.createdBy ? st.user.name : null, lastOpenedAt: s.lastOpenedAt ? s.lastOpenedAt.toISOString() : null, opens: s.opens,
    revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
  });
  return {
    createShare: vi.fn(async (o: { org: { id: string }; user: { id: string }; reportId: string; days?: unknown }) => {
      reportOf(o.org.id, o.reportId);
      if (st.shares.filter((s) => s.reportId === o.reportId && state(s) === 'live').length >= S.maxPerReport)
        throw new HttpError(409, `This report already has ${S.maxPerReport} live share links. Turn one off before creating another.`, 'share_limit');
      st.seq++;
      const token = 'TOKEN' + String(st.seq).padStart(2, '0') + 'x'.repeat(36);
      const row: Share = { id: st.seq === 1 ? SHARE_ID : SHARE_ID.slice(0, -2) + String(10 + st.seq), orgId: o.org.id, reportId: o.reportId, tokenHash: sha(token), expiresAt: exp(o.days), revokedAt: null, createdBy: o.user.id, createdAt: new Date(), lastOpenedAt: null, opens: 0 };
      st.shares.push(row);
      return { link: toLink(row), token };
    }),
    listShares: vi.fn(async (orgId: string, reportId: string) => { reportOf(orgId, reportId); return st.shares.filter((s) => s.reportId === reportId).map(toLink); }),
    revokeShare: vi.fn(async (orgId: string, reportId: string, shareId: string) => {
      reportOf(orgId, reportId);
      const s = st.shares.find((x) => x.id === shareId && x.orgId === orgId && x.reportId === reportId);
      if (!s) throw notFound('Share link not found');
      if (!s.revokedAt) s.revokedAt = new Date();
      return toLink(s);
    }),
    shareByToken: vi.fn(async (token: string) => st.shares.find((s) => s.tokenHash === sha(token)) ?? null),
    markOpened: vi.fn(async (id: string) => { const s = st.shares.find((x) => x.id === id); if (s) { s.opens++; s.lastOpenedAt = new Date(); } }),
    sharedReport: vi.fn(async (share: Share) => {
      const r = st.reports.find((x) => x.id === share.reportId);
      if (!r) return null;
      return {
        id: r.id, stage: 'link_builder', status: 'progress', title: 'Link building', siteDomain: 'northwind-erp.com',
        receivedAt: '2026-10-13T08:00:00.000Z', scheduled: true, summary: { drafted: 3 },
        files: st.files.filter((f) => f.reportId === r.id).map((f) => ({ id: f.id, kind: f.kind, fileName: f.fileName, mimeType: f.mimeType, size: f.size })),
        orgName: st.org.name, expiresAt: share.expiresAt.toISOString(),
      };
    }),
    sharedFile: vi.fn(async (share: Share, fileId: string) => st.files.find((f) => f.id === fileId && f.reportId === share.reportId && f.orgId === share.orgId) ?? null),
  };
});
vi.mock('../src/services/runs', () => ({
  createRun: vi.fn(), filesFor: vi.fn(async () => new Map()), getRunOrThrow: vi.fn(), reportsList: vi.fn(async () => []), toReport: vi.fn(), toRun: vi.fn(),
}));
vi.mock('../src/db', () => ({ db: { query: { reports: { findFirst: vi.fn(async () => undefined) }, files: { findFirst: vi.fn(async () => undefined) } } }, schema: {} }));

const { runRoutes } = await import('../src/routes/runs');
const { HttpError } = await import('../src/lib/errors');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, _req, reply) => (err instanceof HttpError ? reply.status(err.statusCode).send({ error: err.message, code: err.code }) : reply.status(500).send({ error: String(err) })));
  await app.register(runRoutes);
});
afterAll(() => app.close());
beforeEach(() => {
  st.shares = []; st.seq = 0; st.role = 'admin';
  st.reports = [{ id: REP, orgId: 'org-1' }, { id: REP2, orgId: 'org-1' }, { id: REP_OTHER, orgId: 'org-2' }];
  st.files = [
    { id: FILE1, reportId: REP, orgId: 'org-1', kind: 'pdf', fileName: 'link-building.pdf', mimeType: 'application/pdf', size: 9, data: Buffer.from('%PDF-1.4\n') },
    { id: FILE2, reportId: REP2, orgId: 'org-1', kind: 'csv', fileName: 'prospects.csv', mimeType: 'text/csv', size: 3, data: Buffer.from('a,b') },
  ];
});

const base = `/api/orgs/${ORG}/reports`;
const create = (reportId = REP, payload?: object) => app.inject({ method: 'POST', url: `${base}/${reportId}/shares`, payload: payload ?? {} });
const open = (token: string) => app.inject({ method: 'GET', url: `/api/share/${token}` });
const tokenOf = (url: string) => url.split('/share/')[1];

describe('share links: the rules (shared/src/share.ts)', () => {
  it('a link lasts 14 days by default, and whatever the owner picks inside 1-90', () => {
    expect(SHARE.defaultDays).toBe(14);
    expect([shareDays(undefined), shareDays(30), shareDays(0), shareDays(10_000), shareDays('nonsense')]).toEqual([14, 30, 1, 90, 14]);
    const now = new Date('2026-10-13T00:00:00.000Z');
    expect(shareExpiry(undefined, now).toISOString()).toBe('2026-10-27T00:00:00.000Z');
    expect(shareExpiry(1, now).toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('a link is live until it expires, revoked for good once turned off, and a missing one is simply not valid', () => {
    const now = new Date('2026-10-13T12:00:00.000Z');
    const live = { expiresAt: new Date('2026-10-20T00:00:00.000Z') };
    expect([shareState(live, now), shareUsable(live, now)]).toEqual(['live', true]);
    expect(shareState({ expiresAt: new Date('2026-10-12T00:00:00.000Z') }, now)).toBe('expired');
    expect(shareState({ ...live, revokedAt: new Date('2026-10-13T09:00:00.000Z') }, now)).toBe('revoked');   // revoked wins over a future expiry
    expect([shareState(null, now), shareUsable(null, now)]).toEqual(['missing', false]);
    expect(shareRefusal('expired')).toMatch(/expired/i);
    expect(shareRefusal('revoked')).toMatch(/turned off/i);
    expect(shareRefusal('missing')).toMatch(/not valid/i);
  });

  it('only a long base64url string can be a token, and the link is built on the app\'s own URL', () => {
    expect(isShareToken('x'.repeat(43))).toBe(true);
    expect([isShareToken('short'), isShareToken('x'.repeat(43) + '/../..'), isShareToken('x'.repeat(200)), isShareToken(null)]).toEqual([false, false, false, false]);
    expect(shareUrl('https://app.example.com/', 'abc')).toBe('https://app.example.com/share/abc');
    expect(SHARE.tokenBytes).toBeGreaterThanOrEqual(32);
  });
});

describe('share links: the routes', () => {
  it('creates a link, returns its URL exactly once, and records who made it and when it expires', async () => {
    const r = await create();
    expect(r.statusCode).toBe(200);
    const link = r.json();
    expect(link.url).toMatch(/^https:\/\/app\.example\.com\/share\/[A-Za-z0-9_-]{32,}$/);
    expect([link.state, link.createdByName, link.opens]).toEqual(['live', 'Dana Owner', 0]);
    expect(new Date(link.expiresAt).getTime() - Date.now()).toBeGreaterThan(13 * 864e5);
    const list = (await app.inject({ method: 'GET', url: `${base}/${REP}/shares` })).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].url).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain(tokenOf(link.url));   // the token is never shown again
  });

  it('the owner can ask for a shorter life, and a nonsense number is refused instead of silently defaulting', async () => {
    const week = (await create(REP, { days: 7 })).json();
    expect(Math.round((new Date(week.expiresAt).getTime() - Date.now()) / 864e5)).toBe(7);
    const bad = await create(REP, { days: 'forever' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toMatch(/1-90/);
  });

  it('a viewer or a member cannot hand a report outside the company; an admin can', async () => {
    for (const role of ['viewer', 'member']) {
      st.role = role;
      expect((await create()).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: `${base}/${REP}/shares` })).statusCode).toBe(403);
    }
    st.role = 'admin';
    expect((await create()).statusCode).toBe(200);
  });

  it('a report of another company, or a nonsense id, can never be shared', async () => {
    expect((await create(REP_OTHER)).statusCode).toBe(404);
    expect((await create('not-a-uuid')).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/orgs/00000000-0000-0000-0000-000000000009/reports/${REP}/shares`, payload: {} })).statusCode).toBe(404);
    expect(st.shares).toHaveLength(0);
  });

  it('a live link opens that one report, read-only, and every open is recorded', async () => {
    const token = tokenOf((await create()).json().url);
    const r = await open(token);
    expect(r.statusCode).toBe(200);
    const { report } = r.json();
    expect([report.id, report.title, report.orgName]).toEqual([REP, 'Link building', 'Northwind']);
    expect(report.files.map((f: { id: string }) => f.id)).toEqual([FILE1]);
    const body = JSON.stringify(r.json());
    expect(body).not.toContain('org-1');      // no company id
    expect(body).not.toContain('payload');    // no callback payload
    expect(body).not.toContain('runId');      // no run
    expect([st.shares[0].opens, st.shares[0].lastOpenedAt !== null]).toEqual([1, true]);
    await open(token);
    expect(st.shares[0].opens).toBe(2);
  });

  it('a wrong, a revoked and an expired token all answer 404 with no report and the reason in the code', async () => {
    const token = tokenOf((await create()).json().url);
    expect((await open('x'.repeat(43))).statusCode).toBe(404);
    expect((await open('../../api/orgs')).statusCode).toBe(404);
    expect((await open('short')).statusCode).toBe(404);
    st.shares[0].revokedAt = new Date();
    const revoked = await open(token);
    expect([revoked.statusCode, revoked.json().code]).toEqual([404, 'share_revoked']);
    expect(revoked.json().error).toMatch(/turned off/i);
    st.shares[0].revokedAt = null;
    st.shares[0].expiresAt = new Date(Date.now() - 1000);
    const expired = await open(token);
    expect([expired.statusCode, expired.json().code, expired.json().report]).toEqual([404, 'share_expired', undefined]);
  });

  it('revoking works at any time, is permanent, and only for a link of that report', async () => {
    const token = tokenOf((await create()).json().url);
    const r = await app.inject({ method: 'DELETE', url: `${base}/${REP}/shares/${SHARE_ID}` });
    expect([r.statusCode, r.json().state]).toEqual([200, 'revoked']);
    expect((await open(token)).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `${base}/${REP}/shares/${SHARE_ID}` })).json().state).toBe('revoked');   // twice is fine
    expect((await app.inject({ method: 'DELETE', url: `${base}/${REP2}/shares/${SHARE_ID}` })).statusCode).toBe(404);          // not this report's link
    expect((await app.inject({ method: 'DELETE', url: `${base}/${REP}/shares/not-a-uuid` })).statusCode).toBe(404);
  });

  it('the link is scoped to one report: editing the URL reaches neither another report nor another report\'s file', async () => {
    const token = tokenOf((await create()).json().url);
    const own = await app.inject({ method: 'GET', url: `/api/share/${token}/files/${FILE1}` });
    expect(own.statusCode).toBe(200);
    expect(own.headers['content-type']).toBe('application/pdf');
    expect(own.headers['content-disposition']).toMatch(/inline; filename="link-building.pdf"/);
    expect(own.headers['x-content-type-options']).toBe('nosniff');
    expect((await app.inject({ method: 'GET', url: `/api/share/${token}/files/${FILE2}` })).statusCode).toBe(404);   // the other report's file
    expect((await app.inject({ method: 'GET', url: `/api/share/${token}/files/not-a-uuid` })).statusCode).toBe(404);
    // there is no shared route that lists anything, takes a company id, or writes
    expect((await app.inject({ method: 'GET', url: `/api/share/${token}/reports` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/share/${token}/../orgs/${ORG}/reports` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/share/${token}`, payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/share/${token}` })).statusCode).toBe(404);
  });

  it('a non-PDF shared file is sandboxed and downloads, exactly like the company\'s own file route', async () => {
    const token = tokenOf((await create(REP2)).json().url);
    const r = await app.inject({ method: 'GET', url: `/api/share/${token}/files/${FILE2}?download=1` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/^attachment;/);
    expect(r.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
  });

  it('a report cannot carry more than ten live links at once, and turning one off makes room', async () => {
    for (let i = 0; i < SHARE.maxPerReport; i++) expect((await create()).statusCode).toBe(200);
    const over = await create();
    expect([over.statusCode, over.json().code]).toEqual([409, 'share_limit']);
    st.shares[0].revokedAt = new Date();
    expect((await create()).statusCode).toBe(200);
  });
});
