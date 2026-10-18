// Vercel Routing Middleware (runs at the edge in front of the static web build; the Vercel project's Root Directory is `app/`).
// Vercel serves only the React build. Everything the API owns goes to the API server named by API_ORIGIN, so the browser sees one
// origin: session cookies stay first-party, the CSRF header rule and `connect-src 'self'` keep working, and the app needs no CORS.
//
//   /api/*                        -> API_ORIGIN (every host)
//   any path on an agency portal  -> API_ORIGIN: the server builds the portal's page shell (title, icon) from the host, and must
//                                    never answer with our own (app/docs/WHITE_LABEL.md §2), so a portal host is proxied whole
//   everything else               -> the static build (vercel.json turns unknown paths into index.html)
//
// Settings (Vercel → Project → Settings → Environment Variables, per environment):
//   API_ORIGIN     https origin of the API server, e.g. https://api.alaventra.com (no path). Unset: /api answers 503.
//   PRIMARY_HOSTS  comma-separated hosts that are ours (e.g. alaventra.com,www.alaventra.com,app.alaventra.com). A request to any
//                  other host is treated as an agency portal and proxied whole. *.vercel.app is always ours. Unset: every host is
//                  ours (no portal pass-through), the safe default until custom portal domains are added to the Vercel project.
//   ORIGIN_SECRET  (deploy/gcp) the shared secret the API host's proxy (Caddy) checks before it believes X-Real-IP / X-Forwarded-Host
//                  from us; sent as X-Origin-Secret on every proxied request. Same value as ORIGIN_SECRET in the VM's prod.env.
//                  Unset: the API sees Vercel's address as the visitor's (shared rate limits) and our host as its own.
// On the API server: APP_URL = this site's public origin. Behind deploy/gcp's Caddy TRUST_PROXY = 1 (Caddy rewrites X-Forwarded-For
// from X-Real-IP for requests that carry the secret, and from the connecting address for everything else); behind a plain router 2.
//
// Content-Security-Policy is set here, not in vercel.json, because connect-src must name API_ORIGIN: large uploads go to the API
// directly (web/src/lib/api.ts API_ORIGIN — a proxy in front has body-size and time limits). Two CSP headers would intersect, so
// vercel.json carries none.
import { next, rewrite } from '@vercel/functions/middleware';

const CSP_BASE =
  "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data: https:; " +
  "object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; frame-src 'self' blob:; upgrade-insecure-requests";
/** the page's CSP: the API's origin is the one other place scripts may talk to */
export const csp = (apiOrigin: string) => `${CSP_BASE}; connect-src 'self'${/^https:\/\/[^/\s;]+$/.test(apiOrigin) ? ' ' + apiOrigin : ''}`;

export const config = { matcher: '/:path*' };

const hostsOf = (v: string | undefined) =>
  new Set(
    (v ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ''))
      .filter(Boolean),
  );

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const host = (request.headers.get('host') ?? url.host).toLowerCase().replace(/:\d+$/, '');
  const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');
  const primary = hostsOf(process.env.PRIMARY_HOSTS);
  const ours = primary.size === 0 || primary.has(host) || host.endsWith('.vercel.app') || host === 'localhost';
  const origin = (process.env.API_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!isApi && ours) return next({ headers: { 'content-security-policy': csp(origin) } });

  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    return new Response(JSON.stringify({ error: 'The API is not configured for this deployment.', code: 'api_unconfigured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  // Only the headers the API needs. Copying every incoming header into the request override also re-injected Vercel's own
  // x-vercel-* / hop-by-hop headers and the invocation failed on every /api call (MIDDLEWARE_INVOCATION_FAILED, 2026-10-18).
  const headers = new Headers();
  for (const [k, v] of request.headers) if (FORWARD.has(k.toLowerCase())) headers.set(k, v);
  const ip = request.headers.get('x-real-ip') ?? (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (ip) headers.set('x-real-ip', ip);
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', 'https');
  const secret = (process.env.ORIGIN_SECRET ?? '').trim();
  if (secret) headers.set('x-origin-secret', secret);   // a visitor's own x-origin-secret is never in FORWARD
  try {
    return rewrite(new URL(url.pathname + url.search, origin), { request: { headers } });
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return new Response(JSON.stringify({ error: 'The edge proxy could not forward this request.', code: 'proxy_failed', detail: err.slice(0, 300) }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}

/** request headers the API reads; everything else (Vercel's own x-vercel-*, hop-by-hop, a visitor's x-origin-secret) stays behind */
const FORWARD = new Set([
  'accept', 'accept-language', 'authorization', 'cookie', 'content-length', 'content-type', 'idempotency-key', 'if-none-match', 'origin',
  'referer', 'user-agent', 'x-api-key', 'x-org-id', 'x-requested-with', 'x-csrf-token',
]);
