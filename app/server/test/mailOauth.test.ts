import { beforeEach, describe, expect, it, vi } from 'vitest';

// L4 (FIX_PLAN): mailboxes connected with OAuth. No live flow is ever run here — the HTTP layer is stubbed, so this checks the token
// refresh, the revoke, the provider branch (Gmail messages.send vs Microsoft Graph sendMail) and what is offered when the installation
// has no OAuth app of its own.
const env = vi.hoisted(() => {
  process.env.MAILBOX_KEY = 'a'.repeat(64);
  process.env.APP_URL = 'https://app.example.com';
  process.env.GMAIL_OAUTH_CLIENT_ID = 'gmail-client';
  process.env.GMAIL_OAUTH_CLIENT_SECRET = 'gmail-secret';
  process.env.MS_OAUTH_CLIENT_ID = 'ms-client';
  process.env.MS_OAUTH_CLIENT_SECRET = 'ms-secret';
  process.env.MS_OAUTH_TENANT = 'contoso';
  return {};
});
void env;

const saved = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('../src/db', () => ({
  db: { update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => { saved.rows.push(v); } }) }) },
  schema: { mailboxes: { id: 'id' } },
}));

// the DNS check of the sending domain is the password mailbox's own test (server/test/mail.test.ts): no lookup is made here
vi.mock('../src/services/mail', async (orig) => ({
  ...(await orig<typeof import('../src/services/mail')>()),
  dnsCheck: async () => ({ spf: 'pass' as const, dmarc: 'pass' as const, dkim: 'found' as const, checkedAt: '2026-10-13T00:00:00.000Z', notes: [] }),
}));

const { accessTokenFor, exchangeMailCode, inboxViaApi, isOauthMailbox, mailAuthUrl, mailProviderInfo, refreshMailTokens, revokeMailTokens, sendRawViaApi, setOauthFetch, testOauthMailbox } = await import('../src/services/mailOauth');
const { seal } = await import('../src/lib/secretBox');
type MailboxRow = import('../src/db/schema').MailboxRow;

const idToken = (claims: Record<string, unknown>) =>
  ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'y'].join('.');

interface Call { url: string; init: RequestInit & { body?: unknown } }
let calls: Call[] = [];
let answers: { status?: number; body?: unknown }[] = [];
const stub = () =>
  setOauthFetch(async (url, init) => {
    calls.push({ url: String(url), init: (init ?? {}) as Call['init'] });
    const a = answers.shift() ?? { body: {} };
    const text = typeof a.body === 'string' ? a.body : JSON.stringify(a.body ?? {});
    return new Response(text, { status: a.status ?? 200, headers: { 'content-type': 'application/json' } });
  });

const mailbox = (o: Partial<MailboxRow> = {}): MailboxRow =>
  ({
    id: 'mb-1', orgId: 'org-1', fromEmail: 'sara@techand.ai', fromName: 'Sara Khan', provider: 'ms_graph', secret: '',
    oauthRefresh: seal('refresh-1'), oauthAccess: seal('access-1'), oauthExpiresAt: new Date(Date.now() + 3600_000), oauthScope: '', oauthSubject: 'sub-1', oauthCursor: '',
    readsReplies: true, status: 'active', statusReason: '', lastError: '', smtpHost: '', imapHost: '', sentFolder: '',
    ...o,
  }) as unknown as MailboxRow;

beforeEach(() => { calls = []; answers = []; saved.rows = []; stub(); });

describe('what this installation offers (L4)', () => {
  it('both providers are offered when the keys are set, and each says plainly what it can do', () => {
    const info = mailProviderInfo();
    expect(info.map((p) => [p.id, p.enabled, p.reads])).toEqual([['ms_graph', true, true], ['gmail_oauth', true, false]]);
    expect(info.find((p) => p.id === 'gmail_oauth')!.note).toMatch(/Replies are not read automatically/);
    expect(info.find((p) => p.id === 'gmail_oauth')!.note).toMatch(/restricted scope/);
    expect(info.every((p) => p.disabledWhy === '')).toBe(true);
  });

  it('the consent URL is the provider\'s own, with PKCE, the tenant and the scopes the feature needs', () => {
    const ms = mailAuthUrl('ms_graph');
    expect(ms.url.startsWith('https://login.microsoftonline.com/contoso/oauth2/v2.0/authorize?')).toBe(true);
    expect(ms.url).toContain('code_challenge_method=S256');
    expect(ms.url).toContain(encodeURIComponent('https://graph.microsoft.com/Mail.Send'));
    expect(ms.url).toContain(encodeURIComponent('https://graph.microsoft.com/Mail.Read'));
    expect(ms.url).toContain(encodeURIComponent('https://app.example.com/api/mailbox-oauth/callback'));
    expect(ms.verifier.length).toBeGreaterThan(20);
    const g = mailAuthUrl('gmail_oauth');
    expect(g.url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.send'));
    expect(g.url).not.toContain('gmail.readonly');   // the restricted scope is never asked for
    expect(g.url).toContain('access_type=offline');
  });

  it('a provider with no OAuth app is not offered at all, with the reason and what to do instead', async () => {
    vi.resetModules();
    process.env.MS_OAUTH_CLIENT_ID = ''; process.env.MS_OAUTH_CLIENT_SECRET = '';
    const m = await import('../src/services/mailOauth');
    const ms = m.mailProviderInfo().find((p) => p.id === 'ms_graph')!;
    expect(ms.enabled).toBe(false);
    // D-12 (re-rating 2026-10-17): customer text names no setting or file ("MS_OAUTH_CLIENT_ID … in app/.env" was shown on the tab)
    expect(ms.disabledWhy).toMatch(/Microsoft 365 sign-in is not set up on this installation/);
    expect(ms.disabledWhy).not.toMatch(/MS_OAUTH|CLIENT_ID|SECRET|\.env/);
    expect(ms.disabledWhy).toMatch(/app password/);
    expect(() => m.mailAuthUrl('ms_graph')).toThrow(/not set up/);
    process.env.MS_OAUTH_CLIENT_ID = 'ms-client'; process.env.MS_OAUTH_CLIENT_SECRET = 'ms-secret';
    vi.resetModules();
  });
});

describe('the tokens (L4)', () => {
  it('the code is exchanged for a refresh token and the address it was granted for', async () => {
    answers = [{ body: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'Mail.Send Mail.Read', id_token: idToken({ sub: 'oid-1', email: 'SARA@techand.ai' }) } }];
    const t = await exchangeMailCode('ms_graph', 'code-1', 'verifier-1');
    expect(t).toMatchObject({ accessToken: 'at-1', refreshToken: 'rt-1', email: 'sara@techand.ai', subject: 'oid-1' });
    expect(t.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(String(calls[0]!.init.body)).toContain('grant_type=authorization_code');
    expect(String(calls[0]!.init.body)).toContain('code_verifier=verifier-1');
  });

  it('a grant without a refresh token is refused: there would be nothing to send with tomorrow', async () => {
    answers = [{ body: { access_token: 'at-1', expires_in: 3600, id_token: idToken({ email: 'a@b.com' }) } }];
    await expect(exchangeMailCode('gmail_oauth', 'c', 'v')).rejects.toThrow(/offline access/i);
  });

  it('a stored access token is reused while it lasts, and refreshed before it expires', async () => {
    const live = await accessTokenFor(mailbox());
    expect(live).toBe('access-1');
    expect(calls.length).toBe(0);   // nothing asked of the provider
    answers = [{ body: { access_token: 'at-2', expires_in: 3600, id_token: idToken({ email: 'sara@techand.ai' }) } }];
    const soon = await accessTokenFor(mailbox({ oauthExpiresAt: new Date(Date.now() + 30_000) }));
    expect(soon).toBe('at-2');
    expect(String(calls[0]!.init.body)).toContain('grant_type=refresh_token');
    expect(saved.rows[0]!.oauthAccess).toBeTruthy();
    expect(String(saved.rows[0]!.oauthAccess)).not.toContain('at-2');   // stored encrypted, never in the clear
    expect(saved.rows[0]!.oauthExpiresAt).toBeInstanceOf(Date);
  });

  it('a withdrawn permission stops the mailbox with the reason, instead of failing every send silently', async () => {
    answers = [{ status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }];
    await expect(accessTokenFor(mailbox({ oauthExpiresAt: new Date(Date.now() - 1000) }))).rejects.toThrow(/expired or revoked/);
    expect(saved.rows[0]).toMatchObject({ status: 'error' });
    expect(String(saved.rows[0]!.statusReason)).toMatch(/connect the mailbox again/);
  });

  it('disconnecting revokes what the provider lets us revoke, and says where to withdraw the rest by hand', async () => {
    answers = [{ body: {} }];
    const g = await revokeMailTokens('gmail_oauth', 'rt-1');
    expect(g.ok).toBe(true);
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(calls[0]!.init.body)).toContain('token=rt-1');
    const ms = await revokeMailTokens('ms_graph', 'rt-1');   // Microsoft has no revocation endpoint for this flow
    expect(ms.ok).toBe(false);
    expect(ms.note).toMatch(/myaccount\.microsoft\.com/);
    answers = [{ status: 400, body: { error: 'invalid_token' } }];
    expect((await revokeMailTokens('gmail_oauth', 'rt-1')).note).toMatch(/myaccount\.google\.com/);   // a failed revoke never blocks the disconnect
  });

  it('the refresh keeps the old refresh token when the provider sends none back', async () => {
    answers = [{ body: { access_token: 'at-3', expires_in: 900, id_token: idToken({ email: 'sara@techand.ai' }) } }];
    const t = await refreshMailTokens('gmail_oauth', 'rt-old');
    expect(t.refreshToken).toBe('rt-old');
  });
});

describe('sending and reading through the provider (L4)', () => {
  const raw = Buffer.from('From: sara@techand.ai\r\nSubject: A dead link in your guide\r\n\r\nHello', 'utf8');

  it('Gmail: the message goes to messages.send as base64url, and our own Message-ID is kept for threading', async () => {
    answers = [{ body: { id: 'gmail-1', threadId: 't1' } }];
    const mid = await sendRawViaApi(mailbox({ provider: 'gmail_oauth', readsReplies: false }), raw, '<lb.1.0.abc@techand.ai>');
    expect(mid).toBe('<lb.1.0.abc@techand.ai>');
    expect(calls[0]!.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(JSON.parse(String(calls[0]!.init.body)).raw).toBe(raw.toString('base64url'));
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer access-1');
  });

  it('Microsoft 365: the same MIME message goes to Graph sendMail as base64 text', async () => {
    answers = [{ body: '' }];
    await sendRawViaApi(mailbox(), raw, '<lb.1.0.abc@techand.ai>');
    expect(calls[0]!.url).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
    expect((calls[0]!.init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    expect(String(calls[0]!.init.body)).toBe(raw.toString('base64'));
  });

  it('Microsoft 365: only messages newer than the stored cursor are read, and the cursor moves to the newest one', async () => {
    answers = [
      { body: { value: [{ id: 'm1', receivedDateTime: '2026-10-13T08:00:00Z' }, { id: 'm2', receivedDateTime: '2026-10-13T09:00:00Z' }] } },
      { body: 'From: a@b.com\r\nSubject: Re: x\r\n\r\nyes' },
      { body: 'From: c@d.com\r\nSubject: Re: y\r\n\r\nno' },
    ];
    const r = await inboxViaApi(mailbox({ oauthCursor: '2026-10-13T07:00:00Z' }));
    expect(r.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(r.cursor).toBe('2026-10-13T09:00:00Z');
    expect(calls[0]!.url).toContain(encodeURIComponent('2026-10-13T07:00:00Z'));
    expect(calls[1]!.url).toBe('https://graph.microsoft.com/v1.0/me/messages/m1/$value');
  });

  it('a Gmail mailbox is never read: Google classes inbox access as restricted, so nothing is asked of it', async () => {
    const r = await inboxViaApi(mailbox({ provider: 'gmail_oauth', readsReplies: false, oauthCursor: 'x' }));
    expect(r).toEqual({ messages: [], cursor: 'x' });
    expect(calls.length).toBe(0);
  });

  it('the connection test sends nothing: it reads the mailbox\'s own profile, and says plainly that Gmail replies are not read', async () => {
    answers = [{ body: { emailAddress: 'sara@techand.ai' } }];
    const t = await testOauthMailbox(mailbox({ provider: 'gmail_oauth', readsReplies: false }));
    expect(calls[0]!.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile');
    expect(t.smtp.ok).toBe(true);
    expect(t.imap.ok).toBe(false);
    expect(t.imap.error).toMatch(/restricted scope/);
    expect(isOauthMailbox(mailbox({ provider: 'smtp' }))).toBe(false);
  });

  it('a provider that refuses the token is reported as a connection problem, not as a lost e-mail', async () => {
    answers = [{ status: 401, body: { error: { message: 'InvalidAuthenticationToken' } } }];
    await expect(sendRawViaApi(mailbox(), raw, '<m@x>')).rejects.toThrow(/refused the request/);
  });
});
