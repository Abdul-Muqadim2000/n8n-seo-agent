// Indexing (Index coverage, 2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md §6.1): which of the website's pages Google
// left out of search, the reason Google gives, what it means, what we do and what the client does; new pages apart from the rest;
// pages that dropped out; Google's own updates and what they did to this website. Read only: the engine's daily index check writes the
// data; the client's fixes are "Steps on your website" (checked by us) and a rewrite is always the client's click.
import { useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FileSearch, History, Link2, ListChecks, Settings2, Sparkles, TrendingDown, TriangleAlert } from 'lucide-react';
import {
  INDEX_ACTION_INFO,
  INDEX_GROUP_PREVIEW,
  improveKeywordOf,
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
import { useIndexing, useIndexingHistory, useIndexingPages } from '@/lib/queries';
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
          description={`Every day we ask Google about the pages of ${domain}, new pages first, within Google's daily limit. The first results appear after the next daily check. It needs Search Console connected.`}
          action={<GuideButton id="search-console-access" vars={{ domain }} label="Connect Search Console" />}
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
  const title = t.shouldBe ? `Google has ${n(t.indexed)} of your ${pages(t.shouldBe)} that should be in search` : `We know ${pages(t.known)} of ${domain}`;
  const existing = d.lanes.existing;
  const rest = t.daysToFinish ? `, about ${t.daysToFinish} day${t.daysToFinish === 1 ? '' : 's'} to check the rest` : '';
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
      {d.rollingOut && <UpdateBanner e={d.rollingOut} />}
      {d.capped && <Callout tone="info">Your website has more pages than we show at once. The figures cover the first {n(d.pagesRead)}; the daily check covers every page.</Callout>}

      <SummaryHero
        tone="blue"
        eyebrow={<HeroEyebrow tag="Index coverage">{d.checkedAt ? `Checked ${fmtDay(d.checkedAt)}` : 'Not checked yet'}</HeroEyebrow>}
        title={title}
        description={`${t.needYou ? `${pages(t.needYou)} need you.` : 'No page needs you right now.'} Existing pages checked: ${n(existing.checked)} of ${n(existing.known)}${rest}.`}
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

      {d.dropped.length > 0 && (
        <Panel icon={<TrendingDown />} iconTone="warning" title="Dropped out of Google search" description={`${pages(d.dropped.length)} that were in search before`} flush>
          <ul className="divide-y divide-line border-t border-line">
            {d.dropped.map((p) => (
              <PageRow key={p.url} p={p} orgId={orgId} siteId={siteId} member={member} freeze={d.freeze.on} />
            ))}
          </ul>
        </Panel>
      )}

      <UpdatesPanel events={d.events} impacts={d.impacts} rolling={d.rollingOut} />
      <SettingsCard d={d} orgId={orgId} siteId={siteId} />
    </Stagger>
  );
}

function UpdateBanner({ e }: { e: GoogleEvent }) {
  return (
    <Callout tone="info" title={`${e.title} is rolling out`}>
      Google is changing how it ranks pages{e.startedAt ? ` (since ${fmtDay(e.startedAt)})` : ''}. Pages move around while it rolls out, so we hold back rewrite suggestions until it is over. We then compare your pages before and after.
    </Callout>
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
  wait: 'neutral',
  leave_out: 'neutral',
  none: 'good',
};

function GroupPanel({ g, orgId, siteId, domain, member, freeze }: { g: IndexGroup; orgId: string; siteId: string; domain: string; member: boolean; freeze: boolean }) {
  const [page, setPage] = useState(1);
  // a short list first (none for pages that need nothing), the whole group on request, paged by 25
  const [all, setAll] = useState(false);
  const first = g.action === 'leave_out' || g.action === 'wait' || g.action === 'none' ? 0 : 5;
  const more = all && g.count > INDEX_GROUP_PREVIEW;
  const q = useIndexingPages(orgId, siteId, more && page > 1 ? { lane: g.lane, action: g.action, cause: g.cause, page } : null);
  const shown = !all ? g.pages.slice(0, first) : page > 1 && q.data?.status === 'ok' ? q.data.items : g.pages;
  const last = Math.max(1, Math.ceil(g.count / INDEX_GROUP_PREVIEW));
  return (
    <Panel
      icon={g.action === 'site_fix' ? <TriangleAlert /> : g.action === 'none' ? <CheckCircle2 /> : g.action === 'links' ? <Link2 /> : g.action === 'quality' ? <Sparkles /> : <CircleDashed />}
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
  const st = STATE[p.state];
  const facts = [
    p.checkedAt ? `checked ${fmtDay(p.checkedAt)}` : 'not checked yet',
    p.impressions28d ? `${n(p.impressions28d)} impressions in 28 days` : null,
    p.inSitemap ? 'in your sitemap' : 'not in your sitemap',
    p.needsPerson ? 'unchanged after 4 checks: worth a closer look' : null,
  ].filter(Boolean);
  const improve = p.action === 'quality' && !freeze && member;
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
              {i.rows.filter((r) => r.state === 'dropped').length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {i.rows
                    .filter((r) => r.state === 'dropped')
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
