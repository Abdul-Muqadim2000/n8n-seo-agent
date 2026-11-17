// Whether this page load started from HTML written at build time (scripts/prerender.mjs marks #root with data-prerendered), and the
// prerender itself (no document). While true, "/" shows the marketing home that is already on screen instead of a loader while
// /api/me answers, so the first client render matches the static HTML. app.<domain>/ is served the plain app shell (app.html, no
// marker, middleware.ts), so a signed-in user there still sees the loader and then the app, never the marketing home.
let fromStatic = typeof document === 'undefined';

/** true during the prerender, and in the browser when the page was served prerendered */
export const startedFromStatic = (): boolean => fromStatic;

/** main.tsx, once, before the first render */
export const markStartedFromStatic = (on: boolean): void => {
  fromStatic = on;
};
