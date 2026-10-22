import { describe, expect, it } from 'vitest';
import { gscConnectionState } from './gsc-connection';

// 2026-10-22 (techand.ai on production): the panel on Verification & Google said Connected while Overview, Recommendations and the
// Pipeline said "Connect Google Search Console", because they read only the weekly report (or the engine row before any report).
const engine = (gscProperty: string | null, lastRunAt: string | null = null) => ({ gscProperty, lastRunAt });
const live = (at: string, connected: boolean) => ({ at, connected, property: connected ? 'sc-domain:techand.ai' : null });

describe('gscConnectionState', () => {
  it('no report yet, engine row empty, the live check found access: connected, figures with the next report', () => {
    const s = gscConnectionState({ report: null, tracking: { ...engine(null), gscLiveCheck: live('2026-10-22T17:00:00Z', true) } });
    expect(s).toEqual({ connected: true, property: 'sc-domain:techand.ai', source: 'live_check', awaitingReport: true });
  });

  it('a report that said "no access", then the service account was added and the panel checked: connected', () => {
    const s = gscConnectionState({ report: { receivedAt: '2026-10-22T16:50:00Z', connected: false, property: null }, tracking: { ...engine(null), gscLiveCheck: live('2026-10-22T17:00:00Z', true) } });
    expect(s.connected).toBe(true);
    expect(s.awaitingReport).toBe(true);
  });

  it('a newer report that read Search Console wins over an older "no access" live check', () => {
    const s = gscConnectionState({ report: { receivedAt: '2026-10-23T06:00:00Z', connected: true, property: 'sc-domain:techand.ai' }, tracking: { ...engine('sc-domain:techand.ai'), gscLiveCheck: live('2026-10-22T17:00:00Z', false) } });
    expect(s).toEqual({ connected: true, property: 'sc-domain:techand.ai', source: 'report', awaitingReport: false });
  });

  it('access removed after the last report: the newer live check says not connected', () => {
    const s = gscConnectionState({ report: { receivedAt: '2026-10-20T06:00:00Z', connected: true, property: 'sc-domain:techand.ai' }, tracking: { ...engine('sc-domain:techand.ai'), gscLiveCheck: live('2026-10-22T17:00:00Z', false) } });
    expect(s.connected).toBe(false);
  });

  it('connected in a report and still connected in the panel: nothing is awaited', () => {
    const s = gscConnectionState({ report: { receivedAt: '2026-10-20T06:00:00Z', connected: true, property: 'sc-domain:techand.ai' }, tracking: { ...engine('sc-domain:techand.ai'), gscLiveCheck: live('2026-10-22T17:00:00Z', true) } });
    expect(s).toMatchObject({ connected: true, awaitingReport: false });
  });

  it('without a live check it behaves as before: the report, else the engine row', () => {
    expect(gscConnectionState({ report: { receivedAt: '2026-10-22T06:00:00Z', connected: false, property: null }, tracking: engine('sc-domain:x.com') }).connected).toBe(false);
    expect(gscConnectionState({ report: null, tracking: engine('sc-domain:x.com') }).connected).toBe(true);
    expect(gscConnectionState({ report: null, tracking: engine(null) }).connected).toBe(false);
    expect(gscConnectionState({}).source).toBe('none');
  });

  it('a stored engine property with no run time does not outrank a "no access" live check', () => {
    expect(gscConnectionState({ report: null, tracking: { ...engine('sc-domain:x.com'), gscLiveCheck: live('2026-10-22T17:00:00Z', false) } }).connected).toBe(false);
  });
});
