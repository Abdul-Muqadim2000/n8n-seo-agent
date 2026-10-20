// A keyword in plain words for owners who are not SEO people (SCHEDULING_KEYWORDS_PLAN.md §5.2): how many people search it, the
// website's chances, why we suggest it, the plan and the credits of a page. Used by onboarding's "Your first keyword", the keyword
// proposals on the Pipeline and the Coming-up plan.
import type { ReactNode } from 'react';
import { CalendarRange, Check, Coins, Search, Sparkles, Users } from 'lucide-react';
import { CHANCE_WORDS, compactNumber, type DifficultyForYou, type PlanChoice } from '@seo/shared';
import { Badge, type Tone } from '@/components/ui/badge';
import { IconTile } from '@/components/insight';
import { PRICES } from '@/lib/prices';
import { cn } from '@/lib/utils';

/** "Good chance" / "Takes a few months" / "Hard for your website now"; null when not rated or not realistic. */
export function chanceWords(d: DifficultyForYou | null | undefined): string | null {
  if (!d || d === 'not_realistic') return null;
  return CHANCE_WORDS[d] ?? null;
}

export const CHANCE_TONE: Record<DifficultyForYou, Tone> = { easy: 'good', reachable: 'accent', hard: 'warning', very_hard: 'warning', not_realistic: 'warning' };

/** "About 320 people search this a month" (or that the number is not known). */
export function searchesWords(volume: number | null | undefined): string {
  if (volume == null) return 'Searches a month not known yet';
  if (volume <= 0) return 'Few searches a month';
  return `About ${compactNumber(volume)} ${volume === 1 ? 'person searches' : 'people search'} this a month`;
}

const PLAN_PAGES: Record<Exclude<PlanChoice, 'none'>, string> = { direct: '3-4 pages', short: '4-6 pages', full: '9-13 pages' };

/** "About 5 pages over 3-6 months", '' when there is no plan. */
export function planWords(plan: PlanChoice | null | undefined, months: string | null | undefined): string {
  if (!plan || plan === 'none') return '';
  const pages = PLAN_PAGES[plan];
  const m = (months ?? '').trim();
  return `About ${pages}${m ? ` over ${m} months` : ''}`;
}

export interface KeywordChoice {
  keyword: string;
  volume: number | null;
  difficultyForYou: DifficultyForYou | null;
  planType: PlanChoice | null;
  months: string;
  why: string;
  /** rehearsal 2026-10-20: "Not one of the services you listed" for a research card outside what the client sells */
  note?: string;
}

export function KeywordChoiceCard({
  k,
  selected,
  onToggle,
  disabled,
  disabledReason,
  ourPick,
  creditsPerPage,
  children,
  className,
}: {
  k: KeywordChoice;
  /** a choice card: pressed when chosen */
  selected?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  /** why it cannot be chosen now (the limit is reached) */
  disabledReason?: string;
  /** our first pick */
  ourPick?: boolean;
  /** the credits of one page when the server sent them; else the shared price */
  creditsPerPage?: number | null;
  /** extra lines under the card (alternatives, a warning) */
  children?: ReactNode;
  className?: string;
}) {
  const chance = chanceWords(k.difficultyForYou);
  const plan = planWords(k.planType, k.months);
  const price = creditsPerPage != null && creditsPerPage > 0 ? `about ${creditsPerPage} credits a page` : `about ${PRICES.page()} a page`;
  const body = (
    <>
      <span className="flex items-start gap-3">
        <IconTile size="md" tone={selected ? 'solid' : 'blue'}>
          {selected ? <Check /> : <Search />}
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 break-words font-display text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">{k.keyword}</span>
            {ourPick && (
              <Badge tone="accent" icon={<Sparkles className="size-3" aria-hidden />}>
                Our first pick
              </Badge>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chance ? <Badge tone={CHANCE_TONE[k.difficultyForYou!]}>Your chances: {chance}</Badge> : <Badge>Chances not rated yet</Badge>}
          </span>
        </span>
      </span>
      <span className="mt-3 grid gap-1.5 text-[13px] leading-snug text-ink-2">
        <span className="flex items-start gap-2">
          <Users className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
          {searchesWords(k.volume)}
        </span>
        {plan && (
          <span className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
            {plan}
          </span>
        )}
        <span className="flex items-start gap-2">
          <Coins className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span>{price.charAt(0).toUpperCase() + price.slice(1)}</span>
        </span>
      </span>
      {k.why && <span className="mt-2.5 block text-[13px] leading-snug text-ink-3">Why we suggest it: {k.why}</span>}
      {k.note && <span className="mt-1 block text-[13px] leading-snug text-ink-3">{k.note}</span>}
    </>
  );
  const frame = cn(
    'flex h-full w-full min-w-0 flex-col rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,translate] duration-200 ease-brand',
    selected ? 'border-accent-text/80 bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-text)]' : 'border-line-strong bg-surface shadow-card',
    className,
  );
  if (!onToggle)
    return (
      <div className={frame}>
        {body}
        {children}
      </div>
    );
  return (
    <div className={cn('flex h-full min-w-0 flex-col gap-2', className)}>
      <button
        type="button"
        aria-pressed={!!selected}
        aria-label={`${selected ? 'Chosen' : 'Choose'}: ${k.keyword}`}
        disabled={disabled && !selected}
        title={disabled && !selected ? disabledReason : undefined}
        onClick={onToggle}
        className={cn(frame, 'enabled:hover:-translate-y-px enabled:hover:shadow-raised enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60', !selected && 'enabled:hover:border-ink-3/50')}
      >
        {body}
        <span className={cn('mt-auto pt-3 text-[13px] font-medium', selected ? 'text-accent-text' : 'text-ink-2')}>{selected ? 'Chosen. Click again to remove it' : disabled ? disabledReason : 'Choose this keyword'}</span>
      </button>
      {children}
    </div>
  );
}
