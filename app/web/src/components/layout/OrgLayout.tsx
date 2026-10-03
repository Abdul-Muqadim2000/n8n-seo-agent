import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import {
  Activity,
  BellRing,
  Bot,
  Building2,
  ChevronsUpDown,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  PenSquare,
  Plus,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type Site } from '@seo/shared';
import { lastSite, makeCan, OrgContext, rememberSite, useOrgCtx, type OrgContextValue } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useLogout, useMe, useOrg, useSites } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { ErrorState, PageLoader } from '../ui/feedback';
import { Avatar } from '../ui/misc';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../ui/overlay';
import { Brand, BrandMark } from './Brand';
import { rememberOrg } from './HomeRedirect';
import { ThemeMenu } from './ThemeMenu';

export function OrgLayout() {
  const { orgId = '' } = useParams();
  const me = useMe();
  const org = useOrg(orgId);
  const sites = useSites(orgId);
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [loc.pathname]);
  useEffect(() => {
    if (org.data) rememberOrg(org.data.id);
  }, [org.data]);

  const ctx = useMemo<OrgContextValue | null>(() => {
    if (!me.data || !org.data || !sites.data) return null;
    return { me: me.data, org: org.data, role: org.data.role, sites: sites.data, can: makeCan(org.data.role) };
  }, [me.data, org.data, sites.data]);

  if (org.isError) return <ErrorState error={org.error} title="Company not available" />;
  if (!ctx) return <PageLoader />;

  return (
    <OrgContext.Provider value={ctx}>
      <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[264px_1fr]">
        {/* mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <Brand to={paths.org(orgId)} />
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Open navigation">
            <MenuIcon className="size-5" />
          </button>
        </div>
        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onClose={() => setMobileOpen(false)} />
        </aside>
        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </OrgContext.Provider>
  );
}

/** /o/:orgId — the last website used, the first one, or "add your first website". */
export function OrgIndex() {
  const { orgId = '' } = useParams();
  const sites = useSites(orgId);
  if (!sites.data) return <PageLoader />;
  if (!sites.data.length) return <Navigate to={paths.newSite(orgId)} replace />;
  const last = lastSite(orgId);
  const site = sites.data.find((s) => s.id === last) ?? sites.data[0];
  return <Navigate to={paths.site(orgId, site.id)} replace />;
}

function useCurrentSite(sites: Site[], orgId: string): Site | null {
  const { siteId } = useParams();
  const loc = useLocation();
  const fromQuery = new URLSearchParams(loc.search).get('site');
  const id = siteId ?? fromQuery ?? lastSite(orgId);
  return sites.find((s) => s.id === id) ?? sites[0] ?? null;
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const { me, org, sites, role, can } = useOrgCtx();
  const site = useCurrentSite(sites, org.id);
  const navigate = useNavigate();
  const logout = useLogout();

  useEffect(() => {
    if (site) rememberSite(org.id, site.id);
  }, [org.id, site]);

  const siteNav: { to: string; label: string; icon: ReactNode }[] = site
    ? [
        { to: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
        { to: 'pipeline', label: 'Pipeline', icon: <Workflow className="size-4" /> },
        { to: 'recommendations', label: 'Recommendations', icon: <Lightbulb className="size-4" /> },
        { to: 'search', label: 'Search & traffic', icon: <TrendingUp className="size-4" /> },
        { to: 'rankings', label: 'Rankings', icon: <Activity className="size-4" /> },
        { to: 'content', label: 'Content', icon: <PenSquare className="size-4" /> },
        { to: 'technical', label: 'Technical health', icon: <Gauge className="size-4" /> },
        { to: 'ai', label: 'AI visibility', icon: <Bot className="size-4" /> },
        { to: 'backlinks', label: 'Backlinks', icon: <Link2 className="size-4" /> },
        { to: 'alerts', label: 'Alerts & check-ins', icon: <BellRing className="size-4" /> },
        { to: 'settings', label: 'Website settings', icon: <Settings className="size-4" /> },
      ]
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <OrgSwitcher />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 lg:hidden" aria-label="Close navigation">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <Menu
          align="start"
          className="w-[240px]"
          trigger={
            <button type="button" className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left hover:border-line-strong">
              <Globe className="size-4 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-3">Website</span>
                <span className="block truncate text-sm font-medium text-ink">{site?.domain ?? 'No website yet'}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
            </button>
          }
        >
          <MenuLabel>Websites</MenuLabel>
          {sites.map((s) => (
            <MenuItem key={s.id} icon={<Globe className="size-4" />} onSelect={() => navigate(paths.site(org.id, s.id))}>
              <span className="truncate">{s.domain}</span>
              {!s.verifiedAt && <span className="ml-auto text-[11px] text-warning-text">unverified</span>}
            </MenuItem>
          ))}
          {can('admin') && (
            <>
              <MenuSeparator />
              <MenuItem icon={<Plus className="size-4" />} onSelect={() => navigate(paths.newSite(org.id))}>
                Add a website
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {site && (
          <NavGroup>
            {siteNav.map((n) => (
              <NavItem key={n.to} to={paths.site(org.id, site.id, n.to)} icon={n.icon}>
                {n.label}
              </NavItem>
            ))}
          </NavGroup>
        )}
        <NavGroup title="Company">
          <NavItem to={paths.tools(org.id)} icon={<Wrench className="size-4" />}>
            Run an analysis
          </NavItem>
          <NavItem to={paths.runs(org.id)} icon={<ListChecks className="size-4" />}>
            Runs
          </NavItem>
          <NavItem to={paths.reports(org.id)} icon={<FileText className="size-4" />}>
            Reports
          </NavItem>
          <NavItem to={paths.settings(org.id)} icon={<Building2 className="size-4" />} match={`/o/${org.id}/settings`}>
            Company settings
          </NavItem>
          {me.platformAdmin && (
            <NavItem to={paths.admin} icon={<Shield className="size-4" />}>
              Platform admin
            </NavItem>
          )}
        </NavGroup>
        {can('member') && (
          <div className="mt-4 px-1">
            <Link
              to={paths.tool(org.id, 'keyword', { siteId: site?.id })}
              className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink-2 hover:border-accent hover:text-accent-text"
            >
              <Sparkles className="size-4" />
              Write a page for a keyword
            </Link>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-line px-3 py-3">
        <Menu
          align="start"
          trigger={
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
              <Avatar name={me.user.name} src={me.user.avatarUrl} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{me.user.name}</span>
                <span className="block truncate text-xs text-ink-3">{ROLE_LABELS[role]}</span>
              </span>
            </button>
          }
        >
          <MenuLabel>{me.user.email}</MenuLabel>
          <MenuItem icon={<User className="size-4" />} onSelect={() => navigate(paths.account)}>
            Your account
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<LogOut className="size-4" />}
            onSelect={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
          >
            Sign out
          </MenuItem>
        </Menu>
        <ThemeMenu />
      </div>
    </div>
  );
}

function OrgSwitcher() {
  const { me, org } = useOrgCtx();
  const navigate = useNavigate();
  return (
    <Menu
      align="start"
      className="w-[240px]"
      trigger={
        <button type="button" className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2">
          <BrandMark className="size-6" />
          <span className="truncate text-sm font-semibold text-ink">{org.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-ink-3" />
        </button>
      }
    >
      <MenuLabel>Companies</MenuLabel>
      {me.orgs.map((o) => (
        <MenuItem key={o.id} icon={<Building2 className="size-4" />} onSelect={() => navigate(paths.org(o.id))}>
          <span className="truncate">{o.name}</span>
          {o.id === org.id && <span className="ml-auto text-xs text-ink-3">✓</span>}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={<Plus className="size-4" />} onSelect={() => navigate(paths.onboarding())}>
        New company
      </MenuItem>
    </Menu>
  );
}

function NavGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-1">
      {title && <div className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</div>}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavItem({ to, icon, children, match }: { to: string; icon: ReactNode; children: ReactNode; match?: string }) {
  const loc = useLocation();
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) => {
          const active = isActive || (match ? loc.pathname.startsWith(match) : false) || (to.endsWith('/settings') && loc.pathname.startsWith(to));
          return cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            active ? 'bg-accent-soft font-medium text-accent-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          );
        }}
      >
        {icon}
        {children}
      </NavLink>
    </li>
  );
}

