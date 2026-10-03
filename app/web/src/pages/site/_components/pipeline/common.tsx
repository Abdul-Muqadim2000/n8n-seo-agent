// Building blocks of the Pipeline page and the keyword-ladder page: time formats, status chips (always icon + word), the
// segmented page-progress bar, position changes in words.
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Gauge,
  Hand,
  Hourglass,
  Inbox,
  Link2,
  ListOrdered,
  Minus,
  PauseCircle,
  PenLine,
  PenSquare,
  RotateCw,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { PAGE_TYPE_VALUES, type AutomationId, type LadderCard, type LadderMode, type LadderPageState, type LadderStatus, type PageType, type PlanType, type RankPoint } from '@seo/shared';
import { Badge, type Tone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sortByDate } from '../format';
import { OFF_CHART, plotPos } from '../positions';

export const AUTO_ICON: Record<AutomationId, ReactNode> = {
  ai_visibility: <Bot className="size-4" />,
  backlinks: <Link2 className="size-4" />,
  rank_tracker: <Activity className="size-4" />,
  site_tracker: <TrendingUp className="size-4" />,
  content_cadence: <PenSquare className="size-4" />,
  audit: <Gauge className="size-4" />,
};

// ---------- time, in the viewer's own time zone ----------
const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o);
/** "Mon 5 Oct, 17:00" */
export const fmtWhen = (iso: string) => dtf({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** "Monday 5 October" */
export const fmtDayHead = (iso: string) => dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
/** "Mon 5 Oct" */
export const fmtShortDay = (iso: string) => dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
/** "17:00" */
export const fmtTime = (iso: string) => dtf({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const inDays = (iso: string) => {
  const d = Math.round((Date.parse(iso) - Date.now()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
};
export const validDate = (iso: string | null | undefined): iso is string => !!iso && Number.isFinite(Date.parse(iso));

/** The engine's page type text ("Guide-style Service Page (…)") as one of the form's page types. */
export function asPageType(t: string): PageType {
  if ((PAGE_TYPE_VALUES as readonly string[]).includes(t)) return t as PageType;
  if (/pillar|hub/i.test(t)) return 'Pillar Page';
  if (/local/i.test(t)) return 'Local Page';
  if (/blog/i.test(t)) return 'Blog Post';
  if (/guide/i.test(t)) return 'Guide';
  if (/landing/i.test(t)) return 'Landing Page';
  if (/product/i.test(t)) return 'Product Page';
  return 'Service Page';
}

// ---------- ladder status, mode, plan ----------
export const LADDER_STATUS: Record<LadderStatus, { label: string; tone: Tone; icon: ReactNode; hint: string }> = {
  planning: { label: 'Planning', tone: 'neutral', icon: <ListOrdered className="size-3" aria-hidden />, hint: 'The plan is ready; no page written yet.' },
  writing: { label: 'Writing', tone: 'accent', icon: <PenLine className="size-3" aria-hidden />, hint: 'Pages are being written; none is live yet.' },
  climbing: { label: 'Climbing', tone: 'accent', icon: <TrendingUp className="size-3" aria-hidden />, hint: 'Pages are live and moving up on Google.' },
  won: { label: 'Won', tone: 'good', icon: <Trophy className="size-3" aria-hidden />, hint: 'The main keyword has been in the top 3 for four weekly checks.' },
  paused: { label: 'Paused', tone: 'neutral', icon: <PauseCircle className="size-3" aria-hidden />, hint: 'No new pages; positions are still checked.' },
  queued: { label: 'Queued', tone: 'neutral', icon: <Clock className="size-3" aria-hidden />, hint: 'Starts when one of the active ladders is done or paused.' },
  stuck: { label: 'Stuck', tone: 'serious', icon: <AlertTriangle className="size-3" aria-hidden />, hint: 'No live page has improved for 8 weeks.' },
  needs_you: { label: 'Needs you', tone: 'warning', icon: <Hand className="size-3" aria-hidden />, hint: 'Something only you can do is holding it up.' },
};

export function LadderStatusBadge({ status, className }: { status: LadderStatus; className?: string }) {
  const s = LADDER_STATUS[status] ?? { label: String(status || 'Unknown'), tone: 'neutral' as Tone, icon: <Circle className="size-3" aria-hidden />, hint: '' };
  return (
    <span title={s.hint} className="inline-flex">
      <Badge tone={s.tone} icon={s.icon} className={className}>
        {s.label}
      </Badge>
    </span>
  );
}

export function ModeChip({ mode, className }: { mode: LadderMode; className?: string }) {
  const auto = mode !== 'manual';
  return (
    <span title={auto ? 'Auto: the system does the next step itself' : 'Manual: the system prepares each step and waits for your click'} className="inline-flex">
      <Badge icon={auto ? <Zap className="size-3" aria-hidden /> : <Hand className="size-3" aria-hidden />} className={className}>
        {auto ? 'Auto' : 'Manual'}
      </Badge>
    </span>
  );
}

export const PLAN_LABEL: Record<PlanType, string> = { direct: 'Direct', short: 'Short ladder', full: 'Full ladder' };
export const PLAN_HINT: Record<PlanType, string> = {
  direct: 'the main page first, a few supporting pages link to it',
  short: 'a few supporting pages, then the main page',
  full: 'rung by rung from easy to hard, the main page last',
};

/** "9-12" → "9–12 months" */
export const monthsText = (m: string | null | undefined) => (m ? `${m.replace('-', '–')} months` : '');

export const rungLabel = (rung: number) => (rung >= 4 ? 'Main page' : `Rung ${rung}`);

// ---------- page states ----------
export const PAGE_STATE: Record<LadderPageState, { label: string; tone: Tone; icon: ReactNode }> = {
  published: { label: 'Live', tone: 'good', icon: <CheckCircle2 className="size-3" aria-hidden /> },
  waiting: { label: 'Written, publish it', tone: 'warning', icon: <Inbox className="size-3" aria-hidden /> },
  writing: { label: 'Being written', tone: 'accent', icon: <RotateCw className="size-3" aria-hidden /> },
  planned: { label: 'Planned', tone: 'neutral', icon: <Circle className="size-3" aria-hidden /> },
  gated: { label: 'Waits for support', tone: 'neutral', icon: <Hourglass className="size-3" aria-hidden /> },
};

export function PageStateBadge({ state, className }: { state: LadderPageState; className?: string }) {
  const s = PAGE_STATE[state] ?? PAGE_STATE.planned;
  return (
    <Badge tone={s.tone} icon={s.icon} className={className}>
      {s.label}
    </Badge>
  );
}

// ---------- positions ----------
/** Sparkline rows of a position history (oldest first); empty when no check ranked in the top 50 (a flat floor line says nothing). */
export function sparkRows(history: readonly RankPoint[] | null | undefined): { p: number | null }[] {
  const rows = sortByDate(history ?? [], (h) => h.checkedAt).map((h) => ({ p: plotPos(h.position) }));
  return rows.length > 1 && rows.some((r) => r.p != null && r.p < OFF_CHART) ? rows : [];
}

/** A Google position in words: null = never checked, 0 = not in the top 50, -1 = the check failed. */
export function positionWords(p: number | null | undefined): string {
  if (p == null) return 'Not checked yet';
  if (p < 0) return 'Check failed';
  if (p === 0) return 'Not in the top 50';
  return `#${Number.isInteger(p) ? p : p.toFixed(1)}`;
}

/** Positive = moved up. Arrow + words ("up 3"), never colour alone. */
export function PositionChange({ change, className }: { change: number | null | undefined; className?: string }) {
  if (change == null || !Number.isFinite(change)) return null;
  const n = Math.abs(change);
  const places = Number.isInteger(n) ? String(n) : n.toFixed(1);
  if (n < 0.05)
    return (
      <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-ink-3', className)}>
        <Minus className="size-3.5" aria-hidden />
        no change
      </span>
    );
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium tabular', up ? 'text-good-text' : 'text-critical-text', className)}>
      <Icon className="size-3.5" aria-hidden />
      {up ? 'up' : 'down'} {places}
    </span>
  );
}

// ---------- page progress: published / waiting / being written / planned ----------
// An ordered progression, so one hue from dark (done) to light (started), and the neutral track for what is still planned.
const SEGMENTS: { key: 'published' | 'waiting' | 'writing' | 'planned'; label: string; color: string }[] = [
  { key: 'published', label: 'Published', color: 'var(--seq-6)' },
  { key: 'waiting', label: 'Written, waiting', color: 'var(--seq-4)' },
  { key: 'writing', label: 'Being written', color: 'var(--seq-2)' },
  { key: 'planned', label: 'Planned', color: 'var(--surface-3)' },
];

export function LadderProgress({ counts, className, legend = true }: { counts: LadderCard['counts']; className?: string; legend?: boolean }) {
  const known = counts.published + counts.waiting + counts.writing + counts.planned;
  const total = Math.max(counts.total || 0, known);
  // pages not in any bucket (e.g. waiting for support) count as planned
  const values = { ...counts, planned: counts.planned + Math.max(0, total - known) };
  const label = `${counts.published} of ${total} pages published, ${counts.waiting} written and waiting, ${counts.writing} being written, ${values.planned} planned`;
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={label}>
        {total === 0 ? (
          <span className="h-full w-full bg-surface-3" />
        ) : (
          SEGMENTS.filter((s) => values[s.key] > 0).map((s) => <span key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: values[s.key], flexBasis: 0, background: s.color }} />)
        )}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
          {SEGMENTS.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color, boxShadow: s.key === 'planned' ? 'inset 0 0 0 1px var(--line-strong)' : undefined }} />
              {s.label}
              <span className="font-medium tabular text-ink">{values[s.key]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
