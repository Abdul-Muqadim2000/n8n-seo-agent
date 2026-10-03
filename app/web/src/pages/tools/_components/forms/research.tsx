import { useState } from 'react';
import { Callout } from '@/components/ui/feedback';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ChevronDown, ChevronRight, Video } from 'lucide-react';
import { PAGE_TYPES, RUN_SCHEMAS, urlOnDomain } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { Checkbox, ChoiceCard } from '@/components/ui/field';
import { estimateCost, estimateEta } from '../estimate';
import { CountryField, EmailCopyField, errMsg, FormCard, GoalField, PageTypeField, setPristine, siteDefaults, SiteField, ToneField, ToolShell, useRunSubmit, useSiteChange, useSyncSiteParam } from '../kit';
import { TextAreaField, TextField, withChecks, withPrefill, type ToolFormProps } from '../form-utils';

const isVideoUrl = (u: string) => /youtube\.com|youtu\.be|vimeo\.com/i.test(u);

// ---------------- verdict ----------------
const VS = RUN_SCHEMAS.verdict;
type VIn = z.input<typeof VS>;
type VOut = z.output<typeof VS>;

export function VerdictForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<VIn, unknown, VOut>({
    resolver: zodResolver(VS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<VIn>>({ mode: 'verdict', siteId: initialSiteId, keyword: '', country: sd.country, business: '', emailCopy: true }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => setPristine(form, 'country', siteDefaults(s).country));

  return (
    <ToolShell mode="verdict" site={site} cost={estimateCost('verdict', v)} eta={estimateEta('verdict', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Get the verdict">
      <FormCard title="Keyword" description="We read the top 10 Google results, pull volume, difficulty and trend, and judge whether a page can win.">
        <SiteField optional value={v.siteId} onChange={(id) => form.setValue('siteId', id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.siteId)} />
        <TextField label="Keyword" reg={form.register('keyword')} error={errMsg(e.keyword)} placeholder="e.g. erp implementation services" hint="One search phrase, the way a buyer would type it into Google." />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} />
      </FormCard>
      <FormCard title="Your business" description="Lets the verdict judge relevance, not just competition.">
        <TextAreaField
          label="What you sell and to whom"
          reg={form.register('business')}
          error={errMsg(e.business)}
          optional
          rows={3}
          max={500}
          value={v.business}
          placeholder="e.g. Microsoft Dynamics 365 partner implementing ERP for mid-sized distributors in the UAE"
          hint={site?.business ? `Leave empty to use ${site.domain}'s description.` : 'A sentence or two is enough.'}
        />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- keyword (write a page) ----------------
const KS = RUN_SCHEMAS.keyword;
type KIn = z.input<typeof KS>;
type KOut = z.output<typeof KS>;

export function KeywordForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const defaults = withPrefill<DefaultValues<KIn>>(
    {
      mode: 'keyword',
      siteId: initialSiteId,
      keyword: '',
      country: sd.country,
      pageType: 'Service Page',
      existingPageUrl: '',
      localArea: '',
      videoUrl: '',
      videoTranscript: '',
      businessFacts: '',
      cta: '',
      tone: sd.tone ?? 'Professional and direct',
      goal: sd.goal ?? 'leads',
      checkPageExists: false,
      ladder: undefined,
      receiveReport: true,
      receiveContent: true,
      emailCopy: true,
    },
    prefill,
  );
  const form = useForm<KIn, unknown, KOut>({
    resolver: withChecks(zodResolver(KS), (x) => {
      const s = sites.find((y) => y.id === x.siteId);
      const out: Record<string, string> = {};
      if (s && x.existingPageUrl && !urlOnDomain(x.existingPageUrl, s.domain)) out.existingPageUrl = `Must be a page on ${s.domain}`;
      if (x.videoUrl && !isVideoUrl(x.videoUrl)) out.videoUrl = 'Use a YouTube or Vimeo link';
      return out;
    }),
    mode: 'onTouched',
    defaultValues: defaults,
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  const [videoOpen, setVideoOpen] = useState(!!defaults.videoUrl);
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => {
    const d = siteDefaults(s);
    setPristine(form, 'country', d.country);
    setPristine(form, 'tone', d.tone);
    setPristine(form, 'goal', d.goal);
    if (!s) {
      form.setValue('existingPageUrl', '');
      form.setValue('checkPageExists', false);
    }
  });
  const extras = [v.receiveReport && 'Keyword report: competitors, verdict, keyword data', v.receiveContent && 'The finished page, QA-checked'].filter((x): x is string => !!x);

  return (
    <ToolShell
      mode="keyword"
      site={site}
      cost={estimateCost('keyword', v)}
      eta={estimateEta('keyword', v)}
      emailCopy={!!v.emailCopy}
      extras={extras}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel={v.receiveContent ? 'Write the page' : 'Get the keyword report'}
      values={{ keyword: v.keyword, existingPageUrl: v.existingPageUrl, receiveContent: v.receiveContent, ladder: v.ladder }}
      onUsePlan={(plan) => {
        form.setValue('existingPageUrl', plan.existingPageUrl, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
        const type = PAGE_TYPES.find((t) => t.value === plan.pageType)?.value;
        if (type) form.setValue('pageType', type, { shouldDirty: true });
      }}
    >
      <FormCard title="Keyword" description="Competitor research, a verdict, a brief, the copy, an editor pass and SEO QA, for one keyword.">
        <SiteField optional value={v.siteId} onChange={(id) => form.setValue('siteId', id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.siteId)} />
        <TextField label="Keyword" reg={form.register('keyword')} error={errMsg(e.keyword)} placeholder="e.g. erp implementation services dubai" hint="The main search phrase the page should rank for. Related phrases are found and covered automatically." />
        {v.ladder && (
          <Callout tone="info" title={`Part of the keyword ladder “${v.ladder.head || 'your ladder'}”`}>
            {v.ladder.rung === 4 ? 'The top page of the ladder' : `Rung ${v.ladder.rung}`}: the page links to the ladder’s top page and a sibling, and the ladder marks it as written so the weekly cadence moves on.
          </Callout>
        )}
        <CountryField reg={form.register('country')} error={errMsg(e.country)} />
      </FormCard>

      <FormCard title="Page" description="The page type sets the structure, the schema and the call to action.">
        <PageTypeField value={v.pageType ?? 'Service Page'} onChange={(p) => form.setValue('pageType', p as KIn['pageType'], { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.pageType)} />
        {v.pageType === 'Local Page' && (
          <TextField
            label="City or area"
            reg={form.register('localArea')}
            error={errMsg(e.localArea)}
            placeholder="e.g. Dubai Marina"
            hint="Where the service is offered. The page carries your verified address from the business profile. Optional when the keyword already names the place (“… in Dubai”)."
          />
        )}
        <TextField
          label="Improve an existing page"
          optional
          reg={form.register('existingPageUrl')}
          error={errMsg(e.existingPageUrl)}
          inputMode="url"
          placeholder={site ? `https://${site.domain}/services/…` : 'Choose your website first'}
          hint={site ? `Rewrites and strengthens this page instead of writing a new one. Must be on ${site.domain}.` : 'Available when a website is chosen.'}
        />
        {site && !v.existingPageUrl && (
          <Checkbox {...form.register('checkPageExists')} label="Check whether I already have a page for this keyword" description={`Searches ${site.domain} first; if a matching page exists, the run improves it instead of creating a duplicate.`} />
        )}
      </FormCard>

      <FormCard title="What you get">
        <div className="space-y-3">
          <Checkbox {...form.register('receiveReport')} label="Keyword report" description="Competitor analysis, the verdict with reasons and risks, keyword data and secondary keywords (PDF and Word)." />
          <Checkbox
            {...form.register('receiveContent')}
            label="The finished page"
            description="Copy written from the brief, edited and checked (title, meta, headings, links, schema, images plan): Word, PDF, HTML, Markdown and meta.json."
          />
          {errMsg(e.receiveContent) && <p className="text-[13px] text-critical-text">{errMsg(e.receiveContent)}</p>}
          {!v.receiveContent && <p className="text-[13px] text-ink-3">Report only: about $0.40 instead of $1.20.</p>}
        </div>
      </FormCard>

      {v.receiveContent && (
        <FormCard title="Voice and facts" description="The writer only states facts it can verify; anything else becomes a [placeholder] for you to fill in.">
          <div className="grid gap-5 sm:grid-cols-2">
            <ToneField reg={form.register('tone')} error={errMsg(e.tone)} />
            <GoalField reg={form.register('goal')} error={errMsg(e.goal)} />
          </div>
          <TextField
            label="Call to action"
            optional
            reg={form.register('cta')}
            error={errMsg(e.cta)}
            placeholder="e.g. Book a free readiness assessment"
            hint={site?.cta ? `Leave empty to use “${site.cta}” from the website settings.` : 'What the reader should do at the end of the page.'}
          />
          <TextAreaField
            label="Business facts"
            optional
            reg={form.register('businessFacts')}
            error={errMsg(e.businessFacts)}
            rows={4}
            max={2000}
            value={v.businessFacts}
            placeholder="e.g. Founded 2014 · Microsoft Solutions Partner · 120+ ERP projects · offices in Dubai and Riyadh · fixed-price implementation from AED 45,000"
            hint={site?.businessFacts ? "Leave empty to use the website's facts." : 'Years in business, certifications, client numbers, prices. Verified facts make the page credible.'}
          />
        </FormCard>
      )}

      {v.receiveContent && (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          <button type="button" onClick={() => setVideoOpen(!videoOpen)} aria-expanded={videoOpen} className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6">
            <Video className="size-4 text-ink-3" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">Add a video</span>
              <span className="block text-[13px] text-ink-3">Embed a YouTube or Vimeo video with its transcript and key moments (VideoObject schema).</span>
            </span>
            {videoOpen ? <ChevronDown className="size-4 text-ink-3" /> : <ChevronRight className="size-4 text-ink-3" />}
          </button>
          {videoOpen && (
            <div className="space-y-5 border-t border-line px-5 py-5 sm:px-6">
              <TextField label="Video link" optional reg={form.register('videoUrl')} error={errMsg(e.videoUrl)} inputMode="url" placeholder="https://www.youtube.com/watch?v=…" hint="Title, duration and thumbnail are read from YouTube or Vimeo." />
              {!!v.videoUrl && (
                <TextAreaField
                  label="Transcript"
                  optional
                  reg={form.register('videoTranscript')}
                  error={errMsg(e.videoTranscript)}
                  rows={6}
                  max={60000}
                  value={v.videoTranscript}
                  placeholder="Paste the transcript (with timestamps if you have them)"
                  hint="Adds a readable transcript and key moments. Timestamps like 01:25 become chapter links."
                />
              )}
            </div>
          )}
        </div>
      )}

      <FormCard title="Delivery">
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- discover ----------------
const DS = RUN_SCHEMAS.discover;
type DIn = z.input<typeof DS>;
type DOut = z.output<typeof DS>;

export function DiscoverForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<DIn, unknown, DOut>({
    resolver: zodResolver(DS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<DIn>>(
      {
        mode: 'discover',
        siteId: initialSiteId,
        business: '',
        customers: '',
        country: sd.country,
        goal: sd.goal ?? 'leads',
        businessFacts: '',
        siteAudit: false,
        fullReport: false,
        receiveReport: false,
        receiveContent: false,
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
    setPristine(form, 'goal', d.goal);
    if (!s) {
      form.setValue('siteAudit', false);
      form.setValue('fullReport', false);
    }
  });
  const audit = v.fullReport ? 'full' : v.siteAudit ? 'technical' : 'none';
  const setAudit = (a: 'none' | 'technical' | 'full') => {
    form.setValue('siteAudit', a === 'technical', { shouldDirty: true });
    form.setValue('fullReport', a === 'full', { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };
  const extras = [
    v.receiveReport && 'Keyword report for the best keyword',
    v.receiveContent && 'The page for the best keyword',
    audit === 'technical' && 'Technical site audit',
    audit === 'full' && 'Full SEO report',
  ].filter((x): x is string => !!x);

  return (
    <ToolShell mode="discover" site={site} cost={estimateCost('discover', v)} eta={estimateEta('discover', v)} emailCopy={!!v.emailCopy} extras={extras} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Find keywords">
      <FormCard title="Your business" description="About 600 keywords from several sources are scored, reviewed by AI for relevance, grouped into topics and checked live on Google.">
        <SiteField optional value={v.siteId} onChange={(id) => form.setValue('siteId', id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.siteId)} />
        <TextAreaField
          label="What you sell"
          optional={!!site}
          reg={form.register('business')}
          error={errMsg(e.business)}
          rows={3}
          max={500}
          value={v.business}
          placeholder="e.g. ERP implementation and e-invoicing compliance for UAE businesses"
          hint={site ? `Leave empty to use ${site.domain}'s description (read from its homepage).` : 'Required without a website: the research starts from this description.'}
        />
        <TextField
          label="Who buys it"
          optional
          reg={form.register('customers')}
          error={errMsg(e.customers)}
          placeholder="e.g. CFOs of mid-sized distributors"
          hint={site?.customers ? `Leave empty to use “${site.customers}”.` : 'Helps the AI review drop keywords your buyers would never search.'}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <CountryField reg={form.register('country')} error={errMsg(e.country)} />
          <GoalField reg={form.register('goal')} error={errMsg(e.goal)} hint="Leads and sales favour buyer keywords; traffic favours questions and guides." />
        </div>
        <TextAreaField label="Business facts" optional reg={form.register('businessFacts')} error={errMsg(e.businessFacts)} rows={3} max={2000} value={v.businessFacts} hint="Services, locations, specialisms: anything that sharpens relevance." />
      </FormCard>

      <FormCard title="Follow-ups" description="Optional extra reports, each delivered separately when ready.">
        <Checkbox {...form.register('receiveReport')} label="Keyword report for the best keyword" description="Competitors, verdict and keyword data for the keyword the strategy says to start with." />
        <Checkbox {...form.register('receiveContent')} label="Write the page for the best keyword (+$1.20)" description="The full page run for that keyword: brief, copy, edit and QA." />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink">Audit the website too</p>
          <div role="radiogroup" aria-label="Audit the website too" className="grid gap-2 sm:grid-cols-3">
            <ChoiceCard selected={audit === 'none'} onSelect={() => setAudit('none')} title="No audit" />
            <ChoiceCard selected={audit === 'technical'} onSelect={() => setAudit('technical')} title="Technical (+$0.10)" description="Crawl, indexing and fix pack" disabled={!site} />
            <ChoiceCard selected={audit === 'full'} onSelect={() => setAudit('full')} title="Full report (+$0.90)" description="Adds competitors, backlinks, AI" disabled={!site} />
          </div>
          {errMsg(e.siteAudit) ? <p className="mt-1.5 text-[13px] text-critical-text">{errMsg(e.siteAudit)}</p> : !site && <p className="mt-1.5 text-[13px] text-ink-3">Choose your website to add an audit.</p>}
        </div>
      </FormCard>

      <FormCard title="Delivery">
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

