// The platform admin panel's shell (/admin/*): a slim left nav (a scrolling tab row on phones), a header with the period selector kept
// in the URL (`?period=`) and a way back to the app. Only for the people in PLATFORM_ADMIN_EMAILS; everyone else gets "no access".
import { useEffect, useRef, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { Activity, ArrowLeft, Building2, LayoutDashboard, ListChecks, Lock, Receipt, Settings, Shield, Users } from 'lucide-react';
import { ADMIN_PERIODS, type AdminPeriod } from '@seo/shared';
import { Brand, BrandMark } from '@/components/layout/Brand';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageLoader } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/tabs';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { StandaloneShell } from '@/pages/settings/_components/StandaloneShell';
import { adminPaths, parsePeriod, PERIOD_LABELS, PERIOD_SHORT, withPeriod } from './lib';

const NAV: { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean }[] = [
  { to: adminPaths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: adminPaths.companies, label: 'Companies', icon: Building2 },
  { to: adminPaths.users, label: 'Users', icon: Users },
  { to: adminPaths.runs, label: 'Runs', icon: ListChecks },
  { to: adminPaths.costs, label: 'Costs & billing', icon: Receipt },
  { to: adminPaths.activity, label: 'Activity', icon: Activity },
  { to: adminPaths.settings, label: 'Settings', icon: Settings },
];

/** the period every admin page reads, from `?period=` (default: this month) */
export function useAdminPeriod(): [AdminPeriod, (p: AdminPeriod) => void] {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get('period'));
  const set = (p: AdminPeriod) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p === 'month') next.delete('period');
        else next.set('period', p);
        return next;
      },
      { replace: true },
    );
  return [period, set];
}

function PeriodPicker() {
  const [period, setPeriod] = useAdminPeriod();
  return (
    <>
      <Segmented
        className="hidden xl:inline-flex"
        size="sm"
        label="Period"
        value={period}
        onChange={setPeriod}
        options={ADMIN_PERIODS.map((p) => ({ value: p, label: PERIOD_SHORT[p] }))}
      />
      <div className="xl:hidden">
        <Select aria-label="Period" value={period} onChange={(e) => setPeriod(parsePeriod(e.target.value))} className="h-8 w-[128px] text-[13px]">
          {ADMIN_PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const me = useMe();
  if (!me.data) return <PageLoader fullPage />;
  if (!me.data.platformAdmin)
    return (
      <StandaloneShell icon={<Shield />} title="Platform admin">
        <Card>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="You do not have access to this page"
            description="Platform administration is limited to the people who run this installation."
            action={<ButtonLink to="/">Go to the dashboard</ButtonLink>}
          />
        </Card>
      </StandaloneShell>
    );
  return <AdminShell />;
}

function AdminShell() {
  const [period] = useAdminPeriod();
  const loc = useLocation();
  const row = useRef<HTMLElement>(null);
  // phones: the nav row scrolls; keep the current page's tab in view
  useEffect(() => {
    row.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [loc.pathname]);
  const item = (active: boolean) =>
    cn(
      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ease-brand',
      active ? 'bg-accent-soft text-accent-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
    );
  return (
    <div className="min-h-dvh bg-page">
      <a href="#admin-main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          {/* phones: the app icon alone, so the period and the way back fit at 375px */}
          <Link to="/" aria-label="Alaventra home" className="shrink-0 rounded-md sm:hidden">
            <BrandMark />
          </Link>
          <Brand to="/" className="hidden sm:flex" />
          <span className="hidden items-center gap-1.5 border-l border-line pl-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3 sm:inline-flex">
            <Shield className="size-3.5" aria-hidden />
            Platform admin
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <PeriodPicker />
            <ButtonLink to="/" variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} aria-label="Back to app" className="px-2 sm:px-3">
              <span className="hidden sm:inline">Back to app</span>
            </ButtonLink>
            <ThemeMenu />
          </div>
        </div>
        {/* phones and tablets: the nav as one scrolling row */}
        <nav ref={row} aria-label="Admin" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 [scrollbar-width:none] lg:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={withPeriod(n.to, period)} end={n.end} className={({ isActive }) => cn(item(isActive), 'shrink-0 py-1.5')}>
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="flex">
        <div className="hidden w-56 shrink-0 border-r border-line bg-surface/40 lg:block">
        <aside className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 py-5">
          <nav aria-label="Admin" className="space-y-0.5">
            {NAV.map((n) => (
              <NavLink key={n.to} to={withPeriod(n.to, period)} end={n.end} className={({ isActive }) => item(isActive)}>
                <n.icon className="size-4 shrink-0" aria-hidden />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-6 px-2.5 text-[11px] leading-snug text-ink-3">Internal. Customers never see these figures.</p>
        </aside>
        </div>
        <main id="admin-main" className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
