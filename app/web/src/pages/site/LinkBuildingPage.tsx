// Link building (v4.13, n8n/seo-agent/LINK_BUILDER_SPEC.md): the weekly Link Builder finds sites worth a link, checks them, finds the right
// person, picks our page and the link text, and drafts a short sequence; a person approves it here and it goes out from the company's own
// mailbox, a few a day, stopping at the first reply. Then the replies, the listings to add by hand, redirects, and what won links did.
import { useState } from 'react';
import { CalendarClock, FlaskConical, Handshake, Mail, MessageSquareReply, Search, Target, Trophy } from 'lucide-react';
import { formatPercent, type LinkBuildingData } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { paths } from '@/lib/paths';
import { useLinkBuilding } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { Collapsible, CountUp, HeroLink, HeroNextStep, HeroStat, MetricCard, Stagger, SummaryHero, useSurface } from '@/components/insight';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { DataGate, useSitePage } from './_components/kit';
import { plural } from './_components/format';
import { DashSkeleton, HeroEyebrow } from './_components/visuals';
import { approvalLine, draftCounts, ReadyToSend } from './_components/links/drafts';
import { InProgress, needsAnswer, Replies, sequenceGroups } from './_components/links/sequences';
import { Impact, Listings, Redirects } from './_components/links/listings';
import { LinkSettingsCard, RunDialog } from './_components/links/settings';
import { jumpTo, typeLabel } from './_components/links/common';

export default function LinkBuildingPage() {
  const { org, site, can } = useSitePage();
  const q = useLinkBuilding(org.id, site.id);
  const [runOpen, setRunOpen] = useState(false);
  const admin = can('admin');
  return (
    <div>
      <PageHeader
        icon={<Handshake />}
        title="Link building"
        description={`Pitches to sites worth a link to ${site.domain}, sent from your own mailbox once you approve them. Then the replies, the listings you can add yourself and what each won link did.`}
        actions={
          admin ? (
            <Button icon={<Search className="size-4" />} onClick={() => setRunOpen(true)}>
              Find opportunities now
            </Button>
          ) : undefined
        }
      />
      <DataGate q={q} skeleton={<DashSkeleton cards={4} charts={0} />}>
        {(d) => <LinkBuilding d={d} onRun={admin ? () => setRunOpen(true) : undefined} />}
      </DataGate>
      {admin && <RunDialog open={runOpen} onOpenChange={setRunOpen} />}
    </div>
  );
}

/** A "go to that section" link inside the hero (looks like HeroLink, scrolls instead of navigating). */
// L7: two subject styles per batch, the reply rate of each, and nothing called better before there is enough to read.
function SubjectAb({ ab }: { ab: LinkBuildingData['subjectAb'] }) {
  const cols: Column<LinkBuildingData['subjectAb']['rows'][number]>[] = [
    { key: 'variant', header: 'Style', cell: (r) => <span className="text-ink">{r.variant}{ab.leader === r.variant ? ' · ahead' : ''}</span> },
    { key: 'subject', header: 'Example subject', cell: (r) => <span className="text-ink-2">{r.subject || '-'}</span> },
    { key: 'sent', header: 'First e-mails', align: 'right', sortValue: (r) => r.sent, cell: (r) => <span className="tabular">{r.sent}</span> },
    { key: 'replied', header: 'Replies', align: 'right', sortValue: (r) => r.replied, cell: (r) => <span className="tabular">{r.replied}</span> },
    { key: 'rate', header: 'Reply rate', align: 'right', sortValue: (r) => r.replyRate ?? -1, cell: (r) => <span className="tabular">{r.replyRate != null ? formatPercent(r.replyRate) : '-'}</span> },
  ];
  return (
    <div className="space-y-2">
      <DataTable rows={ab.rows} rowKey={(r) => r.variant} columns={cols} dense />
      <p className="flex items-start gap-1.5 text-[13px] text-ink-3">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{ab.note}</span>
      </p>
    </div>
  );
}

function HeroJump({ to, children }: { to: string; children: string }) {
  const surface = useSurface();
  return (
    <button
      type="button"
      onClick={() => jumpTo(to)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md text-[13px] font-medium underline-offset-4 transition-colors duration-150 ease-brand hover:underline',
        surface === 'blue' ? 'text-on-ink decoration-on-ink/60' : 'text-accent-on-ink decoration-accent-on-ink/50',
      )}
    >
      {children}
      <span aria-hidden>then</span>
    </button>
  );
}

function LinkBuilding({ d, onRun }: { d: LinkBuildingData; onRun?: () => void }) {
  const { org, role, can } = useSitePage();
  const k = d.kpis;
  const counts = draftCounts(d);
  const { running, replies } = sequenceGroups(d);
  const toAnswer = replies.filter(needsAnswer).length;
  const toList = d.listings.filter((l) => l.status === 'missing' || l.status === 'unknown').length;
  const linked = d.listings.filter((l) => l.status === 'linked').length;
  const pitches = (n: number) => plural(n, 'pitch', 'pitches');

  const title = k.wonMonth
    ? `${plural(k.wonMonth, 'link')} won this month${counts.drafted ? ` (${pitches(counts.drafted)} ready for you)` : ''}`
    : toAnswer
      ? `${plural(toAnswer, 'reply', 'replies')} to answer`
      : counts.drafted
        ? `${pitches(counts.drafted)} ready for your approval`
        : running.length
          ? `${plural(running.length, 'conversation')} in progress`
          : d.lastRun
            ? 'No pitches waiting this week'
            : 'Your first link opportunities arrive on Monday';

  const next =
    !d.canSend.ok && can('admin')
      ? { title: 'Connect your mailbox so approved pitches can go out', action: <HeroLink to={paths.settings(org.id, 'mailboxes')}>Open Mailboxes</HeroLink> }
      : toAnswer
        ? { title: `Answer ${plural(toAnswer, 'reply', 'replies')} while the conversation is fresh`, action: <HeroJump to="replies">Go to the replies</HeroJump> }
        : counts.drafted
          ? { title: `Read and approve ${pitches(counts.drafted)}`, action: <HeroJump to="ready">Review the pitches</HeroJump> }
          : toList
            ? { title: `Add yourself to ${plural(toList, 'listing')} worth being on`, action: <HeroJump to="listings">See the listings</HeroJump> }
            : d.redirects.length
              ? { title: `Add ${plural(d.redirects.length, 'redirect')} for old URLs that 404`, action: <HeroJump to="redirects">See the redirects</HeroJump> }
              : null;

  const typeCols: Column<LinkBuildingData['kpis']['byType'][number]>[] = [
    { key: 'type', header: 'Opportunity', sortValue: (r) => typeLabel(r.type), cell: (r) => <span className="text-ink">{typeLabel(r.type)}</span> },
    { key: 'sent', header: 'Contacted', align: 'right', sortValue: (r) => r.sent, cell: (r) => <span className="tabular">{r.sent}</span> },
    { key: 'replied', header: 'Replied', align: 'right', sortValue: (r) => r.replied, cell: (r) => <span className="tabular">{r.replied}</span> },
    { key: 'won', header: 'Won', align: 'right', sortValue: (r) => r.won, cell: (r) => <span className="tabular">{r.won}</span> },
  ];

  return (
    <Stagger className="space-y-6">
      {!d.canSend.ok &&
        (role === 'viewer' ? (
          <Callout tone="info">You can see everything here. Members and admins approve pitches and answer replies.</Callout>
        ) : (
          <Callout
            tone="warning"
            title="Pitches cannot go out yet"
            action={
              can('admin') ? (
                <>
                  <ButtonLink size="sm" variant="secondary" to={paths.settings(org.id, 'mailboxes')} icon={<Mail className="size-3.5" />}>
                    Company settings &gt; Mailboxes
                  </ButtonLink>
                  <GuideButton id="mailbox-connect" label="How to connect it" />
                </>
              ) : undefined
            }
          >
            {d.canSend.why}
            {!can('admin') && ' Ask an admin of your company.'}
          </Callout>
        ))}

      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Link building">{d.lastRun ? `Last search ${fmtDate(d.lastRun)} · every Monday 11:00` : 'Every Monday 11:00'}</HeroEyebrow>}
        title={title}
        description={approvalLine(d)}
        aside={next ? <HeroNextStep icon={<Handshake />} title={next.title} actions={next.action} /> : undefined}
        stats={
          <>
            <HeroStat
              label="Pitches to review"
              value={<CountUp value={counts.drafted} />}
              hint={counts.live > counts.drafted ? `${counts.live - counts.drafted} more ${counts.live - counts.drafted === 1 ? 'site' : 'sites'} found` : 'drafted for your approval'}
              onClick={() => jumpTo('ready')}
            />
            <HeroStat label="In progress" value={<CountUp value={running.length} />} hint="going out or waiting for a reply" onClick={() => jumpTo('progress')} />
            <HeroStat label="Replies to answer" value={<CountUp value={toAnswer} />} hint={`${k.replied} ${k.replied === 1 ? 'person' : 'people'} replied in all`} onClick={() => jumpTo('replies')} />
            <HeroStat label="Listings to add" value={<CountUp value={toList} />} hint={`${linked} linked already`} onClick={() => jumpTo('listings')} />
          </>
        }
      />

      <div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard
            className="col-span-2 lg:col-span-1"
            icon={<Trophy />}
            tone={k.wonMonth ? 'good' : 'blue'}
            label="Links won"
            info="Counted when our link check finds your link live on their page. A link you mark won counts once the check confirms it."
            value={<CountUp value={k.wonMonth} />}
            deltaLabel="this month"
            meta={`${k.wonAll} in all`}
          />
          <MetricCard
            icon={<Mail />}
            label="E-mails sent"
            info="E-mails that went out from your mailbox this month: first e-mails, follow-ups and your answers. Failed sends are not counted."
            value={<CountUp value={k.sentMonth} />}
            deltaLabel="this month"
            meta={`${plural(k.contactedDomains, 'site')} contacted in all`}
          />
          {/* B11-1: a rate is shown only once there is enough to read one from, under the floor the counts and what is still
              needed take its place, the same rule the subject-line test below already applies. */}
          <MetricCard
            icon={<MessageSquareReply />}
            label="Reply rate"
            info={`People who replied ÷ conversations started. Out-of-office and other automatic replies are not counted. No rate is shown under ${k.rates.reply.min} conversations: a reply or two says nothing about a rate. Link outreach usually gets 4-9% replies, journalist pitches about 13%.`}
            value={k.replyRate != null ? <CountUp value={k.replyRate} format={(v) => formatPercent(v)} /> : '-'}
            meta={k.replyRate != null ? `${k.replied} replied · ${k.positive} positive` : k.rates.reply.note}
          />
          <MetricCard
            icon={<Target />}
            label="Win rate"
            info={`Sites that linked ÷ sites contacted, once ${k.rates.win.min} sites have been contacted. Links are rare by nature: the one published funnel with its arithmetic shown puts it at roughly 13 links per 1,000 sites e-mailed (Hunter, 2026), so a quiet month is normal. Bounces above 2% hurt your mailbox's reputation, but that limit cannot be measured under ${k.rates.bounce.min} e-mails, so no bounce rate is shown until then.`}
            value={k.winRate != null ? <CountUp value={k.winRate} format={(v) => formatPercent(v)} /> : '-'}
            meta={
              k.bounceRate != null && k.bounceRate > 2 ? (
                <StatusBadge tone="warning">{formatPercent(k.bounceRate)} bounced</StatusBadge>
              ) : k.bounceRate != null ? (
                `${formatPercent(k.bounceRate)} bounced · ${k.unsubscribes} opted out`
              ) : (
                `${k.rates.win.value == null ? k.rates.win.note : `${k.rates.bounce.hits} bounced of ${k.rates.bounce.sample} sent`} · ${k.unsubscribes} opted out`
              )
            }
          />
          <MetricCard
            icon={<CalendarClock />}
            label="Days to link"
            info="The median number of days between the first e-mail and the link going live."
            value={k.medianDaysToLink != null ? <CountUp value={k.medianDaysToLink} /> : '-'}
            meta="median, first e-mail to link live"
          />
        </div>
        {k.byType.length > 0 && (
          <Collapsible className="mt-3" label="Results by opportunity type" openLabel="Hide results by type" contentClassName="pt-2">
            <DataTable rows={k.byType} rowKey={(r) => r.type} columns={typeCols} dense initialSort={{ key: 'sent', dir: 'desc' }} />
          </Collapsible>
        )}
        {d.subjectAb.rows.some((r) => r.sent > 0) && (
          <Collapsible className="mt-3" label="Subject lines being tested" openLabel="Hide the subject lines" contentClassName="pt-2">
            <SubjectAb ab={d.subjectAb} />
          </Collapsible>
        )}
      </div>

      <ReadyToSend d={d} onRun={onRun} />
      <InProgress d={d} />
      <Replies d={d} />
      <Listings d={d} />
      <Redirects d={d} />
      <Impact d={d} />
      <LinkSettingsCard d={d} onRun={onRun} />
    </Stagger>
  );
}
