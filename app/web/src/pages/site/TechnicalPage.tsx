import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, BellRing, CheckCircle2, Circle, Eye, FileArchive, FileSearch, FileText, Gauge, ListChecks, Siren, Sparkles, TrendingUp } from 'lucide-react';
import { foldMinor, minorFoldNote, titleCase, type AuditPoint, type Finding, type FindingStatus, type IndexCoverage, type PageWatch, type RecheckRequest, type TechnicalData } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { api, errorMessage, fileUrl } from '@/lib/api';
import { qk, useSiteData } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { Badge, StatusBadge, severityTone } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { Delta, PageHeader, scoreTone } from '@/components/ui/misc';
import { CountUp, DisclosureButton, DistributionBar, HeroStat, IconTile, InfoTip, InsightItem, MetricCard, ScoreRing, Stagger, SummaryHero, type IconTileTone } from '@/components/insight';
import { DataTable, type Column } from '@/components/ui/table';
import { TicketButton, useTicketStates } from '@/components/site/TicketButton';
import { DataGate, FillHeight, FilterChips, Panel, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { countBy, dateLabelFormat, diff, plural, sortByDate, timeAxisFormat } from './_components/format';
import { FileChip, ReportList, isFixPackFile } from './_components/reports';
import { ChartTitle, DashSkeleton, HeroEyebrow } from './_components/visuals';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
type Sev = (typeof SEVERITIES)[number];
const sevKey = (s: string): Sev => {
  const x = s.toLowerCase();
  return (SEVERITIES as readonly string[]).includes(x) ? (x as Sev) : x.startsWith('crit') ? 'critical' : x.startsWith('warn') ? 'medium' : 'info';
};
const SEV_RANK: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const reportTypeLabel = (t: string) => (/full/i.test(t) ? 'Full SEO report' : 'Technical audit');

export default function TechnicalPage() {
  const { org, site } = useSitePage();
  const [params, setParams] = useSearchParams();
  const auditId = params.get('auditId') ?? undefined;
  const q = useSiteData(org.id, site.id, 'technical', { auditId });
  const audits = useMemo(() => sortByDate(q.data?.audits ?? [], (a) => a.auditedAt, 'desc'), [q.data?.audits]);
  const selected = q.data?.selectedAuditId ?? audits[0]?.auditId ?? '';
  const auditDate = dateLabelFormat(audits.map((a) => a.auditedAt));
  return (
    <div>
      <PageHeader
        icon={<Gauge />}
        title="Technical health"
        description="Crawl results, health score and every issue the audits found: what is new, what is still open and what you fixed."
        actions={
          <>
            {audits.length > 1 && (
              <div className="w-64">
                <Select
                  aria-label="Audit"
                  value={selected}
                  onChange={(e) => {
                    const next = new URLSearchParams(params);
                    if (e.target.value === audits[0]?.auditId) next.delete('auditId');
                    else next.set('auditId', e.target.value);
                    setParams(next, { replace: true });
                  }}
                >
                  {audits.map((a, i) => (
                    <option key={a.auditId} value={a.auditId}>
                      {auditDate(a.auditedAt)} · {a.healthScore}/100{i === 0 ? ' (latest)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <ToolButton mode="audit" variant="primary" icon={<Gauge className="size-4" />}>
              Run an audit
            </ToolButton>
          </>
        }
      />
      <DataGate q={q} skeleton={<DashSkeleton />}>
        {(d) => <Technical d={d} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

function Technical({ d, refetching }: { d: TechnicalData; refetching: boolean }) {
  const { org, site, page, can } = useSitePage();
  const audits = useMemo(() => sortByDate(d.audits, (a) => a.auditedAt), [d.audits]);

  if (!audits.length)
    return (
      <EmptyState
        icon={<Gauge className="size-5" />}
        title="No audit yet"
        description="A technical audit crawls up to 1,000 pages, checks indexing, speed, structured data, AI readiness and Search Console, and scores the site out of 100. It also delivers a fix pack (robots.txt, llms.txt, redirects, schema). Monthly audits then run on the 1st and only re-crawl when your sitemap changed."
        action={
          <>
            <ToolButton mode="audit" variant="primary">
              Run a technical audit
            </ToolButton>
            {can('admin') && (
              <ButtonLink to={page('settings/tracking')} variant="secondary">
                Monthly audit settings
              </ButtonLink>
            )}
          </>
        }
      />
    );

  const sel: AuditPoint = audits.find((a) => a.auditId === d.selectedAuditId) ?? audits[audits.length - 1];
  // R66: compare only with the audit the server chose, the previous one of the same report type. The old fallback to the list
  // neighbour is gone: a full report and a technical audit score different findings on different weights, so the neighbour of the
  // other type is not a baseline (it gave "25 new issues" and "down from 83 to 70").
  const prev: AuditPoint | null = audits.find((a) => a.auditId === d.previousAuditId) ?? null;
  // one score scale per chart: the trend lines hold the selected audit's own type only
  const trend = audits.filter((a) => a.reportType === sel.reportType);
  const st = countBy(d.findings, (f) => f.status);
  const tone = scoreTone(sel.healthScore);
  const fixReport = sortByDate(d.reports, (r) => r.receivedAt, 'desc').find((r) => r.files.some(isFixPackFile));
  const fixZip = fixReport?.files.find((f) => f.kind === 'zip' && isFixPackFile(f));
  const fixLoose = fixReport?.files.filter((f) => f.kind !== 'zip' && isFixPackFile(f)) ?? [];
  const grade = sel.grade || (tone === 'good' ? 'Good' : tone === 'warning' ? 'Needs work' : 'Poor');
  const scoreDelta = diff(sel.healthScore, prev?.healthScore);

  return (
    <Stagger className="space-y-6">
      {/* how healthy the site is, what changed since the last audit */}
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag={reportTypeLabel(sel.reportType)}>{`${fmtDate(sel.auditedAt)} · ${sel.pagesCrawled.toLocaleString('en-US')} pages crawled · ${sel.scheduled ? 'monthly schedule' : 'run on demand'}`}</HeroEyebrow>}
        title={healthHeadline(sel)}
        description={
          prev
            ? `Since the ${reportTypeLabel(prev.reportType).toLowerCase()} of ${fmtDate(prev.auditedAt)}: ${plural(st.fixed ?? 0, 'issue')} fixed, ${plural(st.new ?? 0, 'new issue')}, ${st.open ?? 0} still open. Health score ${sel.healthScore >= prev.healthScore ? 'up' : 'down'} from ${prev.healthScore} to ${sel.healthScore}.`
            : audits.some((a) => a !== sel && a.reportType !== sel.reportType)
              ? `The first ${reportTypeLabel(sel.reportType).toLowerCase()} of this website. It is not compared with the ${/full/i.test(sel.reportType) ? 'technical audits' : 'full SEO reports'}: they check different things and score on different weights.`
              : 'The first audit of this website. The next one shows what you fixed.'
        }
        aside={
          <div className="flex items-center gap-4 md:flex-col md:gap-2">
            <ScoreRing label="Health score" value={sel.healthScore} display={<CountUp value={sel.healthScore} />} suffix="/100" size={112} />
            <span className="text-sm font-medium text-on-ink">{grade}</span>
          </div>
        }
        stats={
          prev ? (
            <>
              <HeroStat label="Fixed since the last audit" value={<CountUp value={st.fixed ?? 0} />} hint={`audit of ${fmtDate(prev.auditedAt)}`} />
              <HeroStat label="New issues" value={<CountUp value={st.new ?? 0} />} hint="found for the first time" />
              <HeroStat label="Still open" value={<CountUp value={st.open ?? 0} />} hint="found by both audits" />
              <HeroStat label="Health score change" value={scoreDelta != null ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta} pts` : '-'} hint={`${prev.healthScore} to ${sel.healthScore} of 100`} />
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Health score"
          icon={<Gauge />}
          tone={tone === 'accent' ? 'blue' : tone}
          value={
            <span>
              <CountUp value={sel.healthScore} />
              <span className="text-base font-medium text-ink-3">/100</span>
            </span>
          }
          delta={<Delta value={scoreDelta} suffix=" pts" digits={0} />}
          deltaLabel={prev ? `vs ${fmtDate(prev.auditedAt)}` : 'first audit'}
          sparkline={<Sparkline data={trend.map((a) => ({ healthScore: a.healthScore }))} dataKey="healthScore" />}
          info="80 and above is good, 60-79 needs work, below 60 is poor"
          meta={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge tone={tone === 'accent' ? 'neutral' : tone}>{grade}</StatusBadge>
              {prev ? `change vs ${fmtDate(prev.auditedAt)}` : 'first audit'}
            </span>
          }
        />
        <MetricCard
          label="Issues found"
          icon={<ListChecks />}
          value={<CountUp value={sel.findings} />}
          delta={<Delta value={diff(sel.findings, prev?.findings)} suffix="" digits={0} upIsGood={false} />}
          deltaLabel={prev ? `vs previous ${reportTypeLabel(prev.reportType).toLowerCase()}` : undefined}
          sparkline={<Sparkline data={trend.map((a) => ({ findings: a.findings }))} dataKey="findings" invert />}
          meta={prev ? `${st.new ?? 0} new · ${st.fixed ?? 0} fixed · ${st.open ?? 0} still open` : 'The next audit shows what you fixed'}
        />
        <MetricCard
          label="Critical or high"
          icon={<Siren />}
          tone={sel.critical ? 'critical' : sel.high ? 'serious' : 'good'}
          value={<CountUp value={sel.critical + sel.high} />}
          info="Fix these first: they keep pages out of Google or cost the most rankings"
          sparkline={
            <div className="flex h-full items-center">
              <DistributionBar label="Issues by severity" segments={severitySegments(sel)} legend={false} className="w-full" />
            </div>
          }
          meta={
            <span className="flex flex-wrap gap-1.5">
              <StatusBadge tone={sel.critical ? 'critical' : 'neutral'}>{sel.critical} critical</StatusBadge>
              <StatusBadge tone={sel.high ? 'serious' : 'neutral'}>{sel.high} high</StatusBadge>
              <StatusBadge tone={sel.medium ? 'warning' : 'neutral'}>{sel.medium} medium</StatusBadge>
              <StatusBadge tone="neutral">{sel.low} low</StatusBadge>
            </span>
          }
        />
        <MetricCard
          label="Pages crawled"
          icon={<FileSearch />}
          value={<CountUp value={sel.pagesCrawled} />}
          sparkline={trend.length > 1 ? <Sparkline data={trend.map((a) => ({ pagesCrawled: a.pagesCrawled }))} dataKey="pagesCrawled" /> : undefined}
          meta={`${reportTypeLabel(sel.reportType)} · ${sel.scheduled ? 'monthly schedule' : 'run on demand'} · ${fmtDate(sel.auditedAt)}`}
        />
      </div>

      {fixReport && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <IconTile tone="solid" size="lg">
            <FileArchive />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="flex items-center gap-1 font-display text-base font-semibold tracking-[-0.01em] text-ink">
                  Fix pack ready · audit of {fmtDate(fixReport.receivedAt)}
                  <InfoTip label="About the fix pack">Each file comes with a README that says where it goes on your site; apply them, then the next audit checks the result.</InfoTip>
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">Ready-to-apply files: robots.txt, llms.txt, structured data (JSON-LD), redirects and an internal-links list, with a README on where each one goes.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {fixZip && (
                  <a href={fileUrl(org.id, fixZip.id, true)} download={fixZip.fileName} className={cn(buttonClass('primary', 'md'), 'shrink-0')}>
                    <FileArchive className="size-4" aria-hidden />
                    Download all (.zip)
                  </a>
                )}
                <GuideButton id="fix-pack" vars={{ domain: site.domain }} label="How to apply it" />
              </div>
            </div>
            {fixLoose.length > 0 && (
              <span className="mt-3 flex flex-wrap gap-1.5">
                {fixLoose.map((f) => (
                  <FileChip key={f.id} orgId={org.id} f={f} />
                ))}
              </span>
            )}
          </div>
        </Card>
      )}

      <FixFirst findings={d.findings} hasPrevious={!!prev} sel={sel} />

      <WatchPanel watch={d.watch} coverage={d.indexCoverage} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={<ChartTitle icon={<TrendingUp />}>Health score over time</ChartTitle>}
          description={`${plural(trend.length, reportTypeLabel(sel.reportType).toLowerCase())} · 80 and above is good${trend.length < audits.length ? ' · other report types score on other weights and are left out' : ''}`}
          loading={refetching}
          table={{
            columns: [
              { key: 'auditedAt', label: 'Audit', format: (v) => dateLabelFormat(trend.map((a) => a.auditedAt))(String(v)) },
              { key: 'healthScore', label: 'Score', align: 'right' },
              { key: 'grade', label: 'Grade' },
              { key: 'findings', label: 'Issues', align: 'right' },
              { key: 'pagesCrawled', label: 'Pages', align: 'right' },
            ],
            rows: [...trend].reverse().map((a) => ({ ...a })),
          }}
        >
          <FillHeight min={240}>
            {(h) => <TimeSeriesChart data={trend.map((a) => ({ auditedAt: a.auditedAt, healthScore: a.healthScore }))} xKey="auditedAt" xFormat={timeAxisFormat(trend.map((a) => a.auditedAt))} series={[{ key: 'healthScore', label: 'Health score', format: (v) => `${v}/100` }]} yDomain={[0, 100]} reference={{ y: 80, label: 'Good' }} area height={h} />}
          </FillHeight>
        </ChartCard>
        <CategoryChart rows={d.byCategory} loading={refetching} />
      </div>

      <section>
        <SectionHeading
          icon={<ListChecks />}
          title="Findings"
          description={prev ? `Compared with the audit of ${fmtDate(prev.auditedAt)}: new since then, still open, or fixed` : 'Every issue of this audit'}
          info="Filter by severity and status, search by issue or category; the affected count shows the change since the previous audit."
        />
        <Card className="p-4">
          <FindingsTable findings={d.findings} hasPrevious={!!prev} auditId={sel.auditId} />
        </Card>
      </section>

      <Panel title="Audit reports" icon={<FileText />} description="PDF report, the diff since the last audit and the fix pack (.zip)" flush>
        <ReportList orgId={org.id} reports={d.reports} empty={<p className="px-5 pb-6 pt-2 text-sm text-ink-3">Reports of audits run before the app was connected are not stored here.</p>} />
      </Panel>
    </Stagger>
  );
}

/** The hero's headline: the score and what needs fixing first. */
function healthHeadline(a: AuditPoint): string {
  const head = `Health ${a.healthScore}/100`;
  if (a.critical) return `${head}: ${plural(a.critical, 'critical issue')}${a.high ? ` and ${a.high} high` : ''} to fix`;
  if (a.high) return `${head}: ${plural(a.high, 'high-severity issue')} to fix`;
  if (a.medium) return `${head}: no critical issues, ${plural(a.medium, 'medium issue')} left`;
  return `${head}: no critical or high issues`;
}

/** Severities of one audit as status-coloured buckets (these colours are status: always with the words in the legend). */
function severitySegments(a: AuditPoint) {
  return [
    { label: 'Critical', value: a.critical, color: 'var(--critical)' },
    { label: 'High', value: a.high, color: 'var(--serious)' },
    { label: 'Medium', value: a.medium, color: 'var(--warning)' },
    { label: 'Low', value: a.low, color: 'var(--ink-3)' },
  ];
}

const SEV_TILE: Record<Sev, IconTileTone> = { critical: 'critical', high: 'serious', medium: 'warning', low: 'neutral', info: 'neutral' };

/** The open critical and high issues (or the medium ones when there are none) as a to-do list; the full table follows below. */
function FixFirst({ findings, hasPrevious, sel }: { findings: Finding[]; hasPrevious: boolean; sel: AuditPoint }) {
  const open = findings.filter((f) => f.status !== 'fixed');
  const urgent = open.filter((f) => SEV_RANK[sevKey(f.severity)] <= 1);
  // G26: the audit ranks its findings by likely impact (severity x pages affected x the clicks and impressions those pages get), and the
  // server hands them over in that order. Audits written before 2026-10-12 carry no weight, so they keep the severity order.
  const rows = (urgent.length ? urgent : open.filter((f) => sevKey(f.severity) === 'medium'))
    .slice()
    .sort((a, b) =>
      a.impact != null && b.impact != null
        ? b.impact - a.impact || SEV_RANK[sevKey(a.severity)] - SEV_RANK[sevKey(b.severity)]
        : SEV_RANK[sevKey(a.severity)] - SEV_RANK[sevKey(b.severity)] || b.affectedCount - a.affectedCount);
  if (!rows.length) return null;
  const shown = rows.slice(0, 6);
  return (
    <Panel
      title={urgent.length ? 'Fix these first' : 'Worth fixing next'}
      icon={<Siren />}
      iconTone={urgent.length ? (urgent.some((f) => sevKey(f.severity) === 'critical') ? 'critical' : 'serious') : 'warning'}
      description={urgent.length ? `${plural(urgent.length, 'critical or high issue')} still open, biggest first` : 'No critical or high issue is open: these medium ones come next'}
      flush
      footer={rows.length > shown.length ? `${rows.length - shown.length} more in the findings table below` : undefined}
    >
      <div className="px-5 pb-4">
        <DistributionBar label="Issues of this audit by severity" segments={severitySegments(sel)} />
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {shown.map((f) => {
          const sev = sevKey(f.severity);
          return (
            <InsightItem
              key={`${f.key}-${f.status}`}
              tone={SEV_TILE[sev]}
              meta={
                <>
                  <StatusBadge tone={severityTone(f.severity)}>{titleCase(f.severity)}</StatusBadge>
                  <span className="text-xs text-ink-3">{f.category}</span>
                  {hasPrevious && STATUS_META[f.status]?.node}
                </>
              }
              title={f.title}
              description={
                f.affectedCount > 0 || f.impactBasis ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {f.impactBasis || `${plural(f.affectedCount, 'page')} affected`}
                    {f.previousCount != null && f.previousCount !== f.affectedCount && <Delta value={f.affectedCount - f.previousCount} suffix="" digits={0} upIsGood={false} label="vs previous audit" />}
                  </span>
                ) : undefined
              }
              actionPosition="side"
            />
          );
        })}
      </ul>
    </Panel>
  );
}

const SEV_SERIES: Series[] = [
  { key: 'critical', label: 'Critical', color: 'var(--critical)' },
  { key: 'high', label: 'High', color: 'var(--serious)' },
  { key: 'medium', label: 'Medium', color: 'var(--warning)' },
  { key: 'low', label: 'Low', color: 'var(--ink-3)' },
];

function CategoryChart({ rows, loading }: { rows: TechnicalData['byCategory']; loading: boolean }) {
  const sorted = [...rows].sort((a, b) => b.critical * 1000 + b.high * 100 + b.medium * 10 + b.low - (a.critical * 1000 + a.high * 100 + a.medium * 10 + a.low));
  return (
    <ChartCard
      title={<ChartTitle icon={<BarChart3 />}>Issues by category</ChartTitle>}
      description="Number of issues per area, by severity"
      series={SEV_SERIES}
      legendShape="rect"
      loading={loading}
      table={{
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'critical', label: 'Critical', align: 'right' },
          { key: 'high', label: 'High', align: 'right' },
          { key: 'medium', label: 'Medium', align: 'right' },
          { key: 'low', label: 'Low', align: 'right' },
        ],
        rows: sorted.map((r) => ({ ...r })),
      }}
    >
      {sorted.length ? (
        <BarsChart
          data={sorted.map((r) => ({ ...r }))}
          categoryKey="category"
          series={SEV_SERIES}
          horizontal
          stacked
          height={Math.max(160, 44 + sorted.length * 34)}
          categoryWidth={132}
          categoryFormat={(v) => {
            const s = String(v ?? '');
            return s.length > 20 ? `${s.slice(0, 19)}...` : s;
          }}
        />
      ) : (
        <EmptyState className="py-10" title="No issues in this audit" description="Every check passed." />
      )}
    </ChartCard>
  );
}

const STATUS_META: Record<FindingStatus, { label: string; node: ReactNode }> = {
  new: { label: 'New', node: <Badge tone="accent" icon={<Sparkles className="size-3" aria-hidden />}>New</Badge> },
  open: { label: 'Open', node: <Badge icon={<Circle className="size-3" aria-hidden />}>Open</Badge> },
  fixed: { label: 'Fixed', node: <Badge tone="good" icon={<CheckCircle2 className="size-3" aria-hidden />}>Fixed</Badge> },
  no_longer_seen: { label: 'No longer seen', node: <Badge icon={<Circle className="size-3" aria-hidden />}>No longer seen</Badge> },
};

type SevFilter = Sev | 'all';
type StatusFilter = FindingStatus | 'all';

function FindingsTable({ findings: all, hasPrevious, auditId }: { findings: Finding[]; hasPrevious: boolean; auditId: string }) {
  const { site } = useSitePage();
  // G4: with Jira / Linear / Asana connected, every open finding can become one ticket, and its state shows here
  const ticketing = useTicketStates(site.id);
  const [sev, setSev] = useState<SevFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cat, setCat] = useState('all');
  const [showMinor, setShowMinor] = useState(false);
  // G18-2 (2026-10-12, FIX_PLAN §3.9): the minor band is folded into one line, exactly as the audit report folds it (the same rule, from
  // the stored severity and impact). Nothing is removed, the folded rows open with one click, and the counts above include them.
  const { main, minor } = useMemo(() => foldMinor(all), [all]);
  const findings = showMinor ? all : main;
  const minorId = 'minor-findings';
  const categories = [...new Set(findings.map((f) => f.category))].sort();
  const base = findings.filter((f) => (cat === 'all' || f.category === cat) && (status === 'all' || f.status === status));
  const sevCounts = countBy(base, (f) => sevKey(f.severity));
  const statusCounts = countBy(
    findings.filter((f) => (cat === 'all' || f.category === cat) && (sev === 'all' || sevKey(f.severity) === sev)),
    (f) => f.status,
  );
  const rows = base.filter((f) => sev === 'all' || sevKey(f.severity) === sev);

  const columns: Column<Finding>[] = [
    { key: 'severity', header: 'Severity', sortValue: (f) => SEV_RANK[sevKey(f.severity)], cell: (f) => <StatusBadge tone={severityTone(f.severity)}>{titleCase(f.severity)}</StatusBadge> },
    {
      key: 'title',
      header: 'Issue',
      sortValue: (f) => f.title,
      cell: (f) => (
        <div className="min-w-[14rem]">
          <p className={f.status === 'fixed' ? 'text-ink-3 line-through decoration-ink-3/50' : 'font-medium text-ink'}>{f.title}</p>
          <p className="text-xs text-ink-3 md:hidden">{f.category}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, sortValue: (f) => f.category, cell: (f) => <span className="text-[13px] text-ink-2">{f.category}</span> },
    {
      key: 'affected',
      header: 'Affected',
      align: 'right',
      sortValue: (f) => f.affectedCount,
      cell: (f) => (
        <span className="inline-flex flex-col items-end">
          {f.affectedCount > 0 ? f.affectedCount.toLocaleString('en-US') : f.status === 'fixed' ? '0' : '-'}
          {f.previousCount != null && f.previousCount !== f.affectedCount && <Delta value={f.affectedCount - f.previousCount} suffix="" digits={0} upIsGood={false} className="text-[11px]" />}
        </span>
      ),
    },
    ...(hasPrevious ? [{ key: 'status', header: 'Status', sortValue: (f: Finding) => ['new', 'open', 'fixed'].indexOf(f.status), cell: (f: Finding) => STATUS_META[f.status]?.node ?? f.status }] : []),
    // G11 (2026-10-13): mark it fixed and the daily key-page watch judges that one finding again the next morning
    { key: 'recheck', header: 'Fix check', sortValue: (f: Finding) => f.recheck?.state ?? '', cell: (f: Finding) => <RecheckCell finding={f} auditId={auditId} /> },
    ...(ticketing
      ? [{ key: 'ticket', header: 'Ticket', cell: (f: Finding) => (f.status === 'fixed' || !f.key ? <span className="text-ink-3">-</span> : <TicketButton siteId={site.id} source={{ type: 'finding', auditId, findingKey: f.key }} />) }]
      : []),
  ];

  if (!all.length) return <EmptyState className="py-8" title="No findings stored for this audit" description="Audits before v4.5 stored only their score; run a new audit for the full list." />;

  return (
    <div className="space-y-3">
      {minor.length > 0 && (
        <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
          <DisclosureButton
            open={showMinor}
            onToggle={() => setShowMinor(!showMinor)}
            controls={minorId}
            variant="link"
            label={`Minor items (${minor.length}): show them in the table`}
            openLabel={`Minor items (${minor.length}): hide them again`}
          />
          <p className="mt-1 text-xs text-ink-3">{minorFoldNote(minor.length)}</p>
        </div>
      )}
      {!findings.length && <EmptyState className="py-8" title="Only minor items in this audit" description="Nothing of real impact is open. Open the minor items above to see what is left." />}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Severity"
          value={sev}
          onChange={setSev}
          options={[{ value: 'all' as SevFilter, label: 'All severities', count: base.length }, ...SEVERITIES.filter((s) => sevCounts[s] || s === 'critical' || s === 'high').map((s) => ({ value: s as SevFilter, label: titleCase(s), count: sevCounts[s] ?? 0 }))]}
        />
        {hasPrevious && (
          <FilterChips
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Any status', count: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
              { value: 'new', label: 'New', count: statusCounts.new ?? 0 },
              { value: 'open', label: 'Open', count: statusCounts.open ?? 0 },
              { value: 'fixed', label: 'Fixed', count: statusCounts.fixed ?? 0 },
            ]}
          />
        )}
      </div>
      <div id={minorId}>
        <DataTable
        rows={rows}
        columns={columns}
        rowKey={(f) => `${f.key}-${f.status}`}
        initialSort={{ key: 'severity', dir: 'asc' }}
        searchable
        searchPlaceholder="Search issues"
        searchText={(f) => `${f.title} ${f.category}`}
        dense
        pageSize={25}
        empty="No issue matches these filters."
        toolbar={
          categories.length > 1 ? (
            <div className="w-56">
              <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          ) : undefined
        }
        />
      </div>
    </div>
  );
}

// ---- G11 + G25 (2026-10-13, FIX_PLAN): the daily key-page watch, and what Google says about the same pages ----
const CHANGE_LABEL: Record<string, string> = {
  page_gone: 'page gone',
  page_error: 'server error',
  page_redirects: 'redirects now',
  noindex_added: 'noindex added',
  noindex_removed: 'noindex gone',
  robots_blocked: 'blocked by robots.txt',
  canonical_moved: 'canonical moved',
  canonical_removed: 'canonical removed',
  robots_changed: 'robots.txt changed',
  title_changed: 'title changed',
  page_back: 'answers again',
};
const pathOnly = (u: string) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

/**
 * The watch panel's one line. B5 (pre-launch run 2026-10-21): a website added today showed "Last check unknown. The watch has not run
 * since", a sentence cut off around a word the app never shows. Three states, each a whole sentence: running, not run yet, stopped.
 */
export function watchLine(watch: Pick<PageWatch, 'running' | 'lastCheckedAt' | 'pagesWatched'>): string {
  const pages = plural(watch.pagesWatched, 'key page');
  if (watch.running) return `${pages} checked every morning · last check ${fmtDate(watch.lastCheckedAt)}`;
  if (!watch.lastCheckedAt) return `${pages} ready to watch. The first check runs within a day, every morning after that.`;
  return `Last check ${fmtDate(watch.lastCheckedAt)}. The watch has not run since then, so these pages may have changed without a warning.`;
}

function WatchPanel({ watch, coverage }: { watch: PageWatch | null; coverage: IndexCoverage | null }) {
  if (!watch) {
    return (
      <Panel
        title="Daily key-page watch"
        icon={<Eye />}
        iconTone="neutral"
        description="Checks your most important pages every morning for status, noindex, canonical, title and robots.txt"
      >
        <p className="text-sm text-ink-2">
          It starts once this website is tracked: every morning the engine fetches your key pages (home page, the menu, the pages Search Console brings impressions for, the pages your keyword ladders own) and tells you the same day when one disappears, is set to noindex, starts redirecting, changes its canonical or its title, or when robots.txt changes.
        </p>
      </Panel>
    );
  }
  const problem = watch.pages.filter((p) => p.status >= 400 || p.noindex || p.robotsBlocked);
  return (
    <Panel
      title="Daily key-page watch"
      icon={<Eye />}
      iconTone={problem.length ? 'serious' : watch.running ? 'good' : 'neutral'}
      description={watchLine(watch)}
      flush
    >
      <div className="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3">
        <MetricCard
          label="Pages watched daily"
          value={<CountUp value={watch.pagesWatched} />}
          icon={<Eye />}
          tone="blue"
          meta={watch.pagesNotChecked ? `${watch.pagesNotChecked} could not be read in the last check` : 'free: one plain request per page'}
          info="The key pages come from your site model and page inventory. One plain request each, no paid API, so this can run every day."
        />
        <MetricCard
          label="Changes in the last 7 days"
          value={<CountUp value={watch.changedLast7Days} />}
          icon={<BellRing />}
          tone={watch.changedLast7Days ? 'warning' : 'good'}
          meta={watch.changedLast7Days ? 'alerted the same day' : 'nothing changed'}
          info="A page gone, a noindex, a redirect, a moved canonical, a changed title, or a changed robots.txt. You also get these on the Alerts page."
        />
        <MetricCard
          label="In Google's index"
          value={coverage && coverage.checked ? `${coverage.indexed}/${coverage.checked}` : '-'}
          icon={<FileSearch />}
          tone={coverage && coverage.notIndexed ? 'warning' : 'blue'}
          meta={coverage ? (coverage.notChecked ? `${coverage.notChecked} not checked yet` : 'every key page inspected') : 'Search Console not connected'}
          info={coverage?.text ?? "Connect Search Console to see which of these pages Google has indexed and which canonical it chose."}
        />
      </div>
      {watch.changes.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {watch.changes.map((c) => (
            <InsightItem
              key={`${c.url}-${c.at}`}
              tone={c.changes.some((x) => /gone|noindex_added|robots_blocked|error/.test(x)) ? 'critical' : 'warning'}
              meta={
                <>
                  {c.changes.map((x) => (
                    <Badge key={x}>{CHANGE_LABEL[x] ?? x.replace(/_/g, ' ')}</Badge>
                  ))}
                  <span className="text-xs text-ink-3">{fmtDate(c.at)}</span>
                </>
              }
              title={pathOnly(c.url)}
              titleAttr={c.url}
              clampTitle
              actionPosition="side"
            />
          ))}
        </ul>
      )}
      {coverage && (
        <div className="border-t border-line px-5 py-3">
          <p className="text-[13px] text-ink-2">{coverage.text}</p>
          {(coverage.canonicalMismatch > 0 || coverage.mobileBad > 0) && (
            <p className="mt-1 text-xs text-ink-3">
              {coverage.canonicalMismatch > 0 && `${plural(coverage.canonicalMismatch, 'page')} where Google picked a different canonical than the page itself. `}
              {coverage.mobileBad > 0 && `${plural(coverage.mobileBad, 'page')} Google reports as not mobile-friendly.`}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

const RECHECK_META: Record<string, { label: string; tone: 'accent' | 'good' | 'warning' | undefined }> = {
  requested: { label: 'Re-check queued', tone: 'accent' },
  fixed: { label: 'Fixed (re-checked)', tone: 'good' },
  still_open: { label: 'Still open', tone: 'warning' },
  not_checked: { label: 'Needs the next audit', tone: undefined },
};

/** "I fixed this": asks the daily key-page watch to judge this one finding again, and shows what it answered. */
function RecheckCell({ finding, auditId }: { finding: Finding; auditId: string }) {
  const { org, site, can } = useSitePage();
  const qc = useQueryClient();
  const [asked, setAsked] = useState<RecheckRequest | null>(null);
  const ask = useMutation({
    mutationFn: () => api<RecheckRequest>(`/api/orgs/${org.id}/sites/${site.id}/technical/findings/recheck`, { method: 'POST', body: { auditId, findingKey: finding.key } }),
    onSuccess: (r) => {
      setAsked(r);
      toast.success(r.message);
      void qc.invalidateQueries({ queryKey: qk.siteData(site.id, 'technical') });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const state = asked?.state ?? finding.recheck?.state;
  if (state) {
    const m = RECHECK_META[state] ?? { label: state, tone: undefined };
    const note = asked?.message ?? finding.recheck?.note ?? '';
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone={m.tone}>{m.label}</Badge>
        {note && <InfoTip label="What the re-check found">{note}</InfoTip>}
      </span>
    );
  }
  if (finding.status === 'fixed' || !can('member')) return <span className="text-ink-3">-</span>;
  return (
    <Button size="sm" variant="ghost" loading={ask.isPending} onClick={() => ask.mutate()}>
      I fixed this
    </Button>
  );
}
