// Shared browser set-up: dist served through page.route, /api answered by fixtures.mts as one persona.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { api, type Persona } from './fixtures.mts';

export const DIST = '/app/web/dist';
export const BASE = 'http://app.test';
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

export interface Ctx { ctx: BrowserContext; apiLog: { method: string; path: string; status: number; ms: number }[]; assets: { path: string; bytes: number }[] }

export async function context(browser: Browser, o: { persona: Persona; width: number; height?: number; theme: 'light' | 'dark'; creditsOut?: boolean; slowKeywordsMs?: number; failPaths?: RegExp }): Promise<Ctx> {
  const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height ?? 900 }, colorScheme: o.theme, reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript('window.__name = (f) => f;');
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, o.theme);
  const apiLog: Ctx['apiLog'] = [];
  const assets: Ctx['assets'] = [];
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== BASE) return route.fulfill({ status: 204, body: '' });
    if (url.pathname.startsWith('/api/')) {
      const t0 = Date.now();
      if (o.failPaths && o.failPaths.test(url.pathname)) { apiLog.push({ method: req.method(), path: url.pathname + url.search, status: 502, ms: 0 }); return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'The SEO engine could not be read right now. Please try again in a minute.', code: 'engine_unreachable' }) }); }
      if (o.slowKeywordsMs && url.pathname.endsWith('/ki/keywords')) await new Promise((r) => setTimeout(r, o.slowKeywordsMs));
      let body: any = null; try { body = req.postDataJSON(); } catch {}
      const [status, ans] = api(o.persona, req.method(), url, body, { creditsOut: o.creditsOut });
      apiLog.push({ method: req.method(), path: url.pathname + url.search, status, ms: Date.now() - t0 });
      if (url.pathname.endsWith('.csv')) return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'content-disposition': 'attachment; filename="x.csv"' }, body: 'a,b\r\n' });
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(ans) });
    }
    let f = join(DIST, url.pathname);
    if (!existsSync(f) || url.pathname === '/' || !extname(f)) f = join(DIST, 'index.html');
    const buf = readFileSync(f);
    assets.push({ path: url.pathname, bytes: buf.length });
    return route.fulfill({ status: 200, contentType: MIME[extname(f)] ?? 'application/octet-stream', body: buf });
  });
  return { ctx, apiLog, assets };
}

export async function open(c: Ctx, path: string): Promise<{ page: Page; errors: string[] }> {
  const page = await c.ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return { page, errors };
}

export async function metrics(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main') ?? document.body;
    const vis = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const label = (el: Element) => ((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50));
    const small = [...main.querySelectorAll('button, a[href], select, input, [role=button], summary')].filter(vis).map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => (r.height < 40 || r.width < 24) && !(el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox' && el.closest('label') && el.closest('label')!.getBoundingClientRect().height >= 40))
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    // elements that stick out of the viewport horizontally (inside main)
    const over = [...main.querySelectorAll('*')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.right > doc.clientWidth + 1; })
      .filter((el) => !el.closest('.overflow-x-auto, [data-overflow-ok]')).slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 50)} right=${Math.round(el.getBoundingClientRect().right)}`);
    // truncated text (ellipsis) that has no title
    const trunc = [...main.querySelectorAll('.truncate, .line-clamp-1, .line-clamp-2')].filter(vis).filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 || (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 1).filter((el) => !el.getAttribute('title')).slice(0, 8).map((el) => (el as HTMLElement).innerText.slice(0, 60));
    const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => `${h.tagName}:${(h as HTMLElement).innerText.trim().slice(0, 40)}`);
    const unnamed = [...main.querySelectorAll('button, a[href]')].filter(vis).filter((el) => !label(el)).map((el) => el.outerHTML.slice(0, 80)).slice(0, 5);
    return { overflow: doc.scrollWidth - doc.clientWidth, h1: document.querySelectorAll('h1').length, small: [...new Set(small)].slice(0, 25), over, trunc, heads, unnamed, height: doc.scrollHeight };
  });
}

export async function axe(page: Page) {
  await page.addScriptTag({ path: '/pw/node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map((v: any) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodes: v.nodes.slice(0, 4).map((n: any) => ({ t: n.target.join(' '), s: (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 160), h: n.html.slice(0, 120) })) }));
  });
}

export const launch = () => chromium.launch();
