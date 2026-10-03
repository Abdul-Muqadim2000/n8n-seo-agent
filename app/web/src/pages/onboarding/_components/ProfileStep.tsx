import { ShieldAlert } from 'lucide-react';
import { EmailVerifyNotice } from '@/components/site/EmailVerifyNotice';
import { ProfileForm, profileSavedToast, useSaveProfile } from '@/components/site/ProfileForm';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { useSiteData } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { useWizardSite } from './wizard';

const FORM_ID = 'onboarding-profile';

export function ProfileStep() {
  const { me, org, site, go } = useWizardSite();
  const verified = !!site.verifiedAt;
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: verified });
  const { save, isPending } = useSaveProfile(org.id, site.id);

  return (
    <StepFrame
      step="profile"
      title="Who stands behind your content"
      description="Google and AI assistants favour pages written by real, qualified people from a real business (E-E-A-T: experience, expertise, authority, trust). Add your author and business details once; every page then gets a byline, an author box and the right schema."
      why={
        <>
          <strong className="font-medium text-ink">Fill in what is true today</strong> and leave the rest empty. You can complete it any time in Website settings → Author
          &amp; profile.
        </>
      }
      back={() => go('business')}
      skip={{ label: 'Skip for now', onClick: () => go('tracking') }}
      primary={verified ? { label: 'Save and continue', form: FORM_ID, loading: isPending } : undefined}
    >
      {!verified ? (
        <Callout
          tone="warning"
          title={`Verify ${site.domain} to save a profile`}
          action={
            <Button size="sm" variant="secondary" icon={<ShieldAlert className="size-4" />} onClick={() => go('verify')}>
              Verify now
            </Button>
          }
        >
          The profile is stored with your website’s data, which opens once ownership is confirmed. Skip this step for now and add it later from Website settings.
        </Callout>
      ) : settings.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" aria-busy>
          <div className="space-y-4">
            <Skeleton className="h-9" />
            <Skeleton className="h-20" />
            <Skeleton className="h-28" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="space-y-5">
          <EmailVerifyNotice me={me} action="Saving the profile" />
          {settings.isError && (
            <Callout tone="warning">We could not load a saved profile, so the form starts empty. Anything you save replaces the stored profile.</Callout>
          )}
          <ProfileForm
            key={site.id}
            formId={FORM_ID}
            profile={settings.data?.profile}
            savedReadiness={settings.data?.profile ? settings.data.readiness : null}
            layout="aside"
            emptyIsSkip
            onSkip={() => go('tracking')}
            onSubmit={async (v) => {
              await save(v);
              profileSavedToast();
              go('tracking');
            }}
          />
        </div>
      )}
    </StepFrame>
  );
}
