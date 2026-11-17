import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOT_FOUND_PATH, render, renderDocument, sitePages, visibleText } from '@/entry-server';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { features } from '@/marketing/content/features';
import { tutorials } from '@/marketing/content/tutorials';

// C2 (client report 2026-11-17): every public page is written at build time with its title, description, canonical, H1, full body
// and structured data in the raw HTML (crawlers and AI assistants read raw HTML; the site used to answer one empty app shell).
// The pages here render through entry-server.tsx, the same function scripts/prerender.mjs runs over the server build.

const shell = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const ldBlocks = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
const filmed = tutorials.find((t) => t.film)!;
const SAMPLE = ['/', '/platform', '/platform/index-coverage', '/pricing', '/security', '/subprocessors', '/data-retention', `/tutorials/${filmed.slug}`];

describe('a prerendered page', () => {
  it.each(SAMPLE)('%s: title, canonical, H1, body text and JSON-LD in the raw HTML', async (path) => {
    const r = await render(path);
    expect(r.status).toBe(200);
    expect(r.head?.title).toMatch(/ \| Alaventra$/);
    expect(r.head?.url).toBe(`${SITE_ORIGIN}${path}`);
    expect(r.html).toMatch(/<h1[\s>]/);
    expect(visibleText(r.html).length).toBeGreaterThan(600);
    expect(r.html).not.toContain('Loading...');
    // nothing left for the browser to fill in, and no inline script (the CSP allows scripts from this site only)
    expect(r.html).not.toMatch(/<!--\$[!?]-->/);
    expect(r.html).not.toMatch(/<script(?![^>]*type="application\/ld\+json")/);

    const doc = renderDocument(shell, { head: r.head, html: r.html, styles: ['/assets/MarketingLayout-x.css'], hydratePath: path });
    expect(doc).toContain(`<title>${r.head!.title.replace(/&/g, '&amp;')}</title>`);
    expect(doc).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path}" />`);
    expect(doc).toContain(`<meta property="og:url" content="${SITE_ORIGIN}${path}" />`);
    expect(doc).toContain(`<div id="root" data-prerendered="${path}">`);
    expect(doc).toContain('<link rel="stylesheet" crossorigin href="/assets/MarketingLayout-x.css">');
    expect(doc).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/og-image.png" />`);
    expect(doc.match(/<title>/g)).toHaveLength(1);
    expect(doc.match(/<meta name="description"/g)).toHaveLength(1);
    const types = ldBlocks(doc).map((b) => b['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
    // canonical and structured data name the public origin only, never the host that served the build (app.*)
    expect(doc).not.toMatch(/https?:\/\/app\.alaventra\.com/);
  });

  it('home and pricing describe the software without offers (prices are placeholders), and FAQPage only where the FAQ is visible', async () => {
    const decode = (h: string) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    for (const path of ['/', '/pricing']) {
      const { html } = await render(path);
      const blocks = ldBlocks(html);
      const app = blocks.find((b) => b['@type'] === 'SoftwareApplication');
      expect(app, path).toBeTruthy();
      expect(app).not.toHaveProperty('offers');
      expect(app).not.toHaveProperty('aggregateRating');
      const faq = blocks.find((b) => b['@type'] === 'FAQPage') as { mainEntity: { name: string }[] } | undefined;
      expect(faq, path).toBeTruthy();
      // every question in the structured data is a visible question on the page
      const summaries = [...html.matchAll(/<summary[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]));
      for (const q of faq!.mainEntity) expect(summaries, q.name).toContain(q.name);
    }
    // a page without a visible FAQ carries no FAQPage
    expect(ldBlocks((await render('/subprocessors')).html).some((b) => b['@type'] === 'FAQPage')).toBe(false);
  });

  it('breadcrumbs and the tutorial film name the public origin', async () => {
    const feature = ldBlocks((await render('/platform/index-coverage')).html).find((b) => b['@type'] === 'BreadcrumbList') as { itemListElement: { item: string }[] };
    expect(feature.itemListElement.map((i) => i.item)).toEqual([`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/platform`, `${SITE_ORIGIN}/platform/index-coverage`]);
    const video = ldBlocks((await render(`/tutorials/${filmed.slug}`)).html).find((b) => b['@type'] === 'VideoObject') as { url: string };
    expect(video.url).toBe(`${SITE_ORIGIN}/tutorials/${filmed.slug}`);
  });

  it('the security page is dated and says what does not exist yet; the trust pages are linked from the footer', async () => {
    const html = (await render('/security')).html;
    const t = visibleText(html);
    expect(t).toMatch(/Facts as of \d{1,2} [A-Z][a-z]+ 20\d\d/);
    expect(t).toContain('me-central1 (Doha, Qatar)');
    expect(t).toContain('No SOC 2 or ISO 27001 report yet');
    expect(t).toContain('No penetration test by a third party yet');
    expect(html).toContain('href="/subprocessors"');
    expect(html).toContain('href="/data-retention"');
  });

  it('the signed-out home renders the marketing home, not a loader (the browser shows it until /api/me answers)', async () => {
    const r = await render('/');
    expect(visibleText(r.html)).toContain(r.head!.title.replace(' | Alaventra', '').slice(0, 10));
    expect(r.html).toContain('Start free');
  });

  it('an unknown address renders the not-found page, and its document has no canonical and no hydration marker', async () => {
    const r = await render(NOT_FOUND_PATH);
    expect(r.html).toContain('Page not found');
    const doc = renderDocument(shell, { head: null, html: r.html, styles: [], hydratePath: null, extraHead: '<meta name="robots" content="noindex" />' });
    expect(doc).not.toContain('rel="canonical"');
    expect(doc).toContain('<div id="root">');
    expect(doc).toContain('noindex');
  });

  it('page text with dollar signs is copied as it is into the document', () => {
    const doc = renderDocument(shell, { head: { title: 'A $& B | Alaventra', description: "Costs $' and $1", url: `${SITE_ORIGIN}/x` }, html: "<h1>$& $' $` $$</h1>", styles: [], hydratePath: '/x' });
    expect(doc).toContain("<h1>$& $' $` $$</h1>");
    expect(doc).toContain('<title>A $&amp; B | Alaventra</title>');
  });

  it('a shell without the expected tags fails the build instead of writing a broken page', () => {
    expect(() => renderDocument('<html><head></head><body></body></html>', { head: null, html: '<h1>x</h1>', styles: [], hydratePath: '/' })).toThrow(/empty #root/);
  });
});

describe('every public page', () => {
  it('renders with status 200, its own canonical and an H1 (what the build writes for each sitemap entry)', async () => {
    const pages = sitePages();
    expect(pages.length).toBeGreaterThan(features.length + tutorials.length);
    for (const { path } of pages) {
      const r = await render(path);
      expect(r.status, path).toBe(200);
      expect(r.head?.url, path).toBe(`${SITE_ORIGIN}${path}`);
      expect(r.html, path).toMatch(/<h1[\s>]/);
    }
  }, 120_000);
});
