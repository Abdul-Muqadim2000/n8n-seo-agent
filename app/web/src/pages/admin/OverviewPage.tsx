import { Link } from 'react-router';
import { AlertTriangle, Building2, CheckCircle2, Coins, LayoutDashboard, Play, TrendingUp, Users, Wallet } from 'lucide-react';
import type { AdminCompanyRow } from '@seo/shared';
import { CountUp, MetricCard, Stagger } from '@/components/insight';
import { Card } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { type Column } from '@/components/ui/table';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { useAdminOverview } from '@/lib/queries';
import { useAdminPeriod } from './AdminLayout';
import { AdminCard, AdminPageHeader, CompanyStatus, CostSplitCell, DailyCostChart, EstimatedTip, FlushTable, MarginValue, Money, Num, ProviderBillCard, RowTile, SplitLine } from './_components/kit';
import { adminPaths, credits, estimatedShare, marginPct, money, PERIOD_LABELS, withPeriod } from './lib';

export function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[118px]" />
        ))}
      </div>
      <Skeleton className="h-[360px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [period] = useAdminPeriod();
  const q = useAdminOverview(period);
  const o = q.data;

  const top: Column<AdminCompanyRow>[] = [
    {
      key: 'name',
      header: 'Company',
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <Link to={withPeriod(adminPaths.company(r.id), period)} className="flex min-w-0 items-center gap-3 rounded-md hover:text-accent-text">
          <RowTile name={r.name} muted={r.disabled} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.name}</span>
            <span className="block truncate font-mono text-[11px] text-ink-3">{r.runs} runs · {r.members} members</span>
          </span>
        </Link>
      ),
    },
    { key: 'cost', header: 'Cost to us', align: 'right', sortValue: (r) => r.money.cost.totalUsd, cell: (r) => <CostSplitCell cost={r.money.cost} /> },
    { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.money.revenueUsd, cell: (r) => <Money value={r.money.revenueUsd} />, hideOnMobile: true },
    { key: 'margin', header: 'Margin', align: 'right', sortValue: (r) => r.money.marginUsd, cell: (r) => <MarginValue marginUsd={r.money.marginUsd} pct={r.money.marginPct} revenueUsd={r.money.revenueUsd} /> },
    { key: 'credits', header: 'Credits left', align: 'right', sortValue: (r) => r.credits.balance, cell: (r) => <Num>{credits(r.credits.balance)}</Num>, hideOnMobile: true },
    { key: 'status', header: 'Status', cell: (r) => <CompanyStatus row={r} />, hideOnMobile: true },
  ];

  return (
    <>
      <AdminPageHeader
        icon={<LayoutDashboard />}
        title="Overview"
        description={o ? `${PERIOD_LABELS[period]}${o.from ? ` · ${fmtDate(o.from)} – ${fmtDate(o.to)}` : ` · up to ${fmtDate(o.to)}`} · UTC` : PERIOD_LABELS[period]}
      />
      {q.isPending ? (
        <OverviewSkeleton />
      ) : q.isError || !o ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the overview" />
        </Card>
      ) : (
        <Stagger className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              label="Revenue"
              icon={<TrendingUp />}
              value={<CountUp value={o.money.revenueUsd} format={(v) => money(v, { digits: 2 })} />}
              info="Payments recorded when credits were granted. There is no card billing yet."
              meta={<SplitLine items={[{ label: 'list value', value: money(o.money.listValueUsd, { digits: 2 }) }]} />}
            />
            <MetricCard
              label="Cost to us"
              icon={<Wallet />}
              value={<CountUp value={o.money.cost.totalUsd} format={(v) => money(v, { digits: 2 })} />}
              info={
                <>
                  What customers’ runs cost at Claude and DataForSEO, attributed run by run. {money(o.money.cost.claudeEstimatedUsd)} of the Claude part is estimated (
                  {Math.round((estimatedShare(o.money.cost) ?? 0) * 100)}%).
                </>
              }
              meta={
                <SplitLine
                  items={[
                    { label: 'Claude', value: money(o.money.cost.claudeUsd) },
                    { label: 'DataForSEO', value: money(o.money.cost.dataforseoUsd) },
                  ]}
                />
              }
            />
            <MetricCard
              label="Margin"
              icon={<Coins />}
              tone={o.money.marginUsd < 0 ? 'critical' : 'blue'}
              value={<CountUp value={o.money.marginUsd} format={(v) => money(v, { digits: 2 })} />}
              info="Revenue minus cost to us, for this period."
              meta={o.money.marginPct == null ? 'No revenue in this period' : <SplitLine items={[{ label: 'margin', value: marginPct(o.money.marginPct) }]} />}
            />
            <MetricCard
              label="Credits outstanding"
              icon={<Coins />}
              value={<CountUp value={o.credits.outstanding} format={credits} />}
              info="The sum of every company’s balance now: credits granted and not yet used."
              meta={
                <SplitLine
                  items={[
                    { label: 'granted', value: credits(o.credits.grantedInPeriod) },
                    { label: 'used', value: credits(o.credits.usedInPeriod) },
                  ]}
                />
              }
            />
            <MetricCard
              label="Active users"
              icon={<Users />}
              value={<CountUp value={o.users.activeInPeriod} format={(v) => Math.round(v).toLocaleString('en-US')} />}
              meta={
                <SplitLine
                  items={[
                    { label: 'of', value: o.users.total.toLocaleString('en-US') },
                    { label: 'new', value: o.users.newInPeriod },
                    ...(o.users.suspended ? [{ label: 'suspended', value: o.users.suspended }] : []),
                  ]}
                />
              }
            />
            <MetricCard
              label="Runs"
              icon={<Play />}
              tone={o.runs.failed ? 'warning' : 'blue'}
              value={<CountUp value={o.runs.started} format={(v) => Math.round(v).toLocaleString('en-US')} />}
              to={withPeriod(adminPaths.runs, period)}
              meta={
                <SplitLine
                  items={[
                    { label: 'failed', value: o.runs.failed },
                    { label: 'running', value: o.runs.inFlight },
                  ]}
                />
              }
            />
          </div>

          <DailyCostChart daily={o.daily} loading={q.isPlaceholderData} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {o.bills.map((b) => (
              <ProviderBillCard key={b.provider} bill={b} attributedSplit={b.provider === 'anthropic' ? { estimatedUsd: o.money.cost.claudeEstimatedUsd } : undefined} />
            ))}
            <Card className="flex min-w-0 flex-col p-4 md:col-span-2 xl:col-span-1">
              <span className="text-[13px] font-medium text-ink-2">Not tied to a company</span>
              <span className="mt-3 font-display text-xl font-semibold text-ink">{money(o.unattributed.totalUsd)}</span>
              <span className="mt-1 font-mono text-[11px] text-ink-3">
                Claude {money(o.unattributed.claudeUsd)} · DataForSEO {money(o.unattributed.dataforseoUsd)}
              </span>
              <p className="mt-auto border-t border-line pt-2.5 text-xs leading-snug text-ink-3">
                Engine spend on deleted websites, test runs and the engine’s own checks. Counted in “attributed” on the provider cards, not in any company’s cost.
              </p>
            </Card>
          </div>

          <AdminCard
            title="Top companies by cost"
            description={`${PERIOD_LABELS[period]}: what each company’s runs cost us and what it paid.`}
            info={<EstimatedTip />}
            actions={
              <Link to={withPeriod(adminPaths.companies, period)} className="text-[13px] font-medium text-accent-text hover:underline">
                All companies
              </Link>
            }
            bodyClassName="px-0 pb-0 pt-3"
          >
            <FlushTable
              rows={o.topCompanies}
              columns={top}
              rowKey={(r) => r.id}
              initialSort={{ key: 'cost', dir: 'desc' }}
              pageSize={10}
              empty="No company has run anything in this period."
            />
          </AdminCard>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            {o.sources.engineLedger.ok ? <CheckCircle2 className="size-3.5 text-good-text" aria-hidden /> : <AlertTriangle className="size-3.5 text-warning-text" aria-hidden />}
            <span className="font-medium text-ink-2">{o.sources.engineLedger.ok ? 'Cost data is current' : 'Cost data may be stale'}</span>
            <span>
              {o.sources.engineLedger.note}
              {o.sources.engineLedger.lastSyncAt && <> · engine ledger read {fmtAgo(o.sources.engineLedger.lastSyncAt)}</>}
              {' · '}
              <Num className="text-[11px]">{o.sources.engineLedger.rows.toLocaleString('en-US')}</Num> rows
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" aria-hidden />
              {o.companies.total} companies ({o.companies.newInPeriod} new, {o.companies.disabled} disabled, {o.companies.withEnforcedCredits} enforcing credits) · {o.sites} websites
            </span>
          </p>
        </Stagger>
      )}
    </>
  );
}
