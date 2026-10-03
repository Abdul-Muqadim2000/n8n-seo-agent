import { useRef, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { CRAWL_PAGE_OPTIONS, RUN_SCHEMAS, urlOnDomain, type Site } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { fmtBytes } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ChoiceCard } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/tabs';
import { estimateCost, estimateEta } from '../estimate';
import { CountryField, DomainTagsField, EmailCopyField, errMsg, FormCard, setPristine, siteDefaults, SiteField, ToolShell, useRunSubmit, useSiteChange, useSyncSiteParam } from '../kit';
import { TextAreaField, TextField, withChecks, withPrefill, type ToolFormProps } from '../form-utils';

const noVerified = (sites: Site[]) => (sites.some((s) => s.verifiedAt) ? undefined : 'Verify a website first: this check runs against your own site.');

// ---------------- describe ----------------
const DeS = RUN_SCHEMAS.describe;
type DeIn = z.input<typeof DeS>;
type DeOut = z.output<typeof DeS>;

export function DescribeForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const form = useForm<DeIn, unknown, DeOut>({
    resolver: zodResolver(DeS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<DeIn>>({ mode: 'describe', siteId: initialSiteId ?? '', emailCopy: false }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  useSyncSiteParam(v.siteId);
  return (
    <ToolShell mode="describe" site={site} cost={estimateCost('describe', v)} eta={estimateEta('describe', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Describe my website" blocked={noVerified(sites)}>
      <FormCard title="Website" description="We read the homepage and return what the business does, for whom, its offers and proof, plus seed keywords. Keyword runs reuse it for 30 days.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(form.formState.errors.siteId)} />
        <ul className="grid gap-2 text-[13px] text-ink-2 sm:grid-cols-2">
          {['One-line summary and description', 'Products and services', 'Target audience', 'What sets you apart', 'Suggested title and meta description', '8-10 seed keywords'].map((x) => (
            <li key={x} className="rounded-lg bg-surface-2 px-3 py-2">
              {x}
            </li>
          ))}
        </ul>
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- audit ----------------
const AS = RUN_SCHEMAS.audit;
type AIn = z.input<typeof AS>;
type AOut = z.output<typeof AS>;

export function AuditForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const form = useForm<AIn, unknown, AOut>({
    resolver: zodResolver(AS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<AIn>>({ mode: 'audit', siteId: initialSiteId ?? '', country: sd.country, reportType: 'site_audit', crawlPages: 200, crawlJs: false, competitors: sd.competitors, emailCopy: true }, prefill),
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
  const pages = v.crawlPages ?? 200;
  const setJs = (on: boolean) => {
    form.setValue('crawlJs', on, { shouldDirty: true });
    if (on && pages > 500) form.setValue('crawlPages', 500, { shouldDirty: true });
    if (form.formState.isSubmitted) void form.trigger('crawlPages');
  };
  const full = v.reportType === 'full';

  return (
    <ToolShell
      mode="audit"
      site={site}
      cost={estimateCost('audit', v)}
      eta={estimateEta('audit', v)}
      emailCopy={!!v.emailCopy}
      extras={full ? ['Competitors, keywords, backlinks and AI visibility'] : []}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel={full ? 'Start the full report' : 'Start the audit'}
      blocked={noVerified(sites)}
    >
      <FormCard title="Website">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} hint="The market for rankings, competitors and the Google Business Profile check." />
      </FormCard>

      <FormCard title="Report">
        <div role="radiogroup" aria-label="Report type" className="grid gap-2 md:grid-cols-2">
          <ChoiceCard
            selected={!full}
            onSelect={() => form.setValue('reportType', 'site_audit', { shouldDirty: true })}
            title="Technical audit"
            badge={<Badge>about $0.10 · 20 min</Badge>}
            description="Crawl, speed and caching, indexing and Search Console, structure, schema, brand and entity check, internal links, and a fix pack (robots.txt, llms.txt, redirects, schema)."
          />
          <ChoiceCard
            selected={full}
            onSelect={() => form.setValue('reportType', 'full', { shouldDirty: true })}
            title="Full SEO report"
            badge={<Badge>about $0.90 · 30 min</Badge>}
            description="Everything in the technical audit plus competitor and keyword analysis, backlinks and link gap, AI visibility and domain ages."
          />
        </div>
      </FormCard>

      <FormCard title="Crawl" description="How many pages to read. Larger crawls find more but take longer.">
        <div role="radiogroup" aria-label="Pages to crawl" className="grid gap-2 sm:grid-cols-3">
          {CRAWL_PAGE_OPTIONS.map((n) => (
            <ChoiceCard
              key={n}
              selected={pages === n}
              onSelect={() => form.setValue('crawlPages', n, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
              title={`${n.toLocaleString()} pages`}
              description={n === 200 ? 'Most small and mid-sized sites' : n === 500 ? 'Larger sites and blogs' : 'Big sites (no JavaScript rendering)'}
              disabled={n > 500 && !!v.crawlJs}
            />
          ))}
        </div>
        {errMsg(e.crawlPages) && <p className="text-[13px] text-critical-text">{errMsg(e.crawlPages)}</p>}
        <div className="border-t border-line">
          <SwitchRow
            title="Render JavaScript"
            description="For sites built with React, Vue or Angular whose content only appears after scripts run. Slower, and limited to 500 pages."
            checked={!!v.crawlJs}
            onCheckedChange={setJs}
          />
        </div>
      </FormCard>

      {full && (
        <FormCard title="Competitors" description="Compared with your site for keywords, backlinks and AI visibility.">
          <DomainTagsField
            value={v.competitors ?? []}
            onChange={(c) => form.setValue('competitors', c, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
            error={errMsg(e.competitors)}
            ownDomain={site?.domain}
            hint={site?.competitors.length ? 'Pre-filled from the website settings; changes here apply to this report only.' : 'Up to 3. Leave empty and the report finds the sites ranking for your keywords.'}
          />
        </FormCard>
      )}

      <FormCard title="Delivery">
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- published ----------------
const PS = RUN_SCHEMAS.published;
type PIn = z.input<typeof PS>;
type POut = z.output<typeof PS>;

export function PublishedForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const form = useForm<PIn, unknown, POut>({
    resolver: withChecks(zodResolver(PS), (x): Record<string, string> => {
      const s = sites.find((y) => y.id === x.siteId);
      return s && x.publishedUrl && /^https?:\/\//i.test(x.publishedUrl) && !urlOnDomain(x.publishedUrl, s.domain) ? { publishedUrl: `Must be a page on ${s.domain}` } : {};
    }),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<PIn>>({ mode: 'published', siteId: initialSiteId ?? '', keyword: '', publishedUrl: '', emailCopy: false }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  return (
    <ToolShell mode="published" site={site} cost={0} eta={estimateEta('published', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Check the page" blocked={noVerified(sites)}>
      <FormCard title="The page you published" description="We fetch it live, check what Google will see, mark it published (ladder and content log) and start tracking its position.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        <TextField label="Page address" reg={form.register('publishedUrl')} error={errMsg(e.publishedUrl)} inputMode="url" placeholder={site ? `https://${site.domain}/…` : 'https://…'} hint={site ? `The live URL on ${site.domain}.` : 'The live URL.'} />
        <TextField label="Target keyword" reg={form.register('keyword')} error={errMsg(e.keyword)} placeholder="e.g. uae e invoicing penalties" hint="The keyword the page was written for (the one in its report)." />
        <ul className="grid gap-2 text-[13px] text-ink-2 sm:grid-cols-2">
          {['Live (HTTP 200) and indexable', 'Title and meta description', 'One H1, canonical', 'Structured data, author and date', 'Images and alt text', 'Internal links to and from it'].map((x) => (
            <li key={x} className="rounded-lg bg-surface-2 px-3 py-2">
              {x}
            </li>
          ))}
        </ul>
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}

// ---------------- Search Console check-in ----------------
const CS = RUN_SCHEMAS.checkin;
type CIn = z.input<typeof CS>;
type COut = z.output<typeof CS>;
const MAX_CSV = 400_000;

/** What the engine will read from the export (same header rules as Parse Checkin). */
function detectCsv(text: string): { kind: string; rows: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = (lines[0] ?? '').toLowerCase();
  const rows = Math.max(0, lines.length - 1);
  if (/(^|,)"?reason/.test(header)) return { kind: 'Reasons table (why pages are not indexed)', rows };
  if (/(^|,)"?url/.test(header)) return { kind: 'URL list for one reason', rows };
  if (/(^|,)"?date/.test(header)) return { kind: 'Chart (indexed vs not indexed per day)', rows };
  return { kind: 'Not recognised: export the Pages report as CSV', rows };
}

export function CheckinForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const form = useForm<CIn, unknown, COut>({
    resolver: zodResolver(CS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<CIn>>({ mode: 'checkin', siteId: initialSiteId ?? '', manualAction: false, securityIssue: false, notes: '', pagesCsv: '', emailCopy: false }, prefill),
  });
  const { onSubmit, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const e = form.formState.errors;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  useSyncSiteParam(v.siteId);

  const onFile = async (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') return setFileError('Upload the CSV file (unzip the export first).');
    if (f.size > MAX_CSV) return setFileError(`The file is ${fmtBytes(f.size)}; the limit is 400 KB. Upload Table.csv rather than a long URL list.`);
    const text = await f.text();
    form.setValue('pagesCsv', text, { shouldDirty: true, shouldValidate: true });
    setFile({ name: f.name, size: f.size });
  };
  const clearFile = () => {
    form.setValue('pagesCsv', '', { shouldDirty: true });
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const detected = v.pagesCsv ? detectCsv(v.pagesCsv) : null;

  const yesNo = (name: 'manualAction' | 'securityIssue', label: string, help: string) => (
    <div>
      <p className="mb-1 text-[13px] font-medium text-ink">{label}</p>
      <p className="mb-2 text-[13px] text-ink-3">{help}</p>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        <ChoiceCard selected={!v[name]} onSelect={() => form.setValue(name, false, { shouldDirty: true })} title="No, nothing listed" />
        <ChoiceCard selected={!!v[name]} onSelect={() => form.setValue(name, true, { shouldDirty: true })} title="Yes, there is one" description="Raised as a critical alert" />
      </div>
    </div>
  );

  return (
    <ToolShell mode="checkin" site={site} cost={0} eta={estimateEta('checkin', v)} emailCopy={!!v.emailCopy} onSubmit={onSubmit} pending={pending} error={error} submitLabel="Record the check-in" blocked={noVerified(sites)}>
      <FormCard title="This month in Search Console" description="Two things the Search Console API cannot see. Takes two minutes once a month; the Monday report reminds you.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: true })} error={errMsg(e.siteId)} />
        {yesNo('manualAction', 'Manual actions', 'Search Console → Security & Manual Actions → Manual actions.')}
        {yesNo('securityIssue', 'Security issues', 'Search Console → Security & Manual Actions → Security issues.')}
        {(v.manualAction || v.securityIssue) && (
          <Callout tone="warning">Describe what Search Console shows in the notes below. Fixing a manual action and requesting a review comes before any other SEO work.</Callout>
        )}
      </FormCard>

      <FormCard title="Pages report" description="Optional, and the most useful part: why Google does not index some pages.">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
          <li>Search Console → Indexing → Pages → Export (top right) → Download CSV.</li>
          <li>Unzip the download and upload Table.csv. Chart.csv, or the URL list of one reason, also work.</li>
        </ol>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" id="pages-csv" onChange={(ev) => void onFile(ev.target.files?.[0])} />
        {file || v.pagesCsv ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileSpreadsheet className="size-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{file?.name ?? 'Pages export'}</p>
                <p className="text-xs text-ink-3">
                  {file ? `${fmtBytes(file.size)} · ` : ''}
                  {detected ? `${detected.kind} · ${detected.rows} rows` : ''}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile} icon={<X className="size-4" />}>
              Remove
            </Button>
          </div>
        ) : (
          <label htmlFor="pages-csv" className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center hover:border-accent hover:bg-surface-2">
            <Upload className="size-5 text-ink-3" aria-hidden />
            <span className="text-sm font-medium text-ink">Choose the CSV file</span>
            <span className="text-xs text-ink-3">Up to 400 KB · read in your browser</span>
          </label>
        )}
        {(fileError || errMsg(e.pagesCsv)) && <p className="text-[13px] text-critical-text">{fileError ?? errMsg(e.pagesCsv)}</p>}
        <TextAreaField label="Notes" optional reg={form.register('notes')} error={errMsg(e.notes)} rows={3} max={1000} value={v.notes} placeholder="Anything else worth recording this month" />
        <EmailCopyField reg={form.register('emailCopy')} />
      </FormCard>
    </ToolShell>
  );
}
