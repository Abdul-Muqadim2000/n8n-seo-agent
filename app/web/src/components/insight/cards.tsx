// Dashboard cards: metric card, summary hero (+ hero stat), insight row and action card. Clickable cards use one stretched link /
// button (the label) so info tips and buttons inside stay separately clickable, with the focus ring drawn on the whole card.
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconTile, type IconTileTone } from '@/components/ui/icon-tile';
import { CollapsePanel, DisclosureButton, InfoTip } from './disclosure';
import { SurfaceContext, useSurface } from './surface';

type Go = { onClick?: () => void; to?: string };

/**
 * The label of a clickable card: a link / button whose ::after covers the card (the `relative` card is the hit area). The overlay sits
 * at z-1 so positioned children painted later (CountUp, ScoreRing, a sparkline) do not punch holes in it; controls that must stay
 * separately clickable (InfoTip, an ActionCard's action) sit above it at z-2.
 */
function StretchedLabel({ onClick, to, children, className, describedBy }: Go & { children: ReactNode; className?: string; describedBy?: string }) {
  const cls = cn('min-w-0 text-left outline-none after:absolute after:inset-0 after:z-[1] focus-visible:shadow-none!', className);
  if (to)
    return (
      <Link to={to} className={cls} aria-describedby={describedBy}>
        {children}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} aria-describedby={describedBy}>
        {children}
      </button>
    );
  return <span className={cn('min-w-0', className)}>{children}</span>;
}

// whole-card states for a card with a stretched label: lift on hover, ring on keyboard focus, settle on press
const CLICK_CARD =
  'cursor-pointer transition-[box-shadow,border-color,translate,background-color] duration-200 ease-brand hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised has-[.card-link:active]:translate-y-0 has-[.card-link:focus-visible]:shadow-[var(--ring)]';

/**
 * MetricCard: one number that matters — icon tile, label (+ InfoTip for how it is measured), value, delta vs a named period,
 * optional sparkline, and a meta line with the facts behind it. `visual` (e.g. a ScoreRing) replaces the big value.
 * `onClick` / `to` make the whole card a link with a hover lift and an arrow.
 */
export function MetricCard({
  label,
  value,
  icon,
  tone = 'blue',
  delta,
  deltaLabel,
  sparkline,
  visual,
  info,
  meta,
  onClick,
  to,
  className,
}: {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  tone?: IconTileTone;
  delta?: ReactNode;
  /** the period the delta compares with, e.g. "vs last month" */
  deltaLabel?: ReactNode;
  sparkline?: ReactNode;
  visual?: ReactNode;
  info?: ReactNode;
  meta?: ReactNode;
  className?: string;
} & Go) {
  const clickable = !!(onClick || to);
  const vid = useId();
  return (
    <div className={cn('group/metric @container relative flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card', clickable && CLICK_CARD, className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <IconTile tone={tone} size="sm">
            {icon}
          </IconTile>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <StretchedLabel onClick={onClick} to={to} describedBy={vid} className="card-link text-[13px] leading-snug font-medium text-ink-2">
            {label}
          </StretchedLabel>
          {info && (
            <InfoTip label={`About ${label.toLowerCase()}`} className="z-[2]">
              {info}
            </InfoTip>
          )}
        </div>
        {clickable && <ArrowRight className="size-4 shrink-0 text-ink-3 transition-[translate,color] duration-200 ease-brand group-hover/metric:translate-x-0.5 group-hover/metric:text-accent-text" aria-hidden />}
      </div>
      <div className="mt-3 flex flex-col gap-3 @min-[15rem]:flex-row @min-[15rem]:items-end @min-[15rem]:justify-between">
        <div id={vid} className={cn('min-w-0', visual && 'flex flex-col items-start gap-2.5 @min-[12.5rem]:flex-row @min-[12.5rem]:items-center @min-[12.5rem]:gap-3')}>
          {visual ?? <div className="font-display text-[28px] leading-none font-semibold tracking-[-0.01em] text-ink">{value}</div>}
          {(delta || deltaLabel) && (
            <div className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 [&>span]:whitespace-nowrap', !visual && 'mt-2.5', visual && '@min-[12.5rem]:flex-col @min-[12.5rem]:items-start')}>
              {delta}
              {deltaLabel && <span className="text-xs text-ink-3">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {sparkline && <div className="h-9 w-full shrink-0 @min-[15rem]:h-11 @min-[15rem]:w-28">{sparkline}</div>}
      </div>
      {meta && (
        <div className="mt-auto pt-3">
          <div className="border-t border-line pt-2.5 text-xs leading-snug text-ink-3">{meta}</div>
        </div>
      )}
    </div>
  );
}

/**
 * SummaryHero: the page's one solid panel (ink by default, or Ascentra Blue) — eyebrow, a headline sentence that says how things
 * are, a supporting line, 2–4 HeroStats and the primary next step. Children switch to on-dark colours through the surface context.
 */
export function SummaryHero({
  tone = 'ink',
  eyebrow,
  title,
  description,
  aside,
  stats,
  actions,
  className,
}: {
  tone?: 'ink' | 'blue';
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** a visual on the right (ScoreRing) */
  aside?: ReactNode;
  /** 2–4 <HeroStat>s */
  stats?: ReactNode;
  /** primary next step (+ a secondary link) */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceContext.Provider value={tone}>
      <section className={cn('relative isolate overflow-hidden rounded-xl p-5 shadow-raised sm:p-6', tone === 'ink' ? 'bg-ink-surface text-on-ink ring-1 ring-line-on-ink' : 'bg-accent text-on-ink dark:bg-accent-soft dark:ring-1 dark:ring-line-on-ink', className)}>
        {/* the whole mark as a quiet watermark (brand: hero graphics / watermarks; never single rays) */}
        <img src="/brand/ascentra-mark-white.svg" alt="" aria-hidden className={cn('pointer-events-none absolute -top-24 -right-20 -z-10 w-[26rem] select-none', tone === 'ink' ? 'opacity-[0.045]' : 'opacity-[0.08]')} />
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 max-w-3xl">
            {eyebrow && <div className={cn('mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium', tone === 'ink' ? 'text-on-ink-2' : 'text-on-ink/90')}>{eyebrow}</div>}
            <h2 className="font-display text-xl leading-snug font-semibold tracking-[-0.01em] text-balance text-on-ink sm:text-[26px] sm:leading-tight">{title}</h2>
            {description && <p className={cn('mt-2 max-w-2xl text-sm leading-relaxed', tone === 'ink' ? 'text-on-ink-2' : 'text-on-ink/90')}>{description}</p>}
            {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {stats && <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{stats}</div>}
      </section>
    </SurfaceContext.Provider>
  );
}

/** HeroStat: one figure inside a SummaryHero (translucent tile; label, value, delta, optional sparkline and hint; clickable like a MetricCard). */
export function HeroStat({ label, value, delta, trend, hint, info, onClick, to, className }: { label: string; value: ReactNode; delta?: ReactNode; trend?: ReactNode; hint?: ReactNode; info?: ReactNode; className?: string } & Go) {
  const surface = useSurface();
  const clickable = !!(onClick || to);
  const vid = useId();
  // secondary text: white at 72% on ink; full white on blue (72% would fall under 4.5:1 on the lighter tile)
  const soft = surface === 'blue' ? 'text-on-ink' : 'text-on-ink-2';
  return (
    <div
      className={cn(
        'group/hs @container relative flex min-w-0 flex-col rounded-lg bg-on-ink/[0.06] p-3.5 ring-1 ring-line-on-ink',
        surface === 'blue' && 'bg-on-ink/10',
        clickable && 'cursor-pointer transition-[background-color,translate] duration-200 ease-brand hover:-translate-y-0.5 hover:bg-on-ink/[0.12] has-[.card-link:focus-visible]:shadow-[var(--ring)]',
        className,
      )}
    >
      <div className={cn('flex min-h-5 items-center gap-1', soft)}>
        <StretchedLabel onClick={onClick} to={to} describedBy={vid} className="card-link text-xs leading-snug font-medium">
          {label}
        </StretchedLabel>
        {info && (
          <InfoTip label={`About ${label.toLowerCase()}`} className="z-[2]">
            {info}
          </InfoTip>
        )}
        {clickable && <ArrowRight className="ml-auto size-3.5 shrink-0 transition-[translate,color] duration-200 ease-brand group-hover/hs:translate-x-0.5 group-hover/hs:text-on-ink" aria-hidden />}
      </div>
      <div id={vid} className="mt-2.5 flex flex-col gap-2 @min-[13rem]:flex-row @min-[13rem]:items-start @min-[13rem]:justify-between">
        <div className="min-w-0">
          <div className="font-display text-2xl leading-none font-semibold tracking-[-0.01em] text-on-ink">{value}</div>
          {delta && <div className="mt-2">{delta}</div>}
        </div>
        {/* sparklines inside the hero are drawn in the on-dark accent whatever colour they were given */}
        {trend && (
          <div
            className={cn(
              'h-8 w-full shrink-0 @min-[13rem]:h-10 @min-[13rem]:w-24 @min-[13rem]:self-end',
              surface === 'blue' ? '[&_.recharts-curve]:[stroke:var(--on-ink)] dark:[&_.recharts-curve]:[stroke:var(--accent-on-ink)]' : '[&_.recharts-curve]:[stroke:var(--accent-on-ink)]',
            )}
          >
            {trend}
          </div>
        )}
      </div>
      {hint && <div className={cn('mt-auto pt-2.5 text-xs leading-snug', soft)}>{hint}</div>}
    </div>
  );
}

/** HeroNextStep: the hero's "do this next" box (aside of a SummaryHero): small icon + eyebrow, one clamped title, the action(s). */
export function HeroNextStep({ icon, eyebrow = 'Next step', title, actions, className }: { icon?: ReactNode; eyebrow?: ReactNode; title: string; actions?: ReactNode; className?: string }) {
  const surface = useSurface();
  return (
    <div className={cn('w-full rounded-lg p-4 ring-1 ring-line-on-ink md:w-[340px]', surface === 'blue' ? 'bg-on-ink/10' : 'bg-on-ink/[0.06]', className)}>
      <div className={cn('flex items-center gap-2 text-xs font-medium', surface === 'blue' ? 'text-on-ink' : 'text-on-ink-2')}>
        {icon && (
          <IconTile tone="on-dark" size="xs">
            {icon}
          </IconTile>
        )}
        {eyebrow}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-on-ink" title={title}>
        {title}
      </p>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>}
    </div>
  );
}

/** HeroLink: a quiet text link with an arrow inside a SummaryHero (on-dark colours; the arrow nudges on hover). */
export function HeroLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const surface = useSurface();
  return (
    <Link
      to={to}
      className={cn(
        'group/hl inline-flex items-center gap-1 rounded-md text-[13px] font-medium underline-offset-4 transition-colors duration-150 ease-brand hover:underline',
        surface === 'ink' ? 'text-accent-on-ink decoration-accent-on-ink/50' : surface === 'blue' ? 'text-on-ink decoration-on-ink/60' : 'text-accent-text decoration-accent-text/40',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5 shrink-0 transition-transform duration-200 ease-brand group-hover/hl:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const ITEM_ICON: Partial<Record<IconTileTone, ReactNode>> = {
  good: <CheckCircle2 />,
  warning: <TriangleAlert />,
  serious: <TriangleAlert />,
  critical: <OctagonAlert />,
};

/**
 * InsightItem: one finding / recommendation / alert as a list row — tone-coloured icon tile, meta chips (priority, category), title,
 * one line, the action, and an optional expandable detail. Render inside a `<ul className="divide-y divide-line">`.
 */
export function InsightItem({
  tone = 'blue',
  icon,
  title,
  titleAttr,
  description,
  meta,
  action,
  detail,
  detailLabel = 'Details',
  clampTitle,
  actionPosition = 'below',
  className,
}: {
  tone?: IconTileTone;
  icon?: ReactNode;
  title: ReactNode;
  /** full title on hover when the title is clamped */
  titleAttr?: string;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  detail?: ReactNode;
  detailLabel?: ReactNode;
  clampTitle?: boolean;
  /** `side`: the action sits to the right from `md` up (full-width lists); `below`: under the text (narrow cards) */
  actionPosition?: 'below' | 'side';
  className?: string;
}) {
  const side = actionPosition === 'side';
  const [open, setOpen] = useState(false);
  const did = useId();
  return (
    <li className={cn('flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 ease-brand hover:bg-surface-2/50', className)}>
      <IconTile tone={tone} size="sm" className="mt-0.5">
        {icon ?? ITEM_ICON[tone] ?? <Info />}
      </IconTile>
      <div className={cn('min-w-0 flex-1', side && 'md:flex md:items-center md:gap-6')}>
        <div className="min-w-0 flex-1">
          {meta && <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">{meta}</div>}
          <p className={cn('text-sm font-medium leading-snug text-ink', clampTitle && 'line-clamp-2')} title={titleAttr}>
            {title}
          </p>
          {(description || detail) && (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs leading-snug">
              {description && <div className="min-w-0 text-ink-3">{description}</div>}
              {detail && <DisclosureButton open={open} onToggle={() => setOpen(!open)} controls={did} label={detailLabel} openLabel="Hide" />}
            </div>
          )}
          {detail && (
            <CollapsePanel open={open} id={did}>
              <div className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">{detail}</div>
            </CollapsePanel>
          )}
        </div>
        {action && <div className={cn('mt-2.5 flex flex-wrap items-center gap-2', side && 'md:mt-0 md:shrink-0 md:justify-end')}>{action}</div>}
      </div>
    </li>
  );
}

/**
 * ActionCard: a standalone card for "do this next" / "go here" — icon tile, title, one line, optional meta and action. With `to` /
 * `onClick` the whole card is the link (hover lift, arrow nudges); an `action` button stays separately clickable.
 */
export function ActionCard({ icon, tone = 'blue', title, description, meta, action, onClick, to, className }: { icon: ReactNode; tone?: IconTileTone; title: string; description?: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string } & Go) {
  const clickable = !!(onClick || to);
  return (
    <div className={cn('group/ac relative flex items-start gap-3.5 rounded-xl border border-line bg-surface p-4 shadow-card', clickable && CLICK_CARD, className)}>
      <IconTile tone={tone} size="md">
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        {meta && <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">{meta}</div>}
        <StretchedLabel onClick={onClick} to={to} className="card-link block text-sm leading-snug font-semibold text-ink">
          {title}
        </StretchedLabel>
        {description && <div className="mt-1 text-[13px] leading-snug text-ink-2">{description}</div>}
        {action && <div className="relative z-[2] mt-3 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {clickable && <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition-[translate,color] duration-200 ease-brand group-hover/ac:translate-x-0.5 group-hover/ac:text-accent-text" aria-hidden />}
    </div>
  );
}
