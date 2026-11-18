import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleAlertRow } from '@seo/shared';

// CR17-D (client report 2026-11-17, devaicon.com F5 / F6): "Mark as seen" on one alert writes only ack_by / ack_at on that website's row
// (n8n public API), and the Alerts page's data never shows the check-in's -1 "not recorded" marker as a count.
// The n8n client and the audit log are mocked: no Data Table and no database is touched.

const rows = vi.fn();
const updateRows = vi.fn();
const siteRows = vi.fn();
const audit = vi.fn();
vi.mock('../src/n8n/client', () => ({ rows: (...a: unknown[]) => rows(...a), updateRows: (...a: unknown[]) => updateRows(...a), siteRows: (...a: unknown[]) => siteRows(...a) }));
vi.mock('../src/services/audit', () => ({ audit: (...a: unknown[]) => audit(...a) }));

const { markAlertSeen } = await import('../src/services/alerts');

const access = { user: { id: 'u1', email: 'owner@example.com' }, org: { id: 'o1' }, role: 'member', site: { id: 's1', domain: 'example-agency.com' } } as never;
const req = { log: { error: () => {} } } as never;
const row = (o: Partial<ConsoleAlertRow>): ConsoleAlertRow =>
  ({ id: 3, createdAt: '', updatedAt: '', site_id: 'site_example-agency-com', domain: 'example-agency.com', kind: 'page_watch', severity: 'high', subject: 'Page gone: example-agency.com/pricing',
    summary: 'x', received_at: '2026-11-10T05:45:00Z', message_id: 'watch:site_example-agency-com:page_gone:abcd1234:2026-11-10', status: 'new', source: 'page_watch', ...o }) as ConsoleAlertRow;

afterEach(() => {
  rows.mockReset();
  updateRows.mockReset();
  audit.mockReset();
});

describe('Mark as seen', () => {
  it('writes only ack_by / ack_at on the one row of this website, and records it in the audit log', async () => {
    rows.mockResolvedValue([row({})]);
    updateRows.mockResolvedValue(true);
    const r = await markAlertSeen(access, req, { id: 'watch:site_example-agency-com:page_gone:abcd1234:2026-11-10' }, new Date('2026-11-17T09:00:00Z'));
    expect(r).toEqual({ id: 'watch:site_example-agency-com:page_gone:abcd1234:2026-11-10', ackAt: '2026-11-17T09:00:00.000Z', ackBy: 'u1' });
    const [table, filters, data] = updateRows.mock.calls[0];
    expect(table).toBe('consoleAlerts');
    expect(filters).toEqual([
      { columnName: 'domain', condition: 'eq', value: 'example-agency.com' },
      { columnName: 'message_id', condition: 'eq', value: 'watch:site_example-agency-com:page_gone:abcd1234:2026-11-10' },
    ]);
    // FX-SERVER (review R3 L7): the user id, never the e-mail (a deleted account leaves no personal data in the engine)
    expect(data).toEqual({ ack_by: 'u1', ack_at: '2026-11-17T09:00:00.000Z' });
    expect(JSON.stringify(updateRows.mock.calls)).not.toContain('@');
    expect(audit.mock.calls[0][2]).toMatchObject({ action: 'alerts.seen' });
  });
  it('an alert of another website (or none) is not found; a resolved one needs no mark; a seen one is not written twice', async () => {
    rows.mockResolvedValue([]);
    await expect(markAlertSeen(access, req, { id: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    rows.mockResolvedValue([row({ status: 'resolved', resolved_at: '2026-11-16T05:45:00Z' })]);
    await expect(markAlertSeen(access, req, { id: 'x' })).rejects.toMatchObject({ statusCode: 409 });
    rows.mockResolvedValue([row({ ack_at: '2026-11-16T08:00:00Z', ack_by: 'a@example.com' })]);
    expect(await markAlertSeen(access, req, { id: 'x' })).toMatchObject({ ackBy: 'a@example.com' });
    expect(updateRows).not.toHaveBeenCalled();
    await expect(markAlertSeen(access, req, {})).rejects.toMatchObject({ statusCode: 400 });
  });
  it('an engine table that cannot take the mark yet says nothing was saved', async () => {
    rows.mockResolvedValue([row({})]);
    updateRows.mockRejectedValue(new Error('n8n rows/update answered 400'));
    await expect(markAlertSeen(access, req, { id: 'x' })).rejects.toMatchObject({ statusCode: 503 });
  });
});
