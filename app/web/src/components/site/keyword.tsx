// "Difficulty for your site" and the plan types (PIPELINE_FEATURE_SPEC.md §5.3-5.5) as chips: always an icon and a word. Used by the
// "New keyword ladder" flow, the keyword-strategy report and the ladder-plan report.
import type { ReactNode } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Mountain, Route, TrendingUp } from 'lucide-react';
import { DIFFICULTY_HINT, DIFFICULTY_LABEL, DIFFICULTY_WORD, PLAN_CHOICE_LABEL, type DifficultyForYou, type PlanChoice } from '@seo/shared';
import { Badge, type Tone } from '@/components/ui/badge';

export const DIFFICULTY_TONE: Record<DifficultyForYou, Tone> = { easy: 'good', reachable: 'accent', hard: 'warning', very_hard: 'serious', not_realistic: 'critical' };
const DIFFICULTY_ICON: Record<DifficultyForYou, ReactNode> = {
  easy: <CheckCircle2 className="size-3" aria-hidden />,
  reachable: <TrendingUp className="size-3" aria-hidden />,
  hard: <Mountain className="size-3" aria-hidden />,
  very_hard: <AlertTriangle className="size-3" aria-hidden />,
  not_realistic: <Ban className="size-3" aria-hidden />,
};

/** "Easy for your site" (compact: "Easy") with its icon; the hint explains it on hover. */
export function DifficultyBadge({ difficulty, compact, className }: { difficulty: DifficultyForYou | null | undefined; compact?: boolean; className?: string }) {
  if (!difficulty) return null;
  return (
    <span title={DIFFICULTY_HINT[difficulty]} className="inline-flex">
      <Badge tone={DIFFICULTY_TONE[difficulty]} icon={DIFFICULTY_ICON[difficulty]} className={className}>
        {compact ? DIFFICULTY_WORD[difficulty] : DIFFICULTY_LABEL[difficulty]}
      </Badge>
    </span>
  );
}

/** "Short ladder · 4–8 months" (never shown for "no ladder"). */
export function PlanBadge({ plan, months, stretch, className }: { plan: PlanChoice | null | undefined; months?: string; stretch?: boolean; className?: string }) {
  if (!plan || plan === 'none') return null;
  return (
    <Badge icon={<Route className="size-3" aria-hidden />} className={className}>
      {PLAN_CHOICE_LABEL[plan]}
      {stretch ? ' (stretch)' : ''}
      {months ? ` · ${months.replace('-', '–')} months` : ''}
    </Badge>
  );
}
