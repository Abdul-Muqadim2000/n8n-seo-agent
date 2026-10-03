import { describe, expect, it } from 'vitest';
import { LADDER_SETTINGS_COLUMNS, type LadderRow, type LadderSettingsRow } from '@seo/shared';
import { HttpError } from '../src/lib/errors';
import { assertLadderOfSite, automationWrite, ladderOrder, ladderOrderWrites, ladderSettingsWrites, settingsData, wonWrite, type SettingsWrite } from '../src/services/ladderSettings';

const site = { domain: 'techand.ai' };
const NOW = '2026-10-03T12:00:00.000Z';
const lad = (ladder_id: string, start: string, o: Partial<LadderRow> = {}) =>
  [
    { ladder_id, domain: 'techand.ai', head_keyword: `${ladder_id} head`, keyword: `${ladder_id} page`, rung: 1, page_no: 1, start_date: start, status: 'planned', ...o },
    { ladder_id, domain: 'techand.ai', head_keyword: `${ladder_id} head`, keyword: `${ladder_id} head`, rung: 4, page_no: 2, start_date: start, status: 'planned', ...o },
  ] as LadderRow[];
const ladders = [...lad('lad_c', '2026-09-01'), ...lad('lad_a', '2026-07-01'), ...lad('lad_b', '2026-08-01')];
const row = (ladder_id: string, o: Partial<LadderSettingsRow> = {}) => ({ ladder_id, domain: 'techand.ai', mode: '', status: 'active', priority: null, ...o }) as unknown as LadderSettingsRow;

/** the settings after the writes (what n8n would hold) */
function applied(settings: LadderSettingsRow[], writes: SettingsWrite[]): LadderSettingsRow[] {
  const out = settings.map((r) => ({ ...r }));
  for (const w of writes) {
    const cur = out.find((r) => r.ladder_id === w.ladderId);
    if (cur) Object.assign(cur, w.data);
    else out.push(w.data as unknown as LadderSettingsRow);
  }
  return out;
}

describe('ladder settings: one ladder (PATCH)', () => {
  it('a ladder without a row gets a whole row: mode set, status active, the next priority — and so does each ladder ahead of it', () => {
    expect(ladderOrder(ladders, [])).toEqual(['lad_a', 'lad_b', 'lad_c']);
    const w = ladderSettingsWrites({ site, ladders, settings: [], ladderId: 'lad_b', change: { mode: 'manual' }, now: NOW });
    expect(w.map((x) => [x.ladderId, x.insert, x.data.priority, x.data.mode])).toEqual([
      ['lad_a', true, 1, ''],
      ['lad_b', true, 2, 'manual'],
    ]);
    expect(w[1].data).toEqual({
      ladder_id: 'lad_b',
      site_id: 'site_techand-ai',
      domain: 'techand.ai',
      head_keyword: 'lad_b head',
      mode: 'manual',
      status: 'active',
      plan_type: '',
      source: 'app',
      opportunities: '',
      auto_start: false,
      priority: 2,
      created_at: NOW,
      updated_at: NOW,
    });
    // the order the person sees does not change
    expect(ladderOrder(ladders, applied([], w))).toEqual(['lad_a', 'lad_b', 'lad_c']);
  });

  it('a ladder with a priority: only its changed columns', () => {
    const settings = [row('lad_a', { priority: 1 }), row('lad_b', { priority: 2, mode: 'auto' })];
    const w = ladderSettingsWrites({ site, ladders, settings, ladderId: 'lad_b', change: { status: 'paused' }, now: NOW });
    expect(w).toEqual([{ ladderId: 'lad_b', insert: false, data: { status: 'paused', updated_at: NOW } }]);
  });

  it('after the ladders that have a priority: the next numbers, the order kept', () => {
    const settings = [row('lad_c', { priority: 1 })];
    expect(ladderOrder(ladders, settings)).toEqual(['lad_c', 'lad_a', 'lad_b']);
    const w = ladderSettingsWrites({ site, ladders, settings, ladderId: 'lad_b', change: { status: 'paused' }, now: NOW });
    expect(w.map((x) => [x.ladderId, x.data.priority, x.data.status])).toEqual([
      ['lad_a', 2, 'active'],
      ['lad_b', 3, 'paused'],
    ]);
    expect(ladderOrder(ladders, applied(settings, w))).toEqual(['lad_c', 'lad_a', 'lad_b']);
  });

  it('only real columns go to n8n; never the app’s own fields', () => {
    expect(settingsData({ ladder_id: 'x', priority: 1, bogus: 1, mode: undefined })).toEqual({ ladder_id: 'x', priority: 1 });
    const names = new Set<string>(LADDER_SETTINGS_COLUMNS.map((c) => c.name));
    for (const w of ladderSettingsWrites({ site, ladders, settings: [], ladderId: 'lad_c', change: { mode: 'auto', status: 'active' }, now: NOW })) expect(Object.keys(w.data).every((k) => names.has(k))).toBe(true);
  });
});

describe('ladder settings: order, won, website defaults', () => {
  it('a new order: priorities 1..n, written only where they change', () => {
    const settings = [row('lad_a', { priority: 1 }), row('lad_b', { priority: 2 })];
    const w = ladderOrderWrites({ site, ladders, settings, ladderIds: ['lad_a', 'lad_c', 'lad_b'], now: NOW });
    expect(w.map((x) => [x.ladderId, x.insert, x.data.priority])).toEqual([
      ['lad_c', true, 2],
      ['lad_b', false, 3],
    ]);
    expect(ladderOrder(ladders, applied(settings, w))).toEqual(['lad_a', 'lad_c', 'lad_b']);
  });

  it('a new order must list every ladder of the website once', () => {
    for (const ids of [['lad_a', 'lad_b'], ['lad_a', 'lad_b', 'lad_c', 'lad_x'], ['lad_a', 'lad_b', 'lad_x']])
      expect(() => ladderOrderWrites({ site, ladders, settings: [], ladderIds: ids, now: NOW })).toThrow(HttpError);
  });

  it('won: recorded unless the person paused (or archived) the ladder, once', () => {
    expect(wonWrite({ site, ladders, settings: [], ladderId: 'lad_a', now: NOW })).toMatchObject({ insert: true, data: { ladder_id: 'lad_a', status: 'won', mode: '' } });
    expect(wonWrite({ site, ladders, settings: [row('lad_a', { priority: 1, mode: 'manual' })], ladderId: 'lad_a', now: NOW })).toEqual({ ladderId: 'lad_a', insert: false, data: { status: 'won', updated_at: NOW } });
    for (const status of ['paused', 'archived', 'won']) expect(wonWrite({ site, ladders, settings: [row('lad_a', { status })], ladderId: 'lad_a', now: NOW })).toBeNull();
  });

  it('website defaults: a new _site row holds every value; an existing one only the changes', () => {
    const n = automationWrite({ site, settings: [], change: { maxActiveLadders: 3 }, now: NOW });
    expect(n.insert).toBe(true);
    expect(n.automation).toEqual({ defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 3, maxWaiting: 3 });
    expect(n.data).toMatchObject({ ladder_id: '_site', site_id: 'site_techand-ai', domain: 'techand.ai', mode: 'auto', opportunities: 'auto', auto_start: false, max_active: 3, max_waiting: 3 });
    const e = automationWrite({ site, settings: [row('_site', { mode: 'manual', opportunities: 'auto', max_active: 2, max_waiting: 3 })], change: { opportunities: 'manual', maxWaiting: 5 }, now: NOW });
    expect([e.insert, e.data, e.automation]).toEqual([false, { opportunities: 'manual', max_waiting: 5, updated_at: NOW }, { defaultMode: 'manual', opportunities: 'manual', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 5 }]);
  });

  it('a ladder that is not one of the website’s is a 404', () => {
    expect(() => assertLadderOfSite(ladders, 'lad_a')).not.toThrow();
    for (const id of ['lad_other', '_site', '']) expect(() => assertLadderOfSite(ladders, id)).toThrow(expect.objectContaining({ statusCode: 404 }));
  });
});
