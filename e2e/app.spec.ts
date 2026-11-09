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
    // Never silent, since a tap meant for a card can land on Undo: it says so and can put it back.
    await expect(toastEl(page)).toContainText('Wet removed');
    await toastEl(page).getByRole('button', { name: 'Put back' }).click();
    await expect(entries(page)).toHaveCount(1);
    await expect.poll(async () => (await storedEvents(page))[0]?.deleted).toBeFalsy();
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
    const confirm = page.locator('#confirm');
    await expect(confirm).toContainText('Delete this entry?');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeVisible();
    await expect(entries(page)).toHaveCount(1);

    await sheet.getByRole('button', { name: 'Delete' }).click();
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(sheet).toBeHidden();
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

  // Regression: leaving the app after moving to another day saved that day's (empty) box over the note.
  test('a day note survives leaving the app from another day', async ({ page }) => {
    await open(page);
    const note = page.getByLabel('📝 Day note');
    await note.fill('Rolled over');
    await note.blur();
    await page.getByRole('button', { name: 'Previous day' }).click();
    await note.focus();
    await note.blur();
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(note).toHaveValue('Rolled over');
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

  test('music starts hidden; turned on in Settings it logs one song per tap and stays on', async ({ page }) => {
    await open(page);
    await expect(card(page, 'music')).toBeHidden();
    await page.keyboard.press('j'); // the key works while it's hidden
    await expect(entries(page).first()).toContainText('Music');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings fieldset', { hasText: 'Buttons' }).locator('label', { hasText: 'Music' }).click();
    await page.keyboard.press('Escape');
    await card(page, 'music').click();
    await expect(card(page, 'music')).toContainText('2 today');
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(card(page, 'music')).toBeVisible();
  });

  test('weight and height: a tap asks for the number, in either unit, converted for display', async ({ page }) => {
    await open(page);
    await expect(card(page, 'weight')).toContainText('Add a weight');
    await card(page, 'weight').click();
    const s = page.locator('#sheet form');
    // A provider gave it in lb + oz; the setting is kg. Switch units in the sheet and type it as given.
    await s.getByText('lb · oz', { exact: true }).click();
    await s.getByLabel('Weight (lb)').fill('15');
    await s.getByLabel('and oz').fill('14');
    await expect(s.locator('[data-conv]')).toHaveText('= 7.201 kg');
    // Switching back converts what was typed.
    await s.getByText('kg', { exact: true }).click();
    await expect(s.getByLabel('Weight (kg)')).toHaveValue('7.201');
    await s.getByRole('button', { name: 'Save' }).click();
    await expect(card(page, 'weight')).toContainText('7.201 kg');
    await expect(entries(page).first()).toContainText('7.201 kg');

    // Saving without a number explains instead of logging an empty measurement.
    await card(page, 'height').click();
    await s.getByRole('button', { name: 'Save' }).click();
    await expect(s.getByRole('alert')).toHaveText('Enter the height.');
    await s.getByText('in', { exact: true }).click();
    await s.getByLabel('Height (in)').fill('24.5');
    await expect(s.locator('[data-conv]')).toHaveText('= 62.2 cm');
    await s.getByRole('button', { name: 'Save' }).click();
    await expect(card(page, 'height')).toContainText('62.2 cm');

    // Display units are a setting; stored values don't change.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings').getByText('lb · in', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(card(page, 'weight')).toContainText('15 lb 14 oz');
    await expect(card(page, 'height')).toContainText('24.5 in');

    // Trends: a Growth chart per measurement with tooltips, and the table.
    await page.keyboard.press('g');
    const growth = page.locator('#trends section', { hasText: 'Growth' });
    await expect(growth.locator('.growth-chart[data-kind="weight"] [data-tip]')).toHaveCount(1);
    await expect(growth.locator('.growth-table tbody tr')).toHaveCount(1);
    await expect(growth.locator('.growth-table tbody tr')).toContainText('15 lb 14 oz');
    await expect(growth.locator('.growth-table tbody tr')).toContainText('24.5 in');
  });

  test('weight and height links take any unit', async ({ page }) => {
    await open(page, {}, './?do=log&what=weight&lb=14&oz=2');
    await expect(card(page, 'weight')).toContainText('6.407 kg');
    const r = await page.evaluate(() => window.tinylog.log('height', { inches: 24 }));
    expect(r).toMatchObject({ result: 'logged', entry: { what: 'height', summary: '61 cm' } });
    const g = await page.evaluate(() => window.tinylog.growth());
    expect(g.weight).toHaveLength(1);
    expect(g.height[0].cm).toBe(60.96);
  });

  test('my mood: a tap asks how you feel; check-ins have their own place in Trends, outside the baby log', async ({ page }) => {
    await open(page);
    await expect(card(page, 'mood')).toContainText('How are you?');
    await card(page, 'mood').click();
    const s = page.locator('#sheet form');
    // Saving without picking a mood explains instead of logging an empty check-in.
    await s.getByRole('button', { name: 'Save' }).click();
    await expect(s.getByRole('alert')).toHaveText('Pick how you’re feeling.');
    // The face is decoration (aria-hidden): the choice is announced as just "Low".
    await s.locator('label').filter({ has: page.getByRole('radio', { name: 'Low', exact: true }) }).click();
    await s.getByText('Anxious', { exact: true }).click();
    await s.getByText('Tearful', { exact: true }).click();
    // Support contacts are always there, folded away.
    await s.getByText('Need support?').click();
    await expect(s.locator('.support a[href="tel:+18338526262"]')).toBeVisible();
    await s.getByRole('button', { name: 'Save' }).click();
    await expect(card(page, 'mood')).toContainText('😕 Low');
    await expect(entries(page).first()).toContainText('Low · anxious, tearful');

    // Kept out of the baby's Markdown log.
    const md = await page.evaluate(() => window.tinylog.markdown(1));
    expect(md).not.toContain('anxious');

    // Trends: a dot per check-in with a tooltip, and the table.
    await page.keyboard.press('g');
    const mood = page.locator('#trends section', { hasText: 'My mood' });
    await expect(mood.locator('.mood-chart [data-tip]')).toHaveCount(1);
    await expect(mood.locator('.mood-table tbody tr')).toContainText('Anxious, Tearful');
  });

  test('my mood links and API', async ({ page }) => {
    await open(page, {}, './?do=log&what=mood&mood=good&feelings=calm');
    await expect(card(page, 'mood')).toContainText('🙂 Good');
    const r = await page.evaluate(() => window.tinylog.log('mood', { mood: 2, feelings: ['lonely'] }));
    expect(r).toMatchObject({ result: 'logged', entry: { what: 'mood', summary: 'Low · lonely' } });
    expect(await page.evaluate(() => window.tinylog.state().last.mood)).toMatchObject({ summary: 'Low · lonely' });
    await expect(page.evaluate(() => window.tinylog.log('mood'))).rejects.toThrow(/say the mood/);
  });

  test('arrange: drag buttons into a new order, nothing logs, and the order sticks', async ({ page }) => {
    await open(page);
    const order = () => page.locator('#cards .card:not([hidden])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.card));
    const before = await order();
    expect(before[0]).toBe('feed');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings').getByRole('button', { name: 'Arrange buttons' }).click();
    const bar = page.getByRole('region', { name: 'Arranging buttons' });
    await expect(bar).toBeVisible();

    // A tap while arranging never logs. (force: the buttons wiggle, so they're never "stable".)
    await card(page, 'wet').click({ force: true });
    await expect(entries(page)).toHaveCount(0);

    // Drag Feed onto Bath, once the smooth scroll to the buttons has settled.
    await expect
      .poll(async () => {
        const a = await page.evaluate(() => scrollY);
        await page.waitForTimeout(150);
        return a === (await page.evaluate(() => scrollY));
      })
      .toBe(true);
    const from = (await card(page, 'feed').boundingBox())!;
    const to = (await card(page, 'bath').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    const dragged = await order();
    expect(dragged[0]).not.toBe('feed');
    // It lands next to Bath (which side depends on the path the pointer took).
    expect(Math.abs(dragged.indexOf('feed') - dragged.indexOf('bath'))).toBe(1);

    // Keyboard: arrows move the focused button and don't change the day.
    const first = dragged[0]!;
    await card(page, first).focus();
    await page.keyboard.press('ArrowRight');
    expect((await order())[1]).toBe(first);
    await expect(page.locator('#day-title')).toContainText('Today');
    await expect(entries(page)).toHaveCount(0);

    await bar.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toHaveCount(0);
    const saved = await order();
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    expect(await order()).toEqual(saved);

    // Back to normal: a tap logs again. Settings lists the buttons in the new order and can reset it.
    await card(page, 'wet').click();
    await expect(entries(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Settings' }).click();
    const toggles = await page.locator('#settings [data-card-toggle]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(toggles.filter((id) => saved.includes(id))).toEqual(saved);
    await page.locator('#settings').getByRole('button', { name: 'Reset order' }).click();
    await page.keyboard.press('Escape');
    expect(await order()).toEqual(before);
  });

  test('arrange: hide a button with the ×, after confirming, and bring it back from the bar', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings').getByRole('button', { name: 'Arrange buttons' }).click();
    const bar = page.getByRole('region', { name: 'Arranging buttons' });
    const confirm = page.locator('#confirm');

    // Cancel keeps it, and Escape in the confirmation doesn't end arranging.
    await page.getByRole('button', { name: 'Hide Bath' }).click();
    await expect(confirm.getByRole('heading')).toHaveText('Hide 🛁 Bath?');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(card(page, 'bath')).toBeVisible();
    await page.getByRole('button', { name: 'Hide Bath' }).click();
    await page.keyboard.press('Escape');
    await expect(card(page, 'bath')).toBeVisible();
    await expect(bar).toBeVisible();

    await page.getByRole('button', { name: 'Hide Bath' }).click();
    await confirm.getByRole('button', { name: 'Hide' }).click();
    await expect(card(page, 'bath')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Hide Bath' })).toBeHidden();
    const showBath = bar.getByRole('button', { name: 'Show Bath' });
    await expect(showBath).toBeVisible();
    // Off-by-default Music is listed too.
    await expect(bar.getByRole('button', { name: 'Show Music' })).toBeVisible();

    await showBath.click();
    await expect(card(page, 'bath')).toBeVisible();
    await expect(showBath).toHaveCount(0);

    // Hide it again and leave with Escape: it stays hidden, Settings agrees.
    await page.getByRole('button', { name: 'Hide Bath' }).click();
    await confirm.getByRole('button', { name: 'Hide' }).click();
    await page.keyboard.press('Escape');
    await expect(bar).toHaveCount(0);
    await expect(page.locator('.card-hide')).toHaveCount(0);
    await expect(card(page, 'bath')).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#settings [data-card-toggle][value="bath"]')).not.toBeChecked();
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

test.describe('swipe to delete', () => {
  async function swipe(page: import('@playwright/test').Page, row: import('@playwright/test').Locator, dx: number) {
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width - 20 + (dx * i) / 8, y);
    await page.mouse.up();
  }

  test('swiping a row left asks, then deletes; Undo brings it back', async ({ page }) => {
    const now = Date.now();
    await open(page, { events: [ev('feed', now - 20 * MIN), ev('diaper', now - 40 * MIN, { detail: { diaper: 'dirty' } })] });
    await expect(entries(page)).toHaveCount(2);
    const confirm = page.locator('#confirm');

    // A short drag springs back and doesn't open the entry.
    await swipe(page, entries(page).first(), -30);
    await expect(confirm).toBeHidden();
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('#entries li.is-swiping')).toHaveCount(0);

    await swipe(page, entries(page).first(), -260);
    await expect(confirm).toContainText('Feed');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(entries(page)).toHaveCount(2);
    await expect(page.locator('#sheet')).toBeHidden();

    await swipe(page, entries(page).first(), -260);
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first()).toContainText('Dirty');
    await expect.poll(async () => (await storedEvents(page)).find((e) => e.type === 'feed')?.deleted).toBe(true);
    await toastEl(page).getByRole('button', { name: 'Undo' }).click();
    await expect(entries(page)).toHaveCount(2);
  });

  test('with "Ask before deleting" off, a swipe deletes straight away', async ({ page }) => {
    await open(page, { events: [ev('feed', Date.now() - 20 * MIN)], settings: { confirmDeletes: false } });
    await swipe(page, entries(page).first(), -260);
    await expect(entries(page)).toHaveCount(0);
    await expect(page.locator('#confirm')).toBeHidden();
    await expect(toastEl(page)).toContainText('Feed deleted');
  });
});
