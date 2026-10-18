/**
 * G1 browser pass — every identity screen, driven by a real Chromium against a throwaway stack (gap-g1: own Postgres, API, Vite).
 * Run inside the web container's network namespace so the app is http://localhost:5173 (a secure context: passkeys work):
 *   docker run --rm --network container:gap-g1-web-1 -v <bp>:/bp -v <app>/docs/browser-pass/g1:/out -w /bp \
 *     mcr.microsoft.com/playwright:v1.55.0-noble node g1_pass.mjs <setup|prep|shots>
 */
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = '/out';
const STATE = '/bp/state.json';
const phase = process.argv[2];
const PW = 'browser-pass-1234';
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
mkdirSync(OUT, { recursive: true });
const read = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return {}; } };
const save = (o) => writeFileSync(STATE, JSON.stringify({ ...read(), ...o }, null, 2));

// ------------------------------------------------------------------ TOTP (RFC 6238) for the test person's "phone"
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32dec(s) { let bits = 0, v = 0; const out = []; for (const c of s.replace(/[\s=]/g, '').toUpperCase()) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function totp(secret, offset = 0) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac('sha1', b32dec(secret)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

const CONTRAST = `() => {
  const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const v = rgb(getComputedStyle(n).backgroundColor); if (v && v.a > 0.9) return v.c; n = n.parentElement; } const b = rgb(getComputedStyle(document.body).backgroundColor); return b ? b.c : [255,255,255]; };
  const out = [];
  for (const el of document.querySelectorAll('p,span,a,h1,h2,h3,h4,dt,dd,li,label,button,td,th,div,code,legend')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.opacity === '0') continue;
    const fg = rgb(st.color); if (!fg || fg.a < 0.9) continue;
    const bg = bgOf(el); const l1 = lum(fg.c), l2 = lum(bg);
    const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
    const size = parseFloat(st.fontSize), bold = Number(st.fontWeight) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio + 0.05 < need) out.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need });
  }
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 6);
}`;

const results = read().results ?? [];
const DEV_NOISE = ['/node_modules/.vite/deps/', '/@vite', '/@react-refresh'];
async function visit(page, { name, path, size, theme, expectFailed = [], after }) {
  const errors = [], failed = [];
  const skip = (u) => [...expectFailed, ...DEV_NOISE].some((e) => u.includes(e));
  const onConsole = (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); };
  const onFailed = (r) => { if (!skip(r.url())) failed.push(r.url().slice(0, 140) + ' — ' + (r.failure()?.errorText ?? '')); };
  const onResponse = (r) => { if (r.status() >= 400 && !skip(r.url())) failed.push(r.url().slice(0, 140) + ' — HTTP ' + r.status()); };
  page.on('console', onConsole); page.on('requestfailed', onFailed); page.on('response', onResponse);
  if (path) await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (after) await after(page);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const h1 = await page.locator('h1').count();
  const contrast = await page.evaluate(`(${CONTRAST})()`);
  const file = `${name}-${size}-${theme}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  page.off('console', onConsole); page.off('requestfailed', onFailed); page.off('response', onResponse);
  const row = { name, size, theme, url: page.url().replace(BASE, ''), consoleErrors: errors, failedRequests: failed, overflowPx: Math.max(0, overflow), h1, contrast, shot: file };
  results.push(row);
  const bad = errors.length || failed.length || overflow > 1 || !h1 || contrast.length;
  console.log(`${bad ? 'CHECK' : 'ok   '} ${name} ${size}/${theme}${bad ? ' ' + JSON.stringify({ errors, failed, overflow, h1, contrast }) : ''}`);
  return row;
}

const launch = () => chromium.launch();
const api = async (page, method, path, data, headers = {}) => {
  const r = await page.request.fetch(BASE + path, { method, data, headers: { 'x-requested-with': 'fetch', ...headers } });
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  if (r.status() >= 400) throw new Error(`${method} ${path} → ${r.status()} ${t.slice(0, 200)}`);
  return body;
};

// ------------------------------------------------------------------ phase 1: an owner with an app and a passkey, a company, a member
async function setup() {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: SIZES.desktop, colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'MacBook Touch ID' : undefined));
  const owner = { email: 'dana@northwind-demo.example', name: 'Dana Okafor' };
  await api(page, 'POST', '/api/auth/signup', { name: owner.name, email: owner.email, password: PW });
  const org = await api(page, 'POST', '/api/orgs', { name: 'Northwind Trading', industry: 'Wholesale' });
  await api(page, 'PATCH', `/api/orgs/${org.id}/onboarding`, { step: 'done', done: true });

  // the authenticator app, through the UI
  await page.goto(BASE + '/account');
  await page.waitForLoadState('networkidle');
  const startResp = page.waitForResponse((r) => r.url().includes('/api/me/mfa/totp/start'));
  await page.getByRole('button', { name: 'Set up', exact: true }).click();
  const secret = (await (await startResp).json()).secret;
  await page.getByLabel('Code from the app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await page.getByRole('heading', { name: 'Save your recovery codes' }).waitFor();
  const codes = (await page.locator('[role=dialog] li').allTextContents()).map((s) => s.trim());
  await page.getByRole('button', { name: 'I saved them' }).click();

  // a passkey, through the UI, with Chromium's virtual authenticator
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } });
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await page.getByText('MacBook Touch ID').waitFor({ timeout: 15_000 });
  console.log('passkey added');

  // sign out and back in with the passkey (the second step)
  await api(page, 'POST', '/api/auth/logout');
  await page.goto(BASE + '/login');
  await page.getByLabel('Work e-mail').fill(owner.email);
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirm it is you' }).waitFor();
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 });
  console.log('signed in with the passkey →', new URL(page.url()).pathname);
  const creds = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  console.log('virtual authenticator holds', creds.credentials.length, 'credential(s), sign count', creds.credentials[0]?.signCount);

  // a member with a password (invited), and a second device for the owner
  const inv = await api(page, 'POST', `/api/orgs/${org.id}/invitations`, { email: 'pat@northwind-demo.example', role: 'member' });
  const mctx = await browser.newContext();
  const mpage = await mctx.newPage();
  await api(mpage, 'POST', '/api/auth/signup', { name: 'Pat Reyes', email: 'pat@northwind-demo.example', password: PW, inviteToken: inv.inviteUrl.split('/invite/')[1] });
  await mctx.storageState({ path: '/bp/member.json' });
  const phone = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const ppage = await phone.newPage();
  await ppage.request.post(BASE + '/api/auth/login', { data: { email: owner.email, password: PW }, headers: { 'x-requested-with': 'fetch' } });
  await ppage.request.post(BASE + '/api/auth/mfa/verify', { data: { method: 'recovery', code: codes[0] }, headers: { 'x-requested-with': 'fetch' } });

  // single sign-on settings: a domain and a SAML connection (the domain is verified in the database between phases: example
  // domains cannot carry our TXT record)
  const dom = await api(page, 'POST', `/api/orgs/${org.id}/sso/domains`, { domain: 'northwind-demo.example' });
  await api(page, 'PUT', `/api/orgs/${org.id}/sso/connection`, {
    protocol: 'saml',
    saml: { entityId: 'http://www.okta.com/exk1northwind', ssoUrl: 'https://northwind.okta.example/app/ascentra/exk1northwind/sso/saml', certificates: [readFileSync('/bp/cert.pem', 'utf8')] },
    jitEnabled: true,
    defaultRole: 'member',
  });
  // a failed sign-in, for the log
  await page.request.post(BASE + '/api/auth/login', { data: { email: 'pat@northwind-demo.example', password: 'not the right one 1' }, headers: { 'x-requested-with': 'fetch' } });
  await ctx.storageState({ path: '/bp/owner.json' });
  save({ owner, orgId: org.id, secret, codes: codes.slice(1), domainId: dom.id, results });
  await browser.close();
}

// ------------------------------------------------------------------ phase 2 (after the database step): SCIM pushes people and groups
async function prep() {
  const s = read();
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: '/bp/owner.json' });
  const page = await ctx.newPage();
  const tok = await api(page, 'POST', `/api/orgs/${s.orgId}/scim/tokens`, { name: 'Okta' });
  const h = { authorization: `Bearer ${tok.token}`, 'content-type': 'application/scim+json' };
  const scim = async (method, path, body) => {
    const r = await page.request.fetch(`${BASE}/api/scim/v2${path}`, { method, data: body ? JSON.stringify(body) : undefined, headers: h });
    const t = await r.text();
    console.log('SCIM', method, path, r.status());
    return t ? JSON.parse(t) : null;
  };
  const u1 = await scim('POST', '/Users', { userName: 'lena@northwind-demo.example', name: { givenName: 'Lena', familyName: 'Sato' }, emails: [{ primary: true, value: 'lena@northwind-demo.example' }], active: true, externalId: '00u1lena' });
  const u2 = await scim('POST', '/Users', { userName: 'omar@northwind-demo.example', name: { givenName: 'Omar', familyName: 'Haddad' }, emails: [{ primary: true, value: 'omar@northwind-demo.example' }], active: true });
  const g1 = await scim('POST', '/Groups', { displayName: 'Ascentra Admins', members: [{ value: u1.id }] });
  await scim('POST', '/Groups', { displayName: 'Marketing', members: [{ value: u2.id }] });
  await scim('PATCH', `/Users/${u2.id}`, { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'Replace', path: 'active', value: 'False' }] });
  await api(page, 'PATCH', `/api/orgs/${s.orgId}/scim/groups/${g1.id}`, { role: 'admin' });
  // the company requires two-step verification now (Pat has none)
  await api(page, 'PUT', `/api/orgs/${s.orgId}/security`, { requireMfa: true, mfaTrustGoogle: false, mfaTrustSso: true, idleTimeoutMinutes: 240, auditRetentionDays: 730 });
  // one more owner session, made stale in the database afterwards, for the step-up screen
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await sp.request.post(BASE + '/api/auth/login', { data: { email: s.owner.email, password: PW }, headers: { 'x-requested-with': 'fetch' } });
  const v = await sp.request.post(BASE + '/api/auth/mfa/verify', { data: { method: 'totp', code: totp(s.secret) }, headers: { 'x-requested-with': 'fetch' } });
  console.log('stale-to-be session', v.status());
  await sctx.storageState({ path: '/bp/owner-stale.json' });
  await browser.close();
}

// ------------------------------------------------------------------ phase 3: every screen, 1440 / 390, light / dark
async function shots() {
  const s = read();
  const browser = await launch();
  const o = `/o/${s.orgId}`;
  let n = 0;
  for (const size of ['desktop', 'phone'])
    for (const theme of ['light', 'dark']) {
      const pub = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
      const p = await pub.newPage();
      await visit(p, { name: 'g1-01-login', path: '/login', size, theme });
      await visit(p, { name: 'g1-02-login-sso', path: '/login/sso?error=sso_none&email=someone%40elsewhere.example', size, theme });
      await visit(p, {
        name: 'g1-03-login-second-step', path: '/login', size, theme,
        after: async (pg) => {
          await pg.getByLabel('Work e-mail').fill(s.owner.email);
          await pg.getByLabel('Password').fill(PW);
          await pg.getByRole('button', { name: 'Sign in', exact: true }).click();
          await pg.getByRole('heading', { name: 'Confirm it is you' }).waitFor();
          await pg.getByRole('button', { name: 'Use your authenticator app' }).click();
        },
      });
      await pub.close();

      // a new person sets up an authenticator app: the QR dialog and the recovery codes
      const fresh = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
      const f = await fresh.newPage();
      await api(f, 'POST', '/api/auth/signup', { name: 'Sam Fresh', email: `sam${++n}@fresh-demo.example`, password: PW });
      let secret = '';
      await visit(f, {
        name: 'g1-04-totp-setup', path: '/account', size, theme,
        after: async (pg) => {
          const r = pg.waitForResponse((x) => x.url().includes('/api/me/mfa/totp/start'));
          await pg.getByRole('button', { name: 'Set up', exact: true }).click();
          secret = (await (await r).json()).secret;
          await pg.getByLabel('Code from the app').waitFor();
        },
      });
      await visit(f, {
        name: 'g1-05-recovery-codes', size, theme,
        after: async (pg) => {
          await pg.getByLabel('Code from the app').fill(totp(secret));
          await pg.getByRole('button', { name: 'Turn on' }).click();
          await pg.getByRole('heading', { name: 'Save your recovery codes' }).waitFor();
        },
      });
      await fresh.close();

      const own = await browser.newContext({ viewport: SIZES[size], colorScheme: theme, storageState: '/bp/owner.json' });
      const q = await own.newPage();
      q.on('dialog', (d) => d.accept());
      await visit(q, { name: 'g1-06-account', path: '/account', size, theme });
      await visit(q, { name: 'g1-07-company-security', path: `${o}/settings/security`, size, theme });
      await visit(q, { name: 'g1-08-audit-log', path: `${o}/settings/audit`, size, theme });
      await visit(q, { name: 'g1-09-audit-event', size, theme, after: async (pg) => { await pg.locator('tbody tr').first().click(); await pg.getByRole('dialog').waitFor(); } });
      await visit(q, { name: 'g1-10-sso', path: `${o}/settings/sso`, size, theme });
      await visit(q, { name: 'g1-11-team', path: `${o}/settings/team`, size, theme });
      if (size === 'desktop' && theme === 'light') {
        // the CSV export, as a person downloads it
        await q.goto(BASE + `${o}/settings/audit`);
        await q.waitForLoadState('networkidle');
        const dl = q.waitForEvent('download');
        await q.getByRole('link', { name: 'Export CSV' }).click();
        const file = await (await dl).path();
        const csv = readFileSync(file, 'utf8').replace(/^﻿/, '').trim().split('\r\n');
        console.log('CSV', (await dl).suggestedFilename(), 'rows', csv.length - 1, 'header', csv[0]);
        writeFileSync(`${OUT}/g1-audit-export-header.txt`, `${(await dl).suggestedFilename()}\n${csv[0]}\nrows: ${csv.length - 1}\n`);
      }
      await own.close();

      // the member without a second step, in a company that requires one
      const mem = await browser.newContext({ viewport: SIZES[size], colorScheme: theme, storageState: '/bp/member.json' });
      await visit(await mem.newPage(), { name: 'g1-12-company-mfa-gate', path: o, size, theme, expectFailed: [`/api/orgs/${s.orgId}`] });
      await mem.close();

      // step-up: a security change after the 10 minutes are up (the owner's sessions are made stale between phases)
      const stale = await browser.newContext({ viewport: SIZES[size], colorScheme: theme, storageState: '/bp/owner-stale.json' });
      const st = await stale.newPage();
      st.on('dialog', (d) => d.accept());
      await visit(st, {
        name: 'g1-13-step-up', path: '/account', size, theme, expectFailed: ['/api/me/mfa/totp'],
        after: async (pg) => {
          await pg.getByRole('button', { name: 'Remove', exact: true }).first().click();
          await pg.getByRole('heading', { name: 'Confirm it is you' }).waitFor();
        },
      });
      await stale.close();
    }
  save({ results });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results.filter((r) => r.name.startsWith('g1-')), null, 2));
  await browser.close();
}

async function stale() {
  const s = read();
  const browser = await launch();
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await sp.request.post(BASE + '/api/auth/login', { data: { email: s.owner.email, password: PW }, headers: { 'x-requested-with': 'fetch' } });
  const v = await sp.request.post(BASE + '/api/auth/mfa/verify', { data: { method: 'totp', code: totp(s.secret, 1) }, headers: { 'x-requested-with': 'fetch' } });
  console.log('stale-to-be session', v.status());
  await sctx.storageState({ path: '/bp/owner-stale.json' });
  await browser.close();
}

await ({ setup, prep, shots, stale })[phase]();
