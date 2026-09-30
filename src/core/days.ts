import type { LogEvent } from './types';
import { isOngoing } from './events';

/** Local day key (YYYY-MM-DD) for a time, where a day starts at `dayStartHour`. */
export function dayKey(ts: number, dayStartHour = 0): string {
  const d = new Date(ts);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  return keyOf(d);
}

function keyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m - 1, d];
}

/** [start, end) of a day in epoch ms. Built from calendar fields, so DST days are 23 or 25 hours. */
export function dayRange(key: string, dayStartHour = 0): [number, number] {
  const [y, m, d] = parts(key);
  return [new Date(y, m, d, dayStartHour).getTime(), new Date(y, m, d + 1, dayStartHour).getTime()];
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = parts(key);
  return keyOf(new Date(y, m, d + n));
}

/** Noon-anchored Date for display (weekday, month), independent of day start. */
export function dayDate(key: string): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m, d, 12);
}

/** When an event ends for display purposes: ongoing ones run until `now`. */
export function spanEnd(e: LogEvent, now: number): number {
  if (e.endAt !== undefined) return e.endAt;
  return isOngoing(e) ? Math.max(now, e.at) : e.at;
}

/** Events that touch a day: instant ones inside it, timed ones overlapping it (a night sleep shows on both days). */
export function eventsForDay(events: LogEvent[], key: string, dayStartHour: number, now: number): LogEvent[] {
  const [start, end] = dayRange(key, dayStartHour);
  return events.filter((e) => {
    if (e.deleted) return false;
    const stop = spanEnd(e, now);
    if (stop === e.at) return e.at >= start && e.at < end;
    return e.at < end && stop > start;
  });
}

/** Milliseconds of an event that fall inside [start, end). */
export function overlap(e: LogEvent, start: number, end: number, now: number): number {
  return Math.max(0, Math.min(spanEnd(e, now), end) - Math.max(e.at, start));
}
