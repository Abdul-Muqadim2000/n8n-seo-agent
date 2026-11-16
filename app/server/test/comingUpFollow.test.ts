import { describe, expect, it } from 'vitest';
import type { CyclePreviewRow } from '../src/db/schema';
import { comingUpView, followResult, laterPage, notWrittenMessage, planPageLog, type PlanLogRow, type PlanPages, type PlanRun } from '../src/services/comingUp';

// Client report 2026-11-16 b (devaicon.com): "I have written this page but it still says the page is not written. I have also published the page
// but in the pipeline it shows not published." The 13 Nov plan's run wrote two pages and not the client's approved AI page "custom ai solutions
// uae"; on 16 Nov the client had it written with Write it now (09:20), made its final version and marked it published (11:40). Coming up kept
// showing the finished plan: the approval "Not written · Not written in that run." and the two pages the run wrote only "Written on ...", never
// that they were live. The finished plan now follows its pages: an approval the client wrote since is that page (by you), and every page says when
// it went live. Shapes as production holds them (seo_content_log rows, the plan, the run's report); values synthetic.

const H = 3_600_000;
const CYCLE = 'cyc:site_devaicon-com:2026-11-13';
const DUE = Date.parse('2026-11-13T01:00:00.000Z');
const NOW = Date.parse('2026-11-16T13:00:00.000Z');
const APPROVED = 'custom ai solutions uae';
const D = 'https://devaicon.com';

const body = {
  stage: 'cycle_preview', site_id: 'site_devaicon-com', domain: 'devaicon.com', cycle_key: CYCLE, scheduled_for: '2026-11-13T01:00:00.000Z', level: 2, pages_per_week: 2,
  waiting_for_keyword: false, paused_reason: '', reason: '', approved_not_written: [],
  items: [
    { keyword: 'ai app development', source: 'ladder', auto: true, est_usd: 1.3, item_key: 'ai app development' },
    { keyword: 'agentic ai development in uae', source: 'ladder', auto: true, est_usd: 1.3, item_key: 'agentic ai development in uae' },
  ],
  suggestions: [{ keyword: APPROVED, source: 'ai_answer', auto: false, est_usd: 1.3, item_key: APPROVED, ai_target: { target_id: 'ait_devaicon-com_q_x', kind: 'answer', question: 'Which firms build custom AI solutions?' } }],
};
const preview = { id: 'cp', siteId: 's', orgId: 'o', cycleKey: CYCLE, scheduledFor: new Date(DUE), body, reportId: null, receivedAt: new Date('2026-11-11T01:03:10.000Z'), emailedAt: null } as CyclePreviewRow;
const skips = [{ key: `site_devaicon-com:${CYCLE}:${APPROVED}`, site_id: 'site_devaicon-com', cycle_key: CYCLE, item_key: APPROVED, decision: 'approve', scope: 'cycle', by: 'client@example.com', created_at: '2026-11-11T11:53:45.000Z', source: 'ai_answer', ladder_id: '' }];
// the run's own report (13 Nov 01:28): two pages, and (an engine before this fix) nothing about the approval
const run: PlanRun = {
  job: { status: 'done', finished_at: '2026-11-13T01:28:26.000Z' },
  currentKey: CYCLE,
  report: {
    payload: {
      stage: 'content_cadence', cycle_key: CYCLE, paused_reason: '', approved_items: [{ keyword: APPROVED, source: 'ai_answer', item_key: APPROVED }],
      pages: [
        { keyword: 'agentic ai development in uae', source: 'ladder', auto: true, approved: false, request_id: 'cad_20261113_devaicon-com_1' },
        { keyword: 'governed vs autonomous ai agents', source: 'ai_answer', auto: true, approved: false, request_id: 'cad_20261113_devaicon-com_2' },
      ],
    },
    receivedAt: new Date('2026-11-13T01:28:26.000Z'),
  },
  pageReports: [
    { id: 'rep-agentic', requestId: 'cad_20261113_devaicon-com_1', status: 'completed', receivedAt: new Date('2026-11-13T02:10:20.000Z') },
    { id: 'rep-governed', requestId: 'cad_20261113_devaicon-com_2', status: 'completed', receivedAt: new Date('2026-11-13T02:07:46.000Z') },
  ],
  nextPreviewAt: '2026-11-18T01:00:00.000Z',
  nextDueAt: '2026-11-20T01:00:00.000Z',
};
const log = (o: Partial<PlanLogRow>): PlanLogRow => ({ keyword: '', status: 'written', published_url: '', published_at: '', started_at: '', request_id: '', ...o });
const LOGS: PlanLogRow[] = [
  log({ keyword: APPROVED, status: 'published', request_id: '14845', started_at: '2026-11-16T09:20:37.207Z', published_url: `${D}/insights/custom-ai-solutions-uae`, published_at: '2026-11-16T11:40:49.841Z' }),
  log({ keyword: 'governed vs autonomous ai agents', status: 'published', request_id: 'cad_20261113_devaicon-com_2', started_at: '2026-11-13T01:28:16.132Z', published_url: `${D}/insights/governed-vs-autonomous-ai-agents`, published_at: '2026-11-13T11:08:43.759Z' }),
  log({ keyword: 'agentic ai development in uae', status: 'published', request_id: 'cad_20261113_devaicon-com_1', started_at: '2026-11-13T01:28:10.000Z', published_url: `${D}/services/agentic-ai-development-in-uae`, published_at: '2026-11-13T09:30:00.000Z' }),
];
const pages = (logs: PlanLogRow[] = LOGS): PlanPages => ({ logs, reportOf: (id) => (id === '14845' ? 'rep-custom' : null) });
const view = (p: PlanPages | null = pages()) => comingUpView({ site: { id: 's', domain: 'devaicon.com' }, preview, skips: skips as never, role: 'owner', now: NOW, credits: (u) => Math.ceil(u * 60), run, pages: p });

describe('client report 2026-11-16 b: a finished plan follows its pages', () => {
  it('reproduces the report without the pages (an older server): the approval reads "Not written in that run."', () => {
    const it0 = view(null).suggestions.find((s) => s.keyword === APPROVED)!;
    expect(it0.result).toMatchObject({ state: 'not_written', message: 'Not written in that run.' });
  });
  it('the approval the client had written and published since is that page: written by you, live, with its report', () => {
    const r = view().suggestions.find((s) => s.keyword === APPROVED)!.result!;
    expect(r).toMatchObject({ state: 'written', by: 'you', reportId: 'rep-custom', at: '2026-11-16T09:20:37.207Z', publishedUrl: `${D}/insights/custom-ai-solutions-uae`, publishedAt: '2026-11-16T11:40:49.841Z' });
  });
  it('the pages the run wrote say where they are live', () => {
    const o = view().outcome!;
    expect(o.pages.map((p) => [p.keyword, p.state, p.publishedUrl])).toEqual([
      ['agentic ai development in uae', 'written', `${D}/services/agentic-ai-development-in-uae`],
      ['governed vs autonomous ai agents', 'written', `${D}/insights/governed-vs-autonomous-ai-agents`],
    ]);
  });
  it('a page written before the plan was offered is not taken for the approval (it was not written for it)', () => {
    const old = [log({ keyword: APPROVED, status: 'published', request_id: '900', started_at: '2026-11-01T00:00:00.000Z', published_url: `${D}/old` })];
    expect(view(pages(old)).suggestions.find((s) => s.keyword === APPROVED)!.result).toMatchObject({ state: 'not_written' });
  });
  it('written and not published yet: by you, no address; being written: started; failed or held: still not written', () => {
    const since = preview.receivedAt.getTime();
    const one = (o: Partial<PlanLogRow>) => pages([log({ keyword: APPROVED, request_id: '1', ...o })]);
    expect(laterPage(one({ status: 'written', started_at: '2026-11-16T09:20:00.000Z' }), APPROVED, since, NOW)).toMatchObject({ state: 'written' });
    expect(laterPage(one({ status: 'started', started_at: new Date(NOW - H).toISOString() }), APPROVED, since, NOW)).toMatchObject({ state: 'started' });
    expect(laterPage(one({ status: 'started', started_at: new Date(NOW - 9 * H).toISOString() }), APPROVED, since, NOW)).toBeNull();
    for (const status of ['failed', 'held']) expect(laterPage(one({ status, started_at: '2026-11-16T09:20:00.000Z' }), APPROVED, since, NOW)).toBeNull();
    const w = followResult({ state: 'not_written', at: null, reportId: null, message: 'Not written in that run.' }, APPROVED, pages([log({ keyword: APPROVED, status: 'written', request_id: '14845', started_at: '2026-11-16T09:20:00.000Z' })]), since, '', NOW)!;
    expect(w).toMatchObject({ state: 'written', by: 'you', reportId: 'rep-custom' });
    expect(w.publishedUrl).toBeUndefined();
  });
  it('review H1: a page written again and not republished is not live (the row keeps its old address and date)', () => {
    const since = preview.receivedAt.getTime();
    const rew = log({ keyword: APPROVED, status: 'written', request_id: '14845', started_at: '2026-11-16T09:20:00.000Z', published_url: `${D}/old-address`, published_at: '2026-10-02T10:00:00.000Z' });
    const r = followResult({ state: 'not_written', at: null, reportId: null, message: '' }, APPROVED, pages([rew]), since, '', NOW)!;
    expect(r).toMatchObject({ state: 'written', by: 'you' });
    expect(r.publishedUrl).toBeUndefined();
    const runPage = followResult({ state: 'written', at: '2026-11-13T02:00:00.000Z', reportId: 'x', message: '' }, 'k', pages([{ ...rew, keyword: 'k', request_id: 'cad_1' }]), since, 'cad_1', NOW)!;
    expect(runPage.publishedUrl).toBeUndefined();
  });
  it('review M2: the app reopened an older row of the search (old start date kept): found through its report since the plan', () => {
    const reopened = log({ keyword: APPROVED, status: 'published', request_id: '14845', started_at: '2026-10-01T00:00:00.000Z', published_url: `${D}/insights/custom-ai-solutions-uae`, published_at: '2026-11-16T11:40:00.000Z' });
    expect(followResult({ state: 'not_written', at: null, reportId: null, message: '' }, APPROVED, pages([reopened]), preview.receivedAt.getTime(), '', NOW)).toMatchObject({ state: 'written', by: 'you', reportId: 'rep-custom' });
    const noReport = { ...reopened, request_id: '777' };
    expect(followResult({ state: 'not_written', at: null, reportId: null, message: '' }, APPROVED, pages([noReport]), preview.receivedAt.getTime(), '', NOW)).toMatchObject({ state: 'not_written' });
  });
  it('review M3: the run\'s own page is never credited to the client; a later system run reads "later", not "you"', () => {
    const since = preview.receivedAt.getTime();
    const own = log({ keyword: APPROVED, status: 'started', request_id: 'cad_20261113_devaicon-com_3', started_at: new Date(NOW - H).toISOString() });
    expect(followResult({ state: 'failed', at: null, reportId: null, message: 'x' }, APPROVED, pages([own]), since, 'cad_20261113_devaicon-com_3', NOW, new Set(['cad_20261113_devaicon-com_3']))).toMatchObject({ state: 'failed' });
    const retry = log({ keyword: APPROVED, status: 'written', request_id: 'cad_20261113_devaicon-com_9', started_at: '2026-11-14T01:00:00.000Z' });
    expect(followResult({ state: 'not_written', at: null, reportId: null, message: '' }, APPROVED, pages([retry]), since, '', NOW)).toMatchObject({ state: 'written', by: 'later' });
  });
  it('review L8: a draft that failed its quality check needs a fix, never "publish it"', () => {
    const r = followResult({ state: 'not_written', at: null, reportId: null, message: '' }, APPROVED, pages([log({ keyword: APPROVED, status: 'not_ready', request_id: '14845', started_at: '2026-11-16T09:20:00.000Z' })]), preview.receivedAt.getTime(), '', NOW)!;
    expect(r).toMatchObject({ state: 'written', by: 'you', needsFix: true });
  });
  it('review L4: the run page fallback by search is bounded by the plan (a months-old page of the search is not this run\'s)', () => {
    const old = [log({ keyword: 'agentic ai development in uae', status: 'published', request_id: 'x', started_at: '2026-08-01T00:00:00.000Z', published_url: `${D}/old` })];
    expect(planPageLog(old, 'agentic ai development in uae', '', preview.receivedAt.getTime())).toBeNull();
  });
  it('a page the run started that failed, then the client wrote it: the client\'s page', () => {
    const r = followResult({ state: 'failed', at: null, reportId: null, message: 'x' }, APPROVED, pages(), preview.receivedAt.getTime(), 'cad_x', NOW)!;
    expect(r).toMatchObject({ state: 'written', by: 'you' });
  });
  it('the run\'s own page is found by its request id first, else by its search', () => {
    expect(planPageLog(LOGS, 'agentic ai development in uae', 'cad_20261113_devaicon-com_1')?.request_id).toBe('cad_20261113_devaicon-com_1');
    expect(planPageLog(LOGS, 'Agentic AI development in UAE')?.published_url).toBe(`${D}/services/agentic-ai-development-in-uae`);
    expect(planPageLog(LOGS, 'nothing like it')).toBeNull();
  });
  it('a same-page hold has its own plain reason with the address (never "your pages a week are already used")', () => {
    const m = notWrittenMessage({ keyword: APPROVED, reason: 'same_page', detail: `${D}/services/ai-app-development-companies` });
    expect(m.reason).toBe('same_page');
    expect(m.message).toBe(`"${APPROVED}" waits: the page of your website it would change (/services/ai-app-development-companies) already has another change this week, and we change a page only once a week. We bring it back in your next plan by itself, as long as it is still a page we would write.`);
    expect(m.message).not.toMatch(/[—–…]|\$|seo_|cad_/);
  });
});
