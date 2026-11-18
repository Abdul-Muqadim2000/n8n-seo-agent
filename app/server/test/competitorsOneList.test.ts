// CR17-F (2026-11-17, client report C5, devaicon.com): the platform called LinkedIn, Clutch and edX "a competing site" and listed SAP,
// Salesforce and Oracle as businesses AI recommends instead of the client. The app now reads every stored competitor list through the one role
// rule (shared/src/competitor-roles.ts, the engine's CMP.role), including rows the engine stored BEFORE the rule; Site settings shows THE one
// competitor list; prospects retired with their AI question are never offered. Synthetic data only; the engine is an in-memory fake.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiVisibilityRow, RankHistoryRow } from '@seo/shared';

const st = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, report: null as unknown }));

vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string, _domain: string, q: Record<string, unknown> = {}) => {
    const rows = st.tables[table] ?? [];
    const sort = String(q.sortBy ?? '');
    const sorted = sort.endsWith(':desc') ? [...rows].sort((a, b) => String(b[sort.split(':')[0]]).localeCompare(String(a[sort.split(':')[0]]))) : rows;
    return sorted.slice(0, Number(q.max ?? 2000));
  }),
  rows: vi.fn(async () => []),
  deleteRows: vi.fn(), insertRows: vi.fn(), ensureTable: vi.fn(), invalidateSite: vi.fn(), siteAdmin: vi.fn(), upsertRow: vi.fn(), updateRows: vi.fn(),
}));
vi.mock('../src/services/runs', async (orig) => ({ ...(await orig<typeof import('../src/services/runs')>()), latestReport: vi.fn(async () => st.report) }));
vi.mock('../src/services/runCredits', async (orig) => ({ ...(await orig<typeof import('../src/services/runCredits')>()), aiChargeEntries: vi.fn(async () => []) }));
vi.mock('../src/services/admin/settings', () => ({ settingsRow: vi.fn(async () => ({ creditValueUsd: 0.05, markup: 3 })) }));

const { aiData, aiNamedOf, backlinksData, competitorSiteOf, monitorsFromRow, oneCompetitorListOf, serpReading } = await import('../src/services/data');

const DOMAIN = 'devaicon.example';
const org = { id: '00000000-0000-0000-0000-000000000001' } as never;
const site = { id: 'site-1', domain: DOMAIN, services: ['Open edX development', 'AI consulting'] } as never;
const ctx = { domain: DOMAIN, services: ['Open edX development', 'AI consulting'] };

/** An AI visibility row as the engine stored it BEFORE the role rule: software makers and platforms among the competitors. */
const OLD_COMPETITORS = JSON.stringify([
  { domain: 'sap.com', mentions: 9, share: 20, auto: true },
  { domain: 'salesforce.com', mentions: 7, share: 15, auto: true },
  { domain: 'oracle.com', mentions: 5, share: 11, auto: true },
  { domain: 'edly.io', mentions: 4, share: 9, auto: true },
  { domain: 'clutch.co', mentions: 3, share: 6, auto: true },
  { domain: 'linkedin.com', mentions: 2, share: 4, auto: true },
  { domain: 'Acme Learning', mentions: 1, share: 2, auto: true },
]);
const vis = (over: Partial<AiVisibilityRow> = {}): Record<string, unknown> => ({
  site_id: 'site_devaicon-example', domain: DOMAIN, run_id: 'ai_20261115_devaicon.example', checked_at: '2026-11-15T07:00:00.000Z', prompts: 20, answers: 80, samples: 80,
  mention_rate: 0, citation_rate: 0, share_of_voice: 0, avg_rank: 0, aio_presence: 0, aio_citation_rate: 0, engines_json: '{}', competitors_json: OLD_COMPETITORS, sources_json: '[]',
  pages_json: '[]', gaps_json: '[]', market_json: '', cost_usd: 1, alerts: '', run_kind: 'weekly', ...over,
});

beforeEach(() => {
  st.tables = {};
  st.report = null;
});

describe('CR17-F: AI visibility splits competitors from software makers (old rows included)', () => {
  it('an old row naming sap.com / salesforce.com / edly.io: only the businesses stay competitors, the software makers are listed apart', async () => {
    st.tables.aiVisibility = [vis()];
    const d = await aiData(org, site);
    expect(d.latest!.competitors.map((c) => c.domain)).toEqual(['edly.io', 'Acme Learning']);
    expect(d.latest!.softwareNamed.map((x) => x.domain)).toEqual(['sap.com', 'salesforce.com', 'oracle.com']);
    expect(d.latest!.softwareNamed[0]).toEqual({ domain: 'sap.com', name: 'sap.com', answers: 9, role: 'software' });
    // a directory and a social network are neither competitors nor software: left out of both
    const all = [...d.latest!.competitors.map((c) => c.domain), ...d.latest!.softwareNamed.map((x) => x.domain)];
    expect(all).not.toContain('clutch.co');
    expect(all).not.toContain('linkedin.com');
  });
  it('the share-of-voice trend (every brand named) keeps only businesses and you', async () => {
    st.tables.aiVisibility = [vis()];
    const d = await aiData(org, site);
    const ids = d.runs[0].sov!.brands.map((b) => b.id);
    expect(ids).toContain('edly.io');
    expect(ids).not.toContain('sap.com');
    expect(ids).not.toContain('clutch.co');
  });
  it('a newer row: software_json is the list (and a software maker the engine still left among the competitors joins it once)', () => {
    const r = aiNamedOf(
      { competitors_json: JSON.stringify([{ domain: 'edly.io', mentions: 4, share: 9, auto: true }, { domain: 'sap.com', mentions: 2, share: 1, auto: true }]), software_json: JSON.stringify([{ domain: 'sap.com', name: 'SAP', answers: 6, role: 'software' }, { domain: 'openedx.org', name: 'Open edX', answers: 3, role: 'your_platform' }]) },
      ctx,
    );
    expect(r.competitors.map((c) => c.domain)).toEqual(['edly.io']);
    expect(r.softwareNamed).toEqual([
      { domain: 'sap.com', name: 'SAP', answers: 6, role: 'software' },
      { domain: 'openedx.org', name: 'Open edX', answers: 3, role: 'your_platform' },
    ]);
  });
  it('the client\'s own "Not a competitor" wins: a domain on not_competitors leaves the competitors', async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.monitors = [{ domain: DOMAIN, site_id: 'site_devaicon-example', competitors: '', not_competitors: 'edly.io' }];
    const d = await aiData(org, site);
    expect(d.latest!.competitors.map((c) => c.domain)).toEqual(['Acme Learning']);
  });
});

describe('CR17-F: link prospects retired with their AI question are never offered', () => {
  it('backlinks: a row with retired_at is kept in the table but not listed', async () => {
    st.tables.prospects = [
      { domain: DOMAIN, prospect_domain: 'list-a.example', type: 'ai_source', status: 'new', score: 5, rank: 1, retired_at: '' },
      { domain: DOMAIN, prospect_domain: 'list-b.example', type: 'ai_source', status: 'new', score: 9, rank: 1, retired_at: '2026-11-16T10:00:00.000Z' },
    ];
    const b = await backlinksData(org, site);
    expect(b.prospects.map((p) => p.prospectDomain)).toEqual(['list-a.example']);
  });
  it('backlinks: the link gap competitors keep businesses only (an old snapshot listed salesforce.com)', async () => {
    st.tables.backlinkSnapshots = [{ domain: DOMAIN, checked_at: '2026-11-15T07:00:00.000Z', lost_json: '[]', new_json: '[]', timeseries_json: '[]', competitors_json: JSON.stringify([{ domain: 'edly.io', rank: 10 }, { domain: 'salesforce.com', rank: 90 }]) }];
    const b = await backlinksData(org, site);
    expect(b.latest!.competitors.map((c) => c.domain)).toEqual(['edly.io']);
  });
});

describe('CR17-F: THE competitor list (Site settings = the Competitors page)', () => {
  const ki = [
    { comp_domain: 'chosen-one.example', status: 'chosen', status_by: 'user' },
    { comp_domain: 'chosen-two.example', status: 'chosen', status_by: 'user' },
    { comp_domain: 'dismissed.example', status: 'dismissed', status_by: 'user' },
    { comp_domain: 'candidate.example', status: 'candidate', status_by: 'auto' },
  ] as const;
  it('Site settings + KI chosen, minus not_competitors and the ones dismissed by the person', () => {
    const mon = { competitors: 'declared.example, dismissed.example, gone.example', not_competitors: 'gone.example, chosen-two.example' };
    expect(oneCompetitorListOf({ domain: DOMAIN }, mon, ki)).toEqual(['declared.example', 'chosen-one.example']);
  });
  it('monitorsFromRow reads not_competitors (empty before the engine adds the column)', () => {
    expect(monitorsFromRow({ domain: DOMAIN, competitors: 'a.example', not_competitors: 'b.example, c.example' } as never)!.notCompetitors).toEqual(['b.example', 'c.example']);
    expect(monitorsFromRow({ domain: DOMAIN, competitors: 'a.example' } as never)!.notCompetitors).toEqual([]);
  });
  it('the role context carries the client\'s choices', () => {
    const c = competitorSiteOf({ domain: DOMAIN, services: ['AI consulting'] }, { competitors: 'declared.example', not_competitors: 'x.example' }, ki);
    expect(c).toEqual({ domain: DOMAIN, services: ['AI consulting'], declared: ['declared.example'], chosen: ['chosen-one.example', 'chosen-two.example'], notCompetitors: ['x.example', 'dismissed.example'] });
  });
});

describe('CR17-F: Rankings "Above you" says what each site is', () => {
  it('with the website\'s context, every domain carries its role; without it nothing changes', () => {
    const row = {
      id: 1, createdAt: 'x', updatedAt: 'x', ladder_id: 'lad_1', domain: DOMAIN, keyword: 'open edx development', rung: 1, position: 7, url: '', checked_at: '2026-11-15T08:00:00.000Z', device: 'desktop',
      features_json: JSON.stringify({ checked_at: '2026-11-15T08:00:00.000Z', ai_overview: { shown: false }, featured_snippet: { shown: false }, people_also_ask: { shown: false }, local_pack: { shown: false } }),
      competitors_json: JSON.stringify({ above: [{ d: 'edx.org', p: 1 }, { d: 'clutch.co', p: 2 }, { d: 'edly.io', p: 3 }, { d: 'openedx.org', p: 4 }] }),
    } as unknown as RankHistoryRow;
    const withCtx = serpReading([row], ctx)!;
    expect(withCtx.above.map((c) => [c.domain, c.role])).toEqual([['edx.org', 'also_ranks'], ['clutch.co', 'listing'], ['edly.io', 'competitor'], ['openedx.org', 'your_platform']]);
    expect(serpReading([row])!.above.every((c) => c.role === undefined)).toBe(true);
  });
});
