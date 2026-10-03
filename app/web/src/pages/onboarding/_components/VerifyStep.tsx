import { VerificationPanel } from '@/components/site/VerificationPanel';
import { StepFrame } from './WizardShell';
import { useWizardSite } from './wizard';

export function VerifyStep() {
  const { org, site, go } = useWizardSite();
  const verified = !!site.verifiedAt;
  return (
    <StepFrame
      step="verify"
      title={verified ? `${site.domain} is yours` : `Confirm that you own ${site.domain}`}
      description={
        verified
          ? 'Ownership is confirmed. Check that Search Console is connected and pick your GA4 property, then continue.'
          : 'We only show a website’s data to the company that owns it. Pick one way below; it takes about two minutes.'
      }
      why={
        verified ? undefined : (
          <>
            <strong className="font-medium text-ink">Tip:</strong> verifying shows that this website is yours, so only your company sees its data. Then you connect Search
            Console and GA4 by adding our read-only service account as a user; we never change anything in your accounts.
          </>
        )
      }
      back={() => go('website')}
      skip={verified ? undefined : { label: 'Skip for now', onClick: () => go('business') }}
      primary={{ label: 'Continue', onClick: () => go('business'), disabled: !verified }}
      note={verified ? undefined : 'Until it is verified, dashboards stay locked and tracking cannot start.'}
    >
      <VerificationPanel orgId={org.id} site={site} canEdit />
    </StepFrame>
  );
}
