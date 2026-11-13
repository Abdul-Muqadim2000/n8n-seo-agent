// F-07 (prod review 2026-10-31 / 2026-11-12): how typed or pasted text becomes the entries of a list field (chips).
//
// "What do you sell?" used to split on every comma and cut each entry at 80 characters without a word, so "Microsoft Dynamics 365 Business
// Central, implementation" became two services and a pasted sentence became six fragments, the last one cut mid-word. The engine then judged
// keyword fit and wrote pages from those fragments.
//
// Two ways to split:
// - 'items' (domains, keywords, tags): every comma, semicolon and new line separates entries, as before.
// - 'phrases' (services, products): a new line, a semicolon or a tab always separates entries. A comma separates entries only when the text
//   is plainly a list of short items: three or more pieces, each of one to four words and at most 40 characters, and no sentence in it
//   ("accounting, payroll, invoicing" or "ERP, CRM, HR, payroll"). Anything else keeps its commas: "Microsoft Dynamics 365 Business Central,
//   implementation" stays one entry, and a pasted sentence stays one entry, which the length check then refuses with a message instead of
//   cutting it.

export type ListSplit = 'items' | 'phrases';

/** "What do you sell?": the longest service or product name we keep (the shared schema refuses longer ones, the form says so). */
export const SERVICE_MAX_CHARS = 120;
/** "What do you sell?": how many services or products a website can list. */
export const SERVICES_MAX = 30;

const COMMA_ITEM_MAX_WORDS = 4;
const COMMA_ITEM_MAX_CHARS = 40;
const COMMA_LIST_MIN_ITEMS = 3;

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** a sentence ends inside the text: ". ", "! ", "? " or a final full stop ("Node.js" and "v2.1" are not sentences) */
const hasSentence = (s: string) => /[.!?](\s|$)/.test(s.trim());

/** the pieces of a comma list, with a joining "and" / "or" taken off the last ones ("a, b, and c") */
const commaPieces = (s: string) =>
  s
    .split(',')
    .map((p) => squash(p).replace(/^(and|or|&)\s+/i, ''))
    .filter(Boolean);

/** true when the text is plainly a list of short items separated by commas */
export function isShortCommaList(text: string): boolean {
  if (!text.includes(',') || hasSentence(text)) return false;
  const pieces = commaPieces(text);
  if (pieces.length < COMMA_LIST_MIN_ITEMS) return false;
  return pieces.every((p) => p.length <= COMMA_ITEM_MAX_CHARS && p.split(' ').length <= COMMA_ITEM_MAX_WORDS);
}

/** Typed or pasted text -> the entries it holds (trimmed, inner spaces collapsed, empty ones dropped; never shortened). */
export function splitListEntries(raw: string, mode: ListSplit = 'items'): string[] {
  const text = String(raw ?? '');
  if (mode === 'items') return text.split(/[,\n;]+/).map(squash).filter(Boolean);
  const out: string[] = [];
  for (const line of text.split(/[\n\r;\t•]+/)) {
    const l = squash(line.replace(/^[-*]\s+/, ''));
    if (!l) continue;
    if (isShortCommaList(l)) out.push(...commaPieces(l));
    else out.push(l);
  }
  return out;
}

/** true when the paste should be split into chips at once (the text holds more than one entry) */
export function pasteHasSeveral(raw: string, mode: ListSplit = 'items'): boolean {
  return mode === 'items' ? /[,\n;]/.test(raw) : splitListEntries(raw, 'phrases').length > 1;
}

/** "What do you sell?": the message for an entry the list cannot keep, or null */
export function serviceEntryError(s: string): string | null {
  const v = squash(s);
  if (v.length < 2) return 'Use at least 2 characters';
  if (v.length > SERVICE_MAX_CHARS)
    return `At most ${SERVICE_MAX_CHARS} characters (this one has ${v.length}). Shorten it, or press Enter between two services.`;
  return null;
}
