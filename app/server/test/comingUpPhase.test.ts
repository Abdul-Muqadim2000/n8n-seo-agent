import { describe, expect, it } from 'vitest';
import type { CyclePreviewRow } from '../src/db/schema';
import { approvedResult, comingUpView, notWrittenMessage, planPhase, plainDetail, runOutcome, type PlanRun } from '../src/services/comingUp';

// I3 (2026-11-10, devaicon.com): "I approved the weekly item but it still shows wait; wait for what? It shows a past date." The plan of
// the 11-06 run was still titled "Coming up" on 11-10, its approved suggestion sat under "Waits for your OK" with a green tick although
// the run never wrote it, and the plan-time pile-up banner stayed up although the run was not paused. These tests pin the server half.

const H = 3_600_000;
const CYCLE = 'cyc:site_devaicon-com:2026-11-06';
const DUE = Date.parse('2026-11-06T01:00:00.000Z');
const TUESDAY = Date.parse('2026-11-10T12:00:00.000Z');
const SUGGESTION = 'ai industrial automation pakistan';

// the plan as production holds it (received Wed 11-04 01:03 UTC): writing paused for the pile-up, one AI refresh suggested
const body = {
  stage: 'cycle_preview', site_id: 'site_devaicon-com', domain: 'devaicon.com', cycle_key: CYCLE, scheduled_for: '2026-11-06T01:00:00.000Z', level: 2, pages_per_week: 2,
  waiting_for_keyword: false, paused_reason: 'pileup', reason: '3 written pages are waiting to be published (limit 3)', items: [],
  suggestions: [{ keyword: SUGGESTION, source: 'ai_refresh', auto: false, est_usd: 1.322, ai_target: { target_id: 'ait_devaicon-com_q_0ip57ck1bn048o', kind: 'refresh', question: 'Which companies build AI for industrial automation in Pakistan?' } }],
};
const preview = { id: 'cp', siteId: 's', orgId: 'o', cycleKey: CYCLE, scheduledFor: new Date(DUE), body, reportId: null, receivedAt: new Date('2026-11-04T01:03:00.000Z'), emailedAt: null } as CyclePreviewRow;
// approve (11-04), skip (11-04), approve again (11-05): one row per key, the last approve is what seo_skips holds
const skips = [{ key: `site_devaicon-com:${CYCLE}:${SUGGESTION}`, site_id: 'site_devaicon-com', cycle_key: CYCLE, item_key: SUGGESTION, decision: 'approve', scope: 'cycle', by: 'client@devaicon.com', created_at: '2026-11-05T15:45:00.000Z', source: 'ai_refresh', ladder_id: '' }];

// the run's own content report (cadence 10606, 01:28 UTC): it wrote ladder rung 2, said nothing of the approval (an older engine)
const report = (extra: Record<string, unknown> = {}) => ({
  payload: {
    stage: 'content_cadence', cycle_key: CYCLE, paused_reason: '', waiting_publish: 1, max_waiting: 3, approved_items: [], reason: '',
    pages: [{ keyword: 'ai app development companies', source: 'ladder', auto: true, approved: false, item_key: 'ai app development companies', request_id: 'cad_20261106_devaicon-com_2' }],
    ...extra,
  },
  receivedAt: new Date('2026-11-06T01:28:15.000Z'),
});
const run = (o: Partial<PlanRun> = {}): PlanRun => ({
  job: { status: 'done', finished_at: '2026-11-06T01:28:15.000Z' },
  currentKey: CYCLE,
  report: report(),
  pageReports: [{ id: 'rep-page-1', requestId: 'cad_20261106_devaicon-com_2', status: 'completed', receivedAt: new Date('2026-11-06T01:46:19.000Z') }],
  nextPreviewAt: '2026-11-11T01:00:00.000Z',
  nextDueAt: '2026-11-13T01:00:00.000Z',
  ...o,
});
const view = (o: { now?: number; run?: PlanRun | null } = {}) =>
  comingUpView({ site: { id: 's', domain: 'devaicon.com' }, preview, skips: skips as never, role: 'owner', now: o.now ?? TUESDAY, credits: (u) => Math.ceil(u * 60), run: o.run === undefined ? run() : o.run });

describe('I3: where the plan\'s run stands', () => {
  it('upcoming before it is due, running while its writing job has not finished, done once it finished', () => {
    expect(planPhase({ due: DUE, now: DUE - H, cycleKey: CYCLE, run: run() })).toBe('upcoming');
    expect(planPhase({ due: DUE, now: DUE + 10 * 60_000, cycleKey: CYCLE, run: run({ job: { status: 'running', finished_at: '' }, report: null }) })).toBe('running');
    expect(planPhase({ due: DUE, now: DUE + H, cycleKey: CYCLE, run: run({ job: { status: 'failed', finished_at: '' }, report: null }) })).toBe('running');
    for (const status of ['done', 'skipped', 'gave_up'] as const) expect(planPhase({ due: DUE, now: DUE + H, cycleKey: CYCLE, run: run({ job: { status, finished_at: '' }, report: null }) })).toBe('done');
  });
  it('done from the run\'s report alone, from a later cycle, or after a day with no word; never from a missing due time', () => {
    expect(planPhase({ due: DUE, now: DUE + H, cycleKey: CYCLE, run: run({ job: null }) })).toBe('done');
    expect(planPhase({ due: DUE, now: DUE + H, cycleKey: CYCLE, run: run({ job: null, report: null, currentKey: 'cyc:site_devaicon-com:2026-11-13' }) })).toBe('done');
    expect(planPhase({ due: DUE, now: DUE + 23 * H, cycleKey: CYCLE, run: null })).toBe('running');
    expect(planPhase({ due: DUE, now: DUE + 25 * H, cycleKey: CYCLE, run: null })).toBe('done');
    expect(planPhase({ due: NaN, now: TUESDAY, cycleKey: CYCLE })).toBe('upcoming');
  });
});

describe('I3: the devaicon.com plan of 11-06 seen on Tuesday 11-10', () => {
  it('is done, says what the run wrote (with its page) and when the next plan and run come', () => {
    const v = view();
    expect(v).toMatchObject({ phase: 'done', closed: true, nextPreviewAt: '2026-11-11T01:00:00.000Z', nextDueAt: '2026-11-13T01:00:00.000Z' });
    expect(v.outcome).toEqual({
      known: true,
      at: '2026-11-06T01:28:15.000Z',
      pages: [{ keyword: 'ai app development companies', source: 'ladder', approved: false, state: 'written', at: '2026-11-06T01:46:19.000Z', reportId: 'rep-page-1' }],
      pausedReason: '',
      waitingPublish: 1,
      note: '',
    });
  });
  it('the approved suggestion keeps its approval, and says it was not written, with no invented reason (the old report gives none)', () => {
    const s = view().suggestions[0];
    expect(s.decision).toMatchObject({ decision: 'approve', by: 'client@devaicon.com' });
    expect(s.result).toEqual({ state: 'not_written', at: null, reportId: null, message: 'Not written in that run.' });
    expect(s).toMatchObject({ canApprove: false, canSkip: false });
    expect(view().approvedNotWritten).toEqual([]);
  });
  it('with the new engine\'s reason (no_longer_offered) the row says why and what to do', () => {
    const detail = 'The question left your AI panel because it is about Pakistan and your market is the UAE.';
    const v = view({ run: run({ report: report({ approved_not_written: [{ keyword: SUGGESTION, source: 'ai_refresh', reason: 'no_longer_offered', detail }] }) }) });
    expect(v.suggestions[0].result?.message).toBe(
      `Your OK for "${SUGGESTION}" was not used: the question left your AI panel because it is about Pakistan and your market is the UAE. Use Write it now if you still want this page.`,
    );
    // the row carries it: the separate list does not repeat it
    expect(v.approvedNotWritten).toEqual([]);
    expect(JSON.stringify(v.suggestions[0].result)).not.toMatch(/—|…|[“”]|seo_|ait_/);
  });
  it('an approval the run wrote shows "written" with its page; one it only started shows "started"', () => {
    const wrote = run({ report: report({ pages: [{ keyword: SUGGESTION, source: 'ai_refresh', approved: true, request_id: 'cad_x_1' }] }), pageReports: [{ id: 'rep-2', requestId: 'cad_x_1', status: 'completed', receivedAt: new Date('2026-11-06T01:50:00.000Z') }] });
    expect(view({ run: wrote }).suggestions[0].result).toEqual({ state: 'written', at: '2026-11-06T01:50:00.000Z', reportId: 'rep-2', message: '' });
    expect(view({ run: { ...wrote, pageReports: [] } }).suggestions[0].result).toMatchObject({ state: 'started', reportId: null, at: '2026-11-06T01:28:15.000Z' });
    expect(view({ run: { ...wrote, pageReports: [{ id: 'rep-3', requestId: 'cad_x_1', status: 'failed', receivedAt: new Date() }] } }).suggestions[0].result).toMatchObject({ state: 'failed', reportId: null });
  });
  it('before the run is due nothing has a result, and the next plan / run times in the past are not shown', () => {
    const v = view({ now: DUE - 2 * H, run: run({ nextPreviewAt: '2026-11-04T01:00:00.000Z', nextDueAt: '2026-11-06T01:00:00.000Z' }) });
    expect(v).toMatchObject({ phase: 'upcoming', closed: false, outcome: null, nextPreviewAt: null, nextDueAt: '2026-11-06T01:00:00.000Z' });
    expect(v.suggestions[0].result).toBeUndefined();
    expect(v.suggestions[0].canSkip).toBe(true);
  });
  it('done with no report of the run: no result is claimed for the approval', () => {
    const v = view({ run: run({ report: null, pageReports: [] }) });
    expect(v.phase).toBe('done');
    expect(v.outcome).toMatchObject({ known: false, at: '2026-11-06T01:28:15.000Z', pages: [] });
    expect(v.suggestions[0].result).toBeNull();
  });
});

describe('I3: what a run did and why an approval was not used', () => {
  it('a run held by the pile-up: the approval says so (the run\'s own word, not the plan\'s)', () => {
    const o = runOutcome(run({ report: report({ pages: [], paused_reason: 'pileup', waiting_publish: 3 }) }));
    expect(o).toMatchObject({ known: true, pages: [], pausedReason: 'pileup', waitingPublish: 3 });
    expect(approvedResult({ keyword: 'x', outcome: o, reported: [], planned: [] })?.message).toMatch(/^Your OK for "x" waits: pages we already wrote are waiting to be published/);
  });
  it('a run that wrote nothing says why in plain words, never the machinery', () => {
    expect(runOutcome(run({ report: report({ pages: [], reason: 'nothing left to write this week (execution 1234)' }) })).note).toBe('nothing left to write this week');
    expect(runOutcome(run({ report: report({ pages: [], reason: 'seo_ladders row missing' }) })).note).toBe('');
  });
  it('the reason the run gave wins over the plan\'s; the plan\'s is used when the run gave none', () => {
    const o = runOutcome(run());
    expect(approvedResult({ keyword: 'a', outcome: o, reported: [{ keyword: 'a', source: 'x', reason: 'budget' }], planned: [{ keyword: 'a', source: 'x', reason: 'covered_by_live_page' }] })?.message).toMatch(/did not fit/);
    expect(approvedResult({ keyword: 'a', outcome: o, reported: [], planned: [{ keyword: 'a', source: 'x', reason: 'covered_by_live_page' }] })?.message).toMatch(/already answers this search/);
  });
  it('no_longer_offered without a usable detail still reads as a sentence; internal words never reach the customer', () => {
    expect(notWrittenMessage({ keyword: 'k', reason: 'no_longer_offered' })).toEqual({ keyword: 'k', reason: 'no_longer_offered', message: 'Your OK for "k" was not used: this page was no longer offered when the run started. Use Write it now if you still want this page.' });
    expect(notWrittenMessage({ keyword: 'k', reason: 'no_longer_offered', detail: 'target ait_x status skipped in seo_ai_targets' }).message).toContain('no longer offered');
    expect(plainDetail('The AI check — retired it…')).toBe('the AI check, retired it');
    expect(plainDetail('UAE market only.')).toBe('UAE market only');
  });
});
