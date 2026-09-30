import { dayTotals, type DayTotals } from './daily';
import { addDays, dayKey, dayRange, eventsForDay, spanEnd } from './days';
import type { DayNote, LogEvent } from './types';

/** Everything the end-of-day recap card shows. Derived, descriptive, never a score. */
export interface Recap {
  day: string;
  inProgress: boolean;
  totals: DayTotals;
  events: LogEvent[];
  /** Longest single sleep that ended in (or runs into) this day. */
  longest: { ms: number; from: number; to: number } | null;
  /** True when that stretch is the longest of the last 7 days (and there are at least 3 days to compare). */
  longestOfWeek: boolean;
  note: string;
}

function longestSleep(events: LogEvent[], day: string, dayStartHour: number, now: number) {
  let best: Recap['longest'] = null;
  for (const e of eventsForDay(events, day, dayStartHour, now)) {
    if (e.type !== 'sleep' || e.endAt === undefined) continue;
    const ms = e.endAt - e.at;
    if (!best || ms > best.ms) best = { ms, from: e.at, to: spanEnd(e, now) };
  }
  return best;
}

export function recap(events: LogEvent[], notes: Record<string, DayNote>, day: string, dayStartHour: number, now: number): Recap {
  const live = events.filter((e) => !e.deleted);
  const longest = longestSleep(live, day, dayStartHour, now);
  let longestOfWeek = false;
  if (longest) {
    const first = live.reduce((m, e) => Math.min(m, e.at), Infinity);
    const firstDay = Number.isFinite(first) ? dayKey(first, dayStartHour) : day;
    const others: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = addDays(day, -i);
      if (d < firstDay) break;
      others.push(longestSleep(live, d, dayStartHour, now)?.ms ?? 0);
    }
    longestOfWeek = others.length >= 2 && others.every((ms) => longest.ms > ms);
  }
  const [, end] = dayRange(day, dayStartHour);
  return {
    day,
    inProgress: now < end,
    totals: dayTotals(live, day, dayStartHour, now),
    events: eventsForDay(live, day, dayStartHour, now),
    longest,
    longestOfWeek,
    note: notes[day]?.text?.trim() ?? '',
  };
}
