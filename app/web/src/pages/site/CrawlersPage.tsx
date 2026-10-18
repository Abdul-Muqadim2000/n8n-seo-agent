// Crawlers (gap #6, app/docs/LOG_ANALYTICS.md): what Googlebot, Bingbot and the AI crawlers actually requested on the website, read
// from its own access logs — every request checked against the vendor's published address list or DNS, spoofers counted apart,
// pages Google or AI never fetched, crawl budget spent on redirects / errors / parameter URLs, and the pages AI assistants fetched
// because a person asked.
import { useState } from 'react';
import { Bot, Clock, Download, FileQuestion, Gauge, MessageSquareText, ScanSearch, ShieldAlert, Sparkles, Timer, Upload } from 'lucide-react';
import {
  BOT_KIND_LABELS,
  CRAWLER_LIMITS,
  ROBOTS_ONLY_TOKENS,
  VERIFY_METHOD_LABELS,
  type CrawlerBotRow,
  type CrawlerData,
  type CrawlerPageGap,
  type CrawlerRecommendation,
} from '@seo/shared';
import { BarsChart, ChartCard, SERIES_COLORS, type Series } from '@/components/charts';
import { GuideButton } from '@/components/guide';
import { ActionCard, CountUp, HeroLink, HeroNextStep, HeroStat, InfoTip, InsightItem, MetricCard, Stagger, SummaryHero } from '@/components/insight';
import { StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Menu, MenuItem } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { crawlerExportUrl, useCrawlers } from '@/lib/queries';
import { fmtDay } from '@/lib/utils';
import { DataGate, Panel, useSitePage } from './_components/kit';
import { plural, ratioPct } from './_components/format';
import { ChartTitle, DashSkeleton, HeroEyebrow } from './_components/visuals';
import { CrawlerSetup, IngestTable, UploadLogDialog } from './_components/crawlers';

const n = (v: number) => v.toLocaleString('en-US');
type Days = '7' | '30' | '90';

export default function CrawlersPage() {
  const { org, site, can } = useSitePage();
  const [days, setDays] = useState<Days>(String(CRAWLER_LIMITS.defaultWindow) as Days);
  const [upload, setUpload] = useState(false);
  const q = useCrawlers(org.id, site.id, Number(days));
  return (
    <div>
      <PageHeader
        icon={<ScanSearch />}
        title="Crawlers"
        description={`What Googlebot and the AI crawlers really requested on ${site.domain}, from your own server logs — every crawler checked against its vendor's addresses.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Period" size="sm" value={days} onChange={setDays} options={CRAWLER_LIMITS.windows.map((w) => ({ value: String(w) as Days, label: `${w} days` }))} />
            {can('member') && (
              <Button icon={<Upload className="size-4" />} onClick={() => setUpload(true)}>
                Upload a log
              </Button>
            )}
          </div>
        }
      />
      <DataGate q={q} skeleton={<DashSkeleton cards={4} charts={1} />}>
        {(d) => <Crawlers d={d} orgId={org.id} siteId={site.id} domain={site.domain} admin={can('admin')} member={can('member')} loading={q.isFetching} onUpload={() => setUpload(true)} />}
      </DataGate>
      <UploadLogDialog orgId={org.id} siteId={site.id} domain={site.domain} open={upload} onOpenChange={setUpload} />
    </div>
  );
}

const REC_TONE: Record<CrawlerRecommendation['tone'], 'critical' | 'serious' | 'warning' | 'blue' | 'good'> = { critical: 'critical', serious: 'serious', warning: 'warning', info: 'blue', good: 'good' };
const REC_LABEL: Record<CrawlerRecommendation['tone'], { tone: Tone; label: string }> = {
  critical: { tone: 'critical', label: 'Critical' },
  serious: { tone: 'serious', label: 'Serious' },
  warning: { tone: 'warning', label: 'Warning' },
  info: { tone: 'accent', label: 'Note' },
  good: { tone: 'good', label: 'Good' },
};

function RecAction({ r, orgId, siteId }: { r: CrawlerRecommendation; orgId: string; siteId: string }) {
  if (r.link === 'technical') return <ButtonLink size="sm" variant="secondary" to={`/o/${orgId}/sites/${siteId}/technical`}>Open technical health</ButtonLink>;
  if (r.link === 'ai') return <ButtonLink size="sm" variant="secondary" to={`/o/${orgId}/sites/${siteId}/ai`}>Open AI visibility</ButtonLink>;
  if (r.link === 'crawler-setup')
    return (
      <Button size="sm" variant="secondary" onClick={() => document.getElementById('crawler-setup')?.scrollIntoView({ behavior: 'smooth' })}>
        Log setup
      </Button>
    );
  return null;
}

/** The page body from one answer (also rendered by the web tests). */
export function Crawlers({ d, orgId, siteId, domain, admin, member, loading, onUpload }: { d: CrawlerData; orgId: string; siteId: string; domain: string; admin: boolean; member: boolean; loading?: boolean; onUpload: () => void }) {
  if (!d.hasData) return <NoLogsYet d={d} orgId={orgId} siteId={siteId} domain={domain} admin={admin} member={member} onUpload={onUpload} />;
  const t = d.totals;
  const reading = d.ingests.filter((i) => i.status === 'queued' || i.status === 'processing');
  const top = d.recommendations.find((r) => r.tone !== 'good') ?? d.recommendations[0];
  const proved = t.verifiedShare != null ? ratioPct(t.verifiedShare, 0) : '–';
  const title = t.hits
    ? `Googlebot made ${plural(t.googlebot, 'request')}, AI crawlers ${n(t.ai)}, in the last ${d.windowDays} days`
    : `No crawler request in the last ${d.windowDays} days of your logs`;
  const cov = d.coverage;
  return (
    <Stagger className="space-y-6">
      {reading.length > 0 && <Callout tone="info" title={`Reading ${plural(reading.length, 'log file')}`}>The figures update by themselves when it is done.</Callout>}
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Server logs">{`${fmtDay(d.from)} – ${fmtDay(d.to)} · data from ${fmtDay(d.dataFrom)} to ${fmtDay(d.dataTo)}`}</HeroEyebrow>}
        title={title}
        description={`${proved} of crawler requests were proved to come from the vendor. ${t.spoofed ? `${n(t.spoofed)} more only pretended to be a crawler and are left out of every figure.` : 'Nothing pretended to be a crawler.'}`}
        aside={top ? <HeroNextStep title={top.title} actions={top.link === 'technical' ? <HeroLink to={`/o/${orgId}/sites/${siteId}/technical`}>Technical health</HeroLink> : top.link === 'ai' ? <HeroLink to={`/o/${orgId}/sites/${siteId}/ai`}>AI visibility</HeroLink> : undefined} /> : undefined}
        stats={
          <>
            <HeroStat label="Googlebot requests" value={<CountUp value={t.googlebot} format={n} />} info="Requests whose user agent says Googlebot and that were not proved false. Includes requests we could not check (no address, or a proxy's)." />
            <HeroStat label="AI crawler requests" value={<CountUp value={t.ai} format={n} />} info="GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, CCBot, Amazonbot, Bytespider, Meta-ExternalAgent and the fetches for a person." />
            <HeroStat label="Fetched for a person" value={<CountUp value={t.aiUser} format={n} />} info="ChatGPT-User, Claude-User, Perplexity-User, Google-Agent and Meta-ExternalFetcher fetch a page while someone waits for an answer." />
            <HeroStat label="Pretended to be a crawler" value={<CountUp value={t.spoofed} format={n} />} info="The user agent named a crawler that can be checked, and the address was not that vendor's." />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          icon={<Gauge />}
          label="Pages Googlebot fetched"
          value={cov.source === 'inventory' ? `${n(cov.fetchedByGoogle)} / ${n(cov.inventory)}` : '–'}
          info="Pages of your site (the weekly page inventory) Googlebot requested at least once in the period."
          meta={cov.source === 'inventory' ? `${plural(cov.inventory - cov.fetchedByGoogle, 'page')} not fetched` : 'The page list arrives with the weekly site report'}
        />
        <MetricCard
          icon={<Bot />}
          label="Pages AI crawlers fetched"
          value={cov.source === 'inventory' ? `${n(cov.fetchedByAi)} / ${n(cov.inventory)}` : '–'}
          info="Pages any AI crawler or AI fetch requested at least once in the period."
          meta={cov.source === 'inventory' ? `${plural(cov.inventory - cov.fetchedByAi, 'page')} never read by AI` : undefined}
        />
        <MetricCard
          icon={<ShieldAlert />}
          tone={d.waste.share != null && d.waste.share >= 0.2 ? 'warning' : 'blue'}
          label="Googlebot on redirects and errors"
          value={d.waste.share != null ? ratioPct(d.waste.share, 0) : '–'}
          info="Share of Googlebot's requests that hit a redirect, a 4xx, a 5xx or a URL with parameters. A request can be in two of those."
          meta={`${n(d.waste.redirects)} redirects · ${n(d.waste.clientErrors)} 4xx · ${n(d.waste.serverErrors)} 5xx · ${n(d.waste.paramHits)} parameter URLs`}
        />
        <MetricCard
          icon={<Timer />}
          label="Answer time for Googlebot"
          value={d.bots.find((b) => b.bot === 'googlebot')?.avgMs != null ? `${n(d.bots.find((b) => b.bot === 'googlebot')!.avgMs!)} ms` : '–'}
          info="Average time your server took to answer Googlebot, when the log records it (Nginx $request_time, Apache %D, IIS time-taken, Cloudflare OriginResponseDurationMs)."
        />
      </div>

      {d.recommendations.length > 0 && (
        <Panel icon={<Sparkles />} title="What to do next" description={plural(d.recommendations.length, 'finding')} flush>
          <ul className="divide-y divide-line">
            {d.recommendations.map((r) => (
              <InsightItem key={r.id} tone={REC_TONE[r.tone]} title={r.title} description={r.detail} meta={<StatusBadge tone={REC_LABEL[r.tone].tone}>{REC_LABEL[r.tone].label}</StatusBadge>} action={<RecAction r={r} orgId={orgId} siteId={siteId} />} actionPosition="side" />
            ))}
          </ul>
        </Panel>
      )}

      <DailyChart d={d} loading={loading} />
      <BotsTable d={d} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PageGaps title="Pages Googlebot did not fetch" description={`In ${d.windowDays} days, most-clicked first`} rows={cov.neverGoogle} which="google" source={cov.source} error={cov.error} />
        <PageGaps title="Pages no AI crawler read" description={`In ${d.windowDays} days, most-clicked first`} rows={cov.neverAi} which="ai" source={cov.source} error={cov.error} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Waste d={d} />
        <AiDemand d={d} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NewPages d={d} />
        <Unknown d={d} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResponseTimes d={d} loading={loading} />
        <Spoofed d={d} />
      </div>

      <Exports orgId={orgId} siteId={siteId} days={d.windowDays} />
      <CrawlerSetup d={d} orgId={orgId} siteId={siteId} domain={domain} admin={admin} member={member} onUpload={onUpload} />
    </Stagger>
  );
}

function NoLogsYet({ d, orgId, siteId, domain, admin, member, onUpload }: { d: CrawlerData; orgId: string; siteId: string; domain: string; admin: boolean; member: boolean; onUpload: () => void }) {
  const vars = { domain, logEndpoint: d.setup.endpoint, logHeader: d.setup.header };
  const reading = d.ingests.some((i) => i.status === 'queued' || i.status === 'processing');
  return (
    <Stagger className="space-y-6">
      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Server logs">Not connected yet</HeroEyebrow>}
        title={reading ? 'Your log is being read' : 'See what Google and the AI crawlers really fetch'}
        description="Search Console shows what Google decided; your access log shows what its crawler and every AI crawler actually asked for — and which of them were impostors. Send one log to start."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard icon={<Upload />} title="Upload an access log" description="Apache, Nginx, IIS, CloudFront or JSON lines. Plain or gzip." action={member ? <Button size="sm" onClick={onUpload}>Upload a log</Button> : undefined} meta={<GuideButton id="crawler-logs-upload" vars={{ domain }} label="Where is my log?" />} />
        <ActionCard icon={<ScanSearch />} title="Cloudflare Logpush" description="Every request, minutes after it happens. Cloudflare Enterprise." meta={<GuideButton id="crawler-logs-cloudflare" vars={vars} />} />
        <ActionCard icon={<MessageSquareText />} title="Vercel, Fastly or Akamai" description="A log drain posts JSON lines with your push key." meta={<GuideButton id="crawler-logs-drain" vars={vars} />} />
      </div>
      {d.ingests.length > 0 && (
        <Panel icon={<Clock />} title="Files and pushes read" flush>
          <IngestTable items={d.ingests} />
        </Panel>
      )}
      <CrawlerSetup d={d} orgId={orgId} siteId={siteId} domain={domain} admin={admin} member={member} onUpload={onUpload} />
    </Stagger>
  );
}

const DAILY_SERIES: Series[] = (['search', 'ai_training', 'ai_search', 'ai_user', 'seo_tool', 'other', 'spoofed'] as const).map((k, i) => ({
  key: k,
  label: k === 'spoofed' ? 'Pretending to be a crawler' : BOT_KIND_LABELS[k],
  color: SERIES_COLORS[i],
}));

function DailyChart({ d, loading }: { d: CrawlerData; loading?: boolean }) {
  const used = DAILY_SERIES.filter((s) => d.daily.some((x) => (x as unknown as Record<string, number>)[s.key] > 0));
  const series = used.length ? used : DAILY_SERIES.slice(0, 1);
  return (
    <ChartCard
      title={<ChartTitle icon={<ScanSearch />} info="Requests per day (UTC) by kind of crawler. Spoofed requests are their own series and are not in any other.">Crawler requests per day</ChartTitle>}
      series={series}
      legendShape="rect"
      loading={loading}
      table={{
        columns: [{ key: 'day', label: 'Day', format: (v) => fmtDay(String(v)) }, ...series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const }))],
        rows: [...d.daily].reverse() as unknown as Record<string, unknown>[],
      }}
    >
      <BarsChart data={d.daily as unknown as Record<string, unknown>[]} categoryKey="day" series={series} stacked categoryFormat={(v) => fmtDay(String(v))} valueFormat={n} />
    </ChartCard>
  );
}

const VERIFY_TONE = (b: CrawlerBotRow): { tone: Tone; label: string } =>
  b.method === 'none' ? { tone: 'neutral', label: 'Claimed' } : b.hits && b.verified / b.hits >= 0.9 ? { tone: 'good', label: 'Proved' } : b.unchecked >= b.verified ? { tone: 'warning', label: 'Mostly unchecked' } : { tone: 'accent', label: 'Partly proved' };

function BotsTable({ d }: { d: CrawlerData }) {
  const cols: Column<CrawlerBotRow>[] = [
    {
      key: 'label',
      header: 'Crawler',
      sortValue: (b) => b.label,
      cell: (b) => (
        <span className="flex items-center gap-1 text-ink">
          {b.label}
          {b.vendor && <span className="text-xs text-ink-3">· {b.vendor}</span>}
          <InfoTip label={`How ${b.label} is checked`}>{VERIFY_METHOD_LABELS[b.method]}</InfoTip>
        </span>
      ),
    },
    { key: 'kind', header: 'Kind', hideOnMobile: true, cell: (b) => <span className="text-ink-2">{BOT_KIND_LABELS[b.kind]}</span> },
    { key: 'hits', header: 'Requests', align: 'right', sortValue: (b) => b.hits, cell: (b) => <span className="tabular">{n(b.hits)}</span> },
    { key: 'verified', header: 'Identity', cell: (b) => <StatusBadge tone={VERIFY_TONE(b).tone}>{VERIFY_TONE(b).label}</StatusBadge> },
    { key: 'spoofed', header: 'Spoofed', align: 'right', sortValue: (b) => b.spoofed, cell: (b) => <span className="tabular">{b.spoofed ? n(b.spoofed) : '–'}</span> },
    { key: 'pages', header: 'Paths', align: 'right', hideOnMobile: true, sortValue: (b) => b.pages, cell: (b) => <span className="tabular">{n(b.pages)}</span> },
    { key: 'errors', header: '3xx / 4xx / 5xx', align: 'right', hideOnMobile: true, sortValue: (b) => b.s3xx + b.s4xx + b.s5xx, cell: (b) => <span className="tabular">{`${n(b.s3xx)} / ${n(b.s4xx)} / ${n(b.s5xx)}`}</span> },
    { key: 'ms', header: 'Avg. answer', align: 'right', hideOnMobile: true, sortValue: (b) => b.avgMs ?? -1, cell: (b) => <span className="tabular">{b.avgMs != null ? `${n(b.avgMs)} ms` : '–'}</span> },
    { key: 'last', header: 'Last seen', hideOnMobile: true, sortValue: (b) => b.lastSeen ?? '', cell: (b) => <span className="tabular text-ink-2">{fmtDay(b.lastSeen)}</span> },
  ];
  return (
    <Panel
      icon={<Bot />}
      title="Every crawler"
      description="Proved = on the vendor's published address list or confirmed by DNS. Unchecked = no address in the log, or a proxy's."
      info={
        <>
          {ROBOTS_ONLY_TOKENS.map((r) => (
            <span key={r.token} className="block">
              <strong>{r.token}</strong>: {r.note}
            </span>
          ))}
        </>
      }
      flush
    >
      <DataTable rows={d.bots} rowKey={(b) => b.bot} columns={cols} dense initialSort={{ key: 'hits', dir: 'desc' }} />
    </Panel>
  );
}

function PageGaps({ title, description, rows, which, source, error }: { title: string; description: string; rows: CrawlerPageGap[]; which: 'google' | 'ai'; source: 'inventory' | 'none'; error: string | null }) {
  const cols: Column<CrawlerPageGap>[] = [
    { key: 'path', header: 'Page', cell: (p) => <span className="break-all text-ink" title={p.title || undefined}>{p.path}</span> },
    { key: 'clicks', header: 'Clicks', align: 'right', sortValue: (p) => p.clicks ?? -1, cell: (p) => <span className="tabular">{p.clicks != null ? n(p.clicks) : '–'}</span> },
    { key: 'last', header: 'Last fetched', sortValue: (p) => (which === 'google' ? p.lastGoogle : p.lastAi) ?? '', cell: (p) => <span className="tabular text-ink-2">{(which === 'google' ? p.lastGoogle : p.lastAi) ? fmtDay(which === 'google' ? p.lastGoogle : p.lastAi) : 'Never in your logs'}</span> },
  ];
  return (
    <Panel icon={<FileQuestion />} title={title} description={description} flush>
      {source === 'none' ? (
        <p className="px-5 pb-5 text-[13px] text-ink-3">{error ?? 'Your page list arrives with the weekly site report; then the pages no crawler fetched show here.'}</p>
      ) : (
        <DataTable rows={rows} rowKey={(p) => p.path} columns={cols} dense pageSize={8} empty="Every page was fetched in the period." />
      )}
    </Panel>
  );
}

function Waste({ d }: { d: CrawlerData }) {
  const label = { '3xx': 'Redirect', '4xx': 'Client error', '5xx': 'Server error', param: 'Parameter URL' } as const;
  const cols: Column<CrawlerData['waste']['top'][number]>[] = [
    { key: 'path', header: 'URL', cell: (r) => <span className="break-all text-ink">{r.path}</span> },
    { key: 'reason', header: 'Why', cell: (r) => <StatusBadge tone={r.reason === '5xx' ? 'critical' : r.reason === '4xx' ? 'serious' : 'warning'}>{`${label[r.reason]}${r.status ? ` ${r.status}` : ''}`}</StatusBadge> },
    { key: 'hits', header: 'Requests', align: 'right', sortValue: (r) => r.hits, cell: (r) => <span className="tabular">{n(r.hits)}</span> },
  ];
  return (
    <Panel icon={<ShieldAlert />} title="Crawl budget Googlebot spent badly" description={d.waste.share != null ? `${ratioPct(d.waste.share, 0)} of ${n(d.waste.googleHits)} requests` : 'No Googlebot request in the period'} flush>
      <DataTable rows={d.waste.top} rowKey={(r, i) => `${r.path}-${r.reason}-${i}`} columns={cols} dense pageSize={8} empty="Googlebot hit no redirect, error or parameter URL." />
      {d.waste.paramPatterns.length > 0 && (
        <div className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
          <p className="mb-1 font-medium text-ink">Parameters Googlebot followed</p>
          <ul className="space-y-0.5">
            {d.waste.paramPatterns.slice(0, 6).map((p) => (
              <li key={`${p.path}?${p.keys}`} className="flex justify-between gap-3">
                <span className="break-all">
                  {p.path}?<span className="font-mono">{p.keys}</span>
                </span>
                <span className="tabular text-ink-3">{n(p.hits)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function AiDemand({ d }: { d: CrawlerData }) {
  const cols: Column<CrawlerData['aiDemand'][number]>[] = [
    { key: 'path', header: 'Page', cell: (r) => <span className="break-all text-ink">{r.path}</span> },
    { key: 'bots', header: 'Asked through', cell: (r) => <span className="text-ink-2">{r.bots.join(', ')}</span> },
    { key: 'hits', header: 'Fetches', align: 'right', sortValue: (r) => r.hits, cell: (r) => <span className="tabular">{n(r.hits)}</span> },
  ];
  return (
    <Panel icon={<MessageSquareText />} title="Pages AI assistants fetched for a person" description="Each fetch is someone asking ChatGPT, Claude, Perplexity or Gemini something right now" flush>
      <DataTable rows={d.aiDemand} rowKey={(r) => r.path} columns={cols} dense pageSize={8} empty="No AI assistant fetched a page for a person in the period." />
    </Panel>
  );
}

function NewPages({ d }: { d: CrawlerData }) {
  const cols: Column<CrawlerData['newPages'][number]>[] = [
    { key: 'path', header: 'Page', cell: (r) => <span className="break-all text-ink">{r.path}</span> },
    { key: 'g', header: 'Googlebot first', sortValue: (r) => r.firstGoogle ?? '', cell: (r) => <span className="tabular">{fmtDay(r.firstGoogle)}</span> },
    { key: 'a', header: 'AI first', sortValue: (r) => r.firstAi ?? '', cell: (r) => <span className="tabular text-ink-2">{r.firstAi ? fmtDay(r.firstAi) : 'Not yet'}</span> },
  ];
  return (
    <Panel icon={<Sparkles />} title="New pages, first seen" description="Pages Googlebot fetched for the first time in your logs during the period" flush>
      <DataTable rows={d.newPages} rowKey={(r) => r.path} columns={cols} dense pageSize={8} empty="No new page — or the logs do not go back far enough to say what is new." />
    </Panel>
  );
}

function Unknown({ d }: { d: CrawlerData }) {
  const cols: Column<CrawlerData['coverage']['unknownToInventory'][number]>[] = [
    { key: 'path', header: 'URL', cell: (r) => <span className="break-all text-ink">{r.path}</span> },
    { key: 'hits', header: 'Googlebot requests', align: 'right', sortValue: (r) => r.hits, cell: (r) => <span className="tabular">{n(r.hits)}</span> },
  ];
  return (
    <Panel icon={<FileQuestion />} title="Fetched by Google, missing from your page list" description="Answered 200 but not in the sitemap or the site's links: old URLs, duplicates or pages worth linking" flush>
      <DataTable rows={d.coverage.unknownToInventory} rowKey={(r) => r.path} columns={cols} dense pageSize={8} empty={d.coverage.source === 'none' ? 'Shown once the weekly page list is in.' : 'Every page Googlebot fetched is in your page list.'} />
    </Panel>
  );
}

function ResponseTimes({ d, loading }: { d: CrawlerData; loading?: boolean }) {
  const series: Series[] = [{ key: 'avgMs', label: 'Average answer (ms)', color: SERIES_COLORS[0] }];
  const rows = d.responseTimes.slice(0, 10) as unknown as Record<string, unknown>[];
  return (
    <ChartCard
      title={<ChartTitle icon={<Timer />} info="Only crawlers with 5 or more requests, and only when the log records the answer time.">Answer time by crawler</ChartTitle>}
      loading={loading}
      table={{ columns: [{ key: 'label', label: 'Crawler' }, { key: 'avgMs', label: 'Average (ms)', align: 'right' }, { key: 'hits', label: 'Requests', align: 'right' }], rows }}
    >
      {rows.length ? <BarsChart data={rows} categoryKey="label" series={series} horizontal valueFormat={(v) => `${n(v)} ms`} categoryWidth={130} /> : <p className="py-10 text-center text-[13px] text-ink-3">Your log does not record answer times.</p>}
    </ChartCard>
  );
}

function Spoofed({ d }: { d: CrawlerData }) {
  const cols: Column<CrawlerData['spoofed'][number]>[] = [
    { key: 'label', header: 'Pretended to be', cell: (r) => <span className="text-ink">{r.label}</span> },
    { key: 'hits', header: 'Requests', align: 'right', sortValue: (r) => r.hits, cell: (r) => <span className="tabular">{n(r.hits)}</span> },
    { key: 'nets', header: 'Networks', cell: (r) => <span className="font-mono text-xs text-ink-2">{r.topNetworks.join(', ') || '–'}</span> },
  ];
  return (
    <Panel icon={<ShieldAlert />} iconTone="warning" title="Impostors" description="A crawler's name from an address that is not the vendor's: left out of every other figure" flush>
      <DataTable rows={d.spoofed} rowKey={(r) => r.bot} columns={cols} dense pageSize={8} empty="Nothing pretended to be a crawler in the period." />
    </Panel>
  );
}

function Exports({ orgId, siteId, days }: { orgId: string; siteId: string; days: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Menu
        trigger={
          <Button variant="secondary" size="sm" icon={<Download className="size-3.5" />}>
            Export CSV
          </Button>
        }
      >
        <MenuItem onSelect={() => window.location.assign(crawlerExportUrl(orgId, siteId, 'daily', days))}>Daily totals per crawler</MenuItem>
        <MenuItem onSelect={() => window.location.assign(crawlerExportUrl(orgId, siteId, 'pages', days))}>Requests per page and crawler</MenuItem>
        <MenuItem onSelect={() => window.location.assign(crawlerExportUrl(orgId, siteId, 'hits', days))}>Every crawler request (as long as they are kept)</MenuItem>
      </Menu>
      <span className="text-[13px] text-ink-3">The same figures are in the read API: GET /api/v1/websites/{siteId}/crawlers</span>
    </div>
  );
}
