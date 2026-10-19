import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  deliveryDecision,
  SHARE,
  shareCaveat,
  sharedBrand,
  shareExpiry,
  shareState,
  type ProfileRow,
  type SharedBrand,
  type ShareLink,
  type SharedReport,
} from '@seo/shared';
import { db, schema } from '../db';
import type { OrgRow, ReportShareRow, UserRow } from '../db/schema';
import { siteRows } from '../n8n/client';
import { summarize } from './summaries';
import { brandForOrg } from './brandOf';
import { rewritableKind } from './portalDocs';
import { randomToken, sha256 } from '../lib/crypto';
import { HttpError, notFound } from '../lib/errors';

/**
 * The expiring share links of one report (G15; the rules live in @seo/shared `share.ts`, this file only reads and writes the database).
 * What a holder of a link can reach: that one report's title, website domain, date, headline values and its own files, plus the
 * company's own name and logo (B-R2) and the run's own caveat when the report is not finished work, read-only.
 * What it can never reach: another report (the token resolves to one report id), any list or dashboard, the run's input, the callback
 * payload, the company's other websites, its members or its settings, and no write of any kind. The token itself is never stored.
 */

const toLink = (r: ReportShareRow, createdByName: string | null, now = new Date()): ShareLink => ({
  id: r.id,
  reportId: r.reportId,
  state: shareState(r, now) as ShareLink['state'],
  expiresAt: r.expiresAt.toISOString(),
  createdAt: r.createdAt.toISOString(),
  createdByName,
  lastOpenedAt: r.lastOpenedAt ? r.lastOpenedAt.toISOString() : null,
  opens: r.opens,
  revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
});

/** The report, if it belongs to this company (404 otherwise, a report of another company is simply not there). */
async function reportOfOrg(orgId: string, reportId: string) {
  const row = await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.id, reportId)) });
  if (!row) throw notFound('Report not found');
  return row;
}

/** The live links of one report, newest first (never another report's, and never a token). */
export async function listShares(orgId: string, reportId: string): Promise<ShareLink[]> {
  await reportOfOrg(orgId, reportId);
  const rows = await db
    .select({ s: schema.reportShares, name: schema.users.name })
    .from(schema.reportShares)
    .leftJoin(schema.users, eq(schema.reportShares.createdBy, schema.users.id))
    .where(and(eq(schema.reportShares.orgId, orgId), eq(schema.reportShares.reportId, reportId)))
    .orderBy(desc(schema.reportShares.createdAt))
    .limit(50);
  const now = new Date();
  return rows.map((r) => toLink(r.s, r.name ?? null, now));
}

/**
 * A new link for one report: a 256-bit token, stored only as its hash, with an explicit expiry. The URL (the only time the token is
 * ever returned) is built by the caller from the app's own base URL.
 */
export async function createShare(o: { org: OrgRow; user: UserRow; reportId: string; days?: unknown }): Promise<{ link: ShareLink; token: string }> {
  await reportOfOrg(o.org.id, o.reportId);
  const now = new Date();
  const live = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.reportShares)
    .where(and(eq(schema.reportShares.reportId, o.reportId), isNull(schema.reportShares.revokedAt), sql`${schema.reportShares.expiresAt} > now()`));
  if (Number(live[0]?.n ?? 0) >= SHARE.maxPerReport)
    throw new HttpError(409, `This report already has ${SHARE.maxPerReport} live share links. Turn one off before creating another.`, 'share_limit');
  const token = randomToken(SHARE.tokenBytes);
  const [row] = await db
    .insert(schema.reportShares)
    .values({ orgId: o.org.id, reportId: o.reportId, tokenHash: sha256(token), expiresAt: shareExpiry(o.days, now), createdBy: o.user.id })
    .returning();
  return { link: toLink(row, o.user.name, now), token };
}

/**
 * B-R1: the link a delivery carries. Same table, same rules, same expiry and revocation as a link a person creates in the app, * there is one sharing mechanism in this product and this is it. The two differences are deliberate: no `createdBy` (nobody
 * clicked anything), and nothing is created once the report has used up its budget of live links, so a weekly summary cannot
 * quietly spend all ten.
 */
export async function createShareForDelivery(orgId: string, reportId: string, days: number): Promise<{ link: ShareLink; token: string } | null> {
  const now = new Date();
  const live = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.reportShares)
    .where(and(eq(schema.reportShares.reportId, reportId), isNull(schema.reportShares.revokedAt), sql`${schema.reportShares.expiresAt} > now()`));
  // only the hash of a live link was kept, so an existing one cannot be handed out again, a fresh one is made while there is room
  if (Number(live[0]?.n ?? 0) >= SHARE.maxPerReport) return null;
  const token = randomToken(SHARE.tokenBytes);
  const [row] = await db
    .insert(schema.reportShares)
    .values({ orgId, reportId, tokenHash: sha256(token), expiresAt: shareExpiry(days, now), createdBy: null })
    .returning();
  return { link: toLink(row, null, now), token };
}

/** Turns a link off for good. Revoking twice is not an error; another company's link is a 404. */
export async function revokeShare(orgId: string, reportId: string, shareId: string): Promise<ShareLink> {
  await reportOfOrg(orgId, reportId);
  const row = await db.query.reportShares.findFirst({
    where: and(eq(schema.reportShares.id, shareId), eq(schema.reportShares.orgId, orgId), eq(schema.reportShares.reportId, reportId)),
  });
  if (!row) throw notFound('Share link not found');
  if (row.revokedAt) return toLink(row, null);
  const [updated] = await db.update(schema.reportShares).set({ revokedAt: new Date() }).where(eq(schema.reportShares.id, row.id)).returning();
  return toLink(updated, null);
}

/** The stored link behind a token (by its hash), whatever its state, the route decides what to say. */
export async function shareByToken(token: string): Promise<ReportShareRow | null> {
  const row = await db.query.reportShares.findFirst({ where: eq(schema.reportShares.tokenHash, sha256(token)) });
  return row ?? null;
}

/** Records an open: the time and a counter, so the owner can see whether the link was used. Never fails the read. */
export async function markOpened(shareId: string): Promise<void> {
  try {
    await db
      .update(schema.reportShares)
      .set({ lastOpenedAt: new Date(), opens: sql`${schema.reportShares.opens} + 1` })
      .where(eq(schema.reportShares.id, shareId));
  } catch {
    /* an open is not worth failing the page for */
  }
}

/**
 * B-R2: the company's own name and logo for the website this report is about.
 *
 * It reads the business profile the company already filled in for the engine and takes **two fields of it**, `business_name` and
 * `logo_url`. The rest of that row is the company's postal address, phone, public e-mail, opening hours and the author's biography,
 * and none of it is returned: a share link exposes one report, and a brand mark is the only thing added to that.
 *
 * The engine is a dependency this page must not have. If n8n is unreachable, slow, or simply has no profile for the domain, the brand
 * falls back to the company's own name in the app and the page renders exactly as it did before. A report with no website (a keyword
 * check, say) reads no profile at all. The read goes through the n8n client's 60-second cache, so a link passed around a client's team
 * costs at most one request a minute.
 */
async function brandFor(orgName: string, domain: string | null): Promise<SharedBrand> {
  if (!domain) return sharedBrand({ orgName });
  try {
    const rows = await siteRows<ProfileRow>('profiles', domain, { max: 5 });
    return sharedBrand({ orgName, businessName: rows[0]?.business_name, logoUrl: rows[0]?.logo_url });
  } catch {
    return sharedBrand({ orgName });
  }
}

/**
 * B-R2: the headline figures in the order the run wrote them, not the order Postgres happens to return.
 *
 * `summary` is stored as `jsonb`, and jsonb keeps its keys sorted by length, so a shared audit led with "scoreDelta 4" and put the
 * health score last, which is not how anybody reads a report. `summarize()` is the one place that decides what a stage's headline
 * figures are and in which order, so the order is taken from it rather than from a second list that could drift. Anything stored but
 * no longer produced keeps its place at the end instead of disappearing.
 */
function orderedSummary(stage: string, payload: unknown, stored: Record<string, string | number | boolean | null>) {
  try {
    const out: Record<string, string | number | boolean | null> = {};
    for (const k of Object.keys(summarize(stage, (payload ?? {}) as Record<string, unknown>))) if (k in stored) out[k] = stored[k]!;
    for (const [k, v] of Object.entries(stored)) if (!(k in out)) out[k] = v;
    return out;
  } catch {
    return stored;
  }
}

/** The one report a live link may show, with its files and the company's name, and nothing else from that company. */
export async function sharedReport(share: ReportShareRow): Promise<SharedReport | null> {
  const rows = await db
    .select({ r: schema.reports, domain: schema.sites.domain, orgName: schema.organizations.name, org: schema.organizations })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .leftJoin(schema.organizations, eq(schema.reports.orgId, schema.organizations.id))
    .where(and(eq(schema.reports.id, share.reportId), eq(schema.reports.orgId, share.orgId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // G5: a white-label client workspace's link shows the agency's name and only the files that can carry it
  const agencyBrand = await brandForOrg(row.org ?? null);
  const [files, brand] = await Promise.all([
    db
      .select({ id: schema.files.id, kind: schema.files.kind, fileName: schema.files.fileName, mimeType: schema.files.mimeType, size: schema.files.size })
      .from(schema.files)
      .where(eq(schema.files.reportId, share.reportId))
      .orderBy(asc(schema.files.createdAt))
      .limit(50),
    brandFor(row.orgName ?? '', row.domain ?? null),
  ]);
  return {
    id: row.r.id,
    stage: row.r.stage,
    status: row.r.status,
    title: row.r.title,
    siteDomain: row.domain ?? null,
    receivedAt: row.r.receivedAt.toISOString(),
    scheduled: row.r.scheduled,
    summary: orderedSummary(row.r.stage, row.r.payload, row.r.summary),
    files: agencyBrand ? files.filter((f) => rewritableKind(f.kind)) : files,
    orgName: row.orgName ?? '',
    brand,
    agencyBrand,
    // B-R2: the same readiness rule the delivery applies, said to the reader instead of used to refuse. The payload itself never leaves.
    caveat: shareCaveat(deliveryDecision({ stage: row.r.stage, status: row.r.status, payload: (row.r.payload ?? {}) as Record<string, unknown> })),
    expiresAt: share.expiresAt.toISOString(),
  };
}

/** One file of the shared report, the file must belong to that report, or there is nothing to serve. */
export async function sharedFile(share: ReportShareRow, fileId: string) {
  const f = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.reportId, share.reportId), eq(schema.files.orgId, share.orgId)),
  });
  return f ?? null;
}
