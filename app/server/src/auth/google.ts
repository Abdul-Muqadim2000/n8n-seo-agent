import { createHash } from 'node:crypto';
import { config } from '../config';
import { randomToken } from '../lib/crypto';

// "Sign in with Google": OAuth 2.0 authorization-code flow with PKCE and a state value, as Google documents for web servers.
// The ID token comes straight from Google's token endpoint over TLS (server to server, authenticated with the client secret), so its
// claims are checked (issuer, audience, expiry, verified e-mail) without fetching Google's signing keys.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** short-lived cookies of the OAuth round trip (state, PKCE verifier, where to return, what for) */
export const G_COOKIE = { path: '/api/auth/google', httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure, maxAge: 600 };

export interface GoogleStart {
  url: string;
  state: string;
  verifier: string;
}

/** `searchConsole`: also ask for read-only Search Console access (domain verification: is this person an owner of the property?). */
export function googleAuthUrl(opts: { searchConsole?: boolean } = {}): GoogleStart {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: opts.searchConsole ? 'openid email profile https://www.googleapis.com/auth/webmasters.readonly' : 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: opts.searchConsole ? 'consent select_account' : 'select_account',
    access_type: 'online',
  });
  return { url: `${AUTH_URL}?${params}`, state, verifier };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export async function exchangeGoogleCode(code: string, verifier: string): Promise<GoogleProfile & { accessToken: string | null }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.id_token) throw new Error(body.error_description || body.error || `Google token exchange failed (${res.status})`);
  const parts = body.id_token.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss))) throw new Error('Unexpected token issuer');
  if (claims.aud !== config.google.clientId) throw new Error('Token was issued for another client');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now() - 60_000) throw new Error('Token expired');
  if (!claims.sub || !claims.email) throw new Error('Google did not return an e-mail address');
  return {
    sub: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: String(claims.name || claims.given_name || String(claims.email).split('@')[0]),
    picture: typeof claims.picture === 'string' ? claims.picture : null,
    accessToken: body.access_token ?? null,
  };
}
