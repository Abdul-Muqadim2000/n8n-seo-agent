import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Square icon tile in brand blue tint (used by cards, menus and lists). */
export function IconTile({ icon: Icon, className, size = 'md' }: { icon: LucideIcon; className?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text transition-colors duration-200 ease-brand',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={1.75} />
    </span>
  );
}

/** Linked capability card: icon, title, one line, optional bullets; lifts on hover, border turns blue, the arrow nudges right. */
export function FeatureCard({
  to,
  icon,
  title,
  description,
  bullets,
  cta = 'Learn more',
  className,
  children,
}: {
  to: string;
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  bullets?: string[];
  cta?: string;
  className?: string;
  /** extra content (e.g. a small visual) under the text */
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex h-full flex-col rounded-xl border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-brand',
        'hover:-translate-y-0.5 hover:border-accent hover:shadow-raised focus-visible:border-accent sm:p-7',
        className,
      )}
    >
      <IconTile icon={icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
      <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{description}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2.5 text-sm leading-snug text-ink-2">
              <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
      {children}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-accent-text">
        {cta}
        <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
