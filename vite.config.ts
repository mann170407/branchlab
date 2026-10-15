/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Inline fonts as data URIs; scripts/inline-build.mjs then inlines JS and CSS
    // so dist/index.html is a single file that works from disk or any host.
    assetsInlineLimit: () => true,
    modulePreload: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
