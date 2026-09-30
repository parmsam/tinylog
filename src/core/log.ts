import { loadAll, writeIdb, writeMirror } from './db';
import { dayKey } from './days';
import { mergeData, patchEvent } from './events';
import { loadSettings, saveSettings } from './settings';
import { createStore, persist } from './store';
import type { DayNote, LogData, LogEvent, Settings } from './types';

/** The app's data, in memory. Every change goes through the functions below, which also persist it. */
export interface AppState {
  events: LogEvent[];
  notes: Record<string, DayNote>;
  /** The day being viewed (YYYY-MM-DD). */
  day: string;
  loaded: boolean;
  /** False if the last localStorage mirror write failed. */
  mirrorOk: boolean;
  /** False if IndexedDB couldn't be opened or written (the mirror still has the data). */
  idbOk: boolean;
}

export const settings = createStore<Settings>(loadSettings());

export const app = createStore<AppState>({
  events: [],
  notes: {},
  day: dayKey(Date.now(), settings.get().dayStartHour),
  loaded: false,
  mirrorOk: true,
  idbOk: true,
});

export function setupPersistence() {
  persist(settings, saveSettings);
  window.addEventListener('pagehide', flushMirror);
}

export const today = (now = Date.now()) => dayKey(now, settings.get().dayStartHour);

export async function init(): Promise<{ restored: number }> {
  const data = await loadAll();
  app.set({
    events: data.events,
    notes: Object.fromEntries(data.notes.map((n) => [n.day, n])),
    loaded: true,
    idbOk: data.idbOk,
  });
  if (data.restored || !data.idbOk) scheduleMirror();
  return { restored: data.restored };
}

export function snapshot(): LogData {
  const s = app.get();
  return { events: s.events, notes: Object.values(s.notes) };
}

let mirrorTimer: number | undefined;
function scheduleMirror() {
  if (mirrorTimer === undefined) mirrorTimer = window.setTimeout(flushMirror, 250);
}
export function flushMirror() {
  if (mirrorTimer !== undefined) clearTimeout(mirrorTimer);
  mirrorTimer = undefined;
  const ok = writeMirror(snapshot());
  if (ok !== app.get().mirrorOk) app.set({ mirrorOk: ok });
}

function save(events: LogEvent[], notes: DayNote[] = []) {
  void writeIdb(events, notes).then((ok) => {
    if (ok !== app.get().idbOk) app.set({ idbOk: ok });
  });
  scheduleMirror();
}

function put(changed: LogEvent[]) {
  const byId = new Map(changed.map((e) => [e.id, e]));
  const events = app.get().events.map((e) => byId.get(e.id) ?? e);
  const known = new Set(events.map((e) => e.id));
  for (const e of changed) if (!known.has(e.id)) events.push(e);
  app.set({ events });
  save(changed);
}

export function getEvent(id: string): LogEvent | undefined {
  return app.get().events.find((e) => e.id === id);
}

export function addEvent(e: LogEvent): LogEvent {
  put([e]);
  return e;
}

export function updateEvent(id: string, patch: Parameters<typeof patchEvent>[1], now = Date.now()): LogEvent | undefined {
  const e = getEvent(id);
  if (!e) return undefined;
  const next = patchEvent(e, patch, now);
  put([next]);
  return next;
}

export function deleteEvent(id: string, now = Date.now()) {
  return updateEvent(id, { deleted: true }, now);
}

/** Undo: put an earlier version back. It gets a fresh `updatedAt` so the undo wins when merged elsewhere. */
export function revertTo(prev: LogEvent, now = Date.now()) {
  const cur = getEvent(prev.id);
  put([{ ...prev, updatedAt: Math.max(now, (cur?.updatedAt ?? 0) + 1) }]);
}

export function setNote(day: string, text: string, now = Date.now()) {
  const cur = app.get().notes[day];
  if ((cur?.text ?? '') === text) return;
  const note: DayNote = { day, text, updatedAt: Math.max(now, (cur?.updatedAt ?? 0) + 1) };
  app.set({ notes: { ...app.get().notes, [day]: note } });
  save([], [note]);
}

/** Merges another phone's export into this one. */
export async function importData(data: LogData): Promise<{ added: number; updated: number }> {
  const before = snapshot();
  const merged = mergeData(before, data);
  const oldEvents = new Map(before.events.map((e) => [e.id, e.updatedAt]));
  const oldNotes = new Map(before.notes.map((n) => [n.day, n.updatedAt]));
  const changedEvents = merged.events.filter((e) => oldEvents.get(e.id) !== e.updatedAt);
  const changedNotes = merged.notes.filter((n) => oldNotes.get(n.day) !== n.updatedAt);
  app.set({ events: merged.events, notes: Object.fromEntries(merged.notes.map((n) => [n.day, n])) });
  const ok = await writeIdb(changedEvents, changedNotes);
  app.set({ idbOk: ok });
  flushMirror();
  return { added: merged.added, updated: merged.updated };
}
