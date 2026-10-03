import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Handshake, Link2, Mail, ShieldAlert } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, ExternalLink, StatTile } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { ChartCard, TimeSeriesChart } from '@/components/charts';
import { FileButton } from './files';
import { AlertList, Block, CodeBlock, Disclosure, Empty, has, n, num, obj, objs, shortUrl, str, strs, type P } from './kit';

const monthLabel = (m: unknown) => {
  const d = parseISO(`${String(m)}-01`);
  return isValid(d) ? format(d, 'MMM yy') : String(m ?? '');
};

export function BacklinksReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const s = obj(p.summary);
  const series = useMemo(
    () =>
      objs(p.timeseries)
        .map((t) => ({ month: str(t.month), referringDomains: num(t.referring_domains), backlinks: num(t.backlinks) }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    [p.timeseries],
  );
  const lost = objs(p.lost);
  const important = objs(p.important_lost);
  const fresh = objs(p.new_links);
  const spammy = objs(p.spammy);
  const reclaim = objs(p.reclaim);
  const gap = objs(p.gap);
  const mentions = objs(p.mentions);
  const prospects = objs(p.prospects);
  const pipeline = obj(p.pipeline);
  const csv = report.files.find((f) => f.kind === 'csv');
  const disavowFile = report.files.find((f) => /disavow/i.test(f.fileName) || /disavow/i.test(f.field));
  const disavow = str(p.disavow_text);
  const full = str(p.mode) === 'full';

  const linkCols: Column<P>[] = [
    {
      key: 'from_domain',
      header: 'From',
      sortValue: (r) => str(r.from_domain),
      cell: (r) => (
        <div className="min-w-[180px]">
          <p className="flex items-center gap-1.5 font-medium text-ink">
            {str(r.from_domain)}
            {r.spammy === true && <StatusBadge tone="warning">spam</StatusBadge>}
          </p>
          {str(r.from_url) && (
            <ExternalLink href={str(r.from_url)} className="text-xs">
              {shortUrl(str(r.from_url)).slice(0, 70)}
            </ExternalLink>
          )}
        </div>
      ),
    },
    { key: 'anchor', header: 'Anchor text', cell: (r) => <span className="line-clamp-2 text-[13px] text-ink-2">{str(r.anchor) || <em className="text-ink-3">none</em>}</span>, hideOnMobile: true },
    { key: 'to_url', header: 'To', cell: (r) => <span className="text-[13px] text-ink-2">{shortUrl(str(r.to_url))}</span>, hideOnMobile: true },
    { key: 'domain_rank', header: 'Authority', align: 'right', sortValue: (r) => num(r.domain_rank), cell: (r) => n(r.domain_rank) },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (r) => num(r.spam), cell: (r) => (num(r.spam) == null ? '–' : `${num(r.spam)}%`), hideOnMobile: true },
    { key: 'dofollow', header: 'Type', cell: (r) => <Badge>{r.dofollow === false ? 'nofollow' : 'dofollow'}</Badge>, hideOnMobile: true },
    { key: 'last_seen', header: 'Seen', sortValue: (r) => str(r.last_seen), cell: (r) => <span className="whitespace-nowrap text-xs text-ink-3">{str(r.first_seen)}{str(r.last_seen) && str(r.last_seen) !== str(r.first_seen) ? ` → ${str(r.last_seen)}` : ''}</span> },
  ];
  const linkTabs = [
    { key: 'important', label: 'Important lost', rows: important, empty: 'No important link was lost.' },
    { key: 'lost', label: 'Lost', rows: lost, empty: 'No links lost in this period.' },
    { key: 'new', label: 'New', rows: fresh, empty: 'No new links in this period.' },
    { key: 'spammy', label: 'Spammy', rows: spammy, empty: 'No spammy links found.' },
  ];

  const gapCols: Column<P>[] = [
    { key: 'domain', header: 'Site', sortValue: (r) => str(r.domain), cell: (r) => <span className="font-medium text-ink">{str(r.domain)}</span> },
    { key: 'links_to', header: 'Links to', cell: (r) => <span className="text-[13px] text-ink-2">{strs(r.links_to).join(', ')}</span> },
    { key: 'backlinks', header: 'Links', align: 'right', sortValue: (r) => num(r.backlinks), cell: (r) => n(r.backlinks) },
    { key: 'rank', header: 'Authority', align: 'right', sortValue: (r) => num(r.rank), cell: (r) => n(r.rank) },
    { key: 'spam', header: 'Spam', align: 'right', sortValue: (r) => num(r.spam), cell: (r) => (num(r.spam) == null ? '–' : `${num(r.spam)}%`), hideOnMobile: true },
  ];

  return (
    <div className="space-y-5">
      <AlertList alerts={objs(p.alerts)} />
      {s.available === false && <Callout tone="warning">Backlink data was not available: {str(s.error) || 'the data provider did not answer'}.</Callout>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Referring domains" value={n(s.referring_domains)} hint={num(s.referring_domains_nofollow) ? `${num(s.referring_domains_nofollow)} nofollow only` : undefined} />
        <StatTile label="Backlinks" value={n(s.backlinks)} />
        <StatTile label="Domain authority" value={n(s.rank)} hint="DataForSEO rank, 0-1000" />
        <StatTile label="Spam score" value={num(s.spam_score) != null ? `${num(s.spam_score)}%` : '–'} hint={(num(s.spam_score) ?? 0) >= 50 ? 'High: many links come from spam sites' : 'Share of links from spammy sites'} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Links lost" value={lost.length} hint={important.length ? `${important.length} important` : undefined} />
        <StatTile label="Links gained" value={fresh.length} />
        <StatTile label="Spammy links" value={spammy.length} />
        <StatTile label="Broken backlinks" value={n(s.broken_backlinks)} hint={num(s.broken_pages) ? `${num(s.broken_pages)} broken pages receive links` : 'links pointing to missing pages'} />
      </div>

      {series.length > 1 && (
        <ChartCard
          title="Link profile over time"
          description="Referring domains and backlinks per month"
          series={[
            { key: 'referringDomains', label: 'Referring domains' },
            { key: 'backlinks', label: 'Backlinks' },
          ]}
          table={{
            columns: [
              { key: 'month', label: 'Month', format: (v) => monthLabel(v) },
              { key: 'referringDomains', label: 'Referring domains', align: 'right' },
              { key: 'backlinks', label: 'Backlinks', align: 'right' },
            ],
            rows: series,
          }}
        >
          <TimeSeriesChart
            data={series}
            xKey="month"
            xFormat={monthLabel}
            series={[
              { key: 'referringDomains', label: 'Referring domains' },
              { key: 'backlinks', label: 'Backlinks' },
            ]}
            height={220}
          />
        </ChartCard>
      )}

      <Block title="Links" description={str(p.since) ? `Changes since ${str(p.since).slice(0, 10)}` : undefined} icon={<Link2 className="size-4" />}>
        <Tabs defaultValue={linkTabs.find((t) => t.rows.length)?.key ?? 'lost'}>
          <TabList>
            {linkTabs.map((t) => (
              <Tab key={t.key} value={t.key} count={t.rows.length}>
                {t.label}
              </Tab>
            ))}
          </TabList>
          {linkTabs.map((t) => (
            <TabPanel key={t.key} value={t.key}>
              {t.rows.length ? <DataTable rows={t.rows} columns={linkCols} rowKey={(r, i) => `${str(r.from_url)}-${i}`} pageSize={10} /> : <Empty>{t.empty}</Empty>}
            </TabPanel>
          ))}
        </Tabs>
      </Block>

      {reclaim.length > 0 && (
        <Block title="Links to reclaim" description="Sites link to pages of yours that no longer exist: redirect those URLs to a live page">
          <ul className="divide-y divide-line text-sm">
            {reclaim.map((r, i) => (
              <li key={i} className="py-2">
                <p className="text-ink">{shortUrl(str(r.to_url) || str(r.url))}</p>
                <p className="text-xs text-ink-3">
                  {num(r.backlinks) != null ? `${num(r.backlinks)} links` : ''} {str(r.from_domain) && `from ${str(r.from_domain)}`} {str(r.status) && `· HTTP ${str(r.status)}`}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(gap.length > 0 || str(p.gap_error)) && (
        <Block title="Link gap" description="Sites that link to your competitors but not to you: the warmest outreach targets">
          {str(p.gap_error) && <Callout tone="warning" className="mb-3">The link gap could not be computed: {str(p.gap_error)}</Callout>}
          {gap.length > 0 && <DataTable rows={gap} columns={gapCols} rowKey={(r, i) => `${str(r.domain)}-${i}`} initialSort={{ key: 'backlinks', dir: 'desc' }} pageSize={10} />}
        </Block>
      )}

      {mentions.length > 0 && (
        <Block title="Unlinked mentions" description="Pages that name you without linking: ask them to add the link">
          <ul className="space-y-1.5 text-sm">
            {mentions.map((m, i) => (
              <li key={i}>
                <ExternalLink href={str(m.url)}>{str(m.title) || shortUrl(str(m.url))}</ExternalLink>
                {str(m.domain) && <span className="ml-1.5 text-xs text-ink-3">{str(m.domain)}</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {prospects.length > 0 && (
        <Block
          title="Outreach prospects"
          description={str(pipeline.counts) || `${prospects.length} prospects`}
          icon={<Handshake className="size-4" />}
          actions={csv && <FileButton file={csv} label="prospects.csv" />}
        >
          <ul className="space-y-2">
            {prospects.map((x, i) => (
              <li key={i}>
                <Disclosure
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{str(x.prospect_domain)}</span>
                      <Badge tone={str(x.type) === 'lost' ? 'warning' : 'accent'}>{str(x.type) === 'lost' ? 'win back' : str(x.type) || 'prospect'}</Badge>
                      <Badge tone={str(x.status) === 'won' ? 'good' : 'neutral'}>{str(x.status) || 'new'}</Badge>
                    </span>
                  }
                  meta={num(x.rank) ? `authority ${num(x.rank)}` : undefined}
                >
                  <p className="text-[13px] text-ink-2">{str(x.detail)}</p>
                  {str(x.outreach_body) && (
                    <div className="mt-3 rounded-lg border border-line bg-surface-2/60 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                          <Mail className="size-3.5" aria-hidden /> {str(x.outreach_subject)}
                        </p>
                        <CopyButton text={`Subject: ${str(x.outreach_subject)}\n\n${str(x.outreach_body)}`} label="Copy e-mail" />
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{str(x.outreach_body)}</p>
                    </div>
                  )}
                </Disclosure>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">Mark prospects as contacted or won in the Backlinks page of the website; won links are detected automatically.</p>
        </Block>
      )}

      {(disavow || disavowFile) && (
        <Block title="Disavow candidates" description="Only upload a disavow file for a manual action or a clear link attack: Google ignores most spam on its own" icon={<ShieldAlert className="size-4" />} actions={disavowFile && <FileButton file={disavowFile} label="disavow.txt" />}>
          {disavow ? <CodeBlock text={disavow} maxHeight="max-h-64" /> : <Empty>Download the list to review it.</Empty>}
        </Block>
      )}

      {!full && !has(p.gap) && <p className="text-xs text-ink-3">This was the weekly light check (lost, new and spammy links). The monthly full report adds the link gap, reclaim list and outreach prospects.</p>}
    </div>
  );
}
