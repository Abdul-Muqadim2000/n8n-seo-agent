import { and, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  actionsIn,
  auditCategoryOf,
  auditLabel,
  policyOf,
  safeAuditDetails,
  type AuditAction,
  type AuditActorType,
  type AuditEventView,
  type AuditQuery,
} from '@seo/shared';
import { db, schema } from '../db';
import type { AuditEventRow, UserRow } from '../db/schema';

/**
 * G1: the one way into the customer-visible audit log (app/docs/IDENTITY.md §6). Routes call `audit()` (one company) or
 * `auditUser()` (every company the person belongs to — sign-ins, two-step changes, passwords). Details pass through
 * `safeAuditDetails`, which drops anything that looks like a secret whatever the caller hands in.
 */

export interface AuditActor {
  type: AuditActorType;
  userId?: string | null;
  label: string;
}

export interface AuditEntry {
  action: AuditAction;
  outcome?: 'success' | 'failure';
  target?: { type: string; id?: string | null; label?: string | null };
  details?: Record<string, unknown>;
  /** default: the signed-in person of the request (or "system") */
  actor?: AuditActor;
}

const actorOf = (req: FastifyRequest | null, user?: UserRow | null): AuditActor => {
  const u = user ?? req?.user ?? null;
  return u ? { type: 'user', userId: u.id, label: u.email } : { type: 'system', label: 'system' };
};

function row(req: FastifyRequest | null, orgId: string, e: AuditEntry, actor: AuditActor) {
  return {
    orgId,
    action: e.action,
    outcome: e.outcome ?? 'success',
    actorType: actor.type,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label.slice(0, 200),
    targetType: e.target?.type ?? null,
    targetId: e.target?.id ?? null,
    targetLabel: e.target?.label?.slice(0, 200) ?? null,
    ip: req?.ip ?? null,
    userAgent: req ? String(req.headers['user-agent'] ?? '').slice(0, 300) || null : null,
    details: safeAuditDetails(e.details ?? {}),
  };
}

/** writes one event; a failed write is logged and never undoes or fails the action it records */
export async function audit(req: FastifyRequest | null, orgId: string, e: AuditEntry): Promise<void> {
  try {
    await db.insert(schema.auditEvents).values(row(req, orgId, e, e.actor ?? actorOf(req)));
  } catch (err) {
    req?.log.error({ err: String(err), action: e.action }, 'audit event could not be written');
  }
}

/** the same event in every company the person belongs to (their own sign-in, two-step or password events) */
export async function auditUser(req: FastifyRequest | null, user: UserRow, e: AuditEntry): Promise<void> {
  try {
    const orgs = await db.select({ orgId: schema.memberships.orgId }).from(schema.memberships).where(eq(schema.memberships.userId, user.id));
    if (!orgs.length) return;
    const actor = e.actor ?? actorOf(req, user);
    await db.insert(schema.auditEvents).values(orgs.map((o) => row(req, o.orgId, e, actor)));
  } catch (err) {
    req?.log.error({ err: String(err), action: e.action }, 'audit event could not be written');
  }
}

export const toAuditView = (r: AuditEventRow): AuditEventView => ({
  id: String(r.id),
  at: r.at.toISOString(),
  action: r.action,
  label: auditLabel(r.action),
  category: auditCategoryOf(r.action),
  outcome: r.outcome === 'failure' ? 'failure' : 'success',
  actorType: r.actorType as AuditActorType,
  actorId: r.actorUserId,
  actorLabel: r.actorLabel,
  targetType: r.targetType,
  targetId: r.targetId,
  targetLabel: r.targetLabel,
  ip: r.ip,
  userAgent: r.userAgent,
  details: r.details ?? {},
});

function filters(orgId: string, q: Omit<AuditQuery, 'limit'>): SQL {
  const c: SQL[] = [eq(schema.auditEvents.orgId, orgId)];
  if (q.category) c.push(inArray(schema.auditEvents.action, actionsIn(q.category)));
  if (q.action) c.push(eq(schema.auditEvents.action, q.action));
  if (q.actor) c.push(eq(schema.auditEvents.actorUserId, q.actor));
  if (q.outcome) c.push(eq(schema.auditEvents.outcome, q.outcome));
  if (q.from) c.push(gte(schema.auditEvents.at, new Date(`${q.from}T00:00:00Z`)));
  if (q.to) c.push(lt(schema.auditEvents.at, new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 864e5)));
  if (q.before) c.push(lt(schema.auditEvents.id, Number(q.before)));
  return and(...c)!;
}

/** newest first; `nextCursor` is the id to pass as `before` for the next page */
export async function listAudit(orgId: string, q: AuditQuery): Promise<{ items: AuditEventView[]; nextCursor: string | null }> {
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(filters(orgId, q))
    .orderBy(desc(schema.auditEvents.id))
    .limit(q.limit + 1);
  const items = rows.slice(0, q.limit).map(toAuditView);
  return { items, nextCursor: rows.length > q.limit ? items[items.length - 1].id : null };
}

/** for the CSV export: newest first, in pages, up to `max` rows */
export async function* auditRowsForExport(orgId: string, q: Omit<AuditQuery, 'limit'>, max = 50_000): AsyncGenerator<AuditEventView> {
  let before = q.before;
  let n = 0;
  while (n < max) {
    const page = await listAudit(orgId, { ...q, before, limit: 200 });
    for (const e of page.items) {
      if (n++ >= max) return;
      yield e;
    }
    if (!page.nextCursor) return;
    before = page.nextCursor;
  }
}

/** the people who appear as actors in this company's log (the "who" filter) */
export async function auditActors(orgId: string): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .selectDistinct({ id: schema.auditEvents.actorUserId, label: schema.auditEvents.actorLabel })
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.orgId, orgId), sql`${schema.auditEvents.actorUserId} is not null`))
    .limit(500);
  const seen = new Map<string, string>();
  for (const r of rows) if (r.id && !seen.has(r.id)) seen.set(r.id, r.label);
  return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Retention: deletes each company's events older than its `auditRetentionDays`. The table's trigger refuses every other DELETE; this
 * transaction sets `ascentra.audit_purge` for itself only (`set_config(..., true)` is local to the transaction).
 */
export async function purgeAudit(now = new Date()): Promise<number> {
  const orgs = await db.select({ id: schema.organizations.id, policy: schema.organizations.securityPolicy }).from(schema.organizations);
  let removed = 0;
  for (const o of orgs) {
    const cutoff = new Date(now.getTime() - policyOf(o.policy).auditRetentionDays * 864e5);
    removed += await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('ascentra.audit_purge', 'on', true)`);
      const gone = await tx.delete(schema.auditEvents).where(and(eq(schema.auditEvents.orgId, o.id), lt(schema.auditEvents.at, cutoff))).returning({ id: schema.auditEvents.id });
      return gone.length;
    });
  }
  return removed;
}
