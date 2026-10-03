import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-ink-3', className)} role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ?? <span className="sr-only">Loading</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} aria-hidden />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

const calloutTone = {
  info: { cls: 'bg-accent-soft border-transparent text-ink', icon: <Info className="size-4 text-accent-text" aria-hidden /> },
  good: { cls: 'bg-good-soft border-transparent text-ink', icon: <CheckCircle2 className="size-4 text-good-text" aria-hidden /> },
  warning: { cls: 'bg-warning-soft border-transparent text-ink', icon: <AlertTriangle className="size-4 text-warning-text" aria-hidden /> },
  critical: { cls: 'bg-critical-soft border-transparent text-ink', icon: <AlertOctagon className="size-4 text-critical-text" aria-hidden /> },
} as const;

export function Callout({ tone = 'info', title, children, action, className }: { tone?: keyof typeof calloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const t = calloutTone[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3', t.cls, className)} role={tone === 'critical' ? 'alert' : undefined}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <EmptyState
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
