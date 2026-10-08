import { Activity, ArrowRight, CalendarClock, Clock, Link2, ListChecks, ScanText, UserCheck } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { ExternalLink, KeyValue, Meter, scoreTone } from '@/components/ui/misc';
import { Block, Bullets, CheckRow, Chips, CodeBlock, Disclosure, Empty, Facts, has, JsonViewer, LedgerCard, n, num, obj, objs, SectionTitle, shortUrl, str, strs, type P } from './kit';
import { keywordPrefill, stageLabel } from './meta';

// Renderers for the short callbacks: publish check, business profile, check-in, cadence, set-up and "started" notices,
// site description, rejections, alerts, and the generic fallback.

export function PublishedReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const checks = objs(p.checks);
  const failed = strs(p.failed);
  const page = obj(p.page);
  const linkFrom = Array.isArray(p.link_from) ? p.link_from : [];
  const live = p.live === true;
  return (
    <div className="space-y-5">
      <Callout tone={live ? (failed.length ? 'warning' : 'good') : 'critical'} title={live ? (failed.length ? `Live, with ${failed.length} thing${failed.length === 1 ? '' : 's'} to fix` : 'Live and ready to rank') : `The page could not be fetched${num(p.http_status) ? ` (HTTP ${num(p.http_status)})` : ''}`}>
        {str(p.summary)}
        {str(p.published_url) && (
          <span className="mt-1 block">
            <ExternalLink href={str(p.published_url)} />
          </span>
        )}
        {str(p.fetch_error) && <span className="mt-1 block text-critical-text">{str(p.fetch_error)}</span>}
      </Callout>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Block title="Live checks" description={`${num(p.passed) ?? checks.filter((c) => c.ok === true).length} of ${checks.length} passed`} icon={<ListChecks className="size-4" />}>
          {checks.length ? (
            <ul className="divide-y divide-line">
              {checks.map((c, i) => (
                <CheckRow key={i} ok={c.ok === true ? true : c.ok === false ? false : null} label={str(c.name)} detail={str(c.detail) || str(c.fix)} />
              ))}
            </ul>
          ) : (
            <Empty>No checks ran.</Empty>
          )}
        </Block>
        <div className="space-y-5">
          {has(page) && (
            <Block title="What Google sees">
              <KeyValue
                items={[
                  { label: 'Title', value: str(page.title) || '–' },
                  { label: 'H1', value: str(page.h1) || '–' },
                  { label: 'Description', value: str(page.meta_description) || '–' },
                  { label: 'Canonical', value: str(page.canonical) ? shortUrl(str(page.canonical)) : '–' },
                  { label: 'JSON-LD blocks', value: String(num(page.jsonld_blocks) ?? 0) },
                  { label: 'Words', value: n(page.words) },
                ]}
              />
            </Block>
          )}
          <Block title="Link to it from" description="Existing pages that should link to the new one" icon={<Link2 className="size-4" />}>
            {linkFrom.length ? (
              <ul className="space-y-2 text-sm">
                {linkFrom.map((l, i) => {
                  const o = obj(l);
                  const url = typeof l === 'string' ? l : str(o.url) || str(o.from_url) || str(o.page);
                  return (
                    <li key={i}>
                      {url ? <ExternalLink href={url}>{shortUrl(url)}</ExternalLink> : <span className="text-ink">{str(o.keyword) || str(o.title)}</span>}
                      {(str(o.anchor) || str(o.reason)) && (
                        <span className="block text-xs text-ink-3">
                          {str(o.anchor) && <>anchor “{str(o.anchor)}” </>}
                          {str(o.reason)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No suggestions yet: they appear once the site has other tracked or ladder pages on the same topic.</Empty>
            )}
          </Block>
          <div className="flex flex-wrap gap-2 text-xs">
            {p.stored === true && <StatusBadge tone="good">Marked as published</StatusBadge>}
            {p.ladder_found === true && <Badge>part of a keyword ladder</Badge>}
            {str(p.store_error) && <StatusBadge tone="critical">Not stored: {str(p.store_error)}</StatusBadge>}
          </div>
        </div>
      </div>
    </div>
  );
}

const PROFILE_LABELS: Record<string, string> = {
  business_name: 'Business name',
  business_type: 'Business type',
  street_address: 'Street address',
  city: 'City',
  region: 'Region',
  postal_code: 'Postal code',
  country_code: 'Country',
  phone: 'Phone',
  public_email: 'Public e-mail',
  opening_hours: 'Opening hours',
  service_areas: 'Areas served',
  map_url: 'Map link',
  logo_url: 'Logo',
  author_name: 'Author',
  author_job_title: 'Author job title',
  author_credentials: 'Credentials',
  author_bio: 'Bio',
  author_url: 'Author page',
  author_same_as: 'Author profiles',
  author_knows_about: 'Expertise',
  reviewer_name: 'Expert reviewer',
  reviewer_job_title: 'Reviewer job title',
  reviewer_url: 'Reviewer page',
};

export function ProfileReport({ report }: { report: ReportDetail }) {
  const { org, can } = useOrgCtx();
  const p = report.payload;
  const profile = obj(p.profile);
  const preview = obj(p.schema_preview);
  const eeat = num(p.eeat_score);
  const local = num(p.local_score);
  const rows = Object.entries(PROFILE_LABELS)
    .filter(([k]) => str(profile[k]))
    .map(([k, label]) => ({ label, value: /url$/.test(k) && /^https?:/.test(str(profile[k])) ? <ExternalLink href={str(profile[k])} /> : str(profile[k]) }));
  return (
    <div className="space-y-5">
      {str(p.summary) && <Callout tone={p.stored === false ? 'critical' : 'good'}>{str(p.summary)}</Callout>}
      <div className="grid gap-5 md:grid-cols-2">
        <ScoreCard title="Author and E-E-A-T" score={eeat} items={objs(p.eeat_checklist)} />
        <ScoreCard title="Local business details" score={local} items={objs(p.local_checklist)} />
      </div>
      {rows.length > 0 && (
        <Block
          title="Profile on file"
          icon={<UserCheck className="size-4" />}
          actions={
            report.siteId &&
            can('admin') && (
              <ButtonLink to={paths.site(org.id, report.siteId, 'settings/profile')} variant="secondary" size="sm">
                Edit profile
              </ButtonLink>
            )
          }
        >
          <KeyValue items={rows} />
          {strs(p.changed).length > 0 && (
            <p className="mt-4 text-xs text-ink-3">
              Changed in this update: {strs(p.changed).map((k) => PROFILE_LABELS[k] ?? k).join(', ')}
            </p>
          )}
        </Block>
      )}
      {has(preview) && (
        <Block title="Schema preview" description="The structured data every new page will carry">
          <div className="space-y-2">
            {Object.entries(preview).map(([k, v]) => (
              <Disclosure key={k} title={k === 'person' ? 'Person (author)' : k === 'local_business' ? 'LocalBusiness' : k.replace(/_/g, ' ')} defaultOpen={k === 'person'}>
                <CodeBlock text={JSON.stringify(v, null, 2)} />
              </Disclosure>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

function ScoreCard({ title, score, items }: { title: string; score: number | null; items: P[] }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <span className="font-display text-2xl font-semibold text-ink">{score != null ? `${score}%` : '–'}</span>
        </div>
        {score != null && <Meter value={score} tone={scoreTone(score)} label={`${title} completeness`} className="mt-2" />}
        {items.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {items.map((it, i) => (
              <CheckRow key={i} ok={it.ok === true ? true : it.ok === false ? false : null} label={str(it.item)} detail={it.ok === false ? str(it.hint) : undefined} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function CheckinReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const cov = obj(p.coverage);
  const reasons = objs(cov.reasons);
  const urls = objs(cov.urls);
  const summary = Array.isArray(p.summary) ? strs(p.summary) : str(p.summary) ? [str(p.summary)] : [];
  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-2">Check-in for {str(p.month) || 'this month'}</span>
          <StatusBadge tone={p.manual_action === true ? 'critical' : 'good'}>{p.manual_action === true ? 'Manual action reported' : 'No manual action'}</StatusBadge>
          <StatusBadge tone={p.security_issue === true ? 'critical' : 'good'}>{p.security_issue === true ? 'Security issue reported' : 'No security issue'}</StatusBadge>
          {p.stored === true && <Badge>recorded</Badge>}
        </CardBody>
      </Card>
      {summary.length > 0 && (
        <Block title="Summary">
          <Bullets items={summary} />
        </Block>
      )}
      {has(cov) && str(cov.kind) !== 'none' && (
        <Block title="Pages report" description={str(cov.kind) === 'reasons' ? 'Why pages are not indexed' : str(cov.kind) === 'urls' ? 'Pages listed in the export' : 'Indexed pages on the last day of the export'}>
          <Facts
            cols="sm:grid-cols-3"
            items={[
              { label: 'Indexed', value: n(cov.indexed_total) },
              { label: 'Not indexed', value: n(cov.not_indexed_total) },
              { label: 'Rows read', value: n(cov.rows) },
            ]}
          />
          {reasons.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {reasons.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-ink">{str(r.reason)}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    {str(r.source)} {str(r.validation) && <Badge>{str(r.validation)}</Badge>} <span className="tabular text-sm text-ink">{n(r.pages)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {urls.length > 0 && (
            <Disclosure className="mt-4" title="URLs" meta={`${urls.length}`}>
              <ul className="space-y-1 text-[13px]">
                {urls.map((u, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <ExternalLink href={str(u.url)}>{shortUrl(str(u.url))}</ExternalLink>
                    <span className="text-xs text-ink-3">{str(u.last_crawled)}</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </Block>
      )}
      {str(p.store_error) && <Callout tone="critical">The check-in could not be stored: {str(p.store_error)}</Callout>}
    </div>
  );
}

export function CadenceReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const pages = objs(p.pages);
  const upcoming = objs(p.upcoming);
  const pending = objs(p.pending_publish);
  return (
    <div className="space-y-5">
      <Block title={`Being written this week${str(p.week) ? ` (${str(p.week)})` : ''}`} description="Each page arrives as its own report when it is finished" icon={<CalendarClock className="size-4" />}>
        {pages.length ? (
          <ul className="divide-y divide-line">
            {pages.map((x, i) => (
              <li key={i} className="py-2.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {str(x.keyword)} <Badge tone="accent">{str(x.source) || 'planned'}</Badge> {str(x.page_type) && <span className="text-xs font-normal text-ink-3">{str(x.page_type)}</span>}
                </p>
                {str(x.why) && <p className="text-xs text-ink-3">{str(x.why)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No page this week: {pending.length ? 'written pages are waiting to be published first.' : 'no candidate keyword was ready.'}</Empty>
        )}
      </Block>
      {upcoming.length > 0 && (
        <Block title="Coming up next" description={`${num(p.candidates) ?? upcoming.length} candidates in the queue`}>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {upcoming.map((x, i) => (
              <li key={i} className="text-ink">
                {str(x.keyword)} <span className="text-xs text-ink-3">· {str(x.why) || str(x.source)}</span>
              </li>
            ))}
          </ol>
        </Block>
      )}
      {pending.length > 0 && (
        <Callout tone="warning" title="Waiting to be published">
          {pending.map((x) => str(x.keyword)).join(', ')}. Publish them and report the URL so they can be tracked.
        </Callout>
      )}
    </div>
  );
}

export function TrackerSetupReport({ report }: { report: ReportDetail }) {
  const { org } = useOrgCtx();
  const p = report.payload;
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-accent-text" aria-hidden />
          <h3 className="text-[15px] font-semibold text-ink">Tracking is set up{str(p.domain) ? ` for ${str(p.domain)}` : ''}</h3>
        </div>
        {str(p.next) && <p className="text-sm leading-relaxed text-ink-2">{str(p.next)}</p>}
        {strs(p.keywords).length > 0 && (
          <div>
            <SectionTitle>Keywords checked live every week</SectionTitle>
            <Chips items={strs(p.keywords)} />
          </div>
        )}
        <KeyValue items={[{ label: 'GA4 property', value: str(p.ga4_property_id) || 'detected automatically when access is granted' }]} />
        {str(p.store_error) && <Callout tone="critical">Saving the settings failed: {str(p.store_error)}</Callout>}
        {report.siteId && (
          <ButtonLink to={paths.site(org.id, report.siteId, 'search')} variant="secondary" size="sm" icon={<ArrowRight className="size-4" />}>
            Open Search & traffic
          </ButtonLink>
        )}
      </CardBody>
    </Card>
  );
}

export function StartedReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const ok = p.started !== false && !str(p.error) && !str(p.spawn_error);
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-accent-text" aria-hidden />
          <h3 className="text-[15px] font-semibold text-ink">{str(p.title) || stageLabel(report.stage)}</h3>
          {num(p.estimated_minutes) != null && <Badge>about {num(p.estimated_minutes)} min</Badge>}
        </div>
        {str(p.summary) && <p className="text-sm leading-relaxed text-ink-2">{str(p.summary)}</p>}
        {str(p.keyword) && <KeyValue items={[{ label: 'Target keyword', value: str(p.keyword) }]} />}
        {strs(p.competitors).length > 0 && (
          <div>
            <SectionTitle>Compared with</SectionTitle>
            <Chips items={strs(p.competitors)} />
          </div>
        )}
        {strs(p.hints).length > 0 && (
          <Callout tone="info" title="To make it stronger next time">
            <Bullets items={strs(p.hints)} />
          </Callout>
        )}
        {!ok && <Callout tone="critical">{str(p.error) || str(p.spawn_error) || 'The follow-up run did not start.'}</Callout>}
        {ok && <p className="text-xs text-ink-3">The full report appears here as soon as it is ready.</p>}
      </CardBody>
    </Card>
  );
}

export function RejectedReport({ report }: { report: ReportDetail }) {
  return (
    <Callout tone="critical" title="The SEO engine did not run this request">
      {str(report.payload.error) || 'No reason was given.'}
    </Callout>
  );
}

export function DescriptionReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const d = obj(p.site_description);
  const list = (k: string) => strs(d[k]);
  return (
    <div className="space-y-5">
      {p.site_read_failed === true && <Callout tone="warning">The homepage could not be read automatically (blocked or empty), so this description is based on what was entered.</Callout>}
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <ScanText className="size-4" aria-hidden /> {str(d.industry)}
          </div>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.01em] text-ink">{str(d.business_name) || str(p.domain)}</h2>
          {str(d.one_line_summary) && <p className="mt-1 text-[15px] text-ink-2">{str(d.one_line_summary)}</p>}
          {str(d.business_description) && <p className="mt-4 text-sm leading-relaxed text-ink-2">{str(d.business_description)}</p>}
        </CardBody>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {list('products_or_services').length > 0 && (
          <Block title="Products and services">
            <Bullets items={list('products_or_services')} />
          </Block>
        )}
        {list('target_audience').length > 0 && (
          <Block title="Who it is for">
            <Bullets items={list('target_audience')} />
          </Block>
        )}
        {list('unique_selling_points').length > 0 && (
          <Block title="What sets it apart">
            <Bullets items={list('unique_selling_points')} tone="good" />
          </Block>
        )}
        <Block title="Positioning">
          <KeyValue
            items={[
              { label: 'Area served', value: str(d.location_served) || '–' },
              { label: 'Brand tone', value: str(d.tone_of_brand) || '–' },
              { label: 'Suggested title', value: str(d.suggested_meta_title) || '–' },
              { label: 'Suggested description', value: str(d.suggested_meta_description) || '–' },
            ]}
          />
        </Block>
      </div>
      {list('seed_keywords').length > 0 && (
        <Block title="Keywords customers would search" description="Starting points for keyword discovery">
          <div className="flex flex-wrap gap-1.5">
            {list('seed_keywords').map((k) => (
              <SeedKeyword key={k} keyword={k} siteId={report.siteId} />
            ))}
          </div>
        </Block>
      )}
      <LedgerCard ledger={p.run_ledger} />
    </div>
  );
}

function SeedKeyword({ keyword, siteId }: { keyword: string; siteId: string | null }) {
  const { org, can } = useOrgCtx();
  if (!can('member')) return <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[13px] text-ink-2">{keyword}</span>;
  return (
    <ButtonLink to={paths.tool(org.id, 'verdict', { siteId, prefill: keywordPrefill({ keyword }) })} variant="secondary" size="sm" title="Check this keyword">
      {keyword}
    </ButtonLink>
  );
}

export function ConsoleAlertReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const sev = str(p.severity).toLowerCase();
  return (
    <div className="space-y-5">
      <Callout tone={sev.startsWith('crit') || sev === 'high' ? 'critical' : sev ? 'warning' : 'info'} title={str(p.subject) || 'Search Console notice'}>
        {str(p.summary) || str(p.text) || str(p.action) || 'Google sent a Search Console notification for this website.'}
        {str(p.kind) && <span className="mt-1 block text-xs text-ink-3">Type: {str(p.kind).replace(/_/g, ' ')}</span>}
      </Callout>
      {str(p.action) && str(p.summary) && (
        <Block title="What to do">
          <p className="text-sm text-ink-2">{str(p.action)}</p>
        </Block>
      )}
      <JsonViewer value={p} title="Notification details" />
    </div>
  );
}

/** Any stage without a dedicated view: headline values plus the raw payload. */
export function GenericReport({ report }: { report: ReportDetail }) {
  const summary = Object.entries(report.summary ?? {}).filter(([, v]) => v !== null && v !== '');
  const p = report.payload;
  const text = str(p.summary) || str(p.message) || str(p.error);
  return (
    <div className="space-y-5">
      {text && <Callout tone={report.status === 'rejected' ? 'critical' : 'info'}>{text}</Callout>}
      {summary.length > 0 && (
        <Block title="Summary">
          <KeyValue items={summary.map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').toLowerCase(), value: typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v) }))} />
        </Block>
      )}
      <LedgerCard ledger={p.run_ledger} />
      <JsonViewer value={p} defaultOpen={!summary.length && !text} />
    </div>
  );
}
