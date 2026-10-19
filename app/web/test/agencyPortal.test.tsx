import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { effectiveBrand, type AgencyOverviewRow, type Me, type Org, type PortalBrand, type Role, type Site } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { AgencyLockup } from '@/components/layout/Brand';
import { AuthLayout } from '@/components/layout/AuthGate';
import { OrgLayout, portalPathAllowed } from '@/components/layout/OrgLayout';
import { TooltipProvider } from '@/components/ui/overlay';
import { makeCan, OrgContext } from '@/lib/context';
import { productName, resetPortalBrand, setPortalBrand } from '@/lib/portal';
import { qk } from '@/lib/queries';
import { ThemeProvider } from '@/lib/theme';
import ClientsPage from '@/pages/agency/ClientsPage';
import ApprovalsPage from '@/pages/portal/ApprovalsPage';
import { text } from './renderReport';

// G5 (app/docs/WHITE_LABEL.md): what a client person and an agency see, rendered to HTML in Node, the agency's mark instead of ours,
// the portal's pages and nothing else, the agency's clients table, approvals for an approver.

const brand = effectiveBrand({ name: 'North Agency', branding: { whiteLabel: true, productName: 'North Insights', accent: '#0f766e', supportEmail: 'help@north.example.com' } })!;
const site: Site = { id: 's1', orgId: 'c1', domain: 'acme.example.com', verifiedAt: '2026-10-01T00:00:00.000Z', trackingStatus: 'active' } as Site;
const orgOf = (role: Role, extra: Partial<Org> = {}): Org =>
  ({ id: 'c1', name: 'Acme', slug: 'acme', industry: '', size: '', website: '', monthlyBudgetUsd: 0, disabled: false, onboardingStep: 'done', onboardedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', role, kind: 'client', agency: { name: 'North Agency' }, brand, clientApproval: true, ...extra }) as Org;
const me = (role: Role): Me => ({ user: { id: 'u1', email: 'ceo@acme.example.com', name: 'Ceo', mfaEnabled: false }, orgs: [{ id: 'c1', name: 'Acme', slug: 'acme', role, onboardingStep: 'done', onboardedAt: null, kind: 'client', agencyName: 'North Agency' }], platformAdmin: false }) as unknown as Me;

function shell(children: ReactNode, seed: (qc: QueryClient) => void = () => undefined, url = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(qc);
  return text(
    renderToString(
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <GuideProvider>
              <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
            </GuideProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  );
}

afterEach(() => resetPortalBrand());

describe('the agency mark', () => {
  it('draws the logo when there is one, else the initials and the name', () => {
    expect(renderToString(<AgencyLockup name="North" logoUrl="https://north.example.com/l.svg" logoDarkUrl={null} initials="N" />)).toContain('src="https://north.example.com/l.svg"');
    const t = text(renderToString(<AgencyLockup name="North Insights" logoUrl={null} logoDarkUrl={null} initials="NI" />));
    expect(t).toContain('NI');
    expect(t).toContain('North Insights');
  });
  it('the product name follows the brand in force', () => {
    expect(productName()).toBe('Alaventra');
    setPortalBrand(brand);
    expect(productName()).toBe('North Insights');
  });
});

describe('sign-in on a portal', () => {
  it('shows the agency and never our name or capabilities', () => {
    setPortalBrand(brand);
    const t = shell(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<p>form</p>} />
        </Route>
      </Routes>,
    );
    expect(t).toContain('North Insights client portal');
    expect(t).toContain('help@north.example.com');
    expect(t).not.toMatch(/Alaventra|Enterprise-grade autonomous SEO|Keyword ladders/);
  });
  it('says "Powered by Alaventra" only when the agency chose it', () => {
    setPortalBrand({ ...brand, poweredBy: true } as PortalBrand);
    const t = shell(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<p>form</p>} />
        </Route>
      </Routes>,
    );
    expect(t).toContain('Powered by Alaventra');
  });
});

describe('the client portal', () => {
  it('keeps a client person inside its pages', () => {
    expect(portalPathAllowed([])).toBe(true);
    expect(portalPathAllowed(['sites', 's1', 'overview'])).toBe(true);
    expect(portalPathAllowed(['sites', 's1', 'backlinks'])).toBe(true);
    expect(portalPathAllowed(['reports', 'r1'])).toBe(true);
    expect(portalPathAllowed(['approvals'])).toBe(true);
    for (const p of [['tools'], ['runs'], ['settings', 'team'], ['sites', 'new'], ['sites', 's1', 'pipeline'], ['sites', 's1', 'settings', 'business'], ['sites', 's1', 'content'], ['clients']])
      expect(portalPathAllowed(p), p.join('/')).toBe(false);
  });

  it('the sidebar of a client viewer: the agency\'s mark, the portal\'s pages, nothing of tools, runs, costs or settings', () => {
    setPortalBrand(brand);
    const t = shell(
      <Routes>
        <Route path="/o/:orgId" element={<OrgLayout />}>
          <Route path="sites/:siteId/overview" element={<p>overview page</p>} />
        </Route>
      </Routes>,
      (qc) => {
        qc.setQueryData(qk.me, me('client_viewer'));
        qc.setQueryData(qk.org('c1'), orgOf('client_viewer'));
        qc.setQueryData(qk.sites('c1'), [site]);
      },
      '/o/c1/sites/s1/overview',
    );
    for (const s of ['North Insights', 'Overview', 'Recommendations', 'Rankings', 'AI visibility', 'Backlinks', 'Reports', 'Approvals', 'Client viewer', 'acme.example.com'])
      expect(t, s).toContain(s);
    for (const s of ['Run an analysis', 'Runs', 'Company settings', 'Pipeline', 'Website settings', 'Link building', 'Write a page', 'Alaventra'])
      expect(t, s).not.toContain(s);
  });

  it('agency staff in a client workspace keep the full app, with the way back to the agency and the client\'s approvals', () => {
    const t = shell(
      <Routes>
        <Route path="/o/:orgId" element={<OrgLayout />}>
          <Route path="sites/:siteId/overview" element={<p>overview page</p>} />
        </Route>
      </Routes>,
      (qc) => {
        qc.setQueryData(qk.me, { ...me('admin'), orgs: [] });
        qc.setQueryData(qk.org('c1'), orgOf('admin', { agency: { id: 'a1', name: 'North Agency' } }));
        qc.setQueryData(qk.sites('c1'), [site]);
      },
      '/o/c1/sites/s1/overview',
    );
    expect(t).toContain('Client of North Agency');
    expect(t).toContain('Run an analysis');
    expect(t).toContain('Approvals');
    expect(t).toContain('Company settings');
  });
});

const ctx = (org: Org, role: Role) => ({ me: me(role), org, role, sites: [site], can: makeCan(role) });

describe('the agency\'s clients page', () => {
  const rows: AgencyOverviewRow[] = [
    { clientId: 'c1', clientName: 'Acme', siteId: 's1', domain: 'acme.example.com', verified: true, tracking: 'active', healthScore: 83, healthAt: '2026-10-10T00:00:00.000Z', rankGains: 4, rankDrops: 1, clicksPct: 12.5, aiVisibility: 41, aiMentionRate: 0.2, alerts14d: 2, approvalsWaiting: 1, spentUsd: 3.2, budgetUsd: 25 },
    { clientId: 'c2', clientName: 'Beta Foods', siteId: null, domain: null, verified: false, tracking: null, healthScore: null, healthAt: null, rankGains: null, rankDrops: null, clicksPct: null, aiVisibility: null, aiMentionRate: null, alerts14d: 0, approvalsWaiting: 0, spentUsd: 0, budgetUsd: 25 },
  ];
  const agency = orgOf('admin', { id: 'a1', name: 'North Agency', kind: 'agency', agency: null, brand: null, clientApproval: false });
  it('lists every client website with health, movement, alerts and spend', () => {
    const t = shell(
      <OrgContext.Provider value={ctx(agency, 'admin')}>
        <ClientsPage />
      </OrgContext.Provider>,
      (qc) => {
        qc.setQueryData(['org', 'a1', 'agency', 'overview'], { rows, generatedAt: '2026-10-18T00:00:00.000Z' });
        qc.setQueryData(['org', 'a1', 'agency', 'clients'], { clients: [] });
      },
    );
    for (const s of ['Acme', 'acme.example.com', 'Beta Foods', 'No website yet', '83', '▲ 4', '▼ 1', '+12.5%', '2 alerts', '1 to approve', 'Export CSV', 'New client']) expect(t, s).toContain(s);
  });
  it('a standard company is offered agency mode by its owner only', () => {
    const std = orgOf('owner', { id: 'o1', kind: 'standard', agency: null, brand: null });
    expect(shell(<OrgContext.Provider value={ctx(std, 'owner')}><ClientsPage /></OrgContext.Provider>)).toContain('Turn on agency mode');
    expect(shell(<OrgContext.Provider value={ctx({ ...std, role: 'member' }, 'member')}><ClientsPage /></OrgContext.Provider>)).toContain('Only the owner can turn this on');
  });
});

describe('approvals', () => {
  const items = [
    { id: 'p1', kind: 'page', itemId: 'r1', siteId: 's1', siteDomain: 'acme.example.com', title: 'Page: erp uae', status: 'pending', note: 'Please check the prices', requestedBy: 'Agency Member', requestedAt: '2026-10-17T00:00:00.000Z', decisionNote: null, decidedBy: null, decidedAt: null, reportId: 'r1' },
    { id: 'p2', kind: 'outreach', itemId: 'blog.example.org|resource_page', siteId: 's1', siteDomain: 'acme.example.com', title: 'Outreach to blog.example.org', status: 'approved', note: '', requestedBy: 'Agency Member', requestedAt: '2026-10-16T00:00:00.000Z', decisionNote: 'Fine', decidedBy: 'Ceo', decidedAt: '2026-10-16T10:00:00.000Z', reportId: null },
  ];
  it('an approver can approve or ask for changes; a viewer only reads', () => {
    const seed = (canDecide: boolean) => (qc: QueryClient) => qc.setQueryData(['org', 'c1', 'approvals'], { items, canDecide });
    const approver = shell(<OrgContext.Provider value={ctx(orgOf('client_approver'), 'client_approver')}><ApprovalsPage /></OrgContext.Provider>, seed(true));
    for (const s of ['Page: erp uae', 'Please check the prices', 'Approve', 'Ask for changes', 'Read the page', 'Nothing is published or sent before it is approved here', 'Decided', 'Fine']) expect(approver, s).toContain(s);
    expect(approver).not.toContain('Ask for approval');
    const viewer = shell(<OrgContext.Provider value={ctx(orgOf('client_viewer'), 'client_viewer')}><ApprovalsPage /></OrgContext.Provider>, seed(false));
    expect(viewer).not.toContain('Ask for changes');
    expect(viewer).toContain('Page: erp uae');
  });
});
