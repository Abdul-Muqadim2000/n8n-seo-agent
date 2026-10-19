import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

/**
 * deploy/gcp (the web front end on Vercel, this server on api.<domain>): what a split between two hosts of ONE site needs.
 *
 * Most requests come through the front end's own /api proxy (same origin: nothing here applies). Large uploads go to api.<domain>
 * directly, because a proxy in front has body-size and time limits, so for those the browser makes a cross-origin request WITH the
 * session cookie:
 *  - the cookie must reach api.<domain>: it is set with Domain=<COOKIE_DOMAIN> (app.<domain> and api.<domain> are the same site, so
 *    SameSite=Lax still sends it), but only on hosts inside that domain: an agency's portal host keeps host-only cookies;
 *  - the browser must be allowed to read the answer: CORS with credentials, for the listed origins only (CORS_ORIGINS), never `*`;
 *  - CSRF stays what it was: a state-changing request needs X-Requested-With, which a cross-site form cannot send and a cross-origin
 *    script can send only after a preflight this server answers for the listed origins alone.
 */

const hostOf = (raw: string | undefined) =>
  String(raw ?? '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

/** Domain attribute for a cookie set on this request's host: COOKIE_DOMAIN when the host is it or under it, else none (host-only). */
export function cookieDomainFor(host: string | undefined): string | undefined {
  const d = config.cookieDomain;
  if (!d) return undefined;
  const h = hostOf(host);
  return h === d || h.endsWith('.' + d) ? d : undefined;
}

/** the request's Origin when it is one of CORS_ORIGINS, else null */
export function allowedOrigin(origin: string | undefined): string | null {
  if (!origin || !config.corsOrigins.length) return null;
  const o = origin.trim().replace(/\/+$/, '').toLowerCase();
  return config.corsOrigins.includes(o) ? o : null;
}

const ALLOW_HEADERS = 'accept, content-type, x-requested-with, x-alaventra-passive';
const ALLOW_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE';

/**
 * onRequest hook for /api/*: adds the CORS answer for an allowed origin, and answers its preflight here (204, before routing, before
 * any session lookup). A request from any other origin gets no CORS header at all, so the browser keeps the answer from the script.
 * Returns true when it answered the request itself.
 */
export function corsHook(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!req.url.startsWith('/api/')) return false;
  const origin = allowedOrigin(req.headers.origin);
  reply.header('vary', 'Origin');
  if (!origin) return false;
  reply.header('access-control-allow-origin', origin);
  reply.header('access-control-allow-credentials', 'true');
  if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
    void reply
      .status(204)
      .header('access-control-allow-methods', ALLOW_METHODS)
      .header('access-control-allow-headers', ALLOW_HEADERS)
      .header('access-control-max-age', '600')
      .send();
    return true;
  }
  return false;
}
