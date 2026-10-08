import type { ReactNode } from 'react';
import type { ReportDetail, ReportFile } from '@seo/shared';
import { Callout } from '@/components/ui/feedback';
import { AiPulseReport, AiVisibilityReport } from './ai';
import { AuditReport } from './audit';
import { BacklinksReport } from './backlinks';
import { ContentReport } from './content';
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
import { ReportDownloads, ReportFilesContext } from './visuals';
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

/** The documents of a report as download cards (fix-pack files are listed in their own section). */
export function ReportFilesBar({ files }: { files: ReportFile[] }) {
  return <ReportDownloads files={files} />;
}

/**
 * A report rendered by stage: a dedicated view per callback type, the raw data for anything else. Every view opens with its summary
 * hero; the report's documents follow the hero as download cards (through ReportFilesContext; `hideFiles` leaves them out).
 */
export function ReportView({ report, hideFiles }: { report: ReportDetail; hideFiles?: boolean }) {
  const Renderer = RENDERERS[report.stage] ?? GenericReport;
  return (
    <ReportFilesContext.Provider value={hideFiles ? null : report.files}>
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
    </ReportFilesContext.Provider>
  );
}
