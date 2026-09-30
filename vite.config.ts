import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/tinylog/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // three.js (~530 kB raw, ~130 kB gz) is its own lazy chunk, loaded only for the night-sky background.
  build: { chunkSizeWarningLimit: 600 },
  plugins: [
    VitePWA({
      // Ask before updating: silently reloading could interrupt someone mid-entry.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'tinylog · baby tracker',
        short_name: 'tinylog',
        description: 'One-tap baby tracker: feeds, diapers, sleep, tummy time. All data stays on your phone.',
        theme_color: '#1b1726',
        background_color: '#1b1726',
        display: 'standalone',
        start_url: '/tinylog/',
        scope: '/tinylog/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Serve the app for page URLs only; real files come from the network.
        navigateFallbackDenylist: [/^[^?#]*\/[^/?#]+\.[^/?#]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // A zone with DST so day logic is tested across clock changes (CI runs in UTC).
    env: { TZ: 'America/New_York' },
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
