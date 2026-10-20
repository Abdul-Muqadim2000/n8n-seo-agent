import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { upcomingCycles, type Me, type Org, type PipelineData, type Site, type SiteCycleView } from '@seo/shared';
import { GUIDES, guideById } from '@seo/shared/guides';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { firstPageOf, firstPageReady, nextSteps, nextStepsText } from '@/lib/next-steps';
import { autopilotGuideVars, levelWords, monthlyDateWords } from '@/lib/guide-vars';
import { WhatHappensNext } from '@/components/site/WhatHappensNext';
import { PipelineNextSteps } from '@/pages/site/_components/pipeline/next-steps';
import { YourWeek } from '@/pages/site/_components/pipeline/your-week';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import { writeKeywordDraft, writeTrackingDraft } from '@/pages/onboarding/_components/wizard';
import { trackDefaults } from '@/components/site/TrackingForm';
import { features } from '@/marketing/content/features';
import { qk } from '@/lib/queries';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { renderReport, report, text } from './renderReport';

// the article viewer reads the theme's tokens from the page, which Node does not have; the not-ready notice above it is what is tested
vi.mock('@/components/reports/article', async (orig) => ({ ...(await orig<typeof import('@/components/reports/article')>()), ArticleViewer: () => null }));

// Guides for the weekly autopilot (A3, 2026-10-20): the "What happens next" line built from the website's real cycle, and the guide each
// keyword-first screen offers. Rendered to HTML in Node with the contexts the pages really get.

const ORG = 'org-cg';
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [{ id: ORG, name: 'CG Trading', role: 'owner' }], platformAdmin: false } as unknown as Me;
const org: Org = { id: ORG, name: 'CG Trading', slug: 'cg', industry: '', size: '1-10', website: 'cg.example.com', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'launch', onboardedAt: null, createdAt: '2026-10-19T16:00:00.000Z', role: 'owner' };
const site: Site = {
  id: '2b3f1c2a-5b6e-4c1d-9a8b-0c1d2e3f4a5b',
  orgId: ORG,
  domain: 'cg.example.com',
  n8nSiteId: 'site_cg.example.com',
  country: 'United Arab Emirates',
  business: 'CRM implementation in the UAE',
  customers: '',
  goal: 'leads',
  tone: '',
  cta: '',
  businessFacts: '',
  competitors: [],
  brandNames: [],
  keywords: [],
  ga4PropertyId: '',
  gscProperty: '',
  blogsPerWeek: 1,
  verifiedAt: '2026-10-20T05:00:00.000Z',
  verificationMethod: 'dns',
  trackingStatus: 'active',
  trackingStartedAt: '2026-10-20T06:00:00.000Z',
  createdAt: '2026-10-20T04:00:00.000Z',
  timezone: 'Asia/Dubai',
  services: ['crm implementation'],
  cycleWeekday: null,
  autopilotLevel: 2,
};

// the website's week as the rehearsal had it: started Tuesday 20 October 10:00 in Dubai, monthly date the 20th
const intent = { anchorAt: '2026-10-20T06:00:00.000Z', tz: 'Asia/Dubai', monthlyDay: 20, lastCycleAt: '2026-10-20T06:00:00.000Z', lastMonthlyKey: '2026-10' };
const NOW = Date.parse('2026-10-21T08:00:00.000Z');
const cycleView = (o: Partial<SiteCycleView> = {}, now = NOW): SiteCycleView => {
  const upcoming = upcomingCycles(intent, now, 5);
  return {
    known: true,
    status: 'active',
    timezone: 'Asia/Dubai',
    weekday: 2,
    weekdayName: 'Tuesday',
    localTime: '06:00',
    anchorAt: intent.anchorAt,
    monthlyDay: 20,
    nextDueAt: upcoming[0]?.at ?? null,
    nextPreviewAt: upcoming[0]?.previewAt || null,
    lastCycleAt: intent.lastCycleAt,
    current: null,
    recent: [],
    upcoming,
    overdue: false,
    canChangeWeekday: true,
    ...o,
  };
};

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

function client(extra?: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.me, me);
  qc.setQueryData(qk.org(ORG), org);
  qc.setQueryData(qk.sites(ORG), [site]);
  extra?.(qc);
  return qc;
}
const App = ({ qc, children }: { qc: QueryClient; children: ReactNode }) => (
  <ThemeProvider>
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <GuideProvider>{children}</GuideProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);
const inSite = (node: ReactNode, qc = client(), s: Site = site) =>
  renderToString(
    <App qc={qc}>
      <MemoryRouter>
        <OrgContext.Provider value={{ me, org, role: 'owner', sites: [s], can: makeCan('owner') }}>
          <SiteContext.Provider value={{ site: s }}>{node}</SiteContext.Provider>
        </OrgContext.Provider>
      </MemoryRouter>
    </App>,
  );

// ======================================================================================================================================
describe('"What happens next": built from the website\'s cycle', () => {
  it('names the real dates in the website\'s zone: Coming up, the weekly run at 06:00 and the next monthly checks', () => {
    const steps = nextSteps({ cycle: cycleView(), now: NOW, firstPage: 'none' });
    expect(nextStepsText(steps)).toBe('Sun 25 Oct: Coming up: the plan of your next week · Tue 27 Oct 06:00: your weekly run · 24 Nov: monthly checks');
    expect(steps.map((s) => s.guide)).toEqual(['coming-up-plan', 'your-weekly-cycle', 'your-weekly-cycle']);
    for (const s of steps) expect(guideById(s.guide), s.key).toBeDefined();
  });

  it('leads with today while the first week runs, and says when the first page waits for the profile and the facts', () => {
    const running = cycleView({ current: { cycleKey: 'cyc:site_cg.example.com:2026-10-20', date: '2026-10-20', monthly: true, cycle0: true, status: 'running', jobs: [] } });
    const t = nextStepsText(nextSteps({ cycle: running, now: NOW, firstPage: 'waiting' }));
    expect(t).toMatch(/^Today: first checks and the plan for your keyword · Your first page: waiting for your author profile and business facts · Sun 25 Oct/);
    expect(nextStepsText(nextSteps({ cycle: running, now: NOW, firstPage: 'writing' }))).toMatch(/^Today: first checks and your first page · Sun 25 Oct/);
  });

  it('says Coming up is ready between the plan and the run', () => {
    const now = Date.parse('2026-10-26T10:00:00.000Z');
    const t = nextStepsText(nextSteps({ cycle: cycleView({}, now), now, firstPage: 'none' }));
    expect(t).toMatch(/^Now: Coming up is ready: decide before Tue 27 Oct · Tue 27 Oct 06:00: your weekly run/);
  });

  it('marks the weekly run that is also the monthly one, instead of a separate monthly step', () => {
    const now = Date.parse('2026-11-19T10:00:00.000Z');
    const t = nextStepsText(nextSteps({ cycle: cycleView({}, now), now, firstPage: 'none' }));
    expect(t).toContain('Tue 24 Nov 06:00: your weekly run, with the monthly checks');
    expect(t).not.toContain(': monthly checks');
  });

  it('a paused website says so and nothing else', () => {
    expect(nextStepsText(nextSteps({ cycle: cycleView({ status: 'paused' }), now: NOW, firstPage: 'none' }))).toBe('Paused: nothing runs until you resume; the missed week then runs once');
  });

  it('with no cycle yet: the shape of the week without dates, or (onboarding) the week a website starting now gets', () => {
    const none = nextSteps({ cycle: null, now: NOW, firstPage: 'no_keyword' });
    expect(nextStepsText(none)).toBe('When tracking starts: your first week runs at once · Two days before each week: Coming up: the plan, to skip or approve · Every week: your weekly run, from 06:00 · Once a month: the bigger checks');
    const notStarted = nextSteps({ cycle: cycleView({ known: false, status: 'not_started', upcoming: [], nextDueAt: null, nextPreviewAt: null }), now: NOW, firstPage: 'none' });
    expect(notStarted[0].key).toBe('start');
    // onboarding on Wednesday 21 October at noon in Dubai: today, then Coming up on Monday 26, the run on Wednesday 28 at 06:00, and the
    // monthly checks in the first run on or after 21 November (Wednesday 25)
    const projected = nextStepsText(nextSteps({ cycle: null, now: NOW, firstPage: 'waiting', projectFrom: { tz: 'Asia/Dubai' } }));
    expect(projected).toBe('Today: first checks and the plan for your keyword · Your first page: waiting for your author profile and business facts · Mon 26 Oct: Coming up: the plan of your next week · Wed 28 Oct 06:00: your weekly run · 25 Nov: monthly checks');
  });

  it('asks for a keyword first when none is chosen', () => {
    const t = nextStepsText(nextSteps({ cycle: cycleView(), now: NOW, firstPage: 'no_keyword' }));
    expect(t).toMatch(/^Your keyword: choose one: nothing is written until you do · Sun 25 Oct/);
  });

  it('where the first page stands, from the keyword, the ladders and the profile', () => {
    const lad = (mode: 'auto' | 'manual', written = 0) => ({ mode, counts: { published: written, waiting: 0, writing: 0 } });
    expect(firstPageOf({ needsKeyword: true, ladders: [], ready: false })).toBe('no_keyword');
    expect(firstPageOf({ needsKeyword: false, ladders: [], ready: false })).toBe('none');
    expect(firstPageOf({ needsKeyword: false, ladders: [lad('auto')], ready: false })).toBe('waiting');
    expect(firstPageOf({ needsKeyword: false, ladders: [lad('auto')], ready: true })).toBe('writing');
    expect(firstPageOf({ needsKeyword: false, ladders: [lad('manual')], ready: true })).toBe('plan');
    expect(firstPageOf({ needsKeyword: false, ladders: [lad('auto', 1)], ready: false })).toBe('none');
    // the engine's rule (shared/src/readiness.ts): the author's name, job title and bio, and business facts of at least 30 characters
    const author = { name: 'Amira', jobTitle: 'Head of delivery', bio: 'Leads the delivery team.' };
    const facts = 'Founded 2012; 40 consultants; certified partner.';
    expect(firstPageReady({ author }, facts)).toBe(true);
    expect(firstPageReady({ author: { ...author, name: ' ' } }, facts)).toBe(false);
    expect(firstPageReady({ author: { ...author, bio: '' } }, facts)).toBe(false);
    expect(firstPageReady(null, facts)).toBe(false);
    expect(firstPageReady({ author }, '')).toBe(false);
    expect(firstPageReady({ author }, 'Founded 2012')).toBe(false);
  });

  it('renders as a list of buttons, each opening its guide, with the line for screen readers', () => {
    const html = inSite(<WhatHappensNext steps={nextSteps({ cycle: cycleView(), now: NOW, firstPage: 'none' })} />);
    const t = text(html);
    expect(t).toContain('What happens next');
    expect(t).toContain('Sun 25 Oct');
    expect(t).toContain('Tue 27 Oct 06:00');
    expect((html.match(/<button/g) ?? []).length).toBe(3);
    expect(html).toContain('aria-label="Sun 25 Oct: Coming up: the plan of your next week. How this works"');
    expect(html).not.toMatch(/[—…“”]/);
  });

  it('on the Pipeline: from the page\'s cycle, with the first page waiting while the profile is empty', () => {
    const qc = client((q) => q.setQueryData(qk.siteData(site.id, 'settings', ''), { profile: null, readiness: { score: 0, missing: [] } }));
    const data = {
      tracking: { status: 'active' },
      cycle: cycleView({ current: { cycleKey: 'cyc:x:2026-10-20', date: '2026-10-20', monthly: true, cycle0: true, status: 'running', jobs: [] } }),
      ladderCards: [{ id: 'lad_1', mode: 'auto', counts: { total: 5, published: 0, waiting: 0, writing: 0, planned: 5 } }],
      automation: { autopilotLevel: 2 },
    } as unknown as PipelineData;
    const t = text(inSite(<PipelineNextSteps data={data} needs={[]} now={NOW} />, qc));
    expect(t).toContain('Your first page: waiting for your author profile and business facts');
    expect(t).toContain('Today: first checks and the plan for your keyword');
  });

  it('on the Pipeline before tracking starts: the shape of the week', () => {
    const data = { tracking: { status: 'not_started' }, ladderCards: [], automation: { autopilotLevel: 2 } } as unknown as PipelineData;
    const t = text(inSite(<PipelineNextSteps data={data} needs={[]} now={NOW} />, client(), { ...site, trackingStatus: 'not_started', trackingStartedAt: null }));
    expect(t).toContain('When tracking starts: your first week runs at once');
  });
});

describe('the guides\' values for the website', () => {
  it('its weekday, zone, monthly date and level; credits from the price table', () => {
    const v = autopilotGuideVars(site, { cycle: cycleView() });
    expect(v).toMatchObject({ weekday: 'Tuesday', timezone: 'Asia/Dubai', monthlyDate: 'day 20 of the month', level: 'level 2 (My keywords and keep my pages healthy)', domain: 'cg.example.com' });
    for (const k of ['pageCredits', 'planCredits', 'checkCredits']) expect(v[k]).toMatch(/^about [\d,]+ credits?$/);
    expect(levelWords(3)).toBe('level 3 (Full autopilot)');
    expect(monthlyDateWords(31)).toBe('day 28 of the month');
  });
  it('before the cycle exists: the week the website would get if it started now', () => {
    const v = autopilotGuideVars({ ...site, trackingStartedAt: null, timezone: 'Asia/Dubai' }, { now: NOW });
    expect(v.weekday).toBe('Wednesday');
    expect(v.monthlyDate).toBe('day 21 of the month');
  });
});

describe('every keyword-first screen offers its guide', () => {
  it('Your week', () => {
    const t = text(inSite(<YourWeek cycle={cycleView()} />));
    expect(t).toContain('How your week works');
    expect(AUTOPILOT_SCREEN_GUIDES.yourWeek).toBe('your-weekly-cycle');
  });

  it('a written page that is not ready to publish', () => {
    const t = text(renderReport(report('content', { keyword: 'crm system', html: '<h1>CRM system</h1>', qa_not_ready: true, qa_label: 'did not pass the quality check', qa_reasons: ['2 bracket(s) left in the text for you to fill in'] })));
    expect(t).toContain('How to finish it');
  });

  it('onboarding: the keyword step (choosing and the level) and the launch summary with the strip', () => {
    const go = (step: string) =>
      text(
        renderToString(
          <App qc={client()}>
            <MemoryRouter initialEntries={[`/onboarding/${ORG}/${step}?site=${site.id}`]}>
              <Routes>
                <Route path="/onboarding/:orgId/:step?" element={<OnboardingPage />} />
              </Routes>
            </MemoryRouter>
          </App>,
        ),
      );
    const kw = go('keyword');
    expect(kw).toContain('How to choose');
    expect(kw).toContain('What each level does');
    writeKeywordDraft(site.id, { picks: [{ keyword: 'crm system', chosenBy: 'client_picked', mode: 'auto', volume: 320, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: '' }], later: false, level: 2 });
    writeTrackingDraft(site.id, { ...trackDefaults(site), blogsPerWeek: 1 });
    const launch = go('launch');
    expect(launch).toContain('What happens next');
    expect(launch).toContain('What happens when');
    // no business facts and no profile yet: the first page waits for them
    expect(launch).toContain('Your first page: waiting for your author profile and business facts');
  });

  it('the business site counts the guides there really are', () => {
    const guided = features.find((f) => f.slug === 'guided-setup')!;
    expect(guided.facts[0].value).toBe(GUIDES.length);
    expect(guided.benefits.join(' ')).toMatch(/weekly autopilot/);
  });
});
