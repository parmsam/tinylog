import { addDays, dayDate, dayRange, eventsForDay, spanEnd } from '../core/days';
import { clockTime, duration } from '../core/format';
import type { LogEvent, Settings } from '../core/types';
import { arcPath, frac, hourLabel, hourMarks, polar } from './geom';

type Prefs = Pick<Settings, 'clock' | 'dayStartHour'>;

const C = 160;
const OUTER = 146;
const STEP = 14;

const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Seven concentric 24-hour rings, today outermost. Sleep arcs from each day line up,
 * so a settling rhythm shows as arcs stacking into bands. Feeds are small dots on each ring.
 */
export function weekRingsSvg(events: LogEvent[], lastDay: string, now: number, prefs: Prefs, days = 7): string {
  const parts: string[] = [];
  const [s0, e0] = dayRange(lastDay, prefs.dayStartHour);

  for (const m of hourMarks(s0, e0).filter((_, i) => i % 6 === 0)) {
    const f = frac(m.ts, s0, e0);
    const [x0, y0] = polar(C, C, OUTER - (days - 1) * STEP - 8, f);
    const [x1, y1] = polar(C, C, OUTER + 8, f);
    const [lx, ly] = polar(C, C, OUTER + 20, f);
    parts.push(
      `<line x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(x1)}" y2="${r1(y1)}" class="wr-spoke" /><text x="${r1(lx)}" y="${r1(ly)}" text-anchor="middle" dominant-baseline="central" class="wr-hour">${hourLabel(m.hour, prefs.clock)}</text>`,
    );
  }

  for (let i = 0; i < days; i++) {
    const day = addDays(lastDay, -i);
    const r = OUTER - i * STEP;
    const [start, end] = dayRange(day, prefs.dayStartHour);
    const f = (ts: number) => frac(ts, start, end);
    const list = eventsForDay(events, day, prefs.dayStartHour, now);
    const ring: string[] = [`<circle cx="${C}" cy="${C}" r="${r}" class="wr-track" />`];
    for (const e of list.filter((e) => e.type === 'sleep')) {
      const a = f(e.at);
      const b = Math.max(f(spanEnd(e, now)), a + 0.004);
      const tip = `🌙 ${e.detail?.sleep === 'night' ? 'Night sleep' : 'Nap'} · ${dayDate(day).toLocaleDateString(undefined, { weekday: 'short' })} · ${clockTime(e.at, prefs.clock)}–${clockTime(spanEnd(e, now), prefs.clock)} (${duration(spanEnd(e, now) - e.at)})`;
      ring.push(`<path d="${arcPath(C, C, r, a, b)}" class="wr-sleep" data-tip="${esc(tip)}" />`);
    }
    for (const e of list.filter((e) => e.type === 'feed')) {
      const [x, y] = polar(C, C, r, f(e.at));
      ring.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" class="wr-feed" data-tip="${esc(`🍼 Feed · ${clockTime(e.at, prefs.clock)}`)}" />`);
    }
    const d = dayDate(day);
    ring.push(
      `<text x="${C - 5}" y="${C - r}" text-anchor="end" dominant-baseline="central" class="wr-day">${i === 0 ? 'today' : d.toLocaleDateString(undefined, { weekday: 'narrow' })}</text>`,
    );
    parts.push(`<g class="wr-ring">${ring.join('')}</g>`);
  }
  return `<svg viewBox="-16 -16 352 352" class="rings" role="img" aria-label="Sleep for the last ${days} days as rings, today outermost. The daily totals table below has the same information.">${parts.join('')}</svg>`;
}
