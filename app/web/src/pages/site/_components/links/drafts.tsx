// Link building, "Ready to send": the drafted pitches waiting for a person (LINK_BUILDER_SPEC.md §2), each with why this site, our page
// and the link text to ask for, the contact, and the review dialog (edit, consent, footer preview, approve).
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CircleSlash, Clock, ExternalLink as ExternalIcon, FileText, Mail, MailCheck, Send, ShieldCheck, UserRound } from 'lucide-react';
import { consentGate, footerLines, replySubject, type LinkBuildingData, type MailboxView, type OutreachDraft, type OutreachStep } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useApproveOutreach, useDismissOutreach } from '@/lib/queries';
import { useCycleDay } from '@/lib/cycle-day';
import { fmtDate } from '@/lib/utils';
import { Collapsible, IconTile, InfoTip } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { ExternalLink } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { Kind, SectionHeading, useSitePage } from '../kit';
import { urlPath } from '../format';
import { anchorLabel, ANCHOR_INFO, CONTACT_KIND, sendingMailbox, typeIcon, typeLabel, windowText, words } from './common';

/** Cards shown before "Show more". */
const SHOWN = 6;
/** prospects a person already settled (won, not a fit, ignored) do not come back as drafts */
const SETTLED = new Set(['won', 'rejected', 'ignored']);

export function ReadyToSend({ d, onRun }: { d: LinkBuildingData; onRun?: () => void }) {
  const [open, setOpen] = useState<OutreachDraft | null>(null);
  const day = useCycleDay();
  const live = d.drafts.filter((x) => x.status !== 'not_fit' && !SETTLED.has(x.prospectStatus));
  const notFit = d.drafts.filter((x) => x.status === 'not_fit');
  const drafted = live.filter((x) => x.status === 'drafted' && x.steps.length).length;

  return (
    <section id="ready" className="scroll-mt-20">
      <SectionHeading
        icon={<Send />}
        title="Ready to send"
        description={live.length ? `${drafted} ${drafted === 1 ? 'pitch' : 'pitches'} drafted · ${live.length - drafted} more ${live.length - drafted === 1 ? 'site' : 'sites'} found` : 'Pitches drafted for you to read, edit and approve'}
        info="Each site was checked first: the page answers, it does not sell links, it is on your topic and nobody contacted it in the last 90 days. A pitch is three short e-mails at most in one thread; it stops at the first reply."
      />
      {live.length ? (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {live.slice(0, SHOWN).map((x) => (
              <DraftCard key={`${x.prospectDomain}|${x.type}`} x={x} d={d} onOpen={() => setOpen(x)} />
            ))}
          </ul>
          {live.length > SHOWN && (
            <Collapsible className="mt-3" label={`Show ${live.length - SHOWN} more`} openLabel="Show fewer" contentClassName="pt-3">
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {live.slice(SHOWN).map((x) => (
                  <DraftCard key={`${x.prospectDomain}|${x.type}`} x={x} d={d} onOpen={() => setOpen(x)} />
                ))}
              </ul>
            </Collapsible>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <EmptyState
            className="py-9"
            icon={<Send className="size-5" />}
            title="No pitches waiting"
            description={`The Link Builder looks for new opportunities ${day.every}${d.lastRun ? ` (last search ${fmtDate(d.lastRun)})` : ''}: journalist requests, dead links to replace, resource pages, lists that leave you out. New pitches appear here for your approval.`}
            action={
              onRun ? (
                <Button variant="secondary" onClick={onRun}>
                  Find opportunities now
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      {notFit.length > 0 && (
        <Collapsible className="mt-3" label={`${notFit.length} ${notFit.length === 1 ? 'site' : 'sites'} checked and left out`} openLabel="Hide the sites left out" contentClassName="pt-2">
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-[13px]">
            {notFit.map((x) => (
              <li key={`${x.prospectDomain}|${x.type}`} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="shrink-0 font-medium text-ink">{x.prospectDomain}</span>
                <span className="min-w-0 text-ink-3 [overflow-wrap:anywhere]">
                  {typeLabel(x.type)} · {x.fitReason || 'not a fit'}
                </span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
      {open && <ApproveDialog x={open} d={d} onClose={() => setOpen(null)} />}
    </section>
  );
}

function DraftStatus({ x }: { x: OutreachDraft }) {
  if (x.status === 'drafted' && x.steps.length) return <StatusBadge tone="accent">Pitch ready</StatusBadge>;
  if (x.status === 'needs_edit') return <StatusBadge tone="warning">Needs your edit</StatusBadge>;
  if (x.status === 'needs_contact') return <StatusBadge tone="warning">No e-mail address</StatusBadge>;
  return <Badge>Pitch not written yet</Badge>;
}

function DraftCard({ x, d, onOpen }: { x: OutreachDraft; d: LinkBuildingData; onOpen: () => void }) {
  const { org, site, can } = useSitePage();
  const dismiss = useDismissOutreach(org.id, site.id);
  const member = can('member');
  const pitch = (x.status === 'drafted' || x.status === 'needs_edit') && x.steps.length > 0;   // a held pitch is shown so a person can fix it; it cannot be sent until every check passes
  const press = x.type === 'press';
  const noEmail = !x.contacts.length;
  const notFit = () =>
    dismiss.mutate(
      { prospectDomain: x.prospectDomain, type: x.type },
      { onSuccess: () => toast.success(`${x.prospectDomain}: marked not a fit`), onError: (e) => toast.error(errorMessage(e)) },
    );
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-colors duration-150 ease-brand hover:border-line-strong">
      <div className="flex items-start gap-3">
        <IconTile size="md">{typeIcon(x.type)}</IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <ExternalLink href={x.pageUrl || `https://${x.prospectDomain}`} className="min-w-0 text-sm font-semibold text-ink">
              {x.prospectDomain}
            </ExternalLink>
            <DraftStatus x={x} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Kind>{typeLabel(x.type)}</Kind>
            {x.score > 0 && (
              <Badge tone="accent" className="gap-1.5">
                score {Math.round(x.score)}
                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-accent/15" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, x.score))}%` }} />
                </span>
              </Badge>
            )}
            {x.fit > 0 && <span className="text-xs text-ink-3">topic fit {Math.round(x.fit * 100)}%</span>}
            {x.prospectStatus === 'contacted' && <Badge>Marked contacted</Badge>}
          </div>
        </div>
      </div>

      {press && x.deadline && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-text">
          <Clock className="size-4 shrink-0" aria-hidden />
          Deadline: {x.deadline}
        </p>
      )}

      <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
        {x.pageTitle && <p className="font-medium text-ink [overflow-wrap:anywhere]">{x.pageTitle}</p>}
        {x.evidence && (
          <p className="line-clamp-3 text-ink-2 [overflow-wrap:anywhere]" title={x.evidence}>
            {x.evidence}
          </p>
        )}
        {x.deadLink && (
          <p className="text-ink-2 [overflow-wrap:anywhere]">
            <span className="font-medium text-ink">Dead link on their page:</span> {x.deadLink.anchor ? `"${x.deadLink.anchor}", link to ` : ''}
            <span className="text-ink-3">{x.deadLink.url}</span>
          </p>
        )}
        {x.fitReason && <p className="text-ink-3 [overflow-wrap:anywhere]">Why them: {x.fitReason}</p>}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="text-ink-3">Your page</dt>
        <dd className="min-w-0">
          {x.targetUrl ? (
            <ExternalLink href={x.targetUrl} className="font-medium">
              {urlPath(x.targetUrl)}
            </ExternalLink>
          ) : (
            '-'
          )}
          {x.targetReason && <span className="block text-xs text-ink-3 [overflow-wrap:anywhere]">{x.targetReason}</span>}
        </dd>
        <dt className="text-ink-3">Link text</dt>
        <dd className="flex min-w-0 items-center gap-0.5 text-ink">
          {anchorLabel(x.anchorHint)}
          <InfoTip label="Why not a keyword">{ANCHOR_INFO}</InfoTip>
        </dd>
        <dt className="text-ink-3">Contact</dt>
        <dd className="min-w-0">
          {noEmail ? (
            <span className="text-ink-2">{x.contactFormUrl ? 'No e-mail on their site: they take messages through a contact form.' : 'No address found yet.'}</span>
          ) : (
            <ul className="space-y-1">
              {x.contacts.slice(0, 3).map((c) => (
                <li key={c.email} className="flex flex-wrap items-center gap-1.5">
                  <span className="break-all text-ink">{c.email}</span>
                  <Badge className="h-5 px-1.5 font-normal" icon={c.kind === 'person' ? <UserRound className="size-3" aria-hidden /> : undefined}>
                    {CONTACT_KIND[c.kind]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {pitch && !noEmail && (
          <Button size="sm" variant={member ? 'primary' : 'secondary'} icon={<Mail className="size-3.5" />} onClick={onOpen}>
            {member ? 'Review & approve' : 'Read the pitch'}
          </Button>
        )}
        {noEmail && x.contactFormUrl && (
          <a href={x.contactFormUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <ExternalIcon className="size-3.5" aria-hidden />
            Open their contact form
          </a>
        )}
        {pitch && noEmail && (
          <Button size="sm" variant="ghost" icon={<FileText className="size-3.5" />} onClick={onOpen}>
            Read the pitch
          </Button>
        )}
        {member && (
          <Button size="sm" variant="ghost" icon={<CircleSlash className="size-3.5" />} loading={dismiss.isPending} onClick={notFit}>
            Not a fit
          </Button>
        )}
        {!pitch && x.status !== 'needs_contact' && <span className="text-xs text-ink-3">The pitch is written in a coming weekly run (up to 10 a week, best first).</span>}
        {x.status === 'needs_edit' && <span className="text-xs text-warning-text">Every pitch is checked before it goes out: edit it and the checks run again on approval.</span>}
        {x.draftedAt && <span className="ml-auto text-xs text-ink-3">drafted {fmtDate(x.draftedAt)}</span>}
      </div>
      {!d.canSend.ok && pitch && member && <p className="mt-2 text-xs text-warning-text">{d.canSend.why}</p>}
    </li>
  );
}

/** The footer the app adds when it sends (who is writing, the postal address, the opt-out line). */
function FooterPreview({ mb, first, country, foundOn }: { mb: MailboxView | null; first: boolean; country: string; foundOn: string }) {
  if (!mb) return null;
  const lines = footerLines({ name: mb.signatureName || mb.fromName, title: mb.signatureTitle, company: mb.company, postalAddress: mb.postalAddress }, { firstEmail: first, country, foundOn });
  return (
    <div className="mt-2 rounded-lg border border-dashed border-line-strong px-3 py-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <ShieldCheck className="size-3.5" aria-hidden />
        Added by the app when it sends
      </p>
      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{lines.filter((l, i) => i > 0 || l).join('\n')}</pre>
    </div>
  );
}

function ApproveDialog({ x, d, onClose }: { x: OutreachDraft; d: LinkBuildingData; onClose: () => void }) {
  const { org, site, can } = useSitePage();
  const approve = useApproveOutreach(org.id, site.id);
  const dismiss = useDismissOutreach(org.id, site.id);
  const member = can('member');
  const active = d.mailboxes.filter((m) => m.status === 'active');
  const [mailboxId, setMailboxId] = useState<string | null>(sendingMailbox(d)?.id ?? null);
  const mb = active.find((m) => m.id === mailboxId) ?? sendingMailbox(d);
  const [toEmail, setToEmail] = useState(x.contacts[0]?.email ?? '');
  const [steps, setSteps] = useState<OutreachStep[]>(() => x.steps.map((s) => ({ ...s })));
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contact = x.contacts.find((c) => c.email === toEmail);
  // the consent rule depends on the address chosen (a named person in the UAE needs it, editor@ does not)
  const gate = useMemo(() => consentGate(x.country, toEmail), [x.country, toEmail]);
  const first = steps[0];
  const invalid = !toEmail || !first?.subject.trim() || steps.some((s) => !s.body.trim());
  const blocked = !d.canSend.ok || (gate.needed && !consent);
  const setStep = (i: number, patch: Partial<OutreachStep>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const submit = () => {
    setError(null);
    approve.mutate(
      { prospectDomain: x.prospectDomain, type: x.type, toEmail, steps: steps.map((s) => ({ ...s, subject: s.subject.trim(), body: s.body.trim() })), consent: gate.needed ? consent : false, mailboxId: mb?.id ?? null },
      {
        onSuccess: () => {
          toast.success(`Approved: the first e-mail to ${x.prospectDomain} goes out in your sending window`);
          onClose();
        },
        onError: (e) => {
          setError(errorMessage(e));
          toast.error(errorMessage(e));
        },
      },
    );
  };
  const notFit = () =>
    dismiss.mutate(
      { prospectDomain: x.prospectDomain, type: x.type },
      {
        onSuccess: () => {
          toast.success(`${x.prospectDomain}: marked not a fit`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={member ? `Review the pitch to ${x.prospectDomain}` : `The pitch to ${x.prospectDomain}`}
      description={`${typeLabel(x.type)}${x.country ? ` · ${x.country}` : ''}${x.language ? ` · ${x.language}` : ''} · ${steps.length} ${steps.length === 1 ? 'e-mail' : 'e-mails'} in one thread, stops at the first reply`}
      footer={
        member ? (
          <>
            <Button variant="ghost" className="mr-auto" icon={<CircleSlash className="size-4" />} loading={dismiss.isPending} onClick={notFit}>
              Not a fit
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<MailCheck className="size-4" />} loading={approve.isPending} disabled={invalid || blocked} onClick={submit}>
              Approve and schedule
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {!d.canSend.ok && (
          <Callout
            tone="warning"
            title="This pitch cannot go out yet"
            action={
              can('admin') && d.canSend.why.toLowerCase().includes('mailbox') ? (
                <>
                  <ButtonLink size="sm" variant="secondary" to={paths.settings(org.id, 'mailboxes')}>
                    Mailboxes
                  </ButtonLink>
                  <GuideButton id="mailbox-connect" label="How to connect it" />
                </>
              ) : undefined
            }
          >
            {d.canSend.why}
          </Callout>
        )}
        {x.type === 'press' && x.deadline && (
          <Callout tone="warning" title={`Journalist deadline: ${x.deadline}`}>
            Requests close fast: approve today so the answer goes out in the next sending window.
          </Callout>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="To" hint={contact?.sourceUrl ? <>Found on <ExternalLink href={contact.sourceUrl}>{urlPath(contact.sourceUrl)}</ExternalLink></> : undefined}>
            {(f) => (
              <Select {...f} value={toEmail} disabled={!member} onChange={(e) => setToEmail(e.target.value)}>
                {x.contacts.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.email} · {CONTACT_KIND[c.kind].toLowerCase()}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From" hint={mb ? `Sends ${windowText(mb)}, a few minutes apart` : undefined}>
            {(f) =>
              active.length > 1 && member ? (
                <Select {...f} value={mb?.id ?? ''} onChange={(e) => setMailboxId(e.target.value)}>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fromName} · {m.fromEmail}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input {...f} readOnly value={mb ? `${mb.fromName} <${mb.fromEmail}>` : 'No active mailbox'} />
              )
            }
          </Field>
        </div>

        <ol className="space-y-5">
          {steps.map((s, i) => {
            const subject = i === 0 ? s.subject : replySubject(steps[0]?.subject ?? '');
            const w = words(s.body);
            const target = i === 0 ? '80-130 words work best' : '40-70 words work best';
            return (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <IconTile size="xs" tone={i === 0 ? 'solid' : 'blue'}>
                    <Mail />
                  </IconTile>
                  <span className="text-sm font-semibold text-ink">{i === 0 ? 'First e-mail' : `Follow-up ${i}`}</span>
                  {i > 0 && (
                    <span className="text-xs text-ink-3">
                      sent {s.waitDays} working {s.waitDays === 1 ? 'day' : 'days'} later in the same thread, only if there is no reply
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {i === 0 ? (
                    <Field label="Subject" hint={`${s.subject.trim().length} characters · 36-50 work best`}>
                      {(f) => <Input {...f} value={s.subject} maxLength={140} readOnly={!member} onChange={(e) => setStep(i, { subject: e.target.value })} />}
                    </Field>
                  ) : (
                    <p className="text-[13px] text-ink-3">
                      Subject: <span className="text-ink-2">{subject}</span>
                    </p>
                  )}
                  <Field label="Text" hint={`${w} ${w === 1 ? 'word' : 'words'} · ${target}`}>
                    {(f) => <Textarea {...f} rows={i === 0 ? 8 : 5} maxLength={6000} value={s.body} readOnly={!member} onChange={(e) => setStep(i, { body: e.target.value })} />}
                  </Field>
                  <FooterPreview mb={mb} first={i === 0} country={x.country} foundOn={contact?.sourceUrl ?? ''} />
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-[13px] leading-relaxed text-ink-3">
          The app adds the footer itself: who is writing, your postal address and a way to say no. The law asks for them (CAN-SPAM, GDPR, PECR), and an address that says no is never written to again. Plain text, no tracking, sent from your own mailbox with a copy in your Sent folder.
        </p>

        {gate.needed && (
          <Callout tone="warning" title="Consent needed for this recipient">
            <p>{gate.why}</p>
            {member && (
              <Checkbox className="mt-2.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} label="I have their consent or we already work together" />
            )}
          </Callout>
        )}
        {error && <Callout tone="critical">{error}</Callout>}
      </div>
    </Dialog>
  );
}

/** A compact line for the hero / settings: what approval means here. */
export function approvalLine(d: LinkBuildingData) {
  return d.settings.mode === 'auto'
    ? `Automatic: up to ${d.settings.autoDailyMax} pitches a day with a contact and a good fit are approved for you; consent-gated recipients always wait for a person.`
    : 'Nothing goes out until someone approves it: every pitch is sent from your own mailbox, a few a day, and stops at the first reply.';
}

export const draftCounts = (d: LinkBuildingData) => {
  const live = d.drafts.filter((x) => x.status !== 'not_fit' && !SETTLED.has(x.prospectStatus));
  return { live: live.length, drafted: live.filter((x) => x.status === 'drafted' && x.steps.length).length, press: live.filter((x) => x.type === 'press').length };
};

