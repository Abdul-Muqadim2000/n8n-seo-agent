// Prerenders the public website after `vite build` (CR17, 2026-11-17: crawlers, AI assistants and link previews read raw HTML; the
// site used to answer one empty app shell on every address). Runs the server build of src/entry-server.tsx (dist-ssr/) and writes:
//   dist/app.html              the untouched app shell: app/vercel.json rewrites the app's own paths to /app (cleanUrls serves this
//                              file at /app; a destination of /app.html misses and answers the 404 page); the API server and the
//                              agency portal shell use it too (app/server/src/services/portalShell.ts appShellFile)
//   dist/index.html            the home page; dist/<path>.html for every other public page (served without .html: cleanUrls)
//   dist/404.html              the not-found page, answered with status 404 for every unknown address
//   dist/sitemap.xml, robots.txt, llms.txt
// and fails the build when a page renders without its title, canonical or H1, or with too little text.
// Usage: node scripts/prerender.mjs   (from app/web, after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`)
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(web, 'dist');
const ssrDir = join(web, 'dist-ssr');
const MIN_TEXT = 600;
const fail = (msg) => {
  console.error(`prerender: ${msg}`);
  process.exit(1);
};

const ssr = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);
const shell = await readFile(join(dist, 'index.html'), 'utf8');
if (shell.includes('data-prerendered')) fail('dist/index.html is already prerendered: run vite build first');

// the stylesheets of the public pages' lazy chunks (MarketingLayout, the platform kit, ...), from Vite's manifest
const manifestPath = join(dist, '.vite', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
// (each public page module and every chunk it imports, e.g. the shared platform kit)
const seen = new Set();
const queue = Object.keys(manifest).filter((k) => typeof manifest[k].src === 'string' && manifest[k].src.startsWith('src/marketing/'));
while (queue.length) {
  const k = queue.pop();
  if (seen.has(k) || !manifest[k]) continue;
  seen.add(k);
  queue.push(...(manifest[k].imports ?? []));
}
const styles = [...new Set([...seen].flatMap((k) => manifest[k].css ?? []))]
  .sort()
  .map((f) => `/${f}`)
  .filter((href) => !shell.includes(`href="${href}"`));

const fileFor = (path) => (path === '/' ? join(dist, 'index.html') : join(dist, `${path.slice(1)}.html`));
const write = async (file, body) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
};

await write(join(dist, 'app.html'), shell);

const pages = ssr.sitePages();
if (pages.length < ssr.STATIC_PATHS.length + 10) fail(`only ${pages.length} pages found`);
let bytes = 0;
const started = Date.now();
for (const { path } of pages) {
  const r = await ssr.render(path);
  if (r.status !== 200) fail(`${path} answered ${r.status}`);
  if (!r.head) fail(`${path} set no title (useSeo)`);
  if (!/<h1[\s>]/.test(r.html)) fail(`${path} has no <h1>`);
  if (/<!--\$[!?]-->/.test(r.html)) fail(`${path} left a part unrendered (a Suspense boundary did not finish)`);
  if (/<script(?![^>]*type="application\/ld\+json")/i.test(r.html)) fail(`${path} renders an inline script (the CSP allows none)`);
  const text = ssr.visibleText(r.html);
  if (text.length < MIN_TEXT) fail(`${path} renders only ${text.length} characters of text`);
  if (/Loading\.\.\./.test(text.slice(0, 400))) fail(`${path} renders a loader`);
  const doc = ssr.renderDocument(shell, { head: r.head, html: r.html, styles, hydratePath: path });
  bytes += doc.length;
  await write(fileFor(path), doc);
}

// the catch-all route's page (app/vercel.json answers it with status 404 for every unknown address)
const nf = await ssr.render(ssr.NOT_FOUND_PATH);
if (!/Page not found/.test(nf.html)) fail('the not-found page does not say so');
// no hydration marker: the browser renders whatever its address really is (a /platform/<unknown> 404 inside the site layout, ...)
await write(join(dist, '404.html'), ssr.renderDocument(shell, { head: null, html: nf.html, styles, hydratePath: null, extraHead: '<meta name="robots" content="noindex" />' }));

await write(join(dist, 'sitemap.xml'), ssr.sitemapXml(pages));
await write(join(dist, 'robots.txt'), ssr.robotsTxt());
await write(join(dist, 'llms.txt'), ssr.llmsTxt());

// the manifest and the server build are build inputs, never published
await rm(join(dist, '.vite'), { recursive: true, force: true });
await rm(ssrDir, { recursive: true, force: true });
console.log(`prerender: ${pages.length} pages + 404 in ${((Date.now() - started) / 1000).toFixed(1)} s, ${(bytes / 1024 / 1024).toFixed(1)} MB of HTML, ${styles.length} page stylesheets`);
