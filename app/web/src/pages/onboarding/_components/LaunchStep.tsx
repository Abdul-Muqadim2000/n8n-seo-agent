import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Receipt, ShieldAlert } from 'lucide-react';
import { AI_ENGINES, AUTOPILOT_LEVELS, autopilotMonthlyUsd, autopilotRows, formatCredits, GOALS, MONITOR_COSTS, type Run } from '@seo/shared';
import { useEngineCal } from '@/lib/engine-cal';
import { runCost } from '@/lib/prices';
import { creditsLabel, quoteCredits, quoteLabel } from '@/lib/credits';
import { CreditRefusal, isCreditRefusal } from '@/components/site/CreditRefusal';
import { EmailVerifyNotice } from '@/components/site/EmailVerifyNotice';
import { permissionLabel } from '@/components/site/GoogleConnectionPanel';
import { asCountry } from '@/components/site/helpers';
import { trackDefaults, type TrackFormOutput } from '@/components/site/TrackingForm';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { IconTile } from '@/components/insight';
import { GuideButton } from '@/components/guide';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { qk, useBilling, useGoogleConnection, useOnboardingStep, useSiteData, useStartRun, useUpdateAutomation } from '@/lib/queries';
import { browserTimezone, siteWeekdayName, todayWeekdayName } from '@/lib/cycle-day';
import { cn } from '@/lib/utils';
import { sizeLabel } from './CompanyStep';
import { StepFrame } from './WizardShell';
import { launchRequests } from './launch-plan';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { WhatHappensNext } from '@/components/site/WhatHappensNext';
import { autopilotGuideVars } from '@/lib/guide-vars';
import { firstPageReady, nextSteps, type FirstPage } from '@/lib/next-steps';
import { clearTrackingDraft, readKeywordDraft, readTrackingDraft, useWizardSite, type KeywordPick, type StepId } from './wizard';

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
  const automation = useUpdateAutomation(org.id, site.id);
  const [busy, setBusy] = useState<null | 'launch' | 'finish'>(null);
  const [error, setError] = useState<unknown>(null);

  const plan = useMemo<TrackFormOutput>(() => {
    const draft = readTrackingDraft(site.id);
    if (draft) return { ...draft, country: asCountry(site.country) ?? draft.country };
    return trackDefaults(site, { monitors: settings.data?.monitors ?? undefined, blogsPerWeek: settings.data?.cadence?.pagesPerWeek });
  }, [site, settings.data]);

  const m = plan.monitors;
  // the "Your first keyword" step: the keyword(s) chosen, how pages are written for them, and the autopilot level
  const kw = useMemo(() => readKeywordDraft(site.id), [site.id]);
  const picks: KeywordPick[] = kw?.picks ?? [];
  const level = kw?.level ?? AUTOPILOT_LEVELS[1].level;
  const levelInfo = AUTOPILOT_LEVELS.find((l) => l.level === level)!;
  const writing = picks.some((p) => p.mode === 'auto');
  const weekday = siteWeekdayName(site) ?? todayWeekdayName();
  // credits (app/docs/CREDITS.md): the schedules' month from the same rows as the settings card and the Credits page (autopilotRows)
  const monthly = autopilotMonthlyUsd(m, plan.blogsPerWeek, { level, writing });
  // today: "Track my site" (the first report) and the first cycle's checks, which start at once (cycle 0 is also the website's monthly
  // cycle, so the monthly audit runs in it); the cycle's checks are autopilot spend, shown as an estimate
  const rows = autopilotRows(m, plan.blogsPerWeek, { level, writing });
  const firstChecksUsd = rows
    .filter((r) => r.on && r.id !== 'blog_posts' && r.id !== 'research' && r.id !== 'site_report')
    .reduce((t, r) => t + (r.id === 'audit' ? r.usd : r.usd / MONITOR_COSTS.weeksPerMonth), 0);
  // a ladder start: its plan and, for "Write a page each week", the first page today; "Ask me before each page" writes nothing at start
  const ladderUsd = (p: KeywordPick) =>
    p.mode === 'auto' ? runCost('ladder', { pagesNow: 1 }) : Math.max(0.01, runCost('ladder', { pagesNow: 1 }) - runCost('keyword', { receiveContent: true, receiveReport: true }));
  // credits (app/docs/CREDITS.md): each run is quoted (and held) on its own, so starting now uses the sum of their quotes
  const nowCredits = quoteCredits(runCost('track')) + picks.reduce((t, p) => t + quoteCredits(ladderUsd(p)), 0);
  const b = billing.data;
  const metered = !!b && (b.enforced || b.limits.onDemandMonthly != null);
  const available = b ? Math.max(0, b.onDemandAvailable) : 0;
  const overCredits = metered && nowCredits > available;
  const country = plan.country;
  // "What happens next": the week this website gets when it starts now (its first week at once, then every 7 days), with where its
  // first page stands (it waits for the author profile and the business facts)
  const ready = firstPageReady(settings.data?.profile, site.businessFacts);
  const firstPage: FirstPage = !picks.length ? (level === 3 ? 'none' : 'no_keyword') : writing ? (ready ? 'writing' : 'waiting') : 'plan';
  const steps = useMemo(() => nextSteps({ cycle: null, now: Date.now(), firstPage, projectFrom: { tz: site.timezone || browserTimezone() } }), [firstPage, site.timezone]);
  const guideVars = autopilotGuideVars(site, { level });

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
      const req = launchRequests({ site, plan, picks, level, timezone: browserTimezone() });
      const run = await startRun.mutateAsync(req.track);
      if (run.status === 'failed') throw new Error(run.error || 'The SEO engine did not accept the request. Try again in a minute.');
      // the autopilot level (the website's own setting); the first cycle reads it
      try {
        await automation.mutateAsync(req.automation);
      } catch (e) {
        toast.error('The autopilot level was not saved', { description: `${errorMessage(e)} Set it again in Website settings, Autopilot.` });
      }
      // the chosen keyword(s): one keyword ladder each; "Ask me before each page" writes nothing at start (the server's rule for Manual)
      const started: string[] = [];
      for (const body of req.ladders) {
        const ok = await extraRun(body, `plan for "${String(body.keyword)}"`);
        if (ok) started.push(String(body.keyword));
      }
      await finishOnboarding();
      clearTrackingDraft(site.id);
      qc.invalidateQueries({ queryKey: qk.sites(org.id) });
      qc.invalidateQueries({ queryKey: qk.site(site.id) });
      toast.success(`Tracking started for ${site.domain}`, {
        description: `The first report arrives in a few minutes${started.length ? `; the plan for ${started.map((k) => `"${k}"`).join(' and ')} in about 5 to 10 minutes` : ''}. Then every ${weekday}.`,
      });
      navigate(paths.site(org.id, site.id, 'pipeline'));
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
      description={`Here is everything we will use. Change anything with Edit, then start: your first checks begin today, then your week repeats every ${weekday}.`}
      back={() => go('tracking')}
      skip={{ label: 'Finish without tracking', onClick: finishWithout, loading: busy === 'finish', disabled: busy === 'launch' }}
      primary={{ label: picks.length ? 'Start' : 'Start tracking', onClick: launch, loading: busy === 'launch', disabled: !verified || !country || busy === 'finish' }}
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
          <Row label="Your keyword" step="keyword" go={go}>
            {picks.length ? (
              <span className="block space-y-1">
                {picks.map((p) => (
                  <span key={p.keyword} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.keyword}</span>
                    <Badge tone={p.mode === 'auto' ? 'accent' : 'neutral'}>{p.mode === 'auto' ? 'A page each week' : 'Asks before each page'}</Badge>
                  </span>
                ))}
              </span>
            ) : level === 3 ? (
              <span className="text-ink-3">None yet: we choose one from the research and tell you two days before it starts</span>
            ) : (
              <span className="text-warning-text">None yet: nothing is written until you choose one (the Pipeline asks you)</span>
            )}
          </Row>
          <Row label="Autopilot" step="keyword" go={go}>
            <span className="block">
              Level {level}: {levelInfo.label}
            </span>
            <span className="block text-ink-3">{levelInfo.summary}</span>
          </Row>
          <Row label="Other keywords" step="tracking" go={go}>
            {plan.keywords.length ? (
              <span className="flex flex-wrap gap-1.5">
                {plan.keywords.slice(0, 8).map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
                {plan.keywords.length > 8 && <Badge>+{plan.keywords.length - 8} more</Badge>}
              </span>
            ) : (
              <span className="text-ink-3">None listed; we watch what Search Console reports</span>
            )}
          </Row>
          <Row label="Pages a week" step="tracking" go={go}>
            {plan.blogsPerWeek ? `${plan.blogsPerWeek} a week for your keyword, every ${weekday}` : 'None'}
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
            <span className="text-ink-3"> for the weekly checks{writing && plan.blogsPerWeek ? ' and the pages for your keyword' : ''}</span>
          </Row>
        </dl>

        <WhatHappensNext steps={steps} vars={guideVars} action={<GuideButton id={AUTOPILOT_SCREEN_GUIDES.launch} vars={guideVars} label="What happens when" />} />

        {/* what happens today, then every week (plan §5.2) */}
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
          <IconTile size="sm">
            <CalendarClock />
          </IconTile>
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <p>
              <span className="font-semibold text-ink">Today:</span> your first checks (about {creditsLabel(firstChecksUsd + runCost('track'))})
              {picks.map((p, i) => (
                <span key={p.keyword}>
                  {i === 0 ? ' and ' : ' and '}
                  {p.mode === 'auto' ? `the first page for "${p.keyword}"` : `the plan for "${p.keyword}"`} (about {quoteLabel(ladderUsd(p))})
                </span>
              ))}
              .
            </p>
            <p>
              <span className="font-semibold text-ink">Then every {weekday}:</span> the weekly checks
              {writing && plan.blogsPerWeek ? `, and ${plan.blogsPerWeek === 1 ? 'a page' : `${plan.blogsPerWeek} pages`} for your keyword` : ''}, about {creditsLabel(monthly)} a month.
            </p>
            {writing && plan.blogsPerWeek > 0 && <p className="text-ink-3">The first page counts as this week's page, so the next one is written next {weekday}.</p>}
            {picks.some((p) => p.mode === 'manual') && <p className="text-ink-3">For a keyword where we ask first, the plan is made today and each page waits for your OK.</p>}
            {!picks.length && level !== 3 && <p className="text-ink-3">No pages are written until you choose a keyword. The checks run anyway.</p>}
          </div>
        </div>

        {/* credits note */}
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <IconTile size="sm">
            <Receipt />
          </IconTile>
          <div className="min-w-0 flex-1 pt-0.5">
            <p>
              <span className="font-semibold text-ink">What you start now uses about {formatCredits(nowCredits)}</span>
              {metered && <> · {formatCredits(available)} available</>}. The weekly checks are counted in the monthly estimate.
            </p>
            {metered && <CreditsBar available={available} add={nowCredits} />}
          </div>
        </div>
        {overCredits && (
          <Callout tone="warning" title="Not enough credits to start all of this now">
            Analyses that need more credits than are available are refused. {org.role === 'owner' || org.role === 'admin' ? 'Add credits in Company settings > Credits' : 'Ask an owner or admin of your company to add credits'}, or
            start without a keyword for now and choose it later from the Pipeline.
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
