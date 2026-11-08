import { writeFileSync } from 'node:fs';
import { launch, context, open, metrics } from './harness.mts';
const OUT = '/out';
const R: any = {};
const b = await launch();
const shot = (page: any, name: string, full = false) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: full });
const focusInfo = (page: any) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 50), ring: !!ring, inDialog: !!el.closest('[role=dialog]') };
});
async function tabUntil(page: any, re: RegExp, max = 150) {
  const seen: any[] = [];
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    const f = await focusInfo(page);
    seen.push(f);
    if (f && re.test(f.text)) return { tabs: i, seen };
  }
  return { tabs: -1, seen };
}

// ---------- A. competitors, keyboard, choose up to 5, drawer (1440)
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/competitors');
  await page.locator('main h1').click();
  const t = await tabUntil(page, /^Choose$/);
  R.tabsToFirstChoose = t.tabs;
  R.focusNoRing = t.seen.filter((f: any) => f && !f.ring).map((f: any) => `${f.tag} ${f.text}`);
  R.tabOrderSample = t.seen.slice(0, 30).map((f: any) => f && `${f.tag}:${f.text}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  R.afterChoose1 = await page.locator('[data-sonner-toast]').allInnerTexts();
  // choose two more -> 5
  for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Choose', exact: true }).first().click(); await page.waitForTimeout(400); }
  R.chosenDesc = await page.locator('main').getByText(/chosen, \d+ suggested/).first().innerText();
  const left = page.getByRole('button', { name: 'Choose', exact: true });
  R.chooseLeft = await left.count();
  R.chooseDisabled = R.chooseLeft ? await left.first().isDisabled() : null;
  R.chooseTitle = R.chooseLeft ? await left.first().getAttribute('title') : null;
  await shot(page, 'i-comp-5chosen-1440');
  // hero after choosing: what does the next step say
  R.heroAfter = (await page.locator('main h2').first().innerText());
  // drawer by keyboard
  const det = page.getByRole('button', { name: 'Details' }).first();
  await det.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  R.drawerFocus = await focusInfo(page);
  await shot(page, 'i-drawer-1440');
  const dlg = page.getByRole('dialog');
  R.drawerText = (await dlg.innerText()).slice(0, 1500);
  // CSV in drawer
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), dlg.getByRole('button', { name: /Download CSV/ }).click()]);
  if (dl) { const p = await dl.path(); R.drawerCsv = { name: dl.suggestedFilename(), head: p ? (await import('node:fs')).readFileSync(p, 'utf8').split('\r\n').slice(0, 3) : null }; }
  // score tip in drawer? focus "What this means" in drawer and read tooltip
  await dlg.getByRole('button', { name: 'What this means' }).first().focus();
  await page.waitForTimeout(400);
  R.drawerTip = await page.locator('[role=tooltip]').allInnerTexts();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  R.drawerClosed = (await page.getByRole('dialog').count()) === 0;
  R.focusAfterClose = await focusInfo(page);
  // competitor score tip on the list
  await page.getByRole('button', { name: 'What this means' }).first().hover();
  await page.waitForTimeout(500);
  R.compTip = await page.locator('[role=tooltip]').allInnerTexts();
  await shot(page, 'i-comp-tip-1440');
  // gaps "Start" disabled count
  R.comingSoonCount = await page.getByText('Coming soon', { exact: true }).count();
  R.api = c.apiLog.map((x) => `${x.method} ${x.path} ${x.status}`);
  await c.ctx.close();
}

// ---------- B. competitors 375: drawer, nested filter sheet; sliced screens
{
  const c = await context(b, { persona: 'owner', width: 375, height: 812, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/competitors');
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  R.comp375Height = h;
  for (const [i, y] of [[0, 900], [1, 1700], [2, 2600], [3, 4200]]) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(150); await shot(page, `i-comp375-${i}`); }
  await page.getByRole('button', { name: 'Details' }).first().click();
  await page.waitForTimeout(900);
  await shot(page, 'i-drawer-375');
  const dlg = page.getByRole('dialog');
  await dlg.locator('div.overflow-y-auto').first().evaluate((el) => (el.scrollTop = 900));
  await page.waitForTimeout(200);
  await shot(page, 'i-drawer-375-table');
  const fb = dlg.getByRole('button', { name: /^Filters/ });
  R.drawerFilterBtn375 = await fb.count();
  if (R.drawerFilterBtn375) { await fb.first().click(); await page.waitForTimeout(600); R.dialogsOpen = await page.getByRole('dialog').count(); await shot(page, 'i-drawer-375-nested-filter'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); R.dialogsAfterEsc = await page.getByRole('dialog').count(); }
  R.drawerMetrics375 = await page.evaluate(() => { const d = document.querySelector('[role=dialog]') as HTMLElement; if (!d) return null; const t = d.querySelector('table'); const box = t?.closest('.overflow-x-auto') as HTMLElement; return { tableW: t?.scrollWidth, boxW: box?.clientWidth }; });
  await c.ctx.close();
}

// ---------- C. keywords 1440: filters, gap filter mismatch, pager, questions, score tip
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/keywords');
  // score tip
  await page.getByRole('button', { name: 'What makes up this score' }).first().hover();
  await page.waitForTimeout(500);
  R.scoreTip = await page.locator('[role=tooltip]').allInnerTexts();
  await shot(page, 'i-kw-scoretip-1440');
  await page.mouse.move(0, 0);
  // volume tip
  await page.getByRole('button', { name: 'What this means' }).first().hover();
  await page.waitForTimeout(500);
  R.volTip = await page.locator('[role=tooltip]').allInnerTexts();
  await page.mouse.move(0, 0);
  // keyboard: tab to Verdict select from page top
  await page.locator('main h1').click();
  const t = await tabUntil(page, /^All\s*Go/, 300);
  R.tabsToVerdictFilter = t.tabs;
  R.kwFocusNoRing = [...new Set(t.seen.filter((f: any) => f && !f.ring).map((f: any) => `${f.tag} ${f.text}`))].slice(0, 15);
  const before = c.apiLog.length;
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(700);
  R.apiOnVerdict = c.apiLog.slice(before).map((x) => x.path);
  R.descAfterVerdict = await page.locator('main').getByText(/searches( match your filters)?$/).first().innerText().catch(() => '');
  // gap filter: rows vs description
  const selects = page.locator('[data-ki-filters] select');
  await selects.nth(0).selectOption('');
  await page.waitForTimeout(500);
  await selects.nth(5).selectOption('missing');
  await page.waitForTimeout(800);
  R.gapDesc = await page.locator('main').getByText(/searches( match your filters)?$/).first().innerText().catch(() => '');
  R.gapRowsShown = await page.locator('table tbody tr').count();
  R.gapPager = await page.locator('main').getByText(/^\d[\d,]*-\d[\d,]* of/).allInnerTexts();
  await shot(page, 'i-kw-gapfilter-1440');
  await selects.nth(5).selectOption('');
  await page.waitForTimeout(600);
  // pager: next page, does the view stay
  const yBefore = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.waitForTimeout(800);
  R.pagerScroll = { before: yBefore, after: await page.evaluate(() => scrollY) };
  R.pagerText = await page.locator('main').getByText(/^\d[\d,]*-\d[\d,]* of/).allInnerTexts();
  // questions: tick 2 by keyboard and add
  const boxes = page.locator('input[type=checkbox]');
  R.questionCount = await boxes.count();
  if (R.questionCount >= 2) { await boxes.nth(0).focus(); await page.keyboard.press('Space'); await boxes.nth(1).focus(); await page.keyboard.press('Space'); await page.getByRole('button', { name: /Add 2 to my AI questions/ }).click(); await page.waitForTimeout(700); R.questionToast = await page.locator('[data-sonner-toast]').allInnerTexts(); }
  // plan start: what happens on click of disabled
  R.planStartDisabled = await page.getByRole('button', { name: 'Start', exact: true }).first().isDisabled();
  R.kwApi = c.apiLog.map((x) => `${x.method} ${x.path} ${x.status}`);
  await c.ctx.close();
}

// ---------- D. keywords 375: filter sheet, cards
{
  const c = await context(b, { persona: 'owner', width: 375, height: 812, theme: 'dark' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/keywords');
  R.kw375Height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const [i, y] of [[0, 700], [1, 2200], [2, 4200], [3, 6500]]) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(150); await shot(page, `i-kw375-dark-${i}`); }
  await page.getByRole('button', { name: /^Filters/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'i-kw375-filtersheet-dark');
  await c.ctx.close();
}

// ---------- E. engine read error after retries
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light', failPaths: /\/ki\/(keywords|competitors)$/ });
  const { page } = await open(c, '/o/org-1/sites/s-erp/competitors');
  await page.waitForTimeout(9000);
  R.errorText = (await page.locator('main').innerText()).slice(0, 600);
  await shot(page, 'i-error-comp-1440');
  await c.ctx.close();
}

// ---------- F. forms
for (const [p, path, name, extra] of [['owner', '/o/org-1/tools/keyword_research?site=s-erp', 'form-research', { creditsOut: true }], ['owner', '/o/org-1/tools/competitors?site=s-erp', 'form-comp', {}], ['owner', '/o/org-1/tools/competitors?site=s-off', 'form-off', {}], ['padmin', '/o/org-1/tools/keyword_research?site=s-trial', 'form-trial', {}], ['owner', '/o/org-1/tools', 'tools', {}], ['owner', '/o/org-1/tools/discover?site=s-erp', 'form-discover', {}]] as const)
  for (const width of [375, 1440]) {
    const c = await context(b, { persona: p as any, width, theme: 'light', ...(extra as any) });
    const { page, errors } = await open(c, path);
    R[`${name}-${width}`] = { text: (await page.locator('main').innerText()).slice(0, 1800), m: await metrics(page), errors };
    await shot(page, `f-${name}-${width}`, width === 1440);
    if (name === 'form-research' && width === 1440) {
      const btn = page.getByRole('button', { name: /Research my keywords/ }).last();
      await btn.click();
      await page.waitForTimeout(1200);
      R.submitCredits = { text: (await page.locator('main').innerText()).slice(0, 2000), toasts: await page.locator('[data-sonner-toast]').allInnerTexts(), api: c.apiLog.filter((x) => x.method !== 'GET').map((x) => `${x.method} ${x.path} ${x.status}`) };
      await shot(page, 'f-form-research-credits-1440', true);
    }
    await c.ctx.close();
  }

// ---------- G. settings switch (platform admin) and as owner
for (const p of ['padmin', 'owner'] as const) {
  const c = await context(b, { persona: p, width: 1440, theme: 'light' });
  const { page, errors } = await open(c, '/o/org-1/sites/s-trial/settings');
  const card = page.getByText('Competitors and Keyword research', { exact: true }).first();
  R[`settings-${p}`] = { found: await card.count(), errors: errors.slice(0, 3) };
  if (await card.count()) { await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await shot(page, `g-settings-${p}`); R[`settings-${p}`].text = (await card.locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText().catch(() => '')).slice(0, 800); }
  else await shot(page, `g-settings-${p}`);
  await c.ctx.close();
}

// ---------- H. reports
for (const r of ['ok', 'partial', 'refused', 'comp']) for (const width of [375, 1440]) {
  const c = await context(b, { persona: 'owner', width, theme: width === 375 ? 'dark' : 'light' });
  const { page, errors } = await open(c, `/o/org-1/reports/rep-${r}`);
  R[`report-${r}-${width}`] = { text: (await page.locator('main').innerText()).slice(0, 900), errors: errors.slice(0, 3) };
  await shot(page, `h-report-${r}-${width}`);
  await c.ctx.close();
}

// ---------- J. performance: a cold load of each page
for (const pg of ['competitors', 'keywords', 'rankings']) {
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  await open(c, `/o/org-1/sites/s-erp/${pg}`);
  const js = c.assets.filter((a) => a.path.endsWith('.js'));
  R[`perf-${pg}`] = { jsFiles: js.length, jsKB: Math.round(js.reduce((s, a) => s + a.bytes, 0) / 1024), chunks: js.map((a) => a.path.replace('/assets/', '') + ' ' + Math.round(a.bytes / 1024) + 'K'), apiCalls: c.apiLog.length, api: c.apiLog.map((x) => x.path) };
  await c.ctx.close();
}
// in-app navigation from the overview to competitors: which chunks are fetched
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/overview');
  const n0 = c.assets.length, a0 = c.apiLog.length;
  await page.getByRole('link', { name: 'Competitors' }).first().click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
  R.navComp = { chunks: c.assets.slice(n0).map((a) => a.path.replace('/assets/', '') + ' ' + Math.round(a.bytes / 1024) + 'K'), api: c.apiLog.slice(a0).map((x) => x.path), heroH2: await page.locator('main h2').first().innerText().catch(() => '') };
  const n1 = c.assets.length;
  await page.getByRole('button', { name: 'Details' }).first().click(); await page.waitForTimeout(800);
  R.drawerChunks = c.assets.slice(n1).map((a) => a.path.replace('/assets/', '') + ' ' + Math.round(a.bytes / 1024) + 'K');
  await c.ctx.close();
}
writeFileSync(`${OUT}/interact.json`, JSON.stringify(R, null, 1));
await b.close();
console.log('done');
