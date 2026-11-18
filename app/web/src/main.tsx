import { createRoot, hydrateRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { RouterProvider, type HydrationState } from 'react-router';
import { AppProviders } from './AppProviders';
import { markStartedFromStatic } from '@/lib/prerender';
import { createAppRouter, prepareHydration } from './router';
// brand fonts, self-hosted (the CSP blocks Google Fonts); unicode-range means browsers fetch only the latin files
import '@fontsource-variable/sora';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

// A public page arrives as HTML written at build time (scripts/prerender.mjs marks #root). It is hydrated when the address is exactly
// the one the build rendered (no query string: /contact?topic=..., /tutorials/x?t=... render differently) and every module of the
// matched route is loaded first, so the first client render is the page already on screen. Anything else (the app shell, a query
// string, a failed module load) is rendered by the client, which replaces the static HTML in one step.
async function start() {
  const container = document.getElementById('root')!;
  // the marker names the path the build rendered: a host that answers another path with this file (an app fallback) gets a fresh render
  const prerendered = container.getAttribute('data-prerendered') === window.location.pathname;
  let hydrationData: HydrationState | undefined;
  if (prerendered && !window.location.search) {
    try {
      hydrationData = await prepareHydration(window.location.pathname);
    } catch {
      hydrationData = undefined;
    }
  }
  markStartedFromStatic(prerendered);
  const app = (
    <AppProviders queryClient={queryClient} hydrating={!!hydrationData}>
      <RouterProvider router={createAppRouter(hydrationData)} />
    </AppProviders>
  );
  if (hydrationData) hydrateRoot(container, app);
  else createRoot(container).render(app);
}

void start();
