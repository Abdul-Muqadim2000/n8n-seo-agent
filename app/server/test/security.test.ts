import { describe, expect, it } from 'vitest';
import { urlOnHost } from '@seo/shared';
import { safeNext } from '../src/routes/auth';

describe('safeNext (no open redirects)', () => {
  it('keeps in-app paths', () => {
    expect(safeNext('/o/1/sites/2/overview?x=1')).toBe('/o/1/sites/2/overview?x=1');
    expect(safeNext('/invite/abc')).toBe('/invite/abc');
  });
  it.each(['//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', 'https://evil.com', 'evil.com', '/api/auth/logout', '', null, 42])('refuses %j', (v) => {
    expect(safeNext(v)).toBe('/');
  });
});

describe('urlOnHost (the engine accepts existing pages on the domain itself only)', () => {
  it('accepts the domain with or without www, refuses subdomains and look-alikes', () => {
    expect(urlOnHost('https://www.techand.ai/x', 'techand.ai')).toBe(true);
    expect(urlOnHost('https://techand.ai/', 'techand.ai')).toBe(true);
    expect(urlOnHost('https://blog.techand.ai/x', 'techand.ai')).toBe(false);
    expect(urlOnHost('https://techand.ai.evil.com/', 'techand.ai')).toBe(false);
  });
});
