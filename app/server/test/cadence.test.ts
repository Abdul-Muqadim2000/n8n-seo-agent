import { describe, expect, it } from 'vitest';
import type { AiTargetRow, ContentLogRow, LadderRow, LadderSettingsRow, QueryRow, RankHistoryRow, SitePageRow, TrendRow } from '@seo/shared';
import { matchPage, planCadence, simulateCadence, type CadenceInput } from '../src/services/cadence';
import { cadenceDetail, cadenceSchedule } from '../src/services/pipeline';

// The app's mirror of Cadence_Plan.js, checked against the same situations as the n8n harness (scenarios_v5.js S24): the expected
// picks are the ones n8n's own code produces there. Keyword-first (2026-10-19): the ladders here have no `chosen_by` (a ladder from before
// the column, or one started through the API: the client's own), so they are written at every level; what else is written on its own
// depends on the website's autopilot level (`L3` below = full autopilot). The keyword-first rules themselves are held to the engine by the
// shared fixture (cadenceLevels.test.ts, 36 cases).

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
// v4.14 (FIX_PLAN D5): ladder rows still 'writing' are pages waiting to be published, so three or more of them trip the pile-up
// guard. Cases about something else (focus, the main-page gate) raise the website's limit; the guard has its own cases below.
const noGuard = [siteSet({ max_waiting: 20 })];
/** full autopilot: every source the fit gate lets through is written on its own (the old "opportunities Auto") */
const L3 = (o: Partial<LadderSettingsRow> = {}) => [siteSet({ autopilot_level: 3, ...o } as Partial<LadderSettingsRow>)];
/** newest first, weekly */
const ranks = (id: string, kw: string, positions: number[]) => positions.map((p, i) => ({ ladder_id: id, keyword: kw, checked_at: daysAgo(7 * i + 2), position: p, domain: D, rung: 4 }) as RankHistoryRow);
const logRow = (keyword: string, o: Partial<ContentLogRow> = {}) => ({ domain: D, keyword, source: 'ladder', ladder_id: '', request_id: 'cad_x', started_at: daysAgo(10), status: 'written', published_url: '', published_at: '', ...o }) as ContentLogRow;   // R1 (2026-10-13): a page waits for publication only once the log row says `written`
const input = (o: Partial<CadenceInput>): CadenceInput => ({ domain: D, pagesPerWeek: 3, ladders: [], queries: [], trends: [], logs: [], settings: [], history: [], ...o });
const kws = (o: Partial<CadenceInput>) => planCadence(input(o), NOW).picks.map((p) => p.keyword);

describe('cadence mirror: ladder order and focus', () => {
  it('priority: ladder 1\'s pages first, then ladder 2; written pages skipped; the main page waits for support', () => {
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
    const p = planCadence(input({ ladders: [...A(W3), ...B(W3), ...C()], settings: noGuard }), NOW);
    expect(p.picks.map((x) => x.keyword)).toEqual(['peppol uae providers', 'vat software uae providers']);
    expect(p.queued).toEqual(['lad_C']);
    expect(kws({ ladders: [...A(W3), ...B(W3), ...C()], settings: [siteSet({ max_active: 3, max_waiting: 20 })] })).toEqual(['peppol uae providers', 'vat software uae providers', 'wms dubai cost']);
    const free = planCadence(input({ ladders: [...A({ ...W3, d: 'writing', top: 'writing' }), ...B(W3), ...C()], settings: noGuard }), NOW);
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
    const p = planCadence(input({ ladders: gated, settings: noGuard }), NOW);
    expect([p.picks, p.waitingForSupport]).toEqual([[], ['lad_A']]);
    expect(cadenceDetail([], { ...p, at: '', cycleKey: '' }, { cards: [{ id: 'lad_A', head: 'peppol uae' } as never] })).toBe(
      'Nothing to write automatically: the main page of "peppol uae" waits until half of its supporting pages are live',
    );
  });
  it('half published (ladder row + content log), or the main keyword in the top 30: the main page is written', () => {
    expect(kws({ ladders: gated, settings: noGuard, logs: [logRow('peppol uae guide', { status: 'published', published_url: slug('peppol uae guide'), published_at: daysAgo(5) })] })).toEqual(['peppol uae']);
    expect(kws({ ladders: gated, settings: noGuard, history: ranks('lad_A', 'peppol uae', [25, 60]) })).toEqual(['peppol uae']);
    // a failed check (-1) is skipped; the latest valid check decides
    expect(kws({ ladders: gated, settings: noGuard, history: ranks('lad_A', 'peppol uae', [-1, 25]) })).toEqual(['peppol uae']);
    expect(kws({ ladders: gated, settings: noGuard, history: ranks('lad_A', 'peppol uae', [45, 25]) })).toEqual([]);
  });
  it('won: the main keyword in the top 3 in the last 4 checks (or status won) gives no more pages, the place is freed', () => {
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
  it('3 pages waiting gives nothing is written (paused_reason pileup); older than 120 days does not count; the limit from the _site row', () => {
    const p = planCadence(input({ ladders: A(), logs: waiting3 }), NOW);
    expect([p.picks, p.pausedReason, p.waitingPublish, p.candidates.length]).toEqual([[], 'pileup', 3, 4]);
    expect(cadenceDetail([], { ...p, at: '', cycleKey: '' }, { cards: [] })).toBe(
      'Writes nothing: 3 written pages waiting for publication (pile-up guard, limit 3): "x three", "x two", "x one". Publish them to continue',
    );
    expect(kws({ ladders: A(), logs: [...waiting3.slice(0, 2), logRow('x old', { started_at: daysAgo(130) })] })).toHaveLength(3);
    expect(kws({ ladders: A(), logs: waiting3, settings: [siteSet({ max_waiting: 5 })] })).toHaveLength(3);
    // pages a week 0: the old batch run skips the website, no guard either; a cycle run of it still reports the guard (the engine's rule)
    const off = planCadence(input({ ladders: A(), logs: waiting3, pagesPerWeek: 0 }), NOW, { kind: 'batch' });
    expect([off.picks, off.pausedReason, off.candidates.length]).toEqual([[], '', 0]);
    const offCycle = planCadence(input({ ladders: A(), logs: waiting3, pagesPerWeek: 0 }), NOW);
    expect([offCycle.picks, offCycle.pausedReason, offCycle.reason]).toEqual([[], 'pileup', '3 written pages are waiting to be published (limit 3): nothing new is written until they are']);
  });

  // ---- v4.14 (FIX_PLAN D5): pages written by a keyword ladder count too (they reached the content log only from v4.14 on) ----
  it('D5: 2 content-log rows + 2 ladder rows "writing" are 4 pages waiting at a limit of 3 gives nothing is written, and they are named', () => {
    const p = planCadence(input({ ladders: A({ a: 'writing', b: 'writing' }), logs: [logRow('erp pricing uae'), logRow('erp for distributors'), logRow('peppol uae cost', { started_at: daysAgo(20) }), logRow('peppol uae guide', { started_at: daysAgo(19) })] }), NOW);
    expect([p.picks, p.pausedReason, p.waitingPublish]).toEqual([[], 'pileup', 4]);
    expect([...p.waitingKeywords].sort()).toEqual(['erp for distributors', 'erp pricing uae', 'peppol uae cost', 'peppol uae guide']);
    expect(cadenceDetail([], { ...p, at: '', cycleKey: '' }, { cards: [] })).toBe(
      'Writes nothing: 4 written pages waiting for publication (pile-up guard, limit 3): "peppol uae cost", "peppol uae guide", "erp pricing uae", "erp for distributors". Publish them to continue',
    );
    // the same website is written again once its limit allows it: the guard stopped it, not the ladder
    expect(kws({ ladders: A({ a: 'writing', b: 'writing' }), logs: [logRow('erp pricing uae'), logRow('erp for distributors'), logRow('peppol uae cost', { started_at: daysAgo(20) }), logRow('peppol uae guide', { started_at: daysAgo(19) })], settings: [siteSet({ max_waiting: 5 })] })).toEqual([
      'peppol uae software',
      'peppol uae providers',
    ]);
  });

  it('D5 / R1: a page in the content log and on its ladder row counts once; published pages never count; only "written" waits', () => {
    const both = planCadence(input({ ladders: A({ a: 'writing', b: 'writing' }), logs: [logRow('peppol uae cost', { status: 'written' }), logRow('peppol uae guide', { status: 'written' })] }), NOW);
    expect([both.waitingPublish, both.pausedReason, [...both.waitingKeywords].sort()]).toEqual([2, '', ['peppol uae cost', 'peppol uae guide']]);
    const published = ['peppol uae cost', 'peppol uae guide', 'peppol uae software'].map((k) => logRow(k, { status: 'published', published_url: slug(k), published_at: daysAgo(3) }));
    expect(planCadence(input({ ladders: A({ a: 'published', b: 'published', c: 'published' }), logs: published }), NOW).waitingPublish).toBe(0);
    // a ladder row left on 'writing' whose page is live (the content log has the address) does not count either
    expect(planCadence(input({ ladders: A({ a: 'writing', b: 'writing', c: 'writing' }), logs: published }), NOW).waitingPublish).toBe(0);
  });

  // R1 (2026-10-13, the re-rating run): a budget-refused page run left row 19 saying `writing` with a `started` log row, and this guard
  // counted it among 6 pages waiting and paused the website for a week. `written` in the content log is the only proof of a page.
  it('R1: a ladder row "writing" whose log row only says "started" is no page waiting, the website keeps writing', () => {
    const promised = planCadence(input({ pagesPerWeek: 1, ladders: A({ a: 'writing' }), logs: [logRow('peppol uae cost', { status: 'started' })] }), NOW);
    expect([promised.waitingPublish, promised.pausedReason, promised.waitingKeywords]).toEqual([0, '', []]);
    expect(promised.picks.map((x) => x.keyword)).toEqual(['peppol uae guide']);
    const written = planCadence(input({ pagesPerWeek: 1, ladders: A({ a: 'writing' }), logs: [logRow('peppol uae cost', { status: 'written' })], settings: [siteSet({ max_waiting: 1 })] }), NOW);
    expect([written.waitingPublish, written.pausedReason, written.waitingKeywords]).toEqual([1, 'pileup', ['peppol uae cost']]);
  });

  it('D5: nothing older than 120 days waits; a content-log row dates an older ladder\'s page', () => {
    const old = planCadence(input({ ladders: std('lad_O', 'wms dubai', daysAgo(200), { a: 'writing', b: 'writing', c: 'writing' }), logs: [logRow('erp pricing uae', { started_at: daysAgo(130) })] }), NOW);
    expect([old.waitingPublish, old.pausedReason]).toEqual([0, '']);
    const dated = planCadence(input({ ladders: std('lad_O', 'wms dubai', daysAgo(200), { a: 'writing' }), logs: [logRow('wms dubai cost', { started_at: daysAgo(9) })] }), NOW);
    expect([dated.waitingPublish, dated.waitingKeywords]).toEqual([1, ['wms dubai cost']]);
  });

  const queries = [
    { domain: D, period_end: '2026-09-27', query: 'erp for distributors', position: 8, impressions: 120, page: 'https://www.northwind-erp.com/erp/' },
    { domain: D, period_end: '2026-09-27', query: 'northwind erp login', position: 5, impressions: 400, page: '' },
    { domain: D, period_end: '2026-09-27', query: 'erp pricing uae', position: 12, impressions: 60, page: 'https://www.northwind-erp.com/blog/pricing/' },
    { domain: D, period_end: '2026-09-20', query: 'old query', position: 6, impressions: 900, page: '' },
  ] as QueryRow[];
  const trends = [{ domain: D, keyword: 'erp', checked_at: '2026-09-28T09:00:00Z', direction: 'rising', change_pct: 40, rising: 'cloud erp uae (+250%), erp for distributors' }] as TrendRow[];
  it('full autopilot (level 3): striking distance by impressions (no brand queries, latest period), then rising searches', () => {
    const p = planCadence(input({ queries, trends, settings: L3() }), NOW);
    expect(p.picks.map((x) => [x.keyword, x.source, x.pageType])).toEqual([
      ['erp for distributors', 'striking', 'Service Page'],
      ['erp pricing uae', 'striking', 'Guide'],
      ['cloud erp uae', 'trend', 'Guide'],
    ]);
    expect(p.picks.every((x) => x.auto && x.itemKey === x.keyword)).toBe(true);
  });
  it('level 2 (the default) with no keyword chosen: nothing written, the same searches are suggestions with their price', () => {
    const p = planCadence(input({ queries, trends }), NOW);
    expect([p.waitingForKeyword, p.picks, p.suggestions.map((x) => x.keyword)]).toEqual([true, [], ['erp for distributors', 'erp pricing uae', 'cloud erp uae']]);
    expect(p.suggestions.every((x) => x.auto === false && x.estUsd > 0)).toBe(true);
    expect(p.reason).toMatch(/^waiting for your first keyword/);
  });
  it('a stored "opportunities: auto" or "manual" decides nothing any more (R-K3): the level does', () => {
    for (const opportunities of ['auto', 'manual']) {
      const l = planCadence(input({ ladders: A(), queries, trends, settings: [siteSet({ opportunities })] }), NOW);
      expect(l.picks.every((x) => x.source === 'ladder') && l.suggestions.length === 3).toBe(true);
    }
    // level 1: the ladder pages only, everything else waits for an OK
    const l1 = planCadence(input({ ladders: A(), queries, trends, settings: [siteSet({ autopilot_level: 1 } as Partial<LadderSettingsRow>)] }), NOW);
    expect([l1.level, l1.picks.map((x) => x.source), l1.suggestions.length]).toEqual([1, ['ladder', 'ladder', 'ladder'], 3]);
  });
});

describe('cadence mirror: the coming Mondays', () => {
  const runs = ['2026-10-05T14:00:00.000Z', '2026-10-12T14:00:00.000Z', '2026-10-19T14:00:00.000Z', '2026-10-26T14:00:00.000Z'];
  it('each run\'s pages count as written for the next run, until the pile-up guard stops the writing', () => {
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

// v4.12 (AI_GROWTH_SPEC.md): the AI page of the week, the same rules as Cadence_Plan.js (harness S29 (g))
describe('cadence mirror: the AI page of the week (written on its own at level 3 only)', () => {
  const target = (o: Partial<AiTargetRow> & { tid: string }) =>
    ({ target_id: 'ait_x_' + o.tid, site_id: 'site_northwind-erp-com', domain: D, prompt_id: '', question: o.question ?? 'Which companies help UAE businesses with e-invoicing?', keyword: o.keyword ?? 'e invoicing in uae', kind: o.kind ?? 'answer', page_url: o.page_url ?? '', page_type: 'Guide',
      fanout: 'a | b', sources_json: '[]', competitors: 'zoho.com, cleartax.com', engines: '', stage: 'decision', value: o.value ?? 1, status: o.status ?? 'queued', reason: '', created_at: '', updated_at: '', request_id: '', written_at: '', won_at: '' }) as AiTargetRow;
  const T = [target({ tid: '1', keyword: 'odoo vs business central uae', value: 2.1 }), target({ tid: '2', kind: 'refresh', page_url: slug('e invoicing uae'), value: 3.4 })];
  it('the most valuable queued target is written next to the weekly pages (a refresh of the page AI cited)', () => {
    const p = planCadence(input({ pagesPerWeek: 1, ladders: A(), aiTargets: T, aiPagesPerMonth: 2, settings: L3() }), NOW);
    expect(p.picks.map((x) => x.source)).toEqual(['ladder', 'ai_refresh']);
    expect(p.picks[1].existingPageUrl).toBe(slug('e invoicing uae'));
    expect(p.picks[1].aiTarget).toEqual({ targetId: 'ait_x_2', question: 'Which companies help UAE businesses with e-invoicing?', kind: 'refresh', fanout: ['a', 'b'], sources: [], competitors: ['zoho.com', 'cleartax.com'] });
  });
  it('one a week; none when the month is used up or AI pages are off; never with 0 pages a week (it used to be written anyway)', () => {
    expect(kws({ aiTargets: T, aiPagesPerMonth: 2, settings: L3(), logs: [logRow('odoo partner dubai', { source: 'ai_answer', started_at: daysAgo(2) })] })).not.toContain('e invoicing in uae');
    expect(planCadence(input({ aiTargets: T, aiPagesPerMonth: 0, settings: L3() }), NOW).picks.some((x) => /^ai_/.test(x.source))).toBe(false);
    expect(planCadence(input({ pagesPerWeek: 0, aiTargets: T, aiPagesPerMonth: 2, settings: L3() }), NOW).picks).toEqual([]);
  });
  it('below level 3 it is a suggestion that carries the whole AI target; the pile-up guard holds it too', () => {
    const m = planCadence(input({ pagesPerWeek: 1, ladders: A(), aiTargets: T, aiPagesPerMonth: 2, settings: [siteSet({ autopilot_level: 1 } as Partial<LadderSettingsRow>)] }), NOW);
    expect(m.picks.some((x) => /^ai_/.test(x.source))).toBe(false);
    expect(m.suggestions[0].aiTarget).toMatchObject({ targetId: 'ait_x_2', kind: 'refresh', fanout: ['a', 'b'], competitors: ['zoho.com', 'cleartax.com'] });
    const pile = planCadence(input({ pagesPerWeek: 1, aiTargets: T, aiPagesPerMonth: 2, settings: L3(), logs: ['a', 'b', 'c'].map((k) => logRow('waiting ' + k, { started_at: daysAgo(5) })) }), NOW);   // R1: `written` rows
    expect(pile.picks.some((x) => /^ai_/.test(x.source))).toBe(false);
  });
  it('one search, one page: a question the planned ladder page targets is written as that ladder page, with the AI target', () => {
    const p = planCadence(input({ pagesPerWeek: 1, ladders: A(), aiTargets: [target({ tid: '9', question: 'How much does Peppol cost in the UAE?', keyword: 'peppol uae cost dubai', value: 5 })], aiPagesPerMonth: 2 }), NOW);
    expect(p.picks.map((x) => x.source)).toEqual(['ladder']);
    expect(p.picks[0].keyword).toBe('peppol uae cost');
    expect(p.picks[0].aiTarget?.targetId).toBe('ait_x_9');
  });
  it('the simulated cycles write the targets one after the other (a refresh is not repeated)', () => {
    const weeks = simulateCadence(input({ pagesPerWeek: 1, aiTargets: T, aiPagesPerMonth: 4, settings: L3() }), ['2026-10-05T14:00:00.000Z', '2026-10-12T14:00:00.000Z', '2026-10-19T14:00:00.000Z']);
    expect(weeks.map((w) => w.picks.map((x) => x.source + ':' + x.keyword))).toEqual([['ai_refresh:e invoicing in uae'], ['ai_answer:odoo vs business central uae'], []]);
  });
});

// D11 (2026-10-12, system review FIX_PLAN): one search, one page, the website's page inventory (seo_pages, written weekly by the
// Site Tracker) keeps the queue from offering a page the site already has. Same rules as SM.matchPage in n8n (harness S40).
describe('cadence mirror: pages the website already has (D11)', () => {
  const INS = 'https://www.northwind-erp.com/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs';
  const page = (url: string, o: Partial<SitePageRow> = {}) =>
    ({ site_id: 'site_northwind-erp-com', url, title: '', h1: '', source: 'sitemap', lastmod: '', queries_json: '[]', updated_at: '', ...o }) as SitePageRow;
  const INVENTORY = [
    page(INS, { title: 'The cost of non-compliance: UAE e-invoicing penalties and mitigation costs' }),
    page('https://www.northwind-erp.com/uae-e-invoicing-fta-rules/', { title: 'UAE e-invoicing: FTA rules explained' }),
    page('https://www.northwind-erp.com/erp-pricing/', { source: 'gsc', queries_json: JSON.stringify([{ query: 'erp cost dubai', impressions: 240 }, { query: 'erp price uae', impressions: 0 }]) }),
  ];
  const rising = (q: string) => [{ domain: D, keyword: 'e invoicing', direction: 'rising', rising: `${q} (+120%)`, change_pct: 120, checked_at: daysAgo(2) } as unknown as TrendRow];

  it('matchPage: the live page for "uae e invoicing penalties", the S26 false-match pair kept apart, a query match, nothing else', () => {
    expect(matchPage(INVENTORY, 'uae e invoicing penalties')).toMatchObject({ url: INS, matchedBy: 'slug', score: 1 });
    expect(matchPage(INVENTORY, 'e invoicing uae penalties')?.url).toBe(INS);
    expect(matchPage([INVENTORY[1]], 'e invoicing uae penalties')).toBeNull();
    expect(matchPage(INVENTORY, 'erp cost dubai')).toMatchObject({ url: 'https://www.northwind-erp.com/erp-pricing/', matchedBy: 'query' });
    expect(matchPage(INVENTORY, 'wms implementation dubai')).toBeNull();
    expect(matchPage([], 'uae e invoicing penalties')).toBeNull();
  });
  it('an opportunity post for a search a live page answers is not queued, and says which page answers it', () => {
    const p = planCadence(input({ pagesPerWeek: 1, trends: rising('uae e invoicing penalties'), pages: INVENTORY, settings: L3() }), NOW);
    expect(p.picks.map((x) => x.keyword)).not.toContain('uae e invoicing penalties');
    expect(p.coveredByLivePages).toEqual([{ keyword: 'uae e invoicing penalties', source: 'trend', url: INS }]);
  });
  it('a ladder page for such a search is still written, as a refresh of that page, never a second URL', () => {
    const L = ladder('lad_P', 'uae e invoicing', [[1, 1, 'uae e invoicing penalties', undefined]], '2026-07-01T00:00:00.000Z');
    const p = planCadence(input({ pagesPerWeek: 1, ladders: L, pages: INVENTORY }), NOW);
    expect(p.picks.map((x) => [x.keyword, x.existingPageUrl])).toEqual([['uae e invoicing penalties', INS]]);
    expect(p.picks[0].why).toContain('already answers this search, so it is refreshed, not written again');
    expect(p.coveredByLivePages.map((c) => c.source)).toEqual(['ladder']);
  });
  it('without an inventory the queue is exactly what it was before', () => {
    const p = planCadence(input({ pagesPerWeek: 1, trends: rising('uae e invoicing penalties'), settings: L3() }), NOW);
    expect(p.picks.map((x) => x.keyword)).toEqual(['uae e invoicing penalties']);
    expect(p.coveredByLivePages).toEqual([]);
  });
});

// v4.16 (B4-3, benchmark area 4): the same situations as the n8n harness scenario S77, a page the Site Tracker's test confirmed
// is losing traffic is refreshed ahead of a striking-distance query, and the states the evidence refused are never written.
describe('cadence mirror: a page losing traffic is refreshed (B4-3)', () => {
  const P = 'https://www.northwind-erp.com/guides/erp-implementation-checklist/';
  const decaying = (o: Partial<SitePageRow> = {}) =>
    ({
      site_id: 'site_northwind-erp-com', url: P, title: '', h1: '', source: 'gsc', lastmod: '', updated_at: '', measured_at: daysAgo(0),
      queries_json: JSON.stringify([{ query: 'erp implementation checklist', impressions: 9000, clicks: 300 }]),
      clicks: 400, impressions: 13000, position: 9, prev_clicks: 900, yoy_clicks: 1000,
      decay_state: 'decaying', decay_pct: -56, decay_lost: 500, decay_kind: 'visibility', decay_basis: 'Search Console clicks for this page, the last 28 days against the 28 days before (900 to 400).',
      ...o,
    }) as SitePageRow;
  const striking = (page: string) =>
    [{ domain: D, period_end: '2026-10-07', query: 'erp pricing uae', position: 8, impressions: 400, clicks: 5, page } as unknown as QueryRow];

  it('a confirmed decaying page is queued as a refresh of that URL, ahead of the striking-distance guess', () => {
    const p = planCadence(input({ pagesPerWeek: 2, pages: [decaying()], queries: striking('https://www.northwind-erp.com/erp-pricing/'), settings: L3() }), NOW);
    expect(p.picks.map((x) => [x.source, x.existingPageUrl])).toEqual([
      ['decay', P],
      ['striking', 'https://www.northwind-erp.com/erp-pricing/'],
    ]);
    expect(p.picks[0].keyword).toBe('erp implementation checklist');
    expect(p.picks[0].decayLost).toBe(500);
    expect(p.picks[0].why).toContain('500 clicks lost in 28 days (900 to 400)');
  });

  it('seasonal, watch and too-small pages are never rewritten', () => {
    for (const state of ['seasonal', 'watch', 'too_small', 'steady', '']) {
      const p = planCadence(input({ pagesPerWeek: 2, pages: [decaying({ decay_state: state })], settings: L3() }), NOW);
      expect(p.picks.some((x) => x.source === 'decay')).toBe(false);
    }
  });

  it('a page refreshed inside the settle window, or with no search behind it, is left alone', () => {
    const settled = planCadence(input({ pagesPerWeek: 2, pages: [decaying()], settings: L3(), logs: [logRow('anything', { existing_page_url: P, started_at: daysAgo(20) })] }), NOW);
    expect(settled.picks.some((x) => x.source === 'decay')).toBe(false);
    const blind = planCadence(input({ pagesPerWeek: 2, pages: [decaying({ queries_json: '[]' })], settings: L3() }), NOW);
    expect(blind.picks.some((x) => x.source === 'decay')).toBe(false);
  });

  it('one page is one piece of work: it is not queued as a refresh and as a striking-distance page', () => {
    const p = planCadence(input({ pagesPerWeek: 3, pages: [decaying()], queries: striking(P), settings: L3() }), NOW);
    expect(p.picks.filter((x) => x.existingPageUrl === P)).toHaveLength(1);
    expect(p.picks.map((x) => x.source)).toEqual(['decay']);
  });
});

describe('cadence mirror: a failed draft and a set-aside main keyword (R111, R87: 2026-10-16)', () => {
  // R111: the content log says `not_ready` when the page's LAST quality round failed (Content_Log_Row.js). Cadence_Plan.js counts such a
  // draft in the pile-up guard, it is written and not live, and names it as needing a fix, never as a page to publish.
  it('R111: a not_ready draft counts toward the pile-up limit and is named in needsFix; a written one is not', () => {
    const logs = [logRow('erp software uae'), logRow('service industry erp software'), logRow('ai consulting', { status: 'not_ready' })];
    const p = planCadence(input({ ladders: A(), logs }), NOW);
    expect([p.pausedReason, p.waitingPublish]).toEqual(['pileup', 3]);
    expect(p.needsFix).toEqual(['ai consulting']);
    expect(p.waitingKeywords).toContain('ai consulting');
    expect(p.picks).toEqual([]);
  });

  it('R111: a ladder row "writing" whose log row is not_ready waits as a draft to fix (counted once)', () => {
    const p = planCadence(input({ ladders: A({ a: 'writing' }), logs: [logRow('peppol uae cost', { status: 'not_ready', ladder_id: 'lad_A' })], settings: noGuard }), NOW);
    expect([p.waitingPublish, p.needsFix]).toEqual([1, ['peppol uae cost']]);
  });

  // A-20 (2026-10-17, F-A1): the engine now moves the ladder row itself to `written` / `not_ready` when the page run saves its content-log
  // row (Ladder_Row_Written.js). The mirror reads those exactly like `writing`: the page waits once, and it is never written again.
  it('A-20: a ladder row that says not_ready / written waits once and is not picked again', () => {
    for (const st of ['not_ready', 'written'] as const) {
      const p = planCadence(input({ ladders: A({ a: st }), logs: [logRow('peppol uae cost', { status: st, ladder_id: 'lad_A' })], settings: noGuard }), NOW);
      expect(p.waitingPublish).toBe(1);
      expect(p.picks.some((x) => x.keyword === 'peppol uae cost')).toBe(false);
    }
  });

  // R87: n8n writes `set_aside` back on the main keyword's row when it is not a search the site should target (Tracker Ladder Marks /
  // Ladder Marks). The ladder's rungs exist only to climb towards it, so the Monday run writes none of them and the app shows it paused.
  it('R87: a ladder whose main keyword row says set_aside is paused: no rung written or queued, the reason kept', () => {
    const note = '"peppol uae" is not a search this website should target: the results page belongs to government sites (government)';
    const ladders = [...A(), ...B()].map((r) => (r.ladder_id === 'lad_A' && r.rung === 4 ? ({ ...r, status: 'set_aside', status_note: note } as LadderRow) : r));
    const p = planCadence(input({ ladders, settings: noGuard }), NOW);
    expect(p.picks.some((x) => x.ladder?.id === 'lad_A')).toBe(false);
    expect(p.candidates.some((x) => x.ladder?.id === 'lad_A')).toBe(false);
    const la = p.ladders.find((l) => l.id === 'lad_A');
    expect([la?.role, la?.headSetAside, la?.remaining.length]).toEqual(['paused', note, 0]);
    expect(p.ladders.find((l) => l.id === 'lad_B')?.headSetAside).toBe('');
  });
});
