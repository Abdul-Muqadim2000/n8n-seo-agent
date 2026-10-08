import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import * as D from '@radix-ui/react-dialog';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { features } from '../content/features';
import { primaryNav } from '../content/site';
import { solutions } from '../content/solutions';
import { LOOP_STEPS } from './diagrams/GrowthLoopDiagram';
import { IconTile } from './FeatureCard';
import { Logo } from './Logo';
import { Container } from './Section';
import { ThemeMenuButton, ThemeSegmented } from './ThemeSwitch';

type MenuId = 'platform' | 'solutions';

const navItem =
  'inline-flex h-9 items-center gap-1 rounded-md px-3 text-[14px] font-medium text-ink-2 transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink aria-expanded:text-ink aria-[current=page]:text-ink';

/** Header CTAs: "Sign in" + "Start free" for visitors, "Open app" for signed-in users. */
function useAuthCtas() {
  const me = useMe();
  return { signedIn: !!me.data };
}

/** One row in a menu: icon tile, name, one line. */
function MenuRow({ to, icon, title, body, onNavigate }: { to: string; icon: Parameters<typeof IconTile>[0]['icon']; title: string; body: string; onNavigate?: () => void }) {
  return (
    <Link to={to} onClick={onNavigate} className="group flex gap-3.5 rounded-lg p-3 transition-colors duration-150 ease-brand hover:bg-surface-2 focus-visible:bg-surface-2">
      <IconTile icon={icon} size="sm" className="mt-0.5 group-hover:bg-accent group-hover:text-accent-ink" />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[14px] font-medium text-ink">
          {title}
          <ArrowRight className="size-3.5 -translate-x-1 text-accent-text opacity-0 transition-[opacity,transform] duration-150 ease-brand group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-3">{body}</span>
      </span>
    </Link>
  );
}

/** Sticky marketing header: transparent at the top, solid with a hairline once scrolled; Platform mega-menu, Solutions menu, links, CTAs and the phone menu. */
export function SiteHeader() {
  const { signedIn } = useAuthCtas();
  const loc = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpenState] = useState<MenuId | null>(null);
  // the latest value, readable inside handlers before React re-renders (hover then click arrive in the same frame)
  const openRef = useRef<MenuId | null>(null);
  const setOpen = useCallback((v: MenuId | null) => {
    openRef.current = v;
    setOpenState(v);
  }, []);
  const [sheet, setSheet] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  // a menu opened by hover stays open on the click that follows (instead of toggling shut)
  const openedBy = useRef<'hover' | 'click'>('click');
  const headerRef = useRef<HTMLElement>(null);
  const triggers = useRef<Record<MenuId, HTMLButtonElement | null>>({ platform: null, solutions: null });
  const ids = { platform: useId(), solutions: useId() };

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // close everything on navigation
  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [loc.pathname]);

  // Escape closes and returns focus to the trigger; a click outside closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggers.current[open]?.focus();
        setOpen(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = useCallback(
    (id: MenuId, item: HTMLElement) => {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => {
        // a late or stale leave (e.g. a panel closed by Escape under a resting pointer) must not close a menu the pointer is on
        if (openRef.current === id && !item.matches(':hover')) setOpen(null);
      }, 140);
    },
    [setOpen],
  );
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // hover opens on devices with a real pointer; click / Enter / Space toggles everywhere
  const hoverProps = (id: MenuId) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelClose();
      if (openRef.current !== id) openedBy.current = 'hover';
      setOpen(id);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      scheduleClose(id, e.currentTarget);
    },
  });
  // leaving the menu by keyboard closes it
  const blurProps = (id: MenuId) => ({
    onBlur: (e: React.FocusEvent<HTMLLIElement>) => {
      if (open === id && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null);
    },
  });

  const trigger = (id: MenuId, label: string) => (
    <button
      ref={(el) => {
        triggers.current[id] = el;
      }}
      type="button"
      className={navItem}
      aria-expanded={open === id}
      aria-controls={ids[id]}
      onClick={() => {
        const cur = openRef.current;
        if (cur === id && openedBy.current === 'hover') {
          openedBy.current = 'click';
          return;
        }
        openedBy.current = 'click';
        setOpen(cur === id ? null : id);
      }}
    >
      {label}
      <ChevronDown className={cn('size-3.5 text-ink-3 transition-transform duration-200 ease-brand', open === id && 'rotate-180')} aria-hidden />
    </button>
  );

  const solid = scrolled || open !== null;
  const close = () => setOpen(null);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 ease-brand',
        solid ? 'border-line bg-page/90 backdrop-blur-md supports-[backdrop-filter]:bg-page/80' : 'border-transparent bg-transparent',
      )}
    >
      <Container className="relative flex h-16 items-center gap-6 lg:h-[72px]">
        <Link to="/" className="-ml-1 shrink-0 rounded-md p-1" aria-label="Ascentra home">
          <Logo className="h-8 sm:h-9" />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 self-stretch lg:block">
          <ul className="flex h-full items-center gap-0.5">
            <li className="flex h-full items-center" {...hoverProps('platform')} {...blurProps('platform')}>
              {trigger('platform', 'Platform')}
              {open === 'platform' && (
                <div id={ids.platform} className="absolute inset-x-4 top-full pt-2 sm:inset-x-6 lg:inset-x-8">
                  <div className="mk-menu-panel grid grid-cols-[minmax(0,1fr)_300px] gap-2 rounded-2xl border border-line bg-surface p-2 shadow-overlay">
                    <div className="p-2">
                      <p className="px-3 pb-2 pt-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Capabilities</p>
                      <ul className="grid grid-cols-2 gap-x-2">
                        {features.map((f) => (
                          <li key={f.slug}>
                            <MenuRow to={`/platform/${f.slug}`} icon={f.icon} title={f.shortName} body={f.tagline} onNavigate={close} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col justify-between rounded-xl bg-ink-surface p-6 text-on-ink">
                      <div>
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-on-ink">How it works</p>
                        <p className="mt-3 font-display text-lg font-semibold leading-snug">One weekly loop from research to results.</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-on-ink-2">Every step on Auto or waiting for you, with the cost shown before any paid work.</p>
                        <ol className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
                          {LOOP_STEPS.map((st, i) => (
                            <li key={st.label} className="flex items-center gap-2 text-[13px] text-on-ink">
                              <span className="font-mono text-[11px] text-accent-on-ink tabular">{String(i + 1).padStart(2, '0')}</span>
                              {st.label}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="mt-6 space-y-1">
                        <Link to="/how-it-works" onClick={close} className="group flex items-center justify-between rounded-md py-1.5 text-[14px] font-medium text-on-ink hover:text-accent-on-ink">
                          See how it works
                          <ArrowRight className="size-4 transition-transform duration-150 ease-brand group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                        <Link to="/platform" onClick={close} className="group flex items-center justify-between rounded-md py-1.5 text-[14px] font-medium text-on-ink hover:text-accent-on-ink">
                          Platform overview
                          <ArrowRight className="size-4 transition-transform duration-150 ease-brand group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </li>
            <li className="relative flex h-full items-center" {...hoverProps('solutions')} {...blurProps('solutions')}>
              {trigger('solutions', 'Solutions')}
              {open === 'solutions' && (
                <div id={ids.solutions} className="absolute left-0 top-full w-[440px] pt-2">
                  <div className="mk-menu-panel rounded-2xl border border-line bg-surface p-2 shadow-overlay">
                    <ul>
                      {solutions.map((s) => (
                        <li key={s.slug}>
                          <MenuRow to={`/solutions/${s.slug}`} icon={s.icon} title={s.shortName} body={s.tagline} onNavigate={close} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 border-t border-line pt-1">
                      <Link
                        to="/solutions"
                        onClick={close}
                        className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium text-accent-text hover:bg-surface-2"
                      >
                        All solutions
                        <ArrowRight className="size-4 transition-transform duration-150 ease-brand group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </li>
            {primaryNav.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={navItem}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeMenuButton className="hidden lg:inline-flex" onOpen={() => setOpen(null)} />
          <span aria-hidden className="mr-1 hidden h-5 w-px bg-line lg:block" />
          {signedIn ? (
            <ButtonLink to="/" size="sm" className="group h-10 px-4 text-[14px] lg:h-9">
              Open app
              <ArrowRight className="hidden size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 sm:block" aria-hidden />
            </ButtonLink>
          ) : (
            <>
              <Link to="/contact?topic=sales" className={cn(navItem, 'hidden xl:inline-flex')}>
                Talk to sales
              </Link>
              <Link to="/login" className={cn(navItem, 'hidden h-10 sm:inline-flex lg:h-9')}>
                Sign in
              </Link>
              <ButtonLink to="/signup" size="sm" className="group h-10 px-4 text-[14px] lg:h-9">
                Start free
                <ArrowRight className="hidden size-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5 sm:block" aria-hidden />
              </ButtonLink>
            </>
          )}
          <MobileMenu open={sheet} onOpenChange={setSheet} signedIn={signedIn} />
        </div>
      </Container>
    </header>
  );
}

function SheetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{title}</p>
      {children}
    </div>
  );
}

/** Phone / tablet menu: a full-height sheet (Radix Dialog: focus trap, Escape, focus returns to the button). */
function MobileMenu({ open, onOpenChange, signedIn }: { open: boolean; onOpenChange: (o: boolean) => void; signedIn: boolean }) {
  const close = () => onOpenChange(false);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Trigger asChild>
        <button
          type="button"
          className="-mr-1.5 inline-flex size-10 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:bg-surface-3 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink-surface/50 animate-fade-in lg:hidden" />
        <D.Content className="mk-sheet fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col overflow-hidden rounded-b-2xl border-b border-line bg-page shadow-overlay lg:hidden">
          <D.Title className="sr-only">Menu</D.Title>
          <D.Description className="sr-only">Pages on the Ascentra website</D.Description>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6">
            <Link to="/" onClick={close} className="-ml-1 rounded-md p-1" aria-label="Ascentra home">
              <Logo className="h-8" />
            </Link>
            <D.Close className="-mr-1.5 inline-flex size-10 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:bg-surface-3" aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </D.Close>
          </div>
          <nav aria-label="Main" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-2 py-5 sm:px-4">
            <SheetGroup title="Platform">
              <ul className="grid sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f.slug}>
                    <Link to={`/platform/${f.slug}`} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-surface-2">
                      <IconTile icon={f.icon} size="sm" />
                      {f.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetGroup>
            <SheetGroup title="Solutions">
              <ul className="grid sm:grid-cols-2">
                {solutions.map((s) => (
                  <li key={s.slug}>
                    <Link to={`/solutions/${s.slug}`} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-surface-2">
                      <IconTile icon={s.icon} size="sm" />
                      {s.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetGroup>
            <SheetGroup title="Company">
              <ul className="grid grid-cols-2">
                {[{ label: 'Platform overview', to: '/platform' }, ...primaryNav, { label: 'About', to: '/about' }, { label: 'Changelog', to: '/changelog' }, { label: 'Contact', to: '/contact' }].map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} onClick={close} className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-surface-2">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetGroup>
          </nav>
          <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-3 border-t border-line p-4 sm:px-6">
            <div className="col-span-2 flex items-center justify-between gap-3">
              <p className="pl-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3" aria-hidden>
                Theme
              </p>
              <ThemeSegmented labels="wide" />
            </div>
            {signedIn ? (
              <ButtonLink to="/" size="lg" onClick={close} className="col-span-2">
                Open app
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" size="lg" variant="secondary" onClick={close}>
                  Sign in
                </ButtonLink>
                <ButtonLink to="/signup" size="lg" onClick={close}>
                  Start free
                </ButtonLink>
              </>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
