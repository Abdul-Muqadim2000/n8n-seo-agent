// W0-A (2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 1, REVIEW_CODE H4): the meta description of a written page.
// Production page run 3299 stored "Slug: ms-365-erp-uae" (20 characters) as its meta description: the engine's claim check had emptied the
// line and a reader took the next line as its value. The app then sent that value back to make the final version and showed it on the
// report. The engine now rebuilds a broken description (PF.meta, v5/code/_page_fix.js); this is the same field rule on the app side, so a
// report written before the fix is repaired when it is read, never sent back to the engine and never published to a CMS.

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** A field label at the start (the engine's meta lines): such a value is never a description. */
const META_FIELD_LABEL = /^(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords|URL|Page Type)\s*:/i;

export type MetaDescriptionProblem = '' | 'missing' | 'multi_line' | 'label' | 'short';

/**
 * Why a stored description cannot be used as one: missing, on more than one line, a field label ("Slug: ..."), or under 70 characters.
 * A long one is not a problem here (the engine shortens it), and neither is a bracket (the engine unwraps it).
 */
export function metaDescriptionProblem(d: unknown): MetaDescriptionProblem {
  const raw = s(d).replace(/\s+$/, '');
  const t = raw.trim();
  if (!t) return 'missing';
  if (/\n/.test(raw)) return 'multi_line';
  if (META_FIELD_LABEL.test(t)) return 'label';
  if (t.length < 70) return 'short';
  return '';
}

/** The stored description when it can be sent to the engine as it is, else '' (the engine then writes one from the page). */
export function usableMetaDescription(d: unknown): string {
  return metaDescriptionProblem(d) ? '' : s(d).trim();
}

/**
 * The stored description unless it is plainly broken (a field label such as "Slug: ...", or several lines): what a report shows and a CMS
 * publishes. A short one is kept here (it is still the page's own description; the report flags its length).
 */
export function cleanMetaDescription(d: unknown): string {
  const p = metaDescriptionProblem(d);
  return p === 'label' || p === 'multi_line' || p === 'missing' ? '' : s(d).trim();
}

/** What a report shows in place of a description it cannot use. */
export const META_DESCRIPTION_MISSING_NOTE = 'Missing. Make the final version and we will write one from the page.';

/** The description a report shows: the stored one, or none with the note above. */
export function metaDescriptionView(d: unknown): { text: string; note: string } {
  const text = cleanMetaDescription(d);
  return { text, note: text ? '' : META_DESCRIPTION_MISSING_NOTE };
}
