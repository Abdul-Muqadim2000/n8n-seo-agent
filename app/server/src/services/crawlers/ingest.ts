import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import {
  classifyUserAgent,
  CRAWLER_LIMITS,
  hostIsSite,
  pathKind,
  splitTarget,
  type BotDef,
  type IngestStats,
  type LogFormat,
  type Verification,
} from '@seo/shared';
import { sqlClient } from '../../db';
import { detectFormat, lineParser, parseJsonObject, type LineResult, type LogRecord } from './parse';
import { loadRanges, networkOf } from './ranges';
import { pgDate } from './pgTime';
import { Verifier, type Dns } from './verify';

/**
 * One ingest (an uploaded file or a pushed batch) → crawler rows + daily totals (app/docs/LOG_ANALYTICS.md §4). Streams the spool
 * file (gzip or plain) line by line, keeps only crawler requests, verifies them in batches of 2,000 and writes each batch with one
 * multi-row insert, so a file of a million lines never holds more than one batch in memory and never blocks the event loop for long
 * (every batch awaits the database). A person's request is counted and dropped: no row, no address.
 */

const BATCH = 2000;
const sha16 = (s: string) => createHash('sha256').update(s).digest().subarray(0, 16);

interface Pending {
  rec: LogRecord;
  bot: BotDef;
  hashOf: string;
}

export function emptyStats(): IngestStats {
  return { lines: 0, malformed: 0, otherHost: 0, people: 0, bots: 0, duplicates: 0, verified: 0, spoofed: 0, claimed: 0, unchecked: 0, proxyAddresses: 0, firstAt: null, lastAt: null, samples: [] };
}

async function isGzip(path: string): Promise<boolean> {
  const fh = await open(path, 'r');
  try {
    const b = Buffer.alloc(2);
    const { bytesRead } = await fh.read(b, 0, 2, 0);
    return bytesRead === 2 && b[0] === 0x1f && b[1] === 0x8b;
  } finally {
    await fh.close();
  }
}

export interface IngestInput {
  ingestId: string;
  siteId: string;
  domain: string;
  path: string;
  dns?: Dns;
  /** progress callback every 50,000 lines (the worker writes it to the row so the page can show it) */
  onProgress?: (s: IngestStats) => Promise<void> | void;
}

export async function processIngestFile(input: IngestInput): Promise<{ stats: IngestStats; format: LogFormat; truncated: boolean }> {
  await loadRanges();
  const stats = emptyStats();
  const verifier = new Verifier(input.dns);
  let stream: Readable = createReadStream(input.path);
  if (await isGzip(input.path)) stream = stream.pipe(createGunzip());
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let streamError: Error | null = null;
  stream.on('error', (e) => {
    streamError = e;
    rl.close();
  });

  let format: LogFormat = 'unknown';
  let parse: ((l: string) => LineResult) | null = null;
  const head: string[] = [];
  let batch: Pending[] = [];
  let truncated = false;
  let first: number | null = null;
  let last: number | null = null;

  const bad = (reason: string) => {
    stats.malformed++;
    if (stats.samples.length < 5) stats.samples.push({ line: stats.lines, reason });
  };
  const take = async (r: LineResult, raw: string) => {
    if (r.kind === 'skip') return;
    if (r.kind === 'bad') return bad(r.reason);
    const rec = r.rec;
    if (!hostIsSite(rec.host, input.domain)) {
      stats.otherHost++;
      return;
    }
    const t = rec.at.getTime();
    first = first == null ? t : Math.min(first, t);
    last = last == null ? t : Math.max(last, t);
    const bot = classifyUserAgent(rec.ua);
    if (!bot) {
      stats.people++;
      return;
    }
    stats.bots++;
    if (rec.proxied) stats.proxyAddresses++;
    batch.push({ rec, bot, hashOf: rec.requestId ?? raw });
    if (batch.length >= BATCH) {
      const b = batch;
      batch = [];
      await writeBatch(input, b, verifier, stats);
    }
  };
  const handle = async (line: string) => {
    stats.lines++;
    const t = line.trim();
    // a JSON array on one line (Vercel's "JSON" drain format, a pretty small push)
    if (format === 'json' && t.startsWith('[') && t.endsWith(']') && t.length > 2) {
      let arr: unknown;
      try {
        arr = JSON.parse(t);
      } catch {
        return bad('unreadable JSON');
      }
      if (!Array.isArray(arr)) return bad('unreadable JSON');
      for (const o of arr) await take(parseJsonObject(o as Record<string, unknown>), JSON.stringify(o));
      return;
    }
    await take(parse!(line), line);
  };

  try {
    for await (const line of rl) {
      if (!parse) {
        head.push(line);
        if (head.length < 20) continue;
        format = detectFormat(head);
        parse = lineParser(format === 'unknown' ? 'combined' : format);
        for (const h of head.splice(0)) await handle(h);
        continue;
      }
      if (stats.lines >= CRAWLER_LIMITS.maxLines) {
        truncated = true;
        rl.close();
        stream.destroy();
        break;
      }
      await handle(line);
      if (stats.lines % 50_000 === 0 && input.onProgress) await input.onProgress(stats);
    }
  } catch (e) {
    // a broken gzip surfaces here (zlib's Z_* codes); anything else (the database) is not a file problem
    if (!streamError && !String((e as { code?: string }).code ?? '').startsWith('Z_')) throw e;
    streamError = streamError ?? (e as Error);
  }
  if (streamError) {
    const msg = String((streamError as Error).message || streamError);
    throw new Error(/incorrect header|unexpected end|invalid|unknown compression/i.test(msg) ? 'The file is not a complete gzip file. Upload it again, or upload it uncompressed.' : `The file could not be read: ${msg}`);
  }
  if (!parse) {
    format = detectFormat(head);
    parse = lineParser(format === 'unknown' ? 'combined' : format);
    for (const h of head.splice(0)) await handle(h);
  }
  if (batch.length) await writeBatch(input, batch, verifier, stats);
  stats.firstAt = first != null ? new Date(first).toISOString() : null;
  stats.lastAt = last != null ? new Date(last).toISOString() : null;
  return { stats, format, truncated };
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const REFUSED = new Set([401, 403, 429]);

async function writeBatch(input: IngestInput, batch: Pending[], verifier: Verifier, stats: IngestStats): Promise<void> {
  const verdicts: Verification[] = await verifier.verifyAll(batch.map((b) => ({ bot: b.bot, ip: b.rec.ip, proxied: b.rec.proxied })));
  const rows = batch.map((b, i) => {
    const v = verdicts[i];
    stats[v]++;
    const { path, queryKeys } = splitTarget(b.rec.target);
    return {
      site_id: input.siteId,
      ingest_id: input.ingestId,
      at: b.rec.at.toISOString(),
      bot: b.bot.key,
      verification: v,
      method: b.rec.method,
      path,
      query_keys: queryKeys,
      kind: pathKind(path),
      status: b.rec.status,
      bytes: b.rec.bytes,
      ms: b.rec.ms,
      // what is kept of an address that was not proved: its network, so a spoofer can be blocked; nothing for a proved crawler
      net: v === 'verified' || !b.rec.ip ? null : networkOf(b.rec.ip),
      line_hash: sha16(b.hashOf),
    };
  });
  type Ins = { at: Date | string; bot: string; verification: string; path: string; query_keys: string; kind: string; status: number; bytes: number | null; ms: number | null };
  const inserted = (await sqlClient`insert into crawler_hits ${sqlClient(rows as unknown as Record<string, unknown>[], 'site_id', 'ingest_id', 'at', 'bot', 'verification', 'method', 'path', 'query_keys', 'kind', 'status', 'bytes', 'ms', 'net', 'line_hash')}
    on conflict (site_id, line_hash) do nothing
    returning at, bot, verification, path, query_keys, kind, status, bytes, ms`) as unknown as Ins[];
  stats.duplicates += rows.length - inserted.length;
  if (!inserted.length) return;

  type D = { site_id: string; day: string; bot: string; verification: string; hits: number; s2xx: number; s3xx: number; s4xx: number; s5xx: number; refused: number; param_hits: number; asset_hits: number; bytes: number; ms_sum: number; ms_n: number };
  type P = { site_id: string; day: string; bot: string; path: string; hits: number; verified_hits: number; s3xx: number; s4xx: number; s5xx: number; param_hits: number; last_status: number; _at: number };
  const daily = new Map<string, D>();
  const pages = new Map<string, P>();
  for (const r of inserted) {
    const at = pgDate(r.at)!;
    const d = day(at);
    const dk = `${d}|${r.bot}|${r.verification}`;
    let a = daily.get(dk);
    if (!a) daily.set(dk, (a = { site_id: input.siteId, day: d, bot: r.bot, verification: r.verification, hits: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, refused: 0, param_hits: 0, asset_hits: 0, bytes: 0, ms_sum: 0, ms_n: 0 }));
    a.hits++;
    const cls = Math.floor(r.status / 100);
    if (cls === 2) a.s2xx++;
    else if (cls === 3) a.s3xx++;
    else if (cls === 4) a.s4xx++;
    else if (cls === 5) a.s5xx++;
    if (REFUSED.has(r.status)) a.refused++;
    if (r.query_keys) a.param_hits++;
    if (r.kind === 'asset') a.asset_hits++;
    a.bytes += Number(r.bytes ?? 0);
    if (r.ms != null) {
      a.ms_sum += r.ms;
      a.ms_n++;
    }
    if (r.verification === 'spoofed') continue;
    const pk = `${d}|${r.bot}|${r.path}`;
    let p = pages.get(pk);
    if (!p) pages.set(pk, (p = { site_id: input.siteId, day: d, bot: r.bot, path: r.path, hits: 0, verified_hits: 0, s3xx: 0, s4xx: 0, s5xx: 0, param_hits: 0, last_status: r.status, _at: 0 }));
    p.hits++;
    if (r.verification === 'verified') p.verified_hits++;
    if (cls === 3) p.s3xx++;
    else if (cls === 4) p.s4xx++;
    else if (cls === 5) p.s5xx++;
    if (r.query_keys) p.param_hits++;
    const t = at.getTime();
    if (t >= p._at) {
      p._at = t;
      p.last_status = r.status;
    }
  }
  // one lock order for every writer (two servers ingesting for one site at once never deadlock)
  const dRows = [...daily.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, v]) => v);
  const pRows = [...pages.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, v]) => {
    const { _at, ...rest } = v;
    void _at;
    return rest;
  });
  await sqlClient`insert into crawler_daily ${sqlClient(dRows as unknown as Record<string, unknown>[], 'site_id', 'day', 'bot', 'verification', 'hits', 's2xx', 's3xx', 's4xx', 's5xx', 'refused', 'param_hits', 'asset_hits', 'bytes', 'ms_sum', 'ms_n')}
    on conflict (site_id, day, bot, verification) do update set
      hits = crawler_daily.hits + excluded.hits, s2xx = crawler_daily.s2xx + excluded.s2xx, s3xx = crawler_daily.s3xx + excluded.s3xx,
      s4xx = crawler_daily.s4xx + excluded.s4xx, s5xx = crawler_daily.s5xx + excluded.s5xx, refused = crawler_daily.refused + excluded.refused,
      param_hits = crawler_daily.param_hits + excluded.param_hits, asset_hits = crawler_daily.asset_hits + excluded.asset_hits,
      bytes = crawler_daily.bytes + excluded.bytes, ms_sum = crawler_daily.ms_sum + excluded.ms_sum, ms_n = crawler_daily.ms_n + excluded.ms_n`;
  for (let i = 0; i < pRows.length; i += 5000) {
    const chunk = pRows.slice(i, i + 5000);
    await sqlClient`insert into crawler_page_daily ${sqlClient(chunk as unknown as Record<string, unknown>[], 'site_id', 'day', 'bot', 'path', 'hits', 'verified_hits', 's3xx', 's4xx', 's5xx', 'param_hits', 'last_status')}
      on conflict (site_id, day, bot, path) do update set
        hits = crawler_page_daily.hits + excluded.hits, verified_hits = crawler_page_daily.verified_hits + excluded.verified_hits,
        s3xx = crawler_page_daily.s3xx + excluded.s3xx, s4xx = crawler_page_daily.s4xx + excluded.s4xx, s5xx = crawler_page_daily.s5xx + excluded.s5xx,
        param_hits = crawler_page_daily.param_hits + excluded.param_hits, last_status = excluded.last_status`;
  }
}
