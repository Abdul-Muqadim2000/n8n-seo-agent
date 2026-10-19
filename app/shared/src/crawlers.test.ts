import { describe, expect, it } from 'vitest';
import { BOTS, classifyUserAgent, hostIsSite, pathKey, pathKind, RANGE_SOURCES, splitTarget, verifyMethod } from './crawlers';

// The crawler registry and the pure path rules of the Crawlers page (app/docs/LOG_ANALYTICS.md). The user agents are the vendors'
// own published strings.

const UA = {
  googlebotDesktop: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.6723.116 Safari/537.36',
  googlebotSmartphone: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotImage: 'Googlebot-Image/1.0',
  inspection: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
  googleOther: 'GoogleOther',
  googleAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/141.0.7390.122 Safari/537.36',
  bing: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  oaiSearch: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot',
  chatgptUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  claudeUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  claudeSearch: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
  perplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  perplexityUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  metaAgent: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  metaFetcher: 'meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  bytespider: 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  amazonbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36',
  ccbot: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  ahrefs: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  someBot: 'Mozilla/5.0 (compatible; Barkrowler/0.9; +https://babbar.tech/crawler) examplebot/1.0',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  cubot: 'Mozilla/5.0 (Linux; Android 13; CUBOT P80) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
};

describe('classifyUserAgent', () => {
  it.each([
    ['googlebotDesktop', 'googlebot'],
    ['googlebotSmartphone', 'googlebot'],
    ['googlebotImage', 'googlebot'],
    ['inspection', 'google-inspectiontool'],
    ['googleOther', 'googleother'],
    ['googleAgent', 'google-agent'],
    ['bing', 'bingbot'],
    ['applebot', 'applebot'],
    ['gptbot', 'gptbot'],
    ['oaiSearch', 'oai-searchbot'],
    ['chatgptUser', 'chatgpt-user'],
    ['claudebot', 'claudebot'],
    ['claudeUser', 'claude-user'],
    ['claudeSearch', 'claude-searchbot'],
    ['perplexityBot', 'perplexitybot'],
    ['perplexityUser', 'perplexity-user'],
    ['metaAgent', 'meta-externalagent'],
    ['metaFetcher', 'meta-externalfetcher'],
    ['bytespider', 'bytespider'],
    ['amazonbot', 'amazonbot'],
    ['ccbot', 'ccbot'],
    ['ahrefs', 'ahrefsbot'],
    ['someBot', 'other-bot'],
  ] as const)('%s gives %s', (k, key) => {
    expect(classifyUserAgent(UA[k])?.key).toBe(key);
  });
  it('a person (Chrome, Safari on iPhone, a Cubot phone, no user agent) is no crawler', () => {
    for (const ua of [UA.chrome, UA.iphone, UA.cubot, '', '-', null, undefined]) expect(classifyUserAgent(ua)).toBeNull();
  });
  it('kinds: a fetch for a person is ai_user, training is ai_training, AI search is ai_search', () => {
    expect(classifyUserAgent(UA.chatgptUser)?.kind).toBe('ai_user');
    expect(classifyUserAgent(UA.perplexityUser)?.kind).toBe('ai_user');
    expect(classifyUserAgent(UA.gptbot)?.kind).toBe('ai_training');
    expect(classifyUserAgent(UA.oaiSearch)?.kind).toBe('ai_search');
    expect(classifyUserAgent(UA.googlebotDesktop)?.kind).toBe('search');
  });
});

describe('the registry', () => {
  it('every list a crawler names exists, every docs link is https, keys are unique', () => {
    const ids = new Set<string>(RANGE_SOURCES.map((s) => s.id));
    const keys = new Set<string>();
    for (const b of BOTS) {
      for (const r of b.ranges ?? []) expect(ids.has(r)).toBe(true);
      expect(b.docs).toMatch(/^https:\/\//);
      expect(keys.has(b.key)).toBe(false);
      keys.add(b.key);
    }
    for (const s of RANGE_SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });
  it('the required crawlers can be proved; the unprovable ones say so', () => {
    const m = (k: string) => verifyMethod(BOTS.find((b) => b.key === k)!);
    expect(m('googlebot')).toBe('ip_list_dns');
    expect(m('bingbot')).toBe('ip_list_dns');
    expect(m('applebot')).toBe('ip_list_dns');
    for (const k of ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user', 'claude-searchbot', 'perplexitybot', 'perplexity-user', 'ccbot']) expect(m(k)).toBe('ip_list');
    expect(m('amazonbot')).toBe('ip_list_dns');
    for (const k of ['meta-externalagent', 'bytespider', 'ahrefsbot']) expect(m(k)).toBe('none');
  });
});

describe('path rules', () => {
  it('splitTarget keeps parameter names only, sorted, never values', () => {
    expect(splitTarget('/blog/e-invoicing-uae?utm_source=x&page=2')).toEqual({ path: '/blog/e-invoicing-uae', queryKeys: 'page,utm_source' });
    expect(splitTarget('https://techand.example/a?b=1#c')).toEqual({ path: '/a', queryKeys: 'b' });
    expect(splitTarget('/a#frag')).toEqual({ path: '/a', queryKeys: '' });
    expect(splitTarget('')).toEqual({ path: '/', queryKeys: '' });
    expect(splitTarget('/x?a=1&a=2&b')).toEqual({ path: '/x', queryKeys: 'a,b' });
  });
  it('pathKey joins a log path and an inventory URL', () => {
    expect(pathKey('https://www.techand.example/Services/AI-Consulting/')).toBe('/services/ai-consulting');
    expect(pathKey('/services/ai-consulting')).toBe('/services/ai-consulting');
    expect(pathKey('/caf%C3%A9')).toBe('/café');
    expect(pathKey('/%E0%A4%A')).toBe('/%e0%a4%a');
    expect(pathKey('https://techand.example')).toBe('/');
    expect(pathKey('/a?b=1')).toBe('/a');
  });
  it('pathKind', () => {
    expect(pathKind('/robots.txt')).toBe('robots');
    expect(pathKind('/sitemap_index.xml')).toBe('sitemap');
    expect(pathKind('/wp-sitemap-posts-post-1.xml')).toBe('sitemap');
    expect(pathKind('/assets/app.3f2a.js')).toBe('asset');
    expect(pathKind('/img/hero.webp')).toBe('asset');
    expect(pathKind('/blog/peppol')).toBe('page');
    expect(pathKind('/')).toBe('page');
  });
  it('hostIsSite: the domain and www only; a host-less line is the site', () => {
    expect(hostIsSite('techand.example', 'techand.example')).toBe(true);
    expect(hostIsSite('WWW.techand.example:443', 'techand.example')).toBe(true);
    expect(hostIsSite(null, 'techand.example')).toBe(true);
    expect(hostIsSite('cdn.othersite.example', 'techand.example')).toBe(false);
    expect(hostIsSite('techand.example.evil.net', 'techand.example')).toBe(false);
    expect(hostIsSite('blog.techand.example', 'techand.example')).toBe(false);
  });
});
