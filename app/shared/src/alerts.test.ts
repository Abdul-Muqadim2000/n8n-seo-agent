import { describe, expect, it } from 'vitest';
import { alertCounts, alertSourceLabel, alertState, alertView, checkinDelta, checkinNotIndexed, isOpenAlert, openAlertCount } from './alerts';

// Client report 2026-11-17 (devaicon.com F5 / F6): eight High Page Watch alerts stayed "open" for weeks (nothing resolved them), and the
// November check-in's -1 marker (no Pages export) was shown as "-1 pages not indexed, 42 fewer than October".

const a = (o: Partial<{ severity: string; status: string; resolvedAt: string; ackAt: string }>) => ({ severity: 'high', status: 'new', resolvedAt: '', ackAt: '', ...o });

describe('alert state', () => {
  it('resolved by status or by resolved_at, seen by ack_at, open otherwise', () => {
    expect(alertState(a({}))).toBe('open');
    expect(alertState(a({ status: 'resolved' }))).toBe('resolved');
    expect(alertState(a({ resolvedAt: '2026-11-17T05:45:00Z' }))).toBe('resolved');
    expect(alertState(a({ ackAt: '2026-11-17T09:00:00Z' }))).toBe('seen');
    expect(alertState(a({ ackAt: '2026-11-17T09:00:00Z', status: 'resolved' }))).toBe('resolved');
  });
  it('the open count leaves out seen, resolved and Info notices; urgent = critical or high', () => {
    const list = [a({ severity: 'critical' }), a({ severity: 'high', ackAt: 'x' }), a({ severity: 'medium' }), a({ severity: 'info' }), a({ status: 'resolved' }), a({ severity: 'high' })];
    expect(alertCounts(list)).toEqual({ open: 3, urgent: 2, seen: 1, resolved: 1, total: 6 });
    expect(openAlertCount(list)).toBe(3);
    expect(isOpenAlert(a({ severity: 'info' }))).toBe(false);
  });
  it('the devaicon case: 8 High page-watch rows resolved by the watch leave 0 open', () => {
    const rows = Array.from({ length: 8 }, () => a({ severity: 'high', status: 'resolved', resolvedAt: '2026-11-18T05:45:00Z' }));
    expect(openAlertCount([...rows, a({ severity: 'medium' })])).toBe(1);
  });
  it('a seen alert stays in the Open list (its condition is still true), a resolved one moves to Resolved', () => {
    expect(alertView(a({ ackAt: 'x' }))).toBe('open');
    expect(alertView(a({ status: 'resolved' }))).toBe('resolved');
  });
  it('sources in plain words, never the raw code', () => {
    expect(alertSourceLabel('page_watch')).toBe('from the daily page watch');
    expect(alertSourceLabel('imap')).toBe('from a Search Console e-mail');
    expect(alertSourceLabel('something_internal')).toBe('');
  });
});

describe('check-in numbers', () => {
  it('-1 (no Pages export uploaded) and negatives are not recorded, never a count', () => {
    expect(checkinNotIndexed(-1)).toBeNull();
    expect(checkinNotIndexed('')).toBeNull();
    expect(checkinNotIndexed(null)).toBeNull();
    expect(checkinNotIndexed(41)).toBe(41);
    expect(checkinNotIndexed(0)).toBe(0);
  });
  it('a change exists only between two recorded numbers (no fake "-42 vs October")', () => {
    expect(checkinDelta(checkinNotIndexed(-1), 41)).toBeNull();
    expect(checkinDelta(30, 41)).toBe(-11);
    expect(checkinDelta(30, null)).toBeNull();
  });
});
