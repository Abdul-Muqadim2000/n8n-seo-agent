// Small building blocks for the product mockups (drawn in code, sample data only).
import { useRef, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Circle, CircleCheck, Clock, OctagonAlert, PenLine, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInView } from '../Reveal';

/** Wraps a mockup: adds `is-drawn` once it is in view, which starts the CSS draw-in (lines, dots, rows). */
export function Drawn({ className, children, label }: { className?: string; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { threshold: 0.25 });
  return (
    <div ref={ref} role="img" aria-label={label} className={cn('text-left', seen && 'is-drawn', className)}>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

/** A card inside a mockup */
export function MockCard({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface', className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
          <span className="text-[12px] font-semibold text-ink">{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

type Tone = 'good' | 'warning' | 'critical' | 'accent' | 'neutral';
const toneCls: Record<Tone, string> = {
  good: 'bg-good-soft text-good-text',
  warning: 'bg-warning-soft text-warning-text',
  critical: 'bg-critical-soft text-critical-text',
  accent: 'bg-accent-soft text-accent-text',
  neutral: 'bg-surface-2 text-ink-2',
};
const toneIcon: Record<Tone, LucideIcon> = { good: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, accent: PenLine, neutral: Circle };

/** Status pill: always an icon + a label (never colour alone) */
export function MockBadge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: LucideIcon | null; children: ReactNode; className?: string }) {
  const Icon = icon === null ? null : (icon ?? toneIcon[tone]);
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[10.5px] font-medium', toneCls[tone], className)}>
      {Icon && <Icon className="size-3" strokeWidth={2.25} />}
      {children}
    </span>
  );
}

/** ↑ 18.4% in good / ↓ in critical, with the arrow as the non-colour signal */
export function MockDelta({ value, suffix = '%', good = true }: { value: string; suffix?: string; good?: boolean }) {
  const up = !value.startsWith('-');
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-mono text-[11px] font-medium tabular', good ? 'text-good-text' : 'text-critical-text')}>
      <Icon className="size-3" strokeWidth={2.5} />
      {value.replace('-', '')}
      {suffix}
    </span>
  );
}

export const PendingIcon = Clock;

/** Faux text line (skeleton-like, static) */
export function MockLine({ w = '100%', className }: { w?: string; className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-surface-3', className)} style={{ width: w }} />;
}
