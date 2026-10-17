import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Component tests render with react-dom/server in Node (no browser, no DOM library): they prove a screen renders at all, with the
// contexts it really gets, which is what the 2026-10-17 onboarding crash (D-1) needed.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
});
