import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Activity, AlarmClock, Building2, Globe, KeyRound, Lock, Play, Shield, Wallet } from 'lucide-react';
import { compactNumber, formatUsd, orgBudgetSchema, type AdminOrg, type DeliveryReport, type DeliveryWeek } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { CopyButton, Meter } from '@/components/ui/misc';
import { CountUp, InfoTip, MetricCard, Stagger } from '@/components/insight';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { SwitchRow } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useAdminDelivery, useAdminOrgs, useAdminUpdateOrg, useMe, usePost } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { SettingsCard } from './_components/SettingsCard';
import { StandaloneShell } from './_components/StandaloneShell';

const budgetForm = orgBudgetSchema.extend({
  monthlyBudgetUsd: z.number({ message: 'Enter an amount' }).min(0, 'At least 0').max(100000, 'At most 100,000'),
  disabled: z.boolean(),
});
type BudgetValues = z.input<typeof budgetForm>;

const usedPct = (o: AdminOrg) => (o.monthlyBudgetUsd > 0 ? (o.monthEstimatedUsd / o.monthlyBudgetUsd) * 100 : o.monthEstimatedUsd > 0 ? 100 : 0);

export default function PlatformAdminPage() {
  const me = useMe();
  const isAdmin = !!me.data?.platformAdmin;
  const orgs = useAdminOrgs(isAdmin);
  const [editing, setEditing] = useState<AdminOrg | null>(null);
  const [toggling, setToggling] = useState<AdminOrg | null>(null);

  const totals = useMemo(() => {
    const list = orgs.data ?? [];
    return {
      companies: list.length,
      disabled: list.filter((o) => o.disabled).length,
      sites: list.reduce((t, o) => t + o.sites, 0),
      runs: list.reduce((t, o) => t + o.monthRuns, 0),
      spend: list.reduce((t, o) => t + o.monthEstimatedUsd, 0),
    };
  }, [orgs.data]);

  if (!me.data) return <PageLoader fullPage />;
  if (!isAdmin)
    return (
      <StandaloneShell icon={<Shield />} title="Platform admin">
        <Card>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="You do not have access to this page"
            description="Platform administration is limited to the operators the server names in PLATFORM_ADMIN_EMAILS."
            action={<ButtonLink to="/">Go to the dashboard</ButtonLink>}
          />
        </Card>
      </StandaloneShell>
    );

  const columns: Column<AdminOrg>[] = [
    {
      key: 'name',
      header: 'Company',
      sortValue: (o) => o.name.toLowerCase(),
      cell: (o) => (
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
              o.disabled ? 'bg-surface-2 text-ink-3' : 'bg-ink-surface text-on-ink dark:bg-surface-3 dark:text-ink',
            )}
            aria-hidden
          >
            {o.name
              .split(/\s+/)
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase() || '?'}
          </span>
          <span className="block min-w-0">
            <span className="block truncate font-medium text-ink">{o.name}</span>
            <span className="block truncate text-xs text-ink-3">
              {o.slug} · since {fmtDate(o.createdAt)}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'members', header: 'Members', align: 'right', sortValue: (o) => o.members, cell: (o) => o.members, hideOnMobile: true },
    { key: 'sites', header: 'Websites', align: 'right', sortValue: (o) => o.sites, cell: (o) => o.sites, hideOnMobile: true },
    { key: 'monthRuns', header: 'Runs this month', align: 'right', sortValue: (o) => o.monthRuns, cell: (o) => compactNumber(o.monthRuns) },
    {
      key: 'spend',
      header: 'Spend vs budget',
      sortValue: usedPct,
      cell: (o) => {
        const pct = usedPct(o);
        return (
          <span className="block min-w-[150px]">
            <span className="block text-[13px] tabular text-ink">
              {formatUsd(o.monthEstimatedUsd)} <span className="text-ink-3">of {formatUsd(o.monthlyBudgetUsd, 0)}</span>
            </span>
            <Meter value={pct} tone={pct >= 100 ? 'critical' : pct >= 80 ? 'warning' : 'accent'} label={`${o.name}: ${Math.round(pct)}% of budget used`} className="mt-1" />
          </span>
        );
      },
    },
    {
      key: 'disabled',
      header: 'Status',
      sortValue: (o) => (o.disabled ? 1 : 0),
      cell: (o) => (o.disabled ? <StatusBadge tone="critical">Disabled</StatusBadge> : <StatusBadge tone="good">Active</StatusBadge>),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (o) => (
        <span className="inline-flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(o)} aria-label={`Edit budget of ${o.name}`}>
            Budget
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setToggling(o)}>
            {o.disabled ? 'Enable' : 'Disable'}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <StandaloneShell wide icon={<Shield />} title="Platform admin" description="Every company on this platform: team size, websites, this month’s analyses and spend against its budget.">
      {orgs.isPending ? (
        <div className="space-y-5" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : orgs.isError ? (
        <Card>
          <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} title="Could not load the companies" />
        </Card>
      ) : (
        <Stagger className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Companies"
              icon={<Building2 />}
              value={<CountUp value={totals.companies} format={compactNumber} />}
              meta={totals.disabled ? <StatusBadge tone="warning">{totals.disabled} disabled</StatusBadge> : <StatusBadge tone="good">All active</StatusBadge>}
            />
            <MetricCard label="Websites" icon={<Globe />} value={<CountUp value={totals.sites} format={compactNumber} />} />
            <MetricCard label="Analyses this month" icon={<Play />} value={<CountUp value={totals.runs} format={compactNumber} />} />
            <MetricCard
              label="Estimated spend this month"
              icon={<Wallet />}
              value={<CountUp value={totals.spend} format={(v) => formatUsd(v)} />}
              meta="Runs started from the app; scheduled monitoring is not included."
            />
          </div>
          <DataTable
            rows={orgs.data}
            columns={columns}
            rowKey={(o) => o.id}
            initialSort={{ key: 'spend', dir: 'desc' }}
            searchable
            searchPlaceholder="Search companies…"
            searchText={(o) => `${o.name} ${o.slug}`}
            empty="No companies yet."
          />
        </Stagger>
      )}

      <DeliveryCard enabled={isAdmin} />
      <ResetLinkCard />
      {editing && <BudgetDialog org={editing} onClose={() => setEditing(null)} />}
      {toggling && <ToggleDialog org={toggling} onClose={() => setToggling(null)} />}
    </StandaloneShell>
  );
}

function BudgetDialog({ org, onClose }: { org: AdminOrg; onClose: () => void }) {
  const update = useAdminUpdateOrg();
  const form = useForm<BudgetValues, unknown, z.output<typeof budgetForm>>({
    resolver: zodResolver(budgetForm),
    defaultValues: { monthlyBudgetUsd: org.monthlyBudgetUsd, disabled: org.disabled },
  });
  const submit = form.handleSubmit((v) =>
    update.mutate(
      { orgId: org.id, monthlyBudgetUsd: v.monthlyBudgetUsd, disabled: v.disabled },
      {
        onSuccess: () => {
          toast.success(`${org.name}: budget ${formatUsd(v.monthlyBudgetUsd)} per month${v.disabled !== org.disabled ? (v.disabled ? ', disabled' : ', enabled') : ''}`);
          onClose();
        },
      },
    ),
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Budget of ${org.name}`}
      description={`Used this month: ${formatUsd(org.monthEstimatedUsd)} in ${org.monthRuns} runs. Runs that would go over the budget are refused.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-budget-form" loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="admin-budget-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Monthly budget (USD)" error={form.formState.errors.monthlyBudgetUsd?.message}>
          {(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={100000} step={1} {...form.register('monthlyBudgetUsd', { valueAsNumber: true })} />}
        </Field>
        <Controller
          control={form.control}
          name="disabled"
          render={({ field }) => (
            <SwitchRow
              title="Disabled"
              description="A disabled company cannot start analyses. Its dashboards stay readable."
              checked={!!field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        {update.isError && <Callout tone="critical">{errorMessage(update.error)}</Callout>}
      </form>
    </Dialog>
  );
}

function ToggleDialog({ org, onClose }: { org: AdminOrg; onClose: () => void }) {
  const update = useAdminUpdateOrg();
  const disable = !org.disabled;
  const confirm = () =>
    update.mutate(
      { orgId: org.id, monthlyBudgetUsd: org.monthlyBudgetUsd, disabled: disable },
      {
        onSuccess: () => {
          toast.success(disable ? `${org.name} is disabled` : `${org.name} is enabled`);
          onClose();
        },
      },
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={disable ? `Disable ${org.name}?` : `Enable ${org.name}?`}
      description={
        disable
          ? 'Its members can no longer start analyses. Dashboards and reports stay readable, and nothing is deleted.'
          : 'Its members can start analyses again, within the monthly budget.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={disable ? 'danger' : 'primary'} onClick={confirm} loading={update.isPending}>
            {disable ? 'Disable company' : 'Enable company'}
          </Button>
        </>
      }
    >
      {update.isError && <Callout tone="critical">{errorMessage(update.error)}</Callout>}
    </Dialog>
  );
}

/** No e-mails on this platform: a forgotten password is reset with a link the platform admin creates and hands over. */
export function ResetLinkCard() {
  const [email, setEmail] = useState('');
  const create = usePost<{ email: string }, { url: string; expiresInHours: number; name: string }>('/api/admin/users/reset-link');
  return (
    <SettingsCard
      className="mt-6"
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
        <Field label="User’s e-mail" className="min-w-[240px] flex-1">
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

// G21 (2026-10-13, FIX_PLAN G21): runs delivered / runs started per week — for the runs the app starts and for the nine schedules —
// with the schedule fires that left no execution behind (D25a: a Mac-hosted stack misses a Monday whenever the machine sleeps) and the
// channel that carried each ops alert (R6). Internal only: this page is for operators, so it is not on the business site.
const ratePct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);
type RateTone = 'good' | 'warning' | 'critical' | 'neutral';
const rateTone = (v: number | null, target: number): RateTone => (v == null ? 'neutral' : v >= target ? 'good' : v >= target - 5 ? 'warning' : 'critical');

function RateCell({ value, target, of }: { value: number | null; target: number; of: string }) {
  if (value == null) return <span className="text-sm text-muted">not measured</span>;
  return (
    <span className="flex items-center gap-2">
      <StatusBadge tone={rateTone(value, target)}>{ratePct(value)}</StatusBadge>
      <span className="font-mono text-xs text-muted">{of}</span>
    </span>
  );
}

export function DeliveryCard({ enabled }: { enabled: boolean }) {
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
      cell: (w) => (w.missed.length ? <StatusBadge tone="critical">{w.missed.length}</StatusBadge> : <span className="text-sm text-muted">none</span>),
      sortValue: (w) => w.missed.length,
    },
    {
      key: 'other',
      header: 'Not delivered',
      align: 'right',
      hideOnMobile: true,
      cell: (w) => (
        <span className="font-mono text-xs text-muted">
          {w.onDemand.failed + w.scheduled.failed} failed · {w.onDemand.noReport} without a report · {w.onDemand.stuck} never finished
          {w.onDemand.inFlight ? ` · ${w.onDemand.inFlight} still running` : ''}
        </span>
      ),
      sortValue: (w) => w.onDemand.failed + w.scheduled.failed,
    },
  ];

  return (
    <SettingsCard
      className="mt-6"
      icon={<Activity />}
      title="Delivery rate"
      description="Of everything that should have run, how much reached the customer. A run counts as delivered only when it finished and at least one report arrived; a schedule counts only when the engine really ran it."
      info={
        <InfoTip label="How the delivery rate is measured">
          Runs started in the app come from this platform’s own run records. The scheduled side compares each automation’s own clock (
          {report?.timezone ?? 'the engine’s timezone'}) with the engine’s execution history: a fire with no execution within 90 minutes is a{' '}
          <strong>missed schedule</strong> — this stack runs on a Mac and misses a schedule whenever the machine sleeps through it. Runs still going are left out of
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
                meta={missedTotal ? 'A schedule fired no execution — see below.' : 'Every schedule fired.'}
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
                      <span className="font-mono text-xs text-muted">
                        {new Date(m.expectedAt).toLocaleString()} · {m.workflow}
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
