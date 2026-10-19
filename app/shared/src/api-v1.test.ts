import { describe, expect, it } from 'vitest';
import {
  API_SCOPE_ROLE,
  API_WRITE_SCOPES,
  apiKeyCreateSchema,
  idempotencyKeyOk,
  apiKeyState,
  bearerKey,
  decodeCursor,
  encodeCursor,
  filterFindings,
  findingsV1,
  isApiKeyToken,
  keyDisplayPrefix,
  pageLimit,
  pageOf,
  publishCheckSchema,
  sampleNote,
  triesBearer,
} from './api-v1';

const KEY = 'asc_' + 'A'.repeat(20) + '-_' + 'b'.repeat(21);

describe('B5-11 API keys', () => {
  it('recognises only our key shape', () => {
    expect(KEY.length).toBe(47);
    expect(isApiKeyToken(KEY)).toBe(true);
    expect(isApiKeyToken('asc_short')).toBe(false);
    expect(isApiKeyToken('sk_' + 'a'.repeat(44))).toBe(false);
    expect(isApiKeyToken(KEY + 'x')).toBe(false);
    expect(keyDisplayPrefix(KEY)).toBe('asc_AAAAAAAA');
  });
  it('reads a Bearer header, and says when a request tried one at all', () => {
    expect(bearerKey(`Bearer ${KEY}`)).toBe(KEY);
    expect(bearerKey(`bearer   ${KEY}  `)).toBe(KEY);
    expect(bearerKey('Bearer nope')).toBeNull();
    expect(bearerKey(`Basic ${KEY}`)).toBeNull();
    expect(bearerKey(undefined)).toBeNull();
    expect(triesBearer('Bearer nope')).toBe(true);
    expect(triesBearer(undefined)).toBe(false);
  });
  it('states: revoked beats expired beats active', () => {
    const now = new Date('2026-10-17T00:00:00Z');
    expect(apiKeyState({ revokedAt: null, expiresAt: null }, now)).toBe('active');
    expect(apiKeyState({ revokedAt: null, expiresAt: '2026-10-16T00:00:00Z' }, now)).toBe('expired');
    expect(apiKeyState({ revokedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-16T00:00:00Z' }, now)).toBe('revoked');
  });
  it('creation: a name, known scopes, an offered expiry', () => {
    expect(apiKeyCreateSchema.parse({ name: ' CI ' })).toEqual({ name: 'CI', scopes: ['read', 'publish_check'], expiresInDays: 90 });
    expect(apiKeyCreateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(apiKeyCreateSchema.safeParse({ name: 'x', scopes: ['write'] }).success).toBe(false);
    expect(apiKeyCreateSchema.safeParse({ name: 'x', expiresInDays: 7 }).success).toBe(false);
    expect(apiKeyCreateSchema.parse({ name: 'x', expiresInDays: 0 }).expiresInDays).toBe(0);
  });
  it('G4: the write permissions are chosen explicitly, never by default, and need a role to stay usable', () => {
    expect(apiKeyCreateSchema.parse({ name: 'agent', scopes: ['read', 'run', 'admin'] }).scopes).toEqual(['read', 'run', 'admin']);
    expect(apiKeyCreateSchema.parse({ name: 'x' }).scopes).not.toContain('run');
    expect(API_WRITE_SCOPES).toEqual(['run', 'admin']);
    expect([API_SCOPE_ROLE.read, API_SCOPE_ROLE.run, API_SCOPE_ROLE.admin]).toEqual(['viewer', 'member', 'admin']);
  });
  it('G4: an Idempotency-Key is a short opaque string', () => {
    for (const ok of ['a', 'job-42', '0d133af2-f740-481a-9de0-013991e7dea1', 'ci:release.2026_10']) expect(idempotencyKeyOk(ok)).toBe(true);
    for (const bad of ['', 'has space', 'x'.repeat(201), 'semi;colon', 42, null]) expect(idempotencyKeyOk(bad)).toBe(false);
  });
});

describe('B5-11 pages and cursors', () => {
  it('round-trips both cursor kinds and ignores junk', () => {
    const t = { t: '2026-10-17T10:00:00.123Z', id: '0d133af2-f740-481a-9de0-013991e7dea1' };
    expect(decodeCursor(encodeCursor(t))).toEqual(t);
    expect(decodeCursor(encodeCursor({ o: 50 }))).toEqual({ o: 50 });
    for (const junk of ['', 'junk!!', 'x'.repeat(300), encodeCursor({ o: -1 }), encodeCursor({ t: 'no', id: 'x' } as never), 42]) expect(decodeCursor(junk)).toBeNull();
  });
  it('limits 1-100, default 25', () => {
    expect([pageLimit(undefined), pageLimit('0'), pageLimit('7'), pageLimit(1000), pageLimit('x')]).toEqual([25, 25, 7, 100, 25]);
  });
  it('an offset page says where the next one starts, and null at the end', () => {
    const all = [1, 2, 3, 4, 5];
    const p1 = pageOf(all, null, 2);
    expect(p1.items).toEqual([1, 2]);
    const p3 = pageOf(all, decodeCursor(pageOf(all, decodeCursor(p1.nextCursor), 2).nextCursor), 2);
    expect(p3).toEqual({ items: [5], nextCursor: null });
  });
});

describe('B5-11 findings compared with the previous audit of the same type', () => {
  const row = (key: string, n: number, extra: Record<string, unknown> = {}) => ({ finding_key: key, category: 'On-Page', severity: 'High', title: key, affected_count: n, checked: 25, ...extra });
  const oneReading = (f: { title?: unknown }) => /AI answers/.test(String(f.title));
  it('open / new / fixed / no longer seen, never "fixed" for a one-reading finding', () => {
    const out = findingsV1([row('a', 4), row('new', 1)], [row('a', 6), row('gone', 2), row('named in AI answers', 0)], oneReading);
    const by = Object.fromEntries(out.map((f) => [f.key, f]));
    expect(by.a).toMatchObject({ status: 'open', affected: 4, previousAffected: 6, notCompared: null });
    expect(by.new.status).toBe('new');
    expect(by.gone).toMatchObject({ status: 'fixed', affected: 0, previousAffected: 2 });
    expect(by['named in AI answers'].status).toBe('no_longer_seen');
  });
  it('the first audit has nothing to compare with: everything is open', () => {
    expect(findingsV1([row('a', 1)], null, oneReading).map((f) => f.status)).toEqual(['open']);
  });
  it('R19: a sample that moved more than 20% is not compared', () => {
    expect(sampleNote(14, 25)).toMatch(/sample moved \(14 pages checked now, 25 before\)/);
    expect(sampleNote(24, 25)).toBeNull();
    expect(sampleNote(0, 25)).toBeNull();
    const [f] = findingsV1([row('a', 5, { checked: 14 })], [row('a', 9)], oneReading);
    expect(f.previousAffected).toBeNull();
    expect(f.notCompared).toMatch(/sample moved/);
  });
  it('a field the engine did not store is null, never "" or 0', () => {
    const [f] = findingsV1([{ finding_key: 'k', severity: 'Low', title: 't', affected_count: 2 }], null, oneReading);
    expect(f).toMatchObject({ checked: null, evidence: null, sampleUrls: null, impact: null, impactBasis: null, recheck: null });
    const [g] = findingsV1([row('k', 2, { evidence: ' /a has none ', sample_urls: '["https://x.example/a","javascript:alert(1)"]', recheck_state: 'requested' })], null, oneReading);
    expect(g.evidence).toBe('/a has none');
    expect(g.sampleUrls).toEqual(['https://x.example/a']);
    expect(g.recheck?.state).toBe('requested');
  });
  it('order: the audit\'s impact order where it exists, else severity then pages', () => {
    const imp = findingsV1([row('low', 1, { impact: 2, severity: 'Low' }), row('high', 1, { impact: 9 })], null, oneReading);
    expect(imp.map((f) => f.key)).toEqual(['high', 'low']);
    const sev = findingsV1([row('m', 9, { severity: 'Medium' }), row('h1', 1), row('h2', 3)], null, oneReading);
    expect(sev.map((f) => f.key)).toEqual(['h2', 'h1', 'm']);
  });
  it('filters by severity and status', () => {
    const out = findingsV1([row('a', 1), row('b', 1, { severity: 'Low' })], [row('a', 1)], oneReading);
    expect(filterFindings(out, { severity: 'low', status: 'new' }).map((f) => f.key)).toEqual(['b']);
    expect(filterFindings(out, {}).length).toBe(2);
  });
});

describe('B3-7 publish check request', () => {
  const words = Array.from({ length: 60 }, () => 'word').join(' ');
  it('needs a whole page and its search', () => {
    expect(publishCheckSchema.safeParse({ markdown: 'too short', keyword: 'x' }).success).toBe(false);
    expect(publishCheckSchema.safeParse({ markdown: words }).success).toBe(false);
    expect(publishCheckSchema.safeParse({ markdown: words, keyword: 'erp uae' }).success).toBe(true);
  });
  it('keeps the engine contract\'s limits', () => {
    expect(publishCheckSchema.safeParse({ markdown: words, keyword: 'k', target_words: 100 }).success).toBe(false);
    expect(publishCheckSchema.safeParse({ markdown: words, keyword: 'k', competitors: Array.from({ length: 11 }, () => ({ url: 'https://a.example', content: 'x' })) }).success).toBe(false);
    expect(publishCheckSchema.safeParse({ markdown: words, keyword: 'k', terms: ['a', { term: 'b', min_count: 2 }] }).success).toBe(true);
  });
});
