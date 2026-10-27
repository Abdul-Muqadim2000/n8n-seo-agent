// Steps on your website (app/docs/SITE_TASKS.md, 2026-10-28): the things only the client can change on their own website, each checked by
// us. The Pipeline lists them all (to do highlighted, done ticked with when and how we know, skipped muted); Recommendations and the AI
// page reuse the check button. "I've done it, check now" reads the website at once; we also look again every day on our own.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, CircleDashed, ListChecks, RotateCcw, SkipForward, TriangleAlert } from 'lucide-react';
import { siteTaskCheckLine, type SiteTask } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { InsightItem } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { noRetryOn4xx } from '@/lib/queries';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { fmtDate } from '@/lib/utils';
import { Panel } from '@/pages/site/_components/kit';

const tasksKey = (siteId: string) => ['site', siteId, 'tasks'] as const;

/** The anchor of one step on the Pipeline (its Needs-you button scrolls there). */
export const siteTaskAnchor = (key: string) => `site-task-${key.replace(/[^a-z0-9]+/gi, '-')}`;

/** The website's steps (GET …/tasks), for the pages that do not get them with their own data (the AI page). */
export function useSiteTasks(enabled = true) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  return useQuery({
    queryKey: tasksKey(site.id),
    queryFn: () => api<{ tasks: SiteTask[] }>(`/api/orgs/${org.id}/sites/${site.id}/tasks`).then((r) => r.tasks),
    enabled: enabled && !!site.verifiedAt,
    // an older server (no tasks endpoint) answers 404 at once, so the AI page falls back without waiting through retries
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });
}

/** Check, skip or bring back one step; refreshes every page of the website that shows it (Pipeline, Recommendations, AI page). */
function useTaskAction() {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, action }: { key: string; action: 'check' | 'skip' | 'restore' }) =>
      api<{ task: SiteTask }>(`/api/orgs/${org.id}/sites/${site.id}/tasks/${action}`, { method: 'POST', body: { key } }).then((r) => ({ action, task: r.task })),
    onSuccess: ({ action, task }) => {
      if (action === 'check') {
        if (task.state === 'done') toast.success(`Done: ${task.title}`);
        else toast.warning(task.lastCheck?.message ?? 'Not done yet');
      } else toast.success(action === 'skip' ? 'Skipped. You can bring it back below.' : 'Back on your to-do list');
      void qc.invalidateQueries({ queryKey: ['site', site.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** "I've done it, check now" for one step (members and above), as a button on its own (Recommendations). */
export function SiteTaskCheckButton({ taskKey, label = "I've done it, check now", variant = 'secondary' }: { taskKey: string; label?: string; variant?: 'primary' | 'secondary' }) {
  const { can } = useOrgCtx();
  const act = useTaskAction();
  if (!can('member')) return null;
  return (
    <Button size="sm" variant={variant} loading={act.isPending} icon={<CheckCircle2 className="size-4" />} onClick={() => act.mutate({ key: taskKey, action: 'check' })}>
      {label}
    </Button>
  );
}

function stateMeta(t: SiteTask) {
  if (t.state === 'done') return <StatusBadge tone="good">Done</StatusBadge>;
  if (t.state === 'skipped') return <Badge>Skipped</Badge>;
  if (t.reopened) return <StatusBadge tone="warning">Needed again</StatusBadge>;
  return <StatusBadge tone={t.severity === 'warning' ? 'warning' : 'accent'}>To do</StatusBadge>;
}

/** One step: what to do, the values to copy, how we know where it stands, and its buttons. */
export function SiteTaskRow({ task }: { task: SiteTask }) {
  const { can } = useOrgCtx();
  const { site } = useSiteCtx();
  const act = useTaskAction();
  // one action at a time per step: every button of the row waits while one runs
  const busy = act.isPending && act.variables?.key === task.key;
  const todo = task.state === 'todo';
  const check = task.lastCheck;
  const line = check ? siteTaskCheckLine(check, (iso) => fmtDate(iso)) : null;
  const description = (
    <div className="space-y-2 text-[13px] leading-snug text-ink-2">
      {task.state === 'skipped' ? (
        <p>
          Skipped{task.skipped?.who ? ` by ${task.skipped.who}` : ''} on {fmtDate(task.skipped?.at ?? '')}. We do not check it or ask for it while it is skipped.
        </p>
      ) : (
        <p>{task.detail}</p>
      )}
      {todo && task.values.length > 0 && (
        <dl className="grid gap-1.5 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-3">
          {task.values.map((v) => (
            <div key={v.label} className="contents">
              <dt className="text-ink-3">{v.label}</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink">{v.value}</code>
                <CopyButton text={v.value} label="Copy" ariaLabel={`Copy ${v.label.toLowerCase()}`} className="shrink-0" />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {check && task.state !== 'skipped' && (
        <p className={todo ? 'text-warning-text' : 'text-good-text'}>
          {todo && task.reopened && task.doneAt ? `It was done on ${fmtDate(task.doneAt)}. ` : ''}
          {line}: {check.message}
        </p>
      )}
      {!check && todo && <p className="text-ink-3">{can('member') ? 'Not checked yet. We look every day on our own, or press the button once it is done.' : 'Not checked yet. We look every day on our own.'}</p>}
    </div>
  );
  return (
    <InsightItem
      tone={task.state === 'done' ? 'good' : task.state === 'skipped' ? 'neutral' : task.severity === 'warning' || task.reopened ? 'warning' : 'blue'}
      icon={task.state === 'done' ? <CheckCircle2 className="size-4" /> : task.state === 'skipped' ? <SkipForward className="size-4" /> : task.reopened ? <TriangleAlert className="size-4" /> : <CircleDashed className="size-4" />}
      meta={stateMeta(task)}
      title={task.title}
      description={description}
      id={siteTaskAnchor(task.key)}
      className={todo ? 'scroll-mt-24 bg-warning-soft/40 hover:bg-warning-soft/60' : 'scroll-mt-24'}
      actionPosition="below"
      action={
        <span className="flex flex-wrap items-center gap-1.5">
          {todo && can('member') && (
            <Button size="sm" variant={task.severity === 'warning' || task.reopened ? 'primary' : 'secondary'} disabled={busy} loading={busy && act.variables?.action === 'check'} icon={<CheckCircle2 className="size-4" />} onClick={() => act.mutate({ key: task.key, action: 'check' })}>
              I&apos;ve done it, check now
            </Button>
          )}
          {task.state === 'done' && can('member') && (
            <Button size="sm" variant="ghost" disabled={busy} loading={busy && act.variables?.action === 'check'} onClick={() => act.mutate({ key: task.key, action: 'check' })}>
              Check again
            </Button>
          )}
          {todo && (
            <GuideButton
              id={task.guide}
              vars={{ domain: site.domain, ...task.guideVars }}
              label="Show me how"
              finish={can('member') ? { label: "I've done it, check now", onClick: () => act.mutate({ key: task.key, action: 'check' }) } : undefined}
            />
          )}
          {todo && can('member') && (
            <Button size="sm" variant="ghost" icon={<SkipForward className="size-4" />} disabled={busy} loading={busy && act.variables?.action === 'skip'} onClick={() => act.mutate({ key: task.key, action: 'skip' })}>
              Skip
            </Button>
          )}
          {task.state === 'skipped' && can('member') && (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} disabled={busy} loading={busy && act.variables?.action === 'restore'} onClick={() => act.mutate({ key: task.key, action: 'restore' })}>
              Bring it back
            </Button>
          )}
        </span>
      }
    />
  );
}

/** The Pipeline's panel: every step on the website, to do first (highlighted), then done, then skipped. */
export function SiteTasksPanel({ tasks }: { tasks: readonly SiteTask[] | undefined }) {
  if (!tasks?.length) return null;
  const todo = tasks.filter((t) => t.state === 'todo').length;
  const done = tasks.filter((t) => t.state === 'done').length;
  const important = tasks.some((t) => t.state === 'todo' && (t.severity === 'warning' || t.reopened));
  return (
    <section id="site-tasks" aria-label="Steps on your website" className="min-w-0 scroll-mt-24">
      <Panel
        flush
        className={todo ? (important ? 'border-warning' : 'border-warning/50') : undefined}
        icon={<ListChecks />}
        iconTone={todo ? 'warning' : 'good'}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Steps on your website
            {todo > 0 && <span className="rounded-full bg-warning-soft px-2 text-xs font-semibold tabular text-warning-text">{todo} to do</span>}
            {done > 0 && <span className="rounded-full bg-good-soft px-2 text-xs font-semibold tabular text-good-text">{done} done</span>}
          </span>
        }
        description="Changes only you can make on your own website. We check each one ourselves, every day, and tick it off when it is in place."
      >
        <ul className="divide-y divide-line border-t border-line">
          {tasks.map((t) => (
            <SiteTaskRow key={t.key} task={t} />
          ))}
        </ul>
      </Panel>
    </section>
  );
}
