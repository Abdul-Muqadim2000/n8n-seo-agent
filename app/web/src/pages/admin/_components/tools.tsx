// The two operator tools kept from the first admin page (2026-10-13): the delivery rate (G21) and the password reset link (no app e-mails).
import { useMemo, useState } from 'react';
import { Activity, AlarmClock, KeyRound } from 'lucide-react';
import { compactNumber, type DeliveryReport, type DeliveryWeek } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { CountUp, InfoTip, MetricCard } from '@/components/insight';
import { DataTable, type Column } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { useAdminDelivery, usePost } from '@/lib/queries';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { SettingsCard } from '@/pages/settings/_components/SettingsCard';

/** No e-mails on this platform: a forgotten password is reset with a link the platform admin creates and hands over. */
export function ResetLinkCard({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const create = usePost<{ email: string }, { url: string; expiresInHours: number; name: string }>('/api/admin/users/reset-link');
  return (
    <SettingsCard
      className={className}
      icon={<KeyRound />}
      title="Password reset link"
      description="The platform sends no e-mails. For a user who forgot their password, create a one-time link here and send it to them yourself (it works for 24 hours)."
    >
      <form
        className="flex flex-wrap items-end gap-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ email: email.trim().toLowerCase() });
        }}
      >
        <Field label="User's e-mail" className="min-w-[240px] flex-1">
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />}
        </Field>
        <Button type="submit" variant="secondary" loading={create.isPending} disabled={!email.includes('@')}>
          Create link
        </Button>
      </form>
      {create.isError && (
        <div className="px-5 pb-4">
          <Callout tone="critical">{errorMessage(create.error)}</Callout>
        </div>
      )}
      {create.data && (
        <div className="space-y-2 border-t border-line px-5 py-4">
          <p className="text-sm text-ink">Reset link for {create.data.name}, valid {create.data.expiresInHours} hours:</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">{create.data.url}</code>
            <CopyButton text={create.data.url} />
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

// G21 (2026-10-13, FIX_PLAN G21): runs delivered / runs started per week, for the runs the app starts and for the nine schedules,
// with the schedule fires that left no execution behind (D25a: a Mac-hosted stack misses a Monday whenever the machine sleeps) and the
// channel that carried each ops alert (R6). Internal only: this page is for operators, so it is not on the business site.
const ratePct = (v: number | null) => (v == null ? 'unmeasured' : `${v.toFixed(1)}%`);   // R106: null is "not measured", never 0% or a dash
type RateTone = 'good' | 'warning' | 'critical' | 'neutral';
const rateTone = (v: number | null, target: number): RateTone => (v == null ? 'neutral' : v >= target ? 'good' : v >= target - 5 ? 'warning' : 'critical');

function RateCell({ value, target, of }: { value: number | null; target: number; of: string }) {
  if (value == null) return <span className="text-sm text-ink-3">unmeasured</span>;
  return (
    <span className="flex items-center gap-2">
      <StatusBadge tone={rateTone(value, target)}>{ratePct(value)}</StatusBadge>
      <span className="font-mono text-xs text-ink-3">{of}</span>
    </span>
  );
}

export function DeliveryCard({ enabled, className }: { enabled: boolean; className?: string }) {
  const q = useAdminDelivery(enabled);
  const report: DeliveryReport | undefined = q.data;
  const target = report?.targetPct ?? 99;
  const weeks = useMemo(() => (report ? [...report.weeks].reverse() : []), [report]);
  const latest = weeks[0];
  const missed = useMemo(() => weeks.flatMap((w) => w.missed.map((m) => ({ ...m, week: w.week }))).slice(0, 12), [weeks]);
  const missedTotal = report ? report.weeks.reduce((t, w) => t + w.missed.length, 0) : 0;

  const columns: Column<DeliveryWeek>[] = [
    { key: 'week', header: 'Week of', cell: (w) => <span className="font-mono text-xs">{fmtDate(w.week)}</span>, sortValue: (w) => w.week },
    {
      key: 'overall',
      header: 'Delivered',
      cell: (w) => <RateCell value={w.overallPct} target={target} of={`${w.onDemand.delivered + w.scheduled.delivered}/${w.onDemand.settled + w.scheduled.settled}`} />,
      sortValue: (w) => w.overallPct ?? -1,
    },
    {
      key: 'ondemand',
      header: 'Started in the app',
      hideOnMobile: true,
      cell: (w) => <RateCell value={w.onDemand.ratePct} target={target} of={`${w.onDemand.delivered}/${w.onDemand.settled}`} />,
      sortValue: (w) => w.onDemand.ratePct ?? -1,
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      hideOnMobile: true,
      cell: (w) => <RateCell value={w.scheduled.ratePct} target={target} of={`${w.scheduled.delivered}/${w.scheduled.started}`} />,
      sortValue: (w) => w.scheduled.ratePct ?? -1,
    },
    {
      key: 'missed',
      header: 'Missed schedules',
      align: 'right',
      cell: (w) => (w.missed.length ? <StatusBadge tone="critical">{w.missed.length}</StatusBadge> : <span className="text-sm text-ink-3">none</span>),
      sortValue: (w) => w.missed.length,
    },
    {
      key: 'other',
      header: 'Not delivered',
      align: 'right',
      hideOnMobile: true,
      cell: (w) => (
        <span className="font-mono text-xs text-ink-3">
          {w.onDemand.failed + w.scheduled.failed} failed · {w.onDemand.noReport} without a report · {w.onDemand.stuck} never finished
          {w.onDemand.inFlight ? ` · ${w.onDemand.inFlight} still running` : ''}
        </span>
      ),
      sortValue: (w) => w.onDemand.failed + w.scheduled.failed,
    },
  ];

  return (
    <SettingsCard
      className={className}
      icon={<Activity />}
      title="Delivery rate"
      description="Of everything that should have run, how much reached the customer. A run counts as delivered only when it finished and at least one report arrived; a schedule counts only when the engine really ran it."
      info={
        <InfoTip label="How the delivery rate is measured">
          Runs started in the app come from this platform's own run records. The scheduled side compares each automation's own clock (
          {report?.timezone ?? 'the engine\'s timezone'}) with the engine's execution history: a fire with no execution within 90 minutes is a{' '}
          <strong>missed schedule</strong>: this stack runs on a Mac and misses a schedule whenever the machine sleeps through it. Runs still going are left out of
          the rate rather than counted against it; runs that never finished are counted against it.
        </InfoTip>
      }
    >
      <div className="space-y-5 px-5 py-4">
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not measure delivery" />
        ) : !report ? (
          <EmptyState icon={<Activity className="size-5" />} title="Nothing to measure yet" description="No run and no scheduled execution has happened in the last weeks." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="This week"
                icon={<Activity />}
                value={ratePct(latest?.overallPct ?? null)}
                meta={<StatusBadge tone={rateTone(latest?.overallPct ?? null, target)}>target {target}%</StatusBadge>}
              />
              <MetricCard
                label="Missed schedules, last 6 weeks"
                icon={<AlarmClock />}
                value={<CountUp value={missedTotal} format={compactNumber} />}
                meta={missedTotal ? 'A schedule fired no execution (see below).' : 'Every schedule fired.'}
              />
              <MetricCard
                label="Alerts delivered"
                icon={<AlarmClock />}
                value={ratePct(report.alerts.ratePct)}
                meta={
                  report.alerts.total
                    ? `${report.alerts.delivered} of ${report.alerts.total} alert(s)${
                        Object.keys(report.alerts.byChannel).length
                          ? ` · ${Object.entries(report.alerts.byChannel)
                              .map(([c, n]) => `${c} ${n}`)
                              .join(', ')}`
                          : ''
                      }${report.alerts.pending ? ` · ${report.alerts.pending} never sent` : ''}`
                    : 'No ops alert has been recorded yet.'
                }
              />
            </div>
            <DataTable rows={weeks} columns={columns} rowKey={(w) => w.week} initialSort={{ key: 'week', dir: 'desc' }} empty="No week to show yet." />
            {!!missed.length && (
              <div className="rounded-lg border border-line">
                <p className="border-b border-line px-4 py-2 text-sm font-medium">Schedules that should have run and left no execution behind</p>
                <ul className="divide-y divide-line">
                  {missed.map((m) => (
                    <li key={`${m.workflow}-${m.expectedAt}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                      <span>{m.title}</span>
                      <span className="font-mono text-xs text-ink-3">
                        {fmtDateTime(m.expectedAt)} · {m.workflow}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!report.notes.length && (
              <Callout tone="warning">
                <ul className="list-inside list-disc space-y-1">
                  {report.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Callout>
            )}
          </>
        )}
      </div>
    </SettingsCard>
  );
}
