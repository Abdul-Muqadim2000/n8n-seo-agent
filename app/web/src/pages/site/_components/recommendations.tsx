// Recommendations: the category of each, the order, the button that carries one out, and the list row (InsightItem) used on the
// Recommendations page; the Overview builds its top-5 rows from the same parts.
import { SiteTaskCheckButton } from '@/components/site/SiteTasks';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Activity, ArrowRight, Bot, CheckCircle2, ExternalLink as ExternalIcon, Gauge, Link2, PenSquare, RotateCcw, Settings, TrendingUp, XCircle } from 'lucide-react';
import { DISMISS_REASONS, MODES, queueOrder, scoreNote, type Priority, type Recommendation, type RecommendationAction, type RecommendationCategory, type RecommendationState } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Dialog, DialogClose } from '@/components/ui/overlay';
import { toastError } from '@/lib/api';
import { useRecommendationAction } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { guideForRecommendation } from '@seo/shared/guides';
import { autopilotGuideVars } from '@/lib/guide-vars';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { buttonClass, ButtonLink } from '@/components/ui/button';
import { InfoTip, InsightItem } from '@/components/insight';
import { GuideButton } from '@/components/guide';
import { TicketButton } from '@/components/site/TicketButton';
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
 * REP 3.3 (benchmark pass 2026-10-14): the one queue's order is `queueOrder` in `@seo/shared`, blocking setup first, then by
 * impact x confidence / effort, then the items nothing has measured yet. The server already returns them in that order; this
 * keeps a client-side list (a filtered view, an older cached payload) in the same one. Rows with no score at all, written
 * before the queue existed, fall back to the old priority-then-category order among themselves.
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
  const { org, can, tool, page } = useSitePage();
  // E-QA (2026-10-21): a not-ready draft's report, where each bracket to edit by hand is listed
  if (action.report) {
    return (
      <ButtonLink to={paths.report(org.id, action.report)} size={size} variant={variant} className="group/rec">
        {action.label}
        <ArrowRight className={NUDGE} aria-hidden />
      </ButtonLink>
    );
  }
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
export function RecommendationItem({ rec, siteId }: { rec: Recommendation; siteId?: string }) {
  const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.setup;
  // CR17-H: the family's guide (the registry) first, then the older id map
  const guide = rec.rule?.guide || guideForRecommendation(rec.id);
  const open = !rec.state || rec.state === 'open' || rec.state === 'in_progress' || rec.state === 'failed';
  return (
    <InsightItem
      icon={meta.icon}
      meta={
        <>
          <PriorityBadge priority={rec.priority} />
          <span className="text-xs text-ink-3">{meta.label}</span>
          <RecStateChip rec={rec} />
          <WorthChip rec={rec} />
        </>
      }
      title={<span className="text-[15px] leading-snug">{rec.title}</span>}
      description={
        <span className="flex flex-col gap-1">
          {rec.evidence ? <span className="tabular [overflow-wrap:anywhere]">{rec.evidence}</span> : <span className="text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{rec.detail}</span>}
          <RecStateLine rec={rec} />
        </span>
      }
      detail={<RecRuleBlock rec={rec} />}
      detailLabel="Why, how, and how we check it"
      action={
        <div className="flex flex-col items-stretch gap-1.5">
          {/* site tasks: a step on the website is checked here as on the Pipeline */}
          {open && rec.taskKey && <SiteTaskCheckButton taskKey={rec.taskKey} />}
          {open && rec.action && <RecommendationButton action={rec.action} />}
          {open && !rec.taskKey && rec.rule?.canCheckNow && rec.state && <RecCheckButton rec={rec} />}
          {open && guide && <GuideHelp id={guide} extra={rec.guideVars} />}
          {/* G4: the work item in the company's tracker (only once one is connected; setup items are ours to finish, not a ticket) */}
          {open && siteId && rec.category !== 'setup' && <TicketButton siteId={siteId} source={{ type: 'recommendation', id: rec.id }} />}
          {rec.state && (rec.state === 'dismissed' ? <RecRestoreButton rec={rec} /> : open || rec.state === 'waiting_for_google' ? <RecDismissButton rec={rec} /> : null)}
        </div>
      }
      actionPosition="side"
    />
  );
}

// ---- CR17-H (client report 2026-11-17, Q4): where an item stands, why, how to do it, how we check it, and the client's buttons ----

const STATE_META: Record<RecommendationState, { label: string; tone: 'good' | 'warning' | 'accent' | 'neutral' | 'serious' }> = {
  open: { label: 'To do', tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'accent' },
  failed: { label: 'Still there', tone: 'warning' },
  waiting_for_google: { label: 'Waiting for Google', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'good' },
  expired: { label: 'No longer reported', tone: 'neutral' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

/** The state as a chip (absent on an older server: nothing). */
function RecStateChip({ rec }: { rec: Recommendation }) {
  if (!rec.state || rec.state === 'open') return null;
  const m = STATE_META[rec.state];
  return m.tone === 'neutral' ? <Badge>{m.label}</Badge> : <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
}

/** One line: since when, and the evidence that set the state ("Resolved on 20 Nov: /about is in Google since 18 Nov"). */
export function RecStateLine({ rec }: { rec: Recommendation }) {
  if (!rec.state) return null;
  const on = (iso?: string) => (iso ? fmtDate(iso) : '');
  const line =
    rec.state === 'resolved'
      ? `Resolved on ${on(rec.stateAt)}${rec.stateEvidence ? `: ${rec.stateEvidence}` : ''}`
      : rec.state === 'waiting_for_google'
        ? `Waiting for Google since ${on(rec.stateAt)}${rec.stateEvidence ? `: ${rec.stateEvidence}` : ''}`
        : rec.state === 'dismissed'
          ? `Dismissed on ${on(rec.stateAt)}: ${rec.dismissed?.reason ?? ''}${rec.dismissed?.note ? `. ${rec.dismissed.note}` : ''}`
          : rec.state === 'expired'
            ? `No longer reported since ${on(rec.stateAt)}, and no check of ours confirmed it fixed.`
            : `Recommended since ${on(rec.firstSeenAt)}${rec.stateEvidence ? `. ${rec.stateEvidence}` : ''}`;
  return <span className="text-xs text-ink-3 [overflow-wrap:anywhere]">{line}</span>;
}

/** Why it matters, how to do it, how we check it, who else reported it. */
function RecRuleBlock({ rec }: { rec: Recommendation }) {
  const r = rec.rule;
  return (
    <span className="flex flex-col gap-1.5 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
      {rec.evidence && rec.detail ? <span>{rec.detail}</span> : null}
      {r && (
        <>
          <span>
            <b className="font-medium text-ink">Why: </b>
            {r.why}
          </span>
          <span>
            <b className="font-medium text-ink">How to do it: </b>
            {r.how}
          </span>
          <span>
            <b className="font-medium text-ink">How we check it: </b>
            {r.check ? `${r.check} (${r.checkWhen}).` : 'Nothing checks this one, so it is never marked resolved: dismiss it once it no longer applies.'}
          </span>
        </>
      )}
      {rec.alsoFrom?.length ? <span className="text-ink-3">Also reported by {rec.alsoFrom.join(', ')}.</span> : null}
    </span>
  );
}

function RecCheckButton({ rec }: { rec: Recommendation }) {
  const { org, site, can } = useSitePage();
  const act = useRecommendationAction(org.id, site.id);
  if (!can('member')) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={act.isPending}
      icon={<CheckCircle2 className="size-4" />}
      onClick={() =>
        act.mutate(
          { key: rec.id, action: 'check' },
          {
            onSuccess: ({ rec: r }) => (r.state === 'resolved' ? toast.success(`Resolved: ${r.title}`) : toast.message(r.stateEvidence || 'Checked: nothing has changed yet.')),
            onError: (e) => toastError(e),
          },
        )
      }
    >
      Check now
    </Button>
  );
}

function RecRestoreButton({ rec }: { rec: Recommendation }) {
  const { org, site, can } = useSitePage();
  const act = useRecommendationAction(org.id, site.id);
  if (!can('member')) return null;
  return (
    <Button size="sm" variant="ghost" loading={act.isPending} icon={<RotateCcw className="size-4" />} onClick={() => act.mutate({ key: rec.id, action: 'restore' }, { onSuccess: () => toast.success('Back on your to-do list'), onError: (e) => toastError(e) })}>
      Bring it back
    </Button>
  );
}

/** "Not relevant": dismiss with a reason (and a line for another reason). A step on the website is skipped with it. */
function RecDismissButton({ rec }: { rec: Recommendation }) {
  const { org, site, can } = useSitePage();
  const act = useRecommendationAction(org.id, site.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(DISMISS_REASONS[0].id);
  const [note, setNote] = useState('');
  if (!can('member')) return null;
  return (
    <>
      <Button size="sm" variant="ghost" icon={<XCircle className="size-4" />} onClick={() => setOpen(true)}>
        Not relevant
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Dismiss this recommendation?"
        description="It moves to the Dismissed tab and stops counting as a step to do. You can bring it back at any time; if it is still reported in 90 days it comes back by itself."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              loading={act.isPending}
              disabled={reason === 'other' && !note.trim()}
              onClick={() =>
                act.mutate(
                  { key: rec.id, action: 'dismiss', reason, note: note.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Dismissed. It is on the Dismissed tab.');
                      setOpen(false);
                    },
                    onError: (e) => toastError(e),
                  },
                )
              }
            >
              Dismiss
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-2">{rec.title}</p>
          <Field label="Why does it not apply?">
            {(p) => (
              <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                {DISMISS_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={reason === 'other' ? 'In a few words' : 'A note for your team'} optional={reason !== 'other'}>
            {(p) => <Textarea {...p} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** Compact rows inside a narrow card (Overview): text first, the action underneath. */
export function RecommendationRows({ recs }: { recs: readonly Recommendation[] }) {
  return (
    <ul className="divide-y divide-line">
      {recs.map((rec) => {
        const guide = guideForRecommendation(rec.id);
        return (
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
            {(rec.action || guide || rec.taskKey) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {rec.taskKey && <SiteTaskCheckButton taskKey={rec.taskKey} label="Done? Check now" />}
                {rec.action && <RecommendationButton action={rec.action} />}
                {guide && <GuideHelp id={guide} extra={rec.guideVars} />}
              </div>
            )}
          </div>
        </li>
        );
      })}
    </ul>
  );
}

/** "Show me how" on a recommendation that asks the person to do something outside the app (the site's own values are filled in). */
function GuideHelp({ id, extra }: { id: string; extra?: Record<string, string> }) {
  const { site } = useSitePage();
  // B3: the recommendation's own values (the IndexNow key, file and address) over the guide's examples
  return <GuideButton id={id} vars={{ ...autopilotGuideVars(site), ...(extra ?? {}) }} className="justify-center" />;
}
