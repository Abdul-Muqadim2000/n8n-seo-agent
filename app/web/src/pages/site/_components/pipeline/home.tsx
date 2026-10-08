// Pipeline home, top half: the summary hero (this week, what needs the person, the month's numbers), this week's runs, what needs
// the person, and how a ladder works.
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  Hand,
  Inbox,
  Info,
  Layers,
  ListOrdered,
  Loader2,
  PenSquare,
  PlugZap,
  TrendingUp,
  Trophy,
  Workflow,
  XCircle,
} from 'lucide-react';
import { AUTOMATIONS, compactNumber, formatUsd, MODES, type LadderCard, type NeedsYouItem, type PipelineData, type PipelineStage, type ThisWeekItem } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CollapsePanel, CountUp, DisclosureButton, HeroNextStep, HeroStat, IconTile, InsightItem, SummaryHero, useSurface } from '@/components/insight';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtAgo } from '@/lib/utils';
import { Panel } from '../kit';
import { plural } from '../format';
import { AUTO_ICON, fmtDayHead, fmtTime, fmtWhen, validDate } from './common';
import type { WriteNowItem } from './WriteNowDialog';

// ---------- this week ----------
/** Older servers: the coming week from the automations' next run times. */
function thisWeekOf(data: PipelineData): ThisWeekItem[] {
  if (data.thisWeek) return data.thisWeek;
  const week = Date.now() + 7 * 864e5;
  return data.automations
    .filter((a) => a.state === 'on' && validDate(a.nextRunAt) && Date.parse(a.nextRunAt) <= week)
    .map((a) => ({
      at: a.nextRunAt!,
      automation: a.id,
      title: AUTOMATIONS.find((x) => x.id === a.id)?.title ?? a.id,
      detail: a.detail ?? '',
      running: (data.running ?? []).some((r) => r.automation === a.id),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

const sortedWeek = (data: PipelineData) => [...thisWeekOf(data)].filter((i) => validDate(i.at)).sort((a, b) => a.at.localeCompare(b.at));

const RunningBadge = () => (
  <Badge tone="accent" icon={<Loader2 className="size-3 animate-spin" aria-hidden />}>
    Running now
  </Badge>
);

/** A day as a small calendar tile: the weekday on top, the day of the month under it. */
export function DayTile({ iso, className }: { iso: string; className?: string }) {
  const d = new Date(iso);
  const wd = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
  return (
    <span className={cn('flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-soft text-accent-text', className)} aria-hidden>
      <span className="font-mono text-[10px] leading-none font-medium tracking-[0.04em] uppercase">{wd}</span>
      <span className="mt-0.5 font-display text-base leading-none font-semibold">{d.getDate()}</span>
    </span>
  );
}

export function ThisWeek({ data }: { data: PipelineData }) {
  const { org } = useOrgCtx();
  const items = useMemo(() => sortedWeek(data), [data]);
  const days = useMemo(() => {
    const m = new Map<string, ThisWeekItem[]>();
    for (const e of items) {
      const key = new Date(e.at).toDateString();
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return [...m.values()];
  }, [items]);
  const active = data.activeRuns ?? [];
  // automatic runs in progress that are not in the list (e.g. last week's run still going)
  const runningOther = (data.running ?? []).filter((r) => !items.some((i) => i.automation === r.automation && i.running));

  return (
    <Panel icon={<CalendarClock />} title="This week" description="The next automatic runs in order, in your time zone, and what each one works on.">
      <div className="space-y-4">
        {(active.length > 0 || runningOther.length > 0) && (
          <ul className="space-y-2">
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-accent-soft px-3 py-2 text-[13px]">
                <RunningBadge />
                <Link to={paths.run(org.id, r.id)} className="min-w-0 font-medium text-ink hover:text-accent-text hover:underline transition-colors duration-150 ease-brand">
                  {MODES[r.mode]?.title ?? r.mode}
                  {r.keyword ? `: “${r.keyword}”` : ''}
                </Link>
                <span className="text-xs text-ink-3">started {fmtAgo(r.createdAt)}</span>
              </li>
            ))}
            {runningOther.map((r) => (
              <li key={r.automation + r.startedAt} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-accent-soft px-3 py-2 text-[13px]">
                <RunningBadge />
                <span className="font-medium text-ink">{AUTOMATIONS.find((a) => a.id === r.automation)?.title ?? r.automation}</span>
                <span className="text-xs text-ink-3">started {fmtAgo(r.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {!days.length ? (
          <p className="text-sm text-ink-3">Nothing is scheduled this week. Start tracking or switch the automations on in the settings.</p>
        ) : (
          <ol className="space-y-5">
            {days.map((events) => (
              <li key={events[0].at}>
                <div className="flex items-center gap-3">
                  <DayTile iso={events[0].at} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{fmtDayHead(events[0].at)}</p>
                    <p className="text-xs text-ink-3">{plural(events.length, 'automatic run')}</p>
                  </div>
                </div>
                {/* one row per run on a line that joins the job icons */}
                <ul className="relative mt-3 space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[calc(4.5rem+0.5rem+0.875rem)] before:w-px before:bg-line" aria-label={fmtDayHead(events[0].at)}>
                  {events.map((e) => (
                    <li key={e.at + e.automation} className="relative grid grid-cols-[4.5rem_1.75rem_minmax(0,1fr)] items-start gap-x-2 py-1.5 text-[13px]">
                      <span className="whitespace-nowrap pt-1 pl-1 tabular text-ink-3">{fmtTime(e.at)}</span>
                      <IconTile size="sm" tone={e.running ? 'solid' : 'blue'} className="relative z-[1] ring-2 ring-surface">
                        {AUTO_ICON[e.automation]}
                      </IconTile>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{e.title}</span>
                          {e.running && <RunningBadge />}
                        </div>
                        {e.detail && <p className="mt-0.5 break-words leading-snug text-ink-3">{e.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}

// ---------- needs you ----------
const KIND_ICON: Record<NeedsYouItem['kind'], ReactNode> = {
  publish: <Inbox className="size-4" />,
  approve: <Hand className="size-4" />,
  overlap: <Copy className="size-4" />,
  duplicate: <Copy className="size-4" />,
  failed: <XCircle className="size-4" />,
  connection: <PlugZap className="size-4" />,
  pileup: <Layers className="size-4" />,
};

/** Older servers: the pages waiting to be published. */
export function needsYouOf(data: PipelineData): NeedsYouItem[] {
  if (data.needsYou) return data.needsYou;
  return [...(data.queue?.waiting ?? [])]
    .sort((a, b) => b.days - a.days)
    .map((w) => ({
      id: `publish:${w.keyword}`,
      kind: 'publish' as const,
      severity: w.days >= 7 ? ('warning' as const) : ('info' as const),
      title: `Publish “${w.keyword}”`,
      detail: `Written ${w.days === 0 ? 'today' : w.days === 1 ? 'yesterday' : `${w.days} days ago`}. A page only ranks once it is live on your site; tell us its address and tracking starts.`,
      action: { label: 'I published it', mode: 'published' as const, prefill: { keyword: w.keyword } },
    }));
}

/** Where a Needs-you item's button goes (null: no link, e.g. a tool for a viewer). */
function useNeedsYouHref() {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  return (a: NonNullable<NeedsYouItem['action']>): string | null => {
    if (a.ladderId) return paths.ladder(org.id, site.id, a.ladderId);
    if (a.runId) return paths.run(org.id, a.runId);
    if (a.mode) return can('member') ? paths.tool(org.id, a.mode, { siteId: site.id, prefill: a.prefill }) : null;
    if (a.page) return paths.site(org.id, site.id, a.page);
    return null;
  };
}

/** The button of a Needs-you item: "Write it" (a Manual ladder's next page, opens Write now) or the item's link. */
function NeedsYouAction({ it, primary, onWrite, variant }: { it: NeedsYouItem; primary: boolean; onWrite?: (i: WriteNowItem) => void; variant?: 'primary' | 'secondary' }) {
  const { can } = useOrgCtx();
  const to = useNeedsYouHref();
  const href = it.action ? to(it.action) : null;
  // a Manual ladder's next page: "Write it" opens the Write now dialog with the ladder fields
  const write = it.writeNow && onWrite && can('member') ? it.writeNow : null;
  const v = variant ?? (primary ? 'primary' : 'secondary');
  if (write)
    return (
      <Button size="sm" variant={v} className="self-start" icon={<PenSquare className="size-4" />} onClick={() => onWrite!(write)}>
        {it.action?.label ?? 'Write it'}
      </Button>
    );
  if (href && it.action)
    return (
      <ButtonLink to={href} size="sm" variant={v} className="self-start">
        {it.action.label}
      </ButtonLink>
    );
  return null;
}

export function NeedsYou({ items, onWrite }: { items: NeedsYouItem[]; onWrite?: (i: WriteNowItem) => void }) {
  if (!items.length) return null;
  const important = items.some((x) => x.severity === 'warning');
  return (
    <section id="needs-you" aria-label="Needs you" className="min-w-0">
      <Panel
        className={important ? 'border-warning/50' : undefined}
        icon={<Hand />}
        iconTone={important ? 'warning' : 'blue'}
        flush
        title={
          <span className="inline-flex items-center gap-2">
            Needs you
            <span className="rounded-full bg-warning-soft px-2 text-xs font-semibold tabular text-warning-text">{items.length}</span>
          </span>
        }
        description="Things only a person can do. The pipeline keeps running, but these hold some of it up."
      >
        <ul className="divide-y divide-line border-t border-line">
          {items.map((it, i) => {
            // one primary button: the first important item
            const primary = it.severity === 'warning' && items.findIndex((x) => x.severity === 'warning') === i;
            return (
              <InsightItem
                key={it.id}
                tone={it.severity === 'warning' ? 'warning' : 'blue'}
                icon={KIND_ICON[it.kind] ?? <Info className="size-4" />}
                meta={it.severity === 'warning' ? <StatusBadge tone="warning">Important</StatusBadge> : <Badge icon={<Info className="size-3" aria-hidden />}>To do</Badge>}
                title={it.title}
                description={it.detail ? <span className="text-[13px] leading-snug text-ink-2">{it.detail}</span> : undefined}
                action={<NeedsYouAction it={it} primary={primary} onWrite={onWrite} />}
                actionPosition="side"
              />
            );
          })}
        </ul>
      </Panel>
    </section>
  );
}

// ---------- the hero ----------
/** A thin bar on the hero (on-dark colours); `alert`: warning / critical fills when it is nearly full (a budget). */
export function HeroMeter({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const surface = useSurface();
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full', surface === 'light' ? 'bg-accent-soft' : 'bg-on-ink/20')} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-brand', alert && v >= 90 ? 'bg-critical' : alert && v >= 70 ? 'bg-warning' : surface === 'light' ? 'bg-accent' : 'bg-on-ink')} style={{ width: `${v}%` }} />
    </div>
  );
}

function heroTitle(status: PipelineData['tracking']['status'], needs: NeedsYouItem[], next: ThisWeekItem | undefined): string {
  if (needs.length) return `${needs.length === 1 ? 'One thing needs' : `${needs.length} things need`} you; the rest runs on its own`;
  if (status === 'not_started') return 'The autopilot is not started yet';
  if (status === 'paused') return 'The pipeline is paused';
  if (next) return `All on track. Next up: ${next.title}`;
  return 'Nothing needs you right now';
}

/**
 * The page's summary: how the pipeline stands this week (headline from what needs the person and the next run), the month's
 * numbers (published, top 10, clicks, spend against the budget) and the first thing to do.
 */
export function PipelineHero({ data, needs, cards, onWrite }: { data: PipelineData; needs: NeedsYouItem[]; cards: LadderCard[]; onWrite?: (i: WriteNowItem) => void }) {
  const { site } = useSiteCtx();
  const week = useMemo(() => sortedWeek(data), [data]);
  const next = week[0];
  const s = data.summary;
  const share = s && s.budgetUsd > 0 ? (s.spendThisMonthUsd / s.budgetUsd) * 100 : 0;
  const first = needs[0];
  const line = [
    next ? `Next automatic run: ${next.title}, ${fmtWhen(next.at)}` : 'No automatic run in the next seven days',
    week.length > 1 ? `${plural(week.length, 'run')} this week` : '',
    cards.length ? plural(cards.length, 'keyword ladder') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SummaryHero
      tone="blue"
      eyebrow={
        <>
          <span className="font-mono tracking-[0.02em] uppercase">This week</span>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <span className="basis-full sm:basis-auto">{site.domain}</span>
        </>
      }
      title={heroTitle(data.tracking.status, needs, next)}
      description={line}
      aside={
        first ? (
          <HeroNextStep
            icon={KIND_ICON[first.kind] ?? <Hand />}
            eyebrow={needs.length > 1 ? `Needs you · 1 of ${needs.length}` : 'Needs you'}
            title={first.title}
            actions={<NeedsYouAction it={first} primary={false} onWrite={onWrite} variant="secondary" />}
          />
        ) : next ? (
          <HeroNextStep icon={AUTO_ICON[next.automation] ?? <CalendarClock />} eyebrow="Next automatic run" title={`${next.title} · ${fmtWhen(next.at)}`} />
        ) : undefined
      }
      stats={
        s ? (
          <>
            <HeroStat label="Pages published this month" value={<CountUp value={s.publishedThisMonth} />} hint="Ladder pages and blog posts that went live" />
            <HeroStat label="Keywords in the top 10" value={<CountUp value={s.top10} />} hint="Ladder pages and main keywords on page one of Google" />
            <HeroStat label="Clicks from ladder pages" value={<CountUp value={s.clicks28d} format={compactNumber} />} hint="Last 28 days, from Search Console" />
            <HeroStat
              label="Spent this month"
              value={<CountUp value={s.spendThisMonthUsd} format={formatUsd} />}
              hint={
                s.budgetUsd > 0 ? (
                  <>
                    <HeroMeter value={share} label="Share of the monthly budget spent" alert />
                    <span className="mt-1.5 flex items-center gap-1">
                      {share >= 70 && <AlertTriangle className="size-3 shrink-0" aria-hidden />}
                      of {formatUsd(s.budgetUsd)} monthly budget ({Math.round(share)}%)
                    </span>
                  </>
                ) : (
                  'No monthly budget set'
                )
              }
            />
          </>
        ) : undefined
      }
    />
  );
}

// ---------- how it works ----------
const STEP_ICON = [<ListOrdered key="plan" />, <PenSquare key="write" />, <Inbox key="publish" />, <Activity key="track" />, <TrendingUp key="climb" />, <Trophy key="won" />];

export function HowItWorks({ data, cards }: { data: PipelineData; cards: LadderCard[] }) {
  const { site } = useSiteCtx();
  const [open, setOpen] = useState(false);
  const id = useId();
  const stage = (id: PipelineStage['id']) => data.stages?.find((s) => s.id === id);
  const won = cards.filter((c) => c.status === 'won').length;
  const steps: { title: string; text: string; yours?: string }[] = [
    {
      title: 'Plan',
      text: 'Pick one main keyword. The plan lists pages from easy to hard, each with its own, easier keyword.',
      yours: cards.length ? `${plural(cards.length, 'keyword ladder')} · ${stage('plan')?.headline ?? ''}` : stage('plan')?.headline,
    },
    {
      title: 'Pages written on Mondays',
      text: 'Every Monday the next page is researched, written, edited and checked: easy pages first.',
      yours: stage('write')?.headline,
    },
    {
      title: 'You publish',
      text: 'Put the page on your site (copy or download it), then tell us its address so tracking starts.',
      yours: stage('publish')?.headline,
    },
    {
      title: 'Rank check',
      text: 'Every Monday each page and the main keyword are looked up on Google.',
      yours: stage('track')?.detail,
    },
    {
      title: 'Climb',
      text: 'Easy pages reach page one first. They link to the main page and lend it strength, so it climbs too.',
      yours: data.summary ? `${plural(data.summary.top10, 'keyword')} in the top 10 now` : undefined,
    },
    {
      title: 'Main keyword won',
      text: 'When the main keyword stays in the top 3 for four weekly checks, the ladder is won. Tracking goes on.',
      yours: cards.length ? `${won} of ${plural(cards.length, 'ladder')} won` : undefined,
    },
  ];
  return (
    <Card>
      <DisclosureButton
        open={open}
        onToggle={() => setOpen(!open)}
        controls={id}
        variant="row"
        className="rounded-xl px-5 py-4 transition-colors duration-150 ease-brand hover:bg-surface-2/60"
        icon={
          <>
            <IconTile size="sm">
              <Workflow />
            </IconTile>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">How a keyword ladder works</span>
              <span className="mt-0.5 block text-[13px] leading-snug font-normal text-ink-3">Six steps, with {site.domain}’s own numbers. It takes months, not weeks.</span>
            </span>
          </>
        }
        label={null}
      />
      <CollapsePanel open={open} id={id}>
        <div className="border-t border-line px-5 py-4">
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
                <span className="relative shrink-0">
                  <IconTile size="md">{STEP_ICON[i]}</IconTile>
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold tabular text-accent-ink ring-2 ring-surface" aria-hidden>
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{s.text}</p>
                  {s.yours && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-accent-soft/70 px-2 py-1 text-xs text-accent-text">
                      <ArrowRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span>
                        On your site: <span className="font-medium">{s.yours}</span>
                      </span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-start gap-2 text-xs leading-snug text-ink-3">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Pages that reach the top 10 usually take 2–6 months. Progress shows first as pages going live and positions moving up.
          </p>
        </div>
      </CollapsePanel>
    </Card>
  );
}

/** A small warning line (icon + word). */
export function WarnLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-[13px] leading-snug text-warning-text', className)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
