// Recommendations: the category of each, the order, the button that carries one out, and the list row (InsightItem) used on the
// Recommendations page; the Overview builds its top-5 rows from the same parts.
import type { ReactNode } from 'react';
import { Activity, ArrowRight, Bot, ExternalLink as ExternalIcon, Gauge, Link2, PenSquare, Settings, TrendingUp } from 'lucide-react';
import { MODES, queueOrder, scoreNote, type Priority, type Recommendation, type RecommendationAction, type RecommendationCategory } from '@seo/shared';
import { GUIDE_FOR_RECOMMENDATION } from '@seo/shared/guides';
import { cn } from '@/lib/utils';
import { buttonClass, ButtonLink } from '@/components/ui/button';
import { InfoTip, InsightItem } from '@/components/insight';
import { GuideButton } from '@/components/guide';
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

/**
 * REP 3.3 (benchmark pass 2026-10-14): the one queue's order is `queueOrder` in `@seo/shared` — blocking setup first, then by
 * impact x confidence / effort, then the items nothing has measured yet. The server already returns them in that order; this
 * keeps a client-side list (a filtered view, an older cached payload) in the same one. Rows with no score at all — written
 * before the queue existed — fall back to the old priority-then-category order among themselves.
 */
export function sortRecommendations(recs: readonly Recommendation[]): Recommendation[] {
  if (!recs.some((r) => r.score)) return [...recs].sort((a, b) => (PRIO_RANK[a.priority] ?? 3) - (PRIO_RANK[b.priority] ?? 3) || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  return queueOrder(recs);
}

/**
 * What this item is worth and why it sits where it does. A ranked item shows the number the queue sorted by; an unranked one says
 * so in words rather than borrowing a number it does not have.
 */
export function WorthChip({ rec, className }: { rec: Recommendation; className?: string }) {
  const s = rec.score;
  if (!s) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-ink-3', className)}>
      {s.ranked ? (
        <>
          <span className="font-mono tabular">Worth {s.value}</span>
          <span aria-hidden>·</span>
          <span>{s.effortLabel}</span>
        </>
      ) : (
        <span>Not ranked · {s.effortLabel}</span>
      )}
      <InfoTip label="How this is ranked">{scoreNote(s)}</InfoTip>
    </span>
  );
}

const NUDGE = 'size-3.5 transition-transform duration-200 ease-brand group-hover/rec:translate-x-0.5';

/** The button that carries a recommendation out: a pre-filled tool, a page of the site, or an external link. */
export function RecommendationButton({ action, size = 'sm', variant = 'secondary' }: { action: RecommendationAction; size?: 'sm' | 'md'; variant?: 'primary' | 'secondary' }) {
  const { can, tool, page } = useSitePage();
  if (action.mode) {
    if (!can('member')) return null;
    return (
      <ButtonLink to={tool(action.mode, action.prefill)} size={size} variant={variant} title={MODES[action.mode]?.summary} className="group/rec">
        {action.label}
        <ArrowRight className={NUDGE} aria-hidden />
      </ButtonLink>
    );
  }
  if (action.page) {
    return (
      <ButtonLink to={page(action.page.replace(/^\/+/, ''))} size={size} variant={variant} className="group/rec">
        {action.label}
        <ArrowRight className={NUDGE} aria-hidden />
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

/**
 * One recommendation as a to-do row (Recommendations page): the category's icon tile, priority and area chips, the title, the
 * evidence (or the explanation when there is none) and, behind "Why it matters", the explanation; the action on the side.
 */
export function RecommendationItem({ rec }: { rec: Recommendation }) {
  const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.setup;
  const guide = GUIDE_FOR_RECOMMENDATION[rec.id];
  return (
    <InsightItem
      icon={meta.icon}
      meta={
        <>
          <PriorityBadge priority={rec.priority} />
          <span className="text-xs text-ink-3">{meta.label}</span>
          <WorthChip rec={rec} />
        </>
      }
      title={<span className="text-[15px] leading-snug">{rec.title}</span>}
      description={rec.evidence ? <span className="tabular [overflow-wrap:anywhere]">{rec.evidence}</span> : <span className="text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{rec.detail}</span>}
      detail={rec.evidence ? <span className="text-[13px] leading-relaxed [overflow-wrap:anywhere]">{rec.detail}</span> : undefined}
      detailLabel="Why it matters"
      action={
        rec.action || guide ? (
          <div className="flex flex-col items-stretch gap-1.5">
            {rec.action && <RecommendationButton action={rec.action} />}
            {guide && <GuideHelp id={guide} />}
          </div>
        ) : undefined
      }
      actionPosition="side"
    />
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
              <WorthChip rec={rec} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink">{rec.title}</p>
            {rec.evidence ? <p className="mt-0.5 truncate text-xs text-ink-3 tabular">{rec.evidence}</p> : <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{rec.detail}</p>}
            {(rec.action || GUIDE_FOR_RECOMMENDATION[rec.id]) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {rec.action && <RecommendationButton action={rec.action} />}
                {GUIDE_FOR_RECOMMENDATION[rec.id] && <GuideHelp id={GUIDE_FOR_RECOMMENDATION[rec.id]} />}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Show me how" on a recommendation that asks the person to do something outside the app (the site's own values are filled in). */
function GuideHelp({ id }: { id: string }) {
  const { site } = useSitePage();
  return <GuideButton id={id} vars={{ domain: site.domain }} className="justify-center" />;
}
