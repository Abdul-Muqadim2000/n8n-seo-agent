// B9-9 (2026-10-17, benchmark area 9): ONE robots.txt matcher. Until now `AI_Access.js` (the AI Visibility Tracker, homepage and key paths) and
// `Growth_Robots.js` (AI Growth, every key page and every page about to be submitted) each carried a copy of the parser, the group selection and
// the longest-rule match, and two copies of a rule is how two answers start. Google's documented rules: the most specific matching group wins
// (several groups for the same agent are merged), then the longest matching rule, and Allow wins a tie; `*` matches any run and `$` anchors the end.
// Inlined into both nodes at build time (build_monitors.py `src()`); build section 123 asserts that neither node defines its own copy.
const AK = (() => {
  const parse = (txt) => {
    const groups = []; let cur = null, lastWasRule = false;
    for (const raw of String(txt || '').split(/\r?\n/)) { const line = raw.replace(/#.*$/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === 'user-agent') { if (!cur || lastWasRule) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasRule = false; }
      else if ((k === 'allow' || k === 'disallow') && cur) { if (v || k === 'allow') cur.rules.push({ allow: k === 'allow', path: v }); lastWasRule = true; } }
    return groups;
  };
  // the most specific matching group(s) for the bot, else the `*` groups; `group` says which one decided
  const rulesFor = (groups, bot) => { const b = String(bot).toLowerCase(); const fit = (g) => Math.max(0, ...g.agents.filter(a => a && a !== '*' && (a === b || b.startsWith(a))).map(a => a.length)); const best = Math.max(0, ...groups.map(fit));
    const own = best ? groups.filter(g => fit(g) === best) : [];
    return own.length ? { rules: own.flatMap(g => g.rules), group: bot } : { rules: groups.filter(g => g.agents.includes('*')).flatMap(g => g.rules), group: '*' }; };
  const matches = (pattern, path) => { if (!pattern) return false; const end = pattern.endsWith('$'); const body = (end ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'); return new RegExp('^' + body + (end ? '$' : '')).test(path); };
  const allowed = (rules, path) => { let best = null; for (const r of rules) { if (!r.path || !matches(r.path, path)) continue; const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow, path: r.path }; }
    return best ? { ok: best.allow, rule: (best.allow ? 'Allow: ' : 'Disallow: ') + best.path } : { ok: true, rule: '' }; };
  return { parse, rulesFor, matches, allowed };
})();
