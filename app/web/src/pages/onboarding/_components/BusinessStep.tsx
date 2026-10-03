import { businessOnly, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { useUpdateSite } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { useWizardSite } from './wizard';

const FORM_ID = 'onboarding-business';

export function BusinessStep() {
  const { org, site, go } = useWizardSite();
  const update = useUpdateSite(org.id, site.id);
  return (
    <StepFrame
      step="business"
      title="Your business, in your words"
      description="Every page, report and AI-visibility question the engine produces starts from these details. Check them and add what is missing."
      why={
        <>
          <strong className="font-medium text-ink">Only real facts.</strong> The engine never invents prices, numbers, awards or claims: it can only use what you write
          here. Specific facts (years, clients, certifications, prices you publish) make pages more convincing to readers, Google and AI assistants.
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
          await update.mutateAsync(businessOnly(v));
          go('profile');
        }}
      />
    </StepFrame>
  );
}
