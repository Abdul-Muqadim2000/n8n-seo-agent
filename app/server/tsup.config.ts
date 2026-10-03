import { defineConfig } from 'tsup';

// One ESM bundle; the workspace package @seo/shared (TypeScript source) is bundled in, npm dependencies stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@seo/shared'],
});
