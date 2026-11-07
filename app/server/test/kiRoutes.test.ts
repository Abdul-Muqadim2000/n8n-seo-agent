// KI A1 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §7, fixes/A1_ROUTES.md): the keyword-intelligence routes. Roles, verified
// ownership, isolation between two companies, Off / Trial / On visibility (404 when not visible), the kill switch, CSV formula guard, filters
// and paging, the max-chosen 409, the platform-admin-only mode switch, the AI panel approval, API v1, recommendations, and a 5,000-row timing.
// Synthetic data only (example.* domains); the engine is an in-memory fake.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = '00000000-0000-0000-0000-0000000000a1';
const ORG_B = '00000000-0000-0000-0000-0000000000b1';
const SITE_A = '00000000-0000-0000-0000-0000000000a2';
const SITE_B = '00000000-0000-0000-0000-0000000000b2';
const SITES: Record<string, { id: string; orgId: string; domain: string; verifiedAt: Date | null; brandNames: string[] }> = {
  [SITE_A]: { id: SITE_A, orgId: ORG_A, domain: 'nova-a.example', verifiedAt: new Date(), brandNames: ['Nova Alpha'] },
  [SITE_B]: { id: SITE_B, orgId: ORG_B, domain: 'nova-b.example', verifiedAt: new Date(), brandNames: [] },
};

const st = vi.hoisted(() => ({
  member: {} as Record<string, string>,
  platform: false,
  tables: {} as Record<string, Record<string, unknown>[]>,
  cache: [] as Record<string, unknown>[] | null,
  sent: [] as Record<string, unknown>[],
  adminOk: true,
  applyMonitors: true,
  leak: false,
}));

vi.mock('../src/auth/access', () => ({
  siteAccess: vi.fn(async (_req: unknown, orgId: string, siteId: string, need: string) => {
    const rank: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    const role = st.member[orgId];
    const err = (code: number, m: string) => Object.assign(new Error(m), { statusCode: code });
    if (!role) throw err(404, 'Company not found');
    const site = SITES[siteId];
    if (!site || site.orgId !== orgId) throw err(404, 'Website not found');
    if ((rank[role] ?? 0) < (rank[need] ?? 0)) throw err(403, 'Not allowed');
    return { org: { id: orgId }, site, role, user: { id: 'u1', email: 'a@nova-a.example' } };
  }),
  requireVerified: vi.fn((s: { verifiedAt: Date | null; domain: string }) => {
    if (!s.verifiedAt) throw Object.assign(new Error(`Verify that you own ${s.domain}`), { statusCode: 403 });
  }),
  requireUser: vi.fn(() => ({ id: 'u1', email: 'a@nova-a.example' })),
  isUuid: (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
  isPlatformAdmin: vi.fn(() => st.platform),
}));
vi.mock('../src/n8n/client', () => {
  const filt = (table: string, domain: string) => {
    const all = st.tables[table] ?? [];
    // `leak`: an engine filter that went wrong and returned another website's rows as well (the app must still never show them)
    return st.leak ? all : all.filter((r) => r.domain === domain);
  };
  return {
    siteRows: vi.fn(async (table: string, domain: string) => filt(table, domain)),
    rows: vi.fn(async (table: string) => {
      if (table === 'cache') {
        if (st.cache === null) throw new Error('n8n down');
        return st.cache;
      }
      return st.tables[table] ?? [];
    }),
    siteAdmin: vi.fn(async (body: Record<string, unknown>) => {
      st.sent.push(body);
      if (body.action === 'monitors' && st.applyMonitors) {
        const m = (st.tables.monitors ??= []);
        const row = m.find((r) => r.domain === body.domain);
        const ki = (body.monitors as Record<string, unknown>).ki_mode;
        if (row) row.ki_mode = ki;
        else m.push({ domain: body.domain, ki_mode: ki });
      }
      if (body.action === 'ki_competitor') {
        const row = (st.tables.kiCompetitors ?? []).find((r) => r.domain === body.domain && r.comp_domain === body.comp_domain);
        if (row) Object.assign(row, { status: body.status, status_by: 'user' });
      }
      return { ok: st.adminOk, action: String(body.action), affected: 1, error: st.adminOk ? null : 'engine said no' };
    }),
    invalidateSite: vi.fn(),
    deleteRows: vi.fn(),
  };
});
vi.mock('../src/db', async () => ({
  db: { query: { sites: { findFirst: vi.fn(async () => SITES[SITE_B]) } } },
  schema: await import('../src/db/schema'),
}));
vi.mock('../src/services/audit', () => ({ audit: vi.fn() }));
vi.mock('../src/services/admin/settings', () => ({ settingsRow: vi.fn(async () => ({ creditValueUsd: 0.05, markup: 3 })) }));
vi.mock('../src/services/billing', () => ({ quoteCredits: (usd: number, s: { creditValueUsd: number; markup: number }) => (usd > 0 ? Math.max(1, Math.ceil(Math.round((usd * s.markup) / s.creditValueUsd * 100) / 100 - 1e-9)) : 0) }));
vi.mock('../src/services/runs', () => ({ estimateCost: vi.fn(async (input: { mode: string }) => (input.mode === 'competitors' ? 0.37 : 0.94)) }));

const { kiRoutes } = await import('../src/routes/ki');
const { kiCache } = await import('../src/services/ki');
const kiData = await import('../src/services/kiData');
const { kiCsvLine, KI_VERDICT_IDS, KI_KEYWORD_CSV_COLUMNS } = await import('@seo/shared');

let app: FastifyInstance;
beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => reply.status(err.statusCode ?? 500).send({ error: err.message, code: err.code }));
  await app.register(kiRoutes);
});
afterAll(() => app.close());

// ---------------- fixtures ----------------
const STAGES = ['hire', 'compare', 'solution', 'problem', 'info'];
const VERDICTS = ['go', 'months', 'hard', 'gated'];
function kw(domain: string, i: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  const verdict = VERDICTS[i % 4];
  return {
    id: i + 1, domain, site_id: 'site_x', market: 'AE-en', keyword: `erp service ${i} dubai`, kw_key: `k${i}`,
    sources_json: JSON.stringify([{ source: i % 3 === 0 ? 'gsc' : 'labs_ideas', fetched_at: '2026-11-07T10:00:00Z' }]), source_count: 1,
    volume: (i * 37) % 2000, volume_basis: 'provider_estimate', volume_source: 'Google Ads', cpc: 2.5, kd: (i * 7) % 100,
    gsc_impressions: i % 3 === 0 ? 100 + i : null, gsc_clicks: null, gsc_position: i % 3 === 0 ? (i % 30) + 1 : null, gsc_page: null,
    intent: 'commercial', stage: STAGES[i % 5], stage_evidence_json: '[]', intent_confidence: 0.8, needs_review: false,
    gate: verdict === 'gated' ? 'fail' : 'pass', gate_reason: verdict === 'gated' ? 'another company\'s brand' : null,
    fit: 0.7, demand: 0.5, win: verdict === 'go' ? 0.7 : verdict === 'months' ? 0.5 : 0.2, value: 0.6, gap: 0.3, score: (i * 13) % 100, score_low: 10, score_high: 90,
    low_confidence: false, verdict, cluster_id: `c${i % 50}`, is_head: i % 50 === i, cluster_size: 5, cluster_demand: 1000,
    serp_read_at: '2026-11-07T10:00:00Z', top10_json: JSON.stringify([{ url: 'https://rival.example/x', host: 'rival.example', type: 'service', pos: 1 }]),
    page_action: i % 6 === 0 ? 'refresh' : 'new', page_url: null, cannibal_json: '[]', competitors_json: '[]', striking: i % 10 === 0,
    run_id: 'r1', fetched_at: '2026-11-07T10:00:00Z', updated_at: '2026-11-07T10:00:00Z', ...over,
  };
}
function comp(domain: string, d: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    domain, site_id: 'site_x', market: 'AE-en', comp_domain: d, class: 'direct', class_basis: 'rule', class_confidence: 0.9, scored: true, score: 70, score_low: 60,
    score_high: 80, serp_share: 0.3, topic_sim: 0.6, geo_match: 1, ai_share: 0.1, size_tag: 'peer', seeds_seen: 5, seeds_total: 10,
    reasons_json: JSON.stringify(['shows up for 5 of 10 of your services']), evidence_json: JSON.stringify([{ seed: 'erp dubai', position: 3, url: `https://${d}/erp` }]),
    declared: false, status: 'candidate', status_by: 'auto', first_seen: '2026-11-01', last_seen: '2026-11-07', misses: 0, profile_json: null, run_id: 'r1',
    updated_at: '2026-11-07T10:00:00Z', ...over,
  };
}
const gap = (domain: string, id: string, over: Record<string, unknown> = {}) => ({
  gap_id: id, domain, site_id: 'site_x', market: 'AE-en', type: 'missing', keyword: 'erp cost dubai', cluster_id: 'c1', competitor_domains_json: '["rival.example"]',
  client_position: null, evidence_json: '{}', sample_note: '', action: 'new_page', action_target: '', credits: 40, status: 'open', run_id: 'r1',
  created_at: '2026-11-07T10:00:00Z', updated_at: '2026-11-07T10:00:00Z', ...over,
});
const run = (domain: string, over: Record<string, unknown> = {}) => ({
  domain, site_id: 'site_x', run_id: 'r1', request_id: '9', kind: 'keyword_research', market: 'AE-en', mode: 'on', rule_version: 'ki-1', started_at: '2026-11-07T09:00:00Z',
  finished_at: '2026-11-07T09:12:00Z', status: 'partial', reason: '', sections_json: JSON.stringify([{ key: 'volumes', state: 'missing', reason: 'provider', rows: 0 }, { key: 'serps', state: 'ok', reason: '', rows: 60 }]),
  counts_json: '{"keywords":120}', cost_dfs_usd: 0.8, cost_claude_usd: 0.02, config_json: '{}', ...over,
});

function seed(mode: string, opts: { keywords?: number; maxComp?: number | null } = {}) {
  const n = opts.keywords ?? 40;
  st.tables = {
    monitors: [
      { domain: 'nova-a.example', site_id: 'site_a', ki_mode: mode, ki_max_competitors: opts.maxComp ?? null, ai_prompts_max: 10 },
      { domain: 'nova-b.example', site_id: 'site_b', ki_mode: 'on' },
    ],
    kiKeywords: [...Array.from({ length: n }, (_, i) => kw('nova-a.example', i)), kw('nova-b.example', 999, { keyword: 'secret of b', kw_key: 'kb' })],
    kiCompetitors: [comp('nova-a.example', 'rival-one.example'), comp('nova-a.example', 'rival-two.example', { score: 50 }), comp('nova-a.example', 'g2.example', { class: 'directory' }), comp('nova-b.example', 'b-only.example')],
    kiGaps: [gap('nova-a.example', 'g1'), gap('nova-a.example', 'g2', { type: 'striking', status: 'started' }), gap('nova-b.example', 'gb')],
    kiRuns: [run('nova-a.example'), run('nova-a.example', { kind: 'competitors', run_id: 'r0', status: 'ok', started_at: '2026-11-06T09:00:00Z' })],
    aiPrompts: [],
  };
}

beforeEach(() => {
  kiCache.clear();
  st.member = { [ORG_A]: 'owner' };
  st.platform = false;
  st.cache = [];
  st.sent = [];
  st.adminOk = true;
  st.applyMonitors = true;
  st.leak = false;
  seed('on');
});

const U = (p = '', org = ORG_A, site = SITE_A) => `/api/orgs/${org}/sites/${site}/ki${p}`;
const get = (p = '', org?: string, site?: string) => app.inject({ method: 'GET', url: U(p, org, site) });
const patch = (p: string, payload: unknown) => app.inject({ method: 'PATCH', url: U(p), payload: payload as object });
const post = (p: string, payload: unknown) => app.inject({ method: 'POST', url: U(p), payload: payload as object });
const json = (r: { body: string }) => JSON.parse(r.body);
const DATA_ROUTES: [string, string, unknown?][] = [
  ['GET', '/competitors'], ['GET', '/competitors.csv'], ['GET', '/keywords'], ['GET', '/keywords.csv'], ['GET', '/gaps'], ['GET', '/gaps.csv'],
  ['PATCH', '/competitors/rival-one.example', { status: 'chosen' }], ['PATCH', '/gaps/g1', { status: 'done' }], ['POST', '/questions/approve', { keys: ['k0'] }], ['POST', '/plan/a1/start', {}],
];
const call = (m: string, p: string, payload?: unknown) => app.inject({ method: m as 'GET', url: U(p), ...(payload ? { payload: payload as object } : {}) });

describe('KI A1: Off / Trial / On visibility', () => {
  it('Off: the overview says off with nothing in it; every data route answers 404 and nothing reaches the engine', async () => {
    seed('');
    const o = json(await get());
    expect(o).toMatchObject({ mode: 'off', visible: false, summary: null, lastRuns: [], canSwitch: false, canAct: false });
    expect(o.killed).toBeUndefined();
    for (const [m, p, b] of DATA_ROUTES) expect((await call(m, p, b)).statusCode, `${m} ${p}`).toBe(404);
    expect(st.sent).toEqual([]);
  });
  it('Trial: a company person reads it as Off and gets 404 everywhere; a platform admin sees the stored mode and the data', async () => {
    seed('trial');
    expect(json(await get())).toMatchObject({ mode: 'off', visible: false });
    for (const [m, p, b] of DATA_ROUTES) expect((await call(m, p, b)).statusCode, `${m} ${p}`).toBe(404);
    st.platform = true;
    expect(json(await get())).toMatchObject({ mode: 'trial', visible: true, canSwitch: true, killed: false });
    expect((await get('/keywords')).statusCode).toBe(200);
  });
  it('On: visible to the company, with the counts the hero needs in one answer', async () => {
    const o = json(await get());
    expect(o).toMatchObject({ mode: 'on', visible: true, canAct: true, maxCompetitors: 5, credits: { competitors: 23, research: 57 } });
    expect(o.summary.keywords.total).toBe(40);
    expect(o.summary.competitors).toMatchObject({ total: 2, chosen: 0, listings: 1, confirmed: false });
    expect(o.summary.gaps).toMatchObject({ open: 1, byType: { missing: 1 } });
    expect(o.lastRuns[0]).toMatchObject({ kind: 'keyword_research', status: 'partial', missingSections: ['volumes'] });
  });
  it('the kill switch (or an unreadable one) makes an On website behave as Off; a platform admin is told it is killed', async () => {
    st.cache = [{ key: 'ki:kill', value: '1' }];
    expect((await get('/keywords')).statusCode).toBe(404);
    expect(json(await get())).toMatchObject({ visible: false });
    st.cache = null;
    expect((await get('/competitors')).statusCode).toBe(404);
    st.platform = true;
    expect(json(await get())).toMatchObject({ visible: false, killed: true, mode: 'on' });
  });
  it('an Off website does not read the kill switch at all (existing pages read nothing more)', async () => {
    seed('off');
    st.cache = null;
    expect(json(await get())).toMatchObject({ visible: false });
  });
});

describe('KI A1: roles, ownership and isolation', () => {
  it('a viewer reads but cannot change a status, approve questions or start a plan step', async () => {
    st.member = { [ORG_A]: 'viewer' };
    expect((await get('/keywords')).statusCode).toBe(200);
    expect(json(await get()).canAct).toBe(false);
    expect((await patch('/competitors/rival-one.example', { status: 'chosen' })).statusCode).toBe(403);
    expect((await patch('/gaps/g1', { status: 'done' })).statusCode).toBe(403);
    expect((await post('/questions/approve', { keys: ['k0'] })).statusCode).toBe(403);
    expect((await post('/plan/a1/start', {})).statusCode).toBe(403);
    expect(st.sent).toEqual([]);
  });
  it('a member changes statuses; approving into the AI panel needs an admin, as the panel manager does', async () => {
    st.member = { [ORG_A]: 'member' };
    expect((await patch('/gaps/g1', { status: 'done' })).statusCode).toBe(200);
    expect((await post('/questions/approve', { keys: ['k0'] })).statusCode).toBe(403);
  });
  it('another company\'s website is 404, through its own company or through ours', async () => {
    expect((await get('', ORG_B, SITE_B)).statusCode).toBe(404);
    expect((await get('/keywords', ORG_A, SITE_B)).statusCode).toBe(404);
    expect((await get('/competitors', ORG_B, SITE_A)).statusCode).toBe(404);
  });
  it('an unverified website is refused before anything is read', async () => {
    SITES[SITE_A].verifiedAt = null;
    try {
      expect((await get()).statusCode).toBe(403);
    } finally {
      SITES[SITE_A].verifiedAt = new Date();
    }
  });
  it('rows of another domain are never shown, even when the engine returns them', async () => {
    st.leak = true;
    const k = json(await get('/keywords?page_size=200'));
    expect(k.total).toBe(40);
    expect(k.items.some((x: { keyword: string }) => /secret of b/.test(x.keyword))).toBe(false);
    expect(json(await get('/competitors')).items.map((c: { compDomain: string }) => c.compDomain)).not.toContain('b-only.example');
    expect(json(await get('/gaps')).items.map((g: { gapId: string }) => g.gapId)).not.toContain('gb');
    expect((await get('/keywords.csv')).body).not.toMatch(/secret of b/);
  });
});

describe('KI A1: keyword filters, sort and paging (server side)', () => {
  beforeEach(() => seed('on', { keywords: 600 }));
  it('the page size is bounded at 200 and the pages are counted', async () => {
    const r = json(await get('/keywords?page_size=500'));
    expect(r).toMatchObject({ total: 600, pageSize: 200, pages: 3, page: 1 });
    expect(r.items).toHaveLength(200);
    expect(json(await get('/keywords?page=3&page_size=200')).items).toHaveLength(200);
    expect(json(await get('/keywords?page=99&page_size=200')).page).toBe(3);
  });
  it('filters: verdict, stage, source, min volume, cluster, striking, text; facets over the whole market', async () => {
    const go = json(await get('/keywords?verdict=go&page_size=200'));
    expect(go.total).toBe(150);
    expect(go.items.every((x: { verdict: string }) => x.verdict === 'go')).toBe(true);
    expect(go.facets.verdict).toMatchObject({ go: 150, months: 150, hard: 150, gated: 150 });
    expect(json(await get('/keywords?stage=hire')).total).toBe(120);
    expect(json(await get('/keywords?source=gsc')).total).toBe(200);
    expect(json(await get('/keywords?min_volume=1500&page_size=200')).items.every((x: { volume: number }) => x.volume >= 1500)).toBe(true);
    expect(json(await get('/keywords?cluster=c7')).total).toBe(12);
    expect(json(await get('/keywords?striking=1')).total).toBe(60);
    expect(json(await get('/keywords?q=service%2012%20dubai')).total).toBe(1);
    expect(json(await get('/keywords?verdict=nonsense')).total).toBe(600);   // an unknown value is ignored, never an error
  });
  it('a gated keyword is always "Not for you", whatever the stored verdict says', async () => {
    st.tables.kiKeywords.push(kw('nova-a.example', 7000, { gate: 'fail', verdict: 'go', kw_key: 'kx' }));
    const r = json(await get('/keywords?q=service%207000'));
    expect(r.items[0]).toMatchObject({ verdict: 'gated', verdictLabel: 'Not for you', verdictTone: 'neutral' });
  });
  it('sorts: volume descending, keyword ascending, empty values last either way', async () => {
    const v = json(await get('/keywords?sort=-volume&page_size=50')).items.map((x: { volume: number }) => x.volume);
    expect(v).toEqual([...v].sort((a: number, b: number) => b - a));
    // 200 of the 600 have a Search Console position: they fill page 1 in both directions, the rest come after
    const posOf = async (q: string) => json(await get('/keywords' + q)).items.map((x: { gsc: { position: number } | null }) => x.gsc?.position ?? null);
    const up = await posOf('?sort=position&page_size=200');
    expect(up.every((p: number | null) => p !== null)).toBe(true);
    expect(up).toEqual([...up].sort((a: number, b: number) => a - b));
    expect((await posOf('?sort=-position&page_size=200')).every((p: number | null) => p !== null)).toBe(true);
    expect((await posOf('?sort=position&page_size=200&page=2')).every((p: number | null) => p === null)).toBe(true);
  });
  it('brand and non-brand split on the website\'s brand names and domain name', async () => {
    st.tables.kiKeywords.push(kw('nova-a.example', 8000, { keyword: 'nova alpha erp reviews', kw_key: 'kbrand' }), kw('nova-a.example', 8001, { keyword: 'nova-a login', kw_key: 'kbrand2' }));
    const b = json(await get('/keywords?brand=brand'));
    expect(b.items.map((x: { kwKey: string }) => x.kwKey).sort()).toEqual(['kbrand', 'kbrand2']);
    expect(json(await get('/keywords?brand=non_brand')).total).toBe(600);
  });
  it('the results page read is sent only when asked for (include=serp)', async () => {
    expect(json(await get('/keywords?page_size=1')).items[0].top10).toBeUndefined();
    expect(json(await get('/keywords?page_size=1&include=serp')).items[0].top10[0]).toMatchObject({ host: 'rival.example', pos: 1 });
  });
});

describe('KI A1: CSV', () => {
  it('every cell starting with = + - @ is neutralised; the basis and the date are columns', async () => {
    st.tables.kiKeywords = [kw('nova-a.example', 1, { keyword: '=HYPERLINK("http://x.example","y")' }), kw('nova-a.example', 2, { keyword: '+cmd', kw_key: 'k2' }), kw('nova-a.example', 3, { keyword: '@SUM(1)', kw_key: 'k3' }), kw('nova-a.example', 4, { keyword: '-2+3', kw_key: 'k4' })];
    const r = await get('/keywords.csv');
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="keywords-nova-a\.example-\d{4}-\d\d-\d\d\.csv"/);
    const lines = r.body.trim().split('\r\n');
    // FX-A (review UX M11): plain-word headers in the stable machine order of KI_KEYWORD_CSV_COLUMNS
    expect(lines[0]).toMatch(/^"Search","Market","For you",.*"How we know the searches".*"Updated on"$/);
    expect(lines[0].split(',').length).toBe(KI_KEYWORD_CSV_COLUMNS.length);
    for (const bad of ['=HYPERLINK', '+cmd', '@SUM', '-2+3']) {
      expect(r.body).not.toMatch(new RegExp(`(^|,)"\\${bad.charAt(0)}`, 'm'));
      expect(r.body).toContain(`"'${bad}`);
    }
    expect(r.body).toContain('estimate from Google Ads');
    expect(kiCsvLine(['=1', 'a"b'])).toBe('"\'=1","a""b"\r\n');
  });
  it('competitors and gaps download too', async () => {
    const c = await get('/competitors.csv');
    expect(c.body.split('\r\n')[0]).toMatch(/^"Website","Market","What it is",/);
    expect(c.body).toContain('rival-one.example');
    expect((await get('/gaps.csv')).body).toContain('"g1"');
  });
});

describe('KI A1: competitor and gap statuses', () => {
  it('the sixth chosen competitor is refused with 409 and nothing is sent; watch and dismiss still work', async () => {
    st.tables.kiCompetitors = [...Array.from({ length: 5 }, (_, i) => comp('nova-a.example', `c${i}.example`, { status: 'chosen', status_by: 'user' })), comp('nova-a.example', 'sixth.example')];
    const r = await patch('/competitors/sixth.example', { status: 'chosen' });
    expect(r.statusCode).toBe(409);
    expect(json(r)).toMatchObject({ code: 'ki_max_competitors' });
    expect(json(r).error).toMatch(/up to 5 competitors/);
    expect(st.sent).toEqual([]);
    expect(json(await patch('/competitors/sixth.example', { status: 'watch' }))).toMatchObject({ ok: true, status: 'watch', chosen: 5 });
    expect(st.sent[0]).toMatchObject({ action: 'ki_competitor', domain: 'nova-a.example', market: 'AE-en', comp_domain: 'sixth.example', status: 'watch' });
    // re-choosing one already chosen is not "one more"
    expect((await patch('/competitors/c0.example', { status: 'chosen' })).statusCode).toBe(200);
  });
  it('the website\'s own limit (ki_max_competitors) is the limit', async () => {
    seed('on', { maxComp: 1 });
    expect((await patch('/competitors/rival-one.example', { status: 'chosen' })).statusCode).toBe(200);
    expect((await patch('/competitors/rival-two.example', { status: 'chosen' })).statusCode).toBe(409);
  });
  it('a write empties the cache, so the next read shows it', async () => {
    expect(json(await get('/competitors')).chosen).toBe(0);
    await patch('/competitors/rival-one.example', { status: 'chosen' });
    expect(json(await get('/competitors')).chosen).toBe(1);
    expect(json(await get()).summary.competitors.confirmed).toBe(true);
  });
  it('unknown domain or gap: 404; a bad status: 400; an engine that refuses: 502', async () => {
    expect((await patch('/competitors/nobody.example', { status: 'chosen' })).statusCode).toBe(404);
    expect((await patch('/competitors/not_a_domain', { status: 'chosen' })).statusCode).toBe(404);
    expect((await patch('/gaps/zzz', { status: 'done' })).statusCode).toBe(404);
    expect((await patch('/competitors/rival-one.example', { status: 'mine' })).statusCode).toBe(400);
    expect((await patch('/gaps/g1', { status: 'won' })).statusCode).toBe(400);
    st.adminOk = false;
    expect((await patch('/gaps/g1', { status: 'done' })).statusCode).toBe(502);
  });
  it('a gap status goes to Site Admin ki_gap', async () => {
    expect(json(await patch('/gaps/g1', { status: 'dismissed' }))).toEqual({ ok: true, gapId: 'g1', status: 'dismissed' });
    expect(st.sent[0]).toMatchObject({ action: 'ki_gap', gap_id: 'g1', status: 'dismissed', domain: 'nova-a.example' });
  });
});

describe('KI A1: buyer questions into the AI question panel', () => {
  it('adds as many as the panel has room for, as the owner\'s own, and says why the rest were skipped', async () => {
    st.tables.kiKeywords = [
      kw('nova-a.example', 1, { keyword: 'how much does erp cost in dubai', kw_key: 'q1', stage: 'compare' }),
      kw('nova-a.example', 2, { keyword: 'what is the best erp for small business', kw_key: 'q2' }),
      kw('nova-a.example', 3, { keyword: 'erp dubai', kw_key: 'notq', gate: 'pass', verdict: 'go' }),
      kw('nova-a.example', 4, { keyword: 'how to choose a rival brand partner', kw_key: 'gated', gate: 'fail' }),
      kw('nova-a.example', 5, { keyword: 'which erp do accountants use', kw_key: 'onpanel' }),
    ];
    st.tables.aiPrompts = [
      ...Array.from({ length: 8 }, (_, i) => ({ domain: 'nova-a.example', prompt: `Own question number ${i}?`, source: 'custom', status: 'active' })),
      { domain: 'nova-a.example', prompt: 'Which erp do accountants use?', source: 'auto', status: 'active' },
    ];
    const r = json(await post('/questions/approve', { keys: ['q1', 'q2', 'notq', 'gated', 'onpanel', 'missing', 'q1'] }));
    expect(r.panelSize).toBe(10);
    expect(r.added).toEqual([{ kwKey: 'q1', question: 'How much does erp cost in dubai?' }, { kwKey: 'q2', question: 'What is the best erp for small business?' }]);
    expect(Object.fromEntries(r.skipped.map((s: { kwKey: string; reason: string }) => [s.kwKey, s.reason]))).toMatchObject({ notq: 'not_a_question', gated: 'gated', onpanel: 'already_on_panel', missing: 'not_found', q1: 'duplicate' });
    expect(r.ownOnPanel).toBe(10);
    expect(st.sent).toHaveLength(1);
    expect(st.sent[0]).toMatchObject({ action: 'ai_prompts', domain: 'nova-a.example' });
    expect((st.sent[0].add as Record<string, unknown>[])[0]).toEqual({ prompt: 'How much does erp cost in dubai?', persona: '', cluster: '', stage: 'decision', market: 'AE-en', pinned: false, keyword: 'how much does erp cost in dubai' });
    // the panel is full now: the next one is refused, and nothing is sent
    st.sent = [];
    st.tables.aiPrompts.push({ domain: 'nova-a.example', prompt: 'How much does erp cost in dubai?', source: 'custom', status: 'active' }, { domain: 'nova-a.example', prompt: 'X y z question here?', source: 'custom', status: 'active' });
    st.tables.kiKeywords.push(kw('nova-a.example', 6, { keyword: 'why do erp projects fail', kw_key: 'q3' }));
    kiCache.clear();
    expect(json(await post('/questions/approve', { keys: ['q3'] })).skipped).toEqual([{ kwKey: 'q3', reason: 'panel_full' }]);
    expect(st.sent).toEqual([]);
  });
  it('the request is bounded (1-30 keys)', async () => {
    expect((await post('/questions/approve', { keys: [] })).statusCode).toBe(400);
    expect((await post('/questions/approve', { keys: Array.from({ length: 31 }, (_, i) => `k${i}`) })).statusCode).toBe(400);
  });
});

describe('KI A1: plan start and the mode switch', () => {
  it('starting a plan step answers 501 with a plain sentence for now', async () => {
    const r = await post('/plan/act_1/start', {});
    expect(r.statusCode).toBe(501);
    expect(json(r)).toMatchObject({ code: 'not_available_yet' });
    expect(json(r).error).not.toMatch(/[—–…‘’“”]/);
  });
  it('only a platform admin switches it, and only ki_mode is written, then read back', async () => {
    const r = await patch('/mode', { mode: 'trial' });
    expect(r.statusCode).toBe(403);
    expect(st.sent).toEqual([]);
    st.platform = true;
    st.member = {};   // not a member of the company: still allowed (as the AI ranking trial)
    const ok = await app.inject({ method: 'PATCH', url: U('/mode', ORG_B, SITE_B), payload: { mode: 'trial' } });
    expect(ok.statusCode).toBe(200);
    expect(json(ok)).toEqual({ ok: true, mode: 'trial' });
    expect(st.sent).toHaveLength(1);
    expect(st.sent[0]).toMatchObject({ action: 'monitors', domain: 'nova-b.example', monitors: { ki_mode: 'trial' } });
    expect(Object.keys(st.sent[0].monitors as object)).toEqual(['ki_mode']);
  });
  it('an engine that did not keep it: 502; a bad mode: 400', async () => {
    st.platform = true;
    st.applyMonitors = false;
    expect((await app.inject({ method: 'PATCH', url: U('/mode', ORG_B, SITE_B), payload: { mode: 'off' } })).statusCode).toBe(502);
    expect((await app.inject({ method: 'PATCH', url: U('/mode', ORG_B, SITE_B), payload: { mode: 'shadow' } })).statusCode).toBe(400);
  });
});

describe('KI A1: recommendations, Needs you and API v1 follow the switch', () => {
  const siteA = SITES[SITE_A] as never;
  it('On: "Choose your competitors" until a person chose one, and the quick wins; Trial and Off: nothing', async () => {
    const k = await kiData.kiForRecs(siteA);
    expect(k).toMatchObject({ competitorsFound: 2, confirmed: false });
    const recs = kiData.kiRecommendations(k).map((x) => x.rec);
    expect(recs.map((r) => r.id)).toEqual(['ki:competitors', 'ki:quick-wins']);
    expect(recs[0].action).toEqual({ label: 'Choose competitors', page: 'competitors' });
    // FX-A (review CONSISTENCY M2): named and counted as the section it opens
    expect(recs[1].title).toMatch(/^\d+ search(es)? just off page one$/);
    for (const r of recs) expect(`${r.title} ${r.detail}`).not.toMatch(/[—–…‘’“”]/);
    const needs = kiData.kiNeedsYou(k);
    expect(needs.map((n) => [n.id, n.kind])).toEqual([['ki:competitors', 'ki'], ['ki:quick-wins', 'ki']]);
    for (const mode of ['trial', 'off', '']) {
      seed(mode);
      kiCache.clear();
      st.platform = true;   // even a platform admin's Trial adds nothing to the client's lists
      expect(await kiData.kiForRecs(siteA), mode).toBeNull();
    }
    expect(kiData.kiRecommendations(null)).toEqual([]);
    expect(kiData.kiNeedsYou(undefined)).toEqual([]);
  });
  it('API v1 get_table reads the KI tables for an On website only (Trial answers as an unknown table)', async () => {
    const page = <T,>(all: readonly T[]) => ({ items: all.slice(0, 100) as T[], nextCursor: null });
    const r = await kiData.kiTableRowsV1({ id: ORG_A }, SITES[SITE_A] as never, 'ki_keywords', {}, page);
    expect(r.items).toHaveLength(40);
    expect(r.items[0]).toMatchObject({ company_id: ORG_A, website_id: SITE_A, website_domain: 'nova-a.example', kw_key: 'k0' });
    expect(r.items[0]).not.toHaveProperty('id');
    seed('trial');
    st.platform = true;
    await expect(kiData.kiTableRowsV1({ id: ORG_A }, SITES[SITE_A] as never, 'ki_gaps', {}, page)).rejects.toMatchObject({ statusCode: 404 });
    expect(kiData.isKiV1Table('ki_runs')).toBe(true);
    expect(kiData.isKiV1Table('rank_history')).toBe(false);
  });
  it('the MCP get_table enum lists the four KI tables; the site delete clears them', () => {
    const v1 = readFileSync(join(__dirname, '../src/routes/apiV1.ts'), 'utf8');
    expect(v1).toMatch(/enum: \['rank_history', 'site_metrics', 'audit_findings', 'ai_visibility', 'backlinks', 'runs', 'ki_competitors', 'ki_keywords', 'ki_gaps', 'ki_runs'\]/);
    const sites = readFileSync(join(__dirname, '../src/routes/sites.ts'), 'utf8');
    const stop = sites.slice(sites.indexOf('async function stopInEngine'), sites.indexOf('async function stopInEngine') + 1200);
    expect(stop).toMatch(/await clearKiInEngine\(site\.domain, log\);/);
    expect(sites).toMatch(/KI_TABLES_CLEARED_ON_DELETE = \['kiCompetitors', 'kiKeywords', 'kiGaps', 'kiRuns'\]/);
  });
});

describe('KI A1: performance with 5,000 keywords', () => {
  it('p95 of a keyword page view stays well under 50 ms once the rows are read (one engine read per minute)', async () => {
    seed('on', { keywords: 5000 });
    const n8n = await import('../src/n8n/client');
    const reads = vi.mocked(n8n.siteRows);
    reads.mockClear();
    const queries = ['', '?verdict=go', '?sort=-volume&page=3', '?stage=hire&min_volume=500', '?q=service%2042', '?source=gsc&sort=position', '?striking=1', '?brand=non_brand&page_size=200', '?cluster=c3&sort=keyword', '?questions=1'];
    const t0 = performance.now();
    const cold = await get('/keywords');
    const coldMs = performance.now() - t0;
    expect(json(cold).total).toBe(5000);
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const s = performance.now();
      const r = await get('/keywords' + queries[i % queries.length]);
      times.push(performance.now() - s);
      expect(r.statusCode).toBe(200);
    }
    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    // one read of each KI table (+ the monitors row per request, which the client's own 60-second cache answers in production)
    const kiReads = reads.mock.calls.filter(([t]) => String(t).startsWith('ki'));
    expect(kiReads).toHaveLength(4);
    console.log(`KI keywords, 5,000 rows: cold ${coldMs.toFixed(1)} ms, warm p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms over ${times.length} requests`);
    expect(p95).toBeLessThan(50);
    // the summary of the overview is one request too
    const s = performance.now();
    expect(json(await get()).summary.keywords.total).toBe(5000);
    console.log(`KI overview, 5,000 rows (warm): ${(performance.now() - s).toFixed(2)} ms`);
    const c = performance.now();
    const csv = await get('/keywords.csv');
    console.log(`KI keywords CSV, 5,000 rows: ${(performance.now() - c).toFixed(1)} ms, ${(csv.body.length / 1024).toFixed(0)} KB`);
    expect(csv.body.split('\r\n').length).toBe(5002);
  });
});

describe('KI A1: the verdict words are the shared ones', () => {
  it('four verdicts', () => expect([...KI_VERDICT_IDS]).toEqual(['go', 'months', 'hard', 'gated']));
});
