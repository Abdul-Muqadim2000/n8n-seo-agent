// A-13 (2026-10-17, re-rating 2026-10-17): ONE answer to "what in this page is still a bracket somebody has to fill in or confirm?".
// The engine's Content QA counts with n8n/seo-agent/v5/code/_placeholders.js; this file carries the same two patterns, character for
// character (build_v4.py section 130 reads both and fails the build when they differ), so the count the engine reports, the brackets the
// article view highlights and the brackets the delivery rule holds a report for are one set. Live (exec 771) the delivered body said
// "[Price band: typical Assess & Envision fee in AED]" while the engine counted 0 and the view highlighted nothing: both patterns refused
// a colon.
//   - a Markdown link or image (`[text](url)`, `![alt](src)`), a checkbox (`[ ]`, `[x]`), a footnote (`[^1]`) or a number (`[1]`) is not a gap;
//   - a review note is one of the closed list Confirm / Owner / Author insight / Image;
//   - every other bracket that starts with a letter is a placeholder, whatever its case or punctuation.

export const PLACEHOLDER_BRACKET_SRC = "(?<![!\\\\])\\[([A-Za-z][^\\[\\]\\n]{0,399})\\](?![(:])";
export const PLACEHOLDER_NOTE_SRC = "^(?:confirm|owner|author insight|image)\\s*:";

export type OpenBracketKind = 'placeholder' | 'review_note';
export interface OpenBracket {
  token: string;
  count: number;
  kind: OpenBracketKind;
}

/** A fresh global matcher for every bracket that may be left for a person (stateful `lastIndex`, so never shared). */
export const placeholderRe = (): RegExp => new RegExp(PLACEHOLDER_BRACKET_SRC, 'g');
const NOTE_RE = new RegExp(PLACEHOLDER_NOTE_SRC, 'i');

/** Every bracket left in `text` for a person, counted per token, placeholders first, each kind by count. */
export function findOpenBrackets(text: string): OpenBracket[] {
  const ph = new Map<string, number>();
  const nt = new Map<string, number>();
  for (const m of String(text ?? '').matchAll(placeholderRe())) {
    const inner = (m[1] ?? '').trim();
    if (!inner || /^x$/i.test(inner)) continue;
    const tok = `[${m[1]}]`;
    const into = NOTE_RE.test(inner) ? nt : ph;
    into.set(tok, (into.get(tok) ?? 0) + 1);
  }
  const list = (mp: Map<string, number>, kind: OpenBracketKind): OpenBracket[] =>
    [...mp.entries()].map(([token, count]) => ({ token, count, kind })).sort((a, b) => b.count - a.count);
  return [...list(ph, 'placeholder'), ...list(nt, 'review_note')];
}

/** Whether one matched token is a review note (Confirm / Owner / Author insight / Image) rather than a gap to fill. */
export const isReviewNote = (token: string): boolean => NOTE_RE.test(token.replace(/^\[|\]$/g, '').trim());
