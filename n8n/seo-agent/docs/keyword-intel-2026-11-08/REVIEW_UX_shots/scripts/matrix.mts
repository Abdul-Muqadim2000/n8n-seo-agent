// Matrix: both pages x 4 widths x 2 themes on the ERP site (5,000 searches), owner; axe at 375 + 1440 both themes; states; personas.
import { writeFileSync } from 'node:fs';
import { launch, context, open, metrics, axe } from './harness.mts';
const OUT = '/out';
const R: any = { matrix: [], states: [], personas: [], axe: [] };
const b = await launch();
const shot = (page: any, name: string, full = false) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: full });

for (const theme of ['light', 'dark'] as const)
  for (const width of [375, 768, 1024, 1440]) {
    const c = await context(b, { persona: 'owner', width, theme });
    for (const pg of ['competitors', 'keywords']) {
      const { page, errors } = await open(c, `/o/org-1/sites/s-erp/${pg}`);
      const m = await metrics(page);
      R.matrix.push({ pg, width, theme, ...m, errors: errors.filter((e) => !/404/.test(e)) });
      await shot(page, `m-${pg}-${width}-${theme}`);
      if (width === 375 && theme === 'light') await shot(page, `m-${pg}-375-light-full`, true);
      if (width === 375 || width === 1440) R.axe.push({ pg, width, theme, v: await axe(page) });
      await page.close();
    }
    await c.ctx.close();
  }

const states: [string, string, any][] = [
  ['s-new', 'empty', {}], ['s-one', 'one-row', {}], ['s-edx', 'partial', {}], ['s-refused', 'refused', {}], ['s-credits', 'credits', {}], ['s-off', 'off', {}],
  ['s-erp', 'error', { failPaths: /\/ki\/(keywords|competitors)$/ }], ['s-erp', 'loading', { slowKeywordsMs: 60000 }],
];
for (const [site, name, extra] of states)
  for (const width of [375, 1440]) {
    const c = await context(b, { persona: 'owner', width, theme: 'light', ...extra });
    for (const pg of ['competitors', 'keywords']) {
      const page = await c.ctx.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://app.test/o/org-1/sites/${site}/${pg}`, { waitUntil: name === 'loading' ? 'domcontentloaded' : 'networkidle' });
      await page.waitForTimeout(name === 'loading' ? 2500 : 600);
      const text = (await page.locator('main').innerText().catch(() => '')).slice(0, 900);
      R.states.push({ site, name, pg, width, text, errors, m: await metrics(page) });
      await shot(page, `s-${name}-${pg}-${width}`, width === 1440 && name !== 'loading');
      await page.close();
    }
    await c.ctx.close();
  }

const personas: [string, string][] = [['viewer', 's-erp'], ['member', 's-erp'], ['admin', 's-erp'], ['padmin', 's-trial'], ['padmin', 's-killed'], ['owner', 's-trial']];
for (const [p, site] of personas) {
  const c = await context(b, { persona: p as any, width: 1440, theme: 'light' });
  for (const pg of ['competitors', 'keywords']) {
    const { page } = await open(c, `/o/org-1/sites/${site}/${pg}`);
    const buttons = await page.locator('main button:visible, main a:visible').allInnerTexts();
    const nav = await page.locator('nav a, aside a').allInnerTexts().catch(() => []);
    const text = (await page.locator('main').innerText()).slice(0, 1200);
    R.personas.push({ p, site, pg, buttons: [...new Set(buttons.map((x) => x.trim()).filter(Boolean))].slice(0, 60), navHasKi: nav.some((x) => /Competitors|Keyword research/.test(x)), text });
    await shot(page, `p-${p}-${site}-${pg}`);
    await page.close();
  }
  await c.ctx.close();
}
writeFileSync(`${OUT}/matrix.json`, JSON.stringify(R, null, 1));
await b.close();
console.log('done');
