// Host probes: raw responses WITHOUT following redirects, to see how apex/www/http resolve.
// Content probes (robots, sitemap, llms.txt, crawler access) live in "Content Probes" and DO follow redirects.
const d = $('Check Crawl').first().json;
const domain = d.domain;
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
return [
  { id: 'home',      url: 'https://' + domain + '/',       ua: CHROME, accept: 'text/html' },
  { id: 'www_https', url: 'https://www.' + domain + '/',   ua: CHROME, accept: 'text/html' },
  { id: 'www_http',  url: 'http://www.' + domain + '/',    ua: CHROME, accept: 'text/html' },
  { id: 'apex_http', url: 'http://' + domain + '/',        ua: CHROME, accept: 'text/html' }
].map(p => ({ json: p }));