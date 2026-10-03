import { describe, expect, it } from 'vitest';
import type { ContentLogRow, LadderRow, LadderSettingsRow, QueryRow, RankHistoryRow, TrendRow } from '@seo/shared';
import { planCadence, simulateCadence, type CadenceInput } from '../src/services/cadence';
import { cadenceDetail, cadenceSchedule } from '../src/services/pipeline';

// The app's mirror of Cadence_Plan.js, checked against the same situations as the n8n harness (scenarios_v5.js S24): the expected
// picks are the ones n8n's own code produces there.

const NOW = Date.parse('2026-10-05T14:00:00Z');
const D = 'northwind-erp.com';
const daysAgo = (n: number) => new Date(NOW - n * 864e5).toISOString();
const slug = (k: string) => `https://www.northwind-erp.com/${k.replace(/\s+/g, '-')}/`;
type St = Partial<Record<'a' | 'b' | 'c' | 'd' | 'top', string>>;
/** [rung, page_no, keyword, status]; rung 4 is the main page */
const ladder = (id: string, head: string, pages: [number, number, string, string | undefined][], start: string) =>
  pages.map(
    ([rung, page_no, keyword, status]) =>
      ({ ladder_id: id, domain: D, head_keyword: head, rung, page_no, keyword, supporting: '', page_type: rung === 4 ? 'Pillar Page' : 'Guide', target_url: slug(keyword), page_exists: false, status: status || 'planned', months: '', start_date: start, country: 'United Arab Emirates' }) as LadderRow,
  );
const std = (id: string, h: string, start: string, st: St = {}) =>
  ladder(id, h, [[1, 1, `${h} cost`, st.a], [1, 2, `${h} guide`, st.b], [2, 3, `${h} software`, st.c], [3, 4, `${h} providers`, st.d], [4, 0, h, st.top]], start);
const A = (st?: St) => std('lad_A', 'peppol uae', '2026-07-01T00:00:00.000Z', st);
const B = (st?: St) => std('lad_B', 'vat software uae', '2026-08-01T00:00:00.000Z', st);
const C = (st?: St) => std('lad_C', 'wms dubai', '2026-09-01T00:00:00.000Z', st);
const W3: St = { a: 'writing', b: 'writing', c: 'writing' };
const set = (ladder_id: string, o: Partial<LadderSettingsRow> = {}) =>
  ({ ladder_id, site_id: 'site_northwind-erp-com', domain: D, head_keyword: '', mode: 'auto', priority: null, status: 'active', plan_type: '', reach: null, source: 'app', opportunities: '', auto_start: false, max_active: null, max_waiting: null, ...o }) as unknown as LadderSettingsRow;
const siteSet = (o: Partial<LadderSettingsRow>) => set('_site', { opportunities: 'auto', max_active: 2, max_waiting: 3, ...o } as Partial<LadderSettingsRow>);
/** newest first, weekly */
const ranks = (id: string, kw: string, positions: number[]) => positions.map((p, i) => ({ ladder_id: id, keyword: kw, checked_at: daysAgo(7 * i + 2), position: p, domain: D, rung: 4 }) as RankHistoryRow);
const logRow = (keyword: string, o: Partial<ContentLogRow> = {}) => ({ domain: D, keyword, source: 'ladder', ladder_id: '', request_id: 'cad_x', started_at: daysAgo(10), status: 'started', published_url: '', published_at: '', ...o }) as ContentLogRow;
const input = (o: Partial<CadenceInput>): CadenceInput => ({ domain: D, pagesPerWeek: 3, ladders: [], queries: [], trends: [], logs: [], settings: [], history: [], ...o });
const kws = (o: Partial<CadenceInput>) => planCadence(input(o), NOW).picks.map((p) => p.keyword);

describe('cadence mirror: ladder order and focus', () => {
  it('priority: ladder 1’s pages first, then ladder 2; written pages skipped; the main page waits for support', () => {
    const p = planCadence(input({ ladders: [...A(), ...B({ a: 'writing', b: 'writing' })], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1 })] }), NOW);
    expect(p.picks.map((x) => x.keyword)).toEqual(['vat software uae software', 'vat software uae providers', 'peppol uae cost']);
    expect(p.picks[0].ladder).toEqual({ id: 'lad_B', rung: 2, head: 'vat software uae', pageNo: 3 });
  });

  it('a paused ladder is not written and not queued', () => {
    const p = planCadence(input({ ladders: [...A(), ...B()], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1, status: 'paused' })] }), NOW);
    expect(p.picks.every((x) => x.ladder?.id === 'lad_A') && p.picks.length === 3).toBe(true);
    expect(p.queued).toEqual([]);
    expect(p.ladders.find((l) => l.id === 'lad_B')?.role).toBe('paused');
  });

  it('a Manual ladder is never written: its next page waits for approval', () => {
    const p = planCadence(input({ ladders: [...A(), ...B({ a: 'writing' })], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1, mode: 'manual' })] }), NOW);
    expect(p.picks.map((x) => x.ladder?.id)).toEqual(['lad_A', 'lad_A', 'lad_A']);
    expect(p.awaitingApproval.map((x) => [x.keyword, x.ladder?.id, x.ladder?.rung, x.ladder?.pageNo, x.pageType])).toEqual([['vat software uae guide', 'lad_B', 1, 2, 'Guide']]);
    // the website's default mode applies to ladders without a mode of their own
    const d = planCadence(input({ ladders: [...A(), ...B()], settings: [siteSet({ mode: 'manual' }), set('lad_B', { mode: '' })] }), NOW);
    expect([d.picks.length, d.awaitingApproval.map((x) => x.ladder?.id)]).toEqual([0, ['lad_A', 'lad_B']]);
  });

  it('at most max_active Auto ladders are written; the next waits as queued; a fully written ladder frees its place', () => {
    const p = planCadence(input({ ladders: [...A(W3), ...B(W3), ...C()] }), NOW);
    expect(p.picks.map((x) => x.keyword)).toEqual(['peppol uae providers', 'vat software uae providers']);
    expect(p.queued).toEqual(['lad_C']);
    expect(kws({ ladders: [...A(W3), ...B(W3), ...C()], settings: [siteSet({ max_active: 3 })] })).toEqual(['peppol uae providers', 'vat software uae providers', 'wms dubai cost']);
    const free = planCadence(input({ ladders: [...A({ ...W3, d: 'writing', top: 'writing' }), ...B(W3), ...C()] }), NOW);
    expect([free.picks.map((x) => x.keyword), free.queued]).toEqual([['vat software uae providers', 'wms dubai cost', 'wms dubai guide'], []]);
  });

  it('no settings: the oldest ladder first', () => {
    expect(kws({ ladders: [...B(), ...A()] })).toEqual(['peppol uae cost', 'peppol uae guide', 'peppol uae software']);
  });

  it('a Direct plan writes the main page first', () => {
    expect(kws({ ladders: A(), settings: [set('lad_A', { plan_type: 'direct' })] })[0]).toBe('peppol uae');
  });
});

describe('cadence mirror: main-page gate and won', () => {
  const gated = A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' });
  it('1 of 4 supporting pages published: the main page is not written, the ladder waits for support', () => {
    const p = planCadence(input({ ladders: gated }), NOW);
    expect([p.picks, p.waitingForSupport]).toEqual([[], ['lad_A']]);
    expect(cadenceDetail([], { ...p, at: '' }, { cards: [{ id: 'lad_A', head: 'peppol uae' } as never] })).toBe(
      'Nothing to write automatically: the main page of “peppol uae” waits until half of its supporting pages are live',
    );
  });
  it('half published (ladder row + content log), or the main keyword in the top 30: the main page is written', () => {
    expect(kws({ ladders: gated, logs: [logRow('peppol uae guide', { status: 'published', published_url: slug('peppol uae guide'), published_at: daysAgo(5) })] })).toEqual(['peppol uae']);
    expect(kws({ ladders: gated, history: ranks('lad_A', 'peppol uae', [25, 60]) })).toEqual(['peppol uae']);
    // a failed check (-1) is skipped; the latest valid check decides
    expect(kws({ ladders: gated, history: ranks('lad_A', 'peppol uae', [-1, 25]) })).toEqual(['peppol uae']);
    expect(kws({ ladders: gated, history: ranks('lad_A', 'peppol uae', [45, 25]) })).toEqual([]);
  });
  it('won: the main keyword in the top 3 in the last 4 checks (or status won) → no more pages, the place is freed', () => {
    const p = planCadence(input({ ladders: [...A(), ...B()], history: ranks('lad_A', 'peppol uae', [2, 1, 3, 2]) }), NOW);
    expect([p.picks.every((x) => x.ladder?.id === 'lad_B'), p.picks.length, p.won]).toEqual([true, 3, ['lad_A']]);
    expect(planCadence(input({ ladders: [...A(), ...B()], history: ranks('lad_A', 'peppol uae', [2, 1, 3, 5]) }), NOW).picks[0].ladder?.id).toBe('lad_A');
    const st = planCadence(input({ ladders: [...A(), ...B()], settings: [set('lad_A', { status: 'won' })] }), NOW);
    expect([st.won, st.picks[0].ladder?.id]).toEqual([['lad_A'], 'lad_B']);
    // 'stuck' (display only in the app) would stop the writing in n8n: the app never writes it
    expect(kws({ ladders: A(), settings: [set('lad_A', { status: 'stuck' })] })).toEqual([]);
  });
});

describe('cadence mirror: pile-up guard and opportunity posts', () => {
  const waiting3 = ['x one', 'x two', 'x three'].map((k, i) => logRow(k, { started_at: daysAgo(10 + 10 * i) }));
  it('3 pages waiting → nothing is written (paused_reason pileup); older than 120 days does not count; the limit from the _site row', () => {
    const p = planCadence(input({ ladders: A(), logs: waiting3 }), NOW);
    expect([p.picks, p.pausedReason, p.waitingPublish, p.candidates.length]).toEqual([[], 'pileup', 3, 4]);
    expect(cadenceDetail([], { ...p, at: '' }, { cards: [] })).toBe('Writes nothing: 3 pages wait to be published (your limit is 3). Publish them to continue');
    expect(kws({ ladders: A(), logs: [...waiting3.slice(0, 2), logRow('x old', { started_at: daysAgo(130) })] })).toHaveLength(3);
    expect(kws({ ladders: A(), logs: waiting3, settings: [siteSet({ max_waiting: 5 })] })).toHaveLength(3);
    // weekly posts off: the website is skipped, no guard either
    const off = planCadence(input({ ladders: A(), logs: waiting3, pagesPerWeek: 0 }), NOW);
    expect([off.picks, off.pausedReason, off.candidates.length]).toEqual([[], '', 4]);
  });

  const queries = [
    { domain: D, period_end: '2026-09-27', query: 'erp for distributors', position: 8, impressions: 120, page: 'https://www.northwind-erp.com/erp/' },
    { domain: D, period_end: '2026-09-27', query: 'northwind erp login', position: 5, impressions: 400, page: '' },
    { domain: D, period_end: '2026-09-27', query: 'erp pricing uae', position: 12, impressions: 60, page: 'https://www.northwind-erp.com/blog/pricing/' },
    { domain: D, period_end: '2026-09-20', query: 'old query', position: 6, impressions: 900, page: '' },
  ] as QueryRow[];
  const trends = [{ domain: D, keyword: 'erp', checked_at: '2026-09-28T09:00:00Z', direction: 'rising', change_pct: 40, rising: 'cloud erp uae (+250%), erp for distributors' }] as TrendRow[];
  it('opportunities Auto: striking distance by impressions (no brand queries, latest period), then rising searches', () => {
    const p = planCadence(input({ queries, trends }), NOW);
    expect(p.picks.map((x) => [x.keyword, x.source, x.pageType])).toEqual([
      ['erp for distributors', 'striking', 'Service Page'],
      ['erp pricing uae', 'striking', 'Guide'],
      ['cloud erp uae', 'trend', 'Guide'],
    ]);
  });
  it('opportunities Manual: nothing written, the same posts become suggestions; ladder pages still written', () => {
    const p = planCadence(input({ queries, trends, settings: [siteSet({ opportunities: 'manual' })] }), NOW);
    expect([p.picks, p.suggestions.map((x) => x.keyword)]).toEqual([[], ['erp for distributors', 'erp pricing uae', 'cloud erp uae']]);
    const l = planCadence(input({ ladders: A(), queries, trends, settings: [siteSet({ opportunities: 'manual' })] }), NOW);
    expect(l.picks.every((x) => x.source === 'ladder') && l.suggestions.length === 3).toBe(true);
  });
});

describe('cadence mirror: the coming Mondays', () => {
  const runs = ['2026-10-05T14:00:00.000Z', '2026-10-12T14:00:00.000Z', '2026-10-19T14:00:00.000Z', '2026-10-26T14:00:00.000Z'];
  it('each run’s pages count as written for the next run, until the pile-up guard stops the writing', () => {
    const weeks = simulateCadence(input({ ladders: A(), pagesPerWeek: 1, logs: [logRow('x one')] }), runs, NOW);
    expect(weeks.map((w) => [w.at.slice(0, 10), w.picks.map((p) => p.keyword), w.pausedReason])).toEqual([
      ['2026-10-05', ['peppol uae cost'], ''],
      ['2026-10-12', ['peppol uae guide'], ''],
      ['2026-10-19', [], 'pileup'],
      ['2026-10-26', [], 'pileup'],
    ]);
    const s = cadenceSchedule(weeks, true);
    expect(s.dated.map((d) => [d.at.slice(0, 10), d.item.keyword])).toEqual([
      ['2026-10-05', 'peppol uae cost'],
      ['2026-10-12', 'peppol uae guide'],
    ]);
    expect([s.plan?.pileup, s.plan?.nextOf.get('lad_A')?.keyword]).toEqual([false, 'peppol uae cost']);
    // weekly posts off: nothing dated
    expect(cadenceSchedule(simulateCadence(input({ ladders: A(), pagesPerWeek: 0 }), [], NOW), false).dated).toEqual([]);
  });
});
