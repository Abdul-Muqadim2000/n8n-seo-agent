import { describe, expect, it } from 'vitest';
import type { SiteRow } from '../src/db/schema';
import { actionFromApiBody, recommend, type SiteBundle } from '../src/services/recommendations';

const site = { id: 's1', domain: 'northwind-erp.com', trackingStatus: 'active', keywords: [] } as unknown as SiteRow;

function bundle(over: Partial<SiteBundle> = {}): SiteBundle {
  return {
    search: { connection: { tracked: true, status: 'active', gscProperty: 'sc-domain:northwind-erp.com', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, snapshot: null, metrics: [], queries: [], periods: [], trends: [] },
    rankings: { ladders: [], keywords: [] },
    content: { items: [], cadence: { pagesPerWeek: 1, status: 'active' }, caseStudies: [], profile: null, readiness: { score: 100, missing: [] }, generated: [] },
    technical: { audits: [{ auditId: 'a1', auditedAt: new Date().toISOString(), reportType: 'site_audit', healthScore: 90, grade: 'Good', pagesCrawled: 10, findings: 0, critical: 0, high: 0, medium: 0, low: 0, scheduled: false }], selectedAuditId: 'a1', previousAuditId: null, findings: [], byCategory: [], reports: [] },
    ai: { runs: [{ runId: 'r', checkedAt: '', prompts: 5, answers: 20, mentionRate: 50, citationRate: 10, shareOfVoice: 30, avgRank: 2, aioPresence: 0, aioCitationRate: 0, costUsd: 0, alerts: [], runKind: 'weekly', samples: 20, visibilityScore: 40, mentionLo: 30, mentionHi: 70, sentimentScore: null, accuracyIssues: 0, aiSessions: null, aiConversions: null, aiRevenue: null, indexSov: null, aiImpressions: null }], latest: null, daily: [], prompts: [], answers: [], report: null },
    backlinks: { snapshots: [{ checkedAt: '', mode: 'full', rank: 1, backlinks: 1, referringDomains: 1, referringDomainsNofollow: 0, spamScore: 0, brokenBacklinks: 0, newLinks: 0, lostLinks: 0, importantLost: 0, spammyNew: 0, costUsd: 0, unionDomains: null, bestLinks: null, verifiedLive: null, atRisk: null, confirmedLost: null, referralVisits: null }], latest: null, refs: [], imports: [], linkGraph: null, prospects: [], report: null },
    alerts: { alerts: [], checkins: [], checkinDue: false },
    settings: { tracking: { tracked: true, status: 'active', gscProperty: 'x', ga4PropertyId: '1', lastRunAt: null, lastStatus: null, keywords: [], reportsToThisApp: true }, monitors: null, cadence: null, profile: null, readiness: { score: 100, missing: [] } },
    rankNext: null,
    reportsElsewhere: false,
    ...over,
  };
}

describe('recommend', () => {
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
    const recs = recommend(site, bundle({ rankings: { keywords: [], ladders: [{ ladderId: 'lad_1', headKeyword: 'erp dubai', country: 'United Arab Emirates', startDate: '', pages: 2, published: 0, rungs: [rung('erp cost dubai', 'writing', 1), rung('erp vendors dubai', 'planned', 2)] }] } }));
    expect(recs.find((r) => r.id === 'rank:next:lad_1')?.action).toEqual({ label: 'Open the ladder', page: 'pipeline/ladders/lad_1' });
  });

  it('sorts by priority', () => {
    const recs = recommend(site, bundle({ settings: { ...bundle().settings, readiness: { score: 20, missing: ['Author name'] } }, alerts: { alerts: [], checkins: [], checkinDue: true } }));
    const ranks = recs.map((r) => ({ high: 0, medium: 1, low: 2 })[r.priority]);
    expect([...ranks].sort()).toEqual(ranks);
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
