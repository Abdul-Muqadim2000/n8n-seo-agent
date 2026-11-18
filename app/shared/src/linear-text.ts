// Text rules that read the text once (CR17, CodeQL js/polynomial-redos on PR #71). A few patterns of the client-copy, link and address
// rules backtrack: a long run of spaces, slashes or "#" that does not end the way the pattern needs makes the engine retry the run from
// every one of its characters, so a crafted engine note, page title or linking address could stall the API. Each helper below gives
// exactly what the pattern it replaces gives (linear-text.test.ts runs both on the same cases) in one pass over the text.
// Pure, no imports: usable by the server, the web and `@seo/shared/legal`.

const LINE_BREAK = '\n\r  ';
const SPACE = /\s/;

/** `s` without its trailing run of characters matching `one` (a one-character class such as /[\s:,-]/): exactly s.replace(/[...]+$/, '') */
export function trimEndMatching(s: string, one: RegExp): string {
  let e = s.length;
  while (e > 0 && one.test(s[e - 1])) e--;
  return s.slice(0, e);
}

/**
 * `s` cut at the first character matching `one` that has no line break after it: exactly s.replace(/[...].*$/, '') (`.` stops at a line
 * break, so the pattern cuts at the first such character after the last line break).
 */
export function cutAtFirst(s: string, one: RegExp): string {
  let i = s.length;
  while (i > 0 && !LINE_BREAK.includes(s[i - 1])) i--;
  for (; i < s.length; i++) if (one.test(s[i])) return s.slice(0, i);
  return s;
}

/**
 * Every match of `core` replaced together with the spaces around it: exactly s.replace(/\s{before}CORE\s{after}/g, repl), where `before`
 * and `after` are '*' (any run of spaces, also none), '+' (at least one space) or '' (no space taken). `core` is a global pattern that
 * neither starts nor ends with a space and cannot overlap itself; with a '+' side it must match one character.
 */
export function replaceSpaced(s: string, core: RegExp, before: '*' | '+', after: '' | '*' | '+', repl: string | ((m: RegExpMatchArray) => string)): string {
  if (!core.global) throw new Error('replaceSpaced: core must be a global pattern');
  let out = '';
  let p = 0; // everything before p is written or taken
  for (const m of s.matchAll(core)) {
    const c = m.index ?? 0;
    const e = c + m[0].length;
    if (c < p) continue;
    let b = c;
    while (b > p && SPACE.test(s[b - 1])) b--;
    if (before === '+' && b === c) continue;
    let f = e;
    if (after) {
      while (f < s.length && SPACE.test(s[f])) f++;
      if (after === '+' && f === e) continue;
    }
    out += s.slice(p, b) + (typeof repl === 'string' ? repl : repl(m));
    p = f;
  }
  return out + s.slice(p);
}
