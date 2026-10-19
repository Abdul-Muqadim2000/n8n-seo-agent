import { afterEach, describe, expect, it, vi } from 'vitest';

// B-A6 seam (2026-10-15). The engine dedupes a repeated POST and answers 202 with the FIRST run's id instead of starting a second
// run and spending again. That creates a seam on this side: two of our run rows would carry one request id, and a callback matches
// the newest of them, so the repeat row would take the result and the original would wait for ever. These tests pin both halves:
// the client must carry the engine's `duplicate` flag through, and the rule must only resolve to an existing run when the engine
// really said so. Neither agent owned this seam; it was found by reading the two changes against each other.

const OK202 = (body: Record<string, unknown>) => ({ status: 202, json: async () => ({ status: 'accepted', ...body }) }) as unknown as Response;

async function loadClient() {
  vi.resetModules();
  vi.doMock('../src/config.js', () => ({ config: { n8n: { webhookKey: 'k', baseUrl: 'http://engine', runPath: '/run' } } }));
  return await import('../src/n8n/client.js');
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('the engine\'s repeat flag reaches the app', () => {
  it('carries duplicate and first_seen_at from a 202', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => OK202({ request_id: '511', duplicate: true, first_seen_at: '2026-10-15T10:00:00Z', estimated_minutes: 4 })));
    const { startRun } = await loadClient();
    const res = await startRun({}, 'org');
    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(true);
    expect(res.requestId).toBe('511');          // the FIRST run's id, not a new one
    expect(res.firstSeenAt).toBe('2026-10-15T10:00:00Z');
  });

  it('a normal start is not a duplicate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => OK202({ request_id: '512', duplicate: false, estimated_minutes: 4 })));
    const { startRun } = await loadClient();
    expect((await startRun({}, 'org')).duplicate).toBe(false);
  });

  it('an engine that does not send the field is never treated as a duplicate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => OK202({ request_id: '513', estimated_minutes: 4 })));
    const { startRun } = await loadClient();
    expect((await startRun({}, 'org')).duplicate).toBe(false);
  });
});

describe('when a start resolves to a run already going', () => {
  // the `afterEach` above resets the module registry, so this one re-transpiles the whole runs service from cold: under load that
  // import alone has taken over 5 seconds and failed the run (seen twice on 2026-10-15). The assertions are instant; only the import is slow.
  it('only when the engine said duplicate AND named the run', { timeout: 30_000 }, async () => {
    const { repeatResolvesToOriginal } = await import('../src/services/runs.js');
    expect(repeatResolvesToOriginal({ duplicate: true, requestId: '511' })).toBe(true);
    expect(repeatResolvesToOriginal({ duplicate: false, requestId: '511' })).toBe(false);
    expect(repeatResolvesToOriginal({ requestId: '511' })).toBe(false);          // older engine: it really started
    expect(repeatResolvesToOriginal({ duplicate: true, requestId: null })).toBe(false);
    expect(repeatResolvesToOriginal({ duplicate: true, requestId: '' })).toBe(false);
  });
});
