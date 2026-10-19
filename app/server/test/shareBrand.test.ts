import { beforeEach, describe, expect, it, vi } from 'vitest';

// B-R2, what `sharedReport()` hands a client: the company's own mark, the run's own caveat, and still nothing else of that company.
// The database and the n8n client are mocked; the service's own decisions are the real ones.

const st = vi.hoisted(() => ({
  report: {} as Record<string, unknown>,
  domain: null as string | null,
  orgName: 'Northwind Trading' as string | null,
  files: [] as unknown[],
  profiles: [] as Record<string, unknown>[],
  profileError: null as Error | null,
  profileCalls: [] as { table: string; domain: string }[],
}));

// drizzle's builder, far enough to answer the two selects this service makes, in order
vi.mock('../src/db', () => {
  const queue: unknown[][] = [];
  const chain = (rows: unknown[]) => {
    const p: Record<string, unknown> = {};
    for (const k of ['from', 'leftJoin', 'where', 'orderBy']) p[k] = () => p;
    p.limit = () => rows;
    return p;
  };
  return {
    db: {
      select: () => chain(queue.shift() ?? []),
      __queue: queue,
      query: { reports: { findFirst: vi.fn() }, reportShares: { findFirst: vi.fn() } },
    },
    schema: {
      reports: { id: 'reports.id', orgId: 'reports.org_id', siteId: 'reports.site_id' },
      sites: { id: 'sites.id', domain: 'sites.domain' },
      organizations: { id: 'organizations.id', name: 'organizations.name' },
      files: { id: 'files.id', reportId: 'files.report_id', createdAt: 'files.created_at', kind: 'files.kind', fileName: 'files.file_name', mimeType: 'files.mime_type', size: 'files.size' },
      reportShares: { id: 'report_shares.id' },
      users: { id: 'users.id', name: 'users.name' },
    },
  };
});
vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string, domain: string) => {
    st.profileCalls.push({ table, domain });
    if (st.profileError) throw st.profileError;
    return st.profiles;
  }),
}));

const { db } = await import('../src/db');
const { sharedReport } = await import('../src/services/shareLinks');

const SHARE = { id: 's1', orgId: 'org-1', reportId: 'rep-1', tokenHash: 'h', expiresAt: new Date('2026-11-01T00:00:00.000Z'), revokedAt: null, createdBy: null, createdAt: new Date(), lastOpenedAt: null, opens: 0 };

const queue = (db as unknown as { __queue: unknown[][] }).__queue;
const run = () => {
  queue.length = 0;
  queue.push([{ r: { id: 'rep-1', stage: 'site_audit', status: 'completed', title: 'Technical audit', summary: { health: 83 }, receivedAt: new Date('2026-10-14T16:00:00.000Z'), scheduled: true, payload: st.report }, domain: st.domain, orgName: st.orgName }]);
  queue.push(st.files);
  return sharedReport(SHARE as never);
};

beforeEach(() => {
  st.report = { health_score: 83 };
  st.domain = 'techand.ai';
  st.orgName = 'Northwind Trading';
  st.files = [];
  st.profiles = [{ business_name: 'Techand', logo_url: 'https://techand.ai/logo.png' }];
  st.profileError = null;
  st.profileCalls = [];
});

describe('the mark on a shared report', () => {
  it('comes from the business profile the company already filled in, for that website', async () => {
    const r = await run();
    expect(r?.brand).toEqual({ name: 'Techand', logoUrl: 'https://techand.ai/logo.png', initials: 'TE' });
    expect(st.profileCalls).toEqual([{ table: 'profiles', domain: 'techand.ai' }]);
  });

  it('takes two fields of that profile and nothing else of it', async () => {
    st.profiles = [
      {
        business_name: 'Techand',
        logo_url: 'https://techand.ai/logo.png',
        phone: '+971 4 000 0000',
        public_email: 'hello@techand.ai',
        street_address: '42 Media City',
        author_name: 'Dana Owner',
        author_bio: 'Twenty years of e-invoicing',
      },
    ];
    const body = JSON.stringify(await run());
    for (const leak of ['+971', 'hello@techand.ai', 'Media City', 'Dana Owner', 'e-invoicing']) expect(body).not.toContain(leak);
  });

  it('falls back to the company name when there is no profile, no logo, or a logo we will not render', async () => {
    st.profiles = [];
    expect((await run())?.brand).toEqual({ name: 'Northwind Trading', logoUrl: null, initials: 'NT' });
    st.profiles = [{ business_name: '', logo_url: 'http://techand.ai/logo.png' }];
    expect((await run())?.brand).toEqual({ name: 'Northwind Trading', logoUrl: null, initials: 'NT' });
  });

  it('asks the engine nothing for a report with no website', async () => {
    st.domain = null;
    expect((await run())?.brand.name).toBe('Northwind Trading');
    expect(st.profileCalls).toEqual([]);
  });

  it('still renders when the engine is unreachable, a logo is never worth a broken page', async () => {
    st.profileError = new Error('connect ECONNREFUSED');
    const r = await run();
    expect(r?.brand).toEqual({ name: 'Northwind Trading', logoUrl: null, initials: 'NT' });
    expect(r?.title).toBe('Technical audit');
  });
});

describe('the headline figures', () => {
  it('lead with the figure the run leads with, not with the shortest key jsonb happened to sort first', async () => {
    st.report = { health_score: 78, grade: 'B', issue_counts: { Critical: 0, High: 3, Medium: 7 }, audit_diff: { score_delta: 4 } };
    queue.length = 0;
    queue.push([{ r: { id: 'rep-1', stage: 'site_audit', status: 'completed', title: 'Technical audit', summary: { high: 3, grade: 'B', medium: 7, critical: 0, scoreDelta: 4, healthScore: 78 }, receivedAt: new Date(), scheduled: true, payload: st.report }, domain: st.domain, orgName: st.orgName }]);
    queue.push([]);
    const r = await sharedReport(SHARE as never);
    expect(Object.keys(r!.summary)).toEqual(['healthScore', 'grade', 'critical', 'high', 'medium', 'scoreDelta']);
  });

  it('keeps a figure the engine no longer produces rather than dropping it', async () => {
    queue.length = 0;
    queue.push([{ r: { id: 'rep-1', stage: 'site_audit', status: 'completed', title: 'Technical audit', summary: { somethingOld: 1, healthScore: 78 }, receivedAt: new Date(), scheduled: false, payload: { health_score: 78 } }, domain: st.domain, orgName: st.orgName }]);
    queue.push([]);
    expect(Object.keys((await sharedReport(SHARE as never))!.summary)).toEqual(['healthScore', 'somethingOld']);
  });
});

describe('the caveat on a shared report', () => {
  it('is empty for a finished report', async () => {
    expect((await run())?.caveat).toBeNull();
  });

  it('tells the reader when the run marked the work a draft, the same rule the delivery refuses on', async () => {
    st.report = { qa_not_ready: true, qa_reasons: ['3 placeholders left', 'word count 3,952 for 2,100'] };
    const c = (await run())?.caveat;
    expect(c?.code).toBe('not_ready');
    expect(c?.detail).toContain('3 placeholders left');
  });

  it('says so when the engine could not read the evidence', async () => {
    st.report = { verdict: 'NOT_CHECKED' };
    expect((await run())?.caveat?.code).toBe('unavailable');
  });

  it('never carries the callback payload itself', async () => {
    st.report = { qa_not_ready: true, qa_reasons: ['3 placeholders left'], internal_prompt: 'TOP SECRET BRIEF', cost_usd: 1.2 };
    const body = JSON.stringify(await run());
    expect(body).not.toContain('TOP SECRET BRIEF');
    expect(body).not.toContain('internal_prompt');
  });
});
