import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Receipt, ShieldAlert } from 'lucide-react';
import { AI_ENGINES, autopilotMonthlyUsd, formatCredits, GOALS, type Run } from '@seo/shared';
import { useEngineCal } from '@/lib/engine-cal';
import { runCost, runMinutes } from '@/lib/prices';
import { creditsLabel, quoteCredits, quoteLabel } from '@/lib/credits';
import { CreditRefusal, isCreditRefusal } from '@/components/site/CreditRefusal';
import { EmailVerifyNotice } from '@/components/site/EmailVerifyNotice';
import { permissionLabel } from '@/components/site/GoogleConnectionPanel';
import { asCountry } from '@/components/site/helpers';
import { trackDefaults, type TrackFormOutput } from '@/components/site/TrackingForm';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/field';
import { IconTile } from '@/components/insight';
import { GuideButton } from '@/components/guide';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { qk, useBilling, useGoogleConnection, useOnboardingStep, useSiteData, useStartRun } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { sizeLabel } from './CompanyStep';
import { StepFrame } from './WizardShell';
import { clearTrackingDraft, readTrackingDraft, useWizardSite, type StepId } from './wizard';

const JS_MAX_PAGES = 500;

export function LaunchStep() {
  const { me, org, site, go } = useWizardSite();
  useEngineCal(org.id);   // re-render with the engine's own prices once they arrive
  const navigate = useNavigate();
  const qc = useQueryClient();
  const verified = !!site.verifiedAt;
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: verified });
  const google = useGoogleConnection(org.id, site.id, verified);
  const billing = useBilling(org.id);
  const startRun = useStartRun(org.id);
  const onboarding = useOnboardingStep(org.id);
  const [auditNow, setAuditNow] = useState(true);
  const [aiNow, setAiNow] = useState(true);
  const [busy, setBusy] = useState<null | 'launch' | 'finish'>(null);
  const [error, setError] = useState<unknown>(null);

  const plan = useMemo<TrackFormOutput>(() => {
    const draft = readTrackingDraft(site.id);
    if (draft) return { ...draft, country: asCountry(site.country) ?? draft.country };
    return trackDefaults(site, { monitors: settings.data?.monitors ?? undefined, blogsPerWeek: settings.data?.cadence?.pagesPerWeek });
  }, [site, settings.data]);

  const m = plan.monitors;
  // credits (app/docs/CREDITS.md): the schedules' month from the same rows as the settings card and the Credits page (autopilotRows)
  const monthly = autopilotMonthlyUsd(m, plan.blogsPerWeek);
  // D-2: the runs this step starts, priced and timed exactly as their tool forms and the budget check price them (the engine's own
  // calibration, read here without the company layout), not the shipped MODES table, which said $0.09 beside the form's $0.11
  const auditRun = { reportType: 'site_audit' } as const;
  // credits (app/docs/CREDITS.md): each run is quoted (and held) on its own, so starting now uses the sum of their quotes; blog posts
  // and monitors are autopilot (see the monthly estimate)
  const nowCredits = quoteCredits(runCost('track')) + (auditNow ? quoteCredits(runCost('audit', auditRun)) : 0) + (aiNow ? quoteCredits(runCost('ai_visibility')) : 0);
  const b = billing.data;
  const metered = !!b && (b.enforced || b.limits.onDemandMonthly != null);
  const available = b ? Math.max(0, b.onDemandAvailable) : 0;
  const overCredits = metered && nowCredits > available;
  const country = plan.country;

  const finishOnboarding = async () => {
    try {
      await onboarding.mutateAsync({ step: 'done', done: true });
    } catch {
      /* the setup is complete either way; the dashboard opens */
    }
  };

  const extraRun = async (body: Record<string, unknown>, label: string): Promise<boolean> => {
    try {
      const r: Run = await startRun.mutateAsync(body);
      if (r.status === 'failed') {
        toast.error(`The ${label} did not start`, { description: r.error ?? undefined });
        return false;
      }
      return true;
    } catch (e) {
      toast.error(`The ${label} did not start`, { description: errorMessage(e) });
      return false;
    }
  };

  const launch = async () => {
    setError(null);
    setBusy('launch');
    try {
      const run = await startRun.mutateAsync({
        mode: 'track',
        siteId: site.id,
        country,
        keywords: plan.keywords,
        ga4PropertyId: plan.ga4PropertyId,
        blogsPerWeek: plan.blogsPerWeek,
        competitors: plan.competitors,
        monitors: plan.monitors,
        emailCopy: true,
      });
      if (run.status === 'failed') throw new Error(run.error || 'The SEO engine did not accept the request. Try again in a minute.');
      const extras: string[] = [];
      if (auditNow) {
        const pages = m.auditJs ? Math.min(m.auditPages, JS_MAX_PAGES) : m.auditPages;
        const ok = await extraRun(
          { mode: 'audit', siteId: site.id, country, reportType: 'site_audit', crawlPages: pages, crawlJs: m.auditJs, competitors: plan.competitors, emailCopy: true },
          'technical audit',
        );
        if (ok) extras.push('technical audit');
      }
      if (aiNow) {
        const ok = await extraRun({ mode: 'ai_visibility', siteId: site.id, country, topics: [], competitors: plan.competitors, emailCopy: true }, 'AI visibility baseline');
        if (ok) extras.push('AI visibility baseline');
      }
      await finishOnboarding();
      clearTrackingDraft(site.id);
      qc.invalidateQueries({ queryKey: qk.sites(org.id) });
      qc.invalidateQueries({ queryKey: qk.site(site.id) });
      toast.success(`Tracking started for ${site.domain}`, {
        description: `The first report arrives in a few minutes${extras.length ? `; the ${extras.join(' and ')} within about 20 minutes` : ''}. A copy goes to ${me.user.email}.`,
      });
      navigate(paths.site(org.id, site.id, 'overview'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const finishWithout = async () => {
    setBusy('finish');
    await finishOnboarding();
    setBusy(null);
    navigate(paths.site(org.id, site.id, 'overview'));
  };

  const engines = AI_ENGINES.filter((e) => m.aiEngines.includes(e.value)).map((e) => e.label);
  const goal = GOALS.find((g) => g.value === site.goal)?.label ?? site.goal;
  const gsc = google.data?.gsc;
  const ga4Id = plan.ga4PropertyId || site.ga4PropertyId;

  return (
    <StepFrame
      step="launch"
      title="Review and start"
      description="Here is everything we will use. Change anything with Edit, then start tracking: the first report arrives within minutes, then every Monday."
      back={() => go('tracking')}
      skip={{ label: 'Finish without tracking', onClick: finishWithout, loading: busy === 'finish', disabled: busy === 'launch' }}
      primary={{ label: 'Start tracking', onClick: launch, loading: busy === 'launch', disabled: !verified || !country || busy === 'finish' }}
    >
      <div className="space-y-6">
        <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <Row label="Company" step="company" go={go}>
            {org.name}
            {(org.industry || org.size) && <span className="text-ink-3"> · {[org.industry, org.size && sizeLabel(org.size)].filter(Boolean).join(' · ')}</span>}
          </Row>
          <Row label="Website" step="website" go={go}>
            <span className="inline-flex flex-wrap items-center gap-2">
              {site.domain}
              <span className="text-ink-3">· {site.country || 'country not set'}</span>
              {verified ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
            </span>
          </Row>
          <Row label="Google data" step="verify" go={go}>
            {!verified ? (
              <span className="text-ink-3">Connects after verification</span>
            ) : google.isPending ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <span className="block space-y-1">
                <span className="block">
                  Search Console:{' '}
                  {gsc?.connected ? (
                    <>
                      connected <span className="text-ink-3">({gsc.property}, {permissionLabel(gsc.permissionLevel)})</span>
                    </>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="text-warning-text">not connected</span>
                      <GuideButton id="search-console-access" vars={{ domain: site.domain }} label="Show me how" />
                    </span>
                  )}
                </span>
                <span className="block">GA4: {ga4Id ? `property ${ga4Id}` : <span className="text-ink-3">detected from your web stream</span>}</span>
              </span>
            )}
          </Row>
          <Row label="Business" step="business" go={go}>
            <span className="block">
              {goal} · {site.tone}
            </span>
            <span className="block text-ink-3">
              {site.businessFacts ? `${site.businessFacts.length} characters of business facts` : 'No business facts yet; pages will be more general'}
              {plan.competitors.length ? ` · competitors: ${plan.competitors.join(', ')}` : ''}
            </span>
          </Row>
          <Row label="Author & profile" step="profile" go={go}>
            {!verified ? (
              <span className="text-ink-3">Available after verification</span>
            ) : settings.isPending ? (
              <Skeleton className="h-5 w-40" />
            ) : settings.data?.profile ? (
              <>Saved · {settings.data.readiness.score}% complete</>
            ) : (
              <span className="text-ink-3">Not set up (or still being saved); pages carry no author byline until it is</span>
            )}
          </Row>
          <Row label="Keywords" step="tracking" go={go}>
            {plan.keywords.length ? (
              <span className="flex flex-wrap gap-1.5">
                {plan.keywords.slice(0, 8).map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
                {plan.keywords.length > 8 && <Badge>+{plan.keywords.length - 8} more</Badge>}
              </span>
            ) : (
              <span className="text-ink-3">None listed; we track what Search Console reports</span>
            )}
          </Row>
          <Row label="Blog posts" step="tracking" go={go}>
            {plan.blogsPerWeek ? `${plan.blogsPerWeek} a week, delivered every Monday` : 'None'}
          </Row>
          <Row label="Monitors" step="tracking" go={go}>
            <span className="block">AI visibility: {m.aiVisibility ? `on · ${m.aiPromptsMax} questions · ${engines.join(', ') || 'no engines'}${m.aiPulse ? ' · daily pulse' : ''}` : 'off'}</span>
            <span className="block">Backlink monitor: {m.backlinks ? 'on' : 'off'}</span>
            <span className="block">
              Monthly audit: {m.auditMonthly ? `on · up to ${m.auditJs ? Math.min(m.auditPages, JS_MAX_PAGES) : m.auditPages} pages${m.auditJs ? ' with JavaScript' : ''}` : 'off'}
            </span>
          </Row>
          <Row label="Estimated credits" step="tracking" go={go} highlight>
            <span className="font-semibold">{creditsLabel(monthly)} a month</span>
            <span className="text-ink-3"> for weekly tracking, monitors and blog posts</span>
          </Row>
        </dl>

        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-sm font-semibold text-ink">Also start right away</legend>
          <div className="rounded-lg border border-line px-4 py-3 transition-colors duration-150 ease-brand hover:border-line-strong has-[:checked]:border-accent-text/50 has-[:checked]:bg-accent-soft/60">
            <Checkbox
              checked={auditNow}
              onChange={(e) => setAuditNow(e.target.checked)}
              disabled={!verified}
              label="Run a technical audit now"
              description={`About ${runMinutes('audit', auditRun)} minutes, about ${quoteLabel(runCost('audit', auditRun))}. Health score, issues by priority and a fix pack, without waiting for the 1st of the month.`}
            />
          </div>
          <div className="rounded-lg border border-line px-4 py-3 transition-colors duration-150 ease-brand hover:border-line-strong has-[:checked]:border-accent-text/50 has-[:checked]:bg-accent-soft/60">
            <Checkbox
              checked={aiNow}
              onChange={(e) => setAiNow(e.target.checked)}
              disabled={!verified}
              label="Take an AI visibility baseline now"
              description={`About ${runMinutes('ai_visibility')} minutes, about ${quoteLabel(runCost('ai_visibility'))}. Where AI assistants name you today, so later changes can be measured against it.`}
            />
          </div>
        </fieldset>

        {/* credits note */}
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <IconTile size="sm">
            <Receipt />
          </IconTile>
          <div className="min-w-0 flex-1 pt-0.5">
            <p>
              <span className="font-semibold text-ink">Starting now uses about {formatCredits(nowCredits)}</span>
              {metered && <> · {formatCredits(available)} available</>}.
            </p>
            {metered && <CreditsBar available={available} add={nowCredits} />}
          </div>
        </div>
        {overCredits && (
          <Callout tone="warning" title="Not enough credits to start all of this now">
            Analyses that need more credits than are available are refused. {org.role === 'owner' || org.role === 'admin' ? 'Add credits in Company settings > Credits' : 'Ask an owner or admin of your company to add credits'}, or
            untick the extras above.
          </Callout>
        )}

        {!verified && (
          <Callout
            tone="warning"
            title={`Verify ${site.domain} to start tracking`}
            action={
              <Button size="sm" variant="secondary" icon={<ShieldAlert className="size-4" />} onClick={() => go('verify')}>
                Verify now
              </Button>
            }
          >
            Tracking reads your website's data, so ownership must be confirmed first. You can also finish now and verify later from Website settings.
          </Callout>
        )}
        {!country && (
          <Callout
            tone="warning"
            title="Choose the website's main country"
            action={
              <Button size="sm" variant="secondary" onClick={() => go('business')}>
                Open business details
              </Button>
            }
          >
            Rankings, keyword volumes and AI answers are measured per country, so tracking needs it.
          </Callout>
        )}
        <EmailVerifyNotice me={me} action="Tracking and audits" />
        {error != null && (error instanceof ApiRequestError && isCreditRefusal(error) ? <CreditRefusal orgId={org.id} error={error} /> : <Callout tone="critical">{errorMessage(error)}</Callout>)}
      </div>
    </StepFrame>
  );
}

function Row({ label, step, go, children, highlight }: { label: string; step: StepId; go: (s: StepId) => void; children: ReactNode; highlight?: boolean }) {
  return (
    <div className={cn('grid gap-1 px-4 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:px-5', highlight && 'bg-accent-soft')}>
      <dt className="text-[13px] font-medium text-ink-3">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
      <dd className="sm:text-right">
        <button type="button" onClick={() => go(step)} className="rounded text-[13px] font-medium text-accent-text underline-offset-4 hover:underline" aria-label={`Edit ${label.toLowerCase()}`}>
          Edit
        </button>
      </dd>
    </div>
  );
}

/** credits (app/docs/CREDITS.md): what starting now holds (light blue) out of the credits available for analyses; the rest (solid blue) stays. */
function CreditsBar({ available, add }: { available: number; add: number }) {
  const addPct = available > 0 ? Math.min(100, (add / available) * 100) : add > 0 ? 100 : 0;
  const restPct = Math.max(0, 100 - addPct);
  return (
    <div
      className="mt-2 flex h-2 w-full max-w-sm gap-0.5 overflow-hidden rounded-full bg-surface-3"
      role="meter"
      aria-label="Credits available for analyses, with what starting now uses"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(addPct)}
    >
      {addPct > 0 && <span className="h-full rounded-l-full bg-accent/40 dark:bg-accent-text/55" style={{ width: `${addPct}%` }} />}
      {restPct > 0 && <span className={cn('h-full bg-accent', addPct <= 0 && 'rounded-l-full')} style={{ width: `${restPct}%` }} />}
    </div>
  );
}
