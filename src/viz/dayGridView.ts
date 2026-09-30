import { dayGrid, type GridRow } from '../core/dayGrid';
import { HEAT_COLUMNS, type HeatColumn } from '../core/heatmap';
import type { LogEvent, Settings } from '../core/types';
import { hourLabel } from './geom';
import { tipFor } from './radialClock';
import { attachTips } from './tooltip';

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour' | 'gridMarks'>;

const GLYPH = { dots: '', checks: '✓', crosses: '✕' } as const;

const COLOR: Record<HeatColumn, string> = {
  feed: '--v-feed',
  wet: '--v-diaper',
  dirty: '--v-diaper',
  sleep: '--v-sleep',
  tummy: '--v-tummy',
  pump: '--v-pump',
  fussy: '--v-fussy',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (f: number) => `${Math.round(f * 1000) / 10}%`;

function cellHtml(row: GridRow, col: HeatColumn, prefs: Prefs, now: number): string {
  const cell = row.cells[col];
  const tip = (e: LogEvent) => `data-tip="${esc(tipFor(e, prefs, now))}"`;
  const parts: string[] = [];
  for (const s of cell.segments) {
    const ongoing = s.event.endAt === undefined ? ' ongoing' : '';
    parts.push(`<span class="dg-seg${ongoing}" style="left:${pct(s.from)};width:${pct(s.to - s.from)}" ${tip(s.event)}></span>`);
  }
  for (const m of cell.marks) {
    const kind = m.event.type === 'diaper' ? ` ${m.event.detail?.diaper ?? 'wet'}` : '';
    // Clamped so a mark at :58 isn't cut off by the cell edge.
    const glyph = GLYPH[prefs.gridMarks];
    const cls = glyph ? `dg-glyph` : `dg-mark${kind}`;
    parts.push(`<span class="${cls}" style="left:clamp(6px, ${pct(m.at)}, calc(100% - 6px))" ${tip(m.event)} aria-hidden="true">${glyph}</span>`);
  }
  if (row.now !== undefined) parts.push(`<span class="dg-now" style="left:${pct(row.now)}"></span>`);
  const said = [...cell.segments.map((s) => tipFor(s.event, prefs, now)), ...cell.marks.map((m) => tipFor(m.event, prefs, now))];
  const sr = said.length ? `<span class="visually-hidden">${esc(said.join('; '))}</span>` : '';
  return `<td class="dg-cell" style="--c: var(${COLOR[col]})">${parts.join('')}${sr}</td>`;
}

/** The selected day as a grid: hour rows × category columns, with position inside a cell = minute of the hour. */
export function dayGridHtml(events: LogEvent[], day: string, now: number, prefs: Prefs): string {
  const rows = dayGrid(events, day, prefs.dayStartHour, now);
  const head = HEAT_COLUMNS.map((c) => `<th scope="col"><span aria-hidden="true">${c.emoji}</span><span class="hm-col">${c.label}</span></th>`).join('');
  const body = rows
    .map((r, i) => {
      const cls = [r.now !== undefined ? 'is-now' : '', r.future ? 'is-future' : ''].filter(Boolean).join(' ');
      // The repeated hour when clocks fall back gets a second label so rows stay distinct.
      const repeat = i > 0 && rows[i - 1].hour === r.hour ? '′' : '';
      return `<tr class="${cls}"><th scope="row" class="${i % 3 === 0 ? 'major' : ''}">${hourLabel(r.hour, prefs.clock)}${repeat}</th>${HEAT_COLUMNS.map((c) => cellHtml(r, c.id, prefs, now)).join('')}</tr>`;
    })
    .join('');
  return `<table class="heatmap daygrid">
    <caption class="visually-hidden">The day hour by hour. Every entry is also in the log below.</caption>
    <thead><tr><th scope="col"><span class="visually-hidden">Hour</span></th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="hint dg-hint">Each cell is an hour; left to right is :00 to :59.</p>`;
}

let lastKey = '';

export function renderDayGrid(host: HTMLElement, events: LogEvent[], day: string, now: number, prefs: Prefs) {
  const ids = events.filter((e) => !e.deleted).map((e) => `${e.id}:${e.updatedAt}`).join(',');
  const key = `grid|${day}|${prefs.dayStartHour}|${prefs.clock}|${prefs.units}|${prefs.gridMarks}|${Math.floor(now / 60_000)}|${ids}`;
  if (key === lastKey && host.querySelector('.daygrid')) return;
  lastKey = key;
  host.innerHTML = dayGridHtml(events, day, now, prefs);
  attachTips(host);
}
