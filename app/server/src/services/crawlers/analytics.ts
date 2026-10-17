import {
  BOT_BY_KEY,
  BOTS,
  botKind,
  botLabel,
  CRAWLER_LIMITS,
  LOG_PUSH_KEY,
  n8nSiteId,
  OTHER_BOT,
  pathKey,
  pathKind,
  verifyMethod,
  type BotKind,
  type CrawlerBotRow,
  type CrawlerData,
  type CrawlerDay,
  type CrawlerPageGap,
  type CrawlerRecommendation,
  type CrawlerSetup,
  type IngestStats,
  type LogIngestView,
  type SitePageRow,
} from '@seo/shared';
import { config } from '../../config';
import { sqlClient } from '../../db';
import type { SiteRow } from '../../db/schema';
import { rows as n8nRows } from '../../n8n/client';
import { rangeStatus } from './ranges';

/**
 * The Crawlers page (and `/api/v1/websites/:id/crawlers`): every figure is read from the site's own rows — daily totals for counts
 * and trends, the per-path daily rows for coverage and first-seen, the raw rows (only as old as the retention setting) for parameter
 * patterns and spoofers' networks — and joined with the engine's page inventory (`seo_pages`). Days are UTC.
 */

const AI_KINDS: BotKind[] = ['ai_training', 'ai_search', 'ai_user'];
const AI_BOTS = BOTS.filter((b) => AI_KINDS.includes(b.kind)).map((b) => b.key);
const AI_USER_BOTS = BOTS.filter((b) => b.kind === 'ai_user').map((b) => b.key);
const GOOGLEBOT = 'googlebot';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayStr = (v: unknown): string | null => (v == null ? null : v instanceof Date ? iso(v) : String(v).slice(0, 10));
const num = (v: unknown) => Number(v ?? 0) || 0;

export function windowOf(days: unknown): number {
  const n = Number(days);
  return (CRAWLER_LIMITS.windows as readonly number[]).includes(n) ? n : CRAWLER_LIMITS.defaultWindow;
}

export const toIngestView = (r: {
  id: string;
  source: string;
  file_name?: string;
  fileName?: string;
  status: string;
  format: string;
  bytes: number | string;
  stats: unknown;
  error: string;
  created_at?: Date;
  createdAt?: Date;
  finished_at?: Date | null;
  finishedAt?: Date | null;
}): LogIngestView => ({
  id: r.id,
  source: r.source as LogIngestView['source'],
  fileName: r.file_name ?? r.fileName ?? '',
  status: r.status as LogIngestView['status'],
  format: (r.format || 'unknown') as LogIngestView['format'],
  bytes: Number(r.bytes) || 0,
  stats: (r.stats as IngestStats | null) ?? null,
  error: r.error,
  createdAt: (r.created_at ?? r.createdAt ?? new Date()).toISOString(),
  finishedAt: (r.finished_at ?? r.finishedAt)?.toISOString() ?? null,
});

export async function ingestsOf(siteId: string, limit = 20): Promise<LogIngestView[]> {
  const rows = await sqlClient<{ id: string; source: string; file_name: string; status: string; format: string; bytes: string; stats: unknown; error: string; created_at: Date; finished_at: Date | null }[]>`
    select id, source, file_name, status, format, bytes, stats, error, created_at, finished_at from log_ingests
    where site_id = ${siteId} and (source = 'upload' or status <> 'done' or created_at > now() - interval '1 day')
    order by created_at desc limit ${limit}`;
  return rows.map(toIngestView);
}

export async function setupOf(site: SiteRow): Promise<CrawlerSetup> {
  const [src] = await sqlClient<{ retention_days: number; push_key_prefix: string | null; push_key_created_at: Date | null; last_push_at: Date | null }[]>`
    select retention_days, push_key_prefix, push_key_created_at, last_push_at from log_sources where site_id = ${site.id}`;
  const [p] = await sqlClient<{ n: string }[]>`select count(*) as n from log_ingests where site_id = ${site.id} and source = 'push' and created_at > now() - interval '1 day'`;
  return {
    retentionDays: src?.retention_days ?? CRAWLER_LIMITS.defaultRetentionDays,
    push: {
      enabled: !!src?.push_key_prefix,
      prefix: src?.push_key_prefix ?? null,
      createdAt: src?.push_key_created_at?.toISOString() ?? null,
      lastPushAt: src?.last_push_at?.toISOString() ?? null,
      pushes24h: num(p?.n),
    },
    endpoint: `${config.appUrl}/api/ingest/logs/${site.id}`,
    header: LOG_PUSH_KEY.header,
    limits: { uploadMaxBytes: CRAWLER_LIMITS.uploadMaxBytes, pushMaxBytes: CRAWLER_LIMITS.pushMaxBytes, rollupDays: CRAWLER_LIMITS.rollupDays },
    ranges: rangeStatus(),
  };
}

/** the engine's page inventory of the site (written weekly by the Site Tracker); [] when n8n is unreachable or it has none yet */
async function inventory(site: SiteRow): Promise<{ pages: SitePageRow[]; error: string | null }> {
  try {
    const pages = await n8nRows<SitePageRow>('pages', { filters: [{ columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) }], max: 5000 });
    return { pages, error: null };
  } catch (e) {
    return { pages: [], error: `The page inventory could not be read (${String((e as Error).message || e).slice(0, 120)}): coverage is not shown.` };
  }
}

export async function crawlerData(site: SiteRow, daysIn: unknown, opts: { withSetup?: boolean } = {}): Promise<CrawlerData> {
  const days = windowOf(daysIn);
  const to = new Date();
  const fromD = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - (days - 1)));
  const from = iso(fromD);
  const sid = site.id;

  const [span] = await sqlClient<{ first: Date | string | null; last: Date | string | null }[]>`select min(day) as first, max(day) as last from crawler_daily where site_id = ${sid}`;
  const dataFrom = dayStr(span?.first);
  const dataTo = dayStr(span?.last);

  const dailyRows = await sqlClient<{ day: Date | string; bot: string; verification: string; hits: number; s2xx: number; s3xx: number; s4xx: number; s5xx: number; refused: number; param_hits: number; asset_hits: number; ms_sum: string; ms_n: number }[]>`
    select day, bot, verification, hits, s2xx, s3xx, s4xx, s5xx, refused, param_hits, asset_hits, ms_sum, ms_n
    from crawler_daily where site_id = ${sid} and day >= ${from} order by day`;
  const pageCounts = await sqlClient<{ bot: string; pages: string; last: Date | string }[]>`
    select bot, count(distinct path) as pages, max(day) as last from crawler_page_daily where site_id = ${sid} and day >= ${from} group by bot`;
  const pagesOf = new Map(pageCounts.map((r) => [r.bot, { pages: num(r.pages), last: dayStr(r.last) }]));

  // ---- per bot
  const bots = new Map<string, CrawlerBotRow & { msSum: number; msN: number }>();
  const dayMap = new Map<string, CrawlerDay>();
  for (let d = new Date(fromD); d <= to; d = new Date(d.getTime() + 86_400_000)) {
    const k = iso(d);
    dayMap.set(k, { day: k, search: 0, ai_training: 0, ai_search: 0, ai_user: 0, seo_tool: 0, other: 0, spoofed: 0, googlebot: 0 });
  }
  for (const r of dailyRows) {
    const def = BOT_BY_KEY.get(r.bot) ?? OTHER_BOT;
    let b = bots.get(r.bot);
    if (!b) {
      bots.set(
        r.bot,
        (b = { bot: r.bot, label: botLabel(r.bot), vendor: def.vendor, kind: def.kind, method: verifyMethod(def), hits: 0, verified: 0, claimed: 0, unchecked: 0, spoofed: 0, pages: pagesOf.get(r.bot)?.pages ?? 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, paramHits: 0, assetHits: 0, avgMs: null, lastSeen: pagesOf.get(r.bot)?.last ?? null, msSum: 0, msN: 0 }),
      );
    }
    const dk = dayStr(r.day)!;
    const dd = dayMap.get(dk);
    if (r.verification === 'spoofed') {
      b.spoofed += r.hits;
      if (dd) dd.spoofed += r.hits;
      continue;
    }
    b.hits += r.hits;
    if (r.verification === 'verified') b.verified += r.hits;
    else if (r.verification === 'claimed') b.claimed += r.hits;
    else b.unchecked += r.hits;
    b.s2xx += r.s2xx;
    b.s3xx += r.s3xx;
    b.s4xx += r.s4xx;
    b.s5xx += r.s5xx;
    b.paramHits += r.param_hits;
    b.assetHits += r.asset_hits;
    b.msSum += num(r.ms_sum);
    b.msN += r.ms_n;
    if (dd) {
      dd[def.kind] += r.hits;
      if (r.bot === GOOGLEBOT) dd.googlebot += r.hits;
    }
  }
  const botRows: CrawlerBotRow[] = [...bots.values()]
    .map(({ msSum, msN, ...b }) => ({ ...b, avgMs: msN ? Math.round(msSum / msN) : null }))
    .sort((a, b) => b.hits + b.spoofed - (a.hits + a.spoofed));

  const sum = (f: (b: CrawlerBotRow) => number, pred: (b: CrawlerBotRow) => boolean = () => true) => botRows.filter(pred).reduce((s, b) => s + f(b), 0);
  const hits = sum((b) => b.hits);
  const verified = sum((b) => b.verified);
  const unchecked = sum((b) => b.unchecked);
  const totals = {
    hits,
    search: sum((b) => b.hits, (b) => b.kind === 'search'),
    googlebot: bots.get(GOOGLEBOT)?.hits ?? 0,
    ai: sum((b) => b.hits, (b) => AI_KINDS.includes(b.kind)),
    aiUser: sum((b) => b.hits, (b) => b.kind === 'ai_user'),
    spoofed: sum((b) => b.spoofed),
    verifiedShare: hits ? verified / hits : null,
    uncheckedShare: hits ? unchecked / hits : null,
  };

  // ---- coverage (per path, all stored days, so "last fetched" can be older than the window)
  const pathRows = await sqlClient<{ path: string; last_google: Date | string | null; first_google: Date | string | null; last_ai: Date | string | null; first_ai: Date | string | null; g_hits: string; g_status: number | null }[]>`
    select path,
      max(day) filter (where bot = ${GOOGLEBOT}) as last_google,
      min(day) filter (where bot = ${GOOGLEBOT}) as first_google,
      max(day) filter (where bot = any(${AI_BOTS}::text[])) as last_ai,
      min(day) filter (where bot = any(${AI_BOTS}::text[])) as first_ai,
      coalesce(sum(hits) filter (where bot = ${GOOGLEBOT} and day >= ${from}), 0) as g_hits,
      max(last_status) filter (where bot = ${GOOGLEBOT} and day >= ${from}) as g_status
    from crawler_page_daily where site_id = ${sid} group by path
    order by max(day) desc limit 50000`;
  const byKey = new Map<string, (typeof pathRows)[number]>();
  for (const r of pathRows) {
    const k = pathKey(r.path);
    const cur = byKey.get(k);
    // "/a" and "/a/" are one page: keep the most recent of each date
    if (!cur) byKey.set(k, r);
    else
      byKey.set(k, {
        ...cur,
        last_google: maxDay(cur.last_google, r.last_google),
        first_google: minDay(cur.first_google, r.first_google),
        last_ai: maxDay(cur.last_ai, r.last_ai),
        first_ai: minDay(cur.first_ai, r.first_ai),
        g_hits: String(num(cur.g_hits) + num(r.g_hits)),
      });
  }
  const inv = await inventory(site);
  const invKeys = new Set<string>();
  const gaps: (CrawlerPageGap & { g: boolean; a: boolean })[] = [];
  let inSitemap = 0;
  for (const p of inv.pages) {
    const k = pathKey(p.url);
    if (invKeys.has(k)) continue;
    invKeys.add(k);
    if (p.source === 'sitemap') inSitemap++;
    const r = byKey.get(k);
    const lastGoogle = dayStr(r?.last_google);
    const lastAi = dayStr(r?.last_ai);
    gaps.push({
      path: k,
      url: p.url,
      title: p.title || p.h1 || '',
      clicks: p.clicks ?? null,
      impressions: p.impressions ?? null,
      lastGoogle,
      lastAi,
      g: !!lastGoogle && lastGoogle >= from,
      a: !!lastAi && lastAi >= from,
    });
  }
  const importance = (x: CrawlerPageGap) => (x.clicks ?? 0) * 1000 + (x.impressions ?? 0);
  gaps.sort((a, b) => importance(b) - importance(a));
  const strip = ({ g: _g, a: _a, ...rest }: CrawlerPageGap & { g: boolean; a: boolean }): CrawlerPageGap => (void _g, void _a, rest);
  const unknownToInventory = inv.pages.length
    ? [...byKey.entries()]
        .filter(([k, r]) => num(r.g_hits) > 0 && !invKeys.has(k) && pathKind(r.path) === 'page' && (r.g_status ?? 200) < 300)
        .sort((a, b) => num(b[1].g_hits) - num(a[1].g_hits))
        .slice(0, 25)
        .map(([, r]) => ({ path: r.path, hits: num(r.g_hits), status: r.g_status }))
    : [];

  // ---- waste (Googlebot, not spoofed)
  const g = bots.get(GOOGLEBOT);
  const googleHits = g?.hits ?? 0;
  const wasted = g ? g.s3xx + g.s4xx + g.s5xx + g.paramHits : 0;
  const wasteRows = await sqlClient<{ path: string; s3xx: string; s4xx: string; s5xx: string; param_hits: string; last_status: number | null }[]>`
    select path, sum(s3xx) as s3xx, sum(s4xx) as s4xx, sum(s5xx) as s5xx, sum(param_hits) as param_hits, max(last_status) as last_status
    from crawler_page_daily where site_id = ${sid} and bot = ${GOOGLEBOT} and day >= ${from} and (s3xx + s4xx + s5xx + param_hits) > 0
    group by path order by sum(s3xx + s4xx + s5xx + param_hits) desc limit 60`;
  const top: CrawlerData['waste']['top'] = [];
  for (const r of wasteRows)
    for (const [reason, n] of [['5xx', r.s5xx], ['4xx', r.s4xx], ['3xx', r.s3xx], ['param', r.param_hits]] as const)
      if (num(n) > 0) top.push({ path: r.path, reason, hits: num(n), status: reason === 'param' ? null : r.last_status });
  top.sort((a, b) => b.hits - a.hits);
  const paramPatterns = await sqlClient<{ path: string; keys: string; hits: string }[]>`
    select path, query_keys as keys, count(*) as hits from crawler_hits
    where site_id = ${sid} and bot = ${GOOGLEBOT} and verification <> 'spoofed' and query_keys <> '' and at >= ${fromD}
    group by path, query_keys order by count(*) desc limit 15`;

  // ---- new pages: first fetched by Googlebot inside the window, and only once the data is old enough to say "first"
  const enoughHistory = dataFrom != null && Date.parse(dataFrom) + 3 * 86_400_000 <= Date.parse(from) + (days - 1) * 86_400_000;
  const newPages = enoughHistory
    ? [...byKey.entries()]
        .filter(([, r]) => {
          const fg = dayStr(r.first_google);
          return fg && fg >= from && Date.parse(fg) >= Date.parse(dataFrom!) + 3 * 86_400_000 && pathKind(r.path) === 'page';
        })
        .sort((a, b) => String(dayStr(b[1].first_google)).localeCompare(String(dayStr(a[1].first_google))))
        .slice(0, 20)
        .map(([k, r]) => ({ path: r.path, firstGoogle: dayStr(r.first_google), firstAi: dayStr(r.first_ai), inInventory: invKeys.has(k) }))
    : [];

  // ---- AI fetches made because a person asked
  const demand = await sqlClient<{ path: string; hits: string; bots: string[]; last: Date | string }[]>`
    select path, sum(hits) as hits, array_agg(distinct bot) as bots, max(day) as last from crawler_page_daily
    where site_id = ${sid} and day >= ${from} and bot = any(${AI_USER_BOTS}::text[]) group by path order by sum(hits) desc limit 20`;

  // ---- spoofers and refusals
  const spoofNets = await sqlClient<{ bot: string; networks: string; top: string[] }[]>`
    select bot, count(distinct net) as networks, (array_agg(net order by n desc))[1:3] as top from (
      select bot, net, count(*) as n from crawler_hits where site_id = ${sid} and verification = 'spoofed' and at >= ${fromD} and net is not null group by bot, net
    ) x group by bot`;
  const netsOf = new Map(spoofNets.map((r) => [r.bot, { networks: num(r.networks), top: r.top ?? [] }]));
  const refusedBy = new Map<string, number>();
  for (const r of dailyRows) if (r.verification !== 'spoofed' && r.refused) refusedBy.set(r.bot, (refusedBy.get(r.bot) ?? 0) + r.refused);

  const data: CrawlerData = {
    windowDays: days,
    from,
    to: iso(to),
    hasData: dataFrom != null,
    dataFrom,
    dataTo,
    totals,
    bots: botRows,
    daily: [...dayMap.values()],
    coverage: {
      source: inv.pages.length ? 'inventory' : 'none',
      inventory: invKeys.size,
      inSitemap,
      fetchedByGoogle: gaps.filter((x) => x.g).length,
      fetchedByAi: gaps.filter((x) => x.a).length,
      neverGoogle: gaps.filter((x) => !x.g).slice(0, 25).map(strip),
      neverAi: gaps.filter((x) => !x.a).slice(0, 25).map(strip),
      unknownToInventory,
      error: inv.error,
    },
    waste: {
      googleHits,
      redirects: g?.s3xx ?? 0,
      clientErrors: g?.s4xx ?? 0,
      serverErrors: g?.s5xx ?? 0,
      paramHits: g?.paramHits ?? 0,
      share: googleHits ? Math.min(1, wasted / googleHits) : null,
      top: top.slice(0, 20),
      paramPatterns: paramPatterns.map((r) => ({ path: r.path, keys: r.keys, hits: num(r.hits) })),
    },
    newPages,
    aiDemand: demand.map((r) => ({ path: r.path, hits: num(r.hits), bots: (r.bots ?? []).map(botLabel), lastSeen: dayStr(r.last) })),
    responseTimes: botRows.filter((b) => b.avgMs != null && b.hits >= 5).map((b) => ({ bot: b.bot, label: b.label, avgMs: b.avgMs!, hits: b.hits })),
    spoofed: botRows
      .filter((b) => b.spoofed > 0)
      .map((b) => ({ bot: b.bot, label: b.label, hits: b.spoofed, networks: netsOf.get(b.bot)?.networks ?? 0, topNetworks: netsOf.get(b.bot)?.top ?? [] }))
      .sort((a, b) => b.hits - a.hits),
    blocked: botRows
      .filter((b) => AI_KINDS.includes(b.kind) && (refusedBy.get(b.bot) ?? 0) > 0)
      .map((b) => ({ bot: b.bot, label: b.label, hits: b.hits, refused: refusedBy.get(b.bot) ?? 0 }))
      .sort((a, b) => b.refused - a.refused),
    recommendations: [],
    setup: opts.withSetup === false ? (null as unknown as CrawlerSetup) : await setupOf(site),
    ingests: opts.withSetup === false ? [] : await ingestsOf(sid),
  };
  data.recommendations = recommend(data);
  return data;
}

function maxDay(a: Date | string | null, b: Date | string | null) {
  const x = dayStr(a);
  const y = dayStr(b);
  return !x ? y : !y ? x : x > y ? x : y;
}
function minDay(a: Date | string | null, b: Date | string | null) {
  const x = dayStr(a);
  const y = dayStr(b);
  return !x ? y : !y ? x : x < y ? x : y;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => x.toLocaleString('en-US');

/** What the figures ask the owner to do, most urgent first. Each names the view of the app that acts on it. */
export function recommend(d: CrawlerData): CrawlerRecommendation[] {
  const out: CrawlerRecommendation[] = [];
  if (!d.hasData) return out;
  const proxied = d.ingests.reduce((s, i) => s + (i.stats?.proxyAddresses ?? 0), 0);
  if (proxied > 0 && (d.totals.uncheckedShare ?? 0) >= 0.5)
    out.push({
      id: 'proxy-address',
      tone: 'warning',
      title: 'Your log records your CDN or load balancer, not the visitor',
      detail: `${pct(d.totals.uncheckedShare!)} of crawler requests could not be checked because the address in the log is a proxy's. Log the visitor's address (Cloudflare's CF-Connecting-IP, or X-Forwarded-For), or send Cloudflare's own logs with Logpush.`,
      link: 'crawler-setup',
    });
  const g = d.bots.find((b) => b.bot === GOOGLEBOT);
  if (g && g.hits >= 20 && g.s5xx / g.hits >= 0.01)
    out.push({ id: 'google-5xx', tone: 'critical', title: `Googlebot got a server error ${n(g.s5xx)} times`, detail: `${pct(g.s5xx / g.hits)} of Googlebot's requests in ${d.windowDays} days ended in a 5xx. Repeated server errors make Google slow its crawl and can drop pages. The URLs are under "Crawl budget".`, link: 'technical' });
  if (d.waste.share != null && d.waste.googleHits >= 50 && d.waste.share >= 0.2)
    out.push({
      id: 'crawl-waste',
      tone: d.waste.share >= 0.4 ? 'serious' : 'warning',
      title: `Googlebot spends ${pct(d.waste.share)} of its requests on redirects, errors and parameter URLs`,
      detail: `${n(d.waste.redirects)} redirects, ${n(d.waste.clientErrors)} client errors, ${n(d.waste.serverErrors)} server errors and ${n(d.waste.paramHits)} parameter URLs in ${d.windowDays} days. Point internal links and the sitemap at the final URLs and keep parameter URLs out of them; the audit lists the pages that link to them.`,
      link: 'technical',
    });
  const importantMissed = d.coverage.neverGoogle.filter((p) => (p.clicks ?? 0) > 0 || (p.impressions ?? 0) > 0);
  if (d.coverage.source === 'inventory' && importantMissed.length)
    out.push({
      id: 'google-missed',
      tone: 'warning',
      title: `${importantMissed.length} page${importantMissed.length === 1 ? '' : 's'} with search traffic Googlebot did not fetch in ${d.windowDays} days`,
      detail: `For example ${importantMissed[0].path}. A page Google does not revisit keeps its old version in the index. Link to it from pages Google fetches often and keep it in the sitemap with a true lastmod.`,
      link: 'technical',
    });
  for (const b of d.blocked)
    out.push({
      id: `ai-refused-${b.bot}`,
      tone: 'serious',
      title: `Your server refused ${b.label} ${n(b.refused)} times`,
      detail: `${b.label} got 401 / 403 / 429 answers. If you want to be named in AI answers, allow it in robots.txt and in your firewall or CDN bot rules; the AI visibility page checks your crawler access every week.`,
      link: 'ai',
    });
  if (d.coverage.source === 'inventory' && d.coverage.inventory > 0 && d.coverage.fetchedByAi === 0 && d.totals.ai === 0)
    out.push({ id: 'ai-none', tone: 'info', title: `No AI crawler fetched your pages in ${d.windowDays} days`, detail: 'AI assistants can only cite what they have read. Check that robots.txt and your CDN let GPTBot, OAI-SearchBot, ClaudeBot and PerplexityBot in, and that your key pages answer without JavaScript.', link: 'ai' });
  if (g && g.avgMs != null && g.hits >= 20 && g.avgMs >= 1000)
    out.push({ id: 'google-slow', tone: 'warning', title: `Your server takes ${n(g.avgMs)} ms on average to answer Googlebot`, detail: 'Slow answers lower how many pages Google fetches a day. Cache pages Googlebot asks for most, and check the slowest URLs in the audit.', link: 'technical' });
  const spoof = d.spoofed.reduce((s, x) => s + x.hits, 0);
  if (spoof > 0)
    out.push({ id: 'spoofed', tone: 'info', title: `${n(spoof)} requests pretended to be a crawler`, detail: `They used a crawler's name (${d.spoofed.slice(0, 3).map((x) => x.label).join(', ')}) from addresses that are not the vendor's. They are left out of every other figure here. Block them at your firewall by network if they cost you.`, link: null });
  if (d.totals.aiUser > 0)
    out.push({ id: 'ai-demand', tone: 'good', title: `AI assistants fetched your pages ${n(d.totals.aiUser)} times because a person asked`, detail: `Fetches by ChatGPT-User, Claude-User, Perplexity-User and Google-Agent happen while someone waits for an answer: the pages they read are the ones people are asking about. Keep those pages current and answer-first.`, link: 'ai' });
  return out;
}

// ---------------------------------------------------------------- CSV export

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // a cell starting with = + - @ is a formula in a spreadsheet: neutralise it (OWASP CSV injection)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export async function crawlerCsv(site: SiteRow, kind: string, daysIn: unknown): Promise<{ name: string; body: string }> {
  const days = windowOf(daysIn);
  const to = new Date();
  const fromD = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - (days - 1)));
  const from = iso(fromD);
  const base = `${site.domain}-crawlers-${kind}-${from}-to-${iso(to)}.csv`;
  if (kind === 'pages') {
    const rows = await sqlClient<{ path: string; bot: string; hits: string; verified_hits: string; s3xx: string; s4xx: string; s5xx: string; param_hits: string; first: Date; last: Date; last_status: number | null }[]>`
      select path, bot, sum(hits) as hits, sum(verified_hits) as verified_hits, sum(s3xx) as s3xx, sum(s4xx) as s4xx, sum(s5xx) as s5xx, sum(param_hits) as param_hits,
             min(day) as first, max(day) as last, max(last_status) as last_status
      from crawler_page_daily where site_id = ${site.id} and day >= ${from} group by path, bot order by sum(hits) desc limit 200000`;
    return { name: base, body: toCsv(['path', 'crawler', 'requests', 'verified_requests', 'redirects_3xx', 'client_errors_4xx', 'server_errors_5xx', 'parameter_urls', 'first_day', 'last_day', 'last_status'], rows.map((r) => [r.path, botLabel(r.bot), r.hits, r.verified_hits, r.s3xx, r.s4xx, r.s5xx, r.param_hits, dayStr(r.first), dayStr(r.last), r.last_status])) };
  }
  if (kind === 'hits') {
    const rows = await sqlClient<{ at: Date; bot: string; verification: string; method: string; path: string; query_keys: string; status: number; bytes: string | null; ms: number | null; net: string | null }[]>`
      select at, bot, verification, method, path, query_keys, status, bytes, ms, net from crawler_hits
      where site_id = ${site.id} and at >= ${fromD} order by at desc limit 200000`;
    return { name: base, body: toCsv(['time_utc', 'crawler', 'verification', 'method', 'path', 'parameter_names', 'status', 'bytes', 'response_ms', 'network_if_not_verified'], rows.map((r) => [r.at.toISOString(), botLabel(r.bot), r.verification, r.method, r.path, r.query_keys, r.status, r.bytes, r.ms, r.net])) };
  }
  const rows = await sqlClient<{ day: Date; bot: string; verification: string; hits: number; s2xx: number; s3xx: number; s4xx: number; s5xx: number; param_hits: number; asset_hits: number; bytes: string; ms_sum: string; ms_n: number }[]>`
    select day, bot, verification, hits, s2xx, s3xx, s4xx, s5xx, param_hits, asset_hits, bytes, ms_sum, ms_n from crawler_daily
    where site_id = ${site.id} and day >= ${from} order by day, bot, verification`;
  return {
    name: base.replace(`-${kind}-`, '-daily-'),
    body: toCsv(
      ['day_utc', 'crawler', 'kind', 'verification', 'requests', 'ok_2xx', 'redirects_3xx', 'client_errors_4xx', 'server_errors_5xx', 'parameter_urls', 'asset_requests', 'bytes', 'avg_response_ms'],
      rows.map((r) => [dayStr(r.day), botLabel(r.bot), botKind(r.bot), r.verification, r.hits, r.s2xx, r.s3xx, r.s4xx, r.s5xx, r.param_hits, r.asset_hits, r.bytes, r.ms_n ? Math.round(num(r.ms_sum) / r.ms_n) : '']),
    ),
  };
}
