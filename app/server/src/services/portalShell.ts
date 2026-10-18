import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { effectiveBrand } from '@seo/shared';
import { orgById } from './brandOf';

/**
 * G5 (WHITE_LABEL.md §2): the HTML shell served on an agency's portal host. The built index.html names Ascentra in its title, its
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

export async function portalIndexHtml(dist: string, agencyId: string): Promise<string> {
  const path = resolve(dist, 'index.html');
  if (!cached || cached.path !== path) cached = { path, html: await readFile(path, 'utf8') };
  const agency = await orgById(agencyId);
  const brand = agency ? effectiveBrand({ name: agency.name, branding: agency.branding }) : null;
  return rewriteShell(cached.html, brand);
}
