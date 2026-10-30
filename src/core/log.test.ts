import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDb, loadAll, readMirror, writeIdb } from './db';
import { createEvent } from './events';
import { addEvent, app, deleteEvent, flushMirror, init, setupPersistence } from './log';

setupPersistence();

beforeEach(() => {
  _resetDb();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  app.set({ events: [], notes: {}, loaded: false });
});

describe('log', () => {
  // Regression: a feed tapped while the app was still opening vanished once the stored log arrived.
  it('keeps entries logged while the stored log is still loading', async () => {
    const old = createEvent('diaper', 1, undefined, 1);
    await writeIdb([old]);
    _resetDb();

    const loading = init();
    const early = addEvent(createEvent('feed', 2, undefined, 2));
    await loading;

    expect(app.get().events.map((e) => e.id).sort()).toEqual([old.id, early.id].sort());
    flushMirror();
    expect(readMirror()!.events.map((e) => e.id)).toContain(early.id);
  });

  it('a change made while loading wins over the older stored copy', async () => {
    const e = createEvent('feed', 1, undefined, 1);
    await writeIdb([e]);
    _resetDb();
    app.set({ events: [e] });

    const loading = init();
    deleteEvent(e.id, 5);
    await loading;

    expect(app.get().events.find((x) => x.id === e.id)?.deleted).toBe(true);
  });

  // Regression: the localStorage copy was written 250 ms after a tap, so locking the phone right away could lose it.
  it('writes the backup copy as soon as the page is hidden', async () => {
    await init();
    const e = addEvent(createEvent('feed', 3, undefined, 3));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(readMirror()?.events.map((x) => x.id)).toContain(e.id);
    expect((await loadAll()).events.map((x) => x.id)).toContain(e.id);
  });
});
