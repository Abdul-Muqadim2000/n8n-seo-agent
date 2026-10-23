import { describe, expect, it } from 'vitest';
import { deliveryDecision, type AuditPoint, type AutomationStatus, type ContentLogRow, type CycleJobRow, type LadderRow } from '@seo/shared';
import type { SiteRow } from '../src/db/schema';
import { aiDailySeries, oneReadingFinding, previousOfType } from '../src/services/data';
import { buildLadders, draftQa, ladderNeedsYou, type LadderSources } from '../src/services/ladders';
import { cadenceDetail, publishStage, pulseLastRun, waitingPages, withCycleTruth, withScheduleTruth } from '../src/services/pipeline';
import { recommend, type SiteBundle } from '../src/services/recommendations';
import { STALE_RUN_ERROR, runOutcome } from '../src/services/runs';
import { stageOf, summarize } from '../src/services/summaries';
import { engineActions } from '../src/services/data';

// Agent A3 (2026-10-16), the 2026-10-15 re-rating's app-side defects of families F2 / F3: a draft that failed its quality check is never
// offered for publishing (R111), comparisons are like for like (R66), a refused request is closed with the engine's sentence (R116), the
// site report's list line follows its significance test (R113), and the Pipeline's "last run" is the schedule's own (R104).

const NOW = Date.parse('2026-10-16T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const log = (o: Partial<ContentLogRow> & { qa_reasons?: string }) =>
  ({ site_id: 's', domain: 'techand.ai', keyword: '', source: 'app', page_type: 'Service Page', existing_page_url: '', rung: 0, ladder_id: '', request_id: '', started_at: ago(2), status: 'written', published_url: '', published_at: '', week: '', ...o }) as ContentLogRow;
const lad = (o: Partial<LadderRow>) =>
  ({ ladder_id: 'lad_ai', head_keyword: 'ai consulting dubai', keyword: '', status: 'planned', rung: 1, page_no: 1, page_type: 'Service Page', target_url: '', page_exists: false, months: '1-2', start_date: ago(30), country: 'United Arab Emirates', supporting: '', ...o }) as LadderRow;
const src = (o: Partial<LadderSources>): LadderSources => ({ ladders: [], history: [], logs: [], queries: [], settings: [], plans: [], pageReports: [], runs: [], ...o });

// exec 616: "ai consulting" did not pass its last QA round (round 2 of 2); "erp software uae" passed and waits to be published
const NOT_READY = log({ keyword: 'ai consulting', ladder_id: 'lad_ai', status: 'not_ready', qa_reasons: 'covers 60% of the competitors\' subtopics against a target of 90%; 2 figures could not be matched to their source', started_at: ago(1) });
const READY = log({ keyword: 'erp software uae', status: 'written', started_at: ago(9) });

describe('R111: a draft that failed its quality check is never offered for publishing', () => {
  it('reads the QA verdict from the newest unpublished content-log row; old rows (only `written`) read as before', () => {
    expect(draftQa([NOT_READY])).toEqual({ needsFix: true, reasons: ['covers 60% of the competitors\' subtopics against a target of 90%', '2 figures could not be matched to their source'] });
    expect(draftQa([READY])).toEqual({ needsFix: false, reasons: [] });
    // a re-run that passed is newer than the failed draft: the page is ready now
    expect(draftQa([NOT_READY, log({ keyword: 'ai consulting', status: 'written', started_at: ago(0) })]).needsFix).toBe(false);
  });

  it('the Pipeline\'s waiting list counts the draft (the pile-up guard) and labels it "needs a fix"', () => {
    const w = waitingPages([NOT_READY, READY], NOW);
    expect(w.map((x) => x.keyword)).toEqual(['erp software uae', 'ai consulting']);
    expect(w.find((x) => x.keyword === 'ai consulting')).toMatchObject({ needsFix: true });
    expect(w.find((x) => x.keyword === 'erp software uae')?.needsFix).toBeUndefined();
  });

  it('the growth loop says "1 page to publish · 1 needs a fix" and names the draft with "finish it by hand", never "publish" or a re-run for it', () => {
    const st = publishStage(waitingPages([NOT_READY, READY], NOW), 0);
    expect(st.headline).toBe('1 page(s) to publish · 1 needs a fix');
    expect(st.state).toBe('attention');
    expect(st.detail).toContain('"ai consulting" did not pass the quality check: finish it by hand');
    expect(st.detail).not.toMatch(/run (it|them) again/);
    const onlyFix = publishStage(waitingPages([NOT_READY], NOW), 0);
    expect(onlyFix.headline).toBe('1 needs a fix');
    expect(onlyFix.action).toEqual({ label: 'See what to edit', page: 'content' });
    expect(onlyFix.detail).not.toMatch(/Publish them/);
  });

  it('Needs you: a "finish it by hand" item with the reasons and its report, no re-run, and no "I published it" for that page (E-QA)', () => {
    const b = buildLadders(src({ ladders: [lad({ keyword: 'ai consulting', status: 'writing', page_no: 1 }), lad({ keyword: 'ai consulting dubai', rung: 4, page_no: 2 })], logs: [NOT_READY, READY] }), { dated: [], cadenceRuns: [], rankNextAt: null }, { now: NOW });
    expect(b.waiting.find((w) => w.keyword === 'ai consulting')).toMatchObject({ needsFix: true, ladderId: 'lad_ai' });
    const items = ladderNeedsYou(b);
    const fix = items.find((i) => i.id === 'fix:lad_ai');
    expect(fix).toBeDefined();
    expect(fix!.title).toBe('Finish 1 page of "ai consulting dubai" before publishing');
    expect(fix!.detail).toContain('covers 60% of the competitors\' subtopics');
    expect(fix!.detail).toContain('You do not need a new run');
    expect(fix!.detail).not.toMatch(/run (it|them) again/);
    expect(fix!.action).toMatchObject({ label: 'See what to edit' });
    expect(fix!.action?.mode).toBeUndefined();
    // the ladder's publish item no longer names the draft; the other written page keeps its "I published it"
    const publishes = items.filter((i) => i.kind === 'publish');
    expect(publishes.some((i) => /ai consulting/.test(i.detail) && i.action?.mode === 'published')).toBe(false);
    expect(publishes.find((i) => /erp software uae/.test(i.detail))?.action).toMatchObject({ label: 'I published it', mode: 'published' });
    // the card's next step
    const card = b.cards.find((c) => c.id === 'lad_ai')!;
    expect(card.next.text).toMatch(/finish 1 page that failed the quality check by hand/);
    expect(card.next.text).not.toMatch(/publish 1 page/);
  });

  it('the pile-up note labels the draft and does not tell the owner to publish it', () => {
    const b = buildLadders(src({ ladders: [lad({ keyword: 'ai consulting', status: 'writing' })], logs: [NOT_READY, READY] }), { dated: [], cadenceRuns: [], rankNextAt: null }, { now: NOW });
    const plan = { pausedReason: 'pileup', waitingPublish: 2, waitingKeywords: ['ai consulting', 'erp software uae'], config: { maxWaiting: 2 } } as unknown as Parameters<typeof cadenceDetail>[1];
    const txt = cadenceDetail([], plan, b);
    expect(txt).toContain('"ai consulting" (needs a fix)');
    expect(txt).toContain('finish the others by hand');
    expect(txt).not.toMatch(/Publish them to continue$/);
  });

  it('recommendations: an engine `fix_draft` action opens the draft to edit, never a re-run or "Report the published URL"; old `publish` actions are unchanged', () => {
    const acts = engineActions(
      [
        { type: 'fix_draft', keyword: 'ai consulting', url: 'https://www.techand.ai/ai-consulting/', reasons: ['covers 60% against 90%'] },
        { type: 'publish', priority: 1, action: 'Publish the written page for "erp software uae"', keyword: 'erp software uae' },
      ],
      'site_tracker',
      ago(0),
    );
    expect(acts).toHaveLength(2);
    expect(acts[0].action).toMatch(/Finish the draft for "ai consulting" by hand/);
    expect(acts[0].why).toContain('covers 60% against 90%');
    const b = bundleWith({ snapshotActions: acts });
    const recs = recommend(SITE, b);
    const fix = recs.find((r) => r.id.startsWith('engine:site_tracker:fix_draft'));
    expect(fix?.action).toMatchObject({ label: 'See what to edit', page: 'content' });
    expect(recs.find((r) => r.id.startsWith('engine:site_tracker:publish'))?.action).toMatchObject({ label: 'Report the published URL', mode: 'published' });
  });

  it('recommendations: a `not_ready` content row is "Finish the draft ... by hand", not "Publish the page" and not a re-run', () => {
    const b = bundleWith({ items: [{ keyword: 'ai consulting', source: 'app', pageType: 'Service Page', rung: 0, ladderId: '', requestId: '', startedAt: ago(5), status: 'not_ready', publishedUrl: '', publishedAt: '', week: '', existingPageUrl: '', qaReasons: 'covers 60% against 90%' } as never] });
    const recs = recommend(SITE, b);
    expect(recs.some((r) => r.id === 'content:publish:ai consulting')).toBe(false);
    const fix = recs.find((r) => r.id === 'content:fix:ai consulting');
    expect(fix?.title).toBe('Finish the draft for "ai consulting" by hand');
    expect(fix?.detail).toContain('covers 60% against 90%');
    expect(fix?.detail).toContain('You do not need a new run');
    expect(fix?.action).toMatchObject({ label: 'See what to edit', page: 'content' });
  });
});

describe('R66: an audit is compared only with the previous audit of the same report type', () => {
  const pt = (id: string, at: string, type: string, score: number): AuditPoint =>
    ({ auditId: id, auditedAt: at, reportType: type, healthScore: score, grade: '', pagesCrawled: 47, findings: 0, critical: 0, high: 0, medium: 0, low: 0, scheduled: false }) as AuditPoint;
  // the stored rows of 2026-10-14 / 15 (exec 595 = technical 83, exec 614 = full 70; the full report of 2026-10-14 = 69)
  const points = [pt('aud_mv8bsknpagb', '2026-10-14T16:30:00Z', 'full', 69), pt('aud_tech14', '2026-10-14T17:59:58Z', 'site_audit', 83), pt('aud_mv9wujhkclv', '2026-10-15T19:07:10Z', 'site_audit', 83), pt('aud_mv9x4zz1i6i', '2026-10-15T19:15:18Z', 'full', 70)];

  it('the full report of 2026-10-15 is compared with the full report of 2026-10-14, not the technical audit eight minutes before it', () => {
    expect(previousOfType(points, 3)?.auditId).toBe('aud_mv8bsknpagb');
    expect(previousOfType(points, 2)?.auditId).toBe('aud_tech14');
    // relative to the SELECTED audit, not the latest
    expect(previousOfType(points, 1)).toBeNull();
    // rows written before v4.5 carry no type: compared with nothing
    expect(previousOfType([pt('o1', '2026-09-01', '', 64), pt('o2', '2026-09-20', '', 72)], 1)).toBeNull();
  });

  it('no "Health score fell from 83 to 70" recommendation when a full report follows a technical audit', () => {
    const b = bundleWith({ audits: points });
    expect(recommend(SITE, b).some((r) => r.id === 'tech:score-drop')).toBe(false);
    // a real fall within one type still fires
    const fell = bundleWith({ audits: [...points, pt('aud_next', '2026-10-16T08:00:00Z', 'site_audit', 70)] });
    expect(recommend(SITE, fell).find((r) => r.id === 'tech:score-drop')?.title).toBe('Health score fell from 83 to 70');
  });
});

describe('R74: a finding that rested on one outside reading is not "fixed" when it is no longer seen', () => {
  it('follows the engine\'s rule: brand / AI readings and a full report\'s model-written review are one reading; measured findings are not', () => {
    expect(oneReadingFinding({ title: 'Does not rank at the top for its own brand name', category: 'Authority' }, 'full')).toBe(true);
    expect(oneReadingFinding({ title: 'ChatGPT recommends other providers', category: 'AI' }, 'full')).toBe(true);
    expect(oneReadingFinding({ title: 'Contact page has an unescaped entity', category: 'Content' }, 'full')).toBe(true);
    expect(oneReadingFinding({ title: 'Placeholder (lorem ipsum) text is live', category: 'Content' }, 'full')).toBe(false);
    expect(oneReadingFinding({ title: 'Missing meta description', category: 'On-Page' }, 'site_audit')).toBe(false);
  });
});

describe('R116: a request the engine refuses after its "started" note is closed with the engine\'s own sentence', () => {
  // the body agent A5's monitor refusal posts (contract of 2026-10-16)
  const refusal = { stage: 'rejected', status: 'rejected', error: 'Another backlinks check for techand.ai is still running (started 19:40). Wait for its report, then ask again.', request_id: '621' };

  it('the callback is a refusal stage, closes the run as failed with that sentence, and is held from delivery', () => {
    expect(stageOf(refusal)).toBe('rejected');
    const o = runOutcome('running', ['backlinks'], 'rejected', refusal);
    expect(o.status).toBe('failed');
    expect(o.error).toBe(refusal.error);
    expect(o.completedAt).toBeInstanceOf(Date);
    expect(deliveryDecision({ stage: 'rejected', status: 'rejected', payload: refusal })).toMatchObject({ deliver: false, code: 'rejected' });
  });

  it('a run already completed is never reopened by a late refusal; a final stage still completes a run', () => {
    expect(runOutcome('completed', ['backlinks'], 'rejected', refusal)).toEqual({});
    expect(runOutcome('running', ['backlinks'], 'backlinks', { stage: 'backlinks', status: 'progress' })).toMatchObject({ status: 'completed', error: null });
    expect(runOutcome('accepted', ['backlinks'], 'backlinks_started', { stage: 'backlinks_started' })).toEqual({ status: 'running' });
  });

  it('the stale-run message no longer claims an e-mail it cannot know was sent', () => {
    expect(STALE_RUN_ERROR).not.toMatch(/e-?mailed/i);
    expect(STALE_RUN_ERROR).toMatch(/did not report a failure/);
  });
});

describe('R113: the site report\'s list line follows its own significance test', () => {
  const body = { stage: 'site_tracker', gsc: { totals: { cur: { clicks: 32, impressions: 5308 } }, deltas: { clicks_pct: 52 } }, significance: { clicks: { pct: 52, real: false, significant: false, watch: true } } };
  it('a change the test calls not real is "within normal variation", with no percentage', () => {
    const s = summarize('site_tracker', body);
    expect(s.clicksPct).toBeUndefined();
    expect(s.clicksChange).toBe('within normal variation');
  });
  it('a real change and an older report without the test keep the percentage', () => {
    expect(summarize('site_tracker', { ...body, significance: { clicks: { pct: 52, real: true } } }).clicksPct).toBe(52);
    expect(summarize('site_tracker', { ...body, significance: undefined }).clicksPct).toBe(52);
  });
});

describe('R104: the Pipeline\'s last run is the schedule\'s own fire; on-demand runs and missed fires are named', () => {
  const auto = (o: Partial<AutomationStatus>): AutomationStatus => ({ id: 'rank_tracker', state: 'on', reason: null, nextRunAt: '2026-10-19T12:00:00.000Z', lastRunAt: '2026-10-15T19:48:00.000Z', lastResult: '0 ladder pages in the top 10', lastReportId: 'r', monthlyCredits: 0.1, detail: null, ...o });

  // 2026-10-19: the weekly jobs run in each website's own cycle (withCycleTruth, below); the daily AI pulse is still on the engine's clock
  it('only an on-demand run since the due time of a daily schedule: no last run, "scheduled run missed", and the run named as on demand', () => {
    const [a] = withScheduleTruth([auto({ id: 'ai_pulse', lastResult: 'Named in 20% of 40 answers' })], { SEOagentAIPulse1: [{ id: 'i', workflowId: 'SEOagentAIPulse1', status: 'success', startedAt: '2026-10-15T19:48:00.000Z', mode: 'integrated' }] }, 'America/New_York', new Date('2026-10-15T20:00:00Z'));
    expect(a.lastRunAt).toBeNull();
    expect(a.lastResult).toMatch(/^scheduled run missed on 2026-10-15 · last run on demand 2026-10-15 19:48 UTC · Named in 20% of 40 answers$/);
  });

  it('a job of the website\'s cycle is left to the cycle\'s own records by the shared-clock rule (no false "missed")', () => {
    const [a] = withScheduleTruth([auto({})], { SEOagentTracker1: [] }, 'America/New_York', new Date('2026-10-15T20:00:00Z'));
    expect([a.lastRunAt, a.lastResult]).toEqual(['2026-10-15T19:48:00.000Z', '0 ladder pages in the top 10']);
  });

  it("withCycleTruth: the last run is the job's last finish in the website's cycles; a job that gave up is named", () => {
    const job = (o: Partial<CycleJobRow>): CycleJobRow => ({ key: '', site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-14', job: 'rank_tracker', workflow_id: 'SEOagentTracker1', status: 'done', attempts: 1, run_id: '1', ledger_key: '', monthly: false, reason: '', due_at: '2026-10-14T02:00:00.000Z', started_at: '2026-10-14T02:05:00.000Z', finished_at: '2026-10-14T02:09:00.000Z', updated_at: '', ...o });
    const [done] = withCycleTruth([auto({ lastRunAt: null, lastResult: null })], [job({})]);
    expect(done.lastRunAt).toBe('2026-10-14T02:09:00.000Z');
    const [gave] = withCycleTruth([auto({ lastResult: null })], [job({}), job({ cycle_key: 'cyc:site_techand-ai:2026-10-21', status: 'gave_up', due_at: '2026-10-21T02:00:00.000Z', finished_at: '' })]);
    expect(gave.lastRunAt).toBe('2026-10-14T02:09:00.000Z');
    expect(gave.lastResult).toBe('did not run in the cycle of 2026-10-21 after 3 attempts');
    // no job rows yet: what the app's own rows say stays
    expect(withCycleTruth([auto({})], [])[0].lastRunAt).toBe('2026-10-15T19:48:00.000Z');
  });

  it('without the engine\'s history nothing changes', () => {
    const [a] = withScheduleTruth([auto({})], {}, 'America/New_York', new Date('2026-10-15T20:00:00Z'));
    expect(a.lastRunAt).toBe('2026-10-15T19:48:00.000Z');
    expect(a.lastResult).toBe('0 ladder pages in the top 10');
  });

  it('the pulse\'s last run is its row\'s checked_at, not the date with 06:30 made up', () => {
    expect(pulseLastRun([{ date: '2026-10-15', checkedAt: '2026-10-15T11:11:24.000Z' }])).toBe('2026-10-15T11:11:24.000Z');
    expect(pulseLastRun([{ date: '2026-10-15' }])).toBe('2026-10-15');
    expect(pulseLastRun([])).toBeNull();
  });
});

describe('R95 / R104: the AI Pulse series has one point per date, even with a scheduled and an on-demand reading that day', () => {
  const row = (o: Record<string, unknown>) => ({ site_id: 's', domain: 'techand.ai', date: '2026-10-15', checked_at: '', run_id: '', samples: 0, mentioned: 0, cited: 0, mention_rate: 0, citation_rate: 0, share_of_voice: 0, visibility_score: 0, engines_json: '', prompts_json: '', competitors_json: '', sources_json: '', alerts: '', cost_usd: 0, ...o }) as never;

  it('pools the two rows of 2026-10-15: samples, mentions and citations summed, rates recomputed; the newest reading is the last run', () => {
    const d = aiDailySeries([
      row({ date: '2026-10-14', checked_at: '2026-10-14T14:51:44Z', run_id: 'a', samples: 21, mentioned: 0, cited: 0, mention_rate: 0, citation_rate: 0 }),
      row({ checked_at: '2026-10-15T11:11:24Z', run_id: 'sched', samples: 21, mentioned: 2, cited: 1, mention_rate: 9.5, citation_rate: 4.8, share_of_voice: 10, visibility_score: 20, alerts: 'low: one engine failed' }),
      row({ checked_at: '2026-10-15T19:42:00Z', run_id: 'ondemand', samples: 19, mentioned: 0, cited: 0, mention_rate: 0, citation_rate: 0, share_of_voice: 0, visibility_score: 0 }),
    ]);
    expect(d.map((x) => x.date)).toEqual(['2026-10-14', '2026-10-15']);
    expect(d[1]).toMatchObject({ samples: 40, mentionRate: 5, citationRate: 2.5, checkedAt: '2026-10-15T19:42:00Z', alerts: ['one engine failed'] });   // A4 (2026-10-23): the level is read off the " | "-joined text
    expect(d[1].shareOfVoice).toBeCloseTo(5.3, 1);
    // one row a day reads exactly as stored
    expect(d[0]).toMatchObject({ samples: 21, mentionRate: 0, checkedAt: '2026-10-14T14:51:44Z' });
  });
});

describe('R116: the refusal A5 posts carries extra fields; the handler takes the contract and ignores the rest', () => {
  it('closes the run with the sentence whatever else the body carries', () => {
    const body = { stage: 'rejected', status: 'rejected', error: 'A backlinks check for techand.ai started 81 ms earlier is still running.', request_id: '621', domain: 'techand.ai', mode: 'backlinks', on_demand: true, reason: 'same_mode', basis: { open: 1 }, execution_id: '624', parent_run_id: '621', cost_usd: 0, refused_at: '2026-10-15T19:41:00Z' };
    expect(stageOf(body)).toBe('rejected');
    expect(runOutcome('accepted', ['backlinks'], stageOf(body), body)).toMatchObject({ status: 'failed', error: body.error });
    expect(summarize('rejected', body)).toBeTypeOf('object');
  });
});

// ---------- a minimal site bundle for recommend() ----------
const SITE = { id: 's1', domain: 'techand.ai', trackingStatus: 'active', keywords: [] } as unknown as SiteRow;
function bundleWith(o: { snapshotActions?: ReturnType<typeof engineActions>; items?: SiteBundle['content']['items']; audits?: AuditPoint[] }): SiteBundle {
  const tracking = { tracked: true, status: 'active', gscProperty: 'sc-domain:techand.ai', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true };
  return {
    search: { connection: tracking, snapshot: o.snapshotActions ? ({ actions: o.snapshotActions, gsc: { connected: true, error: null, current: null, previous: null, deltas: {}, daily: [], winners: [], losers: [], newQueries: [], lostQueries: [] }, ga4: { connected: true, organic: null, organicPrev: null, channels: [], landing: [], daily: [] }, brief: null } as unknown as SiteBundle['search']['snapshot']) : null, metrics: [], queries: [], periods: [], trends: [], annotations: [], dataBreaks: [], changeTests: [], lineage: [] },
    rankings: { ladders: [], keywords: [], lineage: [] },
    content: { items: o.items ?? [], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
    technical: { audits: o.audits ?? [], selectedAuditId: null, previousAuditId: null, findings: [], byCategory: [], reports: [], watch: null, indexCoverage: null },
    ai: { runs: [], latest: null, daily: [], prompts: [], answers: [], growth: null, report: null },
    backlinks: { snapshots: [], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
    alerts: { alerts: [], checkins: [], checkinDue: false },
    settings: { tracking, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
    rankNext: null,
    reportsElsewhere: false,
  } as unknown as SiteBundle;
}

// B-17 (F-B, 2026-10-17, re-rating 2026-10-17 exec 767): the summary said High 17 / Medium 18 beside a stored list of High 15 / Medium 15,
// because issue_counts also counts the unscored content-review findings. The callback now carries the stored counts.
describe('full report summary counts what the list holds (B-17)', () => {
  it('uses issue_counts_stored when the engine sends it, and names the unscored', () => {
    const s = summarize('full_report', { health_score: 70, grade: 'Needs Improvement', issue_counts: { Critical: 0, High: 17, Medium: 18, Low: 18, Info: 2 },
      issue_counts_stored: { Critical: 0, High: 15, Medium: 15, Low: 17, unscored: 7 } });
    expect([s.high, s.medium, s.unscored]).toEqual([15, 15, 7]);
  });
  it('an older payload keeps issue_counts', () => {
    const s = summarize('site_audit', { health_score: 85, grade: 'Good', issue_counts: { Critical: 0, High: 4, Medium: 7 } });
    expect([s.high, s.medium, s.unscored]).toEqual([4, 7, undefined]);
  });
});
