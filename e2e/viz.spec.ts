import { demoDays } from './seed';
import { card, entries, ev, expect, MIN, open, test, toastEl } from './helpers';

test.describe('day clock', () => {
  test('draws today’s entries as marks with details on tap', async ({ page }) => {
    const now = Date.now();
    await open(page, {
      events: [
        ev('sleep', now - 3 * 60 * MIN, { endAt: now - 2 * 60 * MIN, detail: { sleep: 'nap' } }),
        ev('feed', now - 90 * MIN, { detail: { method: 'bottle', amount: 90 } }),
        ev('diaper', now - 60 * MIN, { detail: { diaper: 'dirty' } }),
      ],
    });
    const clock = page.locator('#day-clock');
    await expect(clock.locator('.rc-mark')).toHaveCount(3);
    await expect(clock.locator('.rc-now')).toHaveCount(1);
    await expect(clock.locator('svg')).toHaveAttribute('aria-label', /Asleep 1h, 1 feeds \(90 ml by bottle\), 0 wet and 1 dirty/);

    await clock.locator('.rc-feed').click();
    await expect(page.locator('.viz-tip')).toContainText('Bottle · 90 ml');
  });

  test('updates when something is logged, and shows no "now" hand on past days', async ({ page }) => {
    await open(page);
    await expect(page.locator('#day-clock .rc-mark')).toHaveCount(0);
    await card(page, 'wet').click();
    await expect(page.locator('#day-clock .rc-mark')).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#day-clock .rc-now')).toHaveCount(0);
  });
});

test.describe('trends', () => {
  test('shows the strip, rings and a totals row per day; remembers the range', async ({ page }) => {
    await open(page, { events: demoDays(14) });
    await page.getByRole('button', { name: 'Trends (G)' }).click();
    const trends = page.locator('#trends');
    await expect(trends.getByRole('heading', { name: 'Trends' })).toBeVisible();
    await expect(trends.locator('table.totals tbody tr')).toHaveCount(7);
    await expect(trends.locator('.ds-row')).toHaveCount(7);
    await expect(trends.locator('.wr-ring')).toHaveCount(7);
    await expect(trends.locator('.ds-sleep').first()).toBeVisible();

    await trends.getByText('14 days').click();
    await expect(trends.locator('table.totals tbody tr')).toHaveCount(14);
    await page.keyboard.press('Escape');
    await page.keyboard.press('g');
    await expect(trends.locator('table.totals tbody tr')).toHaveCount(14);
  });

  test('downloads the range as Markdown', async ({ page }) => {
    await open(page, { events: [ev('feed', Date.now() - 30 * MIN, { detail: { method: 'breast', side: 'L' } })], settings: { babyName: 'Pip' } });
    await page.keyboard.press('g');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .md' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^tinylog-.*\.md$/);
    const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
    expect(text).toContain("# Pip's log");
    expect(text).toContain('🍼 **Feed** — Breast · L');
  });
});

test.describe('keyboard', () => {
  test('U undoes the last log, even after its toast is gone', async ({ page }) => {
    await open(page);
    await page.keyboard.press('b');
    await expect(entries(page)).toHaveCount(1);
    await page.locator('#day-title').click();
    await page.keyboard.press('u');
    await expect(entries(page)).toHaveCount(0);
    await page.keyboard.press('u');
    await expect(toastEl(page)).toContainText('Nothing to undo');
  });

  test('? lists the shortcuts', async ({ page }) => {
    await open(page);
    await page.keyboard.press('?');
    const sheet = page.locator('#shortcuts');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Start / stop nap');
    await expect(sheet).toContainText('Undo the last action');
  });
});

test('bedside display shows the last feed and awake time, and closes on tap', async ({ page }) => {
  const now = Date.now();
  await open(page, {
    events: [
      ev('feed', now - 95 * MIN, { detail: { method: 'breast', side: 'R' } }),
      ev('sleep', now - 4 * 60 * MIN, { endAt: now - 50 * MIN, detail: { sleep: 'nap' } }),
    ],
  });
  await page.getByRole('button', { name: 'Bedside display (A)' }).click();
  const amb = page.locator('#ambient');
  await expect(amb.locator('.amb-feed')).toHaveText('1h 35m');
  await expect(amb.locator('.amb-sleep-label')).toHaveText('awake for');
  await expect(amb.locator('.amb-sleep')).toHaveText('50m');
  await amb.click();
  await expect(amb).toBeHidden();
});
