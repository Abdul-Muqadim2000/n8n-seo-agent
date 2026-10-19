import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import { audit } from '../services/audit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  adminActionSchema,
  createSiteSchema,
  LINK_IMPORT_COLUMNS,
  linkImportSchema,
  monitorsBody,
  parseLinkImport,
  n8nSiteId,
  safeJson,
  updateSiteSchema,
  VERIFICATION_META_NAME,
  VERIFICATION_TXT_PREFIX,
  verifySiteSchema,
  type AdminResult,
  type AiGrowthRow,
  type IndexNowCheck,
  type GoogleConnection,
  type LinkImportSummary,
  type Site,
  type SiteVerificationInfo,
  type VerificationMethod,
  type VerifyResult,
} from '@seo/shared';
import { orgAccess, requireVerified, siteAccess } from '../auth/access';
import { G_COOKIE, googleAuthUrl } from '../auth/google';
import { config } from '../config';
import { db, schema } from '../db';
import type { SiteRow } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { badRequest, conflict, HttpError, notFound, parse } from '../lib/errors';
import { deleteRows, ensureTable, insertRows, invalidateSite, siteAdmin, siteRows } from '../n8n/client';
import { invalidateForecast } from '../services/billing';
import { assertGa4ForDomain, findGscProperty, gscOwnerCheck, listGa4Properties } from '../services/google';
import { routeSiteToApp } from '../services/runs';
import { fetchPublicText, verify } from '../services/verify';

export function toSite(s: SiteRow): Site {
  return {
    id: s.id,
    orgId: s.orgId,
    domain: s.domain,
    n8nSiteId: n8nSiteId(s.domain),
    country: s.country,
    business: s.business,
    customers: s.customers,
    goal: s.goal,
    tone: s.tone,
    cta: s.cta,
    businessFacts: s.businessFacts,
    competitors: s.competitors,
    brandNames: s.brandNames,
    keywords: s.keywords,
    ga4PropertyId: s.ga4PropertyId,
    gscProperty: s.gscProperty,
    blogsPerWeek: s.blogsPerWeek,
    verifiedAt: s.verifiedAt?.toISOString() ?? null,
    verificationMethod: (s.verificationMethod as VerificationMethod | null) ?? null,
    trackingStatus: s.trackingStatus as Site['trackingStatus'],
    trackingStartedAt: s.trackingStartedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    timezone: s.timezone,
    services: s.services,
    cycleWeekday: s.cycleWeekday ?? null,
    autopilotLevel: (s.autopilotLevel === 1 || s.autopilotLevel === 3 ? s.autopilotLevel : 2) as Site['autopilotLevel'],
  };
}

async function verifiedElsewhere(domain: string, orgId: string): Promise<boolean> {
  const row = await db.query.sites.findFirst({ where: and(eq(schema.sites.domain, domain), isNotNull(schema.sites.verifiedAt), ne(schema.sites.orgId, orgId)) });
  return !!row;
}

type P = { orgId: string; siteId: string };

/** Marks the site verified and points the domain's stored n8n delivery (site row, ladders) at this company. */
async function markVerified(site: SiteRow, method: VerificationMethod, gscProperty?: string | null) {
  const [s] = await db
    .update(schema.sites)
    .set({ verifiedAt: new Date(), verificationMethod: method, ...(gscProperty ? { gscProperty } : {}), updatedAt: new Date() })
    .where(eq(schema.sites.id, site.id))
    .returning();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, site.orgId) });
  if (org) await routeSiteToApp(org, s).catch(() => undefined);
}

/** Called by the Google OAuth callback: is the signed-in admin's Google account an owner of the domain in Search Console? */
export async function verifyWithGoogle(req: FastifyRequest, orgId: string, siteId: string, userAccessToken: string): Promise<'verified' | 'already' | 'claimed' | 'not_owner' | 'failed'> {
  let a;
  try {
    a = await siteAccess(req, orgId, siteId, 'admin');
  } catch {
    return 'failed';
  }
  if (a.site.verifiedAt) return 'already';
  if (await verifiedElsewhere(a.site.domain, a.org.id)) return 'claimed';
  const r = await gscOwnerCheck(userAccessToken, a.site.domain);
  if (!r.owner) return 'not_owner';
  await markVerified(a.site, 'search_console', r.property);
  await audit(req, a.org.id, { action: 'site.verified', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { method: 'search_console' } });
  return 'verified';
}

/** Stops everything the SEO engine runs for a domain: its site row (weekly runs) and its ladders (rank tracking and the "virtual"
 * sites the monitors build from ladder rows). History tables stay. */
async function stopInEngine(site: SiteRow, log: FastifyRequest['log']) {
  try {
    await siteAdmin({ action: 'delete', domain: site.domain, site_id: n8nSiteId(site.domain), request_id: `app-delete-${site.id}` });
  } catch (err) {
    log.warn({ err: String(err), domain: site.domain }, 'n8n site delete failed');
  }
  try {
    await deleteRows('ladders', [{ columnName: 'domain', condition: 'eq', value: site.domain }]);
    // the ladders' settings (Phase 2 table: nothing to do while it does not exist)
    await deleteRows('ladderSettings', [{ columnName: 'domain', condition: 'eq', value: site.domain }]);
  } catch (err) {
    log.warn({ err: String(err), domain: site.domain }, 'n8n ladder delete failed');
  }
  invalidateSite(site.domain);
}
export { stopInEngine };

export async function siteRoutes(app: FastifyInstance) {
  // G5: the client portal lists the workspace's websites
  app.get('/api/orgs/:orgId/sites', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'client_viewer');
    const rows = await db.query.sites.findMany({ where: eq(schema.sites.orgId, a.org.id), orderBy: asc(schema.sites.createdAt) });
    return rows.map(toSite);
  });

  app.post('/api/orgs/:orgId/sites', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    const body = parse(createSiteSchema, req.body);
    const mine = await db.query.sites.findFirst({ where: and(eq(schema.sites.orgId, a.org.id), eq(schema.sites.domain, body.domain)) });
    if (mine) throw conflict(`${body.domain} is already one of your websites.`, 'site_exists');
    if (await verifiedElsewhere(body.domain, a.org.id))
      throw conflict(`${body.domain} is already verified by another company on this platform. If it is yours, contact the platform administrator.`, 'domain_claimed');
    const [site] = await db
      .insert(schema.sites)
      .values({
        orgId: a.org.id,
        domain: body.domain,
        country: body.country,
        business: body.business,
        customers: body.customers,
        goal: body.goal,
        tone: body.tone,
        cta: body.cta,
        businessFacts: body.businessFacts,
        competitors: body.competitors,
        brandNames: body.brandNames,
        ...(body.services ? { services: body.services } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        verificationToken: randomToken(18),
      })
      .returning();
    await audit(req, a.org.id, { action: 'site.added', target: { type: 'site', id: site.id, label: site.domain } });
    return toSite(site);
  });

  app.get('/api/orgs/:orgId/sites/:siteId', async (req) => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'client_viewer');
    return toSite(site);
  });

  app.patch('/api/orgs/:orgId/sites/:siteId', async (req) => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const body = parse(updateSiteSchema, req.body);
    if (body.ga4PropertyId) {
      requireVerified(site);
      await assertGa4ForDomain(body.ga4PropertyId, site.domain);
    }
    const patch = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    const [s] = await db
      .update(schema.sites)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.sites.id, site.id))
      .returning();
    return toSite(s);
  });

  app.delete('/api/orgs/:orgId/sites/:siteId', async (req) => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    // a verified owner leaves: nothing keeps running or reporting for the domain (history in n8n stays)
    if (site.verifiedAt) await stopInEngine(site, req.log);
    await db.delete(schema.sites).where(eq(schema.sites.id, site.id));
    invalidateSite(site.domain);
    await audit(req, site.orgId, { action: 'site.deleted', target: { type: 'site', id: site.id, label: site.domain }, details: { wasVerified: !!site.verifiedAt } });
    return { ok: true };
  });

  // ---------- ownership ----------
  app.get('/api/orgs/:orgId/sites/:siteId/verification', async (req): Promise<SiteVerificationInfo> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId);
    return {
      verified: !!site.verifiedAt,
      verifiedAt: site.verifiedAt?.toISOString() ?? null,
      method: (site.verificationMethod as VerificationMethod | null) ?? null,
      token: site.verificationToken,
      dnsRecord: { type: 'TXT', host: site.domain, value: VERIFICATION_TXT_PREFIX + site.verificationToken },
      metaTag: `<meta name="${VERIFICATION_META_NAME}" content="${site.verificationToken}">`,
      serviceAccountEmail: config.serviceAccount.email || null,
      claimedElsewhere: await verifiedElsewhere(site.domain, site.orgId),
    };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/verify', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req): Promise<VerifyResult> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const { method } = parse(verifySiteSchema, req.body);
    if (site.verifiedAt) return { verified: true, method: (site.verificationMethod as VerificationMethod) ?? method, message: 'Already verified.' };
    if (method === 'search_console')
      throw badRequest('Search Console ownership is checked with your own Google account: use "Verify with Google" (or a DNS record or meta tag).', undefined, 'use_google');
    if (await verifiedElsewhere(site.domain, site.orgId)) throw conflict(`${site.domain} is already verified by another company on this platform.`, 'domain_claimed');
    const r = await verify(method, site.domain, site.verificationToken);
    if (r.verified) await markVerified(site, method);
    await audit(req, site.orgId, { action: r.verified ? 'site.verified' : 'site.verify_failed', outcome: r.verified ? 'success' : 'failure', target: { type: 'site', id: site.id, label: site.domain }, details: { method } });
    return { verified: r.verified, method, message: r.message };
  });

  // v4.12 (AI_GROWTH_SPEC.md): is the IndexNow key file in place? The AI growth loop sends new pages through IndexNow once it is (it checks
  // every Monday); this answers at once after the owner uploads the file. Only the site's own host, https, a few bytes.
  app.post('/api/orgs/:orgId/sites/:siteId/ai/indexnow/check', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req): Promise<IndexNowCheck> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId);
    requireVerified(site);
    const g = (await siteRows<AiGrowthRow>('aiGrowth', site.domain, { sortBy: 'checked_at:desc', max: 1 }))[0];
    const keyUrl = String(safeJson<Record<string, Record<string, unknown>>>(g?.submitted_json ?? '', {}).indexnow?.key_url ?? '');
    const m = keyUrl.match(/^https:\/\/([^/]+)\/([a-f0-9]{32})\.txt$/);
    if (!m) throw notFound('No IndexNow key yet: the first weekly AI growth run of this website makes it.');
    const host = m[1].toLowerCase();
    if (host !== site.domain && host !== `www.${site.domain}`) throw badRequest('The key file must be on your own website.');
    const r = await fetchPublicText(keyUrl, 4096).catch(() => null);
    const verified = !!r && r.status === 200 && r.text.trim() === m[2];
    return {
      verified,
      keyUrl,
      status: r?.status ?? 0,
      message: verified
        ? 'The file is in place: from the next AI growth run every new or updated page is sent through IndexNow too.'
        : !r
          ? 'The file could not be fetched (no answer from the website).'
          : r.status === 200
            ? 'The address answers, but the file does not contain only the key.'
            : `The address answers ${r.status}: the file is not there yet.`,
    };
  });

  // "Verify with Google": sign in with the Google account that owns the domain in Search Console (read-only scope)
  app.get('/api/orgs/:orgId/sites/:siteId/verify/google', async (req, reply) => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const nextRaw = (req.query as { next?: string }).next;
    const back = nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !/[\\\s]/.test(nextRaw) ? nextRaw : `/o/${p.orgId}/sites/${p.siteId}/settings/verification`;
    if (!config.google.enabled) return reply.redirect(`${back}${back.includes('?') ? '&' : '?'}google=disabled`);
    if (site.verifiedAt) return reply.redirect(`${back}${back.includes('?') ? '&' : '?'}google=already`);
    const { url, state, verifier } = googleAuthUrl({ searchConsole: true });
    reply.setCookie('g_state', state, G_COOKIE);
    reply.setCookie('g_verifier', verifier, G_COOKIE);
    reply.setCookie('g_next', back, G_COOKIE);
    reply.setCookie('g_intent', `verify:${p.orgId}:${p.siteId}`, G_COOKIE);
    return reply.redirect(url);
  });

  app.get('/api/orgs/:orgId/sites/:siteId/google', async (req): Promise<GoogleConnection> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(site);
    const out: GoogleConnection = {
      serviceAccountEmail: config.serviceAccount.email || null,
      configured: config.serviceAccount.enabled,
      gsc: { connected: false, property: null, permissionLevel: null, error: null },
      ga4: { connected: !!site.ga4PropertyId, properties: [], selected: site.ga4PropertyId || null, error: null },
    };
    if (!config.serviceAccount.enabled) return out;
    const [gsc, ga4] = await Promise.allSettled([findGscProperty(site.domain), listGa4Properties(site.domain)]);
    if (gsc.status === 'fulfilled') {
      if (gsc.value) {
        out.gsc = { connected: true, property: gsc.value.property, permissionLevel: gsc.value.permissionLevel, error: null };
        if (site.gscProperty !== gsc.value.property) await db.update(schema.sites).set({ gscProperty: gsc.value.property }).where(eq(schema.sites.id, site.id));
      }
    } else out.gsc.error = String((gsc.reason as Error)?.message ?? gsc.reason);
    if (ga4.status === 'fulfilled') {
      // the service account sees every company's properties: only show the ones that measure this domain (and the chosen one)
      out.ga4.properties = ga4.value.filter((x) => x.matchesDomain || x.id === site.ga4PropertyId);
      out.ga4.connected = !!site.ga4PropertyId && ga4.value.some((x) => x.id === site.ga4PropertyId);
    } else out.ga4.error = String((ga4.reason as Error)?.message ?? ga4.reason);
    return out;
  });

  // ---------- link uploads (v4.10): Search Console Links exports and other tools' backlink CSVs -> seo_link_imports ----------
  // The Search Console API has no links: the export is the only way to bring Google's own sample in. The latest upload of each kind
  // replaces the previous one; the Backlink Monitor merges it into its ledger on the next run and checks the pages itself.
  app.post('/api/orgs/:orgId/sites/:siteId/backlinks/import', { bodyLimit: 16 * 1024 * 1024, config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req): Promise<LinkImportSummary> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(site);
    const input = parse(linkImportSchema, req.body);
    let parsed;
    try {
      parsed = parseLinkImport(input.csv, site.domain);
    } catch (err) {
      throw badRequest((err as Error).message);
    }
    const now = new Date().toISOString();
    const importId = `imp_${Date.now().toString(36)}`;
    const siteId = n8nSiteId(site.domain);
    await ensureTable('linkImports', LINK_IMPORT_COLUMNS);
    await deleteRows('linkImports', [
      { columnName: 'site_id', condition: 'eq', value: siteId },
      { columnName: 'source', condition: 'eq', value: parsed.source },
    ]);
    for (let i = 0; i < parsed.rows.length; i += 500)
      await insertRows('linkImports', parsed.rows.slice(i, i + 500).map((r) => ({ site_id: siteId, domain: site.domain, import_id: importId, source: parsed.source, ...r, imported_at: now })));
    invalidateSite(site.domain);
    req.log.info({ site: site.domain, source: parsed.source, rows: parsed.rows.length }, 'link import');
    return { source: parsed.source, label: parsed.label, rows: parsed.rows.length, domains: parsed.domains, total: parsed.total, skipped: parsed.skipped, importedAt: now };
  });

  // ---------- Site Admin (n8n) ----------
  app.post('/api/orgs/:orgId/sites/:siteId/admin', async (req): Promise<AdminResult> => {
    const p = req.params as P;
    const { site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(site);
    const a = parse(adminActionSchema, req.body);
    const base = { domain: site.domain, site_id: n8nSiteId(site.domain), request_id: `app-${a.action}-${Date.now().toString(36)}` };
    let body: Record<string, unknown>;
    switch (a.action) {
      case 'pause':
      case 'resume':
        body = { ...base, action: a.action };
        break;
      case 'cadence':
        body = { ...base, action: 'cadence', pages_per_week: a.pagesPerWeek };
        break;
      case 'unpublish':
        body = { ...base, action: 'unpublish', keyword: a.keyword };
        break;
      case 'monitors': {
        // Site Admin keeps a field when it is '' : a single space clears a list
        const m = monitorsBody(a.monitors);
        if (a.monitors.brandNames && !a.monitors.brandNames.length) m.brand_names = ' ';
        if (a.monitors.aiPersonas && !a.monitors.aiPersonas.length) m.ai_personas = ' ';   // G6
        if (a.monitors.aiMarkets && !a.monitors.aiMarkets.length) m.ai_markets = ' ';
        body = { ...base, action: 'monitors', monitors: { ...m, ...(a.competitors ? { competitors: a.competitors.join(', ') || ' ' } : {}) } };
        break;
      }
      case 'prospect':
        body = { ...base, action: 'prospect', prospect_domain: a.prospectDomain, type: a.type, ...(a.status ? { status: a.status } : {}), ...(a.note !== undefined ? { note: a.note } : {}), ...(a.contactEmail ? { contact_email: a.contactEmail } : {}) };
        break;
      case 'ai_prompts':
        // G6 (2026-10-18): the panel manager, the engine's field names (AI_Prompt_Rows_Admin.js)
        body = { ...base, action: 'ai_prompts', add: a.add, remove: a.remove, enable: a.enable, pin: a.pin, unpin: a.unpin,
          edit: a.edit.map((e) => ({ prompt_id: e.promptId, ...(e.prompt ? { prompt: e.prompt } : {}), ...(e.persona !== undefined ? { persona: e.persona } : {}), ...(e.cluster !== undefined ? { cluster: e.cluster } : {}),
            ...(e.stage ? { stage: e.stage } : {}), ...(e.market ? { market: e.market } : {}), ...(e.pinned !== undefined ? { pinned: e.pinned } : {}) })) };
        break;
      case 'content_groups':
        body = { ...base, action: 'content_groups', content_groups: a.contentGroups };
        break;
    }
    const r = await siteAdmin(body);
    if (!r.ok) throw new HttpError(502, r.error || 'The SEO engine could not apply the change.', 'admin_failed');
    if (r.affected === 0 && (a.action === 'pause' || a.action === 'resume')) throw new HttpError(409, 'The SEO engine does not track this website yet: start weekly tracking first.', 'not_tracked');
    if (r.affected === 0 && a.action === 'content_groups') throw new HttpError(409, 'The SEO engine does not track this website yet: start weekly tracking first, then set its content groups.', 'not_tracked');
    if (r.affected === 0 && a.action === 'unpublish') throw notFound(`No page for "${a.keyword}" is recorded for ${site.domain}.`);
    if (r.affected === 0 && a.action === 'prospect') throw notFound(`${a.prospectDomain} is not in the link-prospect list.`);
    // mirror what the app shows about the site
    const patch: Partial<SiteRow> = {};
    // a person's pause / resume replaces the credit guard's (it never resumes what a person paused)
    if (a.action === 'pause') Object.assign(patch, { trackingStatus: 'paused', creditsPausedAt: null, creditsPausedReason: null });
    if (a.action === 'resume') Object.assign(patch, { trackingStatus: 'active', creditsPausedAt: null, creditsPausedReason: null });
    if (a.action === 'cadence') patch.blogsPerWeek = a.pagesPerWeek;
    if (a.action === 'monitors') {
      if (a.competitors) patch.competitors = a.competitors;
      if (a.monitors.brandNames) patch.brandNames = a.monitors.brandNames;
    }
    if (Object.keys(patch).length) await db.update(schema.sites).set({ ...patch, updatedAt: new Date() }).where(eq(schema.sites.id, site.id));
    invalidateSite(site.domain);
    invalidateForecast(site.orgId); // the schedules' credit forecast follows the settings
    return { ok: true, action: a.action, affected: r.affected, error: null };
  });
}
