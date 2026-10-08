import { useState } from 'react';
import { toast } from 'sonner';
import { MailX, PauseCircle, Play, Workflow } from 'lucide-react';
import { formatUsd } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { Stagger } from '@/components/insight';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useSiteAdmin, useSiteData } from '@/lib/queries';
import { AlwaysOn } from './_components/pipeline/always-on';
import { HowItWorks, NeedsYou, needsYouOf, PipelineHero, ThisWeek } from './_components/pipeline/home';
import { PipelineSettingsButton } from './_components/pipeline/controls';
import { LadderCards } from './_components/pipeline/ladders';
import { Calendar, RecentActivity } from './_components/pipeline/schedule';
import { WriteNowDialog, type WriteNowItem } from './_components/pipeline/WriteNowDialog';

// The website's Pipeline (PIPELINE_FEATURE_SPEC.md §4.1): this week's runs, what needs the person, one card per keyword ladder,
// the always-on part (opportunity posts, monitoring, the weekly capacity), how a ladder works, the next four weeks and what ran.

export default function PipelinePage() {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  // while a ladder is being planned the page looks again every 30 s, so its card replaces the "Planning" placeholder
  const q = useSiteData(org.id, site.id, 'pipeline', undefined, { refetchInterval: (query) => (query.state.data?.activeRuns?.some((r) => r.mode === 'ladder') ? 30_000 : false) });
  const admin = useSiteAdmin(org.id, site.id);
  const [writing, setWriting] = useState<WriteNowItem | null>(null);

  if (q.isPending)
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-20" />
        <Skeleton className="h-[300px] rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const status = d.tracking.status;
  const cards = d.ladderCards ?? [];
  const needs = needsYouOf(d);

  const pauseResume = (action: 'pause' | 'resume') =>
    admin.mutate(
      { action },
      {
        onSuccess: () => {
          toast.success(action === 'pause' ? 'Pipeline paused: no automatic runs until you resume' : 'Pipeline resumed');
          q.refetch();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div>
      <PageHeader
        icon={<Workflow />}
        title="Pipeline"
        description={`Everything that runs on its own for ${site.domain}: your keyword ladders, the always-on posts and checks, and what happens when. You publish the pages; the rest runs every week.`}
        actions={
          <>
            {status === 'active' ? <StatusBadge tone="good">Autopilot on</StatusBadge> : status === 'paused' ? <StatusBadge tone="warning">Paused</StatusBadge> : <Badge>Not started</Badge>}
            <span className="text-[13px] text-ink-3">about {formatUsd(d.monthlyCostUsd)} / month</span>
            {can('admin') && d.tracking.verified && <PipelineSettingsButton automation={d.automation} autoStartEnabled={d.autoStartEnabled !== false} />}
            {can('admin') && status === 'active' && (
              <Button variant="secondary" size="sm" icon={<PauseCircle className="size-4" />} loading={admin.isPending} onClick={() => pauseResume('pause')}>
                Pause
              </Button>
            )}
            {can('admin') && status === 'paused' && (
              <Button size="sm" icon={<Play className="size-4" />} loading={admin.isPending} onClick={() => pauseResume('resume')}>
                Resume
              </Button>
            )}
          </>
        }
      />

      <Stagger className="space-y-6">
        {status === 'not_started' && (
          <Callout
            tone="info"
            title="Start the autopilot"
            action={
              can('admin') && (
                <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} size="sm" icon={<Play className="size-4" />}>
                  Start tracking
                </ButtonLink>
              )
            }
          >
            Weekly tracking switches the pipeline on: Search Console and GA4 reports, rank checks, AI-visibility and backlink checks, monthly audits and your weekly posts.
          </Callout>
        )}
        {status !== 'not_started' && !d.tracking.reportsToThisApp && (
          <Callout
            tone="warning"
            title="The weekly results are not routed to this dashboard yet"
            action={
              can('admin') && (
                <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} size="sm" variant="secondary">
                  Save tracking settings
                </ButtonLink>
              )
            }
          >
            The SEO engine tracked this site before it joined the platform. Save the tracking settings once and every Monday report, post and alert lands here.
          </Callout>
        )}
        {!d.tracking.engineEmails && (
          <p className="flex items-center gap-2 text-[13px] text-ink-3">
            <MailX className="size-4 shrink-0" />
            No e-mails: every result of the pipeline arrives here, under Reports and Runs.
          </p>
        )}

        <PipelineHero data={d} needs={needs} cards={cards} onWrite={setWriting} />

        <div className={needs.length ? 'grid gap-4 xl:grid-cols-2 xl:items-start' : ''}>
          <NeedsYou items={needs} onWrite={setWriting} />
          <ThisWeek data={d} />
        </div>

        <LadderCards cards={cards} automation={d.automation} planning={(d.activeRuns ?? []).filter((r) => r.mode === 'ladder')} />

        <AlwaysOn data={d} cards={cards} onWrite={setWriting} />

        <HowItWorks data={d} cards={cards} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <Calendar data={d} />
          <RecentActivity data={d} />
        </div>
      </Stagger>

      {writing && <WriteNowDialog item={writing} onClose={() => setWriting(null)} />}
    </div>
  );
}
