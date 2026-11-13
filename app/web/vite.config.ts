import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// robots.txt + sitemap.xml for the business site, written into the build from the same content registries the router uses
// (before 2026-11-12 both paths answered the app's HTML shell: an SEO product with no sitemap). SITE_ORIGIN overrides the origin.
const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://www.alaventra.com').replace(/\/+$/, '');
const STATIC_PATHS = ['/', '/platform', '/how-it-works', '/tutorials', '/solutions', '/pricing', '/security', '/about', '/contact', '/changelog', '/privacy', '/terms'];
function seoFiles(): Plugin {
  return {
    name: 'alaventra-seo-files',
    apply: 'build',
    async generateBundle() {
      const { createServer } = await import('vite');
      const root = fileURLToPath(new URL('.', import.meta.url));
      const server = await createServer({
        configFile: false,
        root,
        logLevel: 'silent',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, watch: null },
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
      });
      let paths: string[];
      try {
        const [f, s, t] = await Promise.all([
          server.ssrLoadModule('/src/marketing/content/features.ts'),
          server.ssrLoadModule('/src/marketing/content/solutions.ts'),
          server.ssrLoadModule('/src/marketing/content/tutorials.ts'),
        ]);
        paths = [
          ...STATIC_PATHS,
          ...(f.features as { slug: string }[]).map((x) => `/platform/${x.slug}`),
          ...(s.solutions as { slug: string }[]).map((x) => `/solutions/${x.slug}`),
          ...(t.tutorials as { slug: string }[]).map((x) => `/tutorials/${x.slug}`),
        ];
      } finally {
        await server.close();
      }
      if (paths.length < STATIC_PATHS.length + 10) this.error(`sitemap: only ${paths.length} paths found`);
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        [...new Set(paths)].map((p) => `  <url><loc>${SITE_ORIGIN}${p === '/' ? '/' : p}</loc></url>`).join('\n') +
        '\n</urlset>\n';
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
      // the signed-in app, share links and invitations are not for search engines; app.<domain> answers its own robots.txt
      // (Disallow: /) from middleware.ts
      const robots = ['User-agent: *', 'Allow: /', ...['/o/', '/admin', '/account', '/onboarding', '/share/', '/invite/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/portal-handoff', '/api/'].map((p) => `Disallow: ${p}`), '', `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ''].join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    },
  };
}

// Dev: Vite on :5173 proxies /api to the app server (API_PROXY, default http://localhost:4000), so cookies are first-party.
export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // the dev server is also reached from other containers (browser tests): by service name and host.docker.internal
    allowedHosts: ['localhost', 'web', 'host.docker.internal'],
    // file events do not always cross a Docker bind mount on macOS
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    // no public source maps in production builds
    sourcemap: false,
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
});
