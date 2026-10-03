// Pipeline home: the always-on part (opportunity posts and monitoring) and the weekly capacity the ladders share.
import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, ChevronRight, Circle, FileText, Lightbulb, PenSquare, Play, Settings } from 'lucide-react';
import { AUTOMATIONS, formatUsd, MODES, type AutomationStatus, type LadderCard, type PipelineData, type QueueItem } from '@seo/shared';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtAgo } from '@/lib/utils';
import { SectionHeading } from '../kit';
import { asPageType, AUTO_ICON, fmtWhen, inDays, ModeChip, validDate } from './common';
import type { WriteNowItem } from './WriteNowDialog';

const SOURCE_LABEL: Record<QueueItem['source'], string> = { ladder: 'Keyword ladder', striking: 'Close to page one', trend: 'Rising search' };
const SOURCE_TONE: Record<QueueItem['source'], Tone> = { ladder: 'accent', striking: 'neutral', trend: 'neutral' };

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
      <SectionHeading id="always-on-heading" title="Always on" description="Runs next to your ladders: posts for new chances in Search Console and Google Trends, and the weekly checks of your site." />
      <Capacity data={data} cards={cards} />
      <OpportunityPosts data={data} onWrite={onWrite} />
      <Monitoring data={data} />
    </section>
  );
}

function Capacity({ data, cards }: { data: PipelineData; cards: LadderCard[] }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const perWeek = data.queue?.pagesPerWeek ?? 0;
  const ladders = writingLadders(cards);
  const opportunities = (data.automation?.opportunities ?? 'auto') === 'auto';
  const maxActive = data.automation?.maxActiveLadders ?? 2;
  const cadence = data.automations.find((a) => a.id === 'content_cadence');
  const users = [...ladders.map((l) => `“${l.head}”`), ...(opportunities ? ['opportunity posts'] : [])];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5 text-[13px]">
        <PenSquare className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0">
          {perWeek > 0 ? (
            <p className="text-ink">
              <span className="font-semibold">{perWeek === 1 ? '1 post a week' : `${perWeek} posts a week`}</span>
              {users.length > 0 && (
                <>
                  <span className="text-ink-3"> · used by: </span>
                  {users.map((u, i) => (
                    <span key={u}>
                      {i > 0 && <ChevronRight className="mx-0.5 inline size-3.5 text-ink-3" aria-label="then" />}
                      {u}
                    </span>
                  ))}
                </>
              )}
            </p>
          ) : (
            <p className="text-ink">
              <span className="font-semibold">Weekly posts are off.</span> <span className="text-ink-2">Nothing is written on its own; use Write now on a ladder page or an opportunity.</span>
            </p>
          )}
          <p className="mt-0.5 text-xs text-ink-3">
            Shared by the ladders in their order, at most {maxActive === 1 ? '1 ladder' : `${maxActive} ladders`} at a time: the first gets the posts until it has nothing to write, then the next one.
            {perWeek > 0 && cadence && validDate(cadence.nextRunAt) ? ` Next writing: ${fmtWhen(cadence.nextRunAt)}.` : ''}
          </p>
          {perWeek > 0 && data.queue?.paused && (
            <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-warning-text">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              Next Monday writes nothing: {data.queue.paused.waiting} pages wait to be published (your limit is {data.queue.paused.max}).
            </p>
          )}
        </div>
      </div>
      {can('admin') && (
        <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="secondary" size="sm" className="self-start sm:self-center">
          {perWeek > 0 ? 'Change' : 'Turn on weekly posts'}
        </ButtonLink>
      )}
    </div>
  );
}

function QueueRow({ item, onWrite, highlight }: { item: QueueItem; onWrite?: (i: QueueItem) => void; highlight?: boolean }) {
  const { can } = useOrgCtx();
  return (
    <li className={cn('flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3', highlight ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{item.keyword}</span>
          <Badge tone={SOURCE_TONE[item.source]}>{SOURCE_LABEL[item.source] ?? item.source}</Badge>
          <span className="text-xs text-ink-3">{asPageType(item.pageType)}</span>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-ink-3">{item.why}</p>
        {item.existingPageUrl && <p className="mt-0.5 truncate text-xs text-ink-3">Improves {item.existingPageUrl.replace(/^https?:\/\/(www\.)?/, '')}</p>}
      </div>
      {onWrite && can('member') && (
        <Button size="sm" variant={highlight ? 'primary' : 'secondary'} icon={<PenSquare className="size-4" />} onClick={() => onWrite(item)}>
          Write now
        </Button>
      )}
    </li>
  );
}

function OpportunityPosts({ data, onWrite }: { data: PipelineData; onWrite: (i: WriteNowItem) => void }) {
  const mode = data.automation?.opportunities ?? 'auto';
  const manual = mode === 'manual';
  // Manual: the posts Auto would write are suggestions; nothing is written on its own
  const next = manual ? [] : (data.queue?.next ?? []).filter((i) => i.source !== 'ladder');
  const later = manual ? (data.queue?.suggestions ?? []) : (data.queue?.later ?? []).filter((i) => i.source !== 'ladder');
  const perWeek = data.queue?.pagesPerWeek ?? 0;
  return (
    <Card>
      <CardHeader
        icon={<Lightbulb className="size-4" />}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Opportunity posts
            <ModeChip mode={mode} />
          </span>
        }
        description={
          mode === 'auto'
            ? 'Searches you already appear for close to page one, and rising searches. They fill the weekly posts the ladders leave free.'
            : 'Searches close to page one and rising searches, shown as suggestions: nothing is written until you click Write now.'
        }
      />
      <CardBody className="space-y-4">
        {!next.length && !later.length ? (
          <p className="text-sm text-ink-3">No opportunities right now. They come from the weekly site report: searches where you show up on page two, and searches that are rising on Google.</p>
        ) : (
          <>
            {!perWeek && !manual && (
              <Callout tone="info" title="Weekly posts are off">
                These would be written next. Turn weekly posts on, or write one now (about {formatUsd(MODES.keyword.costUsd)} each).
              </Callout>
            )}
            {next.length > 0 && (
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-ink">Next Monday</h4>
                <ul className="space-y-2">
                  {next.map((i) => (
                    <QueueRow key={i.keyword} item={i} onWrite={onWrite} highlight />
                  ))}
                </ul>
              </div>
            )}
            {later.length > 0 && (
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-ink">
                  {manual ? 'Suggested posts: write the ones you want' : next.length ? 'Then, when a weekly post is free' : 'In line, when a weekly post is free'}
                </h4>
                <ul className="space-y-2">
                  {later.map((i) => (
                    <QueueRow key={i.keyword} item={i} onWrite={onWrite} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Monitoring({ data }: { data: PipelineData }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const list = data.automations.filter((a) => a.id !== 'content_cadence');
  return (
    <Card>
      <CardHeader
        icon={<CalendarClock className="size-4" />}
        title="Monitoring"
        description={`Checks that run on their own. Times are in your time zone (the engine runs on ${data.timezone}).`}
        actions={
          can('admin') && (
            <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="secondary" size="sm" icon={<Settings className="size-4" />}>
              Settings
            </ButtonLink>
          )
        }
      />
      <ul className="divide-y divide-line px-5 pb-2 pt-2">
        {list.map((a) => {
          const info = AUTOMATIONS.find((x) => x.id === a.id);
          if (!info) return null;
          const runNow = info.runNowMode && a.state !== 'needs_setup' && can('member');
          return (
            <li key={a.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-3">{AUTO_ICON[a.id]}</span>
                  <span className="text-sm font-semibold text-ink">{info.title}</span>
                  {automationState(a)}
                  {a.monthlyCostUsd > 0 && a.state === 'on' && <span className="text-xs text-ink-3">≈ {formatUsd(a.monthlyCostUsd)}/month</span>}
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ink-2">{info.summary}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {info.cadence}
                  {a.detail ? ` · ${a.detail}` : ''}
                </p>
                <dl className="mt-2 grid gap-1 text-[13px]">
                  <div className="flex gap-1.5">
                    <dt className="w-9 shrink-0 text-ink-3">Next</dt>
                    <dd className="min-w-0 text-ink">{validDate(a.nextRunAt) ? `${fmtWhen(a.nextRunAt)} · ${inDays(a.nextRunAt)}` : (a.reason ?? '–')}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="w-9 shrink-0 text-ink-3">Last</dt>
                    <dd className="min-w-0 break-words text-ink">
                      {a.lastRunAt ? fmtAgo(a.lastRunAt) : 'not yet'}
                      {a.lastResult ? ` · ${a.lastResult}` : ''}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap items-start gap-2 md:justify-end">
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
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
