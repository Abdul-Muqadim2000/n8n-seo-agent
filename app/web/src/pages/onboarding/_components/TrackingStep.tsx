import { useCallback, useMemo } from 'react';
import { asCountry } from '@/components/site/helpers';
import { trackDefaults, TrackingForm, type TrackFormOutput, type TrackFormValues } from '@/components/site/TrackingForm';
import { Skeleton } from '@/components/ui/feedback';
import { useSiteData, useUpdateSite } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { readTrackingDraft, useWizardSite, writeTrackingDraft } from './wizard';

const FORM_ID = 'onboarding-tracking';

export function TrackingStep() {
  const { org, site, go } = useWizardSite();
  const verified = !!site.verifiedAt;
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: verified });
  const update = useUpdateSite(org.id, site.id);
  const loading = verified && settings.isPending;

  const defaults = useMemo<TrackFormOutput | null>(() => {
    if (loading) return null;
    const draft = readTrackingDraft(site.id);
    // the business step owns the country: a draft from before a change must not override it
    if (draft) return { ...draft, country: asCountry(site.country) ?? draft.country };
    return trackDefaults(site, {
      monitors: settings.data?.monitors ?? undefined,
      blogsPerWeek: settings.data?.cadence?.pagesPerWeek,
    });
  }, [loading, site, settings.data]);

  const keepDraft = useCallback((v: TrackFormValues) => writeTrackingDraft(site.id, v), [site.id]);

  return (
    <StepFrame
      step="tracking"
      title="Choose what to track"
      description="Every Monday you get a report from Search Console, GA4, Google Trends and live rank checks, with a short list of what to do next. Choose the extras below; you can change all of it later in Website settings."
      why={
        <>
          <strong className="font-medium text-ink">Not sure?</strong> The defaults suit most companies. Keywords are optional: everything Search Console reports is tracked
          anyway, and the list is for terms you specifically want to win.
        </>
      }
      back={() => go('profile')}
      primary={{ label: 'Continue', form: FORM_ID, loading: update.isPending, disabled: !defaults }}
    >
      {!defaults ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-16" />
          <Skeleton className="h-9" />
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <TrackingForm
          key={site.id}
          site={site}
          formId={FORM_ID}
          defaults={defaults}
          showCountry={false}
          submitting={update.isPending}
          onValuesChange={keepDraft}
          onSubmit={async (v) => {
            writeTrackingDraft(site.id, v);
            // what the website itself stores now; blog posts and monitors take effect when tracking starts
            await update.mutateAsync({ keywords: v.keywords, ga4PropertyId: v.ga4PropertyId, competitors: v.competitors, brandNames: v.monitors.brandNames });
            go('launch');
          }}
        />
      )}
    </StepFrame>
  );
}
