import { dayDate } from '../core/days';
import { amount, clockTime, dayTitle, duration } from '../core/format';
import type { Maybe, Patterns, Spread } from '../core/stats';
import type { Settings } from '../core/types';

type Prefs = Pick<Settings, 'units' | 'clock'>;

const r1 = (v: number) => Math.round(v * 10) / 10;
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Clock time for "minutes after noon" (bedtime) or "minutes after midnight" (wake). */
function timeOf(minutes: number, fromNoon: boolean, prefs: Prefs): string {
  const d = new Date(2026, 0, 1, fromNoon ? 12 : 0, 0);
  d.setMinutes(d.getMinutes() + Math.round(minutes / 5) * 5);
  return clockTime(d.getTime(), prefs.clock);
}

/** Tiny line of daily values, oldest → newest, with the latest day marked. */
function sparkline(series: number[], color: string): string {
  if (series.length < 2) return '';
  const w = 120;
  const h = 26;
  // Anchored at zero: scaling min→max would make a day with one more diaper look like a spike.
  const max = Math.max(...series) || 1;
  const min = 0;
  const span = max - min;
  const pts = series.map((v, i) => [r1((i / (series.length - 1)) * (w - 4) + 2), r1(h - 3 - ((v - min) / span) * (h - 6))]);
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="--c: var(${color})">
    <polyline points="${pts.map((p) => p.join(',')).join(' ')}" /><circle cx="${lx}" cy="${ly}" r="2.6" /></svg>`;
}

/** Time-of-day strip: the usual window as a band, the median as a tick. */
function windowStrip(s: Spread, axisFrom: number, axisTo: number, fromNoon: boolean, prefs: Prefs): string {
  const x = (m: number) => r1(4 + ((Math.min(Math.max(m, axisFrom), axisTo) - axisFrom) / (axisTo - axisFrom)) * 112);
  const label = (m: number) => timeOf(m, fromNoon, prefs).replace(/:00/, '').replace(/\s?([AP])M/i, (_, a: string) => a.toLowerCase());
  return `<svg class="window" viewBox="0 0 120 30" aria-hidden="true">
    <rect x="4" y="6" width="112" height="8" rx="4" class="w-track" />
    <rect x="${x(s.p25)}" y="6" width="${Math.max(3, x(s.p75) - x(s.p25))}" height="8" rx="4" class="w-band" />
    <rect x="${x(s.median) - 1}" y="3" width="2" height="14" rx="1" class="w-tick" />
    <text x="4" y="27">${label(axisFrom)}</text><text x="116" y="27" text-anchor="end">${label(axisTo)}</text>
  </svg>`;
}

function weekBars(weeks: { from: string; to: string; ms: number }[]): string {
  const max = Math.max(...weeks.map((w) => w.ms), 1);
  const bw = 120 / Math.max(weeks.length, 1);
  return `<svg class="weekbars" viewBox="0 0 120 30" aria-hidden="true">${weeks
    .map((w, i) => {
      const h = Math.max(2, (w.ms / max) * 20);
      return `<rect x="${r1(i * bw + 3)}" y="${r1(22 - h)}" width="${r1(bw - 6)}" height="${r1(h)}" rx="2" class="${i === weeks.length - 1 ? 'now' : ''}" />`;
    })
    .join('')}<line x1="0" y1="22.5" x2="120" y2="22.5" /></svg>`;
}

interface Tile {
  label: string;
  value: string;
  sub?: string;
  viz?: string;
  basis?: string;
}

function tile(t: Tile, pending = false): string {
  return `<article class="stat ${pending ? 'pending' : ''}">
    <h4 class="stat-label">${t.label}</h4>
    <p class="stat-value">${t.value}</p>
    ${t.sub ? `<p class="stat-sub">${t.sub}</p>` : ''}
    ${t.viz ?? ''}
    ${t.basis ? `<p class="stat-basis">${t.basis}</p>` : ''}
  </article>`;
}

/** A tile for a metric, or a "not enough yet" placeholder saying what it still needs. */
function maybeTile<T>(m: Maybe<T>, label: string, unit: string, render: (v: T, basis: number) => Tile): string {
  if (m.ok) return tile(render(m.value, m.basis));
  return tile({ label, value: '—', sub: `Needs ${plural(m.need, unit)} of logs (${m.have} so far)` }, true);
}

/** "4–7 PM" rather than "4 PM–7 PM" when both ends share AM/PM. */
function hourSpan(from: number, to: number): string {
  const f = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
  const a = f(from);
  const b = f(to);
  const suffix = /\s?[AP]M$/i;
  const sa = a.match(suffix)?.[0];
  return sa && sa === b.match(suffix)?.[0] ? `${a.replace(suffix, '')}–${b}` : `${a}–${b}`;
}

const range = (s: Spread, f: (v: number) => string) => (f(s.p25) === f(s.p75) ? f(s.median) : `${f(s.p25)}–${f(s.p75)}`);

export function patternsHtml(p: Patterns, prefs: Prefs): string {
  const tiles: string[] = [];

  tiles.push(
    maybeTile(p.sleepPerDay, 'Sleep per day', 'full day', (v, n) => ({
      label: 'Sleep per day',
      value: duration(v.avg),
      sub: `naps ${duration(v.napAvg)} · night ${duration(v.nightAvg)}`,
      viz: sparkline(v.series, '--v-sleep'),
      basis: `average of ${plural(n, 'day')}`,
    })),
  );

  tiles.push(
    maybeTile(p.napLength, 'Naps', 'nap', (v, n) => ({
      label: 'Naps',
      value: duration(v.median),
      sub: `usually ${range(v, duration)}${p.napsPerDay.ok ? ` · ${n1(p.napsPerDay.value)} a day` : ''}`,
      basis: `typical length of ${plural(n, 'nap')}`,
    })),
  );

  tiles.push(
    maybeTile(p.longestStretch, 'Longest stretch', 'night', (v, n) => ({
      label: 'Longest stretch',
      value: duration(v.avg),
      sub: `best ${duration(v.best)} (${dayTitle(dayDate(v.bestNight)).replace(/,.*/, '')} night)`,
      basis: `average of ${plural(n, 'night')}`,
    })),
  );

  tiles.push(
    maybeTile(p.bedtime, 'Bedtime', 'night', (v, n) => ({
      label: 'Bedtime',
      value: timeOf(v.median, true, prefs),
      sub: `usually ${range(v, (m) => timeOf(m, true, prefs))}`,
      viz: windowStrip(v, 5 * 60, 14 * 60, true, prefs),
      basis: `from ${plural(n, 'night')}`,
    })),
  );

  tiles.push(
    maybeTile(p.wake, 'Up for the day', 'night', (v, n) => ({
      label: 'Up for the day',
      value: timeOf(v.median, false, prefs),
      sub: `usually ${range(v, (m) => timeOf(m, false, prefs))}`,
      viz: windowStrip(v, 4 * 60, 11 * 60, false, prefs),
      basis: `from ${plural(n, 'morning')}`,
    })),
  );

  tiles.push(
    maybeTile(p.feedsPerDay, 'Feeds per day', 'full day', (v, n) => ({
      label: 'Feeds per day',
      value: n1(v.avg),
      sub: [
        p.feedGap.ok ? `every ${range(p.feedGap.value, duration)}` : '',
        v.bottleMlAvg ? `${amount(v.bottleMlAvg, prefs.units)} by bottle` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      viz: sparkline(v.series, '--v-feed'),
      basis: `average of ${plural(n, 'day')}`,
    })),
  );

  tiles.push(
    maybeTile(p.diapers, 'Diapers per day', 'full day', (v, n) => ({
      label: 'Diapers per day',
      value: n1(v.wet + v.dirty),
      sub: `${n1(v.wet)} wet · ${n1(v.dirty)} dirty`,
      viz: sparkline(v.series, '--v-diaper'),
      basis: `average of ${plural(n, 'day')}`,
    })),
  );

  tiles.push(
    maybeTile(p.tummy, 'Tummy time', 'full day', (v) => {
      const cur = v.weeks[v.weeks.length - 1];
      const prev = v.weeks[v.weeks.length - 2];
      return {
        label: 'Tummy time',
        value: cur ? duration(cur.ms) : '—',
        sub: `last 7 days${prev ? ` · week before ${duration(prev.ms)}` : ''} · ${duration(v.perDay)} a day`,
        viz: v.weeks.length > 1 ? weekBars(v.weeks) : '',
        basis: `rolling weeks`,
      };
    }),
  );

  if (p.fussy) {
    tiles.push(
      maybeTile(p.fussy, 'Fussy', 'full day', (v, n) => ({
        label: 'Fussy',
        value: v.peak === null ? duration(v.perDay) : hourSpan(v.peak, (v.peak + 3) % 24),
        sub: v.peak === null ? `a day · ${plural(v.spells, 'spell')}` : `most often · ${duration(v.perDay)} a day`,
        basis: `from ${plural(v.spells, 'spell')} over ${plural(n, 'day')}`,
      })),
    );
  }

  if (p.pump) {
    tiles.push(
      maybeTile(p.pump, 'Pumping', 'full day', (v, n) => ({
        label: 'Pumping',
        value: `${amount(v.mlPerDay, prefs.units)}`,
        sub: `a day · ${n1(v.sessionsPerDay)} sessions${v.perSession ? ` · usually ${range(v.perSession, (ml) => amount(ml, prefs.units))} each` : ''}`,
        basis: `average of ${plural(n, 'day')}`,
      })),
    );
  }

  const basis = p.days.length
    ? `${plural(p.days.length, 'full day')}, ${dayTitle(dayDate(p.days[0]))} – ${dayTitle(dayDate(p.days[p.days.length - 1]))}`
    : 'no full days yet';
  return `<p class="hint">What usually happens, from ${basis} (today is left out until it's over). A description of your log, not advice.</p>
    <div class="stats">${tiles.join('')}</div>`;
}

