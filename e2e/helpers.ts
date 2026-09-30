import { test as base, expect, type Page } from '@playwright/test';
import type { DayNote, LogEvent, Settings } from '../src/core/types';

/** `test` that fails if the page throws an uncaught error. */
export const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use();
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const MIN = 60_000;

interface Seed {
  events?: LogEvent[];
  notes?: DayNote[];
  settings?: Partial<Settings>;
  /** Seed only the localStorage mirror (IndexedDB left empty). */
  mirrorOnly?: boolean;
}

/**
 * Loads the app from a known state. Storage is reset from a same-origin page that isn't the app,
 * so no open IndexedDB connection blocks the delete.
 */
export async function open(page: Page, seed: Seed = {}) {
  await page.goto('./favicon.svg');
  await page.evaluate(async (seed) => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase('tinylog');
      r.onsuccess = r.onerror = r.onblocked = () => res(null);
    });
    localStorage.setItem('tinylog:v1:settings', JSON.stringify({ tipsSeen: ['welcome', 'install', 'partner'], theme: 'dusk', ...seed.settings }));
    const events = seed.events ?? [];
    const notes = seed.notes ?? [];
    if (seed.mirrorOnly) {
      localStorage.setItem('tinylog:v1:mirror', JSON.stringify({ events, notes }));
      return;
    }
    if (!events.length && !notes.length) return;
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open('tinylog', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('events', { keyPath: 'id' });
        r.result.createObjectStore('notes', { keyPath: 'day' });
      };
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction(['events', 'notes'], 'readwrite');
        events.forEach((e) => tx.objectStore('events').put(e));
        notes.forEach((n) => tx.objectStore('notes').put(n));
        tx.oncomplete = () => {
          r.result.close();
          res();
        };
      };
    });
  }, seed);
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toBeAttached();
}

/** Events as persisted in IndexedDB. */
export async function storedEvents(page: Page): Promise<LogEvent[]> {
  return page.evaluate(
    () =>
      new Promise<LogEvent[]>((res, rej) => {
        const r = indexedDB.open('tinylog', 1);
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('events').objectStore('events').getAll();
          q.onsuccess = () => {
            r.result.close();
            res(q.result as LogEvent[]);
          };
        };
      }),
  );
}

export async function mirror(page: Page): Promise<{ events: LogEvent[]; notes: DayNote[] } | null> {
  await page.waitForTimeout(400);
  return page.evaluate(() => JSON.parse(localStorage.getItem('tinylog:v1:mirror') ?? 'null'));
}

export function ev(type: LogEvent['type'], at: number, extra: Partial<LogEvent> = {}): LogEvent {
  return { id: `e-${type}-${at}-${Math.random().toString(36).slice(2, 7)}`, type, at, createdAt: at, updatedAt: at, ...extra };
}

export const card = (page: Page, id: string) => page.locator(`[data-card="${id}"]`);
export const entries = (page: Page) => page.locator('#entries .entry');
export const toastEl = (page: Page) => page.locator('.toast:not(.leaving)');
