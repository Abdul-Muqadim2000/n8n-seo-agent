import { createSign } from 'node:crypto';
import { outbound, safeError } from './netGuard';

/**
 * A Google access token for a CUSTOMER's service account (G4 BigQuery export), the JWT-bearer flow
 * (https://developers.google.com/identity/protocols/oauth2/service-account#httprest). Not the engine's own service account
 * (services/google.ts): that one reads Search Console for every company; this one writes into one company's BigQuery and nothing else.
 */

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

const cache = new Map<string, { value: string; exp: number }>();

export async function serviceAccountToken(key: ServiceAccountKey, scope: string): Promise<string> {
  const id = `${key.client_email}|${scope}`;
  const hit = cache.get(id);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.value;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  let signature: string;
  try {
    signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key.replace(/\\n/g, '\n'), 'base64url');
  } catch {
    throw new Error('The service-account key could not sign a request: paste the whole JSON key file again');
  }
  const res = await outbound({
    url: 'https://oauth2.googleapis.com/token',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString(),
    timeoutMs: 15_000,
  }).catch((err) => {
    throw new Error(`Google could not be reached: ${safeError(err)}`);
  });
  let body: { access_token?: string; expires_in?: number; error_description?: string; error?: string } = {};
  try {
    body = JSON.parse(res.text);
  } catch {
    /* not JSON */
  }
  if (res.status !== 200 || !body.access_token) throw new Error(`Google refused the service account (${body.error_description || body.error || res.status})`);
  cache.set(id, { value: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}

/** tests: forget cached tokens */
export const forgetTokens = () => cache.clear();
