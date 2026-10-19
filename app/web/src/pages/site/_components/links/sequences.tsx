// Link building, the conversations: sequences going out (step x of n, next send, pause / resume / stop, edit the unsent e-mails, the
// thread) and the replies (class, summary, the reply, the suggested answer sent in the same thread, won / not a fit).
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, CircleSlash, MessageSquareReply, Pause, Pencil, Play, Reply, Send, Square, Trophy } from 'lucide-react';
import { replySubject, type LinkBuildingData, type OutreachMessageView, type OutreachSequence, type OutreachStep } from '@seo/shared';
import { errorMessage } from '@/lib/api';
import { useSequenceAction, useSequenceOutcome, useSequenceReply, useUpdateSequence } from '@/lib/queries';
import { cn, fmtAgo, fmtDate, fmtDateTime } from '@/lib/utils';
import { Collapsible, IconTile } from '@/components/insight';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ExternalLink } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { Kind, Panel, useSitePage } from '../kit';
import { urlPath } from '../format';
import { REPLY_NOTE, ReplyBadge, SequenceBadge, sendingMailbox, typeIcon, typeLabel, words } from './common';

const RUNNING = new Set(['scheduled', 'active', 'paused']);
const ENDED = new Set(['finished', 'bounced', 'stopped', 'failed']);

export const sequenceGroups = (d: LinkBuildingData) => ({
  running: d.sequences.filter((q) => RUNNING.has(q.status)),
  replies: d.sequences.filter((q) => q.status === 'replied' || q.status === 'won'),
  ended: d.sequences.filter((q) => ENDED.has(q.status)),
});

/** What happens next in a sequence, in words. */
function nextLine(q: OutreachSequence): string {
  const n = q.steps.length;
  if (q.status === 'paused') return q.error ? `Paused: ${q.error}` : 'Paused: nothing goes out until it is resumed';
  if (q.status === 'scheduled') return `First e-mail goes out in the next sending window${q.nextAt ? ` (from ${fmtDateTime(q.nextAt)})` : ''}`;
  if (q.oooUntil) return `Out of office until ${fmtDate(q.oooUntil)}: the next e-mail waits until then`;
  if (q.step < n) return `Follow-up ${q.step} on ${fmtDate(q.nextAt)} if there is no reply`;
  return `Last e-mail sent: closes without a reply on ${fmtDate(q.nextAt)}`;
}

/** n dots, the sent ones filled. */
function StepDots({ sent, total }: { sent: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('size-2 rounded-full', i < sent ? 'bg-accent' : 'bg-surface-3 ring-1 ring-line-strong')} />
      ))}
    </span>
  );
}

export function InProgress({ d }: { d: LinkBuildingData }) {
  const { running, ended } = sequenceGroups(d);
  const [edit, setEdit] = useState<OutreachSequence | null>(null);
  const [stop, setStop] = useState<OutreachSequence | null>(null);
  return (
    <section id="progress" className="scroll-mt-20">
      <Panel
        title="In progress"
        icon={<Send />}
        description={running.length ? `${running.length} ${running.length === 1 ? 'conversation' : 'conversations'} going out or waiting for a reply` : 'Approved pitches while they go out'}
        info="Three e-mails at most in one thread: the first, a follow-up after a few working days and a last one. Everything stops at the first reply, a bounce or an opt-out. Sent Monday to Friday inside your mailbox's sending window, a few minutes apart."
        flush
      >
        {running.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {running.map((q) => (
              <SequenceRow key={q.id} q={q} onEdit={() => setEdit(q)} onStop={() => setStop(q)} />
            ))}
          </ul>
        ) : (
          <EmptyState className="border-t border-line py-8" icon={<Send className="size-5" />} title="Nothing going out right now" description="Approve a pitch above: it waits for your mailbox's sending window, then the follow-ups go out on their own until someone replies." />
        )}
        {ended.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Collapsible label={`${ended.length} ended ${ended.length === 1 ? 'conversation' : 'conversations'}`} openLabel="Hide ended conversations" contentClassName="pt-2">
              <ul className="divide-y divide-line text-[13px]">
                {ended.map((q) => (
                  <li key={q.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-ink">{q.prospectDomain}</span>
                      <SequenceBadge status={q.status} />
                    </span>
                    <span className="min-w-0 text-ink-3 [overflow-wrap:anywhere] sm:ml-auto sm:text-right">
                      {q.error || `${q.step} of ${q.steps.length} sent`}
                      {q.lastSentAt ? ` · last ${fmtDate(q.lastSentAt)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          </div>
        )}
      </Panel>
      {edit && <EditDialog q={edit} onClose={() => setEdit(null)} />}
      {stop && <StopDialog q={stop} onClose={() => setStop(null)} />}
    </section>
  );
}

function SequenceRow({ q, onEdit, onStop }: { q: OutreachSequence; onEdit: () => void; onStop: () => void }) {
  const { org, site, can } = useSitePage();
  const act = useSequenceAction(org.id, site.id);
  const member = can('member');
  const n = q.steps.length;
  const sent = Math.min(q.step, n);
  const run = (action: 'pause' | 'resume') =>
    act.mutate(
      { id: q.id, action },
      { onSuccess: () => toast.success(`${q.prospectDomain}: ${action === 'pause' ? 'paused' : 'resumed'}`), onError: (e) => toast.error(errorMessage(e)) },
    );
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <IconTile size="sm" className="mt-0.5">
          {typeIcon(q.type)}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ExternalLink href={q.pageUrl || `https://${q.prospectDomain}`} className="text-sm font-semibold text-ink">
              {q.prospectDomain}
            </ExternalLink>
            <SequenceBadge status={q.status} />
            <Kind>{typeLabel(q.type)}</Kind>
          </div>
          <p className="mt-1 text-[13px] text-ink-2 [overflow-wrap:anywhere]">
            To {q.toEmail}
            {q.targetUrl && (
              <>
                {' · your page '}
                <ExternalLink href={q.targetUrl}>{urlPath(q.targetUrl)}</ExternalLink>
              </>
            )}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            <StepDots sent={sent} total={n} />
            <span className="font-medium text-ink">
              {sent} of {n} sent
            </span>
            <span className="text-ink-3">· {nextLine(q)}</span>
          </p>
          {q.error && q.status !== 'paused' && <p className="mt-1 text-xs text-warning-text">Last attempt: {q.error}</p>}
          {q.messages.length > 0 && (
            <Collapsible className="mt-2" label={`Show the thread (${q.messages.length})`} openLabel="Hide the thread" contentClassName="pt-2">
              <Thread messages={q.messages} />
            </Collapsible>
          )}
        </div>
      </div>
      {member && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-10">
          {q.status === 'paused' ? (
            <Button size="sm" variant="secondary" icon={<Play className="size-3.5" />} loading={act.isPending} onClick={() => run('resume')}>
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={<Pause className="size-3.5" />} loading={act.isPending} onClick={() => run('pause')}>
              Pause
            </Button>
          )}
          {q.step < n && (
            <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
              Edit the unsent {n - q.step === 1 ? 'e-mail' : 'e-mails'}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={onStop}>
            Stop
          </Button>
        </div>
      )}
    </li>
  );
}

/** The messages of one conversation, oldest first. */
export function Thread({ messages }: { messages: OutreachMessageView[] }) {
  return (
    <ol className="space-y-2">
      {messages.map((m) => {
        const out = m.direction === 'out';
        return (
          <li key={m.id} className={cn('rounded-lg border px-3 py-2.5', out ? 'border-line bg-surface-2' : 'border-accent-text/20 bg-accent-soft')}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
              {out ? <ArrowUpRight className="size-3.5 shrink-0" aria-hidden /> : <ArrowDownLeft className="size-3.5 shrink-0 text-accent-text" aria-hidden />}
              <span className="font-medium text-ink-2">{out ? (m.kind === 'manual' ? 'Your answer' : m.step === 0 ? 'First e-mail' : `Follow-up ${m.step}`) : `Reply from ${m.from}`}</span>
              <span>· {fmtDateTime(m.at)}</span>
            </div>
            {m.subject && <p className="mt-1 text-[13px] font-medium text-ink [overflow-wrap:anywhere]">{m.subject}</p>}
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{m.body}</pre>
            {m.error && <p className="mt-1 text-xs font-medium text-critical-text">Not sent: {m.error}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function EditDialog({ q, onClose }: { q: OutreachSequence; onClose: () => void }) {
  const { org, site } = useSitePage();
  const update = useUpdateSequence(org.id, site.id);
  const [steps, setSteps] = useState<OutreachStep[]>(() => q.steps.map((s, i) => ({ ...s, step: i })));
  const [toEmail, setToEmail] = useState(q.toEmail);
  const [error, setError] = useState<string | null>(null);
  const unsent = steps.filter((_, i) => i >= q.step);
  const invalid = unsent.some((s) => !s.body.trim()) || (q.step === 0 && !steps[0]?.subject.trim()) || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(toEmail.trim());
  const save = () => {
    setError(null);
    update.mutate(
      { id: q.id, steps: unsent.map((s) => ({ ...s, subject: s.subject.trim(), body: s.body.trim() })), ...(q.step === 0 && toEmail.trim() !== q.toEmail ? { toEmail: toEmail.trim() } : {}) },
      {
        onSuccess: () => {
          toast.success(`${q.prospectDomain}: changes saved`);
          onClose();
        },
        onError: (e) => {
          setError(errorMessage(e));
          toast.error(errorMessage(e));
        },
      },
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={`Edit the pitch to ${q.prospectDomain}`}
      description="Only e-mails that have not gone out yet can change. Sent e-mails stay as they were."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={update.isPending} disabled={invalid} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {q.step === 0 ? (
          <Field label="To" hint="The address can change until the first e-mail goes out">
            {(f) => <Input {...f} type="email" value={toEmail} maxLength={200} onChange={(e) => setToEmail(e.target.value)} />}
          </Field>
        ) : (
          <p className="text-[13px] text-ink-2">To {q.toEmail}</p>
        )}
        {steps.map((s, i) => {
          if (i < q.step) return null;
          const w = words(s.body);
          return (
            <div key={i} className="space-y-3 rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">
                {i === 0 ? 'First e-mail' : `Follow-up ${i}`}
                {i > 0 && <span className="ml-2 text-xs font-normal text-ink-3">{s.waitDays} working days after the previous one, only if there is no reply</span>}
              </p>
              {i === 0 ? (
                <Field label="Subject" hint={`${s.subject.trim().length} characters · 36-50 work best`}>
                  {(f) => <Input {...f} value={s.subject} maxLength={140} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))} />}
                </Field>
              ) : (
                <p className="text-[13px] text-ink-3">Subject: {replySubject(steps[0]?.subject ?? '')}</p>
              )}
              <Field label="Text" hint={`${w} ${w === 1 ? 'word' : 'words'}`}>
                {(f) => <Textarea {...f} rows={i === 0 ? 8 : 5} maxLength={6000} value={s.body} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />}
              </Field>
            </div>
          );
        })}
        {error && <Callout tone="critical">{error}</Callout>}
      </div>
    </Dialog>
  );
}

function StopDialog({ q, onClose }: { q: OutreachSequence; onClose: () => void }) {
  const { org, site } = useSitePage();
  const act = useSequenceAction(org.id, site.id);
  const stop = () =>
    act.mutate(
      { id: q.id, action: 'cancel' },
      {
        onSuccess: () => {
          toast.success(`${q.prospectDomain}: stopped`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Stop the pitch to ${q.prospectDomain}?`}
      description="No further e-mail goes out in this conversation. To pause for a while instead, use Pause."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it going
          </Button>
          <Button variant="danger" icon={<Square className="size-4" />} loading={act.isPending} onClick={stop}>
            Stop
          </Button>
        </>
      }
    />
  );
}

// ---------------- replies ----------------

export function Replies({ d }: { d: LinkBuildingData }) {
  const { replies } = sequenceGroups(d);
  const ordered = [...replies].sort((a, b) => (a.status === 'won' ? 1 : 0) - (b.status === 'won' ? 1 : 0) || String(b.replyAt ?? b.wonAt ?? '').localeCompare(String(a.replyAt ?? a.wonAt ?? '')));
  const open = replies.filter(needsAnswer).length;
  return (
    <section id="replies" className="scroll-mt-20">
      <Panel
        title="Replies"
        icon={<MessageSquareReply />}
        description={replies.length ? `${open} to answer · ${replies.length - open} won` : 'What people answered, with a suggested reply'}
        info="Replies are read from your inbox every few minutes and sorted by what they say. Follow-ups stop at the first reply. Out-of-office replies are not counted: the next e-mail just waits."
        flush
      >
        {ordered.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {ordered.map((q) => (
              <ReplyRow key={q.id} q={q} d={d} />
            ))}
          </ul>
        ) : (
          <EmptyState className="border-t border-line py-8" icon={<Reply className="size-5" />} title="No replies yet" description="When someone answers, the reply shows here with what it means and a suggested answer you can edit and send in the same thread. Most replies come to the first e-mail." />
        )}
      </Panel>
    </section>
  );
}

function ReplyRow({ q, d }: { q: OutreachSequence; d: LinkBuildingData }) {
  const { org, site, can } = useSitePage();
  const reply = useSequenceReply(org.id, site.id);
  const outcome = useSequenceOutcome(org.id, site.id);
  const member = can('member');
  const [answer, setAnswer] = useState(q.suggestedReply ?? '');
  const won = q.status === 'won';
  const good = won || q.replyClass === 'says_linked';
  const lastIn = [...q.messages].reverse().find((m) => m.direction === 'in');
  const answered = q.messages.filter((m) => m.direction === 'out' && m.kind === 'manual' && (!lastIn || m.at > lastIn.at));
  const mayAnswer = !won && q.replyClass !== 'unsubscribe' && q.replyClass !== 'declined';
  const mb = sendingMailbox(d, q.mailboxId);
  const note = q.replyClass ? REPLY_NOTE[q.replyClass] : undefined;

  const send = () =>
    reply.mutate(
      { id: q.id, body: answer.trim() },
      { onSuccess: () => toast.success(`Answer sent to ${q.replyFrom || q.toEmail}`), onError: (e) => toast.error(errorMessage(e)) },
    );
  const mark = (status: 'won' | 'rejected') =>
    outcome.mutate(
      { id: q.id, status },
      { onSuccess: () => toast.success(`${q.prospectDomain}: ${status === 'won' ? 'marked won' : 'marked not a fit'}`), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <li className={cn('px-5 py-4', good && 'bg-good-soft/40')}>
      <div className="flex items-start gap-3">
        <IconTile size="sm" tone={good ? 'good' : 'blue'} className="mt-0.5">
          {good ? <Trophy /> : <MessageSquareReply />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ExternalLink href={q.pageUrl || `https://${q.prospectDomain}`} className="text-sm font-semibold text-ink">
              {q.prospectDomain}
            </ExternalLink>
            {won ? <StatusBadge tone="good">Won{q.wonAt ? ` ${fmtDate(q.wonAt)}` : ''}</StatusBadge> : <ReplyBadge cls={q.replyClass} />}
            <Kind>{typeLabel(q.type)}</Kind>
            {q.replyAt && <span className="text-xs text-ink-3">replied {fmtAgo(q.replyAt)}</span>}
          </div>
          {q.replySummary && <p className="mt-1 text-sm text-ink">{q.replySummary}</p>}
          {note && <p className="mt-1 text-[13px] text-ink-3">{note}</p>}
          {won && <p className="mt-1 text-[13px] text-ink-3">Our link check confirms the link on their page; its effect on your page shows under "What your links did" after six weeks.</p>}

          {lastIn && (
            <div className="mt-2.5 rounded-lg border border-accent-text/20 bg-surface px-3 py-2.5">
              <p className="text-xs text-ink-3">
                {lastIn.from} · {fmtDateTime(lastIn.at)}
              </p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{lastIn.body}</pre>
            </div>
          )}

          {mayAnswer && member && (
            <div className="mt-3">
              {answered.length > 0 && <p className="mb-2 text-xs font-medium text-good-text">You answered {fmtAgo(answered[answered.length - 1]!.at)}.</p>}
              <Field label="Your answer" hint={`Sent now in the same thread${mb ? ` from ${mb.fromEmail}` : ''}, signed with your name, title and company.`}>
                {(f) => <Textarea {...f} rows={5} maxLength={6000} value={answer} placeholder="Write your answer" onChange={(e) => setAnswer(e.target.value)} />}
              </Field>
            </div>
          )}
          {!mayAnswer && !won && q.suggestedReply && (
            <p className="mt-2 text-xs text-ink-3">No answer is sent to an address that asked not to be contacted.</p>
          )}

          {q.messages.length > 0 && (
            <Collapsible className="mt-2" label={`Show the whole thread (${q.messages.length})`} openLabel="Hide the thread" contentClassName="pt-2">
              <Thread messages={q.messages} />
            </Collapsible>
          )}

          {member && !won && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mayAnswer && (
                <Button size="sm" icon={<Send className="size-3.5" />} loading={reply.isPending} disabled={answer.trim().length < 2} onClick={send}>
                  Send in this thread
                </Button>
              )}
              {mayAnswer && (
                <>
                  <Button size="sm" variant={q.replyClass === 'says_linked' ? 'primary' : 'secondary'} icon={<Trophy className="size-3.5" />} loading={outcome.isPending && outcome.variables?.status === 'won'} onClick={() => mark('won')}>
                    Mark won
                  </Button>
                  <Button size="sm" variant="ghost" icon={<CircleSlash className="size-3.5" />} loading={outcome.isPending && outcome.variables?.status === 'rejected'} onClick={() => mark('rejected')}>
                    Not a fit
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** a reply that waits for the person: not an opt-out, a refusal or an out-of-office, and not answered since it came in */
export function needsAnswer(q: LinkBuildingData['sequences'][number]): boolean {
  if (q.status !== 'replied' || ['unsubscribe', 'declined', 'out_of_office'].includes(q.replyClass ?? '')) return false;
  const lastIn = [...q.messages].reverse().find((m) => m.direction === 'in');
  return !q.messages.some((m) => m.direction === 'out' && m.kind === 'manual' && (!lastIn || m.at > lastIn.at));
}
export const replyCount = (d: LinkBuildingData) => d.sequences.filter(needsAnswer).length;
