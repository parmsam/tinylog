import { mergeData } from './events';
import type { DayNote, LogData, LogEvent } from './types';

/**
 * Where the log lives. IndexedDB is primary; localStorage keeps a full mirror as a second on-device copy.
 * Loading merges both, so data missing from one side (evicted, private mode, a bug) comes back from the other.
 */

const DB_NAME = 'tinylog';
const DB_VERSION = 1;
export const MIRROR_KEY = 'tinylog:v1:mirror';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'day' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function readIdb(): Promise<LogData | null> {
  try {
    const db = await openDb();
    const [events, notes] = await Promise.all([getAll<LogEvent>(db, 'events'), getAll<DayNote>(db, 'notes')]);
    return { events, notes };
  } catch (err) {
    console.warn('tinylog: IndexedDB read failed', err);
    return null;
  }
}

export async function writeIdb(events: LogEvent[], notes: DayNote[] = []): Promise<boolean> {
  if (!events.length && !notes.length) return true;
  try {
    const db = await openDb();
    const tx = db.transaction(['events', 'notes'], 'readwrite');
    const es = tx.objectStore('events');
    const ns = tx.objectStore('notes');
    events.forEach((e) => es.put(e));
    notes.forEach((n) => ns.put(n));
    await done(tx);
    return true;
  } catch (err) {
    console.warn('tinylog: IndexedDB write failed', err);
    return false;
  }
}

export function readMirror(): LogData | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<LogData>;
    return { events: Array.isArray(data.events) ? data.events : [], notes: Array.isArray(data.notes) ? data.notes : [] };
  } catch {
    return null;
  }
}

/** Returns false if the mirror couldn't be written (quota, disabled storage). */
export function writeMirror(data: LogData): boolean {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ events: data.events, notes: data.notes }));
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult extends LogData {
  /** Items the mirror had that IndexedDB didn't (and were written back). */
  restored: number;
  idbOk: boolean;
}

export async function loadAll(): Promise<LoadResult> {
  const idb = await readIdb();
  const mirror = readMirror() ?? { events: [], notes: [] };
  const base = idb ?? { events: [], notes: [] };
  const merged = mergeData(base, mirror);
  const restored = merged.added + merged.updated;
  if (idb && restored) {
    const ids = new Set(base.events.map((e) => `${e.id}:${e.updatedAt}`));
    const days = new Set(base.notes.map((n) => `${n.day}:${n.updatedAt}`));
    await writeIdb(
      merged.events.filter((e) => !ids.has(`${e.id}:${e.updatedAt}`)),
      merged.notes.filter((n) => !days.has(`${n.day}:${n.updatedAt}`)),
    );
  }
  return { events: merged.events, notes: merged.notes, restored: idb ? restored : 0, idbOk: !!idb };
}

/** For tests: forget the open connection. */
export function _resetDb() {
  dbPromise?.then((db) => db.close()).catch(() => {});
  dbPromise = null;
}
