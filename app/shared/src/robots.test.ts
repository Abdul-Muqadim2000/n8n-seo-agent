import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRobots, robotsAllowed, robotsBlocked, robotsPatternMatches, robotsRulesFor } from './robots';

// Site tasks (2026-10-28): the app's robots.txt matcher must answer exactly as the engine's (n8n/seo-agent/v5/code/_ai_access_kit.js),
// or the "check now" button and the weekly run would disagree about one file. The kit is evaluated here straight from the engine folder
// and both copies decide every case below. Needs the repo root (CI checks it out whole).

const here = dirname(fileURLToPath(import.meta.url));
const KIT_SRC = readFileSync(join(here, '../../../n8n/seo-agent/v5/code/_ai_access_kit.js'), 'utf8');
type Kit = {
  parse: (t: string) => { agents: string[]; rules: { allow: boolean; path: string }[] }[];
  rulesFor: (g: unknown, bot: string) => { rules: { allow: boolean; path: string }[]; group: string };
  allowed: (rules: unknown, path: string) => { ok: boolean; rule: string };
};
const AK = new Function(`${KIT_SRC}\nreturn AK;`)() as Kit;

const FILES: Record<string, string> = {
  empty: '',
  blockAll: 'User-agent: *\nDisallow: /',
  blockGpt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
  blockSearchBot: 'User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\n',
  allowNamed: 'User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /',
  paths: 'User-agent: *\nDisallow: /private/\nDisallow: /*.pdf$\nAllow: /private/open\n',
  tie: 'User-agent: Claude-SearchBot\nDisallow: /docs\nAllow: /docs\n',
  merged: 'User-agent: Bingbot\nDisallow: /a\n\nUser-agent: Bingbot\nDisallow: /b\n',
  comments: '# hello\nUser-agent: Googlebot # the search one\nDisallow: / # all of it\n',
  prefix: 'User-agent: Claude\nDisallow: /\n',
  emptyDisallow: 'User-agent: *\nDisallow:\n',
  crlf: 'User-agent: ChatGPT-User\r\nDisallow: /\r\n',
  odd: 'user-agent : Bingbot\nDISALLOW:/a#b\n-: x\nuser agent: Googlebot\nDisallow : /c\n: /d\nAllow:\n#User-agent: *\nUser-agent:*\nDisallow: /e # tail\n',
};
const BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Claude-User', 'Googlebot', 'Bingbot', 'GPTBot'];
const PATHS = ['/', '/private/', '/private/open', '/private/x', '/report.pdf', '/report.pdf?x', '/docs', '/a', '/b/c', '/c'];

describe('robots.txt matcher, the engine kit and the app port answer alike', () => {
  for (const [name, txt] of Object.entries(FILES))
    it(`${name}: every bot on every path`, () => {
      const appGroups = parseRobots(txt);
      const kitGroups = AK.parse(txt);
      expect(appGroups).toEqual(kitGroups);
      for (const bot of BOTS) {
        const a = robotsRulesFor(appGroups, bot);
        const k = AK.rulesFor(kitGroups, bot);
        expect(a).toEqual(k);
        for (const path of PATHS) expect(robotsAllowed(a.rules, path)).toEqual(AK.allowed(k.rules, path));
      }
    });
});

describe('robotsBlocked: what a site task reads', () => {
  it('names the bots and the rule still keeping them out', () => {
    expect(robotsBlocked(FILES.blockSearchBot, ['OAI-SearchBot', 'Googlebot'], [])).toEqual([{ bot: 'OAI-SearchBot', path: '/', rule: 'Disallow: /' }]);
  });
  it('a named Allow wins over a restrictive catch-all', () => {
    expect(robotsBlocked(FILES.allowNamed, ['OAI-SearchBot'], ['/pricing'])).toEqual([]);
    expect(robotsBlocked(FILES.allowNamed, ['PerplexityBot'], [])).toEqual([{ bot: 'PerplexityBot', path: '/', rule: 'Disallow: /' }]);
  });
  it('checks the key paths too, and an empty file blocks nothing', () => {
    expect(robotsBlocked(FILES.paths, ['Bingbot'], ['/private/x', '/private/open'])).toEqual([{ bot: 'Bingbot', path: '/private/x', rule: 'Disallow: /private/' }]);
    expect(robotsBlocked('', ['Googlebot'], ['/x'])).toEqual([]);
  });
});

describe('the matcher without backtracking', () => {
  // the engine's own pattern rule (a regex), as the reference
  const KIT = new Function(`${KIT_SRC}\nreturn AK;`)() as { matches: (p: string, path: string) => boolean };
  it('answers like the engine on 4,000 random rules and paths', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[rnd(chars.length)]).join('');
    for (let k = 0; k < 4000; k++) {
      const pattern = '/' + pick('ab*/.', rnd(7)) + (rnd(3) === 0 ? '$' : '');
      const path = '/' + pick('ab/.', rnd(9));
      expect(robotsPatternMatches(pattern, path), `${pattern} on ${path}`).toBe(KIT.matches(pattern, path));
    }
  });
  it('a hostile file cannot stall the reader (many #, "-:" then many spaces)', () => {
    const t0 = Date.now();
    parseRobots('#'.repeat(200000) + '\n' + '-:' + ' '.repeat(200000) + 'x\n' + 'User-agent: *\nDisallow: /' + '/'.repeat(100000));
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it('a hostile rule cannot stall the server', () => {
    const t0 = Date.now();
    expect(robotsPatternMatches('/' + '*a'.repeat(40) + 'b', '/' + 'a'.repeat(20000))).toBe(false);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
