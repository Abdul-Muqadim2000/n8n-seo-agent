import { describe, expect, it } from 'vitest';
import { queueOrder } from '@seo/shared';
import type { SiteRow } from '../src/db/schema';
import { actionFromApiBody, recommend, type SiteBundle } from '../src/services/recommendations';

const site = { id: 's1', domain: 'northwind-erp.com', trackingStatus: 'active', keywords: [] } as unknown as SiteRow;

function bundle(over: Partial<SiteBundle> = {}): SiteBundle {
  return {
    search: { connection: { tracked: true, status: 'active', gscProperty: 'sc-domain:northwind-erp.com', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, snapshot: null, metrics: [], queries: [], periods: [], trends: [], annotations: [], dataBreaks: [], changeTests: [], lineage: [] },
    rankings: { ladders: [], keywords: [], lineage: [] },
    content: { items: [], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
    technical: { audits: [{ auditId: 'a1', auditedAt: new Date().toISOString(), reportType: 'site_audit', healthScore: 90, grade: 'Good', pagesCrawled: 10, findings: 0, critical: 0, high: 0, medium: 0, low: 0, scheduled: false }], selectedAuditId: 'a1', previousAuditId: null, findings: [], byCategory: [], reports: [], watch: null, indexCoverage: null },
    ai: { runs: [{ runId: 'r', checkedAt: '', prompts: 5, answers: 20, mentionRate: 50, citationRate: 10, shareOfVoice: 30, avgRank: 2, aioPresence: 0, aioCitationRate: 0, credits: 0, alerts: [], runKind: 'weekly', samples: 20, visibilityScore: 40, mentionLo: 30, mentionHi: 70, sentimentScore: null, accuracyIssues: 0, aiSessions: null, aiConversions: null, aiRevenue: null, indexSov: null, aiImpressions: null }], latest: null, daily: [], prompts: [], segments: null, panel: null, answers: [], growth: null, report: null },
    backlinks: { snapshots: [{ checkedAt: '', mode: 'full', rank: 1, backlinks: 1, referringDomains: 1, referringDomainsNofollow: 0, spamScore: 0, brokenBacklinks: 0, newLinks: 0, lostLinks: 0, importantLost: 0, spammyNew: 0, credits: 0, unionDomains: null, bestLinks: null, verifiedLive: null, atRisk: null, confirmedLost: null, referralVisits: null }], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
    alerts: { alerts: [], checkins: [], checkinDue: false },
    settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
    rankNext: null,
    reportsElsewhere: false,
    ...over,
  };
}

describe('recommend', () => {
  // G26 (2026-10-12, FIX_PLAN): the audit ranks its findings by likely impact and says why; the recommendation quotes that reason and keeps
  // the audit's order, so the app never tells the owner to start somewhere else than the report does.
  it('a technical recommendation keeps the audit order and quotes why the finding ranks there', () => {
    const finding = (over: Record<string, unknown>) => ({ key: 'k', category: 'Crawlability & Indexing', severity: 'High', title: 't', affectedCount: 2, previousCount: null, status: 'open' as const, impact: null as number | null, impactBasis: '', recheck: null, ...over });
    const recs = recommend(
      site,
      bundle({
        technical: {
          ...bundle().technical,
          findings: [
            finding({ key: 'noindex', title: 'Key pages are noindex', impact: 50.7, impactBasis: 'Google cannot index or follow these pages · 2 of 14 crawled pages · about 720 clicks and 15,400 impressions in the last 28 days · High severity' }),
            finding({ key: 'title', category: 'On-Page', severity: 'Critical', title: 'Missing title tag', affectedCount: 1, impact: 12.3, impactBasis: '1 of 14 crawled pages · about 1 click and 40 impressions in the last 28 days · Critical severity' }),
          ],
        },
      }),
    ).filter((r) => r.id.startsWith('tech:'));
    expect(recs.map((r) => r.id)).toEqual(['tech:noindex', 'tech:title']);
    expect(recs[0].evidence).toContain('Google cannot index or follow these pages');
    expect(recs[0].evidence).toContain('720 clicks');
  });

  it('a finding from an audit written before the impact weight existed still gets its page count as evidence', () => {
    const recs = recommend(
      site,
      bundle({
        technical: {
          ...bundle().technical,
          findings: [{ key: 'old', category: 'On-Page', severity: 'High', title: 'Missing meta description', affectedCount: 4, previousCount: null, status: 'open', impact: null, impactBasis: '', recheck: null }],
        },
      }),
    ).filter((r) => r.id.startsWith('tech:'));
    expect(recs[0].evidence).toBe('4 page(s) affected');
  });

  it('a healthy, fully set-up site gets no setup nagging', () => {
    expect(recommend(site, bundle()).filter((r) => r.category === 'setup')).toEqual([]);
  });

  it('finds striking-distance queries with an "improve the page" run', () => {
    const recs = recommend(
      site,
      bundle({
        search: {
          ...bundle().search,
          periods: ['2026-09-29'],
          queries: [
            { query: 'erp dubai', periodEnd: '2026-09-29', clicks: 4, impressions: 340, ctr: 0.01, position: 8.2, prevClicks: 3, prevImpressions: 300, prevPosition: 9, page: 'https://northwind-erp.com/erp/', tracked: false, serpPosition: -1 },
            { query: 'tiny', periodEnd: '2026-09-29', clicks: 0, impressions: 3, ctr: 0, position: 9, prevClicks: 0, prevImpressions: 0, prevPosition: 0, page: '', tracked: false, serpPosition: -1 },
          ],
        },
      }),
    );
    const r = recs.find((x) => x.id === 'search:striking:erp dubai');
    expect(r?.priority).toBe('high');
    expect(r?.action).toMatchObject({ mode: 'keyword', prefill: { keyword: 'erp dubai', existingPageUrl: 'https://northwind-erp.com/erp/' } });
    expect(recs.some((x) => x.id === 'search:striking:tiny')).toBe(false);
  });

  it('asks to publish written pages and to route reports here', () => {
    const recs = recommend(
      site,
      bundle({
        reportsElsewhere: true,
        content: { ...bundle().content, items: [{ keyword: 'erp pricing', source: 'cadence', pageType: 'Blog Post', rung: 0, ladderId: '', requestId: '', startedAt: new Date(Date.now() - 6 * 864e5).toISOString(), status: 'started', publishedUrl: '', publishedAt: '', week: '', existingPageUrl: '' }] },
      }),
    );
    expect(recs[0].priority).toBe('high');
    expect(recs.find((r) => r.id === 'setup:delivery')).toBeTruthy();
    expect(recs.find((r) => r.id === 'content:publish:erp pricing')?.action).toMatchObject({ mode: 'published', prefill: { keyword: 'erp pricing' } });
  });

  it('the next ladder rung opens the ladder on the Pipeline page', () => {
    const rung = (keyword: string, status: string, pageNo: number) => ({ rung: 1, pageNo, keyword, supporting: [], pageType: 'Guide', targetUrl: '', pageExists: false, status, months: '1-2', latestPosition: null, previousPosition: null, bestPosition: null, lastChecked: null, history: [] });
    const recs = recommend(site, bundle({ rankings: { keywords: [], lineage: [], ladders: [{ ladderId: 'lad_1', headKeyword: 'erp dubai', country: 'United Arab Emirates', startDate: '', pages: 2, published: 0, rungs: [rung('erp cost dubai', 'writing', 1), rung('erp vendors dubai', 'planned', 2)] }] } }));
    expect(recs.find((r) => r.id === 'rank:next:lad_1')?.action).toEqual({ label: 'Open the ladder', page: 'pipeline/ladders/lad_1' });
  });

  // REP 3.3 (benchmark pass 2026-10-14): the list is no longer sorted by the hand-set priority, it is the one queue, ordered by
  // impact x confidence / effort (`@seo/shared/queue`). The guarantee these two tests keep is the new one.
  it('returns the one queue in its own order: blocking setup first, then by value, then whatever nothing measured', () => {
    const recs = recommend(site, bundle({ settings: { ...bundle().settings, readiness: { score: 20, missing: ['Author name'] } }, alerts: { alerts: [], checkins: [], checkinDue: true } }));
    expect(recs).toEqual(queueOrder(recs));
    const band = (r: (typeof recs)[number]) => (r.score?.blocking ? 0 : r.score?.ranked ? 1 : 2);
    expect(recs.map(band)).toEqual([...recs.map(band)].sort());
    const values = recs.filter((r) => band(r) === 1).map((r) => (r.score && r.score.ranked ? r.score.value : 0));
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('gives every recommendation a score, and never a number without a basis', () => {
    const recs = recommend(site, bundle({ settings: { ...bundle().settings, readiness: { score: 20, missing: ['Author name'] } }, alerts: { alerts: [], checkins: [], checkinDue: true } }));
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.score, r.id).toBeDefined();
      if (r.score && r.score.ranked) expect(r.score.basis.length, r.id).toBeGreaterThan(0);
      else if (r.score) expect(r.score.reason.length, r.id).toBeGreaterThan(0);
    }
  });
});

describe('AI growth owner steps (v4.12)', () => {
  const growth = (o: Record<string, unknown> = {}) => ({
    checkedAt: '', pagesChecked: 0, avgScore: null, pages: [], targets: [], entity: null, actions: [], alerts: [], pagesPerMonth: 2, writtenThisMonth: 0,
    submitted: { bing: { enabled: true, inAccount: true, submitted: 0, quota: null, error: '' }, indexnow: { keyUrl: 'https://northwind-erp.com/0123456789abcdef0123456789abcdef.txt', key: '0123456789abcdef0123456789abcdef', verified: false, submitted: 0, error: '' } },
    earned: [
      { url: 'https://gulfnews.com/x', title: 'Best providers', host: 'gulfnews.com', kind: 'list', citations: 3, engines: ['chatgpt'], questions: ['q'], mentionsUs: false, competitorsNamed: [], action: 'Ask', status: 'new', drafted: true, contactEmail: '', draft: { subject: 's', body: 'b' } },
      { url: 'https://cleartax.com/x', title: '', host: 'cleartax.com', kind: 'competitor', citations: 2, engines: [], questions: [], mentionsUs: false, competitorsNamed: [], action: '', status: 'new', drafted: true, contactEmail: '', draft: null },
      { url: 'https://reddit.com/x', title: '', host: 'reddit.com', kind: 'forum', citations: 1, engines: [], questions: [], mentionsUs: false, competitorsNamed: [], action: '', status: 'contacted', drafted: true, contactEmail: '', draft: null },
    ],
    ...o,
  });
  const withGrowth = (g: unknown) => { const b = bundle(); return bundle({ ai: { ...b.ai, growth: g as SiteBundle['ai']['growth'] } }); };
  it('asks for the IndexNow key file and to send the drafts that wait (not competitors, not the ones sent)', () => {
    const r = recommend(site, withGrowth(growth()));
    const inx = r.find((x) => x.id === 'ai:indexnow')!, out = r.find((x) => x.id === 'ai:outreach')!;
    expect(inx.detail).toContain('0123456789abcdef0123456789abcdef.txt');
    expect(inx.action?.page).toBe('ai');
    expect(out.title).toBe('1 outreach draft ready for pages AI cites');
    expect(out.evidence).toBe('gulfnews.com');
  });
  it('says nothing once the file is in place and every draft is sent', () => {
    const g = growth({ submitted: { bing: { enabled: true, inAccount: true, submitted: 0, quota: null, error: '' }, indexnow: { keyUrl: '', key: 'k', verified: true, submitted: 3, error: '' } } });
    (g.earned as { status: string }[])[0].status = 'contacted';
    const r = recommend(site, withGrowth(g));
    expect(r.some((x) => x.id === 'ai:indexnow' || x.id === 'ai:outreach')).toBe(false);
  });
});

describe('actionFromApiBody', () => {
  it('maps the engine body to a pre-filled tool', () => {
    expect(actionFromApiBody({ mode: 'keyword', keyword: 'peppol uae', page_type: 'Guide-style Service Page', existing_page_url: 'https://x.com/p', receive: ['Keyword Report', 'Page Content'] }, 'Run')).toEqual({
      label: 'Run',
      mode: 'keyword',
      prefill: { keyword: 'peppol uae', pageType: 'Guide', existingPageUrl: 'https://x.com/p', receiveReport: true, receiveContent: true },
    });
    expect(actionFromApiBody({ mode: 'explode' }, 'x')).toBeUndefined();
    expect(actionFromApiBody(null, 'x')).toBeUndefined();
  });
});
