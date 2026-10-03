import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import type { z } from 'zod';
import { COMPANY_SIZES, createOrgSchema, roleAtLeast } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { applyServerErrors } from '@/components/site/helpers';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useCreateOrg, useUpdateOrg } from '@/lib/queries';
import { StepFrame } from './WizardShell';
import { useWizard } from './wizard';

type Values = z.input<typeof createOrgSchema>;
type Output = z.output<typeof createOrgSchema>;

export const sizeLabel = (s: string) => (s === 'Just me' ? s : `${s.replace('-', '–')} people`);

const FORM_ID = 'onboarding-company';

export function CompanyStep() {
  const { me, org, go } = useWizard();
  const navigate = useNavigate();
  const create = useCreateOrg();
  const update = useUpdateOrg(org?.id ?? '');
  const [error, setError] = useState<unknown>(null);
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: org?.name ?? '',
      industry: org?.industry ?? '',
      size: (COMPANY_SIZES.find((s) => s === org?.size) ?? '') as Values['size'],
      website: org?.website ?? '',
    },
  });
  const errors = form.formState.errors;
  // a company this user started but did not finish setting up: offer to continue instead of creating a second one
  const unfinished = org ? [] : me.orgs.filter((o) => !o.onboardedAt && roleAtLeast(o.role, 'admin'));

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      if (org) {
        if (form.formState.isDirty) await update.mutateAsync(v);
        go('website');
      } else {
        const created = await create.mutateAsync(v);
        navigate(paths.onboarding(created.id, 'website'));
      }
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) setError(e);
    }
  });

  return (
    <StepFrame
      step="company"
      title={org ? 'Your company' : 'Welcome. Let’s set up your company'}
      description="This creates your company’s workspace: its websites, reports and team live here. You can invite colleagues once setup is done."
      primary={{ label: 'Continue', form: FORM_ID, loading: create.isPending || update.isPending }}
    >
      {unfinished.length > 0 && (
        <Callout
          tone="info"
          className="mb-6"
          title={`You already started setting up ${unfinished[0].name}`}
          action={
            <ButtonLink to={paths.onboarding(unfinished[0].id, unfinished[0].onboardingStep === 'done' ? undefined : unfinished[0].onboardingStep)} size="sm" variant="secondary">
              Continue
            </ButtonLink>
          }
        >
          Pick up where you left off, or fill in the form below to create another company.
        </Callout>
      )}
      <form id={FORM_ID} onSubmit={submit} noValidate className="max-w-xl space-y-5">
        <Field label="Company name" error={errors.name?.message}>
          {(p) => <Input {...p} autoFocus autoComplete="organization" placeholder="Acme Ltd" {...form.register('name')} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Industry" optional hint="For example accounting software or dental clinic." error={errors.industry?.message}>
            {(p) => <Input {...p} {...form.register('industry')} />}
          </Field>
          <Field label="Company size" optional error={errors.size?.message}>
            {(p) => (
              <Select {...p} {...form.register('size')}>
                <option value="">Choose…</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {sizeLabel(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Main website" optional hint="You add it properly in the next step." error={errors.website?.message}>
          {(p) => <Input {...p} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="example.com" {...form.register('website')} />}
        </Field>
        {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
      </form>
    </StepFrame>
  );
}
