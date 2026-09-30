import { card, entries, ev, expect, MIN, open, test } from './helpers';

test.describe('Puff', () => {
  test('mirrors what is happening and reacts to logs', async ({ page }) => {
    await open(page, { settings: { babyName: 'Pip' } });
    const companion = page.locator('#companion');
    const puff = companion.locator('svg.puff');
    await expect(companion).toBeVisible();
    await expect(puff).toHaveAttribute('data-state', 'idle');

    await card(page, 'feed').click();
    await expect(puff).toHaveAttribute('data-face', 'o');
    await expect(companion).toContainText('fed just now');

    await card(page, 'nap').click();
    await expect(puff).toHaveAttribute('data-state', 'sleeping');
    await expect(companion).toContainText('Pip is sleeping');
    await card(page, 'nap').click();
    await expect(puff).toHaveAttribute('data-state', 'idle');
    await expect(companion).toContainText('Awake');

    await card(page, 'fussy').click();
    await expect(puff).toHaveAttribute('data-state', 'fussy');
  });

  test('only shows on today, and can be turned off', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('#companion')).toBeHidden();
    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.locator('#companion')).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Show Puff, the little companion').uncheck();
    await page.keyboard.press('Escape');
    await expect(page.locator('#companion')).toBeHidden();
  });
});

test.describe('day recap', () => {
  test('draws a shareable card for the selected day, with a text description', async ({ page }) => {
    const now = Date.now();
    await open(page, {
      settings: { babyName: 'Pip' },
      events: [
        ev('feed', now - 3 * 60 * MIN, { detail: { method: 'bottle', amount: 90 } }),
        ev('diaper', now - 2 * 60 * MIN, { detail: { diaper: 'wet' } }),
        ev('sleep', now - 100 * MIN, { endAt: now - 40 * MIN, detail: { sleep: 'nap' } }),
      ],
    });
    await expect(entries(page)).toHaveCount(3);
    await page.getByRole('button', { name: '✨ Recap' }).click();
    const img = page.locator('#recap .recap-img');
    await expect(img).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1080);
    await expect(img).toHaveAttribute('alt', /Pip's day .*asleep 1h.*1 feeds \(90 ml by bottle\).*1 diapers.*longest stretch 1h/);

    const download = page.waitForEvent('download');
    await page.locator('#recap').getByRole('button', { name: 'Save image' }).click();
    expect((await download).suggestedFilename()).toMatch(/^tinylog-\d{4}-\d{2}-\d{2}\.png$/);
  });
});

test.describe('backgrounds', () => {
  test('plain hides the glow; night sky loads lazily (or falls back without WebGL)', async ({ page }) => {
    await open(page);
    await expect(page.locator('.bg')).toHaveAttribute('data-bg', 'glow');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings').getByText('Plain', { exact: true }).click();
    await expect(page.locator('.bg')).toHaveAttribute('data-bg', 'none');
    await expect(page.locator('.glow').first()).toBeHidden();

    await page.locator('#settings').getByText('Night sky', { exact: true }).click();
    // Either the sky canvas appears, or (no WebGL here) it falls back to the glow quietly.
    await expect.poll(async () => (await page.locator('.sky-canvas').count()) > 0 || (await page.locator('.bg').getAttribute('data-bg')) === 'glow').toBe(true);
    await page.locator('#settings').getByText('Glow', { exact: true }).click();
    await expect(page.locator('.sky-canvas')).toHaveCount(0);
  });
});
