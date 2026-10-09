import type { ReactNode } from 'react';
import { Download, ExternalLink, File, FileArchive, FileCode, FileJson, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import type { ReportFile } from '@seo/shared';
import { fileUrl } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { cn, fmtBytes } from '@/lib/utils';

const KIND_ICON: Record<ReportFile['kind'], (c: string) => ReactNode> = {
  pdf: (c) => <FileText className={c} aria-hidden />,
  docx: (c) => <FileType className={c} aria-hidden />,
  doc: (c) => <FileType className={c} aria-hidden />,
  html: (c) => <FileCode className={c} aria-hidden />,
  md: (c) => <FileText className={c} aria-hidden />,
  json: (c) => <FileJson className={c} aria-hidden />,
  zip: (c) => <FileArchive className={c} aria-hidden />,
  csv: (c) => <FileSpreadsheet className={c} aria-hidden />,
  txt: (c) => <FileText className={c} aria-hidden />,
  other: (c) => <File className={c} aria-hidden />,
};

const KIND_LABEL: Record<ReportFile['kind'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  html: 'HTML',
  md: 'Markdown',
  json: 'JSON',
  zip: 'ZIP',
  csv: 'CSV',
  txt: 'Text',
  other: 'File',
};

export const fileKindLabel = (k: ReportFile['kind']) => KIND_LABEL[k] ?? 'File';

/** The order files are offered in: the documents people read first. */
const ORDER: ReportFile['kind'][] = ['pdf', 'docx', 'doc', 'html', 'md', 'json', 'csv', 'zip', 'txt', 'other'];
export const sortFiles = (files: ReportFile[]) => [...files].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.fileName.localeCompare(b.fileName));

/** The same document is sometimes attached twice (backlinks: `pdf` and `files.pdf`): keep the first of each name + size. */
export function uniqueFiles(files: ReportFile[]): ReportFile[] {
  const seen = new Set<string>();
  return files.filter((f) => {
    const k = `${f.fileName}|${f.size}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** One file as a link: PDFs open inline in a new tab, everything else downloads. */
export function FileButton({ file, compact, label }: { file: ReportFile; compact?: boolean; label?: ReactNode }) {
  const { org } = useOrgCtx();
  const inline = file.kind === 'pdf';
  return (
    <a
      href={fileUrl(org.id, file.id, !inline)}
      target={inline ? '_blank' : undefined}
      rel={inline ? 'noopener noreferrer' : undefined}
      download={inline ? undefined : file.fileName}
      title={`${file.fileName} · ${fmtBytes(file.size)}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line-strong bg-surface font-medium text-ink-2 shadow-card transition-[color,border-color,background-color,translate] duration-150 ease-brand hover:-translate-y-px hover:border-accent hover:bg-accent-soft/40 hover:text-accent-text active:translate-y-0',
        compact ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]',
      )}
    >
      {KIND_ICON[file.kind]?.(compact ? 'size-3.5 shrink-0' : 'size-4 shrink-0') ?? <File className="size-4" aria-hidden />}
      <span className="truncate">{label ?? fileKindLabel(file.kind)}</span>
      {inline ? <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden /> : <Download className="size-3 shrink-0 opacity-60" aria-hidden />}
    </a>
  );
}

/** Every file of a report as chips; `named` shows the file name instead of the kind. */
export function FileChips({ files, compact, named, max }: { files: ReportFile[]; compact?: boolean; named?: boolean; max?: number }) {
  const list = sortFiles(uniqueFiles(files));
  if (!list.length) return null;
  const shown = max ? list.slice(0, max) : list;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((f) => (
        <FileButton key={f.id} file={f} compact={compact} label={named ? f.fileName : undefined} />
      ))}
      {max && list.length > max && <span className="text-xs text-ink-3">+{list.length - max}</span>}
    </div>
  );
}
