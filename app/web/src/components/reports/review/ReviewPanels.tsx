import { lazy, Suspense, useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowRight, BadgeCheck, CheckCircle2, CircleHelp, Copy, FileCheck2, Loader2, PenLine, Sparkles, Wand2 } from 'lucide-react';
import {
  answerProblem,
  DECISION_LABEL,
  DUPLICATE_REASON_MAX,
  duplicateReasonProblem,
  formatCredits,
  REVIEW_STAGE_LABEL,
  REVIEW_STAGE_TONE,
  type AnswerDecision,
  type PageDelivery,
  type PageReviewView,
  type ReportDetail,
  type ReviewStage,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage, toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useAcceptPrefilled, useApprovePage, useDuplicateDecision, useFinalizePage, usePageReview, useReport, useSaveAnswers } from '@/lib/queries';
import { cn, fmtDateTime } from '@/lib/utils';
import { CmsPublishPanel } from '../CmsPublish';
import { ExternalLink } from '@/components/ui/misc';
import { Block } from '../kit';
import { keywordPrefill } from '../meta';
import { answeredCount, byPerson, choicesFor, contextLines, currentChoice, groupQuestions, type ReviewQuestion } from './model';

const PageEditor = lazy(() => import('./PageEditor'));

/** The guide behind every question ("Show me how"): what the business details are and how answers are kept. */
export const QUESTIONS_GUIDE = 'page-questions' as const;

export const stageTone = (s: ReviewStage): Tone => {
  const t = REVIEW_STAGE_TONE[s];
  return t === 'info' ? 'accent' : t;
};

export function StageBadge({ stage }: { stage: ReviewStage }) {
  return <StatusBadge tone={stageTone(stage)}>{REVIEW_STAGE_LABEL[stage]}</StatusBadge>;
}

/** The delivered status, said first on the page report: the headline, what we did and what you do, the blocking points. */
export function DeliveryCallout({ delivery }: { delivery: PageDelivery }) {
  const tone = delivery.status === 'not_ready' ? 'critical' : delivery.status === 'unknown' ? 'warning' : delivery.status === 'ready' ? 'good' : 'info';
  return (
    <Callout tone={tone} title={delivery.headline}>
      <p className="[overflow-wrap:anywhere]">{delivery.detail}</p>
      {delivery.status === 'not_ready' && delivery.blocking.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
          {delivery.blocking.slice(0, 6).map((b, i) => (
            <li key={`${i}-${b.code}`}>
              {b.text}
              {b.action ? <span className="text-ink-2"> What to do: {b.action}.</span> : null}
            </li>
          ))}
        </ul>
      )}
      {delivery.advisory.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Advice that does not stop you publishing ({delivery.advisory.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2 [overflow-wrap:anywhere]">
            {delivery.advisory.slice(0, 12).map((a, i) => (
              <li key={`${i}-${a.code}`}>{a.text}</li>
            ))}
          </ul>
        </details>
      )}
    </Callout>
  );
}

/**
 * H3: the review of a written page, under its delivered status: the questions (ranked, the top three first), the client's own edits, the
 * final version and the approval. Without the review (an older server, a page written without one of your websites) nothing is shown here
 * and the report reads as before.
 */
export function PageReview({ report, fallback, publishLink }: { report: ReportDetail; fallback?: ReactNode; publishLink?: ReactNode }) {
  const { org } = useOrgCtx();
  const q = usePageReview(org.id, report.id, !!report.siteId);
  if (!report.siteId) return <>{fallback}</>;
  if (q.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!q.data) return <>{fallback}</>;
  return <ReviewBody view={q.data} report={report} publishLink={publishLink} />;
}

export function ReviewBody({ view, report, publishLink }: { view: PageReviewView; report: ReportDetail; publishLink?: ReactNode }) {
  const { org } = useOrgCtx();
  return (
    <div className="space-y-5">
      {view.isFinal && view.finalOf && (
        <Callout tone="info" title="This is the final version of your page">
          It was made from your answers and edits. The first version is still in{' '}
          <a className="font-medium text-accent-text underline-offset-2 hover:underline" href={paths.report(org.id, view.finalOf)}>
            its own report
          </a>
          .
        </Callout>
      )}
      {view.duplicate && view.duplicate.pages.length > 0 && <DuplicateCard view={view} />}
      {view.questions.length > 0 && <QuestionsPanel view={view} domain={report.siteDomain ?? ''} />}
      <EditCard view={view} />
      <FinalVersionCard view={view} />
      <ApproveCard view={view} report={report} publishLink={publishLink} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// W0-B (2026-10-29, owner decision D2): the website already has a page for the same search
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Two pages for one search compete with each other, so the page is not ready until the client chooses: rewrite the website's page as an
 * update (a new page run that keeps its address, priced on the form) or say how this page differs (saved, sent with the next final
 * version and shown on it; the grade keeps its limit for fit).
 */
export function DuplicateCard({ view }: { view: PageReviewView }) {
  const { org, can } = useOrgCtx();
  const save = useDuplicateDecision(org.id, view.reportId);
  const d = view.duplicate!;
  const first = d.pages[0]!;
  const [reason, setReason] = useState(d.decision?.reason ?? '');
  const ids = useId();
  const editable = can('member') && !view.approval;
  const problem = duplicateReasonProblem(reason);
  const dirty = reason.trim() !== (d.decision?.reason ?? '').trim();
  const send = async (choice: 'differs' | null) => {
    try {
      await save.mutateAsync(choice ? { choice, reason: reason.trim() } : { choice: null });
      if (!choice) setReason('');
      toast.success(choice ? 'Reason saved' : 'Reason taken back', { description: choice ? 'Make the final version to apply it.' : 'The page waits for your choice again.' });
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <section id="duplicate" aria-labelledby={`${ids}-dup`} className="scroll-mt-20">
      <Block
        title={<span id={`${ids}-dup`}>Your website already has a page for this search</span>}
        description="Two pages for one search compete with each other in Google. Publish this one as an update of your page, or tell us how it differs."
        icon={<Copy />}
        iconTone="warning"
      >
        <ul className="space-y-1 text-[13px] text-ink-2 [overflow-wrap:anywhere]">
          {d.pages.map((p) => (
            <li key={p.url}>
              <ExternalLink href={p.url}>{p.title || p.url}</ExternalLink>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">Update your page instead</h3>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              We write a new version of your page at its own address, so it keeps what it has already earned. This is a new page, priced on the next screen.
            </p>
            {can('member') && d.rewrite.keyword && view.siteId && (
              <ButtonLink
                className="mt-3"
                size="sm"
                icon={<ArrowRight className="size-4" />}
                to={paths.tool(org.id, 'keyword', { siteId: view.siteId, prefill: keywordPrefill({ keyword: d.rewrite.keyword, pageType: d.rewrite.pageType, country: d.rewrite.country, existingPageUrl: first.url }) })}
              >
                Rewrite it as an update of your page
              </ButtonLink>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">Or tell us how this page differs</h3>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              We keep your reason with the page and show it on the final version. The page can then be ready, but its grade keeps a limit for fit.
            </p>
            <fieldset className="mt-3" disabled={!editable || save.isPending}>
              <Field label="How this page differs" hint="For example: who it is for, or what it covers that your other page does not." error={dirty && reason.trim() && problem ? problem : undefined}>
                {(p) => <Textarea {...p} rows={3} value={reason} maxLength={DUPLICATE_REASON_MAX} onChange={(e) => setReason(e.target.value)} />}
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" disabled={!dirty || !!problem} loading={save.isPending} onClick={() => send('differs')}>
                  Save my reason
                </Button>
                {d.decision && (
                  <Button size="sm" variant="ghost" onClick={() => send(null)}>
                    Take my reason back
                  </Button>
                )}
              </div>
            </fieldset>
            <p className="mt-1.5 min-h-4 text-xs text-ink-3" role="status" aria-live="polite">
              {d.decision && !dirty ? `Saved ${fmtDateTime(d.decision.at)}${byPerson(view, d.decision.by)}. Make the final version to apply it.` : ''}
            </p>
          </div>
        </div>
      </Block>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------------------------------------------

export function QuestionsPanel({ view, domain = '' }: { view: PageReviewView; domain?: string }) {
  const { org, can } = useOrgCtx();
  const accept = useAcceptPrefilled(org.id, view.reportId);
  const { top, optional, stored } = groupQuestions(view.questions);
  const { answered, total } = answeredCount(view);
  const prefilled = [...top, ...optional].filter((x) => x.prefill && !view.answers[x.id]).length;
  const editable = can('member') && !view.approval;
  const acceptAll = async () => {
    try {
      await accept.mutateAsync();
      toast.success('Suggestions accepted', { description: 'Each answer is kept in your business details for later pages.' });
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <section id="questions" aria-labelledby="questions-title" className="scroll-mt-20">
      <Block
        title={<span id="questions-title">Questions only you can answer</span>}
        description={`${answered} of ${total} answered. The page is publishable without them: each answer makes it more specific and is kept for your later pages.`}
        icon={<CircleHelp />}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <GuideButton id={QUESTIONS_GUIDE} vars={{ domain }} />
            {editable && prefilled > 0 && (
              <Button size="sm" variant="secondary" icon={<Sparkles className="size-4" />} loading={accept.isPending} onClick={acceptAll}>
                Accept all suggestions ({prefilled})
              </Button>
            )}
          </span>
        }
      >
        {top.length > 0 && (
          <div>
            <h3 className="mb-2 font-display text-[15px] font-semibold text-ink">{top.length === 1 ? 'This one matters most' : `These ${top.length} matter most`}</h3>
            <ol className="space-y-3">
              {top.map((x) => (
                <QuestionCard key={x.id} q={x} view={view} editable={editable} highlight />
              ))}
            </ol>
          </div>
        )}
        {optional.length > 0 && (
          <details className="mt-5" open={top.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink-2">Optional: {optional.length} more {optional.length === 1 ? 'question' : 'questions'}</summary>
            <ol className="mt-3 space-y-3">
              {optional.map((x) => (
                <QuestionCard key={x.id} q={x} view={view} editable={editable} />
              ))}
            </ol>
          </details>
        )}
        {stored.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-[13px] font-medium text-ink-2">Answered in your business details ({stored.length})</h3>
            <ul className="space-y-1.5 text-[13px] text-ink-2">
              {stored.map((x) => (
                <li key={x.id} className="flex items-start gap-2 [overflow-wrap:anywhere]">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-good-text" aria-hidden />
                  <span>
                    {x.question}
                    {x.stored?.text ? <span className="text-ink-3"> Your answer: {x.stored.text}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Block>
    </section>
  );
}

export function QuestionCard({ q, view, editable, highlight }: { q: ReviewQuestion; view: PageReviewView; editable: boolean; highlight?: boolean }) {
  const { org } = useOrgCtx();
  const save = useSaveAnswers(org.id, view.reportId);
  const saved = view.answers[q.id];
  const cur = currentChoice(q, saved);
  const [decision, setDecision] = useState<AnswerDecision | null>(cur.decision);
  const [text, setText] = useState(cur.text);
  const [status, setStatus] = useState('');
  const ids = useId();
  const ctx = contextLines(q);
  const needsText = decision === 'edit' || decision === 'answer';
  const problem = decision ? answerProblem(q, decision, text) : '';
  const dirty = decision !== cur.decision || (needsText && text.trim() !== cur.text.trim());

  const send = async (d: AnswerDecision, t: string) => {
    setStatus('Saving');
    try {
      await save.mutateAsync([{ questionId: q.id, decision: d, ...(d === 'edit' || d === 'answer' ? { text: t.trim() } : {}) }]);
      setStatus('Saved');
    } catch (e) {
      setStatus('');
      toastError(e);
    }
  };
  const choose = (d: AnswerDecision) => {
    setDecision(d);
    if (d === 'edit' && !text) setText(q.original || q.prefill);
    // one click for every choice that needs no wording
    if (d !== 'edit' && d !== 'answer' && d !== cur.decision) void send(d, '');
  };

  return (
    <li
      className={cn('rounded-xl border p-4', highlight ? 'border-accent-text/40 bg-accent-soft/40' : 'border-line bg-surface')}
      aria-labelledby={`${ids}-q`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink tabular" aria-hidden>
          {q.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${ids}-q`} className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">
            <span className="sr-only">Question {q.rank}: </span>
            {q.question}
          </p>
          {q.why && <p className="mt-1 text-[13px] leading-snug text-ink-2 [overflow-wrap:anywhere]">{q.why}</p>}
          {(ctx.specific || ctx.now) && (
            <div className="mt-2.5 space-y-1.5 text-[13px]">
              {ctx.specific && (
                <figure className="rounded-lg border border-line bg-surface px-3 py-2">
                  <figcaption className="text-xs font-medium text-ink-3">What we wanted to say{q.section ? ` (in "${q.section}")` : ''}</figcaption>
                  <blockquote className="mt-0.5 text-ink [overflow-wrap:anywhere]">{ctx.specific}</blockquote>
                </figure>
              )}
              <p className="text-ink-3 [overflow-wrap:anywhere]">
                {ctx.nowLabel}
                {ctx.now ? <span className="text-ink-2">: "{ctx.now}"</span> : '.'}
              </p>
            </div>
          )}
          {q.prefill && (
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2 [overflow-wrap:anywhere]">
              <span className="font-medium text-ink">{q.prefill_source && !/business facts/i.test(q.prefill_source) ? 'Your website says' : 'Our suggestion'}: </span>"{q.prefill}"
              {q.prefill_source && /^https?:\/\//.test(q.prefill_source) ? <span className="text-ink-3"> ({q.prefill_source.replace(/^https?:\/\/(www\.)?/, '')})</span> : null}
            </p>
          )}

          <fieldset className="mt-3" disabled={!editable || save.isPending}>
            <legend className="sr-only">Your answer to question {q.rank}</legend>
            <div className="flex flex-wrap gap-1.5">
              {choicesFor(q).map((d) => {
                const on = decision === d;
                return (
                  <label
                    key={d}
                    className={cn(
                      'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors duration-150 ease-brand focus-within:ring-2 focus-within:ring-accent-text/60',
                      on ? 'border-accent-text bg-accent-soft text-accent-text' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3/50 hover:text-ink',
                      (!editable || save.isPending) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input type="radio" className="sr-only" name={`${ids}-choice`} value={d} checked={on} onChange={() => choose(d)} />
                    {on && <CheckCircle2 className="size-3.5" aria-hidden />}
                    {d === 'answer' && q.prefill ? 'Use this answer' : DECISION_LABEL[d]}
                  </label>
                );
              })}
            </div>
            {needsText && (
              <div className="mt-3">
                <Field label={decision === 'edit' ? 'Your wording' : 'Your answer'} hint="Plain sentences. This exact text can appear on your pages." error={dirty && problem ? problem : undefined}>
                  {(p) => <Textarea {...p} rows={3} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} />}
                </Field>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" disabled={!dirty || !!problem} loading={save.isPending} onClick={() => decision && send(decision, text)}>
                    Save answer
                  </Button>
                </div>
              </div>
            )}
          </fieldset>
          <p className="mt-1.5 min-h-4 text-xs text-ink-3" role="status" aria-live="polite">
            {status === 'Saving' ? 'Saving' : status === 'Saved' || (saved && !dirty) ? `Saved${saved && saved.decision !== 'skip' && q.use_for_future_pages ? ', and kept for your later pages' : ''}` : ''}
          </p>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The client's own edits
// ---------------------------------------------------------------------------------------------------------------------------------

function EditCard({ view }: { view: PageReviewView }) {
  const { can } = useOrgCtx();
  const [open, setOpen] = useState(false);
  const cv = view.clientVersion;
  if (view.isFinal && !can('member')) return null;
  return (
    <Block
      title="Change the page yourself"
      description={cv ? `Your version, saved ${fmtDateTime(cv.savedAt)}${byPerson(view, cv.savedBy)}. The final check runs on it.` : 'Edit any heading, paragraph, list, table or link. We check your version before you publish it.'}
      icon={<PenLine />}
      actions={
        can('member') && !view.approval ? (
          <Button size="sm" variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Close the editor' : cv ? 'Continue editing' : 'Open the editor'}
          </Button>
        ) : undefined
      }
    >
      {cv?.check && !open && <CheckResult check={cv.check} />}
      {open ? (
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <PageEditor view={view} onClose={() => setOpen(false)} />
        </Suspense>
      ) : (
        !cv && <p className="text-[13px] text-ink-3">Nothing changed yet: the page is as we delivered it.</p>
      )}
    </Block>
  );
}

export function CheckResult({ check }: { check: NonNullable<NonNullable<PageReviewView['clientVersion']>['check']> }) {
  if (!check.ran)
    return (
      <Callout tone="warning" title="Your version could not be checked just now">
        {check.note || 'Your changes are saved. Save again in a moment to check them.'}
      </Callout>
    );
  return (
    <div className="space-y-2">
      {check.blocking.length ? (
        <Callout tone="critical" title={`${check.blocking.length} ${check.blocking.length === 1 ? 'point stops' : 'points stop'} your version from being published`}>
          <ul className="list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
            {check.blocking.map((b, i) => (
              <li key={`${i}-${b.code}`}>
                {b.text}
                {b.action ? <span className="text-ink-2"> What to do: {b.action}.</span> : null}
              </li>
            ))}
          </ul>
        </Callout>
      ) : (
        <Callout tone="good" title="Your version passed the check">
          {check.note || 'Nothing in it stops you publishing.'}
        </Callout>
      )}
      {check.advisory.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Advice ({check.advisory.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
            {check.advisory.map((a, i) => (
              <li key={`${i}-${a.code}`}>{a.text}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The final version
// ---------------------------------------------------------------------------------------------------------------------------------

export function FinalVersionCard({ view }: { view: PageReviewView }) {
  const { org, can } = useOrgCtx();
  const finalize = useFinalizePage(org.id, view.reportId);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const f = view.finalize;
  if (view.isFinal) return null;
  if (f.status === 'none' && !f.needed) return null;
  const price = formatCredits(f.quote.credits);
  const start = async () => {
    setErr('');
    try {
      await finalize.mutateAsync();
      setConfirm(false);
    } catch (e) {
      setErr(errorMessage(e));
      setConfirm(false);
    }
  };
  return (
    <Block title="Your final version" description="We put your answers and your edits into the page, rewrite only the parts they change, and check the whole page again." icon={<Wand2 />}>
      <div aria-live="polite">
        {f.status === 'running' ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="size-4 animate-spin text-accent-text" aria-hidden />
            Making the final version. It usually takes a minute or two; you can leave this page.
          </p>
        ) : f.status === 'done' && f.reportId ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5 text-sm text-ink">
              <CheckCircle2 className="size-4 text-good-text" aria-hidden /> The final version is ready.
            </p>
            <ButtonLink to={paths.report(org.id, f.reportId)} size="sm" icon={<FileCheck2 className="size-4" />}>
              Open the final version
            </ButtonLink>
            {f.needed && can('member') && (
              <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                Make it again with my newer answers
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {f.status === 'failed' && (
              <Callout tone="critical" title="The final version could not be made">
                {f.error || 'Nothing was charged for it.'} You can try again.
              </Callout>
            )}
            {err && <Callout tone="critical">{err}</Callout>}
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<Wand2 className="size-4" />} disabled={!can('member') || !f.needed} onClick={() => setConfirm(true)}>
                {f.status === 'failed' ? 'Try again' : 'Make the final version'}
              </Button>
              <span className="text-[13px] text-ink-2">
                {price}
                {f.reason ? <span className="text-ink-3"> · {f.reason}</span> : null}
              </span>
            </div>
          </div>
        )}
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Make the final version?"
        description={`This costs ${price}. We use your answers and edits, rewrite only what they change and check the page again. Nothing is published until you approve it.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button loading={finalize.isPending} onClick={start}>
              Make it for {price}
            </Button>
          </>
        }
      />
    </Block>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Approve, then publish
// ---------------------------------------------------------------------------------------------------------------------------------

export function ApproveCard({ view, report, publishLink }: { view: PageReviewView; report: ReportDetail; publishLink?: ReactNode }) {
  const { org, can } = useOrgCtx();
  const approve = useApprovePage(org.id, view.reportId);
  const target = !view.isFinal && view.finalize.status === 'done' && view.finalize.reportId ? view.finalize.reportId : report.id;
  const approved = view.approval;
  const approvedHere = approved?.reportId === report.id;
  const other = useReport(org.id, approved && !approvedHere ? approved.reportId : undefined);
  const notReady = view.delivery.status === 'not_ready' && !view.clientVersion?.check?.ran;
  const blockedBy = view.clientVersion?.check?.ran && view.clientVersion.check.blocking.length ? view.clientVersion.check.blocking[0]!.text : notReady ? view.delivery.blocking[0]?.text ?? view.delivery.headline : '';
  const go = async () => {
    try {
      await approve.mutateAsync(target !== report.id ? { versionReportId: target } : {});
      toast.success('Approved', { description: 'Now publish it: send it to your website or tell us its address once it is live.' });
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <Block
      title="Approve and publish"
      description="One click to approve; then send it to your website, or publish it yourself and tell us the address so we check it live."
      icon={<BadgeCheck />}
      actions={<StageBadge stage={view.stage} />}
    >
      {approved ? (
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
            <CheckCircle2 className="size-4 text-good-text" aria-hidden />
            Approved {fmtDateTime(approved.approvedAt)}
            {byPerson(view, approved.approvedBy)}.
            {!approvedHere && (
              <a className="font-medium text-accent-text underline-offset-2 hover:underline" href={paths.report(org.id, approved.reportId)}>
                Open the approved version
              </a>
            )}
          </p>
          {view.publish.url && (
            <p className="text-[13px] text-ink-2 [overflow-wrap:anywhere]">
              {view.publish.status === 'live_verified' ? 'Live and checked at ' : 'Address: '}
              <a className="text-accent-text hover:underline" href={view.publish.url} target="_blank" rel="noopener noreferrer">
                {view.publish.url}
              </a>
            </p>
          )}
          {approvedHere ? <CmsPublishPanel report={report} /> : other.data ? <CmsPublishPanel report={other.data} /> : null}
          {approvedHere && publishLink ? <div className="flex flex-wrap items-center gap-2">{publishLink}</div> : null}
        </div>
      ) : (
        <div className="space-y-2">
          {blockedBy && <p className="text-[13px] text-ink-2 [overflow-wrap:anywhere]">Approval opens once nothing stops the page: {blockedBy}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={<BadgeCheck className="size-4" />} disabled={!can('member') || !!blockedBy} loading={approve.isPending} onClick={go}>
              {target !== report.id ? 'Approve the final version and publish' : 'Approve and publish'}
            </Button>
            {view.finalize.status === 'running' && <Badge tone="accent">The final version is being made</Badge>}
          </div>
        </div>
      )}
    </Block>
  );
}
