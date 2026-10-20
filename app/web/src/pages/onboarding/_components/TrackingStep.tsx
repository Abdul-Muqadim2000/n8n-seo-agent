import { useCallback, useMemo } from 'react';
import { asCountry } from '@/components/site/helpers';
import { trackDefaults, TrackingForm, type TrackFormOutput, type TrackFormValues } from '@/components/site/TrackingForm';
import { Skeleton } from '@/components/ui/feedback';
import { useSiteData, useUpdateSite } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { siteWeekdayName, todayWeekdayName } from '@/lib/cycle-day';
import { readKeywordDraft, readTrackingDraft, useWizardSite, writeTrackingDraft } from './wizard';

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
    // the keyword(s) chosen in the step before are watched too (and a site with a chosen keyword writes a page a week by default)
    const picks = (readKeywordDraft(site.id)?.picks ?? []).map((p) => p.keyword.trim().toLowerCase());
    const withPicks = (v: TrackFormOutput): TrackFormOutput => ({ ...v, keywords: [...picks.filter((k) => !v.keywords.includes(k)), ...v.keywords].slice(0, 20) });
    // the business step owns the country: a draft from before a change must not override it
    if (draft) return withPicks({ ...draft, country: asCountry(site.country) ?? draft.country });
    const base = trackDefaults(site, {
      monitors: settings.data?.monitors ?? undefined,
      blogsPerWeek: settings.data?.cadence?.pagesPerWeek,
    });
    return withPicks(picks.length && !base.blogsPerWeek ? { ...base, blogsPerWeek: 1 } : base);
  }, [loading, site, settings.data]);
  const weekday = siteWeekdayName(site) ?? todayWeekdayName();

  const keepDraft = useCallback((v: TrackFormValues) => writeTrackingDraft(site.id, v), [site.id]);

  return (
    <StepFrame
      step="tracking"
      title="Choose what to track"
      description={`Every ${weekday} you get a report from Search Console, GA4, Google Trends and live rank checks, with a short list of what to do next. Your week starts the day you finish setup. Choose the extras below; you can change all of it later in Website settings.`}
      why={
        <>
          <strong className="font-medium text-ink">Not sure?</strong> The defaults suit most companies. The keywords to watch are optional: everything Search Console reports
          is tracked anyway. Pages are written only for the keyword you chose in the step before.
        </>
      }
      back={() => go('keyword')}
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
