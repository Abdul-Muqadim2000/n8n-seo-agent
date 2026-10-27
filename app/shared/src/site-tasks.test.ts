import { describe, expect, it } from 'vitest';
import { deriveSiteTasks, redirectTaskKey, siteTaskPayload, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';

// Site tasks (2026-10-28, app/docs/SITE_TASKS.md): what is a step on the client's website, and whether it is done. The newest reading
// decides (the engine's weekly / monthly run or the app's own check), a step found missing after it was done is reopened, a skip
// is the client's, and a website with no stored row still sees its steps.

const KEY = '0164d4832b1f1282c628825ad67050dd';
const base: SiteTaskInputs = { domain: 'novaand-demo.com', indexnow: null, access: null, reclaim: null };
const withKey = (verified: boolean, checkedAt = '2026-10-25T20:08:00.000Z'): SiteTaskInputs => ({
  ...base,
  indexnow: { keyUrl: `https://www.novaand-demo.com/${KEY}.txt`, key: KEY, verified, checkedAt },
});
const row = (o: Partial<StoredSiteTask> & Pick<StoredSiteTask, 'key' | 'kind'>): StoredSiteTask => ({
  payload: {},
  lastCheck: null,
  doneAt: null,
  skippedAt: null,
  skippedBy: null,
  createdAt: '2026-10-26T00:00:00.000Z',
  ...o,
});

describe('IndexNow file', () => {
  it('no key yet: no step', () => {
    expect(deriveSiteTasks(base, [])).toEqual([]);
  });
  it('a key the weekly run did not find: to do, with the file name, its one line and its address', () => {
    const [t] = deriveSiteTasks(withKey(false), []);
    expect(t).toMatchObject({ key: 'indexnow', kind: 'indexnow', state: 'todo', reopened: false, severity: 'info', guide: 'indexnow-key-file' });
    expect(t.values.map((v) => v.value)).toEqual([`${KEY}.txt`, KEY, `https://www.novaand-demo.com/${KEY}.txt`]);
    expect(t.guideVars).toMatchObject({ domain: 'novaand-demo.com', indexNowKey: KEY });
    expect(t.lastCheck?.by).toBe('weekly');
  });
  it('found by the weekly run with no stored row: done (every production website sees its state at once)', () => {
    const [t] = deriveSiteTasks(withKey(true), []);
    expect(t).toMatchObject({ state: 'done', doneAt: '2026-10-25T20:08:00.000Z' });
  });
  it('the client checked after the weekly run: their newer reading decides', () => {
    const stored = row({ key: 'indexnow', kind: 'indexnow', lastCheck: { at: '2026-10-28T09:00:00.000Z', ok: true, message: 'found', by: 'you', who: 'Sam' }, doneAt: '2026-10-28T09:00:00.000Z' });
    const [t] = deriveSiteTasks(withKey(false), [stored]);
    expect(t).toMatchObject({ state: 'done', lastCheck: { by: 'you', who: 'Sam' } });
  });
  it('done, then a newer reading finds it gone: reopened and important', () => {
    const stored = row({ key: 'indexnow', kind: 'indexnow', lastCheck: { at: '2026-10-28T09:00:00.000Z', ok: true, message: 'found', by: 'you' }, doneAt: '2026-10-28T09:00:00.000Z' });
    const [t] = deriveSiteTasks(withKey(false, '2026-11-01T20:00:00.000Z'), [stored]);
    expect(t).toMatchObject({ state: 'todo', reopened: true, severity: 'warning', doneAt: '2026-10-28T09:00:00.000Z' });
  });
  it('a failed check never reopens a step that was never done', () => {
    const stored = row({ key: 'indexnow', kind: 'indexnow', lastCheck: { at: '2026-10-28T09:00:00.000Z', ok: false, message: '404', by: 'you' } });
    const [t] = deriveSiteTasks(withKey(false), [stored]);
    expect(t).toMatchObject({ state: 'todo', reopened: false, severity: 'info', lastCheck: { message: '404' } });
  });
  it('skipped: stays listed as skipped, out of the to-do list', () => {
    const [t] = deriveSiteTasks(withKey(false), [row({ key: 'indexnow', kind: 'indexnow', skippedAt: '2026-10-28T09:00:00.000Z', skippedBy: 'Sam' })]);
    expect(t).toMatchObject({ state: 'skipped', skipped: { who: 'Sam' } });
  });
});

describe('AI search crawlers', () => {
  const access = (bots: { bot: string; allowed: boolean; blockedPaths?: string[]; group?: 'answer' | 'training' }[], checkedAt = '2026-10-25T19:43:00.000Z'): SiteTaskInputs => ({
    ...base,
    access: { checkedAt, bots: bots.map((b) => ({ owner: b.bot, rule: b.allowed ? '' : 'Disallow: /', blockedPaths: [], group: 'answer', ...b })) },
  });
  it('only answer crawlers make a step; a blocked training crawler is the owner\'s choice', () => {
    expect(deriveSiteTasks(access([{ bot: 'GPTBot', allowed: false, group: 'training' }, { bot: 'OAI-SearchBot', allowed: true }]), [])).toEqual([]);
  });
  it('a blocked answer crawler is a step; Googlebot or Bingbot blocked is important', () => {
    const [t] = deriveSiteTasks(access([{ bot: 'PerplexityBot', allowed: false }]), []);
    expect(t).toMatchObject({ key: 'ai_crawlers', state: 'todo', severity: 'info' });
    expect(t.values[1]).toEqual({ label: 'Rule that blocks PerplexityBot', value: 'Disallow: /' });
    expect(deriveSiteTasks(access([{ bot: 'Googlebot', allowed: false }]), [])[0].severity).toBe('warning');
  });
  it('key pages blocked while / is allowed: the paths are what the check reads', () => {
    const inputs = access([{ bot: 'Bingbot', allowed: true, blockedPaths: ['/pricing'] }]);
    expect(siteTaskPayload(inputs, [], 'ai_crawlers')?.payload).toEqual({ bots: [{ bot: 'Bingbot', owner: 'Bingbot', rule: '', paths: ['/pricing'] }] });
  });
  it('fixed by the next weekly run: the stored step shows done with what was fixed', () => {
    const stored = row({ key: 'ai_crawlers', kind: 'ai_crawlers', payload: { bots: [{ bot: 'PerplexityBot', owner: 'Perplexity', rule: 'Disallow: /', paths: ['/'] }] } });
    const [t] = deriveSiteTasks(access([{ bot: 'PerplexityBot', allowed: true }], '2026-11-01T19:43:00.000Z'), [stored]);
    expect(t).toMatchObject({ state: 'done', lastCheck: { by: 'weekly' } });
    expect(t.detail).toContain('PerplexityBot');
  });
  it('an all-clear reading older than the step says nothing about it', () => {
    const stored = row({ key: 'ai_crawlers', kind: 'ai_crawlers', createdAt: '2026-10-30T00:00:00.000Z', payload: { bots: [{ bot: 'PerplexityBot', owner: 'Perplexity', rule: 'Disallow: /', paths: ['/'] }] } });
    const [t] = deriveSiteTasks(access([{ bot: 'PerplexityBot', allowed: true }]), [stored]);
    expect(t).toMatchObject({ state: 'todo', lastCheck: null });
  });
});

describe('Redirects of broken pages other sites link to', () => {
  const reclaim = (items: { brokenUrl: string; links: number }[], receivedAt = '2026-10-20T00:00:00.000Z'): SiteTaskInputs => ({
    ...base,
    reclaim: { receivedAt, items: items.map((i) => ({ redirectTo: 'https://novaand-demo.com/services', domains: ['a.com'], ...i })) },
  });
  it('one step per broken page, most links first, at most five, one key per address', () => {
    const items = [1, 9, 3, 7, 5, 2].map((n) => ({ brokenUrl: `https://novaand-demo.com/old-${n}`, links: n }));
    items.push({ brokenUrl: 'https://www.novaand-demo.com/old-9/', links: 8 });
    const tasks = deriveSiteTasks(reclaim(items), []);
    expect(tasks.map((t) => t.key)).toEqual(['old-9', 'old-7', 'old-5', 'old-3', 'old-2'].map((p) => `redirect:novaand-demo.com/${p}`));
    expect(tasks[0]).toMatchObject({ title: 'Redirect /old-9', guide: 'redirect-broken-page', lastCheck: { by: 'monthly' } });
  });
  it('keys ignore www, case, the query and a trailing slash', () => {
    expect(redirectTaskKey('https://WWW.Novaand-Demo.com/Old/?a=1#x')).toBe('redirect:novaand-demo.com/Old');
    expect(redirectTaskKey('https://novaand-demo.com')).toBe('redirect:novaand-demo.com/');
    expect(redirectTaskKey('https://novaand-demo.com//')).toBe('redirect:novaand-demo.com/');
    const t0 = Date.now();
    redirectTaskKey('https://novaand-demo.com/' + '/'.repeat(100000) + 'x' + '#'.repeat(100000));
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it('a stored step the next report no longer lists is done; one the report predates stays as it was', () => {
    const stored = row({ key: 'redirect:novaand-demo.com/old-1', kind: 'redirect', payload: { brokenUrl: 'https://novaand-demo.com/old-1', redirectTo: 'https://novaand-demo.com/services', links: 4 } });
    expect(deriveSiteTasks(reclaim([], '2026-11-20T00:00:00.000Z'), [stored])[0]).toMatchObject({ state: 'done', lastCheck: { by: 'monthly' } });
    expect(deriveSiteTasks(reclaim([], '2026-10-20T00:00:00.000Z'), [stored])[0]).toMatchObject({ state: 'todo', lastCheck: null });
  });
});

describe('redirects: what a backlink index can and cannot say', () => {
  const stored = row({ key: 'redirect:novaand-demo.com/old-1', kind: 'redirect', payload: { brokenUrl: 'https://novaand-demo.com/old-1', redirectTo: 'https://novaand-demo.com/services', links: 1 } });
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ brokenUrl: `https://novaand-demo.com/old-${i + 1}`, redirectTo: 'https://novaand-demo.com/', links: 100 - i, domains: [] }));
  it('a stored page that fell below the top five is still broken, not done', () => {
    const tasks = deriveSiteTasks({ ...base, reclaim: { receivedAt: '2026-11-20T00:00:00.000Z', items: [...items(7).slice(1), { ...items(1)[0], links: 1 }] } }, [stored]);
    expect(tasks.find((t) => t.key === stored.key)).toMatchObject({ state: 'todo', lastCheck: { by: 'monthly', ok: false } });
    // still at most five new steps beside it
    expect(tasks.filter((t) => t.kind === 'redirect')).toHaveLength(6);
  });
  it('our own check that the redirect works is not overturned by an index that has not caught up', () => {
    const own = { ...stored, lastCheck: { at: '2026-11-15T09:00:00.000Z', ok: true, message: 'redirects', by: 'daily' as const }, doneAt: '2026-11-15T09:00:00.000Z' };
    const report = (at: string): SiteTaskInputs => ({ ...base, reclaim: { receivedAt: at, items: items(1) } });
    expect(deriveSiteTasks(report('2026-11-20T00:00:00.000Z'), [own])[0]).toMatchObject({ state: 'done', reopened: false });
    // an index reading more than a week newer than ours does decide
    expect(deriveSiteTasks(report('2026-11-25T00:00:00.000Z'), [own])[0]).toMatchObject({ state: 'todo', reopened: true });
  });
});

describe('order', () => {
  it('important to-dos first, then to-dos, then done, then skipped', () => {
    const inputs: SiteTaskInputs = {
      ...withKey(true),
      access: { checkedAt: '2026-10-25T00:00:00.000Z', bots: [{ bot: 'Googlebot', owner: 'Google', group: 'answer', allowed: false, rule: 'Disallow: /', blockedPaths: [] }] },
      reclaim: { receivedAt: '2026-10-20T00:00:00.000Z', items: [{ brokenUrl: 'https://novaand-demo.com/a', redirectTo: 'https://novaand-demo.com/', links: 2, domains: [] }, { brokenUrl: 'https://novaand-demo.com/b', redirectTo: 'https://novaand-demo.com/', links: 1, domains: [] }] },
    };
    const tasks = deriveSiteTasks(inputs, [row({ key: 'redirect:novaand-demo.com/b', kind: 'redirect', skippedAt: '2026-10-27T00:00:00.000Z' })]);
    expect(tasks.map((t) => `${t.key}:${t.state}`)).toEqual(['ai_crawlers:todo', 'redirect:novaand-demo.com/a:todo', 'indexnow:done', 'redirect:novaand-demo.com/b:skipped']);
  });
});
