// Report of the weekly Link Builder (callback stage `link_builder`, v4.13, n8n/seo-agent/LINK_BUILDER_SPEC.md): pitches drafted for approval,
// journalist requests, listings to add, redirects for old URLs that 404, and what won links did. The work itself happens on the Link building page.
import { ArrowRight, BarChart3, ClipboardList, CornerDownRight, Handshake, Mail } from 'lucide-react';
import { OPPORTUNITY_LABEL, titleCase, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ExternalLink } from '@/components/ui/misc';
import { CountUp, HeroStat, Stagger } from '@/components/insight';
import { Block, Empty, num, obj, objs, shortUrl, str } from './kit';
import { ReportHero } from './visuals';

const LISTING: Record<string, { label: string; tone: Tone }> = {
  linked: { label: 'Linked', tone: 'good' },
  listed: { label: 'Listed, no link seen', tone: 'accent' },
  missing: { label: 'Not listed', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'accent' },
  unknown: { label: 'Can’t check automatically', tone: 'neutral' },
  ignored: { label: 'Not relevant', tone: 'neutral' },
};
const VERDICT: Record<string, { label: string; tone: Tone }> = {
  likely_helped: { label: 'Likely helped', tone: 'good' },
  possibly_helped: { label: 'Possibly helped', tone: 'accent' },
  no_effect_yet: { label: 'No measurable effect yet', tone: 'neutral' },
  too_early: { label: 'Too early', tone: 'neutral' },
  cant_tell: { label: 'Can’t tell', tone: 'neutral' },
};
const tag = (t: { label: string; tone: Tone }) => (t.tone === 'neutral' ? <Badge>{t.label}</Badge> : <StatusBadge tone={t.tone}>{t.label}</StatusBadge>);

export function LinkBuilderReport({ report }: { report: ReportDetail }) {
  const { org } = useOrgCtx();
  const p = report.payload;
  const s = obj(p.summary);
  const drafted = objs(p.drafted);
  const listings = objs(p.listings);
  const redirects = objs(p.redirects);
  const impact = objs(p.impact);
  const free = p.free_only === true;
  const n = (k: string) => num(s[k]) ?? 0;
  const pitches = num(s.drafted) ?? drafted.length;
  const missing = num(s.listings_missing) ?? listings.filter((l) => str(l.status) === 'missing').length;
  const page = report.siteId ? paths.site(org.id, report.siteId, 'links') : null;

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={free ? 'Free check' : undefined}
        title={pitches ? `${pitches} ${pitches === 1 ? 'pitch' : 'pitches'} ready for your approval` : free ? 'Link opportunities found (free check, no pitches drafted)' : 'Link opportunities this week'}
        description="Nothing is sent for you: every pitch waits for approval on the Link building page and goes out from your own mailbox. Listings are never submitted automatically."
        actions={
          page ? (
            <ButtonLink to={page} icon={<Handshake className="size-4" />}>
              Open Link building
            </ButtonLink>
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="Pitches drafted" value={<CountUp value={pitches} />} hint={n('needs_contact') ? `${n('needs_contact')} more without an e-mail address` : 'waiting for approval'} />
            <HeroStat label="Journalist requests" value={<CountUp value={n('press')} />} hint="on your topics" />
            <HeroStat label="Not listed yet" value={<CountUp value={missing} />} hint={n('listings_linked') ? `${n('listings_linked')} linked already` : 'places to add yourself'} />
            <HeroStat label="Redirects to add" value={<CountUp value={num(s.redirects) ?? redirects.length} />} hint="old URLs that 404" />
          </>
        }
      />
      {str(s.writer_error) && <Callout tone="warning" title="Some pitches were not written">{str(s.writer_error)}</Callout>}
      {n('not_fit') > 0 && (
        <p className="text-[13px] text-ink-3">
          {n('not_fit')} {n('not_fit') === 1 ? 'site was' : 'sites were'} checked and left out (selling links, off topic, contacted recently or no page that answers).
        </p>
      )}

      <Block title="Pitches drafted this week" icon={<Mail />} description="Read, edit and approve them on the Link building page" flush>
        {drafted.length ? (
          <ul className="divide-y divide-line text-[13px]">
            {drafted.map((d, i) => (
              <li key={i} className="flex flex-col gap-1 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-medium text-ink">{str(d.prospect_domain)}</span>
                <Badge className="h-5 w-fit px-1.5 font-normal">{OPPORTUNITY_LABEL[str(d.type)] ?? titleCase(str(d.type) || 'other')}</Badge>
                {str(d.target_url) && (
                  <span className="flex min-w-0 items-center gap-1 text-ink-3 sm:ml-auto">
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                    <ExternalLink href={str(d.target_url)}>{shortUrl(str(d.target_url))}</ExternalLink>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-4">
            <Empty>{free ? 'The free check drafts no e-mails.' : 'No new pitches this week.'}</Empty>
          </div>
        )}
      </Block>

      {listings.length > 0 && (
        <Block title="Links you can add yourself" icon={<ClipboardList />} description="Directories and platforms worth being on; we check every week whether your listing is live" flush>
          <ul className="divide-y divide-line text-[13px]">
            {listings.slice(0, 25).map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span className="text-ink">{str(l.name) || str(l.listing_id)}</span>
                {tag(LISTING[str(l.status)] ?? { label: titleCase(str(l.status) || 'unknown'), tone: 'neutral' })}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {redirects.length > 0 && (
        <Block title="Redirects to add" icon={<CornerDownRight />} description="Old URLs of yours that now answer 404: a 301 keeps the value of the links pointing at them" flush>
          <ul className="divide-y divide-line text-[13px]">
            {redirects.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-2">
                <code className="min-w-0 font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{str(r.from)}</code>
                <ArrowRight className="hidden size-3.5 shrink-0 text-ink-3 sm:block" aria-hidden />
                {str(r.to) ? <ExternalLink href={str(r.to)}>{shortUrl(str(r.to))}</ExternalLink> : <span className="text-ink-3">no close page found</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {impact.length > 0 && (
        <Block
          title="What your links did"
          icon={<BarChart3 />}
          description="The page each won link points to, against your pages without a new link"
          info="We say “likely helped”, never “caused”: the page's position is compared with your other pages over the same weeks, so site-wide swings cancel out."
          flush
        >
          <ul className="divide-y divide-line text-[13px]">
            {impact.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 text-ink [overflow-wrap:anywhere]">
                  {str(r.ref_domain)} → {str(r.target_url) ? shortUrl(str(r.target_url)) : 'your page'}
                </span>
                <span className="flex shrink-0 items-center gap-2 sm:ml-auto">
                  <span className="text-xs text-ink-3">{num(r.weeks) ?? 0} weeks</span>
                  {tag(VERDICT[str(r.verdict)] ?? { label: titleCase(str(r.verdict) || 'unknown'), tone: 'neutral' })}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </Stagger>
  );
}
