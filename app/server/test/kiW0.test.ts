// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §1, §4, §7): a Competitors / Keyword research run starts only on a website
// switched On, or in Trial for a platform admin; a refused or failed answer ends the run failed (not charged); the run watcher reads the KI
// workflow. Synthetic data; the engine read is injected.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ platform: false }));
vi.mock('../src/auth/access', async (orig) => ({ ...(await orig<typeof import('../src/auth/access')>()), isPlatformAdmin: vi.fn(() => st.platform) }));

import { assertKiRunAllowed, kiModeFor } from '../src/services/ki';
import { noResultOf, runOutcome } from '../src/services/runs';

const site = { domain: 'nova-ki.example' };
const user = { id: 'u1', email: 'a@nova-ki.example' } as never;
const rows = (ki_mode: unknown) => async () => [{ domain: site.domain, ki_mode } as never];
const fails = async () => {
  throw new Error('engine down');
};
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { statusCode?: number; code?: string }) => `${e.statusCode} ${e.code}`);

describe('KI W0: who may start a keyword-intelligence run', () => {
  it('On: anyone the run route lets in; Trial: platform admins only; Off, empty or unknown: nobody', async () => {
    st.platform = false;
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, site, user, rows('on')))).toBe('ok');
    expect(await codeOf(assertKiRunAllowed({ mode: 'keyword_research' }, site, user, rows('trial')))).toBe('403 ki_not_available');
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, site, user, rows('')))).toBe('403 ki_not_available');
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, site, user, rows('shadow')))).toBe('403 ki_not_available');
    st.platform = true;
    expect(await codeOf(assertKiRunAllowed({ mode: 'keyword_research' }, site, user, rows(' Trial ')))).toBe('ok');
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, site, user, rows('off')))).toBe('403 ki_not_available');
    st.platform = false;
  });
  it('an engine that cannot be read starts nothing (409), and every other mode is untouched', async () => {
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, site, user, fails))).toBe('409 ki_mode_unknown');
    expect(await kiModeFor(site.domain, fails)).toBeNull();
    expect(await kiModeFor(site.domain, async () => [])).toBe('off');
    expect(await codeOf(assertKiRunAllowed({ mode: 'backlinks' }, site, user, fails))).toBe('ok');
    expect(await codeOf(assertKiRunAllowed({ mode: 'competitors' }, null, user, rows('on')))).toBe('400 bad_request');
  });
  it('the guard sits in the run path before anything is quoted or started', () => {
    const src = readFileSync(join(__dirname, '../src/services/runs.ts'), 'utf8');
    const at = src.indexOf('await assertKiRunAllowed(input, site, user);');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf('const estimated = await estimateCost(input, site);'));
  });
});

describe('KI W0: what a refused or failed KI answer does to the run', () => {
  const finals = ['ki_competitors'];
  it('refused (the W0 skeleton\'s answer) or failed ends the run failed with a plain sentence, so it is never charged', () => {
    const r = runOutcome('running', finals, 'ki_competitors', { stage: 'ki_competitors', status: 'refused', reason: 'not_available_yet' });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/not available yet\. Nothing was charged/);
    expect(r.error).not.toMatch(/[—–…‘’“”]/);
    expect(noResultOf('ki_research', { status: 'refused', reason: 'killed' })).toMatch(/paused/);
    expect(noResultOf('ki_research', { status: 'failed' })).toMatch(/could not finish/);
    expect(noResultOf('ki_research', { status: 'refused', reason: 'something new' })).toMatch(/could not run/);
  });
  it('a delivered answer completes, and other stages are as before', () => {
    expect(runOutcome('running', finals, 'ki_competitors', { stage: 'ki_competitors', status: 'ok' }).status).toBe('completed');
    expect(runOutcome('running', finals, 'ki_competitors', { stage: 'ki_competitors', status: 'partial' }).status).toBe('completed');
    expect(noResultOf('content', { status: 'refused' })).toBeNull();
  });
});

describe('KI W0: the run watcher reads the KI workflow', () => {
  it('SEOagentKIntel1 is in WATCHED', () => {
    const src = readFileSync(join(__dirname, '../src/services/engineFailures.ts'), 'utf8');
    expect(src).toMatch(/export const WATCHED = \[[^\]]*'SEOagentKIntel1'[^\]]*\]/);
  });
});
