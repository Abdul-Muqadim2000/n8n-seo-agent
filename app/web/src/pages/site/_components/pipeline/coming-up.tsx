// "Coming up" (SCHEDULING_KEYWORDS_PLAN.md §5.7): two days before each weekly run, the plan of what it writes. Each item says why it was
// chosen and its credits; automatic items can be skipped, the others wait for an OK. Decisions are for this week, or "never suggest
// again"; once the run started they are closed (409 `cycle_started`).
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Ban, CalendarClock, Check, CheckCircle2, ChevronDown, Hand, Info, PenSquare, SkipForward, Undo2, Zap } from 'lucide-react';
import { WEEKDAY_NAMES, weekdayOfDate, type ComingUpItem, type ComingUpView, type SiteCycleView } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/overlay';
import { ActionCard, IconTile } from '@/components/insight';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { siteTimezone } from '@/lib/cycle-day';
import { formatCredits } from '@/lib/credits';
import { paths } from '@/lib/paths';
import { useComingUp, useComingUpDecision } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Panel } from '../kit';
import { asPageType, fmtDayHead, validDate } from './common';
import { SOURCE_ICON, SOURCE_LABEL, SOURCE_TONE } from './always-on';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';
import { autopilotGuideVars } from '@/lib/guide-vars';

/** "How Coming up works", beside the plan (the guide's values: the website's weekday and the credits of a page). */
function ComingUpGuide({ cycle }: { cycle?: SiteCycleView }) {
  const { site } = useSiteCtx();
  return <GuideButton id={AUTOPILOT_SCREEN_GUIDES.comingUp} vars={autopilotGuideVars(site, { cycle })} label="How Coming up works" />;
}

/** "Wednesday 22 October" for a local date (YYYY-MM-DD) of the website's cycle. */
export function cycleDayWords(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

const decisionBadge = (it: ComingUpItem): ReactNode => {
  const d = it.decision;
  if (!d) return null;
  if (d.decision === 'approve')
    return (
      <StatusBadge tone="good">
        Approved{d.by ? ` by ${d.by}` : ''}
      </StatusBadge>
    );
  return d.scope === 'always' ? (
    <Badge icon={<Ban className="size-3" aria-hidden />}>Never suggested again</Badge>
  ) : (
    <Badge icon={<SkipForward className="size-3" aria-hidden />}>Skipped this week</Badge>
  );
};

export function ComingUp({ cycle, onWrite }: { cycle?: SiteCycleView; onWrite?: (it: ComingUpItem) => void }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const q = useComingUp(org.id, site.id, !!site.verifiedAt);
  if (!site.verifiedAt) return null;
  return (
    <section id="coming-up" aria-label="Coming up" className="min-w-0 scroll-mt-20">
      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : q.isError ? (
        <Panel icon={<CalendarClock />} title="Coming up">
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the plan of your next weekly run" />
        </Panel>
      ) : (
        <ComingUpPanel view={q.data} cycle={cycle} onWrite={onWrite} />
      )}
    </section>
  );
}

/**
 * The Overview's one line on the next weekly run's plan: what is written on its own and what waits for an OK, linked to the Pipeline.
 * Nothing shows before the first plan arrives, or for a website that is not verified.
 */
export function ComingUpSummary() {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const q = useComingUp(org.id, site.id, !!site.verifiedAt);
  const v = q.data;
  if (!site.verifiedAt || !v?.available || v.closed) return null;
  const auto = v.items.filter((i) => i.auto && i.decision?.decision !== 'skip').length;
  const waiting = [...v.items.filter((i) => !i.auto), ...v.suggestions.filter((s) => !v.items.some((i) => i.itemKey === s.itemKey))].filter((i) => !i.decision).length;
  const day = v.cycleDate ? cycleDayWords(v.cycleDate) : '';
  const parts = [auto ? `${auto === 1 ? '1 page is' : `${auto} pages are`} written on its own` : 'nothing is written on its own', waiting ? `${waiting} ${waiting === 1 ? 'waits' : 'wait'} for your OK` : ''];
  return (
    <ActionCard
      icon={<CalendarClock />}
      title={day ? `Coming up on ${day}` : 'Coming up in your next weekly run'}
      description={`${parts.filter(Boolean).join(', ')}.${v.waitingForKeyword ? ' Choose your keyword to have pages written each week.' : ''}`}
      meta={waiting ? <Badge tone="accent">Needs your OK</Badge> : undefined}
      to={`${paths.site(org.id, site.id, 'pipeline')}#coming-up`}
    />
  );
}

function ComingUpPanel({ view, cycle, onWrite }: { view: ComingUpView; cycle?: SiteCycleView; onWrite?: (it: ComingUpItem) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const tz = siteTimezone(site);
  const day = view.cycleDate ? cycleDayWords(view.cycleDate) : '';
  if (!view.available) {
    const next = cycle?.nextPreviewAt && validDate(cycle.nextPreviewAt) ? fmtDayHead(cycle.nextPreviewAt, tz) : null;
    return (
      <Panel icon={<CalendarClock />} title="Coming up" description="Before each weekly run you see what it will write, with the credits, and can skip or approve each page." actions={<ComingUpGuide cycle={cycle} />}>
        <div className="flex items-start gap-3 rounded-lg bg-surface-2/60 px-4 py-3">
          <IconTile size="sm" tone="neutral">
            <Info />
          </IconTile>
          <p className="pt-0.5 text-sm leading-relaxed text-ink-3">
            {next ? `Your first plan arrives on ${next}, two days before your next weekly run.` : 'Your first plan arrives two days before your next weekly run, once tracking runs.'}{' '}
            Nothing is written that you could not see here first.
          </p>
        </div>
      </Panel>
    );
  }
  const auto = view.items.filter((i) => i.auto);
  const waiting = [...view.items.filter((i) => !i.auto), ...view.suggestions.filter((s) => !view.items.some((i) => i.itemKey === s.itemKey))];
  const weekday = view.cycleDate ? WEEKDAY_NAMES[weekdayOfDate(view.cycleDate)] : '';
  return (
    <Panel
      icon={<CalendarClock />}
      title={day ? `Coming up on ${day}` : 'Coming up'}
      description={
        view.closed
          ? 'This weekly run has started, so its plan can no longer change. The next plan arrives two days before the next run.'
          : `What your ${weekday || 'next'} run will write. Automatic pages are written unless you skip them; the others wait for your OK.`
      }
      actions={
        <>
          {view.autoCredits > 0 && (
            <span className="text-[13px] text-ink-3">
              about <span className="font-medium text-ink">{formatCredits(view.autoCredits)}</span> on its own
            </span>
          )}
          <ComingUpGuide cycle={cycle} />
        </>
      }
    >
      <div className="space-y-4">
        {view.waitingForKeyword && (
          <Callout
            tone="info"
            title="Nothing is written until you choose your keyword"
            action={
              can('member') ? (
                <ButtonLink to={paths.site(org.id, site.id, 'pipeline/new')} size="sm">
                  Choose a keyword
                </ButtonLink>
              ) : undefined
            }
          >
            The checks still run. You can approve a suggestion below to have it written this week.
          </Callout>
        )}
        {/* P1 (2026-10-20): no page is written before the author profile and the business facts are on file */}
        {view.waitingForProfile && (
          <Callout
            tone="warning"
            title="Your pages wait for your author profile and business facts"
            action={
              can('admin') ? (
                <ButtonLink to={paths.site(org.id, site.id, /author/.test(view.missingText) ? 'settings/profile' : 'settings/business')} size="sm">
                  Add them
                </ButtonLink>
              ) : undefined
            }
          >
            {view.missingText ? `Add ${view.missingText} in Website settings. ` : ''}Until then nothing is written or charged, approved pages included. The pages below are written in the first run after that.
            <span className="mt-2 flex flex-wrap gap-2">
              <GuideButton id={/author/.test(view.missingText) ? 'business-profile' : 'business-facts'} />
            </span>
          </Callout>
        )}
        {view.pausedReason === 'pileup' && (
          <Callout tone="warning" title="Writing is paused: pages wait to be published">
            Publish the pages you have, then the weekly pages continue.
          </Callout>
        )}
        {view.pausedReason === 'site_paused' && <Callout tone="warning" title="Tracking is paused for this website: nothing runs until you resume it" />}
        {view.reason && !view.waitingForKeyword && !view.pausedReason && !view.waitingForProfile && <p className="text-[13px] text-ink-3">{view.reason}</p>}

        {!auto.length && !waiting.length ? (
          <p className="text-sm text-ink-3">Nothing to write in this run. Your checks and reports run as usual.</p>
        ) : (
          <>
            {auto.length > 0 && (
              <Group icon={<Zap />} title="Written on its own">
                {auto.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} />
                ))}
              </Group>
            )}
            {waiting.length > 0 && (
              <Group icon={<Hand />} title="Waits for your OK">
                {waiting.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} onWrite={onWrite} />
                ))}
              </Group>
            )}
          </>
        )}
        {(view.approvedNotWritten ?? []).length > 0 && <NotWritten list={view.approvedNotWritten} />}
        {view.refused.length > 0 && <Refused list={view.refused} />}
      </div>
    </Panel>
  );
}

/** Approvals the run does not write, each with why (an approval that two different pages share asks for a new one). */
export function NotWritten({ list }: { list: ComingUpView['approvedNotWritten'] }) {
  return (
    <Callout tone={list.some((x) => x.reason === 'ambiguous') ? 'warning' : 'info'} title={list.length === 1 ? 'One approval is not used in this run' : `${list.length} approvals are not used in this run`}>
      <ul className="mt-1 space-y-1">
        {list.map((x) => (
          <li key={`${x.keyword}:${x.reason}`} className="text-[13px] leading-snug">
            {x.message}
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/** The line a page of a ladder planned long ago carries: its keyword is checked again before anything is written. */
export const RECHECK_LINE = 'Checking this keyword again before writing: the plan is more than 60 days old, so we make sure it is still a good choice first.';

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <span className="text-accent-text [&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
        {title}
      </h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function ComingUpRow({ item, closed, onWrite }: { item: ComingUpItem; closed: boolean; onWrite?: (it: ComingUpItem) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const decide = useComingUpDecision(org.id, site.id);
  const [pending, setPending] = useState<string | null>(null);
  const d = item.decision;
  const skipped = d?.decision === 'skip';
  const approved = d?.decision === 'approve';
  const send = (decision: 'skip' | 'approve', scope: 'cycle' | 'always') => {
    setPending(`${decision}:${scope}`);
    decide.mutate(
      { itemKey: item.itemKey, decision, scope },
      {
        onSuccess: () =>
          toast.success(
            decision === 'approve' ? `"${item.keyword}" will be written in this run` : scope === 'always' ? `We will not suggest "${item.keyword}" again` : `"${item.keyword}" is skipped this week`,
          ),
        onError: (e) =>
          toast.error(
            e instanceof ApiRequestError && e.status === 409 ? 'This weekly run has already started' : 'The change was not saved',
            { description: e instanceof ApiRequestError && e.status === 409 ? 'Its plan can no longer change. Decide on the next plan when it arrives, two days before the next run.' : errorMessage(e) },
          ),
        onSettled: () => setPending(null),
      },
    );
  };
  const canAct = can('member') && !closed;
  return (
    <li className={cn('flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ease-brand', skipped ? 'border-line bg-surface-2/50' : 'border-line bg-surface')}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile size="sm" tone={skipped ? 'neutral' : item.auto || approved ? 'solid' : 'blue'} className="mt-0.5">
          {SOURCE_ICON[item.source] ?? <PenSquare />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-sm font-semibold', skipped ? 'text-ink-3 line-through decoration-1' : 'text-ink')}>{item.keyword}</span>
            <Badge tone={SOURCE_TONE[item.source]}>{SOURCE_LABEL[item.source] ?? item.source}</Badge>
            {decisionBadge(item)}
            {item.recheck && <Badge tone="warning">Checking again</Badge>}
            {item.held && <Badge tone="warning">Waits for your profile</Badge>}
          </div>
          {item.recheck ? (
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{RECHECK_LINE}</p>
          ) : (
            item.why && <p className="mt-1 text-[13px] leading-snug text-ink-2">{item.why}</p>
          )}
          <p className="mt-0.5 text-xs text-ink-3">
            {asPageType(item.pageType)}
            {item.existingPageUrl ? ` · improves ${item.existingPageUrl.replace(/^https?:\/\/(www\.)?/, '')}` : ''}
            {item.credits > 0 ? ` · about ${formatCredits(item.credits)}` : ''}
          </p>
        </div>
      </div>
      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          {item.canApprove && !approved && (
            <Button size="sm" icon={<Check className="size-4" />} loading={pending === 'approve:cycle'} onClick={() => send('approve', 'cycle')}>
              Approve
            </Button>
          )}
          {!item.auto && !item.canApprove && !item.recheck && onWrite && !skipped && (
            <Button size="sm" variant="secondary" icon={<PenSquare className="size-4" />} onClick={() => onWrite(item)}>
              Write it now
            </Button>
          )}
          {item.canSkip &&
            (skipped ? (
              <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" />} loading={pending === 'approve:cycle'} disabled={!item.canApprove} onClick={() => send('approve', 'cycle')} title={item.canApprove ? undefined : 'Automatic pages come back with the next plan'}>
                {item.canApprove ? 'Approve instead' : 'Skipped'}
              </Button>
            ) : (
              <Menu
                trigger={
                  <Button size="sm" variant="secondary" icon={<SkipForward className="size-4" />} loading={!!pending && pending.startsWith('skip')}>
                    Skip
                    <ChevronDown className="size-3.5" aria-hidden />
                  </Button>
                }
              >
                <MenuLabel>Skip "{item.keyword}"</MenuLabel>
                <MenuItem icon={<SkipForward className="size-4" />} onSelect={() => send('skip', 'cycle')}>
                  This week only
                </MenuItem>
                <MenuItem icon={<Ban className="size-4" />} onSelect={() => send('skip', 'always')}>
                  Never suggest it again
                </MenuItem>
              </Menu>
            ))}
        </div>
      )}
      {approved && !canAct && <CheckCircle2 className="size-4 text-good-text" aria-hidden />}
    </li>
  );
}

function Refused({ list }: { list: ComingUpView['refused'] }) {
  return (
    <details className="group rounded-lg border border-line bg-surface-2/40 px-4 py-2.5 text-[13px]">
      <summary className="cursor-pointer list-none font-medium text-ink-2 marker:hidden">
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className="size-3.5 transition-transform duration-200 ease-brand group-open:rotate-180" aria-hidden />
          {list.length === 1 ? '1 topic we left out' : `${list.length} topics we left out`} because they do not fit your business
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5 text-ink-3">
        {list.map((r) => (
          <li key={r.keyword + r.reason}>
            <span className="font-medium text-ink-2">{r.keyword}</span>: {r.detail || r.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}
