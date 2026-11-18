import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { effectiveBrand } from '@seo/shared';
import { orgById } from './brandOf';

/**
 * G5 (WHITE_LABEL.md §2): the HTML shell served on an agency's portal host. The built index.html names Alaventra in its title, its
 * description, its icons and its social tags; on a portal host the person must not meet our name before the app has loaded, so the
 * shell is rewritten: the agency's name in the title, its logo as the icon (or none), and no Open Graph / Twitter / manifest tags.
 * The script and style tags are untouched (same bundle, same CSP).
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let cached: { path: string; html: string } | null = null;

export function rewriteShell(html: string, brand: { name: string; logoUrl: string | null } | null): string {
  const name = brand?.name?.trim() || 'Client portal';
  let out = html
    .split('\n')
    .filter((l) => !/rel="(icon|apple-touch-icon|mask-icon|manifest)"|property="og:|name="twitter:/.test(l))
    .join('\n');
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(name)}</title>\n    <meta name="portal-host" content="1" />`);
  out = out.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(`${name}: your SEO reports and dashboards`)}" />`);
  // a logo as the tab icon when there is one; otherwise the browser asks /favicon.ico, which a portal host answers 404
  if (brand?.logoUrl) out = out.replace('</title>', `</title>\n    <link rel="icon" href="${esc(brand.logoUrl)}" />`);
  return out;
}

/**
 * The app's plain shell in a web build: `app.html` since the public pages are prerendered (CR17, 2026-11-17: index.html is then the
 * marketing home's own HTML, which must never reach a portal host or an app route), `index.html` in an older build without it.
 */
export function appShellFile(dist: string): 'app.html' | 'index.html' {
  return existsSync(resolve(dist, 'app.html')) ? 'app.html' : 'index.html';
}

/** robots.txt on an agency portal host: a signed-in client portal has nothing for search engines (WHITE_LABEL.md §2) */
export const PORTAL_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

/**
 * Review R4 L1 (2026-11-18): the API serves the whole web build as static files, and since CR17 that build holds Alaventra's own
 * public website (the prerendered pages as <page>.html, index.html, 404.html, app.html), its llms.txt, sitemap.xml, robots.txt and
 * .well-known/security.txt. On an agency portal host none of them may answer: each names us, links us or describes our product.
 * True for a request path (query and trailing slash ignored, percent-escapes decoded, any case) the portal host must refuse; the
 * portal's own shell ("/", the app's routes) and the bundle under /assets/ stay served.
 */
export function portalRefusesPublicFile(url: string): boolean {
  let path = url.split(/[?#]/, 1)[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    return true; // a malformed escape is nothing a portal serves
  }
  path = path.toLowerCase().replace(/\/+$/, '');
  return /\.html?$/.test(path) || /^\/(llms(-full)?\.txt|sitemap[^/]*\.xml|robots\.txt|\.well-known\/security\.txt|security\.txt)$/.test(path);
}

export async function portalIndexHtml(dist: string, agencyId: string): Promise<string> {
  const path = resolve(dist, appShellFile(dist));
  if (!cached || cached.path !== path) cached = { path, html: await readFile(path, 'utf8') };
  const agency = await orgById(agencyId);
  const brand = agency ? effectiveBrand({ name: agency.name, branding: agency.branding }) : null;
  return rewriteShell(cached.html, brand);
}
