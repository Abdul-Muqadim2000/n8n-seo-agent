import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { forgotSchema, loginSchema, resetSchema, signupSchema, type AuthProviders } from '@seo/shared';
import { requireUser } from '../auth/access';
import { exchangeGoogleCode, G_COOKIE, googleAuthUrl } from '../auth/google';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password';
import { clearSessionCookie, createSession, deleteSession, deleteUserSessions } from '../auth/session';
import { consumeToken, issueToken } from '../auth/tokens';
import { config } from '../config';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';
import { sha256 } from '../lib/crypto';
import { badRequest, conflict, forbidden, HttpError, parse } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { acceptInvitation } from '../services/invitations';
import { buildMe } from '../services/me';
import { verifyWithGoogle } from './sites';

const LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export async function sendVerification(user: UserRow, log: FastifyInstance['log']): Promise<boolean> {
  const token = await issueToken(user.id, 'verify_email', 60 * 24 * 3);
  return sendMail(
    {
      to: user.email,
      subject: `Confirm your e-mail for ${config.brand}`,
      lines: [`Hi ${user.name},`, 'Please confirm your e-mail address. Analyses and reports start once it is confirmed.'],
      action: { label: 'Confirm e-mail', url: `${config.appUrl}/verify-email?token=${token}` },
      footer: 'The link works for 3 days. If you did not create an account, ignore this e-mail.',
    },
    log,
  );
}

async function pendingInvitationFor(email: string) {
  return db.query.invitations.findFirst({
    where: and(eq(schema.invitations.email, email), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt), gt(schema.invitations.expiresAt, new Date())),
  });
}

export function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  // browsers treat "\" like "/" and drop tabs/newlines: "/\evil.com" or "/\t/evil.com" would leave the site
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/api/') || /[\\\u0000-\u001f\u007f]/.test(s) || s.length > 500) return '/';
  try {
    const u = new URL(s, config.appUrl);
    return u.origin === new URL(config.appUrl).origin ? u.pathname + u.search + u.hash : '/';
  } catch {
    return '/';
  }
}


export async function authRoutes(app: FastifyInstance) {
  app.get(
    '/api/auth/providers',
    async (): Promise<AuthProviders> => ({
      google: config.google.enabled,
      emailPassword: true,
      email: config.accountEmails,
      engineEmails: config.engineEmails,
      requireEmailVerification: config.requireEmailVerification,
    }),
  );

  app.post('/api/auth/signup', LIMIT, async (req, reply) => {
    const body = parse(signupSchema, req.body);
    const invitation = body.inviteToken
      ? await db.query.invitations.findFirst({
          where: and(eq(schema.invitations.tokenHash, sha256(body.inviteToken)), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt), gt(schema.invitations.expiresAt, new Date())),
        })
      : null;
    const invitedHere = !!invitation && invitation.email === body.email;
    if (!config.allowSignup && !invitedHere) throw forbidden('Sign-up is by invitation only. Open the invitation link you received to create your account.');
    const exists = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
    if (exists) throw conflict('An account with this e-mail already exists. Sign in instead.', 'email_taken');
    const [user] = await db
      .insert(schema.users)
      .values({
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        // the invitation link reached this mailbox, which confirms the address
        emailVerifiedAt: invitedHere ? new Date() : null,
      })
      .returning();
    if (invitedHere && invitation) await acceptInvitation(invitation, user);
    else void sendVerification(user, req.log).catch((err) => req.log.error({ err }, 'verification e-mail failed')); // do not make the visitor wait for SMTP
    await createSession(reply, req, user.id);
    return buildMe(user);
  });

  app.post('/api/auth/login', LIMIT, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
    if (!user || !user.passwordHash) {
      await burnPasswordCheck(body.password);
      throw new HttpError(401, user ? 'This account signs in with Google. Use "Continue with Google", or set a password with "Forgot password".' : 'Wrong e-mail or password.', 'bad_credentials');
    }
    if (!(await verifyPassword(user.passwordHash, body.password))) throw new HttpError(401, 'Wrong e-mail or password.', 'bad_credentials');
    await createSession(reply, req, user.id);
    return buildMe(user);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionId) await deleteSession(req.sessionId);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/auth/forgot', LIMIT, async (req) => {
    const { email } = parse(forgotSchema, req.body);
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (user) {
      const token = await issueToken(user.id, 'reset_password', 60);
      void sendMail(
        {
          to: user.email,
          subject: `Reset your ${config.brand} password`,
          lines: [`Hi ${user.name},`, 'Someone asked to reset the password of your account. Choose a new one with the button below.'],
          action: { label: 'Choose a new password', url: `${config.appUrl}/reset-password?token=${token}` },
          footer: 'The link works for one hour. If you did not ask for it, ignore this e-mail; your password stays the same.',
        },
        req.log,
      );
    }
    return { ok: true }; // same answer either way: no account enumeration
  });

  app.post('/api/auth/reset', LIMIT, async (req) => {
    const body = parse(resetSchema, req.body);
    const userId = await consumeToken(body.token, 'reset_password');
    if (!userId) throw badRequest('This reset link is invalid or has expired. Request a new one.');
    // the reset link reached the mailbox, which also confirms the address
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.password), emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())` }).where(eq(schema.users.id, userId));
    await deleteUserSessions(userId);
    return { ok: true };
  });

  app.post('/api/auth/verify-email', LIMIT, async (req) => {
    const token = String((req.body as { token?: unknown } | null)?.token ?? '');
    const userId = await consumeToken(token, 'verify_email');
    if (!userId) throw badRequest('This confirmation link is invalid, already used or expired.');
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
    return { ok: true };
  });

  app.post('/api/auth/resend-verification', { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req);
    if (user.emailVerifiedAt) return { ok: true, sent: false };
    return { ok: true, sent: await sendVerification(user, req.log) };
  });

  // ---------- Google ----------
  app.get('/api/auth/google', async (req, reply) => {
    if (!config.google.enabled) return reply.redirect('/login?error=google_disabled');
    const { url, state, verifier } = googleAuthUrl();
    reply.setCookie('g_state', state, G_COOKIE);
    reply.setCookie('g_verifier', verifier, G_COOKIE);
    reply.setCookie('g_next', safeNext((req.query as { next?: string }).next), G_COOKIE);
    return reply.redirect(url);
  });

  app.get('/api/auth/google/callback', async (req, reply: FastifyReply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const state = req.cookies.g_state;
    const verifier = req.cookies.g_verifier;
    const next = safeNext(req.cookies.g_next);
    const intent = req.cookies.g_intent ?? '';
    for (const c of ['g_state', 'g_verifier', 'g_next', 'g_intent']) reply.clearCookie(c, { path: G_COOKIE.path });
    // "Verify with Google": the signed-in admin's own Google account must own the domain in Search Console
    if (intent.startsWith('verify:')) {
      const [, orgId, siteId] = intent.split(':');
      const back = (code: string) => reply.redirect(`${next}${next.includes('?') ? '&' : '?'}google=${code}`);
      if (!req.user) return reply.redirect('/login');
      if (q.error || !q.code || !q.state || !state || !verifier || q.state !== state) return back('failed');
      try {
        const p = await exchangeGoogleCode(q.code, verifier);
        if (!p.accessToken) return back('failed');
        return back(await verifyWithGoogle(req, orgId, siteId, p.accessToken));
      } catch (err) {
        req.log.warn({ err: String(err) }, 'google site verification failed');
        return back('failed');
      }
    }
    const fail = (code: string) => reply.redirect(`/login?error=${code}${next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`);
    if (q.error) return fail('google_failed');
    if (!q.code || !q.state || !state || !verifier || q.state !== state) return fail('google_state');
    let profile;
    try {
      profile = await exchangeGoogleCode(q.code, verifier);
    } catch (err) {
      req.log.warn({ err: String(err) }, 'google sign-in failed');
      return fail('google_failed');
    }
    if (!profile.emailVerified) return fail('google_unverified');

    // already signed in ("Link Google account" on the account page): attach this Google login to the current user
    if (req.user) {
      const owner = await db.query.users.findFirst({ where: eq(schema.users.googleSub, profile.sub) });
      if (owner && owner.id !== req.user.id) return reply.redirect('/account?error=google_linked_elsewhere');
      await db
        .update(schema.users)
        .set({ googleSub: profile.sub, avatarUrl: req.user.avatarUrl ?? profile.picture, ...(profile.email === req.user.email && !req.user.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}) })
        .where(eq(schema.users.id, req.user.id));
      return reply.redirect('/account?linked=google');
    }

    let user = await db.query.users.findFirst({ where: eq(schema.users.googleSub, profile.sub) });
    if (!user) {
      const byEmail = await db.query.users.findFirst({ where: eq(schema.users.email, profile.email) });
      if (byEmail) {
        // same e-mail, now proven by Google. If the account was never confirmed, whoever created it may not own the address
        // (anyone can sign up with any e-mail while confirmation is off): their password and sessions are dropped.
        const unconfirmed = !byEmail.emailVerifiedAt;
        if (unconfirmed) await deleteUserSessions(byEmail.id);
        [user] = await db
          .update(schema.users)
          .set({ googleSub: profile.sub, avatarUrl: byEmail.avatarUrl ?? profile.picture, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(), ...(unconfirmed ? { passwordHash: null } : {}) })
          .where(eq(schema.users.id, byEmail.id))
          .returning();
      } else {
        if (!config.allowSignup && !(await pendingInvitationFor(profile.email))) return fail('signup_closed');
        [user] = await db
          .insert(schema.users)
          .values({ email: profile.email, name: profile.name, googleSub: profile.sub, avatarUrl: profile.picture, emailVerifiedAt: new Date() })
          .returning();
      }
    }
    await createSession(reply, req, user.id);
    return reply.redirect(next);
  });
}
