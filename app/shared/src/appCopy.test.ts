import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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
