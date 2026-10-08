import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink as ExternalIcon, FileUp, Link2, Mail, ShieldAlert } from 'lucide-react';
import { PROSPECT_STATUSES, compactNumber, titleCase, type BacklinkLink, type BacklinkRef, type BacklinksData, type Prospect, type ProspectStatus } from '@seo/shared';
import { errorMessage, fileUrl } from '@/lib/api';
import { useLinkImport, useSiteAdmin, useSiteData } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { BarsChart, ChartCard, ShareBars, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { Badge, StatusBadge, severityTone, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { CopyButton, Delta, ExternalLink, KeyValue, PageHeader, StatTile } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { Chips, DataGate, FilterChips, KpiGrid, MetricSwitch, Kind, Panel, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { countBy, diff, fmtMonthShort, lastTwo, sortByDate, timeAxisFormat, urlPath } from './_components/format';

// v4.10 (n8n/seo-agent/BACKLINKS_SPEC.md): DataForSEO is one source among several — Bing Webmaster Tools, the Search Console export you
// upload, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, news and web search — and every important link is checked on
// its page by our own crawler: lost means "checked twice and gone", with the reason.

const SOURCE_LABEL: Record<string, string> = { dfs: 'DataForSEO', bing: 'Bing', gsc: 'Search Console', ga4: 'GA4 visits', cc: 'Common Crawl', wiki: 'Wikipedia', hn: 'Hacker News', news: 'News', web: 'Web search', import: 'Upload' };
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? titleCase(s);
const REASON_LABEL: Record<string, string> = { link_removed: 'Link removed', page_gone: 'Page gone', domain_gone: 'Site gone', not_seen: 'Not seen for 4 months', reported_lost: 'Reported lost — checking' };
const VERIFY: Record<string, { tone: Tone; label: string }> = {
  found: { tone: 'good', label: 'On the page' },
  missing: { tone: 'warning', label: 'Not on the page' },
  gone: { tone: 'serious', label: 'Page gone' },
  blocked: { tone: 'neutral', label: 'Bot-blocked' },
  js: { tone: 'neutral', label: 'Needs JavaScript' },
  error: { tone: 'neutral', label: 'Error' },
  unchecked: { tone: 'neutral', label: 'Not checked yet' },
};
const verifyOf = (v: string) => VERIFY[v] ?? VERIFY.unchecked!;

export default function BacklinksPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'backlinks');
  const r = q.data?.report;
  return (
    <div>
      <PageHeader
        title="Backlinks"
        description={`Who links to ${site.domain} — from every source we can read, each important link checked on its page — what you lost and why, and the sites worth winning next.`}
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
  // DataForSEO's own figures (spam, its referring-domain count) come from the latest check that used it: a free-sources-only check has none
  const dfsSnaps = useMemo(() => snaps.filter((s) => s.mode !== 'free'), [snaps]);
  const [D, DP] = lastTwo(dfsSnaps);
  const unionSnaps = useMemo(() => snaps.filter((s) => s.unionDomains != null), [snaps]);

  if (!L && !d.latest && !d.report && !d.prospects.length && !d.refs.length)
    return (
      <EmptyState
        icon={<Link2 className="size-5" />}
        title="No backlink check yet"
        description="The check merges every source we can read (DataForSEO, Bing, your Search Console export, GA4 visits, the Common Crawl web graph, Wikipedia, news), checks the important links on their pages, and drafts the outreach. About $0.50 a month for the full check; a light weekly watch in between."
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
  const union = L?.unionDomains ?? null;
  const prevUnion = unionSnaps.length > 1 ? unionSnaps[unionSnaps.length - 2]!.unionDomains : null;
  const sparkUnion = (union != null ? unionSnaps.map((s) => ({ v: s.unionDomains })) : dfsSnaps.map((s) => ({ v: s.referringDomains })));
  const live = d.refs.filter((x) => x.status !== 'lost' && x.kind === 'web');
  const drShown = d.refs.some((x) => x.dr != null);

  return (
    <div className="space-y-6">
      {L && (
        <KpiGrid cols={5}>
          <StatTile
            label="Referring sites"
            value={compactNumber(union ?? D?.referringDomains ?? 0)}
            delta={<Delta value={union != null ? diff(union, prevUnion) : diff(D?.referringDomains, DP?.referringDomains)} suffix="" digits={0} />}
            trend={<Sparkline data={sparkUnion} dataKey="v" />}
            hint={union != null ? `all sources · DataForSEO: ${D ? compactNumber(D.referringDomains) : '–'}${D && D !== L ? ` (check of ${fmtDate(D.checkedAt)})` : ''}` : `${compactNumber(D?.referringDomainsNofollow ?? 0)} nofollow only`}
          />
          <StatTile label="Best links" value={L.bestLinks ?? '–'} hint="SEO value 50+ (authority, relevance, placement, follow, checked live)" />
          <StatTile label="Checked on the page" value={L.verifiedLive ?? '–'} hint={L.atRisk ? `${L.atRisk} missed once — checked again next week` : 'links our crawler found where they should be'} />
          <StatTile label="Visits from links" value={L.referralVisits != null ? compactNumber(L.referralVisits) : '–'} hint="GA4 referrals, past year" />
          <StatTile
            label="Spam score"
            value={
              D ? (
                <span className="inline-flex items-center gap-2">
                  {D.spamScore}
                  {D.spamScore >= 50 ? <StatusBadge tone="serious">High</StatusBadge> : D.spamScore >= 30 ? <StatusBadge tone="warning">Elevated</StatusBadge> : <StatusBadge tone="good">Low</StatusBadge>}
                </span>
              ) : (
                '–'
              )
            }
            delta={<Delta value={diff(D?.spamScore, DP?.spamScore)} suffix="" digits={0} upIsGood={false} />}
            hint={D ? `${D.spammyNew} spammy new ${D.spammyNew === 1 ? 'link' : 'links'} · DataForSEO, 0–100${D !== L ? ` (check of ${fmtDate(D.checkedAt)})` : ''}` : 'measured by the full check (DataForSEO)'}
          />
        </KpiGrid>
      )}
      {L && <p className="-mt-3 text-xs text-ink-3">{L.mode === 'free' ? `Free-sources check of ${fmtDate(L.checkedAt)} (no DataForSEO, $0); changes ${since}.` : `${titleCase(L.mode || 'light')} check of ${fmtDate(L.checkedAt)}; changes ${since}.`}</p>}

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

      <Coverage d={d} />

      <section>
        <SectionHeading title="Links" description="Every referring site with its three values — SEO (what it passes in search), visits (what it sends) and brand (earned media, sources AI cites) — and what our crawler found on the page" />
        <Card className="px-4 pb-4">
          <LinkTabs d={d} live={live} />
          {drShown && (
            <p className="mt-3 text-xs text-ink-3">
              DR: <a className="underline" href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">Domain Rating by Ahrefs</a>. Authority: DataForSEO rank, 0–1,000.
            </p>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HistoryChart rows={d.latest?.timeseries ?? []} loading={refetching} />
        <ChangesChart snaps={snaps} loading={refetching} />
      </div>

      {(d.latest?.anchors || (d.latest?.pages.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnchorsPanel anchors={d.latest?.anchors ?? null} />
          <PagesPanel pages={d.latest?.pages ?? []} reclaim={d.report?.reclaim ?? []} />
        </div>
      )}

      <Opportunities d={d} />

      <section>
        <SectionHeading title="Outreach pipeline" description="Prospects scored by value × likelihood (an unlinked mention converts far more often than a cold site), with the contact found on their site and a drafted e-mail; contacted prospects get follow-up drafts after 7 and 14 days. Won is set when the link is found on the page." />
        <Card className="px-4 pb-4">
          <Pipeline prospects={d.prospects} />
        </Card>
      </section>
    </div>
  );
}

// ---------------- where the links come from ----------------
function Coverage({ d }: { d: BacklinksData }) {
  const { can } = useSitePage();
  const [upload, setUpload] = useState(false);
  const c = d.latest?.coverage ?? null;
  const st = c?.status ?? null;
  const gscUpload = d.imports.filter((i) => i.source.startsWith('gsc')).sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const other = d.imports.find((i) => i.source === 'csv');
  const rows = ['dfs', 'bing', 'gsc', 'ga4', 'cc', 'wiki', 'hn', 'news', 'web', 'import']
    .filter((k) => (c?.perSource[k] ?? 0) > 0 || ['dfs', 'bing', 'gsc', 'ga4', 'cc'].includes(k))
    .map((k) => ({ label: sourceLabel(k), value: c?.perSource[k] ?? 0, sub: c?.onlyIn[k] ? `${c.onlyIn[k]} only here` : undefined }));
  const status: { name: string; ok: boolean | null; text: string }[] = [
    { name: 'Bing Webmaster Tools', ok: st ? (st.bing.enabled ? st.bing.connected : null) : null, text: !st ? 'after the next full check' : !st.bing.enabled ? 'not set up on this server (a free API key)' : st.bing.connected ? `${st.bing.links} links read` : st.bing.inAccount === false ? 'add the site in Bing Webmaster Tools (import it from Search Console)' : st.bing.error || 'not connected' },
    { name: 'Search Console export', ok: gscUpload ? true : false, text: gscUpload ? `${gscUpload.rows} rows, uploaded ${fmtDate(gscUpload.importedAt)}` : 'not uploaded — Google’s own sample of your links' },
    { name: 'GA4 referrals', ok: st ? st.ga4.connected : null, text: !st ? 'after the next check' : st.ga4.connected ? `${compactNumber(st.ga4.visits)} visits from ${st.ga4.sources} sites` : st.ga4.property ? st.ga4.error || 'no answer' : 'connect GA4 in tracking settings' },
    { name: 'Common Crawl web graph', ok: d.linkGraph ? true : null, text: d.linkGraph ? `release ${d.linkGraph.release}` : 'the monthly job has not written this site yet' },
  ];
  return (
    <section>
      <SectionHeading
        title="Where your links come from"
        description="No index sees every link. Merging the free sources with DataForSEO — and measuring against Google’s own sample — shows how complete the picture is."
        actions={
          can('member') ? (
            <Button variant="secondary" size="sm" icon={<FileUp className="size-4" />} onClick={() => setUpload(true)}>
              Add Search Console links
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        <Panel title="Referring sites by source" description={c ? `${c.union} ${c.union === 1 ? 'site' : 'sites'} in all · DataForSEO finds ${c.dfsShare}%` : 'Fills after the next full check'} className="xl:col-span-2">
          {c ? <ShareBars items={rows} valueFormat={(v: number) => String(v)} /> : <p className="text-[13px] text-ink-3">Run a backlink check to merge the sources.</p>}
          {c && c.gscSample > 0 && (
            <p className="mt-4 text-[13px] text-ink-2">
              Of the <b>{c.gscSample}</b> sites in Google’s own sample, DataForSEO sees <b>{c.dfsSeesGoogle ?? 0}%</b>; another source confirms {c.allSeeGoogle ?? 0}%.
            </p>
          )}
          {c && <p className="mt-2 text-xs text-ink-3">{c.verified} {c.verified === 1 ? 'link' : 'links'} checked on their page{c.blocked ? ` · ${c.blocked} pages block bots (never counted as lost)` : ''}{c.social ? ` · ${c.social} social profiles (not counted)` : ''}</p>}
        </Panel>
        <Panel title="Sources" description="Free sources the monitor reads">
          <ul className="space-y-3">
            {status.map((s) => (
              <li key={s.name} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{s.name}</span>
                  {s.ok === true ? <StatusBadge tone="good">On</StatusBadge> : s.ok === false ? <StatusBadge tone="warning">Missing</StatusBadge> : <Badge>Waiting</Badge>}
                </div>
                <p className="text-xs text-ink-3">{s.text}</p>
              </li>
            ))}
            {other && <li className="text-xs text-ink-3">Other upload: {other.rows} rows, {fmtDate(other.importedAt)}</li>}
          </ul>
        </Panel>
      </div>
      {upload && <ImportDialog onClose={() => setUpload(false)} />}
    </section>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { org, site } = useSitePage();
  const imp = useLinkImport(org.id, site.id);
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const send = async () => {
    const f = file.current?.files?.[0];
    if (!f) return toast.error('Choose the CSV file first');
    if (f.size > 15_000_000) return toast.error('The file is larger than 15 MB: export the "Latest links" table only');
    const csv = await f.text();
    imp.mutate(
      { csv, fileName: f.name },
      {
        onSuccess: (r) => {
          toast.success(`${r.label}: ${r.rows} links from ${r.domains} sites saved. The next check reads them.`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add Search Console links"
      description="Google’s API has no links, so its sample comes in as a file. The monitor merges it and checks every page itself."
      footer={
        <Button onClick={send} loading={imp.isPending} icon={<FileUp className="size-4" />}>
          Upload
        </Button>
      }
    >
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
        <li>
          In <ExternalLink href="https://search.google.com/search-console/links">Search Console → Links</ExternalLink>, choose <b>Export external links → Latest links</b> (or More sample links), then <b>Download CSV</b>.
        </li>
        <li>Upload the file here. A new upload of the same kind replaces the old one.</li>
      </ol>
      <Field label="CSV file" hint={`"Top linking sites" works too. A backlink CSV from another tool also works (Ahrefs Webmaster Tools is free for your own site).`}>
        {(f) => <Input {...f} ref={file} type="file" accept=".csv,text/csv" onChange={(e) => setName(e.target.files?.[0]?.name ?? '')} />}
      </Field>
      {name && <p className="mt-2 text-xs text-ink-3">{name}</p>}
    </Dialog>
  );
}

// ---------------- the link tables ----------------
function LinkTabs({ d, live }: { d: BacklinksData; live: BacklinkRef[] }) {
  const lost = d.refs.filter((x) => x.status === 'lost').sort((a, b) => b.lostAt.localeCompare(a.lostAt));
  const atRisk = d.refs.filter((x) => x.status === 'at_risk');
  const sending = live.filter((x) => x.visits > 0).sort((a, b) => b.visits - a.visits);
  const best = live.filter((x) => x.seoValue >= 50);
  const [src, setSrc] = useState('all');
  const srcCounts = countBy(live.flatMap((x) => x.sources), (s) => s);
  const all = live.filter((x) => src === 'all' || x.sources.includes(src));
  const tabs = [
    { key: 'best', label: 'Best', count: best.length },
    { key: 'all', label: 'All', count: live.length },
    { key: 'lost', label: 'Lost', count: lost.length + atRisk.length },
    { key: 'new', label: 'New', count: d.latest?.new.length ?? 0 },
    { key: 'visits', label: 'Send visits', count: sending.length },
    { key: 'spammy', label: 'Spammy', count: d.report?.spammy.length ?? 0 },
  ];
  if (!d.refs.length)
    return (
      <Tabs defaultValue={(d.latest?.lost.length ?? 0) > 0 ? 'lost' : 'new'}>
        <TabList>
          <Tab value="lost" count={d.latest?.lost.length ?? 0}>
            Lost
          </Tab>
          <Tab value="new" count={d.latest?.new.length ?? 0}>
            New
          </Tab>
        </TabList>
        <TabPanel value="lost">
          <LinkTable rows={d.latest?.lost ?? []} empty="No links lost since the previous check." />
        </TabPanel>
        <TabPanel value="new">
          <LinkTable rows={d.latest?.new ?? []} empty="No new links since the previous check." />
        </TabPanel>
      </Tabs>
    );
  return (
    <Tabs defaultValue={best.length ? 'best' : 'all'}>
      <TabList>
        {tabs.map((t) => (
          <Tab key={t.key} value={t.key} count={t.count}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <TabPanel value="best">
        <RefTable rows={best} empty="No link reaches an SEO value of 50 yet." />
      </TabPanel>
      <TabPanel value="all">
        {Object.keys(srcCounts).length > 1 && (
          <FilterChips className="mb-3" label="Source" value={src} onChange={setSrc} options={[{ value: 'all', label: 'All sources', count: live.length }, ...Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, label: sourceLabel(k), count: n }))]} />
        )}
        <RefTable rows={all} empty="No referring sites from this source." search />
      </TabPanel>
      <TabPanel value="lost">
        {atRisk.length > 0 && (
          <Callout tone="warning" className="mb-3">
            Not found on their page this week, checked again next week before they count as lost: {atRisk.slice(0, 8).map((x) => x.refDomain).join(', ')}
            {atRisk.length > 8 ? ` and ${atRisk.length - 8} more` : ''}.
          </Callout>
        )}
        <LostTable rows={lost} />
      </TabPanel>
      <TabPanel value="new">
        <LinkTable rows={d.latest?.new ?? []} empty="No new links since the previous check." />
      </TabPanel>
      <TabPanel value="visits">
        <RefTable rows={sending} empty="No link sent a visit in GA4 over the past year (or GA4 is not connected)." sortKey="visits" />
      </TabPanel>
      <TabPanel value="spammy">
        <LinkTable rows={d.report?.spammy ?? []} empty="No spammy links found." />
        {(d.report?.spammy.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            <ShieldAlert className="mr-1 inline size-3.5" aria-hidden />
            Google ignores most link spam on its own. Disavow only after a manual action or for a paid-link pattern you did not create. {d.report?.disavowFileId ? 'The disavow list above is ready for review.' : ''}
          </p>
        )}
      </TabPanel>
    </Tabs>
  );
}

function RefTable({ rows, empty, search, sortKey = 'seo' }: { rows: BacklinkRef[]; empty: string; search?: boolean; sortKey?: string }) {
  const columns: Column<BacklinkRef>[] = [
    {
      key: 'from',
      header: 'From',
      sortValue: (x) => x.refDomain,
      cell: (x) => (
        <div className="min-w-[12rem] max-w-[22rem]">
          <a href={x.fromUrl || `https://${x.refDomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent-text transition-colors duration-150 ease-brand">
            {x.refDomain}
            <ExternalIcon className="size-3 text-ink-3" aria-hidden />
          </a>
          {(x.pageTitle || x.note) && (
            <p className="truncate text-xs text-ink-3" title={x.note || x.pageTitle}>
              {x.note || x.pageTitle}
            </p>
          )}
          <Chips className="mt-1" items={x.sources.map(sourceLabel)} max={4} />
        </div>
      ),
    },
    {
      key: 'seo',
      header: 'Value',
      align: 'right',
      sortValue: (x) => x.seoValue,
      cell: (x) => (
        <span className="whitespace-nowrap tabular" title="SEO / visits / brand value, 0–100">
          <b className="text-ink">{x.seoValue}</b>
          <span className="text-ink-3"> · {x.referralValue} · {x.brandValue}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Link', hideOnMobile: true, sortValue: (x) => x.linkType, cell: (x) => <span className="whitespace-nowrap text-[13px] text-ink-2">{[x.linkType && titleCase(x.linkType.replace('_', ' ')), x.rel && x.rel !== 'follow' ? x.rel : '', x.placement && x.placement !== 'body' ? x.placement : ''].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'anchor', header: 'Anchor', hideOnMobile: true, sortValue: (x) => x.anchor, cell: (x) => <span className="block max-w-[12rem] truncate text-[13px] text-ink-2" title={x.anchor}>{x.anchor || <span className="text-ink-3">—</span>}</span> },
    {
      key: 'authority',
      header: 'Authority',
      align: 'right',
      sortValue: (x) => x.dr ?? (x.authority ? x.authority / 10 : x.ccRank ? Math.max(0, 70 - 10 * Math.log10(x.ccRank)) : 0),
      cell: (x) => (
        <span className="whitespace-nowrap tabular" title={x.ccRank ? `Common Crawl: #${x.ccRank.toLocaleString('en-GB')} of ~133M domains` : undefined}>
          {x.authority || (x.ccRank ? `CC #${compactNumber(x.ccRank)}` : '–')}
          {x.dr != null && <span className="text-ink-3"> · DR {x.dr}</span>}
        </span>
      ),
    },
    { key: 'visits', header: 'Visits', align: 'right', hideOnMobile: true, sortValue: (x) => x.visits, cell: (x) => (x.visits ? compactNumber(x.visits) : '–') },
    {
      key: 'check',
      header: 'Check',
      sortValue: (x) => x.verifiedAt,
      cell: (x) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge tone={verifyOf(x.verify).tone}>{verifyOf(x.verify).label}</StatusBadge>
          {x.verifiedAt && <span className="text-[11px] text-ink-3">{fmtDate(x.verifiedAt)}</span>}
        </span>
      ),
    },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(x) => x.refDomain} initialSort={{ key: sortKey, dir: 'desc' }} dense pageSize={12} empty={empty} searchable={search} searchText={(x) => `${x.refDomain} ${x.pageTitle} ${x.anchor} ${x.note}`} />;
}

function LostTable({ rows }: { rows: BacklinkRef[] }) {
  const columns: Column<BacklinkRef>[] = [
    { key: 'from', header: 'From', sortValue: (x) => x.refDomain, cell: (x) => <ExternalLink href={x.fromUrl || `https://${x.refDomain}`} className="font-medium">{x.refDomain}</ExternalLink> },
    { key: 'reason', header: 'Why', sortValue: (x) => x.lostReason, cell: (x) => <Kind>{REASON_LABEL[x.lostReason] ?? (x.lostReason || 'Lost')}</Kind> },
    { key: 'to', header: 'Pointed to', hideOnMobile: true, cell: (x) => <span className="text-[13px] text-ink-2">{urlPath(x.toUrl)}</span> },
    { key: 'authority', header: 'Authority', align: 'right', sortValue: (x) => x.authority, cell: (x) => x.authority || '–' },
    { key: 'when', header: 'Lost', sortValue: (x) => x.lostAt, cell: (x) => <span className="whitespace-nowrap text-xs text-ink-3">{fmtDate(x.lostAt)}</span> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(x) => x.refDomain} initialSort={{ key: 'when', dir: 'desc' }} dense pageSize={10} empty="No link lost: every link checked twice is still there." />;
}

// ---------------- anchors and pages ----------------
const ANCHOR_LABEL: Record<string, string> = { brand: 'Your name', url: 'Web address', generic: 'Generic ("here")', money: 'Keyword', image_or_empty: 'Image / empty' };
function AnchorsPanel({ anchors }: { anchors: NonNullable<BacklinksData['latest']>['anchors'] }) {
  const kinds = anchors?.kinds ?? {};
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  const money = total ? (kinds.money ?? 0) / total : 0;
  return (
    <Panel title="Anchor texts" description="How sites link to you: natural profiles are mostly your name and web address">
      {total ? <ShareBars items={Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: ANCHOR_LABEL[k] ?? k, value: (100 * v) / total }))} /> : <p className="text-[13px] text-ink-3">Fills after the next full check.</p>}
      {money > 0.3 && total >= 10 && <Callout tone="warning" className="mt-3">Over 30% of linking sites use keyword anchors. Ask new links to use your name or the page title.</Callout>}
      {(anchors?.top.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1 text-[13px]">
          {anchors!.top.slice(0, 6).map((a) => (
            <li key={a.anchor} className="flex justify-between gap-3">
              <span className="truncate text-ink-2" title={a.anchor}>
                {a.anchor || '(empty)'}
              </span>
              <span className="tabular text-ink-3">{a.referringDomains} sites</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PagesPanel({ pages, reclaim }: { pages: NonNullable<BacklinksData['latest']>['pages']; reclaim: NonNullable<BacklinksData['report']>['reclaim'] }) {
  return (
    <Panel title="Your most-linked pages" description="Where the links land; a linked page that no longer loads loses them">
      {reclaim.length > 0 && (
        <Callout tone="warning" className="mb-3">
          {reclaim.map((r) => `${urlPath(r.brokenUrl)} (${r.links} links) → 301 to ${urlPath(r.redirectTo)}`).join(' · ')}
        </Callout>
      )}
      {pages.length ? (
        <ul className="space-y-1.5 text-[13px]">
          {pages.slice(0, 10).map((p) => (
            <li key={p.url} className="flex justify-between gap-3">
              <ExternalLink href={p.url} className="truncate">
                {urlPath(p.url)}
              </ExternalLink>
              <span className="flex shrink-0 items-center gap-2 tabular text-ink-3">
                {p.referringDomains} sites
                {p.status && p.status >= 400 && <StatusBadge tone="serious">{p.status}</StatusBadge>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">Fills after the next full check.</p>
      )}
    </Panel>
  );
}

// ---------------- opportunities ----------------
function Opportunities({ d }: { d: BacklinksData }) {
  const lists = d.latest?.lists ?? [];
  const compNew = d.latest?.compNew ?? [];
  const gap = d.report?.gap ?? [];
  const mentions = d.report?.mentions ?? [];
  if (!lists.length && !compNew.length && !gap.length && !mentions.length && !(d.latest?.competitors.length ?? 0)) return null;
  const tabs = [
    { key: 'mentions', label: 'Unlinked mentions', count: mentions.length },
    { key: 'lists', label: '"Best of" lists', count: lists.filter((l) => !l.linked).length },
    { key: 'compnew', label: 'Competitors’ new links', count: compNew.length },
    { key: 'gap', label: 'Link gap', count: gap.length },
  ];
  return (
    <section>
      <SectionHeading title="Opportunities" description="Sites that name you without a link, lists that name your competitors, sites that just linked to a competitor and the gap (DataForSEO and the Common Crawl graph)" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        <Card className="px-4 pb-4 xl:col-span-2">
          <Tabs defaultValue={tabs.find((t) => t.count)?.key ?? 'gap'}>
            <TabList>
              {tabs.map((t) => (
                <Tab key={t.key} value={t.key} count={t.count}>
                  {t.label}
                </Tab>
              ))}
            </TabList>
            <TabPanel value="mentions">
              {mentions.length ? (
                <ul className="divide-y divide-line">
                  {mentions.map((m) => (
                    <li key={m.url} className="py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <ExternalLink href={m.url} className="font-medium">
                          {m.title || m.domain}
                        </ExternalLink>
                        <span className="text-xs text-ink-3">{m.domain}</span>
                        {m.verified ? <StatusBadge tone="good">Checked: names you, no link</StatusBadge> : <Badge>Not checked</Badge>}
                      </div>
                      {m.context && <p className="mt-1 line-clamp-2 text-xs text-ink-3">…{m.context}…</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="py-8" title="No unlinked mentions found" description="The full check searches news (GDELT), the web and DataForSEO's content index for pages that name you, then reads each page." />
              )}
              {mentions.some((m) => m.source === 'news') && (
                <p className="mt-2 text-xs text-ink-3">
                  News: <a className="underline" href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">the GDELT Project</a>.
                </p>
              )}
            </TabPanel>
            <TabPanel value="lists">
              <DataTable
                rows={lists}
                rowKey={(l) => l.url}
                dense
                pageSize={8}
                empty="No list pages found for your topics yet."
                columns={[
                  { key: 'page', header: 'Page', cell: (l) => <ExternalLink href={l.url} className="font-medium">{l.title || l.domain}</ExternalLink> },
                  { key: 'names', header: 'Names', cell: (l) => <Chips items={l.competitors} max={3} /> },
                  { key: 'you', header: 'You', cell: (l) => (l.linked ? <StatusBadge tone="good">Linked</StatusBadge> : l.named ? <StatusBadge tone="warning">Named, no link</StatusBadge> : <StatusBadge tone="serious">Missing</StatusBadge>) },
                ]}
              />
            </TabPanel>
            <TabPanel value="compnew">
              <DataTable
                rows={compNew}
                rowKey={(c) => c.domain}
                dense
                pageSize={8}
                empty="No competitor gained a followed link since the last full check."
                columns={[
                  { key: 'site', header: 'Site', sortValue: (c) => c.domain, cell: (c) => <ExternalLink href={c.url || `https://${c.domain}`} className="font-medium">{c.domain}</ExternalLink> },
                  { key: 'comp', header: 'Linked to', cell: (c) => <span className="text-[13px] text-ink-2">{c.competitor}</span> },
                  { key: 'when', header: 'When', sortValue: (c) => c.firstSeen, cell: (c) => <span className="text-xs text-ink-3">{fmtDate(c.firstSeen)}</span> },
                  { key: 'auth', header: 'Authority', align: 'right', sortValue: (c) => c.domainRank, cell: (c) => c.domainRank || '–' },
                ]}
              />
            </TabPanel>
            <TabPanel value="gap">
              <GapTable rows={gap} />
            </TabPanel>
          </Tabs>
        </Card>
        <Panel title="Competitors compared" description="From the latest full report and the Common Crawl graph">
          <CompetitorList rows={d.latest?.competitors ?? []} graph={d.linkGraph?.counts ?? {}} />
        </Panel>
      </div>
    </section>
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
          <a href={l.fromUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent-text transition-colors duration-150 ease-brand">
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
    { key: 'rank', header: 'Authority', align: 'right', sortValue: (l) => l.domainRank, cell: (l) => l.domainRank || '–' },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (l) => l.spam, cell: (l) => (l.spam >= 50 ? <StatusBadge tone="serious">{l.spam}</StatusBadge> : l.spam) },
    { key: 'seen', header: 'Seen', hideOnMobile: true, sortValue: (l) => l.lastSeen, cell: (l) => <span className="whitespace-nowrap text-xs text-ink-3">{fmtDate(l.firstSeen)} → {fmtDate(l.lastSeen)}</span> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(l, i) => `${l.fromUrl}-${i}`} initialSort={{ key: 'rank', dir: 'desc' }} dense pageSize={10} empty={empty} />;
}

type Gap = NonNullable<BacklinksData['report']>['gap'][number];
function GapTable({ rows }: { rows: Gap[] }) {
  const columns: Column<Gap>[] = [
    { key: 'domain', header: 'Domain', sortValue: (g) => g.domain, cell: (g) => <ExternalLink href={`https://${g.domain}`} className="font-medium">{g.domain}</ExternalLink> },
    { key: 'rank', header: 'Authority', align: 'right', sortValue: (g) => g.rank, cell: (g) => g.rank || '–' },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (g) => g.spam, cell: (g) => (g.spam >= 50 ? <StatusBadge tone="serious">{g.spam}</StatusBadge> : g.spam) },
    { key: 'linksTo', header: 'Links to', cell: (g) => <Chips items={g.linksTo} max={3} /> },
    { key: 'source', header: 'Found by', hideOnMobile: true, sortValue: (g) => g.source, cell: (g) => <Kind>{g.source === 'both' ? 'DataForSEO + Common Crawl' : g.source === 'cc' ? 'Common Crawl' : 'DataForSEO'}</Kind> },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(g) => g.domain} initialSort={{ key: 'rank', dir: 'desc' }} dense pageSize={8} empty="The DataForSEO gap is refreshed quarterly with the full report; the Common Crawl gap with each monthly graph." />;
}

function CompetitorList({ rows, graph }: { rows: NonNullable<BacklinksData['latest']>['competitors']; graph: Record<string, number> }) {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  if (!rows.length) return <p className="text-[13px] text-ink-3">Add competitors in the monitor settings to compare links.</p>;
  const own = Object.entries(graph)[0];
  return (
    <ul className="space-y-2.5">
      {rows.map((c) => {
        const rank = num(c.rank ?? c.domain_rank ?? c.domainRank);
        const rd = num(c.referring_domains ?? c.referringDomains);
        const bl = num(c.backlinks);
        return (
          <li key={c.domain} className="text-sm">
            <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-ink hover:text-accent-text transition-colors duration-150 ease-brand">
              {c.domain}
            </a>
            <span className="text-xs text-ink-3">
              {rd != null && <span className="tabular text-ink">{compactNumber(rd)} domains</span>}
              {bl != null && <span className="tabular"> · {compactNumber(bl)} links</span>}
              {rank != null && <span className="tabular"> · rank {rank}</span>}
              {graph[c.domain] != null && <span className="tabular"> · {compactNumber(graph[c.domain]!)} linking domains (Common Crawl{own ? `; you: ${compactNumber(own[1])}` : ''})</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const TYPE_LABEL: Record<string, string> = { lost: 'Lost link', reclaim: 'Broken-link reclaim', mention: 'Unlinked mention', gap: 'Link gap', list: '"Best of" list', comp_new: 'Linked a competitor', ai_source: 'Cited by AI' };
const typeLabel = (t: string) => TYPE_LABEL[t] ?? (t ? titleCase(t) : 'Prospect');
const STATUS_LABEL: Record<ProspectStatus, string> = { new: 'New', contacted: 'Contacted', won: 'Won', rejected: 'Rejected', ignored: 'Ignored' };
const statusOf = (p: Prospect): ProspectStatus => ((PROSPECT_STATUSES as readonly string[]).includes(p.status) ? (p.status as ProspectStatus) : 'new');

function Pipeline({ prospects }: { prospects: Prospect[] }) {
  const [type, setType] = useState('all');
  const [open, setOpen] = useState<Prospect | null>(null);
  const byStatus = countBy(prospects, statusOf);
  const types = countBy(prospects, (p) => p.type || 'other');
  const scoped = prospects.filter((p) => type === 'all' || (p.type || 'other') === type);

  if (!prospects.length) return <EmptyState className="py-8" title="No prospects yet" description="The monthly full backlink report fills the pipeline with lost links to win back, broken links to redirect, mentions without a link, lists that name your competitors and link-gap sites." />;

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
          const rows = scoped.filter((p) => statusOf(p) === s).sort((a, b) => b.score - a.score || b.rank - a.rank);
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
            {p.score > 0 && <Badge tone="accent">score {p.score}</Badge>}
            {p.rank > 0 && <span className="text-xs text-ink-3">authority {p.rank}</span>}
            {p.spamScore >= 50 && <StatusBadge tone="serious">spam {p.spamScore}</StatusBadge>}
          </div>
        </div>
        {st === 'won' ? <StatusBadge tone="good">Won{p.wonAt ? ` ${fmtDate(p.wonAt)}` : ''}</StatusBadge> : st !== 'new' ? <Badge>{STATUS_LABEL[st]}</Badge> : null}
      </div>
      {p.detail && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{p.detail}</p>}
      {p.contactEmail && <p className="mt-2 text-xs text-ink-3">Contact: {p.contactEmail}</p>}
      {st === 'contacted' && p.followupBody && <p className="mt-2 text-xs font-medium text-warning-text">Follow-up {p.followupStep} is drafted</p>}
      {p.note && <p className="mt-2 rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2">Note: {p.note}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="text-xs text-ink-3">since {fmtDate(p.firstSeen)}</span>
        <Button size="sm" variant={p.outreachBody ? 'secondary' : 'ghost'} icon={<Mail className="size-3.5" />} onClick={onOpen}>
          {st === 'contacted' && p.followupBody ? 'Follow-up' : p.outreachBody ? 'Outreach e-mail' : 'Details'}
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
  const [contact, setContact] = useState(p.contactEmail ?? '');
  const isAdmin = can('admin');
  const dirty = status !== statusOf(p) || note.trim() !== (p.note ?? '').trim() || contact.trim() !== (p.contactEmail ?? '').trim();
  const save = (next?: ProspectStatus) => {
    const s = next ?? status;
    admin.mutate(
      { action: 'prospect', prospectDomain: p.prospectDomain, type: p.type, status: s, note: note.trim(), ...(contact.trim() && contact.trim() !== p.contactEmail ? { contactEmail: contact.trim() } : {}) },
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
  const follow = statusOf(p) === 'contacted' && !!p.followupBody;
  const subject = follow ? p.followupSubject : p.outreachSubject;
  const bodyText = follow ? p.followupBody : p.outreachBody;
  const mailto = bodyText ? `mailto:${encodeURIComponent(contact.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}` : null;
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
          ...(p.contactEmail ? [{ label: 'Contact', value: <span>{p.contactEmail}{p.contactUrl && <ExternalLink href={p.contactUrl} className="ml-2 text-xs">found here</ExternalLink>}</span> }] : []),
          ...(p.contactedAt ? [{ label: 'Contacted', value: fmtDate(p.contactedAt) }] : []),
          { label: 'First seen', value: fmtDate(p.firstSeen) },
        ]}
      />
      {bodyText ? (
        <div className="space-y-3">
          {follow && <Callout tone="info">No reply yet: follow-up {p.followupStep} of 2 is drafted (same thread). The first e-mail was “{p.outreachSubject}”.</Callout>}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Subject</span>
              <CopyButton text={subject} />
            </div>
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink">{subject}</p>
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
                <CopyButton text={bodyText} />
              </span>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 font-sans text-sm leading-relaxed text-ink-2">{bodyText}</pre>
          </div>
          <p className="text-xs text-ink-3">Drafted by the engine — read it, check the contact and send it from your own mailbox. Mark it contacted: follow-ups are drafted after 7 and 14 days without a link.</p>
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
          <Field label="Contact e-mail" optional hint="Found on their site by the engine, or yours to add" className="sm:col-span-2">
            {(f) => <Input {...f} type="email" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} />}
          </Field>
        </div>
      )}
    </Dialog>
  );
}
