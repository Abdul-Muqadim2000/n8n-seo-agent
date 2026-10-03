// Pipeline home: one card per keyword ladder, in priority order (the order the weekly posts go to them).
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, CheckCircle2, Hand, Hourglass, Inbox, Loader2, PenSquare, Plus, TrendingUp } from 'lucide-react';
import { formatUsd, normKeyword, type LadderCard, type PipelineData, type SiteAutomation } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Sparkline } from '@/components/charts';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtAgo } from '@/lib/utils';
import { SectionHeading } from '../kit';
import { LadderProgress, LadderStatusBadge, ModeChip, monthsText, PLAN_LABEL, PositionChange, positionWords, fmtShortDay, sparkRows, validDate } from './common';
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
        title="Keyword ladders"
        description={
          <>
            One plan per main keyword: easy pages first, the main page last. The weekly posts go to the ladders in this order, at most {max === 1 ? '1 ladder' : `${max} ladders`} at a time; the
            others wait as Queued.{admin && sorted.length > 1 ? ' Move a ladder up to write it sooner.' : ''}
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
        <ul className="space-y-4">
          {sorted.map((c, i) => (
            <li key={c.id} className="min-w-0">
              <LadderCardView card={c} rank={i + 1} controls={admin ? <LadderControls cards={sorted} index={i} /> : undefined} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A ladder being planned: the run is going, its plan (and so its card) arrives in about 5-8 minutes. */
function PlanningCard({ run }: { run: PipelineData['activeRuns'][number] }) {
  const { org } = useOrgCtx();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-dashed px-5 py-4" aria-live="polite">
      <div className="flex min-w-0 items-start gap-3">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-accent-text" aria-hidden />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-snug text-ink">
            Planning your ladder “{run.keyword}”
          </p>
          <p className="mt-0.5 text-[13px] text-ink-3">
            About 5-8 minutes; started {fmtAgo(run.createdAt)}. The plan shows here when it is ready, the first pages follow as reports.
          </p>
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
    <div className="relative z-[1] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-b-xl border-t border-line bg-surface-2/40 px-5 py-2.5">
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

function LadderCardView({ card: c, rank, controls }: { card: LadderCard; rank: number; controls?: ReactNode }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const series = sparkRows(c.headSeries);
  const meta = [c.country, c.planType ? PLAN_LABEL[c.planType] : '', monthsText(c.months) ? `about ${monthsText(c.months)}` : ''].filter(Boolean).join(' · ');
  return (
    <Card className="relative flex h-full flex-col transition-colors hover:border-line-strong hover:bg-surface-2/40">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular text-ink-2" title={`Priority ${c.priority || rank}: gets the weekly posts ${rank === 1 ? 'first' : 'after the ladders above'}`}>
            {c.priority || rank}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug text-ink">
              <Link to={paths.ladder(org.id, site.id, c.id)} className="after:absolute after:inset-0 after:rounded-xl hover:text-accent-text focus-visible:outline-none">
                {c.head}
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
      {c.statusText && <p className="px-5 pt-2 text-[13px] leading-snug text-ink-2">{c.statusText}</p>}

      <LadderProgress counts={c.counts} className="px-5 pt-3" />

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line px-5 py-3.5 text-[13px] md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,0.7fr)]">
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Main keyword</dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <span className="font-semibold text-ink">{positionWords(c.headPosition)}</span>
            {series.length > 1 && (
              <span className="h-6 w-14 shrink-0" aria-hidden>
                <Sparkline data={series} dataKey="p" invert />
              </span>
            )}
          </dd>
          <dd>
            <PositionChange change={c.headChange} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">In the top 10</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {c.top10} <span className="font-normal text-ink-3">of {c.counts.total} pages</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Next step</dt>
          <dd className="mt-0.5 flex items-start gap-1.5 text-ink">
            <span className="mt-0.5 shrink-0 text-ink-3">{NEXT_ICON[c.next?.kind] ?? NEXT_ICON.none}</span>
            <span className="min-w-0 break-words">
              {validDate(c.next?.at) && <span className="font-medium">{fmtShortDay(c.next.at)}: </span>}
              {c.next?.text || 'Nothing planned'}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Cost</dt>
          <dd className="mt-0.5 text-ink">
            {formatUsd(c.monthlyCostUsd)}
            <span className="text-ink-3"> / month</span>
          </dd>
        </div>
      </dl>
      {(c.overlaps ?? []).length > 0 && (
        <div className="space-y-1 border-t border-line px-5 py-3">
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
