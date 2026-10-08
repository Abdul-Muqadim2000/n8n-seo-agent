// Visual building blocks shared by the report renderers: the report summary hero (+ the download cards under it), the verdict /
// score mark for the hero's aside, download cards, and small in-cell measures for keyword tables (volume bar, difficulty meter,
// position pill). Colours: blue for categories and intensity, status tokens only where the colour means good / bad (always with a word).
import { createContext, useContext, type ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Download, ExternalLink as ExternalIcon, File, FileArchive, FileCode, FileJson, FileSpreadsheet, FileText, FileType, Files, Info } from 'lucide-react';
import type { ReportDetail, ReportFile } from '@seo/shared';
import { fileUrl } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { cn, fmtBytes, fmtDateTime } from '@/lib/utils';
import { verdictTone, type Tone } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { CountUp, IconTile, InfoTip, ScoreRing, SummaryHero, type IconTileTone, type RingTone } from '@/components/insight';
import { stageLabel, StageIcon } from './meta';
import { sortFiles, uniqueFiles } from './files';
import { verdictLabel } from './kit';

/** The files of the report on screen (null = the page shows them elsewhere): the hero renders them as download cards under itself. */
export const ReportFilesContext = createContext<ReportFile[] | null>(null);

/**
 * ReportHero: the report's summary panel (ink) — eyebrow (report type · website · received), the headline sentence, one supporting
 * line, the verdict / score mark on the right, 2–4 HeroStats and the next action; the report's documents follow as download cards.
 */
export function ReportHero({
  report,
  title,
  description,
  aside,
  stats,
  actions,
  eyebrow,
}: {
  report: ReportDetail;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  /** extra eyebrow parts after the report type (market, week …) */
  eyebrow?: ReactNode;
}) {
  const files = useContext(ReportFilesContext);
  return (
    <>
      <SummaryHero
        tone="ink"
        eyebrow={
          <>
            <span className="inline-flex items-center gap-1.5 font-mono tracking-[0.02em] uppercase">
              <StageIcon stage={report.stage} report={report} className="size-3.5" />
              {stageLabel(report.stage, report)}
            </span>
            {report.siteDomain && (
              <>
                <span aria-hidden>·</span>
                <span>{report.siteDomain}</span>
              </>
            )}
            {eyebrow && (
              <>
                <span aria-hidden>·</span>
                {eyebrow}
              </>
            )}
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="basis-full sm:basis-auto">{fmtDateTime(report.receivedAt)}</span>
          </>
        }
        title={title}
        description={description}
        aside={aside}
        stats={stats}
        actions={actions}
      />
      {files && <ReportDownloads files={files} />}
    </>
  );
}

const STATUS_PILL: Record<Tone, { cls: string; icon: ReactNode }> = {
  neutral: { cls: 'bg-surface-2 text-ink-2', icon: <Info aria-hidden /> },
  accent: { cls: 'bg-accent-soft text-accent-text', icon: <Info aria-hidden /> },
  good: { cls: 'bg-good-soft text-good-text', icon: <CheckCircle2 aria-hidden /> },
  warning: { cls: 'bg-warning-soft text-warning-text', icon: <AlertTriangle aria-hidden /> },
  serious: { cls: 'bg-serious-soft text-serious-text', icon: <AlertTriangle aria-hidden /> },
  critical: { cls: 'bg-critical-soft text-critical-text', icon: <AlertOctagon aria-hidden /> },
};

/** A large status word with its icon (the verdict in a hero): colour + icon + word, never colour alone. */
export function BigStatus({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const t = STATUS_PILL[tone];
  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold [&_svg]:size-4 [&_svg]:shrink-0', t.cls, className)}>
      {t.icon}
      {children}
    </span>
  );
}

const ringTone = (t: Tone): RingTone => (t === 'good' ? 'good' : t === 'warning' || t === 'serious' ? 'warning' : t === 'critical' ? 'critical' : 'accent');

/**
 * The hero's aside: a score ring (drawn in the verdict's colour when there is one) with the verdict / grade as a large word next to it.
 * `label` names the score for screen readers and in the caption ("Opportunity score").
 */
export function ScoreMark({
  score,
  label,
  verdict,
  status,
  statusTone,
  caption,
  max = 100,
  display,
  suffix = '/100',
  ringTone: ringToneProp,
}: {
  /** ring colour when there is no verdict (default: by the score) */
  ringTone?: RingTone;
  score: number | null;
  label: string;
  /** GO / GO_WITH_CHANGES / AVOID: colours the ring and becomes the big word */
  verdict?: string;
  /** any other word for the big pill (a grade, "Live") */
  status?: ReactNode;
  statusTone?: Tone;
  caption?: ReactNode;
  max?: number;
  display?: ReactNode;
  suffix?: string;
}) {
  const tone: Tone | null = verdict ? verdictTone(verdict) : (statusTone ?? null);
  const word = verdict ? verdictLabel(verdict) : status;
  // a verdict colours the ring; any other status word sits next to a ring coloured by the score itself (80+ / 60+ / below)
  const ring: RingTone = verdict && tone ? ringTone(tone) : ringToneProp ?? 'auto';
  return (
    <div className="flex w-full items-center gap-4 rounded-lg bg-on-ink/[0.06] p-4 ring-1 ring-line-on-ink md:w-[300px]">
      <ScoreRing
        value={score}
        max={max}
        label={label}
        tone={ring}
        size={88}
        display={score != null ? (display ?? <CountUp value={score} />) : undefined}
        suffix={suffix}
        valueText={score != null ? `${Number(score.toFixed(1))} of ${max}` : undefined}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium text-on-ink-2">{label}</p>
        {word && tone && <BigStatus tone={tone} className="mt-1.5">{word}</BigStatus>}
        {word && !tone && <p className="mt-1 font-display text-lg leading-tight font-semibold text-on-ink">{word}</p>}
        {caption && <p className="mt-1.5 text-xs leading-snug text-on-ink-2">{caption}</p>}
      </div>
    </div>
  );
}

/** The hero's aside when there is no score: a large status word with an icon tile and a caption. */
export function StatusMark({ tone, icon, title, caption }: { tone: Tone; icon?: ReactNode; title: ReactNode; caption?: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-3.5 rounded-lg bg-on-ink/[0.06] p-4 ring-1 ring-line-on-ink md:w-[300px]">
      {icon && (
        <IconTile tone={tone === 'accent' || tone === 'neutral' ? 'on-dark' : (tone as IconTileTone)} size="lg">
          {icon}
        </IconTile>
      )}
      <div className="min-w-0">
        <BigStatus tone={tone}>{title}</BigStatus>
        {caption && <p className="mt-2 text-xs leading-snug text-on-ink-2">{caption}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Download cards

const KIND_ICON: Record<ReportFile['kind'], ReactNode> = {
  pdf: <FileText />,
  docx: <FileType />,
  doc: <FileType />,
  html: <FileCode />,
  md: <FileText />,
  json: <FileJson />,
  zip: <FileArchive />,
  csv: <FileSpreadsheet />,
  txt: <FileText />,
  other: <File />,
};

const KIND_TITLE: Record<ReportFile['kind'], string> = {
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

/** One document as a card: type tile, kind, file name, size; PDFs open in a new tab, everything else downloads. */
export function FileCard({ file, title }: { file: ReportFile; title?: ReactNode }) {
  const { org } = useOrgCtx();
  const inline = file.kind === 'pdf';
  return (
    <a
      href={fileUrl(org.id, file.id, !inline)}
      target={inline ? '_blank' : undefined}
      rel={inline ? 'noopener noreferrer' : undefined}
      download={inline ? undefined : file.fileName}
      title={`${file.fileName} · ${fmtBytes(file.size)}`}
      className="group/file flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-card transition-[box-shadow,border-color,translate] duration-200 ease-brand hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised active:translate-y-0"
    >
      <IconTile tone={inline ? 'solid' : 'blue'} size="md">
        {KIND_ICON[file.kind] ?? <File />}
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm leading-snug font-semibold text-ink">{title ?? KIND_TITLE[file.kind] ?? 'File'}</span>
          <span className="shrink-0 text-[11px] tabular text-ink-3">{fmtBytes(file.size)}</span>
        </span>
        <span className="block truncate text-xs text-ink-3">{file.fileName}</span>
      </span>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text transition-colors duration-200 ease-brand group-hover/file:bg-accent group-hover/file:text-accent-ink" aria-hidden>
        {inline ? <ExternalIcon className="size-4" /> : <Download className="size-4" />}
      </span>
      <span className="sr-only">{inline ? '(opens in a new tab)' : '(download)'}</span>
    </a>
  );
}

/** The report's documents as download cards (fix-pack files are listed in their own section). */
export function ReportDownloads({ files }: { files: ReportFile[] }) {
  const main = sortFiles(uniqueFiles(files.filter((f) => !f.field.startsWith('fix_pack.files['))));
  const fixPack = files.filter((f) => f.field.startsWith('fix_pack.files[')).length;
  if (!main.length && !fixPack) return null;
  const kindCount = new Map<string, number>();
  main.forEach((f) => kindCount.set(f.kind, (kindCount.get(f.kind) ?? 0) + 1));
  return (
    <section aria-label="Downloads">
      <h3 className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-ink-3">
        <Files className="size-4" aria-hidden /> Downloads
        {main.length > 0 && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular text-ink-2">{main.length}</span>}
        {fixPack > 0 && <span className="text-xs font-normal">+ {fixPack} fix-pack files in the Fix pack section</span>}
      </h3>
      {main.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {main.map((f) => (
            <FileCard key={f.id} file={f} title={(kindCount.get(f.kind) ?? 0) > 1 ? `${KIND_TITLE[f.kind] ?? 'File'} · ${f.fileName}` : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// In-cell measures for keyword tables

/** Search volume as a number with a small blue bar relative to the largest in the list. */
export function VolumeBar({ value, max, text }: { value: number | null; max: number; text: string }) {
  const w = value != null && max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span className="inline-flex min-w-[4.5rem] flex-col items-end gap-1">
      <span className="tabular">{text}</span>
      <span className="block h-1 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {w > 0 && <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />}
      </span>
    </span>
  );
}

/** Keyword difficulty 0–100 as a number with a short meter on the blue ramp (darker = harder; the number says it). */
export function KdMeter({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-3">–</span>;
  const v = Math.max(0, Math.min(100, value));
  const step = v < 15 ? 2 : v < 30 ? 3 : v < 50 ? 4 : v < 70 ? 5 : 6;
  return (
    <span className="inline-flex items-center justify-end gap-1.5" title={`Keyword difficulty ${v} of 100`}>
      <span className="tabular">{value}</span>
      <span className="block h-1.5 w-10 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(6, v)}%`, background: `var(--seq-${step})` }} />
      </span>
    </span>
  );
}

/** A Google position as a pill: top 3 / top 10 / top 20 / further on the blue ramp, "not ranking" in grey. */
export function PositionPill({ value, text }: { value: number | null; text: string }) {
  const ranked = value != null && value > 0;
  const cls = !ranked ? 'bg-surface-2 text-ink-3' : value <= 3 ? 'bg-accent text-accent-ink' : value <= 10 ? 'bg-accent-soft text-accent-text ring-1 ring-accent-text/25' : 'bg-surface-2 text-ink-2';
  return <span className={cn('inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 text-xs font-semibold tabular', cls)}>{text}</span>;
}

/** A chart card title with its icon tile and (optionally) an explanation behind an info tip. */
export function ChartTitle({ icon, children, info }: { icon: ReactNode; children: ReactNode; info?: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <IconTile size="sm">{icon}</IconTile>
      <span className="flex min-w-0 items-center gap-1">
        {children}
        {info && <InfoTip label="About this chart">{info}</InfoTip>}
      </span>
    </span>
  );
}

/** A grid of pass / fail ticks (SEO checks): tick tile, label, the fact behind it. */
export function TickGrid({ items }: { items: { ok: boolean | null; label: ReactNode; detail?: ReactNode }[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 py-1.5">
          <IconTile tone={it.ok === true ? 'good' : it.ok === false ? 'warning' : 'neutral'} size="xs" className="mt-px">
            {it.ok === true ? <CheckCircle2 /> : it.ok === false ? <AlertTriangle /> : <Info />}
          </IconTile>
          <span className="min-w-0 text-sm leading-snug">
            <span className="text-ink">{it.label}</span>
            <span className="sr-only">{it.ok === true ? ' (pass)' : it.ok === false ? ' (to fix)' : ''}</span>
            {it.detail && <span className="block text-xs text-ink-3">{it.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A document as a button inside the hero (PDFs open in a new tab, everything else downloads). */
export function HeroFileButton({ file, children, variant = 'primary' }: { file: ReportFile; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const { org } = useOrgCtx();
  const inline = file.kind === 'pdf';
  return (
    <a
      href={fileUrl(org.id, file.id, !inline)}
      target={inline ? '_blank' : undefined}
      rel={inline ? 'noopener noreferrer' : undefined}
      download={inline ? undefined : file.fileName}
      title={`${file.fileName} · ${fmtBytes(file.size)}`}
      className={buttonClass(variant, 'sm')}
    >
      {inline ? <ExternalIcon className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
      {children}
    </a>
  );
}

/** A word (not a number) as a hero / card value: smaller than the figures and wrapping, so it never overflows its tile. */
export function WordValue({ children }: { children: ReactNode }) {
  return <span className="block text-lg leading-tight [overflow-wrap:anywhere] sm:text-xl">{children}</span>;
}
