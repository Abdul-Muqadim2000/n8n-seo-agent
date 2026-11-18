// CR17 CodeQL fixes (PR #71, js/polynomial-redos): every pattern that backtracked on a crafted input was replaced by a one-pass reader.
// Each test runs the OLD pattern and the new reader on the same cases (the shapes the rules see plus a seeded random corpus of the
// characters that matter) and asks for the same answer, then times the input that made the old pattern slow (well under 50 ms now).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { clientText, providerErrorText } from './client-copy';
import { legalUrl } from './legal';
import { cutAtFirst, replaceSpaced, trimEndMatching } from './linear-text';
import { JOB_HOST_NAMES, isJobHost, junkLinkSite, nameBeforeLetters } from './link-status';
import { pageKey } from './recommendation-rules';

let seed = 20261118;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const corpus = (alphabet: string[], n: number, maxLen = 24) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let s = '';
    const len = Math.floor(rnd() * maxLen);
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    out.push(s);
  }
  return out;
};
const ms = (f: () => unknown) => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
};
const N = 50_000;

describe('trimEndMatching = s.replace(/[class]+$/, "")', () => {
  const cases = [...corpus(['/', 'a', ' ', ':', ',', '-', '\n', '.'], 4000), '', '/', '///', 'https://a.com///', 'a/b/', ' : - ,', 'label: ', 'x\n'];
  it('the same as the old pattern', () => {
    for (const s of cases) {
      expect(trimEndMatching(s, /\//)).toBe(s.replace(/\/+$/, ''));
      expect(trimEndMatching(s, /[\s:,-]/)).toBe(s.replace(/[\s:,-]+$/, ''));
    }
  });
  it('a long run that does not end the text is read once', () => {
    expect(ms(() => trimEndMatching('/'.repeat(N) + 'x', /\//))).toBeLessThan(50);
    expect(ms(() => trimEndMatching(' :'.repeat(N) + 'x', /[\s:,-]/))).toBeLessThan(50);
  });
});

describe('cutAtFirst = s.replace(/[class].*$/, "")', () => {
  const cases = [...corpus(['/', '?', '#', ':', 'a', '.', '\n', '\r', ' ', ' '], 6000), 'a.com/x?y#z', 'a.com', 'a.com/x\ny', '#\n#', '\n', 'a:80/x'];
  it('the same as the old pattern, line breaks included', () => {
    for (const s of cases) {
      expect(cutAtFirst(s, /[/?#]/)).toBe(s.replace(/[/?#].*$/, ''));
      expect(cutAtFirst(s, /[?#]/)).toBe(s.replace(/[?#].*$/, ''));
      expect(cutAtFirst(s, /[/?#:]/)).toBe(s.replace(/[/?#:].*$/, ''));
    }
  });
  it('"####...\\n" is read once', () => {
    expect(ms(() => cutAtFirst('#'.repeat(N) + '\nx', /[/?#]/))).toBeLessThan(50);
  });
});

describe('replaceSpaced = s.replace(/\\s{before}CORE\\s{after}/g, repl)', () => {
  // every pattern of clientText that takes spaces around a mark, with the old pattern next to it
  const pairs: [string, (s: string) => string, (s: string) => string][] = [
    ['lever code', (s) => s.replace(/\s*\((?:L(?:0[1-9]|1[0-7]))\)/g, ''), (s) => replaceSpaced(s, /\((?:L(?:0[1-9]|1[0-7]))\)/g, '*', '', '')],
    ['arrow', (s) => s.replace(/\s*→\s*/g, ', then '), (s) => replaceSpaced(s, /→/g, '*', '*', ', then ')],
    ['spaced dash', (s) => s.replace(/\s+[—–]\s+/g, ': '), (s) => replaceSpaced(s, /[—–]/g, '+', '+', ': ')],
    ['ellipsis', (s) => s.replace(/\s*(?:…|\.\.\.)\s*/g, ' '), (s) => replaceSpaced(s, /…|\.\.\./g, '*', '*', ' ')],
    ['space before a mark', (s) => s.replace(/\s+([,.;:])/g, '$1'), (s) => replaceSpaced(s, /[,.;:]/g, '+', '', (m) => m[0])],
  ];
  const cases = [
    ...corpus([' ', '  ', '\t', '\n', '→', '—', '–', '…', '.', '..', ',', ';', ':', '(L08)', '(L1', '(L18)', 'a', 'b ', 'L08', '('], 8000, 30),
    'AI ranking placement (L08) → then send',
    'a — b – c—d',
    'a - - b',
    'wait ... then … go',
    'one , two ; three .',
    '',
  ];
  for (const [name, old, now] of pairs)
    it(`${name}: the same as the old pattern`, () => {
      for (const s of cases) expect(now(s), JSON.stringify(s)).toBe(old(s));
    });
  it('a long run of spaces with no mark after it is read once', () => {
    const spaces = 'a' + ' '.repeat(N) + 'x';
    for (const [, , now] of pairs) expect(ms(() => now(spaces))).toBeLessThan(50);
  });
  it('refuses a core that is not global (it would read one match only)', () => {
    expect(() => replaceSpaced('a', /a/, '*', '', '')).toThrow();
  });
});

describe('the client-copy rules on the crafted inputs', () => {
  it('clientText keeps its answers', () => {
    // the answers the old chain of patterns gave (recorded from the code before this change)
    expect(clientText('AI ranking placement (L08) → send it — today ...')).toBe('Found by AI ranking: AI answers cite this page');
    expect(clientText('AI ranking (L03): do x (L05)  →  y … z')).toBe('do x, then y z');
    expect(clientText('a — b – c—d')).toBe('a: b: c-d');
    expect(clientText('Write the page (L04) → publish it ; then check')).toBe('Write the page, then publish it; then check');
    expect(clientText('a  ,  b')).toBe('a, b');
  });
  it('a long run of spaces is read once', () => {
    expect(ms(() => clientText('a' + ' '.repeat(N) + 'x'))).toBeLessThan(50);
    expect(ms(() => clientText('a' + ' '.repeat(N) + '(L0'))).toBeLessThan(50);
    expect(ms(() => providerErrorText('ideas' + ' :'.repeat(N) + 'x 500 - {"a":1}'))).toBeLessThan(50);
  });
  it('providerErrorText keeps its label', () => {
    expect(providerErrorText('keyword ideas for 20 seeds: 500 - {"version":"0.1"}')).toBe('keyword ideas for 20 seeds: could not be read this time (the data provider had an error), so the research used the other sources');
  });
});

describe('addresses: legalUrl and pageKey', () => {
  it('the same answers', () => {
    expect(legalUrl('https://app.alaventra.com///', 'privacy')).toBe('https://app.alaventra.com/privacy');
    expect(legalUrl('https://app.alaventra.com', 'terms')).toBe('https://app.alaventra.com/terms');
    expect(pageKey('https://www.Example.com/a/b///?x=1')).toBe('example.com/a/b');
    expect(pageKey('example.com/')).toBe('example.com');
  });
  it('many slashes before the end are read once', () => {
    expect(ms(() => legalUrl('https://a.com' + '/'.repeat(N) + 'x', 'terms'))).toBeLessThan(50);
    expect(ms(() => pageKey('https://a.com' + '/'.repeat(N) + 'x'))).toBeLessThan(50);
  });
});

describe('link-status: the job, LinkedIn and Pinterest hosts read label by label', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const kit = readFileSync(join(here, '../../../n8n/seo-agent/v5/code/_link_kit.js'), 'utf8');
  const engineJob = /const JOB_HOST = \/(.+)\/;\n/.exec(kit)![1];
  const ENGINE_JOB_HOST = new RegExp(engineJob);
  const oldOf = (names: ReadonlySet<string>) => new RegExp(`(^|\\.)(${[...names].join('|')})\\.[a-z.]+$`);
  const names = [...JOB_HOST_NAMES, 'linkedin', 'pinterest', 'jobs', 'careers'];
  const hosts = [
    ...corpus([...names, '.', '.', 'com', 'ae', 'co.uk', 'x', '-', '1', 'www.', ':'], 20000, 8),
    'indeed.com', 'uk.indeed.com', 'indeed.', 'indeed..com', 'my-indeed.com', 'seek.1.adzuna.com', 'jobs.acme.com', 'careers.acme-1.co.uk', 'linkedin.com', 'pinterest.co.uk',
  ];
  it('the same answer as the patterns they replace (and as the engine)', () => {
    for (const h of hosts) {
      expect(isJobHost(h), h).toBe(ENGINE_JOB_HOST.test(h));
      expect(nameBeforeLetters(h, new Set(['linkedin'])), h).toBe(/(^|\.)linkedin\.[a-z.]+$/.test(h));
      expect(nameBeforeLetters(h, new Set(['pinterest'])), h).toBe(oldOf(new Set(['pinterest'])).test(h));
    }
  });
  it('junkLinkSite keeps its answers and reads a crafted host once', () => {
    expect(junkLinkSite({ url: 'https://uk.indeed.com/viewjob?x=1' })).toBe('a job listing');
    expect(junkLinkSite({ url: 'https://www.linkedin.com/in/someone' })).toBe('a profile');
    expect(junkLinkSite({ url: 'https://pinterest.co.uk/someone/' })).toBe('a profile');
    expect(junkLinkSite({ url: 'https://acme.com/blog/post' })).toBe('');
    expect(ms(() => junkLinkSite({ url: 'https://seek.' + '.adzuna'.repeat(N) + '!' }))).toBeLessThan(50);
    expect(ms(() => junkLinkSite({ url: 'https://linkedin.' + '.linkedin'.repeat(N) + '!' }))).toBeLessThan(50);
    expect(ms(() => junkLinkSite({ url: '#'.repeat(N) + '\nx' }))).toBeLessThan(50);
    expect(ms(() => junkLinkSite({ url: 'https://a.com/' + '#'.repeat(N) + '\nx' }))).toBeLessThan(50);
  });
});
