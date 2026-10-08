import { Navigate } from 'react-router';
import { useMe } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { PageLoader } from '../ui/feedback';

const LAST_ORG = 'lastOrg';
export function rememberOrg(orgId: string) {
  try {
    localStorage.setItem(LAST_ORG, orgId);
  } catch {
    /* ignore */
  }
}

/** "/": a company that is still onboarding resumes the wizard; otherwise the last company used. */
export function HomeRedirect() {
  const me = useMe();
  if (me.isPending || !me.data) return <PageLoader fullPage />;
  const orgs = me.data.orgs;
  if (!orgs.length) return <Navigate to={paths.onboarding()} replace />;
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_ORG);
  } catch {
    last = null;
  }
  const org = orgs.find((o) => o.id === last) ?? orgs[0];
  if (!org.onboardedAt && (org.role === 'owner' || org.role === 'admin')) return <Navigate to={paths.onboarding(org.id, org.onboardingStep)} replace />;
  return <Navigate to={paths.org(org.id)} replace />;
}
