import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Award, Handshake, Layers, Link2, LinkIcon, ListChecks, Mail, MessageSquareText, Radar, Recycle, ShieldAlert, Sparkles, TrendingUp, Unlink } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, ExternalLink } from '@/components/ui/misc';
import { CountUp, HeroStat, IconTile, InsightItem, MetricCard, Stagger } from '@/components/insight';
import { DataTable, type Column } from '@/components/ui/table';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { ChartCard, TimeSeriesChart } from '@/components/charts';
import { FileButton } from './files';
import { AlertList, Block, CodeBlock, Disclosure, Empty, has, n, num, obj, objs, shortUrl, str, strs, type P } from './kit';
import { ChartTitle, HeroFileButton, ReportHero, ScoreMark } from './visuals';

const monthLabel = (m: unknown) => {
  const d = parseISO(`${String(m)}-01`);
  return isValid(d) ? format(d, 'MMM yy') : String(m ?? '');
};

const SRC: Record<string, string> = { dfs: 'DataForSEO', bing: 'Bing', gsc: 'Search Console', ga4: 'GA4 visits', cc: 'Common Crawl', wiki: 'Wikipedia', hn: 'Hacker News', news: 'News', web: 'Web search', import: 'Upload' };
const REASON: Record<string, string> = { link_removed: 'link removed', page_gone: 'page gone', domain_gone: 'site gone', not_seen: 'not seen for 4 months', reported_lost: 'reported lost — checking' };

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
    { key: 'reason', header: 'Why', hideOnMobile: true, cell: (r) => (str(r.reason) ? <Badge tone={r.pending === true ? 'neutral' : 'warning'}>{REASON[str(r.reason)] ?? str(r.reason)}</Badge> : null) },
  ];
  const bestCols: Column<P>[] = [
    { key: 'ref_domain', header: 'From', sortValue: (r) => str(r.ref_domain), cell: (r) => <span className="font-medium text-ink">{str(r.ref_domain)}</span> },
    { key: 'seo_value', header: 'Value', align: 'right', sortValue: (r) => num(r.seo_value), cell: (r) => <span className="tabular">{n(r.seo_value)} · {n(r.referral_value)} · {n(r.brand_value)}</span> },
    { key: 'link_type', header: 'Link', hideOnMobile: true, cell: (r) => <span className="text-[13px] text-ink-2">{[str(r.link_type), str(r.rel) !== 'follow' ? str(r.rel) : '', str(r.placement)].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'authority', header: 'Authority', align: 'right', sortValue: (r) => num(r.authority), cell: (r) => <span className="tabular">{[num(r.authority) ? n(r.authority) : '', num(r.dr) ? `DR ${num(r.dr)}` : ''].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'verify', header: 'Check', cell: (r) => <Badge tone={str(r.verify) === 'found' ? 'good' : 'neutral'}>{str(r.verify) === 'found' ? 'on the page' : str(r.verify) || 'not checked'}</Badge> },
  ];
  const linkTabs = [
    { key: 'important', label: 'Important lost', rows: important, empty: 'No important link was lost (a loss counts after two checks on the page).' },
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
    { key: 'source', header: 'Found by', hideOnMobile: true, cell: (r) => <Badge>{str(r.source) === 'cc' ? 'Common Crawl' : str(r.source) === 'both' ? 'both' : 'DataForSEO'}</Badge> },
  ];

  const sites = num(obj(p.coverage).union) ?? num(s.referring_domains);
  const pdf = report.files.find((f) => f.kind === 'pdf');
  const domain = str(p.domain) || report.siteDomain || 'your site';

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={full ? 'Full check' : !has(p.gap) ? 'Light check' : undefined}
        title={important.length ? `${important.length} important ${important.length === 1 ? 'link' : 'links'} lost` : sites != null ? `${n(sites)} ${sites === 1 ? 'site links' : 'sites link'} to ${domain}` : 'Backlink report'}
        description={[`${fresh.length} new`, `${lost.length} lost`, `${spammy.length} spammy`, prospects.length ? `${prospects.length} outreach prospects` : '', reclaim.length ? `${reclaim.length} links to reclaim` : ''].filter(Boolean).join(' · ')}
        aside={
          num(s.rank) != null ? (
            <ScoreMark score={num(s.rank)} max={1000} suffix="/1000" ringTone="accent" label="Domain authority" display={<CountUp value={num(s.rank)!} />} caption="DataForSEO rank, 0-1000" />
          ) : undefined
        }
        actions={
          pdf || csv ? (
            <>
              {pdf && <HeroFileButton file={pdf}>Open the PDF report</HeroFileButton>}
              {csv && (
                <HeroFileButton file={csv} variant="secondary">
                  prospects.csv
                </HeroFileButton>
              )}
            </>
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Referring domains" value={num(s.referring_domains) != null ? <CountUp value={num(s.referring_domains)!} format={(v) => n(Math.round(v))} /> : '–'} hint={num(s.referring_domains_nofollow) ? `${num(s.referring_domains_nofollow)} nofollow only` : undefined} />
            <HeroStat label="Backlinks" value={num(s.backlinks) != null ? <CountUp value={num(s.backlinks)!} format={(v) => n(Math.round(v))} /> : '–'} />
            <HeroStat label="Links lost" value={<CountUp value={lost.length} />} hint={important.length ? `${important.length} important` : undefined} />
            <HeroStat label="Spam score" value={num(s.spam_score) != null ? `${num(s.spam_score)}%` : '–'} hint={(num(s.spam_score) ?? 0) >= 50 ? 'High: many links come from spam sites' : 'Share of links from spammy sites'} />
          </>
        }
      />
      <AlertList alerts={objs(p.alerts)} />
      {s.available === false && <Callout tone="warning">Backlink data was not available: {str(s.error) || 'the data provider did not answer'}.</Callout>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={<TrendingUp />} label="Links gained" value={<CountUp value={fresh.length} />} />
        <MetricCard icon={<ShieldAlert />} tone={spammy.length ? 'warning' : 'blue'} label="Spammy links" value={<CountUp value={spammy.length} />} />
        <MetricCard
          icon={<Unlink />}
          label="Broken backlinks"
          value={n(s.broken_backlinks)}
          meta={num(s.broken_pages) ? `${num(s.broken_pages)} broken pages receive links` : 'links pointing to missing pages'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {has(p.coverage) && (
        <Block title="Where the links were found" description={`${n(obj(p.coverage).union)} referring sites from all sources · DataForSEO finds ${n(obj(p.coverage).dfs_share)}%`} icon={<Radar />}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(obj(obj(p.coverage).per_source)).map(([k, v]) => {
              const max = Math.max(1, ...Object.values(obj(obj(p.coverage).per_source)).map((x) => Number(x) || 0));
              return (
                <li key={k} className="rounded-lg border border-line px-3 py-2.5 transition-colors duration-150 ease-brand hover:border-line-strong">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium text-ink">{SRC[k] ?? k}</span>
                    <span className="tabular text-ink">
                      {String(v)}
                      {num(obj(obj(p.coverage).only_in)[k]) ? <span className="text-xs text-ink-3">{` (${num(obj(obj(p.coverage).only_in)[k])} only here)`}</span> : ''}
                    </span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, ((Number(v) || 0) / max) * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
          {num(obj(p.coverage).gsc_sample) ? (
            <p className="mt-3 text-[13px] text-ink-2">
              Of the {n(obj(p.coverage).gsc_sample)} sites in Google’s own sample (your Search Console upload), DataForSEO sees {n(obj(p.coverage).dfs_sees_google)}%; another source confirms {n(obj(p.coverage).all_see_google)}%.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-ink-3">{n(obj(p.coverage).verified)} links checked on their page this month; lost means checked twice and gone.</p>
        </Block>
      )}

      {objs(p.best).length > 0 && (
        <Block title="Best links" description="Value 0–100: SEO / visits / brand" icon={<Award />}>
          <DataTable rows={objs(p.best)} columns={bestCols} rowKey={(r, i) => `${str(r.ref_domain)}-${i}`} pageSize={10} />
          {p.dr_enabled === true && (
            <p className="mt-2 text-xs text-ink-3">
              DR: <a className="underline" href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">Domain Rating by Ahrefs</a>.
            </p>
          )}
        </Block>
      )}

      {objs(p.wins).length > 0 && (
        <Block title="Wins" description="New valuable links and links that came back" icon={<Sparkles />} iconTone="good" flush>
          <ul className="divide-y divide-line">
            {objs(p.wins).map((w, i) => (
              <InsightItem
                key={i}
                tone="good"
                icon={<Link2 />}
                title={str(w.ref_domain)}
                meta={
                  <>
                    <Badge tone="good">{str(w.why) === 'restored' ? 'restored' : 'new'}</Badge>
                    {str(w.link_type) && <Badge>{str(w.link_type)}</Badge>}
                  </>
                }
                description={str(w.url) ? <ExternalLink href={str(w.url)} className="text-xs">{shortUrl(str(w.url)).slice(0, 70)}</ExternalLink> : undefined}
              />
            ))}
          </ul>
        </Block>
      )}

      {series.length > 1 && (
        <ChartCard
          title={<ChartTitle icon={<TrendingUp />}>Link profile over time</ChartTitle>}
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

      <Block title="Links" description={str(p.since) ? `Changes since ${str(p.since).slice(0, 10)}` : undefined} icon={<LinkIcon />}>
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
        <Block title="Links to reclaim" description="Sites link to pages of yours that no longer exist: redirect those URLs to a live page" icon={<Recycle />} flush>
          <ul className="divide-y divide-line">
            {reclaim.map((r, i) => (
              <InsightItem
                key={i}
                icon={<Recycle />}
                title={
                  <span className="font-normal">
                    {shortUrl(str(r.broken_url) || str(r.to_url) || str(r.url))} <span className="text-ink-3">→ 301 to</span> {shortUrl(str(r.redirect_to)) || '/'}
                  </span>
                }
                description={
                  <>
                    {num(r.links) != null ? `${num(r.links)} links` : num(r.backlinks) != null ? `${num(r.backlinks)} links` : ''} {strs(r.domains).length ? `from ${strs(r.domains).join(', ')}` : str(r.from_domain) && `from ${str(r.from_domain)}`} {str(r.status) && `· HTTP ${str(r.status)}`}
                  </>
                }
              />
            ))}
          </ul>
        </Block>
      )}

      {objs(p.lists).length > 0 && (
        <Block title={'"Best of" lists'} description="List pages for your topics: which competitors they name, and whether they name you" icon={<ListChecks />} flush>
          <ul className="divide-y divide-line">
            {objs(p.lists).map((l, i) => (
              <InsightItem
                key={i}
                tone={l.linked === true ? 'good' : l.named === true ? 'warning' : 'serious'}
                icon={<ListChecks />}
                title={<ExternalLink href={str(l.url)}>{str(l.title) || str(l.domain)}</ExternalLink>}
                description={strs(l.competitors).join(', ') || undefined}
                meta={<Badge tone={l.linked === true ? 'good' : l.named === true ? 'warning' : 'serious'}>{l.linked === true ? 'you: linked' : l.named === true ? 'you: named, no link' : 'you: missing'}</Badge>}
              />
            ))}
          </ul>
        </Block>
      )}

      {objs(p.comp_new).length > 0 && (
        <Block title="Sites that just linked to a competitor" description="Followed links since the last full check: the warmest prospects" icon={<Radar />} flush>
          <ul className="divide-y divide-line">
            {objs(p.comp_new).map((c, i) => (
              <InsightItem
                key={i}
                icon={<Link2 />}
                title={<ExternalLink href={str(c.url) || `https://${str(c.domain)}`}>{str(c.domain)}</ExternalLink>}
                description={`→ ${str(c.competitor)} · ${str(c.first_seen)} · authority ${n(c.domain_rank)}`}
              />
            ))}
          </ul>
        </Block>
      )}

      {(gap.length > 0 || str(p.gap_error)) && (
        <Block title="Link gap" description="Sites that link to your competitors but not to you: the warmest outreach targets" icon={<Layers />}>
          {str(p.gap_error) && <Callout tone="warning" className="mb-3">The link gap could not be computed: {str(p.gap_error)}</Callout>}
          {gap.length > 0 && <DataTable rows={gap} columns={gapCols} rowKey={(r, i) => `${str(r.domain)}-${i}`} initialSort={{ key: 'backlinks', dir: 'desc' }} pageSize={10} />}
        </Block>
      )}

      {mentions.length > 0 && (
        <Block title="Unlinked mentions" description="Pages that name you without linking: ask them to add the link" icon={<MessageSquareText />} flush>
          <ul className="divide-y divide-line">
            {mentions.map((m, i) => (
              <InsightItem
                key={i}
                icon={<MessageSquareText />}
                title={<ExternalLink href={str(m.url)}>{str(m.title) || shortUrl(str(m.url))}</ExternalLink>}
                description={str(m.domain) || undefined}
                meta={m.verified === true ? <Badge tone="good">checked on the page</Badge> : undefined}
              />
            ))}
          </ul>
        </Block>
      )}

      {prospects.length > 0 && (
        <Block
          title="Outreach prospects"
          description={str(pipeline.counts) || `${prospects.length} prospects`}
          icon={<Handshake />}
          actions={csv && <FileButton file={csv} label="prospects.csv" />}
        >
          <ul className="space-y-2">
            {prospects.map((x, i) => (
              <li key={i}>
                <Disclosure
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <IconTile size="xs" tone={str(x.status) === 'won' ? 'good' : 'blue'}>
                        <Handshake />
                      </IconTile>
                      <span>{str(x.prospect_domain)}</span>
                      <Badge tone={str(x.type) === 'lost' ? 'warning' : 'accent'}>{str(x.type) === 'lost' ? 'win back' : str(x.type) || 'prospect'}</Badge>
                      <Badge tone={str(x.status) === 'won' ? 'good' : 'neutral'}>{str(x.status) || 'new'}</Badge>
                    </span>
                  }
                  meta={[num(x.score) ? `score ${num(x.score)}` : '', num(x.rank) ? `authority ${num(x.rank)}` : ''].filter(Boolean).join(' · ') || undefined}
                >
                  <p className="text-[13px] text-ink-2">{str(x.detail)}</p>
                  {str(x.contact_email) && <p className="mt-1 text-xs text-ink-3">Contact: {str(x.contact_email)}</p>}
                  {str(x.followup_body) && str(x.status) === 'contacted' && (
                    <div className="mt-3 rounded-lg border border-line bg-surface-2/60 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-ink">Follow-up {n(x.followup_step)}: {str(x.followup_subject)}</p>
                        <CopyButton text={`Subject: ${str(x.followup_subject)}\n\n${str(x.followup_body)}`} label="Copy follow-up" />
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{str(x.followup_body)}</p>
                    </div>
                  )}
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
        <Block title="Disavow candidates" description="Only upload a disavow file for a manual action or a clear link attack: Google ignores most spam on its own" icon={<ShieldAlert />} iconTone="warning" actions={disavowFile && <FileButton file={disavowFile} label="disavow.txt" />}>
          {disavow ? <CodeBlock text={disavow} maxHeight="max-h-64" /> : <Empty>Download the list to review it.</Empty>}
        </Block>
      )}

      {!full && !has(p.gap) && <p className="text-xs text-ink-3">This was the weekly light check (lost, new and spammy links; the valuable links re-checked on their pages). The monthly full report adds every source, the link gap, lists, reclaims and outreach prospects.</p>}
    </Stagger>
  );
}
