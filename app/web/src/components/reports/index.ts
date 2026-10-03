// Report renderers: one view per n8n callback stage. Reuse `ReportView` wherever a full report is shown and
// `ReportSummaryLine` in lists; `FileChips` for a report's documents.
export { ReportView, ReportFilesBar } from './ReportView';
export { ReportSummaryLine } from './ReportSummaryLine';
export { FileChips, FileButton } from './files';
export { ModeIcon, ModeGlyph, StageGlyph, stageLabel, modeTitle, prefillFromApiBody, keywordPrefill, normalizePageType } from './meta';
