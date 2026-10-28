import { describe, expect, it } from 'vitest';
import { autopilotRuns } from './autopilot';
import { ga4ConnectionState, gscConnectionState } from './gsc-connection';

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

// 2026-10-28 (devaicon.com on production): the GA4 property was chosen on Verification & Google (panel: Connected), never reached the
// engine, and every weekly report said "GA4 off", so Recommendations, the Pipeline and the Search page said "not connected".
describe('ga4ConnectionState', () => {
  const g4 = (ga4PropertyId: string | null, lastRunAt: string | null = null) => ({ ga4PropertyId, lastRunAt });
  const check = (at: string, connected: boolean) => ({ at, connected, propertyId: connected ? '560460806' : null });
  it('a report that said GA4 off, then the property was chosen and confirmed: connected, figures with the next report', () => {
    const s = ga4ConnectionState({ report: { receivedAt: '2026-10-25T19:59:03Z', connected: false, propertyId: null }, tracking: { ...g4(null), ga4LiveCheck: check('2026-10-26T15:29:43Z', true) } });
    expect(s).toEqual({ connected: true, propertyId: '560460806', source: 'live_check', awaitingReport: true });
  });
  it('a newer report that read GA4 wins, with nothing awaited', () => {
    const s = ga4ConnectionState({ report: { receivedAt: '2026-10-30T02:00:00Z', connected: true, propertyId: '560460806' }, tracking: { ...g4('560460806'), ga4LiveCheck: check('2026-10-26T15:29:43Z', true) } });
    expect(s).toEqual({ connected: true, propertyId: '560460806', source: 'report', awaitingReport: false });
  });
  it('access removed after the last report: the newer check says not connected', () => {
    expect(ga4ConnectionState({ report: { receivedAt: '2026-10-20T00:00:00Z', connected: true, propertyId: '1' }, tracking: { ...g4('1'), ga4LiveCheck: check('2026-10-22T00:00:00Z', false) } }).connected).toBe(false);
  });
  it('a newer report that could not read GA4 beats an older confirmation', () => {
    expect(ga4ConnectionState({ report: { receivedAt: '2026-11-06T00:00:00Z', connected: false, propertyId: null }, tracking: { ...g4('1'), ga4LiveCheck: check('2026-10-26T00:00:00Z', true) } }).connected).toBe(false);
  });
  it('a report that tried the very property and failed with a real error is not overruled by opening the panel again', () => {
    const report = { receivedAt: '2026-10-30T02:00:00Z', connected: false, propertyId: null, error: 'PERMISSION_DENIED: Google Analytics Data API has not been used' };
    expect(ga4ConnectionState({ report, tracking: { ...g4('560460806'), ga4LiveCheck: check('2026-10-31T09:00:00Z', true) } }).connected).toBe(false);
    // a different property chosen since: the new choice counts
    expect(ga4ConnectionState({ report, tracking: { ...g4('111'), ga4LiveCheck: check('2026-10-31T09:00:00Z', true) } }).connected).toBe(true);
    // "no property" is not a failure of the property: the check counts (devaicon.com)
    expect(ga4ConnectionState({ report: { ...report, error: 'no property id given or detected' }, tracking: { ...g4('560460806'), ga4LiveCheck: check('2026-10-31T09:00:00Z', true) } }).connected).toBe(true);
  });
  it('without a check it behaves as before: the report, else the engine row', () => {
    expect(ga4ConnectionState({ report: { receivedAt: '2026-10-22T06:00:00Z', connected: false, propertyId: null }, tracking: g4('1') }).connected).toBe(false);
    expect(ga4ConnectionState({ report: null, tracking: g4('1') }).connected).toBe(true);
    expect(ga4ConnectionState({}).source).toBe('none');
  });
});

describe('autopilotRuns (what the weekly cycle runs on its own)', () => {
  const on = { verified: true, trackingStatus: 'active' };
  it('a verified website with tracking on runs the audit, the AI check and the backlink check (missing settings = on)', () => {
    expect(autopilotRuns(on, null)).toEqual({ audit: true, aiVisibility: true, backlinks: true });
  });
  it('a monitor switched off is not run', () => {
    expect(autopilotRuns(on, { auditMonthly: false, aiVisibility: true, backlinks: false })).toEqual({ audit: false, aiVisibility: true, backlinks: false });
  });
  it('paused (by a person or the credit guard), not started or not verified: nothing runs on its own', () => {
    for (const site of [{ verified: true, trackingStatus: 'paused' }, { verified: true, trackingStatus: 'not_started' }, { verified: false, trackingStatus: 'active' }])
      expect(autopilotRuns(site, null)).toEqual({ audit: false, aiVisibility: false, backlinks: false });
  });
});
