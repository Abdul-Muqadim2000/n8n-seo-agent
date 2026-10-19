import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { DEFAULT_CREDIT_LIMITS, type BillingOverview, type Me, type Org, type Role, type Site } from '@seo/shared';
import { TooltipProvider } from '@/components/ui/overlay';
import { CreditsTab } from '@/pages/settings/_components/credits/CreditsTab';
import { CreditBanner, CreditPill } from '@/pages/settings/_components/credits/CreditsShell';
import { makeCan, OrgContext } from '@/lib/context';
import { qk } from '@/lib/queries';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// Company settings → Credits, the sidebar pill and the banner (app/docs/CREDITS.md §2), rendered with the contexts they really get.
// What must hold: every figure is in credits (dollars only on the packs), owners buy and set limits, viewers only read, and a client
// person of an agency sees none of it.

const ORG = 'org-credits';
const org = { id: ORG, name: 'Northwind', slug: 'northwind', kind: 'company', createdAt: '2026-10-01T00:00:00.000Z' } as unknown as Org;
const me = { user: { id: 'u1', email: 'o@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const site = { id: 'site-1', domain: 'northwind.example' } as unknown as Site;

const overview = (over: Partial<BillingOverview> = {}): BillingOverview => ({
  enforced: true,
  balance: 1240,
  held: 24,
  reservedForAutopilot: 600,
  available: 1216,
  onDemandAvailable: 616,
  status: 'low',
  dailyBurn: 230,
  runwayDays: 5.2,
  runsOutOn: '2026-10-24',
  month: { month: '2026-10', autopilotUsed: 812, onDemandUsed: 96, autopilotForecast: 1533, planMonthly: 2000, planRenewsOn: '2026-11-01' },
  limits: { ...DEFAULT_CREDIT_LIMITS, onDemandMonthly: 500 },
  sites: [
    { siteId: 'site-1', domain: 'northwind.example', forecastMonthly: 1533, usedThisMonth: 812, paused: false, pausedForCredits: false },
    { siteId: 'site-2', domain: 'shop.northwind.example', forecastMonthly: 400, usedThisMonth: 0, paused: true, pausedForCredits: true },
  ],
  byFeature: [
    { key: 'autopilot:AI visibility', label: 'AI visibility', origin: 'autopilot', credits: 500, runs: 3 },
    { key: 'on_demand:Written page', label: 'Written page', origin: 'on_demand', credits: 96, runs: 1 },
  ],
  daily: [
    { date: '2026-10-18', autopilot: 30, onDemand: 0 },
    { date: '2026-10-19', autopilot: 25, onDemand: 96 },
  ],
  lots: [
    { id: 'l1', source: 'pack', credits: 2000, remaining: 1240, expiresAt: '2027-10-05T00:00:00.000Z', createdAt: '2026-10-05T00:00:00.000Z', note: '' },
    { id: 'l2', source: 'refund', credits: 12, remaining: 0, expiresAt: null, createdAt: '2026-10-06T00:00:00.000Z', note: '' },
  ],
  expiringSoon: { credits: 150, on: '2026-10-31T23:59:59.000Z' },
  packs: [
    { id: 'starter', credits: 500, discountPct: 0, priceUsd: 25, perCreditUsd: 0.05 },
    { id: 'standard', credits: 2000, discountPct: 0, priceUsd: 100, perCreditUsd: 0.05 },
  ],
  requests: [{ id: 'r1', packId: 'standard', credits: 2000, priceUsd: 100, status: 'pending', note: 'PO-7', requestedBy: 'o@example.org', createdAt: '2026-10-19T08:00:00.000Z', resolvedAt: null }],
  creditValueUsd: 0.05,
  packExpiryMonths: 12,
  planRolloverMonths: 1,
  checkout: 'request',
  ...over,
});

function render(node: ReactNode, role: Role = 'owner', data: BillingOverview = overview(), path = `/o/${ORG}/sites/site-1/overview`) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData([...qk.org(ORG), 'billing'], data);
  return text(
    renderToString(
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[path]}>
              <OrgContext.Provider value={{ me, org: { ...org, role }, role, sites: [site], can: makeCan(role) }}>{node}</OrgContext.Provider>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  );
}

describe('Company settings → Credits', () => {
  it('shows the balance, runway, month, websites, lots and packs, in credits', () => {
    const t = render(<CreditsTab />);
    for (const s of ['Running low', 'Lasts about 5 days at your current use', 'runs out on 24 Oct 2026', 'Available now', 'Held by running analyses', 'Kept for autopilot', 'Your plan adds 2,000 credits a month', 'next credits on 1 Nov 2026', 'northwind.example', 'Paused: out of credits — resumes when credits are added', 'Usage by feature', 'Usage by day', 'Credit pack', 'Never expires', '150 credits expire on 31 Oct 2026', '$25.00', '$100.00', 'Waiting for confirmation', 'Save limits', 'Keep credits for autopilot', 'Packs last 12 months'])
      expect(t, s).toContain(s);
  });

  it('no provider cost reaches the page: the only dollars are pack prices', () => {
    const t = render(<CreditsTab />);
    const dollars = t.match(/\$\d[\d,.]*/g) ?? [];
    expect(new Set(dollars)).toEqual(new Set(['$25.00', '$100.00', '$0.05']));
    expect(t).not.toMatch(/Claude|DataForSEO|provider/i);
  });

  it('a viewer reads the packs and limits but cannot buy or save', () => {
    const t = render(<CreditsTab />, 'viewer');
    expect(t).toContain('Ask an owner or admin');
    expect(t).not.toContain('Save limits');
    expect(t).not.toMatch(/>Buy</);
    expect(t).toContain('Set by the owner of Northwind');
  });

  it('credits only counted: the hero says nothing stops', () => {
    expect(render(<CreditsTab />, 'owner', overview({ enforced: false, status: 'ok', runwayDays: null, runsOutOn: null }))).toContain('do not stop anything');
  });
});

describe('the balance pill and the banner', () => {
  it('owner: pill with the balance, banner with "Buy credits"', () => {
    expect(render(<CreditPill />)).toContain('1,240 credits');
    const t = render(<CreditBanner />);
    expect(t).toContain('Credits are running low');
    expect(t).toContain('Buy credits');
  });

  it('a viewer sees the banner without the button', () => {
    const t = render(<CreditBanner />, 'viewer');
    expect(t).toContain('Credits are running low');
    expect(t).not.toContain('Buy credits');
  });

  it('a client person sees neither', () => {
    expect(render(<CreditPill />, 'client_viewer')).toBe('');
    expect(render(<CreditBanner />, 'client_approver')).toBe('');
  });

  it('no banner on the Credits tab itself, nor when all is well', () => {
    expect(render(<CreditBanner />, 'owner', overview(), `/o/${ORG}/settings/credits`)).toBe('');
    expect(render(<CreditBanner />, 'owner', overview({ status: 'ok' }))).toBe('');
  });
});
