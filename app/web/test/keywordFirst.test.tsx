import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import {
  ONBOARDING_STEPS,
  keywordInput,
  ladderInput,
  trackInput,
  type ComingUpView,
  type KeywordProposalList,
  type KeywordProposalView,
  type Me,
  type Org,
  type RecommendedKeywords,
  type ReportDetail,
  type Site,
  type SiteCycleView,
} from '@seo/shared';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import { launchRequests } from '@/pages/onboarding/_components/launch-plan';
import { readKeywordDraft, STEPS, writeKeywordDraft, writeTrackingDraft } from '@/pages/onboarding/_components/wizard';
import { trackDefaults } from '@/components/site/TrackingForm';
import { ComingUp, ComingUpSummary } from '@/pages/site/_components/pipeline/coming-up';
import { KeywordProposals, countdown } from '@/pages/site/_components/pipeline/proposals';
import { YourWeek } from '@/pages/site/_components/pipeline/your-week';
import { writeNowRequest } from '@/pages/site/_components/pipeline/WriteNowDialog';
import { AutopilotLevelPicker } from '@/components/site/AutopilotLevel';
import { isWrittenPage, NotWhatIWanted } from '@/components/reports/ContentFeedback';
import { chanceWords, planWords, searchesWords } from '@/components/site/KeywordChoiceCard';
import { everyCycleDay, onCycleDay, siteWeekdayName } from '@/lib/cycle-day';
import { qk, useComingUpDecision, useContentFeedback, useProposalAction, useUpdateAutomation } from '@/lib/queries';
import { ApiRequestError } from '@/lib/api';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// Keyword-first in the web app (SCHEDULING_KEYWORDS_PLAN.md §5): onboarding's "Your first keyword", the launch requests, the Pipeline's
// Coming up and keyword proposals, the website's week, the autopilot level and "Not what I wanted". Rendered to HTML in Node with the
// contexts the pages really get; the requests the buttons send are checked through the hooks with a stubbed fetch.

const ORG = 'org-kf';
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [{ id: ORG, name: 'KF Trading', role: 'owner' }], platformAdmin: false } as unknown as Me;
const org: Org = {
  id: ORG,
  name: 'KF Trading',
  slug: 'kf-trading',
  industry: '',
  size: '1-10',
  website: 'kf.example.com',
  monthlyBudgetUsd: 25,
  disabled: false,
  onboardingStep: 'profile',
  onboardedAt: null,
  createdAt: '2026-10-19T16:00:00.000Z',
  role: 'owner',
};
const site: Site = {
  id: '7d3f1c2a-5b6e-4c1d-9a8b-0c1d2e3f4a5b',
  orgId: ORG,
  domain: 'kf.example.com',
  n8nSiteId: 'site_kf.example.com',
  country: 'United Arab Emirates',
  business: 'Payroll software for small companies in the UAE',
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
  blogsPerWeek: 0,
  verifiedAt: '2026-10-19T16:05:00.000Z',
  verificationMethod: 'dns',
  trackingStatus: 'not_started',
  trackingStartedAt: null,
  createdAt: '2026-10-19T16:01:00.000Z',
  timezone: '',
  services: ['payroll software', 'WPS payroll'],
  cycleWeekday: null,
  autopilotLevel: 2,
};
const tracked: Site = { ...site, trackingStatus: 'active', trackingStartedAt: '2026-10-22T10:00:00.000Z', timezone: 'Asia/Dubai', cycleWeekday: 3 };

// ---------- a localStorage for Node (the drafts) ----------
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const recommended = (o: Partial<RecommendedKeywords> = {}): RecommendedKeywords => ({
  reportId: 'rep-research',
  receivedAt: '2026-10-19T16:10:00.000Z',
  ageDays: 0,
  stale: false,
  reach: 12,
  country: 'United Arab Emirates',
  status: 'ready',
  startedAt: null,
  runId: null,
  freeResearch: false,
  keywords: [
    { keyword: 'payroll software uae', volume: 320, kd: 18, intent: 'commercial', pageType: 'Service Page', why: 'You offer payroll software; 3 competitors rank for it.', difficultyForYou: 'easy', planType: 'direct', months: '2-4', label: '', source: 'start_with', overlaps: [] },
    { keyword: 'wps payroll system', volume: 90, kd: 30, intent: 'commercial', pageType: 'Service Page', why: '', difficultyForYou: 'reachable', planType: 'short', months: '3-6', label: '', source: 'priority', overlaps: [] },
    { keyword: 'adp uae login', volume: 900, kd: 5, intent: 'navigational', pageType: 'Service Page', why: '', difficultyForYou: 'not_realistic', planType: 'none', months: '', label: '', source: 'priority', overlaps: [] },
  ],
  ...o,
});

function client(extra?: (qc: QueryClient) => void, sites: Site[] = [site]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.me, me);
  qc.setQueryData(qk.org(ORG), org);
  qc.setQueryData(qk.sites(ORG), sites);
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

function onboarding(step: string, qc = client()) {
  return renderToString(
    <App qc={qc}>
      <MemoryRouter initialEntries={[`/onboarding/${ORG}/${step}?site=${site.id}`]}>
        <Routes>
          <Route path="/onboarding/:orgId/:step?" element={<OnboardingPage />} />
        </Routes>
      </MemoryRouter>
    </App>,
  );
}

/** a page part inside the company and website layouts */
function inSite(node: ReactNode, opts: { qc?: QueryClient; s?: Site; role?: 'owner' | 'admin' | 'member' | 'viewer' } = {}) {
  const role = opts.role ?? 'owner';
  const s = opts.s ?? tracked;
  return renderToString(
    <App qc={opts.qc ?? client()}>
      <MemoryRouter>
        <OrgContext.Provider value={{ me, org: { ...org, role }, role, sites: [s], can: makeCan(role) }}>
          <SiteContext.Provider value={{ site: s }}>{node}</SiteContext.Provider>
        </OrgContext.Provider>
      </MemoryRouter>
    </App>,
  );
}

/** a hook's return value, captured during one render (its mutate works after the render: the client holds the mutation) */
function hook<T>(use: () => T, qc = client()): T {
  let out: T | undefined;
  const Probe = () => {
    out = use();
    return null;
  };
  renderToString(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
  return out!;
}

/** fetch answers `body` with `status`; the requests are recorded */
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

// ======================================================================================================================================
describe('onboarding: the new step "Your first keyword"', () => {
  it('sits between the profile and tracking, and the server stores every step of the wizard (so it resumes at "keyword")', () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids.indexOf('keyword')).toBe(ids.indexOf('profile') + 1);
    expect(ids.indexOf('tracking')).toBe(ids.indexOf('keyword') + 1);
    expect([...ids, 'done']).toEqual([...ONBOARDING_STEPS]);
  });

  it('the business step asks what the website sells', () => {
    const t = text(onboarding('business'));
    expect(t).toContain('What do you sell?');
    expect(t).toContain('payroll software');
  });

  it('asks in plain words, shows the suggestions with chances, searches and the plan, and never a keyword that is not realistic', () => {
    const t = text(onboarding('keyword', client((qc) => qc.setQueryData(qk.siteData(site.id, 'keywords-recommended'), recommended()))));
    expect(t).toContain('What would a customer type into Google to find a business like yours?');
    expect(t).toContain('Suggest keywords for me');
    expect(t).toContain('payroll software uae');
    expect(t).toContain('Your chances: Good chance');
    expect(t).toContain('Your chances: Takes a few months');
    expect(t).toContain('About 320 people search this a month');
    expect(t).toContain('About 3-4 pages over 2-4 months');
    expect(t).toMatch(/About \d+ credits a page/);
    expect(t).toContain('Why we suggest it: You offer payroll software');
    expect(t).not.toContain('adp uae login');
    expect(t).toContain("I'll choose later");
    // the three levels, each with its forecast; level 2 is the default
    expect(t).toContain('How much should we do on our own?');
    expect(t).toContain('1. Only my keywords');
    expect(t).toContain('2. My keywords and keep my pages healthy');
    expect(t).toContain('3. Full autopilot');
    expect((t.match(/a month with your tracking choices/g) ?? []).length).toBe(3);
  });

  it('while the research runs it says so with a progress line', () => {
    const t = text(onboarding('keyword', client((qc) => qc.setQueryData(qk.siteData(site.id, 'keywords-recommended'), recommended({ status: 'running', reportId: null, keywords: [] })))));
    expect(t).toContain(`We are finding keywords for ${site.domain}`);
    expect(t).toContain('about 2 minutes');
  });

  it('a chosen keyword: how its pages are written, named by the weekday; at level 3 the keyword is optional', () => {
    writeKeywordDraft(site.id, {
      picks: [{ keyword: 'payroll software uae', chosenBy: 'client_picked', mode: 'auto', volume: 320, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: '' }],
      later: false,
      level: 2,
    });
    const t = text(onboarding('keyword', client((qc) => qc.setQueryData(qk.siteData(site.id, 'keywords-recommended'), recommended()))));
    expect(t).toContain('Write a page each week');
    expect(t).toContain('Ask me before each page');
    expect(t).toMatch(/A new page is written every (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/);
    expect(t).toContain('Chosen. Click again to remove it');

    writeKeywordDraft(site.id, { picks: [], later: false, level: 3 });
    expect(text(onboarding('keyword'))).toContain("We'll choose one from the research and tell you first");
  });

  it('the draft keeps at most two keywords, a known level and who chose each', () => {
    writeKeywordDraft(site.id, {
      picks: [
        { keyword: 'a b', chosenBy: 'client_typed', mode: 'manual', volume: null, difficultyForYou: null, planType: null, months: '', why: '' },
        { keyword: 'c d', chosenBy: 'client_picked', mode: 'auto', volume: null, difficultyForYou: null, planType: null, months: '', why: '' },
        { keyword: 'e f', chosenBy: 'client_picked', mode: 'auto', volume: null, difficultyForYou: null, planType: null, months: '', why: '' },
      ],
      later: false,
      level: 7 as never,
    });
    const d = readKeywordDraft(site.id)!;
    expect(d.picks.map((p) => p.keyword)).toEqual(['a b', 'c d']);
    expect(d.picks[0]).toMatchObject({ chosenBy: 'client_typed', mode: 'manual' });
    expect(d.level).toBe(2);
  });

  it('tracking: the chosen keyword is watched, the list is relabelled, pages a week are for the keyword', () => {
    writeKeywordDraft(site.id, { picks: [{ keyword: 'Payroll Software UAE', chosenBy: 'client_picked', mode: 'auto', volume: 1, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: '' }], later: false, level: 2 });
    // an unverified website renders the form at once (a verified one waits for its saved settings)
    const t = text(onboarding('tracking', client(undefined, [{ ...site, verifiedAt: null }])));
    expect(t).toContain("Other keywords to watch (we check your position, we don't write for them)");
    expect(t).toContain('Pages a week for your keyword');
    expect(t).toContain('payroll software uae');
    expect(t).not.toContain('Blog posts per week');
  });

  it('launch: the summary names today and the weekday, with the first page; no separate audit or AI run is offered', () => {
    writeKeywordDraft(site.id, { picks: [{ keyword: 'payroll software uae', chosenBy: 'client_picked', mode: 'auto', volume: 320, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: '' }], later: false, level: 2 });
    writeTrackingDraft(site.id, { ...trackDefaults(site), blogsPerWeek: 1 });
    const t = text(onboarding('launch'));
    expect(t).toContain('Today: your first checks');
    expect(t).toContain('the first page for "payroll software uae"');
    expect(t).toMatch(/Then every (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*:\s*the weekly checks\s*, and a page for your keyword\s*, about [\d,.]+ credits a month/);
    expect(t).toContain("The first page counts as this week's page");
    expect(t).toMatch(/Level 2\s*: My keywords and keep my pages healthy/);
    expect(t).not.toContain('Run a technical audit now');
    expect(t).not.toContain('AI visibility baseline now');
  });

  it('launch requests: Track with the zone and services, the level, one ladder per keyword with who chose it; nothing else', () => {
    const plan = { ...trackDefaults(site), country: 'United Arab Emirates', blogsPerWeek: 1 } as ReturnType<typeof trackDefaults>;
    const r = launchRequests({
      site,
      plan,
      level: 1,
      timezone: 'Asia/Dubai',
      picks: [
        { keyword: 'payroll software uae', chosenBy: 'client_picked', mode: 'auto', volume: 320, difficultyForYou: 'easy', planType: 'direct', months: '2-4', why: '' },
        { keyword: 'wps payroll for clinics', chosenBy: 'client_typed', mode: 'manual', volume: 20, difficultyForYou: 'reachable', planType: 'short', months: '3-6', why: '' },
      ],
    });
    expect(r.track).toMatchObject({ mode: 'track', siteId: site.id, timezone: 'Asia/Dubai', services: ['payroll software', 'WPS payroll'], blogsPerWeek: 1 });
    expect(trackInput.safeParse(r.track).error?.issues ?? []).toEqual([]);
    expect(r.automation).toEqual({ autopilotLevel: 1 });
    expect(r.ladders).toHaveLength(2);
    expect(r.ladders[0]).toMatchObject({ mode: 'ladder', keyword: 'payroll software uae', chosenBy: 'client_picked', ladderMode: 'auto', pagesNow: 1 });
    expect(r.ladders[1]).toMatchObject({ chosenBy: 'client_typed', ladderMode: 'manual', pagesNow: 1 });
    for (const l of r.ladders) expect(ladderInput.safeParse(l).success).toBe(true);
    // the first cycle does the audit and the AI visibility check: no separate run
    const modes = [r.track, ...r.ladders].map((b) => b.mode);
    expect(modes).not.toContain('audit');
    expect(modes).not.toContain('ai_visibility');
    // "I'll choose later": Track and the level only
    expect(launchRequests({ site, plan, level: 2, timezone: '', picks: [] }).ladders).toEqual([]);
  });
});

// ======================================================================================================================================
const preview = (o: Partial<ComingUpView> = {}): ComingUpView => ({
  available: true,
  cycleKey: 'cyc:site_kf.example.com:2026-10-29',
  cycleDate: '2026-10-29',
  scheduledFor: '2026-10-29T02:00:00.000Z',
  receivedAt: '2026-10-27T02:00:00.000Z',
  level: 2,
  pagesPerWeek: 1,
  waitingForKeyword: false,
  pausedReason: '',
  reason: '',
  items: [
    { itemKey: 'payroll software uae', keyword: 'payroll software uae', source: 'ladder', pageType: 'Service Page', existingPageUrl: '', ladderId: 'lad_1', rung: 1, why: 'The next page of your keyword', auto: true, credits: 60, aiTarget: null, decision: null, canSkip: true, canApprove: false },
  ],
  suggestions: [
    { itemKey: 'payroll for clinics', keyword: 'payroll for clinics', source: 'trend', pageType: 'Blog Post', existingPageUrl: '', ladderId: '', rung: 0, why: 'Searches rose 40% this month', auto: false, credits: 55, aiTarget: null, decision: null, canSkip: true, canApprove: true },
  ],
  refused: [{ keyword: 'adp login', source: 'striking', reason: 'other_brand', detail: 'A search for another company' }],
  autoCredits: 60,
  canDecide: true,
  closed: false,
  ...o,
});

describe('Coming up', () => {
  it('names the day, splits what is written on its own from what waits, with credits and the right buttons', () => {
    const qc = client((q) => q.setQueryData(qk.siteData(tracked.id, 'coming-up'), preview()));
    const html = inSite(<ComingUp />, { qc });
    const t = text(html);
    expect(t).toMatch(/Coming up on Thursday,? (29 October|October 29)/);
    expect(t).toContain('Written on its own');
    expect(t).toContain('Waits for your OK');
    expect(t).toContain('about 60 credits');
    expect(t).toContain('Searches rose 40% this month');
    expect((t.match(/Approve/g) ?? []).length).toBe(1);
    expect((t.match(/Skip/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(t).toContain('1 topic we left out');
    expect(t).not.toContain('Monday');
  });

  it('closed once the run started; waiting for the first keyword says what to do; no plan yet says when it comes', () => {
    const closed = text(inSite(<ComingUp />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'coming-up'), preview({ closed: true }))) }));
    expect(closed).toContain('This weekly run has started');
    expect(closed).not.toContain('Approve');
    const waiting = text(inSite(<ComingUp />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'coming-up'), preview({ waitingForKeyword: true, items: [] }))) }));
    expect(waiting).toContain('Nothing is written until you choose your keyword');
    const none = text(inSite(<ComingUp />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'coming-up'), preview({ available: false, items: [], suggestions: [] }))) }));
    expect(none).toContain('Nothing is written that you could not see here first');
  });

  it('a viewer sees the plan without buttons; the Overview gets one line', () => {
    const qc = client((q) => q.setQueryData(qk.siteData(tracked.id, 'coming-up'), preview()));
    expect(text(inSite(<ComingUp />, { qc, role: 'viewer' }))).not.toContain('Approve');
    const line = text(inSite(<ComingUpSummary />, { qc }));
    expect(line).toMatch(/Coming up on Thursday,? (29 October|October 29)/);
    expect(line).toContain('1 page is written on its own, 1 waits for your OK');
  });

  it('a decision posts the item, the choice and the scope; a cycle that started answers 409', async () => {
    const calls = stubFetch(200, { item: { ...preview().suggestions[0], decision: { decision: 'skip', scope: 'always', by: 'owner@example.org', at: '' } }, key: 'k' });
    const m = hook(() => useComingUpDecision(ORG, tracked.id));
    await m.mutateAsync({ itemKey: 'payroll for clinics', decision: 'skip', scope: 'always' });
    expect(calls[0]).toEqual({ url: `/api/orgs/${ORG}/sites/${tracked.id}/coming-up/decisions`, method: 'POST', body: { itemKey: 'payroll for clinics', decision: 'skip', scope: 'always' } });
    stubFetch(409, { error: 'This cycle has already started', code: 'cycle_started' });
    const m2 = hook(() => useComingUpDecision(ORG, tracked.id));
    await expect(m2.mutateAsync({ itemKey: 'x', decision: 'approve', scope: 'cycle' })).rejects.toMatchObject({ status: 409, code: 'cycle_started' });
  });
});

// ======================================================================================================================================
const proposal = (o: Partial<KeywordProposalView> = {}): KeywordProposalView => ({
  id: '0b6e6a3e-2b1c-4b5e-9f00-000000000001',
  siteId: tracked.id,
  keyword: 'payroll for restaurants',
  status: 'pending',
  startAt: '2026-10-31T06:00:00.000Z',
  level: 3,
  why: 'You offer payroll software; restaurants search for it.',
  occasion: 'won',
  searches: 140,
  difficulty: 'reachable',
  chance: 'Takes a few months',
  planType: 'short',
  months: '3-6',
  creditsPerPage: 58,
  runId: null,
  swappedFor: null,
  note: '',
  createdAt: '2026-10-29T06:00:00.000Z',
  decidedAt: null,
  decidedBy: null,
  ...o,
});
const list = (p: KeywordProposalView[]): KeywordProposalList => ({ pending: p, recent: [], level: p[0]?.level ?? 2, enabled: true });

describe('keyword proposals', () => {
  it('level 3: the announcement with its start and countdown, Approve now / Pick a different one / Skip', () => {
    const t = text(inSite(<KeywordProposals />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'keyword-proposals'), list([proposal()]))) }));
    expect(t).toContain('Your next keyword starts soon');
    expect(t).toContain('unless you change it');
    expect(t).toContain('Approve now');
    expect(t).toContain('Pick a different one');
    expect(t).toContain('Skip');
    expect(t).toContain('About 58 credits a page');
    expect(t).toContain('Your chances: Takes a few months');
  });

  it('levels 1-2: a suggestion that waits, Start this ladder / Show me others / Not now; none pending shows nothing', () => {
    const t = text(inSite(<KeywordProposals />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'keyword-proposals'), list([proposal({ startAt: null, level: 1 })]))) }));
    expect(t).toContain('A keyword we suggest');
    expect(t).toContain('Start this ladder');
    expect(t).toContain('Show me others');
    expect(t).toContain('Not now');
    expect(t).not.toContain('unless you change it');
    expect(inSite(<KeywordProposals />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'keyword-proposals'), list([]))) })).toBe('');
  });

  it('countdown words', () => {
    const now = Date.parse('2026-10-29T06:00:00.000Z');
    expect(countdown('2026-10-31T06:00:00.000Z', now)).toBe('in 2 days');
    expect(countdown('2026-10-29T11:00:00.000Z', now)).toBe('in 5 hours');
    expect(countdown('2026-10-29T06:01:00.000Z', now)).toBe('any minute now');
  });

  it('swap sends the typed keyword; an unsuitable one comes back with the check and its alternatives', async () => {
    const calls = stubFetch(200, { proposal: proposal({ status: 'swapped' }), runId: 'run-1' });
    const m = hook(() => useProposalAction(ORG, tracked.id));
    await m.mutateAsync({ id: proposal().id, action: 'swap', keyword: 'payroll for cafes' });
    expect(calls[0]).toMatchObject({ url: `/api/orgs/${ORG}/sites/${tracked.id}/keyword-proposals/${proposal().id}/swap`, method: 'POST', body: { keyword: 'payroll for cafes' } });
    stubFetch(409, { error: 'This keyword looks outside your business', code: 'keyword_not_suitable', check: { result: { alternatives: ['payroll for cafes uae'] } } });
    const m2 = hook(() => useProposalAction(ORG, tracked.id));
    const e = await m2.mutateAsync({ id: proposal().id, action: 'swap', keyword: 'cafe menu ideas' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiRequestError);
    expect((e as ApiRequestError).code).toBe('keyword_not_suitable');
    expect(((e as ApiRequestError).data.check as { result: { alternatives: string[] } }).result.alternatives).toEqual(['payroll for cafes uae']);
    const calls2 = stubFetch(200, { proposal: proposal({ status: 'approved' }), runId: 'run-2' });
    await hook(() => useProposalAction(ORG, tracked.id)).mutateAsync({ id: proposal().id, action: 'approve' });
    expect(calls2[0]).toMatchObject({ url: `/api/orgs/${ORG}/sites/${tracked.id}/keyword-proposals/${proposal().id}/approve`, body: {} });
  });
});

// ======================================================================================================================================
const cycle = (o: Partial<SiteCycleView> = {}): SiteCycleView => ({
  known: true,
  status: 'active',
  timezone: 'Asia/Dubai',
  weekday: 3,
  weekdayName: 'Wednesday',
  localTime: '06:00',
  anchorAt: '2026-10-22T06:00:00.000Z',
  monthlyDay: 22,
  nextDueAt: '2026-10-29T02:00:00.000Z',
  nextPreviewAt: '2026-10-27T02:00:00.000Z',
  lastCycleAt: '2026-10-22T06:00:00.000Z',
  current: {
    cycleKey: 'cyc:site_kf.example.com:2026-10-22',
    date: '2026-10-22',
    monthly: true,
    cycle0: true,
    status: 'running',
    jobs: [
      { job: 'ai_visibility', label: 'AI visibility', status: 'done', attempts: 1, monthly: true, reason: '', dueAt: null, startedAt: null, finishedAt: null },
      { job: 'rank_tracker', label: 'Rank tracker', status: 'skipped', attempts: 0, monthly: false, reason: 'No keyword ladder yet', dueAt: null, startedAt: null, finishedAt: null },
      { job: 'link_builder', label: 'Link builder', status: 'gave_up', attempts: 3, monthly: false, reason: 'the engine did not answer', dueAt: null, startedAt: null, finishedAt: null },
    ],
  },
  recent: [],
  upcoming: [],
  overdue: false,
  canChangeWeekday: true,
  ...o,
});

describe('your week', () => {
  it('names the weekday, the next run, the jobs with skipped reasons and what did not run; admins may move it', () => {
    const qc = client((q) => q.setQueryData(qk.siteData(tracked.id, 'cycle'), cycle()));
    const t = text(inSite(<YourWeek cycle={cycle()} />, { qc }));
    expect(t).toContain('Your week starts on Wednesday');
    expect(t).toContain('Your first run');
    expect(t).toContain('No keyword ladder yet');
    expect(t).toContain('Did not run');
    expect(t).toContain('Move your week to');
    const viewer = text(inSite(<YourWeek cycle={cycle({ canChangeWeekday: false })} />, { qc: client((q) => q.setQueryData(qk.siteData(tracked.id, 'cycle'), cycle({ canChangeWeekday: false }))), role: 'viewer' }));
    expect(viewer).not.toContain('Move your week to');
  });

  it('the weekday words of a website', () => {
    expect(siteWeekdayName(tracked)).toBe('Wednesday');
    expect(everyCycleDay(tracked)).toBe('every Wednesday');
    expect(onCycleDay(tracked)).toBe('on Wednesday');
    // no weekday chosen: the weekday tracking started on, in the website's zone (22 Oct 2026 23:30 UTC is Friday in Dubai)
    expect(siteWeekdayName({ ...tracked, cycleWeekday: null, trackingStartedAt: '2026-10-22T23:30:00.000Z' })).toBe('Friday');
    expect(everyCycleDay(site)).toBe('each week');
    expect(onCycleDay(null)).toBe('in the next weekly run');
  });
});

// ======================================================================================================================================
describe('the autopilot level', () => {
  it('three levels with their monthly forecast; the auto-pause notice offers the way back', () => {
    const t = text(inSite(<AutopilotLevelPicker orgId={ORG} siteId={tracked.id} level={1} dropped={{ at: '2026-10-25T10:00:00.000Z', from: 2 }} monitors={null} pagesPerWeek={1} writing admin />));
    expect(t).toContain('We now write only for your keywords');
    expect(t).toContain('so on');
    expect(t).toContain('Back to level 2');
    expect((t.match(/a month with your current settings/g) ?? []).length).toBe(3);
    expect(t).toContain('Save level');
    const viewer = text(inSite(<AutopilotLevelPicker orgId={ORG} siteId={tracked.id} level={2} dropped={null} monitors={null} pagesPerWeek={1} writing admin={false} />, { role: 'viewer' }));
    expect(viewer).not.toContain('Save level');
  });

  it('saving sends the level to the automation settings', async () => {
    const calls = stubFetch(200, { autopilotLevel: 3, defaultMode: 'auto', opportunities: 'manual', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 });
    await hook(() => useUpdateAutomation(ORG, tracked.id)).mutateAsync({ autopilotLevel: 3 });
    expect(calls[0]).toEqual({ url: `/api/orgs/${ORG}/sites/${tracked.id}/automation`, method: 'PATCH', body: { autopilotLevel: 3 } });
  });
});

// ======================================================================================================================================
describe('"Not what I wanted"', () => {
  const page = { id: 'rep-page', siteId: tracked.id, stage: 'content', payload: { keyword: 'payroll for clinics' } } as unknown as ReportDetail;
  it('shows on a written page for members, never on other reports or for viewers', () => {
    expect(isWrittenPage(page)).toBe(true);
    expect(isWrittenPage({ ...page, stage: 'site_tracker' })).toBe(false);
    expect(text(inSite(<NotWhatIWanted report={page} />))).toContain('Not what I wanted');
    expect(inSite(<NotWhatIWanted report={{ ...page, stage: 'keyword_strategy' }} />)).toBe('');
    expect(inSite(<NotWhatIWanted report={page} />, { role: 'viewer' })).toBe('');
  });
  it('sends the rejection with the reason', async () => {
    const calls = stubFetch(200, { id: 'fb1', verdict: 'reject', levelDropped: true, level: 1 });
    const r = await hook(() => useContentFeedback(ORG, 'rep-page', tracked.id)).mutateAsync({ reason: 'Not our topic' });
    expect(calls[0]).toEqual({ url: `/api/orgs/${ORG}/reports/rep-page/feedback`, method: 'POST', body: { verdict: 'reject', reason: 'Not our topic' } });
    expect(r.levelDropped).toBe(true);
  });
});

describe('plain words for a keyword', () => {
  it('chances, searches and the plan', () => {
    expect(chanceWords('easy')).toBe('Good chance');
    expect(chanceWords('reachable')).toBe('Takes a few months');
    expect(chanceWords('hard')).toBe('Hard for your website now');
    expect(chanceWords('not_realistic')).toBeNull();
    expect(searchesWords(1)).toBe('About 1 person searches this a month');
    expect(searchesWords(null)).toBe('Searches a month not known yet');
    expect(planWords('full', '6-12')).toBe('About 9-13 pages over 6-12 months');
    expect(planWords('none', '')).toBe('');
  });
});

// ======================================================================================================================================
describe('"Write it" on a suggestion (R-K5)', () => {
  it('sends where the suggestion came from and its AI target, in a body the server accepts', () => {
    const body = writeNowRequest(
      {
        keyword: 'who are the best payroll providers in dubai',
        why: 'AI answers name three rivals',
        pageType: 'Blog Post',
        ladder: null,
        source: 'ai_answer',
        aiTarget: { question: 'Who are the best payroll providers in Dubai?', kind: 'answer', targetId: 'ait_1', fanout: ['payroll dubai'], sources: [{ url: 'https://x.test/a', title: 'A' }], competitors: ['rival.test'] },
      },
      site,
    );
    expect(body).toMatchObject({ mode: 'keyword', source: 'ai_answer', aiTarget: { question: 'Who are the best payroll providers in Dubai?', kind: 'answer' } });
    const parsed = keywordInput.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.source).toBe('ai_answer');
    // a page with no source sends none (the server records the app's own page)
    expect('source' in writeNowRequest({ keyword: 'payroll uae', why: '', pageType: 'Service Page', ladder: null }, site)).toBe(false);
  });
});
