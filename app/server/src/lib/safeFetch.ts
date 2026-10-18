import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { config } from '../config';
import { publicLookup } from '../services/verify';

/**
 * G1: a `fetch` for URLs a customer typed (their OIDC issuer): https only, the address connected to must be public (the DNS answer is
 * checked inside the connection itself, so a rebinding answer cannot slip through), no redirects followed, 1 MB and 10 s at most.
 * `SSO_ALLOW_PRIVATE_HOSTS=true` (a test IdP in the same Docker network) lifts the address check and allows http.
 */
const MAX_BYTES = 1024 * 1024;

export async function guardedFetch(url: string, init: { method?: string; headers?: Record<string, string> | Headers; body?: unknown; signal?: AbortSignal } = {}): Promise<Response> {
  const u = new URL(url);
  const allowPrivate = config.ssoAllowPrivateHosts;
  if (u.protocol !== 'https:' && !(allowPrivate && u.protocol === 'http:')) throw new Error('Only https addresses are allowed');
  const headers: Record<string, string> = {};
  if (init.headers instanceof Headers) init.headers.forEach((v, k) => (headers[k] = v));
  else Object.assign(headers, init.headers ?? {});
  let body: Buffer | undefined;
  if (typeof init.body === 'string') body = Buffer.from(init.body);
  else if (init.body instanceof URLSearchParams) body = Buffer.from(init.body.toString());
  else if (init.body instanceof Uint8Array) body = Buffer.from(init.body);
  if (body) headers['content-length'] = String(body.length);
  const request = u.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise<Response>((resolve, reject) => {
    const req = request(
      u,
      { method: init.method ?? 'GET', headers, lookup: allowPrivate ? undefined : (publicLookup as never), timeout: 10_000, signal: init.signal },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) return res.destroy(new Error('The answer is too large'));
          chunks.push(c);
        });
        res.on('error', reject);
        res.on('end', () => {
          const h = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (v != null) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
          const status = res.statusCode ?? 502;
          resolve(new Response([101, 204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers: h }));
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('The identity provider did not answer in time')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
