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

  test('heatmap view: a row per hour, a column per category, remembered', async ({ page }) => {
    await open(page, { events: demoDays(7) });
    await page.keyboard.press('g');
    const trends = page.locator('#trends');
    await trends.getByText('Heatmap').click();
    await expect(trends.getByRole('heading', { name: 'By time of day' })).toBeVisible();
    const table = trends.locator('table.heatmap');
    await expect(table.locator('tbody tr')).toHaveCount(24);
    await expect(table.locator('thead th')).toHaveCount(8); // hour + 7 categories
    await expect(table.locator('tbody th').first()).toHaveText(/12a|00/);
    // Night sleep in the demo data fills the small hours.
    await expect(table.locator('tbody tr').nth(3).locator('td').nth(3)).toHaveClass(/l[45]/);
    await table.locator('tbody tr').nth(3).locator('td').nth(3).click();
    await expect(page.locator('.viz-tip')).toContainText('Sleep');

    await page.keyboard.press('Escape');
    await page.keyboard.press('g');
    await expect(trends.locator('table.heatmap')).toBeVisible();
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

test.describe('day grid', () => {
  test('Grid shows the day hour by hour, remembers the choice, and can use ✓ marks', async ({ page }) => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const t = (h: number, m = 0) => midnight.getTime() + (h * 60 + m) * MIN;
    await open(page, {
      events: [
        ev('sleep', t(0, 0), { endAt: t(1, 30), detail: { sleep: 'night' } }),
        ev('diaper', t(0, 45), { detail: { diaper: 'both' } }),
      ],
    });
    const dayView = page.getByRole('radiogroup', { name: 'Day view' });
    await dayView.getByText('Grid').click();
    const grid = page.locator('#day-clock table.daygrid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('tbody tr')).toHaveCount(24);
    // 12 AM row: full hour of sleep, and a "both" diaper in wet and dirty.
    const row0 = grid.locator('tbody tr').first();
    await expect(row0.locator('.dg-seg')).toHaveCount(1);
    await expect(row0.locator('.dg-mark')).toHaveCount(2);
    // 1 AM row: half an hour of sleep.
    await expect(grid.locator('tbody tr').nth(1).locator('.dg-seg')).toHaveAttribute('style', /left:0%;width:50%/);

    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(page.locator('#day-clock table.daygrid')).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings').getByText('✓ Checks').click();
    await page.keyboard.press('Escape');
    await expect(row0.locator('.dg-glyph')).toHaveCount(2);
    await expect(row0.locator('.dg-glyph').first()).toHaveText('✓');

    await dayView.getByText('Clock').click();
    await expect(page.locator('#day-clock svg.radial')).toBeVisible();
  });
});

test.describe('tips', () => {
  test('the welcome tip shows once, and Settings → Show tips again brings it back', async ({ page }) => {
    // (The Android install tip, which would come next on the phone project, is out of the way.)
    await open(page, { settings: { tipsSeen: ['install-android'] } });
    const banner = page.locator('#banner');
    await expect(banner).toContainText('Tap a card');
    await banner.getByRole('button', { name: 'Got it' }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(banner).toBeHidden();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Show tips again' }).click();
    await expect(banner).toContainText('Tap a card');
  });

  test('Next tip steps through every tip without waiting; only Got it marks one seen', async ({ page }) => {
    await open(page, { settings: { tipsSeen: [] } });
    const banner = page.locator('#banner');
    const next = banner.getByRole('button', { name: 'Next tip' });
    // The Android phone project also gets the install tip, right after the welcome.
    const android = test.info().project.name === 'mobile';
    const total = android ? 9 : 8;
    await expect(banner).toContainText('Tap a card');
    await expect(banner.locator('.tip-count')).toHaveText(`1/${total}`);
    await next.click();
    if (android) {
      await expect(banner).toContainText('Install tinylog');
      await next.click();
    }
    // Not due yet (needs 10 entries), but browsing shows it anyway.
    await expect(banner).toContainText('Share with partner');
    await expect(banner.locator('.tip-count')).toHaveText(`${android ? 3 : 2}/${total}`);
    await page.screenshot({ path: test.info().outputPath('tips.png') });
    for (let i = 0; i < 6; i++) await next.click();
    await expect(banner).toContainText('Shortcuts & Siri');
    await next.click();
    await expect(banner).toContainText('Tap a card');
    await next.click();
    await banner.getByRole('button', { name: 'Got it' }).click();
    await expect(banner).toBeHidden();
    // The welcome tip was only browsed past, so it's still there next time.
    await page.reload();
    await expect(banner).toContainText('Tap a card');
    await banner.getByRole('button', { name: 'Got it' }).click();
    await expect(banner).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Show tips again' }).click();
    await expect(banner).toContainText('Tap a card');
    await expect(banner.locator('.tip-count')).toHaveText(`1/${total}`);
  });

  test('Settings has an install guide, with the steps for this phone first', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const section = page.locator('#settings section', { has: page.getByRole('heading', { name: 'Install the app' }) });
    await expect(section).toContainText('Add to Home Screen');
    const first = section.locator('.install-steps li').first();
    await expect(first).toContainText(test.info().project.name === 'mobile' ? 'Android' : 'iPhone');
    // Only shown when the browser offers its own install prompt.
    await expect(section.getByRole('button', { name: 'Install tinylog' })).toBeHidden();
  });
});

test.describe('patterns', () => {
  test('shows typical values once there are enough full days', async ({ page }) => {
    await open(page, { events: demoDays(10) });
    await page.keyboard.press('g');
    const card = page.locator('#trends').locator('section', { has: page.getByRole('heading', { name: 'Patterns' }) });
    // A 7-day range has 6 full days: today is left out until it's over.
    await expect(card).toContainText('6 full days');
    await expect(card.locator('.stat:not(.pending)')).toHaveCount(10); // incl. Fussy and Pumping (both in the demo data)
    const tile = (label: string) => card.locator('.stat', { has: page.getByRole('heading', { name: label, exact: true }) });
    await expect(tile('Bedtime')).toContainText(/usually .*[0-9]/);
    await expect(tile('Naps')).toContainText(/a day/);
    await expect(card).toContainText('not advice');
  });

  test('says what it still needs on a new log', async ({ page }) => {
    await open(page, { events: [ev('feed', Date.now() - 30 * MIN)] });
    await page.keyboard.press('g');
    const card = page.locator('#trends').locator('section', { has: page.getByRole('heading', { name: 'Patterns' }) });
    await expect(card).toContainText('no full days yet');
    await expect(card.locator('.stat.pending').first()).toContainText('Needs 3 full days of logs (0 so far)');
    await expect(card.locator('.stat', { hasText: 'Pumping' })).toHaveCount(0);
  });
});
