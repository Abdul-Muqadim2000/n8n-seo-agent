import { describe, expect, it, vi } from 'vitest';

// Client report 2026-11-11 (devaicon.com, N45): the client added the site to their own Bing account; the engine's key reads another
// account, whose GetUserSites listed techand.ai alone (execution 10597). "Check Bing now" asks Bing the same question at once.
vi.hoisted(() => {
  process.env.LOG_LEVEL = 'silent';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});

import { checkBingAccess } from '../src/services/bingCheck';

const answer = (d: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } }));

describe('checkBingAccess', () => {
  it('says the site is not in the account the key reads (the devaicon.com case)', async () => {
    const f = answer({ d: [{ Url: 'https://techand.ai/', IsVerified: true }] });
    const out = await checkBingAccess('devaicon.com', { fetch: f, key: 'k-test', shareWith: 'reader@example.com', now: new Date('2026-11-11T10:00:00Z') });
    expect(out).toMatchObject({ configured: true, inAccount: false, verified: false, shareWith: 'reader@example.com', checkedAt: '2026-11-11T10:00:00.000Z' });
    expect(String((f.mock.calls[0] as unknown[])[0])).toMatch(/GetUserSites\?apikey=k-test$/);
  });
  it('matches the site with or without www and a trailing slash, and reads its verification', async () => {
    expect(await checkBingAccess('devaicon.com', { fetch: answer({ d: [{ Url: 'https://www.devaicon.com/', IsVerified: true }] }), key: 'k' })).toMatchObject({ inAccount: true, verified: true });
    expect(await checkBingAccess('www.devaicon.com', { fetch: answer({ d: [{ Url: 'http://devaicon.com', IsVerified: false }] }), key: 'k' })).toMatchObject({ inAccount: true, verified: false });
    expect(await checkBingAccess('devaicon.com', { fetch: answer({ d: [{ Url: 'https://devaicon.com.evil.example/' }] }), key: 'k' })).toMatchObject({ inAccount: false });
  });
  it('without a key it says Bing is not set up and calls nobody', async () => {
    const f = answer({ d: [] });
    expect(await checkBingAccess('devaicon.com', { fetch: f, key: '' })).toMatchObject({ configured: false, inAccount: false });
    expect(f).not.toHaveBeenCalled();
  });
  it('a Bing error or an unreadable answer is a retry message that never carries the key', async () => {
    await expect(checkBingAccess('devaicon.com', { fetch: answer({ Message: 'bad key' }, 401), key: 'secret-key' })).rejects.toThrow(/Bing answered 401/);
    await expect(checkBingAccess('devaicon.com', { fetch: vi.fn(async () => new Response('<html>', { status: 200 })), key: 'secret-key' })).rejects.toThrow(/could not read/);
    const err = await checkBingAccess('devaicon.com', { fetch: vi.fn(async () => { throw new Error('connect ECONNREFUSED https://ssl.bing.com/...?apikey=secret-key'); }), key: 'secret-key' }).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toMatch(/secret-key/);
  });
});
