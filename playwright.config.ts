import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
/** Production build + preview, for things only the built app has (service worker). */
const PREVIEW_PORT = 4181;

/**
 * Tests seed entries relative to now ("50 minutes ago"), which land on yesterday shortly after
 * midnight. So run in a fixed-offset zone (no DST) where it's currently around midday, in the
 * browser and in the test process alike (tests that pin a clock build dates in local time).
 */
const offset = ((12 - new Date().getUTCHours() + 36) % 24) - 12; // local = UTC + offset, -12…11
const TZ = offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`; // Etc/ signs are inverted
process.env.TZ = TZ;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/tinylog/`,
    trace: 'on-first-retry',
    timezoneId: TZ,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /pwa\.spec|layout\.spec/ },
    // WebKit catches Safari-only rendering issues (e.g. SVG transform quirks).
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /pwa\.spec|layout\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /pwa\.spec/ },
    // iPhone Safari layout (WebKit + iPhone viewport): form fields must not overlap or clip.
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testMatch: /layout\.spec/ },
    {
      name: 'pwa',
      testMatch: /pwa\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}/tinylog/` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/tinylog/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite build --logLevel warn && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}/tinylog/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
