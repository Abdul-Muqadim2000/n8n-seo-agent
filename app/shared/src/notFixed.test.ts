import { describe, expect, it } from 'vitest';
import { findingsV1 } from './api-v1';
import { notFixedKeys } from './tables';

// B-5 (F-B, 2026-10-17, re-rating 2026-10-17 exec 767): the engine's diff told the customer "5 fixed" when only its checks had changed. The
// audit row now carries the keys the engine did not count as fixed; the app's lists follow that decision instead of deriving "fixed" alone.
describe('notFixedKeys (B-5)', () => {
  it('reads the engine decision from the audit row', () => {
    const m = notFixedKeys({ not_fixed_json: JSON.stringify([{ key: 'Performance|no compression (gzip/brotli)', why: 'check changed 2026-10-16: a redirect response is no longer read as a page (R63)' }, { key: 'x', why: 'one outside reading' }]) });
    expect(m.size).toBe(2);
    expect(m.get('Performance|no compression (gzip/brotli)')).toMatch(/R63/);
  });
  it('is empty for a row written before the column existed, or a malformed value', () => {
    expect(notFixedKeys({}).size).toBe(0);
    expect(notFixedKeys(null).size).toBe(0);
    expect(notFixedKeys({ not_fixed_json: '{oops' }).size).toBe(0);
    expect(notFixedKeys({ not_fixed_json: '[{"nokey":1}]' }).size).toBe(0);
  });
  it('a previous finding the engine did not count as fixed is "no longer seen" in the read API, never "fixed"', () => {
    const prev = [{ finding_key: 'Performance|no compression (gzip/brotli)', title: 'No compression (gzip/brotli)', category: 'Performance', severity: 'Medium', affected_count: 2 },
      { finding_key: 'On-Page|missing meta description', title: 'Missing meta description', category: 'On-Page', severity: 'Medium', affected_count: 1 }];
    const nf = notFixedKeys({ not_fixed_json: JSON.stringify([{ key: 'Performance|no compression (gzip/brotli)', why: 'check changed' }]) });
    const out = findingsV1([], prev, (f) => nf.has(String(f.finding_key ?? '')));
    expect(out.find((f) => f.title === 'No compression (gzip/brotli)')?.status).toBe('no_longer_seen');
    expect(out.find((f) => f.title === 'Missing meta description')?.status).toBe('fixed');
  });
});
