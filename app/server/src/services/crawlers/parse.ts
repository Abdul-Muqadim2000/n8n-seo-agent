import type { LogFormat } from '@seo/shared';
import { isCloudflareIp, isPrivateIp, normalizeIp } from './ranges';

/**
 * Access-log lines → request records (app/docs/LOG_ANALYTICS.md §2). Three families, detected from the first lines:
 *  - combined: Apache / Nginx "combined" and "common", with or without a leading vhost, with trailing extras (request time,
 *    "$http_x_forwarded_for")
 *  - w3c:      IIS / W3C extended and CloudFront standard logs (a `#Fields:` header names the columns; spaces or tabs)
 *  - json:     one JSON object per line (Cloudflare Logpush http_requests, Vercel log drains, Akamai DataStream 2, Fastly / Nginx
 *              JSON formats, a generic { timestamp, ip, method, path, status, bytes, user_agent }), or a JSON array of them
 * Pure: no I/O, so the fixture tests pin every rule.
 */

export interface LogRecord {
  at: Date;
  /** the visitor's address, after the proxy rule below; null when the log has none */
  ip: string | null;
  /** the address the server logged was its CDN's or a private one (and no forwarded address could replace it) */
  proxied: boolean;
  method: string;
  host: string | null;
  target: string;
  status: number;
  bytes: number | null;
  ua: string;
  ms: number | null;
  /** a request id when the format has one (Cloudflare RayID, Vercel requestId): the same request in two lines counts once */
  requestId: string | null;
}

export type LineResult = { kind: 'record'; rec: LogRecord } | { kind: 'skip' } | { kind: 'bad'; reason: string };

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** "10/Oct/2026:13:55:36 +0000" → Date */
export function parseClfTime(s: string): Date | null {
  const m = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*([+-])(\d{2}):?(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon == null) return null;
  const utc = Date.UTC(+m[3], mon, +m[1], +m[4], +m[5], +m[6]);
  const off = (+m[8] * 60 + +m[9]) * 60_000 * (m[7] === '+' ? 1 : -1);
  const d = new Date(utc - off);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** a number or numeric string in s / ms / µs / ns (by magnitude), or an ISO / CLF date string */
export function parseAnyTime(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const num = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null;
  if (num != null) {
    const ms = num > 1e17 ? num / 1e6 : num > 1e14 ? num / 1e3 : num > 1e11 ? num : num * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v !== 'string') return null;
  const clf = parseClfTime(v);
  if (clf) return clf;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

const unq = (s: string) => s.replace(/\\(["\\])/g, '$1').replace(/\\x([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
const dash = (s: string | undefined) => (s == null || s === '-' || s === '' ? null : s);

function decodeUa(s: string): string {
  if (!/%[0-9a-f]{2}/i.test(s)) return s;
  try {
    // CloudFront double-encodes ("%2520"); Akamai encodes once
    let out = decodeURIComponent(s);
    if (/%[0-9a-f]{2}/i.test(out)) out = decodeURIComponent(out);
    return out;
  } catch {
    return s;
  }
}

/**
 * The visitor's address. Behind a CDN or a load balancer the server logs the proxy; a forwarded-for list then holds the visitor.
 * Only the **rightmost** entry that is not a proxy is taken: that one was appended by the proxy itself, while everything to its
 * left came from the client and can be forged (an "X-Forwarded-For: 66.249.66.1" from a scraper must not pass as Googlebot).
 */
export function clientAddress(remote: string | null | undefined, forwarded?: string | null): { ip: string | null; proxied: boolean } {
  const r = normalizeIp(remote);
  const isProxy = (ip: string) => isPrivateIp(ip) || isCloudflareIp(ip);
  if (r && !isProxy(r)) return { ip: r, proxied: false };
  const chain = String(forwarded ?? '')
    .split(',')
    .map((x) => normalizeIp(x))
    .filter((x): x is string => !!x);
  for (let i = chain.length - 1; i >= 0; i--) if (!isProxy(chain[i])) return { ip: chain[i], proxied: false };
  return { ip: r, proxied: !!r };
}

function requestLine(req: string): { method: string; target: string } | null {
  const m = /^([A-Z]{3,10})\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/.exec(req.trim());
  if (!m) return null;
  return { method: m[1], target: m[2] };
}

function finish(p: Partial<Omit<LogRecord, 'at' | 'status' | 'target'>> & { at: Date | null; status: number | null; target: string | null }): LineResult {
  if (!p.at) return { kind: 'bad', reason: 'no readable time' };
  if (p.at.getTime() > Date.now() + 36 * 3600_000 || p.at.getTime() < Date.UTC(2000, 0, 1)) return { kind: 'bad', reason: 'time out of range' };
  if (!p.target) return { kind: 'bad', reason: 'no request path' };
  if (p.status == null || !(p.status >= 100 && p.status <= 599)) return { kind: 'bad', reason: 'no status code' };
  return {
    kind: 'record',
    rec: {
      at: p.at,
      ip: p.ip ?? null,
      proxied: !!p.proxied,
      method: (p.method || 'GET').toUpperCase().slice(0, 10),
      host: p.host ?? null,
      target: p.target,
      status: p.status,
      bytes: p.bytes != null && Number.isFinite(p.bytes) && p.bytes >= 0 ? Math.round(p.bytes) : null,
      ua: (p.ua ?? '').slice(0, 1000),
      ms: p.ms != null && Number.isFinite(p.ms) && p.ms >= 0 && p.ms < 3_600_000 ? Math.round(p.ms) : null,
      requestId: p.requestId ?? null,
    },
  };
}

// ---------------------------------------------------------------- combined / common

const QUOTED = '"((?:[^"\\\\]|\\\\.)*)"';
const AFTER_TIME = new RegExp(`^\\s+${QUOTED}\\s+(\\d{3}|-)\\s+(\\d+|-)(?:\\s+${QUOTED}\\s+${QUOTED})?(.*)$`);

export function parseCombined(line: string): LineResult {
  const open = line.indexOf(' [');
  const close = open >= 0 ? line.indexOf(']', open) : -1;
  if (open < 0 || close < 0) return { kind: 'bad', reason: 'not an access-log line' };
  const head = line.slice(0, open).trim().split(/\s+/);
  // ip ident user | vhost ip ident user (Apache vhost_combined, "%v:%p %h …")
  const ipTok = head.length >= 4 ? head[head.length - 3] : head[0];
  const host = head.length >= 4 ? head[0].replace(/:\d+$/, '') : null;
  const at = parseClfTime(line.slice(open + 2, close));
  const m = AFTER_TIME.exec(line.slice(close + 1));
  if (!m) return { kind: 'bad', reason: 'not an access-log line' };
  const req = requestLine(unq(m[1]));
  if (!req) return { kind: 'bad', reason: 'unreadable request line' };
  const extras = m[6] ?? '';
  // trailing extras: a quoted forwarded-for list and / or the request time ("0.123" seconds, Nginx $request_time; an integer is
  // Apache's %D in microseconds)
  const quoted = [...extras.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  const fwd = quoted.find((q) => /^[0-9a-f:.,\s]+$/i.test(q) && q.split(',').some((x) => normalizeIp(x)));
  const bare = extras.replace(/"[^"]*"/g, ' ').trim().split(/\s+/).filter(Boolean);
  let ms: number | null = null;
  for (const t of bare) {
    if (/^\d+\.\d+$/.test(t)) {
      ms = Number(t) * 1000;
      break;
    }
    if (/^\d+$/.test(t)) {
      ms = Number(t) / 1000;
      break;
    }
  }
  const addr = clientAddress(ipTok, fwd);
  return finish({
    at,
    ...addr,
    method: req.method,
    host,
    target: req.target,
    status: m[2] === '-' ? null : Number(m[2]),
    bytes: m[3] === '-' ? null : Number(m[3]),
    ua: m[5] != null ? unq(m[5]) : '',
    ms,
  });
}

// ---------------------------------------------------------------- W3C extended (IIS, CloudFront)

export interface W3cState {
  fields: string[] | null;
}

export function parseW3c(line: string, st: W3cState): LineResult {
  if (line.startsWith('#')) {
    const f = /^#Fields:\s*(.+)$/i.exec(line);
    if (f) st.fields = f[1].trim().split(/\s+/).map((x) => x.toLowerCase());
    return { kind: 'skip' };
  }
  if (!st.fields) return { kind: 'bad', reason: 'no #Fields header before this line' };
  const vals = line.includes('\t') ? line.split('\t') : line.split(' ');
  if (vals.length < st.fields.length) return { kind: 'bad', reason: 'fewer columns than the #Fields header' };
  const get = (...names: string[]) => {
    for (const n of names) {
      const i = st.fields!.indexOf(n);
      if (i >= 0) return dash(vals[i]);
    }
    return null;
  };
  const date = get('date');
  const time = get('time');
  const at = date && time ? parseAnyTime(`${date}T${time}Z`) : null;
  const stem = get('cs-uri-stem');
  const query = get('cs-uri-query');
  const ua = get('cs(user-agent)');
  const status = get('sc-status');
  const bytes = get('sc-bytes');
  const taken = get('time-taken');
  const ip = get('c-ip');
  const fwd = get('x-forwarded-for', 'cs(x-forwarded-for)');
  // IIS logs time-taken in milliseconds; CloudFront in seconds with decimals
  const ms = taken == null ? null : taken.includes('.') ? Number(taken) * 1000 : Number(taken);
  return finish({
    at,
    ...clientAddress(ip, fwd),
    method: get('cs-method') ?? 'GET',
    host: get('cs-host', 'cs(host)', 'x-host-header'),
    target: stem ? stem + (query ? `?${query}` : '') : null,
    status: status ? Number(status) : null,
    bytes: bytes ? Number(bytes) : null,
    ua: ua ? decodeUa(ua.replace(/\+/g, ' ')) : '',
    ms,
  });
}

// ---------------------------------------------------------------- JSON lines

type Obj = Record<string, unknown>;
function pick(o: Obj, keys: string[]): unknown {
  for (const k of keys) {
    let v: unknown = o;
    for (const part of k.split('.')) v = v && typeof v === 'object' ? (v as Obj)[part] : undefined;
    if (v !== undefined && v !== null && v !== '' && v !== '-') return v;
  }
  return undefined;
}
const asNum = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);
const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : Array.isArray(v) ? (typeof v[0] === 'string' ? v[0] : null) : null);

export function parseJsonObject(o: Obj): LineResult {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { kind: 'bad', reason: 'not a JSON object' };
  // a Vercel build or function log without the request it belongs to; Cloudflare's destination test file ({"content":"tests"})
  if (('deploymentId' in o && !('proxy' in o)) || (Object.keys(o).length === 1 && 'content' in o)) return { kind: 'skip' };
  const at = parseAnyTime(pick(o, ['EdgeStartTimestamp', 'proxy.timestamp', 'timestamp', '@timestamp', 'time_iso8601', 'time', 'time_local', 'reqTimeSec', 'start_time', 'date', 'datetime']));
  const request = asStr(pick(o, ['request']));
  const rl = request ? requestLine(request) : null;
  let target = asStr(pick(o, ['ClientRequestURI', 'proxy.path', 'request_uri', 'uri', 'url', 'path', 'reqPath', 'cs-uri-stem'])) ?? rl?.target ?? null;
  const qs = asStr(pick(o, ['queryStr', 'query_string', 'args', 'cs-uri-query']));
  if (target && qs && !target.includes('?')) target += `?${qs}`;
  if (target && !target.startsWith('/') && !/^[a-z]+:\/\//i.test(target)) target = `/${target}`;
  const status = asNum(pick(o, ['EdgeResponseStatus', 'proxy.statusCode', 'status', 'status_code', 'statusCode', 'sc-status', 'OriginResponseStatus']));
  const remote = asStr(pick(o, ['ClientIP', 'proxy.clientIp', 'client_ip', 'clientIp', 'remote_addr', 'cliIP', 'ip', 'client.ip', 'c-ip', 'clientip']));
  const fwd = asStr(pick(o, ['http_x_forwarded_for', 'x_forwarded_for', 'xForwardedFor']));
  const msDirect = asNum(pick(o, ['OriginResponseDurationMs', 'response_time_ms', 'duration_ms', 'time_elapsed_ms', 'time_taken_ms', 'turnAroundTimeMSec', 'EdgeTimeToFirstByteMs', 'latency_ms']));
  const secs = asNum(pick(o, ['request_time', 'response_time']));
  const micros = asNum(pick(o, ['time_elapsed', 'duration_us']));
  const ms = msDirect ?? (secs != null ? secs * 1000 : micros != null ? micros / 1000 : null);
  const rayId = asStr(pick(o, ['RayID']));
  const reqId = asStr(pick(o, ['requestId', 'request_id']));
  return finish({
    at,
    ...clientAddress(remote, fwd),
    method: asStr(pick(o, ['ClientRequestMethod', 'proxy.method', 'method', 'request_method', 'reqMethod', 'cs-method'])) ?? rl?.method ?? 'GET',
    host: asStr(pick(o, ['ClientRequestHost', 'proxy.host', 'host', 'reqHost', 'http_host', 'hostname'])),
    target,
    status,
    bytes: asNum(pick(o, ['EdgeResponseBytes', 'proxy.responseByteSize', 'totalBytes', 'bytes', 'body_bytes_sent', 'bytes_sent', 'response_body_size', 'response_size', 'size', 'sc-bytes'])),
    ua: decodeUa(asStr(pick(o, ['ClientRequestUserAgent', 'proxy.userAgent', 'user_agent', 'userAgent', 'http_user_agent', 'UA', 'ua', 'useragent'])) ?? ''),
    ms,
    requestId: rayId ? `cf:${rayId}` : reqId ? `id:${reqId}` : null,
  });
}

export function parseJsonLine(line: string): LineResult {
  let o: unknown;
  try {
    o = JSON.parse(line);
  } catch {
    return { kind: 'bad', reason: 'unreadable JSON' };
  }
  return parseJsonObject(o as Obj);
}

// ---------------------------------------------------------------- detection

/** The family of a file from its first non-empty lines (a mixed file is read line by line in the family found first). */
export function detectFormat(lines: string[]): LogFormat {
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (/^#(Software|Version|Fields|Date)\b/i.test(l)) return 'w3c';
    if (l.startsWith('{') || l.startsWith('[')) return 'json';
    if (/\s\[\d{1,2}\/[A-Za-z]{3}\/\d{4}:/.test(l)) return 'combined';
  }
  return 'unknown';
}

/** One parser per ingest, holding the W3C header state. */
export function lineParser(format: LogFormat): (line: string) => LineResult {
  const st: W3cState = { fields: null };
  return (raw: string) => {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) return { kind: 'skip' };
    if (format === 'w3c') return parseW3c(line, st);
    if (format === 'json') {
      const t = line.trim();
      if (t === '[' || t === ']') return { kind: 'skip' };
      return parseJsonLine(t.replace(/,$/, ''));
    }
    if (line.startsWith('#')) return { kind: 'skip' };
    return parseCombined(line);
  };
}
