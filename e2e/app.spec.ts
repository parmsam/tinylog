import { card, entries, ev, expect, MIN, mirror, open, storedEvents, test, toastEl } from './helpers';

test.describe('one-tap logging', () => {
  test('a tap logs a wet diaper, saves it, and Undo takes it back', async ({ page }) => {
    await open(page);
    await expect(card(page, 'wet')).toContainText('Tap to log');
    await card(page, 'wet').click();

    await expect(toastEl(page)).toContainText('Wet logged');
    await expect(card(page, 'wet')).toContainText('just now');
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first()).toContainText('Wet diaper');

    // Saved to IndexedDB and to the localStorage mirror.
    await expect.poll(async () => (await storedEvents(page)).length).toBe(1);
    expect((await mirror(page))?.events).toHaveLength(1);

    await toastEl(page).getByRole('button', { name: 'Undo' }).click();
    await expect(entries(page)).toHaveCount(0);
    await expect(card(page, 'wet')).toContainText('Tap to log');
    await expect.poll(async () => (await storedEvents(page))[0]?.deleted).toBe(true);
  });

  test('time chips move a late entry back', async ({ page }) => {
    await open(page);
    await card(page, 'feed').click();
    await toastEl(page).getByRole('button', { name: '−15m' }).click();
    await expect(card(page, 'feed')).toContainText('15m ago');
    await toastEl(page).getByRole('button', { name: '−30m' }).click();
    await expect(card(page, 'feed')).toContainText('30m ago');
  });

  test('one-tap feeds alternate breasts', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('feed', now - 3 * 60 * MIN, { detail: { method: 'breast', side: 'L' } })] });
    await expect(card(page, 'feed')).toContainText('next R');
    await card(page, 'feed').click();
    await expect(entries(page).first()).toContainText('Breast · R');
  });

  test('keyboard letters log like a tap', async ({ page }) => {
    await open(page);
    await page.keyboard.press('d');
    await expect(entries(page).first()).toContainText('Dirty diaper');
  });
});

test.describe('timed things', () => {
  test('a nap keeps running across a reload and stops with a tap', async ({ page }) => {
    await open(page);
    await card(page, 'nap').click();
    await expect(card(page, 'nap')).toHaveClass(/is-ongoing/);
    await expect(card(page, 'nap')).toContainText('asleep');

    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(card(page, 'nap')).toHaveClass(/is-ongoing/);

    await card(page, 'nap').click();
    await expect(card(page, 'nap')).not.toHaveClass(/is-ongoing/);
    await expect(card(page, 'nap')).toContainText('awake');
    await expect(toastEl(page)).toContainText('Nap ·');
  });

  test('a nap that turns into bedtime switches instead of starting a second sleep', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('sleep', now - 40 * MIN, { detail: { sleep: 'nap' } })] });
    await card(page, 'night').click();
    await expect(card(page, 'night')).toHaveClass(/is-ongoing/);
    await expect(card(page, 'nap')).not.toHaveClass(/is-ongoing/);
    await expect(entries(page)).toHaveCount(1);
  });

  test('fussy is tap to start, tap to stop, and shows today’s total', async ({ page }) => {
    await open(page, { events: [ev('fussy', Date.now() - 50 * MIN, { endAt: Date.now() - 30 * MIN })] });
    await expect(card(page, 'fussy')).toContainText('20m today');
    await page.keyboard.press('c');
    await expect(card(page, 'fussy')).toHaveClass(/is-ongoing/);
    await card(page, 'fussy').click();
    await expect(card(page, 'fussy')).not.toHaveClass(/is-ongoing/);
    await expect(entries(page)).toHaveCount(2);
  });

  test('stopping a pump asks for side and volume', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('pump', now - 18 * MIN)] });
    await card(page, 'pump').click();
    const sheet = page.locator('#sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByText('Both', { exact: true }).click();
    await sheet.getByLabel('Volume (ml)').fill('120');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(entries(page).first()).toContainText('both sides · 120 ml');
    await expect(card(page, 'pump')).toContainText('120 ml today');
  });
});

test.describe('the sheet', () => {
  test('holding a card opens details first (bottle feed with amount)', async ({ page }) => {
    await open(page);
    const feed = card(page, 'feed');
    const box = (await feed.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    const sheet = page.locator('#sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByText('Bottle', { exact: true }).click();
    await sheet.getByLabel('Amount (ml)').fill('90');
    await sheet.getByText('Formula').click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first()).toContainText('Bottle · 90 ml · formula');
  });

  test('a sleep can say where it happened (optional)', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('sleep', now - 60 * MIN, { endAt: now - 20 * MIN, detail: { sleep: 'nap' } })] });
    await entries(page).first().click();
    const sheet = page.locator('#sheet');
    await sheet.getByText('Bassinet', { exact: true }).click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(entries(page).first()).toContainText('Bassinet');
    expect((await storedEvents(page))[0].detail).toMatchObject({ sleep: 'nap', where: 'bassinet' });
  });

  test('editing an entry changes it; deleting can be undone', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('diaper', now - 30 * MIN, { detail: { diaper: 'wet' } })] });
    await entries(page).first().click();
    const sheet = page.locator('#sheet');
    await sheet.getByText('Both', { exact: true }).click();
    await sheet.getByLabel('Note').fill('blowout');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(entries(page).first()).toContainText('Wet + dirty diaper');
    await expect(entries(page).first()).toContainText('blowout');
    await expect(card(page, 'dirty')).toContainText('30m ago');

    await entries(page).first().click();
    await sheet.getByRole('button', { name: 'Delete' }).click();
    await expect(entries(page)).toHaveCount(0);
    await toastEl(page).getByRole('button', { name: 'Undo' }).click();
    await expect(entries(page)).toHaveCount(1);
  });

  test('an end time before the start is refused', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: '+ Add entry' }).click();
    const sheet = page.locator('#sheet');
    await sheet.getByText('😴 Nap').click();
    await sheet.getByLabel('Still going').uncheck();
    await sheet.getByLabel('Started').fill('2026-01-10T10:00');
    await sheet.getByLabel('Ended').fill('2026-01-10T09:00');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet.getByRole('alert')).toContainText('before the start');
  });
});

test.describe('days', () => {
  test('past days can be filled in without touching today', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('#day-title')).toHaveText('Yesterday');
    await expect(card(page, 'bath')).toContainText('—');

    // On a past day a tap opens the sheet at that day instead of logging "now".
    await card(page, 'bath').click();
    const sheet = page.locator('#sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(entries(page)).toHaveCount(1);
    await expect(card(page, 'bath')).toContainText('Bath ✓');

    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.locator('#day-title')).toHaveText('Today');
    await expect(entries(page)).toHaveCount(0);
    await expect(card(page, 'bath')).toContainText('1d ago');
  });

  test('a night sleep across midnight shows on both days', async ({ page }) => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const start = midnight.getTime() - 2 * 60 * MIN;
    await open(page, { events: [ev('sleep', start, { endAt: start + 8 * 60 * MIN, detail: { sleep: 'night' } })] });
    await expect(entries(page)).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expect(entries(page)).toHaveCount(1);
    await expect(card(page, 'night')).toContainText('2h');
  });

  test('day notes are saved per day', async ({ page }) => {
    await open(page);
    await page.getByLabel('📝 Day note').fill('First real smile at the park');
    await page.getByLabel('📝 Day note').blur();
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByLabel('📝 Day note')).toHaveValue('');
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(page.getByLabel('📝 Day note')).toHaveValue('First real smile at the park');
  });
});

test.describe('data', () => {
  test('importing another phone’s export merges it', async ({ page }) => {
    const now = Date.now();
    const mine = ev('feed', now - 60 * MIN, { detail: { method: 'breast', side: 'L' } });
    await open(page, { events: [mine] });
    const theirs = ev('diaper', now - 20 * MIN, { detail: { diaper: 'dirty' } });
    const edited = { ...mine, detail: { method: 'breast' as const, side: 'R' as const }, updatedAt: now };
    const file = { app: 'tinylog', version: 1, exportedAt: now, events: [edited, theirs], notes: [] };

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({
      name: 'tinylog.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(toastEl(page)).toContainText('Merged: 1 new, 1 updated');
    // The confirmation must sit above the open Settings sheet, not behind it.
    const onTop = await toastEl(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(onTop).toBe(true);
    await page.keyboard.press('Escape');
    await expect(entries(page)).toHaveCount(2);
    await expect(entries(page).last()).toContainText('Breast · R');

    // Importing the same file again changes nothing.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({
      name: 'tinylog.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(toastEl(page)).toContainText('Already up to date');
  });

  test('share with partner opens the share sheet where JSON files can’t be shared (Android)', async ({ page }) => {
    // Android Chrome's share allowlist has text/plain but not application/json.
    await page.addInitScript(() => {
      const shared: { name: string; type: string; text: string }[] = [];
      (window as unknown as { shared: typeof shared }).shared = shared;
      navigator.canShare = (data?: ShareData) => !!data?.files?.every((f) => f.type === 'text/plain' && f.name.endsWith('.txt'));
      navigator.share = async (data?: ShareData) => {
        for (const f of data?.files ?? []) shared.push({ name: f.name, type: f.type, text: await f.text() });
      };
    });
    await open(page, { events: [ev('bath', Date.now() - 60 * MIN)] });
    await page.getByRole('button', { name: 'Settings' }).click();
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await page.getByRole('button', { name: 'Share with partner' }).click();
    await expect(page.locator('#data-status')).not.toContainText('never');
    const shared = await page.evaluate(() => (window as unknown as { shared: { name: string; type: string; text: string }[] }).shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].name).toMatch(/^tinylog-.*\.txt$/);
    expect(shared[0].type).toBe('text/plain');
    expect(JSON.parse(shared[0].text).app).toBe('tinylog');
    expect(downloaded).toBe(false);
  });

  test('an export shared as .txt imports like the .json', async ({ page }) => {
    const now = Date.now();
    await open(page);
    const file = { app: 'tinylog', version: 1, exportedAt: now, events: [ev('bath', now - 20 * MIN)], notes: [] };
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({ name: 'tinylog.txt', mimeType: 'text/plain', buffer: Buffer.from(JSON.stringify(file)) });
    await expect(toastEl(page)).toContainText('Merged: 1 new');
  });

  test('the baby name travels with an export, and fills in a blank name on import', async ({ page }) => {
    await open(page, { events: [ev('bath', Date.now() - 60 * MIN)], settings: { babyName: 'Pip' } });
    await page.getByRole('button', { name: 'Settings' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const text = await (await download).createReadStream().then(async (s) => {
      const chunks: Buffer[] = [];
      for await (const c of s) chunks.push(c as Buffer);
      return Buffer.concat(chunks).toString();
    });
    expect(JSON.parse(text).babyName).toBe('Pip');

    // A phone with no name yet takes it from the file…
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({ name: 'tinylog.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(toastEl(page)).toContainText('Name set to Pip');
    await expect(page.getByLabel("Baby's name")).toHaveValue('Pip');
    await page.keyboard.press('Escape');
    await expect(page.locator('#brand-name')).toHaveText('Pip');

    // …but never replaces one that's already set.
    await open(page, { settings: { babyName: 'Bean' } });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({ name: 'tinylog.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(toastEl(page)).toContainText('Merged: 1 new');
    await expect(toastEl(page)).not.toContainText('Name set');
    await expect(page.getByLabel("Baby's name")).toHaveValue('Bean');
  });

  test('a file that is not an export is rejected politely', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-import]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(toastEl(page)).toContainText("isn't a tinylog export");
  });

  test('export downloads a JSON backup and records the backup date', async ({ page }) => {
    await open(page, { events: [ev('bath', Date.now() - 60 * MIN)] });
    await page.getByRole('button', { name: 'Settings' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^tinylog-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    await expect(page.locator('#data-status')).not.toContainText('never');
  });

  test('if IndexedDB lost the log, the localStorage mirror brings it back', async ({ page }) => {
    await open(page, { events: [ev('feed', Date.now() - 45 * MIN, { detail: { method: 'breast' } })], mirrorOnly: true });
    await expect(toastEl(page)).toContainText('Recovered 1 entry');
    await expect(entries(page)).toHaveCount(1);
    await expect.poll(async () => (await storedEvents(page)).length).toBe(1);
  });

  test('settings: name, units and theme apply straight away', async ({ page }) => {
    await open(page, { events: [ev('feed', Date.now() - 45 * MIN, { detail: { method: 'bottle', amount: 120 } })] });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel("Baby's name").fill('Pip');
    await page.locator('#settings').getByText('oz', { exact: true }).click();
    await page.locator('#settings').getByText('Night', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#brand-name')).toHaveText('Pip');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await expect(entries(page).first()).toContainText('4.1 oz');
  });

  test('spit-ups and books are one tap each and count up for the day', async ({ page }) => {
    await open(page);
    await card(page, 'spitup').click();
    await card(page, 'books').click();
    await card(page, 'books').click();
    await expect(card(page, 'spitup')).toContainText('1 today');
    await expect(card(page, 'books')).toContainText('2 today');
    await expect(entries(page)).toHaveCount(3);
    await expect(entries(page).first()).toContainText('Books');
  });

  test('settings: buttons can be turned off, and stay off after a reload', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const buttons = page.locator('#settings fieldset', { hasText: 'Buttons' });
    await buttons.locator('label', { hasText: 'Pump' }).click();
    await buttons.locator('label', { hasText: 'Doctor' }).click();
    await page.keyboard.press('Escape');
    await expect(card(page, 'pump')).toBeHidden();
    await expect(card(page, 'doctor')).toBeHidden();
    await expect(card(page, 'feed')).toBeVisible();

    // The key still works, and a running pump shows its card so it can be stopped.
    await page.keyboard.press('p');
    await expect(card(page, 'pump')).toBeVisible();
    await card(page, 'pump').click();
    await expect(card(page, 'pump')).toBeHidden();

    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(card(page, 'doctor')).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    await buttons.locator('label', { hasText: 'Doctor' }).click();
    await page.keyboard.press('Escape');
    await expect(card(page, 'doctor')).toBeVisible();
  });
});

test.describe('backup reminders', () => {
  const now = Date.now();
  const entries49 = () => Array.from({ length: 49 }, (_, i) => ev('diaper', now - (i + 1) * 20 * MIN, { detail: { diaper: 'wet' } }));

  test('the 50th new entry brings up a reminder; Not now waits for the next 50', async ({ page }) => {
    await open(page, { events: entries49() });
    const banner = page.locator('#banner');
    await expect(banner).toBeHidden();

    await card(page, 'bath').click();
    await expect(banner).toContainText('50 new entries');
    await expect(banner).toContainText('no backup yet');
    await banner.getByRole('button', { name: 'Not now' }).click();
    await expect(banner).toBeHidden();

    await card(page, 'wet').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(banner).toBeHidden();
  });

  test('every few days (4 by default) a reminder offers Back up now; Not now waits a day', async ({ page }) => {
    const DAY = 24 * 60 * MIN;
    const old = Array.from({ length: 25 }, (_, i) => ev('diaper', now - 10 * DAY + i * MIN, { detail: { diaper: 'wet' } }));
    const fresh = [ev('feed', now - DAY), ev('feed', now - 2 * DAY)];
    // `now` is set when the file loads, maybe minutes ago on CI: pin the page to it so "Not now" records exactly it.
    await page.clock.setFixedTime(now);
    await open(page, { events: [...old, ...fresh], settings: { lastBackupAt: now - 5 * DAY } });
    const banner = page.locator('#banner');
    await expect(banner).toContainText('5 days since your last backup');
    await expect(banner.getByRole('button', { name: 'Back up now' })).toBeVisible();
    await banner.getByRole('button', { name: 'Not now' }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(banner).toBeHidden();
    // A day later it's back.
    await page.clock.setFixedTime(now + DAY + MIN);
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(banner).toContainText('6 days since your last backup');
  });

  test('the interval is a setting, and can be left to the 50-entry reminder', async ({ page }) => {
    const DAY = 24 * 60 * MIN;
    const old = Array.from({ length: 25 }, (_, i) => ev('diaper', now - 10 * DAY + i * MIN, { detail: { diaper: 'wet' } }));
    await open(page, { events: [...old, ev('feed', now - DAY)], settings: { lastBackupAt: now - 3 * DAY } });
    const banner = page.locator('#banner');
    await expect(banner).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    const select = page.locator('#settings').getByLabel('Remind me to back up');
    await expect(select).toHaveValue('4');
    await select.selectOption({ label: 'Every 2 days' });
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(banner).toContainText('3 days since your last backup');
    await page.getByRole('button', { name: 'Settings' }).click();
    await select.selectOption({ label: 'Only every 50 entries' });
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(banner).toBeHidden();
  });

  test('exporting from the reminder counts as a backup', async ({ page }) => {
    await open(page, { events: [...entries49(), ev('bath', now - 5 * MIN)] });
    const banner = page.locator('#banner');
    await expect(banner).toContainText('50 new entries');
    const download = page.waitForEvent('download');
    await banner.getByRole('button', { name: 'Back up now' }).click();
    await download;
    await expect(banner).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#data-status')).not.toContainText('never');
  });
});

test('a timed entry added after the fact starts with an end time, not an empty field', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '+ Add entry' }).click();
  const sheet = page.locator('#sheet');
  await sheet.getByText('😴 Nap', { exact: true }).click();
  await expect(sheet.getByLabel('Still going')).not.toBeChecked();
  const start = await sheet.getByLabel('Started').inputValue();
  const end = await sheet.getByLabel('Ended').inputValue();
  expect(end).not.toBe('');
  expect(end >= start).toBe(true);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('#entries .entry')).toHaveCount(1);
});

test('pinch-zoom stays allowed; only double-tap zoom is off', async ({ page }) => {
  await open(page);
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /maximum-scale|user-scalable/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
});

test('the footer links to GitHub and shows the version', async ({ page }) => {
  await open(page);
  const pkg = JSON.parse(await (await import('node:fs/promises')).readFile('package.json', 'utf8')) as { version: string };
  const foot = page.locator('footer.foot');
  await expect(foot.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/parmsam/tinylog');
  await expect(foot).toContainText(`v${pkg.version}`);
});

test('breastfeeding length: per side, or one total, optional', async ({ page }) => {
  await open(page);
  const feed = card(page, 'feed');
  const box = (await feed.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  const sheet = page.locator('#sheet');
  await sheet.getByText('Both', { exact: true }).click();
  await sheet.getByLabel('Left (min)').fill('12');
  await sheet.getByLabel('Right (min)').fill('8');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(entries(page).first()).toContainText('Breast · L 12m · R 8m');

  // Edit it: switch to one side, and only that side's length is kept.
  await entries(page).first().click();
  await sheet.getByText('Left', { exact: true }).click();
  await expect(sheet.getByLabel('Right (min)')).toHaveCount(0);
  await expect(sheet.getByLabel('Left (min)')).toHaveValue('12');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(entries(page).first()).toContainText('Breast · L 12m');
  await expect(entries(page).first()).not.toContainText('R 8m');
});
