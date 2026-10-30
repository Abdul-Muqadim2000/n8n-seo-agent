import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

// Index coverage (2026-10-29): the safe fetcher gained an OPT-IN header return (the indexing step reads X-Robots-Tag). Every existing
// caller gets exactly what it always got: no `headers` key, no `firstStatus`, the same status, text and final address. Node's https is
// replaced by a fake server so nothing leaves the machine.

const answers = vi.hoisted(() => new Map<string, { status: number; headers: Record<string, string>; body?: string }>());
vi.mock('node:https', () => ({
  request: (url: string, _opts: unknown, cb: (res: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
    req.destroy = () => undefined;
    req.end = () => {
      const a = answers.get(url) ?? { status: 404, headers: {}, body: 'not found' };
      const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string>; resume: () => void; destroy: () => void };
      res.statusCode = a.status;
      res.headers = a.headers;
      res.resume = () => undefined;
      res.destroy = () => undefined;
      cb(res);
      if (a.status < 300 || a.status >= 400) {
        if (a.body) res.emit('data', Buffer.from(a.body));
        res.emit('end');
      }
    };
    return req;
  },
}));

const verify = await import('../src/services/verify');
const { fetchPublicOnce, fetchPublicText } = verify;

describe('getOnce: headers only when asked', () => {
  answers.set('https://novaand-demo.com/a', { status: 200, headers: { 'x-robots-tag': 'noindex', 'content-type': 'text/html' }, body: '<p>hi</p>' });
  answers.set('https://novaand-demo.com/old', { status: 301, headers: { location: '/a' } });

  it('an existing caller gets the same three fields, no headers key', async () => {
    const r = await fetchPublicText('https://novaand-demo.com/a', 1000);
    expect(r).toEqual({ status: 200, text: '<p>hi</p>', finalUrl: 'https://novaand-demo.com/a' });
    expect('headers' in (r ?? {})).toBe(false);
    const once = await fetchPublicOnce('https://novaand-demo.com/old');
    expect(once).toEqual({ status: 301, location: 'https://novaand-demo.com/a', text: '' });
    const text = await fetchPublicText('https://novaand-demo.com/old', 1000);
    expect(text).toEqual({ status: 200, text: '<p>hi</p>', finalUrl: 'https://novaand-demo.com/a' });
  });

  it('with the option: the response headers, and the first hop status of a redirect chain', async () => {
    const r = await fetchPublicText('https://novaand-demo.com/a', 1000, 4, { headers: true });
    expect(r?.headers?.['x-robots-tag']).toBe('noindex');
    expect(r?.truncated).toBe(false);
    const text = await fetchPublicText('https://novaand-demo.com/old', 1000, 4, { headers: true });
    expect(text).toMatchObject({ status: 200, finalUrl: 'https://novaand-demo.com/a', firstStatus: 301 });
    expect(text?.headers?.['x-robots-tag']).toBe('noindex');
    const direct = await fetchPublicText('https://novaand-demo.com/a', 1000, 4, { headers: true });
    expect(direct?.firstStatus).toBe(0);
  });

  it('A22: the unguarded single GET is not exported (every caller goes through the host guard)', () => {
    expect('getOnce' in verify).toBe(false);
  });

  it('with the option: a body cut at the size cap says so (a half-read sitemap is not a complete list)', async () => {
    answers.set('https://novaand-demo.com/big.xml', { status: 200, headers: { 'content-type': 'application/xml' }, body: '<urlset>' + 'x'.repeat(5000) });
    const r = await fetchPublicText('https://novaand-demo.com/big.xml', 1000, 4, { headers: true });
    expect(r?.truncated).toBe(true);
  });

  it('the host guard still refuses before any request', async () => {
    expect(await fetchPublicText('https://user:x@novaand-demo.com/a', 1000, 4, { headers: true })).toBeNull();
    expect(await fetchPublicText('https://10.0.0.5/a', 1000)).toBeNull();
  });
});
