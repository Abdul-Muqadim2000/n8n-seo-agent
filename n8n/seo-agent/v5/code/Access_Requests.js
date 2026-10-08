// AI crawler access (v4.9; free): an answer can only cite a page its engine is allowed to fetch. Per site: robots.txt, llms.txt, and the homepage
// fetched once as a browser and once as each AI search fetcher (ChatGPT's OAI-SearchBot and ChatGPT-User, PerplexityBot, Claude-SearchBot), to
// spot a firewall or CDN rule (e.g. a "block AI bots" switch) that turns them away. These requests come from this server, not from the bots' own
// addresses, so a block seen here is reported as "possible"; robots.txt rules are exact.
const UA = {
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Claude-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com/claude-searchbot)' };
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const p of plans) {
  const home = 'https://' + p.domain + '/';
  out.push({ json: { site_id: p.site_id, kind: 'robots', bot: 'browser', url: home + 'robots.txt', ua: UA.browser } });
  out.push({ json: { site_id: p.site_id, kind: 'llms', bot: 'browser', url: home + 'llms.txt', ua: UA.browser } });
  for (const [bot, ua] of Object.entries(UA)) out.push({ json: { site_id: p.site_id, kind: 'home', bot, url: home, ua } });
}
return out.length ? out : [{ json: { skip: true } }];
