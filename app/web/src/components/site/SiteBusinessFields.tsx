import { useEffect, useId, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { cleanDomain, COUNTRIES, createSiteSchema, GOALS, siteBusinessSchema, TONES, type Site } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select, Textarea } from '@/components/ui/field';
import { TagInput } from '@/components/ui/tag-input';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { applyServerErrors, asCountry, competitorValidator, errorText, guessCountry } from './helpers';

// The website's business details (createSiteSchema / siteBusinessSchema): the facts every page, report and AI-visibility question
// starts from. Used by onboarding (steps "website" and "business"), "Add a website" and Website settings → Business details.

const editSchema = siteBusinessSchema.extend({ domain: z.string() });
export type SiteFormValues = z.input<typeof createSiteSchema>;
export type SiteFormOutput = z.output<typeof createSiteSchema>;
/** What PATCH /sites/:id takes from this form (the domain never changes). */
export type SiteBusinessOutput = Omit<SiteFormOutput, 'domain'>;

export function businessOnly(v: SiteFormOutput): SiteBusinessOutput {
  const { domain: _domain, ...rest } = v;
  return rest;
}

function defaultsFor(site: Site | null | undefined, defaultDomain: string | undefined): SiteFormValues {
  const tone = TONES.find((t) => t === site?.tone) ?? TONES[0];
  const goal = GOALS.find((g) => g.value === site?.goal)?.value ?? 'leads';
  return {
    domain: site?.domain ?? (defaultDomain ? cleanDomain(defaultDomain) : ''),
    country: (asCountry(site?.country) ?? (site ? undefined : guessCountry())) as SiteFormValues['country'],
    business: site?.business ?? '',
    customers: site?.customers ?? '',
    goal,
    tone,
    cta: site?.cta ?? '',
    businessFacts: site?.businessFacts ?? '',
    competitors: site?.competitors ?? [],
    brandNames: site?.brandNames ?? [],
  };
}

const MORE_FIELDS = ['tone', 'cta', 'businessFacts', 'competitors', 'brandNames'] as const;

export function SiteBusinessForm({
  mode,
  site,
  defaultDomain,
  formId,
  collapseMore = false,
  readOnly = false,
  showSubmit = false,
  submitLabel = 'Save changes',
  submitting,
  onSubmit,
  renderError,
}: {
  mode: 'create' | 'edit';
  /** the website being edited (edit mode) */
  site?: Site | null;
  /** prefill for the domain in create mode (e.g. the company's website) */
  defaultDomain?: string;
  /** lets a button outside the form submit it (`<Button type="submit" form={formId}>`) */
  formId?: string;
  /** tone, CTA, facts, competitors and brand names behind a "More details" toggle */
  collapseMore?: boolean;
  readOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  /** throw (or reject) to show the error; ApiRequestError field errors land on their fields */
  onSubmit: (values: SiteFormOutput) => Promise<unknown>;
  /** custom rendering of a non-field error (e.g. 409 on create); return null to fall back to the default */
  renderError?: (e: unknown, values: SiteFormValues) => ReactNode | null;
}) {
  const form = useForm<SiteFormValues, unknown, SiteFormOutput>({
    resolver: mode === 'create' ? zodResolver(createSiteSchema) : zodResolver(editSchema),
    defaultValues: defaultsFor(site, defaultDomain),
  });
  const { register, control, formState, setError } = form;
  const errors = formState.errors;
  const [error, setErr] = useState<unknown>(null);
  const [moreOpen, setMoreOpen] = useState(!collapseMore);

  // a validation error inside the collapsed part opens it, so the message is visible
  const moreHasError = MORE_FIELDS.some((k) => !!errors[k]);
  useEffect(() => {
    if (moreHasError) setMoreOpen(true);
  }, [moreHasError]);
  const goalLabelId = useId();

  const submit = form.handleSubmit(async (values) => {
    setErr(null);
    try {
      await onSubmit(values);
    } catch (e) {
      const onFields = applyServerErrors(e, setError);
      if (!onFields || (e as { status?: number }).status === 409) setErr(e);
    }
  });

  const domain = form.watch('domain');
  const businessLen = form.watch('business')?.length ?? 0;
  const factsLen = form.watch('businessFacts')?.length ?? 0;

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      <fieldset disabled={readOnly} className="space-y-5">
        {mode === 'create' ? (
          <Field label="Website address" hint="Your public website, for example example.com. Leave out https:// and www." error={errors.domain?.message}>
            {(p) => <Input {...p} inputMode="url" autoComplete="url" autoCapitalize="off" spellCheck={false} placeholder="example.com" {...register('domain')} />}
          </Field>
        ) : (
          <Field label="Website address" hint="The address cannot be changed. To track another address, add it as a new website.">
            {(p) => <Input {...p} value={site?.domain ?? domain} readOnly disabled />}
          </Field>
        )}

        <Field
          label="Main country"
          hint="Where your customers search. Rankings, keyword volumes and AI answers are checked for this country."
          error={errors.country?.message}
        >
          {(p) => (
            <Select {...p} {...register('country')}>
              <option value="">Choose a country</option>
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="What you do"
          hint={`One or two sentences: what you offer and what makes it different. ${businessLen}/500`}
          error={errors.business?.message}
        >
          {(p) => <Textarea {...p} rows={3} maxLength={500} placeholder="We build e-invoicing software for small and mid-sized businesses in the UAE, approved for FTA Phase 2." {...register('business')} />}
        </Field>

        <Field label="Who your customers are" hint="The people who buy from you: role, company type, location." error={errors.customers?.message}>
          {(p) => <Textarea {...p} rows={2} maxLength={300} placeholder="Finance managers and owners of UAE companies with 10 to 500 staff." {...register('customers')} />}
        </Field>

        <Controller
          control={control}
          name="goal"
          render={({ field }) => (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink" id={goalLabelId}>
                Main goal of your website
              </p>
              <div role="radiogroup" aria-labelledby={goalLabelId} className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <ChoiceCard key={g.value} selected={field.value === g.value} onSelect={() => field.onChange(g.value)} title={g.label} disabled={readOnly} />
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-ink-3">Steers which keywords are chosen and how each page ends.</p>
            </div>
          )}
        />

        {collapseMore && (
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left hover:border-line-strong"
          >
            <span>
              <span className="block text-sm font-medium text-ink">Tone, call to action, facts and competitors</span>
              <span className="block text-[13px] text-ink-3">Optional now. You review them again in the business step.</span>
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
          </button>
        )}

        {moreOpen && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tone of voice" hint="How your pages should sound." error={errors.tone?.message}>
                {(p) => (
                  <Select {...p} {...register('tone')}>
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Call to action" optional hint="What a reader should do next." error={errors.cta?.message}>
                {(p) => <Input {...p} maxLength={200} placeholder="Book a free 20-minute demo" {...register('cta')} />}
              </Field>
            </div>

            <Field
              label="Business facts"
              optional
              hint={`Real facts only: years in business, number of clients, certifications, published prices, guarantees, locations, awards. Pages quote these and never invent numbers. ${factsLen}/2000`}
              error={errors.businessFacts?.message}
            >
              {(p) => (
                <Textarea
                  {...p}
                  rows={5}
                  maxLength={2000}
                  placeholder={'Founded in 2016 in Dubai\n420 customers, 98% renewal rate\nISO 27001 certified\nPlans from AED 99 per month'}
                  {...register('businessFacts')}
                />
              )}
            </Field>

            <Controller
              control={control}
              name="competitors"
              render={({ field, fieldState }) => (
                <Field
                  label="Competitors"
                  optional
                  hint="Up to 3 competitor websites. Used for share of voice in AI answers, the backlink gap and the full SEO report."
                  error={errorText(fieldState.error)}
                >
                  {(p) => (
                    <TagInput
                      id={p.id}
                      invalid={p['aria-invalid']}
                      describedBy={p['aria-describedby']}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      max={3}
                      normalize={cleanDomain}
                      validate={competitorValidator(site?.domain ?? domain)}
                      placeholder="competitor.com, then Enter"
                    />
                  )}
                </Field>
              )}
            />

            <Controller
              control={control}
              name="brandNames"
              render={({ field, fieldState }) => (
                <Field
                  label="Brand names"
                  optional
                  hint="Names people use for your company, like 'Techand AI'. A short name that other companies share can be confused in AI answers, so list the full names."
                  error={errorText(fieldState.error)}
                >
                  {(p) => (
                    <TagInput
                      id={p.id}
                      invalid={p['aria-invalid']}
                      describedBy={p['aria-describedby']}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      max={10}
                      normalize={(s) => s.trim().slice(0, 80)}
                      placeholder="Your brand name, then Enter"
                    />
                  )}
                </Field>
              )}
            />
          </div>
        )}
      </fieldset>

      {error != null && (renderError?.(error, form.getValues()) ?? <Callout tone="critical">{errorMessage(error)}</Callout>)}

      {showSubmit && !readOnly && (
        <div className="flex justify-end">
          <Button type="submit" loading={submitting ?? formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

/** The explanation shown when another company already verified the domain (POST /sites answers 409). */
export function DomainClaimedCallout({ domain }: { domain: string }) {
  return (
    <Callout tone="critical" title={`${domain || 'This website'} already belongs to another company`}>
      Another company has verified this domain, and each website can belong to one company only. If it is your website, ask the owner of that company to invite you
      (Company settings → Team). If you think this is wrong, contact the platform administrator.
    </Callout>
  );
}
