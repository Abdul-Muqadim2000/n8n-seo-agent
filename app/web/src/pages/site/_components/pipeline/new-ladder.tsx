// Building blocks of the "New keyword ladder" flow (PIPELINE_FEATURE_SPEC.md §5.1): the step indicator, the keyword card (a
// recommended keyword or a checked one, with its difficulty for the website and its plan) and the chosen keyword they turn into.
import type { ReactNode } from 'react';
import { Check, CircleHelp, Search, Sparkles, TrendingUp } from 'lucide-react';
import {
  compactNumber,
  DIFFICULTY_LABEL,
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
import { Meter } from '@/components/ui/misc';
import { IconTile, InfoTip } from '@/components/insight';
import { DifficultyBadge, DIFFICULTY_TONE, PlanBadge } from '@/components/site/keyword';
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
    <ol className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Steps">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="min-w-0" aria-current={current ? 'step' : undefined}>
            {/* the progress segment of this step: filled once it is reached */}
            <span className={cn('block h-1 rounded-full transition-colors duration-300 ease-brand', done || current ? 'bg-accent' : 'bg-surface-3')} aria-hidden />
            <span className="mt-2.5 flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-200 ease-brand',
                  done ? 'border-transparent bg-accent text-accent-ink' : current ? 'border-accent bg-accent-soft text-accent-text ring-4 ring-accent-soft' : 'border-line-strong bg-surface text-ink-3',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : n}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] leading-none font-medium tracking-[0.04em] text-ink-3 uppercase max-sm:hidden" aria-hidden>
                  Step {n}
                </span>
                <span className={cn('mt-0.5 block text-[13px] leading-snug', current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const DIFF_ORDER: DifficultyForYou[] = ['easy', 'reachable', 'hard', 'very_hard', 'not_realistic'];
const FILL: Record<string, string> = { good: 'bg-good', accent: 'bg-accent', warning: 'bg-warning', serious: 'bg-serious', critical: 'bg-critical', neutral: 'bg-line-strong' };

/** "Difficulty for your site" as a five-step scale (easy → not realistic), filled up to the keyword's step; the badge says it in words. */
export function DifficultyScale({ difficulty, className }: { difficulty: DifficultyForYou; className?: string }) {
  const at = DIFF_ORDER.indexOf(difficulty);
  const fill = FILL[DIFFICULTY_TONE[difficulty]] ?? 'bg-accent';
  return (
    <span className={cn('flex gap-[3px]', className)} role="img" aria-label={`${DIFFICULTY_LABEL[difficulty]}: step ${at + 1} of ${DIFF_ORDER.length}, from easy to not realistic`}>
      {DIFF_ORDER.map((d, i) => (
        <span key={d} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300 ease-brand', i <= at ? fill : 'bg-surface-3')} />
      ))}
    </span>
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
    <Card className={cn('flex h-full min-w-0 flex-col p-4 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised', selected && 'border-accent ring-1 ring-accent', className)}>
      <div className="flex items-start gap-3">
        <IconTile size="md" tone={selected ? 'solid' : 'blue'}>
          {k.position != null ? <TrendingUp /> : <Search />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-words font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{k.keyword}</h3>
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
        </div>
      </div>
      {k.difficultyForYou && (
        <div className="mt-3.5">
          <p className="mb-1.5 flex items-center gap-0.5 text-xs font-medium text-ink-3">
            Difficulty for your site
            <InfoTip label="About difficulty for your site">Rated from what your website already ranks for: easy, reachable, hard, very hard or not realistic.</InfoTip>
          </p>
          <DifficultyScale difficulty={k.difficultyForYou} />
        </div>
      )}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 rounded-lg bg-surface-2/60 px-3 py-2.5 text-[13px]">
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">Searches a month</dt>
          <dd className="mt-0.5 font-display text-base font-semibold text-ink">{k.volume == null ? 'Unknown' : compactNumber(k.volume)}</dd>
        </div>
        <div className="min-w-0">
          {k.position != null ? (
            <>
              <dt className="text-xs text-ink-3">Your position now</dt>
              <dd className="mt-0.5 font-display text-base font-semibold text-ink">#{k.position}</dd>
            </>
          ) : (
            <>
              <dt className="text-xs text-ink-3" title="How hard it is to rank for, for any website (0-100)">
                Difficulty (any site)
              </dt>
              <dd className="mt-0.5 font-display text-base font-semibold text-ink">{k.kd == null ? 'Unknown' : `${k.kd} / 100`}</dd>
              {k.kd != null && <Meter value={k.kd} label="Difficulty for any site, 0 to 100" className="mt-1.5 h-1.5" />}
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
