import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Me, Org, Site } from '@seo/shared';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import { MonitorSettingsFields, DEFAULT_MONITORS } from '@/components/site/MonitorSettingsFields';
import { qk } from '@/lib/queries';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import type { ReactNode } from 'react';

// D-1 (re-rating 2026-10-17): onboarding step 6 ("Tracking") crashed on every load with "useOrgCtx outside OrgLayout", because
// MonitorSettingsFields -> useEngineCal required the company layout's context and onboarding renders outside it. These tests render
// the step exactly where the customer meets it: under /onboarding/:orgId/:step, with no OrgLayout and no OrgContext.

const ORG = 'org-d1';
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [{ id: ORG, name: 'D1 Trading', role: 'owner' }], platformAdmin: false } as unknown as Me;
const org: Org = {
  id: ORG,
  name: 'D1 Trading',
  slug: 'd1-trading',
  industry: '',
  size: '1-10',
  website: 'd1.example.com',
  monthlyBudgetUsd: 25,
  disabled: false,
  onboardingStep: 'tracking',
  onboardedAt: null,
  createdAt: '2026-10-17T16:00:00.000Z',
  role: 'owner',
};
const site: Site = {
  id: 'site-d1',
  orgId: ORG,
  domain: 'd1.example.com',
  n8nSiteId: 'site_d1.example.com',
  country: 'United Arab Emirates',
  business: 'Wholesale office supplies to companies in the UAE',
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
  verifiedAt: null,
  verificationMethod: null,
  trackingStatus: 'not_started',
  trackingStartedAt: null,
  createdAt: '2026-10-17T16:01:00.000Z',
};

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.me, me);
  qc.setQueryData(qk.org(ORG), org);
  qc.setQueryData(qk.sites(ORG), [site]);
  return qc;
}

/** the providers main.tsx puts above every page */
const App = ({ qc, children }: { qc: QueryClient; children: ReactNode }) => (
  <ThemeProvider>
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <GuideProvider>{children}</GuideProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

function renderOnboarding(step: string, qc = client()) {
  const html = renderToString(
    <App qc={qc}>
      <MemoryRouter initialEntries={[`/onboarding/${ORG}/${step}?site=${site.id}`]}>
        <Routes>
          <Route path="/onboarding/:orgId/:step?" element={<OnboardingPage />} />
        </Routes>
      </MemoryRouter>
    </App>,
  );
  return { html, qc };
}

describe('onboarding outside the company layout (D-1)', () => {
  it('step 6 "Tracking" renders its form and the monitors, not the error page', () => {
    const { html } = renderOnboarding('tracking');
    expect(html).toContain('Choose what to track');
    expect(html).toContain('AI visibility');
    expect(html).not.toContain('useOrgCtx');
    expect(html).not.toContain('Something went wrong');
  });

  it('the tracking fieldset can shrink below its content, so the keyword chips cannot widen the page at 390 px', () => {
    const { html } = renderOnboarding('tracking');
    const tags = html.match(/<fieldset[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    // a fieldset's default min-width is min-content: without min-w-0 a long chip row pushes the whole step 3 px past the viewport
    expect(tags.find((t) => /class="[^"]*space-y-5/.test(t))).toMatch(/class="[^"]*\bmin-w-0\b/);
  });

  it("reads the engine's prices for the company in the onboarding address", () => {
    const { qc } = renderOnboarding('tracking');
    expect(qc.getQueryCache().find({ queryKey: ['engine-costs', ORG] })).toBeTruthy();
  });

  it('every other onboarding step renders outside the layout too', () => {
    for (const step of ['website', 'verify', 'business', 'profile', 'launch']) {
      const { html } = renderOnboarding(step);
      expect(html, step).not.toContain('useOrgCtx');
      expect(html.length, step).toBeGreaterThan(500);
    }
  });

  it('the monitor fields render with no router and no company at all (the shipped prices stay in use)', () => {
    const qc = new QueryClient();
    const html = renderToString(
      <App qc={qc}>
        <MonitorSettingsFields value={DEFAULT_MONITORS} onChange={() => undefined} />
      </App>,
    );
    expect(html).toContain('AI visibility');
    expect(qc.getQueryCache().getAll().filter((q) => q.queryKey[0] === 'engine-costs' && q.queryKey[1])).toHaveLength(0);
  });
});
