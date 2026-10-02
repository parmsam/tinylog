import { dayKey } from './days';
import type { LogEvent } from './types';

/**
 * Coins: one for every entry logged, counted on the day it was added. Derived from the log, never
 * stored, so undoing an entry takes its coin back and a merged export brings its coins along.
 * Nothing is ever lost for a day without entries: there are no streaks.
 */
export function coins(events: LogEvent[], now: number, dayStartHour: number): { today: number; total: number } {
  const day = dayKey(now, dayStartHour);
  let today = 0;
  let total = 0;
  for (const e of events) {
    if (e.deleted || e.type === 'note') continue;
    total++;
    if (dayKey(e.createdAt, dayStartHour) === day) today++;
  }
  return { today, total };
}
