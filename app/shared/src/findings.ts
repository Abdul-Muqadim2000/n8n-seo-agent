// The minor band of an audit finding (G18-2, system review of 2026-10-11, §3.9). The accuracy set measures a second number next to
// precision: of the findings an audit shows, how many are worth a customer's time. It was 75% — 10 of the 40 findings shown on the three
// labelled sites were true and still not worth reading: the link count of a navigation-heavy page, a title one character over 60, "light
// content" on a section index page whose job is to link onwards, a URL whose rename would cost a published article its rankings, a cosmetic
// tag. Such a finding is **folded**, never dropped: the report prints one "Minor items (N)" line instead of a section each, and this app
// shows the same fold with the folded rows one click away.
//
// This is the mirror of `IMP.isMinor` in `n8n/seo-agent/v5/code/_impact.js` — the two must change together (as `Cadence_Plan.js` and
// `server/src/services/cadence.ts` do). It works from the severity and the impact weight the audit stored on the finding row, so no Data
// Table column was added: `impact_cosmetic` is not stored, but the engine caps a cosmetic finding's impact at MINOR_MAX, which the first
// rule below catches anyway.
import type { Finding } from './data';

/** Impact at or below this is the lowest band of an audit — the same ceiling the engine's cosmetic cap uses. */
export const MINOR_IMPACT_MAX = 0.9;
/** A rule on the measured low-value list stays folded up to this impact; above it, it sits on pages with real traffic and is shown. */
export const MINOR_RULE_IMPACT_MAX = 3;
/** The rules the accuracy set measured as not worth a customer's time (ACCURACY_SET.md §6). */
export const MINOR_RULES = /too many links on one page|title longer than \d+ characters|light content|long or messy urls/i;

/** Is this finding in the minor band — folded into one line instead of listed? Only Low and Info findings can be. */
export function isMinorFinding(f: Pick<Finding, 'severity' | 'title' | 'impact'>): boolean {
  const sev = String(f.severity ?? '').toLowerCase();
  if (sev !== 'low' && sev !== 'info') return false;
  const impact = f.impact == null || !Number.isFinite(Number(f.impact)) ? null : Number(f.impact);
  if (MINOR_RULES.test(String(f.title ?? ''))) return impact == null || impact <= MINOR_RULE_IMPACT_MAX;
  return impact != null && impact <= MINOR_IMPACT_MAX;
}

/** The two halves of a finding list and the count, for a page that folds the minor ones into one line. */
export function foldMinor<T extends Pick<Finding, 'severity' | 'title' | 'impact'>>(findings: readonly T[]): { main: T[]; minor: T[]; folded: number } {
  const main: T[] = [];
  const minor: T[] = [];
  for (const f of findings) (isMinorFinding(f) ? minor : main).push(f);
  return { main, minor, folded: minor.length };
}

/** The line the app and the reports use to say what was folded, with the count. */
export function minorFoldNote(folded: number): string {
  if (!folded) return '';
  return `${folded} minor ${folded === 1 ? 'item is' : 'items are'} folded into one line: true, and the lowest impact of this audit (a cosmetic tag, a title a character too long, the link count of a navigation page). Nothing is left out of the score or of the stored findings.`;
}
