import { useState } from 'react';
import { Globe, Plus } from 'lucide-react';
import { cleanDomain, domainOk } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/feedback';
import { ChoiceCard } from '@/components/ui/field';
import { DomainClaimedCallout, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { ApiRequestError } from '@/lib/api';
import { useCreateSite } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { useWizard } from './wizard';

const FORM_ID = 'onboarding-website';

export function WebsiteStep() {
  const { org, sites, site, go } = useWizard();
  const create = useCreateSite(org?.id ?? '');
  const [choice, setChoice] = useState<string>(site?.id ?? sites[0]?.id ?? 'new');
  const existing = sites.find((s) => s.id === choice) ?? null;
  const orgDomain = cleanDomain(org?.website);
  const defaultDomain = orgDomain && domainOk(orgDomain) && !sites.some((s) => s.domain === orgDomain) ? orgDomain : '';

  return (
    <StepFrame
      step="website"
      title={sites.length ? 'Which website should we start with?' : 'Add your website'}
      description="The site you want to grow. You can add more websites later; each gets its own dashboard."
      why={
        <>
          <strong className="font-medium text-ink">Why we ask:</strong> the country decides where rankings, keyword volumes and AI answers are measured. What you do and who
          you serve steer the keyword research, every page we write and the questions we ask AI assistants about your market.
        </>
      }
      back={() => go('company')}
      primary={
        existing
          ? { label: `Continue with ${existing.domain}`, onClick: () => go('verify', existing.id) }
          : { label: 'Add website', form: FORM_ID, loading: create.isPending }
      }
    >
      {sites.length > 0 && (
        <div className="mb-6">
          <div role="radiogroup" aria-label="Website" className="grid gap-2 sm:grid-cols-2">
            {sites.map((s) => (
              <ChoiceCard
                key={s.id}
                selected={choice === s.id}
                onSelect={() => setChoice(s.id)}
                icon={<Globe className="size-5" />}
                title={s.domain}
                description={s.country || 'Country not set'}
                badge={s.verifiedAt ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
              />
            ))}
            <ChoiceCard
              selected={choice === 'new'}
              onSelect={() => setChoice('new')}
              icon={<Plus className="size-5" />}
              title="Add another website"
              description="A different domain owned by this company."
            />
          </div>
        </div>
      )}

      {!existing && (
        <SiteBusinessForm
          mode="create"
          formId={FORM_ID}
          defaultDomain={defaultDomain}
          collapseMore
          submitting={create.isPending}
          onSubmit={async (v) => {
            const created = await create.mutateAsync(v);
            go('verify', created.id);
          }}
          renderError={(e, v) => {
            if (!(e instanceof ApiRequestError) || e.status !== 409) return null;
            if (e.code === 'domain_claimed') return <DomainClaimedCallout domain={cleanDomain(v.domain)} />;
            return (
              <Callout tone="warning" title="You already added this website">
                {e.message} Choose it in the list above to continue.
              </Callout>
            );
          }}
        />
      )}
    </StepFrame>
  );
}
