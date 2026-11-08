// Second pass on 3a990e62: the matrix, states, personas, and every fixed finding re-checked; prefilled links followed to their forms.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch, context, open, metrics, axe, sid, BASE } from './harness.mts';
const OUT = '/out/pass2';
mkdirSync(OUT, { recursive: true });
const R: any = { matrix: [], axe: [], states: [], personas: [], links: [] };
const b = await launch();
const shot = (page: any, name: string, full = false) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 50, fullPage: full });
const go = async (page: any, path: string, wait = 600) => { await page.goto(BASE + sid(path), { waitUntil: 'networkidle' }); await page.waitForTimeout(wait); };
const formValues = (page: any) => page.evaluate(() => [...document.querySelectorAll('main input, main textarea, main select')].map((e: any) => ({ n: e.name || e.id || e.getAttribute('aria-label') || '', t: e.type, v: e.type === 'checkbox' ? String(e.checked) : e.value })).filter((x: any) => x.v && x.v !== 'false'));
const focusInfo = (page: any) => page.evaluate(() => { const el = document.activeElement as HTMLElement | null; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 50), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') }; });

// ---------- matrix
for (const theme of ['light', 'dark'] as const)
  for (const width of [375, 768, 1024, 1440]) {
    const c = await context(b, { persona: 'owner', width, theme });
    for (const pg of ['competitors', 'keywords']) {
      const { page, errors } = await open(c, `/o/org-1/sites/s-erp/${pg}`);
      const m = await metrics(page);
      // KI info tips: the real hit area (button box or its ::after)
      const tip = await page.evaluate(() => { const b = document.querySelector('main button[aria-label="What this means"], main button[aria-label^="About"]') as HTMLElement | null; if (!b) return null; const a = getComputedStyle(b, '::after'); const r = b.getBoundingClientRect(); return { box: `${Math.round(r.width)}x${Math.round(r.height)}`, after: a.content !== 'none' ? `${a.width}x${a.height} inset ${a.inset}` : 'none' }; });
      R.matrix.push({ pg, width, theme, ...m, tip, errors: errors.filter((e) => !/404/.test(e)) });
      if (width === 375 || width === 1440) R.axe.push({ pg, width, theme, v: await axe(page) });
      if ((width === 375 && theme === 'light') || (width === 1440 && theme === 'dark') || (width === 768 && theme === 'light')) await shot(page, `m-${pg}-${width}-${theme}${width === 375 ? '-full' : ''}`, width === 375);
      await page.close();
    }
    await c.ctx.close();
  }

// ---------- states (owner)
const states: [string, string, any][] = [['s-new', 'empty', {}], ['s-one', 'one-row', {}], ['s-edx', 'partial', {}], ['s-refused', 'refused', {}], ['s-credits', 'credits', {}], ['s-off', 'off', {}], ['s-killed', 'killed', {}], ['s-erp', 'error', { failPaths: /\/ki\/(keywords|competitors)$/ }], ['s-erp', 'loading', { slowKeywordsMs: 60000 }]];
for (const [site, name, extra] of states)
  for (const width of [375, 1440]) {
    const c = await context(b, { persona: 'owner', width, theme: 'light', ...extra });
    for (const pg of ['competitors', 'keywords']) {
      const page = await c.ctx.newPage();
      await page.goto(BASE + sid(`/o/org-1/sites/${site}/${pg}`), { waitUntil: name === 'loading' ? 'domcontentloaded' : 'networkidle' });
      await page.waitForTimeout(name === 'loading' ? 2500 : name === 'error' ? 9000 : 600);
      const text = (await page.locator('main').innerText().catch(() => '')).slice(0, 1100);
      const nav = await page.locator('aside a, nav a').allInnerTexts().catch(() => []);
      const links = await page.locator('main a').evaluateAll((as) => as.map((a: any) => `${a.innerText.trim().replace(/\s+/g, ' ')} -> ${a.getAttribute('href')}`).filter((x: string) => !x.startsWith(' ')).slice(0, 12));
      R.states.push({ site, name, pg, width, text, links, navKi: nav.some((x) => /Competitors|Keyword research/.test(x)) });
      if (width === 1440 || name === 'refused') await shot(page, `s-${name}-${pg}-${width}`);
      await page.close();
    }
    await c.ctx.close();
  }

// ---------- personas
for (const [p, site] of [['viewer', 's-erp'], ['member', 's-erp'], ['admin', 's-erp'], ['padmin', 's-trial'], ['owner', 's-trial'], ['padmin', 's-killed']] as const) {
  const c = await context(b, { persona: p, width: 1440, theme: 'light' });
  for (const pg of ['competitors', 'keywords']) {
    const { page } = await open(c, `/o/org-1/sites/${site}/${pg}`);
    const buttons = await page.locator('main button:visible, main a:visible').allInnerTexts();
    const nav = await page.locator('aside a, nav a').allInnerTexts().catch(() => []);
    R.personas.push({ p, site, pg, navKi: nav.some((x) => /Competitors|Keyword research/.test(x)), buttons: [...new Set(buttons.map((x) => x.trim().replace(/\s+/g, ' ')).filter((x) => x && !x.startsWith('About')))].slice(0, 40), text: (await page.locator('main').innerText()).slice(0, 700) });
    if (p === 'viewer' || p === 'padmin') await shot(page, `p-${p}-${site}-${pg}`);
    await page.close();
  }
  await c.ctx.close();
}

// ---------- fixed findings, owner 1440
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/keywords');
  const K: any = {};
  await page.getByRole('button', { name: 'What makes up this score' }).first().hover(); await page.waitForTimeout(500);
  K.scoreTip = await page.locator('[role=tooltip]').allInnerTexts();
  await shot(page, 'x-kw-scoretip-1440'); await page.mouse.move(0, 0); await page.waitForTimeout(300);
  K.hero = await page.locator('main h2').first().innerText();
  K.heroDesc = await page.getByText(/We found .* searches/).first().innerText().catch(() => '');
  K.topicsDesc = await page.getByText(/topics?, best first|topics?\b.*best first/).first().innerText().catch(() => '');
  K.comingSoon = await page.getByText('Coming soon').count();
  K.unknownBadges = await page.getByText('Not judged yet').count();
  K.gatedReasons = await page.locator('[data-verdict=gated]').allInnerTexts();
  const sel = page.locator('[data-ki-filters] select');
  K.filterCount = await sel.count();
  K.filterLabels = await page.locator('[data-ki-filters] label').allInnerTexts();
  // gap filter
  const gapIdx = (await page.locator('[data-ki-filters] label').allInnerTexts()).findIndex((t) => /^Gap/.test(t));
  if (gapIdx >= 0) {
    K.gapOptions = await sel.nth(gapIdx).locator('option').allInnerTexts();
    await sel.nth(gapIdx).selectOption({ index: 1 }); await page.waitForTimeout(900);
    K.gapDesc = await page.getByText(/match your filters/).first().innerText().catch(() => '');
    K.gapRows = await page.locator('table tbody tr').count();
    K.gapPager = await page.getByText(/^\d[\d,]*-\d[\d,]* of/).allInnerTexts();
    await shot(page, 'x-kw-gapfilter-1440');
    await sel.nth(gapIdx).selectOption(''); await page.waitForTimeout(600);
  }
  // topic picker
  const topIdx = (await page.locator('[data-ki-filters] label').allInnerTexts()).findIndex((t) => /^Topic/.test(t));
  if (topIdx >= 0) K.topicOptions = await sel.nth(topIdx).locator('option').count();
  // verdict filter offers unknown?
  K.verdictOptions = await sel.nth(0).locator('option').allInnerTexts();
  // tab count to the first filter
  await page.locator('main h1').click();
  let tabs = 0, f: any = null, noRing = 0;
  for (; tabs < 300; tabs++) { await page.keyboard.press('Tab'); f = await focusInfo(page); if (f && !f.ring) noRing++; if (f?.tag === 'select') break; }
  K.tabsToFirstFilter = tabs + 1; K.noRing = noRing;
  // the action buttons on the page, and where each goes
  K.actions = await page.locator('main a').evaluateAll((as) => as.map((a: any) => ({ t: a.innerText.trim().replace(/\s+/g, ' '), h: a.getAttribute('href') })).filter((x: any) => /Write this page|Improve this page|Refresh this page|Plan the ladder|How to get|Find websites|See all|Show all/.test(x.t)).slice(0, 40));
  K.showAll = await page.getByRole('button', { name: /Show all|See every/ }).allInnerTexts();
  K.whereFrom = await page.locator('table tbody tr td:nth-child(6)').first().innerText().catch(() => '');
  K.strikingLink = await page.getByText(/See all \d+ in the table/).count();
  R.keywords = K;
  await page.close();

  const p2 = await c.ctx.newPage();
  await go(p2, '/o/org-1/sites/s-erp/competitors');
  const C: any = {};
  C.comingSoon = await p2.getByText('Coming soon').count();
  C.runBtn = await p2.locator('main a', { hasText: /Check my competitors again|Find my competitors/ }).first().evaluate((a: any) => ({ text: a.innerText.replace(/\s+/g, ' '), cls: a.className.includes('bg-accent') ? 'primary' : 'secondary' })).catch(() => null);
  C.updated = await p2.getByText(/Updated today/).count();
  C.gapChips = await p2.getByRole('group').allInnerTexts().catch(() => []);
  C.gapKinds = await p2.locator('li').filter({ hasText: 'What to do' }).locator('span').filter({ hasText: /rank|missing|low|lead|off page|topic|kind of page|AI|list|link/ }).allInnerTexts().catch(() => []);
  C.actions = await p2.locator('main a').evaluateAll((as) => as.map((a: any) => ({ t: a.innerText.trim().replace(/\s+/g, ' '), h: a.getAttribute('href') })).filter((x: any) => /Write this page|Improve this page|Refresh this page|Plan the ladder|How to get|Find websites|Get listed|Show all/.test(x.t)).slice(0, 30));
  C.text = (await p2.locator('main').innerText()).slice(0, 3000);
  await p2.locator('main h1').click();
  let t2 = 0; for (; t2 < 150; t2++) { await p2.keyboard.press('Tab'); const ff = await focusInfo(p2); if (ff && /^Choose$/.test(ff.text)) break; }
  C.tabsToChoose = t2 + 1;
  await p2.getByRole('button', { name: 'Details' }).first().click(); await p2.waitForTimeout(900);
  C.drawer = (await p2.getByRole('dialog').innerText()).slice(0, 1400);
  await shot(p2, 'x-drawer-1440');
  R.competitors = C;
  await c.ctx.close();
}

// ---------- drawer + pages at 375
{
  const c = await context(b, { persona: 'owner', width: 375, height: 812, theme: 'dark' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/competitors');
  R.comp375 = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.getByRole('button', { name: 'Details' }).first().click(); await page.waitForTimeout(900);
  await page.getByRole('dialog').locator('div.overflow-y-auto').first().evaluate((el) => (el.scrollTop = 1000)); await page.waitForTimeout(200);
  await shot(page, 'x-drawer-375-dark');
  R.drawer375 = await page.evaluate(() => { const d = document.querySelector('[role=dialog]') as HTMLElement; const t = d?.querySelector('table'); return { tableVisible: !!t && (t as HTMLElement).offsetParent !== null, cards: d?.querySelectorAll('[data-table-cards] li').length ?? 0, dialogs: document.querySelectorAll('[role=dialog]').length }; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  for (const [i, y] of [[0, 600], [1, 1800], [2, 3000]]) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(150); await shot(page, `x-comp375-dark-${i}`); }
  const p2 = await c.ctx.newPage();
  await go(p2, '/o/org-1/sites/s-erp/keywords');
  R.kw375 = await p2.evaluate(() => document.documentElement.scrollHeight);
  const see = p2.getByRole('button', { name: /See every search/ });
  R.kw375See = await see.count();
  if (R.kw375See) { await see.first().click(); await p2.waitForTimeout(800); R.kw375AfterSee = await p2.evaluate(() => document.documentElement.scrollHeight); await p2.getByRole('button', { name: /^Filters/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await shot(p2, 'x-kw375-every-dark'); }
  await c.ctx.close();
}

// ---------- every prefilled link followed (owner, 1440): landing path + field values
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  for (const pg of ['keywords', 'competitors']) {
    const page = await c.ctx.newPage();
    await go(page, `/o/org-1/sites/s-erp/${pg}`);
    const hrefs: { t: string; h: string }[] = await page.locator('main a').evaluateAll((as) => as.map((a: any) => ({ t: a.innerText.trim().replace(/\s+/g, ' '), h: a.getAttribute('href') })).filter((x: any) => /Write this page|Improve this page|Refresh this page|Plan the ladder|How to get|Find websites|Get listed|Run it for/.test(x.t)));
    const seen = new Set<string>();
    for (const x of hrefs) {
      const key = x.t + '|' + x.h.split('?')[0];
      if (seen.has(key) && !/Write|Improve|Plan/.test(x.t)) continue;
      seen.add(key);
      if (R.links.length > 26) break;
      const q = await c.ctx.newPage();
      await q.goto(BASE + x.h, { waitUntil: 'networkidle' }); await q.waitForTimeout(700);
      const h1 = await q.locator('main h1').first().innerText().catch(() => '');
      const vals = await formValues(q);
      R.links.push({ from: pg, label: x.t, href: decodeURIComponent(x.h).slice(0, 220), landed: q.url().replace(BASE, '').slice(0, 120), h1, fields: vals.filter((v: any) => v.t !== 'hidden').map((v: any) => `${v.n}=${String(v.v).slice(0, 90)}`).slice(0, 8) });
      if (R.links.length <= 3 || /Plan the ladder|How to get listed/.test(x.t)) await shot(q, `l-${R.links.length}-${x.t.replace(/\W+/g, '_').slice(0, 20)}`);
      await q.close();
    }
    await page.close();
  }
  // refused: the "Run it for" link
  const r = await c.ctx.newPage();
  await go(r, '/o/org-1/sites/s-refused/keywords');
  const run = r.locator('main a', { hasText: /Run it for/ }).first();
  if (await run.count()) { const h = await run.getAttribute('href'); await r.goto(BASE + h!, { waitUntil: 'networkidle' }); await r.waitForTimeout(600); R.refusedLink = { href: decodeURIComponent(h!), h1: await r.locator('main h1').first().innerText(), fields: (await formValues(r)).map((v: any) => `${v.n}=${v.v}`).slice(0, 6) }; }
  await c.ctx.close();
}

// ---------- clicks: overview -> answer, overview -> act on "what to write next"
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/sites/s-erp/overview');
  await page.getByRole('link', { name: 'Keyword research' }).first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
  const heroBtn = page.locator('main a').filter({ hasText: /Write this page|Improve this page|Plan the ladder/ }).first();
  const label = await heroBtn.innerText().catch(() => '');
  await heroBtn.click().catch(() => {}); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
  R.clicksWrite = { firstButton: label.replace(/\s+/g, ' '), landed: decodeURIComponent(page.url().replace(BASE, '')).slice(0, 200), h1: await page.locator('main h1').first().innerText().catch(() => ''), fields: (await formValues(page)).map((v: any) => `${v.n}=${String(v.v).slice(0, 80)}`).slice(0, 8) };
  await shot(page, 'c-write-next-landing');
  await c.ctx.close();
}

// ---------- tools page and the switch
{
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, '/o/org-1/tools?site=s-erp');
  const t = await page.locator('main').innerText();
  const i = t.indexOf('Research\n');
  R.tools = { more: t.includes('More tools'), research: t.slice(t.indexOf('Find the keywords worth'), t.indexOf('Find the keywords worth') + 1500) };
  await page.getByText('Find the keywords worth').first().scrollIntoViewIfNeeded(); await shot(page, 't-tools-research-1440');
  const f = await c.ctx.newPage(); await go(f, '/o/org-1/tools/keyword_research?site=s-erp');
  R.formHead = (await f.locator('main').innerText()).slice(0, 300);
  await c.ctx.close();
  const c2 = await context(b, { persona: 'padmin', width: 375, theme: 'light' });
  const g = await c2.ctx.newPage(); await go(g, '/o/org-1/sites/s-trial/settings/tracking');
  const card = g.getByText('Competitors and Keyword research', { exact: true }).first();
  if (await card.count()) { await card.scrollIntoViewIfNeeded(); await g.getByRole('radio', { name: 'On' }).click().catch(() => g.getByText('On', { exact: true }).last().click()); await g.waitForTimeout(300); await g.getByRole('button', { name: 'Save', exact: true }).last().click().catch(() => {}); await g.waitForTimeout(500); R.switchOn = { dialog: (await g.getByRole('alertdialog').or(g.getByRole('dialog')).allInnerTexts()).map((x) => x.slice(0, 400)) }; await shot(g, 'g-switch-on-confirm-375'); }
  const tf = await c2.ctx.newPage(); await go(tf, '/o/org-1/tools/keyword_research?site=s-trial');
  R.trialForm = (await tf.locator('main').innerText()).match(/free trial run[^\n]*|Trial[^\n]*|\d+ credits/g)?.slice(0, 6);
  await c2.ctx.close();
}

// ---------- reports
for (const r of ['ok', 'partial', 'refused']) {
  const c = await context(b, { persona: 'owner', width: 1440, theme: 'light' });
  const { page } = await open(c, `/o/org-1/reports/rep-${r}`);
  R[`report-${r}`] = (await page.locator('main').innerText()).slice(0, 700);
  if (r === 'refused') await shot(page, 'h-report-refused');
  await c.ctx.close();
}
writeFileSync(`${OUT}/pass2.json`, JSON.stringify(R, null, 1));
await b.close();
console.log('done');
