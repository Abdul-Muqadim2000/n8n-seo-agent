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
// On the API server: APP_URL = this site's public origin, and TRUST_PROXY = 2 (Vercel's edge + the API host's own router), so the
// client address comes from X-Forwarded-For and the host from the X-Forwarded-Host set below.
import { next, rewrite } from '@vercel/functions/middleware';

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
  if (!isApi && ours) return next();

  const origin = (process.env.API_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    return new Response(JSON.stringify({ error: 'The API is not configured for this deployment.', code: 'api_unconfigured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', 'https');
  return rewrite(new URL(url.pathname + url.search, origin), { request: { headers } });
}
