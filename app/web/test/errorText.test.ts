import { describe, expect, it } from 'vitest';
import { errorText } from '../src/lib/api';

// 2026-10-18: Vercel's platform error answer {"error":{"code","message"}} was shown as "[object Object]" on the SSO sign-in page
describe('errorText', () => {
  it('keeps our own text errors', () => expect(errorText('Wrong password.', 401)).toBe('Wrong password.'));
  it('reads the message of an error object (Vercel platform errors) instead of printing the object', () => {
    const t = errorText({ code: '500', message: 'A server error has occurred' }, 500);
    expect(t).not.toContain('[object');
    expect(t).toContain('A server error has occurred');
  });
  it('never prints an object, whatever the shape', () => {
    for (const v of [{}, { code: 'x' }, [], null, undefined, 42, '']) expect(errorText(v, 502), String(v)).not.toContain('[object');
    expect(errorText({}, 400)).toBe('Request failed (400)');
  });
});
