import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Lightbulb, LogOut, User } from 'lucide-react';
import type { Me, Org, Site } from '@seo/shared';
import { Brand, pageTitle } from '@/components/layout/Brand';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { useDocumentTitle, useScrolled } from '@/components/layout/useDocumentTitle';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/overlay';
import { paths } from '@/lib/paths';
import { useLogout } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { SITE_STEPS, STEPS, type StepId } from './wizard';

// The full-page onboarding layout: brand bar, a progress stepper (left on wide screens, a compact bar on phones) and the step card.

function AccountMenu({ me }: { me: Me }) {
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <Menu
      trigger={
        <button
          type="button"
          className="rounded-full p-0.5 transition-shadow duration-150 ease-brand hover:shadow-[0_0_0_3px_var(--surface-3)] data-[state=open]:shadow-[0_0_0_3px_var(--surface-3)]"
          aria-label="Your account"
        >
          <Avatar name={me.user.name} src={me.user.avatarUrl} size={32} />
        </button>
      }
    >
      <MenuLabel>{me.user.email}</MenuLabel>
      <MenuItem icon={<User className="size-4" />} onSelect={() => navigate(paths.account)}>
        Your account
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LogOut className="size-4" />} onSelect={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}>
        Sign out
      </MenuItem>
    </Menu>
  );
}

type StepState = 'done' | 'current' | 'reachable' | 'upcoming' | 'attention';

export function WizardShell({
  me,
  org,
  site,
  step,
  furthest,
  children,
}: {
  me: Me;
  org: Org | null;
  site: Site | null;
  step: StepId;
  /** index of the furthest step reached (stored on the company) */
  furthest: number;
  children: ReactNode;
}) {
  const current = STEPS.findIndex((s) => s.id === step);
  const search = site ? `?site=${site.id}` : '';
  const scrolled = useScrolled();
  useDocumentTitle(pageTitle(org ? `Setup: ${STEPS[current].label}` : 'Set up your company', org?.name));

  const stateOf = (i: number, id: StepId): StepState => {
    if (i === current) return 'current';
    if (id === 'verify' && site && !site.verifiedAt && i <= furthest) return 'attention';
    if (i < furthest) return 'done';
    if (i === furthest) return 'reachable';
    return 'upcoming';
  };
  const linkable = (i: number, id: StepId) => !!org && i <= furthest && i !== current && (!SITE_STEPS.includes(id) || !!site);
  // the rail below a step is filled once the next step has been reached
  const railFilled = (i: number) => i < Math.max(furthest, current);

  return (
    <div className="min-h-dvh bg-page">
      <header
        className={cn(
          'sticky top-0 z-30 border-b bg-surface/90 backdrop-blur-md transition-[border-color,box-shadow] duration-200 ease-brand',
          scrolled ? 'border-line shadow-card' : 'border-line/70',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand to="/" />
          <div className="flex items-center gap-1.5">
            {org && site && (
              <>
                <ButtonLink to={paths.org(org.id)} variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Save and exit
                </ButtonLink>
                <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
              </>
            )}
            <ThemeMenu />
            <AccountMenu me={me} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-5 sm:px-6 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-12 lg:pt-12">
        <aside className="hidden lg:block" aria-label="Setup progress">
          <div className="sticky top-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{org ? 'Setting up' : 'Set up your workspace'}</p>
            {org && <p className="mt-1 truncate font-display text-base font-semibold tracking-[-0.01em] text-ink">{org.name}</p>}
            <ol className="mt-6">
              {STEPS.map((s, i) => {
                const st = stateOf(i, s.id);
                const inner = (
                  <>
                    <StepDot state={st} n={i + 1} />
                    <span className="min-w-0 pt-px">
                      <span
                        className={cn(
                          'block text-sm leading-5 transition-colors duration-150',
                          st === 'current' ? 'font-semibold text-ink' : st === 'upcoming' ? 'text-ink-3' : 'font-medium text-ink-2 group-hover:text-ink',
                        )}
                      >
                        {s.label}
                      </span>
                      <span className={cn('block truncate text-xs leading-4', st === 'attention' ? 'text-warning-text' : 'text-ink-3')}>
                        {st === 'attention' ? 'Not verified yet' : s.hint}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={s.id} className="relative pb-1 last:pb-0" aria-current={st === 'current' ? 'step' : undefined}>
                    {i < STEPS.length - 1 && (
                      <span
                        className={cn('absolute left-5 top-[36px] -bottom-1.5 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-300', railFilled(i) ? 'bg-accent' : 'bg-line-strong')}
                        aria-hidden
                      />
                    )}
                    {linkable(i, s.id) ? (
                      <Link
                        to={paths.onboarding(org!.id, s.id) + search}
                        className="group relative flex items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-brand hover:bg-surface-3/60"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className={cn('relative flex items-start gap-3 rounded-lg px-2 py-2', st === 'current' && 'bg-surface shadow-card ring-1 ring-line')}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-7 flex items-start gap-2.5 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
              <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              About five minutes. Your progress is saved after every step, so you can stop and come back.
            </p>
          </div>
        </aside>

        <div className="mb-5 lg:hidden">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-ink-2">
              <span className="font-semibold text-ink">
                Step {current + 1} of {STEPS.length}
              </span>{' '}
              · {STEPS[current].label}
            </p>
            {org && site && (
              <Link to={paths.org(org.id)} className="text-[13px] font-medium text-accent-text hover:underline">
                Save and exit
              </Link>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-7 gap-1" role="meter" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Setup progress">
            {STEPS.map((s, i) => {
              const st = stateOf(i, s.id);
              return (
                <span
                  key={s.id}
                  className={cn(
                    'h-1.5 rounded-full transition-colors duration-300',
                    st === 'current' || st === 'done' ? 'bg-accent' : st === 'attention' ? 'bg-warning' : st === 'reachable' ? 'bg-accent/35' : 'bg-line-strong',
                  )}
                />
              );
            })}
          </div>
        </div>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function StepDot({ state, n }: { state: StepState; n: number }) {
  const base = 'relative z-[1] mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular transition-[background-color,border-color,color,box-shadow] duration-200 ease-brand';
  if (state === 'done')
    return (
      <span className={cn(base, 'bg-accent text-accent-ink')}>
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Done:</span>
      </span>
    );
  if (state === 'attention')
    return (
      <span className={cn(base, 'border border-warning bg-warning-soft text-warning-text')}>
        <AlertTriangle className="size-3.5" aria-hidden />
        <span className="sr-only">Needs attention:</span>
      </span>
    );
  if (state === 'current') return <span className={cn(base, 'bg-accent text-accent-ink shadow-[0_0_0_4px_var(--accent-soft)]')}>{n}</span>;
  return (
    <span className={cn(base, 'border bg-surface', state === 'upcoming' ? 'border-line-strong text-ink-3' : 'border-accent text-accent-text group-hover:bg-accent-soft')}>{n}</span>
  );
}

export interface FooterAction {
  label: ReactNode;
  onClick?: () => void;
  /** submit this form id instead of onClick */
  form?: string;
  loading?: boolean;
  disabled?: boolean;
}

/** One step: heading, an optional "why we ask" note, the content and the Back / Skip / Continue bar. */
export function StepFrame({
  step,
  title,
  description,
  why,
  children,
  back,
  skip,
  primary,
  note,
}: {
  step: StepId;
  title: ReactNode;
  description?: ReactNode;
  why?: ReactNode;
  children: ReactNode;
  back?: () => void;
  skip?: FooterAction;
  primary?: FooterAction;
  /** a short line beside the buttons (e.g. what skipping means) */
  note?: ReactNode;
}) {
  const n = STEPS.findIndex((s) => s.id === step) + 1;
  return (
    <Card className="animate-fade-up overflow-visible">
      <div className="border-b border-line px-5 pb-6 pt-6 sm:px-9 sm:pb-7 sm:pt-8">
        {/* phones and tablets show the step count in the progress bar above the card */}
        <p className="mb-2 hidden text-xs font-semibold uppercase tracking-[0.08em] text-accent-text lg:block">
          Step {n} of {STEPS.length}
        </p>
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
        {why && (
          <div className="mt-5 flex max-w-2xl gap-3 rounded-lg border border-accent/15 bg-accent-soft px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-accent-text shadow-card" aria-hidden>
              <Lightbulb className="size-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">{why}</div>
          </div>
        )}
      </div>
      <div className="px-5 py-7 sm:px-9 sm:py-8">{children}</div>
      {(back || skip || primary || note) && (
        // the action bar stays in reach on long steps (from tablet width up); on phones it ends the card
        <div className="flex flex-col-reverse gap-3 rounded-b-xl border-t border-line bg-surface/95 px-5 py-4 backdrop-blur-md sm:sticky sm:bottom-0 sm:z-10 sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <div className="flex items-center gap-3">
            {back && (
              <Button variant="ghost" onClick={back} icon={<ArrowLeft className="size-4" />}>
                Back
              </Button>
            )}
            {note && <p className="text-[13px] leading-snug text-ink-3">{note}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {skip && (
              <Button variant="secondary" onClick={skip.onClick} form={skip.form} type={skip.form ? 'submit' : 'button'} loading={skip.loading} disabled={skip.disabled}>
                {skip.label}
              </Button>
            )}
            {primary && (
              <Button
                onClick={primary.onClick}
                form={primary.form}
                type={primary.form ? 'submit' : 'button'}
                loading={primary.loading}
                disabled={primary.disabled}
                className="group min-w-[140px]"
              >
                {primary.label}
                {!primary.loading && <ArrowRight className="size-4 transition-transform duration-150 ease-brand group-hover:translate-x-0.5" aria-hidden />}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Loading / message states inside the step area. */
export function StepMessage({ children }: { children: ReactNode }) {
  return <Card className="animate-fade-in px-5 py-10 sm:px-9">{children}</Card>;
}
