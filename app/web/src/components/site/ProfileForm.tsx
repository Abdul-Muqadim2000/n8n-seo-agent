import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { toast } from 'sonner';
import { BadgeCheck, Building2, CheckCircle2, Circle, MapPin, UserRound } from 'lucide-react';
import { COUNTRIES, PROFILE_CHECKS, profileFields, type ProfileFields, type ProfileLike, type ProfileReadiness, type Run } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { IconTile, ScoreRing } from '@/components/insight';
import { TagInput } from '@/components/ui/tag-input';
import { errorMessage } from '@/lib/api';
import { qk, useStartRun } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { applyServerErrors, asCountry, errorText, urlValidator } from './helpers';

// The business profile behind E-E-A-T (mode `profile`, Data Table seo_profiles): author, expert reviewer, business name, address
// (NAP) and links. Every later page gets a byline, an author box, Person / Organization / LocalBusiness schema and "Reviewed by".

export type ProfileValues = z.input<typeof profileFields>;
export const EMPTY_PROFILE: ProfileFields = profileFields.parse({});

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

/** A stored profile with every field present (the Data Table may leave some out). */
export function completeProfile(p: ProfileFields | null | undefined): ProfileFields {
  if (!p) return EMPTY_PROFILE;
  return {
    author: {
      name: str(p.author?.name),
      jobTitle: str(p.author?.jobTitle),
      credentials: str(p.author?.credentials),
      bio: str(p.author?.bio),
      url: str(p.author?.url),
      sameAs: list(p.author?.sameAs),
      imageUrl: str(p.author?.imageUrl),
      knowsAbout: list(p.author?.knowsAbout),
    },
    reviewer: { name: str(p.reviewer?.name), jobTitle: str(p.reviewer?.jobTitle), url: str(p.reviewer?.url) },
    businessName: str(p.businessName),
    businessType: str(p.businessType),
    address: {
      street: str(p.address?.street),
      city: str(p.address?.city),
      region: str(p.address?.region),
      postalCode: str(p.address?.postalCode),
      country: asCountry(p.address?.country) ?? '',
    },
    phone: str(p.phone),
    publicEmail: str(p.publicEmail),
    openingHours: str(p.openingHours),
    serviceAreas: list(p.serviceAreas),
    mapUrl: str(p.mapUrl),
    logoUrl: str(p.logoUrl),
  };
}

export function isEmptyProfile(v: ProfileFields): boolean {
  return !(v.author.name || v.businessName || v.address.street || v.phone || v.reviewer.name);
}

/** The server's readiness checks (@seo/shared PROFILE_CHECKS), evaluated live while typing. */
export function profileChecks(v: ProfileValues): { label: string; done: boolean; why: string }[] {
  return PROFILE_CHECKS.map((c) => ({ label: c.label, why: c.why, done: c.done(v as ProfileLike) }));
}

export function ProfileReadinessCard({ values, saved, className }: { values: ProfileValues; saved?: ProfileReadiness | null; className?: string }) {
  const checks = profileChecks(values);
  const done = checks.filter((c) => c.done).length;
  const score = Math.round((done / checks.length) * 100);
  const tone = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'critical';
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-3">
        <ScoreRing label="Profile readiness" value={score} tone={tone} display={`${score}%`} size={56} />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">Profile readiness</h4>
          <p className="mt-0.5 text-xs leading-snug text-ink-3">
            {done} of {checks.length} trust signals filled in.
            {saved && ` Saved profile: ${saved.score}%.`}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-[13px]">
            {c.done ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-good-text" aria-hidden /> : <Circle className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />}
            <span className={c.done ? 'text-ink-2' : 'text-ink'}>
              {c.label}
              <span className="sr-only">{c.done ? ' (done)' : ' (missing)'}</span>
              {!c.done && <span className="text-ink-3"> · {c.why}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Saves a profile through a `profile` run. Throws when the engine did not accept it. */
export function useSaveProfile(orgId: string, siteId: string) {
  const start = useStartRun(orgId);
  const qc = useQueryClient();
  const save = async (values: ProfileFields): Promise<Run> => {
    const run = await start.mutateAsync({ mode: 'profile', siteId, ...values, emailCopy: false });
    if (run.status === 'failed') throw new Error(run.error || 'The SEO engine did not accept the profile. Try again in a minute.');
    // the engine stores it within a minute: refresh what the settings show
    const refresh = () => qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] });
    window.setTimeout(refresh, 15_000);
    window.setTimeout(refresh, 60_000);
    return run;
  };
  return { save, isPending: start.isPending };
}

const GROUP_ICON: Record<string, ReactNode> = { Author: <UserRound />, 'Expert reviewer': <BadgeCheck />, Business: <Building2 />, Address: <MapPin /> };

function Group({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        {GROUP_ICON[title] && (
          <IconTile size="sm" className="mt-0.5">
            {GROUP_ICON[title]}
          </IconTile>
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{description}</p>}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

export function ProfileForm({
  profile,
  formId,
  readOnly = false,
  showSubmit = false,
  submitLabel = 'Save profile',
  submitting,
  emptyIsSkip = false,
  savedReadiness,
  onSubmit,
  onSkip,
  layout = 'stacked',
}: {
  profile?: ProfileFields | null;
  formId?: string;
  readOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  /** an empty form calls `onSkip` instead of failing validation (onboarding) */
  emptyIsSkip?: boolean;
  savedReadiness?: ProfileReadiness | null;
  onSubmit: (values: ProfileFields) => Promise<unknown>;
  onSkip?: () => void;
  /** `aside`: readiness beside the form on wide screens */
  layout?: 'stacked' | 'aside';
}) {
  const form = useForm<ProfileValues, unknown, ProfileFields>({
    resolver: zodResolver(profileFields),
    defaultValues: completeProfile(profile),
  });
  const { register, control, formState, setError } = form;
  const errors = formState.errors;
  const [error, setErr] = useState<unknown>(null);
  const values = form.watch();

  const submit = form.handleSubmit(async (v) => {
    setErr(null);
    if (isEmptyProfile(v)) {
      if (emptyIsSkip && onSkip) return onSkip();
      setError('author.name', { message: 'Fill in at least the author name or the business details' });
      return;
    }
    try {
      await onSubmit(v);
    } catch (e) {
      if (!applyServerErrors(e, setError)) setErr(e);
    }
  });

  const urlTags = (name: 'author.sameAs', label: string, hint: string, max: number) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} optional hint={hint} error={errorText(fieldState.error)}>
          {(p) => (
            <TagInput
              id={p.id}
              invalid={p['aria-invalid']}
              describedBy={p['aria-describedby']}
              value={field.value ?? []}
              onChange={field.onChange}
              max={max}
              validate={urlValidator}
              placeholder="https://www.linkedin.com/in/…, then Enter"
            />
          )}
        </Field>
      )}
    />
  );

  const fields = (
    <fieldset disabled={readOnly} className="min-w-0 space-y-6">
      <Group title="Author" description="The real person whose name goes on your pages. Google and AI assistants trust content from named, qualified people.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.author?.name?.message}>
            {(p) => <Input {...p} autoComplete="name" placeholder="Sara Khan" {...register('author.name')} />}
          </Field>
          <Field label="Job title" optional error={errors.author?.jobTitle?.message}>
            {(p) => <Input {...p} autoComplete="organization-title" placeholder="Head of Tax, Chartered Accountant" {...register('author.jobTitle')} />}
          </Field>
        </div>
        <Field label="Credentials and experience" optional hint="Qualifications, certifications, years of hands-on work. Real facts only." error={errors.author?.credentials?.message}>
          {(p) => <Textarea {...p} rows={2} maxLength={600} placeholder="ACCA, 12 years advising UAE companies on VAT and e-invoicing" {...register('author.credentials')} />}
        </Field>
        <Field label="Short bio" optional hint="Two to four sentences for the author box." error={errors.author?.bio?.message}>
          {(p) => <Textarea {...p} rows={3} maxLength={1200} {...register('author.bio')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author page on your site" optional hint="An about or team page." error={errors.author?.url?.message}>
            {(p) => <Input {...p} type="url" placeholder="https://example.com/team/sara" {...register('author.url')} />}
          </Field>
          <Field label="Photo URL" optional hint="A public link to a headshot." error={errors.author?.imageUrl?.message}>
            {(p) => <Input {...p} type="url" placeholder="https://example.com/img/sara.jpg" {...register('author.imageUrl')} />}
          </Field>
        </div>
        {urlTags('author.sameAs', 'Profile links', 'Up to 8: LinkedIn, X, a professional directory, a talk page.', 8)}
        <Controller
          control={control}
          name="author.knowsAbout"
          render={({ field, fieldState }) => (
            <Field label="Topics of expertise" optional hint="Up to 12 subjects the author knows well." error={errorText(fieldState.error)}>
              {(p) => (
                <TagInput
                  id={p.id}
                  invalid={p['aria-invalid']}
                  describedBy={p['aria-describedby']}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  max={12}
                  normalize={(s) => s.trim().slice(0, 80)}
                  placeholder="VAT, e-invoicing, then Enter"
                />
              )}
            </Field>
          )}
        />
      </Group>

      <Group title="Expert reviewer" description="Optional. Someone qualified who checks pages before they go live; pages then show “Reviewed by”. Leave empty if no one reviews.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" optional error={errors.reviewer?.name?.message}>
            {(p) => <Input {...p} {...register('reviewer.name')} />}
          </Field>
          <Field label="Job title" optional error={errors.reviewer?.jobTitle?.message}>
            {(p) => <Input {...p} {...register('reviewer.jobTitle')} />}
          </Field>
        </div>
        <Field label="Profile page" optional error={errors.reviewer?.url?.message}>
          {(p) => <Input {...p} type="url" placeholder="https://" {...register('reviewer.url')} />}
        </Field>
      </Group>

      <Group title="Business" description="Shown in the contact block and the Organization / LocalBusiness schema. It must match your Google Business Profile exactly.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" optional hint="The legal or trading name." error={errors.businessName?.message}>
            {(p) => <Input {...p} autoComplete="organization" {...register('businessName')} />}
          </Field>
          <Field label="Category" optional hint="For example Accounting firm, Dental clinic, Software company." error={errors.businessType?.message}>
            {(p) => <Input {...p} {...register('businessType')} />}
          </Field>
          <Field label="Phone" optional error={errors.phone?.message}>
            {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="+971 4 000 0000" {...register('phone')} />}
          </Field>
          <Field label="Public e-mail" optional error={errors.publicEmail?.message}>
            {(p) => <Input {...p} type="email" placeholder="hello@example.com" {...register('publicEmail')} />}
          </Field>
          <Field label="Opening hours" optional hint="Format: Mo-Fr 09:00-18:00 (several: Mo-Fr 09:00-18:00, Sa 10:00-14:00)." error={errors.openingHours?.message}>
            {(p) => <Input {...p} placeholder="Mo-Fr 09:00-18:00" {...register('openingHours')} />}
          </Field>
          <Field label="Logo URL" optional error={errors.logoUrl?.message}>
            {(p) => <Input {...p} type="url" placeholder="https://example.com/logo.png" {...register('logoUrl')} />}
          </Field>
        </div>
        <Field label="Map link" optional hint="Your Google Maps link." error={errors.mapUrl?.message}>
          {(p) => <Input {...p} type="url" placeholder="https://maps.google.com/?cid=…" {...register('mapUrl')} />}
        </Field>
      </Group>

      <Group title="Address" description="Only if customers visit you or you serve a local area. Leave empty for an online-only business.">
        <Field label="Street" optional error={errors.address?.street?.message}>
          {(p) => <Input {...p} autoComplete="street-address" {...register('address.street')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" optional error={errors.address?.city?.message}>
            {(p) => <Input {...p} autoComplete="address-level2" {...register('address.city')} />}
          </Field>
          <Field label="Region or state" optional error={errors.address?.region?.message}>
            {(p) => <Input {...p} autoComplete="address-level1" {...register('address.region')} />}
          </Field>
          <Field label="Postal code" optional error={errors.address?.postalCode?.message}>
            {(p) => <Input {...p} autoComplete="postal-code" {...register('address.postalCode')} />}
          </Field>
          <Field label="Country" optional error={errors.address?.country?.message}>
            {(p) => (
              <Select {...p} {...register('address.country')}>
                <option value="">Not set</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Controller
          control={control}
          name="serviceAreas"
          render={({ field, fieldState }) => (
            <Field label="Service areas" optional hint="Up to 20 cities or regions you serve. Used for local pages." error={errorText(fieldState.error)}>
              {(p) => (
                <TagInput
                  id={p.id}
                  invalid={p['aria-invalid']}
                  describedBy={p['aria-describedby']}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  max={20}
                  normalize={(s) => s.trim().slice(0, 80)}
                  placeholder="Dubai, Abu Dhabi, then Enter"
                />
              )}
            </Field>
          )}
        />
      </Group>
    </fieldset>
  );

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {layout === 'aside' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          {fields}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ProfileReadinessCard values={values} saved={savedReadiness} />
          </div>
        </div>
      ) : (
        <>
          <ProfileReadinessCard values={values} saved={savedReadiness} />
          {fields}
        </>
      )}
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

/** Saves with a toast; for pages that do not need the run. */
export function profileSavedToast() {
  toast.success('Profile sent to the SEO engine', { description: 'It is stored within a minute. New pages use it from then on.' });
}
