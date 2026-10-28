import { useMemo } from 'react';
import { toast } from 'sonner';
import { Receipt, RefreshCw } from 'lucide-react';
import type { AdminModeCost, ProviderBill } from '@seo/shared';
import { Stagger } from '@/components/insight';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { type Column } from '@/components/ui/table';
import { errorMessage, toastError } from '@/lib/api';
import { useAdminCostSync, useAdminOverview, useAdminRuns } from '@/lib/queries';
import { useAdminPeriod } from './AdminLayout';
import { AdminCard, AdminPageHeader, CostSplitCell, DailyCostChart, EstimatedTip, FlushTable, Money, Num, ProviderBillCard } from './_components/kit';
import { DeliveryCard } from './_components/tools';
import { OverviewSkeleton } from './OverviewPage';
import { aggregateByMode, credits, estimatedShare, marginPct, modeLabel, money, PERIOD_LABELS, ratioLabel } from './lib';

const MODE_SAMPLE = 200;

type ReconRow = { key: string; label: string; companies: number; unattributed: number; attributed: number; billed: number | null; ratio: number | null; estimated?: number; bill?: ProviderBill };

export default function AdminCostsPage() {
  const [period] = useAdminPeriod();
  const q = useAdminOverview(period);
  const runs = useAdminRuns({ period, limit: MODE_SAMPLE });
  const firstPage = runs.data?.pages[0];
  const byMode = useMemo(() => aggregateByMode(firstPage?.rows ?? []), [firstPage]);
  const o = q.data;
  const sync = useAdminCostSync();

  const recon: ReconRow[] = useMemo(() => {
    if (!o) return [];
    const bill = (p: ProviderBill['provider']) => o.bills.find((b) => b.provider === p);
    const a = bill('anthropic');
    const d = bill('dataforseo');
    const claude: ReconRow = {
      key: 'claude',
      label: 'Claude (Anthropic)',
      companies: o.money.cost.claudeUsd,
      unattributed: o.unattributed.claudeUsd,
      attributed: a?.attributedUsd ?? o.money.cost.claudeUsd + o.unattributed.claudeUsd,
      billed: a?.billedUsd ?? null,
      ratio: a?.ratio ?? null,
      estimated: o.money.cost.claudeEstimatedUsd + o.unattributed.claudeEstimatedUsd,
      bill: a,
    };
    const dfs: ReconRow = {
      key: 'dfs',
      label: 'DataForSEO',
      companies: o.money.cost.dataforseoUsd,
      unattributed: o.unattributed.dataforseoUsd,
      attributed: d?.attributedUsd ?? o.money.cost.dataforseoUsd + o.unattributed.dataforseoUsd,
      billed: d?.billedUsd ?? null,
      ratio: d?.ratio ?? null,
      bill: d,
    };
    const billedBoth = claude.billed != null && dfs.billed != null ? claude.billed + dfs.billed : null;
    const att = claude.attributed + dfs.attributed;
    return [
      claude,
      dfs,
      { key: 'total', label: 'Total', companies: claude.companies + dfs.companies, unattributed: claude.unattributed + dfs.unattributed, attributed: att, billed: billedBoth, ratio: billedBoth != null && att > 0 ? billedBoth / att : null, estimated: claude.estimated },
    ];
  }, [o]);

  const reconCols: Column<ReconRow>[] = [
    { key: 'label', header: 'Provider', cell: (r) => <span className={r.key === 'total' ? 'font-semibold' : 'font-medium'}>{r.label}</span> },
    { key: 'companies', header: 'Companies\' runs', align: 'right', cell: (r) => <Money value={r.companies} /> },
    { key: 'unattributed', header: 'Not tied to a company', align: 'right', cell: (r) => <Money value={r.unattributed} /> },
    { key: 'attributed', header: 'Attributed', align: 'right', cell: (r) => <Money value={r.attributed} className="text-ink" /> },
    {
      key: 'estimated',
      header: 'Of which estimated',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => (r.estimated != null ? <Money value={r.estimated} /> : <Num className="text-ink-3">none</Num>),
    },
    { key: 'billed', header: 'Billed', align: 'right', cell: (r) => (r.billed == null ? <Num className="text-ink-3">not available</Num> : <Money value={r.billed} className="text-ink" />) },
    { key: 'ratio', header: 'Billed ÷ attributed', align: 'right', cell: (r) => <Num>{ratioLabel(r.ratio)}</Num> },
    { key: 'gap', header: 'Gap', align: 'right', hideOnMobile: true, cell: (r) => (r.billed == null ? <Num className="text-ink-3">-</Num> : <Money value={r.billed - r.attributed} />) },
  ];

  const modeCols: Column<AdminModeCost>[] = [
    { key: 'mode', header: 'Mode', sortValue: (r) => modeLabel(r.mode), cell: (r) => <span className="text-[13px] font-medium">{modeLabel(r.mode)}</span> },
    { key: 'runs', header: 'Runs', align: 'right', sortValue: (r) => r.runs, cell: (r) => <Num>{r.runs}</Num> },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (r) => r.cost.totalUsd, cell: (r) => <CostSplitCell cost={r.cost} /> },
    { key: 'avg', header: 'Per run', align: 'right', sortValue: (r) => (r.runs ? r.cost.totalUsd / r.runs : 0), cell: (r) => <Money value={r.runs ? r.cost.totalUsd / r.runs : null} /> },
    { key: 'credits', header: 'Credits', align: 'right', sortValue: (r) => r.credits, cell: (r) => <Num>{credits(r.credits)}</Num>, hideOnMobile: true },
  ];

  const est = o ? estimatedShare(o.money.cost) : null;
  return (
    <>
      <AdminPageHeader
        icon={<Receipt />}
        title="Costs & billing"
        description={`What the providers charged, what we attributed to runs, and what customers paid · ${PERIOD_LABELS[period]}.`}
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className="size-4" aria-hidden />}
            loading={sync.isPending}
            onClick={() =>
              sync.mutate(undefined, {
                onSuccess: (r) =>
                  r.ok && r.ledgerReadable
                    ? toast.success(`Costs synced: ${r.ledgerRows.toLocaleString('en-US')} ledger rows read, ${r.debits} credit debits. ${r.note}`)
                    : toast.warning(r.note || 'The engine ledger could not be read; figures may be stale.'),
                onError: (e) => toastError(e),
              })
            }
          >
            Sync costs now
          </Button>
        }
      />
      {q.isPending ? (
        <OverviewSkeleton />
      ) : q.isError || !o ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the costs" />
        </Card>
      ) : (
        <Stagger className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {o.bills.map((b) => (
              <ProviderBillCard key={b.provider} bill={b} attributedSplit={b.provider === 'anthropic' ? { estimatedUsd: o.money.cost.claudeEstimatedUsd + o.unattributed.claudeEstimatedUsd } : undefined} />
            ))}
          </div>

          <AdminCard
            title="Billed vs attributed"
            info={<EstimatedTip />}
            description="Attributed = the cost the engine tied to runs (companies' runs plus what it could not tie to a company). Billed = what the provider charged. A gap is spend nobody ran through the app, or pricing drift."
            bodyClassName="px-0 pb-0 pt-3"
          >
            <FlushTable rows={recon} columns={reconCols} rowKey={(r) => r.key} />
          </AdminCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <AdminCard title="Revenue vs cost" description={PERIOD_LABELS[period]}>
              <dl className="space-y-2.5 text-sm">
                {[
                  { label: 'Revenue (payments recorded)', value: money(o.money.revenueUsd) },
                  { label: 'Cost of companies\' runs', value: money(o.money.cost.totalUsd) },
                  { label: 'Margin', value: `${money(o.money.marginUsd)} · ${marginPct(o.money.marginPct)}`, strong: true },
                  { label: 'Usage at list price', value: money(o.money.listValueUsd) },
                  { label: 'Not tied to a company (our own cost)', value: money(o.unattributed.totalUsd) },
                  { label: 'Claude cost that is estimated', value: est == null ? 'none' : `${Math.round(est * 100)}%` },
                ].map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0 last:pb-0">
                    <dt className="text-ink-3">{r.label}</dt>
                    <dd className={r.strong ? 'font-mono text-[13px] font-semibold tabular text-ink' : 'font-mono text-[13px] tabular text-ink'}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-snug text-ink-3">There is no card billing yet: revenue is what admins recorded when they granted credits.</p>
            </AdminCard>
            <DailyCostChart className="xl:col-span-2" daily={o.daily} loading={q.isPlaceholderData} />
          </div>

          <AdminCard
            title="Cost by mode, all companies"
            description={
              firstPage
                ? firstPage.total > firstPage.rows.length
                  ? `From the latest ${firstPage.rows.length} of ${firstPage.total.toLocaleString('en-US')} runs in this period (the panel has no platform-wide total by mode).`
                  : `All ${firstPage.rows.length} runs in this period.`
                : 'From the runs in this period.'
            }
            bodyClassName="px-0 pb-0 pt-3"
          >
            {runs.isPending ? (
              <Skeleton className="mx-5 mb-5 h-40" />
            ) : runs.isError ? (
              <Callout tone="critical" className="mx-5 mb-5">
                {errorMessage(runs.error)}
              </Callout>
            ) : (
              <FlushTable rows={byMode} columns={modeCols} rowKey={(r) => r.mode} initialSort={{ key: 'cost', dir: 'desc' }} empty="No run in this period." />
            )}
          </AdminCard>

          <DeliveryCard enabled />
        </Stagger>
      )}
    </>
  );
}
