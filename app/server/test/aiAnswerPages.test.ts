import { describe, expect, it, vi } from 'vitest';
import { AI_CLIENT_TEXT_BANNED, keywordInput, type ContentLogRow, type EngineAction, type LadderRow } from '@seo/shared';

// Client report 2026-11-16 (devaicon.com, issue 1; docs/AI_ANSWER_PAGES_2026-11-16.md): "write a page for this AI question" sent the panel
// topic as the keyword, Recommendations dropped the AI target, an AI page started in the app was logged as the app's own page and never
// moved its question, and the AI page printed the engine's internal reasons.

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', () => ({ db: {}, schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, k) => String(k) }) }) }));

const { actionFromApiBody, recommend } = await import('../src/services/recommendations');
const { aiTargetWritingUpdate, pageSourceFor } = await import('../src/services/runs');
const { aiWrittenPages, targetStat } = await import('../src/services/data');
const { writtenPages } = await import('../src/services/pipeline');

const DUBAI = 'Which companies offer the best AI automation services for businesses in Dubai?';
const aiTarget = { question: DUBAI, kind: 'answer', target_id: 'ait_devaicon-com_q_dubai', fanout: ['ai automation companies dubai'], sources: [{ u: 'https://clutch.co/ae/ai', t: 'Clutch' }], competitors: ['rival.ae'] };
const clean = (t: string) => AI_CLIENT_TEXT_BANNED.filter((re) => re.test(t)).map(String);

describe('actionFromApiBody keeps the AI target (F1 / F13)', () => {
  it('the answer page carries its question, its searches and sources; a "Comparison Page" opens as a guide', () => {
    const a = actionFromApiBody({ mode: 'keyword', keyword: 'best ai automation services dubai', page_type: 'Comparison Page', ai_target: aiTarget }, 'Write the answer page')!;
    expect(a.prefill).toEqual({
      keyword: 'best ai automation services dubai',
      pageType: 'Guide',
      aiTarget: { question: DUBAI, kind: 'answer', targetId: 'ait_devaicon-com_q_dubai', fanout: ['ai automation companies dubai'], sources: [{ url: 'https://clutch.co/ae/ai', title: 'Clutch' }], competitors: ['rival.ae'] },
    });
    expect(keywordInput.safeParse({ mode: 'keyword', siteId: null, country: 'United Arab Emirates', ...a.prefill }).success).toBe(true);
  });
  it('a refresh of an existing page is the AI target\'s refresh', () => {
    const a = actionFromApiBody({ mode: 'keyword', keyword: 'governed vs autonomous ai agents', existing_page_url: 'https://devaicon.com/services/engagement-models', ai_target: aiTarget }, 'x')!;
    expect(a.prefill).toMatchObject({ pageType: 'Service Page', existingPageUrl: 'https://devaicon.com/services/engagement-models', aiTarget: { kind: 'refresh' } });
  });
});

describe('recommendations: the AI report\'s page action goes through the resolver', () => {
  const site = { id: 's1', domain: 'devaicon.com', country: 'United Arab Emirates', trackingStatus: 'active', keywords: [] } as never;
  const action = (body: Record<string, unknown>): EngineAction => ({ source: 'ai_visibility', priority: 1, type: 'content', action: `Win the answer to "${DUBAI}"`, why: 'AI names three rivals here.', keyword: String(body.keyword ?? ''), url: null, receivedAt: '2026-11-13T07:00:00Z', apiBody: body });
  const bundle = (actions: EngineAction[], over: Record<string, unknown> = {}) =>
    ({
      search: { connection: { tracked: true, status: 'active', gscProperty: 'sc-domain:devaicon.com', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, snapshot: null, metrics: [], queries: [], periods: [], trends: [], annotations: [], dataBreaks: [], changeTests: [], lineage: [] },
      rankings: { ladders: [], keywords: [], lineage: [] },
      content: { items: [{ keyword: 'ai automation services', source: 'app', status: 'published', publishedUrl: 'https://devaicon.com/services/ai-automation-services-pakistan', startedAt: '2026-11-10T14:54:00Z' }], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
      technical: { audits: [{ auditId: 'a1', auditedAt: new Date().toISOString(), reportType: 'site_audit', healthScore: 90, grade: 'Good', pagesCrawled: 10, findings: 0, critical: 0, high: 0, medium: 0, low: 0, scheduled: false }], selectedAuditId: 'a1', previousAuditId: null, findings: [], byCategory: [], reports: [], watch: null, indexCoverage: null },
      ai: {
        runs: [], latest: null, daily: [], promptsMax: null, segments: null, panel: null, answers: [],
        prompts: [{ promptId: 'q_dubai', prompt: DUBAI, keyword: 'best ai automation services dubai', topic: 'ai automation services', kind: 'compare' }],
        growth: null,
        report: { receivedAt: '2026-11-13T07:00:00Z', runId: 'r', current: true, brief: null, questions: [], actions },
        ...over,
      },
      backlinks: { snapshots: [], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
      alerts: { alerts: [], checkins: [], checkinDue: false },
      settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
      rankNext: null,
      reportsElsewhere: false,
    }) as never;

  it('an older action with the topic keyword: the question\'s own search and its AI target, never "improve the service page"', () => {
    const r = recommend(site, bundle([action({ mode: 'keyword', keyword: 'ai automation services', page_type: 'Guide', ai_target: aiTarget })])).find((x) => x.id.startsWith('engine:ai_visibility'))!;
    expect(r.action!.label).toBe('Write the answer page');
    expect(r.action!.prefill).toMatchObject({ keyword: 'best ai automation services dubai', pageType: 'Guide', aiTarget: { question: DUBAI, kind: 'answer' } });
    expect(r.action!.prefill?.existingPageUrl).toBeUndefined();
  });

  it('a question whose page is already live (a stored target the server derived) is not recommended again', () => {
    const growth = { checkedAt: '', submitted: { bing: { enabled: true, inAccount: true, submitted: 0, quota: null, error: '' }, indexnow: { keyUrl: '', key: '', verified: true, submitted: 0, error: '' } }, pagesChecked: 0, avgScore: null, pages: [], earned: [], entity: null, actions: [], alerts: [], pagesPerMonth: 2, writtenThisMonth: 0, targets: [{ targetId: 'ait_devaicon-com_q_dubai', promptId: 'q_dubai', question: DUBAI, keyword: 'best ai automation services dubai', kind: 'answer', state: 'live', statePageUrl: 'https://devaicon.com/insights/x' }] };
    const recs = recommend(site, bundle([action({ mode: 'keyword', keyword: 'ai automation services', ai_target: aiTarget })], { growth }));
    expect(recs.some((x) => x.id.startsWith('engine:ai_visibility'))).toBe(false);
  });
});

describe('a page run started in the app for an AI question (F6)', () => {
  const base = { ladder: undefined, existingPageUrl: '', source: undefined };
  const t = { question: DUBAI, kind: 'answer' as const, targetId: 'ait_1', fanout: [], sources: [], competitors: [] };
  it('is logged as an AI page: ai_answer, or ai_refresh when it improves a page; a ladder page stays a ladder page', () => {
    expect(pageSourceFor({ ...base, aiTarget: t })).toBe('ai_answer');
    expect(pageSourceFor({ ...base, aiTarget: { ...t, kind: 'refresh' } })).toBe('ai_refresh');
    expect(pageSourceFor({ ...base, aiTarget: t, existingPageUrl: 'https://devaicon.com/x' })).toBe('ai_refresh');
    expect(pageSourceFor({ ...base, aiTarget: t, ladder: { id: 'l', rung: 1, head: 'h', pageNo: 1 } })).toBe('ladder');
    expect(pageSourceFor({ ...base, source: 'striking' })).toBe('striking');
    expect(pageSourceFor(base)).toBe('app');
  });
  it('moves its question to "being written" with the run, in plain words; never a question already won', () => {
    const u = aiTargetWritingUpdate({ aiTarget: t, existingPageUrl: '' }, '12467', 'devaicon.com', '2026-11-16T10:00:00.000Z')!;
    expect(u.filters).toEqual([
      { columnName: 'domain', condition: 'eq', value: 'devaicon.com' },
      { columnName: 'target_id', condition: 'eq', value: 'ait_1' },
      { columnName: 'status', condition: 'neq', value: 'won' },
    ]);
    expect(u.core).toEqual({ status: 'writing', request_id: '12467', updated_at: '2026-11-16T10:00:00.000Z', reason: 'A page for this question is being written (started 2026-11-16).' });
    expect(u.extra).toEqual({ reason_code: 'writing', reason_args: '{"date":"2026-11-16"}' });
    expect(clean(String(u.core.reason))).toEqual([]);
    expect(aiTargetWritingUpdate({ aiTarget: { ...t, targetId: '' }, existingPageUrl: '' }, '12467', 'devaicon.com', '2026-11-16T10:00:00.000Z')).toBeNull();
    expect(aiTargetWritingUpdate({ aiTarget: undefined, existingPageUrl: '' }, '12467', 'devaicon.com', '2026-11-16T10:00:00.000Z')).toBeNull();
  });
});

describe('the AI page\'s questions to win (F8 / F11)', () => {
  const row = (o: Record<string, unknown>) => ({ target_id: 'ait_41', site_id: 's', domain: 'devaicon.com', prompt_id: 'q_gov', question: 'Governed vs autonomous AI agents?', keyword: 'governed vs autonomous ai agents', kind: 'answer', page_url: '', page_type: 'Comparison Page', fanout: '', sources_json: '[]', competitors: '', engines: '', stage: '', value: 3, status: 'writing', reason: 'a page run (cad_20261113_devaicon-com_2) was started on 2026-11-13; nothing has been written yet — this row moves to "written" only against a seo_content_log row for that run', created_at: '', updated_at: '2026-11-13T01:28:00Z', request_id: 'cad_20261113_devaicon-com_2', written_at: '', won_at: '', ...o }) as never;
  const log = { keyword: 'governed vs autonomous ai agents', request_id: 'cad_20261113_devaicon-com_2', status: 'published', published_url: 'https://devaicon.com/insights/governed-vs-autonomous-ai-agents', published_at: '2026-11-13T11:08:00Z', started_at: '2026-11-13T01:28:00Z', source: 'cadence' } as unknown as ContentLogRow;
  it('a target whose page is live shows as published, with no internal text; the engine\'s note for platform admins only', () => {
    const t = targetStat(row({}), [log]);
    expect(t).toMatchObject({ state: 'live', badge: 'Published', tone: 'good', statePageUrl: 'https://devaicon.com/insights/governed-vs-autonomous-ai-agents', promptId: 'q_gov' });
    expect(clean(t.reason + ' ' + t.badge)).toEqual([]);
    expect(t.adminReason).toBeUndefined();
    expect(targetStat(row({}), [log], true).adminReason).toContain('cad_20261113');
  });
  it('a set-aside question reads "Not for this website", never set_aside', () => {
    const t = targetStat(row({ status: 'set_aside', reason: 'not a search this website should target: 0% (25% is the bar) (off topic); set aside, so no page is written for it.' }), []);
    expect(t.badge).toBe('Not for this website');
    expect(clean(t.reason)).toEqual([]);
  });
  it('the written pages carry the AI question the app\'s run carried', () => {
    const w = aiWrittenPages([{ keyword: 'ai automation services', request_id: '12467', status: 'published', published_url: 'https://devaicon.com/x', started_at: '2026-11-10T14:54:00Z', source: 'app' } as unknown as ContentLogRow], new Map([['12467', { targetId: '', question: DUBAI }]]));
    expect(w).toEqual([{ keyword: 'ai automation services', status: 'published', publishedUrl: 'https://devaicon.com/x', startedAt: '2026-11-10T14:54:00Z', source: 'app', aiTargetId: '', aiQuestion: DUBAI }]);
  });
});

describe('the Pipeline\'s written pages know the AI question (the form notice\'s data)', () => {
  it('a content-log row of an app run with an AI target carries its question; an AI page keeps its kind', () => {
    const logs = [
      { keyword: 'best ai automation services dubai', status: 'started', started_at: '2026-11-16T08:30:00Z', published_url: '', request_id: '13001', source: 'ai_answer' },
      { keyword: 'governed vs autonomous ai agents', status: 'published', started_at: '2026-11-13T01:28:00Z', published_url: 'https://devaicon.com/insights/g', request_id: 'cad_20261113_devaicon-com_2', source: 'ai_answer' },
    ] as unknown as ContentLogRow[];
    const w = writtenPages(logs, [] as LadderRow[], Date.parse('2026-11-16T09:00:00Z'), undefined, [{ requestId: '13001', aiTargetId: 'ait_36', aiQuestion: DUBAI }]);
    expect(w.find((x) => x.keyword === 'best ai automation services dubai')).toMatchObject({ source: 'ai_answer', aiTargetId: 'ait_36', aiQuestion: DUBAI });
    expect(w.find((x) => x.keyword === 'governed vs autonomous ai agents')?.source).toBe('ai_answer');
  });
});
