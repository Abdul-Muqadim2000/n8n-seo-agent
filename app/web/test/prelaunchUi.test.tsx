import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { autopilotMonthlyUsd, monitorSettingsSchema, type Ladder, type Me, type Org, type OverviewData, type PipelineData, type Site } from '@seo/shared';
import { SendReport } from '@/components/reports/SendReport';
import { inputRows } from '@/components/reports/run';
import { LevelChoices } from '@/components/site/AutopilotLevel';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { creditsLabel } from '@/lib/credits';
import { forecastPlanOf } from '@/lib/forecast-plan';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';
import { ContentCard } from '@/pages/site/OverviewPage';
import { LadderCard } from '@/pages/site/RankingsPage';
import { watchLine } from '@/pages/site/TechnicalPage';
import { contentGroups, liveLine } from '@/pages/site/_components/content-status';
import { fmtTime, fmtWhen } from '@/pages/site/_components/pipeline/common';
import { weeklyTradeOff } from '@/pages/site/_components/pipeline/WriteNowDialog';
import { ladderShape, rungView } from '@/pages/site/_components/rungs';
import { renderReport, report, text } from './renderReport';

// The browser pass of the paid pre-launch run on techand.ai (2026-10-21, BROWSER_REVIEW.md B1-B14, DRIVER_REPORT.md D6) and the E-QA rule
// (a not-ready draft is finished by hand, never run again), rendered to HTML in Node with the contexts the screens really get.

// the article viewer reads the theme's colour tokens from a browser document; these tests read the report around it
vi.mock('@/components/reports/article', async (orig) => ({ ...(await orig<typeof import('@/components/reports/article')>()), ArticleViewer: () => null }));

const ORG = 'org-run';
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const org = { id: ORG, name: 'Techand Live Run', slug: 'techand', industry: '', size: '1-10', website: 'techand.ai', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: '2026-10-21T14:08:00.000Z', createdAt: '2026-10-21T14:08:00.000Z', role: 'owner' } as Org;
const site = { id: 'site-1', orgId: ORG, domain: 'techand.ai', timezone: 'Asia/Dubai', trackingStatus: 'active', trackingStartedAt: '2026-10-21T14:14:00.000Z', cycleWeekday: 3, autopilotLevel: 2, blogsPerWeek: 1, verifiedAt: '2026-10-21T14:08:00.000Z' } as unknown as Site;

function render(node: ReactNode): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return renderToString(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role: 'owner', sites: [site], can: makeCan('owner') }}>
                <SiteContext.Provider value={{ site }}>{node}</SiteContext.Provider>
              </OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

// exec 42, the page for "ai consultant": not ready, two brackets, content score 97
const page = {
  keyword: 'ai consultant',
  html: '<h1>AI consultant in the UAE</h1><p>Text [Tech&amp; assessment duration and fee band, to confirm].</p>',
  markdown: '# AI consultant in the UAE\n\nText [Tech& assessment duration and fee band, to confirm].',
  verdict: 'GO_WITH_CHANGES',
  score: 58,
  qa_not_ready: true,
  qa_publishable: false,
  qa_label: 'did not pass the quality check, so it is not ready to publish',
  qa_reasons: ['2 bracket(s) left in the text for you to fill in'],
  meta: { content_score: 97, title: 'AI consultant in the UAE', word_count: 2099, page_type: 'Service Page' },
};
const eqa = {
  qa_next_step: 'Finish this draft by hand: delete [Tech& assessment duration and fee band, to confirm] and the words that need it. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.',
  qa_owner_edits: [{ token: '[Tech& assessment duration and fee band, to confirm]', count: 1, action: 'delete', text: 'Delete [Tech& assessment duration and fee band, to confirm] and the words that need it: no price facts are on file' }],
};

describe('B1: a page the quality check refused is a draft to finish by hand', () => {
  it('offers no "I published this page" and no re-run, and leads with the quality check, not the 97', () => {
    const t = text(renderReport(report('content', { ...page, ...eqa }, { status: 'completed', scheduled: false })));
    expect(t).not.toContain('I published this page');
    expect(t).not.toContain('Run it again');
    expect(t).toContain('needs your edits before you publish it');
    expect(t).not.toContain('is written');
    expect(t).toContain('Not ready to publish');
    expect(t).not.toMatch(/Content score\s*97/);
    // the engine's own next step and each bracket
    expect(t).toContain('You do not need a new run for these edits');
    expect(t).toContain('Delete [Tech& assessment duration and fee band, to confirm] and the words that need it');
  });
  it('an older report without the engine\'s next step gets the same advice in general words', () => {
    const t = text(renderReport(report('content', page, { status: 'completed' })));
    expect(t).toContain('Finish this draft by hand');
    expect(t).toContain('You do not need a new run');
    expect(t).not.toContain('Run it again');
  });
  it('a page that passed still offers "I published this page"', () => {
    const ok = { ...page, qa_not_ready: false, qa_publishable: true, qa_label: 'passed the quality check', qa_reasons: [], markdown: '# AI consultant', html: '<h1>AI consultant</h1>' };
    expect(text(renderReport(report('content', ok, { status: 'completed' })))).toContain('I published this page');
  });
  it('"Send it now" is not offered for a report the delivery would hold', () => {
    const held = report('content', { ...page, ...eqa }, { status: 'completed' });
    expect(text(renderReport(held, <SendReport report={held} />))).not.toContain('Send it now');
    const fine = report('ai_pulse', { mention_rate: 5.6 }, { status: 'completed' });
    expect(text(renderReport(fine, <SendReport report={fine} />))).toContain('Send it now');
  });
});

describe('B2 / B14: the content counts agree and read as sentences', () => {
  const overview = (c: Partial<OverviewData['content']>) => ({ content: { started: 1, published: 0, pendingPublish: 0, needsFix: 1, pagesPerWeek: 1, caseStudies: 0, ...c } }) as OverviewData;
  it('the Overview card says what the Content page says (one written page, not live, needs your edits)', () => {
    const t = text(render(<ContentCard d={overview({})} />));
    expect(t).toContain('Your written page is not live yet');
    expect(t).not.toMatch(/page started/);
    expect(t).not.toContain('Pages started');
    expect(t).toContain('Pages written');
    expect(t).toContain('Needs your edits');
    expect(t).not.toMatch(/run it again/i);
  });
  it('liveLine and contentGroups', () => {
    expect(liveLine(0, 1)).toBe('Your written page is not live yet');
    expect(liveLine(1, 3)).toBe('1 of 3 written pages is live');
    expect(liveLine(0, 2)).toBe('0 of 2 written pages are live');
    const g = contentGroups([{ status: 'not_ready', publishedUrl: '' }, { status: 'written', publishedUrl: '' }, { status: 'written', publishedUrl: 'https://techand.ai/a' }]);
    expect([g.live.length, g.waiting.length, g.fixing.length]).toEqual([1, 1, 1]);
  });
});

describe('B4: the autopilot level cards forecast what the Credits page forecasts', () => {
  it('a website with a keyword ladder includes its rank check, from the Pipeline\'s own ladder cards', () => {
    const d = { ladderCards: [{ id: 'lad_ai', mode: 'auto', status: 'planning', counts: { total: 4, published: 0, waiting: 1, writing: 0, planned: 3 } }], autopilot: { level: 2, notChosen: [] }, automation: { autopilotLevel: 2 } } as unknown as PipelineData;
    expect(forecastPlanOf(d, site)).toEqual({ level: 2, writing: true, ranking: true });
    const m = monitorSettingsSchema.parse({ brandNames: [], aiPersonas: [], aiMarkets: [] });
    const t = text(render(<LevelChoices value={2} onChange={() => undefined} monitors={m} pagesPerWeek={1} writing ranking />));
    expect(t).toContain(`About ${creditsLabel(autopilotMonthlyUsd(m, 1, { level: 2, writing: true, ranking: true }))} a month`);
  });
});

describe('B5: the key-page watch line is a whole sentence and never says "unknown"', () => {
  it('not checked yet, running and stopped', () => {
    expect(watchLine({ running: false, lastCheckedAt: '', pagesWatched: 7 })).toBe('7 key pages ready to watch. The first check runs within a day, every morning after that.');
    expect(watchLine({ running: false, lastCheckedAt: '2026-10-18T09:45:00.000Z', pagesWatched: 7 })).toMatch(/^Last check .*\. The watch has not run since then, so .*\.$/);
    expect(watchLine({ running: false, lastCheckedAt: '', pagesWatched: 7 })).not.toMatch(/unknown/);
  });
});

describe('B6 / D11: the Rankings ladder reads like the ladder page', () => {
  const rung = (o: Partial<Ladder['rungs'][number]>) => ({ rung: 1, pageNo: 1, keyword: '', supporting: [], pageType: 'Service Page', targetUrl: '', pageExists: false, status: 'planned', months: '2-4', latestPosition: null, previousPosition: null, bestPosition: null, lastChecked: null, history: [], ...o });
  const ladder: Ladder = {
    ladderId: 'lad_ai', headKeyword: 'ai consultant', country: 'United Arab Emirates', startDate: '2026-10-21', pages: 4, published: 0,
    rungs: [
      rung({ rung: 1, pageNo: 4, keyword: 'ai consulting' }),
      rung({ rung: 2, pageNo: 2, keyword: 'ai consultant dubai' }),
      rung({ rung: 2, pageNo: 3, keyword: 'ai consulting firm' }),
      rung({ rung: 4, pageNo: 1, keyword: 'ai consultant', status: 'not_ready', targetUrl: 'https://techand.ai/ai-consultant/' }),
    ],
  };
  it('no raw status, the main page named, and a draft to edit instead of "Write page"', () => {
    const t = text(render(<LadderCard ladder={ladder} readiness={{ ready: true, missingText: '', page: 'settings/profile' }} onHistory={() => undefined} />));
    expect(t).not.toContain('not_ready');
    expect(t).toContain('Main page');
    expect(t).not.toMatch(/Rung 4/);
    expect(t).toContain('Needs your edits');
    expect(t).toContain('See what to edit');
    expect(t).toContain('4 pages: the main page and 2 rungs');
    // the three planned pages can still be written
    expect(t.match(/Write page/g)?.length).toBe(3);
  });
  it('pages held for the author profile say so and offer the profile, not "Write page"', () => {
    const t = text(render(<LadderCard ladder={ladder} readiness={{ ready: false, missingText: 'your business facts', page: 'settings/business' }} onHistory={() => undefined} />));
    expect(t).toContain('Waits for your profile');
    expect(t).toContain('Finish your profile');
    expect(t).not.toContain('Write page');
  });
  it('rungView and ladderShape', () => {
    expect(rungView('not_ready')).toMatchObject({ state: 'fix', action: 'edit' });
    expect(rungView('weird_code')).toMatchObject({ label: 'Planned' });
    expect(rungView('planned', false)).toMatchObject({ state: 'held', action: 'profile' });
    expect(ladderShape(1, [4])).toBe('1 page: the main page');
  });
});

describe('B7: the run page shows a ladder page\'s input in words (no unbroken JSON)', () => {
  it('ladder and source', () => {
    const rows = inputRows({ keyword: 'ai consultant', ladder: { id: 'lad_mvi70y0gcgla', head: 'ai consultant', rung: 4, pageNo: 1 }, source: 'ladder' });
    const html = renderToString(<>{rows.map((r) => <p key={r.label}>{r.label}: {r.value}</p>)}</>);
    expect(text(html)).toMatch(/Keyword ladder\s*:\s*"ai consultant", main page/);
    expect(text(html)).toMatch(/Started from\s*:\s*a page of your keyword/);
    expect(html).not.toContain('lad_mvi70y0gcgla');
  });
});

describe('D6: Write it now says what it does to the next weekly run', () => {
  it('one page a week: the next run writes no other page', () => {
    expect(weeklyTradeOff(1)).toMatch(/uses your next weekly run's page .*writes no other page/);
    expect(weeklyTradeOff(3)).toBe("This uses one of your next weekly run's 3 pages a week: that run writes 2 instead of 3.");
    expect(weeklyTradeOff(0)).toMatch(/one page on top/);
  });
});

describe('Low: the Pipeline\'s times are the website\'s, in one clock', () => {
  it('a 02:00 UTC run reads 06:00 in Asia/Dubai, whatever the browser zone', () => {
    expect(fmtTime('2026-10-28T02:00:00.000Z', 'Asia/Dubai')).toMatch(/^06:00$/);
    expect(fmtWhen('2026-10-28T02:00:00.000Z', 'Asia/Dubai')).toMatch(/06:00/);
    expect(fmtWhen('2026-10-28T02:00:00.000Z', 'Asia/Dubai')).not.toMatch(/AM|PM/);
  });
});
