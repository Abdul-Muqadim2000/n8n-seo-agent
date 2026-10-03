// Building blocks shared by the site dashboard pages (layout, loading gates, filters, small badges).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { Bot, ChevronDown, CircleCheck, CircleMinus, CircleX, FileSearch, Gauge, Link2, ListChecks, PenSquare, Search, TrendingUp, Wrench } from 'lucide-react';
import { MODES, type ModeId, type Priority } from '@seo/shared';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/tabs';

/** The company, the website and links scoped to it. */
export function useSitePage() {
  const { org, can, role } = useOrgCtx();
  const { site } = useSiteCtx();
  return {
    org,
    site,
    can,
    role,
    /** tool form for this website, optionally pre-filled (camelCase fields of the mode's schema) */
    tool: (mode: ModeId, prefill?: Record<string, unknown>) => paths.tool(org.id, mode, { siteId: site.id, prefill }),
    /** a page of this website, e.g. "settings/tracking" */
    page: (p: string) => paths.site(org.id, site.id, p),
  };
}

/** First load → skeleton; failed with nothing to show → error with retry; otherwise the content (old data is kept on refetch). */
export function DataGate<T>({ q, skeleton, children }: { q: UseQueryResult<T, unknown>; skeleton?: ReactNode; children: (data: T) => ReactNode }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <>{skeleton ?? <PageSkeleton />}</>;
}

export function PageSkeleton({ tiles = 4, charts = 2, table = true }: { tiles?: number; charts?: number; table?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', tiles >= 4 && 'xl:grid-cols-4')}>
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl" />
        ))}
      </div>
      <div className={cn('grid grid-cols-1 gap-4', charts > 1 && 'lg:grid-cols-2')}>
        {Array.from({ length: charts }, (_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-xl" />
        ))}
      </div>
      {table && <Skeleton className="h-[260px] rounded-xl" />}
    </div>
  );
}

/** A responsive row of stat tiles (one column on phones: tiles carry sparklines). */
export function KpiGrid({ children, cols = 4, dense, className }: { children: ReactNode; cols?: 3 | 4 | 5; /** two tiles per row on phones (tiles without sparklines) */ dense?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2',
        dense && 'grid-cols-2',
        cols === 3 && 'lg:grid-cols-3',
        cols === 4 && 'xl:grid-cols-4',
        cols === 5 && 'lg:grid-cols-3 2xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Gives a chart the height of its (grid-stretched) card: the chart grows with the row instead of leaving a blank band. */
export function FillHeight({ min = 240, children }: { min?: number; children: (height: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.max(min, Math.floor(entries[0].contentRect.height));
      setH((cur) => (Math.abs(cur - next) > 2 ? next : cur));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return (
    <div ref={ref} className="relative h-full" style={{ minHeight: min }}>
      <div className="absolute inset-0">{children(h)}</div>
    </div>
  );
}

/** Chart metric picker: a segmented control from `sm` up, a compact native select on phones (chart headers do not wrap). */
export function MetricSwitch<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <>
      <Segmented size="sm" value={value} onChange={onChange} options={options} className="hidden sm:inline-flex" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-7 max-w-[9rem] rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none sm:hidden"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

/** Text only screen readers get; `relative` keeps it inside scroll containers (an absolutely positioned sr-only box in a table cell would widen the page). */
export function SrOnly({ children }: { children: ReactNode }) {
  return (
    <span className="relative">
      <span className="sr-only">{children}</span>
    </span>
  );
}

/** A titled block of a dashboard page. */
export function SectionHeading({ title, description, actions, id }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3" id={id}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Pill filters with counts (a radio group). */
export function FilterChips<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
              active ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
            {o.count != null && <span className={cn('tabular text-xs', active ? 'text-accent-text' : 'text-ink-3')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A short list of neutral chips with "+N". */
export function Chips({ items, max = 4, className, empty = '–' }: { items: readonly string[]; max?: number; className?: string; empty?: ReactNode }) {
  if (!items.length) return <span className="text-ink-3">{empty}</span>;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {shown.map((t) => (
        <span key={t} className="inline-flex h-5 max-w-[16rem] items-center truncate rounded-md bg-surface-2 px-1.5 text-xs text-ink-2" title={t}>
          {t}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex h-5 items-center rounded-md px-1 text-xs text-ink-3" title={items.slice(max).join(', ')}>
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Yes / no / unknown with an icon and a word (never colour alone). */
export function YesNo({ value, yes = 'Yes', no = 'No', unknown = 'Unknown', goodWhen = true }: { value: boolean | null | undefined; yes?: string; no?: string; unknown?: string; goodWhen?: boolean }) {
  if (value == null)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-3">
        <CircleMinus className="size-3.5" aria-hidden />
        {unknown}
      </span>
    );
  const good = value === goodWhen;
  const Icon = good ? CircleCheck : CircleX;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-good-text' : 'text-critical-text')}>
      <Icon className="size-3.5" aria-hidden />
      {value ? yes : no}
    </span>
  );
}

/** Label + value used inside cards. */
export function MiniStat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs leading-snug text-ink-3">{hint}</div>}
    </div>
  );
}

const PRIORITY: Record<Priority, { tone: 'serious' | 'warning' | 'neutral'; label: string }> = {
  high: { tone: 'serious', label: 'High priority' },
  medium: { tone: 'warning', label: 'Medium' },
  low: { tone: 'neutral', label: 'Low' },
};

export function PriorityBadge({ priority, short }: { priority: Priority; short?: boolean }) {
  const p = PRIORITY[priority] ?? PRIORITY.low;
  return <StatusBadge tone={p.tone}>{short ? titleOf(priority) : p.label}</StatusBadge>;
}
const titleOf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Engine priorities are numbers (1 = do first). */
export const priorityFromNumber = (n: number): Priority => (n <= 1 ? 'high' : n === 2 ? 'medium' : 'low');

/** A card with a header row and a body; `flush` drops the body padding (tables, lists). */
export function Panel({ title, description, actions, children, footer, className, flush, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; flush?: boolean; icon?: ReactNode }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-1', flush ? 'pt-3' : 'px-5 pb-5 pt-3')}>{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 text-[13px] text-ink-3">{footer}</div>}
    </Card>
  );
}

/** "View all →" style link for card footers. */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13px] font-medium text-accent-text underline-offset-4 hover:underline">
      {children} →
    </Link>
  );
}

/** Header button: the analyses that make sense for one website. */
export function RunAnalysisMenu({ label = 'Run an analysis', variant = 'primary' }: { label?: string; variant?: 'primary' | 'secondary' }) {
  const { org, can, tool } = useSitePage();
  const navigate = useNavigate();
  if (!can('member')) return null;
  const items: { mode: ModeId; icon: ReactNode }[] = [
    { mode: 'keyword', icon: <PenSquare className="size-4" /> },
    { mode: 'ladder', icon: <TrendingUp className="size-4" /> },
    { mode: 'verdict', icon: <Search className="size-4" /> },
    { mode: 'audit', icon: <Gauge className="size-4" /> },
    { mode: 'ai_visibility', icon: <Bot className="size-4" /> },
    { mode: 'backlinks', icon: <Link2 className="size-4" /> },
    { mode: 'published', icon: <FileSearch className="size-4" /> },
    { mode: 'checkin', icon: <ListChecks className="size-4" /> },
  ];
  return (
    <Menu
      className="w-[260px]"
      trigger={
        <Button variant={variant} icon={<Wrench className="size-4" />}>
          {label}
          <ChevronDown className="size-4 opacity-80" aria-hidden />
        </Button>
      }
    >
      <MenuLabel>For this website</MenuLabel>
      {items.map((it) => (
        <MenuItem key={it.mode} icon={it.icon} onSelect={() => navigate(tool(it.mode))}>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="truncate">{MODES[it.mode].title}</span>
            <span className="shrink-0 text-xs tabular text-ink-3">{MODES[it.mode].costUsd ? `~$${MODES[it.mode].costUsd.toFixed(2)}` : 'free'}</span>
          </span>
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={<Wrench className="size-4" />} onSelect={() => navigate(paths.tools(org.id))}>
        All analyses
      </MenuItem>
    </Menu>
  );
}

/** A primary link to one tool for this website (hidden for viewers). */
export function ToolButton({ mode, prefill, children, variant = 'secondary', size = 'md', icon }: { mode: ModeId; prefill?: Record<string, unknown>; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'link'; size?: 'sm' | 'md'; icon?: ReactNode }) {
  const { can, tool } = useSitePage();
  if (!can('member')) return null;
  return (
    <ButtonLink to={tool(mode, prefill)} variant={variant} size={size} icon={icon}>
      {children}
    </ButtonLink>
  );
}

/** Small neutral pill for kinds / types / sources. */
export function Kind({ children, className }: { children: ReactNode; className?: string }) {
  return <Badge className={cn('h-5 px-1.5 font-normal', className)}>{children}</Badge>;
}
