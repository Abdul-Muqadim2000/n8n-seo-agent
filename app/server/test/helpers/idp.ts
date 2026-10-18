import { createHash, randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { generate } from 'selfsigned';
import { SignedXml } from 'xml-crypto';

/**
 * G1: identity providers for the SSO tests — no real IdP is available. An OIDC issuer (discovery, JWKS, a token endpoint that checks
 * the client secret and PKCE and signs ID tokens with its own RS256 key) answering through `ssoDeps.fetch`, and a SAML IdP with a
 * freshly generated key and self-signed certificate that signs assertions the way Okta / Entra ID do (enveloped, exc-c14n,
 * RSA-SHA256).
 */

// ------------------------------------------------------------------ OIDC

export interface OidcUser {
  sub: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

export class MockOidcIssuer {
  issuer = 'https://idp.example-okta.test';
  clientId = 'ascentra-client';
  clientSecret = 'client-secret-for-tests-only';
  private key!: { publicKey: CryptoKey; privateKey: CryptoKey };
  private kid = 'k1';
  private codes = new Map<string, { user: OidcUser; nonce: string; challenge: string; redirectUri: string }>();
  /** what the next ID token gets wrong, for the failure tests */
  tamper: { nonce?: string; aud?: string; iss?: string; expSeconds?: number } = {};
  requests: string[] = [];

  async init() {
    this.key = await generateKeyPair('RS256');
    return this;
  }

  /** the IdP's login page: the person signs in; returns the callback query the browser is sent back with */
  authorize(authUrl: string, user: OidcUser): { code: string; state: string } {
    const u = new URL(authUrl);
    if (!u.href.startsWith(`${this.issuer}/authorize`)) throw new Error(`not our authorize endpoint: ${u.href}`);
    if (u.searchParams.get('client_id') !== this.clientId) throw new Error('wrong client');
    if (u.searchParams.get('code_challenge_method') !== 'S256') throw new Error('no PKCE');
    const code = randomBytes(12).toString('hex');
    this.codes.set(code, { user, nonce: u.searchParams.get('nonce')!, challenge: u.searchParams.get('code_challenge')!, redirectUri: u.searchParams.get('redirect_uri')! });
    return { code, state: u.searchParams.get('state')! };
  }

  fetch = async (url: string, init: { method?: string; headers?: Record<string, string> | Headers; body?: unknown } = {}): Promise<Response> => {
    this.requests.push(url);
    const u = new URL(url);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    if (u.origin !== this.issuer) throw new Error(`unexpected host ${u.origin}`);
    if (u.pathname === '/.well-known/openid-configuration')
      return json({
        issuer: this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        code_challenge_methods_supported: ['S256'],
      });
    if (u.pathname === '/jwks') return json({ keys: [{ ...(await exportJWK(this.key.publicKey)), kid: this.kid, use: 'sig', alg: 'RS256' }] });
    if (u.pathname === '/token' && init.method === 'POST') {
      const h = init.headers instanceof Headers ? Object.fromEntries(init.headers) : (init.headers ?? {});
      const auth = Object.entries(h).find(([k]) => k.toLowerCase() === 'authorization')?.[1] ?? '';
      const [id, secret] = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString().split(':').map(decodeURIComponent);
      if (id !== this.clientId || secret !== this.clientSecret) return json({ error: 'invalid_client' }, 401);
      const body = new URLSearchParams(typeof init.body === 'string' ? init.body : String(init.body));
      const c = this.codes.get(body.get('code') ?? '');
      if (!c) return json({ error: 'invalid_grant' }, 400);
      this.codes.delete(body.get('code')!);
      const verifier = body.get('code_verifier') ?? '';
      if (createHash('sha256').update(verifier).digest('base64url') !== c.challenge) return json({ error: 'invalid_grant', error_description: 'PKCE' }, 400);
      if (body.get('redirect_uri') !== c.redirectUri) return json({ error: 'invalid_grant' }, 400);
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({ ...c.user, nonce: this.tamper.nonce ?? c.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: this.kid })
        .setIssuer(this.tamper.iss ?? this.issuer)
        .setAudience(this.tamper.aud ?? this.clientId)
        .setSubject(c.user.sub)
        .setIssuedAt(now)
        .setExpirationTime(now + (this.tamper.expSeconds ?? 300))
        .sign(this.key.privateKey);
      return json({ access_token: randomBytes(16).toString('hex'), token_type: 'Bearer', expires_in: 300, id_token: idToken });
    }
    return json({ error: 'not_found' }, 404);
  };
}

// ------------------------------------------------------------------ SAML

export class MockSamlIdp {
  entityId = 'http://www.okta.test/exk1fakeidp';
  ssoUrl = 'https://northwind.okta.test/app/ascentra/sso/saml';
  cert = '';
  privateKey = '';

  async init() {
    const pems = await generate([{ name: 'commonName', value: 'northwind.okta.test' }], { keySize: 2048, notAfterDate: new Date(Date.now() + 30 * 864e5), algorithm: 'sha256' });
    this.cert = pems.cert;
    this.privateKey = pems.private;
    return this;
  }

  /** the AuthnRequest id inside the redirect our SP sent the browser to */
  static requestOf(redirectUrl: string): { id: string; relayState: string; destination: string } {
    const u = new URL(redirectUrl);
    const xml = inflateRawSync(Buffer.from(u.searchParams.get('SAMLRequest')!, 'base64')).toString();
    return { id: xml.match(/\sID="([^"]+)"/)![1], relayState: u.searchParams.get('RelayState')!, destination: `${u.origin}${u.pathname}` };
  }

  /** a signed SAML Response for the SP; every field can be bent for the failure tests */
  response(o: {
    inResponseTo?: string | null;
    acs: string;
    audience: string;
    email: string;
    name?: string;
    issuer?: string;
    recipient?: string;
    notOnOrAfterMin?: number;
    assertionId?: string;
    signWith?: string;
    tamper?: (signedXml: string) => string;
  }): string {
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const until = iso(now + (o.notOnOrAfterMin ?? 5) * 60_000);
    const aid = o.assertionId ?? `_a${randomBytes(10).toString('hex')}`;
    const irt = o.inResponseTo ? ` InResponseTo="${o.inResponseTo}"` : '';
    const issuer = o.issuer ?? this.entityId;
    const assertion =
      `<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" ID="${aid}" IssueInstant="${iso(now)}" Version="2.0">` +
      `<saml2:Issuer>${issuer}</saml2:Issuer>` +
      `<saml2:Subject><saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${o.email}</saml2:NameID>` +
      `<saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml2:SubjectConfirmationData NotOnOrAfter="${until}" Recipient="${o.recipient ?? o.acs}"${irt}/></saml2:SubjectConfirmation></saml2:Subject>` +
      `<saml2:Conditions NotBefore="${iso(now - 60_000)}" NotOnOrAfter="${until}"><saml2:AudienceRestriction><saml2:Audience>${o.audience}</saml2:Audience></saml2:AudienceRestriction></saml2:Conditions>` +
      `<saml2:AuthnStatement AuthnInstant="${iso(now)}" SessionIndex="${aid}"><saml2:AuthnContext><saml2:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml2:AuthnContextClassRef></saml2:AuthnContext></saml2:AuthnStatement>` +
      `<saml2:AttributeStatement><saml2:Attribute Name="email"><saml2:AttributeValue>${o.email}</saml2:AttributeValue></saml2:Attribute>` +
      `<saml2:Attribute Name="displayName"><saml2:AttributeValue>${o.name ?? 'Dana Doe'}</saml2:AttributeValue></saml2:Attribute></saml2:AttributeStatement>` +
      `</saml2:Assertion>`;
    const xml =
      `<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" Destination="${o.acs}" ID="_r${randomBytes(10).toString('hex')}"${irt} IssueInstant="${iso(now)}" Version="2.0">` +
      `<saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml2:Issuer>` +
      `<saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>${assertion}</saml2p:Response>`;
    const sig = new SignedXml({
      privateKey: o.signWith ?? this.privateKey,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    });
    sig.addReference({
      xpath: "//*[local-name(.)='Assertion']",
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    });
    sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']", action: 'after' } });
    const signed = sig.getSignedXml();
    return Buffer.from(o.tamper ? o.tamper(signed) : signed).toString('base64');
  }
}
