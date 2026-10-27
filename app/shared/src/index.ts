export * from './constants';
export * from './digest';
export * from './domain';
export * from './schemas';
export * from './payload';
export * from './tables';
export * from './api';
export * from './data';
export * from './gsc-connection';
export * from './format';
export * from './profile';
export * from './cost';
export * from './estimate';
export * from './pipeline-notices';
export * from './ladders';
export * from './keywords';
export * from './link-import';
export * from './outreach';
export * from './draft-qa';
export * from './placeholders';
export * from './findings';
export * from './lineage';
export * from './annotations';
export * from './change-test';
export * from './share';
export * from './brand';
export * from './queue';
export * from './report-delivery';
export * from './ai-visibility';
export * from './ai-panel';   // G6 (2026-10-18): the AI question panel at scale, the one cost formula (estimateAiPanelCost), mirrored from the engine
export * from './ai-detail';   // W2-A (2026-10-23): readers of the engine's wave-2 answer and visibility columns (WAVE2_CONTRACTS.md §1-§2)
export * from './ai-trends';   // W2-A: the page filter, trend lines with breaks, owner alert rules, the open-run note
export * from './ai-import';   // W2-A: Bing AI Performance / Search Console AI uploads -> seo_ai_imports (§5)
export * from './ai-export';   // W2-A: the AI page's CSV downloads, the panel import's keyword column (§6)
export * from './ai-compare';   // F3 (2026-10-23): like-for-like deltas, the engine's separators, pulse sampling (APP_AUDIT.md A1 A4 A7 A8)
// The setup guides are imported from '@seo/shared/guides', not from here: the catalogue is a sizeable chunk of text and only
// the help panel (and the recommendation -> guide map) needs it, so it stays out of every bundle that imports this barrel.
export * from './api-v1';
export * from './integrations';
export * from './identity';
export * from './cms';
export * from './crawlers';
export * from './agency';
export * from './admin';
export * from './billing';   // credits: what customers see and pay (app/docs/CREDITS.md)
export * from './autopilot'; // one breakdown of a website's schedules, for the settings card, the forecast and the reserve
export * from './cycle-clock'; // the per-website cycle's clock (v5/code/_cycle.js mirrored): due times, monthly cycles, previews
export * from './fit-gate';  // the engine's fit gate (v5/code/_fit_gate.js), generated from the kit by build_v4.py (KW-PARITY), the same code
export * from './cycles';    // the per-website 7-day cycle and keyword-first autopilot contract (SCHEDULING_KEYWORDS_PLAN.md §14)
export * from './readiness';   // P1 (2026-10-20): author profile + business facts before a written page (the engine's v5/code/_readiness.js)
export * from './markets';   // MKT (2026-10-27): which market a website, a keyword or a text points to (the engine's gazetteer)
export * from './consistency';   // MKT (2026-10-27): the one mismatch mechanism: warnings, Accept, Continue anyway (AUDIT.md §2)
export * from './draft-fix';   // 2026-10-21: a not-ready draft is finished by hand (the engine's qa_next_step / qa_owner_edits), never re-run
