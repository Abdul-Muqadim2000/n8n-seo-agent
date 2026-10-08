import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import type { ReportDetail, ReportFile } from '@seo/shared';
import { Callout } from '@/components/ui/feedback';
import { AiPulseReport, AiVisibilityReport } from './ai';
import { AuditReport } from './audit';
import { BacklinksReport } from './backlinks';
import { ContentReport } from './content';
import { FileButton, fileKindLabel, sortFiles, uniqueFiles } from './files';
import { RenderBoundary } from './kit';
import { LadderReport } from './ladder';
import { RankTrackerReport } from './rank';
import {
  CadenceReport,
  CheckinReport,
  ConsoleAlertReport,
  DescriptionReport,
  GenericReport,
  ProfileReport,
  PublishedReport,
  RejectedReport,
  StartedReport,
  TrackerSetupReport,
} from './simple';
import { KeywordStrategyReport } from './strategy';
import { SiteTrackerReport } from './tracker';

const RENDERERS: Record<string, (p: { report: ReportDetail }) => ReactNode> = {
  content: ContentReport,
  keyword_strategy: KeywordStrategyReport,
  site_audit: AuditReport,
  full_report: AuditReport,
  ladder_plan: LadderReport,
  rank_tracker: RankTrackerReport,
  site_tracker: SiteTrackerReport,
  ai_visibility: AiVisibilityReport,
  ai_pulse: AiPulseReport,
  backlinks: BacklinksReport,
  published: PublishedReport,
  profile: ProfileReport,
  console_checkin: CheckinReport,
  content_cadence: CadenceReport,
  site_tracker_setup: TrackerSetupReport,
  case_study_started: StartedReport,
  ai_visibility_started: StartedReport,
  backlinks_started: StartedReport,
  rejected: RejectedReport,
  site_description: DescriptionReport,
  console_alert: ConsoleAlertReport,
};

/** The documents of a report as one row of buttons (fix-pack files are listed in their own section). */
export function ReportFilesBar({ files }: { files: ReportFile[] }) {
  const main = sortFiles(uniqueFiles(files.filter((f) => !f.field.startsWith('fix_pack.files['))));
  const fixPack = files.filter((f) => f.field.startsWith('fix_pack.files[')).length;
  if (!main.length && !fixPack) return null;
  const kindCount = new Map<string, number>();
  main.forEach((f) => kindCount.set(f.kind, (kindCount.get(f.kind) ?? 0) + 1));
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
        <Download className="size-4" aria-hidden /> Downloads
      </span>
      {main.map((f) => (
        <FileButton key={f.id} file={f} label={(kindCount.get(f.kind) ?? 0) > 1 ? f.fileName : fileKindLabel(f.kind)} />
      ))}
      {fixPack > 0 && <span className="text-xs text-ink-3">+ {fixPack} fix-pack files in the Fix pack section</span>}
    </div>
  );
}

/** A report rendered by stage: a dedicated view per callback type, the raw data for anything else. */
export function ReportView({ report, hideFiles }: { report: ReportDetail; hideFiles?: boolean }) {
  const Renderer = RENDERERS[report.stage] ?? GenericReport;
  return (
    <div className="space-y-5">
      {!hideFiles && <ReportFilesBar files={report.files} />}
      <RenderBoundary
        resetKey={report.id}
        fallback={(e) => (
          <div className="space-y-5">
            <Callout tone="warning" title="This report could not be laid out">
              Part of the data has an unexpected shape ({e.message}). The downloads and the raw data are below.
            </Callout>
            <GenericReport report={report} />
          </div>
        )}
      >
        <Renderer report={report} />
      </RenderBoundary>
    </div>
  );
}
