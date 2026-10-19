import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ExternalLink, TicketPlus } from 'lucide-react';
import { INTEGRATION_LABELS, ISSUE_STATE_LABELS, issueSourceKey, type IssueLinkView, type IssueState, type TrackerKind } from '@seo/shared';
import { StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { issueFor, useCreateIssue, useIssues, useRefreshIssues } from '@/lib/integrations';

/**
 * G4, "Create ticket" beside an audit finding or a recommendation, once the company connected Jira, Linear or Asana. After the
 * ticket exists the button becomes its key and its state in the tracker (to do / in progress / done), linking to it. One finding =
 * one ticket: the server answers the existing ticket when the same finding is pushed again.
 */

export type TicketSource = { type: 'finding'; auditId: string; findingKey: string } | { type: 'recommendation'; id: string };
const STATE_TONE: Record<IssueState, Tone> = { todo: 'neutral', in_progress: 'accent', done: 'good', unknown: 'neutral' };

export function TicketChip({ issue }: { issue: IssueLinkView }) {
  return (
    <a
      href={issue.remoteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium text-accent-text hover:underline"
      title={`${INTEGRATION_LABELS[issue.kind]}: ${issue.remoteStatus || ISSUE_STATE_LABELS[issue.remoteState]}`}
    >
      {issue.remoteKey || 'Ticket'}
      <StatusBadge tone={STATE_TONE[issue.remoteState]}>{issue.remoteStatus || ISSUE_STATE_LABELS[issue.remoteState]}</StatusBadge>
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

export function TicketButton({ siteId, source, label = 'Create ticket' }: { siteId: string; source: TicketSource; label?: string }) {
  const { org, can } = useOrgCtx();
  // G5: tickets are the agency's own work: a client person neither sees nor reads them (the route refuses client roles)
  const q = useIssues(org.id, siteId, can('viewer'));
  const create = useCreateIssue(org.id, siteId);
  const trackers = q.data?.trackers ?? [];
  if (!trackers.length) return null;
  const key = issueSourceKey(siteId, source.type === 'finding' ? { type: 'finding', findingKey: source.findingKey } : { type: 'recommendation', id: source.id });
  const issue = issueFor(q.data?.items, key);
  if (issue) return <TicketChip issue={issue} />;
  if (!can('member')) return null;
  const go = async (kind: TrackerKind) => {
    try {
      const r = await create.mutateAsync({ websiteId: siteId, kind, source });
      toast.success(r.existing ? `Already in ${INTEGRATION_LABELS[kind]}: ${r.issue.remoteKey}` : `Created ${r.issue.remoteKey} in ${INTEGRATION_LABELS[kind]}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (trackers.length === 1)
    return (
      <Button size="sm" variant="ghost" icon={<TicketPlus />} loading={create.isPending} onClick={() => void go(trackers[0]!.kind)} title={`Create a ticket in ${trackers[0]!.name}${trackers[0]!.target ? ` (${trackers[0]!.target})` : ''}`}>
        {label}
      </Button>
    );
  return (
    <span className="inline-flex flex-wrap gap-1">
      {trackers.map((t) => (
        <Button key={t.kind} size="sm" variant="ghost" icon={<TicketPlus />} loading={create.isPending && create.variables?.kind === t.kind} onClick={() => void go(t.kind)}>
          {INTEGRATION_LABELS[t.kind].replace(' Cloud', '')}
        </Button>
      ))}
    </span>
  );
}

/** Reads the state of this website's tickets back from the tracker once when the page opens (at most every 5 minutes server-side). */
export function useTicketStates(siteId: string): boolean {
  const { org, can } = useOrgCtx();
  // G5: tickets are the agency's own work: a client person neither sees nor reads them (the route refuses client roles)
  const q = useIssues(org.id, siteId, can('viewer'));
  const refresh = useRefreshIssues(org.id, siteId);
  const done = useRef(false);
  const has = can('member') && !!q.data?.items.some((i) => i.status === 'created');
  useEffect(() => {
    if (!has || done.current) return;
    done.current = true;
    refresh.mutate();
  }, [has, refresh]);
  return !!q.data?.trackers.length;
}
