// Pipeline home, top half: the summary numbers, this week's runs, what needs the person, and how a ladder works.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Hand,
  Inbox,
  Info,
  Layers,
  Loader2,
  PenSquare,
  PlugZap,
  XCircle,
} from 'lucide-react';
import { AUTOMATIONS, compactNumber, formatUsd, MODES, type LadderCard, type NeedsYouItem, type PipelineData, type PipelineStage, type ThisWeekItem } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Meter, StatTile } from '@/components/ui/misc';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtAgo } from '@/lib/utils';
import { KpiGrid } from '../kit';
import { plural } from '../format';
import { AUTO_ICON, fmtDayHead, fmtTime, validDate } from './common';
import type { WriteNowItem } from './WriteNowDialog';

// ---------- summary numbers ----------
export function SummaryRow({ data }: { data: PipelineData }) {
  const s = data.summary;
  if (!s) return null;
  const share = s.budgetUsd > 0 ? (s.spendThisMonthUsd / s.budgetUsd) * 100 : 0;
  return (
    <KpiGrid dense>
      <StatTile label="Pages published this month" value={s.publishedThisMonth} hint="Ladder pages and blog posts that went live" />
      <StatTile label="Keywords in the top 10" value={s.top10} hint="Ladder pages and main keywords on page one of Google" />
      <StatTile label="Clicks from ladder pages" value={compactNumber(s.clicks28d)} hint="Last 28 days, from Search Console" />
      <StatTile
        label="Spent this month"
        value={formatUsd(s.spendThisMonthUsd)}
        hint={
          s.budgetUsd > 0 ? (
            <>
              <Meter value={share} tone={share >= 90 ? 'critical' : share >= 70 ? 'warning' : 'accent'} label="Share of the monthly budget spent" className="mb-1.5" />
              of {formatUsd(s.budgetUsd)} monthly budget ({Math.round(share)}%)
            </>
          ) : (
            'No monthly budget set'
          )
        }
      />
    </KpiGrid>
  );
}

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

const RunningBadge = () => (
  <Badge tone="accent" icon={<Loader2 className="size-3 animate-spin" aria-hidden />}>
    Running now
  </Badge>
);

export function ThisWeek({ data }: { data: PipelineData }) {
  const { org } = useOrgCtx();
  const items = useMemo(() => [...thisWeekOf(data)].filter((i) => validDate(i.at)).sort((a, b) => a.at.localeCompare(b.at)), [data]);
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
    <Card>
      <CardHeader icon={<CalendarClock className="size-4" />} title="This week" description="The next automatic runs in order, in your time zone, and what each one works on." />
      <CardBody className="space-y-4">
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
          <ol className="space-y-4">
            {days.map((events) => (
              <li key={events[0].at}>
                <p className="text-[13px] font-semibold text-ink">{fmtDayHead(events[0].at)}</p>
                <ul className="mt-1.5 divide-y divide-line">
                  {events.map((e) => (
                    <li key={e.at + e.automation} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 py-2 text-[13px]">
                      <span className="whitespace-nowrap pt-0.5 tabular text-ink-3">{fmtTime(e.at)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-3">{AUTO_ICON[e.automation]}</span>
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
      </CardBody>
    </Card>
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

export function NeedsYou({ items, onWrite }: { items: NeedsYouItem[]; onWrite?: (i: WriteNowItem) => void }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  if (!items.length) return null;
  const to = (a: NonNullable<NeedsYouItem['action']>): string | null => {
    if (a.ladderId) return paths.ladder(org.id, site.id, a.ladderId);
    if (a.runId) return paths.run(org.id, a.runId);
    if (a.mode) return can('member') ? paths.tool(org.id, a.mode, { siteId: site.id, prefill: a.prefill }) : null;
    if (a.page) return paths.site(org.id, site.id, a.page);
    return null;
  };
  return (
    <Card className="border-warning/50">
      <CardHeader
        icon={<Hand className="size-4" />}
        title={
          <span className="inline-flex items-center gap-2">
            Needs you
            <span className="rounded-md bg-surface-2 px-1.5 text-xs font-medium tabular text-ink-2">{items.length}</span>
          </span>
        }
        description="Things only a person can do. The pipeline keeps running, but these hold some of it up."
      />
      <ul className="divide-y divide-line px-5 pb-2 pt-2">
        {items.map((it, i) => {
          const href = it.action ? to(it.action) : null;
          // a Manual ladder's next page: "Write it" opens the Write now dialog with the ladder fields
          const write = it.writeNow && onWrite && can('member') ? it.writeNow : null;
          // one primary button: the first important item
          const primary = it.severity === 'warning' && items.findIndex((x) => x.severity === 'warning') === i;
          return (
            <li key={it.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-start">
              <span className="hidden pt-0.5 text-ink-3 sm:block">{KIND_ICON[it.kind] ?? <Info className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {it.severity === 'warning' ? (
                    <StatusBadge tone="warning">Important</StatusBadge>
                  ) : (
                    <Badge icon={<Info className="size-3" aria-hidden />}>To do</Badge>
                  )}
                  <span className="text-sm font-semibold text-ink">{it.title}</span>
                </div>
                {it.detail && <p className="mt-1 text-[13px] leading-snug text-ink-2">{it.detail}</p>}
              </div>
              {write ? (
                <Button size="sm" variant={primary ? 'primary' : 'secondary'} className="self-start" icon={<PenSquare className="size-4" />} onClick={() => onWrite!(write)}>
                  {it.action?.label ?? 'Write it'}
                </Button>
              ) : (
                href &&
                it.action && (
                  <ButtonLink to={href} size="sm" variant={primary ? 'primary' : 'secondary'} className="self-start">
                    {it.action.label}
                  </ButtonLink>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- how it works ----------
export function HowItWorks({ data, cards }: { data: PipelineData; cards: LadderCard[] }) {
  const { site } = useSiteCtx();
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
    <details className="group rounded-xl border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 transition-colors duration-150 ease-brand hover:bg-surface-2/60 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">How a keyword ladder works</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">Six steps, with {site.domain}’s own numbers. It takes months, not weeks.</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-brand group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line px-5 py-4">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-lg bg-surface-2/60 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular text-accent-text">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{s.text}</p>
                {s.yours && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-3">
                    <ArrowRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span>
                      On your site: <span className="text-ink-2">{s.yours}</span>
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
    </details>
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
