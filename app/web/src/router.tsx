import { createBrowserRouter, matchRoutes, type HydrationState, type RouteObject } from 'react-router';
import { preloadMarketingHome } from '@/marketing/RootRoute';
import { routes } from './routes';

/** The browser router over the shared route table (routes.tsx). `hydrationData` is set when the page started from prerendered HTML
 *  (main.tsx), so the router starts initialised and renders the page that is already on screen. */
export const createAppRouter = (hydrationData?: HydrationState) => createBrowserRouter(routes, hydrationData ? { hydrationData } : undefined);

type LazyFn = () => Promise<Partial<RouteObject>>;

/**
 * Before hydrating a prerendered page: loads every lazy module of the routes that match `pathname` and puts it on the route (React
 * Router's own pattern for lazy routes and hydration), loads the marketing home for "/", and returns the router's starting data: the
 * slug guards return null for every page the build rendered (an unknown slug is a real 404, never prerendered).
 */
export async function prepareHydration(pathname: string): Promise<HydrationState> {
  const matches = matchRoutes(routes, pathname) ?? [];
  if (!matches.length) throw new Error('no route');
  await Promise.all(
    matches.map(async ({ route }) => {
      if (typeof route.lazy !== 'function') return;
      const mod = await (route.lazy as LazyFn)();
      Object.assign(route, { ...mod, lazy: undefined });
    }),
  );
  if (matches[matches.length - 1].route.path === '/') await preloadMarketingHome();
  const loaderData: Record<string, null> = {};
  for (const { route } of matches) if (route.loader && route.id) loaderData[route.id] = null;
  return { loaderData };
}
