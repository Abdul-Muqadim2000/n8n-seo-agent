import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Lightbulb, LogOut, User } from 'lucide-react';
import type { Me, Org, Site } from '@seo/shared';
import { Brand } from '@/components/layout/Brand';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Meter } from '@/components/ui/misc';
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
        <button type="button" className="rounded-full p-0.5 hover:bg-surface-2" aria-label="Your account">
          <Avatar name={me.user.name} src={me.user.avatarUrl} size={30} />
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

  const stateOf = (i: number, id: StepId): StepState => {
    if (i === current) return 'current';
    if (id === 'verify' && site && !site.verifiedAt && i <= furthest) return 'attention';
    if (i < furthest) return 'done';
    if (i === furthest) return 'reachable';
    return 'upcoming';
  };
  const linkable = (i: number, id: StepId) => !!org && i <= furthest && i !== current && (!SITE_STEPS.includes(id) || !!site);

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand to="/" />
          <div className="flex items-center gap-1.5">
            {org && site && (
              <ButtonLink to={paths.org(org.id)} variant="ghost" size="sm" className="hidden sm:inline-flex">
                Save and exit
              </ButtonLink>
            )}
            <ThemeMenu />
            <AccountMenu me={me} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10 lg:pt-10">
        <aside className="hidden lg:block" aria-label="Setup progress">
          <div className="sticky top-24">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{org ? 'Setting up' : 'Set up your workspace'}</p>
            {org && <p className="mt-0.5 truncate text-sm font-semibold text-ink">{org.name}</p>}
            <ol className="mt-5 space-y-1">
              {STEPS.map((s, i) => {
                const st = stateOf(i, s.id);
                const inner = (
                  <>
                    <StepDot state={st} n={i + 1} />
                    <span className="min-w-0">
                      <span className={cn('block text-sm', st === 'current' ? 'font-semibold text-ink' : st === 'upcoming' ? 'text-ink-3' : 'text-ink-2')}>{s.label}</span>
                      <span className="block truncate text-xs text-ink-3">{st === 'attention' ? 'Not verified yet' : s.hint}</span>
                    </span>
                  </>
                );
                return (
                  <li key={s.id} aria-current={st === 'current' ? 'step' : undefined}>
                    {linkable(i, s.id) ? (
                      <Link to={paths.onboarding(org!.id, s.id) + search} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                        {inner}
                      </Link>
                    ) : (
                      <div className={cn('flex items-start gap-3 rounded-lg px-2 py-2', st === 'current' && 'bg-surface-2')}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
              <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              About five minutes. Your progress is saved after every step, so you can stop and come back.
            </p>
          </div>
        </aside>

        <div className="mb-5 lg:hidden">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">
              Step {current + 1} of {STEPS.length} · {STEPS[current].label}
            </p>
            {org && site && (
              <Link to={paths.org(org.id)} className="text-[13px] font-medium text-accent-text hover:underline">
                Save and exit
              </Link>
            )}
          </div>
          <Meter value={((current + 1) / STEPS.length) * 100} label="Setup progress" className="mt-2" />
        </div>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function StepDot({ state, n }: { state: StepState; n: number }) {
  const base = 'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular';
  if (state === 'done')
    return (
      <span className={cn(base, 'bg-accent text-accent-ink')}>
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only">Done:</span>
      </span>
    );
  if (state === 'attention')
    return (
      <span className={cn(base, 'bg-warning-soft text-warning-text')}>
        <AlertTriangle className="size-3.5" aria-hidden />
        <span className="sr-only">Needs attention:</span>
      </span>
    );
  if (state === 'current') return <span className={cn(base, 'border-2 border-accent bg-surface text-accent-text')}>{n}</span>;
  return <span className={cn(base, 'border border-line-strong bg-surface', state === 'upcoming' ? 'text-ink-3' : 'text-ink-2')}>{n}</span>;
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
    <Card>
      <div className="border-b border-line px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-[13px] font-medium text-accent-text">
          Step {n} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>}
        {why && (
          <div className="mt-4 flex max-w-2xl gap-2.5 rounded-xl bg-accent-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
            <div>{why}</div>
          </div>
        )}
      </div>
      <div className="px-5 py-6 sm:px-8">{children}</div>
      {(back || skip || primary || note) && (
        <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
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
              <Button onClick={primary.onClick} form={primary.form} type={primary.form ? 'submit' : 'button'} loading={primary.loading} disabled={primary.disabled}>
                {primary.label}
                {!primary.loading && <ArrowRight className="size-4" aria-hidden />}
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
  return <Card className="px-5 py-10 sm:px-8">{children}</Card>;
}
