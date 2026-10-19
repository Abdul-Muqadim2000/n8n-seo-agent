import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { estimateRunCost, keyCost } from './cost';
import { verifyLockedDescription, verifyMethods, verifyMethodsShort } from '../../web/src/lib/verify-copy';

// Source guards for the app's copy (R97 / R98 / R99 / R109). They read the web and shared source, not a rendered page.
const here = new URL('.', import.meta.url).pathname;
const WEB = join(here, '..', '..', 'web', 'src');
const SHARED = here;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !/\.fixture\./.test(n)) out.push(p);
  }
  return out;
}
/** the code without comments (a price or an example inside a comment never reaches a customer) */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const appFiles = [...walk(join(WEB, 'pages')), ...walk(join(WEB, 'components'))].filter((p) => !p.includes('/marketing/'));

describe('no per-mode price is typed into a component (R99)', () => {
  it('no "$<digits>.<digits>" literal in web pages / components', () => {
    const bad: string[] = [];
    for (const f of appFiles) {
      const c = code(readFileSync(f, 'utf8'));
      c.split('\n').forEach((line, i) => {
        if (/\$[0-9]+\.[0-9]+/.test(line)) bad.push(`${relative(WEB, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it('a ladder started with one page costs the plan plus one page: the hero and the option badges add up', () => {
    expect(estimateRunCost('ladder', { pagesNow: 1 })).toBeCloseTo(keyCost('ladder') + keyCost('content'), 3);
    expect(estimateRunCost('ladder', { pagesNow: 3 })).toBeCloseTo(keyCost('ladder') + 3 * keyCost('content'), 3);
  });
});

describe('no other customer\'s identifiers as examples (R109)', () => {
  // ProfileForm.tsx and pages/site/_components/ai.tsx are in another agent's wave: listed so the guard shrinks, never grows
  const PENDING = new Set<string>([]);
  it('no 543096312 / techand / e-invoicing example in the app or the guides', () => {
    const bad: string[] = [];
    for (const f of [...appFiles, join(SHARED, 'guides.ts')]) {
      const rel = relative(f.startsWith(SHARED) ? SHARED : WEB, f);
      if (PENDING.has(rel)) continue;
      const c = code(readFileSync(f, 'utf8'));
      if (/543096312|techand|e[ -]invoicing/i.test(c)) bad.push(rel);
    }
    expect(bad).toEqual([]);
  });
});

describe('ownership-proof copy follows what the panel offers (R97 / R98)', () => {
  it('without Google OAuth: DNS or meta tag only, never the service account or Search Console', () => {
    for (const t of [verifyMethods(false), verifyMethodsShort(false), verifyLockedDescription(false)]) {
      expect(t).toMatch(/DNS record/);
      expect(t).not.toMatch(/service account/i);
      expect(t).not.toMatch(/Google account|Verify with Google/);
    }
    expect(verifyMethods(false)).not.toMatch(/Search Console/);
  });
  it('with Google OAuth: the Google account is named, as the owner of the property', () => {
    expect(verifyMethods(true)).toMatch(/Google account/);
    expect(verifyMethods(true)).toMatch(/DNS record/);
    expect(verifyLockedDescription(true)).not.toMatch(/service account/i);
  });
  it('no component or page types the "Search Console, a DNS record" proof list', () => {
    const bad = appFiles.filter((f) => /Search Console, (a )?DNS/i.test(code(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f));
    expect(bad).toEqual([]);
  });
});

// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §2.2 item 10, §13): every website has its own weekday now, so no customer-facing string of the
// shared code or the server may promise "Monday". Only string literals are read (comments are code, not copy), with the TypeScript parser
// so a quote inside a template or an apostrophe never confuses it. Allowed: a weekday name on its own (a list of the seven days, a
// company's digest day), and the mailbox sending window ("Monday to Friday": the hours a mailbox may send outreach). Since A2 (2026-10-20)
// it reads the web app and the business site too: every screen names the website's own weekday or says "each week".
describe('no fixed Monday in customer copy (shared, server, web app and business site)', () => {
  const SERVER = join(here, '..', '..', 'server', 'src');
  // files allowed to break the rule for now: it only shrinks (empty since the web wave of 2026-10-20)
  const PENDING = new Set<string>([]);
  const ALLOWED = (t: string) => /^(Monday|Mondays)$/.test(t.trim()) || /Monday\s*(to|-|until)\s*Friday/i.test(t);
  const literals = (file: string): { text: string; line: number }[] => {
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const out: { text: string; line: number }[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push({ text: n.text, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      else if (ts.isTemplateExpression(n)) {
        out.push({ text: n.head.text, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
        for (const sp of n.templateSpans) out.push({ text: sp.literal.text, line: src.getLineAndCharacterOfPosition(sp.getStart()).line + 1 });
      } else if (ts.isJsxText(n)) out.push({ text: n.text, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      ts.forEachChild(n, visit);
    };
    visit(src);
    return out;
  };
  const files = [
    ...walk(SHARED).map((f) => ['shared/' + relative(SHARED, f), f]),
    ...walk(SERVER).map((f) => ['server/' + relative(SERVER, f), f]),
    ...walk(WEB).map((f) => ['web/' + relative(WEB, f), f]),
  ] as [string, string][];
  it('reads the web app and the business site (pages, components, marketing)', () => {
    const rels = files.map(([r]) => r);
    expect(rels.some((r) => r.startsWith('web/pages/'))).toBe(true);
    expect(rels.some((r) => r.startsWith('web/components/'))).toBe(true);
    expect(rels.some((r) => r.startsWith('web/marketing/'))).toBe(true);
    // JSX text is judged too (a sentence between tags, not only string literals)
    expect(literals(join(WEB, 'pages', 'site', 'PipelinePage.tsx')).some((x) => /Pipeline/.test(x.text))).toBe(true);
  });
  it('finds the strings it is meant to judge (the scanner itself works)', () => {
    const own = literals(join(SHARED, 'cycle-clock.ts')).map((x) => x.text);
    expect(own).toContain('Monday');
    expect(ALLOWED('Monday')).toBe(true);
    expect(ALLOWED('Send it every Monday')).toBe(false);
    expect(ALLOWED('Monday to Friday, 09:00-17:00')).toBe(true);
  });
  it('no string literal promises Monday', () => {
    const bad: string[] = [];
    for (const [rel, f] of files) {
      if (PENDING.has(rel)) continue;
      for (const l of literals(f)) if (/\bMondays?\b/.test(l.text) && !ALLOWED(l.text)) bad.push(`${rel}:${l.line}: ${l.text.trim().slice(0, 100)}`);
    }
    expect(bad).toEqual([]);
  });
  it('the pending list only shrinks: every file on it still exists', () => {
    for (const rel of PENDING) expect(files.some(([r]) => r === rel)).toBe(true);
  });
});
