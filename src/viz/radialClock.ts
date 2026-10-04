import { animate, createDrawable, stagger } from 'animejs';
import { cardFor } from '../core/cards';
import { dayTotals } from '../core/daily';
import { dayKey, dayRange, eventsForDay, spanEnd } from '../core/days';
import { isOngoing } from '../core/events';
import { amount, clockTime, duration } from '../core/format';
import { summary } from '../core/status';
import type { LogEvent, Settings } from '../core/types';
import { arcPath, frac, hourLabel, hourMarks, polar } from './geom';
import { attachTips } from './tooltip';

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour'>;

const C = 160;
/** One lane per series, outside in. Sleep and diaper (and tummy and pump) never share a lane: too close in color. */
const LANE = { sleep: 142, feed: 121, diaper: 104, tummy: 90, pump: 79, fussy: 68, other: 164 } as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const f1 = (v: number) => Math.round(v * 10) / 10;

export function tipFor(e: LogEvent, prefs: Prefs, now: number): string {
  const card = cardFor(e)!;
  const t = (ts: number) => clockTime(ts, prefs.clock);
  const label = e.type === 'diaper' ? `${summary(e, prefs)} diaper` : card.label;
  const bits = [`${card.emoji} ${label}`];
  if (card.timed) {
    const end = spanEnd(e, now);
    bits.push(isOngoing(e) ? `since ${t(e.at)} (${duration(now - e.at)})` : `${t(e.at)}–${t(end)} (${duration(end - e.at)})`);
  } else bits.push(t(e.at));
  const s = e.type !== 'diaper' ? summary(e, prefs) : '';
  if (s) bits.push(s);
  if (e.detail?.note) bits.push(e.detail.note);
  return bits.join(' · ');
}

/** A 24-hour ring for one day: sleep arcs, feed dots, diaper marks, tummy and pump arcs, a "now" hand. */
export function radialClockSvg(events: LogEvent[], day: string, now: number, prefs: Prefs): string {
  const [start, end] = dayRange(day, prefs.dayStartHour);
  const isToday = dayKey(now, prefs.dayStartHour) === day;
  const list = eventsForDay(events, day, prefs.dayStartHour, now);
  const f = (ts: number) => frac(ts, start, end);
  const parts: string[] = [];

  // Lane tracks.
  parts.push(
    `<g class="rc-tracks" fill="none">${Object.entries(LANE)
      .filter(([k]) => k !== 'other')
      .map(([k, r]) => `<circle cx="${C}" cy="${C}" r="${r}" stroke-width="${k === 'sleep' ? 18 : k === 'tummy' || k === 'pump' || k === 'fussy' ? 8 : 12}" />`)
      .join('')}</g>`,
  );

  // Hour ticks outside the sleep lane; labels every 6 hours.
  const marks = hourMarks(start, end);
  parts.push(
    `<g class="rc-ticks">${marks
      .map(({ ts, hour }, i) => {
        const major = i % 6 === 0;
        const [x0, y0] = polar(C, C, 151, f(ts));
        const [x1, y1] = polar(C, C, major ? 158 : 154, f(ts));
        const line = `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" class="${major ? 'major' : ''}" />`;
        if (!major) return line;
        const [lx, ly] = polar(C, C, 170, f(ts));
        return `${line}<text x="${f1(lx)}" y="${f1(ly)}" dominant-baseline="central" text-anchor="middle">${hourLabel(hour, prefs.clock)}</text>`;
      })
      .join('')}</g>`,
  );

  const tipAttr = (e: LogEvent) => `data-id="${e.id}" data-tip="${esc(tipFor(e, prefs, now))}" tabindex="0"`;
  const arcs: string[] = [];
  const dots: string[] = [];
  for (const e of list.sort((a, b) => a.at - b.at)) {
    const a0 = f(e.at);
    const a1 = f(spanEnd(e, now));
    switch (e.type) {
      case 'sleep': {
        const d = arcPath(C, C, LANE.sleep, a0, Math.max(a1, a0 + 0.004));
        const cls = `rc-sleep ${e.detail?.sleep === 'night' ? 'night' : 'nap'} ${isOngoing(e) ? 'ongoing' : ''}`;
        arcs.push(`<g ${tipAttr(e)} class="rc-mark"><path d="${d}" class="rc-hit" /><path d="${d}" class="${cls}" /></g>`);
        break;
      }
      case 'tummy':
      case 'pump':
      case 'fussy': {
        const d = arcPath(C, C, LANE[e.type], a0, Math.max(a1, a0 + 0.006));
        arcs.push(`<g ${tipAttr(e)} class="rc-mark"><path d="${d}" class="rc-hit" /><path d="${d}" class="rc-${e.type}" /></g>`);
        break;
      }
      case 'feed': {
        const [x, y] = polar(C, C, LANE.feed, a0);
        const r = e.detail?.method === 'bottle' && e.detail.amount ? Math.min(8, 4 + e.detail.amount / 40) : 5;
        dots.push(
          `<g ${tipAttr(e)} class="rc-mark"><circle cx="${f1(x)}" cy="${f1(y)}" r="12" class="rc-hit" /><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" class="rc-feed ${e.detail?.method ?? 'breast'}" /></g>`,
        );
        break;
      }
      case 'diaper': {
        const [x, y] = polar(C, C, LANE.diaper, a0);
        const kind = e.detail?.diaper ?? 'wet';
        // Shape carries the kind: hollow = wet, filled = dirty, filled with a halo = both.
        dots.push(
          `<g ${tipAttr(e)} class="rc-mark"><circle cx="${f1(x)}" cy="${f1(y)}" r="11" class="rc-hit" /><circle cx="${f1(x)}" cy="${f1(y)}" r="4.5" class="rc-diaper ${kind}" /></g>`,
        );
        break;
      }
      case 'spitup':
      case 'bath':
      case 'book':
      case 'doctor': {
        const [x, y] = polar(C, C, LANE.other, a0);
        dots.push(
          `<g ${tipAttr(e)} class="rc-mark"><circle cx="${f1(x)}" cy="${f1(y)}" r="11" class="rc-hit" /><text x="${f1(x)}" y="${f1(y)}" class="rc-emoji" dominant-baseline="central" text-anchor="middle">${cardFor(e)!.emoji}</text></g>`,
        );
        break;
      }
    }
  }
  parts.push(`<g class="rc-arcs" fill="none">${arcs.join('')}</g><g class="rc-dots">${dots.join('')}</g>`);

  if (isToday) {
    const [hx, hy] = polar(C, C, 150, f(now));
    const [bx, by] = polar(C, C, 62, f(now));
    parts.push(
      `<g class="rc-now"><line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(hx)}" y2="${f1(hy)}" /><circle cx="${f1(hx)}" cy="${f1(hy)}" r="3.5" /></g>`,
    );
  }

  // Center: the day's headline numbers.
  const t = dayTotals(events, day, prefs.dayStartHour, now);
  const diapers = list.filter((e) => e.type === 'diaper').length;
  parts.push(`<g class="rc-center" text-anchor="middle">
    <text x="${C}" y="${C - 6}" class="rc-hero">${t.sleepMs ? duration(t.sleepMs) : '—'}</text>
    <text x="${C}" y="${C + 12}" class="rc-sub">asleep</text>
    <text x="${C}" y="${C + 27}" class="rc-sub">${t.feeds} feed${t.feeds === 1 ? '' : 's'} · ${diapers} diaper${diapers === 1 ? '' : 's'}</text>
  </g>`);

  const label = `Day clock. ${t.sleepMs ? `Asleep ${duration(t.sleepMs)}` : 'No sleep logged'}, ${t.feeds} feeds${t.bottleMl ? ` (${amount(t.bottleMl, prefs.units)} by bottle)` : ''}, ${t.wet} wet and ${t.dirty} dirty diapers. Every entry is also in the log below.`;
  return `<svg viewBox="-24 -24 368 368" class="radial" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
}

const LEGEND = `<ul class="viz-legend" aria-hidden="true">
  <li><span class="sw sleep"></span>Sleep</li>
  <li><span class="sw feed"></span>Feed</li>
  <li><span class="sw diaper"></span>Diaper <small>○ wet ● dirty</small></li>
  <li><span class="sw tummy"></span>Tummy</li>
  <li><span class="sw pump"></span>Pump</li>
  <li><span class="sw fussy"></span>Fussy</li>
</ul>`;

let lastKey = '';
let lastDay = '';
let seen = new Set<string>();

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Renders into `host`, redrawing at most once a minute. Arcs draw themselves in when a day is opened;
 * after that only newly added entries animate.
 */
export function renderRadialClock(host: HTMLElement, events: LogEvent[], day: string, now: number, prefs: Prefs) {
  const list = eventsForDay(events, day, prefs.dayStartHour, now);
  const key = `${day}|${prefs.dayStartHour}|${prefs.clock}|${prefs.units}|${Math.floor(now / 60_000)}|${list.map((e) => `${e.id}:${e.updatedAt}`).join(',')}`;
  if (key === lastKey && host.querySelector('svg.radial')) return;
  // Coming back from the grid view counts as opening the day again (arcs draw in).
  if (!host.querySelector('svg.radial')) lastDay = '';
  lastKey = key;
  host.innerHTML = radialClockSvg(events, day, now, prefs) + LEGEND;
  attachTips(host);

  const dayChanged = day !== lastDay;
  lastDay = day;
  const fresh = (el: Element) => dayChanged || !seen.has((el as HTMLElement).dataset.id ?? '');
  const marks = [...host.querySelectorAll<SVGGElement>('.rc-mark')];
  const animateNow = !reduced() && document.documentElement.dataset.theme !== 'night';
  if (animateNow) {
    const paths = marks.filter(fresh).map((g) => g.querySelector<SVGPathElement>('path:not(.rc-hit)')).filter((p): p is SVGPathElement => !!p);
    if (paths.length) animate(createDrawable(paths), { draw: ['0 0', '0 1'], duration: dayChanged ? 900 : 600, delay: stagger(40), ease: 'outCubic' });
    const dots = marks.filter((g) => fresh(g) && !g.querySelector('path'));
    if (dots.length) animate(dots, { opacity: [0, 1], duration: 450, delay: stagger(20, { start: dayChanged ? 300 : 0 }), ease: 'outQuad' });
  }
  seen = new Set(marks.map((g) => g.dataset.id ?? ''));
}
