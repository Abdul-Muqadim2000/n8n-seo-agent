import { alertState, type ConsoleAlertRow } from '@seo/shared';
import type { FastifyRequest } from 'fastify';
import type { SiteAccess } from '../auth/access';
import { HttpError, notFound } from '../lib/errors';
import { rows, updateRows } from '../n8n/client';
import { audit } from './audit';

/**
 * "Mark as seen" on one alert (client report 2026-11-17, devaicon.com F5; engine build section 194). The alert stays listed with the open
 * ones (its condition may still be true) and leaves the open count; the engine's daily watch keeps the mark when it sees the condition
 * again and resolves the alert when the condition is gone. Only `ack_by` / `ack_at` are written, on the one row of this website the id names
 * (n8n public API, Data Table seo_console_alerts). Members and above; written to the audit log. A resolved alert needs no mark.
 */
export async function markAlertSeen(a: SiteAccess, req: FastifyRequest, body: unknown, now = new Date()): Promise<{ id: string; ackAt: string; ackBy: string }> {
  const d = a.site.domain;
  const id = String(((body as Record<string, unknown> | null) ?? {}).id ?? '').trim();
  if (!id || id.length > 200) throw new HttpError(400, 'Choose an alert to mark as seen.', 'bad_alert');
  const match = [
    { columnName: 'domain', condition: 'eq' as const, value: d },
    { columnName: 'message_id', condition: 'eq' as const, value: id },
  ];
  let found: ConsoleAlertRow[];
  try {
    found = await rows<ConsoleAlertRow>('consoleAlerts', { filters: match, max: 2, fresh: true });
  } catch {
    throw new HttpError(503, 'We could not reach your alerts just now, so nothing was saved. Try again in a few minutes.', 'engine_unreachable');
  }
  const row = found[0];
  if (!row) throw notFound('That alert is not stored for this website.');
  const state = alertState({ severity: String(row.severity ?? ''), status: String(row.status ?? ''), resolvedAt: String(row.resolved_at ?? ''), ackAt: String(row.ack_at ?? '') });
  if (state === 'resolved') throw new HttpError(409, 'This alert is already resolved, so there is nothing to mark.', 'already_resolved');
  if (state === 'seen') return { id, ackAt: String(row.ack_at ?? ''), ackBy: String(row.ack_by ?? '') };
  const ackAt = now.toISOString();
  // FX-SERVER (review R3 L7): the person's user id, never their e-mail: the engine row then holds no personal data, and a deleted account
  // leaves an id that names nobody (the account deletion does not reach the engine's alert rows)
  const ackBy = String(a.user.id ?? '').slice(0, 200);
  let ok = false;
  try {
    ok = await updateRows('consoleAlerts', match, { ack_by: ackBy, ack_at: ackAt });
  } catch {
    ok = false;
  }
  // an engine table without the columns (before the deploy's column sync) or n8n not answering: nothing was saved, and the person is told
  if (!ok) throw new HttpError(503, 'We could not save it just now, so nothing changed. Try again in a few minutes.', 'engine_not_saved');
  await audit(req, a.org.id, { action: 'alerts.seen', target: { type: 'site', id: a.site.id, label: d }, details: { subject: String(row.subject ?? '').slice(0, 200), severity: String(row.severity ?? '') } });
  return { id, ackAt, ackBy };
}
