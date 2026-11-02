import { dayKey } from '../core/days';
import { shortDate } from '../core/format';
import { formatHeight, formatWeight, G_PER_OZ, CM_PER_IN, growthSeries, growthUnits, type GrowthPoint } from '../core/growth';
import type { GrowthUnits, LogEvent, Settings } from '../core/types';
import { niceTicks } from './geom';

type Prefs = Pick<Settings, 'units' | 'dayStartHour'> & Partial<Pick<Settings, 'growthUnits'>>;
type Kind = 'weight' | 'height';

const W = 320;
const H = 160;
const M = { l: 34, r: 12, t: 22, b: 24 };
const f1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The number plotted, in the unit the axis is labelled in (kg / lb, cm / in). */
function display(kind: Kind, value: number, units: GrowthUnits): number {
  if (kind === 'weight') return units === 'imperial' ? value / (G_PER_OZ * 16) : value / 1000;
  return units === 'imperial' ? value / CM_PER_IN : value;
}

export function axisUnit(kind: Kind, units: GrowthUnits): string {
  if (kind === 'weight') return units === 'imperial' ? 'lb' : 'kg';
  return units === 'imperial' ? 'in' : 'cm';
}

const text = (kind: Kind, v: number, units: GrowthUnits) => (kind === 'weight' ? formatWeight(v, units) : formatHeight(v, units));

/** Weight: a dot. Height: a diamond (drawn as a path, no transforms). Different shapes even though each chart has one series. */
function mark(kind: Kind, x: number, y: number): string {
  if (kind === 'weight') return `<circle cx="${x}" cy="${y}" r="4" class="gc-dot" />`;
  const r = 5;
  return `<path d="M${x} ${f1(y - r)}L${f1(x + r)} ${y}L${x} ${f1(y + r)}L${f1(x - r)} ${y}Z" class="gc-dot" />`;
}

/**
 * Measurements over time. The y-axis is fitted to the values (not anchored at zero): growth is a
 * slow climb, and from zero every line would look flat. Dates are spaced by real time.
 */
export function growthChartSvg(points: GrowthPoint[], kind: Kind, units: GrowthUnits): string {
  if (!points.length) return '';
  const vals = points.map((p) => display(kind, p.value, units));
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 3);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const t0 = points[0].at;
  const t1 = points[points.length - 1].at;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (at: number) => f1(M.l + (t1 === t0 ? iw / 2 : ((at - t0) / (t1 - t0)) * iw));
  const y = (v: number) => f1(M.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih);

  const grid = ticks
    .map((v) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" class="gc-grid" /><text x="${M.l - 6}" y="${y(v)}" class="gc-tick" text-anchor="end" dominant-baseline="central">${v}</text>`)
    .join('');
  const dates =
    t1 === t0
      ? `<text x="${x(t0)}" y="${H - 6}" class="gc-tick" text-anchor="middle">${shortDate(t0)}</text>`
      : `<text x="${M.l}" y="${H - 6}" class="gc-tick" text-anchor="start">${shortDate(t0)}</text><text x="${W - M.r}" y="${H - 6}" class="gc-tick" text-anchor="end">${shortDate(t1)}</text>`;
  const line = points.length > 1 ? `<polyline points="${points.map((p, i) => `${x(p.at)},${y(vals[i])}`).join(' ')}" class="gc-line" />` : '';
  const emoji = kind === 'weight' ? '⚖️' : '📏';
  const marks = points
    .map((p, i) => {
      const cx = x(p.at);
      const cy = y(vals[i]);
      const tip = `${emoji} ${shortDate(p.at)} · ${text(kind, p.value, units)}`;
      return `<g class="gc-mark" data-tip="${esc(tip)}"><circle cx="${cx}" cy="${cy}" r="11" class="gc-hit" />${mark(kind, cx, cy)}</g>`;
    })
    .join('');
  return `<svg class="growth-chart" data-kind="${kind}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <text x="${M.l - 6}" y="8" class="gc-unit" text-anchor="end">${axisUnit(kind, units)}</text>
    ${grid}${dates}${line}${marks}</svg>`;
}

/** The Trends "Growth" card: a chart per measurement, and the measurements as a table (the text equivalent). */
export function growthHtml(events: LogEvent[], prefs: Prefs, now: number): string {
  const units = growthUnits(prefs);
  const weight = growthSeries(events, 'weight', now);
  const height = growthSeries(events, 'height', now);
  if (!weight.length && !height.length)
    return '<p class="hint">Add a weight or height with the ⚖️ Weight and 📏 Height buttons (or on a past day) and they show up here over time.</p>';

  const chart = (kind: Kind, pts: GrowthPoint[]) =>
    pts.length ? `<figure class="growth-fig"><figcaption>${kind === 'weight' ? '⚖️ Weight' : '📏 Height'}</figcaption><div class="viz-box">${growthChartSvg(pts, kind, units)}</div></figure>` : '';

  // One row per measurement, newest first; a weight and height taken together share a row.
  const rows = new Map<string, { at: number; weight?: number; height?: number }>();
  for (const [kind, pts] of [['weight', weight], ['height', height]] as const) {
    for (const p of pts) {
      const key = dayKey(p.at, prefs.dayStartHour);
      const row = rows.get(key) ?? { at: p.at };
      // Two of the same on one day: keep the later one.
      if (row[kind] === undefined || p.at >= row.at) row[kind] = p.value;
      row.at = Math.max(row.at, p.at);
      rows.set(key, row);
    }
  }
  const body = [...rows.values()]
    .sort((a, b) => b.at - a.at)
    .map(
      (r) =>
        `<tr><th scope="row">${shortDate(r.at)}</th><td>${r.weight !== undefined ? formatWeight(r.weight, units) : '—'}</td><td>${r.height !== undefined ? formatHeight(r.height, units) : '—'}</td></tr>`,
    )
    .join('');

  return `<p class="hint">Every measurement logged, spaced by date. Hover or tap a point for its value.</p>
    <div class="growth-charts">${chart('weight', weight)}${chart('height', height)}</div>
    <div class="table-wrap"><table class="totals growth-table">
      <caption>Measurements</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Height</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
}
