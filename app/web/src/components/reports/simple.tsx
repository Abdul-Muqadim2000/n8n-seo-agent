import type { ReactNode } from 'react';
import { Activity, AlertOctagon, ArrowRight, BellRing, Braces, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Clock, ExternalLink as ExternalIcon, Eye, FileJson, Hourglass, KeyRound, Link2, ListChecks, ListOrdered, Lightbulb, MapPin, MessageSquareText, PenLine, Rocket, ScanText, Sparkles, Tags, Target, UserCheck, Users } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ExternalLink, KeyValue } from '@/components/ui/misc';
import { CountUp, HeroStat, InsightItem, ProgressBar, ScoreRing, Stagger } from '@/components/insight';
import { Block, Bullets, CheckRow, Chips, CodeBlock, Disclosure, Empty, Facts, has, JsonViewer, LedgerCard, n, num, obj, objs, shortUrl, str, strs, type P } from './kit';
import { keywordPrefill, stageLabel } from './meta';
import { ReportHero, ScoreMark, StatusMark, WordValue } from './visuals';

// Renderers for the short callbacks: publish check, business profile, check-in, cadence, set-up and "started" notices,
// site description, rejections, alerts, and the generic fallback.

export function PublishedReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const checks = objs(p.checks);
  const failed = strs(p.failed);
  const page = obj(p.page);
  const linkFrom = Array.isArray(p.link_from) ? p.link_from : [];
  const live = p.live === true;
  const passed = num(p.passed) ?? checks.filter((c) => c.ok === true).length;
  const headline = live ? (failed.length ? `Live, with ${failed.length} thing${failed.length === 1 ? '' : 's'} to fix` : 'Live and ready to rank') : `The page could not be fetched${num(p.http_status) ? ` (HTTP ${num(p.http_status)})` : ''}`;
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={headline}
        description={
          <>
            {str(p.summary)}
            {str(p.published_url) && <span className="mt-1 block font-mono text-xs [overflow-wrap:anywhere]">{str(p.published_url)}</span>}
          </>
        }
        aside={
          checks.length ? (
            <ScoreMark score={passed} max={checks.length} label="Live checks passed" display={`${passed}/${checks.length}`} suffix="" status={live ? (failed.length ? `Live · ${failed.length} to fix` : 'Live') : 'Not reachable'} statusTone={live ? (failed.length ? 'warning' : 'good') : 'critical'} ringTone={live ? (failed.length ? 'warning' : 'good') : 'critical'} />
          ) : (
            <StatusMark tone={live ? 'good' : 'critical'} icon={<Rocket />} title={live ? 'Live' : 'Not reachable'} />
          )
        }
        actions={
          str(p.published_url) ? (
            <a href={str(p.published_url)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
              <ExternalIcon className="size-4" aria-hidden /> Open the page
            </a>
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Checks passed" value={<CountUp value={passed} />} hint={`of ${checks.length}`} />
            <HeroStat label="To fix" value={<CountUp value={failed.length} />} hint={failed.length ? failed.slice(0, 2).join(' · ') : 'Nothing'} />
            {has(page) && <HeroStat label="Words" value={n(page.words)} />}
            {has(page) && <HeroStat label="JSON-LD blocks" value={String(num(page.jsonld_blocks) ?? 0)} />}
          </>
        }
      />
      {str(p.fetch_error) && <Callout tone="critical" title="Fetching the page failed">{str(p.fetch_error)}</Callout>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Block title="Live checks" description={`${passed} of ${checks.length} passed`} icon={<ListChecks />}>
          {checks.length ? (
            <>
              <ProgressBar value={passed} max={checks.length} label="Passed" valueLabel={`${passed} of ${checks.length}`} tone={passed >= checks.length ? 'good' : 'accent'} className="mb-2" />
              <ul className="divide-y divide-line">
                {checks.map((c, i) => (
                  <CheckRow key={i} ok={c.ok === true ? true : c.ok === false ? false : null} label={str(c.name)} detail={str(c.detail) || str(c.fix)} />
                ))}
              </ul>
            </>
          ) : (
            <Empty>No checks ran.</Empty>
          )}
        </Block>
        <div className="space-y-5">
          {has(page) && (
            <Block title="What Google sees" icon={<Eye />}>
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
          <Block title="Link to it from" description="Existing pages that should link to the new one" icon={<Link2 />} flush={linkFrom.length > 0}>
            {linkFrom.length ? (
              <ul className="divide-y divide-line">
                {linkFrom.map((l, i) => {
                  const o = obj(l);
                  const url = typeof l === 'string' ? l : str(o.url) || str(o.from_url) || str(o.page);
                  return (
                    <InsightItem
                      key={i}
                      icon={<Link2 />}
                      title={url ? <ExternalLink href={url}>{shortUrl(url)}</ExternalLink> : <span className="text-ink">{str(o.keyword) || str(o.title)}</span>}
                      description={
                        str(o.anchor) || str(o.reason) ? (
                          <>
                            {str(o.anchor) && <>anchor “{str(o.anchor)}” </>}
                            {str(o.reason)}
                          </>
                        ) : undefined
                      }
                    />
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
    </Stagger>
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
  const editLink =
    report.siteId && can('admin') ? (
      <ButtonLink to={paths.site(org.id, report.siteId, 'settings/profile')} variant="secondary" size="sm">
        Edit profile
      </ButtonLink>
    ) : undefined;
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={p.stored === false ? 'The profile could not be saved' : str(profile.business_name) ? `Business profile for ${str(profile.business_name)}` : 'Business profile'}
        description={p.stored === false ? undefined : str(p.summary) || undefined}
        aside={<ScoreMark score={eeat} label="Author and E-E-A-T" display={eeat != null ? <CountUp value={eeat} format={(v) => `${Math.round(v)}%`} /> : undefined} suffix="" caption="How complete the author, reviewer and credentials are" />}
        actions={editLink}
        stats={
          <>
            <HeroStat label="Author and E-E-A-T" value={eeat != null ? `${eeat}%` : '–'} />
            <HeroStat label="Local business details" value={local != null ? `${local}%` : '–'} />
            <HeroStat label="Fields on file" value={<CountUp value={rows.length} />} />
            <HeroStat label="Changed in this update" value={<CountUp value={strs(p.changed).length} />} />
          </>
        }
      />
      {str(p.summary) && p.stored === false && <Callout tone="critical">{str(p.summary)}</Callout>}
      <div className="grid gap-5 md:grid-cols-2">
        <ScoreCard title="Author and E-E-A-T" icon={<UserCheck />} score={eeat} items={objs(p.eeat_checklist)} />
        <ScoreCard title="Local business details" icon={<MapPin />} score={local} items={objs(p.local_checklist)} />
      </div>
      {rows.length > 0 && (
        <Block title="Profile on file" icon={<Building2 />} actions={editLink}>
          <KeyValue items={rows} />
          {strs(p.changed).length > 0 && (
            <p className="mt-4 text-xs text-ink-3">
              Changed in this update: {strs(p.changed).map((k) => PROFILE_LABELS[k] ?? k).join(', ')}
            </p>
          )}
        </Block>
      )}
      {has(preview) && (
        <Block title="Schema preview" description="The structured data every new page will carry" icon={<Braces />}>
          <div className="space-y-2">
            {Object.entries(preview).map(([k, v]) => (
              <Disclosure key={k} title={k === 'person' ? 'Person (author)' : k === 'local_business' ? 'LocalBusiness' : k.replace(/_/g, ' ')} defaultOpen={k === 'person'}>
                <CodeBlock text={JSON.stringify(v, null, 2)} />
              </Disclosure>
            ))}
          </div>
        </Block>
      )}
    </Stagger>
  );
}

function ScoreCard({ title, icon, score, items }: { title: string; icon: ReactNode; score: number | null; items: P[] }) {
  return (
    <Block title={title} icon={icon} actions={<ScoreRing value={score} label={`${title} completeness`} display={score != null ? `${score}%` : undefined} size={56} />}>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <CheckRow key={i} ok={it.ok === true ? true : it.ok === false ? false : null} label={str(it.item)} detail={it.ok === false ? str(it.hint) : undefined} />
          ))}
        </ul>
      ) : (
        <p className="font-display text-2xl font-semibold text-ink">{score != null ? `${score}%` : '–'}</p>
      )}
    </Block>
  );
}

export function CheckinReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const cov = obj(p.coverage);
  const reasons = objs(cov.reasons);
  const urls = objs(cov.urls);
  const summary = Array.isArray(p.summary) ? strs(p.summary) : str(p.summary) ? [str(p.summary)] : [];
  const issue = p.manual_action === true || p.security_issue === true;
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={`Check-in for ${str(p.month) || 'this month'}`}
        description={issue ? 'Search Console reports a problem that needs action.' : 'No manual action and no security issue reported.'}
        aside={<StatusMark tone={issue ? 'critical' : 'good'} icon={issue ? <AlertOctagon /> : <CheckCircle2 />} title={issue ? 'Issue reported' : 'All clear'} caption={p.stored === true ? 'Recorded for this month' : undefined} />}
        actions={
          <span className="flex flex-wrap gap-1.5">
            <StatusBadge tone={p.manual_action === true ? 'critical' : 'good'}>{p.manual_action === true ? 'Manual action reported' : 'No manual action'}</StatusBadge>
            <StatusBadge tone={p.security_issue === true ? 'critical' : 'good'}>{p.security_issue === true ? 'Security issue reported' : 'No security issue'}</StatusBadge>
            {p.stored === true && <Badge>recorded</Badge>}
          </span>
        }
        stats={
          has(cov) && str(cov.kind) !== 'none' ? (
            <>
              <HeroStat label="Indexed" value={n(cov.indexed_total)} />
              <HeroStat label="Not indexed" value={n(cov.not_indexed_total)} />
              <HeroStat label="Rows read" value={n(cov.rows)} hint="from the Pages export" />
            </>
          ) : undefined
        }
      />
      {summary.length > 0 && (
        <Block title="Summary" icon={<ClipboardCheck />}>
          <Bullets items={summary} />
        </Block>
      )}
      {has(cov) && str(cov.kind) !== 'none' && (
        <Block title="Pages report" icon={<ListOrdered />} description={str(cov.kind) === 'reasons' ? 'Why pages are not indexed' : str(cov.kind) === 'urls' ? 'Pages listed in the export' : 'Indexed pages on the last day of the export'}>
          <Facts
            cols="sm:grid-cols-3"
            items={[
              { icon: <CheckCircle2 />, label: 'Indexed', value: n(cov.indexed_total) },
              { icon: <Eye />, label: 'Not indexed', value: n(cov.not_indexed_total) },
              { icon: <FileJson />, label: 'Rows read', value: n(cov.rows) },
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
    </Stagger>
  );
}

export function CadenceReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const pages = objs(p.pages);
  const upcoming = objs(p.upcoming);
  const pending = objs(p.pending_publish);
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={str(p.week) ? `week of ${str(p.week)}` : undefined}
        title={pages.length ? `${pages.length} ${pages.length === 1 ? 'page is' : 'pages are'} being written this week` : 'No page this week'}
        description={pages.length ? 'Each page arrives as its own report when it is finished.' : pending.length ? 'Written pages are waiting to be published first.' : 'No candidate keyword was ready.'}
        stats={
          <>
            <HeroStat label="Being written" value={<CountUp value={pages.length} />} />
            <HeroStat label="Candidates in the queue" value={<CountUp value={num(p.candidates) ?? upcoming.length} />} />
            <HeroStat label="Waiting to be published" value={<CountUp value={pending.length} />} hint={pending.length ? 'Publish them first' : undefined} />
          </>
        }
      />
      <Block title={`Being written this week${str(p.week) ? ` (${str(p.week)})` : ''}`} description="Each page arrives as its own report when it is finished" icon={<CalendarClock />} flush={pages.length > 0}>
        {pages.length ? (
          <ul className="divide-y divide-line">
            {pages.map((x, i) => (
              <InsightItem
                key={i}
                icon={<PenLine />}
                meta={
                  <>
                    <Badge tone="accent">{str(x.source) || 'planned'}</Badge>
                    {str(x.page_type) && <span className="text-xs text-ink-3">{str(x.page_type)}</span>}
                  </>
                }
                title={str(x.keyword)}
                description={str(x.why) || undefined}
              />
            ))}
          </ul>
        ) : (
          <Empty>No page this week: {pending.length ? 'written pages are waiting to be published first.' : 'no candidate keyword was ready.'}</Empty>
        )}
      </Block>
      {upcoming.length > 0 && (
        <Block title="Coming up next" description={`${num(p.candidates) ?? upcoming.length} candidates in the queue`} icon={<ListOrdered />} flush>
          <ol className="divide-y divide-line">
            {upcoming.map((x, i) => (
              <InsightItem key={i} icon={<span className="font-display text-xs font-semibold tabular">{i + 1}</span>} title={str(x.keyword)} description={str(x.why) || str(x.source)} />
            ))}
          </ol>
        </Block>
      )}
      {pending.length > 0 && (
        <Callout tone="warning" title="Waiting to be published">
          {pending.map((x) => str(x.keyword)).join(', ')}. Publish them and report the URL so they can be tracked.
        </Callout>
      )}
    </Stagger>
  );
}

export function TrackerSetupReport({ report }: { report: ReportDetail }) {
  const { org } = useOrgCtx();
  const p = report.payload;
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={`Tracking is set up${str(p.domain) ? ` for ${str(p.domain)}` : ''}`}
        description={str(p.next) || undefined}
        aside={<StatusMark tone="good" icon={<Activity />} title="Weekly tracking on" caption="Search Console, GA4, Google Trends and live rank checks" />}
        actions={
          report.siteId ? (
            <ButtonLink to={paths.site(org.id, report.siteId, 'search')} variant="primary" size="sm" icon={<ArrowRight className="size-4" />}>
              Open Search & traffic
            </ButtonLink>
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Keywords checked live" value={<CountUp value={strs(p.keywords).length} />} hint="every week" />
            <HeroStat label="GA4 property" value={<WordValue>{str(p.ga4_property_id) || 'Auto'}</WordValue>} hint={str(p.ga4_property_id) ? undefined : 'detected automatically when access is granted'} />
          </>
        }
      />
      {strs(p.keywords).length > 0 && (
        <Block title="Keywords checked live every week" icon={<KeyRound />}>
          <Chips items={strs(p.keywords)} />
        </Block>
      )}
      <Block title="Settings" icon={<Target />}>
        <KeyValue items={[{ label: 'GA4 property', value: str(p.ga4_property_id) || 'detected automatically when access is granted' }]} />
      </Block>
      {str(p.store_error) && <Callout tone="critical">Saving the settings failed: {str(p.store_error)}</Callout>}
    </Stagger>
  );
}

export function StartedReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const ok = p.started !== false && !str(p.error) && !str(p.spawn_error);
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        title={str(p.title) || stageLabel(report.stage)}
        description={str(p.summary) || undefined}
        aside={
          ok ? (
            <StatusMark tone="accent" icon={<Hourglass />} title={num(p.estimated_minutes) != null ? `About ${num(p.estimated_minutes)} min` : 'Started'} caption="The full report appears here as soon as it is ready." />
          ) : (
            <StatusMark tone="critical" icon={<AlertOctagon />} title="Did not start" />
          )
        }
        stats={
          str(p.keyword) || num(p.estimated_minutes) != null ? (
            <>
              {str(p.keyword) && <HeroStat label="Target keyword" value={<WordValue>{str(p.keyword)}</WordValue>} />}
              {num(p.estimated_minutes) != null && <HeroStat label="Ready in" value={`~${num(p.estimated_minutes)} min`} />}
            </>
          ) : undefined
        }
      />
      {strs(p.competitors).length > 0 && (
        <Block title="Compared with" icon={<Users />}>
          <Chips items={strs(p.competitors)} />
        </Block>
      )}
      {strs(p.hints).length > 0 && (
        <Callout tone="info" title="To make it stronger next time">
          <Bullets items={strs(p.hints)} />
        </Callout>
      )}
      {!ok && <Callout tone="critical">{str(p.error) || str(p.spawn_error) || 'The follow-up run did not start.'}</Callout>}
      {ok && (
        <p className="flex items-center gap-2 text-xs text-ink-3">
          <Clock className="size-3.5" aria-hidden /> The full report appears here as soon as it is ready.
        </p>
      )}
    </Stagger>
  );
}

export function RejectedReport({ report }: { report: ReportDetail }) {
  return (
    <Stagger className="space-y-5">
      <ReportHero report={report} title="The SEO engine did not run this request" aside={<StatusMark tone="critical" icon={<AlertOctagon />} title="Rejected" />} />
      <Callout tone="critical" title="Why">
        {str(report.payload.error) || 'No reason was given.'}
      </Callout>
    </Stagger>
  );
}

export function DescriptionReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const d = obj(p.site_description);
  const list = (k: string) => strs(d[k]);
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={str(d.industry) || undefined}
        title={str(d.business_name) || str(p.domain) || 'Site description'}
        description={str(d.one_line_summary) || undefined}
        stats={
          <>
            <HeroStat label="Products and services" value={<CountUp value={list('products_or_services').length} />} />
            <HeroStat label="Audiences" value={<CountUp value={list('target_audience').length} />} />
            <HeroStat label="Selling points" value={<CountUp value={list('unique_selling_points').length} />} />
            <HeroStat label="Seed keywords" value={<CountUp value={list('seed_keywords').length} />} hint="starting points for discovery" />
          </>
        }
      />
      {p.site_read_failed === true && <Callout tone="warning">The homepage could not be read automatically (blocked or empty), so this description is based on what was entered.</Callout>}
      {str(d.business_description) && (
        <Block title="The business" icon={<ScanText />} description={str(d.industry) || undefined}>
          <p className="text-sm leading-relaxed text-ink-2">{str(d.business_description)}</p>
        </Block>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {list('products_or_services').length > 0 && (
          <Block title="Products and services" icon={<Tags />}>
            <Bullets items={list('products_or_services')} />
          </Block>
        )}
        {list('target_audience').length > 0 && (
          <Block title="Who it is for" icon={<Users />}>
            <Bullets items={list('target_audience')} />
          </Block>
        )}
        {list('unique_selling_points').length > 0 && (
          <Block title="What sets it apart" icon={<Sparkles />}>
            <Bullets items={list('unique_selling_points')} tone="good" />
          </Block>
        )}
        <Block title="Positioning" icon={<Target />}>
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
        <Block title="Keywords customers would search" description="Starting points for keyword discovery: open one to check it" icon={<KeyRound />}>
          <div className="flex flex-wrap gap-1.5">
            {list('seed_keywords').map((k) => (
              <SeedKeyword key={k} keyword={k} siteId={report.siteId} />
            ))}
          </div>
        </Block>
      )}
      <LedgerCard ledger={p.run_ledger} />
    </Stagger>
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
  const tone = sev.startsWith('crit') || sev === 'high' ? 'critical' : sev ? 'warning' : 'accent';
  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={str(p.kind) ? `Type: ${str(p.kind).replace(/_/g, ' ')}` : undefined}
        title={str(p.subject) || 'Search Console notice'}
        description={str(p.summary) || str(p.text) || str(p.action) || 'Google sent a Search Console notification for this website.'}
        aside={<StatusMark tone={tone} icon={<BellRing />} title={str(p.severity) || 'Notice'} caption="From a Search Console notification e-mail" />}
      />
      {str(p.action) && str(p.summary) && (
        <Block title="What to do" icon={<Lightbulb />}>
          <p className="text-sm text-ink-2">{str(p.action)}</p>
        </Block>
      )}
      <JsonViewer value={p} title="Notification details" />
    </Stagger>
  );
}

/** Any stage without a dedicated view: headline values plus the raw payload. */
export function GenericReport({ report }: { report: ReportDetail }) {
  const summary = Object.entries(report.summary ?? {}).filter(([, v]) => v !== null && v !== '');
  const p = report.payload;
  const text = str(p.summary) || str(p.message) || str(p.error);
  return (
    <Stagger className="space-y-5">
      <ReportHero report={report} title={report.title || stageLabel(report.stage, report)} />
      {text && <Callout tone={report.status === 'rejected' ? 'critical' : 'info'}>{text}</Callout>}
      {summary.length > 0 && (
        <Block title="Summary" icon={<MessageSquareText />}>
          <KeyValue items={summary.map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').toLowerCase(), value: typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v) }))} />
        </Block>
      )}
      <LedgerCard ledger={p.run_ledger} />
      <JsonViewer value={p} defaultOpen={!summary.length && !text} />
    </Stagger>
  );
}
