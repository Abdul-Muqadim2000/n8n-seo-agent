import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { emailDomain, type DnsCheck, type MailProviderInfo, type OauthProvider } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { MailboxRow } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { HttpError } from '../lib/errors';
import { seal, unseal } from '../lib/secretBox';
import { dnsCheck } from './mail';

// L4 (FIX_PLAN, LINK_BUILDER_SPEC.md §2): mailboxes connected with OAuth instead of an app password.
// Microsoft is retiring basic authentication for SMTP and many IT departments forbid app passwords, so a customer can connect
//   * **Microsoft 365 through Graph**, sending (`Mail.Send`) and reading replies (`Mail.Read`), so the whole loop works; and
//   * **Gmail / Google Workspace**, sending only (`gmail.send`). Reading a Gmail inbox needs `gmail.readonly` or `https://mail.google.com/`,
//     which Google classes as **restricted**: it requires a CASA security assessment and app verification before anyone outside the test
//     users can grant it. Until that is done a Gmail OAuth mailbox sends and the replies are read in Gmail itself (the UI and app/API.md
//     say exactly this); a customer who wants replies read automatically connects Gmail with an app password or uses Microsoft 365.
// The refresh token is encrypted at rest exactly like a mailbox password (AES-256-GCM, MAILBOX_KEY, lib/secretBox.ts); the access token
// is refreshed before it expires and both are revoked when the customer disconnects the mailbox. The OAuth client id and secret come from
// the owner's own Google / Azure app (app/.env); with none set the option is not offered at all.

export interface ProviderDef {
  id: OauthProvider;
  label: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl: string;
  scopes: string[];
  /** can it read replies as well as send? */
  reads: boolean;
  /** what a customer has to do to withdraw access when we cannot revoke it ourselves */
  withdraw: string;
}

export const MAIL_PROVIDERS: Record<OauthProvider, ProviderDef> = {
  ms_graph: {
    id: 'ms_graph',
    label: 'Microsoft 365',
    authUrl: '', // filled from the tenant below
    tokenUrl: '',
    revokeUrl: '',
    scopes: ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read'],
    reads: true,
    withdraw: 'Remove this app under myaccount.microsoft.com > Privacy > Apps and services you have given access to.',
  },
  gmail_oauth: {
    id: 'gmail_oauth',
    label: 'Gmail / Google Workspace',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'],
    reads: false,
    withdraw: 'Remove this app under myaccount.google.com > Security > Third-party apps with account access.',
  },
};

const def = (p: OauthProvider): ProviderDef => {
  const d = MAIL_PROVIDERS[p];
  if (p !== 'ms_graph') return d;
  const t = config.mailOauth.microsoft.tenant || 'common';
  return { ...d, authUrl: `https://login.microsoftonline.com/${t}/oauth2/v2.0/authorize`, tokenUrl: `https://login.microsoftonline.com/${t}/oauth2/v2.0/token` };
};
const client = (p: OauthProvider) => (p === 'ms_graph' ? config.mailOauth.microsoft : config.mailOauth.gmail);
export const mailOauthEnabled = (p: OauthProvider): boolean => client(p).enabled;
export const isOauthMailbox = (m: Pick<MailboxRow, 'provider'>): boolean => m.provider === 'gmail_oauth' || m.provider === 'ms_graph';
export const oauthProviderOf = (m: Pick<MailboxRow, 'provider'>): OauthProvider | null => (isOauthMailbox(m) ? (m.provider as OauthProvider) : null);

/** What the Mailboxes tab offers: the two providers, whether this installation has the keys, and what each one can do. */
export const mailProviderInfo = (): MailProviderInfo[] =>
  (['ms_graph', 'gmail_oauth'] as OauthProvider[]).map((p) => {
    const d = def(p);
    return {
      id: p,
      label: d.label,
      enabled: mailOauthEnabled(p),
      reads: d.reads,
      note: d.reads
        ? 'Sends pitches and reads the replies, with no password stored.'
        : 'Sends pitches with no password stored. Replies are not read automatically: Google classes inbox access as a restricted scope, which needs its security review and app verification first. Read them in Gmail, or connect this mailbox with an app password instead.',
      disabledWhy: mailOauthEnabled(p)
        ? ''
        : // D-12: customer text, so no setting names or file paths (the operator's README says which settings turn it on)
          `${d.label} sign-in is not set up on this installation. Connect this mailbox with an app password, or ask your administrator to set up ${d.label} sign-in.`,
      withdraw: d.withdraw,
    };
  });

// ---- the HTTP layer, so the tests can stub every call (no live OAuth flow is ever run from here) ----
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
let httpFetch: Fetcher = (url, init) => fetch(url, init);
/** tests replace the HTTP layer; nothing else may */
export const setOauthFetch = (f: Fetcher | null) => { httpFetch = f ?? ((url, init) => fetch(url, init)); };

const form = (o: Record<string, string>) => new URLSearchParams(o);
const short = (e: unknown) => String((e as Error)?.message || e).replace(/\s+/g, ' ').slice(0, 220);

async function post<T>(url: string, body: URLSearchParams | string, headers: Record<string, string>): Promise<T> {
  const res = await httpFetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : body.toString(), signal: AbortSignal.timeout(20000) });
  const text = await res.text().catch(() => '');
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const e = (json ?? {}) as { error?: string; error_description?: string; error_codes?: number[] };
    throw new HttpError(res.status === 400 || res.status === 401 ? 400 : 502, e.error_description || e.error || `The mail provider answered ${res.status}`, 'oauth_failed');
  }
  return (json ?? {}) as T;
}

/** the claims of an id token, read from the token endpoint's own answer over TLS (as auth/google.ts does) */
function claimsOf(idToken: string): Record<string, unknown> {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new HttpError(502, 'The mail provider returned no account details', 'oauth_failed');
  return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
}
const emailOf = (c: Record<string, unknown>): string => {
  for (const k of ['email', 'preferred_username', 'upn', 'unique_name']) {
    const v = String(c[k] ?? '').trim().toLowerCase();
    if (v.includes('@')) return v;
  }
  return '';
};

export interface MailAuthStart { url: string; state: string; verifier: string }
/** Where the customer goes to grant access (authorization code + PKCE, the provider's own consent screen). */
export function mailAuthUrl(p: OauthProvider): MailAuthStart {
  if (!mailOauthEnabled(p)) throw new HttpError(503, mailProviderInfo().find((x) => x.id === p)?.disabledWhy ?? 'This provider is not configured', 'oauth_not_configured');
  const d = def(p);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const params = form({
    client_id: client(p).clientId,
    redirect_uri: config.mailOauth.redirectUri,
    response_type: 'code',
    scope: d.scopes.join(' '),
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'consent',
    ...(p === 'gmail_oauth' ? { access_type: 'offline', include_granted_scopes: 'true' } : {}),
  });
  return { url: `${d.authUrl}?${params}`, state, verifier };
}

export interface MailTokens { accessToken: string; refreshToken: string; expiresAt: Date; scope: string; email: string; subject: string }
interface TokenAnswer { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string }

const tokensFrom = (p: OauthProvider, a: TokenAnswer, previousRefresh = ''): MailTokens => {
  const claims = a.id_token ? claimsOf(a.id_token) : {};
  if (!a.access_token) throw new HttpError(502, 'The mail provider returned no access token', 'oauth_failed');
  return {
    accessToken: a.access_token,
    refreshToken: a.refresh_token || previousRefresh,
    expiresAt: new Date(Date.now() + Math.max(60, Number(a.expires_in) || 3600) * 1000),
    scope: String(a.scope ?? def(p).scopes.join(' ')),
    email: emailOf(claims),
    subject: String(claims.sub ?? claims.oid ?? ''),
  };
};

export async function exchangeMailCode(p: OauthProvider, code: string, verifier: string): Promise<MailTokens> {
  const a = await post<TokenAnswer>(def(p).tokenUrl, form({
    code, client_id: client(p).clientId, client_secret: client(p).clientSecret, redirect_uri: config.mailOauth.redirectUri, grant_type: 'authorization_code', code_verifier: verifier,
  }), { 'content-type': 'application/x-www-form-urlencoded' });
  const t = tokensFrom(p, a);
  if (!t.refreshToken) throw new HttpError(400, 'The mail provider gave no long-lived permission (no refresh token): grant access again and allow offline access.', 'oauth_no_refresh');
  if (!t.email) throw new HttpError(400, 'The mail provider did not say which address was connected.', 'oauth_no_email');
  return t;
}

export async function refreshMailTokens(p: OauthProvider, refreshToken: string): Promise<MailTokens> {
  const a = await post<TokenAnswer>(def(p).tokenUrl, form({
    refresh_token: refreshToken, client_id: client(p).clientId, client_secret: client(p).clientSecret, grant_type: 'refresh_token',
    ...(p === 'ms_graph' ? { scope: def(p).scopes.join(' ') } : {}),
  }), { 'content-type': 'application/x-www-form-urlencoded' });
  return tokensFrom(p, a, refreshToken);
}

/** Withdraw our access when the customer disconnects the mailbox. Microsoft has no token-revocation endpoint for this flow, so the
 *  tokens are deleted here and the customer is told where to remove the app (`withdraw`). A failure never blocks the disconnect. */
export async function revokeMailTokens(p: OauthProvider, refreshToken: string): Promise<{ ok: boolean; note: string }> {
  const d = def(p);
  if (!d.revokeUrl || !refreshToken) return { ok: false, note: d.withdraw };
  try {
    await post(d.revokeUrl, form({ token: refreshToken, client_id: client(p).clientId }), { 'content-type': 'application/x-www-form-urlencoded' });
    return { ok: true, note: '' };
  } catch {
    return { ok: false, note: d.withdraw };
  }
}

const SKEW_MS = 120_000;   // refresh this long before the access token expires
/** A usable access token for this mailbox: the stored one while it lasts, otherwise refreshed and stored. */
export async function accessTokenFor(mb: MailboxRow): Promise<string> {
  const p = oauthProviderOf(mb);
  if (!p) throw new Error('not an OAuth mailbox');
  if (mb.oauthAccess && mb.oauthExpiresAt && mb.oauthExpiresAt.getTime() - Date.now() > SKEW_MS) {
    try { return unseal(mb.oauthAccess); } catch { /* unreadable: refresh below */ }
  }
  if (!mb.oauthRefresh) throw new HttpError(409, 'This mailbox has no stored permission any more: connect it again.', 'oauth_reconnect');
  let t: MailTokens;
  try {
    t = await refreshMailTokens(p, unseal(mb.oauthRefresh));
  } catch (e) {
    const why = short(e);
    await db.update(schema.mailboxes).set({ status: 'error', statusReason: `${def(p).label} withdrew our access (${why}): connect the mailbox again.`, lastError: why, updatedAt: new Date() }).where(eq(schema.mailboxes.id, mb.id));
    throw e;
  }
  await db.update(schema.mailboxes).set({
    oauthAccess: seal(t.accessToken), oauthExpiresAt: t.expiresAt, ...(t.refreshToken ? { oauthRefresh: seal(t.refreshToken) } : {}),
    ...(mb.status === 'error' ? { status: 'active', statusReason: '' } : {}), lastError: '', updatedAt: new Date(),
  }).where(eq(schema.mailboxes.id, mb.id));
  mb.oauthAccess = seal(t.accessToken); mb.oauthExpiresAt = t.expiresAt;
  return t.accessToken;
}

async function api<T>(mb: MailboxRow, url: string, init: RequestInit & { raw?: string } = {}): Promise<T> {
  const token = await accessTokenFor(mb);
  const res = await httpFetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(30000) });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const e = (() => { try { return JSON.parse(text) as { error?: { message?: string } | string }; } catch { return {}; } })();
    const msg = typeof e.error === 'string' ? e.error : e.error?.message || `${res.status}`;
    throw new HttpError(res.status === 401 || res.status === 403 ? 409 : 502, `The mail provider refused the request (${msg})`, 'oauth_api_failed');
  }
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

/** Sends one already-composed MIME message through the provider's API. Both providers keep their own copy in Sent. */
export async function sendRawViaApi(mb: MailboxRow, raw: Buffer, fallbackMessageId: string): Promise<string> {
  const p = oauthProviderOf(mb);
  if (!p) throw new Error('not an OAuth mailbox');
  if (p === 'gmail_oauth') {
    const r = await api<{ id?: string }>(mb, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw: raw.toString('base64url') }),
    });
    return fallbackMessageId || String(r.id ?? '');
  }
  await api(mb, 'https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: raw.toString('base64') });
  return fallbackMessageId;
}

export interface ApiMessage { id: string; receivedAt: string; mime: Buffer }
/** New inbox messages since the stored cursor (Microsoft Graph only; Gmail reading needs the restricted scope). */
export async function inboxViaApi(mb: MailboxRow, max = 25): Promise<{ messages: ApiMessage[]; cursor: string }> {
  const p = oauthProviderOf(mb);
  if (p !== 'ms_graph') return { messages: [], cursor: mb.oauthCursor };
  const since = mb.oauthCursor || new Date(Date.now() - 2 * 864e5).toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$select=id,receivedDateTime&$orderby=receivedDateTime%20asc&$top=${Math.min(50, max)}&$filter=receivedDateTime%20gt%20${encodeURIComponent(since)}`;
  const list = await api<{ value?: { id?: string; receivedDateTime?: string }[] }>(mb, url);
  const out: ApiMessage[] = [];
  let cursor = since;
  for (const m of list.value ?? []) {
    if (!m.id) continue;
    const mime = await api<string>(mb, `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(m.id)}/$value`);
    out.push({ id: m.id, receivedAt: String(m.receivedDateTime ?? ''), mime: Buffer.from(String(mime), 'utf8') });
    if (m.receivedDateTime && String(m.receivedDateTime) > cursor) cursor = String(m.receivedDateTime);
  }
  return { messages: out, cursor };
}

export interface OauthTest { smtp: { ok: boolean; error: string }; imap: { ok: boolean; error: string; sentFolder: string; uidNext: number; uidValidity: string }; dns: DnsCheck }
/** Checks the stored permission without sending anything: the token is refreshed and the mailbox's own profile is read. */
export async function testOauthMailbox(mb: MailboxRow): Promise<OauthTest> {
  const p = oauthProviderOf(mb);
  const d = p ? def(p) : null;
  const smtp = { ok: false, error: '' };
  try {
    await api(mb, p === 'gmail_oauth' ? 'https://gmail.googleapis.com/gmail/v1/users/me/profile' : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName');
    smtp.ok = true;
  } catch (e) { smtp.error = short(e); }
  return {
    smtp,
    imap: d?.reads
      ? { ok: smtp.ok, error: smtp.error, sentFolder: '', uidNext: 0, uidValidity: '' }
      : { ok: false, error: 'Replies are not read automatically for this provider (Google classes inbox access as a restricted scope).', sentFolder: '', uidNext: 0, uidValidity: '' },
    dns: await dnsCheck(emailDomain(mb.fromEmail)),
  };
}
