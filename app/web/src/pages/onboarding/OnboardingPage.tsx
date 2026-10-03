import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { Lock } from 'lucide-react';
import { roleAtLeast, type Me, type Site } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/feedback';
import { paths } from '@/lib/paths';
import { useMe, useOnboardingStep, useOrg, useSites } from '@/lib/queries';
import { BusinessStep } from './_components/BusinessStep';
import { CompanyStep } from './_components/CompanyStep';
import { LaunchStep } from './_components/LaunchStep';
import { ProfileStep } from './_components/ProfileStep';
import { TrackingStep } from './_components/TrackingStep';
import { VerifyStep } from './_components/VerifyStep';
import { WebsiteStep } from './_components/WebsiteStep';
import { StepMessage, WizardShell } from './_components/WizardShell';
import { isStep, SITE_STEPS, stepIndex, WizardContext, type StepId, type WizardValue } from './_components/wizard';

// /onboarding                    → a new company (first sign-in, or "New company" from the menu)
// /onboarding/:orgId/:step?      → the steps of an existing company; without a step it resumes at the stored one

const STEP_COMPONENTS: Record<StepId, () => ReactNode> = {
  company: CompanyStep,
  website: WebsiteStep,
  verify: VerifyStep,
  business: BusinessStep,
  profile: ProfileStep,
  tracking: TrackingStep,
  launch: LaunchStep,
};

export default function OnboardingPage() {
  const { orgId } = useParams();
  const me = useMe();
  if (!me.data) return <PageLoader />;
  return orgId ? <CompanyWizard me={me.data} orgId={orgId} /> : <NewCompanyWizard me={me.data} />;
}

function NewCompanyWizard({ me }: { me: Me }) {
  const value = useMemo<WizardValue>(() => ({ me, org: null, sites: [], site: null, step: 'company', go: () => undefined }), [me]);
  return (
    <WizardContext.Provider value={value}>
      <WizardShell me={me} org={null} site={null} step="company" furthest={0}>
        <CompanyStep />
      </WizardShell>
    </WizardContext.Provider>
  );
}

/** The website the wizard works on: ?site=, else the most recently added one. */
function pickSite(sites: Site[], wanted: string | null): Site | null {
  if (!sites.length) return null;
  return sites.find((s) => s.id === wanted) ?? [...sites].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function CompanyWizard({ me, orgId }: { me: Me; orgId: string }) {
  const { step } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const org = useOrg(orgId);
  const sites = useSites(orgId);
  const onboarding = useOnboardingStep(orgId);
  const current = isStep(step) ? step : null;
  const o = org.data;

  // remember the furthest step reached, so the wizard resumes there (the server keeps it on the company)
  const stored = o?.onboardingStep;
  const canAdmin = !!o && roleAtLeast(o.role, 'admin');
  useEffect(() => {
    if (!current || !canAdmin || !o || o.onboardedAt || onboarding.isPending) return;
    if (stepIndex(current) > stepIndex(stored)) onboarding.mutate({ step: current });
  }, [current, stored, canAdmin]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [current]);

  const site = sites.data ? pickSite(sites.data, params.get('site')) : null;
  const value = useMemo<WizardValue | null>(() => {
    if (!o || !sites.data || !current) return null;
    return {
      me,
      org: o,
      sites: sites.data,
      site,
      step: current,
      go: (next, siteId = site?.id) => navigate({ pathname: paths.onboarding(orgId, next), search: siteId ? `?site=${siteId}` : '' }),
    };
  }, [me, o, sites.data, site, current, navigate, orgId]);

  const frame = (children: ReactNode) => (
    <WizardShell me={me} org={o ?? null} site={site} step={current ?? 'company'} furthest={o ? stepIndex(o.onboardingStep) : 0}>
      {children}
    </WizardShell>
  );

  if (org.isError)
    return frame(
      <StepMessage>
        <ErrorState error={org.error} title="This company is not available" onRetry={() => org.refetch()} />
      </StepMessage>,
    );
  if (!o || !sites.data)
    return frame(
      <StepMessage>
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </StepMessage>,
    );
  if (!canAdmin)
    return frame(
      <StepMessage>
        <EmptyState
          icon={<Lock className="size-5" />}
          title={`Only owners and admins can set up ${o.name}`}
          description="Ask an admin of your company to finish the setup. You can already open the dashboard and see what is there."
          action={<ButtonLink to={paths.org(o.id)}>Open the dashboard</ButtonLink>}
        />
      </StepMessage>,
    );
  if (!current) {
    if (o.onboardedAt && !step) return <Navigate to={paths.org(o.id)} replace />;
    const resume: StepId = isStep(o.onboardingStep) ? o.onboardingStep : o.onboardingStep === 'done' ? 'launch' : 'website';
    return <Navigate to={{ pathname: paths.onboarding(o.id, resume), search: params.toString() ? `?${params}` : '' }} replace />;
  }
  if (SITE_STEPS.includes(current) && !site) return <Navigate to={paths.onboarding(o.id, 'website')} replace />;

  const Step = STEP_COMPONENTS[current];
  return <WizardContext.Provider value={value}>{frame(<Step key={`${current}:${site?.id ?? ''}`} />)}</WizardContext.Provider>;
}
