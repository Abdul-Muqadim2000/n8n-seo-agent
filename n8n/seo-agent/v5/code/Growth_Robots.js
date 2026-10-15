// B9-3 (2026-10-15, benchmark area 9; INVARIANTS rules 1-3): what the AI search fetchers are actually allowed to read.
// Until this ran, AI readiness was measured with a browser User-Agent and robots.txt was never consulted on this path, so a page
// the fetchers are forbidden to read could still be scored "90/100 — AI can read and quote it", and a page nobody may crawl could
// still be sent to Bing and IndexNow. Google's documented matching rules: the most specific matching group wins, then the longest
// matching rule, and Allow wins a tie. The same evaluation the AI Visibility Tracker runs on the homepage (v5/code/AI_Access.js),
// here per key page and per page about to be submitted — the two must agree, and the duplication is registered as B9-8.
// A robots.txt that could not be read is reported as NOT CHECKED: it is never read as "allowed" and never as "blocked".
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = [];
try { reqs = $('Robots Requests (Growth)').all().map(i => i.json); res = $('Fetch Robots (Growth)').all().map(i => i.json); } catch (e) {}
// the fetchers that decide whether an assistant can read and cite a page (the AI Visibility Tracker's "answer" group)
const BOTS = [{ bot: 'OAI-SearchBot', owner: 'ChatGPT search' }, { bot: 'ChatGPT-User', owner: 'ChatGPT (when a user opens a page)' }, { bot: 'PerplexityBot', owner: 'Perplexity' },
  { bot: 'Claude-SearchBot', owner: 'Claude search' }, { bot: 'Googlebot', owner: 'Google Search, AI Overviews and AI Mode' }, { bot: 'Bingbot', owner: 'Bing and Microsoft Copilot' }];
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const pathOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : '/'; };
function parseRobots(txt) {
  const groups = []; let cur = null, lastWasRule = false;
  for (const raw of String(txt || '').split(/\r?\n/)) { const line = raw.replace(/#.*$/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!cur || lastWasRule) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasRule = false; }
    else if ((k === 'allow' || k === 'disallow') && cur) { if (v || k === 'allow') cur.rules.push({ allow: k === 'allow', path: v }); lastWasRule = true; } }
  return groups;
}
const rulesFor = (groups, bot) => { const b = bot.toLowerCase(); const fit = (g) => Math.max(0, ...g.agents.filter(a => a && a !== '*' && (a === b || b.startsWith(a))).map(a => a.length)); const best = Math.max(0, ...groups.map(fit));
  const own = best ? groups.filter(g => fit(g) === best) : []; return own.length ? own.flatMap(g => g.rules) : groups.filter(g => g.agents.includes('*')).flatMap(g => g.rules); };
const matches = (pattern, path) => { if (!pattern) return false; const end = pattern.endsWith('$'); const body = (end ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'); return new RegExp('^' + body + (end ? '$' : '')).test(path); };
const allowed = (rules, path) => { let best = null; for (const r of rules) { if (!r.path || !matches(r.path, path)) continue; const len = r.path.length;
  if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { len, allow: r.allow, path: r.path }; } return best ? { ok: best.allow, rule: (best.allow ? 'Allow: ' : 'Disallow: ') + best.path } : { ok: true, rule: '' }; };
const out = [];
for (const p of plans) {
  const i = reqs.findIndex(q => q && q.site_id === p.site_id);
  const r = i >= 0 ? (res[i] || {}) : {};
  const status = Number(r.statusCode) || 0; const body = String(r.body ?? r.data ?? '');
  const looksHtml = /<html|<!doctype/i.test(body.slice(0, 500));
  const found = status >= 200 && status < 300 && !looksHtml && /(^|\n)\s*(user-agent|sitemap)\s*:/i.test(body);
  // INVARIANTS rule 3: a call that failed marks its evidence unavailable. A 404 is an answer (no rules at all); a 5xx, a timeout or
  // an HTML error page is not, and nothing downstream may read it either way round.
  const gone = status === 404 || status === 410;
  const unavailable = !found && !gone;
  const reason = unavailable ? (i < 0 ? 'robots.txt was not fetched this run' : status ? 'robots.txt answered ' + status + (looksHtml ? ' with an HTML page' : '') : 'robots.txt could not be fetched (no answer)') : '';
  const groups = found ? parseRobots(body) : [];
  const bots = BOTS.map(b => { const rules = rulesFor(groups, b.bot); const root = allowed(rules, '/'); return { ...b, rules, allowed_root: root.ok, root_rule: root.rule }; });
  const urls = [...new Set([...(p.key_pages || []).map(k => k.url), ...(p.submit || []).map(s => s.url), ...(p.audit || []).map(a => a.url)])].filter(Boolean);
  const verdicts = {};
  for (const u of urls) { const path = pathOf(u); const per = bots.map(b => ({ bot: b.bot, owner: b.owner, ...(found ? allowed(b.rules, path) : { ok: null, rule: '' }) }));
    const blocked = per.filter(x => x.ok === false);
    verdicts[keyOf(u)] = { url: u, path, checked: found, blocked: blocked.map(x => x.bot), blocked_owners: [...new Set(blocked.map(x => x.owner))], rule: (blocked[0] || {}).rule || '',
      blocked_all: found && blocked.length === BOTS.length, allowed_bots: found ? BOTS.length - blocked.length : null, answer_bots: BOTS.length,
      bing_ok: found ? !per.some(x => x.bot === 'Bingbot' && x.ok === false) : true }; }
  const blockedPages = Object.values(verdicts).filter(v => v.blocked.length);
  out.push({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, checked_at: p.checked_at, status, found, unavailable, reason,
    basis: found ? 'measured' : unavailable ? 'not available' : 'measured',   // no robots.txt at all is a measurement too: nothing forbids anything
    note: found ? 'robots.txt read at ' + (reqs[i] || {}).url : gone ? 'no robots.txt on the site (' + status + '): no rule forbids any AI fetcher' : reason,
    bots: bots.map(({ rules, ...b }) => b), verdicts, blocked_pages: blockedPages.map(v => ({ url: v.url, bots: v.blocked, owners: v.blocked_owners, rule: v.rule, all: v.blocked_all })) } });
}
return out.length ? out : [{ json: { skip: true } }];
