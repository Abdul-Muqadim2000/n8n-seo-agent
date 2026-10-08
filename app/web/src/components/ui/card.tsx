import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * White surface, radius 14, card shadow. `interactive` (or an onClick, or hover styles passed in className) lifts the card to
 * the raised shadow on hover.
 */
export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  const lifts = interactive ?? (!!rest.onClick || /(^|\s)hover:/.test(className ?? ''));
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface shadow-card',
        lifts && 'transition-[box-shadow,border-color,background-color,translate] duration-200 ease-brand hover:border-line-strong hover:shadow-raised',
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, description, actions, className, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-line px-5 py-3', className)} {...rest} />;
}

/** A labelled section of a settings or form page: title + description on the left, content on the right (stacks on mobile). */
export function Section({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-4 border-b border-line py-6 last:border-b-0 md:grid-cols-[minmax(0,260px)_1fr] md:gap-8', className)}>
      <div>
        <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
