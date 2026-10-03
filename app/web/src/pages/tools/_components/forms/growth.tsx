import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AI_ENGINES, RUN_SCHEMAS } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { Badge } from '@/components/ui/badge';
import { ChoiceCard } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/tabs';
import { estimateCost, estimateEta } from '../estimate';
import { CountryField, DomainTagsField, EmailCopyField, errMsg, FormCard, GoalField, setPristine, siteDefaults, SiteField, TextTagsField, ToneField, ToolShell, useRunSubmit, useSiteChange, useSyncSiteParam } from '../kit';
import { TextAreaField, TextField, withPrefill, type ToolFormProps } from '../form-utils';

const blockedWithout = (verified: boolean) => (verified ? undefined : 'Verify a website first: this runs against your own site.');

// ---------------- ladder ----------------
const LS = RUN_SCHEMAS.ladder;
type LIn = z.input<typeof LS>;
type LOut = z.output<typeof LS>;

export function LadderForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<LIn, unknown, LOut>({
    resolver: zodResolver(LS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<LIn>>(
      {
        mode: 'ladder',
        siteId: initialSiteId ?? '',
        keyword: '',
        country: sd.country,
        business: '',
        customers: '',
        businessFacts: '',
        goal: sd.goal ?? 'leads',
        tone: sd.tone ?? 'Professional and direct',
        cta: '',
        pagesNow: 1,
        emailCopy: true,
      },
      prefill,
    ),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => {
    const d = siteDefaults(s);
    setPristine(form, 'country', d.country);
    setPristine(form, 'tone', d.tone);
    setPristine(form, 'goal', d.goal);
  });
  const pagesNow = v.pagesNow ?? 1;

  return (
    <ToolShell
      mode="ladder"
      site={site}
      cost={estimateCost('ladder', v)}
      eta={estimateEta('ladder', v)}
      emailCopy={!!v.emailCopy}
      extras={[`${pagesNow} page${pagesNow === 1 ? '' : 's'} written now`, 'Weekly rank tracking of every rung']}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel="Build the ladder"
      values={{ keyword: v.keyword }}
      blocked={blockedWithout(sites.some((s) => s.verifiedAt))}
    >
      <FormCard title="The keyword to win" description="A head term you cannot rank for yet. The ladder starts with winnable long-tail pages and climbs to it, with a feasibility verdict, link map and timeline.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <TextField label="Head keyword" reg={form.register('keyword')} error={errMsg(e.keyword)} placeholder="e.g. e invoicing in uae" hint="The competitive term you ultimately want to rank for." />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} />
      </FormCard>

      <FormCard title="Pages to write now" description="The easiest rung-1 pages are written right away (each about $1.20 and 10 minutes, delivered as its own report). The rest follow from the plan or the weekly content cadence.">
        <div role="radiogroup" aria-label="Pages to write now" className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <ChoiceCard
              key={n}
              selected={pagesNow === n}
              onSelect={() => form.setValue('pagesNow', n, { shouldDirty: true })}
              title={`${n} page${n === 1 ? '' : 's'}`}
              badge={<Badge>+${(n * 1.2).toFixed(2)}</Badge>}
              description={n === 1 ? 'Start small, publish, then continue' : n === 2 ? 'Two rung-1 pages in parallel' : 'A fast start on the first rung'}
            />
          ))}
        </div>
        <p className="text-[13px] text-ink-3">The plan itself costs about $0.60 (research and feasibility).</p>
      </FormCard>

      <FormCard title="Business context" description={site ? `Leave these empty to use ${site.domain}'s settings.` : 'Used for relevance and for the pages written now.'}>
        <TextAreaField label="What you sell" optional reg={form.register('business')} error={errMsg(e.business)} rows={2} max={500} value={v.business} hint={site?.business ? `Default: ${site.business.slice(0, 120)}${site.business.length > 120 ? '…' : ''}` : undefined} />
        <TextField label="Who buys it" optional reg={form.register('customers')} error={errMsg(e.customers)} hint={site?.customers ? `Default: ${site.customers}` : undefined} />
        <div className="grid gap-5 sm:grid-cols-2">
          <GoalField reg={form.register('goal')} error={errMsg(e.goal)} />
          <ToneField reg={form.register('tone')} error={errMsg(e.tone)} />
        </div>
        <TextField label="Call to action" optional reg={form.register('cta')} error={errMsg(e.cta)} placeholder="e.g. Book a free readiness assessment" hint={site?.cta ? `Default: ${site.cta}` : undefined} />
        <TextAreaField label="Business facts" optional reg={form.register('businessFacts')} error={errMsg(e.businessFacts)} rows={3} max={2000} value={v.businessFacts} hint="Verified facts the pages may use." />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- case study ----------------
const CS = RUN_SCHEMAS.case_study;
type CIn = z.input<typeof CS>;
type COut = z.output<typeof CS>;

export function CaseStudyForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<CIn, unknown, COut>({
    resolver: zodResolver(CS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<CIn>>(
      {
        mode: 'case_study',
        siteId: initialSiteId ?? '',
        country: sd.country,
        service: '',
        clientName: '',
        clientPublic: true,
        industry: '',
        location: '',
        challenge: '',
        solution: '',
        timeline: '',
        results: '',
        quote: '',
        quoteBy: '',
        keyword: '',
        emailCopy: true,
      },
      prefill,
    ),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => setPristine(form, 'country', siteDefaults(s).country));
  const hasNumbers = /\d/.test(v.results ?? '');

  return (
    <ToolShell
      mode="case_study"
      site={site}
      cost={estimateCost('case_study', v)}
      eta={estimateEta('case_study', v)}
      emailCopy={!!v.emailCopy}
      extras={['Stored as proof that later pages cite']}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel="Write the case study"
      blocked={blockedWithout(sites.some((s) => s.verifiedAt))}
    >
      <FormCard title="The client" description="Real, specific proof is what makes a case study rank and convert. Everything here is used as written: nothing is invented.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <TextField
          label="Client"
          reg={form.register('clientName')}
          error={errMsg(e.clientName)}
          placeholder="e.g. Gulf Foods Trading, or “a 40-person food distributor”"
          hint="The company name, or a description when you cannot name them."
        />
        <div className="border-y border-line">
          <SwitchRow
            title="We may name the client publicly"
            description="Off: the page describes the client without naming them (industry, size, location)."
            checked={v.clientPublic !== false}
            onCheckedChange={(c) => form.setValue('clientPublic', c, { shouldDirty: true })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Industry" optional reg={form.register('industry')} error={errMsg(e.industry)} placeholder="e.g. Food distribution" />
          <TextField label="Location" optional reg={form.register('location')} error={errMsg(e.location)} placeholder="e.g. Dubai, UAE" />
        </div>
        <CountryField reg={form.register('country')} error={errMsg(e.country)} hint="The Google market the case-study page targets." />
      </FormCard>

      <FormCard title="The project">
        <TextField label="Service you delivered" reg={form.register('service')} error={errMsg(e.service)} placeholder="e.g. Dynamics 365 Business Central implementation" />
        <TextAreaField
          label="The challenge"
          reg={form.register('challenge')}
          error={errMsg(e.challenge)}
          rows={4}
          max={2000}
          value={v.challenge}
          placeholder="What was wrong before? e.g. invoices in three spreadsheets, month-end close took 12 days, no stock visibility across two warehouses."
          hint="The situation before you came in, in the client's terms."
        />
        <TextAreaField
          label="What you did"
          reg={form.register('solution')}
          error={errMsg(e.solution)}
          rows={5}
          max={3000}
          value={v.solution}
          placeholder="The approach, the steps and the tools. e.g. 2-week discovery, migrated 8 years of data, integrated the e-invoicing provider, trained 25 users."
          hint="Specific steps and decisions read as real experience."
        />
        <TextField label="Timeline" optional reg={form.register('timeline')} error={errMsg(e.timeline)} placeholder="e.g. 12 weeks, March to June 2026" />
      </FormCard>

      <FormCard title="Results">
        <TextAreaField
          label="Results, with numbers"
          reg={form.register('results')}
          error={errMsg(e.results)}
          rows={4}
          max={2000}
          value={v.results}
          placeholder="e.g. Month-end close from 12 to 4 days · 100% of invoices e-invoicing compliant before the deadline · 18 hours a week of manual entry removed."
          hint={v.results && !hasNumbers ? 'Add at least one number (before → after, %, time or money saved): numbers are what gets cited.' : 'Only figures the client would confirm.'}
        />
        <TextAreaField label="Client quote" optional reg={form.register('quote')} error={errMsg(e.quote)} rows={3} max={600} value={v.quote} placeholder="A sentence or two in the client's words" />
        <TextField label="Quote by" optional reg={form.register('quoteBy')} error={errMsg(e.quoteBy)} placeholder="e.g. Sara Ahmed, Finance Director" hint="Name and role (or role only for anonymous clients)." />
      </FormCard>

      <FormCard title="Search">
        <TextField
          label="Target keyword"
          optional
          reg={form.register('keyword')}
          error={errMsg(e.keyword)}
          placeholder="e.g. business central implementation case study"
          hint="Leave empty and a keyword is chosen from the service and industry."
        />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- AI visibility ----------------
const AiS = RUN_SCHEMAS.ai_visibility;
type AiIn = z.input<typeof AiS>;
type AiOut = z.output<typeof AiS>;

export function AiVisibilityForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<AiIn, unknown, AiOut>({
    resolver: zodResolver(AiS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<AiIn>>({ mode: 'ai_visibility', siteId: initialSiteId ?? '', country: sd.country, topics: [], competitors: sd.competitors, emailCopy: true }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => {
    const d = siteDefaults(s);
    setPristine(form, 'country', d.country);
    setPristine(form, 'competitors', d.competitors);
  });

  return (
    <ToolShell mode="ai_visibility" site={site} cost={estimateCost('ai_visibility', v)} eta={estimateEta('ai_visibility', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Check AI visibility" blocked={blockedWithout(sites.some((s) => s.verifiedAt))}>
      <FormCard title="Website and market" description="About 8 buyer questions are written for your market and asked to every assistant below; each answer is checked for your brand, your links and your competitors.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} />
        <div className="flex flex-wrap gap-1.5">
          {AI_ENGINES.map((x) => (
            <Badge key={x.value}>{x.label}</Badge>
          ))}
        </div>
      </FormCard>
      <FormCard title="Topics and competitors">
        <TextTagsField
          label="Buyer topics"
          value={v.topics ?? []}
          onChange={(t) => form.setValue('topics', t, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
          error={errMsg(e.topics)}
          max={6}
          placeholder="e.g. e invoicing software uae"
          hint="What buyers ask AI about. Leave empty to use your tracked keywords and ladders."
        />
        <DomainTagsField
          value={v.competitors ?? []}
          onChange={(c) => form.setValue('competitors', c, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
          error={errMsg(e.competitors)}
          ownDomain={site?.domain}
          hint="Up to 3 to compare share of voice with. Brands the assistants name are detected automatically as well."
        />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- backlinks ----------------
const BS = RUN_SCHEMAS.backlinks;
type BIn = z.input<typeof BS>;
type BOut = z.output<typeof BS>;

export function BacklinksForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<BIn, unknown, BOut>({
    resolver: zodResolver(BS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<BIn>>({ mode: 'backlinks', siteId: initialSiteId ?? '', country: sd.country, competitors: sd.competitors, emailCopy: true }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => {
    const d = siteDefaults(s);
    setPristine(form, 'country', d.country);
    setPristine(form, 'competitors', d.competitors);
  });

  return (
    <ToolShell mode="backlinks" site={site} cost={estimateCost('backlinks', v)} eta={estimateEta('backlinks', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Check backlinks" blocked={blockedWithout(sites.some((s) => s.verifiedAt))}>
      <FormCard title="Website" description="Links gained and lost, links to broken pages, spam, unlinked brand mentions, the sites that link to your competitors but not to you, and outreach drafts for each.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} hint="Used to find competitors when none are given and for the outreach drafts." />
      </FormCard>
      <FormCard title="Competitors" description="The link gap compares your links with theirs.">
        <DomainTagsField
          value={v.competitors ?? []}
          onChange={(c) => form.setValue('competitors', c, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
          error={errMsg(e.competitors)}
          ownDomain={site?.domain}
          hint={site?.competitors.length ? 'Pre-filled from the website settings.' : 'Up to 3. Leave empty to use the sites ranking for your keywords.'}
        />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}
