import { describe, expect, it } from 'vitest';
import type { CyclePreviewRow, KeywordProposalRow, LadderRecheckRow, SiteRow } from '../src/db/schema';
import { autoPauseDue, autoPauseMail, automaticPage, autopilotNeedsYou, newlyActive, nudgeDue, recheckFell } from '../src/services/autopilot';
import { comingUpMail, comingUpView, decisionRow, previewOf } from '../src/services/comingUp';
import { cycleIntentOf, cycleSummary, jobReason, siteCycleView, weekdayChange } from '../src/services/cycles';
import { recommend, type SiteBundle } from '../src/services/recommendations';
import { summarize, titleFor } from '../src/services/summaries';
import { freeResearchAllowed, researchStatusOf } from '../src/services/research';
import { isScheduledCallback, ladderChoice } from '../src/services/runs';
import { ladderKeywordRow } from '../src/services/ladderSettings';

// The keyword-first decisions of the server that need no database (SCHEDULING_KEYWORDS_PLAN.md §5, §14.6): the autopilot's Needs-you
// items, the auto-pause and the nudge, the queued-ladder re-check, the cycle view and the weekday change, the "Coming up" plan and its
// e-mail, the research state, the recommendations that ask for the keyword, "Add to my ladder", the cycle callbacks.

const NOW = Date.parse('2026-10-20T12:00:00Z');

describe('the autopilot\'s Needs you', () => {
  const proposal = (o: Partial<KeywordProposalRow> = {}) => ({ id: 'p1', status: 'pending', keyword: 'crm consulting', level: 2, startAt: null, details: { why: 'You offer CRM implementation.' }, ...o }) as KeywordProposalRow;
  const base = { level: 2 as const, waitingForKeyword: false, laddersDone: null, proposals: [], rechecks: [], dropped: null, nudge: false, researching: false };
  it('no keyword yet: one warning that asks for it (while research runs it says so); a proposal replaces it', () => {
    expect(autopilotNeedsYou({ ...base, waitingForKeyword: true }).map((x) => [x.id, x.kind, x.severity, x.action?.page])).toEqual([['keyword:first', 'keyword', 'warning', 'pipeline/new']]);
    expect(autopilotNeedsYou({ ...base, waitingForKeyword: true, researching: true })[0].detail).toMatch(/finding keywords for your website right now/);
    const withP = autopilotNeedsYou({ ...base, waitingForKeyword: true, proposals: [proposal()] });
    expect(withP.map((x) => x.id)).toEqual(['proposal:p1']);
    expect(withP[0]).toMatchObject({ severity: 'info', title: 'Suggested keyword: "crm consulting"' });
  });
  it('a level-3 announcement names the day it starts; a finished ladder asks for the next keyword', () => {
    const a = autopilotNeedsYou({ ...base, level: 3, proposals: [proposal({ level: 3, startAt: new Date('2026-10-22T12:00:00Z') })] });
    expect(a[0]).toMatchObject({ kind: 'proposal', severity: 'warning', title: 'We start "crm consulting" on 2026-10-22' });
    expect(autopilotNeedsYou({ ...base, laddersDone: { head: 'crm consulting', won: true } })[0]).toMatchObject({ id: 'keyword:next', title: 'Your ladder for "crm consulting" is done. Choose your next keyword' });
  });
  it('a ladder paused by its re-check, the auto-pause (with the level it came from), the nudge (never with the auto-pause)', () => {
    const r = { ladderId: 'lad_1', keyword: 'crm dubai', paused: true, reason: 'its keyword is no longer realistic for your website' } as LadderRecheckRow;
    expect(autopilotNeedsYou({ ...base, rechecks: [r] })[0]).toMatchObject({ id: 'recheck:lad_1', kind: 'recheck', ladderId: 'lad_1', action: { page: 'pipeline/ladders/lad_1' } });
    const d = autopilotNeedsYou({ ...base, level: 1, dropped: { at: new Date('2026-10-19T00:00:00Z'), from: 3 }, nudge: true });
    expect(d.map((x) => x.id)).toEqual(['level:dropped']);
    expect(d[0].detail).toMatch(/from 3 to 1 on 2026-10-19/);
    expect(autopilotNeedsYou({ ...base, level: 1, nudge: true })[0]).toMatchObject({ id: 'level:nudge', severity: 'info' });
  });
  it('the auto-pause: 2 of the last 5 automatic non-ladder pages; ladder pages, the client\'s own pages and approvals never count', () => {
    const page = (k: string, d: number) => ({ keyword: k, started_at: new Date(NOW - d * 864e5).toISOString() });
    const pages = ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => page(k, i));
    expect(autoPauseDue({ level: 2, automaticPages: pages, rejectedKeys: new Set(['a', 'b']) })).toBe(true);
    // the rejections are older than the last five: not counted
    expect(autoPauseDue({ level: 2, automaticPages: pages, rejectedKeys: new Set(['a', 'f']) })).toBe(false);
    expect(autoPauseDue({ level: 1, automaticPages: pages, rejectedKeys: new Set(['a', 'b']) })).toBe(false);
    expect(automaticPage({ request_id: 'cad_x_1', source: 'decay', keyword: 'a' }, new Set())).toBe(true);
    expect(automaticPage({ request_id: 'cad_x_1', source: 'ladder', keyword: 'a' }, new Set())).toBe(false);
    expect(automaticPage({ request_id: '123', source: 'app', keyword: 'a' }, new Set())).toBe(false);
    expect(automaticPage({ request_id: 'cad_x_1', source: 'trend', keyword: 'A' }, new Set(['a']))).toBe(false);
    const m = autoPauseMail({ domain: 'x.com' }, 3, 'https://app');
    expect(m.lines.join(' ')).toMatch(/from "Full autopilot" to "Only my keywords"/);
    expect(JSON.stringify(m)).not.toMatch(/—|…|’/);
  });
  it('the nudge after 5 published or approved pages at level 1, never at other levels', () => {
    expect(nudgeDue({ level: 1, published: 3, approved: 2, dropped: false })).toBe(true);
    expect(nudgeDue({ level: 1, published: 3, approved: 1, dropped: false })).toBe(false);
    expect(nudgeDue({ level: 2, published: 9, approved: 0, dropped: false })).toBe(false);
  });
  it('the re-check: queued in the previous plan, written now, not won; a verdict fell when not realistic or off topic', () => {
    expect(newlyActive(['a', 'b', 'c'], ['b'], ['c'])).toEqual(['a']);
    expect(newlyActive([], [], [])).toEqual([]);
    expect([recheckFell({ difficultyForYou: 'not_realistic', fit: 2 }), recheckFell({ difficultyForYou: 'easy', fit: 0 }), recheckFell({ difficultyForYou: 'hard', fit: 1 })]).toEqual([true, true, false]);
  });
});

describe('the cycle view', () => {
  const site = { timezone: 'UTC', trackingStartedAt: new Date('2026-10-14T08:00:00Z'), cycleWeekday: null, trackingStatus: 'active' } as unknown as SiteRow;
  it('job reasons in customer words: never an execution, a ledger or a table', () => {
    expect(jobReason('skipped', 'skipped: the backlink monitor is switched off for this website', 0)).toBe('The backlink monitor is switched off for this website');
    expect(jobReason('skipped', 'set aside: cycle cyc:x started before it could run', 0)).toBe('Not run: the next cycle started before it could run');
    expect(jobReason('skipped', 'skipped: refused by the run guard (execution 12)', 0)).toBe('Not needed this week');
    expect(jobReason('failed', 'execution 811 crashed', 2)).toBe('Did not finish: it starts again automatically (attempt 2 of 3)');
    expect(jobReason('refused', 'same_mode', 0)).toMatch(/free slot/);
    expect(jobReason('done', 'finished: ledger row', 1)).toBe('');
  });
  it('before the engine has a row: cycle 0 opened at setup, the next is the first to come; after a weekday change, the next on that day', () => {
    expect(cycleIntentOf(site, null)).toMatchObject({ anchorAt: '2026-10-14T08:00:00.000Z', lastCycleAt: '2026-10-14T08:00:00.000Z', tz: 'UTC' });
    const v = siteCycleView(site, null, [], NOW, 'admin');
    expect(v).toMatchObject({ known: false, status: 'active', weekday: 3, weekdayName: 'Wednesday', nextDueAt: '2026-10-21T06:00:00.000Z', canChangeWeekday: false, overdue: false }); // the weekday is the engine row's: not offered before it exists (PATCH would 409)
    expect(siteCycleView({ ...site, trackingStatus: 'paused' } as SiteRow, null, [], NOW, 'viewer')).toMatchObject({ status: 'paused', nextDueAt: null, upcoming: [], canChangeWeekday: false });
    expect(siteCycleView({ ...site, trackingStartedAt: null, trackingStatus: 'not_started' } as unknown as SiteRow, null, [], NOW, 'admin')).toMatchObject({ status: 'not_started', weekday: null, upcoming: [] });
    const row = { anchor_at: '2026-10-14T08:00:00.000Z', tz: 'UTC', cycle_weekday: 3, last_cycle_at: '2026-10-14T08:01:00.000Z', status: 'active' as const };
    expect(weekdayChange(row, site, 5, NOW)).toEqual({ weekday: 5, weekdayName: 'Friday', nextDueAt: '2026-10-23T06:00:00.000Z', timezone: 'UTC' });
    // the day after a cycle: never two cycles days apart (Thursday after a Wednesday cycle -> the Thursday a week later)
    expect(weekdayChange({ ...row, last_cycle_at: '2026-10-21T06:00:00.000Z' }, site, 4, Date.parse('2026-10-21T08:00:00Z')).nextDueAt).toBe('2026-10-29T06:00:00.000Z');
    // cycle 0 not opened yet: it runs at setup, the new weekday applies from cycle 1
    expect(weekdayChange({ ...row, last_cycle_at: '' }, site, 5, NOW).nextDueAt).toBe('2026-10-14T08:00:00.000Z');
  });
  it('a cycle summary: jobs in the cycle\'s order, done when every job ended, cycle 0 named', () => {
    const job = (job: string, status: string) => ({ key: '', site_id: 's', cycle_key: 'cyc:s:2026-10-14', job, workflow_id: '', status, attempts: 1, run_id: '', ledger_key: '', monthly: true, reason: '', due_at: '', started_at: '', finished_at: '', updated_at: '' }) as never;
    const s = cycleSummary('cyc:s:2026-10-14', [job('audit', 'done'), job('ai_visibility', 'done'), job('preview', 'skipped')], '2026-10-14');
    expect(s).toMatchObject({ date: '2026-10-14', cycle0: true, monthly: true, status: 'done' });
    expect(s.jobs.map((j) => j.label)).toEqual(['"Coming up" plan', 'AI visibility', 'Monthly technical audit']);
  });
});

describe('the "Coming up" plan', () => {
  const body = {
    stage: 'cycle_preview', site_id: 'site_x-com', domain: 'x.com', cycle_key: 'cyc:site_x-com:2026-10-23', scheduled_for: '2026-10-23T06:00:00.000Z', level: 2, pages_per_week: 1, waiting_for_keyword: false, paused_reason: '',
    items: [{ keyword: 'Crm Cost', source: 'ladder', auto: true, est_usd: 0.84 }, { keyword: 'crm migration', source: 'ladder', auto: false, est_usd: 0.84 }],
    suggestions: [{ keyword: 'best crm', source: 'weird', est_usd: 0.84 }], refused: [{ keyword: 'coffee', source: 'trend', reason: 'off topic', detail: 'd' }],
  };
  const preview = { id: 'cp', siteId: 's', orgId: 'o', cycleKey: body.cycle_key, scheduledFor: new Date(body.scheduled_for), body, reportId: null, receivedAt: new Date(NOW), emailedAt: null } as CyclePreviewRow;
  it('reads the engine\'s body defensively (item keys normalised, an unknown source read as a ladder page)', () => {
    const p = previewOf(body);
    expect(p.items.map((i) => [i.item_key, i.auto])).toEqual([['crm cost', true], ['crm migration', false]]);
    expect(p.suggestions[0].source).toBe('ladder');
    expect(p.cycle_date).toBe('2026-10-23');
  });
  it('the view: decisions (a skip beats an approval), prices in credits, Skip / Approve per item, closed after the cycle started', () => {
    const skips = [
      { key: 'k1', site_id: 'site_x-com', cycle_key: body.cycle_key, item_key: 'crm migration', decision: 'approve', scope: 'cycle', by: 'a@x', created_at: '2026-10-21T00:00:00Z' },
      { key: 'k2', site_id: 'site_x-com', cycle_key: '', item_key: 'crm migration', decision: 'skip', scope: 'always', by: 'b@x', created_at: '2026-10-20T00:00:00Z' },
      { key: 'k3', site_id: 'site_x-com', cycle_key: 'cyc:site_x-com:2026-10-16', item_key: 'crm cost', decision: 'skip', scope: 'cycle', by: 'a@x', created_at: '2026-10-14T00:00:00Z' },
    ];
    const v = comingUpView({ site: { id: 's', domain: 'x.com' }, preview, skips: skips as never, role: 'member', now: NOW, credits: (u) => Math.ceil(u * 60) });
    expect(v.items.map((i) => [i.keyword, i.credits, i.canSkip, i.canApprove, i.decision?.decision ?? null])).toEqual([
      ['Crm Cost', 51, true, false, null],
      ['crm migration', 51, true, true, 'skip'],
    ]);
    expect(v.autoCredits).toBe(51);
    expect(comingUpView({ site: { id: 's', domain: 'x.com' }, preview, skips: [], role: 'viewer', now: NOW, credits: () => 1 }).items[1]).toMatchObject({ canSkip: false, canApprove: false });
    expect(comingUpView({ site: { id: 's', domain: 'x.com' }, preview, skips: [], role: 'owner', now: Date.parse('2026-10-23T06:00:01Z'), credits: () => 1 })).toMatchObject({ closed: true });
  });
  it('a decision row: the contract\'s key and fields; refused for unknown items, an automatic approval, an "always" approval, a started cycle', () => {
    const r = decisionRow({ site: { domain: 'x.com' }, preview, input: { itemKey: 'Crm Migration', decision: 'approve', scope: 'cycle' }, by: 'a@x', now: NOW });
    expect(r.row).toEqual({ key: 'site_x-com:cyc:site_x-com:2026-10-23:crm migration', site_id: 'site_x-com', cycle_key: body.cycle_key, item_key: 'crm migration', decision: 'approve', scope: 'cycle', by: 'a@x', created_at: new Date(NOW).toISOString() });
    expect(decisionRow({ site: { domain: 'x.com' }, preview, input: { itemKey: 'best crm', decision: 'skip', scope: 'always' }, by: 'a@x', now: NOW }).row).toMatchObject({ key: 'site_x-com:always:best crm', cycle_key: '' });
    for (const input of [
      { itemKey: 'nothing', decision: 'skip' as const, scope: 'cycle' as const },
      { itemKey: 'crm cost', decision: 'approve' as const, scope: 'cycle' as const },
      { itemKey: 'best crm', decision: 'approve' as const, scope: 'always' as const },
    ])
      expect(() => decisionRow({ site: { domain: 'x.com' }, preview, input, by: 'a', now: NOW })).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => decisionRow({ site: { domain: 'x.com' }, preview, input: { itemKey: 'crm cost', decision: 'skip', scope: 'cycle' }, by: 'a', now: Date.parse('2026-10-24T00:00:00Z') })).toThrow(expect.objectContaining({ statusCode: 409 }));
    expect(() => decisionRow({ site: { domain: 'x.com' }, preview: null, input: { itemKey: 'crm cost', decision: 'skip', scope: 'cycle' }, by: 'a', now: NOW })).toThrow(expect.objectContaining({ statusCode: 404 }));
  });
  it('the e-mail: what is written on its own and what waits, in credits, waiting for a keyword and paused said plainly', () => {
    const v = comingUpView({ site: { id: 's', domain: 'x.com' }, preview, skips: [], role: 'owner', now: NOW, credits: (u) => Math.ceil(u * 60) });
    const m = comingUpMail({ site: { domain: 'x.com', timezone: 'Asia/Dubai' }, view: v, url: 'https://app' });
    expect(m.subject).toBe('Coming up on Friday for x.com');
    expect(m.lines[0]).toMatch(/^Written on their own on Friday: "Crm Cost" \(about 51 credits\)/);
    expect(m.lines.join(' ')).toMatch(/Waiting for your OK: "crm migration" \(about 51 credits\), "best crm"/);
    const w = comingUpMail({ site: { domain: 'x.com', timezone: 'UTC' }, view: { ...v, waitingForKeyword: true, items: [], suggestions: [] }, url: '' });
    expect(w.lines[0]).toMatch(/until you choose the keyword/);
    expect(JSON.stringify([m, w])).not.toMatch(/\$|USD|—|…|Monday/);
  });
});

describe('research, recommendations, callbacks and the ladder fields', () => {
  it('the research state and the free research at setup', () => {
    const rec = { reportId: 'r', ageDays: 10 };
    expect(researchStatusOf({ status: 'running', createdAt: new Date(NOW - 3600_000) }, rec, NOW)).toBe('running');
    expect(researchStatusOf({ status: 'running', createdAt: new Date(NOW - 13 * 3600_000) }, rec, NOW)).toBe('ready');
    expect(researchStatusOf(null, { reportId: 'r', ageDays: 91 }, NOW)).toBe('none');
    expect(researchStatusOf(null, { reportId: null, ageDays: null }, NOW)).toBe('none');
    expect(freeResearchAllowed({ trackingStatus: 'not_started', trackingStartedAt: null }, false, NOW)).toBe(true);
    expect(freeResearchAllowed({ trackingStatus: 'active', trackingStartedAt: new Date(NOW - 3600_000) }, false, NOW)).toBe(true);
    expect(freeResearchAllowed({ trackingStatus: 'active', trackingStartedAt: new Date(NOW - 2 * 864e5) }, false, NOW)).toBe(false);
    expect(freeResearchAllowed({ trackingStatus: 'not_started', trackingStartedAt: null }, true, NOW)).toBe(false);
  });
  it('recommendations: start keyword research / choose your first keyword while there is no ladder; no "turn on blog posts"', () => {
    const b = { search: { periods: [], queries: [], trends: [], snapshot: null }, rankings: { ladders: [], keywords: [] }, content: { items: [], cadence: { pagesPerWeek: 0, status: 'active' } }, technical: { audits: [{ healthScore: 90 }], findings: [] }, ai: { runs: [], report: null }, backlinks: { snapshots: [], prospects: [], imports: [] }, alerts: { alerts: [], checkins: [], checkinDue: false }, settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', reportsToThisApp: true }, monitors: null, profile: null, readiness: { score: 100, missing: [] } }, rankNext: null, reportsElsewhere: false } as unknown as SiteBundle;
    const site = { id: 's', domain: 'x.com', trackingStatus: 'active', keywords: [] } as unknown as SiteRow;
    const ids = (x: SiteBundle) => recommend(site, x).map((r) => r.id);
    expect(ids(b)).toContain('keyword:research');
    expect(ids({ ...b, researchAt: new Date(Date.now() - 5 * 864e5).toISOString() })).toContain('keyword:first');
    expect(ids({ ...b, researchAt: new Date(Date.now() - 5 * 864e5).toISOString() })).not.toContain('keyword:research');
    expect(ids(b)).not.toContain('content:cadence');
    const withLadder = { ...b, rankings: { ladders: [{ ladderId: 'lad_1', headKeyword: 'crm consulting', rungs: [{ keyword: 'crm consulting cost', status: 'planned', rung: 1 }], pages: 2, published: 0 }], keywords: [] } } as unknown as SiteBundle;
    expect(ids(withLadder)).toContain('content:cadence');
    expect(ids(withLadder).filter((i) => i.startsWith('keyword:'))).toEqual([]);
    const recs = recommend(site, withLadder);
    expect(JSON.stringify(recs)).not.toMatch(/Monday/);
  });
  it('"Add to my ladder" beside a search on a ladder\'s topic (striking distance without a page, a rising search)', () => {
    const b = {
      search: { periods: ['2026-10-18'], queries: [{ query: 'crm consulting cost dubai', position: 8, impressions: 300, clicks: 3, ctr: 0.01, page: '', periodEnd: '2026-10-18', prevClicks: 0, prevPosition: 0 }, { query: 'office coffee', position: 8, impressions: 300, clicks: 3, ctr: 0.01, page: '', periodEnd: '2026-10-18', prevClicks: 0, prevPosition: 0 }], trends: [], snapshot: null },
      rankings: { ladders: [{ ladderId: 'lad_1', headKeyword: 'crm consulting', rungs: [{ keyword: 'crm consulting cost', status: 'planned', rung: 1 }], pages: 2, published: 0 }], keywords: [] },
      content: { items: [], cadence: { pagesPerWeek: 1, status: 'active' } }, technical: { audits: [{ healthScore: 90 }], findings: [] }, ai: { runs: [], report: null }, backlinks: { snapshots: [], prospects: [], imports: [] }, alerts: { alerts: [], checkins: [], checkinDue: false },
      settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', reportsToThisApp: true }, monitors: null, profile: null, readiness: { score: 100, missing: [] } }, rankNext: null, reportsElsewhere: false, researchAt: null,
    } as unknown as SiteBundle;
    const recs = recommend({ id: 's', domain: 'x.com', trackingStatus: 'active', keywords: [] } as unknown as SiteRow, b);
    expect(recs.find((r) => r.id === 'search:striking:crm consulting cost dubai')?.secondary).toEqual({ label: 'Add to my ladder', addToLadder: { ladderId: 'lad_1', head: 'crm consulting', keyword: 'crm consulting cost dubai' } });
    expect(recs.find((r) => r.id === 'search:striking:office coffee')?.secondary).toBeUndefined();
  });
  it('the ladder row "Add to my ladder" writes, and its refusals', () => {
    const ladders = [{ ladder_id: 'l1', domain: 'x.com', head_keyword: 'crm consulting', keyword: 'crm consulting', rung: 4, page_no: 4, start_date: '2026-09-01', country: 'United States', status: 'planned' }, { ladder_id: 'l1', domain: 'x.com', head_keyword: 'crm consulting', keyword: 'crm consulting cost', rung: 1, page_no: 2, start_date: '2026-09-01', country: 'United States', status: 'planned' }] as never[];
    expect(ladderKeywordRow({ site: { domain: 'x.com', country: 'United States' }, ladders, ladderId: 'l1', keyword: 'crm consulting partner', now: '2026-10-20' })).toMatchObject({ ladder_id: 'l1', rung: 1, page_no: 5, status: 'planned', start_date: '2026-09-01', head_keyword: 'crm consulting' });
    expect(() => ladderKeywordRow({ site: { domain: 'x.com', country: 'US' }, ladders, ladderId: 'l2', keyword: 'x y', now: '' })).toThrow(expect.objectContaining({ statusCode: 404 }));
    expect(() => ladderKeywordRow({ site: { domain: 'x.com', country: 'US' }, ladders, ladderId: 'l1', keyword: 'CRM Consulting Cost', now: '' })).toThrow(expect.objectContaining({ statusCode: 409 }));
  });
  it('a cycle callback is scheduled; the Coming up plan is summarised and titled, never "test run"', () => {
    expect(isScheduledCallback('ai_visibility', { trigger: 'cycle' })).toBe(true);
    expect(isScheduledCallback('ai_visibility', { request_id: 'cyc_x-com_20261021_ai_visibility' })).toBe(true);
    expect(isScheduledCallback('ai_visibility', { request_id: '1234' })).toBe(false);
    const b = { domain: 'x.com', dry_run: true, cycle_date: '2026-10-23', level: 2, items: [{ auto: true }, { auto: false }], suggestions: [{}], waiting_for_keyword: false };
    expect(titleFor('cycle_preview', b)).toBe('Coming up plan · x.com');
    expect(summarize('cycle_preview', b)).toEqual({ cycle: '2026-10-23', level: 2, automatic: 1, needsOk: 2 });
    expect(summarize('content_cadence', { week: '2026-10-21', pages: [], level: 1, waiting_for_keyword: true, suggestions: [{}, {}], cycle_date: '2026-10-21' })).toMatchObject({ level: 1, waitingForKeyword: true, suggestions: 2, cycle: '2026-10-21' });
  });
  it('ladder choice: a person never announces; the auto start announces; the flow\'s Auto / Manual is the start mode', () => {
    const l = { mode: 'ladder', keyword: 'k', ladderPrefs: { mode: 'manual' } } as never;
    expect(ladderChoice({ ...(l as object), chosenBy: 'system_announced' } as never, false)).toMatchObject({ chosenBy: 'client_typed', ladderMode: 'manual' });
    expect(ladderChoice({ mode: 'ladder', keyword: 'k' } as never, true)).toMatchObject({ chosenBy: 'system_announced' });
    expect(ladderChoice({ mode: 'ladder', keyword: 'k', chosenBy: 'client_picked', ladderMode: 'auto' } as never, false)).toMatchObject({ chosenBy: 'client_picked', ladderMode: 'auto' });
    expect(ladderChoice({ mode: 'verdict', keyword: 'k' } as never, false)).toEqual({ mode: 'verdict', keyword: 'k' });
  });
});
