import { describe, expect, it } from 'vitest';
import { clientTextIssues, recRuleFor, type IndexPageRow, type IndexingForRecs, type SiteTask } from '@seo/shared';
import type { RecommendationStateRow, SiteRow } from '../src/db/schema';
import { recommend, type SiteBundle } from '../src/services/recommendations';
import { boardOf, setIndexPageReader, verdictFor, verifyContext } from '../src/services/recommendationStates';

// CR17-H (client report 2026-11-17, Q4): one card per issue, a rule per family, resolution verified by our own checks with the date and evidence.
// Built from devaicon.com's list of 2026-11-17 (INV_6 Q4): three "Request indexing for <page>" items from the weekly site report, the audit's "A
// large share of important pages is not indexed by Google", and Index coverage's ask-Google list were five cards for one problem.

const site = { id: 's1', domain: 'devaicon.com', trackingStatus: 'active', keywords: [], verifiedAt: new Date() } as unknown as SiteRow;
const P = (p: string) => `https://devaicon.com${p}`;

function bundle(over: Partial<SiteBundle> = {}): SiteBundle {
  return {
    search: { connection: { tracked: true, status: 'active', gscProperty: 'sc-domain:devaicon.com', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, snapshot: null, metrics: [], queries: [], periods: [], trends: [], annotations: [], dataBreaks: [], changeTests: [], lineage: [] },
    rankings: { ladders: [], keywords: [], lineage: [] },
    content: { items: [], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
    technical: { audits: [{ auditId: 'a1', auditedAt: '2026-10-28T09:00:00.000Z', reportType: 'site_audit', healthScore: 80, grade: 'Good', pagesCrawled: 30, findings: 1, critical: 0, high: 1, medium: 0, low: 0, scheduled: false }], selectedAuditId: 'a1', previousAuditId: null, findings: [], byCategory: [], reports: [], watch: null, indexCoverage: null },
    ai: { runs: [], latest: null, daily: [], promptsMax: null, prompts: [], segments: null, panel: null, answers: [], growth: null, report: null },
    backlinks: { snapshots: [{ checkedAt: '', mode: 'full', rank: 1, backlinks: 1, referringDomains: 1, referringDomainsNofollow: 0, spamScore: 0, brokenBacklinks: 0, newLinks: 0, lostLinks: 0, importantLost: 0, spammyNew: 5, credits: 0, unionDomains: null, bestLinks: null, verifiedLive: null, atRisk: null, confirmedLost: null, referralVisits: null }], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
    alerts: { alerts: [], checkins: [], checkinDue: false },
    settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
    rankNext: null,
    reportsElsewhere: false,
    ...over,
  } as SiteBundle;
}

const indexAction = (path: string, kw: string) => ({
  source: 'site_tracker' as const,
  priority: 1,
  type: 'index',
  action: `Request indexing for ${P(path)} in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.`,
  why: `The page for "${kw}" cannot rank until Google indexes it (Discovered - currently not indexed).`,
  keyword: kw,
  url: P(path),
  receivedAt: '2026-11-13T09:00:00.000Z',
  apiBody: null,
});
const devaicon = (ixOn: boolean): SiteBundle => {
  const b = bundle();
  const ix: IndexingForRecs = {
    on: ixOn,
    runAt: '2026-11-17T05:15:00.000Z',
    freeze: { on: true, reason: 'core update' },
    siteFix: [],
    other: [],
    quality: [],
    askGoogle: [{ url: P('/services/ai-app-development-companies'), title: 'AI app development' }, { url: P('/cookies'), title: 'Cookies' }],
  };
  return bundle({
    search: {
      ...b.search,
      snapshot: {
        receivedAt: '2026-11-13T09:00:00.000Z',
        gsc: { connected: true, property: 'sc-domain:devaicon.com', error: null },
        ga4: { connected: true },
        actions: [
          indexAction('/services/ai-development-companies', 'ai development companies'),
          indexAction('/services/ai-app-development-companies', 'ai app development companies'),
          indexAction('/capabilities-application-software-development', 'application software development'),
        ],
      } as unknown as SiteBundle['search']['snapshot'],
    },
    technical: {
      ...b.technical,
      findings: [{ key: 'crawlability & indexing|a large share of important pages is not indexed by google', category: 'Crawlability & Indexing', severity: 'High', title: 'A large share of important pages is not indexed by Google', affectedCount: 15, previousCount: null, status: 'open', impact: 30, impactBasis: '15 of 23 sampled pages are not indexed', recheck: null }],
    },
    indexing: ix,
    // devaicon.com has a keyword ladder (so no "choose your first keyword")
    rankings: { keywords: [], lineage: [], ladders: [{ ladderId: 'lad_1', headKeyword: 'ai development company', country: 'Pakistan', startDate: '', pages: 1, published: 1, rungs: [] }] } as unknown as SiteBundle['rankings'],
  });
};

describe('one card for pages Google has not put in search (Index coverage owns indexing)', () => {
  it('devaicon.com: five asks in four wordings become one card listing every page, with the other sources named', () => {
    const recs = recommend(site, devaicon(true));
    const ids = recs.map((r) => r.id);
    expect(ids.filter((id) => /^engine:site_tracker:index:|^ix:ask_google$/.test(id) || /not indexed by google/.test(id))).toEqual([]);
    const card = recs.find((r) => r.id === 'ix:not_indexed')!;
    expect(card).toBeTruthy();
    expect(card.subjects?.sort()).toEqual([P('/capabilities-application-software-development'), P('/cookies'), P('/services/ai-app-development-companies'), P('/services/ai-development-companies')].sort());
    expect(card.alsoFrom).toEqual(expect.arrayContaining(['the weekly site report', 'the technical audit']));
    expect(card.priority).toBe('medium');
    expect(card.action).toEqual({ label: 'See the pages', page: 'indexing' });
    expect(card.rule?.guide).toBe('index-coverage');
  });
  it('with Index coverage off, the sources keep their own items (one card per page)', () => {
    const recs = recommend(site, devaicon(false));
    expect(recs.some((r) => r.id === 'ix:not_indexed')).toBe(false);
    expect(recs.filter((r) => r.id.startsWith('engine:site_tracker:index:')).length).toBe(3);
    // titles never end mid-sentence and carry no arrow; what does not fit opens the detail
    for (const r of recs.filter((r) => r.id.startsWith('engine:site_tracker:index:'))) {
      expect(r.title).not.toMatch(/→|\b(from|and|to)$/);
      expect(r.detail).toMatch(/link to it from 2-3 existing pages/i);
    }
  });
  it('no High is left from a source\'s own number: the five High items of the list are one Medium card', () => {
    expect(recommend(site, devaicon(true)).filter((r) => r.priority === 'high').map((r) => r.id)).toEqual([]);
  });
  it('a measure is not a task: "spammy links" leaves the to-do list', () => {
    expect(recommend(site, devaicon(true)).some((r) => r.id === 'bl:spam')).toBe(false);
  });
  it('every item has its rule and issue, and every string a client reads passes the client-copy guard', () => {
    for (const ixOn of [true, false]) {
      for (const r of recommend(site, devaicon(ixOn))) {
        expect(recRuleFor(r.id), r.id).toBeTruthy();
        expect(r.rule, r.id).toBeTruthy();
        expect(r.issueKey, r.id).toBeTruthy();
        for (const t of [r.title, r.detail, r.evidence ?? '']) expect(clientTextIssues(t), `${r.id}: ${t}`).toEqual([]);
      }
    }
  });
});

describe('our checks decide the state (the verifiers)', () => {
  const task = (over: Partial<SiteTask>): SiteTask => ({ key: 'indexnow', kind: 'indexnow', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'info', title: 't', detail: 'd', values: [], guide: 'indexnow-key-file', guideVars: {}, skipped: null, ...over });
  const rec = { id: 'ai:indexnow', taskKey: 'indexnow', category: 'ai' as const, priority: 'medium' as const, title: 'Add one small file', detail: 'd' };
  const ctx = (tasks: SiteTask[], x = bundle()) => verifyContext(site, x, tasks, new Date('2026-11-20T10:00:00.000Z'));
  it('a step on the website: its own check (done, waiting for Google, skipped, checked by you and not done)', async () => {
    expect(await verdictFor({ rec, present: false }, ctx([task({ state: 'done', doneAt: '2026-11-19T08:00:00.000Z', lastCheck: { at: '2026-11-19T08:00:00.000Z', ok: true, by: 'daily', message: 'The file was found.' } })]))).toEqual({ outcome: 'resolved', evidence: 'The file was found.', at: '2026-11-19T08:00:00.000Z' });
    expect((await verdictFor({ rec, present: false }, ctx([task({ state: 'done', waitingForGoogle: true, lastCheck: { at: '2026-11-19T08:00:00.000Z', ok: true, by: 'index', message: 'Fixed on your site.' } })]))).outcome).toBe('waiting');
    expect((await verdictFor({ rec, present: false }, ctx([task({ state: 'skipped', skipped: { at: '2026-11-18T00:00:00.000Z', who: 'u' } })]))).outcome).toBe('dismissed');
    const failed = await verdictFor({ rec, present: true }, ctx([task({ lastCheck: { at: '2026-11-19T08:00:00.000Z', ok: false, by: 'you', message: 'The file was not found.' } })]));
    expect(failed).toMatchObject({ outcome: 'failed', evidence: 'We checked on 2026-11-19: The file was not found.' });
    // steps that could not be read: never resolved
    expect((await verdictFor({ rec, present: false }, verifyContext(site, bundle(), undefined))).outcome).toBe('unknown');
  });
  it('the daily index check: every page of the card in Google (or moved for good) -> resolved with the dates', async () => {
    const row = (path: string, over: Partial<IndexPageRow>) => ({ url: P(path), state: 'not_indexed', final_url: '', indexed_since: '', ...over }) as unknown as IndexPageRow;
    setIndexPageReader(async () => [row('/a', { state: 'indexed', indexed_since: '2026-11-18T00:00:00.000Z' }), row('/b', { final_url: P('/services/b') }), row('/c', { asked_google_at: '2026-11-17T11:05:00.000Z' })]);
    const card = { id: 'ix:not_indexed', category: 'technical' as const, priority: 'medium' as const, title: 't', detail: 'd', subjects: [P('/a'), P('/b')] };
    const v = await verdictFor({ rec: card, present: false }, ctx([]));
    expect(v.outcome).toBe('resolved');
    expect(v.evidence).toBe('/a is in Google since 2026-11-18, /b moved to /services/b.');
    const waiting = await verdictFor({ rec: { ...card, subjects: [P('/a'), P('/c')] }, present: true }, ctx([]));
    expect(waiting.outcome).toBe('waiting');
  });
  it('a family computed from the current state is done when it is gone; a weekly report\'s item gone with no check is unknown (it expires)', async () => {
    expect(await verdictFor({ rec: { id: 'setup:gsc', category: 'setup', priority: 'high', title: 't', detail: 'd' }, present: false }, ctx([]))).toEqual({ outcome: 'resolved', evidence: 'Search Console is connected.' });
    expect((await verdictFor({ rec: { id: 'search:drop:erp dubai', category: 'search', priority: 'high', title: 't', detail: 'd' }, present: false }, ctx([]))).outcome).toBe('unknown');
  });
  it('an audit finding: fixed in a newer audit, or checked again on request', async () => {
    const x = bundle();
    const f = { key: 'k1', category: 'On-Page', severity: 'High', title: 'Missing title', affectedCount: 1, previousCount: null, impact: null, impactBasis: '', recheck: null };
    const tech = (status: 'open' | 'fixed', recheck: unknown = null) => bundle({ technical: { ...x.technical, findings: [{ ...f, status, recheck } as never] } });
    const r = { id: 'tech:k1', category: 'technical' as const, priority: 'high' as const, title: 't', detail: 'd' };
    expect((await verdictFor({ rec: r, present: false }, ctx([], tech('fixed')))).outcome).toBe('resolved');
    expect((await verdictFor({ rec: r, present: true }, ctx([], tech('open', { state: 'requested', requestedAt: '2026-11-19T10:00:00.000Z', checkedAt: '', rule: '', note: '' })))).outcome).toBe('in_progress');
    expect((await verdictFor({ rec: r, present: true }, ctx([], tech('open', { state: 'still_open', requestedAt: '', checkedAt: '2026-11-20T03:00:00.000Z', rule: 'r', note: 'Still missing on /x.' })))).outcome).toBe('failed');
  });
});

describe('the board: To do / Waiting for Google / Resolved / Dismissed from the same states', () => {
  const row = (recKey: string, state: RecommendationStateRow['state'], stateAt: string, snapshot: Record<string, unknown> = {}): RecommendationStateRow =>
    ({ id: recKey, orgId: 'o', siteId: 's1', recKey, issueKey: recKey, state, snapshot: { id: recKey, category: 'technical', priority: 'medium', title: `T ${recKey}`, detail: 'd', ...snapshot }, evidence: state === 'resolved' ? 'Search Console is connected.' : '', firstSeenAt: new Date('2026-11-01T00:00:00.000Z'), lastSeenAt: new Date(stateAt), stateAt: new Date(stateAt), dismissedReason: state === 'dismissed' ? 'not_relevant' : '', dismissedNote: '', byUser: null, updatedAt: new Date(stateAt) }) as RecommendationStateRow;
  it('splits the items, keeps gone ones from their snapshot, hides resolved after 90 days', () => {
    const now = Date.parse('2026-11-20T10:00:00.000Z');
    const recs = [{ id: 'a', category: 'technical' as const, priority: 'medium' as const, title: 'A', detail: 'd' }, { id: 'b', category: 'technical' as const, priority: 'medium' as const, title: 'B', detail: 'd' }];
    const rows = new Map([
      ['a', row('a', 'open', '2026-11-19T00:00:00.000Z')],
      ['b', row('b', 'dismissed', '2026-11-18T00:00:00.000Z')],
      ['c', row('c', 'resolved', '2026-11-19T00:00:00.000Z')],
      ['d', row('d', 'resolved', '2026-07-01T00:00:00.000Z')],
      ['e', row('e', 'waiting_for_google', '2026-11-19T00:00:00.000Z')],
      ['f', row('f', 'expired', '2026-11-19T00:00:00.000Z')],
    ]);
    const b = boardOf(recs, rows, now);
    expect(b.todo.map((r) => r.id)).toEqual(['a']);
    expect(b.todo[0]).toMatchObject({ state: 'open', firstSeenAt: '2026-11-01T00:00:00.000Z' });
    expect(b.dismissed.map((r) => [r.id, r.dismissed?.reason])).toEqual([['b', 'Not relevant to my business']]);
    expect(b.resolved.map((r) => [r.id, r.title, r.stateEvidence])).toEqual([['c', 'T c', 'Search Console is connected.']]);
    expect(b.waiting.map((r) => r.id)).toEqual(['e']);
    expect(b.expired.map((r) => r.id)).toEqual(['f']);
    expect(b.dismissReasons.length).toBeGreaterThan(2);
  });
});
