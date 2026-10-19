import { businessOnly, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { browserTimezone } from '@/lib/cycle-day';
import { useStartResearch, useUpdateSite } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { useWizardSite } from './wizard';

const FORM_ID = 'onboarding-business';

export function BusinessStep() {
  const { org, site, go } = useWizardSite();
  const update = useUpdateSite(org.id, site.id);
  const research = useStartResearch(org.id, site.id);
  return (
    <StepFrame
      step="business"
      title="Your business, in your words"
      description="Every page, report and AI-visibility question the engine produces starts from these details. Check them and add what is missing."
      why={
        <>
          <strong className="font-medium text-ink">Only real facts.</strong> The engine never invents prices, numbers, awards or claims: it can only use what you write
          here. Specific facts (years, clients, certifications, prices you publish) make pages more convincing to readers, Google and AI assistants. What you sell also
          tells us which keywords to suggest: we start looking for them as soon as you continue.
        </>
      }
      back={() => go('verify')}
      primary={{ label: 'Save and continue', form: FORM_ID, loading: update.isPending }}
    >
      <SiteBusinessForm
        key={site.id}
        mode="edit"
        site={site}
        formId={FORM_ID}
        submitting={update.isPending}
        onSubmit={async (v) => {
          // the owner's own time zone, so the website's weekly day is the day they set it up in their own week
          const tz = site.timezone ? undefined : browserTimezone() || undefined;
          await update.mutateAsync({ ...businessOnly(v), ...(tz ? { timezone: tz } : {}) });
          // keyword research starts in the background (free once, at setup), so suggestions are ready by the keyword step. It needs a
          // verified website and is never worth stopping the wizard for: a refusal (already used, not verified yet) is simply skipped.
          if (site.verifiedAt) research.mutateAsync().catch(() => undefined);
          go('profile');
        }}
      />
    </StepFrame>
  );
}
