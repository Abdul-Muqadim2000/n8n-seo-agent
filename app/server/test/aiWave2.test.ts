import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiVisibilityRow } from '@seo/shared';

// W2-A (2026-10-23, WAVE2_CONTRACTS.md): the server halves of the AI page's wave 2 against a mocked n8n (Data Tables by table name,
// every read filtered by domain): the page payload without the answers, the filter's scope and segment trend, one page of answers with
// the whole answer, a question's history, the CSV downloads, the AI report uploads, deleting questions, the open-run note, the monitor
// settings read back, and the routes' roles.

const st = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; domain: string; q: Record<string, unknown> }[],
  deleted: [] as { table: string; filters: unknown[] }[],
  inserted: [] as { table: string; rows: Record<string, unknown>[] }[],
  ensured: [] as string[],
  role: 'admin',
  audits: [] as Record<string, unknown>[],
}));

const filterRows = (table: string, domain: string, q: Record<string, unknown>) => {
  let rows = (st.tables[table] ?? []).filter((r) => r.domain === domain);
  for (const f of (q.extra as { columnName: string; condition: string; value: unknown }[] | undefined) ?? [])
    rows = rows.filter((r) => (f.condition === 'eq' ? r[f.columnName] === f.value : f.condition === 'gte' ? String(r[f.columnName]) >= String(f.value) : true));
  const sort = String(q.sortBy ?? '');
  const key = sort.split(':')[0];
  if (sort.endsWith(':desc')) rows = [...rows].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
  return rows.slice(0, Number(q.max ?? 2000));
};

vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string, domain: string, q: Record<string, unknown> = {}) => (st.calls.push({ table, domain, q }), filterRows(table, domain, q))),
  rows: vi.fn(async () => []),
  deleteRows: vi.fn(async (table: string, filters: unknown[]) => (st.deleted.push({ table, filters }), true)),
  insertRows: vi.fn(async (table: string, rows: Record<string, unknown>[]) => (st.inserted.push({ table, rows }), true)),
  ensureTable: vi.fn(async (table: string) => (st.ensured.push(table), 'id')),
  invalidateSite: vi.fn(), siteAdmin: vi.fn(async () => ({ ok: true, affected: 1 })), upsertRow: vi.fn(), updateRows: vi.fn(async () => true),
}));
vi.mock('../src/services/runs', async (orig) => ({ ...(await orig<typeof import('../src/services/runs')>()), latestReport: vi.fn(async () => null), routeSiteToApp: vi.fn() }));
vi.mock('../src/services/runCredits', async (orig) => ({ ...(await orig<typeof import('../src/services/runCredits')>()), aiChargeEntries: vi.fn(async () => []) }));
vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async (_req: unknown, orgId: string, _siteId: string, need: string) => {
    if (orgId !== '00000000-0000-0000-0000-000000000001') { const e = new Error('Website not found') as Error & { statusCode: number }; e.statusCode = 404; throw e; }
    const rank: Record<string, number> = { client_viewer: -1, viewer: 0, member: 1, admin: 2, owner: 3 };
    if ((rank[st.role] ?? 0) < (rank[need] ?? 0)) { const e = new Error('Not allowed') as Error & { statusCode: number }; e.statusCode = 403; throw e; }
    return { org: { id: orgId }, site: { id: 'site-1', orgId, domain: 'techand.ai', verifiedAt: new Date() }, role: st.role };
  }),
  orgAccess: vi.fn(),
  requireVerified: vi.fn(),
}));
vi.mock('../src/services/audit', () => ({ audit: vi.fn(async (_req: unknown, _org: string, e: Record<string, unknown>) => { st.audits.push(e); }) }));
vi.mock('../src/db', async (orig) => ({ ...(await orig<typeof import('../src/db')>()), db: { update: () => ({ set: () => ({ where: async () => undefined }) }), query: {} } }));
vi.mock('../src/auth/google', () => ({ G_COOKIE: 'g', googleAuthUrl: vi.fn() }));
vi.mock('../src/services/google', () => ({ assertGa4ForDomain: vi.fn(), findGscProperty: vi.fn(), gscOwnerCheck: vi.fn(), listGa4Properties: vi.fn() }));
vi.mock('../src/services/verify', () => ({ fetchPublicText: vi.fn(), verify: vi.fn() }));
vi.mock('../src/services/pageWatch', async (orig) => ({ ...(await orig<typeof import('../src/services/pageWatch')>()), requestRecheck: vi.fn() }));
vi.mock('../src/services/pipeline', () => ({ ladderDetailData: vi.fn(), pipelineData: vi.fn() }));
vi.mock('../src/services/recommendations', () => ({ loadBundle: vi.fn(), overviewData: vi.fn(), recommend: vi.fn() }));

const { aiData, monitorsFromRow } = await import('../src/services/data');
const { aiAnswersPage, aiQuestionHistory, aiCsvStream, importAiReport, deleteAiPrompts } = await import('../src/services/aiWave2');
const { runOutcome } = await import('../src/services/runs');
const { dataRoutes } = await import('../src/routes/data');
const { siteRoutes } = await import('../src/routes/sites');

const ORG = '00000000-0000-0000-0000-000000000001';
const org = { id: ORG } as never;
const site = { id: 'site-1', domain: 'techand.ai' } as never;
const seg = (rows: unknown[][]) => JSON.stringify({ cols: ['dim', 'key', 'questions', 'n', 'k', 'cited', 'sov', 'leader', 'pulse_n', 'delta', 'significant'], rows });
const vis = (over: Partial<AiVisibilityRow> = {}): Record<string, unknown> => ({
  site_id: 'site_techand-ai', domain: 'techand.ai', run_id: 'ai_20261019_techand.ai', checked_at: '2026-10-19T07:00:00.000Z', prompts: 3, answers: 6, samples: 6,
  mention_rate: 50, citation_rate: 16.7, share_of_voice: 20, avg_rank: 2, aio_presence: 0, aio_citation_rate: 0, mention_lo: 18.8, mention_hi: 81.2,
  engines_json: JSON.stringify({ chatgpt: { name: 'ChatGPT', mention_rate: 66.7, citation_rate: 33.3, samples: 3 }, gemini: { name: 'Gemini', mention_rate: 33.3, citation_rate: 0, samples: 3 } }),
  competitors_json: JSON.stringify([{ domain: 'acme.com', mentions: 3, share: 60 }]), sources_json: '[]', pages_json: '[]', gaps_json: '[]', market_json: '', cost_usd: 0.1, alerts: '', run_kind: 'weekly',
  panel_json: JSON.stringify({ ids: ['q1', 'q2', 'q3'], size: 3 }), segments_json: seg([['persona', 'CFO', 2, 20, 6, 1, 10, 'acme.com', 0, null, null]]), ...over,
});
const answer = (prompt_id: string, engine: string, over: Record<string, unknown> = {}) => ({
  site_id: 'site_techand-ai', domain: 'techand.ai', run_id: 'ai_20261019_techand.ai', checked_at: '2026-10-19T07:10:00.000Z', prompt_id, prompt: `Question ${prompt_id}?`, kind: 'custom', topic: '', engine,
  answered: true, mentioned: false, cited: false, rank: 0, our_urls: '', competitors: 'acme.com', sources: 'g2.com', excerpt: 'short', cost: 0, error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '', ...over,
});
const prompts = [
  { domain: 'techand.ai', prompt_id: 'q1', prompt: 'Question q1?', persona: 'CFO', cluster: 'erp', market: 'AE-en', stage: 'decision', status: 'active', source: 'custom', pinned: false, last_asked_at: '2026-10-19T07:00:00.000Z', last_asked_run: 'ai_20261019_techand.ai', asked_n_28d: 4 },
  { domain: 'techand.ai', prompt_id: 'q2', prompt: 'Question q2?', persona: 'IT manager', cluster: 'crm', market: 'AE-en', stage: 'awareness', status: 'active', source: 'auto', pinned: false },
  { domain: 'other.com', prompt_id: 'q9', prompt: 'Someone else', status: 'active' },
];

beforeEach(() => {
  st.tables = {};
  st.calls = [];
  st.deleted = [];
  st.inserted = [];
  st.ensured = [];
  st.role = 'admin';
  st.audits = [];
});

describe('the page payload (A10 finished): summary, not every answer', () => {
  it("the page gets each question's best result per engine and the stored count; other callers still get the answers", async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [answer('q1', 'chatgpt', { mentioned: true }), answer('q1', 'chatgpt', { cited: 'https://techand.ai/erp', mentioned: true }), answer('q2', 'gemini', { answered: false })];
    const d = await aiData(org, site, { answers: 'summary' });
    expect(d.answers).toEqual([]);
    expect(d.answersStored).toBe(3);
    expect(d.answerResults).toEqual(expect.arrayContaining([{ promptId: 'q1', engine: 'chatgpt', result: 'cited' }, { promptId: 'q2', engine: 'gemini', result: 'none' }]));
    expect((await aiData(org, site)).answers).toHaveLength(3);
  });
  it('every run carries its engines, share of voice and range; the latest its wave-2 blocks (null on an older row)', async () => {
    st.tables.aiVisibility = [vis({ ci_json: JSON.stringify({ method: 'question-bootstrap', headline: { named_rate: { lo: 12, hi: 88, n_answers: 6, n_questions: 3, deff: 2 } } }), urls_json: JSON.stringify({ own: [{ url: 'https://techand.ai/erp', cited_n: 2, retrieved_n: 5 }] }) })];
    const d = await aiData(org, site, { answers: false });
    const r = d.runs[0];
    expect(r.engineRates?.map((e) => e.key)).toEqual(['chatgpt', 'gemini']);
    expect(r.sov).toMatchObject({ basis: 'all', brands: [{ id: 'acme.com', share: 60 }] });
    expect(r.ciNamed).toEqual([12, 88]);
    expect(r.ciMethod).toBe('question-bootstrap');
    expect(d.latest?.extras?.urls?.own[0]).toMatchObject({ citedN: 2, retrievedN: 5 });
    expect(d.latest?.extras?.shopping).toBeNull();
  });
  it('W2-E1: sources_json as an object keeps the old table from its `list` and feeds the new Sources panel', async () => {
    st.tables.aiVisibility = [vis({ sources_json: JSON.stringify({ v: 2, types: { ugc: { n: 3, share: 100 } }, domains: [{ host: 'reddit.com', type: 'ugc', cited_n: 3 }], n: 3, list: [{ domain: 'reddit.com', citations: 3, engines: ['chatgpt'], topics: [], kind: 'forum' }] }) })];
    const d = await aiData(org, site, { answers: false });
    expect(d.latest?.sources).toEqual([{ domain: 'reddit.com', citations: 3, engines: ['chatgpt'], topics: [], kind: 'forum' }]);
    expect(d.latest?.extras?.sources?.types[0]).toMatchObject({ type: 'ugc', n: 3 });
  });
  it('the panel rows carry the engine\'s own asked record when stored', async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.aiPrompts = prompts;
    const d = await aiData(org, site, { answers: false });
    expect(d.prompts.find((p) => p.promptId === 'q1')).toMatchObject({ lastAskedAt: '2026-10-19T07:00:00.000Z', askedN28d: 4 });
    expect(d.prompts.find((p) => p.promptId === 'q2')?.lastAskedAt).toBeUndefined();
  });
});

describe('the filter bar scope', () => {
  it('one dimension: that segment in every run, with its range; a not-comparable run is marked', async () => {
    st.tables.aiVisibility = [
      vis({ run_id: 'a', checked_at: '2026-10-12T07:00:00.000Z', panel_json: JSON.stringify({ ids: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'], size: 8 }), segments_json: seg([['persona', 'CFO', 2, 4, 1, 0, 0, '', 0, null, null]]) }),
      vis(),
    ];
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [answer('q1', 'chatgpt', { mentioned: true }), answer('q2', 'chatgpt')];
    const d = await aiData(org, site, { answers: 'summary', filter: { engine: '', cluster: '', persona: 'CFO', market: '', stage: '', from: '', to: '' } });
    expect(d.scope?.segment).toEqual({ dim: 'persona', key: 'CFO' });
    expect(d.scope?.trend.map((t) => [t.rate, t.enough])).toEqual([[null, false], [30, true]]);
    expect(d.scope?.trend[1].comparable).toBe(false);
    expect(d.scope?.summary).toMatchObject({ answers: 1, named: 1, enough: false });
  });
});

describe('one page of answers', () => {
  it('pages, filters by facet and result, carries the whole answer and the filter\'s rates', async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [
      ...Array.from({ length: 30 }, (_, i) => answer('q1', i % 2 ? 'chatgpt' : 'gemini', { mentioned: i < 10, checked_at: `2026-10-19T07:${String(10 + i).padStart(2, '0')}:00.000Z`, answer_text: `Full answer ${i}`, cited_json: JSON.stringify([{ url: 'https://techand.ai/a', position: 1 }]) })),
      answer('q2', 'chatgpt'),
    ];
    const p = await aiAnswersPage(site, { filter: { engine: '', cluster: 'erp', persona: '', market: '', stage: '', from: '', to: '' }, page: 2, pageSize: 25 });
    expect(p.total).toBe(30);
    expect(p.items).toHaveLength(5);
    expect(p.summary).toMatchObject({ answers: 30, named: 10, enough: true, namedRate: 33.3 });
    expect(p.items[0].detail?.answerText).toMatch(/Full answer/);
    expect(p.items[0].detail?.citations?.[0].own).toBe(true);
    expect(p.items[0]).toMatchObject({ persona: 'CFO', cluster: 'erp' });
    const named = await aiAnswersPage(site, { filter: { engine: 'gemini', cluster: '', persona: '', market: '', stage: '', from: '', to: '' }, result: 'named' });
    expect(named.items.every((a) => a.engine === 'gemini' && a.mentioned)).toBe(true);
    // every read is the site's own domain
    expect(st.calls.every((c) => c.domain === 'techand.ai')).toBe(true);
  });
  it('no run stored: an empty page, never an error', async () => {
    const p = await aiAnswersPage(site, { filter: { engine: '', cluster: '', persona: '', market: '', stage: '', from: '', to: '' } });
    expect(p).toMatchObject({ runId: null, total: 0, items: [] });
  });
});

describe("a question's history", () => {
  it('groups the answers by run, newest first, with a named rate and range per run', async () => {
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [
      answer('q1', 'chatgpt', { run_id: 'r1', checked_at: '2026-10-05T07:00:00.000Z', mentioned: true }),
      answer('q1', 'gemini', { run_id: 'r1', checked_at: '2026-10-05T07:01:00.000Z' }),
      answer('q1', 'chatgpt', { run_id: 'r2', checked_at: '2026-10-12T07:00:00.000Z' }),
    ];
    const h = await aiQuestionHistory(site, 'q1');
    expect(h.runs.map((r) => r.runId)).toEqual(['r2', 'r1']);
    expect(h.series.map((x) => [x.runId, x.namedRate])).toEqual([['r1', 50], ['r2', 0]]);
    expect(h.facets).toMatchObject({ persona: 'CFO', cluster: 'erp' });
  });
  it('an unknown question is a 404', async () => {
    await expect(aiQuestionHistory(site, 'nope')).rejects.toThrow(/not found/);
  });
});

const collect = async (r: NodeJS.ReadableStream) => { let out = ''; for await (const c of r) out += String(c); return out; };

describe('CSV downloads', () => {
  it('answers: header + one line an answer, the whole answer, formulas neutralised, the filter applied', async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [answer('q1', 'chatgpt', { answer_text: '=HYPERLINK("x")' }), answer('q2', 'chatgpt')];
    const csv = await collect(await aiCsvStream(org, site, 'answers', { engine: '', cluster: '', persona: 'CFO', market: '', stage: '', from: '', to: '' }));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toMatch(/^"run_id","checked_at"/);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"\'=HYPERLINK(""x"")"');
  });
  it('competitors over time, questions and pages read the same tables, the domain\'s own rows only', async () => {
    st.tables.aiVisibility = [vis({ run_id: 'a', checked_at: '2026-10-12T07:00:00.000Z' }), vis()];
    st.tables.aiPrompts = prompts;
    const comp = await collect(await aiCsvStream(org, site, 'competitors', { engine: '', cluster: '', persona: '', market: '', stage: '', from: '', to: '' }));
    expect(comp.trim().split('\r\n')).toHaveLength(5);
    const q = await collect(await aiCsvStream(org, site, 'questions', { engine: '', cluster: '', persona: '', market: '', stage: '', from: '', to: '' }));
    expect(q).toContain('Question q1?');
    expect(q).not.toContain('Someone else');
    const pages = await collect(await aiCsvStream(org, site, 'pages', { engine: '', cluster: '', persona: '', market: '', stage: '', from: '', to: '' }));
    expect(pages.trim().split('\r\n')).toHaveLength(1);
  });
});

describe('AI report uploads -> seo_ai_imports', () => {
  const SITE_F = [{ columnName: 'site_id', condition: 'eq', value: 'site_techand-ai' }, { columnName: 'source', condition: 'eq', value: 'bing_ai' }];
  it('creates the table and inserts with the site id and import id; with nothing stored, nothing is deleted', async () => {
    const out = await importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Date,Page,Citations\n2026-10-20,https://techand.ai/a,3\n2026-10-21,https://techand.ai/b,1\n', fileName: 'bing.csv' });
    expect(out).toMatchObject({ source: 'bing_ai', rows: 2, replaced: 0 });
    expect(st.ensured).toEqual(['aiImports']);
    expect(st.deleted).toEqual([]);
    expect(st.inserted[0].rows[0]).toMatchObject({ site_id: 'site_techand-ai', domain: 'techand.ai', source: 'bing_ai', day: '2026-10-20', citations: 3, file_name: 'bing.csv', import_id: out.importId });
  });
  it('R-A4: upsert by (site, source, day, url, query): a queries file of the same days stays, only superseded rows go, after the insert', async () => {
    const row = (import_id: string, day: string, url: string, query: string) => ({ site_id: 'site_techand-ai', domain: 'techand.ai', source: 'bing_ai', day, url, query, citations: 1, import_id });
    st.tables.aiImports = [
      row('aiimp_pages', '2026-10-20', 'https://techand.ai/a', ''),
      row('aiimp_pages', '2026-10-20', 'https://techand.ai/c', ''),
      row('aiimp_pages', '2026-10-21', 'https://techand.ai/b', ''),
      row('aiimp_queries', '2026-10-20', '', 'erp uae'),
      row('aiimp_pages', '2026-10-25', 'https://techand.ai/a', ''),
      { ...row('aiimp_other', '2026-10-20', 'https://techand.ai/a', ''), domain: 'acme.com', site_id: 'site_acme-com' },
    ];
    const out = await importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Date,Page,Citations\n2026-10-20,https://techand.ai/a,3\n2026-10-21,https://techand.ai/b,1\n' });
    expect(out.replaced).toBe(2);
    // the insert comes first (phase 1), the deletes after (phase 2)
    expect(st.inserted).toHaveLength(1);
    const del = st.deleted.map((d) => d.filters);
    expect(del).toContainEqual([...SITE_F, { columnName: 'day', condition: 'eq', value: '2026-10-21' }, { columnName: 'import_id', condition: 'eq', value: 'aiimp_pages' }]);
    expect(del).toContainEqual([...SITE_F, { columnName: 'day', condition: 'eq', value: '2026-10-20' }, { columnName: 'import_id', condition: 'eq', value: 'aiimp_pages' }, { columnName: 'url', condition: 'eq', value: 'https://techand.ai/a' }]);
    expect(del).toHaveLength(2);
    expect(JSON.stringify(del)).not.toContain('aiimp_queries');
  });
  it('R-A4: a failed insert takes out only this upload\'s rows; earlier uploads are untouched', async () => {
    const client = await import('../src/n8n/client');
    vi.mocked(client.insertRows).mockRejectedValueOnce(new Error('n8n rows insert on seo_ai_imports answered 500'));
    st.tables.aiImports = [{ site_id: 'site_techand-ai', domain: 'techand.ai', source: 'bing_ai', day: '2026-10-20', url: 'https://techand.ai/a', query: '', import_id: 'aiimp_old' }];
    await expect(importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Date,Page,Citations\n2026-10-20,https://techand.ai/a,3\n' })).rejects.toThrow(/Nothing was changed/);
    expect(st.deleted).toHaveLength(1);
    expect(st.deleted[0].filters).toEqual([...SITE_F, { columnName: 'import_id', condition: 'eq', value: expect.stringMatching(/^aiimp_/) }]);
    expect(JSON.stringify(st.deleted)).not.toContain('aiimp_old');
  });
  it('R-A5: a file without dates needs the period end; month-first dates are read month-first', async () => {
    await expect(importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Top queries,Clicks,Impressions\nerp uae,1,10\n' })).rejects.toThrow(/no date column/);
    const out = await importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Date,Page,Citations\n10/22/2026,https://techand.ai/a,3\n10/05/2026,https://techand.ai/b,1\n' });
    expect(out.days).toEqual({ from: '2026-10-05', to: '2026-10-22' });
    expect(out.dateOrder).toBe('mdy');
  });
  it('a file for another domain is a 400 and nothing is written', async () => {
    await expect(importAiReport({ id: 'site-1', domain: 'techand.ai' } as never, { csv: 'Page,Citations\nhttps://acme.com/a,3\n' })).rejects.toThrow(/acme\.com/);
    expect(st.inserted).toEqual([]);
  });
});

describe('deleting questions', () => {
  it("R-A7: keeps a tombstone (status off, origin deleted) for ids stored for this domain, filtered by domain AND id; removes no row", async () => {
    st.tables.aiPrompts = prompts;
    const client = await import('../src/n8n/client');
    vi.mocked(client.updateRows).mockClear();
    expect(await deleteAiPrompts({ domain: 'techand.ai' } as never, ['q1', 'q9', 'nope'])).toEqual({ deleted: 1, failed: [], ids: ['q1'] });
    expect(st.deleted).toEqual([]);
    const calls = vi.mocked(client.updateRows).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('aiPrompts');
    expect(calls[0][1]).toEqual([{ columnName: 'domain', condition: 'eq', value: 'techand.ai' }, { columnName: 'prompt_id', condition: 'eq', value: 'q1' }]);
    expect(calls[0][2]).toMatchObject({ status: 'off', origin: 'deleted', pinned: false });
  });
  it('R-A7: a tombstone is not listed on the page, and deleting it again does nothing', async () => {
    st.tables.aiPrompts = prompts.map((p) => (p.prompt_id === 'q1' ? { ...p, status: 'off', origin: 'deleted' } : p));
    st.tables.aiVisibility = [vis()];
    const d = await aiData(org, site, { answers: false });
    expect(d.prompts.map((p) => p.promptId)).not.toContain('q1');
    expect((await deleteAiPrompts({ domain: 'techand.ai' } as never, ['q1'])).deleted).toBe(0);
  });
  it('R-A16: a failed write is reported, the others still go', async () => {
    st.tables.aiPrompts = prompts;
    const client = await import('../src/n8n/client');
    vi.mocked(client.updateRows).mockRejectedValueOnce(new Error('n8n 500'));
    const r = await deleteAiPrompts({ domain: 'techand.ai' } as never, ['q1', 'q2']);
    expect(r.deleted + r.failed.length).toBe(2);
    expect(r.failed).toHaveLength(1);
  });
});

describe('§6: a start that joins the open run', () => {
  it('is closed with nothing charged, marked as part of the open run with when it finishes', () => {
    const o = runOutcome('accepted', ['ai_visibility'], 'rejected', { stage: 'rejected', status: 'rejected', reason: 'open_run', error: 'A run is in progress.', open_run: { expected_finish: '2099-01-01T09:40:00.000Z' } });
    // R-A3 (review 2026-10-23): its own state, never `failed`
    expect(o).toMatchObject({ status: 'joined', lastStage: 'joined_open_run' });
    expect(o.error).toMatch(/^Part of the open run \(finishes about 09:40 UTC on 2099-01-01\)\. A run is in progress\./);
    expect(runOutcome('accepted', [], 'rejected', { stage: 'rejected', error: 'refused' }).lastStage).toBeUndefined();
    // closed: a later refusal does not turn it into a failure
    expect(runOutcome('joined', ['ai_visibility'], 'rejected', { stage: 'rejected', error: 'refused' })).toEqual({});
  });
  it('R-A3: no run.failed event, nothing charged, a note (not an error) for the API, the open run named for its report', async () => {
    const { eventsFor, deliveryDecision } = await import('@seo/shared');
    const { runCreditsOf } = await import('../src/services/runCredits');
    const { joinedOpenRunOf, toRun } = await import('../src/services/runs');
    const { toRunV1 } = await import('../src/services/apiV1');
    const body = { stage: 'rejected', status: 'rejected', reason: 'open_run', error: 'A run is in progress.', open_run: { run_id: 'ai_20261023_techand.ai', expected_finish: '2099-01-01T09:40:00.000Z' } };
    const report = { id: 'r1', title: 'x', stage: 'rejected', status: 'rejected', receivedAt: '2026-10-23T09:00:00Z', scheduled: false, runId: 'run1', websiteId: 's', url: 'u' };
    const after = { id: 'run1', mode: 'ai_visibility', title: 'AI', status: 'joined', error: null, completedAt: '2026-10-23T09:00:00Z', url: 'u' };
    const ev = eventsFor({ stage: 'rejected', status: 'rejected', payload: body, report, runBefore: { status: 'accepted' }, runAfter: after });
    expect(ev.map((e) => e.type)).not.toContain('run.failed');
    // the same callback on a run closed as failed (before this fix) did emit it: the event is what this guards
    expect(eventsFor({ stage: 'rejected', status: 'rejected', payload: body, report, runBefore: { status: 'accepted' }, runAfter: { ...after, status: 'failed' } }).map((e) => e.type)).toContain('run.failed');
    expect(deliveryDecision({ stage: 'rejected', status: 'rejected', payload: body }).reason).toMatch(/part of the run already in progress/);
    expect(runCreditsOf({ status: 'joined', quotedCredits: 12, engineCostEstimateUsd: null, estimatedCostUsd: 1 } as never, undefined, { creditValueUsd: 0.05, markup: 3 }).state).toBe('not_charged');
    expect(joinedOpenRunOf(body)).toEqual({ openRunId: 'ai_20261023_techand.ai', expectedFinish: '2099-01-01T09:40:00.000Z' });
    expect(joinedOpenRunOf({ stage: 'rejected' })).toBeNull();
    const row = { id: 'run1', orgId: ORG, siteId: 's', userId: null, mode: 'ai_visibility', title: 'AI', status: 'joined', requestId: 'q', input: {}, error: 'Part of the open run.', apiKeyId: null, etaMinutes: 0, createdAt: new Date(), acceptedAt: null, completedAt: new Date(), reportCount: 1, lastStage: 'joined_open_run' } as never;
    const credits = { quoted: 12, charged: null, state: 'not_charged', capped: false } as never;
    expect(toRunV1(row, credits)).toMatchObject({ status: 'joined', error: null, note: 'Part of the open run.' });
    expect(toRun(row, { credits })).toMatchObject({ status: 'joined', error: null, note: 'Part of the open run.' });
  });
});

describe('§4 monitor settings read back', () => {
  it('absent columns stay absent (today\'s behaviour); stored ones are read', () => {
    const base = { site_id: 's', domain: 'techand.ai', ai_visibility: true, ai_engines: '', ai_prompts_max: 50 } as never;
    expect(monitorsFromRow(base)).not.toHaveProperty('aiClaudeWeekly');
    const m = monitorsFromRow({ ...(base as object), ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, perplexity, bogus', ai_fanout_check: 50, ai_alert_rules_json: JSON.stringify([{ id: 'r1', metric: 'named_rate', threshold_points: 5 }]) } as never);
    expect(m).toMatchObject({ aiClaudeWeekly: true, aiPulseEngines: ['chatgpt', 'perplexity'], aiFanoutCheck: 50 });
    expect(m?.aiAlertRules?.[0]).toMatchObject({ id: 'r1', direction: 'drop' });
  });
});

describe('routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => reply.status(err.statusCode ?? 500).send({ error: err.message }));
    await app.register(dataRoutes);
    await app.register(siteRoutes);
  });
  afterAll(() => app.close());
  const base = `/api/orgs/${ORG}/sites/00000000-0000-0000-0000-000000000002`;

  it('CSV download: text/csv attachment named after the site; an unknown kind is a 404', async () => {
    st.tables.aiVisibility = [vis()];
    const r = await app.inject({ method: 'GET', url: `${base}/data/ai/export?kind=competitors` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.headers['content-disposition']).toMatch(/ai-competitors-techand\.ai-/);
    expect((await app.inject({ method: 'GET', url: `${base}/data/ai/export?kind=secrets` })).statusCode).toBe(404);
  });
  it('another company cannot read or download', async () => {
    expect((await app.inject({ method: 'GET', url: `/api/orgs/00000000-0000-0000-0000-000000000009/sites/x/data/ai/export?kind=answers` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/orgs/00000000-0000-0000-0000-000000000009/sites/x/data/ai/answers` })).statusCode).toBe(404);
  });
  it('upload: members may, viewers may not; the audit log has the counts', async () => {
    st.role = 'viewer';
    expect((await app.inject({ method: 'POST', url: `${base}/ai/import`, payload: { csv: 'Date,Page,Citations\n2026-10-20,https://techand.ai/a,3\n' } })).statusCode).toBe(403);
    st.role = 'member';
    const r = await app.inject({ method: 'POST', url: `${base}/ai/import`, payload: { csv: 'Date,Page,Citations\n2026-10-20,https://techand.ai/a,3\n' } });
    expect(r.statusCode).toBe(200);
    expect(st.audits[0]).toMatchObject({ action: 'site.ai_import', details: { source: 'bing_ai', rows: 1 } });
  });
  it('delete questions: admins only, audited with ids', async () => {
    st.tables.aiPrompts = prompts;
    st.role = 'member';
    expect((await app.inject({ method: 'POST', url: `${base}/ai/prompts/delete`, payload: { ids: ['q1'] } })).statusCode).toBe(403);
    st.role = 'admin';
    const r = await app.inject({ method: 'POST', url: `${base}/ai/prompts/delete`, payload: { ids: ['q1'] } });
    expect(r.json()).toEqual({ ok: true, deleted: 1 });
    expect(st.audits[0]).toMatchObject({ action: 'site.ai_prompts_deleted', details: { deleted: 1, ids: ['q1'] } });
  });
  it('the page endpoint takes the filter from the query and sends no answers', async () => {
    st.tables.aiVisibility = [vis()];
    st.tables.aiPrompts = prompts;
    st.tables.aiAnswers = [answer('q1', 'chatgpt', { mentioned: true })];
    const r = (await app.inject({ method: 'GET', url: `${base}/data/ai?persona=CFO` })).json();
    expect(r.answers).toEqual([]);
    expect(r.scope.segment).toEqual({ dim: 'persona', key: 'CFO' });
  });
  it('a question edit sends its keyword to the engine', async () => {
    const { siteAdmin } = await import('../src/n8n/client');
    const r = await app.inject({ method: 'POST', url: `${base}/admin`, payload: { action: 'ai_prompts', edit: [{ promptId: 'q1', keyword: 'erp partner dubai' }] } });
    expect(r.statusCode).toBe(200);
    expect(vi.mocked(siteAdmin).mock.calls.at(-1)?.[0]).toMatchObject({ edit: [{ prompt_id: 'q1', keyword: 'erp partner dubai' }] });
  });
});
