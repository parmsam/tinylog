import { addDays, dayKey, dayRange } from './days';
import type { LogEvent } from './types';

const HOUR = 3_600_000;

export type HeatColumn = 'feed' | 'wet' | 'dirty' | 'sleep' | 'tummy' | 'pump';

export const HEAT_COLUMNS: { id: HeatColumn; label: string; emoji: string; kind: 'count' | 'minutes' }[] = [
  { id: 'feed', label: 'Feeds', emoji: '🍼', kind: 'count' },
  { id: 'wet', label: 'Wet', emoji: '💧', kind: 'count' },
  { id: 'dirty', label: 'Dirty', emoji: '💩', kind: 'count' },
  { id: 'sleep', label: 'Sleep', emoji: '😴', kind: 'minutes' },
  { id: 'tummy', label: 'Tummy', emoji: '🤸', kind: 'minutes' },
  { id: 'pump', label: 'Pump', emoji: '🫗', kind: 'minutes' },
];

export interface HeatCell {
  /** Per day: events per day for counts, minutes of the hour for durations. */
  value: number;
  /** Days that contributed to this hour (today counts only for hours that have started). */
  days: number;
  /** 0 = nothing, 1–5 = quantized intensity within the column. */
  level: number;
}

export interface Heatmap {
  /** Clock hours in row order, starting at the day-start hour. */
  hours: number[];
  cells: Record<HeatColumn, HeatCell[]>;
  /** Days actually covered (the range, trimmed to when logging began). */
  days: number;
  fromDay: string;
}

function columnsFor(e: LogEvent): HeatColumn[] {
  switch (e.type) {
    case 'feed':
      return ['feed'];
    case 'diaper': {
      const d = e.detail?.diaper;
      return d === 'both' ? ['wet', 'dirty'] : d === 'dirty' ? ['dirty'] : ['wet'];
    }
    case 'sleep':
    case 'tummy':
    case 'pump':
      return [e.type];
    default:
      return [];
  }
}

/**
 * Time-of-day heatmap over the last `days` days (ending `lastDay`): for each clock hour and category,
 * how often it happens (counts per day) or how much of the hour it fills (minutes per day).
 * Days before the first entry are left out so a new log isn't diluted.
 */
export function hourHeatmap(events: LogEvent[], lastDay: string, days: number, dayStartHour: number, now: number): Heatmap {
  const live = events.filter((e) => !e.deleted);
  const first = live.reduce((m, e) => Math.min(m, e.at), Infinity);
  let fromDay = addDays(lastDay, -(days - 1));
  if (Number.isFinite(first)) {
    const firstDay = dayKey(first, dayStartHour);
    if (firstDay > fromDay) fromDay = firstDay > lastDay ? lastDay : firstDay;
  }
  const [rangeStart] = dayRange(fromDay, dayStartHour);
  const [, rangeEnd] = dayRange(lastDay, dayStartHour);
  const end = Math.min(rangeEnd, now);

  const hours = Array.from({ length: 24 }, (_, i) => (dayStartHour + i) % 24);
  const sums = Object.fromEntries(HEAT_COLUMNS.map((c) => [c.id, new Array<number>(24).fill(0)])) as Record<HeatColumn, number[]>;

  // How many days each clock hour was "available" (so today's future hours don't drag averages down).
  const denom = new Array<number>(24).fill(0);
  let covered = 0;
  for (let day = fromDay; day <= lastDay; day = addDays(day, 1)) {
    covered++;
    const [s, e] = dayRange(day, dayStartHour);
    for (let t = s; t < e; t += HOUR) if (t < now) denom[new Date(t).getHours()]++;
  }

  for (const e of live) {
    const cols = columnsFor(e);
    if (!cols.length) continue;
    const col = HEAT_COLUMNS.find((c) => c.id === cols[0])!;
    if (col.kind === 'count') {
      if (e.at < rangeStart || e.at >= end) continue;
      const h = new Date(e.at).getHours();
      for (const c of cols) sums[c][h]++;
    } else {
      // Spread a sleep/tummy/pump over the clock hours it covers, in minutes.
      const a = Math.max(e.at, rangeStart);
      const b = Math.min(e.endAt ?? now, end);
      for (let t = a; t < b; ) {
        const d = new Date(t);
        d.setMinutes(0, 0, 0);
        const next = Math.min(d.getTime() + HOUR, b);
        sums[col.id][new Date(t).getHours()] += (next - t) / 60_000;
        t = next;
      }
    }
  }

  const cells = {} as Record<HeatColumn, HeatCell[]>;
  for (const c of HEAT_COLUMNS) {
    const values = hours.map((h) => (denom[h] ? sums[c.id][h] / denom[h] : 0));
    // Sleep is measured against the whole hour (60 min = always asleep); the rest against their own busiest hour.
    const max = c.id === 'sleep' ? 60 : Math.max(...values);
    cells[c.id] = hours.map((h, i) => {
      const v = values[i];
      const level = v <= 0 || max <= 0 ? 0 : Math.max(1, Math.min(5, Math.ceil((v / max) * 5)));
      return { value: v, days: denom[h], level };
    });
  }
  return { hours, cells, days: covered, fromDay };
}
