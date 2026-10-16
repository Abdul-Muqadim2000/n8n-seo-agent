// B9-8 (2026-10-17, benchmark area 9): every key page is fetched a second time AS THE AI ANSWER FETCHERS (the same four the AI Visibility Tracker
// sends to the homepage: ChatGPT's OAI-SearchBot and ChatGPT-User, PerplexityBot, Claude-User). robots.txt may allow what a CDN or firewall rule
// ("block AI bots") refuses, and the browser fetch of the readiness step cannot see that. The pages are the customer's own site, so this is a
// plain GET like the browser one. These requests come from this server, not from the bots' own addresses, so a refusal is reported as "possible".
const UA = {
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Claude-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)' };
const reqs = (() => { try { return $('Page Requests (Growth)').all().map(i => i.json).filter(q => q && !q.skip && q.url); } catch (e) { return []; } })();
const out = reqs.flatMap(q => Object.entries(UA).map(([bot, ua]) => ({ json: { site_id: q.site_id, url: q.url, bot, ua } })));
return out.length ? out : [{ json: { skip: true } }];
