// ---- placeholder kit (A-13, 2026-10-17; inlined through the PLACEHOLDERS marker) ----
// ONE answer to "what in this page is still a bracket somebody has to fill in or confirm?", shared by Content QA (the count, the gate,
// the reasons), the app's article view and its delivery rule (app/shared/src/placeholders.ts carries the same two patterns, and the
// build asserts they are byte-identical). Live (exec 771) the delivered body said "a fixed [Price band: typical Assess & Envision fee in
// AED]" while QA reported `placeholder_count 0`, `open_brackets []`: the pattern counted a bracket only when it held no colon, and the
// colon form was assumed to be one of OUR review notes — but a writer invents its own labels. Now:
//   * a bracket that is a Markdown link or image (`[text](url)`, `![alt](src)`), a checkbox (`[ ]`, `[x]`), a footnote (`[^1]`) or a
//     number (`[1]`) is not a gap;
//   * a review note is one of the CLOSED list of labels the prompts and QA themselves emit — `[Confirm: …]`, `[Owner: …]`,
//     `[Author insight: …]`, `[Image: …]` — and is reported as a note;
//   * every other bracket that starts with a letter is a placeholder, whatever its case or punctuation: `[Price]`, `[name, role]`,
//     `[date]`, `[Price band: typical … fee in AED]`, `[Insert client logo]`.
// Regex only (the n8n Code sandbox has no URL constructor).
const PH = (() => {
  const BRACKET_SRC = "(?<![!\\\\])\\[(\\p{L}[^\\[\\]\\n]{0,399})\\](?![(:])";
  const NOTE_SRC = "^(?:confirm|owner|author insight|image)\\s*:";
  // CT-FIX (review item 11, 2026-10-22): code is read as code ("`labels[sensitivity]`" is an index, not a gap); a bracket starts with a
  // letter of any script ("[السعر]" is a placeholder, it passed before); an edit or date label and an editor's "[sic]" are not gaps.
  const CODE_SRC = "```[\\s\\S]*?```|~~~[\\s\\S]*?~~~|`[^`\\n]+`";
  const NOT_GAP_SRC = "^(?:sic!?|emphasis (?:added|mine|ours)|(?:last )?(?:updated|revised|edited|reviewed|published)\\b[^\\]]*\\d{4}|(?:19|20)\\d\\d)$";
  const bracketRe = () => new RegExp(BRACKET_SRC, 'gu');
  const NOTE_RE = new RegExp(NOTE_SRC, 'i');
  const NOT_GAP_RE = new RegExp(NOT_GAP_SRC, 'i');
  const noCode = (t) => t.replace(new RegExp(CODE_SRC, 'g'), ' ');
  // one pass over the text: { placeholders: [{token, count}], notes: [{token, count}], placeholder_count, note_count, items: [...] }
  const scan = (text) => {
    const t = noCode(String(text == null ? '' : text));
    const ph = new Map(), nt = new Map();
    for (const m of t.matchAll(bracketRe())) {
      const inner = m[1].trim(); if (!inner) continue;
      if (/^x$/i.test(inner) || NOT_GAP_RE.test(inner)) continue;   // a ticked checkbox, [sic], [Updated 2026]
      const tok = '[' + m[1] + ']';
      const into = NOTE_RE.test(inner) ? nt : ph;
      into.set(tok, (into.get(tok) || 0) + 1);
    }
    const list = (mp) => [...mp.entries()].map(x => ({ token: x[0], count: x[1] })).sort((a, b) => b.count - a.count);
    const placeholders = list(ph), notes = list(nt);
    return { placeholders, notes, placeholder_count: placeholders.reduce((s, x) => s + x.count, 0), note_count: notes.reduce((s, x) => s + x.count, 0),
      items: placeholders.map(p => ({ ...p, kind: 'placeholder' })).concat(notes.map(n => ({ ...n, kind: 'review_note' }))) };
  };
  return { BRACKET_SRC, NOTE_SRC, CODE_SRC, NOT_GAP_SRC, bracketRe, NOTE_RE, scan };
})();
