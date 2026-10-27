import { and, desc, eq, inArray } from 'drizzle-orm';
import { checkIntegration } from '../services/consistency';
import { audit } from '../services/audit';
import type { FastifyInstance } from 'fastify';
import {
  outreachItemId,
  approveSchema,
  draftDismissSchema,
  linkBuilderRunSchema,
  linkSettingsSchema,
  listingStatusSchema,
  isOauthProvider,
  mailboxOauthStartSchema,
  mailboxPatchSchema,
  mailboxSchema,
  n8nSiteId,
  sequenceOutcomeSchema,
  sequencePatchSchema,
  sequenceReplySchema,
  suppressionSchema,
  type LinkBuildingData,
  type MailboxTestResult,
  type MailProviderInfo,
  type MailboxView,
  type SuppressionView,
} from '@seo/shared';
import { orgAccess, requireVerified, siteAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import { badRequest, forbidden, HttpError, notFound, parse } from '../lib/errors';
import { secretsReady, seal, unseal } from '../lib/secretBox';
import { invalidateSite, linkBuilderRun, upsertRow } from '../n8n/client';
import { approve, linkBuildingData, linkSettingsOf, mailboxView, sequenceFor, setProspectStatus, suppress, updateSequence } from '../services/linkBuilder';
import { testMailbox } from '../services/mail';
import { exchangeMailCode, isOauthMailbox, MAIL_PROVIDERS, mailAuthUrl, mailProviderInfo, oauthProviderOf, revokeMailTokens, testOauthMailbox } from '../services/mailOauth';
import { sendManual } from '../services/outreachJobs';
import { requireClientApproval } from '../services/approvals';

// v4.13 Link Builder (n8n/seo-agent/LINK_BUILDER_SPEC.md): the company's mailboxes, a website's link-building board, approving / editing /
// pausing sequences, answering replies in the thread, opt-outs, the listings checklist and "find opportunities now".

type P = { orgId: string; siteId: string; id: string };
/** L4: the short-lived cookies of the OAuth round trip (sent to the callback path only) */
const MB_COOKIE = { path: '/api/mailbox-oauth', httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure, maxAge: 900 };
const mailboxErr = (t: Awaited<ReturnType<typeof testMailbox>>) => [!t.smtp.ok ? `Sending (SMTP) failed: ${t.smtp.error}` : '', !t.imap.ok ? `Reading replies (IMAP) failed: ${t.imap.error}` : ''].filter(Boolean).join(' · ');

export async function linkBuilderRoutes(app: FastifyInstance) {
  // ---- mailboxes (company settings; admins) ----
  app.get('/api/orgs/:orgId/mailboxes', async (req): Promise<MailboxView[]> => {
    const { org } = await orgAccess(req, (req.params as P).orgId, 'member');
    const rows = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id));
    return Promise.all(rows.map(mailboxView));
  });

  app.post('/api/orgs/:orgId/mailboxes', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req): Promise<MailboxView> => {
    const { org, user } = await orgAccess(req, (req.params as P).orgId, 'admin');
    if (!secretsReady()) throw new HttpError(503, 'Mailboxes cannot be connected yet: the server has no MAILBOX_KEY to encrypt the password.', 'no_key');
    const m = parse(mailboxSchema, req.body);
    if (m.windowStart >= m.windowEnd) throw badRequest('The sending window must end after it starts.');
    const t = await testMailbox({ ...m }, m.fromEmail);   // nothing is stored unless both logins work
    if (!t.smtp.ok || !t.imap.ok) throw badRequest(mailboxErr(t), undefined, 'mailbox_test_failed');
    const { password, ...rest } = m;
    const [row] = await db.insert(schema.mailboxes).values({ ...rest, orgId: org.id, secret: seal(password), sentFolder: t.imap.sentFolder, lastUid: Math.max(0, t.imap.uidNext - 1), uidValidity: t.imap.uidValidity, dns: t.dns as unknown as Record<string, unknown>, createdBy: user.id })
      .onConflictDoNothing().returning();
    if (!row) throw new HttpError(409, `${m.fromEmail} is already connected.`);
    await audit(req, org.id, { action: 'mailbox.connected', target: { type: 'mailbox', id: row.id, label: m.fromEmail }, details: { method: 'app password', smtpHost: m.smtpHost } });
    return mailboxView(row);
  });

  app.patch('/api/orgs/:orgId/mailboxes/:id', async (req): Promise<MailboxView> => {
    const p = req.params as P; const { org } = await orgAccess(req, p.orgId, 'admin');
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, p.id), eq(schema.mailboxes.orgId, org.id)) });
    if (!mb) throw notFound('Mailbox not found');
    const m = parse(mailboxPatchSchema, req.body);
    if ((m.windowStart ?? mb.windowStart) >= (m.windowEnd ?? mb.windowEnd)) throw badRequest('The sending window must end after it starts.');
    const oauth = isOauthMailbox(mb);   // L4: there is no password and no SMTP login to change on an OAuth mailbox
    if (oauth && (['password', 'smtpHost', 'smtpPort', 'smtpSecure', 'imapHost', 'imapPort', 'imapSecure', 'username'] as const).some((k) => m[k] !== undefined))
      throw badRequest(`${mb.fromEmail} is connected with ${MAIL_PROVIDERS[oauthProviderOf(mb)!].label}: it has no password or server settings to change. Disconnect it to connect it differently.`);
    const patch: Record<string, unknown> = { ...m }; delete patch.password; delete patch.fromEmail;
    const connChanged = !oauth && (m.password !== undefined || (['smtpHost', 'smtpPort', 'smtpSecure', 'imapHost', 'imapPort', 'imapSecure', 'username'] as const).some((k) => m[k] !== undefined && m[k] !== mb[k]));   // only a real change re-tests the login
    if (connChanged) {
      const conn = { smtpHost: m.smtpHost ?? mb.smtpHost, smtpPort: m.smtpPort ?? mb.smtpPort, smtpSecure: m.smtpSecure ?? mb.smtpSecure, imapHost: m.imapHost ?? mb.imapHost, imapPort: m.imapPort ?? mb.imapPort, imapSecure: m.imapSecure ?? mb.imapSecure, username: m.username ?? mb.username, password: m.password ?? unseal(mb.secret) };
      const t = await testMailbox(conn, mb.fromEmail);
      if (!t.smtp.ok || !t.imap.ok) throw badRequest(mailboxErr(t), undefined, 'mailbox_test_failed');
      if (m.password) patch.secret = seal(m.password);
      Object.assign(patch, { sentFolder: t.imap.sentFolder, dns: t.dns, status: mb.status === 'error' ? 'active' : mb.status, statusReason: mb.status === 'error' ? '' : mb.statusReason, lastError: '' });
    }
    const [row] = await db.update(schema.mailboxes).set({ ...patch, updatedAt: new Date() }).where(eq(schema.mailboxes.id, mb.id)).returning();
    return mailboxView(row!);
  });

  app.post('/api/orgs/:orgId/mailboxes/:id/test', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req): Promise<MailboxTestResult> => {
    const p = req.params as P; const { org } = await orgAccess(req, p.orgId, 'admin');
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, p.id), eq(schema.mailboxes.orgId, org.id)) });
    if (!mb) throw notFound('Mailbox not found');
    const t = isOauthMailbox(mb)   // L4: an OAuth mailbox is checked by renewing its permission and reading its own profile
      ? await testOauthMailbox(mb)
      : await testMailbox({ smtpHost: mb.smtpHost, smtpPort: mb.smtpPort, smtpSecure: mb.smtpSecure, imapHost: mb.imapHost, imapPort: mb.imapPort, imapSecure: mb.imapSecure, username: mb.username, password: unseal(mb.secret) }, mb.fromEmail);
    const ok = t.smtp.ok && (t.imap.ok || !mb.readsReplies);
    await db.update(schema.mailboxes).set({ dns: t.dns as unknown as Record<string, unknown>, ...(t.imap.sentFolder ? { sentFolder: t.imap.sentFolder } : {}), ...(ok && mb.status === 'error' ? { status: 'active', statusReason: '' } : {}), lastError: ok ? '' : mailboxErr(t), updatedAt: new Date() }).where(eq(schema.mailboxes.id, mb.id));
    return { ok, smtp: t.smtp, imap: { ok: t.imap.ok, error: t.imap.error }, dns: t.dns };
  });

  for (const action of ['pause', 'resume'] as const) app.post(`/api/orgs/:orgId/mailboxes/:id/${action}`, async (req) => {
    const p = { ...(req.params as P), action }; const { org } = await orgAccess(req, p.orgId, 'admin');
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, p.id), eq(schema.mailboxes.orgId, org.id)) });
    if (!mb) throw notFound('Mailbox not found');
    if (p.action === 'resume' && mb.status === 'error') throw new HttpError(409, 'Fix the connection first (test or update the password).');
    await db.update(schema.mailboxes).set({ status: p.action === 'pause' ? 'paused' : 'active', statusReason: p.action === 'pause' ? 'Paused by a person' : '', updatedAt: new Date() }).where(eq(schema.mailboxes.id, mb.id));
    return { ok: true };
  });

  app.delete('/api/orgs/:orgId/mailboxes/:id', async (req) => {
    const p = req.params as P; const { org } = await orgAccess(req, p.orgId, 'admin');
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, p.id), eq(schema.mailboxes.orgId, org.id)) });
    if (!mb) throw notFound('Mailbox not found');
    await db.update(schema.outreachSequences).set({ status: 'paused', error: 'Its mailbox was removed', updatedAt: new Date() }).where(and(eq(schema.outreachSequences.mailboxId, mb.id), inArray(schema.outreachSequences.status, ['scheduled', 'active'])));
    // L4: withdraw our access as well as forgetting the tokens; Microsoft has no revocation endpoint for this flow, so the answer says
    // where the customer removes the app themselves.
    let revoked = { ok: true, note: '' };
    const p4 = oauthProviderOf(mb);
    if (p4 && mb.oauthRefresh) {
      try { revoked = await revokeMailTokens(p4, unseal(mb.oauthRefresh)); } catch (e) { revoked = { ok: false, note: MAIL_PROVIDERS[p4].withdraw }; req.log.warn({ err: String(e) }, 'mailbox token not revoked'); }
    }
    await db.delete(schema.mailboxes).where(eq(schema.mailboxes.id, mb.id));
    await audit(req, org.id, { action: 'mailbox.removed', target: { type: 'mailbox', id: mb.id, label: mb.fromEmail }, details: { accessWithdrawn: revoked.ok } });
    return { ok: true, revoked: revoked.ok, note: revoked.note };
  });

  // ---- L4: mailboxes connected with OAuth (Microsoft 365 through Graph, Gmail for sending) ----
  // The OAuth app belongs to the owner of this installation (app/.env): with none configured the option is not offered at all, never
  // half-offered. The customer grants access on the provider's own consent screen; we store the refresh token encrypted, renew the access
  // token before it expires, and revoke what we can when the mailbox is disconnected.
  app.get('/api/orgs/:orgId/mailbox-oauth/providers', async (req): Promise<MailProviderInfo[]> => {
    await orgAccess(req, (req.params as P).orgId, 'member');
    return mailProviderInfo();
  });

  app.post('/api/orgs/:orgId/mailbox-oauth/start', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req, reply): Promise<{ url: string }> => {
    const { org } = await orgAccess(req, (req.params as P).orgId, 'admin');
    if (!secretsReady()) throw new HttpError(503, 'Mailboxes cannot be connected yet: the server has no MAILBOX_KEY to encrypt the stored permission.', 'no_key');
    const b = parse(mailboxOauthStartSchema, req.body);
    const { url, state, verifier } = mailAuthUrl(b.provider);
    reply.setCookie('mb_state', state, MB_COOKIE);
    reply.setCookie('mb_verifier', verifier, MB_COOKIE);
    reply.setCookie('mb_ctx', `${org.id}:${b.provider}:${b.label.replace(/[^\w .-]+/g, '').slice(0, 60)}`, MB_COOKIE);
    return { url };
  });

  app.get('/api/mailbox-oauth/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    const state = req.cookies.mb_state;
    const verifier = req.cookies.mb_verifier;
    const [orgId = '', provider = '', label = ''] = String(req.cookies.mb_ctx ?? '').split(':');
    for (const c of ['mb_state', 'mb_verifier', 'mb_ctx']) reply.clearCookie(c, { path: MB_COOKIE.path });
    const back = (params: string) => reply.redirect(`/o/${encodeURIComponent(orgId)}/settings/mailboxes?${params}`);
    const fail = (why: string) => back(`mailbox=error&why=${encodeURIComponent(why.slice(0, 200))}`);
    if (!req.user) return reply.redirect('/login');
    if (!orgId || !isOauthProvider(provider)) return fail('The connection did not start here: try again.');
    if (q.error) return fail(q.error_description || q.error);
    if (!q.code || !q.state || !state || !verifier || q.state !== state) return fail('The provider came back without a valid state: try again.');
    let org;
    try { ({ org } = await orgAccess(req, orgId, 'admin')); } catch { return reply.redirect('/'); }
    try {
      const t = await exchangeMailCode(provider, q.code, verifier);
      const reads = MAIL_PROVIDERS[provider].reads;
      const now = new Date();
      const common = {
        provider, label, fromEmail: t.email, username: t.email, secret: '',
        oauthRefresh: seal(t.refreshToken), oauthAccess: seal(t.accessToken), oauthExpiresAt: t.expiresAt, oauthScope: t.scope.slice(0, 400), oauthSubject: t.subject.slice(0, 120),
        readsReplies: reads, status: 'active', statusReason: '', lastError: '', smtpHost: '', imapHost: '', sentFolder: '', updatedAt: now,
      };
      const existing = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.orgId, org.id), eq(schema.mailboxes.fromEmail, t.email)) });
      if (existing) {
        await db.update(schema.mailboxes).set(common).where(eq(schema.mailboxes.id, existing.id));
      } else {
        await db.insert(schema.mailboxes).values({ ...common, orgId: org.id, fromName: t.email.split('@')[0] ?? t.email, createdBy: req.user.id, startedAt: now });
        await audit(req, org.id, { action: 'mailbox.connected', target: { type: 'mailbox', label: t.email }, details: { method: provider } });
      }
      req.log.info({ org: org.id, provider }, 'mailbox connected with OAuth');
      return back(`mailbox=connected&address=${encodeURIComponent(t.email)}${reads ? '' : '&reads=0'}`);
    } catch (e) {
      req.log.warn({ err: String(e), provider }, 'mailbox OAuth failed');
      return fail(e instanceof HttpError ? e.message : 'The provider refused the connection: try again.');
    }
  });

  // ---- opt-outs (company) ----
  app.get('/api/orgs/:orgId/suppressions', async (req): Promise<SuppressionView[]> => {
    const { org } = await orgAccess(req, (req.params as P).orgId, 'member');
    const rows = await db.select().from(schema.suppressions).where(eq(schema.suppressions.orgId, org.id)).orderBy(desc(schema.suppressions.createdAt)).limit(1000);
    return rows.map((r) => ({ id: r.id, kind: r.kind as SuppressionView['kind'], hint: r.hint, reason: r.reason, createdAt: r.createdAt.toISOString() }));
  });
  app.post('/api/orgs/:orgId/suppressions', async (req) => {
    const { org } = await orgAccess(req, (req.params as P).orgId, 'member');
    const b = parse(suppressionSchema, req.body);
    if (b.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(b.value)) throw badRequest('A valid e-mail address');
    await suppress(org.id, b.kind, b.kind === 'domain' ? b.value.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') : b.value, 'added by hand');
    return { ok: true };
  });
  app.delete('/api/orgs/:orgId/suppressions/:id', async (req) => {
    const p = req.params as P; const { org } = await orgAccess(req, p.orgId, 'admin');
    await db.delete(schema.suppressions).where(and(eq(schema.suppressions.id, p.id), eq(schema.suppressions.orgId, org.id)));
    return { ok: true };
  });

  // ---- a website's link building ----
  app.get('/api/orgs/:orgId/sites/:siteId/link-building', async (req): Promise<LinkBuildingData> => {
    const p = req.params as P; const { org, site, role } = await siteAccess(req, p.orgId, p.siteId);
    requireVerified(site);
    return linkBuildingData(org, site, role);
  });

  app.patch('/api/orgs/:orgId/sites/:siteId/link-building/settings', async (req) => {
    const p = req.params as P; const { org, site, role } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const b = parse(linkSettingsSchema, req.body);
    if (b.mode === 'auto' && role !== 'owner') throw forbidden('Only the owner can let pitches go out without approval.');
    if (b.mailboxId) {
      const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, b.mailboxId), eq(schema.mailboxes.orgId, org.id)) });
      if (!mb) throw notFound('Mailbox not found');
      // MKT I2 (2026-10-27): outreach for this website sent from an address of another website
      if (mb.id !== site.linkSettings?.mailboxId) await checkIntegration(req, { org, site }, { kind: 'mailbox', address: mb.fromEmail });
    }
    const next = { ...site.linkSettings, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) };
    await db.update(schema.sites).set({ linkSettings: next, updatedAt: new Date() }).where(eq(schema.sites.id, site.id));
    return linkSettingsOf({ ...site, linkSettings: next });
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/approve', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P; const { org, site, user } = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(site);
    const body = parse(approveSchema, req.body);
    // G5: a client workspace that approves outreach first: this draft needs the client's approval
    await requireClientApproval(org, 'outreach', outreachItemId(body.prospectDomain, body.type));
    const q = await approve(org, site, user.id, body);
    return { ok: true, id: q.id };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/dismiss', async (req) => {
    const p = req.params as P; const { site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(site);
    const b = parse(draftDismissSchema, req.body);
    await setProspectStatus(site.domain, b.prospectDomain, b.type, 'rejected', 'not a fit (marked in the app)', req.log);
    invalidateSite(site.domain);   // the board reads the prospects again: the draft disappears at once
    return { ok: true };
  });

  app.patch('/api/orgs/:orgId/sites/:siteId/link-building/sequences/:id', async (req) => {
    const p = req.params as P; const { org, site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    const q = await sequenceFor(org, site, p.id);
    const b = parse(sequencePatchSchema, req.body);
    if (b.toEmail && q.step > 0) throw new HttpError(409, 'The first e-mail went out already: the address cannot change.');
    if (!['scheduled', 'active', 'paused'].includes(q.status)) throw new HttpError(409, 'This conversation has ended.');
    const steps = b.steps ? q.steps.map((st, i) => (i < q.step ? st : (b.steps!.find((x) => x.step === i) ?? st))) : q.steps;   // sent e-mails stay as they were
    await updateSequence(q, { steps, ...(b.toEmail ? { toEmail: b.toEmail } : {}) });
    return { ok: true };
  });

  for (const action of ['pause', 'resume', 'cancel'] as const) app.post(`/api/orgs/:orgId/sites/:siteId/link-building/sequences/:id/${action}`, async (req) => {
    const p = { ...(req.params as P), action } as P & { action: 'pause' | 'resume' | 'cancel' }; const { org, site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    const q = await sequenceFor(org, site, p.id);
    if (p.action === 'pause' && ['scheduled', 'active'].includes(q.status)) await updateSequence(q, { status: 'paused' });
    else if (p.action === 'resume' && q.status === 'paused') await updateSequence(q, { status: q.step > 0 ? 'active' : 'scheduled', nextAt: q.nextAt && q.nextAt.getTime() > Date.now() ? q.nextAt : new Date() });
    else if (p.action === 'cancel' && ['scheduled', 'active', 'paused'].includes(q.status)) await updateSequence(q, { status: 'stopped', nextAt: null, error: 'Stopped by a person' });
    else throw new HttpError(409, 'Not possible in this state.');
    return { ok: true };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/sequences/:id/reply', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P; const { org, site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    const q = await sequenceFor(org, site, p.id);
    if (!q.startedAt) throw new HttpError(409, 'Nothing was sent yet.');
    try { await sendManual(q, parse(sequenceReplySchema, req.body).body, req.log); } catch (e) { throw new HttpError(502, String((e as Error).message || e)); }
    return { ok: true };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/sequences/:id/outcome', async (req) => {
    const p = req.params as P; const { org, site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    const q = await sequenceFor(org, site, p.id); const b = parse(sequenceOutcomeSchema, req.body);
    await updateSequence(q, { status: b.status === 'won' ? 'won' : 'stopped', ...(b.status === 'won' ? { wonAt: new Date() } : { error: 'Marked not a fit' }), nextAt: null });
    await setProspectStatus(site.domain, q.prospectDomain, q.prospectType, b.status, b.status === 'won' ? 'won (marked in the app; the link check confirms it)' : 'not a fit (marked in the app)', req.log);
    return { ok: true };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/listings/:id', async (req) => {
    const p = req.params as P; const { site } = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(site);
    const b = parse(listingStatusSchema, req.body);
    await upsertRow('listings', [{ columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) }, { columnName: 'listing_id', condition: 'eq', value: p.id }],
      { status: b.status, ...(b.status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}), ...(b.note !== undefined ? { note: b.note } : {}) });
    return { ok: true };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/link-building/run', { config: { rateLimit: { max: 6, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P; const { org, site } = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(site);
    const b = parse(linkBuilderRunSchema, req.body ?? {});
    const r = await linkBuilderRun({ domain: site.domain, free_only: b.freeOnly, callback_url: `${config.callbackBaseUrl}/api/hooks/n8n/${org.hookToken}`, request_id: `app-lb-${Date.now().toString(36)}` });
    if (!r.ok) throw new HttpError(502, r.error || 'The Link Builder did not start.');
    return { ok: true, requestId: r.requestId };
  });

}
