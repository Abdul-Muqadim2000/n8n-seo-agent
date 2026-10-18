import { resolve4, resolve6, resolveCname, resolveTxt } from 'node:dns/promises';
import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  normalizeHost,
  PORTAL_DOMAIN,
  portalHostProblem,
  portalTxtName,
  portalTxtValue,
  type PortalDomainCheck,
  type PortalDomainView,
} from '@seo/shared';
import { consumeFlow, createFlow } from '../auth/flows';
import { createSession } from '../auth/session';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, PortalDomainRow, UserRow } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../lib/errors';
import { audit } from './audit';

/**
 * G5 (app/docs/WHITE_LABEL.md §2, §5): the hosts this app answers on, an agency's portal host and its DNS proof, the re-check that
 * lapses a host whose proof is gone, the on-demand TLS "ask", and the hand-off of a session from the app host to a portal host.
 */

export interface PortalRequest {
  /** the agency whose portal this host is */
  orgId: string;
  host: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** G5: set when the request came in on a verified portal host */
    portal: PortalRequest | null;
  }
}

const hostOfUrl = (url: string): string | null => /^[a-z]+:\/\/([^/:?#]+)/i.exec(url)?.[1]?.toLowerCase() ?? null;

/** the app's own hosts: APP_URL's, the callback host, APP_EXTRA_HOSTS, and loopback (health checks, local tools) */
export function ownHosts(): Set<string> {
  const s = new Set<string>(['localhost', '127.0.0.1', '::1', '[::1]']);
  for (const u of [config.appUrl, config.callbackBaseUrl]) {
    const h = hostOfUrl(u);
    if (h) s.add(h);
  }
  for (const h of config.portal.extraHosts) s.add(h.replace(/:\d+$/, ''));
  return s;
}

/** hosts no agency may claim: ours, their parents' registrable part when they are on a real domain, and the CNAME target */
export function reservedHosts(): string[] {
  const out = new Set<string>();
  for (const h of [...ownHosts(), config.portal.cnameTarget].filter(Boolean)) {
    if (!h || h === 'localhost' || /^[\d.:[\]]+$/.test(h)) continue;
    out.add(h);
    // app.alaventra.app → alaventra.app as well: nobody gets a sibling of the platform's own host
    const parts = h.split('.');
    if (parts.length > 2) out.add(parts.slice(-2).join('.'));
  }
  return [...out];
}

// ---- host → tenant, cached: every request asks ----
type HostEntry = { orgId: string; status: 'verified' | 'lapsed' };
let cache: { at: number; map: Map<string, HostEntry> } | null = null;
const CACHE_MS = 30_000;
export const invalidatePortalHosts = () => {
  cache = null;
};
async function hostMap(): Promise<Map<string, HostEntry>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  const rows = await db
    .select({ host: schema.portalDomains.host, orgId: schema.portalDomains.orgId, status: schema.portalDomains.status })
    .from(schema.portalDomains)
    .where(inArray(schema.portalDomains.status, ['verified', 'lapsed']));
  const map = new Map(rows.map((r) => [r.host, { orgId: r.orgId, status: r.status as HostEntry['status'] }]));
  cache = { at: Date.now(), map };
  return map;
}

export type HostClass = { kind: 'app' } | { kind: 'portal'; orgId: string; host: string } | { kind: 'lapsed'; host: string } | { kind: 'unknown'; host: string };

export async function classifyHost(raw: string | undefined): Promise<HostClass> {
  const host = String(raw ?? '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (!host || ownHosts().has(host)) return { kind: 'app' };
  const e = (await hostMap()).get(host);
  if (e?.status === 'verified') return { kind: 'portal', orgId: e.orgId, host };
  if (e?.status === 'lapsed') return { kind: 'lapsed', host };
  return { kind: 'unknown', host };
}

/**
 * The first hook of every request (pages and API): sets `req.portal` on a verified portal host; refuses a lapsed portal host always,
 * and any unknown host when strict hosts are on — with a plain 421 and nothing of the app, so nobody can serve our sign-in page
 * under a name we never verified.
 */
export async function hostGate(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  req.portal = null;
  const c = await classifyHost(req.hostname);
  if (c.kind === 'portal') {
    req.portal = { orgId: c.orgId, host: c.host };
    return true;
  }
  if (c.kind === 'app') return true;
  if (c.kind === 'unknown' && !config.portal.strictHosts) return true;
  if (req.url === '/api/health' || req.url.startsWith('/api/portal/tls-allow')) return true;
  void reply
    .status(421)
    .header('content-type', 'text/plain; charset=utf-8')
    .header('cache-control', 'no-store')
    .send(c.kind === 'lapsed' ? 'This portal address is not available right now.' : 'This address is not served here.');
  return false;
}

/** On-demand TLS "ask": a certificate only for our own hosts and verified portal hosts. */
export async function tlsAllowed(domain: unknown): Promise<boolean> {
  const host = normalizeHost(domain) ?? (typeof domain === 'string' && ownHosts().has(domain.toLowerCase()) ? domain.toLowerCase() : null);
  if (!host) return false;
  const c = await classifyHost(host);
  return c.kind === 'portal' || (c.kind === 'app' && host !== 'localhost');
}

// ---- DNS proof ----
export interface PortalDns {
  txt: (name: string) => Promise<string[][]>;
  cname: (name: string) => Promise<string[]>;
  addrs: (name: string) => Promise<string[]>;
}
const nodeDns: PortalDns = {
  txt: (n) => resolveTxt(n),
  cname: (n) => resolveCname(n),
  addrs: async (n) => {
    const [a, b] = await Promise.all([resolve4(n).catch(() => [] as string[]), resolve6(n).catch(() => [] as string[])]);
    return [...a, ...b];
  },
};
let dns: PortalDns = nodeDns;
/** tests: answer DNS from a table */
export const setPortalDns = (d: Partial<PortalDns> | null) => {
  dns = d ? { ...nodeDns, ...d } : nodeDns;
};
const absent = (e: unknown) => ['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(String((e as { code?: string })?.code ?? ''));
const dotless = (h: string) => h.toLowerCase().replace(/\.$/, '');

export async function checkPortalDomain(host: string, token: string): Promise<PortalDomainCheck> {
  let txt: PortalDomainCheck['txt'] = 'missing';
  try {
    const recs = (await dns.txt(portalTxtName(host))).map((r) => r.join('').trim());
    if (recs.includes(portalTxtValue(token))) txt = 'found';
    else if (recs.some((r) => r.startsWith('portal-verification='))) txt = 'wrong';
  } catch (e) {
    txt = absent(e) ? 'missing' : 'error';
  }
  let cname: PortalDomainCheck['cname'] = 'not_checked';
  const target = config.portal.cnameTarget;
  if (target) {
    try {
      const c = (await dns.cname(host).catch((e) => (absent(e) ? [] : Promise.reject(e)))).map(dotless);
      if (c.includes(target)) cname = 'ok';
      else {
        // an apex cannot be a CNAME: the same addresses as the target will do
        const [mine, theirs] = await Promise.all([dns.addrs(host), dns.addrs(target)]);
        cname = mine.length && mine.every((a) => theirs.includes(a)) ? 'ok' : mine.length || c.length ? 'elsewhere' : 'missing';
      }
    } catch {
      cname = 'error';
    }
  }
  const ok = txt === 'found' && (cname === 'ok' || cname === 'not_checked');
  const parts: string[] = [];
  if (txt === 'missing') parts.push(`No TXT record at ${portalTxtName(host)} yet.`);
  if (txt === 'wrong') parts.push(`The TXT record at ${portalTxtName(host)} has a different value: use the one shown here (each claim gets a new one).`);
  if (txt === 'error') parts.push('The DNS lookup failed; try again in a minute.');
  if (cname === 'missing') parts.push(`${host} does not resolve yet: add the CNAME to ${target}.`);
  if (cname === 'elsewhere') parts.push(`${host} points somewhere else: its CNAME must be ${target}.`);
  if (cname === 'error') parts.push(`The CNAME lookup for ${host} failed; try again in a minute.`);
  if (ok) parts.push(cname === 'ok' ? 'TXT record and CNAME found.' : 'TXT record found (this installation does not check the CNAME).');
  return { ok, txt, cname, detail: parts.join(' ') };
}

// ---- the company's portal hosts ----
const scheme = () => (config.appUrl.startsWith('https://') ? 'https' : 'http');
export const portalUrl = (host: string) => `${scheme()}://${host}`;

export function toDomainView(r: PortalDomainRow): PortalDomainView {
  return {
    id: r.id,
    host: r.host,
    status: r.status as PortalDomainView['status'],
    txtName: portalTxtName(r.host),
    txtValue: portalTxtValue(r.token),
    cnameTarget: config.portal.cnameTarget || null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    lastCheckAt: r.lastCheckAt?.toISOString() ?? null,
    lastCheckOk: r.lastCheckOk,
    lastCheckDetail: r.lastCheckDetail,
    failures: r.failures,
    createdAt: r.createdAt.toISOString(),
    url: portalUrl(r.host),
  };
}

export async function listDomains(orgId: string): Promise<PortalDomainView[]> {
  const rows = await db.query.portalDomains.findMany({ where: eq(schema.portalDomains.orgId, orgId), orderBy: asc(schema.portalDomains.createdAt) });
  return rows.map(toDomainView);
}

/** the verified host of an agency (the first), for links in e-mails and share links; null when it has none */
export async function agencyPortalHost(agencyId: string | null | undefined): Promise<string | null> {
  if (!agencyId) return null;
  const r = await db.query.portalDomains.findFirst({
    where: and(eq(schema.portalDomains.orgId, agencyId), eq(schema.portalDomains.status, 'verified')),
    orderBy: asc(schema.portalDomains.verifiedAt),
  });
  return r?.host ?? null;
}

export async function claimDomain(req: FastifyRequest, org: OrgRow, user: UserRow, raw: unknown): Promise<PortalDomainView> {
  const host = normalizeHost(raw);
  const problem = portalHostProblem(host, reservedHosts());
  if (problem || !host) throw badRequest(problem ?? 'Enter a host name.', { host: problem ?? 'Enter a host name' });
  const mine = await db.query.portalDomains.findFirst({ where: and(eq(schema.portalDomains.orgId, org.id), eq(schema.portalDomains.host, host)) });
  if (mine) return toDomainView(mine);
  const live = await db.query.portalDomains.findFirst({ where: and(eq(schema.portalDomains.host, host), inArray(schema.portalDomains.status, ['verified', 'lapsed'])) });
  if (live) throw conflict(`${host} is already in use on this platform. If it is yours, release it there first or contact the platform administrator.`, 'host_in_use');
  const count = (await db.select({ id: schema.portalDomains.id }).from(schema.portalDomains).where(eq(schema.portalDomains.orgId, org.id))).length;
  if (count >= PORTAL_DOMAIN.maxPerOrg) throw conflict(`A company can hold ${PORTAL_DOMAIN.maxPerOrg} portal addresses. Remove one first.`, 'too_many_hosts');
  // a NEW token for every claim, bound to this company: an old TXT record left in DNS by somebody else proves nothing
  const [row] = await db.insert(schema.portalDomains).values({ orgId: org.id, host, token: randomToken(24).replace(/[^A-Za-z0-9]/g, '').slice(0, 32), createdBy: user.id }).returning();
  await audit(req, org.id, { action: 'portal.domain_claimed', target: { type: 'portal_domain', id: row.id, label: host } });
  return toDomainView(row);
}

export async function verifyDomain(req: FastifyRequest, org: OrgRow, id: string): Promise<{ domain: PortalDomainView; check: PortalDomainCheck }> {
  const row = await db.query.portalDomains.findFirst({ where: and(eq(schema.portalDomains.id, id), eq(schema.portalDomains.orgId, org.id)) });
  if (!row) throw notFound('Portal address not found');
  const check = await checkPortalDomain(row.host, row.token);
  const now = new Date();
  let updated: PortalDomainRow;
  try {
    [updated] = await db
      .update(schema.portalDomains)
      .set(
        check.ok
          ? { status: 'verified', verifiedAt: row.verifiedAt ?? now, lastCheckAt: now, lastCheckOk: true, lastCheckDetail: check.detail, failures: 0 }
          : { lastCheckAt: now, lastCheckOk: false, lastCheckDetail: check.detail },
      )
      .where(eq(schema.portalDomains.id, row.id))
      .returning();
  } catch (e) {
    if ((e as { code?: string; cause?: { code?: string } }).code === '23505' || (e as { cause?: { code?: string } }).cause?.code === '23505')
      throw conflict(`${row.host} was verified by another company a moment ago.`, 'host_in_use');
    throw e;
  }
  invalidatePortalHosts();
  if (check.ok && row.status !== 'verified') await audit(req, org.id, { action: 'portal.domain_verified', target: { type: 'portal_domain', id: row.id, label: row.host } });
  if (!check.ok) await audit(req, org.id, { action: 'portal.domain_check_failed', outcome: 'failure', target: { type: 'portal_domain', id: row.id, label: row.host }, details: { txt: check.txt, cname: check.cname } });
  return { domain: toDomainView(updated), check };
}

export async function releaseDomain(req: FastifyRequest, org: OrgRow, id: string): Promise<void> {
  const [gone] = await db.delete(schema.portalDomains).where(and(eq(schema.portalDomains.id, id), eq(schema.portalDomains.orgId, org.id))).returning();
  if (!gone) throw notFound('Portal address not found');
  invalidatePortalHosts();
  await audit(req, org.id, { action: 'portal.domain_released', target: { type: 'portal_domain', id: gone.id, label: gone.host }, details: { status: gone.status } });
}

/**
 * The re-check: every verified or lapsed host whose last check is older than PORTAL_DOMAIN_CHECK_HOURS. A pass keeps (or brings back)
 * `verified`; after `PORTAL_DOMAIN.lapseAfterFailures` failures in a row a verified host lapses and is no longer served.
 */
export async function recheckDomains(now = new Date()): Promise<{ checked: number; lapsed: number; restored: number }> {
  const due = new Date(now.getTime() - config.portal.checkHours * 3600_000);
  const rows = await db.query.portalDomains.findMany({
    where: and(inArray(schema.portalDomains.status, ['verified', 'lapsed']), or(isNull(schema.portalDomains.lastCheckAt), lt(schema.portalDomains.lastCheckAt, due))),
    limit: 200,
  });
  let lapsed = 0;
  let restored = 0;
  for (const r of rows) {
    const c = await checkPortalDomain(r.host, r.token);
    if (c.ok) {
      await db.update(schema.portalDomains).set({ status: 'verified', lastCheckAt: now, lastCheckOk: true, lastCheckDetail: c.detail, failures: 0 }).where(eq(schema.portalDomains.id, r.id));
      if (r.status === 'lapsed') {
        restored++;
        await audit(null, r.orgId, { action: 'portal.domain_verified', target: { type: 'portal_domain', id: r.id, label: r.host }, details: { restored: true } });
      }
      continue;
    }
    const failures = r.failures + 1;
    const lapse = r.status === 'verified' && failures >= PORTAL_DOMAIN.lapseAfterFailures;
    await db
      .update(schema.portalDomains)
      .set({ lastCheckAt: now, lastCheckOk: false, lastCheckDetail: c.detail, failures, ...(lapse ? { status: 'lapsed' } : {}) })
      .where(eq(schema.portalDomains.id, r.id));
    if (lapse) {
      lapsed++;
      await audit(null, r.orgId, { action: 'portal.domain_lapsed', outcome: 'failure', target: { type: 'portal_domain', id: r.id, label: r.host }, details: { failures, txt: c.txt, cname: c.cname } });
    }
  }
  if (rows.length) invalidatePortalHosts();
  return { checked: rows.length, lapsed, restored };
}

// ---- hand-off: a session from the app host to a portal host ----
const HANDOFF_SECONDS = 60;

/** the agency id behind a company: itself (agency) or its parent (client workspace) */
async function agencyIdsOf(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: schema.organizations.id, kind: schema.organizations.kind, parent: schema.organizations.parentOrgId })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.userId, userId), isNull(schema.memberships.deactivatedAt)));
  return new Set(rows.map((r) => (r.kind === 'client' && r.parent ? r.parent : r.id)));
}

/** POST on the app host by a signed-in person: a one-use link (60 s) that opens a session on the agency's portal host */
export async function createHandoff(req: FastifyRequest, user: UserRow, rawHost: unknown): Promise<{ url: string; expiresInSeconds: number }> {
  if (req.portal) throw badRequest('Open this from the main app address.');
  const host = normalizeHost(rawHost);
  const c = host ? await classifyHost(host) : null;
  if (!host || c?.kind !== 'portal') throw notFound('That portal address is not served here.');
  if (!(await agencyIdsOf(user.id)).has(c.orgId)) throw forbidden('You have no access to that portal.');
  const s = req.session;
  const token = await createFlow('portal_handoff', {
    userId: user.id,
    orgId: c.orgId,
    ttlMinutes: HANDOFF_SECONDS / 60,
    data: { host, method: s?.authMethod ?? 'password', mfa: !!s?.mfaAt, ssoOrgId: s?.ssoOrgId ?? null },
  });
  return { url: `${portalUrl(host)}/api/portal/handoff/${token}`, expiresInSeconds: HANDOFF_SECONDS };
}

/** GET on the portal host: consumes the link (once), opens the session there with the same sign-in method, second factor and SSO */
export async function consumeHandoff(req: FastifyRequest, reply: FastifyReply, token: unknown): Promise<void> {
  if (!req.portal) throw notFound();
  const flow = await consumeFlow(token, 'portal_handoff');
  const data = (flow?.data ?? {}) as { host?: string; method?: string; mfa?: boolean; ssoOrgId?: string | null };
  if (!flow?.userId || data.host !== req.portal.host || flow.orgId !== req.portal.orgId) throw new HttpError(400, 'This sign-in link has expired or was already used. Sign in again.', 'handoff_invalid');
  await createSession(reply, req, flow.userId, {
    method: (['password', 'google', 'sso'].includes(String(data.method)) ? data.method : 'password') as 'password' | 'google' | 'sso',
    mfa: !!data.mfa,
    ssoOrgId: data.ssoOrgId ?? null,
  });
  await audit(req, req.portal.orgId, { action: 'portal.handoff', target: { type: 'portal_domain', label: req.portal.host }, actor: { type: 'user', userId: flow.userId, label: (await db.query.users.findFirst({ where: eq(schema.users.id, flow.userId) }))?.email ?? 'user' } });
}

/** the re-check timer (WHITE_LABEL.md §2): hourly sweep of the hosts due for a check */
export function startPortalJobs(log: { warn: (o: object, m: string) => void }): () => void {
  if (!config.portal.jobs) return () => undefined;
  const t = setInterval(() => void recheckDomains().catch((err) => log.warn({ err: String(err) }, 'portal domain re-check failed')), 3600_000);
  t.unref?.();
  return () => clearInterval(t);
}
