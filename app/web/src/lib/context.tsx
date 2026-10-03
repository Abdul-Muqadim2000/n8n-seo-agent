import { createContext, useContext } from 'react';
import { roleAtLeast, type Me, type Org, type Role, type Site } from '@seo/shared';

export interface OrgContextValue {
  me: Me;
  org: Org;
  role: Role;
  sites: Site[];
  /** the signed-in user has at least this role in the company */
  can: (min: Role) => boolean;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

/** Inside /o/:orgId — the company, the user's role and the company's websites. */
export function useOrgCtx(): OrgContextValue {
  const v = useContext(OrgContext);
  if (!v) throw new Error('useOrgCtx outside OrgLayout');
  return v;
}

export function makeCan(role: Role) {
  return (min: Role) => roleAtLeast(role, min);
}

export interface SiteContextValue {
  site: Site;
}
export const SiteContext = createContext<SiteContextValue | null>(null);

/** Inside /o/:orgId/sites/:siteId — the website. */
export function useSiteCtx(): SiteContextValue {
  const v = useContext(SiteContext);
  if (!v) throw new Error('useSiteCtx outside SiteLayout');
  return v;
}

const LAST_SITE = (orgId: string) => `lastSite:${orgId}`;
export function rememberSite(orgId: string, siteId: string) {
  try {
    localStorage.setItem(LAST_SITE(orgId), siteId);
  } catch {
    /* ignore */
  }
}
export function lastSite(orgId: string): string | null {
  try {
    return localStorage.getItem(LAST_SITE(orgId));
  } catch {
    return null;
  }
}
