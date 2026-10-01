// Content probes: what browsers, search crawlers and AI crawlers actually receive (redirects followed).
const d = $('Check Crawl').first().json;
const domain = d.domain;
const home = 'https://' + domain + '/';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const probes = [
  { id: 'home_content', url: home,                                ua: CHROME, accept: 'text/html' },
  { id: 'home_repeat',  url: home,                                ua: CHROME, accept: 'text/html' },
  { id: 'robots',       url: 'https://' + domain + '/robots.txt',  ua: CHROME, accept: 'text/plain' },
  { id: 'sitemap',      url: 'https://' + domain + '/sitemap.xml', ua: CHROME, accept: 'application/xml' },
  { id: 'llms',         url: 'https://' + domain + '/llms.txt',    ua: CHROME, accept: 'text/plain' },
  { id: 'markdown',     url: home,                                ua: CHROME, accept: 'text/markdown' }
];
const BOTS = {
  'GPTBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'ClaudeBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'PerplexityBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'CCBot': 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Amazonbot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',
  'Applebot': 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
  'Meta-ExternalAgent': 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
};
for (const [name, ua] of Object.entries(BOTS)) probes.push({ id: 'bot:' + name, url: home, ua, accept: 'text/html' });
return probes.map(p => ({ json: p }));