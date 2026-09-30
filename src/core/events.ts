import type { Detail, EventType, LogData, LogEvent } from './types';

/** Types that run from a start to an end (tap to start, tap to stop). */
export const TIMED: ReadonlySet<EventType> = new Set(['sleep', 'tummy', 'pump', 'fussy']);

export const isOngoing = (e: LogEvent) => !e.deleted && TIMED.has(e.type) && e.endAt === undefined;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEvent(type: EventType, at: number, detail: Detail | undefined, now: number): LogEvent {
  const e: LogEvent = { id: newId(), type, at, createdAt: now, updatedAt: now };
  const clean = cleanDetail(detail);
  if (clean) e.detail = clean;
  return e;
}

/** Returns a new event with the patch applied and `updatedAt` bumped. */
export function patchEvent(e: LogEvent, patch: Partial<Omit<LogEvent, 'id' | 'createdAt'>>, now: number): LogEvent {
  const next: LogEvent = { ...e, ...patch, updatedAt: Math.max(now, e.updatedAt + 1) };
  if ('endAt' in patch && patch.endAt === undefined) delete next.endAt;
  if ('detail' in patch) {
    const clean = cleanDetail(patch.detail);
    if (clean) next.detail = clean;
    else delete next.detail;
  }
  return next;
}

/** Drops empty fields so stored events stay small and comparable. */
export function cleanDetail(d: Detail | undefined): Detail | undefined {
  if (!d) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) continue;
    out[k] = typeof v === 'string' ? v.trim() || undefined : v;
    if (out[k] === undefined) delete out[k];
  }
  return Object.keys(out).length ? (out as Detail) : undefined;
}

export interface MergeResult extends LogData {
  added: number;
  updated: number;
}

/**
 * Merges another copy of the log into ours: events by id and day notes by day, newest `updatedAt` wins.
 * Soft deletes merge like any edit, so a delete on one phone carries over. Merging the same data twice changes nothing.
 */
export function mergeData(ours: LogData, theirs: LogData): MergeResult {
  let added = 0;
  let updated = 0;
  const events = new Map(ours.events.map((e) => [e.id, e]));
  for (const e of theirs.events) {
    const mine = events.get(e.id);
    if (!mine) {
      events.set(e.id, e);
      if (!e.deleted) added++;
    } else if (e.updatedAt > mine.updatedAt) {
      events.set(e.id, e);
      updated++;
    }
  }
  const notes = new Map(ours.notes.map((n) => [n.day, n]));
  for (const n of theirs.notes) {
    const mine = notes.get(n.day);
    if (!mine) {
      notes.set(n.day, n);
      if (n.text) added++;
    } else if (n.updatedAt > mine.updatedAt) {
      notes.set(n.day, n);
      updated++;
    }
  }
  return {
    events: [...events.values()].sort((a, b) => a.at - b.at),
    notes: [...notes.values()].sort((a, b) => a.day.localeCompare(b.day)),
    added,
    updated,
  };
}
