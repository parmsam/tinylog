/** Geometry for the 24-hour charts. Pure functions, so they're easy to test. */

export const TAU = Math.PI * 2;
const HOUR = 3_600_000;

/** Where a time falls in a day window, 0–1 (clamped). DST days just stretch or squeeze to fit. */
export function frac(ts: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (ts - start) / (end - start)));
}

/** Point on a circle. f = 0 is the top (the day's start), going clockwise. */
export function polar(cx: number, cy: number, r: number, f: number): [number, number] {
  const a = f * TAU - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const n = (v: number) => Math.round(v * 100) / 100;

/** SVG path for an arc stroke from f0 to f1 (0–1 of a full turn). A full turn is drawn as two halves. */
export function arcPath(cx: number, cy: number, r: number, f0: number, f1: number): string {
  const span = Math.max(0, Math.min(f1 - f0, 1));
  if (span >= 0.999) {
    const [x0, y0] = polar(cx, cy, r, f0);
    const [xm, ym] = polar(cx, cy, r, f0 + 0.5);
    return `M${n(x0)} ${n(y0)}A${r} ${r} 0 1 1 ${n(xm)} ${n(ym)}A${r} ${r} 0 1 1 ${n(x0)} ${n(y0)}`;
  }
  const [x0, y0] = polar(cx, cy, r, f0);
  const [x1, y1] = polar(cx, cy, r, f0 + span);
  const large = span > 0.5 ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${r} ${r} 0 ${large} 1 ${n(x1)} ${n(y1)}`;
}

/** Hour marks for a day window: the real clock hours inside it (23 or 25 on DST days). */
export function hourMarks(start: number, end: number): { ts: number; hour: number }[] {
  const out: { ts: number; hour: number }[] = [];
  const d = new Date(start);
  d.setMinutes(0, 0, 0);
  let ts = d.getTime() < start ? d.getTime() + HOUR : d.getTime();
  // Step in real hours (not setHours), so the repeated hour when clocks fall back is kept.
  for (; ts < end; ts += HOUR) out.push({ ts, hour: new Date(ts).getHours() });
  return out;
}

export function hourLabel(hour: number, clock: 'auto' | '12h' | '24h'): string {
  const h12 = clock === '12h' || (clock === 'auto' && new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12);
  if (!h12) return String(hour).padStart(2, '0');
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}
