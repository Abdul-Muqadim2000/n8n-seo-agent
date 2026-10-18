import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Building2, Download } from 'lucide-react';
import type { AdminCompanyRow } from '@seo/shared';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/table';
import { useAdminCompanies } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { useAdminPeriod } from './AdminLayout';
import { AdminPageHeader, CompanyStatus, CostSplitCell, MarginValue, Money, Num, RowTile } from './_components/kit';
import { adminPaths, credits, money, PERIOD_LABELS, sumSplits, withPeriod } from './lib';

export default function AdminCompaniesPage() {
  const [period] = useAdminPeriod();
  const q = useAdminCompanies(period);
  const navigate = useNavigate();
  const rows = q.data ?? [];
  const totals = useMemo(() => {
    const cost = sumSplits(rows.map((r) => r.money.cost));
    return { cost, revenue: rows.reduce((t, r) => t + r.money.revenueUsd, 0), margin: rows.reduce((t, r) => t + r.money.marginUsd, 0) };
  }, [rows]);

  const columns: Column<AdminCompanyRow>[] = [
    {
      key: 'name',
      header: 'Company',
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <Link to={withPeriod(adminPaths.company(r.id), period)} onClick={(e) => e.stopPropagation()} className="flex min-w-[180px] items-center gap-3 rounded-md hover:text-accent-text">
          <RowTile name={r.name} muted={r.disabled} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.name}</span>
            <span className="block truncate font-mono text-[11px] text-ink-3">
              {r.slug}
              {r.kind && r.kind !== 'company' ? ` · ${r.kind}` : ''} · {fmtDate(r.createdAt)}
            </span>
          </span>
        </Link>
      ),
    },
    { key: 'members', header: 'Members', align: 'right', sortValue: (r) => r.members, cell: (r) => <Num>{r.members}</Num>, hideOnMobile: true },
    { key: 'sites', header: 'Sites', align: 'right', sortValue: (r) => r.sites, cell: (r) => <Num>{r.sites}</Num>, hideOnMobile: true },
    {
      key: 'runs',
      header: 'Runs',
      align: 'right',
      sortValue: (r) => r.runs,
      cell: (r) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <Num>{r.runs.toLocaleString('en-US')}</Num>
          {r.failedRuns > 0 && <Num className="mt-0.5 text-[11px] text-critical-text">{r.failedRuns} failed</Num>}
        </span>
      ),
    },
    {
      key: 'credits',
      header: 'Credits left / used',
      align: 'right',
      sortValue: (r) => r.credits.balance,
      cell: (r) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <Num className={r.credits.balance < 0 ? 'text-critical-text' : undefined}>{credits(r.credits.balance)}</Num>
          <Num className="mt-0.5 text-[11px] text-ink-3">{credits(r.credits.usedInPeriod)} used</Num>
        </span>
      ),
    },
    { key: 'cost', header: 'Cost to us', align: 'right', sortValue: (r) => r.money.cost.totalUsd, cell: (r) => <CostSplitCell cost={r.money.cost} /> },
    { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.money.revenueUsd, cell: (r) => <Money value={r.money.revenueUsd} /> },
    { key: 'margin', header: 'Margin', align: 'right', sortValue: (r) => r.money.marginUsd, cell: (r) => <MarginValue marginUsd={r.money.marginUsd} pct={r.money.marginPct} revenueUsd={r.money.revenueUsd} /> },
    { key: 'status', header: 'Status', sortValue: (r) => (r.disabled ? 1 : 0), cell: (r) => <CompanyStatus row={r} /> },
  ];

  return (
    <>
      <AdminPageHeader
        icon={<Building2 />}
        title="Companies"
        description={`Every company on the platform: usage, credits, what it cost us and what it paid · ${PERIOD_LABELS[period]}.`}
        actions={
          <a href={`/api/admin/export/companies.csv?period=${period}`} download className={buttonClass('secondary', 'sm')}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />
      {q.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-96" />
        </div>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the companies" />
        </Card>
      ) : !rows.length ? (
        <Card>
          <EmptyState icon={<Building2 className="size-5" />} title="No companies yet" description="Companies appear here when someone signs up or an admin adds a user with a new company." />
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: 'cost', dir: 'desc' }}
          pageSize={25}
          searchable
          searchPlaceholder="Search companies…"
          searchText={(r) => `${r.name} ${r.slug} ${r.kind}`}
          onRowClick={(r) => navigate(withPeriod(adminPaths.company(r.id), period))}
          toolbar={
            <p className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
              <span>
                {rows.length} companies
              </span>
              <span>
                cost <Num className="text-[12px] text-ink-2">{money(totals.cost.totalUsd)}</Num>
              </span>
              <span>
                revenue <Num className="text-[12px] text-ink-2">{money(totals.revenue)}</Num>
              </span>
              <span>
                margin <Num className={totals.margin < 0 ? 'text-[12px] text-critical-text' : 'text-[12px] text-ink-2'}>{money(totals.margin)}</Num>
              </span>
            </p>
          }
        />
      )}
    </>
  );
}
