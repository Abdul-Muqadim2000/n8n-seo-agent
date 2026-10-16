/** Ownership-proof copy that names only the methods the verification panel offers (R97 / R98).
 *  "Verify with Google" exists only when Google OAuth is configured (`providers.google`); the server never accepts the
 *  service account seeing a property as proof. */
export function verifyMethods(google: boolean): string {
  return google ? 'your Google account (it must own the property in Search Console), a DNS record or a meta tag' : 'a DNS record or a meta tag';
}

/** Short form for step lists. */
export function verifyMethodsShort(google: boolean): string {
  return google ? 'Google, DNS record or meta tag' : 'DNS record or meta tag';
}

export const verifyLockedDescription = (google: boolean): string =>
  `Dashboards, tracking and site checks open once ownership is confirmed: prove it with ${verifyMethods(google)}. Connecting your Search Console data comes after that.`;
