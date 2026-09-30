import { dayRange, overlap } from './days';
import type { LogEvent } from './types';

/** Everything a day adds up to. All derived from the log; nothing here is stored. */
export interface DayTotals {
  day: string;
  feeds: number;
  breastFeeds: number;
  bottleMl: number;
  wet: number;
  dirty: number;
  /** Sleep inside the day's window (a night that crosses the boundary is split). */
  sleepMs: number;
  napMs: number;
  naps: number;
  nightMs: number;
  tummyMs: number;
  /** Time logged as fussy, and how many spells started in the day. */
  fussyMs: number;
  fussies: number;
  pumps: number;
  pumpMl: number;
  baths: number;
  doctor: number;
}

export function dayTotals(events: LogEvent[], day: string, dayStartHour: number, now: number): DayTotals {
  const [start, end] = dayRange(day, dayStartHour);
  const t: DayTotals = {
    day,
    feeds: 0,
    breastFeeds: 0,
    bottleMl: 0,
    wet: 0,
    dirty: 0,
    sleepMs: 0,
    napMs: 0,
    naps: 0,
    nightMs: 0,
    tummyMs: 0,
    fussyMs: 0,
    fussies: 0,
    pumps: 0,
    pumpMl: 0,
    baths: 0,
    doctor: 0,
  };
  for (const e of events) {
    if (e.deleted) continue;
    const starts = e.at >= start && e.at < end;
    const d = e.detail ?? {};
    switch (e.type) {
      case 'feed':
        if (!starts) break;
        t.feeds++;
        if (d.method === 'bottle') t.bottleMl += d.amount ?? 0;
        else t.breastFeeds++;
        break;
      case 'diaper':
        if (!starts) break;
        if (d.diaper !== 'dirty') t.wet++;
        if (d.diaper === 'dirty' || d.diaper === 'both') t.dirty++;
        break;
      case 'sleep': {
        const ms = overlap(e, start, end, now);
        t.sleepMs += ms;
        if (d.sleep === 'night') t.nightMs += ms;
        else {
          t.napMs += ms;
          if (starts) t.naps++;
        }
        break;
      }
      case 'tummy':
        t.tummyMs += overlap(e, start, end, now);
        break;
      case 'fussy':
        t.fussyMs += overlap(e, start, end, now);
        if (starts) t.fussies++;
        break;
      case 'pump':
        if (!starts) break;
        t.pumps++;
        t.pumpMl += d.amount ?? 0;
        break;
      case 'bath':
        if (starts) t.baths++;
        break;
      case 'doctor':
        if (starts) t.doctor++;
        break;
    }
  }
  return t;
}
