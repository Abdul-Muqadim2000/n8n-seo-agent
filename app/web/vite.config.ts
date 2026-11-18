import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The public website's one origin (canonical links, og:url, structured data, sitemap.xml, llms.txt): handed to the code as
// VITE_SITE_ORIGIN (src/lib/siteOrigin.ts), for the browser build and the prerender's server build alike. SITE_ORIGIN still works.
const SITE_ORIGIN = (process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN || 'https://www.alaventra.com').replace(/\/+$/, '');
process.env.VITE_SITE_ORIGIN = SITE_ORIGIN;

// sitemap.xml, robots.txt and llms.txt are written by scripts/prerender.mjs (npm run build), with the prerendered pages.

// Dev: Vite on :5173 proxies /api to the app server (API_PROXY, default http://localhost:4000), so cookies are first-party.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // the dev server is also reached from other containers (browser tests): by service name and host.docker.internal
    allowedHosts: ['localhost', 'web', 'host.docker.internal'],
    // file events do not always cross a Docker bind mount on macOS
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: isSsrBuild
    ? // the prerender's server build (scripts/prerender.mjs): Node runs it once at build time; packages stay external
      { outDir: 'dist-ssr', sourcemap: false, emptyOutDir: true }
    : {
        outDir: 'dist',
        // no public source maps in production builds
        sourcemap: false,
        // the prerender links each public page's stylesheets from it, then deletes it (never published)
        manifest: true,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom', 'react-router'],
              charts: ['recharts'],
              forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
            },
          },
        },
      },
}));
