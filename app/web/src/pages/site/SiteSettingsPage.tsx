import { useState, type ReactNode } from 'react';
import { AutopilotLevelPicker } from '@/components/site/AutopilotLevel';
import { forecastPlanOf } from '@/lib/forecast-plan';
import { useCycleDay } from '@/lib/cycle-day';
import { YourWeek } from './_components/pipeline/your-week';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Building2, CalendarClock, FolderTree, KeyRound, PauseCircle, PenSquare, PlayCircle, Radar, Settings, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { cleanDomain, CONTENT_GROUPS_MAX, contentGroupSchema, type AdminResult, type ContentGroup, type MonitorSettings, type SiteSettingsData } from '@seo/shared';
import { creditsLabel, quoteLabel } from '@/lib/credits';
import { EmailVerifyNotice } from '@/components/site/EmailVerifyNotice';
import { competitorValidator } from '@/components/site/helpers';
import { completeMonitors, MonitoringCost, MonitorSettingsFields } from '@/components/site/MonitorSettingsFields';
import { aiMeasuredFrom } from '@/components/site/AiPrecision';
import { ProfileForm, profileSavedToast, useSaveProfile } from '@/components/site/ProfileForm';
import { businessOnly, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { BLOG_OPTIONS, blogMonthlyCost, trackDefaults, TrackingForm, type TrackFormOutput } from '@/components/site/TrackingForm';
import { VerificationPanel } from '@/components/site/VerificationPanel';
import { PublishingSettings } from '@/components/site/cms/PublishingSettings';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { KeyValue, PageHeader } from '@/components/ui/misc';
import { IconTile } from '@/components/insight';
import { Dialog } from '@/components/ui/overlay';
import { LinkTabs, Segmented } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { GuideButton } from '@/components/guide';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { autopilotGuideVars } from '@/lib/guide-vars';
import { errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { qk, useDeleteSite, useSiteAdmin, useSiteData, useStartRun, useUpdateSite } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';

const TABS = [
  { id: 'business', label: 'Business details', description: 'What the engine knows about your business. Every page, report and AI-visibility question starts here.' },
  { id: 'verification', label: 'Verification & Google', description: 'Ownership of the website and the Search Console and GA4 connection.' },
  { id: 'tracking', label: 'Tracking & monitors', description: 'Weekly tracking, pages a week for your keyword and the growth monitors, with the credits they use.' },
  { id: 'autopilot', label: 'Autopilot', description: 'How much we do on our own, and the weekday your weekly run starts on.' },
  { id: 'profile', label: 'Author & profile', description: 'The author, reviewer and business details behind every byline, author box and schema.' },
  { id: 'publishing', label: 'Publishing', description: 'Your CMS: written pages go to it as drafts from their report, and live only when an owner or admin chooses.' },
  { id: 'danger', label: 'Delete', description: 'Remove this website from your company.' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const TRACK_FORM_ID = 'site-settings-tracking';

export default function SiteSettingsPage() {
  const { tab } = useParams();
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const admin = can('admin');
  const tabs = TABS.filter((t) => t.id !== 'danger' || admin);
  const current = tabs.find((t) => t.id === tab);
  // older links (and the server's Needs-you items) name the autopilot tab "automation"
  if (tab === 'automation') return <Navigate to={paths.site(org.id, site.id, 'settings/autopilot')} replace />;
  if (!current) return <Navigate to={paths.site(org.id, site.id, 'settings/business')} replace />;

  return (
    <div>
      <PageHeader icon={<Settings />} title="Website settings" description={current.description} />
      <LinkTabs className="mb-6" items={tabs.map((t) => ({ to: paths.site(org.id, site.id, `settings/${t.id}`), label: t.label }))} />
      {!admin && (
        <Callout tone="info" className="mb-6">
          You can view these settings. Only admins of {org.name} can change them.
        </Callout>
      )}
      <TabContent tab={current.id} admin={admin} />
    </div>
  );
}

function TabContent({ tab, admin }: { tab: TabId; admin: boolean }) {
  const { site } = useSiteCtx();
  switch (tab) {
    case 'business':
      return <BusinessTab admin={admin} />;
    case 'verification':
      return <VerificationTab admin={admin} />;
    case 'tracking':
      return site.verifiedAt ? <TrackingTab admin={admin} /> : <VerifyFirst what="Tracking and the growth monitors" />;
    case 'profile':
      return site.verifiedAt ? <ProfileTab admin={admin} /> : <VerifyFirst what="The author and business profile" />;
    case 'autopilot':
      return site.verifiedAt ? <AutopilotTab admin={admin} /> : <VerifyFirst what="The autopilot settings" />;
    case 'publishing':
      return site.verifiedAt ? <PublishingSettings admin={admin} /> : <VerifyFirst what="Publishing to your CMS" />;
    case 'danger':
      return <DangerTab />;
  }
}

/** Data-backed tabs answer 403 before verification: say why and link to the verification tab. */
function VerifyFirst({ what }: { what: string }) {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  return (
    <Card>
      <EmptyState
        icon={<ShieldAlert className="size-5" />}
        title={`Verify ${site.domain} first`}
        description={`${what} open once you have confirmed that the website belongs to your company. It takes about two minutes.`}
        action={
          can('admin') ? (
            <ButtonLink to={paths.site(org.id, site.id, 'settings/verification')}>Verify ownership</ButtonLink>
          ) : (
            <span className="text-sm text-ink-3">Ask an admin of your company to verify it.</span>
          )
        }
      />
    </Card>
  );
}

// ---------------- business ----------------

function BusinessTab({ admin }: { admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const update = useUpdateSite(org.id, site.id);
  return (
    <Card className="max-w-3xl">
      <CardHeader
        icon={<HeaderTile icon={<Building2 />} />}
        title="Business details"
        description="Only real facts: the engine never invents prices, numbers or claims, it uses what is written here."
      />
      <CardBody>
        <SiteBusinessForm
          key={site.id}
          mode="edit"
          site={site}
          readOnly={!admin}
          showSubmit
          submitting={update.isPending}
          onSubmit={async (v) => {
            await update.mutateAsync(businessOnly(v));
            toast.success('Business details saved', { description: 'New pages, reports and checks use them from now on.' });
          }}
        />
      </CardBody>
    </Card>
  );
}

// ---------------- verification ----------------

function VerificationTab({ admin }: { admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  return (
    <div className="max-w-4xl space-y-4">
      {!site.verifiedAt && (
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Confirm that you own {site.domain}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            We only show a website's data to the company that owns it. Then connect Search Console and GA4 by adding our read-only service account.
          </p>
        </div>
      )}
      <VerificationPanel orgId={org.id} site={site} canEdit={admin} />
    </div>
  );
}

// ---------------- tracking ----------------

function useTrackRun() {
  const { org, me } = useOrgCtx();
  const { site } = useSiteCtx();
  const start = useStartRun(org.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const run = async (v: TrackFormOutput, wasTracked: boolean) => {
    const r = await start.mutateAsync({ mode: 'track', siteId: site.id, ...v, emailCopy: true });
    if (r.status === 'failed') throw new Error(r.error || 'The SEO engine did not accept the request. Try again in a minute.');
    qc.invalidateQueries({ queryKey: qk.sites(org.id) });
    qc.invalidateQueries({ queryKey: qk.site(site.id) });
    toast.success(wasTracked ? 'Tracking settings saved' : `Tracking started for ${site.domain}`, {
      description: `A fresh report arrives in a few minutes; a copy goes to ${me.user.email}.`,
      action: { label: 'View run', onClick: () => navigate(paths.run(org.id, r.id)) },
    });
  };
  return { run, isPending: start.isPending };
}

function TrackingTab({ admin }: { admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const settings = useSiteData(org.id, site.id, 'settings');
  if (settings.isPending)
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-busy>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
    );
  if (settings.isError)
    return (
      <Card>
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} title="Could not load the tracking settings" />
      </Card>
    );
  return <TrackingSettings data={settings.data} admin={admin} />;
}

function TrackingSettings({ data, admin }: { data: SiteSettingsData; admin: boolean }) {
  const { org, me } = useOrgCtx();
  const { site } = useSiteCtx();
  const day = useCycleDay();
  const track = useTrackRun();
  const t = data.tracking;
  const tracked = t.tracked || site.trackingStatus !== 'not_started';
  const paused = (t.tracked ? t.status : site.trackingStatus) === 'paused';
  const defaults = trackDefaults(site, {
    monitors: data.monitors ?? undefined,
    blogsPerWeek: data.cadence?.pagesPerWeek,
    keywords: t.keywords.length ? t.keywords : undefined,
    ga4PropertyId: site.ga4PropertyId || t.ga4PropertyId || undefined,
    competitors: data.monitors?.competitors.length ? data.monitors.competitors : undefined,
  });

  if (!tracked)
    return (
      <div className="max-w-4xl space-y-5">
        <EmailVerifyNotice me={me} action="Tracking" />
        <Card>
          <CardHeader
            icon={<HeaderTile icon={<CalendarClock />} />}
            title="Start weekly tracking"
            description="Each week: Search Console, GA4, Google Trends and live rank checks, with a short list of what to do next. The first report arrives within minutes, and your week starts that day."
          />
          <CardBody>
            <TrackingForm
              key={site.id}
              site={site}
              defaults={defaults}
              readOnly={!admin}
              showSubmit
              submitLabel="Start tracking"
              submitting={track.isPending}
              onSubmit={(v) => track.run(v, false)}
            />
          </CardBody>
        </Card>
      </div>
    );

  const needsReconnect = t.tracked && t.status === 'active' && !t.reportsToThisApp;

  return (
    <div className="space-y-5">
      {needsReconnect && (
        <Callout
          tone="warning"
          title="Weekly reports are not reaching this dashboard yet"
          action={
            admin ? (
              <Button size="sm" type="submit" form={TRACK_FORM_ID} loading={track.isPending}>
                Save tracking settings
              </Button>
            ) : undefined
          }
        >
          The SEO engine already tracks {site.domain}, but its weekly reports still go to an older address.{' '}
          {admin ? 'Save the tracking settings once to send them here.' : 'Ask an admin to save the tracking settings once to send them here.'}
        </Callout>
      )}
      <EmailVerifyNotice me={me} action="Saving tracking settings" />

      <div className="grid gap-5 lg:grid-cols-2">
        <TrackingStatusCard data={data} paused={paused} admin={admin} />
        <CadenceCard current={data.cadence?.pagesPerWeek ?? site.blogsPerWeek} status={data.cadence?.status ?? null} admin={admin} />
      </div>

      <MonitorsCard
        initial={completeMonitors(data.monitors ?? { brandNames: site.brandNames })}
        initialCompetitors={data.monitors?.competitors.length ? data.monitors.competitors : site.competitors}
        updatedAt={data.monitors?.updatedAt ?? null}
        blogsPerWeek={data.cadence?.pagesPerWeek ?? site.blogsPerWeek}
        admin={admin}
      />

      <ContentGroupsCard initial={data.contentGroups ?? []} admin={admin} />

      <Card>
        <CardHeader
          icon={<HeaderTile icon={<KeyRound />} />}
          title="Keywords and Google Analytics"
          description={`Saving runs the tracker once with these settings and sends a fresh report (about ${quoteLabel(0.1)}). Pages a week and monitors stay as set above.`}
        />
        <CardBody>
          <TrackingForm
            key={site.id}
            site={site}
            formId={TRACK_FORM_ID}
            defaults={defaults}
            sections="basics"
            readOnly={!admin}
            showSubmit
            submitLabel="Save and run the tracker"
            submitting={track.isPending}
            onSubmit={(v) => track.run(v, true)}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function TrackingStatusCard({ data, paused, admin }: { data: SiteSettingsData; paused: boolean; admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const day = useCycleDay();
  const action = useSiteAdmin(org.id, site.id);
  const t = data.tracking;
  const toggle = () =>
    action.mutate(
      { action: paused ? 'resume' : 'pause' },
      {
        onSuccess: (r: AdminResult) =>
          r.ok
            ? toast.success(paused ? 'Tracking resumed' : 'Tracking paused', {
                description: paused ? `The next report arrives ${day.on}.` : 'No weekly reports, monitors or pages until you resume.',
              })
            : toast.error(r.error ?? 'The change was not applied'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<HeaderTile icon={<CalendarClock />} />}
        title="Weekly tracking"
        description={`Search Console, GA4, Trends and rank checks ${day.every}.`}
        actions={paused ? <StatusBadge tone="warning">Paused</StatusBadge> : <StatusBadge tone="good">Active</StatusBadge>}
      />
      <CardBody className="flex-1">
        <KeyValue
          items={[
            { label: 'Started', value: site.trackingStartedAt ? fmtDate(site.trackingStartedAt) : '-' },
            { label: 'Last report', value: t.lastRunAt ? `${fmtAgo(t.lastRunAt)}${t.lastStatus ? ` · ${t.lastStatus}` : ''}` : 'None yet' },
            { label: 'Search Console', value: t.gscProperty ?? site.gscProperty ?? <span className="text-warning-text">not connected</span> },
            { label: 'GA4 property', value: t.ga4PropertyId || site.ga4PropertyId || <span className="text-ink-3">detected automatically</span> },
            { label: 'Keywords', value: t.keywords.length ? `${t.keywords.length} tracked` : <span className="text-ink-3">Search Console queries only</span> },
          ]}
        />
      </CardBody>
      {admin && (
        <CardFooter className="justify-between">
          <p className="text-[13px] text-ink-3">{paused ? 'Nothing runs while paused.' : 'Pausing stops weekly reports, monitors and pages.'}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggle}
            loading={action.isPending}
            icon={paused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function CadenceCard({ current, status, admin }: { current: number; status: string | null; admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const day = useCycleDay();
  const action = useSiteAdmin(org.id, site.id);
  const [value, setValue] = useState(String(Math.min(3, Math.max(0, current))));
  const n = Number(value);
  const save = () =>
    action.mutate(
      { action: 'cadence', pagesPerWeek: n },
      {
        onSuccess: (r: AdminResult) =>
          r.ok
            ? toast.success(n ? `${n} ${n === 1 ? 'page' : 'pages'} a week for your keyword, from your next weekly run` : 'Weekly pages turned off')
            : toast.error(r.error ?? 'The change was not applied'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<HeaderTile icon={<PenSquare />} />}
        title="Pages a week for your keyword"
        description={`Each page is a full, researched and quality-checked page for a keyword you chose, delivered ${day.every} as HTML and Markdown for you to publish.`}
        actions={status && status !== 'active' && current > 0 ? <Badge>{status}</Badge> : undefined}
      />
      <CardBody className="flex-1 space-y-3">
        <Segmented
          value={value}
          onChange={setValue}
          options={BLOG_OPTIONS.map((o) => ({ value: String(o), label: o === 0 ? 'None' : `${o} a week` }))}
        />
        <p className="text-sm text-ink-2">
          {n ? (
            <>
              About <span className="font-medium text-ink">{creditsLabel(blogMonthlyCost(n))}</span> a month, while a keyword you chose has pages to write. Other chances (pages close to page
              one, rising searches) follow your autopilot level.
            </>
          ) : (
            'No weekly pages. Tracking and monitors keep running.'
          )}
        </p>
      </CardBody>
      {admin && (
        <CardFooter>
          <Button size="sm" onClick={save} loading={action.isPending} disabled={n === current}>
            Save
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function MonitorsCard({
  initial,
  initialCompetitors,
  updatedAt,
  blogsPerWeek,
  admin,
}: {
  initial: MonitorSettings;
  initialCompetitors: string[];
  updatedAt: string | null;
  blogsPerWeek: number;
  admin: boolean;
}) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const action = useSiteAdmin(org.id, site.id);
  const [monitors, setMonitors] = useState(initial);
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [enginesError, setEnginesError] = useState<string | undefined>();
  const ai = useSiteData(org.id, site.id, 'ai');   // B8-7: the precision table reads the latest run's measured sample
  const pipelineQ = useSiteData(org.id, site.id, 'pipeline');   // B4: the forecast's plan (level, keyword pages, rank checks)
  const dirty = JSON.stringify(monitors) !== JSON.stringify(initial) || JSON.stringify(competitors) !== JSON.stringify(initialCompetitors);

  const save = () => {
    if (monitors.aiVisibility && !monitors.aiEngines.length) {
      setEnginesError('Choose at least one engine, or turn AI visibility off');
      return;
    }
    setEnginesError(undefined);
    action.mutate(
      { action: 'monitors', monitors, competitors },
      {
        onSuccess: (r: AdminResult) => (r.ok ? toast.success('Monitor settings saved') : toast.error(r.error ?? 'The change was not applied')),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        icon={<HeaderTile icon={<Radar />} />}
        title="Growth monitors"
        description={`They run in the background and fill the AI visibility, Backlinks and Technical health pages.${updatedAt ? ` Last changed ${fmtAgo(updatedAt)}.` : ''}`}
      />
      <CardBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <MonitorSettingsFields value={monitors} onChange={setMonitors} disabled={!admin} enginesError={enginesError} aiMeasured={aiMeasuredFrom(ai.data)} />
            <Field
              label="Competitors"
              optional
              hint="Up to 3. Compared in AI answers (share of voice), the backlink gap and reports."
              labelAction={<GuideButton id="competitors" vars={{ domain: site.domain }} variant="link" label="Who counts as a competitor?" />}
            >
              {(p) => (
                <TagInput
                  id={p.id}
                  describedBy={p['aria-describedby']}
                  value={competitors}
                  onChange={setCompetitors}
                  max={3}
                  normalize={cleanDomain}
                  validate={competitorValidator(site.domain)}
                  placeholder="competitor.com, then Enter"
                />
              )}
            </Field>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <MonitoringCost monitors={monitors} blogsPerWeek={blogsPerWeek} plan={pipelineQ.data ? forecastPlanOf(pipelineQ.data, site) : undefined} />
          </div>
        </div>
      </CardBody>
      {admin && (
        <CardFooter>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMonitors(initial);
                setCompetitors(initialCompetitors);
                setEnginesError(undefined);
              }}
            >
              Undo changes
            </Button>
          )}
          <Button size="sm" onClick={save} loading={action.isPending} disabled={!dirty}>
            Save monitors
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * B7-5 (W3-D's engine half): the website's page groups, blog, services, product, each a pattern over the page address. The weekly
 * site report then shows each group's clicks against the 28 days before, judged on the same bar as every alert, with the pages in no
 * group on a line of their own. Stored in the engine (Site Admin `content_groups`); an empty list clears them.
 */
function ContentGroupsCard({ initial, admin }: { initial: ContentGroup[]; admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const action = useSiteAdmin(org.id, site.id);
  const [rows, setRows] = useState<ContentGroup[]>(initial.length ? initial : []);
  const [errs, setErrs] = useState<Record<number, string>>({});
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<ContentGroup>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => {
    const kept = rows.filter((r) => r.name.trim() || r.pattern.trim());
    const bad: Record<number, string> = {};
    kept.forEach((r, i) => {
      const p = contentGroupSchema.safeParse(r);
      if (!p.success) bad[i] = p.error.issues[0]?.message ?? 'Check this group';
    });
    setRows(kept);
    setErrs(bad);
    if (Object.keys(bad).length) return;
    action.mutate(
      { action: 'content_groups', contentGroups: kept.map((r) => ({ name: r.name.trim(), pattern: r.pattern.trim() })) },
      {
        onSuccess: (r: AdminResult) => (r.ok ? toast.success(kept.length ? 'Content groups saved: the next weekly report shows them' : 'Content groups cleared') : toast.error(r.error ?? 'The change was not applied')),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <Card>
      <CardHeader
        icon={<HeaderTile icon={<FolderTree />} />}
        title="Content groups"
        description="Group your pages (blog, services, product) and the weekly report shows how each group does in Google search, judged on the same bar as every alert. A page can sit in more than one group."
      />
      <CardBody className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-ink-2">No groups yet. The weekly report shows the site as a whole.</p>}
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start">
            <Input aria-label={`Group ${i + 1} name`} value={r.name} maxLength={60} placeholder="Blog" disabled={!admin} onChange={(e) => set(i, { name: e.target.value })} />
            <div className="min-w-0">
              <Input aria-label={`Group ${i + 1} pattern`} className="font-mono" value={r.pattern} maxLength={200} placeholder="^/blog/" disabled={!admin} onChange={(e) => set(i, { pattern: e.target.value })} />
              {errs[i] && <p className="mt-1 text-xs text-critical-text">{errs[i]}</p>}
            </div>
            {admin && (
              <Button variant="ghost" size="sm" aria-label={`Remove group ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        <p className="text-xs text-ink-3">The pattern is a regular expression over the page path, case-insensitive: <code className="font-mono">^/blog/</code> matches every page under /blog/, <code className="font-mono">^/(services|solutions)/</code> two sections at once.</p>
      </CardBody>
      {admin && (
        <CardFooter>
          <Button variant="secondary" size="sm" disabled={rows.length >= CONTENT_GROUPS_MAX} onClick={() => setRows([...rows, { name: '', pattern: '' }])}>
            <Plus /> Add a group
          </Button>
          <Button size="sm" onClick={save} loading={action.isPending} disabled={!dirty}>
            Save groups
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ---------------- autopilot (keyword-first, SCHEDULING_KEYWORDS_PLAN.md §5.5, §4.2) ----------------

function AutopilotTab({ admin }: { admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const pipeline = useSiteData(org.id, site.id, 'pipeline');
  const settings = useSiteData(org.id, site.id, 'settings');
  if (pipeline.isPending || settings.isPending)
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-busy>
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  if (pipeline.isError || settings.isError)
    return (
      <Card>
        <ErrorState error={pipeline.error ?? settings.error} onRetry={() => (pipeline.refetch(), settings.refetch())} title="Could not load the autopilot settings" />
      </Card>
    );
  const d = pipeline.data;
  const level = d.autopilot?.level ?? d.automation?.autopilotLevel ?? site.autopilotLevel ?? 2;
  // a keyword the client chose (Auto, not won or paused) still has pages to write, a ladder to rank-check: the server's forecast plan
  const { writing, ranking } = forecastPlanOf(d, site);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader
          icon={<HeaderTile icon={<Bot />} />}
          title="How much should we do on our own?"
          description="Whatever the level, two days before each weekly run you see what is coming up and can skip anything. The topic check always runs: nothing outside your business is written."
          actions={<GuideButton id={AUTOPILOT_SCREEN_GUIDES.autopilotSettings} vars={autopilotGuideVars(site, { cycle: d.cycle, level })} label="What each level does" />}
        />
        <CardBody>
          <AutopilotLevelPicker
            key={level}
            orgId={org.id}
            siteId={site.id}
            level={level}
            dropped={d.autopilot?.dropped ?? null}
            monitors={settings.data.monitors}
            pagesPerWeek={settings.data.cadence?.pagesPerWeek ?? site.blogsPerWeek}
            writing={writing}
            ranking={ranking}
            admin={admin}
          />
        </CardBody>
      </Card>
      <YourWeek cycle={d.cycle} compact />
    </div>
  );
}

// ---------------- profile ----------------

function ProfileTab({ admin }: { admin: boolean }) {
  const { org, me } = useOrgCtx();
  const { site } = useSiteCtx();
  const settings = useSiteData(org.id, site.id, 'settings');
  const { save, isPending } = useSaveProfile(org.id, site.id);
  if (settings.isPending)
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" aria-busy>
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-72" />
      </div>
    );
  if (settings.isError)
    return (
      <Card>
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} title="Could not load the profile" />
      </Card>
    );
  const d = settings.data;
  return (
    <div className="space-y-5">
      {admin && <EmailVerifyNotice me={me} action="Saving the profile" />}
      {d.profile && d.readiness.missing.length > 0 && (
        <Callout tone="info" title={`Saved profile: ${d.readiness.score}% complete`}>
          Missing: {d.readiness.missing.join(', ')}.
        </Callout>
      )}
      <Card>
        <CardBody className="py-6">
          <ProfileForm
            key={site.id}
            profile={d.profile}
            savedReadiness={d.profile ? d.readiness : null}
            readOnly={!admin}
            layout="aside"
            showSubmit
            submitLabel="Save profile"
            submitting={isPending}
            onSubmit={async (v) => {
              await save(v);
              profileSavedToast();
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------- delete ----------------

function DangerTab() {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const navigate = useNavigate();
  const remove = useDeleteSite(org.id, site.id);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = cleanDomain(typed) === site.domain;

  const confirm = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        toast.success(`${site.domain} was removed from ${org.name}`);
        navigate(paths.org(org.id), { replace: true });
      },
    });

  return (
    <Card className="max-w-3xl border-critical/40">
      <CardHeader title="Delete this website" icon={<HeaderTile icon={<Trash2 />} tone="critical" />} />
      <CardBody className="space-y-3 text-sm leading-relaxed text-ink-2">
        <p>
          This removes <strong className="font-medium text-ink">{site.domain}</strong> from {org.name} and stops its weekly tracking, monitors and pages in the SEO
          engine. To add it again later you would need to verify it again.
        </p>
        <Note>
          Only want a break? <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="link">Pause tracking instead</ButtonLink>.
        </Note>
      </CardBody>
      <CardFooter className="rounded-b-xl border-critical/25 bg-critical-soft/40">
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
          Delete website...
        </Button>
      </CardFooter>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTyped('');
        }}
        title={`Delete ${site.domain}?`}
        description="This cannot be undone from the app."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} loading={remove.isPending} disabled={!matches}>
              Delete website
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={<>Type <span className="font-mono">{site.domain}</span> to confirm</>}>
            {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={site.domain} />}
          </Field>
          {remove.isError && <Callout tone="critical">{errorMessage(remove.error)}</Callout>}
        </div>
      </Dialog>
    </Card>
  );
}

/** The icon tile of a settings card header (blue; critical for the delete card). */
function HeaderTile({ icon, tone = 'blue' }: { icon: ReactNode; tone?: 'blue' | 'critical' }) {
  return (
    <IconTile size="sm" tone={tone} className="-mt-0.5">
      {icon}
    </IconTile>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-ink-3">{children}</p>;
}

