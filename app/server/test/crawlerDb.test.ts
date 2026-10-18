import { createReadStream, readFileSync, writeFileSync, mkdtempSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CrawlerData, SitePageRow } from '@seo/shared';

// Server-log and AI-crawler analytics end to end against a real Postgres (app/docs/LOG_ANALYTICS.md): upload and push → spool →
// worker → crawler rows + daily totals → the Crawlers answer, the CSV, the read API; isolation between companies, roles, CSRF,
// duplicates, retention, the right to delete, the IP-list refresh guard, and a large file that must not block the server.
// Runs when TEST_DATABASE_URL names a throwaway database (the runner also sets DATABASE_URL to it, CRAWLER_JOBS=false).

const DB = process.env.TEST_DATABASE_URL;

const inventory: SitePageRow[] = [];
vi.mock('../src/n8n/client', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    rows: vi.fn(async (table: string, q: { filters?: { columnName: string; value: unknown }[] }) => (table === 'pages' && q.filters?.[0]?.value === 'site_techand-example' ? inventory : [])),
    n8nHealth: vi.fn(async () => ({ api: false, webhook: false })),
  };
});

const fx = (f: string) => readFileSync(new URL(`./fixtures/logs/${f}`, import.meta.url), 'utf8');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const clf = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${MON[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** the fixtures are dated 15 Oct 2026; the window is relative to today */
const recent = (text: string, n = 2) => text.replaceAll('15/Oct/2026', clf(daysAgo(n))).replaceAll('2026-10-15', isoDay(daysAgo(n))).replaceAll('1792044000', String(Math.floor(daysAgo(n).getTime() / 1000)));

describe.skipIf(!DB)('crawler logs against Postgres', () => {
  let app: FastifyInstance;
  let sql: typeof import('../src/db').sqlClient;
  let jobs: typeof import('../src/services/crawlers/jobs');
  let ranges: typeof import('../src/services/crawlers/ranges');
  const ids = { orgA: '', orgB: '', siteA: '', siteU: '', siteB: '', owner: '', viewer: '', member: '', other: '' };
  const cookie: Record<string, string> = {};
  let apiKey = '';

  const req = (who: keyof typeof cookie | null, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, opts: { body?: unknown; raw?: Buffer | string; headers?: Record<string, string>; csrf?: boolean } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(who ? { cookie: `sid=${cookie[who]}` } : {}),
        ...(method !== 'GET' && opts.csrf !== false ? { 'x-requested-with': 'fetch' } : {}),
        ...(opts.raw !== undefined ? { 'content-type': 'application/octet-stream' } : {}),
        ...(opts.headers ?? {}),
      },
      payload: opts.raw !== undefined ? opts.raw : (opts.body as object | undefined),
    });
  const auditOf = async (action: string) => sql<{ details: Record<string, unknown>; target_label: string | null }[]>`select details, target_label from audit_events where org_id = ${ids.orgA} and action = ${action}`;
  const base = (site: string, org = ids.orgA) => `/api/orgs/${org}/sites/${site}/crawlers`;

  beforeAll(async () => {
    const dbm = await import('../src/db');
    sql = dbm.sqlClient;
    await dbm.runMigrations();
    // the audit log is append-only (migration 0011 refuses TRUNCATE): clear it through the retention purge's own switch, then delete
    await sql.begin(async (tx) => { await tx`select set_config('ascentra.audit_purge', 'on', true)`; await tx`delete from audit_events`; });
    await sql`delete from organizations`;
    await sql`delete from users`;
    await sql`delete from bot_ip_ranges`;
    jobs = await import('../src/services/crawlers/jobs');
    ranges = await import('../src/services/crawlers/ranges');
    const { sha256 } = await import('../src/lib/crypto');
    // DNS from a table: Bing's address outside its list has a confirmed msn.com name; nothing else has a name
    jobs.setJobDns({
      reverse: async (ip: string) => {
        if (ip === '40.77.170.1') return ['msnbot-40-77-170-1.search.msn.com'];
        throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
      },
      resolve: async (host: string) => (host === 'msnbot-40-77-170-1.search.msn.com' ? ['40.77.170.1'] : []),
    });
    const user = async (email: string) => (await sql<{ id: string }[]>`insert into users (email, name, email_verified_at) values (${email}, ${email}, now()) returning id`)[0].id;
    ids.owner = await user('owner@a.example');
    ids.viewer = await user('viewer@a.example');
    ids.member = await user('member@a.example');
    ids.other = await user('owner@b.example');
    const org = async (name: string) => (await sql<{ id: string }[]>`insert into organizations (name, slug, hook_token, monthly_budget_usd) values (${name}, ${name.toLowerCase()}, ${sha256(name)}, 25) returning id`)[0].id;
    ids.orgA = await org('A');
    ids.orgB = await org('B');
    for (const [u, o, r] of [[ids.owner, ids.orgA, 'owner'], [ids.viewer, ids.orgA, 'viewer'], [ids.member, ids.orgA, 'member'], [ids.other, ids.orgB, 'owner']] as const)
      await sql`insert into memberships (org_id, user_id, role) values (${o}, ${u}, ${r})`;
    const site = async (o: string, domain: string, verified: boolean) =>
      (await sql<{ id: string }[]>`insert into sites (org_id, domain, country, verification_token, verified_at) values (${o}, ${domain}, 'United Arab Emirates', ${'t' + domain}, ${verified ? new Date().toISOString() : null}) returning id`)[0].id;
    ids.siteA = await site(ids.orgA, 'techand.example', true);
    ids.siteU = await site(ids.orgA, 'unverified.example', false);
    ids.siteB = await site(ids.orgB, 'other.example', true);
    for (const [who, uid] of [['owner', ids.owner], ['viewer', ids.viewer], ['member', ids.member], ['other', ids.other]] as const) {
      const token = `tok-${who}-${Math.random().toString(36).slice(2)}`;
      cookie[who] = token;
      await sql`insert into sessions (id, user_id, expires_at) values (${sha256(token)}, ${uid}, now() + interval '1 day')`;
    }
    apiKey = 'asc_' + 'A'.repeat(43);
    await sql`insert into api_keys (org_id, name, prefix, token_hash, scopes) values (${ids.orgA}, 'test', ${apiKey.slice(0, 12)}, ${sha256(apiKey)}, ${JSON.stringify(['read'])}::jsonb)`;
    inventory.length = 0;
    inventory.push(
      { site_id: 'site_techand-example', url: 'https://www.techand.example/services/ai-consulting/', title: 'AI consulting', h1: '', source: 'sitemap', lastmod: '', queries_json: '[]', updated_at: '', clicks: 50, impressions: 900 } as SitePageRow,
      { site_id: 'site_techand-example', url: 'https://www.techand.example/pricing', title: 'Pricing', h1: '', source: 'sitemap', lastmod: '', queries_json: '[]', updated_at: '', clicks: 30, impressions: 400 } as SitePageRow,
      { site_id: 'site_techand-example', url: 'https://techand.example/never-fetched', title: 'Never', h1: '', source: 'crawl', lastmod: '', queries_json: '[]', updated_at: '', clicks: 0, impressions: 10 } as SitePageRow,
    );
    const { buildApp } = await import('../src/app');
    app = await buildApp();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('an upload is spooled, queued (202) and read by the worker: verified, spoofed, claimed and unchecked are told apart', async () => {
    const r = await req('member', 'POST', `${base(ids.siteA)}/upload?name=access.log`, { raw: recent(fx('nginx-combined.log')) });
    expect(r.statusCode).toBe(202);
    expect(r.json()).toMatchObject({ duplicate: false, ingest: { status: 'queued', source: 'upload', fileName: 'access.log' } });
    expect(await jobs.drain()).toBe(1);
    const [row] = await sql<{ status: string; format: string; stats: Record<string, number>; spool_path: string }[]>`select status, format, stats, spool_path from log_ingests where id = ${r.json().ingest.id}`;
    expect(row).toMatchObject({ status: 'done', format: 'combined', spool_path: '' });
    expect((await auditOf('crawler.log_uploaded')).length).toBe(1);
    expect(row.stats).toMatchObject({ lines: 25, malformed: 2, people: 3, bots: 20, verified: 15, spoofed: 3, claimed: 1, unchecked: 1, proxyAddresses: 1, duplicates: 0 });
    // nothing of a person is stored, and no address at all
    const stored = await sql<{ n: string }[]>`select count(*) as n from crawler_hits where site_id = ${ids.siteA}`;
    expect(Number(stored[0].n)).toBe(20);
    const nets = await sql<{ net: string | null; verification: string }[]>`select distinct net, verification from crawler_hits where site_id = ${ids.siteA} order by net`;
    for (const n of nets) {
      if (n.verification === 'verified') expect(n.net).toBeNull();
      else if (n.net) expect(n.net).toMatch(/\/(24|48)$/);
    }
  });

  it('the same file again is not read twice; an overlapping file counts its shared lines once', async () => {
    const again = await req('member', 'POST', `${base(ids.siteA)}/upload?name=access.log.1`, { raw: recent(fx('nginx-combined.log')) });
    expect(again.statusCode).toBe(200);
    expect(again.json().duplicate).toBe(true);
    const overlap = recent(fx('apache-vhost.log')) + recent(fx('nginx-combined.log')).split('\n').slice(0, 3).join('\n') + '\n';
    const r = await req('member', 'POST', `${base(ids.siteA)}/upload?name=mixed.log.gz`, { raw: gzipSync(overlap) });
    expect(r.statusCode).toBe(202);
    await jobs.drain();
    const [row] = await sql<{ stats: Record<string, number>; status: string }[]>`select stats, status from log_ingests where id = ${r.json().ingest.id}`;
    expect(row.status).toBe('done');
    expect(row.stats).toMatchObject({ otherHost: 1, bots: 6, duplicates: 3 });
  });

  it('access: another company 404, viewer cannot upload, a missing CSRF header 403, an unverified website 403', async () => {
    expect((await req('other', 'GET', base(ids.siteA))).statusCode).toBe(404);
    expect((await req('other', 'GET', base(ids.siteA, ids.orgB))).statusCode).toBe(404);
    expect((await req('other', 'POST', `${base(ids.siteA)}/upload`, { raw: 'x' })).statusCode).toBe(404);
    expect((await req('viewer', 'POST', `${base(ids.siteA)}/upload`, { raw: 'x' })).statusCode).toBe(403);
    expect((await req('member', 'POST', `${base(ids.siteA)}/upload`, { raw: 'x', csrf: false })).statusCode).toBe(403);
    expect((await req('member', 'POST', `${base(ids.siteU)}/upload`, { raw: 'x' })).statusCode).toBe(403);
    expect((await req('viewer', 'GET', base(ids.siteU))).statusCode).toBe(403);
    expect((await req(null, 'GET', base(ids.siteA))).statusCode).toBe(401);
    expect((await req('viewer', 'PUT', `${base(ids.siteA)}/settings`, { body: { retentionDays: 7 } })).statusCode).toBe(403);
    expect((await req('member', 'POST', `${base(ids.siteA)}/push-key`)).statusCode).toBe(403);
  });

  it('the Crawlers answer: per-crawler counts with spoofers apart, waste, coverage against the inventory, AI demand', async () => {
    const r = await req('viewer', 'GET', `${base(ids.siteA)}?days=30`);
    expect(r.statusCode).toBe(200);
    const d = r.json() as CrawlerData;
    expect(d.hasData).toBe(true);
    const bot = (k: string) => d.bots.find((b) => b.bot === k)!;
    expect(bot('gptbot')).toMatchObject({ hits: 1, verified: 1, spoofed: 1, method: 'ip_list' });
    expect(bot('googlebot').spoofed).toBe(2);
    expect(bot('bytespider')).toMatchObject({ claimed: 1, method: 'none' });
    expect(bot('bingbot').verified).toBe(2);
    expect(d.totals.spoofed).toBe(3);
    expect(d.spoofed.find((s) => s.bot === 'gptbot')).toMatchObject({ hits: 1, networks: 1, topNetworks: ['45.133.1.0/24'] });
    expect(d.waste).toMatchObject({ redirects: 1, clientErrors: 1, serverErrors: 1, paramHits: 1 });
    expect(d.waste.top.map((t) => t.reason)).toEqual(expect.arrayContaining(['3xx', '5xx', 'param']));
    expect(d.waste.paramPatterns).toEqual([{ path: '/blog/e-invoicing-uae', keys: 'page,utm_source', hits: 1 }]);
    expect(d.coverage).toMatchObject({ source: 'inventory', inventory: 3, inSitemap: 2, fetchedByGoogle: 1, fetchedByAi: 2 });
    expect(d.coverage.neverGoogle.map((p) => p.path)).toEqual(['/pricing', '/never-fetched']);
    expect(d.coverage.neverAi.map((p) => p.path)).toEqual(['/never-fetched']);
    expect(d.aiDemand[0]).toMatchObject({ path: '/pricing', hits: 2 });
    expect(d.aiDemand[0].bots.sort()).toEqual(['ChatGPT-User', 'Claude-User']);
    expect(d.recommendations.map((x) => x.id)).toEqual(expect.arrayContaining(['spoofed', 'ai-demand', 'google-missed']));
    expect(d.setup.endpoint).toContain(`/api/ingest/logs/${ids.siteA}`);
    expect(d.setup.ranges.find((x) => x.id === 'openai-gptbot')!.prefixes).toBeGreaterThan(0);
    expect(d.ingests.length).toBeGreaterThanOrEqual(2);
    const daily = d.daily.find((x) => x.day === isoDay(daysAgo(2)))!;
    expect(daily.spoofed).toBe(3);
    expect(daily.googlebot).toBeGreaterThan(0);
  });

  it('Cloudflare Logpush: the push key is shown once, a gzip NDJSON batch is accepted, a retried batch is not counted twice', async () => {
    const push = (siteId: string, body: Buffer | string, key?: string, type = 'application/x-ndjson') =>
      app.inject({ method: 'POST', url: `/api/ingest/logs/${siteId}`, headers: { 'content-type': type, ...(key ? { 'x-alaventra-log-key': key } : {}) }, payload: body });
    expect((await push(ids.siteA, 'x')).statusCode).toBe(401);
    const k = await req('owner', 'POST', `${base(ids.siteA)}/push-key`);
    expect(k.statusCode).toBe(200);
    const key = k.json().token as string;
    expect(key).toMatch(/^asl_[A-Za-z0-9_-]{43}$/);
    const made = await auditOf('crawler.push_key_created');
    expect(made.length).toBe(1);
    expect(JSON.stringify(made)).not.toContain(key);
    const [stored] = await sql<{ push_key_hash: string }[]>`select push_key_hash from log_sources where site_id = ${ids.siteA}`;
    expect(stored.push_key_hash).not.toContain(key);
    // Cloudflare's destination test
    expect((await push(ids.siteA, gzipSync('{"content":"tests"}'), key)).statusCode).toBe(200);
    const body = gzipSync(recent(fx('cloudflare-logpush.ndjson')));
    const r = await push(ids.siteA, body, key);
    expect(r.statusCode).toBe(200);
    await jobs.drain();
    const [row] = await sql<{ stats: Record<string, number>; status: string; format: string }[]>`select stats, status, format from log_ingests where id = ${r.json().ingestId}`;
    expect(row).toMatchObject({ status: 'done', format: 'json' });
    expect(row.stats).toMatchObject({ malformed: 1, otherHost: 1, people: 1, bots: 5, duplicates: 1, spoofed: 1 });
    const retry = await push(ids.siteA, body, key);
    expect(retry.json()).toMatchObject({ ok: true, duplicate: true });
    // the key of one website does not open another, an unverified one, or a made-up one
    expect((await push(ids.siteB, body, key)).statusCode).toBe(401);
    expect((await push('not-a-uuid', body, key)).statusCode).toBe(401);
    // a Vercel drain (JSON array, sent as application/json) on the same endpoint
    const v = await push(ids.siteA, recent(fx('vercel-drain.json')), key, 'application/json');
    expect(v.statusCode).toBe(200);
    await jobs.drain();
    const [vr] = await sql<{ stats: Record<string, number> }[]>`select stats from log_ingests where id = ${v.json().ingestId}`;
    expect(vr.stats).toMatchObject({ bots: 1, verified: 1 });
    const d = (await req('viewer', 'GET', base(ids.siteA))).json() as CrawlerData;
    expect(d.blocked).toEqual([{ bot: 'oai-searchbot', label: 'OAI-SearchBot', hits: 1, refused: 1 }]);
    expect(d.recommendations.map((x) => x.id)).toContain('ai-refused-oai-searchbot');
    expect(d.setup.push).toMatchObject({ enabled: true, prefix: key.slice(0, 12) });
    expect(d.setup.push.pushes24h).toBeGreaterThanOrEqual(3);
    // revoked: refused from the next push
    expect((await req('owner', 'DELETE', `${base(ids.siteA)}/push-key`)).statusCode).toBe(200);
    expect((await push(ids.siteA, body, key)).statusCode).toBe(401);
    expect((await auditOf('crawler.push_key_revoked')).length).toBe(1);
  });

  it('a broken gzip fails its job with a plain reason and leaves no spool file', async () => {
    const good = gzipSync(recent(fx('iis-w3c.log')));
    const r = await req('member', 'POST', `${base(ids.siteA)}/upload?name=cut.log.gz`, { raw: good.subarray(0, Math.floor(good.length / 2)) });
    expect(r.statusCode).toBe(202);
    await jobs.drain();
    const [row] = await sql<{ status: string; error: string; spool_path: string }[]>`select status, error, spool_path from log_ingests where id = ${r.json().ingest.id}`;
    expect(row.status).toBe('failed');
    expect(row.error).toMatch(/not a complete gzip/);
    expect(row.spool_path).toBe('');
  });

  it('CSV exports and the read API carry the same data; another company is a 404 there too', async () => {
    const csv = await req('viewer', 'GET', `${base(ids.siteA)}/export?kind=daily&days=7`);
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="techand\.example-crawlers-daily-/);
    expect(csv.body.split('\r\n')[0]).toBe('day_utc,crawler,kind,verification,requests,ok_2xx,redirects_3xx,client_errors_4xx,server_errors_5xx,parameter_urls,asset_requests,bytes,avg_response_ms');
    const hits = await req('viewer', 'GET', `${base(ids.siteA)}/export?kind=hits`);
    expect(hits.body).toContain('GPTBot,spoofed');
    expect(hits.body).not.toMatch(/45\.133\.1\.20\b/);
    const { toCsv } = await import('../src/services/crawlers/analytics');
    expect(toCsv(['a'], [['=HYPERLINK("x")'], ['+1'], ['plain']])).toBe('a\r\n"\'=HYPERLINK(""x"")"\r\n\'+1\r\nplain\r\n');
    const v1 = await app.inject({ method: 'GET', url: `/api/v1/websites/${ids.siteA}/crawlers?days=7`, headers: { authorization: `Bearer ${apiKey}` } });
    expect(v1.statusCode).toBe(200);
    expect((v1.json() as CrawlerData).totals.spoofed).toBeGreaterThan(0);
    expect((await app.inject({ method: 'GET', url: `/api/v1/websites/${ids.siteB}/crawlers`, headers: { authorization: `Bearer ${apiKey}` } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/websites/${ids.siteU}/crawlers`, headers: { authorization: `Bearer ${apiKey}` } })).statusCode).toBe(403);
    const mcp = await app.inject({ method: 'POST', url: '/api/v1/mcp', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(mcp.json().result.tools.map((t: { name: string }) => t.name)).toContain('get_crawler_activity');
  });

  it('retention: raw rows older than the setting go, the daily totals stay', async () => {
    expect((await req('owner', 'PUT', `${base(ids.siteA)}/settings`, { body: { retentionDays: 14 } })).statusCode).toBe(400);
    expect((await req('owner', 'PUT', `${base(ids.siteA)}/settings`, { body: { retentionDays: 7 } })).json()).toEqual({ retentionDays: 7 });
    expect((await auditOf('crawler.retention_changed'))[0]?.details).toMatchObject({ retentionDays: 7 });
    await sql`insert into crawler_hits (site_id, at, bot, verification, path, status, line_hash) values (${ids.siteA}, now() - interval '10 days', 'googlebot', 'verified', '/old', 200, ${Buffer.from('old-line-hash-01')})`;
    await sql`insert into crawler_daily (site_id, day, bot, verification, hits) values (${ids.siteA}, current_date - 10, 'googlebot', 'verified', 1) on conflict do nothing`;
    const r = await jobs.cleanup();
    expect(r.hits).toBe(1);
    expect((await sql`select 1 from crawler_daily where site_id = ${ids.siteA} and day = current_date - 10`).length).toBe(1);
  });

  it('deleting the data needs the domain typed and an admin; then nothing is left', async () => {
    expect((await req('member', 'DELETE', `${base(ids.siteA)}/data`, { body: { confirm: 'techand.example' } })).statusCode).toBe(403);
    expect((await req('owner', 'DELETE', `${base(ids.siteA)}/data`, { body: { confirm: 'nope' } })).statusCode).toBe(400);
    const r = await req('owner', 'DELETE', `${base(ids.siteA)}/data`, { body: { confirm: 'techand.example' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().deleted.requests).toBeGreaterThan(0);
    expect((await auditOf('crawler.data_deleted')).length).toBe(1);
    for (const t of ['crawler_hits', 'crawler_daily', 'crawler_page_daily', 'log_ingests']) expect((await sql.unsafe(`select 1 from ${t} where site_id = $1`, [ids.siteA])).length).toBe(0);
    expect(((await req('viewer', 'GET', base(ids.siteA))).json() as CrawlerData).hasData).toBe(false);
  });

  it('a large file is read in batches without blocking the server (event-loop lag stays low)', async () => {
    const lines = Number(process.env.CRAWLER_PERF_LINES ?? 100_000);
    const dir = mkdtempSync(join(tmpdir(), 'crawl-perf-'));
    const file = join(dir, 'big.log');
    const w = createWriteStream(file);
    const day = clf(daysAgo(1));
    const uas = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'];
    for (let i = 0; i < lines; i++) {
      const bot = i % 10 === 0 ? (i % 20 === 0 ? 1 : 2) : 0;
      const ip = bot === 1 ? `66.249.64.${i % 30}` : bot === 2 ? `132.196.86.${i % 200}` : `198.51.${(i >> 8) & 255}.${i & 255}`;
      const t = `${String(Math.floor(i / 3600) % 24).padStart(2, '0')}:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
      if (!w.write(`${ip} - - [${day}:${t} +0000] "GET /p/${i % 5000}?i=${i} HTTP/1.1" 200 ${1000 + (i % 900)} "-" "${uas[bot]}" 0.0${i % 90}\n`)) await new Promise<void>((r) => w.once('drain', () => r()));
    }
    await new Promise<void>((r) => w.end(() => r()));
    const spooled = await jobs.spool(createReadStream(file), 2 ** 31);
    await jobs.queueIngest({ orgId: ids.orgA, siteId: ids.siteA, source: 'upload', fileName: 'big.log', createdBy: ids.owner, spooled });
    let maxLag = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      maxLag = Math.max(maxLag, now - last - 20);
      last = now;
    }, 20);
    const t0 = Date.now();
    await jobs.drain();
    clearInterval(timer);
    const ms = Date.now() - t0;
    const [row] = await sql<{ stats: Record<string, number>; status: string }[]>`select stats, status from log_ingests where file_name = 'big.log'`;
    expect(row.status).toBe('done');
    expect(row.stats.lines).toBe(lines);
    expect(row.stats.bots).toBe(lines / 10);
    console.log(`[perf] ${lines.toLocaleString('en-US')} lines in ${ms} ms (${Math.round(lines / (ms / 1000)).toLocaleString('en-US')} lines/s), max event-loop lag ${maxLag} ms`);
    expect(maxLag).toBeLessThan(500);
  }, 600_000);

  it('the IP-list refresh keeps the previous list when a vendor answers an error or a list that shrank to almost nothing', async () => {
    const snap = JSON.parse(readFileSync(new URL('../src/services/crawlers/ranges.snapshot.json', import.meta.url), 'utf8')) as { sources: Record<string, { prefixes: string[] }> };
    const r = await ranges.refreshRanges(async (url) => {
      if (url.includes('googlebot.json')) return { ok: true, status: 200, text: async () => JSON.stringify({ prefixes: [{ ipv4Prefix: '1.2.3.0/24' }] }) };
      if (url.includes('bingbot.json')) return { ok: false, status: 503, text: async () => '' };
      const id = Object.entries({ amazon: 'amazonbot', 'cloudflare-v4': 'ips-v4', 'cloudflare-v6': 'ips-v6' }).find(([, frag]) => url.includes(frag))?.[0];
      if (id === 'amazon') return { ok: true, status: 200, text: async () => `<pre><code>${JSON.stringify({ prefixes: snap.sources.amazon.prefixes.map((p) => ({ ipv4Prefix: p })) })}</code></pre>` };
      if (id) return { ok: true, status: 200, text: async () => snap.sources[id].prefixes.join('\n') };
      const src = (await import('@seo/shared')).RANGE_SOURCES.find((s) => s.url === url)!;
      return { ok: true, status: 200, text: async () => JSON.stringify({ creationTime: 'test', prefixes: snap.sources[src.id].prefixes.map((p) => (p.includes(':') ? { ipv6Prefix: p } : { ipv4Prefix: p })) }) };
    });
    expect(r.failed.sort()).toEqual(['bing', 'google-common']);
    expect(ranges.inSource('google-common', '66.249.64.5')).toBe(true);
    expect(ranges.inSource('google-common', '1.2.3.4')).toBe(false);
    const st = ranges.rangeStatus();
    expect(st.find((s) => s.id === 'google-common')!.error).toMatch(/shrank/);
    expect(st.find((s) => s.id === 'bing')!.error).toMatch(/503/);
    expect(st.find((s) => s.id === 'openai-gptbot')!.creationTime).toBe('test');
  });

  it('a job interrupted by a restart is queued again when its file survived, failed when it did not', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crawl-rec-'));
    const f = join(dir, 'x.log');
    writeFileSync(f, recent(fx('iis-w3c.log')));
    const { hostname } = await import('node:os');
    const [a] = await sql<{ id: string }[]>`insert into log_ingests (org_id, site_id, source, status, host, spool_path, sha256) values (${ids.orgA}, ${ids.siteA}, 'upload', 'processing', ${hostname()}, ${f}, 'rec-a') returning id`;
    const [b] = await sql<{ id: string }[]>`insert into log_ingests (org_id, site_id, source, status, host, spool_path, sha256) values (${ids.orgA}, ${ids.siteA}, 'upload', 'processing', ${hostname()}, ${join(dir, 'gone.log')}, 'rec-b') returning id`;
    await jobs.recover();
    const st = await sql<{ id: string; status: string }[]>`select id, status from log_ingests where id in (${a.id}, ${b.id})`;
    expect(Object.fromEntries(st.map((x) => [x.id, x.status]))).toEqual({ [a.id]: 'queued', [b.id]: 'failed' });
    await jobs.drain();
  });
});
