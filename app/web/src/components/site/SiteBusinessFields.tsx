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
import { GuideButton } from '@/components/guide';
import { toast } from 'sonner';
import { ApiRequestError, DONE_INSTEAD, errorMessage, isConfirmCancelled } from '@/lib/api';
import { cn } from '@/lib/utils';
import { applyServerErrors, asCountry, competitorValidator, errorText, guessCountry } from './helpers';

// The website's business details (createSiteSchema / siteBusinessSchema): the facts every page, report and AI-visibility question
// starts from. Used by onboarding (steps "website" and "business"), "Add a website" and Website settings -> Business details.

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
    services: site?.services ?? [],
  };
}

/** "What do you sell?": a service is 2-80 characters (the schema's rule), so the chip says why before the form does. */
const serviceValidator = (s: string): string | null => (s.length < 2 ? 'Use at least 2 characters' : null);

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
      if (!showSubmitError(e)) return;
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
          {(p) => <Textarea {...p} rows={3} maxLength={500} placeholder="We build accounting software for small and mid-sized businesses in Dubai." {...register('business')} />}
        </Field>

        <Controller
          control={control}
          name="services"
          render={({ field, fieldState }) => (
            <Field
              label="What do you sell?"
              hint="Your main services or products, one at a time (press Enter after each). We only suggest keywords and write pages that fit what you sell."
              error={errorText(fieldState.error)}
            >
              {(p) => (
                <TagInput
                  id={p.id}
                  invalid={p['aria-invalid']}
                  describedBy={p['aria-describedby']}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  max={30}
                  normalize={(s) => s.trim().replace(/\s+/g, ' ').slice(0, 80)}
                  validate={serviceValidator}
                  placeholder="For example: accounting software, then Enter"
                />
              )}
            </Field>
          )}
        />

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
              labelAction={<GuideButton id="business-facts" variant="link" label="What makes a good fact?" />}
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
                  labelAction={<GuideButton id="competitors" vars={{ domain: site?.domain ?? domain }} variant="link" label="Who counts as a competitor?" />}
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
                  hint="Names people use for your company, like 'Northwind Trading'. A short name that other companies share can be confused in AI answers, so list the full names."
                  labelAction={<GuideButton id="brand-names" vars={{ domain: site?.domain ?? domain }} variant="link" label="How should I write these?" />}
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

      {error != null && formErrorNode(error, form.getValues(), renderError)}

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

/**
 * Whether a failed save is an error the form shows. Not when the person cancelled the "Check this first" dialog (409 `confirm_needed`:
 * nothing was added or changed, the form keeps what they typed), nor when an Accept in it replaced the save (said in a toast).
 */
export function showSubmitError(e: unknown): boolean {
  if (isConfirmCancelled(e)) return false;
  if (e instanceof ApiRequestError && e.code === DONE_INSTEAD) {
    toast.success(e.message);
    return false;
  }
  return true;
}

/** What the form shows under its fields for a save it could not make: the screen's own message, else the error in plain words. */
export function formErrorNode(e: unknown, values: SiteFormValues, renderError?: (e: unknown, values: SiteFormValues) => ReactNode | null): ReactNode {
  return renderError?.(e, values) ?? <Callout tone="critical">{errorMessage(e)}</Callout>;
}

/**
 * Why POST /sites refused a new website, when it is a duplicate: `exists` = already one of this company's websites (`site_exists`, or
 * `conflict` when two saves raced), `claimed` = another company verified it (`domain_claimed`). Anything else (a 409 `confirm_needed`
 * above all, which is a question, not a duplicate) is not a duplicate: null.
 */
export function siteCreateConflict(e: unknown): 'exists' | 'claimed' | null {
  if (!(e instanceof ApiRequestError) || e.status !== 409) return null;
  if (e.code === 'domain_claimed') return 'claimed';
  if (e.code === 'site_exists' || e.code === 'conflict') return 'exists';
  return null;
}

/**
 * The duplicate message of "Add a website" and the onboarding Website step, in our words (never the server's text). Returns null for
 * anything that is not a duplicate, so the form's default message shows. `action`: a way to the existing website, `hint`: what to do.
 */
export function SiteCreateConflict({ error, domain, action, hint }: { error: unknown; domain: string; action?: ReactNode; hint?: string }) {
  const kind = siteCreateConflict(error);
  if (kind === 'claimed') return <DomainClaimedCallout domain={domain} />;
  if (kind !== 'exists') return null;
  return (
    <Callout tone="warning" title="You already added this website" action={action}>
      {`${domain || 'This website'} is already one of your company's websites.`}
      {hint ? ` ${hint}` : ''}
    </Callout>
  );
}

/** The explanation shown when another company already verified the domain (POST /sites answers 409). */
export function DomainClaimedCallout({ domain }: { domain: string }) {
  return (
    <Callout tone="critical" title={`${domain || 'This website'} already belongs to another company`}>
      Another company has verified this domain, and each website can belong to one company only. If it is your website, ask the owner of that company to invite you
      (Company settings, Team). If you think this is wrong, contact the platform administrator.
    </Callout>
  );
}
