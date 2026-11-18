// Builds one prerendered page from the built app shell (dist/index.html as Vite wrote it): the page's own title, description,
// canonical and Open Graph tags, the site-wide JSON-LD, the stylesheets of the public pages, and the rendered body inside #root.
// Pure string work on the shell Vite writes, so it is unit tested; scripts/prerender.mjs only reads and writes files.
import { absoluteUrl } from '@/lib/siteOrigin';
import type { SeoHead } from '../useSeo';
import { jsonLdText, siteJsonLd } from './schema';

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface PageDocument {
  /** the page's head from useSeo; null only for the 404 page, which keeps a plain title and no canonical */
  head: SeoHead | null;
  /** the rendered body (inside #root) */
  html: string;
  /** stylesheets of the lazily loaded public-page chunks, linked in <head> so the page is styled before any script runs */
  styles: string[];
  /** the path the body was rendered for: the browser hydrates only on this exact path (main.tsx), and renders afresh anywhere else */
  hydratePath: string | null;
  /** extra tags for <head> (e.g. robots noindex on the 404 page) */
  extraHead?: string;
}

/** replaces exactly one match of `re` in `html`, and fails the build when the shell does not have it (the shell changed shape) */
function replaceOnce(html: string, re: RegExp, by: string, what: string): string {
  const hits = html.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))?.length ?? 0;
  if (hits !== 1) throw new Error(`prerender: the app shell has ${hits} ${what} (expected 1)`);
  // a function, so `$&`, `$'` and the like in page text (prices!) are inserted as they are, never read as replacement patterns
  return html.replace(re, () => by);
}

export function renderDocument(shell: string, page: PageDocument): string {
  let out = shell;
  const { head } = page;
  if (head) {
    out = replaceOnce(out, /<title>[^<]*<\/title>/, `<title>${text(head.title)}</title>`, '<title>');
    out = replaceOnce(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${attr(head.description)}" />`, 'meta description');
    out = replaceOnce(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${attr(head.title)}" />`, 'og:title');
    out = replaceOnce(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${attr(head.description)}" />`, 'og:description');
  }
  // social images must be absolute addresses
  out = out.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")\/([^"]*")/g, (_m, a: string, b: string) => `${a}${absoluteUrl('/')}${b}`);
  const tags: string[] = [];
  if (head) {
    tags.push(`<link rel="canonical" href="${attr(head.url)}" />`, `<meta property="og:url" content="${attr(head.url)}" />`);
  }
  if (page.extraHead) tags.push(page.extraHead);
  for (const href of page.styles) tags.push(`<link rel="stylesheet" crossorigin href="${attr(href)}">`);
  for (const ld of siteJsonLd()) tags.push(`<script type="application/ld+json">${jsonLdText(ld)}</script>`);
  out = replaceOnce(out, /\n?[ \t]*<\/head>/, `\n    ${tags.join('\n    ')}\n  </head>`, '</head>');
  const marker = page.hydratePath ? ` data-prerendered="${attr(page.hydratePath)}"` : '';
  out = replaceOnce(out, /<div id="root"><\/div>/, `<div id="root"${marker}>${page.html}</div>`, 'empty #root');
  return out;
}

/** the visible text of a rendered body (for the build's own checks): no tags, no scripts, collapsed spaces */
export const visibleText = (html: string): string =>
  html
    // any case, attributes, and the end tags browsers accept ("</script >", "</SCRIPT foo>"): CodeQL js/bad-tag-filter
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
