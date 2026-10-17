/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// The stylesheet is the legacy game's own (../src/style.css), imported directly so both builds look
// identical. Jev calls go to the local backend proxy so the API key never ships in the client.
export default defineConfig({
  // relative asset paths so the built app works when served from any path
  base: './',
  // two pages: the game, and the standalone world wiki (wiki.html)
  build: { rollupOptions: { input: { main: 'index.html', wiki: 'wiki.html' } } },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
});
