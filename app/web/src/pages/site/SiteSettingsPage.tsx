import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PauseCircle, PlayCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { cleanDomain, formatUsd, type AdminResult, type MonitorSettings, type SiteSettingsData } from '@seo/shared';
import { EmailVerifyNotice } from '@/components/site/EmailVerifyNotice';
import { competitorValidator } from '@/components/site/helpers';
import { completeMonitors, MonitoringCost, MonitorSettingsFields } from '@/components/site/MonitorSettingsFields';
import { ProfileForm, profileSavedToast, useSaveProfile } from '@/components/site/ProfileForm';
import { businessOnly, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { BLOG_OPTIONS, blogMonthlyCost, trackDefaults, TrackingForm, type TrackFormOutput } from '@/components/site/TrackingForm';
import { VerificationPanel } from '@/components/site/VerificationPanel';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { KeyValue, PageHeader } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { LinkTabs, Segmented } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { qk, useDeleteSite, useSiteAdmin, useSiteData, useStartRun, useUpdateSite } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';

const TABS = [
  { id: 'business', label: 'Business details', description: 'What the engine knows about your business. Every page, report and AI-visibility question starts here.' },
  { id: 'verification', label: 'Verification & Google', description: 'Ownership of the website and the Search Console and GA4 connection.' },
  { id: 'tracking', label: 'Tracking & monitors', description: 'Weekly tracking, blog posts per week and the growth monitors, with their cost.' },
  { id: 'profile', label: 'Author & profile', description: 'The author, reviewer and business details behind every byline, author box and schema.' },
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
  if (!current) return <Navigate to={paths.site(org.id, site.id, 'settings/business')} replace />;

  return (
    <div>
      <PageHeader title="Website settings" description={current.description} />
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
      <CardHeader title="Business details" description="Only real facts: the engine never invents prices, numbers or claims, it uses what is written here." />
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
            We only show a website’s data to the company that owns it. Then connect Search Console and GA4 by adding our read-only service account.
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
            title="Start weekly tracking"
            description="Every Monday: Search Console, GA4, Google Trends and live rank checks, with a short list of what to do next. The first report arrives within minutes."
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

      <Card>
        <CardHeader
          title="Keywords and Google Analytics"
          description={`Saving runs the tracker once with these settings and sends a fresh report (about ${formatUsd(0.1)}). Blog posts and monitors stay as set above.`}
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
  const action = useSiteAdmin(org.id, site.id);
  const t = data.tracking;
  const toggle = () =>
    action.mutate(
      { action: paused ? 'resume' : 'pause' },
      {
        onSuccess: (r: AdminResult) =>
          r.ok
            ? toast.success(paused ? 'Tracking resumed' : 'Tracking paused', {
                description: paused ? 'The next report arrives on Monday.' : 'No weekly reports, monitors or blog posts until you resume.',
              })
            : toast.error(r.error ?? 'The change was not applied'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Weekly tracking"
        description="Search Console, GA4, Trends and rank checks every Monday."
        actions={paused ? <StatusBadge tone="warning">Paused</StatusBadge> : <StatusBadge tone="good">Active</StatusBadge>}
      />
      <CardBody className="flex-1">
        <KeyValue
          items={[
            { label: 'Started', value: site.trackingStartedAt ? fmtDate(site.trackingStartedAt) : '–' },
            { label: 'Last report', value: t.lastRunAt ? `${fmtAgo(t.lastRunAt)}${t.lastStatus ? ` · ${t.lastStatus}` : ''}` : 'None yet' },
            { label: 'Search Console', value: t.gscProperty ?? site.gscProperty ?? <span className="text-warning-text">not connected</span> },
            { label: 'GA4 property', value: t.ga4PropertyId || site.ga4PropertyId || <span className="text-ink-3">detected automatically</span> },
            { label: 'Keywords', value: t.keywords.length ? `${t.keywords.length} tracked` : <span className="text-ink-3">Search Console queries only</span> },
          ]}
        />
      </CardBody>
      {admin && (
        <CardFooter className="justify-between">
          <p className="text-[13px] text-ink-3">{paused ? 'Nothing runs while paused.' : 'Pausing stops weekly reports, monitors and blog posts.'}</p>
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
  const action = useSiteAdmin(org.id, site.id);
  const [value, setValue] = useState(String(Math.min(3, Math.max(0, current))));
  const n = Number(value);
  const save = () =>
    action.mutate(
      { action: 'cadence', pagesPerWeek: n },
      {
        onSuccess: (r: AdminResult) =>
          r.ok
            ? toast.success(n ? `${n} blog ${n === 1 ? 'post' : 'posts'} a week from next Monday` : 'Blog posts turned off')
            : toast.error(r.error ?? 'The change was not applied'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Blog posts per week"
        description="Each post is a full, researched and quality-checked page, delivered every Monday as HTML and Markdown for you to publish."
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
              About <span className="font-medium text-ink">{formatUsd(blogMonthlyCost(n))}</span> a month. Topics come from your keyword plan, queries close to page one and
              rising trends.
            </>
          ) : (
            'No blog posts. Tracking and monitors keep running.'
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
        title="Growth monitors"
        description={`They run in the background and fill the AI visibility, Backlinks and Technical health pages.${updatedAt ? ` Last changed ${fmtAgo(updatedAt)}.` : ''}`}
      />
      <CardBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <MonitorSettingsFields value={monitors} onChange={setMonitors} disabled={!admin} enginesError={enginesError} />
            <Field label="Competitors" optional hint="Up to 3. Compared in AI answers (share of voice), the backlink gap and reports.">
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
            <MonitoringCost monitors={monitors} blogsPerWeek={blogsPerWeek} />
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
      <CardHeader title="Delete this website" icon={<Trash2 className="size-4" />} />
      <CardBody className="space-y-3 text-sm leading-relaxed text-ink-2">
        <p>
          This removes <strong className="font-medium text-ink">{site.domain}</strong> from {org.name} and stops its weekly tracking, monitors and blog posts in the SEO
          engine. To add it again later you would need to verify it again.
        </p>
        <Note>
          Only want a break? <ButtonLink to={paths.site(org.id, site.id, 'settings/tracking')} variant="link">Pause tracking instead</ButtonLink>.
        </Note>
      </CardBody>
      <CardFooter>
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
          Delete website…
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

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-ink-3">{children}</p>;
}

