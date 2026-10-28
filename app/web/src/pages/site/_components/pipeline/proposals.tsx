// Keyword proposals (SCHEDULING_KEYWORDS_PLAN.md §5.6, §5.7): when the website has room for a new keyword, the next one from the research.
// Levels 1 and 2: a suggestion that waits ("Start this ladder", "Show me others", "Not now"). Level 3: an announcement that starts two
// days later unless the owner approves it now, picks a different one (checked first) or skips it.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AlertTriangle, Check, Clock, ListOrdered, Megaphone, Repeat, Search, SkipForward } from 'lucide-react';
import { asDifficulty, asPlanChoice, type KeywordCheck, type KeywordProposalView } from '@seo/shared';
import { KeywordChoiceCard } from '@/components/site/KeywordChoiceCard';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { ApiRequestError, DONE_INSTEAD, errorMessage, toastError } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { PRICES } from '@/lib/prices';
import { useKeywordProposals, useProposalAction, useRecommendedKeywords } from '@/lib/queries';
import { Panel } from '../kit';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';
import { autopilotGuideVars } from '@/lib/guide-vars';

/** "Thursday 23 October, 06:00" in the viewer's zone. */
const fmtStart = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** "in 2 days", "in 5 hours", "any minute now" */
export function countdown(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms) || ms <= 5 * 60_000) return 'any minute now';
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} minutes`;
  if (h < 36) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

export function KeywordProposals() {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const q = useKeywordProposals(org.id, site.id, !!site.verifiedAt);
  const pending = q.data?.pending ?? [];
  if (!site.verifiedAt || !pending.length) return null;
  const announced = pending.some((p) => p.startAt);
  return (
    <section id="keyword-proposals" aria-label="Keyword proposals" className="min-w-0 scroll-mt-20">
      <Panel
        icon={<Megaphone />}
        iconTone={announced ? 'warning' : 'blue'}
        title={announced ? 'Your next keyword starts soon' : pending.length === 1 ? 'A keyword we suggest' : 'Keywords we suggest'}
        description={
          announced
            ? 'You chose full autopilot, so we picked the next keyword from your research. It starts on its own unless you change it.'
            : 'You have room for another keyword. Start it, pick a different one, or skip it: nothing starts without your OK.'
        }
        actions={
          <>
            <GuideButton
              id={announced ? AUTOPILOT_SCREEN_GUIDES.proposals : AUTOPILOT_SCREEN_GUIDES.newLadder}
              vars={autopilotGuideVars(site, { level: q.data?.level })}
              label={announced ? 'What happens if I do nothing' : 'How to choose'}
            />
            {/* prod report 2026-10-23 (devaicon): once a proposal exists the Needs-you "Choose a keyword" link is gone, so the full chooser needs its own way in */}
            {can('member') && (
              <ButtonLink to={paths.newLadder(org.id, site.id, { tab: 'recommended' })} variant="secondary" size="sm" icon={<ListOrdered className="size-4" />}>
                See all suggestions
              </ButtonLink>
            )}
          </>
        }
      >
        <ul className="space-y-4">
          {pending.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </ul>
      </Panel>
    </section>
  );
}

/**
 * MKT D1 (2026-10-27): what the person reads when a start did not happen. Cancel in the "Check this first" dialog is the safe choice, not
 * an error; an Accept that added the keyword to an existing ladder is a success; anything else is the server's own reason.
 */
export function notStarted(e: unknown): void {
  if (e instanceof ApiRequestError && e.code === DONE_INSTEAD) toast.success(e.message);
  else if (e instanceof ApiRequestError && e.code === 'confirm_needed') toast.info('Nothing was started', { description: 'The keyword still waits here for your decision.' });
  else toast.error('It did not start', { description: errorMessage(e) });
}

function ProposalCard({ p }: { p: KeywordProposalView }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const navigate = useNavigate();
  const act = useProposalAction(org.id, site.id);
  const [swapOpen, setSwapOpen] = useState(false);
  const announced = !!p.startAt;
  const busy = act.isPending ? act.variables?.action : null;
  const approve = () =>
    act.mutate(
      { id: p.id, action: 'approve' },
      {
        onSuccess: (r) => {
          toast.success(`Planning your keyword "${p.keyword}"`, { description: 'Its plan shows here in about 5 to 10 minutes; the first page follows.' });
          if (r.runId) navigate(paths.run(org.id, r.runId));
        },
        onError: (e) => notStarted(e),
      },
    );
  const skip = () =>
    act.mutate(
      { id: p.id, action: 'skip' },
      {
        onSuccess: (r) =>
          toast.success(`We will not suggest "${p.keyword}" again`, { description: r.next ? `Next suggestion: "${r.next.keyword}".` : 'We tell you when we have another one.' }),
        onError: (e) => toastError(e, 'The change was not saved'),
      },
    );
  return (
    <li className="min-w-0">
      <KeywordChoiceCard
        k={{ keyword: p.keyword, volume: p.searches, difficultyForYou: asDifficulty(p.difficulty), planType: asPlanChoice(p.planType), months: p.months, why: p.why }}
        creditsPerPage={p.creditsPerPage}
      >
        {announced && p.startAt && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-[13px] leading-snug text-warning-text">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Starts on <span className="font-semibold">{fmtStart(p.startAt)}</span> ({countdown(p.startAt)}) unless you change it.
            </span>
          </p>
        )}
        {/* MKT D1: what starting it means, before the click (the server asks again with the full quote and the overlap) */}
        {can('member') && (
          <p className="mt-3 text-[13px] leading-snug text-ink-2">
            Starting it adds a new keyword ladder: we plan it and write its first page now{p.startCredits ? `, about ${p.startCredits} credits` : ''}. We ask you to confirm before anything starts.
          </p>
        )}
        {p.note && <p className="mt-2 text-xs text-ink-3">{p.note}</p>}
        {can('member') ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" icon={<Check className="size-4" />} loading={busy === 'approve'} disabled={!!busy && busy !== 'approve'} onClick={approve}>
              {announced ? 'Approve now' : 'Start this ladder'}
            </Button>
            <Button size="sm" variant="secondary" icon={<Repeat className="size-4" />} disabled={!!busy} onClick={() => setSwapOpen(true)}>
              {announced ? 'Pick a different one' : 'Show me others'}
            </Button>
            <Button size="sm" variant="ghost" icon={<SkipForward className="size-4" />} loading={busy === 'skip'} disabled={!!busy && busy !== 'skip'} onClick={skip}>
              {announced ? 'Skip' : 'Not now'}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-ink-3">A member of your company can approve, change or skip it.</p>
        )}
      </KeywordChoiceCard>
      {swapOpen && <SwapDialog p={p} onClose={() => setSwapOpen(false)} />}
    </li>
  );
}

/** "Pick a different one": one of the other suggestions, or a typed keyword, checked before it starts. */
function SwapDialog({ p, onClose }: { p: KeywordProposalView; onClose: () => void }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const navigate = useNavigate();
  const act = useProposalAction(org.id, site.id);
  const rec = useRecommendedKeywords(org.id, site.id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<KeywordCheck | null>(null);
  const all = rec.data?.keywords ?? [];
  const others = all
    .filter((k) => k.keyword.toLowerCase() !== p.keyword.toLowerCase() && (k.difficultyForYou === 'easy' || k.difficultyForYou === 'reachable') && !k.overlaps.length)
    .slice(0, 5);
  const swap = (keyword: string) => {
    setError(null);
    setCheck(null);
    act.mutate(
      { id: p.id, action: 'swap', keyword },
      {
        onSuccess: (r) => {
          toast.success(`Planning your keyword "${keyword}"`, { description: 'Its plan shows on the Pipeline in about 5 to 10 minutes.' });
          onClose();
          if (r.runId) navigate(paths.run(org.id, r.runId));
        },
        onError: (e) => {
          if (e instanceof ApiRequestError && e.code === 'keyword_not_suitable') {
            setError(e.message);
            setCheck((e.data.check as KeywordCheck | undefined) ?? null);
          } else if (e instanceof ApiRequestError && (e.code === DONE_INSTEAD || e.code === 'confirm_needed')) {
            notStarted(e);
            if (e.code === DONE_INSTEAD) onClose();
          } else setError(errorMessage(e));
        },
      },
    );
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const k = text.trim().replace(/\s+/g, ' ');
    if (k.length < 2 || k.length > 100) return setError('Use 2 to 100 characters');
    swap(k);
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Instead of "${p.keyword}"`}
      description={`Pick another suggestion or type your own. A typed keyword is checked first (5 to 20 seconds, about ${PRICES.check()}) and starts only if it fits your website.`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="space-y-5">
        {others.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Other suggestions</p>
            <ul className="flex flex-wrap gap-2">
              {others.map((k) => (
                <li key={k.keyword}>
                  <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => swap(k.keyword)}>
                    {k.keyword}
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Only the easiest ones that no ladder covers yet are listed here.</p>
          </div>
        )}
        {all.length > others.length && (
          <ButtonLink to={paths.newLadder(org.id, site.id, { tab: 'recommended' })} variant="ghost" size="sm" icon={<ListOrdered className="size-4" />}>
            See all {all.length} suggestions with their chances and plans
          </ButtonLink>
        )}
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Field className="min-w-0 flex-1" label="Your own keyword" error={error && !check ? error : undefined}>
            {(f) => <Input {...f} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="For example: payroll software for small business" />}
          </Field>
          <Button type="submit" loading={act.isPending} icon={<Search className="size-4" />} className="sm:mt-6">
            Check and start
          </Button>
        </form>
        {act.isPending && <p className="text-[13px] text-ink-3" role="status">Checking your keyword. This takes 5 to 20 seconds.</p>}
        {check && (
          <Callout tone="warning" title="This keyword is not started">
            <p>{error}</p>
            {check.result.alternatives.length > 0 && (
              <div className="mt-2">
                <p className="mb-1.5">Try one of these instead:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {check.result.alternatives.slice(0, 5).map((a) => (
                    <li key={a}>
                      <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => swap(a)}>
                        {a}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Callout>
        )}
        {!others.length && !rec.isPending && (
          <p className="flex items-start gap-1.5 text-[13px] text-ink-3">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            No other suggestion is within reach right now. <Badge>Tip</Badge> A specific search (your service and your city) is often easier.
          </p>
        )}
      </div>
    </Dialog>
  );
}
