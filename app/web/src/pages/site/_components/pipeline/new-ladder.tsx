// Building blocks of the "New keyword ladder" flow (PIPELINE_FEATURE_SPEC.md §5.1): the step indicator, the keyword card (a
// recommended keyword or a checked one, with its difficulty for the website and its plan) and the chosen keyword they turn into.
import type { ReactNode } from 'react';
import { Check, CircleHelp, Sparkles } from 'lucide-react';
import {
  compactNumber,
  ladderOverlapsOf,
  type DifficultyForYou,
  type KeywordCheck,
  type LadderKeywords,
  type PlanChoice,
  type RecommendedKeyword,
} from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DifficultyBadge, PlanBadge } from '@/components/site/keyword';
import { cn } from '@/lib/utils';
import { WarnLine } from './home';

/** The keyword the person picked, whichever way: a recommendation, "Choose for me", or a checked keyword. */
export interface ChosenKeyword {
  keyword: string;
  country: string;
  how: 'recommended' | 'chosen' | 'checked';
  difficultyForYou: DifficultyForYou | null;
  planType: PlanChoice | null;
  months: string;
  stretch: boolean;
  label: string;
  volume: number | null;
  kd: number | null;
  why: string;
  /** topic fit from a check (0 off-topic, 1 related, 2 core); null when unknown */
  fit: 0 | 1 | 2 | null;
  position: number | null;
  overlaps: { ladderId: string; head: string; keyword: string }[];
  /** a check answered from the last 7 days (free) */
  cached?: boolean;
  checkedAt?: string;
}

export const fromRecommended = (k: RecommendedKeyword, country: string, how: 'recommended' | 'chosen'): ChosenKeyword => ({
  keyword: k.keyword,
  country,
  how,
  difficultyForYou: k.difficultyForYou,
  planType: k.planType,
  months: k.months,
  stretch: false,
  label: k.label,
  volume: k.volume,
  kd: k.kd,
  why: k.why,
  fit: null,
  position: null,
  overlaps: k.overlaps,
});

export const fromCheck = (c: KeywordCheck, ladders: LadderKeywords[]): ChosenKeyword => ({
  keyword: c.result.keyword || c.keyword,
  country: c.country,
  how: 'checked',
  difficultyForYou: c.result.difficultyForYou,
  planType: c.result.planType,
  months: c.result.months,
  stretch: c.result.stretch,
  label: c.result.label,
  volume: c.result.volume,
  kd: c.result.kd,
  why: '',
  fit: c.result.fit,
  position: c.result.position,
  overlaps: ladderOverlapsOf(c.result.keyword || c.keyword, ladders),
  cached: c.cached,
  checkedAt: c.createdAt,
});

const STEPS = ['Choose the keyword', 'Review the plan', 'Start'];

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Steps">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done ? 'border-transparent bg-accent text-accent-ink' : current ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong bg-surface text-ink-3',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span className={cn('text-[13px]', current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-line-strong sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** "Not rated" chip for keywords that have no difficulty for the website (older research, research without the website). */
function NotRated() {
  return (
    <span title="Rated when the ladder is planned, from what your website already ranks for" className="inline-flex">
      <Badge icon={<CircleHelp className="size-3" aria-hidden />}>Not rated for your site yet</Badge>
    </span>
  );
}

export function KeywordCard({
  k,
  onChoose,
  chooseLabel = 'Choose this keyword',
  selected,
  ourPick,
  footer,
  primary,
  className,
}: {
  k: Pick<ChosenKeyword, 'keyword' | 'difficultyForYou' | 'planType' | 'months' | 'stretch' | 'volume' | 'kd' | 'why' | 'position' | 'overlaps'>;
  onChoose?: () => void;
  chooseLabel?: string;
  selected?: boolean;
  /** the keyword research's own first pick */
  ourPick?: boolean;
  footer?: ReactNode;
  /** the choose button is the main action of the page */
  primary?: boolean;
  className?: string;
}) {
  const realistic = k.planType !== 'none';
  return (
    <Card className={cn('flex h-full min-w-0 flex-col p-4', selected && 'border-accent ring-1 ring-accent', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 break-words text-[15px] font-semibold leading-snug text-ink">{k.keyword}</h3>
        {ourPick && (
          <Badge tone="accent" icon={<Sparkles className="size-3" aria-hidden />}>
            Research’s first pick
          </Badge>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {k.difficultyForYou ? <DifficultyBadge difficulty={k.difficultyForYou} /> : <NotRated />}
        <PlanBadge plan={k.planType} months={k.months} stretch={k.stretch} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 text-[13px]">
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Searches a month</dt>
          <dd className="mt-0.5 font-medium text-ink">{k.volume == null ? 'Unknown' : compactNumber(k.volume)}</dd>
        </div>
        <div className="min-w-0">
          {k.position != null ? (
            <>
              <dt className="text-xs text-ink-3">Your position now</dt>
              <dd className="mt-0.5 font-medium text-ink">#{k.position}</dd>
            </>
          ) : (
            <>
              <dt className="text-xs text-ink-3" title="How hard it is to rank for, for any website (0-100)">
                Difficulty (any site)
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{k.kd == null ? 'Unknown' : `${k.kd} / 100`}</dd>
            </>
          )}
        </div>
      </dl>
      {k.why && <p className="mt-3 line-clamp-3 text-[13px] leading-snug text-ink-2">{k.why}</p>}
      {k.overlaps.length > 0 && (
        <WarnLine className="mt-3">
          Your ladder “{k.overlaps[0].head}” already covers this search
          {k.overlaps[0].keyword !== k.overlaps[0].head ? ` (its page “${k.overlaps[0].keyword}”)` : ''}. One search needs one page.
        </WarnLine>
      )}
      {footer}
      {onChoose && realistic && (
        <div className="mt-auto pt-4">
          <Button size="sm" variant={selected || primary ? 'primary' : 'secondary'} onClick={onChoose} icon={selected ? <Check className="size-4" /> : undefined} className="w-full sm:w-auto">
            {chooseLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}
