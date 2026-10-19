// The runs table of the admin panel (the Runs page, a company's and a person's recent runs): when, company, what, where it came from,
// status, the cost split with how sure it is, the credits, and the error behind a disclosure.
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarClock, MousePointerClick } from 'lucide-react';
import type { AdminRunRow, RunStatus } from '@seo/shared';
import { CollapsePanel, DisclosureButton } from '@/components/insight';
import { Badge, RunStatusBadge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { fmtDateTime } from '@/lib/utils';
import { CertaintyBadge, CostSplitCell, FlushTable, Num } from './kit';
import { adminPaths, credits, modeLabel, money } from '../lib';
import { useAdminUnits } from './units';
import { useAdminSettings } from '@/lib/queries';

const RUN_STATUSES: readonly string[] = ['submitting', 'accepted', 'running', 'completed', 'failed'];

export function RunStatus({ status }: { status: string }) {
  if (RUN_STATUSES.includes(status)) return <RunStatusBadge status={status as RunStatus} />;
  if (status === 'done') return <StatusBadge tone="good">Done</StatusBadge>;
  return <StatusBadge tone="neutral">{status || 'unknown'}</StatusBadge>;
}

export function OriginBadge({ origin }: { origin: AdminRunRow['origin'] }) {
  return origin === 'schedule' ? (
    <Badge icon={<CalendarClock className="size-3" aria-hidden />}>Schedule</Badge>
  ) : (
    <Badge icon={<MousePointerClick className="size-3" aria-hidden />}>App</Badge>
  );
}

function ErrorText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const short = text.length <= 70;
  if (short) return <span className="mt-1 block text-xs text-critical-text">{text}</span>;
  return (
    <span className="mt-1 block max-w-[420px]">
      <span className="flex items-start gap-2">
        <span className="min-w-0 truncate text-xs text-critical-text" title={text}>
          {text}
        </span>
        <DisclosureButton open={open} onToggle={() => setOpen((o) => !o)} controls={id} label="Error" openLabel="Hide" />
      </span>
      <CollapsePanel open={open} id={id}>
        <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-critical-soft px-2.5 py-2 font-mono text-[11px] leading-snug text-ink">{text}</pre>
      </CollapsePanel>
    </span>
  );
}

export function RunsTable({ rows, flush, hideCompany, empty, pageSize = 1000 }: { rows: AdminRunRow[]; flush?: boolean; hideCompany?: boolean; empty?: ReactNode; pageSize?: number }) {
  const [units] = useAdminUnits();
  const cv = useAdminSettings().data?.creditValueUsd ?? null;
  const columns: Column<AdminRunRow>[] = [
    { key: 'at', header: 'Started', hideOnMobile: true, sortValue: (r) => r.createdAt, cell: (r) => <Num className="whitespace-nowrap text-ink-2">{fmtDateTime(r.createdAt)}</Num> },
    ...(hideCompany
      ? []
      : [
          {
            key: 'org',
            header: 'Company',
            hideOnMobile: true,
            sortValue: (r: AdminRunRow) => r.orgName.toLowerCase(),
            cell: (r: AdminRunRow) =>
              // a run the engine could not tie to a company has no company page
              r.orgId ? (
                <Link to={adminPaths.company(r.orgId)} className="block max-w-[180px] truncate text-[13px] font-medium hover:text-accent-text">
                  {r.orgName}
                </Link>
              ) : (
                <span className="block max-w-[180px] truncate text-[13px] text-ink-3">{r.orgName || 'Unattributed'}</span>
              ),
          } satisfies Column<AdminRunRow>,
        ]),
    {
      key: 'what',
      header: 'Run',
      sortValue: (r) => r.mode,
      cell: (r) => (
        <span className="block w-[200px] md:w-auto md:min-w-[200px] md:max-w-[420px]">
          {/* phones: the date and the company columns are hidden, so they lead the run cell */}
          <span className="block truncate font-mono text-[11px] text-ink-3 md:hidden">
            {fmtDateTime(r.createdAt)}
            {hideCompany ? '' : ` · ${r.orgName}`}
          </span>
          <span className="block max-w-[360px] truncate text-[13px] font-medium" title={r.title}>
            {r.title || modeLabel(r.mode)}
          </span>
          <span className="block truncate font-mono text-[11px] text-ink-3">
            {modeLabel(r.mode)}
            {r.siteDomain ? ` · ${r.siteDomain}` : ''}
            {r.userEmail ? ` · ${r.userEmail}` : ''}
          </span>
          {r.error && <ErrorText text={r.error} />}
        </span>
      ),
    },
    { key: 'origin', header: 'Origin', sortValue: (r) => r.origin, cell: (r) => <OriginBadge origin={r.origin} />, hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <RunStatus status={r.status} />
          <CertaintyBadge certainty={r.certainty} />
        </span>
      ),
    },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (r) => r.cost?.totalUsd ?? -1, cell: (r) => <CostSplitCell cost={r.cost} /> },
    // credits (app/docs/CREDITS.md): the Credits / USD switch, what the run was billed at list price (the cost column beside it is ours)
    {
      key: 'credits',
      header: units === 'usd' ? 'Billed ($)' : 'Credits',
      align: 'right',
      sortValue: (r) => r.credits ?? -1,
      cell: (r) => <Num title={r.credits != null ? `${credits(r.credits)} credits` : undefined}>{units === 'usd' && cv != null ? (r.credits == null ? '-' : money(r.credits * cv)) : credits(r.credits)}</Num>,
    },
  ];
  const props = { rows, columns, rowKey: (r: AdminRunRow) => r.id, pageSize, empty: empty ?? 'No runs match.' };
  return flush ? <FlushTable {...props} /> : <DataTable {...props} />;
}
