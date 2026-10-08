// AI crawler access per site (v4.9): robots.txt evaluated for every AI crawler on the homepage and the key pages (longest matching rule wins, Allow
// wins a tie, `*` and `$` patterns, groups for the same agent merged — Google's documented rules), llms.txt, and the homepage as a browser vs as each
// AI search fetcher. Answer crawlers (they decide whether an assistant can read and cite a page) are separated from training crawlers (the owner's
// choice; blocking them does not remove a site from AI answers). Issues come with the fix.
const reqs = $('Access Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const BOTS = [
  { bot: 'OAI-SearchBot', owner: 'ChatGPT search', group: 'answer' }, { bot: 'ChatGPT-User', owner: 'ChatGPT (when a user asks it to open a page)', group: 'answer' },
  { bot: 'PerplexityBot', owner: 'Perplexity', group: 'answer' }, { bot: 'Perplexity-User', owner: 'Perplexity (user fetch)', group: 'answer' },
  { bot: 'Claude-SearchBot', owner: 'Claude search', group: 'answer' }, { bot: 'Claude-User', owner: 'Claude (user fetch)', group: 'answer' },
  { bot: 'Googlebot', owner: 'Google Search, AI Overviews and AI Mode', group: 'answer' }, { bot: 'Bingbot', owner: 'Bing and Microsoft Copilot', group: 'answer' },
  { bot: 'GPTBot', owner: 'OpenAI model training', group: 'training' }, { bot: 'ClaudeBot', owner: 'Anthropic model training', group: 'training' },
  { bot: 'Google-Extended', owner: 'Gemini training and grounding', group: 'training' }, { bot: 'Applebot-Extended', owner: 'Apple Intelligence training', group: 'training' },
  { bot: 'CCBot', owner: 'Common Crawl (used to train many models)', group: 'training' }, { bot: 'Meta-ExternalAgent', owner: 'Meta AI training', group: 'training' } ];
const bodyOf = (r) => { const b = r.body != null ? r.body : r.data; return typeof b === 'string' ? b : (b == null ? '' : JSON.stringify(b)); };
const statusOf = (r) => Number(r.statusCode || r.status || (r.error ? (r.error.httpCode || (r.error.status) || 0) : 0)) || (r.error ? 0 : 200);
const hdr = (r, k) => { const h = r.headers || {}; const key = Object.keys(h).find(x => x.toLowerCase() === k); return key ? String(h[key]) : ''; };
function parseRobots(txt) {
  const groups = []; let cur = null, lastWasRule = false;
  for (const raw of String(txt || '').split(/\r?\n/)) { const line = raw.replace(/#.*$/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!cur || lastWasRule) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasRule = false; }
    else if ((k === 'allow' || k === 'disallow') && cur) { if (v || k === 'allow') cur.rules.push({ allow: k === 'allow', path: v }); lastWasRule = true; } }
  return groups;
}
const rulesFor = (groups, bot) => { const b = bot.toLowerCase(); const fit = (g) => Math.max(0, ...g.agents.filter(a => a && a !== '*' && (a === b || b.startsWith(a))).map(a => a.length)); const best = Math.max(0, ...groups.map(fit)); const own = best ? groups.filter(g => fit(g) === best) : [];   // the most specific matching group(s)
  return own.length ? { rules: own.flatMap(g => g.rules), group: bot } : { rules: groups.filter(g => g.agents.includes('*')).flatMap(g => g.rules), group: '*' }; };
const matches = (pattern, path) => { if (!pattern) return false; const end = pattern.endsWith('$'); const body = (end ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'); return new RegExp('^' + body + (end ? '$' : '')).test(path); };
const allowed = (rules, path) => { let best = null; for (const r of rules) { if (!r.path) continue; if (!matches(r.path, path)) continue; const len = r.path.length;
  if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow, path: r.path }; } return best ? { ok: best.allow, rule: (best.allow ? 'Allow: ' : 'Disallow: ') + best.path } : { ok: true, rule: '' }; };
const CHALLENGE = /just a moment|cf-chl|challenge-platform|attention required|access denied|captcha|are you a robot|bot detection|request blocked|forbidden/i;
return plans.map(p => {
  const mine = reqs.map((q, i) => ({ q, r: resps[i] || {} })).filter(x => x.q.site_id === p.site_id);
  const robotsX = mine.find(x => x.q.kind === 'robots'), llmsX = mine.find(x => x.q.kind === 'llms');
  const rStatus = robotsX ? statusOf(robotsX.r) : 0; const rBody = robotsX ? bodyOf(robotsX.r) : '';
  const robotsFound = rStatus >= 200 && rStatus < 300 && !/<html/i.test(rBody.slice(0, 500));
  const groups = robotsFound ? parseRobots(rBody) : [];
  const paths = ['/', ...(p.key_paths || [])];
  const bots = BOTS.map(b => { const R = rulesFor(groups, b.bot); const res = paths.map(path => ({ path, ...allowed(R.rules, path) }));
    return { ...b, group_used: R.group, allowed_root: res[0].ok, rule: res[0].rule, blocked_paths: res.filter(x => !x.ok).map(x => x.path) }; });
  const lStatus = llmsX ? statusOf(llmsX.r) : 0; const lBody = llmsX ? bodyOf(llmsX.r) : '';
  const llms = { found: lStatus >= 200 && lStatus < 300 && lBody.length > 20 && !/<html|<!doctype/i.test(lBody.slice(0, 300)), status: lStatus, size: lBody.length };
  const homes = mine.filter(x => x.q.kind === 'home').map(x => { const st = statusOf(x.r); const body = bodyOf(x.r).slice(0, 4000); const mitigated = hdr(x.r, 'cf-mitigated');
    return { bot: x.q.bot, status: st, challenge: !!mitigated || (st >= 400 && CHALLENGE.test(body)) || (st === 200 && body.length < 4000 && /just a moment|cf-chl|challenge-platform/i.test(body)), bytes: bodyOf(x.r).length }; });
  const browser = homes.find(h => h.bot === 'browser') || { status: 0 };
  const browserOk = browser.status >= 200 && browser.status < 400 && !browser.challenge;
  const tests = homes.filter(h => h.bot !== 'browser').map(h => ({ ...h, blocked: browserOk && (h.status === 0 || h.status >= 400 || h.challenge) }));
  const issues = [];
  for (const b of bots.filter(b => b.group === 'answer')) {
    if (!b.allowed_root) issues.push({ level: b.bot === 'Googlebot' ? 'critical' : 'high', bot: b.bot, text: 'robots.txt blocks ' + b.bot + ' (' + b.owner + ') from the whole site (' + b.rule + ').', fix: 'Remove that rule from robots.txt or add "User-agent: ' + b.bot + '" with "Allow: /". The fix pack of the monthly audit contains a corrected robots.txt.' });
    else if (b.blocked_paths.length) issues.push({ level: 'medium', bot: b.bot, text: 'robots.txt blocks ' + b.bot + ' from ' + b.blocked_paths.length + ' key page(s): ' + b.blocked_paths.slice(0, 3).join(', ') + '.', fix: 'Allow these paths for ' + b.bot + ' so ' + b.owner + ' can read and cite them.' });
  }
  const blocked = tests.filter(t => t.blocked);
  if (blocked.length) issues.push({ level: 'high', bot: blocked.map(t => t.bot).join(', '), text: 'The homepage answers ' + browser.status + ' to a browser but ' + blocked.map(t => t.bot + ' ' + (t.challenge ? 'a bot challenge' : t.status || 'no answer')).join(', ') + ': a firewall or CDN rule may turn AI search fetchers away (possible: this test runs from our server, not from the bots\' addresses).', fix: 'Check the CDN / firewall bot settings (e.g. Cloudflare "Block AI bots" or "AI Crawl Control"): allow the verified AI search bots OAI-SearchBot, ChatGPT-User, PerplexityBot and Claude-SearchBot; you can keep training crawlers blocked.' });
  if (!robotsFound && rStatus >= 500) issues.push({ level: 'high', bot: '*', text: 'robots.txt answers ' + rStatus + ': crawlers treat a server error as "do not crawl".', fix: 'Make /robots.txt answer 200 (or 404 when there are no rules).' });
  if (!llms.found) issues.push({ level: 'low', bot: '*', text: 'No llms.txt: optional, but it gives AI tools a clean map of your key pages.', fix: 'Publish the llms.txt from the monthly audit\'s fix pack at /llms.txt.' });
  const answerBots = bots.filter(b => b.group === 'answer'), trainingBlocked = bots.filter(b => b.group === 'training' && !b.allowed_root).map(b => b.bot);
  return { json: { site_id: p.site_id, domain: p.domain, checked_at: p.checked_at, robots: { found: robotsFound, status: rStatus }, llms_txt: llms, bots, fetch: { browser: browser.status, tests }, training_blocked: trainingBlocked,
    answer_bots_ok: answerBots.filter(b => b.allowed_root && !b.blocked_paths.length).length, answer_bots: answerBots.length, issues,
    ok: !issues.some(i => i.level === 'critical' || i.level === 'high') } };
});
