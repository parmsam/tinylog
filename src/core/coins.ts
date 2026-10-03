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

/** Coins earned before `at` (e.g. the start of a day), for what was unlocked by then. */
export function coinsBefore(events: LogEvent[], at: number): number {
  let n = 0;
  for (const e of events) if (!e.deleted && e.type !== 'note' && e.createdAt < at) n++;
  return n;
}

/** All-time totals worth a celebration (each brings a reward: companion/rewards.ts). */
export const COIN_MILESTONES = [1, 50, 100, 250, 500, 1000, 2500, 5000, 10_000];

/** The milestone passed going from `prev` to `next` coins (the biggest, if several), if any. */
export function milestonePassed(prev: number, next: number): number | undefined {
  return COIN_MILESTONES.filter((m) => prev < m && m <= next).pop();
}

export const nextMilestone = (total: number) => COIN_MILESTONES.find((m) => m > total);
