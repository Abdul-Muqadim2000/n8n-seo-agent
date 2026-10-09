// Pipeline home: one card per keyword ladder, in priority order (the order the weekly posts go to them).
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowRight, CheckCircle2, Hand, Hourglass, Inbox, Loader2, PenSquare, Plus, TrendingUp } from 'lucide-react';
import { formatUsd, normKeyword, type LadderCard, type PipelineData, type SiteAutomation } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Meter } from '@/components/ui/misc';
import { Sparkline } from '@/components/charts';
import { IconTile, Stagger, type IconTileTone } from '@/components/insight';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { cn, fmtAgo } from '@/lib/utils';
import { SectionHeading } from '../kit';
import { LadderClimb, LadderStatusBadge, ModeChip, monthsText, PLAN_LABEL, PositionChange, PositionPill, fmtShortDay, sparkRows, STATUS_STRIPE, validDate } from './common';
import { LadderModeSwitch, LadderMoveButtons, LadderPauseButton, MODE_HELP } from './controls';
import { WarnLine } from './home';

const NEXT_ICON: Record<LadderCard['next']['kind'], ReactNode> = {
  write: <PenSquare className="size-3.5" />,
  publish: <Inbox className="size-3.5" />,
  approve: <Hand className="size-3.5" />,
  check: <Activity className="size-3.5" />,
  wait: <Hourglass className="size-3.5" />,
  none: <CheckCircle2 className="size-3.5" />,
};
/** what the next step asks for: the person (publish, approve), the engine (write, check), nothing (wait, none) */
const NEXT_TONE: Record<LadderCard['next']['kind'], IconTileTone> = { write: 'blue', publish: 'warning', approve: 'warning', check: 'blue', wait: 'neutral', none: 'good' };

export function LadderCards({ cards, automation, planning = [] }: { cards: LadderCard[]; automation?: SiteAutomation; planning?: PipelineData['activeRuns'] }) {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const { site } = useSiteCtx();
  const newLadder = can('member') && (
    <ButtonLink to={paths.newLadder(org.id, site.id)} size="sm" icon={<Plus className="size-4" />}>
      New keyword ladder
    </ButtonLink>
  );
  const sorted = [...cards].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  // a ladder run whose plan has not arrived yet (its card appears with the plan)
  const pending = planning.filter((r) => !sorted.some((c) => normKeyword(c.head) === normKeyword(r.keyword)));
  const max = automation?.maxActiveLadders ?? 2;
  return (
    <section aria-labelledby="ladders-heading">
      <SectionHeading
        id="ladders-heading"
        icon={<TrendingUp />}
        title="Keyword ladders"
        description="One plan per main keyword: easy pages first, the main page last."
        info={
          <>
            The weekly posts go to the ladders in this order, at most {max === 1 ? '1 ladder' : `${max} ladders`} at a time; the others wait as Queued.
            {admin && sorted.length > 1 ? ' Move a ladder up to write it sooner.' : ''}
          </>
        }
        actions={sorted.length > 0 || pending.length > 0 ? newLadder : undefined}
      />
      {pending.length > 0 && (
        <ul className={sorted.length ? 'mb-4 space-y-4' : 'space-y-4'}>
          {pending.map((r) => (
            <li key={r.id}>
              <PlanningCard run={r} />
            </li>
          ))}
        </ul>
      )}
      {!sorted.length ? (
        pending.length ? null : (
          <Card>
            <EmptyState
              icon={<TrendingUp className="size-5" />}
              title="No keyword ladders yet"
              description="Choose a keyword you want to rank for. The system plans the pages from easy to hard, writes them on Mondays and tracks them on Google."
              action={newLadder}
            />
          </Card>
        )
      ) : (
        <Stagger as="ul" className="space-y-4">
          {sorted.map((c, i) => (
            <li key={c.id} className="min-w-0">
              <LadderCardView card={c} rank={i + 1} controls={admin ? <LadderControls cards={sorted} index={i} /> : undefined} />
            </li>
          ))}
        </Stagger>
      )}
    </section>
  );
}

/** A ladder being planned: the run is going, its plan (and so its card) arrives in about 5-8 minutes. */
function PlanningCard({ run }: { run: PipelineData['activeRuns'][number] }) {
  const { org } = useOrgCtx();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-dashed border-accent/40 bg-accent-soft/30 px-5 py-4" aria-live="polite">
      <div className="flex min-w-0 items-start gap-3">
        <IconTile tone="solid" size="md">
          <Loader2 className="animate-spin" aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-snug tracking-[-0.01em] text-ink">Planning your ladder “{run.keyword}”</p>
          <p className="mt-0.5 text-[13px] text-ink-3">About 5-8 minutes; started {fmtAgo(run.createdAt)}. The plan shows here when it is ready, the first pages follow as reports.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LadderStatusBadge status="planning" />
        <ButtonLink to={paths.run(org.id, run.id)} variant="secondary" size="sm">
          Open the run
        </ButtonLink>
      </div>
    </Card>
  );
}

/** The admin's controls on a card: Auto / Manual with what it means, Pause / Resume, Move up / down. Above the card's link. */
function LadderControls({ cards, index }: { cards: LadderCard[]; index: number }) {
  const c = cards[index];
  return (
    <div className="relative z-[1] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-b-xl border-t border-line bg-surface-2/50 px-5 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <LadderModeSwitch ladder={c} />
        <span className="min-w-0 text-xs leading-snug text-ink-3">{MODE_HELP[c.mode]}</span>
      </div>
      <div className="flex items-center gap-2">
        <LadderPauseButton ladder={c} />
        {cards.length > 1 && <LadderMoveButtons cards={cards} index={index} />}
      </div>
    </div>
  );
}

/** A label + value block of a ladder card. */
function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function LadderCardView({ card: c, rank, controls }: { card: LadderCard; rank: number; controls?: ReactNode }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const series = sparkRows(c.headSeries);
  const meta = [c.country, c.planType ? PLAN_LABEL[c.planType] : '', monthsText(c.months) ? `about ${monthsText(c.months)}` : ''].filter(Boolean).join(' · ');
  const nextKind = c.next?.kind ?? 'none';
  return (
    <Card interactive className="group relative flex h-full flex-col overflow-hidden hover:-translate-y-0.5 has-[.card-link:focus-visible]:shadow-[var(--ring)]">
      {/* the status colour on the edge; the status badge says it in words */}
      <span className={cn('absolute inset-y-0 left-0 w-1', STATUS_STRIPE[c.status] ?? 'bg-line-strong')} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold tabular text-accent-ink shadow-card"
            title={`Priority ${c.priority || rank}: gets the weekly posts ${rank === 1 ? 'first' : 'after the ladders above'}`}
          >
            {c.priority || rank}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
              <Link to={paths.ladder(org.id, site.id, c.id)} className="card-link inline-flex items-center gap-1.5 transition-colors duration-150 ease-brand after:absolute after:inset-0 after:rounded-xl group-hover:text-accent-text focus-visible:shadow-none! focus-visible:outline-none">
                {c.head}
                <ArrowRight className="size-4 shrink-0 text-ink-3 transition-[color,transform] duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden />
              </Link>
            </h3>
            {meta && <p className="mt-0.5 text-[13px] text-ink-3">{meta}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <LadderStatusBadge status={c.status} />
          {!controls && <ModeChip mode={c.mode} />}
        </div>
      </div>
      {c.statusText && <p className="px-5 pt-2 text-[13px] leading-snug text-ink-2 sm:pl-16">{c.statusText}</p>}

      <div className="grid gap-x-6 gap-y-4 px-5 pt-4 pb-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* the climb: one step per page of the plan */}
        <div className="min-w-0 rounded-lg bg-surface-2/60 px-3.5 pt-3 pb-2.5">
          <p className="mb-2 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-3">
            <span>The climb</span>
            <span className="tabular">
              <span className="font-semibold text-ink">{c.counts.published}</span> of {c.counts.total} live
            </span>
          </p>
          <LadderClimb counts={c.counts} height={40} />
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
          <Fact label="Main keyword">
            <span className="flex flex-wrap items-center gap-2">
              <PositionPill position={c.headPosition} />
              {series.length > 1 && (
                <span className="h-6 w-14 shrink-0" aria-hidden>
                  <Sparkline data={series} dataKey="p" invert />
                </span>
              )}
            </span>
            <PositionChange change={c.headChange} className="mt-1" />
          </Fact>
          <Fact label="In the top 10">
            <span className="text-[13px] text-ink-3">
              <span className="font-display text-lg font-semibold text-ink">{c.top10}</span> of {c.counts.total} pages
            </span>
            <Meter value={c.counts.total ? (c.top10 / c.counts.total) * 100 : 0} tone={c.top10 > 0 ? 'good' : 'accent'} label="Pages in the top 10" className="mt-1.5 h-1.5" />
          </Fact>
          <Fact label="Next step" className="col-span-2 sm:col-span-1">
            <span className="flex items-start gap-2 text-[13px] text-ink">
              <IconTile size="xs" tone={NEXT_TONE[nextKind] ?? 'neutral'}>
                {NEXT_ICON[nextKind] ?? NEXT_ICON.none}
              </IconTile>
              <span className="min-w-0 break-words pt-0.5 leading-snug">
                {validDate(c.next?.at) && <span className="font-medium">{fmtShortDay(c.next.at)}: </span>}
                {c.next?.text || 'Nothing planned'}
              </span>
            </span>
          </Fact>
          <Fact label="Cost" className="col-span-2 sm:col-span-1">
            <span className="text-[13px] text-ink">
              <span className="font-semibold">{formatUsd(c.monthlyCostUsd)}</span>
              <span className="text-ink-3"> / month</span>
            </span>
          </Fact>
        </dl>
      </div>
      {(c.overlaps ?? []).length > 0 && (
        <div className="space-y-1 border-t border-line bg-warning-soft/40 px-5 py-3">
          {c.overlaps.map((o) => (
            <WarnLine key={o.ladderId}>
              Overlap: shares {o.keywords.length === 1 ? 'a keyword' : `${o.keywords.length} keywords`} with the ladder “{o.head}” ({o.keywords.slice(0, 3).join(', ')}
              {o.keywords.length > 3 ? ', …' : ''}). Two pages for one search compete with each other.
            </WarnLine>
          ))}
        </div>
      )}
      {controls}
    </Card>
  );
}
