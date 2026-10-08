import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-ink-3', className)} role="status">
      <Loader2 className="size-4 animate-spin text-accent-text" aria-hidden />
      {label ?? <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Full-area loader: the Ascentra mark (blue on light, white on dark) breathing gently; fades in after 150ms so quick loads never flash. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] animate-fade-in flex-col items-center justify-center gap-4 [animation-delay:150ms]" role="status">
      <span className="block w-12 animate-pulse" aria-hidden>
        <img src="/brand/ascentra-mark-blue.svg" alt="" width={48} height={42} className="block h-auto w-full dark:hidden" />
        <img src="/brand/ascentra-mark-white.svg" alt="" width={48} height={42} className="hidden h-auto w-full dark:block" />
      </span>
      <span className="text-sm text-ink-3">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg bg-surface-2 bg-[image:var(--shimmer)] bg-[length:200%_100%]', className)} aria-hidden />;
}

const emptyTone = {
  accent: 'bg-accent-soft text-accent-text',
  neutral: 'bg-surface-2 text-ink-3',
  critical: 'bg-critical-soft text-critical-text',
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = 'accent',
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** colour of the icon tile; `critical` for errors */
  tone?: keyof typeof emptyTone;
}) {
  return (
    <div className={cn('flex animate-fade-in flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className={cn('mb-4 flex size-11 items-center justify-center rounded-xl', emptyTone[tone])}>{icon}</div>}
      <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

const calloutTone = {
  info: { cls: 'bg-accent-soft border-accent-text/20 text-ink', icon: <Info className="size-4 text-accent-text" aria-hidden /> },
  good: { cls: 'bg-good-soft border-good-text/20 text-ink', icon: <CheckCircle2 className="size-4 text-good-text" aria-hidden /> },
  warning: { cls: 'bg-warning-soft border-warning-text/20 text-ink', icon: <AlertTriangle className="size-4 text-warning-text" aria-hidden /> },
  critical: { cls: 'bg-critical-soft border-critical-text/20 text-ink', icon: <AlertOctagon className="size-4 text-critical-text" aria-hidden /> },
} as const;

export function Callout({ tone = 'info', title, children, action, className }: { tone?: keyof typeof calloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const t = calloutTone[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3', t.cls, className)} role={tone === 'critical' ? 'alert' : undefined}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      {/* the action sits under the text on phones, beside it from sm up */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          {title && <p className="font-medium text-ink">{title}</p>}
          {children && <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <EmptyState
      tone="critical"
      icon={<AlertTriangle className="size-5" />}
      title={title}
      description={errorMessage(error)}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="size-4" />}>
            Try again
          </Button>
        )
      }
    />
  );
}
