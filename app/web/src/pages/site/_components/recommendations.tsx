// Recommendation cards: one component for the Overview (top 5) and the Recommendations page (all).
import type { ReactNode } from 'react';
import { Activity, ArrowRight, Bot, ExternalLink as ExternalIcon, Gauge, Link2, PenSquare, Settings, TrendingUp } from 'lucide-react';
import { MODES, type Priority, type Recommendation, type RecommendationAction, type RecommendationCategory } from '@seo/shared';
import { cn } from '@/lib/utils';
import { buttonClass, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PriorityBadge, useSitePage } from './kit';

export const CATEGORY_META: Record<RecommendationCategory, { label: string; icon: ReactNode }> = {
  search: { label: 'Search & traffic', icon: <TrendingUp className="size-4" /> },
  rankings: { label: 'Rankings', icon: <Activity className="size-4" /> },
  content: { label: 'Content', icon: <PenSquare className="size-4" /> },
  technical: { label: 'Technical health', icon: <Gauge className="size-4" /> },
  ai: { label: 'AI visibility', icon: <Bot className="size-4" /> },
  backlinks: { label: 'Backlinks', icon: <Link2 className="size-4" /> },
  setup: { label: 'Setup', icon: <Settings className="size-4" /> },
};
export const CATEGORY_ORDER: RecommendationCategory[] = ['setup', 'search', 'rankings', 'content', 'technical', 'ai', 'backlinks'];
export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];
const PRIO_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function sortRecommendations(recs: readonly Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => (PRIO_RANK[a.priority] ?? 3) - (PRIO_RANK[b.priority] ?? 3) || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

/** The button that carries a recommendation out: a pre-filled tool, a page of the site, or an external link. */
export function RecommendationButton({ action, size = 'sm', variant = 'secondary' }: { action: RecommendationAction; size?: 'sm' | 'md'; variant?: 'primary' | 'secondary' }) {
  const { can, tool, page } = useSitePage();
  if (action.mode) {
    if (!can('member')) return null;
    return (
      <ButtonLink to={tool(action.mode, action.prefill)} size={size} variant={variant} title={MODES[action.mode]?.summary}>
        {action.label}
        <ArrowRight className="size-3.5" aria-hidden />
      </ButtonLink>
    );
  }
  if (action.page) {
    return (
      <ButtonLink to={page(action.page.replace(/^\/+/, ''))} size={size} variant={variant}>
        {action.label}
        <ArrowRight className="size-3.5" aria-hidden />
      </ButtonLink>
    );
  }
  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size)}>
        {action.label}
        <ExternalIcon className="size-3.5" aria-hidden />
      </a>
    );
  }
  return null;
}

function CategoryIcon({ category, className }: { category: RecommendationCategory; className?: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.setup;
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2', className)} aria-hidden>
      {meta.icon}
    </span>
  );
}

/** Full card (Recommendations page). */
export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.setup;
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <CategoryIcon category={rec.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={rec.priority} />
            <span className="text-xs text-ink-3">{meta.label}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{rec.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{rec.detail}</p>
          {rec.evidence && <p className="mt-2 rounded-md bg-surface-2 px-2 py-1 text-xs leading-snug text-ink-2 tabular">{rec.evidence}</p>}
        </div>
      </div>
      {rec.action && (
        <div className="mt-auto flex justify-end pt-3">
          <RecommendationButton action={rec.action} />
        </div>
      )}
    </Card>
  );
}

/** Compact rows inside a narrow card (Overview): text first, the action underneath. */
export function RecommendationRows({ recs }: { recs: readonly Recommendation[] }) {
  return (
    <ul className="divide-y divide-line">
      {recs.map((rec) => (
        <li key={rec.id} className="flex items-start gap-3 px-5 py-3">
          <CategoryIcon category={rec.category} className="size-7" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <PriorityBadge priority={rec.priority} short />
              <span className="text-xs text-ink-3">{(CATEGORY_META[rec.category] ?? CATEGORY_META.setup).label}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink">{rec.title}</p>
            {rec.evidence ? <p className="mt-0.5 truncate text-xs text-ink-3 tabular">{rec.evidence}</p> : <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{rec.detail}</p>}
            {rec.action && (
              <div className="mt-2">
                <RecommendationButton action={rec.action} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
