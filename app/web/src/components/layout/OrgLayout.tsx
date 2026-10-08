import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import {
  Activity,
  BellRing,
  Bot,
  Building2,
  Check,
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
import { MODES, ROLE_LABELS, type Org, type Site } from '@seo/shared';
import { lastSite, makeCan, OrgContext, rememberSite, useOrgCtx, type OrgContextValue } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useLogout, useMe, useOrg, useSites } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { ErrorState, PageLoader } from '../ui/feedback';
import { Avatar } from '../ui/misc';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../ui/overlay';
import { Brand, pageTitle } from './Brand';
import { rememberOrg } from './HomeRedirect';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentTitle, useScrolled } from './useDocumentTitle';

type IconType = ComponentType<{ className?: string }>;

/** The website pages in the sidebar (path segment under /o/:orgId/sites/:siteId/). */
export const SITE_NAV: { to: string; label: string; icon: IconType }[] = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { to: 'pipeline', label: 'Pipeline', icon: Workflow },
  { to: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: 'search', label: 'Search & traffic', icon: TrendingUp },
  { to: 'rankings', label: 'Rankings', icon: Activity },
  { to: 'content', label: 'Content', icon: PenSquare },
  { to: 'technical', label: 'Technical health', icon: Gauge },
  { to: 'ai', label: 'AI visibility', icon: Bot },
  { to: 'backlinks', label: 'Backlinks', icon: Link2 },
  { to: 'alerts', label: 'Alerts & check-ins', icon: BellRing },
  { to: 'settings', label: 'Website settings', icon: Settings },
];

/** "Overview · techand.ai — Ascentra" / "Runs · Acme — Ascentra", from the URL the layout already knows. */
function shellTitle(pathname: string, org: Org, sites: Site[]): string {
  const rest = pathname.slice(`/o/${org.id}`.length).split('/').filter(Boolean);
  if (rest[0] === 'sites' && rest[1] && rest[1] !== 'new') {
    const site = sites.find((s) => s.id === rest[1]);
    const label =
      rest[2] === 'pipeline' && rest[3] === 'new'
        ? 'New keyword ladder'
        : rest[2] === 'pipeline' && rest[3] === 'ladders'
          ? 'Keyword ladder'
          : SITE_NAV.find((n) => n.to === rest[2])?.label;
    return pageTitle(label, site?.domain ?? 'Website');
  }
  const mode = rest[0] === 'tools' && rest[1] ? (MODES as Record<string, { title: string } | undefined>)[rest[1]]?.title : undefined;
  const label: Record<string, string> = {
    tools: mode ?? 'Run an analysis',
    runs: rest[1] ? 'Run' : 'Runs',
    reports: rest[1] ? 'Report' : 'Reports',
    settings: 'Company settings',
    sites: 'Add a website',
  };
  return pageTitle(label[rest[0] ?? ''], org.name);
}

export function OrgLayout() {
  const { orgId = '' } = useParams();
  const me = useMe();
  const org = useOrg(orgId);
  const sites = useSites(orgId);
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrolled = useScrolled();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  useEffect(() => setMobileOpen(false), [loc.pathname]);
  // the drawer only exists below lg: widening the window closes it (the page behind would otherwise stay inert)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setMobileOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // focus moves into the drawer when it opens (retried for a few frames: the drawer becomes visible with the next style update)
  // and back to the menu button when it closes
  useEffect(() => {
    if (!mobileOpen) {
      if (drawer.current?.contains(document.activeElement)) menuButton.current?.focus();
      return;
    }
    let frame = 0;
    let tries = 0;
    const focusIn = () => {
      const close = drawer.current?.querySelector<HTMLElement>('[data-drawer-close]');
      close?.focus();
      if (close && document.activeElement !== close && tries++ < 10) frame = requestAnimationFrame(focusIn);
    };
    focusIn();
    return () => cancelAnimationFrame(frame);
  }, [mobileOpen]);
  useEffect(() => {
    if (org.data) rememberOrg(org.data.id);
  }, [org.data]);
  // Escape closes the phone drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const ctx = useMemo<OrgContextValue | null>(() => {
    if (!me.data || !org.data || !sites.data) return null;
    return { me: me.data, org: org.data, role: org.data.role, sites: sites.data, can: makeCan(org.data.role) };
  }, [me.data, org.data, sites.data]);

  useDocumentTitle(ctx ? shellTitle(loc.pathname, ctx.org, ctx.sites) : null);

  if (org.isError) return <ErrorState error={org.error} title="Company not available" />;
  if (!ctx) return <PageLoader fullPage />;

  return (
    <OrgContext.Provider value={ctx}>
      <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* phone / tablet top bar: the hairline appears once the page scrolls */}
        <div
          className={cn(
            'sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-surface/90 px-4 backdrop-blur-md transition-[border-color,box-shadow] duration-200 ease-brand sm:px-6 lg:hidden',
            scrolled ? 'border-line shadow-card' : 'border-transparent',
          )}
          inert={mobileOpen || undefined}
        >
          <Brand to={paths.org(orgId)} />
          <div className="flex items-center gap-1">
            <ThemeMenu />
            <button
              ref={menuButton}
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink active:bg-surface-3"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
            >
              <MenuIcon className="size-5" />
            </button>
          </div>
        </div>
        {mobileOpen && <div className="fixed inset-0 z-40 animate-fade-in bg-black/45 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}
        <aside
          ref={drawer}
          id="app-sidebar"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-overlay transition-[translate,visibility] duration-200 ease-brand',
            'lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:max-w-none lg:translate-x-0 lg:shadow-none',
            // opening: visible at once (focus moves in right away), then slides; closing: slides, then hides
            mobileOpen ? 'visible translate-x-0 transition-[translate]' : 'invisible -translate-x-full',
          )}
          aria-label="Sidebar"
        >
          <Sidebar onClose={() => setMobileOpen(false)} />
        </aside>
        <main className="min-w-0" inert={mobileOpen || undefined}>
          <div className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

/** A switcher row: small caption, the current value and the up/down chevron. */
const switcherRow =
  'group flex w-full items-center gap-2.5 px-3 py-2.5 text-left short:py-2 transition-colors duration-150 ease-brand hover:bg-surface-2 data-[state=open]:bg-surface-2';

function Sidebar({ onClose }: { onClose: () => void }) {
  const { me, org, sites, role, can } = useOrgCtx();
  const site = useCurrentSite(sites, org.id);
  const navigate = useNavigate();
  const logout = useLogout();
  const nav = useRef<HTMLElement>(null);
  const moreBelow = useMoreBelow(nav, site?.id);

  useEffect(() => {
    if (site) rememberSite(org.id, site.id);
  }, [org.id, site]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5 short:h-12">
        <Brand to={paths.org(org.id)} />
        <button
          type="button"
          data-drawer-close
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* where you are: company, then website */}
      <div className="px-3 pb-3 short:pb-2">
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          <OrgSwitcher />
          <Menu
            align="start"
            className="w-[248px]"
            trigger={
              <button type="button" className={switcherRow} aria-label={`Website: ${site?.domain ?? 'none yet'}. Switch website`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-3">
                  <Globe className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium leading-4 text-ink-3">Website</span>
                  <span className={cn('block truncate text-sm font-medium leading-5', site ? 'text-ink' : 'text-ink-3')}>{site?.domain ?? 'No website yet'}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" />
              </button>
            }
          >
            <MenuLabel>Websites</MenuLabel>
            {sites.map((s) => (
              <MenuItem key={s.id} icon={<Globe className="size-4" />} onSelect={() => navigate(paths.site(org.id, s.id))}>
                <span className="truncate">{s.domain}</span>
                {!s.verifiedAt ? (
                  <span className="ml-auto text-[11px] text-warning-text">unverified</span>
                ) : (
                  s.id === site?.id && <Check className="ml-auto size-4 text-accent-text" aria-label="Current" />
                )}
              </MenuItem>
            ))}
            {!sites.length && <p className="px-2.5 pb-2 text-xs text-ink-3">No websites in this company yet.</p>}
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
      </div>

      <nav
        ref={nav}
        className={cn(
          'flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin] short:pb-3',
          // more links below the fold: the last line fades out (a mask, not a colour) as the cue to scroll
          moreBelow && '[mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]',
        )}
        aria-label="Main"
      >
        {site && (
          <NavGroup title="Website">
            {SITE_NAV.map((n) => (
              <NavItem key={n.to} to={paths.site(org.id, site.id, n.to)} icon={n.icon}>
                {n.label}
              </NavItem>
            ))}
          </NavGroup>
        )}
        <NavGroup title="Company">
          <NavItem to={paths.tools(org.id)} icon={Wrench}>
            Run an analysis
          </NavItem>
          <NavItem to={paths.runs(org.id)} icon={ListChecks}>
            Runs
          </NavItem>
          <NavItem to={paths.reports(org.id)} icon={FileText}>
            Reports
          </NavItem>
          <NavItem to={paths.settings(org.id)} icon={Building2} match={`/o/${org.id}/settings`}>
            Company settings
          </NavItem>
          {me.platformAdmin && (
            <NavItem to={paths.admin} icon={Shield}>
              Platform admin
            </NavItem>
          )}
        </NavGroup>
        {can('member') && (
          <div className="mt-4 short:mt-3">
            <Link
              to={paths.tool(org.id, 'keyword', { siteId: site?.id })}
              className="group flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-2.5 short:py-2 text-sm font-medium text-ink-2 transition-colors duration-150 ease-brand hover:border-accent hover:bg-accent-soft hover:text-accent-text"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-text transition-colors duration-150 ease-brand group-hover:bg-accent group-hover:text-accent-ink">
                <Sparkles className="size-3.5" />
              </span>
              Write a page for a keyword
            </Link>
          </div>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1 border-t border-line px-3 py-3 short:py-2">
        <Menu
          align="start"
          className="w-[248px]"
          trigger={
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left short:py-1 transition-colors duration-150 ease-brand hover:bg-surface-2 data-[state=open]:bg-surface-2"
              aria-label={`Account menu for ${me.user.name}`}
            >
              <Avatar name={me.user.name} src={me.user.avatarUrl} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-5 text-ink">{me.user.name}</span>
                <span className="block truncate text-xs leading-4 text-ink-3">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
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

/** True while a scroll container has content below its visible part (updates on scroll and on size changes). */
function useMoreBelow(ref: RefObject<HTMLElement | null>, contentKey: unknown): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [ref, contentKey]);
  return more;
}

function OrgSwitcher() {
  const { me, org } = useOrgCtx();
  const navigate = useNavigate();
  return (
    <Menu
      align="start"
      className="w-[248px]"
      trigger={
        <button type="button" className={switcherRow} aria-label={`Company: ${org.name}. Switch company`}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink-surface text-[11px] font-semibold text-on-ink dark:bg-surface-3 dark:text-ink" aria-hidden>
            {initials(org.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium leading-4 text-ink-3">Company</span>
            <span className="block truncate text-sm font-semibold leading-5 text-ink">{org.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" />
        </button>
      }
    >
      <MenuLabel>Companies</MenuLabel>
      {me.orgs.map((o) => (
        <MenuItem key={o.id} icon={<Building2 className="size-4" />} onSelect={() => navigate(paths.org(o.id))}>
          <span className="truncate">{o.name}</span>
          {o.id === org.id && <Check className="ml-auto size-4 text-accent-text" aria-label="Current" />}
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
    <div className="mt-4 first:mt-1 short:mt-3 short:first:mt-0.5">
      {title && <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 short:pb-1">{title}</div>}
      <ul className="space-y-px">{children}</ul>
    </div>
  );
}

function NavItem({ to, icon: Icon, children, match }: { to: string; icon: IconType; children: ReactNode; match?: string }) {
  const loc = useLocation();
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) => {
          const active = isActive || (match ? loc.pathname.startsWith(match) : false) || (to.endsWith('/settings') && loc.pathname.startsWith(to));
          return cn(
            // the 3px bar on the sidebar's edge marks the current page (with the tint and the colour, never colour alone)
            'group relative flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ease-brand short:py-[3px]',
            'before:absolute before:-left-3 before:inset-y-1.5 before:w-[3px] before:rounded-r-full before:bg-accent before:opacity-0 before:transition-opacity before:duration-150',
            active ? 'bg-accent-soft font-medium text-accent-text before:opacity-100' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          );
        }}
      >
        {({ isActive }) => {
          const active = isActive || (match ? loc.pathname.startsWith(match) : false) || (to.endsWith('/settings') && loc.pathname.startsWith(to));
          return (
            <>
              <Icon className={cn('size-4 shrink-0 transition-colors duration-150', active ? 'text-accent-text' : 'text-ink-3 group-hover:text-ink-2')} />
              <span className="truncate">{children}</span>
            </>
          );
        }}
      </NavLink>
    </li>
  );
}
