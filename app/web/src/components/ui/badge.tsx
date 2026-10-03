import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Circle, Clock, Info, Loader2, XCircle } from 'lucide-react';
import type { RunStatus } from '@seo/shared';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'accent' | 'good' | 'warning' | 'serious' | 'critical';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent-text border-transparent',
  good: 'bg-good-soft text-good-text border-transparent',
  warning: 'bg-warning-soft text-warning-text border-transparent',
  serious: 'bg-serious-soft text-serious-text border-transparent',
  critical: 'bg-critical-soft text-critical-text border-transparent',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs font-medium', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Status colours never carry meaning alone: every status badge has an icon and a label. */
const STATUS_ICON: Record<Tone, ReactNode> = {
  neutral: <Circle className="size-3" aria-hidden />,
  accent: <Info className="size-3" aria-hidden />,
  good: <CheckCircle2 className="size-3" aria-hidden />,
  warning: <AlertTriangle className="size-3" aria-hidden />,
  serious: <AlertTriangle className="size-3" aria-hidden />,
  critical: <AlertOctagon className="size-3" aria-hidden />,
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge tone={tone} icon={STATUS_ICON[tone]} className={className}>
      {children}
    </Badge>
  );
}

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const map: Record<RunStatus, { tone: Tone; label: string; icon: ReactNode }> = {
    submitting: { tone: 'neutral', label: 'Submitting', icon: <Loader2 className="size-3 animate-spin" aria-hidden /> },
    accepted: { tone: 'accent', label: 'Queued', icon: <Clock className="size-3" aria-hidden /> },
    running: { tone: 'accent', label: 'Running', icon: <Loader2 className="size-3 animate-spin" aria-hidden /> },
    completed: { tone: 'good', label: 'Completed', icon: <CheckCircle2 className="size-3" aria-hidden /> },
    failed: { tone: 'critical', label: 'Failed', icon: <XCircle className="size-3" aria-hidden /> },
  };
  const s = map[status] ?? map.accepted;
  return (
    <Badge tone={s.tone} icon={s.icon} className={className}>
      {s.label}
    </Badge>
  );
}

export function severityTone(sev: string | null | undefined): Tone {
  const s = String(sev ?? '').toLowerCase();
  if (s.startsWith('crit')) return 'critical';
  if (s.startsWith('high') || s.startsWith('serious')) return 'serious';
  if (s.startsWith('med') || s.startsWith('warn')) return 'warning';
  if (s.startsWith('low') || s.startsWith('info')) return 'neutral';
  return 'neutral';
}

export function verdictTone(v: string | null | undefined): Tone {
  const s = String(v ?? '').toUpperCase();
  if (s === 'GO') return 'good';
  if (s.startsWith('GO_WITH') || s.startsWith('GO WITH')) return 'warning';
  if (s === 'AVOID') return 'critical';
  return 'neutral';
}
