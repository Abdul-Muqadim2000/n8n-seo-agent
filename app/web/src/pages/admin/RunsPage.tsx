import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ListChecks, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/tabs';
import { useAdminCompanies, useAdminRuns, type AdminRunFilters } from '@/lib/queries';
import { useAdminPeriod } from './AdminLayout';
import { AdminPageHeader, Num, useDebounced } from './_components/kit';
import { RunsTable } from './_components/runs';
import { money, PERIOD_LABELS, sumSplits } from './lib';

type Status = NonNullable<AdminRunFilters['status']>;
type Origin = NonNullable<AdminRunFilters['origin']>;
const STATUSES: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
];
const ORIGINS: { value: Origin; label: string }[] = [
  { value: 'all', label: 'Any origin' },
  { value: 'app', label: 'App' },
  { value: 'schedule', label: 'Schedule' },
];
const pick = <T extends string>(v: string | null, list: { value: T }[], d: T): T => (list.some((o) => o.value === v) ? (v as T) : d);

export default function AdminRunsPage() {
  const [period] = useAdminPeriod();
  const [params, setParams] = useSearchParams();
  const status = pick(params.get('status'), STATUSES, 'all');
  const origin = pick(params.get('origin'), ORIGINS, 'all');
  const orgId = params.get('orgId') ?? '';
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounced(text, 350);
  const set = (k: string, v: string, empty: string) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (!v || v === empty) n.delete(k);
        else n.set(k, v);
        return n;
      },
      { replace: true },
    );
  useEffect(() => {
    if ((params.get('q') ?? '') !== q.trim()) set('q', q.trim(), '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const companies = useAdminCompanies(period);
  const runs = useAdminRuns({ period, status, origin, orgId: orgId || undefined, q: q.trim() || undefined, limit: 50 });
  const rows = useMemo(() => runs.data?.pages.flatMap((p) => p.rows) ?? [], [runs.data]);
  const total = runs.data?.pages[0]?.total ?? 0;
  const loadedCost = useMemo(() => sumSplits(rows.map((r) => r.cost)), [rows]);

  return (
    <>
      <AdminPageHeader icon={<ListChecks />} title="Runs" description={`Every run across all companies, started in the app or by a schedule · ${PERIOD_LABELS[period]}.`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search title, website, e-mail…" aria-label="Search runs" className="pl-9" />
        </div>
        <Segmented label="Status" value={status} onChange={(v) => set('status', v, 'all')} options={STATUSES} />
        <Segmented label="Origin" value={origin} onChange={(v) => set('origin', v, 'all')} options={ORIGINS} />
        <div className="w-full sm:w-56">
          <Select aria-label="Company" value={orgId} onChange={(e) => set('orgId', e.target.value, '')}>
            <option value="">All companies</option>
            {(companies.data ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>
      </div>
      {runs.isPending ? (
        <Skeleton className="h-96" />
      ) : runs.isError ? (
        <Card>
          <ErrorState error={runs.error} onRetry={() => runs.refetch()} title="Could not load the runs" />
        </Card>
      ) : (
        <div className={runs.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <p className="mb-2 text-xs text-ink-3">
            Showing <Num className="text-[12px] text-ink-2">{rows.length.toLocaleString('en-US')}</Num> of <Num className="text-[12px] text-ink-2">{total.toLocaleString('en-US')}</Num> runs · cost of
            those shown <Num className="text-[12px] text-ink-2">{money(loadedCost.totalUsd)}</Num>
          </p>
          <RunsTable rows={rows} empty={q || status !== 'all' || origin !== 'all' || orgId ? 'No run matches these filters.' : 'No run in this period.'} />
          {runs.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => runs.fetchNextPage()} loading={runs.isFetchingNextPage}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
