// The engine's one robots.txt matcher (n8n/seo-agent/v5/code/_ai_access_kit.js, B9-9), ported line for line so the app's own check of a
// site task (site-tasks.ts) and the engine's weekly crawler-access reading can never give two answers for one robots.txt. Google's
// documented rules: the most specific matching group wins (several groups for the same agent are merged), then the longest matching
// rule, and Allow wins a tie; `*` matches any run and `$` anchors the end. robots.test.ts runs the same cases against both copies.

export interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasRule = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || lastWasRule) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasRule = false;
    } else if ((k === 'allow' || k === 'disallow') && cur) {
      if (v || k === 'allow') cur.rules.push({ allow: k === 'allow', path: v });
      lastWasRule = true;
    }
  }
  return groups;
}

/** The most specific matching group(s) for the bot, else the `*` groups; `group` says which one decided. */
export function robotsRulesFor(groups: RobotsGroup[], bot: string): { rules: RobotsGroup['rules']; group: string } {
  const b = String(bot).toLowerCase();
  const fit = (g: RobotsGroup) => Math.max(0, ...g.agents.filter((a) => a && a !== '*' && (a === b || b.startsWith(a))).map((a) => a.length));
  const best = Math.max(0, ...groups.map(fit));
  const own = best ? groups.filter((g) => fit(g) === best) : [];
  return own.length ? { rules: own.flatMap((g) => g.rules), group: bot } : { rules: groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules), group: '*' };
}

/**
 * The engine builds a regex from the rule (`*` -> `.*`, `$` anchors the end); the same answers here without a regex, because a client's
 * robots.txt (`/*a*a*a*b`) must never be able to stall the server with backtracking. Greedy wildcard matching: linear in practice,
 * at worst pattern x path steps.
 */
export function robotsPatternMatches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const end = pattern.endsWith('$');
  const p = end ? pattern.slice(0, -1) : pattern;
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (j < path.length) {
    if (i < p.length && p[i] !== '*' && p[i] === path[j]) {
      i++;
      j++;
    } else if (i < p.length && p[i] === '*') {
      star = i++;
      mark = j;
    } else if (i === p.length && !end) {
      return true; // the rule is a prefix of the path
    } else if (star >= 0) {
      i = star + 1;
      j = ++mark;
    } else return false;
  }
  while (i < p.length && p[i] === '*') i++;
  return i === p.length;
}

export function robotsAllowed(rules: RobotsGroup['rules'], path: string): { ok: boolean; rule: string } {
  let best: { len: number; allow: boolean; path: string } | null = null;
  for (const r of rules) {
    if (!r.path || !robotsPatternMatches(r.path, path)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow, path: r.path };
  }
  return best ? { ok: best.allow, rule: (best.allow ? 'Allow: ' : 'Disallow: ') + best.path } : { ok: true, rule: '' };
}

/**
 * The AI answer crawlers the engine reads (v5/code/AI_Access.js `BOTS`, group `answer`): they decide whether an assistant can read and
 * cite a page. Training crawlers are the owner's own choice and never a site task.
 */
export const AI_ANSWER_BOTS: readonly { bot: string; owner: string }[] = [
  { bot: 'OAI-SearchBot', owner: 'ChatGPT search' },
  { bot: 'ChatGPT-User', owner: 'ChatGPT (when a user asks it to open a page)' },
  { bot: 'PerplexityBot', owner: 'Perplexity' },
  { bot: 'Perplexity-User', owner: 'Perplexity (user fetch)' },
  { bot: 'Claude-SearchBot', owner: 'Claude search' },
  { bot: 'Claude-User', owner: 'Claude (user fetch)' },
  { bot: 'Googlebot', owner: 'Google Search, AI Overviews and AI Mode' },
  { bot: 'Bingbot', owner: 'Bing and Microsoft Copilot' },
];

/** Which of `bots` robots.txt still keeps from any of `paths` ('/' always included), with the rule that does it. */
export function robotsBlocked(robotsTxt: string, bots: readonly string[], paths: readonly string[]): { bot: string; path: string; rule: string }[] {
  const groups = parseRobots(robotsTxt);
  const all = [...new Set(['/', ...paths.filter((p) => p.startsWith('/'))])];
  const out: { bot: string; path: string; rule: string }[] = [];
  for (const bot of bots) {
    const R = robotsRulesFor(groups, bot);
    for (const path of all) {
      const a = robotsAllowed(R.rules, path);
      if (!a.ok) out.push({ bot, path, rule: a.rule });
    }
  }
  return out;
}
