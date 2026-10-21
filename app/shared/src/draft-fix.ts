// A written page the quality check did not pass is a draft to FINISH BY HAND, not a page to run again (pre-launch run 2026-10-21, exec 42).
// The app told the client "fix it and run it again" in nine places. A new run writes, and charges for, a whole new page, throws away every
// bracket the client already filled in and reads the same results page again; what is left on a draft (a bracket to fill in or delete, a
// claim to confirm, the author fields) is edited in the draft itself. Since the engine's E-QA fix the page run says so itself:
// `qa_next_step` ("Finish this draft by hand: ... You do not need a new run ...") and `qa_owner_edits` (each bracket and what to do with it).
// This module reads those fields, and words the same advice for older reports and for screens that only have the content-log row.

/** What the client does about a draft, in one sentence (screens that have no report at hand). */
export const DRAFT_BY_HAND = 'Finish it by hand: fill in or delete each bracket the report lists, then publish it';
/** Why not a new run (said wherever the choice could be made). */
export const NO_RERUN_NEEDED = 'You do not need a new run for these edits: a new run writes a whole new page and is charged again.';

export interface OwnerEdit {
  /** the bracket as it stands in the text, e.g. "[Tech& banking or public sector reference, to confirm]" */
  token: string;
  count: number;
  /** 'fill_or_delete' | 'fill_or_rewrite' | 'confirm' | 'write' | 'delete' (the engine's) */
  action: string;
  /** what to do with it, in the client's words */
  text: string;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The edits the engine listed for a not-ready draft (`qa_owner_edits`, or the same list in the page's quality block); [] on older reports. */
export function ownerEdits(payload: Record<string, unknown> | null | undefined): OwnerEdit[] {
  const p = payload ?? {};
  const quality = obj(p.qa_quality ?? obj(p.meta).quality);
  const raw = Array.isArray(p.qa_owner_edits) ? p.qa_owner_edits : Array.isArray(quality.owner_edits) ? quality.owner_edits : [];
  return raw
    .map((e) => obj(e))
    .map((e) => ({ token: str(e.token), count: Math.max(1, Number(e.count) || 1), action: str(e.action), text: str(e.text) }))
    .filter((e) => e.token || e.text)
    .map((e) => ({ ...e, text: e.text || `Fill in ${e.token} with the real detail, or delete the bracket and the words that need it` }));
}

/**
 * The next step for a not-ready draft: the engine's own (`qa_next_step`), or, for a report written before the engine said it, the same
 * advice in general words. Never a new run.
 */
export function draftNextStep(payload: Record<string, unknown> | null | undefined): string {
  const p = payload ?? {};
  const quality = obj(p.qa_quality ?? obj(p.meta).quality);
  return str(p.qa_next_step) || str(quality.next_step) || `Finish this draft by hand: work through the points listed here in the text, then publish it. ${NO_RERUN_NEEDED}`;
}
