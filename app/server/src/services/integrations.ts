import { and, desc, eq } from 'drizzle-orm';
import type { ExportRunView, IntegrationKind, IntegrationsOverview, IntegrationView, IssueLinkView, IssueState, TrackerKind } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { ExportRunRow, IntegrationRow, IssueLinkRow, OrgRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { secretsReady } from '../lib/secretBox';
import { listEndpoints, listWebhookDeliveries } from './webhooks';

/**
 * G4 (2026-10-17): the `integrations` rows (issue trackers and export destinations) as the app shows them, and the one answer of
 * Company settings → Integrations. A view never carries a secret: `secretHint` ("token …a1b2") is all that leaves the server.
 */

export const toIntegrationView = (r: IntegrationRow): IntegrationView => ({
  id: r.id,
  kind: r.kind as IntegrationKind,
  name: r.name,
  config: r.config,
  secretHint: r.secretHint,
  status: r.status as IntegrationView['status'],
  lastError: r.lastError,
  lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
  lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
  nextRunAt: r.nextRunAt ? r.nextRunAt.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
});

export const toIssueView = (r: IssueLinkRow): IssueLinkView => ({
  id: r.id,
  websiteId: r.siteId,
  kind: r.kind as TrackerKind,
  sourceKey: r.sourceKey,
  sourceTitle: r.sourceTitle,
  remoteKey: r.remoteKey,
  remoteUrl: r.remoteUrl,
  remoteStatus: r.remoteStatus,
  remoteState: r.remoteState as IssueState,
  status: r.status as IssueLinkView['status'],
  createdAt: r.createdAt.toISOString(),
  syncedAt: r.syncedAt ? r.syncedAt.toISOString() : null,
});

export const toExportRunView = (r: ExportRunRow): ExportRunView => ({
  id: r.id,
  integrationId: r.integrationId,
  trigger: r.trigger as ExportRunView['trigger'],
  status: r.status as ExportRunView['status'],
  tables: (r.tables ?? []) as ExportRunView['tables'],
  startedAt: r.startedAt.toISOString(),
  finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  error: r.error,
});

export async function listIntegrations(orgId: string): Promise<IntegrationRow[]> {
  return db.select().from(schema.integrations).where(eq(schema.integrations.orgId, orgId)).orderBy(desc(schema.integrations.createdAt)).limit(20);
}

/** One integration of THIS company (another company's id is simply not found). */
export async function integrationOf(orgId: string, id: unknown): Promise<IntegrationRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Integration not found');
  const row = await db.query.integrations.findFirst({ where: and(eq(schema.integrations.orgId, orgId), eq(schema.integrations.id, id)) });
  if (!row) throw notFound('Integration not found');
  return row;
}

export async function deleteIntegration(orgId: string, id: unknown): Promise<{ deleted: true }> {
  const row = await integrationOf(orgId, id);
  await db.delete(schema.integrations).where(eq(schema.integrations.id, row.id));
  return { deleted: true };
}

export const requireSecrets = () => {
  if (!secretsReady())
    throw new HttpError(400, 'This server cannot store connection secrets yet (MAILBOX_KEY is not set). Ask the platform administrator to set it.', 'secrets_unavailable');
};

export async function integrationsOverview(org: OrgRow): Promise<IntegrationsOverview> {
  const [endpoints, deliveries, rows, runs, issues] = await Promise.all([
    listEndpoints(org.id),
    listWebhookDeliveries(org.id, 50),
    listIntegrations(org.id),
    db.select().from(schema.exportRuns).where(eq(schema.exportRuns.orgId, org.id)).orderBy(desc(schema.exportRuns.startedAt)).limit(20),
    db.select().from(schema.issueLinks).where(eq(schema.issueLinks.orgId, org.id)).orderBy(desc(schema.issueLinks.createdAt)).limit(50),
  ]);
  return {
    secretsReady: secretsReady(),
    appUrl: config.appUrl,
    endpoints,
    deliveries,
    integrations: rows.map(toIntegrationView),
    exportRuns: runs.map(toExportRunView),
    issues: issues.map(toIssueView),
  };
}
