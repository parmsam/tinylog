import { type Locator, type Page } from '@playwright/test';
import { card, ev, expect, MIN, open, test } from './helpers';

/** Every visible control inside `root`: no two overlap, none spill past the sheet, date fields get the full width. */
async function assertClean(root: Locator, label: string) {
  const problems = await root.evaluate((form) => {
    const out: string[] = [];
    const box = form.getBoundingClientRect();
    const els = [...form.querySelectorAll<HTMLElement>('input:not([type=radio]):not([hidden]), select, textarea, .seg label, .btn, .check, legend, .field-label')].filter(
      (el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0,
    );
    const name = (el: HTMLElement) => `${el.tagName.toLowerCase()}${el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 20)}"`;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1) out.push(`${name(el)} spills out of the sheet`);
      if (el.matches('input[type=datetime-local]') && r.width < box.width * 0.7) out.push(`${name(el)} is only ${Math.round(r.width)}px wide`);
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i];
        const b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) out.push(`${name(a)} overlaps ${name(b)}`);
      }
    }
    return out;
  });
  expect(problems, label).toEqual([]);
}

const sheet = (page: Page) => page.locator('#sheet form');

test('entry sheet fields never overlap on iPhone, in every state', async ({ page }) => {
  await open(page, { events: [ev('pump', Date.now() - 20 * MIN, { endAt: Date.now() - 5 * MIN, detail: { side: 'L', amount: 90 } })] });
  await page.getByRole('button', { name: '+ Add entry' }).click();
  const s = sheet(page);
  await assertClean(s, 'feed (breast)');
  await s.getByText('Bottle', { exact: true }).click();
  await assertClean(s, 'feed (bottle: amount + milk)');
  for (const kind of ['💧 Wet', '😴 Nap', '🌙 Night sleep', '🤸 Tummy time', '🫗 Pump', '😣 Fussy', '🛁 Bath', '🩺 Doctor']) {
    await s.getByText(kind, { exact: true }).click();
    await assertClean(s, kind);
  }
  // Timed entry with an end time (Still going unticked): start and end fields both visible.
  await s.getByText('😴 Nap', { exact: true }).click();
  const still = s.getByLabel('Still going');
  if (await still.isChecked()) await still.uncheck();
  await expect(s.getByLabel('Ended')).toBeEnabled();
  await assertClean(s, 'nap with end time');
  await page.keyboard.press('Escape');

  // Editing an existing entry adds the Delete button.
  await page.locator('#entries .entry').first().click();
  await assertClean(sheet(page), 'edit pump');
  await expect(sheet(page).getByRole('button', { name: 'Delete' })).toBeVisible();
});

test('settings and a past-day sheet fit on iPhone', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await assertClean(page.locator('#settings form'), 'settings');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Previous day' }).click();
  await card(page, 'night').click();
  await assertClean(sheet(page), 'night sleep on a past day');
});
