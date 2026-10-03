import { useMemo, useState } from 'react';
import { BellRing, CalendarCheck, ClipboardCheck, Mail, ShieldAlert } from 'lucide-react';
import { titleCase, type AlertsData, type Checkin, type ConsoleAlert } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard } from '@/components/charts';
import { Badge, StatusBadge, severityTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Delta, PageHeader, StatTile } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { DataGate, FilterChips, KpiGrid, Kind, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { diff, fmtMonth, fmtMonthShort, sortByDate } from './_components/format';

export default function AlertsPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'alerts');
  return (
    <div>
      <PageHeader
        title="Alerts & check-ins"
        description="Search Console notifications for this website, and the monthly check-in of what the Search Console API cannot see: manual actions, security issues and the Pages report."
        actions={
          <ToolButton mode="checkin" variant="primary" icon={<ClipboardCheck className="size-4" />}>
            Record a check-in
          </ToolButton>
        }
      />
      <DataGate q={q}>
        {(d) => <Alerts d={d} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

const CLOSED = ['resolved', 'closed', 'fixed', 'done', 'dismissed', 'ignored'];
const isOpen = (a: ConsoleAlert) => !CLOSED.includes(String(a.status ?? '').toLowerCase());
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, serious: 1, medium: 2, warning: 2, low: 3, info: 4 };
const sevRank = (s: string) => SEV_RANK[String(s ?? '').toLowerCase()] ?? 5;

function Alerts({ d, refetching }: { d: AlertsData; refetching: boolean }) {
  const checkins = useMemo(() => sortByDate(d.checkins, (c) => c.month), [d.checkins]);
  const last = checkins[checkins.length - 1] ?? null;
  const prev = checkins.length > 1 ? checkins[checkins.length - 2] : null;
  const open = d.alerts.filter(isOpen);
  const urgent = open.filter((a) => sevRank(a.severity) <= 1).length;

  return (
    <div className="space-y-6">
      {d.checkinDue && (
        <Callout tone="warning" title="This month’s Search Console check-in is due" action={<ToolButton mode="checkin" variant="primary" size="sm">Record it now</ToolButton>}>
          Open Search Console and look at three things: Security & Manual actions (both should say “No issues detected”) and the Pages report (export it as CSV to record what is not indexed and why). It takes about two minutes.
        </Callout>
      )}

      <KpiGrid>
        <StatTile
          label="Open alerts"
          icon={<BellRing className="size-4" />}
          value={open.length}
          hint={open.length ? `${urgent} critical or high · ${d.alerts.length} received in total` : d.alerts.length ? `${d.alerts.length} received, all resolved` : 'No Search Console notifications received'}
        />
        <StatTile
          label="Last check-in"
          icon={<CalendarCheck className="size-4" />}
          value={last ? fmtMonth(last.month) : '–'}
          hint={last ? `Recorded ${fmtAgo(last.submittedAt)}` : 'Not recorded yet'}
        />
        <StatTile
          label="Pages not indexed"
          value={last ? last.notIndexedTotal.toLocaleString('en-US') : '–'}
          delta={last && prev ? <Delta value={diff(last.notIndexedTotal, prev.notIndexedTotal)} suffix="" digits={0} upIsGood={false} label={`vs ${fmtMonth(prev.month)}`} /> : undefined}
          hint={last ? (last.indexedTotal != null ? `${last.indexedTotal.toLocaleString('en-US')} indexed · from the Pages report` : 'From the Pages report') : 'Recorded with the monthly check-in'}
        />
        <StatTile
          label="Manual actions & security"
          icon={<ShieldAlert className="size-4" />}
          value={
            last ? (
              last.manualAction || last.securityIssue ? (
                <StatusBadge tone="critical" className="h-7 text-sm">
                  {[last.manualAction && 'Manual action', last.securityIssue && 'Security issue'].filter(Boolean).join(' + ')}
                </StatusBadge>
              ) : (
                <StatusBadge tone="good" className="h-7 text-sm">
                  None reported
                </StatusBadge>
              )
            ) : (
              '–'
            )
          }
          hint={last ? `As of the ${fmtMonth(last.month)} check-in` : 'Recorded with the monthly check-in'}
        />
      </KpiGrid>

      <AlertList alerts={d.alerts} />

      <section>
        <SectionHeading title="Monthly check-ins" description="What you recorded from Search Console each month" />
        {checkins.length ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Pages not indexed"
                description="Per monthly check-in (Pages report)"
                loading={refetching}
                table={{
                  columns: [
                    { key: 'month', label: 'Month', format: (v) => fmtMonth(String(v)) },
                    { key: 'notIndexed', label: 'Not indexed', align: 'right' },
                    { key: 'indexed', label: 'Indexed', align: 'right', format: (v) => (v == null ? '–' : String(v)) },
                  ],
                  rows: [...checkins].reverse().map((c) => ({ month: c.month, notIndexed: c.notIndexedTotal, indexed: c.indexedTotal })),
                }}
              >
                <BarsChart data={checkins.map((c) => ({ month: c.month, notIndexed: c.notIndexedTotal }))} categoryKey="month" series={[{ key: 'notIndexed', label: 'Pages not indexed' }]} categoryFormat={(v) => fmtMonthShort(String(v))} height={220} />
              </ChartCard>
              {last && <LatestCheckin c={last} />}
            </div>
            <Card className="p-4">
              <CheckinTable rows={checkins} />
            </Card>
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<ClipboardCheck className="size-5" />}
              title="No check-in recorded yet"
              description="Once a month, record whether Search Console shows a manual action or a security issue, and upload the Pages report export. Issues are raised as alerts here, and a reminder goes out with the Monday report when it is due."
              action={
                <ToolButton mode="checkin" variant="primary">
                  Record the first check-in
                </ToolButton>
              }
            />
          </Card>
        )}
      </section>
    </div>
  );
}

function AlertList({ alerts }: { alerts: ConsoleAlert[] }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const sorted = useMemo(() => [...alerts].sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.receivedAt.localeCompare(a.receivedAt)), [alerts]);
  const shown = sorted.filter((a) => filter === 'all' || isOpen(a));
  return (
    <section>
      <SectionHeading
        title="Search Console alerts"
        description="Notification e-mails from Google Search Console, read automatically and matched to this website"
        actions={
          alerts.length > 0 ? (
            <FilterChips
              label="Alert filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: 'Open', count: alerts.filter(isOpen).length },
                { value: 'all', label: 'All', count: alerts.length },
              ]}
            />
          ) : undefined
        }
      />
      <Card>
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((a, i) => (
              <li key={`${a.receivedAt}-${i}`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="w-28 shrink-0">
                  <StatusBadge tone={severityTone(a.severity)}>{titleCase(a.severity || 'info')}</StatusBadge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{a.subject}</p>
                  {a.summary && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{a.summary}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    {a.kind && <Kind>{titleCase(a.kind)}</Kind>}
                    <span title={fmtDate(a.receivedAt)}>received {fmtAgo(a.receivedAt)}</span>
                    {a.source && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3" aria-hidden />
                        {a.source === 'checkin' ? 'from a check-in' : a.source === 'imap' || a.source === 'mail' ? 'from a Search Console e-mail' : a.source}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0">{isOpen(a) ? <Badge tone="accent">{titleCase(a.status || 'open')}</Badge> : <StatusBadge tone="good">{titleCase(a.status)}</StatusBadge>}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="py-10"
            icon={<BellRing className="size-5" />}
            title={alerts.length ? 'No open alerts' : 'No Search Console alerts'}
            description={
              alerts.length
                ? 'Every alert received for this website is resolved.'
                : 'When Google e-mails a Search Console notice for this website — a manual action, a security issue, indexing or Core Web Vitals problems — it appears here and in the Monday report.'
            }
          />
        )}
      </Card>
    </section>
  );
}

function CheckinTable({ rows }: { rows: Checkin[] }) {
  const columns: Column<Checkin>[] = [
    { key: 'month', header: 'Month', sortValue: (c) => c.month, cell: (c) => <span className="whitespace-nowrap font-medium text-ink">{fmtMonth(c.month)}</span> },
    { key: 'manual', header: 'Manual action', sortValue: (c) => (c.manualAction ? 1 : 0), cell: (c) => (c.manualAction ? <StatusBadge tone="critical">Yes</StatusBadge> : <StatusBadge tone="good">None</StatusBadge>) },
    { key: 'security', header: 'Security', sortValue: (c) => (c.securityIssue ? 1 : 0), cell: (c) => (c.securityIssue ? <StatusBadge tone="critical">Issue</StatusBadge> : <StatusBadge tone="good">None</StatusBadge>) },
    { key: 'notIndexed', header: 'Not indexed', align: 'right', sortValue: (c) => c.notIndexedTotal, cell: (c) => c.notIndexedTotal.toLocaleString('en-US') },
    { key: 'indexed', header: 'Indexed', align: 'right', hideOnMobile: true, sortValue: (c) => c.indexedTotal, cell: (c) => (c.indexedTotal == null ? '–' : c.indexedTotal.toLocaleString('en-US')) },
    { key: 'notes', header: 'Notes', hideOnMobile: true, cell: (c) => <span className="line-clamp-2 min-w-[12rem] max-w-[24rem] text-[13px] text-ink-2" title={c.notes}>{c.notes || '–'}</span> },
    { key: 'submitted', header: 'Recorded', hideOnMobile: true, sortValue: (c) => c.submittedAt, cell: (c) => <span className="whitespace-nowrap text-xs text-ink-3">{fmtDate(c.submittedAt)}{c.csvKind ? ` · ${c.csvKind} export` : ''}</span> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(c, i) => `${c.month}|${i}`} initialSort={{ key: 'month', dir: 'desc' }} dense pageSize={12} />;
}

function LatestCheckin({ c }: { c: Checkin }) {
  const share = c.indexedTotal != null && c.indexedTotal + c.notIndexedTotal > 0 ? Math.round((c.indexedTotal / (c.indexedTotal + c.notIndexedTotal)) * 100) : null;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Latest check-in · {fmtMonth(c.month)}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">Recorded {fmtDate(c.submittedAt)}{c.csvKind ? ` from the ${c.csvKind} export of the Pages report` : ''}</p>
        </div>
        <CalendarCheck className="size-4 shrink-0 text-ink-3" aria-hidden />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-ink-3">Manual actions</dt>
          <dd className="mt-1">{c.manualAction ? <StatusBadge tone="critical">Manual action</StatusBadge> : <StatusBadge tone="good">No issues detected</StatusBadge>}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Security issues</dt>
          <dd className="mt-1">{c.securityIssue ? <StatusBadge tone="critical">Security issue</StatusBadge> : <StatusBadge tone="good">No issues detected</StatusBadge>}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Indexed pages</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">{c.indexedTotal != null ? c.indexedTotal.toLocaleString('en-US') : '–'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Not indexed</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">
            {c.notIndexedTotal.toLocaleString('en-US')}
            {share != null && <span className="ml-1.5 text-xs font-normal text-ink-3">{share}% of known pages indexed</span>}
          </dd>
        </div>
      </dl>
      {c.notes && <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">{c.notes}</p>}
      {(c.manualAction || c.securityIssue) && (
        <p className="mt-3 text-[13px] text-critical-text">Fix the issue in Search Console and request a review: rankings stay suppressed until Google lifts it.</p>
      )}
    </Card>
  );
}
