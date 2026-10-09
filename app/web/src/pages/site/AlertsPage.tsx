import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, BellRing, CalendarCheck, CheckCircle2, ClipboardCheck, FileSearch, Info, Mail, OctagonAlert, ShieldAlert, TriangleAlert } from 'lucide-react';
import { titleCase, type AlertsData, type Checkin, type ConsoleAlert } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard } from '@/components/charts';
import { Badge, StatusBadge, severityTone, type Tone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Delta, PageHeader } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { CountUp, DistributionBar, HeroNextStep, HeroStat, IconTile, ScoreRing, Stagger, SummaryHero, type IconTileTone } from '@/components/insight';
import { DataGate, FilterChips, Panel, SectionHeading, Kind, ToolButton, useSitePage } from './_components/kit';
import { diff, fmtMonth, fmtMonthShort, plural, sortByDate } from './_components/format';

export default function AlertsPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'alerts');
  return (
    <div>
      <PageHeader
        icon={<BellRing />}
        title="Alerts & check-ins"
        description="Search Console notifications for this website, and the monthly check-in of what the Search Console API cannot see: manual actions, security issues and the Pages report."
        actions={
          <ToolButton mode="checkin" variant="primary" icon={<ClipboardCheck className="size-4" />}>
            Record a check-in
          </ToolButton>
        }
      />
      <DataGate
        q={q}
        skeleton={
          <div className="space-y-6" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-[300px] rounded-xl" />
            <Skeleton className="h-[280px] rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-[300px] rounded-xl" />
              <Skeleton className="h-[300px] rounded-xl" />
            </div>
          </div>
        }
      >
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
    <Stagger className="space-y-6">
      {d.checkinDue && (
        <Callout tone="warning" title="This month’s Search Console check-in is due" action={<ToolButton mode="checkin" variant="primary" size="sm">Record it now</ToolButton>}>
          Open Search Console and look at three things: Security & Manual actions (both should say “No issues detected”) and the Pages report (export it as CSV to record what is not indexed and why). It takes about two minutes.
        </Callout>
      )}

      <SummaryHero
        tone="blue"
        eyebrow={<span className="font-mono tracking-[0.02em] uppercase">Search Console</span>}
        title={open.length ? `${plural(open.length, 'open alert')}${urgent ? `, ${urgent} critical or high` : ''}` : 'No open Search Console alerts'}
        description={last ? `Last check-in: ${fmtMonth(last.month)}, recorded ${fmtAgo(last.submittedAt)}.` : 'No monthly check-in recorded yet.'}
        aside={
          d.checkinDue ? (
            <HeroNextStep
              icon={<ClipboardCheck />}
              eyebrow="Next step · about two minutes"
              title="Record this month’s Search Console check-in"
              actions={
                <ToolButton mode="checkin" variant="secondary" size="sm">
                  Record it now
                </ToolButton>
              }
            />
          ) : undefined
        }
        stats={
          <>
            <HeroStat
              label="Open alerts"
              value={<CountUp value={open.length} />}
              hint={open.length ? `${urgent} critical or high · ${d.alerts.length} received in total` : d.alerts.length ? `${d.alerts.length} received, all resolved` : 'No Search Console notifications received'}
            />
            <HeroStat label="Last check-in" value={last ? fmtMonth(last.month) : '–'} hint={last ? `Recorded ${fmtAgo(last.submittedAt)}` : 'Not recorded yet'} />
            <HeroStat
              label="Pages not indexed"
              value={last ? last.notIndexedTotal.toLocaleString('en-US') : '–'}
              delta={last && prev ? <Delta value={diff(last.notIndexedTotal, prev.notIndexedTotal)} suffix="" digits={0} upIsGood={false} label={`vs ${fmtMonth(prev.month)}`} /> : undefined}
              hint={last ? (last.indexedTotal != null ? `${last.indexedTotal.toLocaleString('en-US')} indexed · from the Pages report` : 'From the Pages report') : 'Recorded with the monthly check-in'}
            />
            <HeroStat
              label="Manual actions & security"
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
          </>
        }
      />

      <AlertList alerts={d.alerts} />

      <section>
        <SectionHeading icon={<CalendarCheck />} title="Monthly check-ins" description="What you recorded from Search Console each month" />
        {checkins.length ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title={
                  <span className="flex items-center gap-3">
                    <IconTile size="sm">
                      <BarChart3 />
                    </IconTile>
                    Pages not indexed
                  </span>
                }
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
    </Stagger>
  );
}

const TONE_TILE: Record<Tone, IconTileTone> = { critical: 'critical', serious: 'serious', warning: 'warning', good: 'good', accent: 'blue', neutral: 'neutral' };
const TONE_ICON: Record<Tone, ReactNode> = {
  critical: <OctagonAlert />,
  serious: <TriangleAlert />,
  warning: <TriangleAlert />,
  good: <CheckCircle2 />,
  accent: <Info />,
  neutral: <Info />,
};
/** severity → the ramp of the distribution bar (status colours: severity is a status) */
const SEV_COLOR: Record<Tone, string> = { critical: 'var(--critical)', serious: 'var(--serious)', warning: 'var(--warning)', neutral: 'var(--line-strong)', good: 'var(--good)', accent: 'var(--accent)' };

function AlertList({ alerts }: { alerts: ConsoleAlert[] }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const sorted = useMemo(() => [...alerts].sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.receivedAt.localeCompare(a.receivedAt)), [alerts]);
  const shown = sorted.filter((a) => filter === 'all' || isOpen(a));
  // the shown alerts by severity, strongest first
  const bySev = (['critical', 'serious', 'warning', 'neutral'] as const).map((t) => ({ tone: t, n: shown.filter((a) => severityTone(a.severity) === t).length }));
  const SEV_WORD: Record<string, string> = { critical: 'Critical', serious: 'High', warning: 'Medium', neutral: 'Low or info' };
  return (
    <section>
      <Panel
        icon={<BellRing />}
        title="Search Console alerts"
        description="Notification e-mails from Google Search Console, read automatically and matched to this website"
        flush
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
      >
        {shown.length > 0 && (
          <DistributionBar
            className="px-5 pb-4"
            label={filter === 'open' ? 'Open alerts by severity' : 'Alerts by severity'}
            segments={bySev.map((x) => ({ label: SEV_WORD[x.tone], value: x.n, color: SEV_COLOR[x.tone] }))}
          />
        )}
        {shown.length ? (
          <ol className="relative border-t border-line px-5 py-2 before:absolute before:top-6 before:bottom-6 before:left-[calc(1.25rem+0.875rem)] before:w-px before:bg-line" aria-label="Search Console alerts, most severe first">
            {shown.map((a, i) => {
              const tone = severityTone(a.severity);
              const open = isOpen(a);
              return (
                <li key={`${a.receivedAt}-${i}`} className={cn('relative flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:gap-4', !open && 'opacity-80')}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <IconTile size="sm" tone={TONE_TILE[tone]} className="relative z-[1] ring-4 ring-surface">
                      {TONE_ICON[tone]}
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={tone}>{titleCase(a.severity || 'info')}</StatusBadge>
                        <span className="text-xs text-ink-3" title={fmtDate(a.receivedAt)}>
                          {fmtDate(a.receivedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink">{a.subject}</p>
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
                  </div>
                  <div className="shrink-0 pl-10 sm:pl-0">{open ? <Badge tone="accent">{titleCase(a.status || 'open')}</Badge> : <StatusBadge tone="good">{titleCase(a.status)}</StatusBadge>}</div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState
            className="border-t border-line py-10"
            icon={<BellRing className="size-5" />}
            title={alerts.length ? 'No open alerts' : 'No Search Console alerts'}
            description={
              alerts.length
                ? 'Every alert received for this website is resolved.'
                : 'When Google e-mails a Search Console notice for this website — a manual action, a security issue, indexing or Core Web Vitals problems — it appears here and in the Monday report.'
            }
          />
        )}
      </Panel>
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
    <Panel icon={<CalendarCheck />} title={`Latest check-in · ${fmtMonth(c.month)}`} description={`Recorded ${fmtDate(c.submittedAt)}${c.csvKind ? ` from the ${c.csvKind} export of the Pages report` : ''}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <CheckTile icon={<ShieldAlert />} label="Manual actions" bad={c.manualAction}>
          {c.manualAction ? <StatusBadge tone="critical">Manual action</StatusBadge> : <StatusBadge tone="good">No issues detected</StatusBadge>}
        </CheckTile>
        <CheckTile icon={<ShieldAlert />} label="Security issues" bad={c.securityIssue}>
          {c.securityIssue ? <StatusBadge tone="critical">Security issue</StatusBadge> : <StatusBadge tone="good">No issues detected</StatusBadge>}
        </CheckTile>
      </div>
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-line p-3.5">
        {share != null && <ScoreRing label="Known pages indexed" value={share} tone="accent" display={`${share}%`} size={64} />}
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-3">
          <div>
            <dt className="flex items-center gap-1 text-xs text-ink-3">
              <FileSearch className="size-3.5" aria-hidden />
              Indexed pages
            </dt>
            <dd className="mt-1 font-display text-lg font-semibold text-ink">{c.indexedTotal != null ? c.indexedTotal.toLocaleString('en-US') : '–'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Not indexed</dt>
            <dd className="mt-1 font-display text-lg font-semibold text-ink">
              {c.notIndexedTotal.toLocaleString('en-US')}
              {share != null && <span className="mt-0.5 block font-sans text-xs font-normal text-ink-3">{share}% of known pages indexed</span>}
            </dd>
          </div>
        </dl>
      </div>
      {c.notes && <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">{c.notes}</p>}
      {(c.manualAction || c.securityIssue) && (
        <p className="mt-3 text-[13px] text-critical-text">Fix the issue in Search Console and request a review: rankings stay suppressed until Google lifts it.</p>
      )}
    </Panel>
  );
}

/** One yes / no fact of a check-in, with a status tile. */
function CheckTile({ icon, label, bad, children }: { icon: ReactNode; label: string; bad: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line p-3">
      <span className="flex items-center gap-2 text-xs text-ink-3">
        <IconTile size="xs" tone={bad ? 'critical' : 'good'}>
          {icon}
        </IconTile>
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}
