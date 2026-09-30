import { cardFor } from '../core/cards';
import { addDays, dayDate, dayRange, eventsForDay, spanEnd } from '../core/days';
import { isOngoing } from '../core/events';
import { clockTime, duration } from '../core/format';
import { summary } from '../core/status';
import type { LogEvent, Settings } from '../core/types';
import { frac, hourLabel, hourMarks } from './geom';

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour'>;

const W = 360;
const X0 = 50;
const X1 = W - 8;
const ROW = 32;
const TOP = 22;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const r1 = (v: number) => Math.round(v * 10) / 10;

function tip(e: LogEvent, prefs: Prefs, now: number, clippedStart: boolean): string {
  const card = cardFor(e)!;
  const t = (ts: number) => clockTime(ts, prefs.clock);
  const label = e.type === 'diaper' ? `${summary(e, prefs)} diaper` : card.label;
  const when = card.timed
    ? isOngoing(e)
      ? `since ${t(e.at)} (${duration(now - e.at)})`
      : `${t(e.at)}${clippedStart ? ' (prev. day)' : ''}–${t(spanEnd(e, now))} (${duration(spanEnd(e, now) - e.at)})`
    : t(e.at);
  const s = e.type === 'diaper' ? '' : summary(e, prefs);
  return [`${card.emoji} ${label}`, when, s, e.detail?.note].filter(Boolean).join(' · ');
}

/**
 * The classic sleep log: one row per day (newest on top), 24 hours across.
 * Each row has three lanes: sleep bars, feed ticks, diaper dots (hollow = wet, filled = dirty).
 */
export function dayStripSvg(events: LogEvent[], lastDay: string, days: number, now: number, prefs: Prefs): string {
  const h = TOP + days * ROW + 4;
  const x = (f: number) => r1(X0 + f * (X1 - X0));
  const parts: string[] = [];

  // Hour grid from the most recent day's window (hours line up across days).
  const [s0, e0] = dayRange(lastDay, prefs.dayStartHour);
  const marks = hourMarks(s0, e0).filter((m) => m.hour % 3 === prefs.dayStartHour % 3);
  parts.push(
    `<g class="ds-grid">${marks
      .map((m) => {
        const gx = x(frac(m.ts, s0, e0));
        const major = (m.hour - prefs.dayStartHour + 24) % 6 === 0;
        return `<line x1="${gx}" y1="${TOP - 4}" x2="${gx}" y2="${h - 4}" class="${major ? 'major' : ''}" />${
          major ? `<text x="${gx}" y="${TOP - 10}" text-anchor="middle">${hourLabel(m.hour, prefs.clock)}</text>` : ''
        }`;
      })
      .join('')}</g>`,
  );

  for (let i = 0; i < days; i++) {
    const day = addDays(lastDay, -i);
    const y = TOP + i * ROW;
    const [start, end] = dayRange(day, prefs.dayStartHour);
    const f = (ts: number) => frac(ts, start, end);
    const d = dayDate(day);
    const label = `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
    const row: string[] = [`<text x="${X0 - 8}" y="${y + 12}" text-anchor="end" class="ds-day">${label}</text>`];
    row.push(`<rect x="${X0}" y="${y + 3}" width="${X1 - X0}" height="12" rx="4" class="ds-track" />`);
    for (const e of eventsForDay(events, day, prefs.dayStartHour, now).sort((a, b) => a.at - b.at)) {
      const t = `data-tip="${esc(tip(e, prefs, now, e.at < start))}"`;
      if (e.type === 'sleep') {
        const a = x(f(e.at));
        const b = Math.max(x(f(spanEnd(e, now))), a + 2);
        row.push(
          `<g ${t} class="ds-mark"><rect x="${a}" y="${y}" width="${r1(b - a)}" height="18" class="ds-hit" /><rect x="${a}" y="${y + 3}" width="${r1(b - a)}" height="12" rx="3" class="ds-sleep ${e.detail?.sleep === 'night' ? 'night' : 'nap'}" /></g>`,
        );
      } else if (e.type === 'feed') {
        const fx = x(f(e.at));
        row.push(`<g ${t} class="ds-mark"><rect x="${fx - 5}" y="${y + 15}" width="10" height="11" class="ds-hit" /><rect x="${r1(fx - 1.5)}" y="${y + 17}" width="3" height="7" rx="1.5" class="ds-feed" /></g>`);
      } else if (e.type === 'diaper') {
        const fx = x(f(e.at));
        row.push(`<g ${t} class="ds-mark"><circle cx="${fx}" cy="${y + 28}" r="6" class="ds-hit" /><circle cx="${fx}" cy="${y + 28}" r="2.4" class="rc-diaper ${e.detail?.diaper ?? 'wet'}" /></g>`);
      }
    }
    parts.push(`<g class="ds-row">${row.join('')}</g>`);
  }

  return `<svg viewBox="0 0 ${W} ${h}" class="daystrip" role="img" aria-label="Sleep, feeds and diapers for the last ${days} days. The daily totals table below has the same information.">${parts.join('')}</svg>`;
}
