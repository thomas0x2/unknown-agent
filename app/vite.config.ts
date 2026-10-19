/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// Jev calls go to the local backend proxy so the API key never ships in the client; the GitHub Pages
// build (npm run build:pages, VITE_DIRECT_API=1) calls the APIs with the player's own keys instead.
export default defineConfig({
  // relative asset paths so the built app works when served from any path
  base: './',
  // two pages: the game, and the standalone world wiki (wiki.html), both published to GitHub Pages
  // (.github/workflows/pages.yml); `npm run build:wiki` builds only the wiki, into dist-wiki/
  build: process.env.WIKI_ONLY
    ? { outDir: 'dist-wiki', rollupOptions: { input: { wiki: 'wiki.html' } } }
    : { rollupOptions: { input: { main: 'index.html', wiki: 'wiki.html' } } },
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
});
