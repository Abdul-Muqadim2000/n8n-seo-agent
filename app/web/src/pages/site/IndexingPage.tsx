// Indexing (Index coverage, 2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md §6.1): which of the website's pages Google
// left out of search, the reason Google gives, what it means, what we do and what the client does; new pages apart from the rest;
// pages that dropped out; Google's own updates and what they did to this website. Read only: the engine's daily index check writes the
// data; the client's fixes are "Steps on your website" (checked by us) and a rewrite is always the client's click.
import { useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FileSearch, History, Link2, ListChecks, Map as MapIcon, MousePointerClick, SearchCheck, Settings2, Sparkles, TrendingDown, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  askGoogleStatus,
  INDEX_ACTION_INFO,
  INDEX_GROUP_PREVIEW,
  improveKeywordOf,
  indexInSearchLine,
  indexPath,
  type IndexSitemapState,
  type GoogleEvent,
  type IndexGroup,
  type IndexingData,
  type IndexLane,
  type IndexPage,
  type UpdateImpact,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { CountUp, HeroLink, HeroNextStep, HeroStat, InfoTip, InsightItem, Stagger, SummaryHero } from '@/components/insight';
import { StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { SitemapAccessLine } from '@/components/site/MonitorSettingsFields';
import { toastError } from '@/lib/api';
import { useAskedGoogle, useIndexing, useIndexingHistory, useIndexingPages } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { fmtDay } from '@/lib/utils';
import { DataGate, Panel, useSitePage } from './_components/kit';
import { DashSkeleton, HeroEyebrow } from './_components/visuals';

const n = (v: number) => v.toLocaleString('en-US');
const pages = (c: number) => `${n(c)} page${c === 1 ? '' : 's'}`;

export default function IndexingPage() {
  const { org, site, can } = useSitePage();
  const q = useIndexing(org.id, site.id);
  return (
    <div>
      <PageHeader
        icon={<FileSearch />}
        title="Indexing"
        description={`Which pages of ${site.domain} Google left out of search, why, and what to do about each.`}
        actions={<GuideButton id="index-coverage" vars={{ domain: site.domain }} label="How this works" />}
      />
      <DataGate q={q} skeleton={<DashSkeleton cards={4} charts={0} />}>
        {(d) => <Indexing d={d} orgId={org.id} siteId={site.id} domain={site.domain} member={can('member')} />}
      </DataGate>
    </div>
  );
}

type Props = { d: IndexingData | { status: 'unreadable'; error: string }; orgId: string; siteId: string; domain: string; member: boolean };

/** The page body from one answer (also rendered by the web tests). */
export function Indexing({ d, orgId, siteId, domain, member }: Props) {
  if (d.status === 'unreadable' || !('totals' in d)) {
    return (
      <Stagger className="space-y-6">
        <Callout tone="warning" title="We could not read your index check">
          {('error' in d && d.error) || 'Nothing is lost. Try again in a few minutes.'} The rest of your dashboard is not affected.
        </Callout>
        {'settings' in d && <SettingsCard d={d} orgId={orgId} siteId={siteId} />}
      </Stagger>
    );
  }
  if (!d.settings.on && d.status === 'empty') {
    return (
      <Stagger className="space-y-6">
        <EmptyState icon={<FileSearch />} title="The daily index check is off" description="Switch it on in the website's tracking settings to see which pages Google left out of search and why. It is free." action={<ButtonLink size="sm" to={paths.site(orgId, siteId, 'settings/tracking')}>Open tracking settings</ButtonLink>} />
      </Stagger>
    );
  }
  if (d.status === 'empty') {
    return (
      <Stagger className="space-y-6">
        <EmptyState
          icon={<FileSearch />}
          title="Your first index check is on its way"
          description={`Every morning we read Search Console for the pages of ${domain}, new pages first, within Google's daily limit. The first results appear after the next daily check. It needs Search Console connected; if nothing shows after two days, check the connection.`}
          action={<GuideButton id="search-console-access" vars={{ domain }} label="Connect Search Console" />}
        />
        <SettingsCard d={d} orgId={orgId} siteId={siteId} />
      </Stagger>
    );
  }
  // A4: every check so far could not read Search Console: say so, never "No page needs you"
  if (d.status === 'failed') {
    return (
      <Stagger className="space-y-6">
        <EmptyState
          icon={<TriangleAlert />}
          title={d.notice?.title ?? 'Our last check could not read this website'}
          description={`${d.notice?.text ?? ''} No page of ${domain} has been checked yet.`}
          action={<GuideButton id="search-console-access" vars={{ domain }} label="Check the Search Console connection" />}
        />
        <SettingsCard d={d} orgId={orgId} siteId={siteId} />
      </Stagger>
    );
  }
  return <IndexingBody d={d} orgId={orgId} siteId={siteId} domain={domain} member={member} />;
}

function IndexingBody({ d, orgId, siteId, domain, member }: { d: IndexingData; orgId: string; siteId: string; domain: string; member: boolean }) {
  const t = d.totals;
  const firstFix = d.groups.find((g) => g.action === 'site_fix');
  const [lane, setLane] = useState<IndexLane>(d.lanes.new.needYou > 0 && d.lanes.existing.needYou === 0 ? 'new' : 'existing');
  // A9: the same sentence as the report, from the pages Google gave a reading of
  const title = indexInSearchLine({ indexed: t.indexed, shouldBe: t.shouldBe, known: t.known, notChecked: t.unknown + t.errors }, domain);
  const existing = d.lanes.existing;
  const rest = t.daysToFinish ? `, about ${t.daysToFinish} day${t.daysToFinish === 1 ? '' : 's'} to check the rest at ${n(d.settings.dailyCap)} a day` : '';
  // A4: a check that could not read Search Console never reads as "nothing needs you"
  const needLine = d.notice?.failed ? `${d.notice.title}, so these figures are from ${d.checkedAt ? `the check of ${fmtDay(d.checkedAt)}` : 'an earlier check'}.` : t.needYou ? `${pages(t.needYou)} need you.` : 'No page needs you right now.';
  return (
    <Stagger className="space-y-6">
      {!d.settings.on && (
        <Callout tone="info" title="The daily index check is off">
          What you see is from the last check. Switch it back on in the tracking settings to keep it current.{' '}
          <ButtonLink size="sm" variant="ghost" to={paths.site(orgId, siteId, 'settings/tracking')}>
            Open tracking settings
          </ButtonLink>
        </Callout>
      )}
      {d.notice && (
        <Callout tone={d.notice.tone} title={d.notice.title}>
          {d.notice.text}{' '}
          {d.notice.accessLost && <GuideButton id="search-console-access" vars={{ domain }} label="Check the Search Console connection" />}
        </Callout>
      )}
      {d.sitemapPartial && (
        <Callout tone="info" title="We could not read your whole sitemap">
          Part of your sitemap did not open for us, so nothing is ticked off today because a page is or is not listed in it. The other checks go on as usual.
        </Callout>
      )}
      {d.rollingOut && <UpdateBanner e={d.rollingOut} frozen={d.freeze.on} />}
      {d.capped && <Callout tone="info">Your website has more pages than we show at once. The figures cover the first {n(d.pagesRead)}; the daily check reads the others too, each page on its own schedule.</Callout>}

      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Index coverage">{d.notice?.failed ? `Could not check ${fmtDay(d.notice.at)}${d.checkedAt ? `, last check ${fmtDay(d.checkedAt)}` : ''}` : d.checkedAt ? `Checked ${fmtDay(d.checkedAt)}` : 'Not checked yet'}</HeroEyebrow>}
        title={title}
        description={`${needLine} Existing pages checked: ${n(existing.checked)} of ${n(existing.known)}${rest}.`}
        aside={
          firstFix ? (
            <HeroNextStep title={firstFix.label} actions={<HeroLink to={`${paths.site(orgId, siteId, 'pipeline')}#site-tasks`}>Steps on your website</HeroLink>} />
          ) : undefined
        }
        stats={
          <>
            <HeroStat label="In Google search" value={<CountUp value={t.indexed} format={n} />} info="Pages Google has and can show in search: its own inspection said so, or the page had search impressions in the last 28 days." />
            <HeroStat label="Need you" value={<CountUp value={t.needYou} format={n} />} info="Pages to fix on your website, to improve, to merge, or to link to." />
            <HeroStat label="Not checked yet" value={<CountUp value={t.unknown} format={n} />} info="Google lets each website be checked a limited number of times a day, shared with every tool you use. We check new pages first, then work through the rest." />
            <HeroStat label="Dropped out" value={<CountUp value={d.dropped.length} format={n} />} info="Pages that were in Google search and are not any more." />
          </>
        }
      />

      <Tabs value={lane} onValueChange={(v) => setLane(v as IndexLane)}>
        <TabList>
          <Tab value="new" count={d.lanes.new.known}>
            New pages
          </Tab>
          <Tab value="existing" count={d.lanes.existing.known}>
            Existing pages
          </Tab>
        </TabList>
        {(['new', 'existing'] as const).map((ln) => (
          <TabPanel key={ln} value={ln} className="space-y-4">
            <LaneLine d={d} lane={ln} />
            {d.groups.filter((g) => g.lane === ln).length ? (
              d.groups.filter((g) => g.lane === ln).map((g) => <GroupPanel key={g.id} g={g} orgId={orgId} siteId={siteId} domain={domain} member={member} freeze={d.freeze.on} />)
            ) : (
              <p className="text-sm text-ink-3">{ln === 'new' ? 'No new page from the last 30 days needs anything.' : 'Nothing here needs anything yet.'}</p>
            )}
          </TabPanel>
        ))}
      </Tabs>

      {(d.askGoogle.length > 0 || (d.askedGoogle?.length ?? 0) > 0) && <AskGooglePanel items={d.askGoogle} asked={d.askedGoogle ?? []} domain={domain} orgId={orgId} siteId={siteId} member={member} />}

      {d.dropped.length > 0 && (
        <Panel icon={<TrendingDown />} iconTone="warning" title="Dropped out of Google search" description={`${pages(d.dropped.length)} that ${d.dropped.length === 1 ? 'was' : 'were'} in search before`} flush>
          <ul className="divide-y divide-line border-t border-line">
            {d.dropped.map((p) => (
              <PageRow key={p.url} p={p} orgId={orgId} siteId={siteId} member={member} freeze={d.freeze.on} />
            ))}
          </ul>
        </Panel>
      )}

      {d.sitemap && <SitemapPanel s={d.sitemap} domain={domain} orgId={orgId} siteId={siteId} />}
      <UpdatesPanel events={d.events} impacts={d.impacts} rolling={d.rollingOut} />
      <SettingsCard d={d} orgId={orgId} siteId={siteId} />
    </Stagger>
  );
}

function UpdateBanner({ e, frozen }: { e: GoogleEvent; frozen: boolean }) {
  return (
    <Callout tone="info" title={`${e.title} is rolling out`}>
      Google is changing how it ranks pages{e.startedAt ? ` (since ${fmtDay(e.startedAt)})` : ''}. Pages move around while it rolls out
      {frozen ? ', so we hold back rewrite suggestions until it is over' : ''}. We then compare your pages before and after.
    </Callout>
  );
}

/** FIX_CONTRACT (X8) + wave 2 (DESIGN_WAVE2 §3.2): the few pages where asking Google to read them again in Search Console is the right next
 *  step. Never automated: the client asks Google, presses "I asked Google", and the page then follows Google's next reading. */
function AskGooglePanel({ items, asked, domain, orgId, siteId, member }: { items: IndexPage[]; asked: IndexPage[]; domain: string; orgId: string; siteId: string; member: boolean }) {
  const mark = useAskedGoogle(orgId, siteId);
  const why = (p: IndexPage) => (p.fixSeenAt ? 'fixed on your site, Google has not read it again yet' : p.lane === 'new' ? 'a new page Google has not put in search yet' : 'an important page Google has not read yet');
  return (
    <Panel
      icon={<MousePointerClick />}
      iconTone="blue"
      title="Ask Google to read these pages again"
      description="A few pages a day, by hand in Search Console. We never do it for you, and Google still decides. Press I asked Google once you have: we then follow what Google does."
      actions={<GuideButton id="index-request-indexing" vars={{ domain, pageUrl: items[0]?.url ?? asked[0]?.url ?? '' }} />}
      flush
    >
      <ul className="divide-y divide-line border-t border-line">
        {[...items, ...asked].map((p) => {
          const st = askGoogleStatus(p);
          // ENGINE_BUILD wave 2 contract 6: a press the daily check did not keep ("lost") can be pressed again
          const canMark = member && ((items.includes(p) && (st.state === 'none' || st.state === 'quiet')) || st.state === 'lost');
          return (
            <InsightItem
              key={p.url}
              tone={st.state === 'read' ? 'good' : 'blue'}
              icon={<SearchCheck className="size-4" />}
              meta={st.state === 'read' ? <StatusBadge tone="good">Read again</StatusBadge> : st.state === 'waiting' ? <StatusBadge tone="accent">Waiting for Google</StatusBadge> : st.state === 'lost' ? <StatusBadge tone="warning">Not recorded</StatusBadge> : undefined}
              title={<span className="break-all">{p.path}</span>}
              titleAttr={p.title || p.url}
              description={st.text ? `${st.text}${st.state === 'read' ? ` ${p.state === 'indexed' ? 'It is in Google search now.' : 'Google has not put it in search yet; the groups above say why.'}` : ''}` : why(p)}
              actionPosition="side"
              action={
                canMark ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CheckCircle2 className="size-4" />}
                    loading={mark.isPending && mark.variables === p.url}
                    onClick={() =>
                      mark.mutate(p.url, {
                        onSuccess: () => toast.success(`Noted. ${indexPath(p.url)} is waiting for Google to read it again.`),
                        onError: (e) => toastError(e),
                      })
                    }
                  >
                    I asked Google
                  </Button>
                ) : undefined
              }
            />
          );
        })}
      </ul>
    </Panel>
  );
}

const SUBMISSION_STATUS: Record<IndexSitemapState['submissions'][number]['status'], { tone: Tone; label: string }> = {
  ok: { tone: 'good', label: 'Submitted' },
  refused: { tone: 'warning', label: 'Refused by Google' },
  error: { tone: 'warning', label: 'Not submitted' },
};

/** wave 2 (DESIGN_WAVE2 §3.2): the sitemap switch, the access Google reports for us, and every submission with Google's read date. */
function SitemapPanel({ s, domain, orgId, siteId }: { s: IndexSitemapState; domain: string; orgId: string; siteId: string }) {
  // ENGINE_BUILD wave 2 contract 11: Search Console lists no sitemap; with the switch on and Full access we submit it, nothing to do
  const willSubmit = s.submitOn && s.access === 'full' && s.submitted === 0;
  if (!s.submitOn && !s.submissions.length && s.access !== 'restricted') return null;
  return (
    <Panel
      icon={<MapIcon />}
      title="Your sitemap in Search Console"
      description={
        !s.submitOn
          ? 'Sitemap submission is off: you submit your sitemap in Search Console yourself.'
          : s.access === 'full'
            ? 'Sitemap submission is on: when your sitemap is missing from Search Console or has changed, we submit it, at most once a week.'
            : 'Sitemap submission is on, but nothing can be submitted until Google gives us Full access.'
      }
      actions={
        <ButtonLink size="sm" variant="secondary" to={paths.site(orgId, siteId, 'settings/tracking')}>
          Change
        </ButtonLink>
      }
      flush
    >
      <div className="space-y-2 border-t border-line px-5 py-3">
        <SitemapAccessLine info={{ access: s.access, at: s.accessAt }} domain={domain} on={s.submitOn} />
        {willSubmit && <p className="text-[13px] text-ink-2">Search Console lists no sitemap for {domain} yet. We will submit it on the next daily check; there is nothing to do on your side.</p>}
      </div>
      {s.submissions.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {s.submissions.map((x) => (
            <InsightItem
              key={`${x.path}-${x.at}`}
              tone={x.status === 'ok' ? 'good' : 'warning'}
              icon={<MapIcon className="size-4" />}
              meta={<StatusBadge tone={SUBMISSION_STATUS[x.status].tone}>{SUBMISSION_STATUS[x.status].label}</StatusBadge>}
              title={<span className="break-all">{indexPath(x.path)}</span>}
              titleAttr={x.path}
              description={[
                `${x.status === 'ok' ? 'Submitted' : 'Tried'} on ${fmtDay(x.at)}`,
                x.reason ? `because ${x.reason}` : null,
                x.status === 'ok' ? (x.readAt ? `Google read your sitemap on ${fmtDay(x.readAt)}` : 'Google has not read it since') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </ul>
      ) : (
        s.submitOn && <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Nothing submitted yet. Search Console already lists your sitemap, or the daily check has not run since you switched it on.</p>
      )}
    </Panel>
  );
}

function LaneLine({ d, lane }: { d: IndexingData; lane: IndexLane }) {
  const l = d.lanes[lane];
  return (
    <p className="text-sm text-ink-2">
      {lane === 'new' ? 'Pages we wrote, or that appeared in your sitemap, in the last 30 days. ' : 'Every other page we know on your website. '}
      {n(l.indexed)} of {n(l.shouldBe)} in search · {n(l.needYou)} need you · {n(l.unknown)} not checked yet
    </p>
  );
}

const ACTION_TONE: Record<IndexGroup['action'], 'warning' | 'blue' | 'good' | 'neutral'> = {
  site_fix: 'warning',
  quality: 'blue',
  duplicate: 'blue',
  links: 'blue',
  review: 'warning',
  wait: 'neutral',
  retry: 'neutral',
  leave_out: 'neutral',
  none: 'good',
};

function GroupPanel({ g, orgId, siteId, domain, member, freeze }: { g: IndexGroup; orgId: string; siteId: string; domain: string; member: boolean; freeze: boolean }) {
  const [page, setPage] = useState(1);
  // a short list first (none for pages that need nothing), the whole group on request, paged by 25
  const [all, setAll] = useState(false);
  const first = g.action === 'leave_out' || g.action === 'wait' || g.action === 'retry' || g.action === 'none' ? 0 : 5;
  const more = all && g.count > INDEX_GROUP_PREVIEW;
  const q = useIndexingPages(orgId, siteId, more && page > 1 ? { lane: g.lane, action: g.action, cause: g.cause, page } : null);
  // A19: page 2 and on show their own rows only (never page 1's under a "Page 2" label while reading or after a failed read)
  const pageRead = page > 1 ? (q.data?.status === 'ok' ? q.data.items : null) : g.pages;
  const shown = !all ? g.pages.slice(0, first) : (pageRead ?? []);
  const last = Math.max(1, Math.ceil(g.count / INDEX_GROUP_PREVIEW));
  return (
    <Panel
      icon={g.action === 'site_fix' || g.action === 'review' ? <TriangleAlert /> : g.action === 'none' ? <CheckCircle2 /> : g.action === 'links' ? <Link2 /> : g.action === 'quality' ? <Sparkles /> : <CircleDashed />}
      iconTone={ACTION_TONE[g.action]}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {g.label}
          <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold tabular text-ink-2">{n(g.count)}</span>
        </span>
      }
      description={INDEX_ACTION_INFO[g.action].label}
      actions={
        <span className="flex flex-wrap items-center gap-1.5">
          {g.taskKey && (
            <ButtonLink size="sm" variant="secondary" to={`${paths.site(orgId, siteId, 'pipeline')}#site-tasks`} icon={<ListChecks className="size-4" />}>
              Open the step
            </ButtonLink>
          )}
          {g.guide && <GuideButton id={g.guide} vars={{ domain, pageUrl: g.pages[0]?.url ?? '' }} />}
        </span>
      }
      flush
    >
      <dl className="grid gap-3 border-t border-line px-5 py-4 text-[13px] leading-snug sm:grid-cols-3">
        <div>
          <dt className="font-medium text-ink">What it means</dt>
          <dd className="mt-0.5 text-ink-2">{g.meaning}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">What we do</dt>
          <dd className="mt-0.5 text-ink-2">{g.weDo}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">What you do</dt>
          <dd className="mt-0.5 text-ink-2">{g.youDo}</dd>
        </div>
      </dl>
      {g.action === 'quality' && freeze && <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">A Google update is rolling out. Wait until it is over before you change these pages.</p>}
      {all && page > 1 && !pageRead && (
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">{q.isError || q.data?.status === 'unreadable' ? 'This page of the list could not be read just now.' : 'Reading this page of the list'}</p>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map((p) => (
            <PageRow key={p.url} p={p} orgId={orgId} siteId={siteId} member={member} freeze={freeze} />
          ))}
        </ul>
      )}
      {!all && g.count > first && (
        <div className="border-t border-line px-5 py-2.5">
          <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
            {first ? `Show all ${pages(g.count)}` : `Show the ${pages(g.count)}`}
          </Button>
        </div>
      )}
      {more && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px] text-ink-3">
          <span>
            Page {page} of {last} · {pages(g.count)}
          </span>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="ghost" disabled={page >= last} loading={q.isFetching} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </span>
        </div>
      )}
    </Panel>
  );
}

const STATE: Record<IndexPage['state'], { tone: Tone; label: string }> = {
  indexed: { tone: 'good', label: 'In search' },
  not_indexed: { tone: 'warning', label: 'Left out' },
  excluded: { tone: 'neutral', label: 'Left out' },
  unknown: { tone: 'neutral', label: 'Not checked yet' },
  error: { tone: 'neutral', label: 'Could not check' },
};

function PageRow({ p, orgId, siteId, member, freeze }: { p: IndexPage; orgId: string; siteId: string; member: boolean; freeze: boolean }) {
  const st = p.fixSeenAt ? { tone: 'good' as Tone, label: 'Fixed, waiting for Google' } : STATE[p.state];
  const facts = [
    p.checkedAt ? `checked ${fmtDay(p.checkedAt)}` : 'not checked yet',
    p.fixSeenAt ? `we saw it fixed on ${fmtDay(p.fixSeenAt)}` : null,
    // R1 (final browser check): the row says it too, not only its details: Google read it again after the change we saw, problem still there
    p.fixFailedAt ? `Google read it again on ${fmtDay(p.fixFailedAt)}, after the change we saw, and still sees the problem` : null,
    p.impressions28d ? `${n(p.impressions28d)} impressions in 28 days` : null,
    p.inSitemap ? 'in your sitemap' : 'not in your sitemap',
    // wave 2: which pages of the website link to it (the engine reads the home page and the parent pages)
    p.linkedBy.length ? `linked from ${p.linkedBy.map(indexPath).join(', ')}` : null,
    askGoogleStatus(p).text || null,
    p.needsPerson ? 'unchanged after 4 checks: worth a closer look' : null,
  ].filter(Boolean);
  const improve = p.action === 'quality' && !freeze && member && !p.utility;
  return (
    <InsightItem
      tone={p.state === 'indexed' ? 'good' : p.action === 'site_fix' ? 'warning' : 'blue'}
      icon={<FileSearch className="size-4" />}
      meta={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
      title={<span className="break-all">{p.path}</span>}
      titleAttr={p.title || p.url}
      description={facts.join(' · ')}
      detail={<PageDetail p={p} orgId={orgId} siteId={siteId} />}
      detailLabel="Details and history"
      actionPosition="side"
      action={
        improve ? (
          <ButtonLink size="sm" variant="secondary" to={paths.tool(orgId, 'keyword', { siteId, prefill: { keyword: improveKeywordOf(p.title, p.url), existingPageUrl: p.url } })} icon={<ArrowRight className="size-4" />}>
            Improve this page
          </ButtonLink>
        ) : undefined
      }
    />
  );
}

function PageFacts({ p }: { p: IndexPage }) {
  const rows = [
    p.note ? { k: 'In short', v: p.note } : null,
    p.coverage ? { k: 'Google says', v: p.coverage } : null,
    p.httpStatus ? { k: 'Our visit', v: `answered ${p.httpStatus}${p.finalUrl && p.finalUrl !== p.url ? `, ended at ${p.finalUrl}` : ''}${p.noindex ? `, noindex in the ${p.noindex === 'header' ? 'server answer' : 'page'}` : ''}` } : null,
    p.googleCanonical && p.googleCanonical !== p.url ? { k: 'Main version Google chose', v: p.googleCanonical } : null,
    p.pageCanonical && p.pageCanonical !== p.url ? { k: 'Main version the page names', v: p.pageCanonical } : null,
    p.mergeInto ? { k: 'Suggested to merge into', v: p.mergeInto } : null,
    p.lastCrawl ? { k: 'Google last read it', v: fmtDay(p.lastCrawl) } : null,
    p.nextCheckAt ? { k: 'Next check', v: fmtDay(p.nextCheckAt) } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <dl className="grid gap-1 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-3">
          {rows.map((r) => (
            <div key={r.k} className="contents">
              <dt className="text-ink-3">{r.k}</dt>
              <dd className="break-all text-ink-2">{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.linkFrom.length > 0 && (
        <div>
          <p className="font-medium text-ink">Link to it from these pages of yours in search</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {p.linkFrom.map((l) => (
              <li key={l.url} className="break-all">
                {l.title || l.url}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The page's facts, and its history read only when asked for (closed details stay in the page, so nothing is read for rows nobody opens). */
function PageDetail({ p, orgId, siteId }: { p: IndexPage; orgId: string; siteId: string }) {
  const [want, setWant] = useState(false);
  const h = useIndexingHistory(orgId, siteId, want ? p.url : null);
  return (
    <div className="space-y-3">
      <PageFacts p={p} />
      <div>
        <p className="flex items-center gap-1.5 font-medium text-ink">
          <History className="size-3.5" aria-hidden /> History
        </p>
        {!want ? (
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => setWant(true)}>
            Show what changed over time
          </Button>
        ) : h.isLoading ? (
          <p className="text-ink-3">Reading the history</p>
        ) : h.data?.status === 'ok' && h.data.history.length ? (
          <ul className="mt-1 space-y-0.5">
            {h.data.history.map((e) => (
              <li key={`${e.at}-${e.cause}`}>
                <span className="tabular text-ink-3">{fmtDay(e.at)}</span> · {e.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-3">{h.data?.status === 'unreadable' || h.isError ? 'The history could not be read just now.' : 'No change recorded yet.'}</p>
        )}
      </div>
    </div>
  );
}

const EVENT_STATUS: Record<GoogleEvent['status'], { tone: Tone; label: string }> = {
  rolling_out: { tone: 'warning', label: 'Rolling out' },
  complete: { tone: 'good', label: 'Finished' },
  changed: { tone: 'accent', label: 'Policy page changed' },
  other: { tone: 'neutral', label: 'Announced' },
};

function UpdatesPanel({ events, impacts, rolling }: { events: GoogleEvent[]; impacts: UpdateImpact[]; rolling: GoogleEvent | null }) {
  return (
    <Panel
      icon={<CalendarClock />}
      title="Google updates"
      description={rolling ? `${rolling.title} is rolling out` : events.length ? 'What Google announced, and what it did to your pages' : 'Nothing announced recently'}
      info="Read every day from Google's own Search Status Dashboard. Seven days after an update finishes we compare your pages before and after it."
      flush
    >
      {impacts.length > 0 && (
        <div className="space-y-3 border-t border-line px-5 py-4">
          {impacts.map((i) => (
            <div key={i.eventId} className="text-[13px] text-ink-2">
              <p className="font-medium text-ink">After {i.eventTitle}</p>
              <p>
                {n(i.dropped)} of your pages lost ground, {n(i.stable)} held and {n(i.gained)} gained
                {i.before.from && i.after.to ? ` (${fmtDay(i.before.from)} to ${fmtDay(i.before.to)} against ${fmtDay(i.after.from)} to ${fmtDay(i.after.to)})` : ''}.
                {i.note ? ` ${i.note}` : ''}
              </p>
              {i.rows.filter((r) => r.segment === 'dropped').length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {i.rows
                    .filter((r) => r.segment === 'dropped')
                    .slice(0, 8)
                    .map((r) => (
                      <li key={r.url} className="break-all">
                        {r.path}: {n(r.beforeClicks)} clicks before, {n(r.afterClicks)} after
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {events.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {events.map((e) => (
            <InsightItem
              key={e.id}
              tone={e.status === 'rolling_out' ? 'warning' : 'neutral'}
              icon={<CalendarClock className="size-4" />}
              meta={<StatusBadge tone={EVENT_STATUS[e.status].tone}>{EVENT_STATUS[e.status].label}</StatusBadge>}
              title={e.title}
              description={[e.startedAt ? `from ${fmtDay(e.startedAt)}` : '', e.endedAt ? `to ${fmtDay(e.endedAt)}` : ''].filter(Boolean).join(' ')}
              action={e.url ? <a className="text-[13px] text-accent-text underline" href={e.url} target="_blank" rel="noreferrer">Google&apos;s notice</a> : undefined}
              actionPosition="side"
            />
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-5 py-4 text-[13px] text-ink-3">No core or spam update was announced in the period we keep.</p>
      )}
    </Panel>
  );
}

function SettingsCard({ d, orgId, siteId }: { d: Pick<IndexingData, 'settings'>; orgId: string; siteId: string }) {
  return (
    <Panel
      icon={<Settings2 />}
      title="Settings"
      description="Free: it uses Google's data only, no credits."
      actions={
        <ButtonLink size="sm" variant="secondary" to={paths.site(orgId, siteId, 'settings/tracking')}>
          Change
        </ButtonLink>
      }
    >
      <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-ink-3">Daily index check</dt>
          <dd className="mt-0.5 font-medium text-ink">{d.settings.on ? 'On' : 'Off'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-ink-3">
            Pages checked with Google a day
            <InfoTip label="About the daily limit">Google allows 2,000 checks a day for each website, shared by every tool you use. We keep well under it so your other tools keep their share.</InfoTip>
          </dt>
          <dd className="mt-0.5 font-medium tabular text-ink">{n(d.settings.dailyCap)}</dd>
        </div>
      </dl>
    </Panel>
  );
}
