import { promises as dns, type LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { webhookUrlOk } from '@seo/shared';
import { config } from '../config';

/**
 * The SSRF guard for every request this server makes to an address a customer typed (G4, app/docs/INTEGRATIONS.md §2): event
 * webhooks, Slack / Teams channels, a Jira site, a storage endpoint. Two layers:
 *
 * 1. the address itself (`webhookUrlOk`, the report-delivery rule): https, no private / loopback / link-local / `.internal` name;
 * 2. the address CONNECTED TO: the DNS lookup of the connection refuses a name that resolves to a private address, and an IP
 *    literal is checked directly (Node skips `lookup` for literals, and the URL parser turns `https://2130706433/` into 127.0.0.1).
 *    Checking at connect time is what defeats DNS rebinding: a name that was public when it was saved and private now is refused.
 *
 * No redirect is followed (a 3xx is an answer, reported as such), and at most `maxBytes` of the answer is read.
 * `publicLookup` / `isPrivateIp` were first written for domain verification (services/verify.ts), which now imports them from here.
 */

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') || l.startsWith('64:ff9b');
}

/** DNS lookup for an outbound connection: only public addresses (the address checked is the address connected to). */
export function publicLookup(hostname: string, options: object, cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dns
    .lookup(hostname, { all: true })
    .then((addrs) => {
      const ok = addrs.filter((a) => !isPrivateIp(a.address));
      if (!ok.length || ok.length !== addrs.length) return cb(Object.assign(new Error(`${hostname} resolves to a private address`), { code: 'EPRIVATE' }), '', 4);
      if ((options as { all?: boolean }).all) return cb(null, ok);
      cb(null, ok[0].address, ok[0].family);
    })
    .catch((err) => cb(err, '', 4));
}

export interface OutRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  /** read at most this much of the answer (default 1 MB) */
  maxBytes?: number;
}
export interface OutResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}

export class OutboundRefused extends Error {
  code = 'EREFUSED_ADDRESS';
}

/** Is this an address we may connect to at all (before DNS)? http only to the developer's own machine, outside production. */
export function outboundUrlOk(url: string): boolean {
  if (!webhookUrlOk(url)) return false;
  if (/^http:/i.test(url)) return !config.isProd;
  return true;
}

async function guardedSend(req: OutRequest): Promise<OutResponse> {
  if (!outboundUrlOk(req.url)) throw new OutboundRefused('This address is not allowed: it must be https on a public host');
  let u: URL;
  try {
    u = new URL(req.url);
  } catch {
    throw new OutboundRefused('This is not a valid address');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const local = u.protocol === 'http:';
  if (!local && isIP(host) && isPrivateIp(host)) throw new OutboundRefused('This address points inside a private network');
  const maxBytes = req.maxBytes ?? 1024 * 1024;
  const send = local ? httpRequest : httpsRequest;
  return new Promise<OutResponse>((resolve, reject) => {
    const r = send(
      u,
      { method: req.method, headers: { 'user-agent': `${config.brand.replace(/[^\w .-]/g, '') || 'Alaventra'}-Integrations/1.0`, ...(req.headers ?? {}) }, ...(local ? {} : { lookup: publicLookup as never }), timeout: req.timeoutMs ?? 15_000 },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size <= maxBytes) chunks.push(c);
          else res.destroy();
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v ?? '')])),
            text: Buffer.concat(chunks).toString('utf8'),
          });
        res.on('end', done);
        res.on('close', done);
        res.on('error', reject);
      },
    );
    r.on('timeout', () => r.destroy(new Error('timed out')));
    r.on('error', reject);
    if (req.body != null) r.write(req.body);
    r.end();
  });
}

/** The one way out. Tests replace `transport.send` with a recorder of the vendor's documented answers. */
export const transport = { send: guardedSend };
export const outbound = (req: OutRequest): Promise<OutResponse> => transport.send(req);

/** An error message fit for a log line and the UI: no address query strings, no tokens, cut short. */
export function safeError(err: unknown): string {
  const m = String((err as Error)?.message || err || 'unknown error');
  return m.replace(/https?:\/\/\S+/g, (x) => x.replace(/[?#].*$/, '').replace(/\/[^/]{24,}/g, '/…')).slice(0, 300);
}
