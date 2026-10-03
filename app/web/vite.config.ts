import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: Vite on :5173 proxies /api to the app server (API_PROXY, default http://localhost:4000), so cookies are first-party.
export default defineConfig({
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
