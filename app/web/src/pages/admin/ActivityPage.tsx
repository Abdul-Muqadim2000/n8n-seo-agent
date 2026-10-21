import { useState } from 'react';
import { Link } from 'react-router';
import { Activity } from 'lucide-react';
import type { AdminActivityRow } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { useAdminActivity } from '@/lib/queries';
import { fmtAgo, fmtDateTime } from '@/lib/utils';
import { AdminPageHeader, Num } from './_components/kit';
import { actionLabel, adminPaths, detailText } from './lib';

const LIMITS = [50, 100, 200, 500] as const;

function targetLink(t: AdminActivityRow['target']): string | null {
  if (!t.id) return null;
  if (t.type === 'company' || t.type === 'org') return adminPaths.company(t.id);
  if (t.type === 'user') return adminPaths.user(t.id);
  return null;
}

export default function AdminActivityPage() {
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(100);
  const q = useAdminActivity(limit);

  const columns: Column<AdminActivityRow>[] = [
    {
      key: 'at',
      header: 'When',
      sortValue: (r) => r.at,
      cell: (r) => (
        <span className="block whitespace-nowrap leading-tight" title={fmtDateTime(r.at)}>
          <Num className="text-ink">{fmtDateTime(r.at)}</Num>
          <span className="block text-[11px] text-ink-3">{fmtAgo(r.at)}</span>
        </span>
      ),
    },
    { key: 'actor', header: 'Admin', sortValue: (r) => r.actor, cell: (r) => <span className="block max-w-[220px] truncate text-[13px]">{r.actor}</span> },
    {
      key: 'action',
      header: 'Action',
      sortValue: (r) => r.action,
      cell: (r) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <span className="text-[13px] font-medium">{actionLabel(r.action)}</span>
          <span className="font-mono text-[11px] text-ink-3">{r.action}</span>
        </span>
      ),
    },
    {
      key: 'target',
      header: 'On',
      sortValue: (r) => r.target.label,
      cell: (r) => {
        const to = targetLink(r.target);
        return (
          <span className="inline-flex items-center gap-1.5">
            <Badge>{r.target.type}</Badge>
            {to ? (
              <Link to={to} className="max-w-[200px] truncate text-[13px] font-medium hover:text-accent-text">
                {r.target.label}
              </Link>
            ) : (
              <span className="max-w-[200px] truncate text-[13px]">{r.target.label}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'details',
      header: 'Details',
      cell: (r) => {
        const entries = Object.entries(r.details ?? {});
        if (!entries.length) return <span className="text-ink-3">-</span>;
        return (
          <span className="block min-w-[200px] max-w-[380px] font-mono text-[11px] leading-relaxed text-ink-2">
            {entries.slice(0, 4).map(([k, v]) => (
              <span key={k} className="block truncate" title={`${k}: ${detailText(v)}`}>
                <span className="text-ink-3">{k}</span> {detailText(v)}
              </span>
            ))}
            {entries.length > 4 && <span className="block text-ink-3">+{entries.length - 4} more</span>}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <AdminPageHeader
        icon={<Activity />}
        title="Activity"
        description="What platform admins changed: credits, companies, users and settings, newest first."
        actions={<Segmented label="How many" value={String(limit)} onChange={(v) => setLimit(Number(v) as (typeof LIMITS)[number])} options={LIMITS.map((l) => ({ value: String(l), label: `Last ${l}` }))} />}
      />
      {q.isPending ? (
        <Skeleton className="h-96" />
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the activity" />
        </Card>
      ) : !q.data.length ? (
        <Card>
          <EmptyState icon={<Activity className="size-5" />} title="Nothing changed yet" description="Every credit grant, user change and settings change made here is listed." />
        </Card>
      ) : (
        <DataTable
          rows={q.data}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: 'at', dir: 'desc' }}
          pageSize={50}
          searchable
          searchPlaceholder="Search admin, action, target"
          searchText={(r) => `${r.actor} ${r.action} ${actionLabel(r.action)} ${r.target.label} ${r.target.type}`}
        />
      )}
    </>
  );
}
