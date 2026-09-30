import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDb, loadAll, MIRROR_KEY, readMirror, writeIdb, writeMirror } from './db';
import { createEvent, patchEvent } from './events';

beforeEach(() => {
  _resetDb();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

describe('db', () => {
  it('stores events and notes in IndexedDB', async () => {
    const e = createEvent('feed', 1, undefined, 1);
    await writeIdb([e], [{ day: '2026-09-30', text: 'hi', updatedAt: 1 }]);
    const data = await loadAll();
    expect(data.events).toEqual([e]);
    expect(data.notes[0].text).toBe('hi');
    expect(data.restored).toBe(0);
  });

  it('restores from the localStorage mirror when IndexedDB lost data, and writes it back', async () => {
    const a = createEvent('feed', 1, undefined, 1);
    const b = createEvent('bath', 2, undefined, 2);
    await writeIdb([a]);
    writeMirror({ events: [a, b], notes: [] });
    const data = await loadAll();
    expect(data.events.map((e) => e.id)).toEqual([a.id, b.id]);
    expect(data.restored).toBe(1);

    _resetDb();
    localStorage.clear();
    expect((await loadAll()).events).toHaveLength(2);
  });

  it('prefers the newer copy of an event', async () => {
    const a = createEvent('feed', 1, { method: 'bottle', amount: 60 }, 1);
    const newer = patchEvent(a, { detail: { method: 'bottle', amount: 90 } }, 5);
    await writeIdb([newer]);
    writeMirror({ events: [a], notes: [] });
    expect((await loadAll()).events[0].detail?.amount).toBe(90);
  });

  it('falls back to the mirror when IndexedDB is unavailable', async () => {
    const a = createEvent('feed', 1, undefined, 1);
    writeMirror({ events: [a], notes: [] });
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    const data = await loadAll();
    expect(data.idbOk).toBe(false);
    expect(data.events).toEqual([a]);
  });

  it('survives a corrupt mirror', async () => {
    localStorage.setItem(MIRROR_KEY, '{oops');
    expect(readMirror()).toBeNull();
    expect((await loadAll()).events).toEqual([]);
  });
});
