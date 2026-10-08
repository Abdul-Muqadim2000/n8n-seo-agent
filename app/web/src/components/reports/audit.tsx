import { useState } from 'react';
import { Building2, FolderTree, Link as LinkIcon, ListChecks, Package, Search } from 'lucide-react';
import { urlOnDomain, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Delta, ExternalLink, KeyValue, Meter, scoreTone } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { BarsChart, ChartCard, ShareBars } from '@/components/charts';
import { FileButton } from './files';
import { Block, CodeBlock, Disclosure, Empty, Facts, has, LedgerCard, n, num, obj, objs, pctRatio, SectionTitle, sevTone, shortUrl, str, strs, type P } from './kit';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'] as const;

/** Technical audit and full SEO report (same payload family; the full report adds competitor data in its PDF). */
export function AuditReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const score = num(p.health_score);
  const counts = obj(p.issue_counts);
  const diff = obj(p.audit_diff);
  const top = strs(p.top_issues);
  const isFull = report.stage === 'full_report';
  const domain = str(p.domain);

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <div>
            <p className="text-[13px] font-medium text-ink-3">{isFull ? 'SEO health (full report)' : 'Technical health'}</p>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-5xl font-semibold tracking-tight text-ink">{score ?? '–'}</span>
              <span className="pb-1.5 text-sm text-ink-3">/100</span>
            </div>
            {score != null && <Meter value={score} tone={scoreTone(score)} label="Health score" className="mt-3" />}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {str(p.grade) && <StatusBadge tone={scoreTone(score) === 'accent' ? 'neutral' : scoreTone(score)}>{str(p.grade)}</StatusBadge>}
              {num(diff.score_delta) != null && <Delta value={num(diff.score_delta)} suffix=" pts" digits={0} label="since last audit" />}
            </div>
          </div>
          <div className="min-w-0">
            <SectionTitle>Issues found</SectionTitle>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SEVERITIES.map((s) => (
                <div key={s} className="rounded-lg border border-line px-3 py-2">
                  <p className="font-display text-2xl font-semibold text-ink">{num(counts[s]) ?? 0}</p>
                  <StatusBadge tone={sevTone(s)} className="mt-1">
                    {s}
                  </StatusBadge>
                </div>
              ))}
            </div>
            {top.length > 0 && (
              <>
                <SectionTitle className="mt-4">Fix these first</SectionTitle>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                  {top.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {has(diff) && <AuditDiff diff={diff} />}
      {has(p.fix_pack) && <FixPack fixPack={obj(p.fix_pack)} report={report} />}
      {objs(p.internal_links).length > 0 && <InternalLinks links={objs(p.internal_links)} />}
      {has(p.search_console) && <SearchConsole sc={obj(p.search_console)} />}
      {has(p.site_structure) && <SiteStructure s={obj(p.site_structure)} />}
      {has(p.entity) && <EntityCheck e={obj(p.entity)} domain={domain} siteId={report.siteId} />}
      {!has(p.search_console) && !has(p.audit_diff) && (
        <Callout tone="info">The PDF and Word reports hold every finding with the affected pages and how to fix them.</Callout>
      )}
      <LedgerCard ledger={p.run_ledger} />
    </div>
  );
}

function AuditDiff({ diff }: { diff: P }) {
  const [view, setView] = useState<'new' | 'fixed' | 'open'>('new');
  if (diff.baseline === true)
    return (
      <Callout tone="info" title="First audit on record">
        {str(diff.summary) || 'The next audit shows what was fixed, what is new and what is still open.'}
      </Callout>
    );
  const fixed = objs(diff.fixed);
  const fresh = objs(diff.new);
  const open = objs(diff.open);
  const prev = obj(diff.previous);
  const list = view === 'new' ? fresh : view === 'fixed' ? fixed : open;
  return (
    <Block
      title="Since the last audit"
      description={
        <>
          {str(diff.summary)}
          {str(prev.audited_at) && <> · compared with {fmtDate(str(prev.audited_at))} (score {num(prev.health_score) ?? '–'})</>}
        </>
      }
      actions={
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'new', label: `New ${fresh.length}` },
            { value: 'fixed', label: `Fixed ${fixed.length}` },
            { value: 'open', label: `Open ${open.length}` },
          ]}
        />
      }
    >
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((f, i) => (
            <li key={i} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-ink">{str(f.title)}</p>
                <p className="text-xs text-ink-3">
                  {str(f.category)}
                  {num(f.affected) != null && <> · {num(f.affected)} pages{num(f.affected_before) != null && <> (was {num(f.affected_before)})</>}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {view === 'fixed' ? (
                  <StatusBadge tone="good">Fixed</StatusBadge>
                ) : (
                  <>
                    {str(f.was) && str(f.was) !== str(f.severity) && <span className="text-xs text-ink-3">was {str(f.was)}</span>}
                    <StatusBadge tone={sevTone(str(f.severity))}>{str(f.severity) || 'Issue'}</StatusBadge>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{view === 'new' ? 'No new issues since the last audit.' : view === 'fixed' ? 'Nothing was fixed since the last audit.' : 'No open issues.'}</Empty>
      )}
    </Block>
  );
}

function FixPack({ fixPack, report }: { fixPack: P; report: ReportDetail }) {
  const files = objs(fixPack.files);
  const zip = report.files.find((f) => f.kind === 'zip');
  if (!files.length && !zip) return null;
  return (
    <Block
      title="Fix pack"
      description={`Ready-made files that fix what the audit found${str(fixPack.generated_at) ? ` · ${str(fixPack.generated_at)}` : ''}. Review each one before deploying.`}
      icon={<Package className="size-4" />}
      actions={zip && <FileButton file={zip} label="Download all (.zip)" />}
    >
      <ul className="space-y-2">
        {files.map((f, i) => {
          const stored = report.files.find((x) => x.field === `fix_pack.files[${i}]`);
          const content = str(f.content);
          return (
            <li key={i}>
              <Disclosure
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="text-[13px]">{str(f.name)}</code>
                    <span className="text-xs font-normal text-ink-3">{str(f.purpose)}</span>
                  </span>
                }
                meta={stored ? undefined : `${Math.max(1, Math.round(content.length / 1024))} KB`}
              >
                {stored && (
                  <div className="mb-2">
                    <FileButton file={stored} compact label={`Download ${str(f.name)}`} />
                  </div>
                )}
                {content ? <CodeBlock text={content} fileName={stored ? undefined : str(f.name)} /> : <Empty>Download the file to see it.</Empty>}
              </Disclosure>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

function InternalLinks({ links }: { links: P[] }) {
  const cols: Column<P>[] = [
    { key: 'from_url', header: 'On this page', sortValue: (r) => str(r.from_url), cell: (r) => <ExternalLink href={str(r.from_url)}>{shortUrl(str(r.from_url))}</ExternalLink> },
    { key: 'anchor', header: 'Add a link with the text', cell: (r) => <span className="text-ink">“{str(r.anchor)}”</span> },
    { key: 'to_url', header: 'Pointing to', sortValue: (r) => str(r.to_url), cell: (r) => <ExternalLink href={str(r.to_url)}>{shortUrl(str(r.to_url))}</ExternalLink> },
    { key: 'reason', header: 'Why', cell: (r) => <span className="text-[13px] text-ink-3">{str(r.reason)}</span>, hideOnMobile: true },
  ];
  return (
    <Block title="Internal links to add" description="Pages that deserve more links from your own site (also in internal-links.csv)" icon={<LinkIcon className="size-4" />}>
      <DataTable rows={links} columns={cols} rowKey={(r, i) => `${str(r.from_url)}-${i}`} pageSize={10} />
    </Block>
  );
}

function SearchConsole({ sc }: { sc: P }) {
  const totals = obj(sc.totals);
  const period = obj(totals.period);
  const coverage = Object.entries(obj(sc.coverage)).map(([label, v]) => ({ label, value: num(v) ?? 0 }));
  const notIndexed = objs(sc.not_indexed);
  const sitemaps = objs(sc.sitemaps);
  const queries = objs(sc.top_queries);
  const pages = objs(sc.top_pages);
  const mismatch = objs(sc.canonical_mismatch);
  if (sc.connected === false)
    return (
      <Callout tone="warning" title="Search Console was not connected for this audit">
        {str(sc.error) || 'Add the service account as a user of your Search Console property so the next audit includes indexing data.'}
      </Callout>
    );
  const perfCols = (key: 'query' | 'page'): Column<P>[] => [
    {
      key,
      header: key === 'query' ? 'Query' : 'Page',
      sortValue: (r) => str(r[key]),
      cell: (r) => (key === 'page' ? <ExternalLink href={str(r.page)}>{shortUrl(str(r.page))}</ExternalLink> : <span className="text-ink">{str(r.query)}</span>),
    },
    { key: 'clicks', header: 'Clicks', align: 'right', sortValue: (r) => num(r.clicks), cell: (r) => n(r.clicks) },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => num(r.impressions), cell: (r) => n(r.impressions) },
    { key: 'ctr', header: 'CTR', align: 'right', sortValue: (r) => num(r.ctr), cell: (r) => pctRatio(r.ctr), hideOnMobile: true },
    { key: 'position', header: 'Position', align: 'right', sortValue: (r) => num(r.position), cell: (r) => (num(r.position) == null ? '–' : num(r.position)!.toFixed(1)) },
  ];
  return (
    <Block
      title="Search Console"
      description={
        <>
          {str(sc.property)}
          {str(period.start) && (
            <>
              {' '}
              · {str(period.start)} to {str(period.end)}
            </>
          )}
        </>
      }
      icon={<Search className="size-4" />}
    >
      <Facts
        cols="sm:grid-cols-4"
        items={[
          { label: 'Clicks', value: n(totals.clicks) },
          { label: 'Impressions', value: n(totals.impressions) },
          { label: 'Click-through rate', value: pctRatio(totals.ctr, 2) },
          { label: 'Average position', value: num(totals.position)?.toFixed(1) ?? '–' },
        ]}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle>Pages not indexed, by reason</SectionTitle>
          {coverage.length ? <ShareBars items={coverage} valueFormat={(v) => String(v)} /> : <Empty>Google reports no indexing problems for the key pages.</Empty>}
        </div>
        <div>
          <SectionTitle>Sitemaps</SectionTitle>
          {sitemaps.length ? (
            <ul className="space-y-2 text-[13px]">
              {sitemaps.map((s, i) => (
                <li key={i} className="rounded-lg border border-line p-2.5">
                  <ExternalLink href={str(s.path)} />
                  <p className="mt-1 text-xs text-ink-3">
                    {n(s.urls)} URLs · {num(s.errors) ?? 0} errors · {num(s.warnings) ?? 0} warnings
                    {str(s.downloaded) && <> · read by Google {fmtDate(str(s.downloaded))}</>}
                    {s.pending === true && ' · pending'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No sitemap submitted in Search Console.</Empty>
          )}
        </div>
      </div>
      {notIndexed.length > 0 && (
        <Disclosure className="mt-5" title="Key pages Google has not indexed" meta={`${notIndexed.length}`}>
          <ul className="space-y-1.5 text-[13px]">
            {notIndexed.map((x, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <ExternalLink href={str(x.url)}>{shortUrl(str(x.url))}</ExternalLink>
                <span className="text-xs text-ink-3">{str(x.reason)}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {mismatch.length > 0 && (
        <Callout tone="warning" title="Google picked a different canonical for some pages" className="mt-4">
          <ul className="space-y-1 text-[13px]">
            {mismatch.slice(0, 10).map((m, i) => (
              <li key={i}>
                {shortUrl(str(m.url))} → {shortUrl(str(m.google_canonical) || str(m.canonical))}
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {(queries.length > 0 || pages.length > 0) && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {queries.length > 0 && (
            <div className="min-w-0">
              <SectionTitle>Top queries</SectionTitle>
              <DataTable rows={queries} columns={perfCols('query')} rowKey={(r, i) => `${str(r.query)}-${i}`} initialSort={{ key: 'clicks', dir: 'desc' }} dense pageSize={10} />
            </div>
          )}
          {pages.length > 0 && (
            <div className="min-w-0">
              <SectionTitle>Top pages</SectionTitle>
              <DataTable rows={pages} columns={perfCols('page')} rowKey={(r, i) => `${str(r.page)}-${i}`} initialSort={{ key: 'clicks', dir: 'desc' }} dense pageSize={10} />
            </div>
          )}
        </div>
      )}
    </Block>
  );
}

function SiteStructure({ s }: { s: P }) {
  const depth = Object.entries(obj(s.depth_buckets)).map(([k, v]) => ({ depth: k === '0' ? 'Home' : `${k} click${k === '1' ? '' : 's'}`, pages: num(v) ?? 0 }));
  const sections = objs(s.sections).map((x) => ({ label: str(x.section), value: num(x.pages) ?? 0 }));
  const sm = obj(s.sitemap);
  return (
    <Block title="Site structure" description={s.crawl_complete === false ? 'The crawl stopped at the page limit: raise it for a complete picture' : 'From the crawl'} icon={<FolderTree className="size-4" />}>
      <Facts
        cols="sm:grid-cols-4"
        items={[
          { label: 'Pages crawled', value: n(s.crawled_pages) },
          { label: 'Indexable pages', value: n(s.indexable_pages) },
          { label: 'Within 3 clicks of home', value: num(s.within_3_clicks_pct) != null ? `${num(s.within_3_clicks_pct)}%` : '–' },
          { label: 'URLs in the sitemap', value: n(sm.urls) },
          { label: 'Indexable, not in sitemap', value: n(s.indexable_not_in_sitemap) },
          { label: 'Only in the sitemap (orphans)', value: n(s.sitemap_only) },
          { label: 'Broken sitemap URLs', value: n(s.sitemap_broken) },
          { label: 'Sitemap status', value: num(sm.status) != null ? `HTTP ${num(sm.status)}${sm.is_index === true ? ' · index' : ''}` : '–' },
        ]}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {depth.length > 0 && (
          <ChartCard
            title="Click depth"
            description="Pages by clicks from the homepage"
            table={{ columns: [{ key: 'depth', label: 'Depth' }, { key: 'pages', label: 'Pages', align: 'right' }], rows: depth }}
          >
            <BarsChart data={depth} categoryKey="depth" series={[{ key: 'pages', label: 'Pages' }]} height={200} />
          </ChartCard>
        )}
        {sections.length > 0 && (
          <div>
            <SectionTitle>Largest sections</SectionTitle>
            <ShareBars items={sections} valueFormat={(v) => `${v} pages`} />
          </div>
        )}
      </div>
    </Block>
  );
}

function EntityCheck({ e, domain, siteId }: { e: P; domain: string; siteId: string | null }) {
  const { org, can } = useOrgCtx();
  const home = obj(e.homepage_org);
  const addr = obj(home.address);
  const gbp = obj(e.gbp);
  const gbpMatches = str(gbp.website) ? urlOnDomain(str(gbp.website), domain) : null;
  const address = [str(addr.streetAddress), str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry)].filter(Boolean).join(', ');
  return (
    <Block title="Brand and entity check" description="How consistently search engines and AI can identify your business" icon={<Building2 className="size-4" />}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle>On your homepage</SectionTitle>
          <KeyValue
            items={[
              { label: 'Business name', value: str(home.name) || str(e.business_name) || '–' },
              { label: 'Schema type', value: str(home.type) || 'No Organization schema' },
              { label: 'Phone', value: str(home.telephone) || '–' },
              { label: 'Address', value: address || '–' },
              {
                label: 'Profiles (sameAs)',
                value: strs(home.sameAs).length ? (
                  <span className="flex flex-col">
                    {strs(home.sameAs).map((u) => (
                      <ExternalLink key={u} href={u} className="text-[13px]" />
                    ))}
                  </span>
                ) : (
                  'None'
                ),
              },
            ]}
          />
          {strs(e.homepage_phones).length > 1 && (
            <p className="mt-3 text-[13px] text-warning-text">
              {strs(e.homepage_phones).length} different phone numbers appear on the homepage: {strs(e.homepage_phones).join(', ')}. Use one consistent number.
            </p>
          )}
        </div>
        <div>
          <SectionTitle>Google Business Profile</SectionTitle>
          {has(gbp) ? (
            <div className="rounded-lg border border-line p-3 text-sm">
              <p className="font-medium text-ink">{str(gbp.title)}</p>
              <p className="text-[13px] text-ink-3">
                {[str(gbp.category), str(gbp.address)].filter(Boolean).join(' · ')}
                {num(gbp.rating) != null && (
                  <>
                    {' '}
                    · {num(gbp.rating)}★ ({num(gbp.reviews) ?? 0} reviews)
                  </>
                )}
              </p>
              {str(gbp.website) && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  <ExternalLink href={str(gbp.website)} />
                  {gbpMatches === false && <StatusBadge tone="warning">Not your website</StatusBadge>}
                  {gbpMatches === true && <StatusBadge tone="good">Matches</StatusBadge>}
                </p>
              )}
              {gbp.claimed === false && <p className="mt-1 text-xs text-ink-3">The listing is not claimed.</p>}
            </div>
          ) : (
            <Empty>No Google Business Profile was found for {str(e.business_name) || domain}. A verified profile with the same name, address and phone as the site helps local and AI search.</Empty>
          )}
          {strs(e.other_listings).length > 0 && (
            <p className="mt-3 text-[13px] text-ink-3">
              Similar names on Google Maps (other companies): <span className="text-ink-2">{strs(e.other_listings).join(', ')}</span>
            </p>
          )}
        </div>
      </div>
      {e.profile_set === false && siteId && (
        <Callout
          tone="info"
          className="mt-5"
          title="No business profile on file"
          action={
            can('admin') && (
              <ButtonLink to={paths.site(org.id, siteId, 'settings/profile')} variant="secondary" size="sm" icon={<ListChecks className="size-4" />}>
                Set it up
              </ButtonLink>
            )
          }
        >
          The author, expert reviewer and verified address make every new page carry a byline, author box and LocalBusiness schema.
        </Callout>
      )}
    </Block>
  );
}
