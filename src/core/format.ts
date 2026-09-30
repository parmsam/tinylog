import type { ClockFormat, Units } from './types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "42m", "1h 38m", "2d 3h". Under a minute is "<1m". */
export function duration(ms: number): string {
  ms = Math.max(0, ms);
  if (ms < MIN) return '<1m';
  if (ms < HOUR) return `${Math.floor(ms / MIN)}m`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.floor((ms % HOUR) / MIN);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Running timer style: "4:07", "1:02:33". */
export function stopwatch(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function ago(ts: number, now: number): string {
  if (now - ts < MIN) return 'just now';
  return `${duration(now - ts)} ago`;
}

export function until(ts: number, now: number): string {
  const ms = ts - now;
  if (ms < HOUR) return `in ${duration(ms)}`;
  const days = Math.round(ms / DAY);
  if (ms >= DAY) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `in ${duration(ms)}`;
}

function hour12(clock: ClockFormat): boolean | undefined {
  return clock === 'auto' ? undefined : clock === '12h';
}

export function clockTime(ts: number, clock: ClockFormat = 'auto'): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: hour12(clock) });
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dayTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const ML_PER_OZ = 29.5735;

export function amount(ml: number, units: Units): string {
  if (units === 'oz') {
    const oz = Math.round((ml / ML_PER_OZ) * 10) / 10;
    return `${oz} oz`;
  }
  return `${Math.round(ml)} ml`;
}

/** Converts a number typed in the user's unit to ml. */
export function toMl(value: number, units: Units): number {
  return units === 'oz' ? Math.round(value * ML_PER_OZ) : Math.round(value);
}

export function fromMl(ml: number, units: Units): number {
  return units === 'oz' ? Math.round((ml / ML_PER_OZ) * 10) / 10 : Math.round(ml);
}

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : undefined;
}
