import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink as ExternalIcon, Link2, Mail } from 'lucide-react';
import { PROSPECT_STATUSES, compactNumber, titleCase, type BacklinkLink, type BacklinksData, type Prospect, type ProspectStatus } from '@seo/shared';
import { errorMessage, fileUrl } from '@/lib/api';
import { useSiteAdmin, useSiteData } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { Badge, StatusBadge, severityTone } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Field, Select, Textarea } from '@/components/ui/field';
import { CopyButton, Delta, ExternalLink, KeyValue, PageHeader, StatTile } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { Chips, DataGate, FilterChips, KpiGrid, MetricSwitch, Kind, Panel, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { countBy, diff, fmtMonthShort, lastTwo, sortByDate, timeAxisFormat, urlPath } from './_components/format';

export default function BacklinksPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'backlinks');
  const r = q.data?.report;
  return (
    <div>
      <PageHeader
        title="Backlinks"
        description={`Who links to ${site.domain}, the links you lost or should reject, the gap to your competitors and an outreach pipeline to win new ones.`}
        actions={
          <>
            {r?.prospectsCsvFileId && (
              <a href={fileUrl(org.id, r.prospectsCsvFileId, true)} className={buttonClass('secondary')} download>
                <Download className="size-4" aria-hidden />
                prospects.csv
              </a>
            )}
            {r?.disavowFileId && (
              <a href={fileUrl(org.id, r.disavowFileId, true)} className={buttonClass('secondary')} download>
                <Download className="size-4" aria-hidden />
                disavow.txt
              </a>
            )}
            <ToolButton mode="backlinks" variant="primary" icon={<Link2 className="size-4" />}>
              Run a backlink check
            </ToolButton>
          </>
        }
      />
      <DataGate q={q}>{(d) => <Backlinks d={d} refetching={q.isFetching} />}</DataGate>
    </div>
  );
}

function Backlinks({ d, refetching }: { d: BacklinksData; refetching: boolean }) {
  const { can, page } = useSitePage();
  const snaps = useMemo(() => sortByDate(d.snapshots, (s) => s.checkedAt), [d.snapshots]);
  const [L, P] = lastTwo(snaps);

  if (!L && !d.latest && !d.report && !d.prospects.length)
    return (
      <EmptyState
        icon={<Link2 className="size-5" />}
        title="No backlink check yet"
        description="The check lists who links to you, lost and spammy links, broken links worth reclaiming, sites that link to your competitors but not to you, unlinked brand mentions — and drafts the outreach e-mails. About $0.25; then a light weekly watch and a full report monthly."
        action={
          <>
            <ToolButton mode="backlinks" variant="primary">
              Run the first check
            </ToolButton>
            {can('admin') && (
              <ButtonLink to={page('settings/tracking')} variant="secondary">
                Monitor settings
              </ButtonLink>
            )}
          </>
        }
      />
    );

  const since = P ? `against the check of ${fmtDate(P.checkedAt)}` : 'appear from the next check';
  const spark = (key: 'referringDomains' | 'backlinks' | 'rank' | 'spamScore' | 'brokenBacklinks') => snaps.map((s) => ({ v: s[key] }));

  return (
    <div className="space-y-6">
      {L && (
        <KpiGrid cols={5}>
          <StatTile label="Referring domains" value={compactNumber(L.referringDomains)} delta={<Delta value={diff(L.referringDomains, P?.referringDomains)} suffix="" digits={0} />} trend={<Sparkline data={spark('referringDomains')} dataKey="v" />} hint={`${compactNumber(L.referringDomainsNofollow)} nofollow only`} />
          <StatTile label="Backlinks" value={compactNumber(L.backlinks)} delta={<Delta value={diff(L.backlinks, P?.backlinks)} suffix="" digits={0} />} trend={<Sparkline data={spark('backlinks')} dataKey="v" />} hint={`${L.newLinks} new · ${L.lostLinks} lost since the last check`} />
          <StatTile label="Domain rank" value={L.rank} delta={<Delta value={diff(L.rank, P?.rank)} suffix="" digits={0} />} trend={<Sparkline data={spark('rank')} dataKey="v" />} hint="Authority on a 0–1,000 scale" />
          <StatTile
            label="Spam score"
            value={
              <span className="inline-flex items-center gap-2">
                {L.spamScore}
                {L.spamScore >= 50 ? <StatusBadge tone="serious">High</StatusBadge> : L.spamScore >= 30 ? <StatusBadge tone="warning">Elevated</StatusBadge> : <StatusBadge tone="good">Low</StatusBadge>}
              </span>
            }
            delta={<Delta value={diff(L.spamScore, P?.spamScore)} suffix="" digits={0} upIsGood={false} />}
            hint={`${L.spammyNew} spammy new ${L.spammyNew === 1 ? 'link' : 'links'} · 0–100, lower is better`}
          />
          <StatTile label="Broken backlinks" value={compactNumber(L.brokenBacklinks)} delta={<Delta value={diff(L.brokenBacklinks, P?.brokenBacklinks)} suffix="" digits={0} upIsGood={false} />} hint="Links to pages of yours that no longer load — reclaim with a redirect" />
        </KpiGrid>
      )}
      {L && <p className="-mt-3 text-xs text-ink-3">{`${titleCase(L.mode || 'light')} check of ${fmtDate(L.checkedAt)}; changes ${since}.`}</p>}

      {d.report && d.report.alerts.length > 0 && (
        <Card className="divide-y divide-line">
          {d.report.alerts.map((a, i) => (
            <div key={i} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <StatusBadge tone={severityTone(a.level)}>{titleCase(a.level)}</StatusBadge>
              <p className="min-w-0 flex-1 text-sm text-ink">{a.text}</p>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HistoryChart rows={d.latest?.timeseries ?? []} loading={refetching} />
        <ChangesChart snaps={snaps} loading={refetching} />
      </div>

      <section>
        <SectionHeading title="Links" description="Lost and new links since the previous check, and links that look spammy" />
        <Card className="px-4 pb-4">
          <Tabs defaultValue={(d.latest?.lost.length ?? 0) > 0 ? 'lost' : 'new'}>
            <TabList>
              <Tab value="lost" count={d.latest?.lost.length ?? 0}>
                Lost
              </Tab>
              <Tab value="new" count={d.latest?.new.length ?? 0}>
                New
              </Tab>
              <Tab value="spammy" count={d.report?.spammy.length ?? 0}>
                Spammy
              </Tab>
            </TabList>
            <TabPanel value="lost">
              <LinkTable rows={d.latest?.lost ?? []} empty="No links lost since the previous check." />
            </TabPanel>
            <TabPanel value="new">
              <LinkTable rows={d.latest?.new ?? []} empty="No new links since the previous check." />
            </TabPanel>
            <TabPanel value="spammy">
              <LinkTable rows={d.report?.spammy ?? []} empty="No spammy links found." />
              {(d.report?.spammy.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-ink-3">
                  Spammy links (link farms, PBN offers) rarely hurt on their own; disavow them only if they keep coming or you see a manual action.{' '}
                  {d.report?.disavowFileId ? 'The disavow list above is ready for review.' : ''}
                </p>
              )}
            </TabPanel>
          </Tabs>
        </Card>
      </section>

      {!!(d.report?.gap.length || d.latest?.competitors.length) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
          <Panel title="Link gap" description="Sites linking to your competitors but not to you — the warmest prospects" className="xl:col-span-2" flush>
            <div className="px-4 pb-4">
              <GapTable rows={d.report?.gap ?? []} />
            </div>
          </Panel>
          <Panel title="Competitors compared" description="From the latest full report">
            <CompetitorList rows={d.latest?.competitors ?? []} />
          </Panel>
        </div>
      )}

      <section>
        <SectionHeading title="Outreach pipeline" description="Prospects from lost links, broken-link reclaims, unlinked mentions and the link gap, each with a drafted e-mail. Mark them as you go; won links are confirmed automatically on the next check." />
        <Card className="px-4 pb-4">
          <Pipeline prospects={d.prospects} />
        </Card>
      </section>
    </div>
  );
}

type HMetric = 'referringDomains' | 'backlinks' | 'rank';
function HistoryChart({ rows, loading }: { rows: { month: string; backlinks: number; referringDomains: number; rank: number }[]; loading: boolean }) {
  const [m, setM] = useState<HMetric>('referringDomains');
  const series: Record<HMetric, Series> = {
    referringDomains: { key: 'referringDomains', label: 'Referring domains' },
    backlinks: { key: 'backlinks', label: 'Backlinks' },
    rank: { key: 'rank', label: 'Domain rank' },
  };
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  return (
    <ChartCard
      title="Monthly history"
      description="End-of-month totals from the backlink index"
      loading={loading}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={[{ value: 'referringDomains', label: 'Domains' }, { value: 'backlinks', label: 'Links' }, { value: 'rank', label: 'Rank' }]} />}
      table={{
        columns: [
          { key: 'month', label: 'Month', format: (v) => fmtMonthShort(v) },
          { key: 'referringDomains', label: 'Referring domains', align: 'right' },
          { key: 'backlinks', label: 'Backlinks', align: 'right' },
          { key: 'rank', label: 'Rank', align: 'right' },
        ],
        rows: [...sorted].reverse(),
      }}
    >
      {sorted.length ? (
        <TimeSeriesChart data={sorted} xKey="month" series={[series[m]]} xFormat={fmtMonthShort} area height={230} />
      ) : (
        <EmptyState className="py-10" title="No monthly history yet" description="The monthly full report adds the backlink history." />
      )}
    </ChartCard>
  );
}

function ChangesChart({ snaps, loading }: { snaps: BacklinksData['snapshots']; loading: boolean }) {
  const series: Series[] = [
    { key: 'newLinks', label: 'New links' },
    { key: 'lostLinks', label: 'Lost links' },
  ];
  const rows = snaps.map((s) => ({ checkedAt: s.checkedAt, newLinks: s.newLinks, lostLinks: s.lostLinks, importantLost: s.importantLost, spammyNew: s.spammyNew, mode: s.mode }));
  return (
    <ChartCard
      title="Link changes per check"
      description="Weekly light watch and monthly full checks"
      series={series}
      legendShape="rect"
      loading={loading}
      table={{
        columns: [
          { key: 'checkedAt', label: 'Check', format: (v) => fmtDate(String(v)) },
          { key: 'mode', label: 'Type', format: (v) => titleCase(String(v || '')) },
          { key: 'newLinks', label: 'New', align: 'right' },
          { key: 'lostLinks', label: 'Lost', align: 'right' },
          { key: 'importantLost', label: 'Important lost', align: 'right' },
          { key: 'spammyNew', label: 'Spammy new', align: 'right' },
        ],
        rows: [...rows].reverse(),
      }}
    >
      {rows.length ? (
        <BarsChart data={rows} categoryKey="checkedAt" series={series} categoryFormat={timeAxisFormat(rows.map((r) => r.checkedAt))} height={230} />
      ) : (
        <EmptyState className="py-10" title="No checks stored yet" />
      )}
    </ChartCard>
  );
}

function LinkTable({ rows, empty }: { rows: BacklinkLink[]; empty: string }) {
  const columns: Column<BacklinkLink>[] = [
    {
      key: 'from',
      header: 'From',
      sortValue: (l) => l.fromDomain,
      cell: (l) => (
        <div className="min-w-[12rem] max-w-[20rem]">
          <a href={l.fromUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent-text">
            {l.fromDomain}
            <ExternalIcon className="size-3 text-ink-3" aria-hidden />
          </a>
          {l.title && <p className="truncate text-xs text-ink-3" title={l.title}>{l.title}</p>}
        </div>
      ),
    },
    { key: 'anchor', header: 'Anchor', hideOnMobile: true, sortValue: (l) => l.anchor, cell: (l) => <span className="block max-w-[14rem] truncate text-[13px] text-ink-2" title={l.anchor}>{l.anchor || <span className="text-ink-3">(no text)</span>}</span> },
    { key: 'to', header: 'To', hideOnMobile: true, sortValue: (l) => l.toUrl, cell: (l) => <span className="text-[13px] text-ink-2">{urlPath(l.toUrl)}</span> },
    { key: 'follow', header: 'Type', sortValue: (l) => (l.dofollow ? 1 : 0), cell: (l) => <Kind>{l.dofollow ? 'dofollow' : 'nofollow'}</Kind> },
    { key: 'rank', header: 'Authority', align: 'right', sortValue: (l) => l.domainRank, cell: (l) => l.domainRank },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (l) => l.spam, cell: (l) => (l.spam >= 50 ? <StatusBadge tone="serious">{l.spam}</StatusBadge> : l.spam) },
    { key: 'seen', header: 'Seen', hideOnMobile: true, sortValue: (l) => l.lastSeen, cell: (l) => <span className="whitespace-nowrap text-xs text-ink-3">{fmtDate(l.firstSeen)} → {fmtDate(l.lastSeen)}</span> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(l, i) => `${l.fromUrl}-${i}`} initialSort={{ key: 'rank', dir: 'desc' }} dense pageSize={10} empty={empty} />;
}

type Gap = NonNullable<BacklinksData['report']>['gap'][number];
function GapTable({ rows }: { rows: Gap[] }) {
  const columns: Column<Gap>[] = [
    { key: 'domain', header: 'Domain', sortValue: (g) => g.domain, cell: (g) => <ExternalLink href={`https://${g.domain}`} className="font-medium">{g.domain}</ExternalLink> },
    { key: 'rank', header: 'Authority', align: 'right', sortValue: (g) => g.rank, cell: (g) => g.rank },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (g) => g.spam, cell: (g) => (g.spam >= 50 ? <StatusBadge tone="serious">{g.spam}</StatusBadge> : g.spam) },
    { key: 'linksTo', header: 'Links to', cell: (g) => <Chips items={g.linksTo} max={3} /> },
    { key: 'backlinks', header: 'Links', align: 'right', hideOnMobile: true, sortValue: (g) => g.backlinks, cell: (g) => g.backlinks },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(g) => g.domain} initialSort={{ key: 'rank', dir: 'desc' }} dense pageSize={8} empty="The link gap is refreshed quarterly with the full report." />;
}

function CompetitorList({ rows }: { rows: NonNullable<BacklinksData['latest']>['competitors'] }) {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  if (!rows.length) return <p className="text-[13px] text-ink-3">Add competitors in the monitor settings to compare links.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((c) => {
        const rank = num(c.rank ?? c.domain_rank ?? c.domainRank);
        const rd = num(c.referring_domains ?? c.referringDomains);
        const bl = num(c.backlinks);
        return (
          <li key={c.domain} className="text-sm">
            <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-ink hover:text-accent-text">
              {c.domain}
            </a>
            <span className="text-xs text-ink-3">
              {rd != null && <span className="tabular text-ink">{compactNumber(rd)} domains</span>}
              {bl != null && <span className="tabular"> · {compactNumber(bl)} links</span>}
              {rank != null && <span className="tabular"> · rank {rank}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const TYPE_LABEL: Record<string, string> = { lost: 'Lost link', reclaim: 'Broken-link reclaim', mention: 'Unlinked mention', gap: 'Link gap' };
const typeLabel = (t: string) => TYPE_LABEL[t] ?? (t ? titleCase(t) : 'Prospect');
const STATUS_LABEL: Record<ProspectStatus, string> = { new: 'New', contacted: 'Contacted', won: 'Won', rejected: 'Rejected', ignored: 'Ignored' };
const statusOf = (p: Prospect): ProspectStatus => ((PROSPECT_STATUSES as readonly string[]).includes(p.status) ? (p.status as ProspectStatus) : 'new');

function Pipeline({ prospects }: { prospects: Prospect[] }) {
  const [type, setType] = useState('all');
  const [open, setOpen] = useState<Prospect | null>(null);
  const byStatus = countBy(prospects, statusOf);
  const types = countBy(prospects, (p) => p.type || 'other');
  const scoped = prospects.filter((p) => type === 'all' || (p.type || 'other') === type);

  if (!prospects.length) return <EmptyState className="py-8" title="No prospects yet" description="The monthly full backlink report fills the pipeline with lost links to win back, broken links to redirect, mentions without a link and link-gap sites." />;

  return (
    <>
      <Tabs defaultValue={PROSPECT_STATUSES.find((s) => byStatus[s]) ?? 'new'}>
        <TabList>
          {PROSPECT_STATUSES.map((s) => (
            <Tab key={s} value={s} count={byStatus[s] ?? 0}>
              {STATUS_LABEL[s]}
            </Tab>
          ))}
        </TabList>
        {Object.keys(types).length > 1 && (
          <FilterChips className="mt-3" label="Prospect type" value={type} onChange={setType} options={[{ value: 'all', label: 'All types', count: prospects.length }, ...Object.entries(types).map(([k, n]) => ({ value: k, label: typeLabel(k), count: n }))]} />
        )}
        {PROSPECT_STATUSES.map((s) => {
          const rows = scoped.filter((p) => statusOf(p) === s).sort((a, b) => b.rank - a.rank);
          return (
            <TabPanel key={s} value={s}>
              {rows.length ? (
                <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {rows.map((p) => (
                    <ProspectCard key={`${p.prospectDomain}-${p.type}`} p={p} onOpen={() => setOpen(p)} />
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-ink-3">No {STATUS_LABEL[s].toLowerCase()} prospects{type !== 'all' ? ' of this type' : ''}.</p>
              )}
            </TabPanel>
          );
        })}
      </Tabs>
      {open && <ProspectDialog p={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ProspectCard({ p, onOpen }: { p: Prospect; onOpen: () => void }) {
  const st = statusOf(p);
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <ExternalLink href={`https://${p.prospectDomain}`} className="text-sm font-semibold text-ink">
            {p.prospectDomain}
          </ExternalLink>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Kind>{typeLabel(p.type)}</Kind>
            {p.rank > 0 && <span className="text-xs text-ink-3">authority {p.rank}</span>}
            {p.spamScore >= 50 && <StatusBadge tone="serious">spam {p.spamScore}</StatusBadge>}
          </div>
        </div>
        {st === 'won' ? <StatusBadge tone="good">Won{p.wonAt ? ` ${fmtDate(p.wonAt)}` : ''}</StatusBadge> : st !== 'new' ? <Badge>{STATUS_LABEL[st]}</Badge> : null}
      </div>
      {p.detail && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{p.detail}</p>}
      {p.note && <p className="mt-2 rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2">Note: {p.note}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="text-xs text-ink-3">since {fmtDate(p.firstSeen)}</span>
        <Button size="sm" variant={p.outreachBody ? 'secondary' : 'ghost'} icon={<Mail className="size-3.5" />} onClick={onOpen}>
          {p.outreachBody ? 'Outreach e-mail' : 'Details'}
        </Button>
      </div>
    </li>
  );
}

function ProspectDialog({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const { org, site, can } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  const [status, setStatus] = useState<ProspectStatus>(statusOf(p));
  const [note, setNote] = useState(p.note ?? '');
  const isAdmin = can('admin');
  const dirty = status !== statusOf(p) || note.trim() !== (p.note ?? '').trim();
  const save = (next?: ProspectStatus) => {
    const s = next ?? status;
    admin.mutate(
      { action: 'prospect', prospectDomain: p.prospectDomain, type: p.type, status: s, note: note.trim() },
      {
        onSuccess: (r) => {
          if (r.ok) {
            toast.success(`${p.prospectDomain}: ${STATUS_LABEL[s].toLowerCase()}`);
            onClose();
          } else toast.error(r.error ?? 'The prospect was not updated');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  const mailto = p.outreachBody ? `mailto:?subject=${encodeURIComponent(p.outreachSubject)}&body=${encodeURIComponent(p.outreachBody)}` : null;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={p.prospectDomain}
      description={`${typeLabel(p.type)}${p.rank ? ` · authority ${p.rank}` : ''}${p.spamScore ? ` · spam ${p.spamScore}` : ''}`}
      footer={
        isAdmin ? (
          <>
            {statusOf(p) === 'new' && (
              <Button variant="secondary" onClick={() => save('contacted')} loading={admin.isPending && !dirty}>
                Mark as contacted
              </Button>
            )}
            <Button onClick={() => save()} disabled={!dirty} loading={admin.isPending && dirty}>
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      <KeyValue
        className="mb-4"
        items={[
          ...(p.detail ? [{ label: 'Why', value: p.detail }] : []),
          ...(p.sourceUrl ? [{ label: 'Their page', value: <ExternalLink href={p.sourceUrl}>{p.sourceUrl}</ExternalLink> }] : []),
          ...(p.targetUrl ? [{ label: 'Your page', value: <ExternalLink href={p.targetUrl}>{urlPath(p.targetUrl)}</ExternalLink> }] : []),
          { label: 'First seen', value: fmtDate(p.firstSeen) },
        ]}
      />
      {p.outreachBody ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Subject</span>
              <CopyButton text={p.outreachSubject} />
            </div>
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink">{p.outreachSubject}</p>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">E-mail</span>
              <span className="flex gap-1.5">
                {mailto && (
                  <a href={mailto} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 hover:bg-surface-2">
                    <Mail className="size-3.5" aria-hidden />
                    Open in mail
                  </a>
                )}
                <CopyButton text={p.outreachBody} />
              </span>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 font-sans text-sm leading-relaxed text-ink-2">{p.outreachBody}</pre>
          </div>
          <p className="text-xs text-ink-3">Drafted by the engine — read it, add the contact person and send it from your own mailbox.</p>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">No outreach e-mail for this prospect; reclaims are fixed on your own site with a 301 redirect.</p>
      )}
      {isAdmin && (
        <div className={cn('mt-5 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-[200px_1fr]')}>
          <Field label="Status">
            {(f) => (
              <Select {...f} value={status} onChange={(e) => setStatus(e.target.value as ProspectStatus)}>
                {PROSPECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Note" optional hint="Who you contacted, replies, follow-up dates">
            {(f) => <Textarea {...f} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      )}
    </Dialog>
  );
}
