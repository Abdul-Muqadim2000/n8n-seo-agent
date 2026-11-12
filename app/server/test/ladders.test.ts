import { describe, expect, it } from 'vitest';
import { ENGINE_STOPPED_ERROR } from '../src/lib/customerError';
import { MODES, type ContentLogRow, type LadderRow, type LadderSettingsRow, type QueryRow, type QueueItem, type RankHistoryRow } from '@seo/shared';
import { buildLadders, ladderNeedsYou, siteAutomation, type LadderSchedule, type LadderSources, type SiteRun } from '../src/services/ladders';
import { simulateCadence } from '../src/services/cadence';
import { cadenceSchedule, failedRuns } from '../src/services/pipeline';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const DAY = 864e5;
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
const MONDAYS = ['2026-10-05T14:00:00.000Z', '2026-10-12T14:00:00.000Z', '2026-10-19T14:00:00.000Z', '2026-10-26T14:00:00.000Z'];

const lad = (o: Partial<LadderRow>) =>
  ({ ladder_id: 'l1', head_keyword: 'e invoicing in uae', keyword: '', status: 'planned', rung: 1, page_no: 1, page_type: 'Guide', target_url: '', page_exists: false, months: '1-2', start_date: ago(60), country: 'United Arab Emirates', supporting: '', ...o }) as LadderRow;
const log = (o: Partial<ContentLogRow>) => ({ keyword: '', status: 'written', started_at: ago(5), published_url: '', published_at: '', request_id: '', ladder_id: '', source: 'app', ...o }) as ContentLogRow;   // R1 (2026-10-13): a page waits for publication only once the log row says `written`
/** weekly checks, oldest first, the last one `end` days ago */
const ranks = (ladder: string, keyword: string, positions: number[], end = 1) =>
  positions.map((position, i) => ({ ladder_id: ladder, keyword, position, checked_at: ago(end + (positions.length - 1 - i) * 7) }) as RankHistoryRow);
const run = (o: Partial<SiteRun>): SiteRun => ({ id: 'r1', mode: 'keyword', status: 'completed', title: 'Page', error: null, keyword: '', ladderId: '', costUsd: 1.2, createdAt: ago(1), ...o });
const src = (o: Partial<LadderSources>): LadderSources => ({ ladders: [], history: [], logs: [], queries: [], settings: [], plans: [], pageReports: [], runs: [], ...o });
/** the cadence's picks in order, `perRun` per Monday */
const sched = ({ picks = [], perRun = 1, ...o }: Partial<LadderSchedule> & { picks?: QueueItem[]; perRun?: number } = {}): LadderSchedule => {
  const runs = o.cadenceRuns ?? MONDAYS;
  const dated = perRun > 0 ? picks.map((item, i) => ({ item, at: runs[Math.floor(i / perRun)] })).filter((d) => !!d.at) : [];
  return { dated, cadenceRuns: MONDAYS, rankNextAt: '2026-10-05T12:00:00.000Z', ...o };
};
const pick = (keyword: string, ladder: string, pageNo: number, rung = 1): QueueItem => ({ keyword, source: 'ladder', why: '', pageType: 'Guide', existingPageUrl: '', ladder: { id: ladder, rung, head: 'h', pageNo } });
const settings = (o: Partial<LadderSettingsRow>) => ({ ladder_id: 'l1', domain: 'techand.ai', mode: 'auto', priority: 0, status: 'active', plan_type: '', ...o }) as LadderSettingsRow;
/** a ladder of `n` supporting pages and the main page */
const ladder = (id: string, head: string, n: number, start = 60) => [
  ...Array.from({ length: n }, (_, i) => lad({ ladder_id: id, head_keyword: head, keyword: `${head} part ${i + 1}`, page_no: i + 1, rung: i < 2 ? 1 : 2, start_date: ago(start) })),
  lad({ ladder_id: id, head_keyword: head, keyword: head, rung: 4, page_no: n + 1, months: '6-9', start_date: ago(start) }),
];

describe('ladder pages: states', () => {
  const b = buildLadders(
    src({
      ladders: [
        lad({ keyword: 'uae e invoicing penalties', status: 'published', target_url: 'https://techand.ai/penalties/', page_no: 1 }),
        lad({ keyword: 'e invoicing uae fta', status: 'writing', page_no: 2 }),
        lad({ keyword: 'peppol uae', status: 'writing', page_no: 3 }),
        lad({ keyword: 'uae e invoicing requirements', page_no: 4 }),
        lad({ keyword: 'e invoicing uae 2026', status: 'writing', rung: 2, page_no: 5 }),
        lad({ keyword: 'list of asp uae', status: 'writing', rung: 2, page_no: 6 }),
        lad({ keyword: 'is e invoicing mandatory in uae', rung: 2, page_no: 7 }),
        lad({ keyword: 'e invoicing in uae', rung: 4, page_no: 8 }),
      ],
      logs: [
        log({ keyword: 'e invoicing uae fta', started_at: ago(9), request_id: 'cad_20260924_techand-ai_1' }),
        log({ keyword: 'peppol uae', started_at: new Date(NOW - 3600_000).toISOString() }),
        log({ keyword: 'list of asp uae', started_at: ago(2) }),
        log({ keyword: 'is e invoicing mandatory in uae', status: 'published', started_at: ago(30), published_url: 'https://www.techand.ai/mandatory/', published_at: ago(20) }),
      ],
      runs: [
        run({ id: 'r-req', keyword: 'uae e invoicing requirements', status: 'running', createdAt: new Date(NOW - 600_000).toISOString(), ladderId: 'l1' }),
        run({ id: 'r-asp', keyword: 'list of asp uae', status: 'failed', createdAt: ago(2) }),
      ],
      pageReports: [{ reportId: 'rep-fta', runId: null, keyword: 'E invoicing UAE FTA', ladderId: 'l1', receivedAt: ago(9) }],
    }),
    sched(),
    { now: NOW },
  );
  const pages = b.details.get('l1')!.pages;
  const st = Object.fromEntries(pages.map((p) => [p.keyword, p.state]));

  it('published from the ladder row or the publish check; written = waiting; runs and fresh starts = writing', () => {
    expect(st).toEqual({
      'uae e invoicing penalties': 'published',
      'e invoicing uae fta': 'waiting',
      'peppol uae': 'writing',
      'uae e invoicing requirements': 'writing',
      // the ladder run's own first page: written with the plan
      'e invoicing uae 2026': 'waiting',
      // its run failed and no page arrived: not written
      'list of asp uae': 'planned',
      'is e invoicing mandatory in uae': 'published',
      // 2 of 7 supporting pages live: the main page waits for support
      'e invoicing in uae': 'gated',
    });
    const fta = pages.find((p) => p.keyword === 'e invoicing uae fta')!;
    expect([fta.writtenAt, fta.reportId]).toEqual([ago(9), 'rep-fta']);
    const mandatory = pages.find((p) => p.keyword === 'is e invoicing mandatory in uae')!;
    expect([mandatory.publishedUrl, mandatory.publishedAt]).toEqual(['https://www.techand.ai/mandatory/', ago(20)]);
    expect(pages.find((p) => p.keyword === 'uae e invoicing penalties')!.publishedUrl).toBe('https://techand.ai/penalties/');
    expect(pages.find((p) => p.keyword === 'uae e invoicing requirements')!.runId).toBe('r-req');
    expect(pages.find((p) => p.keyword === 'e invoicing uae 2026')!.writtenAt).toBe(ago(60));
  });

  // R16 (2026-10-13, FIX_PLAN §3.11): a rung the keyword rule refused (a competitor's brand, a government portal, an off-topic search).
  // n8n writes `set_aside` on the row and names the reason in its weekly note; the app must show it as set aside, never promise it and
  // never offer "Write now" for it.
  it('R34: a rung the engine marked `live (existing page)` is a published page at its covered_by URL, not a plan', () => {
    const liveSrc = src({
      ladders: [
        lad({ keyword: 'ai consulting dubai', rung: 4, page_no: 1, status: 'live (existing page)', covered_by: 'https://www.techand.ai/ai-copilot-advisory-uae' }),
        lad({ keyword: 'ai readiness uae', rung: 1, page_no: 2 }),
      ],
    });
    const lb = buildLadders(liveSrc, sched(), { now: NOW });
    const lp = lb.details.get('l1')!.pages.find((p) => p.keyword === 'ai consulting dubai')!;
    expect(lp.state).toBe('published');
    expect(lp.publishedUrl).toBe('https://www.techand.ai/ai-copilot-advisory-uae');
  });

  it('a rung n8n set aside is shown as set_aside: not planned, not counted as coming, not written', () => {
    const asideSrc = src({
      ladders: [
        lad({ keyword: 'erp software dubai', rung: 2, page_no: 1 }),
        lad({ keyword: 'facts erp', rung: 2, page_no: 2, status: 'set_aside' }),
        lad({ keyword: 'erp software uae', rung: 4, page_no: 3 }),
      ],
    });
    const picks = [pick('erp software dubai', 'l1', 1, 2), pick('facts erp', 'l1', 2, 2)];
    const ab = buildLadders(asideSrc, sched({ picks }), { now: NOW });
    const ap = ab.details.get('l1')!.pages;
    expect(Object.fromEntries(ap.map((p) => [p.keyword, p.state]))).toEqual({
      'erp software dubai': 'planned',
      'facts erp': 'set_aside',
      'erp software uae': 'gated',
    });
    // 3 pages, 2 of them still to write (the set-aside one is neither planned nor waiting nor written)
    expect(ab.cards[0].counts).toEqual({ total: 3, published: 0, waiting: 0, writing: 0, planned: 2 });
    // no Monday is promised for it, even though the mirror's queue still carried it
    expect(ab.cards[0].next.text).toBe('Writes page 1: "erp software dubai"');
    expect(ab.details.get('l1')!.timeline.filter((e) => e.kind === 'next' && /facts erp/.test(e.text))).toEqual([]);
  });

  it('a page waiting 7+ days: the ladder needs you, and the next step is publishing', () => {
    const c = b.cards[0];
    expect(c.counts).toEqual({ total: 8, published: 2, waiting: 2, writing: 2, planned: 2 });
    expect(c.status).toBe('needs_you');
    expect(c.next).toEqual({ kind: 'publish', text: 'Waiting for you: publish 2 pages', at: null });
    expect(b.waiting.map((w) => [w.keyword, w.days])).toEqual([
      ['e invoicing uae 2026', 60],
      ['e invoicing uae fta', 9],
    ]);
  });
});

describe('ladder cards: status, next step, priority', () => {
  it('the next step is the Monday the cadence writes one of its pages', () => {
    const b = buildLadders(src({ ladders: ladder('l1', 'erp dubai', 3) }), sched({ picks: [pick('erp dubai part 1', 'l1', 1), pick('other topic', 'x', 1), pick('erp dubai part 2', 'l1', 2)] }), { now: NOW });
    const c = b.cards[0];
    expect([c.status, c.statusText]).toEqual(['planning', 'Planned: 4 pages, none written yet.']);
    expect(c.next).toEqual({ kind: 'write', text: 'Writes page 1: "erp dubai part 1"', at: MONDAYS[0] });
    expect(c.months).toBe('6-9');
    // rank checks: 4 keywords x 4.33 weeks x $0.015, plus the 2 pages written in the next 4 weeks
    // (B-R3: the price of a page comes from the one cost table now, never typed into a test)
    // credits (app/docs/CREDITS.md): in credits at the default rate, 60 a dollar of provider cost
    expect(c.monthlyCredits).toBe(Math.round((0.015 * 4 * 4.33 + 2 * MODES.keyword.costUsd) * 60 * 100) / 100);
    const future = b.details.get('l1')!.timeline.filter((e) => e.future);
    expect(future.map((e) => [e.at, e.text])).toEqual([
      ['2026-10-05T12:00:00.000Z', 'Rank check of 4 keywords'],
      [MONDAYS[0], 'Writes page 1: "erp dubai part 1"'],
      [MONDAYS[2], 'Writes page 2: "erp dubai part 2"'],
    ]);
    // weekly posts off: nothing dated, the person can still write it
    const off = buildLadders(src({ ladders: ladder('l1', 'erp dubai', 3) }), sched({ picks: [], cadenceRuns: [], perRun: 0 }), { now: NOW });
    expect(off.cards[0].next).toEqual({ kind: 'write', text: 'Next page: "erp dubai part 1". Weekly posts are off: use Write now', at: null });
  });

  it('priority: oldest first without settings; beyond 2 active Auto ladders they are queued', () => {
    const rows = [...ladder('new', 'payroll uae', 2, 5), ...ladder('old', 'erp dubai', 2, 90), ...ladder('mid', 'vat filing uae', 2, 30)];
    const b = buildLadders(src({ ladders: rows }), sched(), { now: NOW });
    expect(b.cards.map((c) => [c.id, c.priority, c.status])).toEqual([
      ['old', 1, 'planning'],
      ['mid', 2, 'planning'],
      ['new', 3, 'queued'],
    ]);
    expect(b.cards[2].next.kind).toBe('wait');
    // the settings' priority comes first; a paused ladder frees its place
    const s2 = buildLadders(src({ ladders: rows, settings: [settings({ ladder_id: 'new', priority: 1 }), settings({ ladder_id: 'old', status: 'paused' })] }), sched(), { now: NOW });
    expect(s2.cards.map((c) => [c.id, c.status])).toEqual([
      ['new', 'planning'],
      ['old', 'paused'],
      ['mid', 'planning'],
    ]);
    // a won ladder does not take a place either
    const won = buildLadders(src({ ladders: rows, history: ranks('old', 'erp dubai', [2, 1, 1, 3]) }), sched(), { now: NOW });
    expect(won.cards.map((c) => c.status)).toEqual(['won', 'planning', 'planning']);
    expect(won.cards[0].next.kind).toBe('check');
  });

  it('site automation: the "_site" row of the settings, or the defaults', () => {
    expect(siteAutomation([])).toEqual({ autopilotLevel: 2, defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 });
    expect(siteAutomation([settings({ ladder_id: '_site', mode: 'manual', opportunities: 'manual', auto_start: true, max_active: 1, max_waiting: 0, autopilot_level: 3 })])).toEqual({
      autopilotLevel: 3,
      defaultMode: 'manual',
      opportunities: 'manual',
      autoStartLadders: true,
      maxActiveLadders: 1,
      maxWaiting: 3,
    });
  });
});

describe('main page gate', () => {
  const rows = ladder('l1', 'erp dubai', 4);
  const withLive = (n: number) => src({ ladders: rows.map((r, i) => (i < n ? { ...r, status: 'published' } : r)) });
  const state = (b: ReturnType<typeof buildLadders>) => b.details.get('l1')!.pages.find((p) => p.rung === 4)!.state;

  it('on by default (the cadence enforces it since Phase 2); off: the main page is planned', () => {
    expect(state(buildLadders(withLive(1), sched(), { now: NOW }))).toBe('gated');
    expect(state(buildLadders(withLive(1), sched(), { now: NOW, gate: false }))).toBe('planned');
  });

  it('on: waits until half of the supporting pages are live, or the main keyword ranks top 30; never for Direct plans', () => {
    expect(state(buildLadders(withLive(1), sched(), { now: NOW, gate: true }))).toBe('gated');
    expect(state(buildLadders(withLive(2), sched(), { now: NOW, gate: true }))).toBe('planned');
    expect(state(buildLadders({ ...withLive(1), history: ranks('l1', 'erp dubai', [40, 28]) }, sched(), { now: NOW, gate: true }))).toBe('planned');
    expect(state(buildLadders({ ...withLive(1), settings: [settings({ plan_type: 'direct' })] }, sched(), { now: NOW, gate: true }))).toBe('planned');
    // only the gated main page left: the ladder waits
    const allButMain = buildLadders(withLive(4), sched(), { now: NOW, gate: true });
    expect(state(allButMain)).toBe('planned');
    const gatedOnly = buildLadders(src({ ladders: rows.map((r, i) => (i === 0 ? { ...r, status: 'published' } : i < 4 ? { ...r, status: 'writing' } : r)) }), sched(), { now: NOW, gate: true });
    expect(gatedOnly.cards[0].counts.planned).toBe(1);
  });
});

describe('timeline and traffic', () => {
  const rows = [lad({ keyword: 'peppol uae', status: 'published', target_url: 'https://techand.ai/peppol/', start_date: ago(70) }), lad({ keyword: 'e invoicing in uae', rung: 4, page_no: 2, start_date: ago(70) })];
  const q = (o: Partial<QueryRow>) => ({ query: 'peppol uae', period_end: '2026-09-27', checked_at: '2026-09-28T09:00:00Z', clicks: 0, impressions: 0, page: 'https://www.techand.ai/peppol', ...o }) as QueryRow;
  const b = buildLadders(
    src({
      ladders: rows,
      history: [...ranks('l1', 'peppol uae', [0, 14, 8, 2, 9]), ...ranks('l1', 'e invoicing in uae', [0, 0, 0, 0, 44])],
      logs: [log({ keyword: 'peppol uae', status: 'published', started_at: ago(65), published_url: 'https://techand.ai/peppol/', published_at: ago(60) })],
      queries: [
        q({ clicks: 3, impressions: 100 }),
        // the same period checked again: the newest row counts
        q({ clicks: 5, impressions: 120, checked_at: '2026-09-29T09:00:00Z' }),
        q({ query: 'peppol in uae', clicks: 1, impressions: 30, page: 'https://techand.ai/peppol/' }),
        q({ period_end: '2026-10-04', checked_at: '2026-10-05T09:00:00Z', clicks: 9, impressions: 300 }),
        q({ query: 'other', clicks: 50, impressions: 900, page: 'https://techand.ai/other/' }),
      ],
    }),
    sched(),
    { now: NOW },
  );
  const d = b.details.get('l1')!;

  it('past events: planned, written, published, first top 10 / top 3, drops of 5+ places', () => {
    expect(d.timeline.filter((e) => !e.future).map((e) => [e.kind, e.text])).toEqual([
      ['planned', 'Ladder planned: 2 pages towards "e invoicing in uae"'],
      ['written', '"peppol uae" written'],
      ['published', '"peppol uae" published at techand.ai/peppol'],
      ['top10', '"peppol uae" reached the top 10 (#8)'],
      ['top3', '"peppol uae" reached the top 3 (#2)'],
      ['drop', '"peppol uae" dropped from #2 to #9'],
    ]);
  });

  it('card numbers: main keyword position and change, pages in the top 10 / 3', () => {
    expect([d.status, d.headPosition, d.headChange, d.top10, d.top3]).toEqual(['climbing', 44, 7, 1, 0]);
    expect(d.statusText).toBe('1 of 2 pages live; the main keyword is at #44.');
  });

  it('traffic: Search Console rows of the published pages by address (www, trailing slash do not matter)', () => {
    expect(d.traffic).toEqual({
      points: [
        { periodEnd: '2026-09-27', clicks: 6, impressions: 150 },
        { periodEnd: '2026-10-04', clicks: 9, impressions: 300 },
      ],
      clicks28d: 9,
      impressions28d: 300,
      basis: 'queries',
    });
    expect(b.clicks28d).toBe(9);
  });

  it('cost so far: a plan made outside the app at its list price, the rank checks, the app\'s runs for the ladder', () => {
    expect(d.creditsSoFar).toBe(Math.round((MODES.ladder.costUsd + 10 * 0.015) * 60 * 100) / 100);
    const withRuns = buildLadders(
      src({
        ladders: rows,
        runs: [run({ id: 'plan', mode: 'ladder', keyword: 'e invoicing in uae', costUsd: 1.8 }), run({ id: 'p2', ladderId: 'l1', keyword: 'x', costUsd: 1.1 }), run({ id: 'p3', ladderId: 'l1', status: 'failed' })],
        plans: [{ reportId: 'rp', runId: 'plan', ladderId: 'l1', head: 'e invoicing in uae', receivedAt: ago(70), planType: 'full', months: '9-15', expectedVisitsTop3: 250, keywords: [{ keyword: 'peppol uae', volume: 90, kd: 12 }] }],
        logs: [log({ keyword: 'peppol uae', request_id: 'cad_20260901_techand-ai_1', status: 'published', published_url: 'https://techand.ai/peppol/' })],
      }),
      sched(),
      { now: NOW },
    ).details.get('l1')!;
    expect(withRuns.creditsSoFar).toBe(Math.round((1.8 + 1.1 + MODES.keyword.costUsd) * 60 * 100) / 100);
    expect([withRuns.planType, withRuns.expectedVisitsTop3, withRuns.pages[0].volume, withRuns.pages[0].kd]).toEqual(['full', 250, 90, 12]);
  });
});

describe('needs you', () => {
  it('pages to publish per ladder (oldest first), the pile-up, overlaps and duplicates, Manual ladders\' next page', () => {
    const b = buildLadders(
      src({
        ladders: [
          lad({ ladder_id: 'a', head_keyword: 'e invoicing in uae', keyword: 'uae e invoicing penalties', start_date: ago(90) }),
          lad({ ladder_id: 'a', head_keyword: 'e invoicing in uae', keyword: 'peppol uae', page_no: 2, start_date: ago(90) }),
          lad({ ladder_id: 'a', head_keyword: 'e invoicing in uae', keyword: 'e invoicing in uae', rung: 4, page_no: 3, start_date: ago(90) }),
          lad({ ladder_id: 'b', head_keyword: 'e invoicing uae', keyword: 'e invoicing uae deadline', start_date: ago(30) }),
          lad({ ladder_id: 'b', head_keyword: 'e invoicing uae', keyword: 'e invoicing uae', rung: 4, page_no: 2, start_date: ago(30) }),
          lad({ ladder_id: 'c', head_keyword: 'payroll software uae', keyword: 'uae e-invoicing penalty', start_date: ago(20) }),
          lad({ ladder_id: 'c', head_keyword: 'payroll software uae', keyword: 'wps payroll uae', page_no: 2, start_date: ago(20) }),
          lad({ ladder_id: 'c', head_keyword: 'payroll software uae', keyword: 'payroll software uae', rung: 4, page_no: 3, start_date: ago(20) }),
        ],
        logs: [log({ keyword: 'uae e invoicing penalties', started_at: ago(10) }), log({ keyword: 'peppol uae', started_at: ago(3) }), log({ keyword: 'vat guide', started_at: ago(4) })],
        settings: [settings({ ladder_id: 'c', mode: 'manual' })],
      }),
      sched(),
      { now: NOW },
    );
    const items = ladderNeedsYou(b);
    expect(items.map((i) => [i.kind, i.id, i.severity])).toEqual([
      ['pileup', 'pileup', 'warning'],
      ['publish', 'publish:a', 'warning'],
      ['publish', 'publish:other', 'info'],
      ['duplicate', 'duplicate:a|b', 'warning'],
      ['overlap', 'overlap:a|c', 'warning'],
      ['approve', 'approve:c', 'info'],
    ]);
    const pub = items[1];
    expect(pub.title).toBe('Publish 2 pages of "e invoicing in uae"');
    expect(pub.detail).toBe('"uae e invoicing penalties" (waiting 10 days), "peppol uae" (waiting 3 days). Put each page on your website, then report its address so tracking starts.');
    expect(pub.action).toEqual({ label: 'I published it', mode: 'published', prefill: { keyword: 'uae e invoicing penalties' } });
    // the near-identical main keyword is a duplicate; the ladder further down the list is the one to look at
    expect([items[3].title, items[3].action?.ladderId]).toEqual(['Two ladders for "e invoicing in uae"', 'b']);
    expect(items[4].title).toBe('"e invoicing in uae" and "payroll software uae" overlap');
    expect(items[4].detail).toContain('"uae e invoicing penalties", "uae e-invoicing penalty"');
    expect(items[5].action).toMatchObject({ mode: 'keyword', prefill: { keyword: 'uae e-invoicing penalty', pageType: 'Guide', ladder: { id: 'c', rung: 1, head: 'payroll software uae', pageNo: 1 } } });
    expect(b.cards.map((c) => [c.id, c.status, c.mode])).toEqual([
      ['a', 'needs_you', 'auto'],
      ['b', 'needs_you', 'auto'],
      ['c', 'needs_you', 'manual'],
    ]);
  });

  it('failed runs of the last 7 days, unless started again since', () => {
    const f = failedRuns(
      [
        run({ id: 'new-ok', keyword: 'peppol uae', createdAt: ago(1) }),
        run({ id: 'old-fail', keyword: 'peppol uae', status: 'failed', createdAt: ago(2) }),
        run({ id: 'audit-fail', mode: 'audit', title: 'Technical audit', status: 'failed', error: 'n8n: crawl timed out', createdAt: ago(3) }),
        run({ id: 'ancient', mode: 'backlinks', status: 'failed', createdAt: ago(9) }),
      ],
      NOW,
    );
    // S2-08: the engine's raw text ('n8n: crawl timed out') is never shown to the client; the plain sentence is
    expect(f.map((x) => [x.id, x.title, x.detail, x.action?.runId])).toEqual([['failed:audit-fail', 'Technical audit: did not finish', ENGINE_STOPPED_ERROR, 'audit-fail']]);
  });
});

describe('cards and Needs you from the cadence mirror', () => {
  // F-KW: the Auto ladder is planned within 60 days of the coming runs (an older plan that was never written waits for a fresh check)
  const rows = [...ladder('m', 'payroll uae', 3, 90), ...ladder('a', 'erp dubai', 3, 40)];
  const build = (o: Partial<LadderSources>, runs = MONDAYS.slice(0, 2), extra: Partial<LadderSchedule> = {}) => {
    const s = src({ ladders: rows, ...o });
    const weeks = simulateCadence({ domain: 'techand.ai', pagesPerWeek: 1, ladders: s.ladders, queries: [], trends: [], logs: s.logs, settings: s.settings, history: s.history }, runs, NOW);
    return buildLadders(s, { ...cadenceSchedule(weeks, runs.length > 0), cadenceRuns: runs, rankNextAt: null, ...extra }, { now: NOW });
  };

  it('a Manual ladder: its next page waits for your OK (the Write it dialog gets the ladder fields); the Auto one gets the Mondays', () => {
    const b = build({ settings: [settings({ ladder_id: 'm', mode: 'manual' })] });
    expect(b.cards.map((c) => [c.id, c.mode, c.next.kind, c.next.at])).toEqual([
      ['m', 'manual', 'approve', null],
      ['a', 'auto', 'write', MONDAYS[0]],
    ]);
    const approve = ladderNeedsYou(b).find((i) => i.kind === 'approve')!;
    expect(approve.writeNow).toMatchObject({ keyword: 'payroll uae part 1', source: 'ladder', ladder: { id: 'm', rung: 1, head: 'payroll uae', pageNo: 1 } });
    expect(b.details.get('a')!.timeline.filter((e) => e.future).map((e) => e.text)).toEqual(['Writes page 1: "erp dubai part 1"', 'Writes page 2: "erp dubai part 2"']);
  });

  it('the pile-up guard: nothing dated, the ladders need you; last Monday\'s skipped run shows until a page is published', () => {
    const logs = ['x one', 'x two', 'x three'].map((k) => log({ keyword: k, started_at: ago(12) }));
    const b = build({ logs });
    expect(b.cards.map((c) => [c.status, c.next.kind])).toEqual([
      ['needs_you', 'publish'],
      ['needs_you', 'publish'],
    ]);
    expect(b.cards.every((c) => !b.details.get(c.id)!.timeline.some((e) => e.future))).toBe(true);
    expect(ladderNeedsYou(b).find((i) => i.kind === 'pileup')?.title).toBe('Weekly pages stopped: 3 written pages waiting for publication');
    expect(ladderNeedsYou(b).find((i) => i.kind === 'pileup')?.detail).toContain('Waiting: "x one", "x two", "x three".');
    const last = build({}, MONDAYS.slice(0, 2), { lastRunPileup: { at: ago(5), waiting: 3, max: 3 } });
    const item = ladderNeedsYou(last).find((i) => i.kind === 'pileup')!;
    expect([item.title, item.detail.startsWith('Last week\'s run wrote nothing')]).toEqual(['Last week\'s pages were skipped: 3 written pages waited for publication', true]);
    expect(last.cards[0].status).toBe('planning');
  });

  it('Queued and won come from the mirror; a paused ladder frees its place', () => {
    const three = [...rows, ...ladder('n', 'vat uae', 2, 30)];
    const q = build({ ladders: three });
    expect(q.cards.map((c) => [c.id, c.status])).toEqual([
      ['m', 'planning'],
      ['a', 'planning'],
      ['n', 'queued'],
    ]);
    const p = build({ ladders: three, settings: [settings({ ladder_id: 'm', status: 'paused' })] });
    expect(p.cards.map((c) => c.status)).toEqual(['paused', 'planning', 'planning']);
    expect(p.cards[0].archived).toBeUndefined();
    // review S1 (2026-11-12): an archived ladder reads paused but says it is archived, so no Resume is offered for it
    const ar = build({ ladders: three, settings: [settings({ ladder_id: 'm', status: 'archived' })] });
    expect(ar.cards.find((c) => c.id === 'm')).toMatchObject({ status: 'paused', archived: true, statusText: expect.stringMatching(/^Archived: .*cannot be resumed/) });
    const w = build({ ladders: three, settings: [settings({ ladder_id: 'm', status: 'won' })] });
    expect(w.cards.map((c) => [c.status, c.next.kind])).toEqual([
      ['won', 'check'],
      ['planning', 'write'],
      ['planning', 'write'],
    ]);
  });
});

// Prod 2026-11-05 (devaicon.com): "privacy policy" was a page run of 2026-10-30 that finished with a report and no page (AVOID). The app
// closed its content-log row `failed` and the Content page dropped it, but the Pipeline kept "Publish 1 written page: "privacy policy"
// (waiting 6 days)" because the ladder build's logState took any unpublished row as a written page.
describe('pages that were never written do not wait to be published (noPageRow)', () => {
  const NOW_D = Date.parse('2026-11-05T09:00:00Z');
  const since = (d: number) => new Date(NOW_D - d * DAY).toISOString();
  const publishItems = (b: ReturnType<typeof buildLadders>) => ladderNeedsYou(b).filter((i) => i.kind === 'publish' || i.kind === 'failed');

  it('a run that finished without a page (row closed `failed`): no waiting page, no "Publish 1 written page"', () => {
    const b = buildLadders(
      src({
        logs: [log({ keyword: 'privacy policy', status: 'failed', started_at: since(6), request_id: 'req-pp', qa_reasons: 'no page was written: the keyword check advised against this page, see its report' })],
        runs: [run({ keyword: 'privacy policy', status: 'completed', createdAt: since(6), requestId: 'req-pp' })],
        pageReports: [{ reportId: 'rep-pp', runId: null, keyword: 'privacy policy', ladderId: '', receivedAt: since(6) }],
      }),
      sched(),
      { now: NOW_D },
    );
    expect(b.waiting).toEqual([]);
    expect(publishItems(b)).toEqual([]);
  });

  it('two closed rows for the keyword (the duplicate the 2026-11-03 fix deleted): still no page', () => {
    const b = buildLadders(
      src({ logs: [log({ keyword: 'privacy policy', status: 'failed', started_at: since(6) }), log({ keyword: 'Privacy Policy', status: 'failed', started_at: since(6.01) })] }),
      sched(),
      { now: NOW_D },
    );
    expect(b.waiting).toEqual([]);
  });

  it('a `started` row of a run the app saw fail, not yet marked: no page', () => {
    const b = buildLadders(
      src({
        logs: [log({ keyword: 'privacy policy', status: 'started', started_at: since(6), request_id: 'req-f' })],
        runs: [run({ id: 'r2', keyword: 'privacy policy', status: 'completed', createdAt: since(5), requestId: 'req-other' }), run({ keyword: 'privacy policy', status: 'failed', createdAt: since(6), requestId: 'req-f' })],
      }),
      sched(),
      { now: NOW_D },
    );
    expect(b.waiting).toEqual([]);
  });

  it("a keyword held for the client's OK is not a written page (it has its own Needs-you item)", () => {
    const b = buildLadders(src({ logs: [log({ keyword: 'erp dubai', status: 'held', started_at: since(2) })] }), sched(), { now: NOW_D });
    expect(b.waiting).toEqual([]);
  });

  it('still waits: a written page, a not_ready draft, and an older written page whose later rewrite failed', () => {
    const b = buildLadders(
      src({
        logs: [
          log({ keyword: 'bfsi technology', status: 'written', started_at: since(3) }),
          log({ keyword: 'erp uae', status: 'not_ready', started_at: since(4), qa_reasons: '[Confirm: AED 50m] in the body' }),
          log({ keyword: 'crm uae', status: 'failed', started_at: since(1) }),
          log({ keyword: 'crm uae', status: 'written', started_at: since(8) }),
        ],
      }),
      sched(),
      { now: NOW_D },
    );
    expect(b.waiting.map((w) => [w.keyword, !!w.needsFix])).toEqual([
      ['crm uae', false],
      ['erp uae', true],
      ['bfsi technology', false],
    ]);
  });

  it('a ladder page whose only run finished without a page is planned again, not waiting', () => {
    const b = buildLadders(
      src({
        ladders: [lad({ keyword: 'privacy policy uae', status: 'writing', start_date: since(6) })],
        logs: [log({ keyword: 'privacy policy uae', status: 'failed', started_at: since(6), ladder_id: 'l1' })],
      }),
      sched(),
      { now: NOW_D },
    );
    expect(b.details.get('l1')?.pages.find((p) => p.keyword === 'privacy policy uae')?.state).toBe('planned');
    expect(b.waiting).toEqual([]);
  });
});

// Production 2026-11-10 (devaicon.com, "Main keyword: Not in the top 50, but Google shows it on page one"): our neutral check was right, but the
// ladder counted a check taken six hours before the main page existed, showed "0 times shown" because Google reports no single search for
// these rare keywords, and never said how we check. Client anonymised (novaand-demo.com).
describe('a live page: readings after it went live, its own Search Console figures, how we check', () => {
  const D = 'https://novaand-demo.com';
  const at = (iso: string) => iso;
  const rows = [
    lad({ ladder_id: 'lp', head_keyword: 'ai automation services pakistan', keyword: 'ai in industrial automation', rung: 2, page_no: 1, status: 'published', target_url: `${D}/insights/ai-in-industrial-automation`, country: 'Pakistan', start_date: '2026-10-20T00:00:00Z' }),
    lad({ ladder_id: 'lp', head_keyword: 'ai automation services pakistan', keyword: 'ai automation services pakistan', rung: 4, page_no: 2, status: 'published', target_url: `${D}/ai-automation-services-pakistan`, country: 'Pakistan', start_date: '2026-10-20T00:00:00Z' }),
  ];
  const history = [
    { ladder_id: 'lp', keyword: 'ai automation services pakistan', position: 0, checked_at: at('2026-10-30T01:13:00Z') },
    { ladder_id: 'lp', keyword: 'ai automation services pakistan', position: -1, checked_at: at('2026-11-06T01:13:00Z') },
    { ladder_id: 'lp', keyword: 'ai automation services pakistan', position: 0, checked_at: at('2026-11-08T19:38:00Z') },
    { ladder_id: 'lp', keyword: 'ai in industrial automation', position: 0, checked_at: at('2026-11-08T19:38:00Z') },
  ] as RankHistoryRow[];
  const logs = [
    log({ keyword: 'ai in industrial automation', status: 'published', started_at: '2026-10-26T00:00:00Z', published_url: `${D}/insights/ai-in-industrial-automation`, published_at: '2026-10-27T09:28:16Z', ladder_id: 'lp' }),
    log({ keyword: 'ai automation services pakistan', status: 'published', started_at: '2026-10-29T00:00:00Z', published_url: `${D}/ai-automation-services-pakistan`, published_at: '2026-10-30T07:52:35Z', ladder_id: 'lp' }),
  ];
  const sitePages = [
    { url: `${D}/insights/ai-in-industrial-automation`, impressions: 10, clicks: 1, position: 4.7, measured_at: '2026-11-06T01:18:48Z' },
    { url: `${D}/ai-automation-services-pakistan`, impressions: 1, clicks: 0, position: 10, measured_at: '2026-11-06T01:18:48Z' },
    { url: `${D}/services/ai-automation-services-pakistan`, impressions: 2, clicks: 0, position: 8, measured_at: '2026-11-06T01:18:48Z' },
  ];
  const NOW2 = Date.parse('2026-11-10T12:00:00Z');
  const build = (o: Partial<LadderSources> = {}) => buildLadders(src({ ladders: rows, history, logs, sitePages, ...o }), sched(), { now: NOW2 }).details.get('lp')!;

  it('the check from before the main page went live is kept on the chart, marked, and never counts', () => {
    const d = build();
    const main = d.pages.find((p) => p.rung === 4)!;
    expect(main.history.map((h) => [h.checkedAt, !!h.beforePublish])).toEqual([
      ['2026-10-30T01:13:00Z', true],
      ['2026-11-06T01:13:00Z', false],
      ['2026-11-08T19:38:00Z', false],
    ]);
    expect([main.position, main.previousPosition]).toEqual([0, null]);
    expect([d.headPosition, d.headChange]).toEqual([0, null]);
    expect(d.headSeries.map((h) => !!h.beforePublish)).toEqual([true, false]);
  });

  it('a live page Google reports no single search for shows its own Search Console figures, and the traffic counts them', () => {
    const d = build();
    const guide = d.pages.find((p) => p.rung === 2)!;
    expect(guide.gsc).toMatchObject({ impressions: 10, clicks: 1, position: 4.7 });
    expect(d.traffic).toMatchObject({ points: [], clicks28d: 1, impressions28d: 11, basis: 'pages' });
    // a page with per-search rows keeps them (no page figures added)
    const withRows = build({ queries: [{ query: 'ai in industrial automation', period_end: '2026-11-03', checked_at: '2026-11-04T00:00:00Z', clicks: 1, impressions: 6, page: `${D}/insights/ai-in-industrial-automation` } as QueryRow] });
    expect(withRows.pages.find((p) => p.rung === 2)!.gsc).toBeUndefined();
    expect(withRows.traffic).toMatchObject({ clicks28d: 1, impressions28d: 7, basis: 'mixed' });
  });

  it('a page that moved to a new address is read with it (the engine\'s moved pages)', () => {
    const d = build({ indexMoves: [{ url: `${D}/ai-automation-services-pakistan`, to: `${D}/services/ai-automation-services-pakistan` }] });
    expect(d.pages.find((p) => p.rung === 4)!.gsc).toMatchObject({ impressions: 3, clicks: 0 });
    expect(d.traffic.impressions28d).toBe(13);
  });

  it('says how we check, and both readings in one sentence when Search Console shows the page near the top', () => {
    const d = build();
    expect(d.headNote).toMatch(/^Search Console shows this page at about #10 on average \(1 time shown, every search and place, last 28 days\), while our check of "ai automation services pakistan" did not find it in the top 50/);
    expect(d.headNote).toContain('We check Google Pakistan (google.com.pk), desktop, not signed in; last checked 8 Nov 2026.');
    expect(d.headNote).not.toMatch(/[\u2014\u2018\u2019\u201c\u201d\u2026]/);
  });

  it('a main page whose only check came before it went live: no position, and the note says the check did not count', () => {
    const d = build({ history: [history[0]] });
    expect(d.headPosition).toBeNull();
    expect(d.statusText).toBe('2 of 2 pages live; the main keyword is not checked yet.');
    expect(d.headNote).toMatch(/^Our last check, on 30 Oct 2026, was taken before the page went live on 30 Oct 2026, so it does not count/);
  });
});

// prod 2026-11-11 (devaicon.com, "Google shows it on page one"): each page carries what Google showed in its latest check, so the ladder can
// show the top 10 with the website marked and the phone reading next to "not in the top 50"
describe('ladder pages: what Google showed in the latest check', () => {
  const rows = [lad({ ladder_id: 'g1', head_keyword: 'ai automation services pakistan', keyword: 'ai in industrial automation', rung: 2, page_no: 1, status: 'published', page_exists: true, country: 'Pakistan', target_url: 'https://novaand-demo.com/insights/ai-in-industrial-automation' })];
  const snap = JSON.stringify({ at: ago(2), device: 'desktop', top: [{ p: 1, u: 'https://kaopiz.com/', t: 'How AI in Industrial Automation Transforms Businesses', x: 1 }, { p: 2, u: 'https://google.com/goto?url=abc', t: 'hidden' }, { p: 3, u: 'https://www.ifs.com/what-is-industrial-ai', t: 'What is Industrial AI?' }] });
  const feats = JSON.stringify({ unavailable: false, checked_at: ago(2), types: ['organic', 'ai_overview'], ai_overview: { shown: true, cites_us: false, content_loaded: true, cited_domains: ['ibm.com'] } });
  const history = [
    { ladder_id: 'g1', keyword: 'ai in industrial automation', position: 0, checked_at: ago(9), device: 'desktop' },
    { ladder_id: 'g1', keyword: 'ai in industrial automation', position: 0, checked_at: ago(2), device: 'desktop', snapshot_json: snap, features_json: feats },
    { ladder_id: 'g1', keyword: 'ai in industrial automation', position: 0, checked_at: ago(2), device: 'mobile' },
  ] as RankHistoryRow[];
  it('the latest desktop snapshot (Google redirect links left out, breadcrumb sites without an address) and the phone reading', () => {
    const p = buildLadders(src({ ladders: rows, history }), sched(), { now: NOW }).details.get('g1')!.pages[0];
    expect(p.serp?.snapshot.top.map((t) => [t.position, t.url || t.host])).toEqual([[1, 'kaopiz.com'], [3, 'https://www.ifs.com/what-is-industrial-ai']]);
    expect(p.serp?.snapshot.at).toBe(ago(2));
    expect(p.serp?.mobile).toEqual({ position: 0, checkedAt: ago(2) });
    expect(p.serp?.features.aiOverview.citesUs).toBe(false);
  });
  it('never checked: no reading', () => {
    expect(buildLadders(src({ ladders: rows }), sched(), { now: NOW }).details.get('g1')!.pages[0].serp).toBeNull();
  });
});
