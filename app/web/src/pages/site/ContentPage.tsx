import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BadgeCheck, Briefcase, CalendarClock, CheckCircle2, Clock, ExternalLink as ExternalIcon, FileText, Flame, Inbox, LayoutGrid, PenSquare, Rows3, Target, TrendingUp, Trophy, Undo2, UserRound, XCircle } from 'lucide-react';
import { titleCase, type CaseStudy, type ContentData, type ContentItem, type Report } from '@seo/shared';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useSiteAdmin, useSiteData } from '@/lib/queries';
import { cn, fmtAgo, fmtDate } from '@/lib/utils';
import { Badge, StatusBadge, verdictTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Dialog, DialogClose } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { CountUp, DistributionBar, HeroNextStep, HeroStat, IconTile, ScoreRing, SEQ, Stagger, SummaryHero, type IconTileTone } from '@/components/insight';
import { DataGate, FilterChips, SrOnly, Kind, Panel, RunAnalysisMenu, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { HeroMeter } from './_components/pipeline/home';
import { countBy, daysSince, plural, urlPath } from './_components/format';
import { FileLinks } from './_components/reports';
import { verdictLabel } from '@/components/reports/kit';

export default function ContentPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'content');
  return (
    <div>
      <PageHeader
        icon={<PenSquare />}
        title="Content"
        description="Pages the engine has written for this website, what is live, the weekly blog cadence and the proof that makes pages trustworthy."
        actions={
          <>
            <ToolButton mode="published" icon={<CheckCircle2 className="size-4" />}>
              I published a page
            </ToolButton>
            <ToolButton mode="keyword" variant="primary" icon={<PenSquare className="size-4" />}>
              Write a page
            </ToolButton>
            <RunAnalysisMenu label="More" variant="secondary" />
          </>
        }
      />
      <DataGate
        q={q}
        skeleton={
          <div className="space-y-6" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-[300px] rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-[320px] rounded-xl" />
              <Skeleton className="h-[320px] rounded-xl" />
            </div>
            <Skeleton className="h-[260px] rounded-xl" />
          </div>
        }
      >
        {(d) => <Content d={d} />}
      </DataGate>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  ladder: 'Keyword ladder',
  striking: 'Striking distance',
  trend: 'Rising trend',
  case_study: 'Case study',
  cadence: 'Weekly cadence',
  manual: 'On demand',
  published: 'Reported live',
};
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? (s ? titleCase(s) : 'On demand');
const SOURCE_ICON: Record<string, ReactNode> = {
  ladder: <TrendingUp />,
  striking: <Target />,
  trend: <Flame />,
  case_study: <Trophy />,
  cadence: <CalendarClock />,
  manual: <PenSquare />,
  published: <CheckCircle2 />,
};
const isLive = (i: ContentItem) => i.status === 'published' || !!i.publishedUrl;

/** keyword → newest generated page report (to offer its files next to the pipeline item) */
function reportsByKeyword(reports: readonly Report[]) {
  const m = new Map<string, Report>();
  for (const r of reports) {
    const k = typeof r.summary.keyword === 'string' ? r.summary.keyword.toLowerCase() : '';
    if (k && (!m.has(k) || m.get(k)!.receivedAt < r.receivedAt)) m.set(k, r);
  }
  return m;
}

function Content({ d }: { d: ContentData }) {
  const { org, page, can, tool } = useSitePage();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [source, setSource] = useState('all');
  const [unpublish, setUnpublish] = useState<ContentItem | null>(null);
  const reports = useMemo(() => reportsByKeyword(d.generated), [d.generated]);
  const live = d.items.filter(isLive);
  const waiting = d.items.filter((i) => !isLive(i));
  const stale = waiting.filter((i) => (daysSince(i.startedAt) ?? 0) > 7);
  const sources = countBy(d.items, (i) => i.source || 'manual');
  const shown = d.items.filter((i) => source === 'all' || (i.source || 'manual') === source);
  const cadenceOn = !!d.cadence && d.cadence.pagesPerWeek > 0 && d.cadence.status !== 'paused';

  const fresh = waiting.length - stale.length;
  // the page waiting longest: the hero's next step
  const oldest = [...waiting].sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  const oldestDays = oldest ? daysSince(oldest.startedAt) : null;

  return (
    <Stagger className="space-y-6">
      <SummaryHero
        tone="blue"
        eyebrow={<span className="font-mono tracking-[0.02em] uppercase">Written pages</span>}
        title={d.items.length ? `${live.length} of ${plural(d.items.length, 'written page')} ${live.length === 1 ? 'is' : 'are'} live` : 'No pages written yet'}
        description={
          waiting.length
            ? `${plural(waiting.length, 'page is', 'pages are')} written but not live${stale.length ? `, ${stale.length} for more than a week` : ''}. Nothing ranks before it is published.`
            : d.items.length
              ? 'Every written page is live and tracked.'
              : 'Pages appear here when you write one for a keyword, when a keyword ladder starts its pages, or when the weekly blog cadence writes its posts.'
        }
        aside={
          oldest && can('member') ? (
            <HeroNextStep
              icon={<Inbox />}
              eyebrow={`Next step · ${oldestDays != null ? `${oldestDays} ${oldestDays === 1 ? 'day' : 'days'} waiting` : 'waiting'}`}
              title={`Publish “${oldest.keyword}”, then report its address`}
              actions={
                <ButtonLink to={tool('published', { keyword: oldest.keyword, ...(oldest.existingPageUrl ? { publishedUrl: oldest.existingPageUrl } : {}) })} size="sm" variant="secondary">
                  Report published URL
                </ButtonLink>
              }
            />
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Pages written" value={<CountUp value={d.items.length} />} hint={`${plural(d.generated.length, 'page report')} delivered`} />
            <HeroStat label="Live" value={<CountUp value={live.length} />} hint={d.items.length ? `${Math.round((live.length / d.items.length) * 100)}% of written pages are published` : 'Report a page once it is published'} />
            <HeroStat label="Waiting to publish" value={<CountUp value={waiting.length} />} hint={stale.length ? `${stale.length} for more than a week` : 'Nothing ranks before it is live'} />
            <HeroStat
              label="Business profile (E-E-A-T)"
              value={<CountUp value={d.readiness.score} format={(v) => `${Math.round(v)}%`} />}
              hint={
                <>
                  <HeroMeter value={d.readiness.score} label="Profile readiness" />
                  <span className="mt-1.5 block">{d.readiness.missing.length ? `${plural(d.readiness.missing.length, 'item')} missing` : 'Complete: bylines and schema are filled in'}</span>
                </>
              }
            />
          </>
        }
      />

      {stale.length > 0 && (
        <Callout tone="warning" title={`${plural(stale.length, 'page has', 'pages have')} been waiting more than a week`}>
          {stale
            .slice(0, 4)
            .map((i) => `“${i.keyword}”`)
            .join(', ')}
          {stale.length > 4 ? ` and ${stale.length - 4} more` : ''}. Publish {stale.length === 1 ? 'it' : 'them'}, then use “Report published URL” so the engine checks the page and starts tracking it.
        </Callout>
      )}

      <section>
        <SectionHeading
          icon={<LayoutGrid />}
          title="Content pipeline"
          description="Every page started by a ladder, the weekly cadence or on demand"
          actions={
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'board', label: <span className="inline-flex items-center gap-1"><LayoutGrid className="size-3.5" aria-hidden />Board</span> },
                { value: 'table', label: <span className="inline-flex items-center gap-1"><Rows3 className="size-3.5" aria-hidden />Table</span> },
              ]}
            />
          }
        />
        {d.items.length > 0 && (
          <DistributionBar
            className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-card"
            label="Written pages by status"
            segments={[
              { label: 'Live', value: live.length, color: SEQ[5] },
              { label: 'Waiting up to a week', value: fresh, color: SEQ[2] },
              { label: 'Waiting more than a week', value: stale.length, color: 'var(--warning)' },
            ]}
          />
        )}
        {d.items.length > 0 && Object.keys(sources).length > 1 && (
          <FilterChips
            className="mb-3"
            label="Source"
            value={source}
            onChange={setSource}
            options={[{ value: 'all', label: 'All sources', count: d.items.length }, ...Object.entries(sources).map(([k, n]) => ({ value: k, label: sourceLabel(k), count: n, icon: <span className="text-ink-3 [&_svg]:size-3.5">{SOURCE_ICON[k] ?? <PenSquare />}</span> }))]}
          />
        )}
        {!d.items.length ? (
          <Card>
            <EmptyState
              icon={<PenSquare className="size-5" />}
              title="No pages written yet"
              description="Pages appear here when you write one for a keyword, when a keyword ladder starts its pages, or when the weekly blog cadence writes its posts every Monday."
              action={
                <>
                  <ToolButton mode="keyword" variant="primary">
                    Write a page
                  </ToolButton>
                  {can('admin') && (
                    <ButtonLink to={page('settings/tracking')} variant="secondary">
                      Turn on weekly blog posts
                    </ButtonLink>
                  )}
                </>
              }
            />
          </Card>
        ) : view === 'board' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BoardColumn title="Written — waiting to publish" icon={<Clock />} tone="warning" count={shown.filter((i) => !isLive(i)).length}>
              {shown
                .filter((i) => !isLive(i))
                .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
                .map((i) => (
                  <PipelineCard key={`${i.keyword}-${i.requestId}`} item={i} report={reports.get(i.keyword.toLowerCase())} onUnpublish={setUnpublish} />
                ))}
            </BoardColumn>
            <BoardColumn title="Published" icon={<CheckCircle2 />} tone="good" count={shown.filter(isLive).length}>
              {shown
                .filter(isLive)
                .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
                .map((i) => (
                  <PipelineCard key={`${i.keyword}-${i.requestId}`} item={i} report={reports.get(i.keyword.toLowerCase())} onUnpublish={setUnpublish} />
                ))}
            </BoardColumn>
          </div>
        ) : (
          <Card className="p-4">
            <PipelineTable rows={shown} reports={reports} onUnpublish={setUnpublish} />
          </Card>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <CadenceCard cadence={d.cadence} on={cadenceOn} />
        <ProfileCard d={d} />
      </div>

      <CaseStudies items={d.caseStudies} />

      <section>
        <Panel icon={<FileText />} title="Generated pages" description="Keyword reports and finished pages with their downloads (Word, PDF, HTML, Markdown and meta.json)">
          <GeneratedTable reports={d.generated} orgId={org.id} />
        </Panel>
      </section>

      {unpublish && <UnpublishDialog item={unpublish} onClose={() => setUnpublish(null)} />}
    </Stagger>
  );
}

function BoardColumn({ title, icon, tone, count, children }: { title: string; icon: ReactNode; tone: IconTileTone; count: number; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/70 p-3">
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <IconTile size="sm" tone={count ? tone : 'neutral'}>
          {icon}
        </IconTile>
        <h3 className="min-w-0 flex-1 font-display text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        <span className="rounded-full bg-surface px-2 text-xs font-semibold tabular text-ink-2 shadow-card">{count}</span>
      </div>
      <div className="space-y-2">{count ? children : <p className="px-1 py-6 text-center text-[13px] text-ink-3">Nothing here.</p>}</div>
    </div>
  );
}

function SourceLine({ item }: { item: ContentItem }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-3">
      <span className="text-accent-text [&_svg]:size-3.5" aria-hidden>
        {SOURCE_ICON[item.source || 'manual'] ?? <PenSquare />}
      </span>
      {sourceLabel(item.source)}
      {item.source === 'ladder' && item.rung ? ` · rung ${item.rung}` : ''}
      {item.week ? ` · week ${item.week}` : ''}
    </span>
  );
}

function PipelineCard({ item, report, onUnpublish }: { item: ContentItem; report?: Report; onUnpublish: (i: ContentItem) => void }) {
  const { org, can, tool } = useSitePage();
  const liveNow = isLive(item);
  const days = daysSince(item.startedAt);
  return (
    <Card className="p-3.5 transition-[border-color,box-shadow,translate] duration-200 ease-brand hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{item.keyword}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <SourceLine item={item} />
            {item.pageType && <Kind>{item.pageType}</Kind>}
          </div>
        </div>
        {liveNow ? <StatusBadge tone="good">Live</StatusBadge> : <Badge tone={days != null && days > 7 ? 'warning' : 'accent'} icon={<CalendarClock className="size-3" aria-hidden />}>{days != null ? `${days} ${days === 1 ? 'day' : 'days'} waiting` : 'Waiting'}</Badge>}
      </div>
      <div className="mt-2 space-y-1 text-xs text-ink-3">
        <p>Started {fmtDate(item.startedAt)}{liveNow && item.publishedAt ? ` · published ${fmtDate(item.publishedAt)}` : ''}</p>
        {item.existingPageUrl && !liveNow && <p className="truncate">Improves {urlPath(item.existingPageUrl)}</p>}
        {item.publishedUrl && (
          <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-accent-text hover:underline transition-colors duration-150 ease-brand">
            {urlPath(item.publishedUrl)}
            <ExternalIcon className="size-3 shrink-0" aria-hidden />
          </a>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {report ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Link to={paths.report(org.id, report.id)} className="text-xs font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
              Report
            </Link>
            <FileLinks orgId={org.id} files={report.files} />
          </span>
        ) : (
          <span />
        )}
        <span className="flex flex-wrap gap-1.5">
          {!liveNow && can('member') && (
            <ButtonLink to={tool('published', { keyword: item.keyword, ...(item.existingPageUrl ? { publishedUrl: item.existingPageUrl } : {}) })} size="sm">
              Report published URL
            </ButtonLink>
          )}
          {liveNow && can('member') && (
            <ButtonLink to={tool('published', { keyword: item.keyword, publishedUrl: item.publishedUrl })} size="sm" variant="ghost">
              Re-check page
            </ButtonLink>
          )}
          {liveNow && can('admin') && (
            <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => onUnpublish(item)}>
              Unpublish
            </Button>
          )}
        </span>
      </div>
    </Card>
  );
}

function PipelineTable({ rows, reports, onUnpublish }: { rows: ContentItem[]; reports: Map<string, Report>; onUnpublish: (i: ContentItem) => void }) {
  const { org, can, tool } = useSitePage();
  const columns: Column<ContentItem>[] = [
    { key: 'keyword', header: 'Keyword', sortValue: (r) => r.keyword, cell: (r) => <span className="font-medium text-ink">{r.keyword}</span> },
    { key: 'source', header: 'Source', sortValue: (r) => r.source, cell: (r) => <SourceLine item={r} /> },
    { key: 'pageType', header: 'Page type', hideOnMobile: true, sortValue: (r) => r.pageType, cell: (r) => (r.pageType ? <Kind>{r.pageType}</Kind> : '–') },
    { key: 'status', header: 'Status', sortValue: (r) => (isLive(r) ? 1 : 0), cell: (r) => (isLive(r) ? <StatusBadge tone="good">Live</StatusBadge> : <Badge tone="accent" icon={<CalendarClock className="size-3" aria-hidden />}>Waiting</Badge>) },
    { key: 'startedAt', header: 'Started', sortValue: (r) => r.startedAt, cell: (r) => <span className="text-[13px] text-ink-2">{fmtDate(r.startedAt)}</span> },
    { key: 'publishedAt', header: 'Published', hideOnMobile: true, sortValue: (r) => r.publishedAt || '', cell: (r) => <span className="text-[13px] text-ink-2">{r.publishedAt ? fmtDate(r.publishedAt) : '–'}</span> },
    {
      key: 'url',
      header: 'URL',
      hideOnMobile: true,
      sortValue: (r) => r.publishedUrl,
      cell: (r) =>
        r.publishedUrl ? (
          <a href={r.publishedUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[14rem] truncate text-[13px] text-accent-text hover:underline transition-colors duration-150 ease-brand">
            {urlPath(r.publishedUrl)}
          </a>
        ) : (
          '–'
        ),
    },
    {
      key: 'files',
      header: 'Files',
      hideOnMobile: true,
      cell: (r) => {
        const rep = reports.get(r.keyword.toLowerCase());
        return rep ? <FileLinks orgId={org.id} files={rep.files} /> : <span className="text-ink-3">–</span>;
      },
    },
    {
      key: 'act',
      header: <SrOnly>Actions</SrOnly>,
      align: 'right',
      cell: (r) =>
        isLive(r) ? (
          can('admin') ? (
            <Button size="sm" variant="ghost" onClick={() => onUnpublish(r)}>
              Unpublish
            </Button>
          ) : null
        ) : can('member') ? (
          <ButtonLink to={tool('published', { keyword: r.keyword, ...(r.existingPageUrl ? { publishedUrl: r.existingPageUrl } : {}) })} size="sm" variant="secondary">
            Report URL
          </ButtonLink>
        ) : null,
    },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => `${r.keyword}-${r.requestId}`} initialSort={{ key: 'startedAt', dir: 'desc' }} searchable searchPlaceholder="Search keywords" dense />;
}

function UnpublishDialog({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const { org, site } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Mark “${item.keyword}” as not published?`}
      description="Use this when the page was taken down or reported by mistake. It moves back to “waiting to publish”, the ladder rung goes back to written, and weekly checks stop treating it as live. The page itself is not touched."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={admin.isPending}
            onClick={() =>
              admin.mutate(
                { action: 'unpublish', keyword: item.keyword },
                {
                  onSuccess: (r) => {
                    if (r.ok) {
                      toast.success(`“${item.keyword}” marked as not published`);
                      onClose();
                    } else toast.error(r.error ?? 'The website admin workflow did not apply the change');
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Unpublish
          </Button>
        </>
      }
    >
      {item.publishedUrl && (
        <p className="text-sm text-ink-2">
          Live URL: <span className="break-all text-ink">{item.publishedUrl}</span>
        </p>
      )}
    </Dialog>
  );
}

function CadenceCard({ cadence, on }: { cadence: ContentData['cadence']; on: boolean }) {
  const { can, page } = useSitePage();
  return (
    <Panel
      title="Weekly blog posts"
      icon={<CalendarClock className="size-4" />}
      description="Content cadence: written every Monday at 10:00"
      actions={
        can('admin') ? (
          <ButtonLink to={page('settings/tracking')} size="sm" variant="secondary">
            Change
          </ButtonLink>
        ) : undefined
      }
    >
      <div className="flex items-center gap-4 rounded-lg bg-surface-2/60 p-3.5">
        <IconTile size="lg" tone={on ? 'solid' : 'neutral'}>
          <PenSquare />
        </IconTile>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-3xl leading-none font-semibold tracking-[-0.01em] text-ink">
            <CountUp value={on ? cadence!.pagesPerWeek : 0} />
          </span>
          <span className="text-sm text-ink-2">{on ? (cadence!.pagesPerWeek === 1 ? 'post per week' : 'posts per week') : 'posts per week — off'}</span>
          {cadence?.status === 'paused' && <StatusBadge tone="warning">Paused</StatusBadge>}
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        {on
          ? 'Each Monday the engine picks the next pages in this order: the next rung of your keyword ladder, queries in striking distance (positions 4–20), then rising Google Trends searches. Each post arrives as HTML, Markdown and meta.json, ready to publish.'
          : 'Turn on 1–3 posts a week and the engine writes them every Monday from your ladder, striking-distance queries and rising searches — about $1.20 per post.'}
      </p>
    </Panel>
  );
}

function ProfileCard({ d }: { d: ContentData }) {
  const { page, can } = useSitePage();
  const p = d.profile;
  const score = d.readiness.score;
  return (
    <Panel
      title="Business profile (E-E-A-T)"
      icon={<BadgeCheck className="size-4" />}
      description="Author byline, expert reviewer and business details used in every page and its schema"
      actions={
        can('admin') ? (
          <ButtonLink to={page('settings/profile')} size="sm" variant={score < 100 ? 'primary' : 'secondary'}>
            {score < 100 ? 'Complete the profile' : 'Edit'}
          </ButtonLink>
        ) : undefined
      }
    >
      <div className="flex items-center gap-4">
        <ScoreRing label="Profile readiness" value={score} display={<CountUp value={score} format={(v) => `${Math.round(v)}%`} />} valueText={`${score}%`} size={72} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{score >= 100 ? 'Complete' : score >= 60 ? 'Nearly there' : 'Needs work'}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{d.readiness.missing.length ? `${plural(d.readiness.missing.length, 'item')} missing` : 'Every item is filled in'}</p>
        </div>
      </div>
      {p && (p.author.name || p.reviewer.name || p.businessName) && (
        <dl className="mt-4 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
          {p.author.name && (
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
              <div>
                <dt className="text-xs text-ink-3">Author</dt>
                <dd className="text-ink">
                  {p.author.name}
                  {p.author.jobTitle ? `, ${p.author.jobTitle}` : ''}
                </dd>
              </div>
            </div>
          )}
          {p.reviewer.name && (
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
              <div>
                <dt className="text-xs text-ink-3">Expert reviewer</dt>
                <dd className="text-ink">
                  {p.reviewer.name}
                  {p.reviewer.jobTitle ? `, ${p.reviewer.jobTitle}` : ''}
                </dd>
              </div>
            </div>
          )}
          {p.businessName && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-3">Business</dt>
              <dd className="text-ink">
                {p.businessName}
                {[p.address.city, p.address.country].filter(Boolean).length ? ` · ${[p.address.city, p.address.country].filter(Boolean).join(', ')}` : ''}
              </dd>
            </div>
          )}
        </dl>
      )}
      {d.readiness.missing.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-2">Missing</p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {d.readiness.missing.map((m) => (
              <li key={m} className="flex items-start gap-2 text-[13px] text-ink-2">
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-good-text">
          <CheckCircle2 className="size-4" aria-hidden />
          Every page carries a byline, author box and Person schema
        </p>
      )}
    </Panel>
  );
}

function CaseStudies({ items }: { items: CaseStudy[] }) {
  return (
    <section>
      <SectionHeading icon={<Briefcase />} title="Case studies" description="Proof library: results that later pages cite, each with its own page" actions={<ToolButton mode="case_study" size="sm">Write a case study</ToolButton>} />
      {items.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const live = c.status === 'published' || !!c.pageUrl;
            return (
              <Card key={c.caseId} className="flex flex-col p-4 transition-[border-color,box-shadow,translate] duration-200 ease-brand hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-start gap-3">
                    <IconTile size="sm" tone={live ? 'good' : 'blue'}>
                      <Trophy />
                    </IconTile>
                    <h3 className="min-w-0 pt-1 text-sm font-semibold leading-snug text-ink">{c.title || c.service}</h3>
                  </span>
                  {live ? <StatusBadge tone="good">Published</StatusBadge> : <Badge tone="accent">{c.status ? titleCase(c.status) : 'Draft'}</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {c.clientPublic ? c.clientName : `${c.clientName || 'Client'} (anonymised)`}
                  {c.industry ? ` · ${c.industry}` : ''} · {fmtDate(c.createdAt)}
                </p>
                {c.results && <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{c.results}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  {c.service && <Kind>{c.service}</Kind>}
                  {c.keyword && <Kind>{c.keyword}</Kind>}
                  {c.pageUrl && (
                    <a href={c.pageUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-accent-text hover:underline transition-colors duration-150 ease-brand">
                      View page
                      <ExternalIcon className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            className="py-8"
            icon={<Briefcase className="size-5" />}
            title="No case studies yet"
            description="A case study turns one client result into proof: its own page now, and evidence that every later page can cite — one of the strongest trust signals for Google and AI answers."
            action={<ToolButton mode="case_study" variant="primary">Write a case study</ToolButton>}
          />
        </Card>
      )}
    </section>
  );
}

function GeneratedTable({ reports, orgId }: { reports: Report[]; orgId: string }) {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  const columns: Column<Report>[] = [
    {
      key: 'title',
      header: 'Page',
      sortValue: (r) => r.title,
      cell: (r) => (
        <Link to={paths.report(orgId, r.id)} className="block min-w-[9rem] font-medium text-ink transition-colors duration-150 ease-brand hover:text-accent-text">
          {s(r.summary.keyword) || r.title}
        </Link>
      ),
    },
    { key: 'verdict', header: 'Verdict', sortValue: (r) => s(r.summary.verdict), cell: (r) => (s(r.summary.verdict) ? <StatusBadge tone={verdictTone(s(r.summary.verdict))}>{verdictLabel(s(r.summary.verdict))}</StatusBadge> : '–') },
    { key: 'score', header: 'Score', align: 'right', sortValue: (r) => n(r.summary.score), cell: (r) => n(r.summary.score) ?? '–' },
    { key: 'page', header: 'Page type', hideOnMobile: true, sortValue: (r) => s(r.summary.page), cell: (r) => (s(r.summary.page) ? <Kind className="h-auto max-w-[18rem] whitespace-normal py-0.5 leading-snug">{s(r.summary.page)}</Kind> : '–') },
    { key: 'kind', header: 'Contains', hideOnMobile: true, cell: (r) => <span className="text-[13px] text-ink-2">{r.summary.hasPage ? 'Report + page' : 'Keyword report'}</span> },
    { key: 'receivedAt', header: 'Delivered', sortValue: (r) => r.receivedAt, cell: (r) => <span className="text-[13px] text-ink-3" title={fmtDate(r.receivedAt)}>{fmtAgo(r.receivedAt)}</span> },
    { key: 'files', header: 'Downloads', cell: (r) => <FileLinks orgId={orgId} files={r.files} /> },
  ];
  return (
    <DataTable
      rows={reports}
      columns={columns}
      rowKey={(r) => r.id}
      initialSort={{ key: 'receivedAt', dir: 'desc' }}
      searchable
      searchPlaceholder="Search pages"
      searchText={(r) => `${r.title} ${s(r.summary.keyword)}`}
      pageSize={10}
      empty={<span>No pages generated yet. Use “Write a page” for a keyword to get the report and the finished page.</span>}
      className={cn(!reports.length && 'opacity-90')}
    />
  );
}
