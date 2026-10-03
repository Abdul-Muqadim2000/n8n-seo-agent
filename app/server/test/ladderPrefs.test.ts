import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUN_SCHEMAS, type LadderRow, type LadderSettingsRow } from '@seo/shared';

// The choices of the "New keyword ladder" flow (Auto / Manual, "write it first") are kept with the run and applied when its plan
// arrives (ladder_plan callback) through the ladder settings: refused plans and other callbacks change nothing; members cannot set
// them.

const n8n = vi.hoisted(() => ({
  ladders: [] as LadderRow[],
  settings: [] as LadderSettingsRow[],
  upserts: [] as { filters: { value: unknown }[]; data: Record<string, unknown> }[],
}));
vi.mock('../src/n8n/client', () => ({
  siteRows: vi.fn(async (table: string) => (table === 'ladders' ? n8n.ladders : table === 'ladderSettings' ? n8n.settings : [])),
  upsertRow: vi.fn(async (_t: string, filters: { value: unknown }[], data: Record<string, unknown>) => void n8n.upserts.push({ filters, data })),
  ensureTable: vi.fn(async () => 'tbl'),
  deleteRows: vi.fn(),
  insertRows: vi.fn(),
  updateRows: vi.fn(),
  invalidateSite: vi.fn(),
  startRun: vi.fn(),
  rows: vi.fn(async () => []),
}));

const { ladderPrefsOf, inputForRole } = await import('../src/services/runs');
const { applyLadderPrefs, ladderPrefsWrites } = await import('../src/services/ladderSettings');

const SITE = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const run = (prefs?: unknown) => ({ mode: 'ladder', input: { mode: 'ladder', keyword: 'odoo partner uae', ...(prefs !== undefined ? { ladderPrefs: prefs } : {}) } });
const plan = (o: Record<string, unknown> = {}) => ({ stage: 'ladder_plan', ladder_id: 'lad_new', planned: true, plan_type: 'short', ...o });

const lad = (ladder_id: string, start: string) =>
  [
    { ladder_id, domain: 'techand.ai', head_keyword: `${ladder_id} head`, keyword: `${ladder_id} page`, rung: 1, page_no: 1, start_date: start, status: 'planned' },
    { ladder_id, domain: 'techand.ai', head_keyword: `${ladder_id} head`, keyword: `${ladder_id} head`, rung: 4, page_no: 2, start_date: start, status: 'planned' },
  ] as LadderRow[];
const row = (ladder_id: string, o: Partial<LadderSettingsRow> = {}) => ({ ladder_id, domain: 'techand.ai', mode: '', status: 'active', priority: null, ...o }) as unknown as LadderSettingsRow;
const site = { id: 'site-1', domain: 'techand.ai', verifiedAt: new Date() } as never;
const NOW = '2026-10-03T12:00:00.000Z';

beforeEach(() => {
  n8n.ladders = [...lad('lad_a', '2026-07-01'), ...lad('lad_b', '2026-08-01'), ...lad('lad_new', '2026-10-03')];
  // as n8n writes them: existing ladders got priorities 1-2, the new one the next number with the website's default mode
  n8n.settings = [row('lad_a', { priority: 1 }), row('lad_b', { priority: 2, mode: 'manual' }), row('lad_new', { priority: 3, mode: 'auto', source: 'ladder' })];
  n8n.upserts = [];
});

describe('ladder_plan callback → the flow’s choices', () => {
  it('only the plan of a ladder run with choices, when pages were planned', () => {
    expect(ladderPrefsOf('ladder_plan', plan(), run({ mode: 'manual', first: true }))).toEqual({ ladderId: 'lad_new', prefs: { mode: 'manual', first: true } });
    // refused: a duplicate or a keyword that is not realistic
    expect(ladderPrefsOf('ladder_plan', plan({ planned: false, refusal: { reason: 'duplicate', ladder_id: 'lad_a' } }), run({ first: true }))).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan({ planned: 'false' }), run({ first: true }))).toBeNull();
    // other stages, other modes, no choices, bad ids
    expect(ladderPrefsOf('content', plan(), run({ first: true }))).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), { mode: 'keyword', input: { ladderPrefs: { first: true } } })).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), run())).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), run({}))).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), run({ first: false }))).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), run({ mode: 'sometimes' }))).toBeNull();
    expect(ladderPrefsOf('ladder_plan', plan(), null)).toBeNull();
    for (const ladder_id of ['', '_site', '../x', 42]) expect(ladderPrefsOf('ladder_plan', plan({ ladder_id }), run({ first: true }))).toBeNull();
    // a v4.7 plan without `planned` still counts as planned
    expect(ladderPrefsOf('ladder_plan', { stage: 'ladder_plan', ladder_id: 'lad_new' }, run({ mode: 'auto' }))?.prefs).toEqual({ mode: 'auto' });
  });

  it('"write it first": the new ladder becomes 1, the others keep their order behind it; one write per ladder', () => {
    const w = ladderPrefsWrites({ site: { domain: 'techand.ai' }, ladders: n8n.ladders, settings: n8n.settings, ladderId: 'lad_new', prefs: { first: true, mode: 'manual' }, now: NOW });
    expect(w.map((x) => [x.ladderId, x.insert, x.data.priority, x.data.mode])).toEqual([
      ['lad_new', false, 1, 'manual'],
      ['lad_a', false, 2, undefined],
      ['lad_b', false, 3, undefined],
    ]);
  });

  it('only the mode: one write, the order stays', () => {
    const w = ladderPrefsWrites({ site: { domain: 'techand.ai' }, ladders: n8n.ladders, settings: n8n.settings, ladderId: 'lad_new', prefs: { mode: 'manual' }, now: NOW });
    expect(w).toEqual([{ ladderId: 'lad_new', insert: false, data: { mode: 'manual', updated_at: NOW } }]);
  });

  it('no settings rows yet (older n8n): whole rows, priorities that put the new ladder first', () => {
    const w = ladderPrefsWrites({ site: { domain: 'techand.ai' }, ladders: n8n.ladders, settings: [], ladderId: 'lad_new', prefs: { first: true }, now: NOW });
    expect(w.map((x) => [x.ladderId, x.insert, x.data.priority, x.data.mode, x.data.status])).toEqual([
      ['lad_new', true, 1, '', 'active'],
      ['lad_a', true, 2, '', 'active'],
      ['lad_b', true, 3, '', 'active'],
    ]);
  });

  it('applyLadderPrefs writes the website’s rows only; nothing when the ladder has no rows (refused or not stored)', async () => {
    expect(await applyLadderPrefs(site, 'lad_new', { first: true })).toBe(true);
    expect(n8n.upserts.map((u) => [u.filters.map((f) => f.value), u.data.priority])).toEqual([
      [['lad_new', 'techand.ai'], 1],
      [['lad_a', 'techand.ai'], 2],
      [['lad_b', 'techand.ai'], 3],
    ]);
    n8n.upserts = [];
    expect(await applyLadderPrefs(site, 'lad_gone', { first: true, mode: 'manual' })).toBe(false);
    expect(n8n.upserts).toEqual([]);
  });
});

describe('who may set them', () => {
  const input = RUN_SCHEMAS.ladder.parse({ mode: 'ladder', siteId: SITE, keyword: 'odoo partner uae', country: 'United Arab Emirates', ladderPrefs: { mode: 'manual', first: true } });
  it('admins and owners keep them; members and below lose them (the website’s defaults apply)', () => {
    expect((inputForRole(input, 'admin') as typeof input).ladderPrefs).toEqual({ mode: 'manual', first: true });
    expect((inputForRole(input, 'owner') as typeof input).ladderPrefs).toEqual({ mode: 'manual', first: true });
    expect((inputForRole(input, 'member') as typeof input).ladderPrefs).toBeUndefined();
    expect(inputForRole(input, 'member')).toMatchObject({ keyword: 'odoo partner uae', pagesNow: 1 });
  });
});
