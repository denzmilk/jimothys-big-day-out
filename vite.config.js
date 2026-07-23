import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Relative base so the same build works locally and on GitHub Pages project sites.
  base: './',
  publicDir: 'public',
  server: { port: 3000, open: true },
  build: { outDir: 'dist' },
});
