// Delivered reports and their files (PDF, Word, HTML, Markdown, meta.json, fix pack, CSV, disavow list).
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarClock, ChevronDown, Download, ExternalLink as ExternalIcon, Files, FileText } from 'lucide-react';
import { STAGE_LABELS, compactNumber, type Report, type ReportFile } from '@seo/shared';
import { fileUrl } from '@/lib/api';
import { paths } from '@/lib/paths';
import { cn, fmtAgo, fmtBytes, fmtDate } from '@/lib/utils';
import { Badge, StatusBadge, verdictTone } from '@/components/ui/badge';
import { Popover, Tooltip } from '@/components/ui/overlay';
import { scoreTone } from '@/components/ui/misc';
import { pct } from './format';

const PRIMARY_KINDS: ReportFile['kind'][] = ['pdf', 'docx', 'doc', 'html', 'md', 'zip'];
const FIX_NAMES = /^(robots\.txt|llms\.txt|readme\.txt|internal-links\.csv|redirects?\b.*|.*\.jsonld|_redirects|\.htaccess)$/i;

/** Short labels for documents; data files (txt / csv / json) are labelled by their file name. */
export function fileLabel(f: ReportFile): string {
  switch (f.kind) {
    case 'pdf':
      return 'PDF';
    case 'docx':
    case 'doc':
      return 'Word';
    case 'html':
      return 'HTML';
    case 'md':
      return 'Markdown';
    case 'zip':
      return /fix/i.test(`${f.fileName} ${f.field}`) ? 'Fix pack (.zip)' : f.fileName || 'ZIP';
    default:
      return f.fileName || f.kind.toUpperCase();
  }
}

/** Files that belong to an audit's fix pack (the zip and the loose files in it). */
export function isFixPackFile(f: ReportFile): boolean {
  return /fix/i.test(f.field) || (f.kind === 'zip' && /fix/i.test(f.fileName)) || FIX_NAMES.test(f.fileName);
}

const FILE_ORDER: ReportFile['kind'][] = ['pdf', 'docx', 'doc', 'html', 'md', 'zip', 'json', 'csv', 'txt', 'other'];
const isInline = (f: ReportFile) => f.kind === 'pdf' || f.kind === 'html';

export function FileChip({ orgId, f, size = 'sm' }: { orgId: string; f: ReportFile; size?: 'sm' | 'md' }) {
  const inline = isInline(f);
  return (
    <Tooltip content={`${f.fileName} · ${fmtBytes(f.size)}`}>
      <a
        href={fileUrl(orgId, f.id, !inline)}
        target={inline ? '_blank' : undefined}
        rel={inline ? 'noopener noreferrer' : undefined}
        download={inline ? undefined : f.fileName}
        className={cn(
          'inline-flex max-w-[14rem] items-center gap-1 rounded-md border border-line-strong bg-surface font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
          size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]',
        )}
        aria-label={`${inline ? 'Open' : 'Download'} ${f.fileName}`}
      >
        {inline ? <ExternalIcon className="size-3.5 shrink-0" aria-hidden /> : <Download className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{fileLabel(f)}</span>
      </a>
    </Tooltip>
  );
}

/** Documents as short chips; up to two data files by name; more data files grouped behind one chip with the full list. */
export function FileLinks({ orgId, files, className, size = 'sm' }: { orgId: string; files: readonly ReportFile[]; className?: string; size?: 'sm' | 'md' }) {
  if (!files.length) return null;
  const sorted = [...files].sort((a, b) => FILE_ORDER.indexOf(a.kind) - FILE_ORDER.indexOf(b.kind) || a.fileName.localeCompare(b.fileName));
  const docs = sorted.filter((f) => PRIMARY_KINDS.includes(f.kind));
  const data = sorted.filter((f) => !PRIMARY_KINDS.includes(f.kind));
  const grouped = data.length > 2;
  const fixPack = grouped && data.filter(isFixPackFile).length >= data.length / 2;
  return (
    <span className={cn('inline-flex flex-wrap gap-1.5', className)}>
      {docs.map((f) => (
        <FileChip key={f.id} orgId={orgId} f={f} size={size} />
      ))}
      {!grouped && data.map((f) => <FileChip key={f.id} orgId={orgId} f={f} size={size} />)}
      {grouped && (
        <Popover
          align="end"
          className="w-72"
          trigger={
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
                size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]',
              )}
            >
              <Files className="size-3.5" aria-hidden />
              {fixPack ? 'Fix pack' : 'Files'} ({data.length} files)
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          }
        >
          <p className="mb-2 text-xs font-medium text-ink-3">{fixPack ? 'Fix pack — upload or apply each file' : 'Data files'}</p>
          <ul className="space-y-1">
            {data.map((f) => (
              <li key={f.id}>
                <a href={fileUrl(orgId, f.id, true)} download={f.fileName} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-surface-2">
                  <Download className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                  <span className="shrink-0 text-xs tabular text-ink-3">{fmtBytes(f.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </span>
  );
}

const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Headline values of a report as small chips (verdict, score, health, mention rate …). */
export function ReportHighlights({ report }: { report: Report }) {
  const m = report.summary ?? {};
  const chips: ReactNode[] = [];
  const verdict = s(m.verdict);
  if (verdict) chips.push(<StatusBadge key="v" tone={verdictTone(verdict)}>{verdict.replace(/_/g, ' ')}</StatusBadge>);
  if (n(m.score) != null) chips.push(<Badge key="s">Score {n(m.score)}</Badge>);
  if (n(m.healthScore) != null) {
    const hs = n(m.healthScore)!;
    chips.push(
      <StatusBadge key="h" tone={scoreTone(hs) === 'accent' ? 'neutral' : scoreTone(hs)}>
        Health {hs}
        {s(m.grade) ? ` · ${s(m.grade)}` : ''}
      </StatusBadge>,
    );
  }
  if (n(m.mentionRate) != null) chips.push(<Badge key="mr">Named in {pct(n(m.mentionRate))}</Badge>);
  if (n(m.referringDomains) != null) chips.push(<Badge key="rd">{compactNumber(n(m.referringDomains))} ref. domains</Badge>);
  if (n(m.clicks) != null) chips.push(<Badge key="c">{compactNumber(n(m.clicks))} clicks</Badge>);
  if (n(m.pages) != null && report.stage === 'ladder_plan') chips.push(<Badge key="p">{n(m.pages)} pages</Badge>);
  if (n(m.gains) != null || n(m.drops) != null) chips.push(<Badge key="g">{n(m.gains) ?? 0} up · {n(m.drops) ?? 0} down</Badge>);
  if (n(m.passed) != null) chips.push(<Badge key="pc">{n(m.passed)} checks passed</Badge>);
  return chips.length ? <span className="inline-flex flex-wrap gap-1.5">{chips.slice(0, 3)}</span> : null;
}

/** A list of reports: title → report page, stage, when, highlights, files. */
export function ReportList({ orgId, reports, limit, empty }: { orgId: string; reports: readonly Report[]; limit?: number; empty?: ReactNode }) {
  const rows = limit ? reports.slice(0, limit) : reports;
  if (!rows.length) return <>{empty ?? <p className="px-5 py-8 text-center text-sm text-ink-3">No reports yet.</p>}</>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3" aria-hidden>
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <Link to={paths.report(orgId, r.id)} className="block truncate text-sm font-medium text-ink hover:text-accent-text">
                {r.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                <span>{STAGE_LABELS[r.stage] ?? r.stage}</span>
                <span aria-hidden>·</span>
                <span title={fmtDate(r.receivedAt)}>{fmtAgo(r.receivedAt)}</span>
                {r.scheduled && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" aria-hidden />
                    scheduled
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-10 md:pl-0">
            <ReportHighlights report={r} />
            <FileLinks orgId={orgId} files={r.files} />
          </div>
        </li>
      ))}
    </ul>
  );
}
