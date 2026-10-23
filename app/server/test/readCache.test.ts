import { describe, expect, it } from 'vitest';
import { ReadCache } from '../src/n8n/client';

// R-A8 (review 2026-10-23): the n8n read cache evicts what expired and stays under its byte bound (least recently used first).

describe('ReadCache', () => {
  it('an expired entry is gone on read and swept on the next write (it used to stay until read again)', () => {
    let t = 0;
    const c = new ReadCache(60_000, 1000, 500, 500, () => t);
    c.set('a', [1], 100);
    c.set('b', [2], 100);
    t = 61_000;
    c.set('c', [3], 100);
    expect(c.keys()).toEqual(['c']);
    expect(c.stats()).toEqual({ entries: 1, bytes: 100 });
    t = 200_000;
    expect(c.get('c')).toBeUndefined();
    expect(c.stats().bytes).toBe(0);
  });
  it('stays under its byte bound, dropping the least recently used first; a hit counts as a use', () => {
    const c = new ReadCache(60_000, 300, 200, 500, () => 0);
    c.set('a', [], 100);
    c.set('b', [], 100);
    c.set('c', [], 100);
    expect(c.get('a')).toEqual([]);
    c.set('d', [], 100);
    expect(c.keys()).toEqual(['c', 'a', 'd']);
    expect(c.stats().bytes).toBe(300);
  });
  it('a read larger than the per-entry bound is not cached; replacing a key does not double count', () => {
    const c = new ReadCache(60_000, 1000, 200, 500, () => 0);
    c.set('big', [], 201);
    expect(c.get('big')).toBeUndefined();
    c.set('a', [], 150);
    c.set('a', [], 50);
    expect(c.stats()).toEqual({ entries: 1, bytes: 50 });
  });
});
