import { z } from 'zod';

/**
 * Gap #6 (2026-10-17, MARKET_BENCHMARK.md §5): server-log and AI-crawler analytics — what search engines and AI fetchers actually
 * request on the customer's site. Design note: `app/docs/LOG_ANALYTICS.md`. This file holds what the server and the web app share:
 * the crawler registry (which user agent is which bot, and how each one can be proved), the published IP-list sources, the limits,
 * the pure path rules, and the answer types of the Crawlers page and `/api/v1/websites/:id/crawlers`.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// 1. The crawlers we recognise, and how each can be proved
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * search      — builds a search index (Googlebot, Bingbot, Applebot)
 * ai_training — collects pages to train or ground models (GPTBot, ClaudeBot, CCBot, Bytespider, Meta-ExternalAgent, Amazonbot)
 * ai_search   — builds an AI search index (OAI-SearchBot, Claude-SearchBot, PerplexityBot)
 * ai_user     — fetches a page because a person asked an assistant something right now (ChatGPT-User, Claude-User, Perplexity-User,
 *               Google-Agent, Meta-ExternalFetcher): the closest thing to a demand signal a log holds
 * seo_tool    — SEO tools' crawlers (Ahrefs, Semrush, Majestic)
 * other       — anything else that calls itself a bot
 */
export const BOT_KINDS = ['search', 'ai_training', 'ai_search', 'ai_user', 'seo_tool', 'other'] as const;
export type BotKind = (typeof BOT_KINDS)[number];
export const BOT_KIND_LABELS: Record<BotKind, string> = {
  search: 'Search engines',
  ai_training: 'AI crawlers (training)',
  ai_search: 'AI search crawlers',
  ai_user: 'AI fetches for a person',
  seo_tool: 'SEO tools',
  other: 'Other bots',
};

/** IP lists the vendors publish (refreshed daily by the server, a dated copy ships in the code). */
export const RANGE_SOURCES = [
  { id: 'google-common', label: 'Google common crawlers (Googlebot, Google-InspectionTool, GoogleOther)', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', format: 'json' },
  { id: 'google-special', label: 'Google special-case crawlers', url: 'https://developers.google.com/static/search/apis/ipranges/special-crawlers.json', format: 'json' },
  { id: 'google-user', label: 'Google user-triggered fetchers', url: 'https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json', format: 'json' },
  { id: 'google-user-google', label: 'Google user-triggered fetchers (Google-owned)', url: 'https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json', format: 'json' },
  { id: 'google-agents', label: 'Google-Agent', url: 'https://developers.google.com/static/search/apis/ipranges/user-triggered-agents.json', format: 'json' },
  { id: 'bing', label: 'Bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', format: 'json' },
  { id: 'apple', label: 'Applebot', url: 'https://search.developer.apple.com/applebot.json', format: 'json' },
  { id: 'openai-gptbot', label: 'GPTBot', url: 'https://openai.com/gptbot.json', format: 'json' },
  { id: 'openai-searchbot', label: 'OAI-SearchBot', url: 'https://openai.com/searchbot.json', format: 'json' },
  { id: 'openai-chatgpt-user', label: 'ChatGPT-User', url: 'https://openai.com/chatgpt-user.json', format: 'json' },
  { id: 'anthropic', label: 'ClaudeBot, Claude-User, Claude-SearchBot', url: 'https://claude.com/crawling/bots.json', format: 'json' },
  { id: 'perplexity-bot', label: 'PerplexityBot', url: 'https://www.perplexity.com/perplexitybot.json', format: 'json' },
  { id: 'perplexity-user', label: 'Perplexity-User', url: 'https://www.perplexity.com/perplexity-user.json', format: 'json' },
  { id: 'amazon', label: 'Amazonbot', url: 'https://developer.amazon.com/amazonbot/ip-addresses/', format: 'html-json' },
  { id: 'commoncrawl', label: 'CCBot (Common Crawl)', url: 'https://index.commoncrawl.org/ccbot.json', format: 'json' },
  // not a crawler: Cloudflare's own edge addresses. A log line from one of these means the server logged the CDN, not the visitor.
  { id: 'cloudflare-v4', label: 'Cloudflare edge (IPv4)', url: 'https://www.cloudflare.com/ips-v4', format: 'text' },
  { id: 'cloudflare-v6', label: 'Cloudflare edge (IPv6)', url: 'https://www.cloudflare.com/ips-v6', format: 'text' },
] as const;
export type RangeSourceId = (typeof RANGE_SOURCES)[number]['id'];

export interface BotDef {
  key: string;
  label: string;
  vendor: string;
  kind: BotKind;
  /** matched against the user agent, in registry order (the more specific token first) */
  ua: RegExp;
  /** the vendor's published IP lists: an address on one of them is the vendor */
  ranges?: RangeSourceId[];
  /** forward-confirmed reverse DNS: the address's name ends in one of these and resolves back to the address */
  rdns?: string[];
  /** the vendor's own page on the crawler (cited in LOG_ANALYTICS.md and shown in the app) */
  docs: string;
}

export const BOTS: readonly BotDef[] = [
  { key: 'google-inspectiontool', label: 'Google-InspectionTool', vendor: 'Google', kind: 'search', ua: /Google-InspectionTool/i, ranges: ['google-common'], rdns: ['.googlebot.com', '.google.com'], docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  { key: 'googleother', label: 'GoogleOther', vendor: 'Google', kind: 'search', ua: /GoogleOther/i, ranges: ['google-common'], rdns: ['.googlebot.com', '.google.com'], docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  { key: 'google-agent', label: 'Google-Agent', vendor: 'Google', kind: 'ai_user', ua: /Google-Agent/i, ranges: ['google-agents'], docs: 'https://developers.google.com/search/docs/crawling-indexing/google-user-triggered-fetchers' },
  { key: 'google-special', label: 'Google special crawler (AdsBot, Storebot)', vendor: 'Google', kind: 'other', ua: /AdsBot-Google|Mediapartners-Google|Storebot-Google|APIs-Google/i, ranges: ['google-special'], rdns: ['.googlebot.com', '.google.com'], docs: 'https://developers.google.com/search/docs/crawling-indexing/google-special-case-crawlers' },
  { key: 'googlebot', label: 'Googlebot', vendor: 'Google', kind: 'search', ua: /Googlebot/i, ranges: ['google-common'], rdns: ['.googlebot.com', '.google.com'], docs: 'https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot' },
  { key: 'bingbot', label: 'Bingbot', vendor: 'Microsoft', kind: 'search', ua: /bingbot|BingPreview|adidxbot/i, ranges: ['bing'], rdns: ['.search.msn.com'], docs: 'https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26' },
  { key: 'applebot', label: 'Applebot', vendor: 'Apple', kind: 'search', ua: /Applebot/i, ranges: ['apple'], rdns: ['.applebot.apple.com'], docs: 'https://support.apple.com/en-us/119829' },
  { key: 'oai-searchbot', label: 'OAI-SearchBot', vendor: 'OpenAI', kind: 'ai_search', ua: /OAI-SearchBot/i, ranges: ['openai-searchbot'], docs: 'https://platform.openai.com/docs/bots' },
  { key: 'chatgpt-user', label: 'ChatGPT-User', vendor: 'OpenAI', kind: 'ai_user', ua: /ChatGPT-User/i, ranges: ['openai-chatgpt-user'], docs: 'https://platform.openai.com/docs/bots' },
  { key: 'gptbot', label: 'GPTBot', vendor: 'OpenAI', kind: 'ai_training', ua: /GPTBot/i, ranges: ['openai-gptbot'], docs: 'https://platform.openai.com/docs/bots' },
  { key: 'claude-searchbot', label: 'Claude-SearchBot', vendor: 'Anthropic', kind: 'ai_search', ua: /Claude-SearchBot/i, ranges: ['anthropic'], docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { key: 'claude-user', label: 'Claude-User', vendor: 'Anthropic', kind: 'ai_user', ua: /Claude-User/i, ranges: ['anthropic'], docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { key: 'claudebot', label: 'ClaudeBot', vendor: 'Anthropic', kind: 'ai_training', ua: /ClaudeBot|anthropic-ai/i, ranges: ['anthropic'], docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { key: 'perplexity-user', label: 'Perplexity-User', vendor: 'Perplexity', kind: 'ai_user', ua: /Perplexity-User/i, ranges: ['perplexity-user'], docs: 'https://docs.perplexity.ai/guides/bots' },
  { key: 'perplexitybot', label: 'PerplexityBot', vendor: 'Perplexity', kind: 'ai_search', ua: /PerplexityBot/i, ranges: ['perplexity-bot'], docs: 'https://docs.perplexity.ai/guides/bots' },
  { key: 'meta-externalfetcher', label: 'Meta-ExternalFetcher', vendor: 'Meta', kind: 'ai_user', ua: /meta-externalfetcher/i, docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/' },
  { key: 'meta-externalagent', label: 'Meta-ExternalAgent', vendor: 'Meta', kind: 'ai_training', ua: /meta-externalagent/i, docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/' },
  { key: 'bytespider', label: 'Bytespider', vendor: 'ByteDance', kind: 'ai_training', ua: /Bytespider/i, docs: 'https://darkvisitors.com/agents/bytespider' },
  { key: 'amazonbot', label: 'Amazonbot', vendor: 'Amazon', kind: 'ai_training', ua: /Amazonbot/i, ranges: ['amazon'], rdns: ['.crawl.amazonbot.amazon'], docs: 'https://developer.amazon.com/amazonbot' },
  { key: 'ccbot', label: 'CCBot', vendor: 'Common Crawl', kind: 'ai_training', ua: /CCBot/i, ranges: ['commoncrawl'], docs: 'https://commoncrawl.org/ccbot' },
  { key: 'yandexbot', label: 'YandexBot', vendor: 'Yandex', kind: 'search', ua: /YandexBot|YandexImages/i, rdns: ['.yandex.ru', '.yandex.net', '.yandex.com'], docs: 'https://yandex.com/support/webmaster/robot-workings/check-yandex-robots.html' },
  { key: 'duckduckbot', label: 'DuckDuckBot', vendor: 'DuckDuckGo', kind: 'search', ua: /DuckDuckBot/i, docs: 'https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot' },
  { key: 'ahrefsbot', label: 'AhrefsBot', vendor: 'Ahrefs', kind: 'seo_tool', ua: /AhrefsBot|AhrefsSiteAudit/i, docs: 'https://ahrefs.com/robot' },
  { key: 'semrushbot', label: 'SemrushBot', vendor: 'Semrush', kind: 'seo_tool', ua: /SemrushBot|SiteAuditBot/i, docs: 'https://www.semrush.com/bot/' },
  { key: 'mj12bot', label: 'MJ12bot', vendor: 'Majestic', kind: 'seo_tool', ua: /MJ12bot/i, docs: 'https://mj12bot.com/' },
];
export const BOT_BY_KEY: ReadonlyMap<string, BotDef> = new Map(BOTS.map((b) => [b.key, b]));
/** a user agent that calls itself a bot but is none of the above */
export const OTHER_BOT: BotDef = { key: 'other-bot', label: 'Other bots', vendor: '', kind: 'other', ua: /./, docs: '' };
const GENERIC_BOT = /(?:^|[\s;(/+])[\w.-]*(?:bot|crawler|spider|slurp)(?:[\s/;)+,_-]|$)|crawl/i;
// device names that end in "bot" (Cubot phones) are people, not crawlers
const NOT_A_BOT = /\bcubot\b/i;

/** The crawler a user agent claims to be, or null for a person's browser. A claim only — the IP decides whether it is true. */
export function classifyUserAgent(ua: string | null | undefined): BotDef | null {
  const s = String(ua ?? '');
  if (!s || s === '-') return null;
  for (const b of BOTS) if (b.ua.test(s)) return b;
  if (NOT_A_BOT.test(s)) return null;
  return GENERIC_BOT.test(s) ? OTHER_BOT : null;
}
export const botLabel = (key: string): string => BOT_BY_KEY.get(key)?.label ?? (key === OTHER_BOT.key ? OTHER_BOT.label : key);
export const botKind = (key: string): BotKind => BOT_BY_KEY.get(key)?.kind ?? 'other';

/** How a crawler's identity can be checked: its vendor's IP list, forward-confirmed reverse DNS, both, or not at all. */
export type VerifyMethod = 'ip_list' | 'ip_list_dns' | 'dns' | 'none';
export function verifyMethod(b: BotDef): VerifyMethod {
  if (b.ranges?.length && b.rdns?.length) return 'ip_list_dns';
  if (b.ranges?.length) return 'ip_list';
  if (b.rdns?.length) return 'dns';
  return 'none';
}
export const VERIFY_METHOD_LABELS: Record<VerifyMethod, string> = {
  ip_list: "Checked against the vendor's published IP list",
  ip_list_dns: "Checked against the vendor's published IP list, then by reverse and forward DNS",
  dns: 'Checked by reverse and forward DNS',
  none: 'The vendor publishes no way to check it: claimed, not verified',
};

/**
 * verified  — the address is on the vendor's list (or its DNS name is the vendor's and resolves back to it)
 * spoofed   — it says it is a crawler that can be checked, and the check failed: someone else using the name
 * claimed   — the vendor publishes no way to check it (Bytespider, Meta, SEO tools, unknown bots): the name is taken on trust
 * unchecked — it could have been checked but was not: no address in the log, a private or CDN address, or DNS did not answer
 */
export const VERIFICATIONS = ['verified', 'spoofed', 'claimed', 'unchecked'] as const;
export type Verification = (typeof VERIFICATIONS)[number];

/** Robots.txt tokens that are switches, not fetchers: they never appear in a log, so they cannot be counted. */
export const ROBOTS_ONLY_TOKENS = [
  { token: 'Google-Extended', vendor: 'Google', note: 'A robots.txt switch for whether Google may use your pages for Gemini training and grounding. Google fetches with its usual crawlers, so no log line ever says Google-Extended.', docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended' },
  { token: 'Applebot-Extended', vendor: 'Apple', note: "A robots.txt switch for whether Apple may use pages Applebot fetched to train its models. The fetching is Applebot's.", docs: 'https://support.apple.com/en-us/119829' },
] as const;

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Limits and settings
// ---------------------------------------------------------------------------------------------------------------------------

export const CRAWLER_LIMITS = {
  /** one uploaded file (plain or gzip) */
  uploadMaxBytes: 1024 * 1024 * 1024,
  /** one push from Cloudflare Logpush / a log drain (Cloudflare's max_upload_bytes counts uncompressed: 5 MB–1 GB; set ≤ 100 MB) */
  pushMaxBytes: 100 * 1024 * 1024,
  /** lines read from one ingest at most (a 20-million-line file is several GB; split it) */
  maxLines: 20_000_000,
  /** reverse-DNS checks one ingest may make (each distinct address once); beyond it the line is "unchecked" */
  dnsLookupsPerIngest: 2000,
  /** raw lines (one row per bot request) are kept this many days; the daily totals for `rollupDays` */
  retentionDays: [7, 30, 90] as const,
  defaultRetentionDays: 30,
  rollupDays: 400,
  /** upload rows are kept as history this long; push rows (one per Logpush batch) for 7 days */
  ingestHistoryDays: 90,
  pushHistoryDays: 7,
  windows: [7, 30, 90] as const,
  defaultWindow: 30,
  uploadsPerHour: 20,
  pushesPerMinute: 120,
} as const;

export const crawlerSettingsSchema = z.object({
  retentionDays: z
    .number()
    .int()
    .refine((v) => (CRAWLER_LIMITS.retentionDays as readonly number[]).includes(v), 'Choose 7, 30 or 90 days'),
});
export type CrawlerSettingsInput = z.infer<typeof crawlerSettingsSchema>;

/** The per-site secret a log push sends (shown once; only its SHA-256 is stored). */
export const LOG_PUSH_KEY = { prefix: 'asl_', header: 'X-Ascentra-Log-Key', displayLength: 12 } as const;
const PUSH_RE = /^asl_[A-Za-z0-9_-]{43}$/;
export const isLogPushKey = (v: unknown): v is string => typeof v === 'string' && PUSH_RE.test(v);

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Pure path rules (shared so a test can pin them once)
// ---------------------------------------------------------------------------------------------------------------------------

export type PathKind = 'page' | 'asset' | 'robots' | 'sitemap';
const ASSET = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf|zip|gz|json|webmanifest)$/i;
export function pathKind(path: string): PathKind {
  const p = path.toLowerCase();
  if (p === '/robots.txt') return 'robots';
  if (/sitemap[^/]*\.xml(\.gz)?$/.test(p) || p.endsWith('.xml')) return 'sitemap';
  return ASSET.test(p) ? 'asset' : 'page';
}

/** "/a/b?utm_source=x&page=2" → { path: "/a/b", queryKeys: "page,utm_source" } (names only, sorted — never the values) */
export function splitTarget(target: string): { path: string; queryKeys: string } {
  let t = String(target || '/');
  // an absolute URL in the request line (proxies, some CDNs): keep the path
  const abs = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(t);
  if (abs) t = t.slice(abs[0].length) || '/';
  const hash = t.indexOf('#');
  if (hash >= 0) t = t.slice(0, hash);
  const q = t.indexOf('?');
  const path = (q >= 0 ? t.slice(0, q) : t) || '/';
  const query = q >= 0 ? t.slice(q + 1) : '';
  const keys = query
    ? [...new Set(query.split('&').map((kv) => kv.split('=')[0].slice(0, 40)).filter(Boolean))].sort().slice(0, 12).join(',')
    : '';
  return { path: (path.startsWith('/') ? path : '/' + path).slice(0, 1024), queryKeys: keys.slice(0, 300) };
}

/** The key a log path and an inventory URL are compared on: decoded where safe, no trailing slash (except the root), lower-case. */
export function pathKey(pathOrUrl: string): string {
  let p = String(pathOrUrl || '');
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(p);
  if (m) p = p.slice(m[0].length);
  p = p.split(/[?#]/)[0] || '/';
  try {
    p = decodeURI(p);
  } catch {
    /* keep it encoded */
  }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return (p || '/').toLowerCase();
}

/** The site's own hosts: the domain itself and www. A host-less line (most server logs) counts as the site's. */
export function hostIsSite(host: string | null | undefined, domain: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const d = domain.toLowerCase().replace(/^www\./, '');
  return h === d || h === 'www.' + d;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Answers
// ---------------------------------------------------------------------------------------------------------------------------

export type IngestSource = 'upload' | 'push';
export type IngestStatus = 'queued' | 'processing' | 'done' | 'failed';
export type LogFormat = 'combined' | 'w3c' | 'json' | 'unknown';

export interface IngestStats {
  lines: number;
  /** lines that were not a request line (comments, blank, unreadable) */
  malformed: number;
  /** requests for another host (a shared log or a CDN zone with several hosts) */
  otherHost: number;
  /** requests from people's browsers: counted here, never stored */
  people: number;
  /** requests from crawlers, stored */
  bots: number;
  /** of those, already stored by an earlier upload or push (the same line twice) */
  duplicates: number;
  verified: number;
  spoofed: number;
  claimed: number;
  unchecked: number;
  /** lines whose address was the CDN's or a private one: the server logged its proxy, not the visitor */
  proxyAddresses: number;
  firstAt: string | null;
  lastAt: string | null;
  /** up to five line numbers with why they could not be read (never the line itself: it may hold an address) */
  samples: { line: number; reason: string }[];
}

export interface LogIngestView {
  id: string;
  source: IngestSource;
  fileName: string;
  status: IngestStatus;
  format: LogFormat;
  bytes: number;
  stats: IngestStats | null;
  error: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface CrawlerBotRow {
  bot: string;
  label: string;
  vendor: string;
  kind: BotKind;
  method: VerifyMethod;
  /** requests that are not spoofed (verified + claimed + unchecked) */
  hits: number;
  verified: number;
  claimed: number;
  unchecked: number;
  spoofed: number;
  /** distinct paths (any day of the window) */
  pages: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  paramHits: number;
  assetHits: number;
  avgMs: number | null;
  lastSeen: string | null;
}

export interface CrawlerDay {
  day: string;
  search: number;
  ai_training: number;
  ai_search: number;
  ai_user: number;
  seo_tool: number;
  other: number;
  /** requests from addresses pretending to be a crawler (not in the other columns) */
  spoofed: number;
  googlebot: number;
}

export interface CrawlerPageGap {
  path: string;
  url: string;
  title: string;
  clicks: number | null;
  impressions: number | null;
  lastGoogle: string | null;
  lastAi: string | null;
}

export interface CrawlerRecommendation {
  id: string;
  tone: 'critical' | 'serious' | 'warning' | 'info' | 'good';
  title: string;
  detail: string;
  /** which view of the app acts on it */
  link: 'technical' | 'ai' | 'crawler-setup' | null;
}

export interface CrawlerSetup {
  retentionDays: number;
  push: { enabled: boolean; prefix: string | null; createdAt: string | null; lastPushAt: string | null; pushes24h: number };
  /** where Cloudflare Logpush / a log drain sends to, and the header that carries the key */
  endpoint: string;
  header: string;
  limits: { uploadMaxBytes: number; pushMaxBytes: number; rollupDays: number };
  ranges: { id: string; label: string; url: string; fetchedAt: string | null; creationTime: string | null; prefixes: number; error: string }[];
}

export interface CrawlerData {
  windowDays: number;
  from: string;
  to: string;
  /** any stored request for this site at all (any day) */
  hasData: boolean;
  dataFrom: string | null;
  dataTo: string | null;
  totals: {
    hits: number;
    search: number;
    googlebot: number;
    ai: number;
    aiUser: number;
    spoofed: number;
    /** share of crawler requests (not spoofed) whose identity was proved; null with no requests */
    verifiedShare: number | null;
    uncheckedShare: number | null;
  };
  bots: CrawlerBotRow[];
  daily: CrawlerDay[];
  coverage: {
    /** where the page list came from: the engine's weekly page inventory, or none yet */
    source: 'inventory' | 'none';
    inventory: number;
    inSitemap: number;
    fetchedByGoogle: number;
    fetchedByAi: number;
    /** inventory pages (most clicked first) Googlebot did not fetch in the window */
    neverGoogle: CrawlerPageGap[];
    neverAi: CrawlerPageGap[];
    /** paths Googlebot fetched that the inventory does not have (a sitemap or internal-link gap, or old URLs) */
    unknownToInventory: { path: string; hits: number; status: number | null }[];
    error: string | null;
  };
  waste: {
    googleHits: number;
    redirects: number;
    clientErrors: number;
    serverErrors: number;
    paramHits: number;
    /** (3xx + 4xx + 5xx + parameter URLs) / Googlebot requests, null with none */
    share: number | null;
    top: { path: string; reason: '3xx' | '4xx' | '5xx' | 'param'; hits: number; status: number | null }[];
    paramPatterns: { path: string; keys: string; hits: number }[];
  };
  newPages: { path: string; firstGoogle: string | null; firstAi: string | null; inInventory: boolean }[];
  aiDemand: { path: string; hits: number; bots: string[]; lastSeen: string | null }[];
  responseTimes: { bot: string; label: string; avgMs: number; hits: number }[];
  spoofed: { bot: string; label: string; hits: number; networks: number; topNetworks: string[] }[];
  /** ai crawlers refused by the server (403 / 401 / 429) in the window */
  blocked: { bot: string; label: string; hits: number; refused: number }[];
  recommendations: CrawlerRecommendation[];
  setup: CrawlerSetup;
  ingests: LogIngestView[];
}

/** The answer to a push-key creation: the key is shown once. */
export interface LogPushKeyCreated {
  token: string;
  prefix: string;
  endpoint: string;
  header: string;
  createdAt: string;
}

export interface LogUploadAccepted {
  ingest: LogIngestView;
  duplicate: boolean;
}
