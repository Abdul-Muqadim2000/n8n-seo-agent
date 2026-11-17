import { lazy, Suspense } from 'react';
import { HomeRedirect } from '@/components/layout/HomeRedirect';
import { PageLoader } from '@/components/ui/feedback';
import { startedFromStatic } from '@/lib/prerender';
import { useMe } from '@/lib/queries';

// the marketing home is its own chunk: signed-in users never download it
const loadHome = () => import('./HomeEntry');
const MarketingHome = lazy(loadHome);
/** main.tsx loads it before hydrating a prerendered home, so the first client render is the page already on screen */
export const preloadMarketingHome = loadHome;

/** "/": the marketing home for visitors, the app (HomeRedirect) for signed-in users. A 401 from /api/me is "visitor" (useMe returns null);
 *  any other failure also shows the home page, so a visitor never loops or sees an error. While /api/me is pending the home shows when
 *  the page was prerendered (it is already on screen; a signed-in user then moves on to the app), the loader otherwise. */
export function RootRoute() {
  const me = useMe();
  if (me.data) return <HomeRedirect />;
  if (me.isPending && !startedFromStatic()) return <PageLoader />;
  return (
    <Suspense fallback={<PageLoader />}>
      <MarketingHome />
    </Suspense>
  );
}
