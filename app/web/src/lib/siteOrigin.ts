// The public website's one origin: canonical links, og:url, structured data, sitemap.xml and llms.txt all name it. It is never taken
// from window.location: app.alaventra.com serves the same build, and its pages must still point search engines at www.
// vite.config.ts sets VITE_SITE_ORIGIN for the build (from VITE_SITE_ORIGIN or SITE_ORIGIN, default https://www.alaventra.com), so
// the browser bundle, the prerender and the sitemap read the same value; tests fall back to the default.
export const SITE_ORIGIN = String(import.meta.env?.VITE_SITE_ORIGIN || 'https://www.alaventra.com').replace(/\/+$/, '');

/** `/pricing` -> `https://www.alaventra.com/pricing`; `/` -> `https://www.alaventra.com/` */
export const absoluteUrl = (path: string): string => `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
