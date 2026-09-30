import { card, entries, ev, expect, MIN, open, test, toastEl } from './helpers';

test.describe('link actions', () => {
  test('a link logs once, says so with Undo, and cleans up the URL', async ({ page }) => {
    await open(page, {}, './?do=log&what=wet&ago=10');
    await expect(entries(page)).toHaveCount(1);
    await expect(toastEl(page)).toContainText('Via shortcut: 💧 Wet logged');
    await expect(toastEl(page).getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(card(page, 'wet')).toContainText('10m ago');
    expect(new URL(page.url()).search).toBe('');

    await page.reload();
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(entries(page)).toHaveCount(1);
  });

  test('the same link opened twice in a row only logs once', async ({ page }) => {
    await open(page, {}, './?do=log&what=dirty');
    await page.goto('./?do=log&what=dirty');
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(entries(page)).toHaveCount(1);
  });

  test('toggle starts and stops sleep; stopping a pump with ml skips the sheet', async ({ page }) => {
    await open(page, { events: [ev('pump', Date.now() - 15 * MIN)] }, './?do=stop&what=pump&ml=120&side=both');
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(entries(page).first()).toContainText('both sides · 120 ml');

    await page.goto('./?do=toggle&what=nap');
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(card(page, 'nap')).toHaveClass(/is-ongoing/);
    await page.goto('./?do=toggle&what=nap&note=x');
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(card(page, 'nap')).not.toHaveClass(/is-ongoing/);
  });

  test('a bottle link with an amount', async ({ page }) => {
    await open(page, {}, './?do=log&what=bottle&ml=90&milk=formula');
    await expect(entries(page).first()).toContainText('Bottle · 90 ml · formula');
  });

  test('a bad link explains itself and logs nothing', async ({ page }) => {
    await open(page, {}, './?do=log&what=unicorn');
    await expect(toastEl(page)).toContainText("That link didn't log anything");
    await expect(entries(page)).toHaveCount(0);
  });

  test('links always log to today, even if you were looking at another day', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Previous day' }).click();
    await page.goto('./?do=log&what=bath');
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await expect(page.locator('#day-title')).toHaveText('Today');
    await expect(entries(page)).toHaveCount(1);
  });

  test('Settings lists ready-made links to copy', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const section = page.locator('#settings section', { hasText: 'Shortcuts & Siri' });
    await expect(section.locator('.link-list li')).toHaveCount(6);
    await section.locator('li', { hasText: 'Wet diaper' }).getByRole('button', { name: 'Copy' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/tinylog\/\?do=log&what=wet$/);
  });
});

test.describe('window.tinylog', () => {
  test('every recipe in the help runs', async ({ page }) => {
    await open(page, { settings: { babyName: 'Pip' } });
    const help = await page.evaluate(() => window.tinylog.help());
    expect(help).toContain('tinylog.state()');
    const results = await page.evaluate(() => {
      const t = window.tinylog;
      return {
        wet: t.log('wet', { minutesAgo: 10 }),
        bottle: t.log('bottle', { ml: 90, milk: 'formula' }),
        sleep: t.toggle('sleep'),
        feed: t.state().last.feed,
        today: t.state().today,
        entries: t.entries().length,
        md: t.markdown(1),
        patterns: typeof t.patterns(7),
      };
    });
    expect(results.wet).toMatchObject({ result: 'logged', entry: { what: 'wet', label: 'Wet diaper' } });
    expect(results.bottle).toMatchObject({ result: 'logged', entry: { what: 'feed', summary: 'Bottle · 90 ml · formula' } });
    expect(results.sleep.result).toBe('started');
    expect(results.feed).toMatchObject({ minutesAgo: 0, summary: 'Bottle · 90 ml · formula' });
    expect(results.today).toMatchObject({ feeds: 1, bottleMl: 90, wet: 1 });
    expect(results.entries).toBe(3);
    expect(results.md).toContain("# Pip's log");
    expect(results.patterns).toBe('object');
    // The page updates like any other change.
    await expect(entries(page)).toHaveCount(3);
  });

  test('bad input throws a readable error; stopping nothing is not an error', async ({ page }) => {
    await open(page);
    const err = await page.evaluate(() => {
      try {
        window.tinylog.log('unicorn');
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(err).toContain("don't know “unicorn”");
    const r = await page.evaluate(() => window.tinylog.stop('nap'));
    expect(r).toEqual({ result: 'nothing-to-do', reason: 'No nap is going' });
  });
});
