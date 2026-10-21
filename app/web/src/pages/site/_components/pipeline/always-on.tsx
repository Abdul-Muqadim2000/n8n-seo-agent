// Pipeline home: the always-on part (suggestions, what the autopilot writes on its own, monitoring) and the weekly pages the ladders share.
import type { ReactNode } from 'react';
import { AlertTriangle, Bot, CalendarClock, ChevronRight, Circle, FileText, Flame, History, Lightbulb, PenSquare, Play, RefreshCw, Settings, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { AUTOMATIONS, type AutomationStatus, type LadderCard, type PipelineData, type QueueItem } from '@seo/shared';
import { siteTimezone, useCycleDay } from '@/lib/cycle-day';
import { PRICES } from '@/lib/prices';
import { formatCredits } from '@/lib/credits';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { IconTile } from '@/components/insight';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtAgo } from '@/lib/utils';
import { Panel, SectionHeading } from '../kit';
import { asPageType, AUTO_ICON, fmtWhen, inDays, validDate } from './common';
import type { WriteNowItem } from './WriteNowDialog';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';
import { autopilotGuideVars } from '@/lib/guide-vars';

// v4.16 (B4-3): `decay` = a page that is measurably losing traffic, refreshed rather than written again
export const SOURCE_LABEL: Record<QueueItem['source'], string> = { ladder: 'Your keyword', decay: 'Losing visitors', striking: 'Close to page one', trend: 'Rising search', ai_answer: 'AI answer page', ai_refresh: 'AI refresh' };
export const SOURCE_TONE: Record<QueueItem['source'], Tone> = { ladder: 'accent', decay: 'warning', striking: 'neutral', trend: 'neutral', ai_answer: 'accent', ai_refresh: 'accent' };
export const SOURCE_ICON: Record<QueueItem['source'], ReactNode> = { ladder: <TrendingUp />, decay: <TrendingDown />, striking: <Target />, trend: <Flame />, ai_answer: <Bot />, ai_refresh: <Bot /> };

function automationState(a: AutomationStatus): ReactNode {
  if (a.state === 'on') return <StatusBadge tone="good">On</StatusBadge>;
  if (a.state === 'paused') return <StatusBadge tone="warning">Paused</StatusBadge>;
  if (a.state === 'needs_setup') return <StatusBadge tone="warning">Needs setup</StatusBadge>;
  return <Badge icon={<Circle className="size-3" aria-hidden />}>Off</Badge>;
}

/** Ladders that get weekly posts, in the order they get them. */
const writingLadders = (cards: LadderCard[]) =>
  [...cards].filter((c) => c.mode !== 'manual' && !['paused', 'won', 'queued'].includes(c.status)).sort((a, b) => (a.priority || 99) - (b.priority || 99));

export function AlwaysOn({ data, cards, onWrite }: { data: PipelineData; cards: LadderCard[]; onWrite: (i: WriteNowItem) => void }) {
  return (
    <section aria-labelledby="always-on-heading" className="space-y-4">
      <SectionHeading
        id="always-on-heading"
        icon={<RefreshCw />}
        title="Always on"
        description="Runs next to your keywords: chances we found in Search Console, Google Trends and AI answers, and the weekly checks of your site."
      />
      <Capacity data={data} cards={cards} />
      <Suggestions data={data} onWrite={onWrite} />
      <Monitoring data={data} />
    </section>
  );
}

function Capacity({ data, cards }: { data: PipelineData; cards: LadderCard[] }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const tz = siteTimezone(site);
  const perWeek = data.queue?.pagesPerWeek ?? 0;
  const ladders = writingLadders(cards);
  const level = data.autopilot?.level ?? data.automation?.autopilotLevel ?? 2;
  const maxActive = data.automation?.maxActiveLadders ?? 2;
  const cadence = data.automations.find((a) => a.id === 'content_cadence');
  const users = [...ladders.map((l) => `"${l.head}"`), ...(level >= 2 ? [level === 3 ? 'new topics and refreshes' : 'refreshes of your pages'] : [])];
  const day = useCycleDay();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5 text-[13px]">
        <IconTile tone={perWeek > 0 ? 'solid' : 'neutral'} size="lg">
          <PenSquare />
        </IconTile>
        <div className="min-w-0">
          {perWeek > 0 ? (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-xl leading-tight font-semibold tracking-[-0.01em] text-ink">{perWeek === 1 ? '1 page a week' : `${perWeek} pages a week`}</span>
                {users.length > 0 && <span className="text-ink-3">used by:</span>}
              </p>
              {users.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1">
                  {users.map((u, i) => (
                    <span key={u} className="inline-flex items-center gap-1">
                      {i > 0 && <ChevronRight className="size-3.5 text-ink-3" aria-label="then" />}
                      <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', i === 0 ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-ink-2')}>{u}</span>
                    </span>
                  ))}
                </p>
              )}
            </>
          ) : (
            <p className="text-ink">
              <span className="font-display text-base font-semibold">Weekly pages are off.</span> <span className="text-ink-2">Nothing is written on its own; use Write it on a ladder page or a suggestion.</span>
            </p>
          )}
          <p className="mt-1.5 text-xs leading-snug text-ink-3">
            Shared by your keywords in their order, at most {maxActive === 1 ? '1 keyword' : `${maxActive} keywords`} at a time: the first gets the pages until it has nothing to write, then the next one.
            {perWeek > 0 && cadence && validDate(cadence.nextRunAt) ? ` Next writing: ${fmtWhen(cadence.nextRunAt, tz)}.` : ''}
          </p>
          {perWeek > 0 && data.queue?.paused && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-warning-text">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              The next weekly run ({day.on}) writes nothing: {data.queue.paused.waiting} written pages wait to be published (limit {data.queue.paused.max}).
            </p>
          )}
        </div>
      </div>
      {can('admin') && (
        <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="secondary" size="sm" className="self-start sm:self-center">
          {perWeek > 0 ? 'Change' : 'Turn on weekly pages'}
        </ButtonLink>
      )}
    </div>
  );
}

function QueueRow({ item, onWrite, highlight }: { item: QueueItem; onWrite?: (i: QueueItem) => void; highlight?: boolean }) {
  const { can } = useOrgCtx();
  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-[border-color,box-shadow] duration-200 ease-brand',
        highlight ? 'border-accent/40 bg-accent-soft/60' : 'border-line bg-surface hover:border-line-strong hover:shadow-card',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile size="sm" tone={highlight ? 'solid' : 'blue'} className="mt-0.5">
          {SOURCE_ICON[item.source] ?? <Lightbulb />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{item.keyword}</span>
            <Badge tone={SOURCE_TONE[item.source]}>{SOURCE_LABEL[item.source] ?? item.source}</Badge>
            <span className="text-xs text-ink-3">{asPageType(item.pageType)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-3">{item.why}</p>
          {item.existingPageUrl && <p className="mt-0.5 truncate text-xs text-ink-3">Improves {item.existingPageUrl.replace(/^https?:\/\/(www\.)?/, '')}</p>}
          {item.credits != null && item.credits > 0 && <p className="mt-0.5 text-xs text-ink-3">About {formatCredits(item.credits)}</p>}
        </div>
      </div>
      {onWrite && can('member') && (
        <Button size="sm" variant={highlight ? 'primary' : 'secondary'} icon={<PenSquare className="size-4" />} onClick={() => onWrite(item)}>
          Write it
        </Button>
      )}
    </li>
  );
}

function GroupTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
      <span className="text-accent-text [&_svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      {children}
    </h4>
  );
}

/**
 * Suggestions (keyword-first R-K3): what the autopilot found but does not write on its own at the website's level, each with why, the
 * page it would change and the credits, and "Write it" (one approved run). At levels 2 and 3 the items the level writes on its own are
 * listed first.
 */
function Suggestions({ data, onWrite }: { data: PipelineData; onWrite: (i: WriteNowItem) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const day = useCycleDay();
  const level = data.autopilot?.level ?? data.automation?.autopilotLevel ?? 2;
  // what the level writes on its own this week (never the ladders: they have their own cards)
  const next = (data.queue?.next ?? []).filter((i) => i.source !== 'ladder');
  const suggestions = data.autopilot?.suggestions ?? data.queue?.suggestions ?? [];
  const perWeek = data.queue?.pagesPerWeek ?? 0;
  const write = (i: QueueItem) => onWrite({ keyword: i.keyword, why: i.why, pageType: i.pageType, existingPageUrl: i.existingPageUrl, ladder: i.ladder, aiTarget: i.aiTarget ?? null, source: i.source, credits: i.credits });
  return (
    <Panel
      icon={<Lightbulb />}
      title="Suggestions"
      description={
        level === 1
          ? 'Chances we found: pages close to page one, pages losing visitors, rising searches and AI questions. Nothing here is written until you click Write it.'
          : level === 2
            ? 'We refresh your own pages on your topics on our own. New topics wait here until you click Write it.'
            : 'On full autopilot we write what fits your business on our own, and show it in Coming up first. The rest waits here.'
      }
      actions={
        <>
          <GuideButton id={AUTOPILOT_SCREEN_GUIDES.suggestions} vars={autopilotGuideVars(site, { level })} label="What waits for my OK" />
          {can('admin') && (
            <ButtonLink to={paths.site(org.id, site.id, 'settings/autopilot')} variant="ghost" size="sm" icon={<Settings className="size-4" />}>
              Level {level}
            </ButtonLink>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!next.length && !suggestions.length ? (
          <div className="flex items-start gap-3 rounded-lg bg-surface-2/60 px-4 py-3">
            <IconTile size="sm" tone="neutral">
              <Target />
            </IconTile>
            <p className="text-sm text-ink-3">
              No suggestions right now. They come from your weekly site report and AI checks: searches where you show up on page two, pages losing visitors, rising searches and
              questions AI answers without you.
            </p>
          </div>
        ) : (
          <>
            {!perWeek && next.length > 0 && (
              <Callout tone="info" title="Weekly pages are off">
                These would be written next. Turn weekly pages on, or write one now (about {PRICES.page()} each).
              </Callout>
            )}
            {next.length > 0 && (
              <div>
                <GroupTitle icon={<CalendarClock />}>Written on its own {day.on}</GroupTitle>
                <ul className="space-y-2">
                  {next.map((i) => (
                    <QueueRow key={i.keyword} item={i} onWrite={write} highlight />
                  ))}
                </ul>
              </div>
            )}
            {suggestions.length > 0 && (
              <div>
                <GroupTitle icon={<Lightbulb />}>Waiting for your OK: write the ones you want</GroupTitle>
                <ul className="space-y-2">
                  {suggestions.map((i) => (
                    <QueueRow key={i.keyword} item={i} onWrite={write} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Monitoring({ data }: { data: PipelineData }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const tz = siteTimezone(site);
  const list = data.automations.filter((a) => a.id !== 'content_cadence');
  return (
    <Panel
      icon={<CalendarClock />}
      title="Monitoring"
      description="Checks that run on their own, one after the other in your weekly run. Times are in your own time zone."
      actions={
        can('admin') && (
          <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="secondary" size="sm" icon={<Settings className="size-4" />}>
            Settings
          </ButtonLink>
        )
      }
    >
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((a) => {
          const info = AUTOMATIONS.find((x) => x.id === a.id);
          if (!info) return null;
          const runNow = info.runNowMode && a.state !== 'needs_setup' && can('member');
          return (
            <li
              key={a.id}
              className={cn(
                'flex min-w-0 flex-col rounded-xl border p-4 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-card',
                a.state === 'on' ? 'border-line bg-surface' : 'border-line bg-surface-2/50',
              )}
            >
              <div className="flex items-start gap-3">
                <IconTile size="md" tone={a.state === 'on' ? 'blue' : 'neutral'}>
                  {AUTO_ICON[a.id]}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{info.title}</span>
                    {automationState(a)}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {info.cadence}
                    {a.monthlyCredits > 0 && a.state === 'on' && <span className="text-ink-2"> · about {formatCredits(a.monthlyCredits)} a month</span>}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 text-[13px] leading-snug text-ink-2">{info.summary}</p>
              {a.detail && <p className="mt-1 text-xs leading-snug text-ink-3">{a.detail}</p>}
              <dl className="mt-3 grid gap-1.5 rounded-lg bg-surface-2/60 px-3 py-2.5 text-[13px]">
                <div className="flex items-start gap-2">
                  <dt className="flex w-12 shrink-0 items-center gap-1 text-ink-3">
                    <CalendarClock className="size-3.5" aria-hidden />
                    Next
                  </dt>
                  <dd className="min-w-0 text-ink">{validDate(a.nextRunAt) ? `${fmtWhen(a.nextRunAt, tz)} · ${inDays(a.nextRunAt)}` : (a.reason ?? '-')}</dd>
                </div>
                <div className="flex items-start gap-2">
                  <dt className="flex w-12 shrink-0 items-center gap-1 text-ink-3">
                    <History className="size-3.5" aria-hidden />
                    Last
                  </dt>
                  <dd className="min-w-0 break-words text-ink">
                    {a.lastRunAt ? fmtAgo(a.lastRunAt) : 'not yet'}
                    {a.lastResult ? ` · ${a.lastResult}` : ''}
                  </dd>
                </div>
              </dl>
              {(a.lastReportId || runNow) && (
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
                  {a.lastReportId && (
                    <ButtonLink to={paths.report(org.id, a.lastReportId)} variant="ghost" size="sm" icon={<FileText className="size-4" />}>
                      Last report
                    </ButtonLink>
                  )}
                  {runNow && info.runNowMode && (
                    <ButtonLink
                      to={info.runNowMode === 'track' ? paths.site(org.id, site.id, 'settings/tracking') : paths.tool(org.id, info.runNowMode, { siteId: site.id })}
                      variant="secondary"
                      size="sm"
                      icon={<Play className="size-4" />}
                    >
                      Run now
                    </ButtonLink>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
