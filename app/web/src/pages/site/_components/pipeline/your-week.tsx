// The website's own weekly cycle (SCHEDULING_KEYWORDS_PLAN.md §4): the weekday it runs on (changeable by admins), when the next one
// runs, and the jobs of the current cycle in their order, with what was skipped and why, and what gave up after its attempts.
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, CircleDashed, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { WEEKDAY_NAMES, type CycleJobView, type SiteCycleView } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { useSetCycleWeekday, useSiteCycle } from '@/lib/queries';
import { cn, fmtAgo } from '@/lib/utils';
import { Panel } from '../kit';
import { fmtDayHead, fmtWhen, inDays, validDate } from './common';
import { cycleDayWords } from './coming-up';

const JOB_STATE: Record<CycleJobView['status'], { label: string; icon: ReactNode; tone: string }> = {
  waiting: { label: 'Waiting', icon: <Circle className="size-3.5" aria-hidden />, tone: 'text-ink-3' },
  starting: { label: 'Starting', icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, tone: 'text-accent-text' },
  running: { label: 'Running', icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, tone: 'text-accent-text' },
  done: { label: 'Done', icon: <CheckCircle2 className="size-3.5" aria-hidden />, tone: 'text-good-text' },
  skipped: { label: 'Skipped', icon: <MinusCircle className="size-3.5" aria-hidden />, tone: 'text-ink-3' },
  refused: { label: 'Not run', icon: <MinusCircle className="size-3.5" aria-hidden />, tone: 'text-warning-text' },
  failed: { label: 'Failed, trying again', icon: <AlertTriangle className="size-3.5" aria-hidden />, tone: 'text-warning-text' },
  gave_up: { label: 'Did not run', icon: <XCircle className="size-3.5" aria-hidden />, tone: 'text-critical-text' },
};

export function YourWeek({ cycle: fromPage, compact }: { cycle: SiteCycleView | undefined; compact?: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  // the cycle's own read knows the person's role (whether they may move the weekday); the page's copy is shown until it arrives
  const q = useSiteCycle(org.id, site.id, !!site.verifiedAt);
  const cycle = q.data ?? fromPage;
  if (!cycle) return null;
  const name = cycle.weekdayName ?? (cycle.weekday != null ? WEEKDAY_NAMES[cycle.weekday] : null);
  const current = cycle.current;
  return (
    <Panel
      icon={<CalendarDays />}
      title={name ? `Your week starts on ${name}` : 'Your week'}
      description={
        cycle.status === 'not_started'
          ? `Your weekly run starts the day tracking starts for ${site.domain}, then repeats every 7 days on that weekday.`
          : `Every ${name ?? 'week'} at ${cycle.localTime || '06:00'} (${cycle.timezone}) the weekly run checks your website and writes the pages for your keyword, one step after the other.`
      }
      actions={cycle.status === 'paused' ? <StatusBadge tone="warning">Paused</StatusBadge> : cycle.overdue ? <StatusBadge tone="warning">Late</StatusBadge> : undefined}
    >
      <div className="space-y-4">
        <dl className="grid gap-2 rounded-lg bg-surface-2/60 px-3 py-2.5 text-[13px] sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-ink-3">Next weekly run</dt>
            <dd className="mt-0.5 text-ink">{validDate(cycle.nextDueAt) ? `${fmtWhen(cycle.nextDueAt)} · ${inDays(cycle.nextDueAt)}` : cycle.status === 'paused' ? 'Paused' : 'Not scheduled yet'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-3">Coming up plan</dt>
            <dd className="mt-0.5 text-ink">{validDate(cycle.nextPreviewAt) ? fmtDayHead(cycle.nextPreviewAt) : 'Two days before each run'}</dd>
          </div>
          {cycle.monthlyDay != null && (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs text-ink-3">Monthly checks</dt>
              <dd className="mt-0.5 text-ink">In the first weekly run on or after day {cycle.monthlyDay} of each month (full AI check, full backlink report, technical audit)</dd>
            </div>
          )}
        </dl>
        {cycle.overdue && <p className="flex items-start gap-1.5 text-[13px] text-warning-text"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />Your weekly run is late. It runs as soon as the system is back; missed weeks never pile up.</p>}
        {cycle.canChangeWeekday && cycle.status !== 'not_started' && <WeekdayControl cycle={cycle} />}
        {!compact && current && (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">
              {current.cycle0 ? 'Your first run' : `The run of ${cycleDayWords(current.date)}`}
              {current.monthly && <Badge className="ml-2">Monthly</Badge>}
            </p>
            <ol className="space-y-1.5">
              {current.jobs.map((j, i) => (
                <JobRow key={j.job} j={j} n={i + 1} />
              ))}
            </ol>
          </div>
        )}
        {!compact && cycle.recent.some((c) => c.jobs.some((j) => j.status === 'gave_up')) && (
          <p className="flex items-start gap-1.5 text-[13px] text-ink-2">
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-critical-text" aria-hidden />
            {cycle.recent
              .flatMap((c) => c.jobs.filter((j) => j.status === 'gave_up').map((j) => `${j.label} did not run in the week of ${cycleDayWords(c.date)}${j.reason ? ` (${j.reason})` : ''}`))
              .slice(0, 3)
              .join('; ')}
            . The next weekly run tries again.
          </p>
        )}
      </div>
    </Panel>
  );
}

function JobRow({ j, n }: { j: CycleJobView; n: number }) {
  const s = JOB_STATE[j.status] ?? { label: j.status, icon: <CircleDashed className="size-3.5" aria-hidden />, tone: 'text-ink-3' };
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 text-[13px]">
      <span className="pt-px text-right font-mono text-xs tabular text-ink-3">{n}</span>
      <div className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn('font-medium', j.status === 'skipped' ? 'text-ink-3' : 'text-ink')}>{j.label}</span>
          <span className={cn('inline-flex items-center gap-1 text-xs', s.tone)}>
            {s.icon}
            {s.label}
          </span>
          {j.finishedAt && validDate(j.finishedAt) && <span className="text-xs text-ink-3">{fmtAgo(j.finishedAt)}</span>}
        </span>
        {j.reason && <p className="text-xs leading-snug text-ink-3">{j.reason}</p>}
      </div>
    </li>
  );
}

function WeekdayControl({ cycle }: { cycle: SiteCycleView }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const set = useSetCycleWeekday(org.id, site.id);
  const [value, setValue] = useState(String(cycle.weekday ?? 1));
  const changed = Number(value) !== cycle.weekday;
  const save = () =>
    set.mutate(Number(value), {
      onSuccess: (r) =>
        toast.success(`Your week now starts on ${r.weekdayName}`, {
          description: r.nextDueAt && validDate(r.nextDueAt) ? `The next weekly run is ${fmtWhen(r.nextDueAt)}. Two runs are always at least 3 days apart.` : 'Two runs are always at least 3 days apart.',
        }),
      onError: (e) =>
        toast.error(
          e instanceof ApiRequestError && e.code === 'cycle_not_started' ? 'Your weekly run has not started yet' : 'The weekday was not changed',
          { description: e instanceof ApiRequestError && e.code === 'cycle_not_started' ? 'You can move it once the first weekly run has started.' : errorMessage(e) },
        ),
    });
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="Move your week to" hint="The next run moves to this weekday, at least 3 days after the last one started." className="sm:w-64">
        {(p) => (
          <Select {...p} value={value} onChange={(e) => setValue(e.target.value)}>
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button size="sm" variant="secondary" loading={set.isPending} disabled={!changed} onClick={save} className="sm:mb-6">
        Change weekday
      </Button>
    </div>
  );
}
