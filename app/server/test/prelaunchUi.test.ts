import { describe, expect, it } from 'vitest';
import {
  autopilotMonthlyUsd,
  draftNextStep,
  monitorSettingsSchema,
  MONITOR_COSTS,
  ownerEdits,
  READINESS_REASON,
  type AutomationStatus,
  type ContentLogRow,
  type CycleJobRow,
  type LadderRow,
  type Report,
} from '@seo/shared';
import type { SiteRow } from '../src/db/schema';
import { siteAutopilotRows, activityCursor } from '../src/services/billing';
import { contentCycleNote, cycleSummary, jobReason } from '../src/services/cycles';
import { buildLadders, ladderNeedsYou, type LadderSources } from '../src/services/ladders';
import { firstOf } from '../src/services/linkBuilder';
import { withScheduleTruth } from '../src/services/pipeline';
import { overviewContentCounts, overviewReports, recommend, type SiteBundle } from '../src/services/recommendations';

// App fixes from the browser pass of the paid pre-launch run on techand.ai (2026-10-21, BROWSER_REVIEW.md B1-B13, DRIVER_REPORT.md D6 / D9 /
// D11) and the E-QA rule that a not-ready draft is finished by hand, never re-run. Each case fails on the code before its fix.

const NOW = Date.parse('2026-10-21T15:30:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const lad = (o: Partial<LadderRow>) =>
  ({ ladder_id: 'lad_ai', head_keyword: 'ai consultant', keyword: '', status: 'planned', rung: 1, page_no: 1, page_type: 'Service Page', target_url: '', page_exists: false, months: '2-4', start_date: ago(0), country: 'United Arab Emirates', supporting: '', ...o }) as LadderRow;
const log = (o: Partial<ContentLogRow> & { qa_reasons?: string }) =>
  ({ site_id: 's', domain: 'techand.ai', keyword: '', source: 'ladder', page_type: 'Service Page', existing_page_url: '', rung: 0, ladder_id: '', request_id: '', started_at: ago(0), status: 'written', published_url: '', published_at: '', week: '', ...o }) as ContentLogRow;
const src = (o: Partial<LadderSources>): LadderSources => ({ ladders: [], history: [], logs: [], queries: [], settings: [], plans: [], pageReports: [], runs: [], ...o });
// the run's ladder: Direct plan, main page (rung 4) and three planned pages on rungs 1 and 2
const LADDER = [
  lad({ keyword: 'ai consultant', rung: 4, page_no: 1 }),
  lad({ keyword: 'ai consultant dubai', rung: 2, page_no: 2 }),
  lad({ keyword: 'ai consulting firm', rung: 2, page_no: 3 }),
  lad({ keyword: 'ai consulting', rung: 1, page_no: 4 }),
];

describe('D11: the ladder card names the profile hold, not "posts ahead of it"', () => {
  it('a planned page held for the author profile and the business facts says so', () => {
    const b = buildLadders(src({ ladders: LADDER }), { dated: [], cadenceRuns: ['2026-10-28T02:00:00.000Z'], rankNextAt: null, held: READINESS_REASON }, { now: NOW });
    const card = b.cards.find((c) => c.id === 'lad_ai')!;
    expect(card.next.text).toContain('waiting for your author profile and business facts');
    expect(card.next.text).not.toMatch(/after the posts ahead of it/);
    expect(card.next.kind).toBe('wait');
  });
  it('once both are on file the card reads as before', () => {
    const b = buildLadders(src({ ladders: LADDER }), { dated: [], cadenceRuns: ['2026-10-28T02:00:00.000Z'], rankNextAt: null, held: null }, { now: NOW });
    expect(b.cards[0].next.text).toMatch(/after the posts ahead of it/);
  });
});

describe('E-QA: a not-ready draft is finished by hand; Needs you opens its report', () => {
  it('the fix item points at the page\'s report and offers no re-run', () => {
    const notReady = log({ keyword: 'ai consultant', ladder_id: 'lad_ai', status: 'not_ready', qa_reasons: '2 bracket(s) left in the text for you to fill in', started_at: ago(0) });
    const b = buildLadders(
      src({ ladders: [{ ...LADDER[0], status: 'writing' } as LadderRow, ...LADDER.slice(1)], logs: [notReady], pageReports: [{ reportId: 'rep-page', runId: null, keyword: 'ai consultant', ladderId: 'lad_ai', receivedAt: ago(0) }] }),
      { dated: [], cadenceRuns: [], rankNextAt: null },
      { now: NOW },
    );
    const fix = ladderNeedsYou(b).find((i) => i.id === 'fix:lad_ai')!;
    expect(fix.action).toEqual({ label: 'See what to edit', reportId: 'rep-page' });
    expect(fix.detail).toContain('finish by hand');
    expect(fix.detail).not.toMatch(/run (it|them) again/);
  });
  it('the next step and the edits come from the engine, and an older report gets the same advice in general words', () => {
    const p = { qa_not_ready: true, qa_next_step: 'Finish this draft by hand: delete [fee band]. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.', qa_owner_edits: [{ token: '[fee band]', count: 1, action: 'delete', text: 'Delete [fee band] and the words that need it' }] };
    expect(draftNextStep(p)).toBe(p.qa_next_step);
    expect(ownerEdits(p)).toEqual([{ token: '[fee band]', count: 1, action: 'delete', text: 'Delete [fee band] and the words that need it' }]);
    expect(draftNextStep({ qa_not_ready: true })).toMatch(/^Finish this draft by hand: .* You do not need a new run/);
    expect(ownerEdits({ qa_not_ready: true })).toEqual([]);
    // the quality block inside meta.json carries the same fields
    expect(ownerEdits({ meta: { quality: { owner_edits: [{ token: '[x]', count: 2 }] } } })[0]).toMatchObject({ token: '[x]', count: 2, text: expect.stringContaining('[x]') });
  });
});

describe('D9: every job of the cycle says what happened, in plain words', () => {
  it('"already run when tracking was set up (execution 16 ...)" is not "Not needed this week"', () => {
    const r = jobReason('skipped', 'already run when tracking was set up (execution 16, finished 2026-10-21T14:15:02Z), so cycle 0 does not run it twice', 0, 'site_tracker');
    expect(r).toBe('Already ran when tracking was set up today, so this first run does not repeat it');
    expect(r).not.toMatch(/execution|\d{2}/);
  });
  it('a done job always has a sentence; the content job names why it wrote nothing', () => {
    expect(jobReason('done', 'finished: its ledger row cycle:x settled (execution 30)', 1, 'ai_visibility')).toBe('Done: the AI visibility report is under Reports');
    expect(jobReason('done', '', 1, 'audit')).toMatch(/^Started the audit/);
    const notes = contentCycleNote({ cycle_key: 'cyc:site_techand-ai:2026-10-21', pages: [], reason: `${READINESS_REASON}: 1 page is ready to write once you add your business facts (Website settings); nothing is written or charged until then` });
    const job = { key: '', site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-21', job: 'content_cadence', workflow_id: '', status: 'done', attempts: 1, run_id: '30', ledger_key: '', monthly: true, reason: 'finished: its ledger row settled (execution 30)', due_at: '', started_at: '', finished_at: '', updated_at: '' } as CycleJobRow;
    const s = cycleSummary('cyc:site_techand-ai:2026-10-21', [job], '2026-10-21', notes);
    expect(s.jobs[0].reason).toMatch(/^Wrote nothing: waiting for your author profile and business facts/);
    expect(contentCycleNote({ cycle_key: 'k', pages: [{ keyword: 'ai consultant' }] })).toEqual({ k: { content_cadence: 'Started 1 page: "ai consultant"' } });
    expect(contentCycleNote({ pages: [] })).toEqual({});
  });
});

describe('B4: one forecast for the Pipeline and the Credits page', () => {
  const site = { autopilotLevel: 2, blogsPerWeek: 1 } as SiteRow;
  it('a website with a keyword ladder forecasts its weekly rank check, on every screen that reads the rows', () => {
    const rows = siteAutopilotRows(site, null, LADDER, []);
    expect(rows.find((r) => r.id === 'rank_tracker')).toMatchObject({ on: true, usd: MONITOR_COSTS.rankTrackerMonthly });
    const total = rows.reduce((t, r) => t + r.usd, 0);
    const m = monitorSettingsSchema.parse({ brandNames: [], aiPersonas: [], aiMarkets: [] });
    expect(total).toBeCloseTo(autopilotMonthlyUsd(m, 1, { level: 2, writing: true, ranking: true }), 4);
    // 573 against 567 credits in the run: the rank check (6 credits at 60 a dollar) is the whole difference
    expect(Math.round((autopilotMonthlyUsd(m, 1, { level: 2, writing: true, ranking: true }) - autopilotMonthlyUsd(m, 1, { level: 2, writing: true })) * 60)).toBe(6);
  });
  it('no ladder: no rank check', () => {
    expect(siteAutopilotRows(site, null, [], []).find((r) => r.id === 'rank_tracker')).toMatchObject({ on: false, usd: 0 });
  });
});

describe('B2: the Overview counts written pages the way the Content page does', () => {
  it('a not-ready draft is written, not waiting to publish; every page is in exactly one bucket', () => {
    const c = overviewContentCounts([{ status: 'not_ready', publishedUrl: '' }], { pagesPerWeek: 1, caseStudies: 0 });
    expect(c).toMatchObject({ started: 1, published: 0, pendingPublish: 0, needsFix: 1 });
    const mixed = overviewContentCounts([{ status: 'written', publishedUrl: '' }, { status: 'written', publishedUrl: 'https://techand.ai/x' }, { status: 'published', publishedUrl: '' }], { pagesPerWeek: 1, caseStudies: 0 });
    expect(mixed).toMatchObject({ started: 3, published: 2, pendingPublish: 1, needsFix: 0 });
  });
});

describe('B13: the Overview\'s latest reports are results, not the "Coming up" plan', () => {
  it('drops cycle_preview and keeps six', () => {
    const r = (stage: string, i: number) => ({ id: `r${i}`, stage }) as unknown as Report;
    const list = [r('cycle_preview', 0), r('cycle_preview', 1), ...Array.from({ length: 8 }, (_, i) => r('ai_pulse', i + 2))];
    const out = overviewReports(list);
    expect(out).toHaveLength(6);
    expect(out.some((x) => x.stage === 'cycle_preview')).toBe(false);
  });
});

describe('B3 / B9: recommendations', () => {
  const SITE = { id: 's1', domain: 'techand.ai', trackingStatus: 'active', keywords: [] } as unknown as SiteRow;
  const bundle = (o: Partial<SiteBundle>): SiteBundle => {
    const tracking = { tracked: true, status: 'active', gscProperty: 'sc-domain:techand.ai', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true };
    return {
      search: { connection: tracking, snapshot: null, metrics: [], queries: [], periods: [], trends: [], annotations: [], dataBreaks: [], changeTests: [], lineage: [] },
      rankings: { ladders: [], keywords: [], lineage: [] },
      content: { items: [], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
      technical: { audits: [], selectedAuditId: null, previousAuditId: null, findings: [], byCategory: [], reports: [], watch: null, indexCoverage: null },
      ai: { runs: [], latest: null, daily: [], prompts: [], answers: [], growth: null, report: null },
      backlinks: { snapshots: [], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
      alerts: { alerts: [], checkins: [], checkinDue: false },
      settings: { tracking, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
      rankNext: null,
      reportsElsewhere: false,
      ...o,
    } as unknown as SiteBundle;
  };
  it('B9: a High-severity finding is never labelled "medium" priority', () => {
    const finding = (key: string, impact: number) => ({ key, category: 'Authority', severity: 'High', title: key, affectedCount: 1, previousCount: null, status: 'open', impact, impactBasis: `the whole website · High severity`, recheck: null });
    const recs = recommend(SITE, bundle({ technical: { ...bundle({}).technical, findings: ['a', 'b', 'c', 'd', 'e'].map((k, i) => finding(k, 50 - i)) } as SiteBundle['technical'] })).filter((r) => r.id.startsWith('tech:'));
    expect(recs).toHaveLength(5);
    expect(recs.every((r) => r.priority === 'high')).toBe(true);
  });
  it('B3: the IndexNow recommendation carries the site\'s own key for its guide', () => {
    const growth = { submitted: { indexnow: { verified: false, key: 'ce8ff0a7aaaa', keyUrl: 'https://techand.ai/ce8ff0a7aaaa.txt', submitted: 0 }, bing: { submitted: 0 } }, earned: [] };
    const rec = recommend(SITE, bundle({ ai: { ...bundle({}).ai, growth } as unknown as SiteBundle['ai'] })).find((r) => r.id === 'ai:indexnow');
    expect(rec?.guideVars).toEqual({ indexNowKey: 'ce8ff0a7aaaa', indexNowFile: 'ce8ff0a7aaaa.txt', indexNowUrl: 'https://techand.ai/ce8ff0a7aaaa.txt' });
  });
  it('E-QA: a not-ready draft with a page report opens it, never a run', () => {
    const items = [{ keyword: 'ai consultant', source: 'ladder', pageType: 'Service Page', rung: 4, ladderId: 'lad_ai', requestId: '', startedAt: ago(0), status: 'not_ready', publishedUrl: '', publishedAt: '', week: '', existingPageUrl: '', qaReasons: '2 brackets' }];
    const generated = [{ id: 'rep-page', stage: 'page_content', summary: { keyword: 'ai consultant' }, receivedAt: ago(0) }];
    const rec = recommend(SITE, bundle({ content: { ...bundle({}).content, items, generated } as unknown as SiteBundle['content'] })).find((r) => r.id === 'content:fix:ai consultant');
    expect(rec?.action).toEqual({ label: 'See what to edit', report: 'rep-page' });
  });
});

describe('Low: a schedule fire before the website existed is not "missed"', () => {
  it('the pulse of a website added at 14:08 is not "missed" for its 10:30 due time', () => {
    const auto = { id: 'ai_pulse', state: 'on', reason: null, nextRunAt: null, lastRunAt: null, lastResult: null, lastReportId: null, monthlyCredits: 0, detail: null } as AutomationStatus;
    const at = new Date('2026-10-21T15:30:00Z');
    const [before] = withScheduleTruth([auto], { SEOagentAIPulse1: [] }, 'America/New_York', at);
    expect(before.lastResult ?? '').toMatch(/scheduled run missed on 2026-10-21/);
    const [after] = withScheduleTruth([auto], { SEOagentAIPulse1: [] }, 'America/New_York', at, '2026-10-21T14:08:00.000Z');
    expect(after.lastResult ?? '').not.toMatch(/missed/);
  });
});

describe('B8 / B12: lists without duplicates, the credit activity in time order', () => {
  it('firstOf keeps one item per key', () => {
    expect([{ k: 'a', n: 1 }, { k: 'a', n: 2 }, { k: 'b', n: 3 }].filter(firstOf((x) => x.k)).map((x) => x.n)).toEqual([1, 3]);
  });
  it('the activity cursor is time and booking order; an older bare seq still reads', () => {
    expect(activityCursor('1761058440000_42')).toEqual({ ms: 1761058440000, seq: '42' });
    expect(activityCursor('42')).toEqual({ seq: '42' });
    expect(activityCursor('x')).toBeNull();
    expect(activityCursor(undefined)).toBeNull();
  });
});
