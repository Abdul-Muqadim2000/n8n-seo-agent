// FX-A after-pass: the High items checked in the browser (score tip, gap filter, refused, action links, killed, tools page).
import { writeFileSync } from 'node:fs';
import { launch, context, open } from './harness.mts';
const OUT = '/out';
const R: any = {};
const b = await launch();
const shot = (page: any, name: string, full = false) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: full });

{ // H1 score tip + H2 gap filter + H4 links (1440)
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/keywords');
  const tip = page.getByRole('button', { name: 'What makes up this score' }).first();
  await tip.hover(); await page.waitForTimeout(400);
  R.scoreTip = await page.locator('[role=tooltip]').first().innerText().catch(() => '');
  await shot(page, 'a-kw-scoretip-1440');
  await page.mouse.move(5, 5);
  const sel = page.locator('[data-ki-filters] select').nth(5);
  await sel.selectOption('missing'); await page.waitForTimeout(800);
  const panel = page.locator('#every-search');
  R.gapFilter = { header: await panel.locator('p').first().innerText().catch(() => ''), text: (await panel.innerText()).slice(0, 600) };
  await panel.screenshot({ path: `${OUT}/a-kw-gapfilter-1440.jpg`, type: 'jpeg', quality: 55 });
  R.links = await page.locator('main a').evaluateAll((as) => as.map((a) => [(a as HTMLElement).innerText.trim(), a.getAttribute('href')]).filter(([t]) => /Write this page|Improve this page|Plan the ladder|How to get|Find websites/.test(String(t))).slice(0, 12));
  R.comingSoon = (await page.locator('main').innerText()).includes('Coming soon');
  await c.ctx.close();
}
for (const width of [375, 1440]) { // H3 refused, M1 killed for a client
  const c = await context(b, { persona: 'owner', width, theme: 'light' });
  for (const [site, pg] of [['s-refused', 'keywords'], ['s-refused', 'competitors'], ['s-killed', 'keywords']]) {
    const { page } = await open(c, `/o/org-1/sites/${site}/${pg}`);
    R[`${site}-${pg}-${width}`] = (await page.locator('main').innerText()).slice(0, 500);
    await shot(page, `a-${site}-${pg}-${width}`);
    await page.close();
  }
  await c.ctx.close();
}
{ // M7 tools page: Research group
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/tools?site=s-erp');
  R.research = (await page.locator('#goal-research').innerText().catch(() => '')).slice(0, 700);
  R.more = await page.locator('#goal-more').count();
  await page.locator('#goal-research').screenshot({ path: `${OUT}/a-tools-research-1440.jpg`, type: 'jpeg', quality: 55 }).catch(() => undefined);
  await c.ctx.close();
}
{ // padmin Trial: free run button
  const c = await context(b, { persona: 'padmin', width: 1440, theme: 'dark' });
  const { page } = await open(c, '/o/org-1/sites/s-trial/competitors');
  R.trialButtons = (await page.locator('main a, main button').allInnerTexts()).filter((t) => /trial|credits/i.test(t)).slice(0, 5);
  await shot(page, 'a-trial-competitors-1440-dark');
  await c.ctx.close();
}
{ // drawer at 375 (cards, chips)
  const c = await context(b, { persona: 'owner', width: 375, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/competitors');
  await page.getByRole('button', { name: 'Details' }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'a-drawer-375');
  const dlg = page.locator('[role=dialog]');
  await dlg.evaluate((el) => el.querySelector('table')?.scrollIntoView()).catch(() => undefined);
  await dlg.locator('text=Searches it ranks for').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(300);
  await shot(page, 'a-drawer-375-searches');
  R.drawerTableWidth = await dlg.evaluate((el) => { const t = el.querySelector('table'); return t ? { visible: t.getBoundingClientRect().width > 0 && getComputedStyle(t).display !== 'none', w: t.getBoundingClientRect().width } : null; });
  await c.ctx.close();
}
writeFileSync(`${OUT}/fxa.json`, JSON.stringify(R, null, 1));
await b.close();
console.log('done');
