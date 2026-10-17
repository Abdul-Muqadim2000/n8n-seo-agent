import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { cmsUrlOk } from '@seo/shared';
import { config } from '../../config';
import { publicLookup } from '../verify';

/**
 * G2: the only place CMS publishing opens a socket. Every connector calls `cmsRequest`; the tests replace the transport and record
 * the requests (`setCmsTransport`).
 *
 * The SSRF guard is two layers deep. The address must pass `cmsUrlOk` (https, a public host name, no credentials in the URL) and the
 * connection's DNS lookup is pinned to public addresses (`publicLookup` from verify.ts: the address that was checked is the address
 * connected to, so a DNS answer that changes between the check and the connect cannot reach the network inside). Redirects are not
 * followed — a CMS that answers 3xx is reported with where it points, so the customer types that address instead. Bodies are capped.
 */

export interface CmsHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
}

export interface CmsHttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
  /** the body parsed as JSON, or null */
  json: unknown;
}

export type CmsTransport = (r: CmsHttpRequest) => Promise<CmsHttpResponse>;

export class CmsHttpError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;

const parseJson = (t: string): unknown => {
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

const nodeTransport: CmsTransport = (r) =>
  new Promise((resolve, reject) => {
    const allowPrivate = config.cmsAllowPrivateHosts;
    if (!cmsUrlOk(r.url, { allowPrivate })) return reject(new CmsHttpError('The CMS address must be https:// on a public host.'));
    const isHttps = /^https:/i.test(r.url);
    const send = isHttps ? httpsRequest : httpRequest;
    const body = r.body == null ? undefined : Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body, 'utf8');
    const headers: Record<string, string> = { 'user-agent': 'Ascentra-Publisher/1.0', accept: 'application/json', ...(r.headers ?? {}) };
    if (body) headers['content-length'] = String(body.length);
    const req = send(
      r.url,
      { method: r.method, headers, timeout: r.timeoutMs ?? 30_000, ...(allowPrivate ? {} : { lookup: publicLookup as never }) },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy(new CmsHttpError('The CMS answered with more than 5 MB.'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) if (v != null) h[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
          resolve({ status: res.statusCode ?? 0, headers: h, text, json: parseJson(text) });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new CmsHttpError('The CMS did not answer within 30 seconds.')));
    req.on('error', (err: NodeJS.ErrnoException) => {
      const host = r.url.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? 'the CMS';
      if (err instanceof CmsHttpError) return reject(err);
      if (err.code === 'EPRIVATE') return reject(new CmsHttpError(`${host} points to a private network address, which is not allowed.`));
      if (err.code === 'ENOTFOUND') return reject(new CmsHttpError(`${host} could not be found (DNS).`));
      if (err.code === 'ECONNREFUSED') return reject(new CmsHttpError(`${host} refused the connection.`));
      reject(new CmsHttpError(`${host} could not be reached (${err.code ?? err.message}).`));
    });
    if (body) req.write(body);
    req.end();
  });

let transport: CmsTransport = nodeTransport;

/** Tests only: replace the network. Returns the previous transport. */
export function setCmsTransport(t: CmsTransport | null): CmsTransport {
  const prev = transport;
  transport = t ?? nodeTransport;
  return prev;
}

export const cmsRequest = (r: CmsHttpRequest): Promise<CmsHttpResponse> => transport(r);
