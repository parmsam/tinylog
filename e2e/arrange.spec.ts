import type { Page } from '@playwright/test';
import { card, entries, expect, open, test } from './helpers';

// Arranging the home-screen buttons (ui/arrange.ts).
// Keep a trace of a failed first attempt: these flaked on CI's slow WebKit runner. (Only in this file:
// tracing every test slows that runner a lot.)
test.use({ trace: 'retain-on-first-failure' });

/** Every visible button's × sits on that button's top-right corner. */
const hidesPinned = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('#cards .card:not([hidden])')].every((c) => {
          const x = document.querySelector<HTMLElement>(`.card-hide[data-hide="${c.dataset.card}"]`);
          if (!x || x.hidden) return false;
          const a = c.getBoundingClientRect();
          const b = x.getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          return Math.abs(cx - a.right) < 24 && Math.abs(cy - a.top) < 24;
        }),
      ),
    )
    .toBe(true);

test('arrange: drag buttons into a new order, nothing logs, and the order sticks', async ({ page }) => {
  // Many steps; CI's WebKit runner takes seconds per click.
  test.slow();
  // Reduced motion: no wiggle and no smooth scroll, so buttons stay put for the pointer.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const order = () => page.locator('#cards .card:not([hidden])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.card));
  const before = await order();
  expect(before[0]).toBe('feed');
  // Checkpoints: Music is off by default and nothing here should turn it on. On CI's WebKit it
  // once came back after a reload; these name the step if it happens again.
  const musicStaysHidden = async (step: string, saved = true) => {
    await expect(card(page, 'music'), `Music hidden on screen after ${step}`).toBeHidden();
    if (!saved) return;
    const hidden = await page.evaluate(() => JSON.parse(localStorage.getItem('tinylog:v1:settings') ?? '{}').hiddenCards);
    expect(hidden, `Music hidden in saved settings after ${step}`).toContain('music');
  };
  await musicStaysHidden('opening', false);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#settings').getByRole('button', { name: 'Arrange buttons' }).click();
  const bar = page.getByRole('region', { name: 'Arranging buttons' });
  await expect(bar).toBeVisible();
  await musicStaysHidden('entering arrange mode', false);

  // A tap while arranging never logs.
  await card(page, 'wet').click();
  await expect(entries(page)).toHaveCount(0);
  await musicStaysHidden('a tap while arranging', false);

  // Drag Feed onto Bath.
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
  await musicStaysHidden('the drag');

  // Keyboard: arrows move the focused button and don't change the day.
  await hidesPinned(page);
  const first = dragged[0]!;
  await card(page, first).focus();
  await page.keyboard.press('ArrowRight');
  expect((await order())[1]).toBe(first);
  await hidesPinned(page);
  await musicStaysHidden('the arrow-key move');
  await expect(page.locator('#day-title')).toContainText('Today');
  await expect(entries(page)).toHaveCount(0);

  await bar.getByRole('button', { name: 'Done' }).click();
  await expect(bar).toHaveCount(0);
  await musicStaysHidden('Done');
  const saved = await order();
  await page.reload();
  await expect(page.locator('html[data-ready]')).toBeAttached();
  await musicStaysHidden('the reload');
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
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  // The buttons after it moved up; their ×s followed.
  await hidesPinned(page);
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
