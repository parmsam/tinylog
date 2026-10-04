import { devices } from '@playwright/test';
import { demoDays, demoEvents } from './seed';
import { MIN, open, test } from './helpers';

/**
 * README screenshots (docs/*.png), from a fake baby's demo log. Skipped in normal runs:
 *   SCREENSHOTS=1 npx playwright test screenshots --project=chromium
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to refresh the README screenshots');

/** 2:30 PM today, so the day clock is about half full. */
function afternoon() {
  const d = new Date();
  d.setHours(14, 30, 0, 0);
  return d.getTime();
}

function demo(now: number) {
  const at = (minsAgo: number) => now - minsAgo * MIN;
  const extra = [
    { type: 'spitup' as const, mins: 125 },
    { type: 'book' as const, mins: 200 },
    { type: 'book' as const, mins: 195 },
  ].map(({ type, mins }, i) => ({ id: `shot-${i}`, type, at: at(mins), createdAt: at(mins), updatedAt: at(mins) }));
  // demoDays' last night already runs into this morning; drop demoEvents' own.
  const today = demoEvents(now).filter((e) => !(e.type === 'sleep' && e.detail?.sleep === 'night'));
  return [...demoDays(14, now), ...today, ...extra];
}

const settings = { babyName: 'Pip', companion: 'sadie' as const, theme: 'dusk' as const, lastBackupAt: Date.now() };

test('desktop', async ({ page }) => {
  const now = afternoon();
  await page.clock.install({ time: now });
  await page.setViewportSize({ width: 1280, height: 1250 });
  await open(page, { events: demo(now), settings });
  await page.clock.runFor(3000); // arcs draw in
  await page.screenshot({ path: 'docs/screenshot-desktop.png' });
});

test('mobile', async ({ browser }) => {
  const now = afternoon();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 2, baseURL: test.info().project.use.baseURL, timezoneId: test.info().project.use.timezoneId });
  const page = await ctx.newPage();
  await page.clock.install({ time: now });
  await open(page, { events: demo(now), settings: { ...settings, theme: 'day' } });
  await page.clock.runFor(3000);
  await page.screenshot({ path: 'docs/screenshot-mobile.png' });
  await ctx.close();
});

test('trends', async ({ page }) => {
  const now = afternoon();
  await page.clock.install({ time: now });
  await page.setViewportSize({ width: 1280, height: 860 });
  await open(page, { events: demo(now), settings });
  await page.keyboard.press('g');
  await page.clock.runFor(3000);
  await page.screenshot({ path: 'docs/screenshot-trends.png' });
});
