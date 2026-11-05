// AI ranking (AIR, 2026-11-06, n8n/seo-agent/docs/ai-ranking-2026-11-05/DESIGN.md §2.H, §6.7): the weekly plan of a website in `on` mode on
// the AI visibility page (the memo in seven parts, every figure with its basis; the chosen actions with who does them and their state; the
// blockers with their owner and date), and the platform admin's private trial view (AI ranking's choices beside the current plan's).
// Nothing here renders for a website that is off or in its trial (the page then looks exactly as before), and every field may be missing.
import { useState } from 'react';
import { ChevronDown, Compass, FlaskConical } from 'lucide-react';
import { AI_RANK_EXECUTOR_TEXT, aiRankStatusText, type AiRankActionView, type AiRankMemo, type AiRankPlanData, type AiRankShadowWeek } from '@seo/shared';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { GuideButton } from '@/components/guide';
import { useAiRankShadow } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { Panel, SectionHeading } from './kit';
import { engineLabel } from './ai';
import { urlPath } from './format';

const STATUS_TONE: Record<string, Tone> = { done: 'good', verified: 'good', queued: 'accent', in_progress: 'accent', proposed: 'neutral', not_happened: 'neutral', expired: 'neutral', refused: 'neutral', shadow: 'neutral' };

/** The memo's seven parts. A part with no line is left out; a figure shows its value and where it came from. */
export function AiRankMemoView({ memo }: { memo: AiRankMemo }) {
  const parts = memo.parts.filter((p) => p.lines.length && p.key !== 'shadow_vs_old');
  return (
    <div className="space-y-4">
      {parts.map((p) => (
        <div key={p.key || p.title}>
          <h3 className="text-[13px] font-semibold text-ink">{p.title}</h3>
          <ul className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
            {p.lines.map((l, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                {l.text}
                {l.figures.length > 0 && (
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {l.figures.map((f, j) => (
                      <span key={j} className="mr-3 inline-block">
                        <span className="tabular font-medium text-ink-2">{f.value}</span>
                        {f.basis ? ` (${f.basis})` : ''}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {memo.blockers.length > 0 && (
        <Callout tone="warning" title="Waiting on someone">
          <ul className="space-y-1">
            {memo.blockers.map((b, i) => (
              <li key={i}>
                <span className="font-medium">{b.what}</span>
                {b.blocks ? `: ${b.blocks}` : ''}
                <span className="block text-xs text-ink-3">
                  {b.owner === 'us' ? 'On us' : 'On you'}
                  {b.since ? ` · asked ${fmtDate(b.since)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}

export function AiRankActionList({ actions }: { actions: AiRankActionView[] }) {
  if (!actions.length) return <p className="text-[13px] text-ink-3">No step chosen this week.</p>;
  // the engine's stored rows name questions by id; only question texts (the callback's) are shown
  const texts = (qs: string[]) => qs.filter((q) => /\s/.test(q));
  return (
    <ul className="divide-y divide-line text-[13px]">
      {actions.map((a, i) => (
        <li key={a.actionId || i} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
          <span className="min-w-0">
            <span className="font-medium text-ink [overflow-wrap:anywhere]">{a.label}</span>
            {a.url && <span className="block text-xs text-ink-3 [overflow-wrap:anywhere]">{urlPath(a.url)}</span>}
            {texts(a.questions).length > 0 && <span className="block text-ink-2 [overflow-wrap:anywhere]">For: {texts(a.questions).slice(0, 2).join('; ')}{texts(a.questions).length > 2 ? ` and ${texts(a.questions).length - 2} more` : ''}</span>}
            {a.engines.length > 0 && <span className="block text-xs text-ink-3">{a.engines.map((e) => engineLabel(e)).join(', ')}</span>}
            {a.why && <span className="block text-xs text-ink-3 [overflow-wrap:anywhere]">{a.why}</span>}
          </span>
          <span className="flex shrink-0 flex-wrap gap-1.5">
            <Badge>{AI_RANK_EXECUTOR_TEXT[a.executor]}</Badge>
            {a.status && <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{aiRankStatusText(a.status)}</Badge>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The AI visibility page's AI ranking plan: rendered only for a website in `on` mode with a run on record. */
export function AiRankSection({ plan, domain }: { plan: AiRankPlanData | null | undefined; domain: string }) {
  if (!plan) return null;
  const costLine = plan.memo?.parts.find((p) => p.key === 'cost_per_win');
  return (
    <section className="space-y-4">
      <SectionHeading
        icon={<Compass />}
        title="AI ranking plan"
        description={`This week's steps to get you named in AI answers, and what changed · ${fmtAgo(plan.checkedAt)}`}
        info="Each week the plan picks the few steps most likely to get you named, from what the answers cite and what we can see of your pages. Every result says how it was measured; nothing is called a cause unless a comparison with questions we left alone supports it."
        actions={<GuideButton id="ai-ranking" vars={{ domain }} variant="link" label="How it works" />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="This week's steps" description="Who does each one, and where it stands">
          <AiRankActionList actions={plan.actions} />
        </Panel>
        <Panel title="What changed and why" description={plan.memo ? 'Our weekly note, with the figures behind it' : 'The note appears after the next weekly run'}>
          {plan.memo ? <AiRankMemoView memo={plan.memo} /> : <p className="text-[13px] text-ink-3">No note yet.</p>}
        </Panel>
      </div>
      {!costLine && plan.cost && <p className="text-xs text-ink-3">AI ranking readings this week: {plan.cost.basis || 'measured'}.</p>}
    </section>
  );
}

/** The platform admin's view of the private trial: AI ranking's plan beside the current one, week by week (never shown to clients). */
export function AiRankShadowPanel({ orgId, siteId }: { orgId: string; siteId: string }) {
  const [open, setOpen] = useState(false);
  const q = useAiRankShadow(orgId, siteId, open);
  const weeks = q.data?.weeks ?? [];
  return (
    <Panel
      title="AI ranking trial (platform admins only)"
      icon={<FlaskConical />}
      description="AI ranking's weekly plan beside the current plan, for checking it before it acts. Clients never see this."
      actions={
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'} <ChevronDown className={open ? 'rotate-180' : ''} />
        </Button>
      }
    >
      {!open ? null : q.isLoading ? (
        <p className="text-[13px] text-ink-3">Loading</p>
      ) : q.isError ? (
        <p className="text-[13px] text-ink-3">The trial could not be read.</p>
      ) : !weeks.length ? (
        <p className="text-[13px] text-ink-3">No AI ranking run on record for this website ({q.data?.settings.mode ?? 'off'}).</p>
      ) : (
        <div className="space-y-5">
          {weeks.map((w) => (
            <ShadowWeek key={w.runId || w.checkedAt} w={w} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ShadowWeek({ w }: { w: AiRankShadowWeek }) {
  const shadowPart = w.memo?.parts.find((p) => p.key === 'shadow_vs_old');
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-[13px] font-semibold text-ink">
        {fmtDate(w.checkedAt)} <Badge className="ml-1">{w.mode === 'shadow' ? 'Trial' : w.mode === 'on' ? 'On' : w.mode}</Badge>
      </p>
      {w.error && <p className="mt-1 text-xs text-ink-3">{w.error}</p>}
      {w.compare && (
        <p className="mt-1 text-xs text-ink-3">
          Overlap {w.compare.overlap != null ? `${Math.round(w.compare.overlap * 100)}%` : 'not computed'}
          {w.compare.gainAir != null && w.compare.gainOld != null ? ` · expected gain, AI ranking's own model: ${w.compare.gainAir.toFixed(3)} against ${w.compare.gainOld.toFixed(3)} for the current plan` : ''}
          {w.compare.note ? ` · ${w.compare.note}` : ''}
        </p>
      )}
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-ink-2">AI ranking chose</p>
          <AiRankActionList actions={w.air} />
        </div>
        <div>
          <p className="text-xs font-medium text-ink-2">The current plan chose</p>
          <ul className="space-y-1 text-[13px] text-ink-2">
            {w.old.targets.map((t, i) => (
              <li key={`t${i}`} className="[overflow-wrap:anywhere]">
                {t.kind === 'refresh' ? 'Refresh' : 'Answer page'}: {t.question}
              </li>
            ))}
            {w.old.earned.map((e, i) => (
              <li key={`e${i}`} className="[overflow-wrap:anywhere]">
                Earned media: {e}
              </li>
            ))}
            {w.old.actions.map((a, i) => (
              <li key={`a${i}`} className="[overflow-wrap:anywhere]">
                {a}
              </li>
            ))}
            {!w.old.targets.length && !w.old.earned.length && !w.old.actions.length && <li className="text-ink-3">Nothing recorded.</li>}
          </ul>
        </div>
      </div>
      {shadowPart && shadowPart.lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-ink-3">
          {shadowPart.lines.map((l, i) => (
            <li key={i}>{l.text}</li>
          ))}
        </ul>
      )}
      {w.memo && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-ink-2">The week's note</summary>
          <div className="mt-2">
            <AiRankMemoView memo={w.memo} />
          </div>
        </details>
      )}
    </div>
  );
}
