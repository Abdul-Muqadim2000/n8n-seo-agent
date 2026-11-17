// CR17-B (client report 2026-11-17, C1): the version of the Terms and Privacy Policy a person agrees to, and how the app names them.
// One constant: the legal pages' "updated" date (web/src/marketing/components/company/legal.ts shows the same date). When the texts
// change, change it here: users.terms_version then tells who agreed to which version, and Me.user.termsAccepted turns false for
// everyone on an older one, so a later release can ask them again (no forced prompt today: the texts are still drafts).

export const LEGAL_VERSION = '2026-10-08';

/** the public pages (the marketing site and the app share one deployment, so these paths work on every host) */
export const LEGAL_PATHS = { privacy: '/privacy', terms: '/terms' } as const;

/** `base` is a site origin (config.appUrl on the server); a trailing slash is fine */
export function legalUrl(base: string, page: keyof typeof LEGAL_PATHS): string {
  return `${String(base).replace(/\/+$/, '')}${LEGAL_PATHS[page]}`;
}

/** the person agreed to the CURRENT version */
export function termsAccepted(version: string | null | undefined): boolean {
  return !!version && version === LEGAL_VERSION;
}

export const TERMS_REQUIRED_MESSAGE = 'Tick the box to agree to the Terms and the Privacy Policy.';

/** what deleting one's own account does, read before the person confirms (GET /api/me/deletion) */
export interface AccountDeletionCompany {
  id: string;
  name: string;
  slug: string;
}
export interface AccountDeletionPlan {
  /** false while one of the `blocking` lists is not empty, or for a platform administrator */
  canDelete: boolean;
  /** companies the person is the only owner of while others are members: make another member owner, or delete the company, first */
  soleOwnerOf: AccountDeletionCompany[];
  /** agencies only this person belongs to that still have client workspaces: delete those first */
  agencyWithClients: AccountDeletionCompany[];
  /** companies only this person belongs to: deleted with the account (their websites, runs, reports and the SEO engine's history) */
  deletes: (AccountDeletionCompany & { websites: number })[];
  /** companies the person leaves; the company and its other members stay */
  leaves: AccountDeletionCompany[];
  /** platform administrators are removed from the administrator list first */
  platformAdmin: boolean;
}

/** the reasons a self-deletion is refused (409 codes) */
export const ACCOUNT_DELETE_CODES = { soleOwner: 'sole_owner', agencyHasClients: 'agency_has_clients', platformAdmin: 'platform_admin' } as const;
