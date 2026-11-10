// "Coming up" (SCHEDULING_KEYWORDS_PLAN.md §5.7): two days before each weekly run, the plan of what it writes. Each item says why it was
// chosen and its credits; automatic items can be skipped, the others wait for an OK. Decisions are for this week, or "never suggest
// again"; once the run started they are closed (409 `cycle_started`).
// I3 (2026-11-10, devaicon.com): a plan whose run is past is not "Coming up": the card says the run is running, or what the last run wrote
// and when the next plan and run come; approved items have their own group and, once the run is done, their real result; the pile-up
// banner of the plan shows only while the run is still to come and the live state agrees (the Pipeline's own queue.paused).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Ban, CalendarClock, Check, CheckCircle2, ChevronDown, Hand, Info, PenSquare, SkipForward, Undo2, Zap } from 'lucide-react';
import { WEEKDAY_NAMES, weekdayOfDate, type ComingUpItem, type ComingUpView, type PipelineData, type SiteCycleView } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/overlay';
import { ActionCard, IconTile } from '@/components/insight';
import { ApiRequestError, errorMessage, isConfirmCancelled } from '@/lib/api';
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

/** The live state of the pages that wait to be published (the Pipeline's queue): the same rule the weekly run applies. */
export type LiveQueue = Pick<PipelineData['queue'], 'paused' | 'waiting'>;

export type ComingUpPhase = NonNullable<ComingUpView['phase']>;
/** Where the plan's run stands (an older server sends no phase: a started plan is read as running). */
export const phaseOf = (v: ComingUpView): ComingUpPhase => v.phase ?? (v.closed ? 'running' : 'upcoming');

const quoteList = (xs: string[], max = 3) => `${xs.slice(0, max).map((k) => `"${k}"`).join(', ')}${xs.length > max ? ` and ${xs.length - max} more` : ''}`;
const pages = (n: number) => (n === 1 ? '1 page' : `${n} pages`);
const endStop = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

/** The card's title and first line for each phase (pure). `day` is the run's day ("Friday, November 6"); `fmt` formats an instant. */
export function comingUpHeading(v: ComingUpView, day: string, weekday: string, fmt: (iso: string) => string): { title: string; description: string } {
  const phase = phaseOf(v);
  if (phase === 'upcoming')
    return { title: day ? `Coming up on ${day}` : 'Coming up', description: `What your ${weekday || 'next'} run will write. Automatic pages are written unless you skip them; the others wait for your OK.` };
  if (phase === 'running')
    return { title: day ? `Running now: the weekly run of ${day}` : 'Running now', description: 'This weekly run has started, so its plan can no longer change. What it writes shows here when it is done.' };
  const o = v.outcome;
  let did = 'What it wrote is on Content and under Reports.';
  if (o?.known) {
    if (o.pages.length) {
      const all = o.pages.every((p) => p.state === 'written');
      did = `It ${all ? 'wrote' : 'started'} ${pages(o.pages.length)}: ${quoteList(o.pages.map((p) => p.keyword))}.`;
    } else if (o.pausedReason === 'pileup') did = `It wrote nothing new: ${o.waitingPublish ? `${pages(o.waitingPublish)} waited` : 'pages waited'} to be published.`;
    else if (o.pausedReason === 'site_paused') did = 'It wrote nothing: the website was paused.';
    else did = o.note ? `It wrote nothing: ${endStop(o.note.charAt(0).toLowerCase() + o.note.slice(1))}` : 'It wrote nothing new.';
  }
  const next =
    v.nextPreviewAt && v.nextDueAt
      ? `Your next plan arrives on ${fmt(v.nextPreviewAt)}, two days before the run on ${fmt(v.nextDueAt)}.`
      : v.nextDueAt
        ? `The next run is on ${fmt(v.nextDueAt)}. Its plan arrives two days before.`
        : 'The next plan arrives two days before the next run.';
  return { title: day ? `Last weekly run: ${day}` : 'Last weekly run', description: `${did} ${next}` };
}

/**
 * The pile-up banner (pure). None once the run started or finished (the outcome says what happened). For a run still to come it follows
 * the live state when the Pipeline gives it (the plan's own word may be days old), naming the pages that wait; else the plan's word.
 */
export function pileupBanner(v: ComingUpView, live?: LiveQueue | null): { tone: 'warning' | 'info'; title: string; body: string } | null {
  if (phaseOf(v) !== 'upcoming') return null;
  const planned = v.pausedReason === 'pileup';
  if (live === undefined)
    return planned ? { tone: 'warning', title: 'Writing is paused: pages wait to be published', body: 'Publish the pages you have, then the weekly pages continue.' } : null;
  if (live?.paused) {
    const names = (live.waiting ?? []).map((w) => `"${w.keyword}"${w.needsFix ? ' (needs a fix)' : ''}`);
    const n = live.paused.waiting || names.length;
    const fix = (live.waiting ?? []).some((w) => w.needsFix);
    return {
      tone: 'warning',
      title: `Writing is paused: ${pages(n)} ${n === 1 ? 'waits' : 'wait'} to be published`,
      body: `${names.length ? `${names.slice(0, 5).join(', ')}${names.length > 5 ? ` and ${names.length - 5} more` : ''}. ` : ''}Your limit is ${live.paused.max}. Publish ${fix ? 'them, or fix the ones that need a fix,' : 'some of them'} and the weekly pages continue.`,
    };
  }
  return planned ? { tone: 'info', title: 'No pages wait to be published any more', body: 'This run is not paused: it picks its pages when it starts.' } : null;
}

/** The toast after an approval (pure): never "written in this run" while writing is paused for pages that wait. */
export function approveToast(keyword: string, pileup: boolean): { title: string; description?: string } {
  return pileup
    ? { title: `"${keyword}" is approved: it is written once the pages that wait are published`, description: 'If they still wait when this run starts, approve it again in the next plan.' }
    : { title: `"${keyword}" will be written in this run` };
}

export function ComingUp({ cycle, onWrite, queue }: { cycle?: SiteCycleView; onWrite?: (it: ComingUpItem) => void; queue?: LiveQueue | null }) {
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
        <ComingUpPanel view={q.data} cycle={cycle} onWrite={onWrite} live={queue} />
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

function ComingUpPanel({ view, cycle, onWrite, live }: { view: ComingUpView; cycle?: SiteCycleView; onWrite?: (it: ComingUpItem) => void; live?: LiveQueue | null }) {
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
  const phase = phaseOf(view);
  const upcoming = phase === 'upcoming';
  const done = phase === 'done';
  const all = [...view.items, ...view.suggestions.filter((s) => !view.items.some((i) => i.itemKey === s.itemKey))];
  const isSkip = (i: ComingUpItem) => i.decision?.decision === 'skip';
  const isApproved = (i: ComingUpItem) => i.decision?.decision === 'approve';
  const auto = view.items.filter((i) => i.auto && !isSkip(i));
  const approved = all.filter((i) => !i.auto && isApproved(i));
  const waiting = all.filter((i) => !i.auto && !i.decision);
  const skipped = all.filter(isSkip);
  const weekday = view.cycleDate ? WEEKDAY_NAMES[weekdayOfDate(view.cycleDate)] : '';
  const head = comingUpHeading(view, day, weekday, (iso) => (validDate(iso) ? fmtDayHead(iso, tz) : ''));
  const banner = pileupBanner(view, live);
  // the approve toast follows the same word as the banner: the live state when the Pipeline gives it, else the plan's
  const pileupNow = live === undefined ? view.pausedReason === 'pileup' : !!live?.paused;
  const outcome = done && view.outcome?.known ? view.outcome : null;
  const nothing = outcome ? !outcome.pages.length && !approved.length && !skipped.length : !auto.length && !approved.length && !waiting.length && !skipped.length;
  return (
    <Panel
      icon={<CalendarClock />}
      title={head.title}
      description={head.description}
      actions={
        <>
          {upcoming && view.autoCredits > 0 && (
            <span className="text-[13px] text-ink-3">
              about <span className="font-medium text-ink">{formatCredits(view.autoCredits)}</span> on its own
            </span>
          )}
          <ComingUpGuide cycle={cycle} />
        </>
      }
    >
      <div className="space-y-4">
        {!done && view.waitingForKeyword && (
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
        {!done && view.waitingForProfile && (
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
        {banner && (
          <Callout tone={banner.tone} title={banner.title}>
            {banner.body}
          </Callout>
        )}
        {upcoming && view.pausedReason === 'site_paused' && <Callout tone="warning" title="Tracking is paused for this website: nothing runs until you resume it" />}
        {upcoming && view.reason && !view.waitingForKeyword && !view.pausedReason && !view.waitingForProfile && <p className="text-[13px] text-ink-3">{view.reason}</p>}

        {nothing ? (
          <p className="text-sm text-ink-3">{done ? 'Nothing was written in this run. Your checks and reports ran as usual.' : 'Nothing to write in this run. Your checks and reports run as usual.'}</p>
        ) : (
          <>
            {outcome && outcome.pages.length > 0 && (
              <Group icon={<CheckCircle2 />} title="Written in this run">
                {outcome.pages.map((p) => (
                  <WrittenRow key={p.keyword} page={p} tz={tz} />
                ))}
              </Group>
            )}
            {!outcome && auto.length > 0 && (
              <Group icon={<Zap />} title={done ? 'Planned to be written on its own' : 'Written on its own'}>
                {auto.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} pileup={pileupNow} />
                ))}
              </Group>
            )}
            {approved.length > 0 && (
              <Group icon={<CheckCircle2 />} title="Approved by you">
                {approved.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} onWrite={onWrite} pileup={upcoming && pileupNow} phase={phase} />
                ))}
              </Group>
            )}
            {!done && waiting.length > 0 && (
              <Group icon={<Hand />} title={upcoming ? 'Waits for your OK' : 'Not approved before the run, so not written'}>
                {waiting.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} onWrite={onWrite} pileup={pileupNow} />
                ))}
              </Group>
            )}
            {skipped.length > 0 && (
              <Group icon={<SkipForward />} title="Skipped">
                {skipped.map((i) => (
                  <ComingUpRow key={i.itemKey} item={i} closed={view.closed} onWrite={onWrite} pileup={pileupNow} />
                ))}
              </Group>
            )}
          </>
        )}
        {(view.approvedNotWritten ?? []).length > 0 && <NotWritten list={view.approvedNotWritten} past={done} />}
        {!done && view.refused.length > 0 && <Refused list={view.refused} />}
      </div>
    </Panel>
  );
}

/** A page the finished run started: written (with its page), still being written, or not finished. */
function WrittenRow({ page, tz }: { page: NonNullable<ComingUpView['outcome']>['pages'][number]; tz: string }) {
  const { org } = useOrgCtx();
  const when = validDate(page.at) ? fmtDayHead(page.at, tz) : '';
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile size="sm" tone="solid" className="mt-0.5">
          {SOURCE_ICON[page.source] ?? <PenSquare />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{page.keyword}</span>
            <Badge tone={SOURCE_TONE[page.source]}>{SOURCE_LABEL[page.source] ?? page.source}</Badge>
            {page.approved && <StatusBadge tone="good">Approved by you</StatusBadge>}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">{resultLine({ state: page.state, at: page.at, reportId: page.reportId, message: '' }, when)}</p>
        </div>
      </div>
      {page.reportId && (
        <Link to={paths.report(org.id, page.reportId)} className="text-[13px] font-medium text-accent-text hover:underline">
          Open the page
        </Link>
      )}
      {page.state === 'written' && <CheckCircle2 className="size-4 text-good-text" aria-hidden />}
    </li>
  );
}

/** What became of a page, in one line (pure). */
export function resultLine(r: NonNullable<ComingUpItem['result']>, when: string): string {
  switch (r.state) {
    case 'written':
      return when ? `Written on ${when}.` : 'Written in that run.';
    case 'started':
      return when ? `Started on ${when}: the page arrives under Reports when it is ready.` : 'Started in that run: the page arrives under Reports when it is ready.';
    case 'failed':
      return r.message || 'Started in that run, but the page could not be finished.';
    default:
      return r.message || 'Not written in that run.';
  }
}

/** Approvals the run does not write, each with why (an approval that two different pages share asks for a new one). */
export function NotWritten({ list, past = false }: { list: ComingUpView['approvedNotWritten']; past?: boolean }) {
  const title = past
    ? list.length === 1 ? 'One approval was not used in that run' : `${list.length} approvals were not used in that run`
    : list.length === 1 ? 'One approval is not used in this run' : `${list.length} approvals are not used in this run`;
  return (
    <Callout tone={list.some((x) => x.reason === 'ambiguous') ? 'warning' : 'info'} title={title}>
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

function ComingUpRow({ item, closed, onWrite, pileup = false, phase }: { item: ComingUpItem; closed: boolean; onWrite?: (it: ComingUpItem) => void; pileup?: boolean; phase?: ComingUpPhase }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const tz = siteTimezone(site);
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
        onSuccess: () => {
          if (decision === 'approve') {
            const t = approveToast(item.keyword, pileup);
            return void toast.success(t.title, t.description ? { description: t.description } : undefined);
          }
          toast.success(scope === 'always' ? `We will not suggest "${item.keyword}" again` : `"${item.keyword}" is skipped this week`);
        },
        onError: (e) => {
          // only `cycle_started` means the run began; a cancelled "Check this first" (409 confirm_needed) changed nothing and says so
          if (isConfirmCancelled(e)) return void toast.info('Nothing was changed', { description: 'This keyword keeps its place in the plan.' });
          const started = e instanceof ApiRequestError && e.code === 'cycle_started';
          toast.error(started ? 'This weekly run has already started' : 'The change was not saved', {
            description: started ? 'Its plan can no longer change. Decide on the next plan when it arrives, two days before the next run.' : errorMessage(e),
          });
        },
        onSettled: () => setPending(null),
      },
    );
  };
  const canAct = can('member') && !closed;
  const r = item.result ?? null;
  const when = r && validDate(r.at) ? fmtDayHead(r.at, tz) : '';
  const written = r?.state === 'written';
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
            {r && (written ? <StatusBadge tone="good">Written</StatusBadge> : r.state === 'started' ? <Badge>Being written</Badge> : <Badge tone="warning">Not written</Badge>)}
            {item.recheck && <Badge tone="warning">Checking again</Badge>}
            {item.held && <Badge tone="warning">Waits for your profile</Badge>}
          </div>
          {r ? (
            <p className={cn('mt-1 text-[13px] leading-snug', written || r.state === 'started' ? 'text-ink-2' : 'text-warning-text')}>
              {resultLine(r, when)}
              {r.reportId && (
                <>
                  {' '}
                  <Link to={paths.report(org.id, r.reportId)} className="font-medium text-accent-text hover:underline">
                    Open the page
                  </Link>
                </>
              )}
            </p>
          ) : approved && phase === 'done' ? (
            <p className="mt-1 text-[13px] leading-snug text-ink-3">What became of it is on Content and under Reports.</p>
          ) : approved && pileup && !closed ? (
            <p className="mt-1 text-[13px] leading-snug text-ink-2">Written once the pages that wait are published. If they still wait when this run starts, approve it again in the next plan.</p>
          ) : item.recheck ? (
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
          {!item.auto && !item.canApprove && !item.recheck && onWrite && !skipped && !approved && (
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
      {/* the tick only for a page that was really written (an approval alone is not a result) */}
      {written && <CheckCircle2 className="size-4 text-good-text" aria-hidden />}
      {/* I3: an approval the run did not write can still be written by hand */}
      {r && r.state !== 'written' && r.state !== 'started' && onWrite && can('member') && (
        <Button size="sm" variant="secondary" icon={<PenSquare className="size-4" />} onClick={() => onWrite(item)}>
          Write it now
        </Button>
      )}
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
