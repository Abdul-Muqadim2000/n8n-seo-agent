import { useEffect, useState, type ReactNode } from 'react';
import { Check, Coins, Loader2, Mail } from 'lucide-react';
import { formatUsd, GOALS, PAGE_TYPES, type ModeId, type Run } from '@seo/shared';
import { cn, fmtBytes } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Meter } from '@/components/ui/misc';
import { IconTile, ScoreRing } from '@/components/insight';

/** Re-renders every `ms` (live elapsed times). */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const isActive = (s: Run['status']) => s === 'submitting' || s === 'accepted' || s === 'running';

export function minutesBetween(a: string | null, b: string | number | null): number | null {
  if (!a || b == null) return null;
  const t0 = new Date(a).getTime();
  const t1 = typeof b === 'number' ? b : new Date(b).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return Math.max(0, (t1 - t0) / 60000);
}

export function fmtMinutes(m: number | null): string {
  if (m == null) return '–';
  if (m < 1) return '< 1 min';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** What the engine does for each mode, in order (shown while a run is in progress). */
export const MODE_STEPS: Record<ModeId, string[]> = {
  verdict: ['Read the top 10 Google results', 'Pull search volume, difficulty and trend', 'Weigh competition against your business', 'Write the verdict, reasons and risks (PDF)'],
  keyword: ['Analyse the pages ranking today', 'Verdict and keyword data', 'Write the brief', 'Write the copy', 'Editor pass and SEO quality check', 'Package as Word, PDF, HTML, Markdown and meta.json'],
  discover: ['Read your website', 'Collect about 600 keywords from several sources', 'AI review for relevance', 'Score, cluster and check the best ones live on Google', 'Write the keyword strategy (PDF)'],
  describe: ['Fetch the homepage', 'Describe the business, offers and audience', 'Suggest seed keywords'],
  audit: ['Crawl the website', 'Probe speed, caching, robots and sitemaps', 'Read Search Console', 'Score every finding and compare with the last audit', 'Build the fix pack and the report'],
  ladder: ['Research the head keyword and its long tail', 'Feasibility verdict', 'Build the rungs, link map and timeline', 'Write the plan (PDF and Word)', 'Write the first pages (each arrives as its own report)'],
  track: ['Save the tracking settings', 'Read Search Console, GA4 and Google Trends', 'Check your keywords live', 'Send the first weekly report'],
  published: ['Fetch the live page', 'Check what Google will see', 'Mark it published and suggest links'],
  checkin: ['Read your answers and the Pages export', 'Record the month', 'Raise alerts for anything serious'],
  case_study: ['Store the case study as proof', 'Research the keyword', 'Write the case-study page', 'Quality check and package'],
  profile: ['Save the profile', 'Score E-E-A-T and local readiness', 'Preview the schema'],
  ai_visibility: ['Write buyer questions for your market', 'Ask ChatGPT, Perplexity, Gemini, Claude and Google AI', 'Find mentions, citations and competitors', 'Write the report and actions'],
  backlinks: ['Load your link profile', 'Find lost, new and spammy links', 'Compare with competitors (link gap)', 'Draft outreach and write the report'],
};

/** Progress for a run that is still going: elapsed vs estimate, the steps, e-mail note. */
export function RunProgress({ run, now }: { run: Run; now: number }) {
  const elapsed = minutesBetween(run.acceptedAt ?? run.createdAt, now) ?? 0;
  const eta = Math.max(1, run.etaMinutes);
  const ratio = elapsed / eta;
  const steps = MODE_STEPS[run.mode] ?? [];
  // the engine reports no step progress: spread the steps over the estimate, never mark the last one done
  const current = Math.min(steps.length - 1, Math.floor(Math.min(0.99, ratio) * steps.length));
  const late = ratio > 1.5;
  const emailCopy = (run.input as { emailCopy?: boolean }).emailCopy === true;
  const status = run.status === 'running' ? 'Working on it' : run.status === 'submitting' ? 'Sending to the SEO engine' : 'Queued in the SEO engine';
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,240px)_1fr] md:p-6">
        <div className="flex items-center gap-4 md:flex-col md:items-start">
          <ScoreRing
            value={Math.min(97, ratio * 100)}
            label="Estimated progress"
            tone="accent"
            size={104}
            display={elapsed < 1 ? '<1' : String(Math.round(elapsed))}
            suffix={`min of ~${eta}`}
            valueText={`${fmtMinutes(elapsed)} of about ${eta} min`}
          />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-[-0.01em] text-ink">
              <Loader2 className="size-4 animate-spin text-accent-text" aria-hidden />
              {status}
            </h2>
            <p className="mt-1 text-sm tabular text-ink-2">
              {fmtMinutes(elapsed)} of about {eta} min
            </p>
            <Meter value={Math.min(97, ratio * 100)} label="Estimated progress" className="mt-2.5 h-1.5" />
          </div>
        </div>
        <div className="min-w-0">
          {late && <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning-text">Taking longer than usual. Large sites and busy AI models slow some steps; the page updates by itself when results arrive.</p>}
          {steps.length > 0 && (
            <ol className="relative space-y-1">
              {steps.map((s, i) => {
                const done = i < current;
                const now = i === current;
                return (
                  <li key={s} className={cn('relative flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-300 ease-brand', now && 'bg-accent-soft/60', done ? 'text-ink-2' : now ? 'font-medium text-ink' : 'text-ink-3')}>
                    {i < steps.length - 1 && <span className={cn('absolute top-[calc(50%+14px)] left-[21px] h-[calc(100%-20px)] w-0.5 rounded-full', done ? 'bg-good' : 'bg-line')} aria-hidden />}
                    {done ? (
                      <IconTile tone="good" size="xs" className="rounded-full">
                        <Check strokeWidth={2.75} />
                      </IconTile>
                    ) : now ? (
                      <IconTile tone="solid" size="xs" className="rounded-full">
                        <Loader2 className="animate-spin" />
                      </IconTile>
                    ) : (
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-[11px] font-semibold tabular text-ink-3" aria-hidden>
                        {i + 1}
                      </span>
                    )}
                    <span className="sr-only">{done ? 'probably done: ' : now ? 'in progress: ' : 'to do: '}</span>
                    {s}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 text-[13px] text-ink-3">Step progress is estimated from the usual run time. You can leave this page: the run keeps going and the results appear here.</p>
          {emailCopy && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
              <Mail className="size-4 text-ink-3" aria-hidden /> The results also arrive by e-mail.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

const INPUT_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  country: 'Country',
  pageType: 'Page type',
  localArea: 'City or area',
  existingPageUrl: 'Existing page',
  checkPageExists: 'Check for an existing page',
  receiveReport: 'Keyword report',
  receiveContent: 'Write the page',
  tone: 'Tone',
  goal: 'Goal',
  cta: 'Call to action',
  businessFacts: 'Business facts',
  videoUrl: 'Video',
  videoTranscript: 'Video transcript',
  business: 'Business',
  customers: 'Customers',
  siteAudit: 'Technical audit',
  fullReport: 'Full SEO report',
  reportType: 'Report',
  crawlPages: 'Pages to crawl',
  crawlJs: 'JavaScript rendering',
  competitors: 'Competitors',
  pagesNow: 'Pages written now',
  publishedUrl: 'Published page',
  manualAction: 'Manual action',
  securityIssue: 'Security issue',
  notes: 'Notes',
  pagesCsv: 'Pages export',
  service: 'Service',
  clientName: 'Client',
  clientPublic: 'Client named publicly',
  industry: 'Industry',
  location: 'Location',
  challenge: 'Challenge',
  solution: 'What was done',
  timeline: 'Timeline',
  results: 'Results',
  quote: 'Quote',
  quoteBy: 'Quote by',
  topics: 'Topics',
  keywords: 'Keywords',
  ga4PropertyId: 'GA4 property',
  blogsPerWeek: 'Blog posts per week',
  emailCopy: 'E-mail copy',
};

function LongText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 160) return <>{text}</>;
  return (
    <>
      <span className={cn('whitespace-pre-wrap', !open && 'line-clamp-3')}>{text}</span>
      <button type="button" onClick={() => setOpen(!open)} className="mt-0.5 block text-xs font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
        {open ? 'Show less' : 'Show all'}
      </button>
    </>
  );
}

/** The submitted form values as label / value rows. */
export function inputRows(input: Record<string, unknown>): { label: string; value: ReactNode }[] {
  const rows: { label: string; value: ReactNode }[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (k === 'mode' || k === 'siteId' || v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const label = INPUT_LABELS[k] ?? k;
    let value: ReactNode;
    if (k === 'pagesCsv' && typeof v === 'string') value = `uploaded (${fmtBytes(v.length)})`;
    else if (k === 'videoTranscript' && typeof v === 'string') value = `provided (${v.length.toLocaleString()} characters)`;
    else if (k === 'goal') value = GOALS.find((g) => g.value === v)?.label ?? String(v);
    else if (k === 'pageType') value = PAGE_TYPES.find((p) => p.value === v)?.label ?? String(v);
    else if (k === 'reportType') value = v === 'full' ? 'Full SEO report' : 'Technical audit';
    else if (typeof v === 'boolean') value = v ? 'Yes' : 'No';
    else if (Array.isArray(v)) value = v.map(String).join(', ');
    else if (typeof v === 'object') value = JSON.stringify(v);
    else value = <LongText text={String(v)} />;
    rows.push({ label, value });
  }
  return rows;
}

/** Form values for "Try again" / "Run again": the same input, minus what cannot travel in a link. */
export function retryPrefill(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'mode' || k === 'siteId' || k === 'pagesCsv') continue;
    if (typeof v === 'string' && v.length > 4000) continue;
    out[k] = v;
  }
  return out;
}

export function CostLine({ run }: { run: Run }) {
  return (
    <span className="inline-flex flex-col items-end gap-1 tabular">
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2" title="Estimated cost">
        <Coins className="size-3 text-ink-3" aria-hidden />
        {formatUsd(run.estimatedCostUsd)}
      </span>
      {run.actualCostUsd != null && <span className="block text-xs text-ink-3">data {formatUsd(run.actualCostUsd, 3)}</span>}
    </span>
  );
}

/** A small chip with an icon (durations, counts) for run rows. */
export function RunChip({ icon, children, title, tone = 'neutral' }: { icon?: ReactNode; children: ReactNode; title?: string; tone?: 'neutral' | 'accent' }) {
  return (
    <span title={title} className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap tabular [&_svg]:size-3 [&_svg]:shrink-0', tone === 'accent' ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-ink-2')}>
      {icon}
      {children}
    </span>
  );
}

