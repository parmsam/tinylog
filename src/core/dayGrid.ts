import { dayRange, eventsForDay, spanEnd } from './days';
import type { HeatColumn } from './heatmap';
import type { LogEvent } from './types';

const HOUR = 3_600_000;

/** Where in the hour something falls, as 0–1 across the cell. */
export interface GridSegment {
  from: number;
  to: number;
  event: LogEvent;
}
export interface GridMark {
  at: number;
  event: LogEvent;
}
export interface GridCell {
  segments: GridSegment[];
  marks: GridMark[];
}
export interface GridRow {
  hour: number;
  start: number;
  cells: Record<HeatColumn, GridCell>;
  /** Fraction of this hour that has passed, if "now" is inside it. */
  now?: number;
  future: boolean;
}

const COLS: HeatColumn[] = ['feed', 'wet', 'dirty', 'sleep', 'tummy', 'pump'];

function empty(): Record<HeatColumn, GridCell> {
  return Object.fromEntries(COLS.map((c) => [c, { segments: [], marks: [] }])) as unknown as Record<HeatColumn, GridCell>;
}

/**
 * One day as a grid: a row per real clock hour (23 or 25 on DST days), a column per category.
 * Timed things become segments inside the hours they cover; instant things become marks at their minute.
 */
export function dayGrid(events: LogEvent[], day: string, dayStartHour: number, now: number): GridRow[] {
  const [start, end] = dayRange(day, dayStartHour);
  const rows: GridRow[] = [];
  const first = new Date(start);
  first.setMinutes(0, 0, 0);
  for (let t = first.getTime(); t < end; t += HOUR) {
    rows.push({
      hour: new Date(t).getHours(),
      start: t,
      cells: empty(),
      now: now >= t && now < t + HOUR ? (now - t) / HOUR : undefined,
      future: t > now,
    });
  }
  const rowAt = (ts: number) => rows[Math.min(rows.length - 1, Math.max(0, Math.floor((ts - rows[0].start) / HOUR)))];

  for (const e of eventsForDay(events, day, dayStartHour, now)) {
    if (e.type === 'feed' || e.type === 'diaper') {
      if (e.at < start || e.at >= end) continue;
      const row = rowAt(e.at);
      const mark = { at: (e.at - row.start) / HOUR, event: e };
      if (e.type === 'feed') row.cells.feed.marks.push(mark);
      else {
        const d = e.detail?.diaper;
        if (d !== 'dirty') row.cells.wet.marks.push(mark);
        if (d === 'dirty' || d === 'both') row.cells.dirty.marks.push(mark);
      }
    } else if (e.type === 'sleep' || e.type === 'tummy' || e.type === 'pump') {
      const a = Math.max(e.at, start);
      const b = Math.min(spanEnd(e, now), end);
      for (const row of rows) {
        const s = Math.max(a, row.start);
        const f = Math.min(b, row.start + HOUR);
        if (f > s || (f === s && a === b && s >= row.start && s < row.start + HOUR)) {
          row.cells[e.type].segments.push({ from: (s - row.start) / HOUR, to: Math.max((f - row.start) / HOUR, (s - row.start) / HOUR + 0.02), event: e });
        }
      }
    }
  }
  return rows;
}
