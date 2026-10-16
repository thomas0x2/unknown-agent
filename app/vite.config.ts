/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dev server proxies Jev calls to the local backend so the API key never ships in the client.
export default defineConfig({
  // relative asset paths so the built app works when served from any path (e.g. an artifact URL)
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
