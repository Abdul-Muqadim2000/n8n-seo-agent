import { useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { cleanDomain, COUNTRIES, formatUsd, MONITOR_COSTS, trackInput, type MonitorSettings, type Site } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { TagInput } from '@/components/ui/tag-input';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { applyServerErrors, asCountry, competitorValidator, errorText } from './helpers';
import { completeMonitors, DEFAULT_MONITORS, MonitoringCost, MonitorSettingsFields } from './MonitorSettingsFields';
import { aiMeasuredFrom } from './AiPrecision';
import { useSiteData } from '@/lib/queries';

// "Track my site" (mode `track`): keywords, GA4 property, blog posts per week, competitors and the growth monitors.

export const trackFormSchema = trackInput.omit({ mode: true, siteId: true, emailCopy: true }).superRefine((v, ctx) => {
  if (v.monitors.aiVisibility && !v.monitors.aiEngines.length)
    ctx.addIssue({ code: 'custom', path: ['monitors', 'aiEngines'], message: 'Choose at least one engine, or turn AI visibility off' });
});
export type TrackFormValues = z.input<typeof trackFormSchema>;
export type TrackFormOutput = z.output<typeof trackFormSchema>;

/** Form defaults from the website (and, when known, its current monitors and cadence). */
export function trackDefaults(site: Site, extra: Partial<TrackFormOutput> = {}): TrackFormOutput {
  const monitors = completeMonitors(extra.monitors ?? { brandNames: site.brandNames ?? [] });
  return {
    country: (extra.country ?? asCountry(site.country)) as TrackFormOutput['country'],
    keywords: extra.keywords ?? site.keywords ?? [],
    ga4PropertyId: extra.ga4PropertyId ?? site.ga4PropertyId ?? '',
    blogsPerWeek: Math.min(3, Math.max(0, extra.blogsPerWeek ?? site.blogsPerWeek ?? 0)),
    competitors: extra.competitors ?? site.competitors ?? [],
    monitors: monitors.brandNames.length ? monitors : { ...monitors, brandNames: site.brandNames ?? [] },
  };
}

export const BLOG_OPTIONS = [0, 1, 2, 3] as const;
export const blogMonthlyCost = (n: number) => n * MONITOR_COSTS.weeksPerMonth * MONITOR_COSTS.blogPostEach;

export function TrackingForm({
  site,
  defaults,
  formId,
  sections = 'full',
  showCountry = true,
  readOnly = false,
  showSubmit = false,
  submitLabel = 'Start tracking',
  submitting,
  onSubmit,
  onValuesChange,
}: {
  site: Site;
  defaults?: TrackFormOutput;
  formId?: string;
  /** `basics`: country, keywords, GA4 and competitors only (blog posts and monitors are kept as they are) */
  sections?: 'full' | 'basics';
  showCountry?: boolean;
  readOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (values: TrackFormOutput) => Promise<unknown>;
  /** every change, e.g. to keep a draft */
  onValuesChange?: (values: TrackFormValues) => void;
}) {
  const form = useForm<TrackFormValues, unknown, TrackFormOutput>({
    resolver: zodResolver(trackFormSchema),
    defaultValues: defaults ?? trackDefaults(site),
  });
  const { register, control, formState, setError, setValue, watch } = form;
  // B8-7: the precision table reads what the latest AI run measured (a verified website only; none yet = modelled)
  const ai = useSiteData(site.orgId, site.id, 'ai', undefined, { enabled: !!site.verifiedAt && sections === 'full' });
  const errors = formState.errors;
  const [error, setErr] = useState<unknown>(null);
  const blogsLabel = useId();

  useEffect(() => {
    if (!onValuesChange) return;
    const sub = watch((v) => onValuesChange(v as TrackFormValues));
    return () => sub.unsubscribe();
  }, [watch, onValuesChange]);

  const monitors = completeMonitors(watch('monitors') as Partial<MonitorSettings> | undefined);
  const blogsPerWeek = watch('blogsPerWeek') ?? 0;

  const submit = form.handleSubmit(async (values) => {
    setErr(null);
    try {
      await onSubmit(values);
    } catch (e) {
      if (!applyServerErrors(e, setError)) setErr(e);
    }
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      <fieldset disabled={readOnly} className="min-w-0 space-y-5">
        {showCountry && (
          <Field label="Country" hint="Rankings and trends are checked for this country." error={errors.country?.message}>
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
        )}

        <Controller
          control={control}
          name="keywords"
          render={({ field, fieldState }) => (
            <Field
              label="Keywords to track"
              optional
              hint="Up to 20 search terms you want to rank for. We check your live Google position for each every week. Everything Search Console reports is tracked anyway."
              labelAction={<GuideButton id="keywords-to-track" vars={{ domain: site.domain }} variant="link" label="How do I choose these?" />}
              error={errorText(fieldState.error)}
            >
              {(p) => (
                <TagInput
                  id={p.id}
                  invalid={p['aria-invalid']}
                  describedBy={p['aria-describedby']}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  max={20}
                  normalize={(s) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100)}
                  validate={(s) => (s.length < 2 ? 'Keywords need at least 2 characters' : null)}
                  placeholder="accounting software dubai, then Enter"
                />
              )}
            </Field>
          )}
        />

        <Field
          label="GA4 property ID"
          optional
          hint="Leave empty and we use the GA4 property whose web stream matches your domain. Find it in GA4 → Admin → Property details."
          labelAction={<GuideButton id="ga4-property-id" vars={{ domain: site.domain }} variant="link" label="Where do I find it?" />}
          error={errors.ga4PropertyId?.message}
          className="max-w-sm"
        >
          {(p) => <Input {...p} inputMode="numeric" placeholder="123456789" {...register('ga4PropertyId')} />}
        </Field>

        <Controller
          control={control}
          name="competitors"
          render={({ field, fieldState }) => (
            <Field
              label="Competitors"
              optional
              hint="Up to 3. Compared in AI answers, backlinks and the monthly report."
              labelAction={<GuideButton id="competitors" vars={{ domain: site.domain }} variant="link" label="Who counts as a competitor?" />}
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
                  validate={competitorValidator(site.domain)}
                  placeholder="competitor.com, then Enter"
                />
              )}
            </Field>
          )}
        />

        {sections === 'full' && (
          <>
            <div>
              <p id={blogsLabel} className="mb-1 text-[13px] font-medium text-ink">
                Blog posts per week
              </p>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
                Each post is a full, researched page: keyword and competitor research, a written and quality-checked article with its three images and schema. It arrives
                every Monday as HTML and Markdown (plus the image files and a meta.json) for you to review and publish. Topics come from your keyword plan, queries close to page one and
                rising trends.
              </p>
              <div role="radiogroup" aria-labelledby={blogsLabel} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {BLOG_OPTIONS.map((n) => (
                  <ChoiceCard
                    key={n}
                    selected={blogsPerWeek === n}
                    onSelect={() => setValue('blogsPerWeek', n, { shouldDirty: true })}
                    disabled={readOnly}
                    title={n === 0 ? 'None' : `${n} a week`}
                    description={n === 0 ? 'Tracking only' : `about ${formatUsd(blogMonthlyCost(n), 0)} / month`}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[13px] font-medium text-ink">Growth monitors</p>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-3">They run in the background and appear on your dashboard. Turn off what you do not need.</p>
              <MonitorSettingsFields
                value={monitors}
                onChange={(m) => setValue('monitors', m, { shouldDirty: true, shouldValidate: formState.isSubmitted })}
                disabled={readOnly}
                enginesError={errors.monitors?.aiEngines?.message}
                aiMeasured={aiMeasuredFrom(ai.data)}
              />
            </div>

            <MonitoringCost monitors={monitors} blogsPerWeek={blogsPerWeek} />
          </>
        )}
      </fieldset>

      {!showCountry && errors.country && <Callout tone="critical">Set the website’s main country in the business details first.</Callout>}
      {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}

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

export { DEFAULT_MONITORS };
