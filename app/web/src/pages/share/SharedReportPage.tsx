import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { CalendarClock, Download, ExternalLink, FileText, Lock } from 'lucide-react';
import type { SharedReport } from '@seo/shared';
import { api, ApiRequestError, sharedFileUrl } from '@/lib/api';
import { fmtBytes, fmtDate, fmtDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { BRAND_NAME, BrandMark } from '@/components/layout/Brand';
import { ShareBrand } from '@/components/share/ShareBrand';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { StageIcon, stageLabel } from '@/components/reports/meta';

/**
 * G15: a report shared through an expiring link, for somebody with no account (/share/:token).
 * Read-only by construction: this page can only ask for that one report and its files, there is nothing to sign in to, no navigation
 * into the app, and no action that changes anything. A wrong, revoked or expired token shows the server's one-line reason.
 *
 * B-R2 (white-label-lite): the page belongs to the company whose report it is — their name and logo at the head of it and in the
 * browser tab, our own mark reduced to one line in the footer. The two things that are ours and stay ours are the ones a reader
 * needs: that the link expires and can be turned off, and the run's own caveat when the report is not finished work.
 */

// A headline key is written the way the app writes it everywhere else ("healthScore" -> "Health score"), never as the stored key —
// a client should not have to read our field names. The few keys that no rule can make readable are named outright.
const NAMED: Record<string, string> = { qa: 'Quality check', eeatScore: 'E-E-A-T score', aiOverviews: 'AI Overviews', aiSessions: 'AI sessions', url: 'URL' };
const label = (k: string) =>
  NAMED[k] ??
  k
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
const value = (v: string | number | boolean | null) => (v === true ? 'yes' : v === false ? 'no' : v === null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-GB') : String(v));

export default function SharedReportPage() {
  const { token = '' } = useParams();
  const q = useQuery({
    queryKey: ['share', token],
    queryFn: () => api<{ report: SharedReport }>(`/api/share/${encodeURIComponent(token)}`),
    retry: false,
  });
  const report = q.data?.report;
  const brandName = report?.brand?.name || report?.orgName || '';
  useDocumentTitle(report ? [report.title || 'Report', brandName].filter(Boolean).join(' · ') : 'Shared report');

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line bg-surface-1">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
          {report?.brand ? <ShareBrand brand={report.brand} /> : <span className="font-display text-[15px] font-semibold text-ink">Shared report</span>}
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
            <Lock className="size-3.5" aria-hidden /> Shared, read-only
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {q.isLoading && <PageLoader />}

        {/* the refusal carries the page's h1: a reader who lands on a dead link still lands on a page with a heading */}
        {q.isError && (
          <div className="space-y-3">
            <h1 className="font-display text-2xl font-semibold text-ink">This link does not work</h1>
            <Callout tone="warning">{q.error instanceof ApiRequestError ? q.error.message : 'This link is not valid.'}</Callout>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-text">
                <StageIcon stage={report.stage} className="size-4" /> {stageLabel(report.stage, report)}
              </span>
              <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{report.title || stageLabel(report.stage, report)}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
                {report.siteDomain && (
                  <>
                    <span>{report.siteDomain}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span>received {fmtDateTime(report.receivedAt)}</span>
                {report.scheduled && (
                  <Badge icon={<CalendarClock className="size-3" aria-hidden />} tone="accent">
                    scheduled
                  </Badge>
                )}
              </p>
            </div>

            {report.caveat && (
              <Callout tone="warning" title={report.caveat.title}>
                {report.caveat.detail}
              </Callout>
            )}

            <Callout tone="info" title="A shared copy of one report">
              This link stops working on {fmtDate(report.expiresAt)}, and the person who shared it can turn it off at any time. It shows this report only — nothing
              else of {brandName || 'the company'}'s data — and nothing here can be changed.
            </Callout>

            {Object.keys(report.summary ?? {}).length > 0 && (
              <section aria-labelledby="share-summary">
                <h2 id="share-summary" className="mb-2 text-[13px] font-medium text-ink-3">
                  Headline figures
                </h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-line bg-surface-1 p-4 sm:grid-cols-2">
                  {Object.entries(report.summary).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
                      <dt className="text-[13px] text-ink-2">{label(k)}</dt>
                      <dd className="text-[13px] font-semibold tabular text-ink">{value(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section aria-labelledby="share-files">
              <h2 id="share-files" className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
                <FileText className="size-4" aria-hidden /> Documents
              </h2>
              {report.files.length === 0 ? (
                <p className="text-[13px] text-ink-3">This report has no documents attached.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {report.files.map((f) => {
                    const inline = f.kind === 'pdf';
                    return (
                      <li key={f.id}>
                        <a
                          href={sharedFileUrl(token, f.id, !inline)}
                          target={inline ? '_blank' : undefined}
                          rel={inline ? 'noreferrer' : undefined}
                          download={inline ? undefined : f.fileName}
                          className="group/file flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-3 transition-colors duration-150 ease-brand hover:border-accent/40 hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className="truncate text-sm font-semibold text-ink">{f.kind.toUpperCase()}</span>
                              <span className="shrink-0 text-[11px] tabular text-ink-3">{fmtBytes(f.size)}</span>
                            </span>
                            <span className="block truncate text-xs text-ink-3">{f.fileName}</span>
                          </span>
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden>
                            {inline ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {/* B-R2: our own mark, one line, under the customer's report — never above it */}
      <footer className="mt-auto border-t border-line">
        <p className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 py-5 text-[12px] text-ink-3">
          <BrandMark className="size-4" /> Report prepared with{' '}
          <a href="/" className="rounded-sm font-medium text-ink-2 underline-offset-2 hover:underline">
            {BRAND_NAME}
          </a>
        </p>
      </footer>
    </div>
  );
}
