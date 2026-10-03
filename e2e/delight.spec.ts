import { companionForDay } from '../src/companion/characters';
import { card, entries, ev, expect, MIN, open, test, toastEl } from './helpers';

test.describe('companions', () => {
  test('mirrors what is happening and reacts to logs', async ({ page }) => {
    // Mid-morning with an earlier entry, so the first-of-the-morning hello doesn't cover the line.
    const now = new Date(2026, 8, 30, 10, 30).getTime();
    await page.clock.setFixedTime(now);
    await open(page, { settings: { babyName: 'Pip' }, events: [ev('diaper', now - 30 * MIN, { detail: { diaper: 'wet' } })] });
    const companion = page.locator('#companion');
    const puff = companion.locator('svg.buddy');
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

  test('follows the time of day, and greets the first entry of the morning', async ({ page }) => {
    const now = new Date(2026, 8, 30, 7, 30).getTime();
    await page.clock.setFixedTime(now);
    // Last night's feed, so this isn't the very first coin (which gets its own celebration).
    await open(page, { settings: { babyName: 'Pip' }, events: [ev('feed', now - 12 * 60 * MIN)] });
    const companion = page.locator('#companion');
    const puff = companion.locator('svg.buddy');
    await expect(puff).toHaveAttribute('data-time', 'morning');
    await expect(companion).toContainText('Good morning from Puff');
    // No sleep tracking needed: the first entry of the morning gets a hello.
    await card(page, 'wet').click();
    await expect(companion).toContainText(/(morning|shine), Pip/);
    await page.clock.setFixedTime(new Date(2026, 8, 30, 19, 0));
    await expect(puff).toHaveAttribute('data-time', 'evening');
    await card(page, 'night').click();
    await expect(companion).toContainText(/(Goodnight|Nighty night|dreamland), Pip/);
  });

  test('earns a coin for every entry: today and all time by the companion, and in Settings', async ({ page }) => {
    const now = new Date(2026, 8, 30, 10, 30).getTime();
    await page.clock.setFixedTime(now);
    await open(page, {
      events: [ev('feed', now - 30 * MIN), ev('feed', now - 24 * 60 * MIN), ev('diaper', now - 26 * 60 * MIN, { detail: { diaper: 'wet' } })],
    });
    const chip = page.locator('#companion .coin-chip');
    await expect(chip).toHaveAttribute('aria-label', '1 coin today, 3 all time');
    await expect(chip).toContainText('3 total');
    await card(page, 'wet').click();
    await expect(chip).toHaveAttribute('aria-label', '2 coins today, 4 all time');
    await expect(chip.locator('.coin-pop')).toHaveText('+1');
    await page.screenshot({ path: test.info().outputPath('coins.png') });
    // Undo takes the coin back.
    await toastEl(page).getByRole('button', { name: 'Undo' }).click();
    await expect(chip).toHaveAttribute('aria-label', '1 coin today, 3 all time');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#settings .coin-total')).toContainText('3 coins all time · 1 today');
    await expect(page.locator('#settings .coin-total')).toContainText('Next milestone: 50');
  });

  test('passing a coin milestone gets a celebration', async ({ page }) => {
    const now = new Date(2026, 8, 30, 10, 30).getTime();
    await page.clock.setFixedTime(now);
    await open(page, { events: Array.from({ length: 49 }, (_, i) => ev('feed', now - (i + 1) * 60 * MIN)) });
    await card(page, 'wet').click();
    await expect(page.locator('#companion')).toContainText('50 coins!');
  });

  test('passing a milestone unlocks its prechosen reward: 100 coins puts on the party hat', async ({ page }) => {
    const now = new Date(2026, 8, 30, 10, 30).getTime();
    await page.clock.setFixedTime(now);
    await open(page, { events: Array.from({ length: 99 }, (_, i) => ev('feed', now - (i + 1) * 60 * MIN)) });
    const svg = page.locator('#companion svg.buddy');
    await expect(svg.locator('[data-acc]')).toHaveCount(0);
    await card(page, 'wet').click();
    await expect(page.locator('#companion')).toContainText('100 coins! Puff got a party hat');
    await expect(svg.locator('[data-acc="partyhat"]')).toBeVisible();
    // Undo dips below 100 again: the hat comes off (it's still chosen, just not unlocked).
    await toastEl(page).getByRole('button', { name: 'Undo' }).click();
    await expect(svg.locator('[data-acc]')).toHaveCount(0);
  });

  test('tap the coins: coins, medals and unlocks; wear what is unlocked, pick unlocked companions', async ({ page }) => {
    const now = new Date(2026, 8, 30, 10, 30).getTime();
    await page.clock.setFixedTime(now);
    await open(page, { events: Array.from({ length: 260 }, (_, i) => ev('feed', now - 2 * 24 * 60 * MIN - i * 30 * MIN)) });
    await page.locator('#companion .coin-chip').click();
    const sheet = page.locator('#rewards');
    await expect(sheet.getByRole('heading', { name: 'Coins & rewards' })).toBeVisible();
    await expect(sheet).toContainText('0 today · 260 all time');
    await expect(sheet).toContainText('Next: 500 coins · Flower crown · 240 to go');
    await expect(sheet.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '260');
    await expect(sheet.getByRole('heading', { name: /Medals/ })).toContainText('4 of 9');
    await expect(sheet.getByLabel('250 coins: silver medal, earned')).toBeVisible();
    await expect(sheet.getByLabel('500 coins: silver medal, not yet')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('rewards.png') });

    const bowtie = sheet.locator('[data-wear="bowtie"]');
    await expect(sheet.locator('[data-wear="crown"]')).toBeDisabled();
    await expect(sheet.locator('[data-buddy="unicorn"]')).toBeDisabled();
    await bowtie.click();
    await expect(bowtie).toHaveAttribute('aria-pressed', 'true');
    await sheet.locator('[data-buddy="star"]').click();
    await expect(sheet.locator('[data-buddy="star"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    const svg = page.locator('#companion svg.buddy');
    await expect(svg).toHaveAttribute('data-companion', 'star');
    await expect(svg.locator('[data-acc="bowtie"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Say hi to Star' })).toBeVisible();

    // Settings: Star is choosable, Unicorn still locked; the keyboard shortcut opens the sheet too.
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('#settings input[name="companion"][value="unicorn"]')).toBeDisabled();
    await expect(page.locator('#settings input[name="companion"][value="star"]')).toBeChecked();
    await page.locator('#settings').getByRole('button', { name: 'Medals & unlocks' }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await expect(sheet).toBeVisible();
  });

  test('tap the companion: it says hi in its own voice, and a flurry of taps tickles', async ({ page }) => {
    await open(page, { settings: { companion: 'sadie' } });
    const buddy = page.getByRole('button', { name: 'Say hi to Sadie' });
    await buddy.click();
    await expect(page.locator('#companion .companion-line')).toHaveText('Woof!');
    await expect(page.locator('#companion svg.buddy')).toHaveAttribute('data-face', 'o');
    // Four more in quick succession (one click() each from Playwright can be too slow on CI to count as a flurry).
    await buddy.evaluate((el: HTMLElement) => {
      for (let i = 0; i < 4; i++) el.click();
    });
    await expect(page.locator('#companion .companion-line')).toHaveText('Hehe, that tickles!');
  });

  test('Surprise me: a different companion each day, the same one all day', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 3, 10, 0));
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings .buddy-picker').getByText('Surprise me', { exact: true }).click();
    await page.keyboard.press('Escape');
    const svg = page.locator('#companion svg.buddy');
    const [today, tomorrow] = [companionForDay('2026-10-03'), companionForDay('2026-10-04')];
    expect(today).not.toBe(tomorrow);
    await expect(svg).toHaveAttribute('data-companion', today);
    await page.reload();
    await expect(svg).toHaveAttribute('data-companion', today);
    await page.clock.setFixedTime(new Date(2026, 9, 4, 10, 0));
    await page.reload();
    await expect(svg).toHaveAttribute('data-companion', tomorrow);
  });

  test('only shows on today, and can be turned off', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.locator('#companion')).toBeHidden();
    await page.getByRole('button', { name: 'Back to today' }).click();
    await expect(page.locator('#companion')).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#settings .buddy-picker').getByText('Off', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#companion')).toBeHidden();
  });

  test('Sadie and friends: pick one in Settings, and they react the same way', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const picker = page.locator('#settings .buddy-picker');
    for (const [label, id] of [['Moon', 'moon'], ['Bunny', 'bunny'], ['Duckling', 'duck'], ['Peanut', 'peanut'], ['Sadie', 'sadie']]) {
      await picker.getByText(label, { exact: true }).click();
      await expect(page.locator('#companion svg.buddy')).toHaveAttribute('data-companion', id);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#companion')).toContainText(/from Sadie/);
    await card(page, 'feed').click();
    const sadie = page.locator('#companion svg.buddy');
    await expect(sadie).toHaveAttribute('data-face', 'o');
    await expect(sadie).toHaveAttribute('data-excited', '');
    await card(page, 'nap').click();
    await expect(sadie).toHaveAttribute('data-state', 'sleeping');
    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(page.locator('#companion svg.buddy')).toHaveAttribute('data-companion', 'sadie');
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
  test('plain hides the glow; every scene loads lazily (or falls back without WebGL) and switching cleans up', async ({ page }) => {
    await open(page);
    const bg = page.locator('.bg');
    await expect(bg).toHaveAttribute('data-bg', 'glow');
    await page.getByRole('button', { name: 'Settings' }).click();
    const picker = page.locator('#settings .scene-picker');
    await picker.getByText('Plain', { exact: true }).click();
    await expect(bg).toHaveAttribute('data-bg', 'none');
    await expect(page.locator('.glow').first()).toBeHidden();

    for (const name of ['Night sky', 'Fireflies', 'Bubbles', 'Crib mobile', 'Snow']) {
      await picker.getByText(name, { exact: true }).click();
      // Either the scene canvas is up, or (no WebGL here) it fell back to the glow quietly.
      await expect
        .poll(async () => (await page.locator('canvas.scene-canvas').count()) === 1 || (await bg.getAttribute('data-bg')) === 'glow')
        .toBe(true);
      expect(await page.locator('canvas.scene-canvas').count()).toBeLessThanOrEqual(1);
    }
    await picker.getByText('Glow', { exact: true }).click();
    await expect(page.locator('canvas.scene-canvas')).toHaveCount(0);
  });
});
