import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { FieldValues, Path, UseFormRegisterReturn, UseFormReturn } from 'react-hook-form';
import { format, isValid, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock, Coins, Globe, Mail, PackageCheck, Play, Repeat } from 'lucide-react';
import {
  cleanDomain,
  COUNTRIES,
  domainOk,
  GOALS,
  MODES,
  NOTICE_MODES,
  PAGE_TYPES,
  pipelineNotices,
  TONES,
  type ModeId,
  type NoticeFormat,
  type NoticeInput,
  type PipelineNotice,
  type Site,
} from '@seo/shared';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useProviders, useSiteData } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { useStartRun } from '@/lib/queries';
import { cn, fmtAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Checkbox, ChoiceCard, Field, Select } from '@/components/ui/field';
import { TagInput } from '@/components/ui/tag-input';
import { isCountry } from '@/components/reports/meta';
import { costLabel, etaLabel } from './estimate';

// ---------- errors ----------

/** First message anywhere in a react-hook-form error (arrays of domains report per item). */
export function errMsg(e: unknown, depth = 0): string | undefined {
  if (!e || typeof e !== 'object' || depth > 3) return undefined;
  const m = (e as { message?: unknown }).message;
  if (typeof m === 'string' && m) return m;
  const values = Array.isArray(e) ? e : Object.entries(e as Record<string, unknown>).filter(([k]) => k !== 'ref' && k !== 'types').map(([, v]) => v);
  for (const v of values) {
    const r = errMsg(v, depth + 1);
    if (r) return r;
  }
  return undefined;
}

// ---------- site defaults ----------

export const validTone = (t: string | undefined) => (TONES as readonly string[]).includes(t ?? '') ? (t as (typeof TONES)[number]) : undefined;
export const validGoal = (g: string | undefined) => GOALS.find((x) => x.value === g)?.value;

/** The website's settings as form defaults (the server applies the rest of them when a field is left empty). */
export function siteDefaults(site: Site | null) {
  return {
    country: site && isCountry(site.country) ? site.country : undefined,
    tone: validTone(site?.tone),
    goal: validGoal(site?.goal),
    competitors: site?.competitors ?? [],
  };
}

/** Keeps `?site=` in the URL in step with the form's website (reloads and shared links keep the choice). */
export function useSyncSiteParam(siteId: string | null | undefined) {
  const [, setParams] = useSearchParams();
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (siteId) next.set('site', siteId);
        else next.delete('site');
        return next;
      },
      { replace: true },
    );
  }, [siteId, setParams]);
}

/** Runs `cb` when the chosen website changes after the first render (to refresh defaults the user has not touched). */
export function useSiteChange(siteId: string | null | undefined, cb: (site: Site | null) => void) {
  const { sites } = useOrgCtx();
  const prev = useRef(siteId);
  const fn = useRef(cb);
  fn.current = cb;
  useEffect(() => {
    if (prev.current === siteId) return;
    prev.current = siteId;
    fn.current(sites.find((s) => s.id === siteId) ?? null);
  }, [siteId, sites]);
}

/** Sets a field only while the user has not edited it. */
export function setPristine<T extends FieldValues, O>(form: UseFormReturn<T, unknown, O>, name: Path<T>, value: unknown) {
  if (value === undefined || form.getFieldState(name).isDirty) return;
  form.setValue(name, value as never, { shouldValidate: form.formState.isSubmitted });
}

// ---------- submit ----------

export function useRunSubmit<TIn extends FieldValues, TOut>(form: UseFormReturn<TIn, unknown, TOut>) {
  const { org } = useOrgCtx();
  const start = useStartRun(org.id);
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start.mutate(values, {
      onSuccess: (run) => {
        if (run.status === 'failed') toast.error('The SEO engine did not accept this run', { description: run.error ?? undefined });
        else toast.success('Run started', { description: `${run.title}. Results appear on the run page as they arrive.` });
        navigate(paths.run(org.id, run.id));
      },
      onError: (e) => {
        if (e instanceof ApiRequestError && Object.keys(e.fields).length) {
          const known = Object.keys(form.getValues());
          let unmatched = false;
          for (const [k, m] of Object.entries(e.fields)) {
            const root = k.split('.')[0];
            if (known.includes(root)) form.setError(root as Path<TIn>, { type: 'server', message: m }, { shouldFocus: true });
            else unmatched = true;
          }
          if (unmatched || e.status !== 400) setError(e);
        } else setError(e);
      },
    });
  });
  return { onSubmit, pending: start.isPending, error };
}

export function SubmitError({ error, siteId }: { error: unknown; siteId?: string | null }) {
  const { org, can } = useOrgCtx();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);
  if (!error) return null;
  let body: ReactNode = <Callout tone="critical" title="The run did not start">{errorMessage(error)}</Callout>;
  if (error instanceof ApiRequestError) {
    if (error.status === 402)
      body = (
        <Callout
          tone="critical"
          title="This run would go over the monthly budget"
          action={
            can('owner') && (
              <ButtonLink to={paths.settings(org.id, 'usage')} variant="secondary" size="sm">
                Raise the budget
              </ButtonLink>
            )
          }
        >
          {error.message}
          {!can('owner') && ' Ask a company owner to raise the budget.'}
        </Callout>
      );
    else if (error.status === 403 && /e-?mail/i.test(error.message))
      body = (
        <Callout
          tone="warning"
          title="Verify your e-mail address first"
          action={
            <ButtonLink to={paths.account} variant="secondary" size="sm">
              Your account
            </ButtonLink>
          }
        >
          {error.message}
        </Callout>
      );
    else if (error.status === 403 && /verify|own/i.test(error.message))
      body = (
        <Callout
          tone="warning"
          title="Verify the website first"
          action={
            siteId && (
              <ButtonLink to={paths.site(org.id, siteId, 'settings/verification')} variant="secondary" size="sm">
                Verify ownership
              </ButtonLink>
            )
          }
        >
          {error.message}
        </Callout>
      );
    else if (error.status === 403)
      body = (
        <Callout tone="warning" title="Not allowed">
          {error.message}
        </Callout>
      );
    else if (error.status === 502 || error.status === 0)
      body = (
        <Callout tone="critical" title="The SEO engine is not reachable">
          {error.message} Nothing was charged; try again in a few minutes.
        </Callout>
      );
    else if (error.status === 400)
      body = (
        <Callout tone="critical" title="Some details need fixing">
          {error.message}
          {Object.entries(error.fields).length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(error.fields).map(([k, m]) => (
                <li key={k}>
                  {k}: {m}
                </li>
              ))}
            </ul>
          )}
        </Callout>
      );
  }
  return <div ref={ref}>{body}</div>;
}

// ---------- layout ----------

export function FormCard({ title, description, children, className, aside }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

export interface ShellProps {
  mode: ModeId;
  site: Site | null;
  cost: number;
  eta: number;
  emailCopy: boolean;
  /** extra deliverables chosen in the form ("plus a full SEO report") */
  extras?: string[];
  onSubmit: FormEventHandler<HTMLFormElement>;
  pending: boolean;
  error: unknown;
  submitLabel?: string;
  /** a reason the run cannot start (shown instead of enabling the button) */
  blocked?: ReactNode;
  /** the form values the pipeline notices compare (keyword, existing page, …) */
  values?: NoticeInput;
  /** applies the pipeline's own plan for a keyword (existing page to improve) to the form */
  onUsePlan?: (plan: NonNullable<PipelineNotice['usePlan']>) => void;
  children: ReactNode;
}

const NOTICE_FORMAT: NoticeFormat = {
  when: (iso) => (isValid(parseISO(iso)) ? format(parseISO(iso), 'EEE d MMM, HH:mm') : iso),
  day: (iso) => (isValid(parseISO(iso)) ? format(parseISO(iso), 'EEE d MMM') : iso),
  ago: (iso) => fmtAgo(iso),
};

/**
 * What this run means for the website's automatic pipeline (shared/src/pipeline-notices.ts): the schedule already does it, it is
 * running right now, or the page / ladder already exists. Likely duplicates need a tick before the run starts.
 */
export function usePipelineNotices(mode: ModeId, site: Site | null, values: NoticeInput, cost: number) {
  const { org } = useOrgCtx();
  const on = NOTICE_MODES.includes(mode) && !!site?.verifiedAt;
  const q = useSiteData(org.id, site?.id ?? '', 'pipeline', undefined, { enabled: on, staleTime: 30_000 });
  // another website's data while this one loads would warn about the wrong pages
  const data = on && !q.isPlaceholderData ? q.data : undefined;
  const notices = pipelineNotices(mode, values, data, { fmt: NOTICE_FORMAT, costUsd: cost });
  const [acked, setAcked] = useState<string[]>([]);
  const unconfirmed = notices.filter((n) => n.confirm && !acked.includes(n.id));
  const toggle = (id: string, on: boolean) => setAcked((a) => (on ? [...a, id] : a.filter((x) => x !== id)));
  return { notices, acked, toggle, unconfirmed };
}

export function PipelineNotices({ notices, acked, onToggle, onUsePlan, siteId }: { notices: PipelineNotice[]; acked: string[]; onToggle: (id: string, on: boolean) => void; onUsePlan?: ShellProps['onUsePlan']; siteId: string }) {
  const { org } = useOrgCtx();
  if (!notices.length) return null;
  return (
    <div className="space-y-3" aria-live="polite">
      {notices.map((n) => {
        const to = n.link?.runId
          ? paths.run(org.id, n.link.runId)
          : n.link?.reportId
            ? paths.report(org.id, n.link.reportId)
            : n.link?.ladderId
              ? paths.ladder(org.id, siteId, n.link.ladderId)
              : n.link?.page
                ? paths.site(org.id, siteId, n.link.page)
                : null;
        return (
          <Callout key={n.id} tone={n.tone} title={n.title}>
            <p>{n.body}</p>
            {(to || (n.usePlan && onUsePlan)) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                {n.usePlan && onUsePlan && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => onUsePlan(n.usePlan!)}>
                    {n.usePlan.label}
                  </Button>
                )}
                {to && n.link && (
                  <Link to={to} className="text-[13px] font-medium text-accent-text hover:underline">
                    {n.link.label}
                  </Link>
                )}
              </div>
            )}
            {n.confirm && <Checkbox className="mt-3" checked={acked.includes(n.id)} onChange={(e) => onToggle(n.id, e.target.checked)} label={n.confirm} />}
          </Callout>
        );
      })}
    </div>
  );
}

/** The form with its sticky summary (right column on desktop, a bar at the bottom on phones). */
export function ToolShell({ mode, site, cost, eta, emailCopy, extras = [], onSubmit, pending, error, submitLabel = 'Start the run', blocked: blockedBy, values = {}, onUsePlan, children }: ShellProps) {
  const { can, me } = useOrgCtx();
  const providers = useProviders();
  const showEmail = emailCopy && !!providers.data?.engineEmails;
  const readOnly = !can('member');
  const pipe = usePipelineNotices(mode, site, values, cost);
  const blocked = blockedBy ?? (pipe.unconfirmed.length ? 'Tick the box in the warning above to start anyway.' : undefined);
  const disabled = readOnly || !!blocked;
  const info = MODES[mode];
  const summary = (withButton: boolean) => (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink">Summary</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <SummaryRow icon={<Globe className="size-4" />} label="Website">
          {site ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-ink">{site.domain}</span>
              {site.verifiedAt ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
            </span>
          ) : (
            <span className="text-ink-2">{info.siteBound ? 'Choose a website' : 'None: research only'}</span>
          )}
        </SummaryRow>
        <SummaryRow icon={<PackageCheck className="size-4" />} label="What you get">
          <span className="text-ink-2">{info.delivers}</span>
          {extras.map((x) => (
            <span key={x} className="mt-1 flex items-start gap-1.5 text-ink-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-good-text" aria-hidden />
              {x}
            </span>
          ))}
        </SummaryRow>
        <SummaryRow icon={<Coins className="size-4" />} label="Estimated cost">
          <span className="text-lg font-semibold text-ink">{costLabel(cost)}</span>
          {cost > 0 && <span className="block text-xs text-ink-3">Counted against your company's monthly budget</span>}
        </SummaryRow>
        <SummaryRow icon={<Clock className="size-4" />} label="Time">
          <span className="text-ink-2">{etaLabel(eta)}</span>
          <span className="block text-xs text-ink-3">You can leave the page: the run keeps going</span>
        </SummaryRow>
        {pipe.notices.length > 0 && (
          <SummaryRow icon={<Repeat className="size-4" />} label="Pipeline">
            {pipe.notices.map((n) => (
              <span key={n.id} className="flex items-start gap-1.5 text-ink-2">
                {n.tone === 'warning' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-text" aria-hidden /> : <Repeat className="mt-0.5 size-3.5 shrink-0 text-accent-text" aria-hidden />}
                {n.short}
              </span>
            ))}
          </SummaryRow>
        )}
        {showEmail && (
          <SummaryRow icon={<Mail className="size-4" />} label="E-mail copy">
            <span className="break-all text-ink-2">{me.user.email}</span>
          </SummaryRow>
        )}
      </dl>
      {withButton && (
        <Button type="submit" size="lg" className="mt-5 w-full" loading={pending} disabled={disabled} icon={<Play className="size-4" />}>
          {submitLabel}
        </Button>
      )}
      {readOnly && <p className="mt-2 text-xs text-ink-3">View-only access: ask an admin for the member role to start runs.</p>}
      {!readOnly && blocked && <div className="mt-2 text-xs text-ink-3">{blocked}</div>}
    </Card>
  );
  return (
    <form onSubmit={onSubmit} noValidate className="pb-24 lg:pb-0">
      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <SubmitError error={error} siteId={site?.id} />
            {site && <PipelineNotices notices={pipe.notices} acked={pipe.acked} onToggle={pipe.toggle} onUsePlan={onUsePlan} siteId={site.id} />}
            {children}
            <div className="lg:hidden">{summary(false)}</div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-6">{summary(true)}</div>
          </aside>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0 text-[13px]">
            <p className="font-semibold text-ink">{costLabel(cost)}</p>
            <p className="truncate text-ink-3">{etaLabel(eta)}</p>
          </div>
          <Button type="submit" loading={pending} disabled={disabled} icon={<Play className="size-4" />}>
            {submitLabel}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function SummaryRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-ink-3">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}

// ---------- fields ----------

export function SiteField({ value, onChange, optional, error }: { value: string | null | undefined; onChange: (id: string | null) => void; optional?: boolean; error?: string }) {
  const { sites, org, can } = useOrgCtx();
  const verified = sites.filter((s) => s.verifiedAt);
  const current = sites.find((s) => s.id === value) ?? null;
  let hint: ReactNode;
  if (!sites.length)
    hint = (
      <>
        No website yet.{' '}
        {can('admin') ? (
          <Link to={paths.newSite(org.id)} className="text-accent-text hover:underline">
            Add your website
          </Link>
        ) : (
          'Ask an admin to add it.'
        )}
      </>
    );
  else if (!verified.length)
    hint = (
      <>
        None of your websites is verified yet.{' '}
        <Link to={paths.site(org.id, sites[0].id, 'settings/verification')} className="text-accent-text hover:underline">
          Verify {sites[0].domain}
        </Link>{' '}
        to run checks against it.
      </>
    );
  else if (current) hint = <>The defaults below come from this website's settings; changes apply to this run only.</>;
  else if (optional) hint = <>Without a website the research is generic: no existing-page checks, no tracking.</>;
  return (
    <Field label="Website" error={error} hint={hint} optional={optional}>
      {(p) => (
        <Select {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          {optional ? <option value="">No website (research only)</option> : !value && <option value="">Choose a website</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.verifiedAt}>
              {s.domain}
              {s.verifiedAt ? '' : ' (not verified)'}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function CountryField({ reg, error, hint = 'The Google market to research (search volumes, rankings and competitors differ by country).', label = 'Country' }: { reg: UseFormRegisterReturn; error?: string; hint?: ReactNode; label?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(p) => (
        <Select {...p} {...reg}>
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function ToneField({ reg, error }: { reg: UseFormRegisterReturn; error?: string }) {
  return (
    <Field label="Tone of voice" error={error} hint="How the page should sound. Defaults to your website's tone.">
      {(p) => (
        <Select {...p} {...reg}>
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function GoalField({ reg, error, hint = 'Shapes the call to action and how commercial the page is.' }: { reg: UseFormRegisterReturn; error?: string; hint?: ReactNode }) {
  return (
    <Field label="Goal" error={error} hint={hint}>
      {(p) => (
        <Select {...p} {...reg}>
          {GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

const PAGE_TYPE_HELP: Record<string, string> = {
  'Service Page': 'Sells one service: what you do, for whom, proof and a clear call to action.',
  'Product Page': 'One product: benefits, specifications, buying questions and pricing cues.',
  'Blog Post': 'Answers one question or covers one topic. Builds traffic, links and AI citations.',
  'Landing Page': 'A focused campaign page: one offer, one action.',
  Guide: 'An in-depth explainer or how-to that earns links and gets quoted.',
  'Pillar Page': 'A hub for a whole topic, with sections that link to every page in the cluster.',
  'Local Page': 'Your service in one city or area, with your verified address and local proof.',
};

export function PageTypeField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">Page type</p>
      <div role="radiogroup" aria-label="Page type" className="grid gap-2 sm:grid-cols-2">
        {PAGE_TYPES.map((p) => (
          <ChoiceCard key={p.value} selected={value === p.value} onSelect={() => onChange(p.value)} title={p.label} description={PAGE_TYPE_HELP[p.value]} />
        ))}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-critical-text">{error}</p>}
    </div>
  );
}

export function EmailCopyField({ reg }: { reg: UseFormRegisterReturn }) {
  const { me } = useOrgCtx();
  const providers = useProviders();
  // e-mail delivery is switched off on the platform (ENGINE_EMAILS): every result is here only
  if (!providers.data?.engineEmails) return null;
  return <Checkbox {...reg} label="Also e-mail me a copy" description={`The results and files are always kept here; a copy goes to ${me.user.email}.`} />;
}

/** Competitor domains: cleaned and validated as they are typed (same rules as the SEO engine). */
export function DomainTagsField({
  value,
  onChange,
  error,
  ownDomain,
  label = 'Competitors',
  hint,
  max = 3,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
  ownDomain?: string;
  label?: string;
  hint?: ReactNode;
  max?: number;
}) {
  return (
    <Field label={label} error={error} hint={hint} optional>
      {(p) => (
        <TagInput
          id={p.id}
          invalid={!!error}
          describedBy={p['aria-describedby']}
          value={value}
          onChange={onChange}
          max={max}
          placeholder="competitor.com"
          normalize={cleanDomain}
          validate={(d) => (!domainOk(d) ? `“${d}” is not a public website address` : ownDomain && d === cleanDomain(ownDomain) ? 'That is your own website' : null)}
        />
      )}
    </Field>
  );
}

/** Plain-text tags (topics, keywords). */
export function TextTagsField({ value, onChange, error, label, hint, max, placeholder, maxLength = 80 }: { value: string[]; onChange: (v: string[]) => void; error?: string; label: string; hint?: ReactNode; max: number; placeholder?: string; maxLength?: number }) {
  return (
    <Field label={label} error={error} hint={hint} optional>
      {(p) => (
        <TagInput
          id={p.id}
          invalid={!!error}
          describedBy={p['aria-describedby']}
          value={value}
          onChange={onChange}
          max={max}
          placeholder={placeholder}
          normalize={(s) => s.trim().replace(/\s+/g, ' ')}
          validate={(s) => (s.length < 2 ? 'Too short' : s.length > maxLength ? `Keep it under ${maxLength} characters` : null)}
        />
      )}
    </Field>
  );
}
