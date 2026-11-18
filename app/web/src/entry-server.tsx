// Build-time prerender of the public website (scripts/prerender.mjs runs the server build of this file after `vite build`). React
// Router's own data-mode server tools render each public route exactly as the browser would (same route table, same providers), so
// the raw HTML of every page carries its title, description, canonical, H1, full body and structured data, and the browser hydrates
// it (main.tsx). Nothing here runs in the browser bundle.
import { PassThrough } from 'node:stream';
import { prerenderToNodeStream } from 'react-dom/static';
import { QueryClient } from '@tanstack/react-query';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { AppProviders } from './AppProviders';
import { routes } from './routes';
import { SeoSinkContext, type SeoHead } from './marketing/useSeo';

export { sitePages, STATIC_PATHS } from './marketing/seo/paths';
export { llmsTxt, robotsTxt, sitemapXml } from './marketing/seo/files';
export { renderDocument, visibleText } from './marketing/seo/document';

/** a path no route but the catch-all matches: its render is the 404 page (dist/404.html) */
export const NOT_FOUND_PATH = '/404-page-not-found';

const handler = createStaticHandler(routes);

export interface Rendered {
  status: number;
  html: string;
  head: SeoHead | null;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  const pass = new PassThrough();
  stream.pipe(pass);
  for await (const c of pass) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

/** renders one path of the website to HTML (the body inside #root) and the head its page set through useSeo */
export async function render(path: string): Promise<Rendered> {
  const context = await handler.query(new Request(`${SITE_ORIGIN}${path}`));
  if (context instanceof Response) throw new Error(`prerender ${path}: the route answered a redirect (${context.status})`);
  const router = createStaticRouter(handler.dataRoutes, context);
  let head: SeoHead | null = null;
  // the same query defaults as the browser (main.tsx): no request is made while rendering, and every query reads as "pending" in
  // both places, so signed-out markup is what the build writes and what the first browser render produces
  const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } } });
  const { prelude } = await prerenderToNodeStream(
    <SeoSinkContext.Provider value={(h) => (head = h)}>
      <AppProviders queryClient={queryClient}>
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </AppProviders>
    </SeoSinkContext.Provider>,
  );
  const html = await streamToString(prelude);
  queryClient.clear();
  return { status: context.statusCode, html, head };
}
