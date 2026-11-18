// CR17 CodeQL fixes (PR #71) in the engine's competitor kit (n8n/seo-agent/v5/code/_competitors.js, run here as the app runs it): host
// lists are read label by label instead of patterns built from the names (js/incomplete-sanitization, js/regex/missing-regexp-anchor),
// the title split and the address cut read the text once (js/polynomial-redos). Each test compares the new reader with the OLD pattern on
// the same cases, then times the input that made the old pattern slow.
import { describe, expect, it } from 'vitest';
import { CMP } from './competitor-roles';

// the kit's own object, untyped: the lists and readers below are not part of the app's typed surface
const K = CMP as unknown as {
  ROLE_LISTS: Record<string, { names: string[]; test: (h: string) => boolean }>;
  SOFT_CAT: Record<string, { makers: { names: string[]; test: (h: string) => boolean } }>;
  titleParts: (t: string) => string[];
  host: (h: string) => string;
  kindOfResult: (url: string, title: string, snippet: string) => string;
  kindOfHost: (h: string, own?: string) => string;
  govSignal: (title: string, snippet: string) => boolean;
};

let seed = 1117;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const ms = (f: () => unknown) => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
};
const N = 50_000;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// the pattern every host list was before (SUF of the kit)
const oldList = (names: string[]) => new RegExp(`(^|\\.)(${names.map(esc).join('|')})\\.(?:com|net|org|co|io|ai|info|biz|me|tv|ly|app|fyi|news|[a-z]{2})(?:\\.[a-z]{2})?$`);

const lists = [...Object.entries(K.ROLE_LISTS).map(([k, l]) => [k, l] as const), ...Object.entries(K.SOFT_CAT).map(([k, c]) => [`makers ${k}`, c.makers] as const)];

describe('host lists read label by label', () => {
  const endings = ['com', 'net', 'ae', 'co.uk', 'com.pk', 'news', 'app', 'xyz', 'c', 'com.', 'gov.ae', 'co.u1', 'ae.x', ''];
  const before = ['', 'www.', 'uk.', 'my-', 'a.b.', '.', 'learn.', 'x'];
  it('the same answer as the pattern each list was', () => {
    for (const [k, l] of lists) {
      const old = oldList(l.names);
      const hosts: string[] = [];
      for (const n of l.names) for (const e of endings) for (const b of before) hosts.push(`${b}${n}.${e}`);
      for (let i = 0; i < 3000; i++) hosts.push(`${pick(before)}${pick(l.names)}.${pick(l.names)}.${pick(endings)}`);
      for (const h of hosts) expect(l.test(h), `${k} ${h}`).toBe(old.test(h));
    }
  });
  it('a host of many labels is read once', () => {
    for (const [, l] of lists) expect(ms(() => l.test('a.'.repeat(N) + 'com'))).toBeLessThan(50);
  });
});

describe('the title split and the address cut', () => {
  const OLD_SPLIT = /\s+[|–—:-]\s+|\s*\|\s*/;
  const parts = ['Dubai ', 'Future ', 'Foundation', ' | ', '|', ' - ', '-', ' — ', '–', ':', ' : ', ' ', '  ', '\t', '\n', 'Authority', 'x'];
  const titles = ['Dubai Future Foundation | Home', 'a - - b', 'a | - b', 'x|y', ' | ', '|||', 'a -b', 'a- b', '', '  -  ', 'Ministry of Finance :  UAE'];
  for (let i = 0; i < 20000; i++) titles.push(Array.from({ length: Math.floor(rnd() * 20) }, () => pick(parts)).join(''));
  it('titleParts is split(/\\s+[|\\u2013\\u2014:-]\\s+|\\s*\\|\\s*/)', () => {
    for (const t of titles) expect(K.titleParts(t), JSON.stringify(t)).toEqual(t.split(OLD_SPLIT));
  });
  it('host() cuts the address as /[\\/?#:].*$/ did', () => {
    const old = (h: string) => String(h ?? '').toLowerCase().trim().replace(/^[a-z]+:\/\//, '').replace(/^www\d?\./, '').replace(/[/?#:].*$/, '').replace(/\.$/, '');
    const hs = ['https://www.Acme.com/x?y#z', 'acme.com:8080/p', 'acme.com.', 'a.com/x\ny', 'a#b\nc/d', ' WWW2.acme.ae ', ''];
    for (let i = 0; i < 5000; i++) hs.push(Array.from({ length: Math.floor(rnd() * 16) }, () => pick(['a', '.', '/', '?', '#', ':', '\n', '\r', 'www.', 'http://', ' '])).join(''));
    for (const h of hs) expect(K.host(h), JSON.stringify(h)).toBe(old(h));
  });
  it('the Arabic "best N companies" rule matches what it did', () => {
    const OLD_AR = /(أفضل\s*\d*\s*شركات|قائمة)/;
    for (const t of ['أفضل شركات', 'أفضل 10 شركات', 'أفضل  10  شركات', 'أفضلشركات', 'أفضل10شركات', 'أفضل 1 0 شركات', 'أفضل   ', 'قائمة', 'أفضل \t 5\nشركات'])
      expect(K.kindOfResult('', t, '') === 'list', t).toBe(OLD_AR.test(t));
  });
  it('long runs are read once', () => {
    expect(ms(() => K.govSignal('a' + ' '.repeat(N) + 'x', ''))).toBeLessThan(50);
    expect(ms(() => K.kindOfResult('', 'أفضل' + ' '.repeat(N) + 'x', ''))).toBeLessThan(50);
    expect(ms(() => K.host('#'.repeat(N) + '\nx'))).toBeLessThan(50);
    expect(ms(() => K.kindOfHost('#'.repeat(N) + '\nx.com'))).toBeLessThan(50);
  });
});
