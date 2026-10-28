import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CheckCircle2, FileText, Mail, MessageSquareWarning, Plus, Stamp } from 'lucide-react';
import { isClientRole, type ApprovalCandidate, type ApprovalView } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Select, Textarea } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useApprovalCandidates, useApprovalMutations, useApprovals } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';

/**
 * G5 (WHITE_LABEL.md §2, §4): what the agency asked the client to approve, written pages and outreach drafts, and the client's
 * decisions. Client approvers approve or ask for changes; client viewers follow along; the agency asks and withdraws. With "client
 * approval required" on, the agency cannot publish a page live or send an outreach draft until it is approved here.
 */
export default function ApprovalsPage() {
  const { org, role, can } = useOrgCtx();
  const q = useApprovals(org.id);
  const staff = !isClientRole(role) && can('member');
  const [asking, setAsking] = useState(false);
  if (org.kind !== 'client')
    return (
      <div>
        <PageHeader icon={<Stamp />} title="Approvals" />
        <Card>
          <EmptyState icon={<Stamp className="size-5" />} title="Approvals live in client workspaces" description="Open a client from the Clients page to ask them to approve pages and outreach." />
        </Card>
      </div>
    );
  const items = q.data?.items ?? [];
  const pending = items.filter((i) => i.status === 'pending');
  const decided = items.filter((i) => i.status !== 'pending');
  return (
    <div>
      <PageHeader
        icon={<Stamp />}
        title="Approvals"
        description={isClientRole(role) ? 'Pages and outreach your agency would like you to approve before they go out.' : 'What you asked this client to approve, and what they decided.'}
        actions={
          staff ? (
            <Button icon={<Plus className="size-4" />} onClick={() => setAsking(true)}>
              Ask for approval
            </Button>
          ) : undefined
        }
      />
      {org.clientApproval && (
        <Callout tone="info" className="mb-5">
          {isClientRole(role) ? 'Nothing is published or sent before it is approved here.' : 'This client approves first: a page cannot go live and an outreach draft cannot be sent until it is approved here.'}
        </Callout>
      )}
      {q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      ) : !q.data ? (
        <Skeleton className="h-60" />
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="Nothing waiting"
            description={isClientRole(role) ? 'When your agency asks you to approve a page or an outreach e-mail, it appears here.' : 'Ask the client to approve a written page or an outreach draft.'}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="pending-h">
            <h2 id="pending-h" className="mb-3 font-display text-base font-semibold tracking-[-0.01em] text-ink">
              Waiting for a decision ({pending.length})
            </h2>
            {pending.length ? (
              <ul className="space-y-3">
                {pending.map((a) => (
                  <ApprovalItem key={a.id} a={a} canDecide={q.data.canDecide} staff={staff} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">Nothing is waiting.</p>
            )}
          </section>
          {decided.length > 0 && (
            <section aria-labelledby="decided-h">
              <h2 id="decided-h" className="mb-3 font-display text-base font-semibold tracking-[-0.01em] text-ink">
                Decided
              </h2>
              <ul className="space-y-3">
                {decided.map((a) => (
                  <ApprovalItem key={a.id} a={a} canDecide={false} staff={false} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      {staff && <AskDialog open={asking} onOpenChange={setAsking} />}
    </div>
  );
}

function ApprovalItem({ a, canDecide, staff }: { a: ApprovalView; canDecide: boolean; staff: boolean }) {
  const { org } = useOrgCtx();
  const m = useApprovalMutations(org.id);
  const [changes, setChanges] = useState(false);
  const [note, setNote] = useState('');
  const decide = (decision: 'approved' | 'changes_requested') =>
    m.decide.mutate(
      { id: a.id, decision, note },
      {
        onSuccess: () => {
          toast.success(decision === 'approved' ? 'Approved' : 'Your changes were sent to the agency');
          setChanges(false);
          setNote('');
        },
        onError: (e) => toastError(e),
      },
    );
  return (
    <li>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge icon={a.kind === 'page' ? <FileText className="size-3" aria-hidden /> : <Mail className="size-3" aria-hidden />}>{a.kind === 'page' ? 'Page' : 'Outreach'}</Badge>
                {a.status === 'approved' && <StatusBadge tone="good">Approved</StatusBadge>}
                {a.status === 'changes_requested' && <StatusBadge tone="warning">Changes asked</StatusBadge>}
                {a.status === 'pending' && <StatusBadge tone="accent">Waiting</StatusBadge>}
                {a.siteDomain && <span className="text-xs text-ink-3">{a.siteDomain}</span>}
              </div>
              <p className="font-medium text-ink">{a.title}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                Asked {fmtAgo(a.requestedAt)}
                {a.requestedBy ? ` by ${a.requestedBy}` : ''}
              </p>
            </div>
            {a.reportId && (
              <Link to={paths.report(org.id, a.reportId)} className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-accent-text hover:bg-accent-soft">
                Read the page
              </Link>
            )}
          </div>
          {a.note && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{a.note}</p>}
          {a.decidedAt && (
            <p className="text-[13px] text-ink-2">
              {a.status === 'approved' ? 'Approved' : 'Changes asked'} {fmtAgo(a.decidedAt)}
              {a.decidedBy ? ` by ${a.decidedBy}` : ''}
              {a.decisionNote ? `: "${a.decisionNote}"` : ''}
            </p>
          )}
          {canDecide && a.status === 'pending' && (
            <div className="space-y-3 border-t border-line pt-3">
              {changes && (
                <Field label="What should change?">
                  {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} autoFocus />}
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                {!changes ? (
                  <>
                    <Button icon={<CheckCircle2 className="size-4" />} loading={m.decide.isPending} onClick={() => decide('approved')}>
                      Approve
                    </Button>
                    <Button variant="secondary" icon={<MessageSquareWarning className="size-4" />} onClick={() => setChanges(true)}>
                      Ask for changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button loading={m.decide.isPending} disabled={!note.trim()} onClick={() => decide('changes_requested')}>
                      Send to the agency
                    </Button>
                    <Button variant="ghost" onClick={() => setChanges(false)}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          {staff && a.status === 'pending' && (
            <div className="border-t border-line pt-3">
              <Button size="sm" variant="ghost" loading={m.withdraw.isPending} onClick={() => m.withdraw.mutate(a.id, { onSuccess: () => toast.success('Request withdrawn'), onError: (e) => toastError(e) })}>
                Withdraw request
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </li>
  );
}

function AskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { org } = useOrgCtx();
  const cands = useApprovalCandidates(org.id, open);
  const m = useApprovalMutations(org.id);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const items = cands.data?.items ?? [];
  const chosen: ApprovalCandidate | undefined = items.find((c) => `${c.kind}:${c.itemId}` === pick);
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setPick('');
      setNote('');
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Ask the client for approval"
      description="Their approvers see it in their portal. Asking again about the same item replaces the earlier request."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            loading={m.request.isPending}
            onClick={() =>
              chosen &&
              m.request.mutate(
                { kind: chosen.kind, itemId: chosen.itemId, siteId: chosen.siteId, title: chosen.title, note },
                { onSuccess: () => (toast.success('Sent to the client'), close(false)), onError: (e) => toastError(e) },
              )
            }
          >
            Ask for approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {cands.isError ? (
          <ErrorState error={cands.error} />
        ) : !cands.data ? (
          <Skeleton className="h-10" />
        ) : !items.length ? (
          <Callout tone="info">No written pages from the last 60 days and no outreach drafts waiting in this workspace.</Callout>
        ) : (
          <Field label="What should they approve?">
            {(p) => (
              <Select {...p} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choose a page or an outreach draft</option>
                {items.map((c) => (
                  <option key={`${c.kind}:${c.itemId}`} value={`${c.kind}:${c.itemId}`}>
                    {c.kind === 'page' ? 'Page' : 'Outreach'} · {c.title}
                    {c.siteDomain ? ` (${c.siteDomain})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Note for the client" optional>
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="For example: please check the prices in the second section." />}
        </Field>
      </div>
    </Dialog>
  );
}
