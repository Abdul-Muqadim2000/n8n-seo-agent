import { lazy, Suspense } from 'react';
import { HomeRedirect } from '@/components/layout/HomeRedirect';
import { PageLoader } from '@/components/ui/feedback';
import { useMe } from '@/lib/queries';

// the marketing home is its own chunk: signed-in users never download it
const MarketingHome = lazy(() => import('./HomeEntry'));

/** "/": the marketing home for visitors, the app (HomeRedirect) for signed-in users. A 401 from /api/me is "visitor" (useMe returns null);
 *  any other failure also shows the home page, so a visitor never loops or sees an error. */
export function RootRoute() {
  const me = useMe();
  if (me.isPending) return <PageLoader />;
  if (me.data) return <HomeRedirect />;
  return (
    <Suspense fallback={<PageLoader />}>
      <MarketingHome />
    </Suspense>
  );
}
