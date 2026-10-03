import { describe, expect, it } from 'vitest';
import type { AutomationStatus, PipelineData } from './data';
import { pipelineNotices } from './pipeline-notices';

const NOW = new Date('2026-10-03T12:00:00Z');

function auto(id: AutomationStatus['id'], state: AutomationStatus['state'], nextRunAt: string | null): AutomationStatus {
  return { id, state, reason: null, nextRunAt, lastRunAt: '2026-09-29T11:05:00Z', lastResult: 'Named in 0% of 41 answers', lastReportId: 'rep-1', monthlyCostUsd: 1, detail: null };
}

function data(over: Partial<PipelineData> = {}): PipelineData {
  return {
    timezone: 'America/New_York',
    tracking: { status: 'active', verified: true, reportsToThisApp: true, engineEmails: false },
    stages: [],
    automations: [
      auto('ai_visibility', 'on', '2026-10-05T11:00:00Z'),
      auto('backlinks', 'on', '2026-10-05T11:30:00Z'),
      auto('audit', 'on', '2026-11-01T10:00:00Z'),
      auto('content_cadence', 'on', '2026-10-05T14:00:00Z'),
    ],
    queue: {
      pagesPerWeek: 1,
      next: [{ keyword: 'e invoicing in uae', source: 'ladder', why: 'Keyword ladder, rung 1', pageType: 'Service Page', existingPageUrl: '', ladder: { id: 'lad1', rung: 1, head: 'e invoicing', pageNo: 2 } }],
      later: [{ keyword: 'vat invoice format', source: 'striking', why: 'Ranks #7', pageType: 'Guide', existingPageUrl: 'https://www.techand.ai/blog/vat', ladder: null }],
      waiting: [],
      engineUpcoming: [],
      engineUpcomingAt: null,
    },
    calendar: [],
    activity: [],
    monthlyCostUsd: 3,
    running: [],
    activeRuns: [],
    written: [
      { keyword: 'FTA e-invoicing rules', status: 'published', startedAt: '2026-09-20T10:00:00Z', publishedUrl: 'https://techand.ai/fta-rules/', source: 'cadence' },
      { keyword: 'peppol uae', status: 'started', startedAt: '2026-10-01T10:00:00Z', publishedUrl: '', source: 'app' },
    ],
    ladders: [
      {
        id: 'lad1',
        head: 'E-invoicing',
        pages: 9,
        published: 1,
        planned: [{ keyword: 'einvoicing software dubai', rung: 2, pageNo: 5, pageType: 'Service Page' }],
        keywords: ['e invoicing', 'uae e invoicing penalties', 'einvoicing software dubai', 'peppol e invoicing uae'],
      },
    ],
    ladderCards: [],
    needsYou: [],
    thisWeek: [],
    summary: { publishedThisMonth: 0, top10: 0, clicks28d: 0, spendThisMonthUsd: 0, budgetUsd: 50 },
    automation: { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 },
    ...over,
  };
}

const ids = (n: { id: string }[]) => n.map((x) => x.id);

describe('pipeline notices', () => {
  it('nothing without data, and nothing for modes that do not touch the pipeline', () => {
    expect(pipelineNotices('ai_visibility', {}, null)).toEqual([]);
    expect(pipelineNotices('verdict', { keyword: 'peppol uae' }, data())).toEqual([]);
    expect(pipelineNotices('discover', {}, data())).toEqual([]);
  });

  it('a monitor the schedule runs: info with next run and what the manual run changes', () => {
    const [n] = pipelineNotices('ai_visibility', {}, data(), { now: NOW, costUsd: 0.87 });
    expect(n.tone).toBe('info');
    expect(n.confirm).toBeUndefined();
    expect(n.body).toContain('does not move or cancel the schedule');
    expect(n.body).toContain('later in October reuse');
    expect(n.body).toContain('$0.87');
    expect(n.link?.reportId).toBe('rep-1');
  });

  it('backlinks: a manual run is the month’s full report', () => {
    const [n] = pipelineNotices('backlinks', {}, data(), { now: NOW });
    expect(n.body).toContain('only watch for lost and spammy links');
    // run on the last day of the month: the next run is in a new month
    const late = data({ automations: [auto('backlinks', 'on', '2026-11-02T12:30:00Z')] });
    const [m] = pipelineNotices('backlinks', {}, late, { now: new Date('2026-10-31T12:00:00Z') });
    expect(m.body).toContain('full report as usual');
  });

  it('audit: the automatic audit skips a site audited less than 25 days before', () => {
    const [soon] = pipelineNotices('audit', {}, data(), { now: new Date('2026-10-20T12:00:00Z') });
    expect(soon.body).toContain('skips this website');
    const [far] = pipelineNotices('audit', {}, data(), { now: NOW });
    expect(far.body).toContain('still runs when your site changed');
  });

  it('a monitor that is off or paused says nothing', () => {
    const d = data({ automations: [auto('ai_visibility', 'off', null), auto('backlinks', 'paused', null)] });
    expect(pipelineNotices('ai_visibility', {}, d)).toEqual([]);
    expect(pipelineNotices('backlinks', {}, d)).toEqual([]);
  });

  it('the schedule running right now needs a tick', () => {
    const n = pipelineNotices('ai_visibility', {}, data({ running: [{ automation: 'ai_visibility', startedAt: '2026-10-05T11:00:00Z' }] }), { now: NOW });
    expect(ids(n)).toEqual(['running:ai_visibility']);
    expect(n[0].tone).toBe('warning');
    expect(n[0].confirm).toBeTruthy();
  });

  it('the same run already going in the app needs a tick (per keyword for pages)', () => {
    const d = data({ activeRuns: [{ id: 'run-1', mode: 'keyword', keyword: 'Peppol UAE', createdAt: '2026-10-03T11:58:00Z' }] });
    const n = pipelineNotices('keyword', { keyword: 'peppol  uae', receiveContent: true }, d);
    expect(ids(n)).toEqual(['active:run-1']);
    expect(n[0].link?.runId).toBe('run-1');
    expect(pipelineNotices('keyword', { keyword: 'something else', receiveContent: true }, d).some((x) => x.id === 'active:run-1')).toBe(false);
  });

  it('a page already written or published: warning, unless the run rewrites that very page', () => {
    const pub = pipelineNotices('keyword', { keyword: 'fta e invoicing rules', receiveContent: true }, data());
    expect(pub[0].id).toBe('written:fta e invoicing rules');
    expect(pub[0].confirm).toBeTruthy();
    expect(pub[0].body).toContain('techand.ai/fta-rules');
    expect(pub[0].body).toContain('by your weekly blog posts');
    const rewrite = pipelineNotices('keyword', { keyword: 'FTA e-invoicing rules', existingPageUrl: 'https://www.techand.ai/fta-rules', receiveContent: true }, data());
    expect(rewrite).toEqual([]);
    const waiting = pipelineNotices('keyword', { keyword: 'peppol uae', receiveContent: true }, data());
    expect(waiting[0].body).toContain('waiting to be published');
    // the keyword report alone writes no page
    expect(pipelineNotices('keyword', { keyword: 'peppol uae', receiveContent: false }, data())).toEqual([]);
  });

  it('a keyword the cadence writes on Monday: info, taken off the queue', () => {
    const [n] = pipelineNotices('keyword', { keyword: 'E-Invoicing in UAE', receiveContent: true }, data());
    expect(n.id).toBe('queued:e invoicing in uae');
    expect(n.tone).toBe('info');
    expect(n.body).toContain('takes it off the queue');
    expect(n.body).toContain('page 2 of your keyword ladder');
    expect(n.usePlan).toBeUndefined();
  });

  it('a striking-distance keyword offers to improve the ranking page instead', () => {
    const [n] = pipelineNotices('keyword', { keyword: 'vat invoice format', receiveContent: true }, data());
    expect(n.usePlan?.existingPageUrl).toBe('https://www.techand.ai/blog/vat');
    const [applied] = pipelineNotices('keyword', { keyword: 'vat invoice format', existingPageUrl: 'https://techand.ai/blog/vat/', receiveContent: true }, data());
    expect(applied.usePlan).toBeUndefined();
  });

  it('a planned ladder page outside the queue is written as that ladder page', () => {
    const [n] = pipelineNotices('keyword', { keyword: 'einvoicing software dubai', receiveContent: true }, data());
    expect(n.id).toBe('ladder:einvoicing software dubai');
    expect(n.body).toContain('page 5');
  });

  it('ladder: an existing ladder for the same head term needs a tick; a new one joins the pipeline', () => {
    const [dup] = pipelineNotices('ladder', { keyword: 'e invoicing' }, data());
    expect(dup.tone).toBe('warning');
    expect(dup.confirm).toBeTruthy();
    expect(dup.body).toContain('9 pages');
    const [fresh] = pipelineNotices('ladder', { keyword: 'payroll software uae' }, data());
    expect(fresh.id).toBe('ladder-next');
    expect(fresh.body).toContain('1 a week');
    const [off] = pipelineNotices('ladder', { keyword: 'payroll software uae' }, data({ queue: { ...data().queue, pagesPerWeek: 0 } }));
    expect(off.body).toContain('Weekly blog posts are off');
  });

  it('ladder: a main keyword that is almost the same search as another ladder’s main or page keyword needs a tick', () => {
    // near-duplicate of the main keyword
    const [near] = pipelineNotices('ladder', { keyword: 'e invoicing in the uae' }, data({ ladders: [{ ...data().ladders[0], head: 'e invoicing uae' }] }));
    expect(near.id).toBe('ladder-overlap:e invoicing in the uae');
    expect(near.tone).toBe('warning');
    expect(near.confirm).toBe('Plan this ladder anyway');
    expect(near.body).toContain('main keyword of your ladder “e invoicing uae”');
    expect(near.link?.ladderId).toBe('lad1');
    // a page keyword of the ladder (exact or near)
    const [pg] = pipelineNotices('ladder', { keyword: 'UAE e-invoicing penalty' }, data());
    expect(pg.id).toBe('ladder-overlap:uae e invoicing penalty');
    expect(pg.body).toContain('“uae e invoicing penalties” in “E-invoicing”');
    // ladders from before the keywords field: the planned pages count
    const old = data({ ladders: [{ ...data().ladders[0], keywords: undefined }] });
    expect(pipelineNotices('ladder', { keyword: 'einvoicing software in dubai' }, old)[0].id).toBe('ladder-overlap:einvoicing software in dubai');
    // a related but different search joins the pipeline
    expect(ids(pipelineNotices('ladder', { keyword: 'e invoicing software uae' }, data()))).toEqual(['ladder-next']);
  });

  it('warnings come first', () => {
    const d = data({ running: [{ automation: 'audit', startedAt: '2026-10-01T10:00:00Z' }], activeRuns: [{ id: 'r2', mode: 'audit', keyword: '', createdAt: '2026-10-03T11:00:00Z' }] });
    const n = pipelineNotices('audit', {}, d);
    expect(n.map((x) => x.tone)).toEqual(['warning', 'warning']);
  });
});
