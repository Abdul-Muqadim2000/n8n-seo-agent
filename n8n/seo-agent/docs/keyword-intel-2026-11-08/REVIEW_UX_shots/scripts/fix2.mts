import { writeFileSync } from 'node:fs';
import { SITES } from './fixtures.mts';
import { launch, context, open, metrics } from './harness.mts';
const U = (n: number) => `a0000000-0000-4000-8000-00000000000${n}`;
const map: Record<string, string> = { 's-erp': U(1), 's-trial': U(2), 's-off': U(3) };
for (const s of SITES) if (map[s.id]) s.id = map[s.id];
const R: any = {};
const b = await launch();
const shot = (page: any, name: string, full = false) => page.screenshot({ path: `/out/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: full });
for (const [creditsOut, name] of [[true, 'credits'], [false, 'ok']] as const) {
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light', creditsOut });
  const { page } = await open(c, `/o/org-1/tools/keyword_research?site=${U(1)}`);
  await page.getByRole('button', { name: /Research my keywords/ }).last().click();
  await page.waitForTimeout(1500);
  R[`submit-${name}`] = { url: page.url(), toasts: await page.locator('[data-sonner-toast]').allInnerTexts(), alerts: await page.locator('[role=alert]').allInnerTexts(), api: c.apiLog.filter((x) => x.method !== 'GET').map((x) => `${x.method} ${x.path} ${x.status}`) };
  await shot(page, `f2-submit-${name}`);
  await c.ctx.close();
}
for (const p of ['padmin', 'owner'] as const) for (const width of [375, 1440]) {
  const c = await context(b, { persona: p, width, theme: 'light' });
  const { page, errors } = await open(c, `/o/org-1/sites/${U(2)}/settings/tracking`);
  const card = page.getByText('Competitors and Keyword research', { exact: true }).first();
  R[`settings-${p}-${width}`] = { found: await card.count(), errors: errors.filter((e) => !/404/.test(e)).slice(0, 3) };
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const box = page.locator('div', { has: page.getByText('Off: nothing new anywhere', { exact: false }) }).last();
    R[`settings-${p}-${width}`].m = await metrics(page);
    await shot(page, `g2-settings-${p}-${width}`);
    if (p === 'padmin' && width === 1440) {
      await page.getByRole('radio', { name: 'On' }).click().catch(async () => await page.getByText('On', { exact: true }).last().click());
      await page.waitForTimeout(300);
      R.afterOn = (await page.locator('main').innerText()).match(/On: the client[^\n]*|Compare the trial[^\n]*/g);
      await shot(page, 'g2-settings-padmin-on');
    }
  } else await shot(page, `g2-settings-${p}-${width}`);
  await c.ctx.close();
}
writeFileSync('/out/fix2.json', JSON.stringify(R, null, 1));
await b.close();
console.log(JSON.stringify(R, null, 1).slice(0, 4000));
