import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FileText, ListChecks, Plus, RotateCcw } from 'lucide-react';
import { MODE_IDS, MODES, type Run } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useRuns, type RunFilters } from '@/lib/queries';
import { fmtAgo, fmtDateTime } from '@/lib/utils';
import { RunStatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { Meter, PageHeader } from '@/components/ui/misc';
import { ModeGlyph } from '@/components/reports/meta';
import { CostLine, fmtMinutes, isActive, minutesBetween, useNow } from '@/components/reports/run';

const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  { value: 'accepted', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function RunsPage() {
  const { org, sites } = useOrgCtx();
  const [params, setParams] = useSearchParams();
  const filters: RunFilters = { siteId: params.get('site') ?? undefined, mode: params.get('mode') ?? undefined, status: params.get('status') ?? undefined };
  const filterKey = `${filters.siteId ?? ''}|${filters.mode ?? ''}|${filters.status ?? ''}`;
  const filtered = !!(filters.siteId || filters.mode || filters.status);

  const setFilter = (key: 'site' | 'mode' | 'status', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Every analysis started in your company, newest first. Open one for its progress, reports and files."
        actions={
          <ButtonLink to={paths.tools(org.id)} icon={<Plus className="size-4" />}>
            New run
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FilterSelect label="Website" value={filters.siteId ?? ''} onChange={(v) => setFilter('site', v)}>
          <option value="">All websites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.domain}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Tool" value={filters.mode ?? ''} onChange={(v) => setFilter('mode', v)}>
          <option value="">All tools</option>
          {MODE_IDS.map((m) => (
            <option key={m} value={m}>
              {MODES[m].title}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" value={filters.status ?? ''} onChange={(v) => setFilter('status', v)}>
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        {filtered && (
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>
      <RunList key={filterKey} filters={filters} filtered={filtered} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = `runs-filter-${label.toLowerCase()}`;
  return (
    <div className="w-full sm:w-52">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-3">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </div>
  );
}

/** Pages of runs: each "Load more" adds the next cursor's page (each page is its own query, so polling keeps them fresh). */
function RunList({ filters, filtered }: { filters: RunFilters; filtered: boolean }) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const now = useNow(15_000);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr className="text-left text-xs font-medium text-ink-3">
              <th scope="col" className="border-b border-line px-4 py-2.5 font-medium">
                Run
              </th>
              <th scope="col" className="hidden border-b border-line px-3 py-2.5 font-medium md:table-cell">
                Website
              </th>
              <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="hidden border-b border-line px-3 py-2.5 font-medium lg:table-cell">
                Started by
              </th>
              <th scope="col" className="hidden border-b border-line px-3 py-2.5 font-medium sm:table-cell">
                Started
              </th>
              <th scope="col" className="hidden border-b border-line px-3 py-2.5 font-medium md:table-cell">
                Duration
              </th>
              <th scope="col" className="hidden border-b border-line px-3 py-2.5 text-right font-medium lg:table-cell">
                Est. cost
              </th>
              <th scope="col" className="border-b border-line px-4 py-2.5 text-right font-medium">
                Reports
              </th>
            </tr>
          </thead>
          {cursors.map((c, i) => (
            <RunChunk
              key={c ?? 'first'}
              filters={filters}
              cursor={c}
              first={i === 0}
              last={i === cursors.length - 1}
              now={now}
              filtered={filtered}
              onMore={(next) => setCursors((list) => (list.includes(next) ? list : [...list, next]))}
            />
          ))}
        </table>
      </div>
    </Card>
  );
}

function RunChunk({ filters, cursor, first, last, now, filtered, onMore }: { filters: RunFilters; cursor?: string; first: boolean; last: boolean; now: number; filtered: boolean; onMore: (cursor: string) => void }) {
  const { org } = useOrgCtx();
  const [poll, setPoll] = useState<number | undefined>(undefined);
  const q = useRuns(org.id, { ...filters, cursor, limit: PAGE_SIZE }, poll);
  const items = q.data?.items ?? [];
  const active = items.some((r) => isActive(r.status));
  useEffect(() => setPoll(active ? 15_000 : undefined), [active]);
  const colSpan = 8;

  if (q.isLoading)
    return (
      <tbody>
        {Array.from({ length: first ? 6 : 2 }).map((_, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            <td colSpan={colSpan} className="px-4 py-3">
              <Skeleton className="h-9 w-full" />
            </td>
          </tr>
        ))}
      </tbody>
    );
  if (q.isError)
    return (
      <tbody>
        <tr>
          <td colSpan={colSpan}>
            <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load runs" />
          </td>
        </tr>
      </tbody>
    );
  if (first && !items.length)
    return (
      <tbody>
        <tr>
          <td colSpan={colSpan}>
            <EmptyState
              icon={<ListChecks className="size-5" />}
              title={filtered ? 'No runs match these filters' : 'No runs yet'}
              description={filtered ? 'Try another website, tool or status.' : 'Start a keyword verdict, a page, an audit or any other analysis. Its progress and results appear here.'}
              action={<ButtonLink to={paths.tools(org.id)}>Run an analysis</ButtonLink>}
            />
          </td>
        </tr>
      </tbody>
    );
  return (
    <tbody className={q.isFetching && !q.isLoading ? 'opacity-90' : undefined}>
      {items.map((r) => (
        <RunRow key={r.id} run={r} now={now} />
      ))}
      {last && q.data?.nextCursor && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3 text-center">
            <Button variant="secondary" size="sm" onClick={() => onMore(q.data!.nextCursor!)}>
              Load more
            </Button>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function RunRow({ run, now }: { run: Run; now: number }) {
  const { org } = useOrgCtx();
  const navigate = useNavigate();
  const to = paths.run(org.id, run.id);
  const active = isActive(run.status);
  const elapsed = minutesBetween(run.acceptedAt ?? run.createdAt, active ? now : run.completedAt);
  return (
    <tr className="cursor-pointer border-b border-line align-middle last:border-0 hover:bg-surface-2" onClick={() => navigate(to)}>
      <td className="px-4 py-3">
        <div className="flex min-w-[200px] items-center gap-3">
          <ModeGlyph mode={run.mode} size="sm" />
          <div className="min-w-0">
            <Link to={to} className="block truncate font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
              {run.title}
            </Link>
            <p className="truncate text-xs text-ink-3">
              {MODES[run.mode]?.title ?? run.mode}
              <span className="md:hidden">{run.siteDomain ? ` · ${run.siteDomain}` : ''}</span>
              <span className="sm:hidden"> · {fmtAgo(run.createdAt)}</span>
            </p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 text-ink-2 md:table-cell">{run.siteDomain ?? <span className="text-ink-3">–</span>}</td>
      <td className="px-3 py-3">
        <RunStatusBadge status={run.status} />
        {run.status === 'failed' && run.error && <p className="mt-1 max-w-[220px] truncate text-xs text-critical-text" title={run.error}>{run.error}</p>}
      </td>
      <td className="hidden px-3 py-3 text-ink-2 lg:table-cell">{run.userName ?? <span className="text-ink-3">–</span>}</td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-ink-2 sm:table-cell" title={fmtDateTime(run.createdAt)}>
        {fmtAgo(run.createdAt)}
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        {active ? (
          <div className="w-28">
            <p className="text-xs tabular text-ink-2">
              {fmtMinutes(elapsed)} / ~{run.etaMinutes} min
            </p>
            <Meter value={Math.min(97, ((elapsed ?? 0) / Math.max(1, run.etaMinutes)) * 100)} label="Estimated progress" className="mt-1 h-1.5" />
          </div>
        ) : (
          <span className="tabular text-ink-2">{run.completedAt ? fmtMinutes(elapsed) : '–'}</span>
        )}
      </td>
      <td className="hidden px-3 py-3 text-right text-ink-2 lg:table-cell">
        <CostLine run={run} />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 tabular text-ink-2">
          <FileText className="size-3.5 text-ink-3" aria-hidden />
          {run.reportCount}
        </span>
      </td>
    </tr>
  );
}
