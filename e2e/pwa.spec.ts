import { expect, test } from './helpers';

// Runs against a production build (`vite preview`): the service worker only exists there.
test('installable: manifest, icons and an offline-ready service worker', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({ short_name: 'tinylog', display: 'standalone', start_url: '/tinylog/' });
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, page.url()).toString())).status()).toBe(200);
  }
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active)).toBe(true);
});
