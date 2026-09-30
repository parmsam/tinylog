import type { DayNote, EventType, LogData, LogEvent } from './types';

const TYPES: ReadonlySet<EventType> = new Set(['feed', 'diaper', 'sleep', 'tummy', 'pump', 'bath', 'doctor', 'note']);

export interface Backup extends LogData {
  app: 'tinylog';
  version: 1;
  exportedAt: number;
}

export function toBackup(data: LogData, now: number): Backup {
  return { app: 'tinylog', version: 1, exportedAt: now, events: data.events, notes: data.notes };
}

export function backupFilename(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `tinylog-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validEvent(e: unknown): e is LogEvent {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    !!x.id &&
    TYPES.has(x.type as EventType) &&
    isNum(x.at) &&
    (x.endAt === undefined || isNum(x.endAt)) &&
    isNum(x.createdAt) &&
    isNum(x.updatedAt) &&
    (x.detail === undefined || (typeof x.detail === 'object' && x.detail !== null))
  );
}

function validNote(n: unknown): n is DayNote {
  if (!n || typeof n !== 'object') return false;
  const x = n as Record<string, unknown>;
  return typeof x.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.day) && typeof x.text === 'string' && isNum(x.updatedAt);
}

export class BackupError extends Error {}

/** Parses an export. Invalid entries are skipped (and counted) rather than failing the whole import. */
export function parseBackup(text: string): LogData & { skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't valid JSON.");
  }
  const b = data as Partial<Backup>;
  if (!b || typeof b !== 'object' || b.app !== 'tinylog') throw new BackupError("That file isn't a tinylog export.");
  if (typeof b.version !== 'number' || b.version > 1) throw new BackupError('That export is from a newer version of tinylog. Update the app first.');
  const rawEvents = Array.isArray(b.events) ? b.events : [];
  const rawNotes = Array.isArray(b.notes) ? b.notes : [];
  const events = rawEvents.filter(validEvent);
  const notes = rawNotes.filter(validNote);
  return { events, notes, skipped: rawEvents.length - events.length + rawNotes.length - notes.length };
}
