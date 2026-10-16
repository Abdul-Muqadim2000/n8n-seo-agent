import { describe, expect, it } from 'vitest';
import { verifyMeta } from '../src/services/verify';

type Fetcher = NonNullable<Parameters<typeof verifyMeta>[2]>;
const page = (finalUrl: string, text: string): Fetcher => async () => ({ status: 200, text, finalUrl });
const TAG = (code: string) => `<html><head><meta name="seo-agent-verification" content="${code}"></head></html>`;

// R108: the message says which case happened, and "publish it" only when the page was read
describe('meta-tag ownership check messages (R108)', () => {
  it('a host that does not resolve says it could not open the site, not "publish it"', async () => {
    const fetcher: Fetcher = async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND 10.1.2.3'), { code: 'ENOTFOUND' });
    };
    const r = await verifyMeta('shop.example.com', 'tok', fetcher);
    expect(r.verified).toBe(false);
    expect(r.message).toMatch(/could not open https:\/\/shop\.example\.com\//);
    expect(r.message).toContain('ENOTFOUND');
    expect(r.message).not.toMatch(/Publish it/i);
    expect(r.message).not.toContain('10.1.2.3');
  });
  it('a page that cannot be fetched (null: non-public or too many redirects) says it could not open it', async () => {
    const r = await verifyMeta('shop.example.com', 'tok', async () => null);
    expect(r.message).toMatch(/could not open/);
    expect(r.message).not.toMatch(/Publish it/i);
  });
  it('an off-host redirect names the redirect target', async () => {
    const r = await verifyMeta('shop.example.com', 'tok', page('https://other-site.org/home', TAG('tok')));
    expect(r.verified).toBe(false);
    expect(r.message).toContain('redirects to other-site.org');
    expect(r.message).not.toMatch(/was not found/i);
  });
  it('a readable homepage without the tag says the tag is missing and to publish it', async () => {
    const r = await verifyMeta('shop.example.com', 'tok', page('https://shop.example.com/', '<html><head></head></html>'));
    expect(r.message).toMatch(/has no seo-agent-verification meta tag/);
    expect(r.message).toMatch(/Publish it/);
  });
  it('a tag with a different code and a matching tag keep their messages', async () => {
    expect((await verifyMeta('shop.example.com', 'tok', page('https://shop.example.com/', TAG('other')))).message).toMatch(/different code/);
    expect((await verifyMeta('shop.example.com', 'tok', page('https://shop.example.com/', TAG('tok')))).verified).toBe(true);
  });
});
