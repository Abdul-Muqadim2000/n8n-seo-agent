import { launch, context, open } from './harness.mts';
const b = await launch();
for (const w of [1440, 375]) {
const pa = await context(b, { persona: 'padmin', width: w, theme: 'light' });
const g = await open(pa, '/o/org-1/sites/s-trial/settings/tracking');
await g.page.getByText('Competitors and Keyword research', { exact: true }).first().scrollIntoViewIfNeeded();
await g.page.getByRole('radio', { name: 'On', exact: true }).click();
await g.page.waitForTimeout(300);
const btn = g.page.getByRole('button', { name: /^Save|Switch/ });
console.log(w, 'buttons', await g.page.locator('main button:visible').allInnerTexts().then((a) => a.filter((x) => /Save|Switch|Undo|On/.test(x))));
await g.page.getByText(/The owner agreed/).click(); await g.page.waitForTimeout(200); await g.page.screenshot({ path: `/out/pass2/g-switch-on-${w}.jpg`, type: 'jpeg', quality: 50 }); await g.page.getByRole('button', { name: 'Save', exact: true }).last().click(); await g.page.waitForTimeout(600);
console.log('dialogs', (await g.page.locator('[role=dialog],[role=alertdialog]').allInnerTexts()).map((x) => x.replace(/\n/g, ' | ')));
console.log('api', pa.apiLog.filter((x) => x.method !== 'GET').map((x) => `${x.method} ${x.path} ${x.status}`));
await pa.ctx.close(); }
await b.close();
