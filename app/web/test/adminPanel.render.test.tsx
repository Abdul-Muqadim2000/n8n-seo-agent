import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import AdminLayout from '@/pages/admin/AdminLayout';
import ActivityPage from '@/pages/admin/ActivityPage';
import CompaniesPage from '@/pages/admin/CompaniesPage';
import CompanyDetailPage from '@/pages/admin/CompanyDetailPage';
import CostsPage from '@/pages/admin/CostsPage';
import OverviewPage from '@/pages/admin/OverviewPage';
import RunsPage from '@/pages/admin/RunsPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import UserDetailPage from '@/pages/admin/UserDetailPage';
import UsersPage from '@/pages/admin/UsersPage';
import * as F from './adminFixtures';
import { setAdminUnits } from '@/pages/admin/_components/units';

// The platform admin panel renders every page from answers shaped like the contract (shared/src/admin.ts), and keeps everyone who is
// not a platform admin out, the server enforces it too.

function client(platformAdmin = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(['me'], { ...F.me, platformAdmin });
  qc.setQueryData(['admin', 'overview', 'month'], F.overview);
  qc.setQueryData(['admin', 'companies', 'month'], F.companies);
  const c = F.companies[0]!;
  qc.setQueryData(['admin', 'company', c.id, 'month'], F.companyDetail(c.id));
  qc.setQueryData(['admin', 'credits', c.id], F.credits(c.id));
  qc.setQueryData(['admin', 'users', 'month'], F.users);
  qc.setQueryData(['admin', 'settings'], F.settings);
  qc.setQueryData(['admin', 'activity', 100], F.activity);
  qc.setQueryData(['admin', 'delivery'], F.delivery);
  const page = { pages: [F.runsPage(null, 50)], pageParams: [null] };
  qc.setQueryData(['admin', 'runs', { period: 'month', status: 'all', origin: 'all', orgId: undefined, q: undefined, limit: 50 }], page);
  qc.setQueryData(['admin', 'runs', { period: 'month', limit: 200 }], { pages: [F.runsPage(null, 200)], pageParams: [null] });
  return qc;
}

const render = (path: string, el: ReactNode, platformAdmin = true, child = '*') =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={client(platformAdmin)}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={el} />
                <Route path={child} element={el} />
              </Route>
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('platform admin panel', () => {
  it('shows "no access" to everyone else, without the panel', () => {
    const t = text(render('/admin', <OverviewPage />, false));
    expect(t).toContain('You do not have access to this page');
    expect(t).not.toContain('Cost to us');
  });

  it('overview: the KPIs, the provider bills (a missing bill says why, never an estimate as a bill) and the top companies', () => {
    const t = text(render('/admin', <OverviewPage />));
    for (const s of ['Revenue', 'Cost to us', 'Margin', 'Credits outstanding', 'Active users', 'Runs']) expect(t).toContain(s);
    expect(t).toContain('not available');
    expect(t).toContain('No Anthropic Admin API key is set');
    expect(t).toContain('Brightline Agency');
    expect(t).toContain('Cost data is current');
    expect(t).not.toContain('[object');
    expect(t).not.toContain('NaN');
  });

  it('companies: every company with credits, cost split, revenue and margin, and the CSV export', () => {
    const html = render('/admin/companies', <CompaniesPage />);
    const t = text(html);
    for (const c of F.companies) expect(t).toContain(c.name);
    expect(html).toContain('/api/admin/export/companies.csv?period=month');
    expect(t).toContain('Credits enforced');
    expect(t).toContain('Disabled');
    expect(t).not.toContain('NaN');
  });

  it('company detail: actions, money cards, the credit ledger, members and runs', () => {
    const c = F.companies[0]!;
    const t = text(render(`/admin/companies/${c.id}`, <CompanyDetailPage />, true, 'companies/:companyId'));
    for (const s of ['Add credits', 'Enforce credits', 'Credit ledger', 'Invoice 2026-114', 'Members', 'Sara Haddad', 'Recent runs', 'Cost by mode']) expect(t).toContain(s);
    expect(t).not.toContain('NaN');
  });

  it('credit book: the Credits / USD switch turns every credit figure into the dollars behind it (paid, list value, cost to us, owed)', () => {
    const c = F.companies[0]!;
    setAdminUnits('credits');
    let t = text(render(`/admin/companies/${c.id}`, <CompanyDetailPage />, true, 'companies/:companyId'));
    for (const s of ['Credit book', 'Bought', 'Given free', 'Used', 'Remaining now', 'Credits USD']) expect(t).toContain(s);
    expect(t).not.toContain('cost us');
    const o = text(render('/admin', <OverviewPage />));
    expect(o).toContain('Credit book, all companies');
    expect(o).toContain('893.6'); // credits outstanding, in credits
    setAdminUnits('usd');
    t = text(render(`/admin/companies/${c.id}`, <CompanyDetailPage />, true, 'companies/:companyId'));
    for (const s of ['paid', 'at list price', 'cost us', 'margin', 'owed at list price', 'will cost us', 'Margin on the credits used']) expect(t).toContain(s);
    const usdO = text(render('/admin', <OverviewPage />));
    expect(usdO).toContain('$44.68'); // 893.6 credits × $0.05 owed at list price
    expect(usdO).toContain('$100.00'); // bought
    const cos = text(render('/admin/companies', <CompaniesPage />));
    expect(cos).toContain('Credits left / used ($)');
    expect(t + usdO + cos).not.toContain('NaN');
    setAdminUnits('credits');
  });

  it('users and a person: companies with roles, sign-in methods, cost of their runs', () => {
    const t = text(render('/admin/users', <UsersPage />));
    for (const u of F.users) expect(t).toContain(u.email);
    expect(t).toContain('Suspended');
    const one = text(render(`/admin/users/${F.users[1]!.id}`, <UserDetailPage />, true, 'users/:userId'));
    expect(one).toContain('Sara Haddad');
    expect(one).toContain('Brightline Agency');
    expect(one).toContain('Cost of their runs');
  });

  it('runs, costs, activity and settings render from the contract', () => {
    const runs = text(render('/admin/runs', <RunsPage />));
    expect(runs).toContain('Load more');
    expect(runs).toContain('Part estimated');
    const costs = text(render('/admin/costs', <CostsPage />));
    expect(costs).toContain('Billed vs attributed');
    expect(costs).toContain('Delivery rate');
    expect(costs).toContain('Cost by mode, all companies');
    const act = text(render('/admin/activity', <ActivityPage />));
    expect(act).toContain('Credits granted');
    const set = text(render('/admin/settings', <SettingsPage />));
    expect(set).toContain('Worked example');
    expect(set).toContain('24'); // a $0.80 run at $0.10 a credit and ×3 uses 24 credits
    expect(set).toContain('Password reset link');
  });
});
