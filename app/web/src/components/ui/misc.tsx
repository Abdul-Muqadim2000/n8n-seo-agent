import { useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Copy, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconTile } from './icon-tile';

/** Page title row: optional eyebrow, H1, one-line purpose and the page actions; `icon` adds a solid blue icon tile before the title. */
export function PageHeader({ title, description, actions, eyebrow, className, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className={cn('min-w-0', icon && 'flex items-start gap-3.5 sm:gap-4')}>
        {icon && (
          <IconTile tone="solid" size="lg" className="mt-0.5">
            {icon}
          </IconTile>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-ink-3">{eyebrow}</div>}
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Delta: signed change with an arrow; the colour follows direction x whether up is good (positions: down is good).
 * Never colour alone: arrow + sign + text.
 */
export function Delta({ value, suffix = '%', upIsGood = true, digits = 1, label, className }: { value: number | null | undefined; suffix?: string; upIsGood?: boolean; digits?: number; label?: string; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn('text-xs text-ink-3', className)}>{label ? `– ${label}` : '–'}</span>;
  const flat = Math.abs(value) < Math.pow(10, -digits) / 2;
  const good = flat ? null : value > 0 === upIsGood;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium tabular', good == null ? 'text-ink-3' : good ? 'text-good-text' : 'text-critical-text', className)}>
      <span className={cn('inline-flex h-5 items-center gap-0.5 rounded-md pl-1 pr-1.5', good == null ? 'bg-surface-2' : good ? 'bg-good-soft' : 'bg-critical-soft')}>
        <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        {value > 0 ? '+' : ''}
        {value.toFixed(digits)}
        {suffix}
      </span>
      {label && <span className="font-normal text-ink-3">{label}</span>}
    </span>
  );
}

/** Stat tile: label, value (proportional figures), optional delta vs a named period, optional sparkline. */
export function StatTile({ label, value, delta, hint, trend, icon, className, onClick }: { label: ReactNode; value: ReactNode; delta?: ReactNode; hint?: ReactNode; trend?: ReactNode; icon?: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-card',
        onClick && 'transition-[box-shadow,border-color,translate] duration-200 ease-brand hover:-translate-y-px hover:border-line-strong hover:shadow-raised active:translate-y-0 active:shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-3">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight font-semibold tracking-[-0.01em] text-ink tabular">{value}</div>
          {delta && <div className="mt-1">{delta}</div>}
        </div>
        {trend && <div className="h-10 w-24 shrink-0">{trend}</div>}
      </div>
      {hint && <div className="mt-2 text-xs leading-snug text-ink-3">{hint}</div>}
    </Comp>
  );
}

/** Meter: the fill carries severity; the track is a lighter step. `value` 0-100. */
export function Meter({ value, tone = 'accent', label, className }: { value: number; tone?: 'accent' | 'good' | 'warning' | 'critical'; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const fill = { accent: 'bg-accent', good: 'bg-good', warning: 'bg-warning', critical: 'bg-critical' }[tone];
  const track = { accent: 'bg-accent-soft', good: 'bg-good-soft', warning: 'bg-warning-soft', critical: 'bg-critical-soft' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full', track, className)} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-brand', fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function scoreTone(score: number | null | undefined): 'good' | 'warning' | 'critical' | 'accent' {
  if (score == null) return 'accent';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'critical';
}

export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the text is visible next to the button */
        }
      }}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium shadow-card transition-[color,background-color,border-color,translate] duration-150 ease-brand active:translate-y-px',
        done ? 'border-good-text/30 bg-good-soft text-good-text' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {done ? <Check key="done" className="size-3.5 animate-scale-in" aria-hidden /> : <Copy key="copy" className="size-3.5" aria-hidden />}
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  );
}

export function Avatar({ name, src, size = 28, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return src ? (
    <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-display font-semibold tracking-[0.02em] text-accent-text ring-1 ring-accent-text/15 select-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

/** "label: value" rows for detail panels. */
export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(0,max-content)_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{it.label}</dt>
          <dd className="min-w-0 break-words text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-accent-text [overflow-wrap:anywhere] decoration-accent-text/40 underline-offset-2 transition-colors duration-150 hover:underline hover:decoration-accent-text', className)}
    >
      {children ?? href}
    </a>
  );
}
