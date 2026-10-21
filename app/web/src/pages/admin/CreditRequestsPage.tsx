// The customers' "Buy credits" requests (app/docs/CREDITS.md §1 "Buying credits"): there is no card payment yet, so a request is
// invoiced by the Alaventra team and confirmed here, which adds the pack to that company and records the payment as revenue.
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
import type { AdminPurchaseRequest } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { useAdminCreditRequests, useCancelAdminCreditRequest } from '@/lib/queries';
import { fmtAgo, fmtDateTime } from '@/lib/utils';
import { useAdminPeriod } from './AdminLayout';
import { AdminPageHeader, ConfirmDialog, CreditDialog, Money, Num, RowTile } from './_components/kit';
import { adminPaths, credits, money, withPeriod } from './lib';

type Filter = 'pending' | 'all';
const STATUS: Record<AdminPurchaseRequest['status'], { tone: 'warning' | 'good' | 'neutral'; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting' },
  fulfilled: { tone: 'good', label: 'Fulfilled' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

export default function AdminCreditRequestsPage() {
  const [period] = useAdminPeriod();
  const [filter, setFilter] = useState<Filter>('pending');
  const q = useAdminCreditRequests(filter);
  const cancel = useCancelAdminCreditRequest();
  const [confirming, setConfirming] = useState<AdminPurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState<AdminPurchaseRequest | null>(null);
  const rows = q.data ?? [];
  const waiting = rows.filter((r) => r.status === 'pending');

  const columns: Column<AdminPurchaseRequest>[] = [
    {
      key: 'company',
      header: 'Company',
      sortValue: (r) => r.orgName.toLowerCase(),
      cell: (r) =>
        r.orgId ? (
          <Link to={withPeriod(adminPaths.company(r.orgId), period)} className="flex min-w-[170px] items-center gap-3 rounded-md hover:text-accent-text">
            <RowTile name={r.orgName} />
            <span className="block truncate font-medium">{r.orgName}</span>
          </Link>
        ) : (
          <span className="flex min-w-[170px] items-center gap-3 text-ink-3">
            <RowTile name={r.orgName || '?'} muted />
            <span className="block truncate">{r.orgName || 'Deleted company'} (deleted)</span>
          </span>
        ),
    },
    {
      key: 'pack',
      header: 'Pack',
      align: 'right',
      sortValue: (r) => r.credits,
      cell: (r) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <Num>{credits(r.credits)} credits</Num>
          <span className="mt-0.5 font-mono text-[11px] text-ink-3">{r.packId}</span>
        </span>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', sortValue: (r) => r.priceUsd, cell: (r) => <Money value={r.priceUsd} digits={2} /> },
    {
      key: 'by',
      header: 'Requested by',
      hideOnMobile: true,
      sortValue: (r) => r.requestedBy ?? '',
      cell: (r) => (
        <span className="block min-w-[150px] max-w-[260px] text-[13px] text-ink-2">
          {r.requestedBy ?? '-'}
          {r.note && <span className="block text-xs text-ink-3">{r.note}</span>}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <Num className="whitespace-nowrap text-ink-2" title={fmtDateTime(r.createdAt)}>
          {fmtAgo(r.createdAt)}
        </Num>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className="inline-flex flex-col items-start leading-tight">
          <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>
          {r.resolvedAt && <Num className="mt-1 text-[11px] text-ink-3">{fmtDateTime(r.resolvedAt)}</Num>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) =>
        r.status === 'pending' && r.orgId ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setConfirming(r)}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
              Cancel
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <AdminPageHeader
        icon={<Inbox />}
        title="Credit requests"
        description="Packs customers asked for with &quot;Buy credits&quot;. Invoice each one, then confirm it once paid: the pack is added and the payment counts as revenue."
        actions={
          <Segmented
            size="sm"
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'pending', label: 'Waiting' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      {q.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-72" />
        </div>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the credit requests" />
        </Card>
      ) : !rows.length ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title={filter === 'pending' ? 'No request waiting' : 'No request yet'}
            description="When an owner or admin of a company asks for a credit pack, it appears here and the platform admins get an e-mail."
          />
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: 'when', dir: 'desc' }}
          pageSize={25}
          searchable
          searchPlaceholder="Search companies or people"
          searchText={(r) => `${r.orgName} ${r.requestedBy ?? ''} ${r.packId} ${r.note}`}
          toolbar={
            <p className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
              <span>
                {waiting.length} waiting
              </span>
              <span>
                worth <Num className="text-[12px] text-ink-2">{money(waiting.reduce((t, r) => t + r.priceUsd, 0), { digits: 2 })}</Num>
              </span>
            </p>
          }
        />
      )}

      {confirming?.orgId && (
        <CreditDialog company={{ id: confirming.orgId, name: confirming.orgName }} kind="grant" request={confirming} onClose={() => setConfirming(null)} />
      )}
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => {
          setCancelling(null);
          cancel.reset();
        }}
        title={cancelling ? `Cancel ${cancelling.orgName}'s request for ${credits(cancelling.credits)} credits?` : ''}
        description="The customer sees it as cancelled and can ask again. No credits are added."
        confirmLabel="Cancel request"
        danger
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={() =>
          cancelling &&
          cancel.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success(`${cancelling.orgName}: request cancelled`);
              setCancelling(null);
            },
          })
        }
      />
    </>
  );
}
