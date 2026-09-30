import { HEAT_COLUMNS, type HeatColumn, type Heatmap } from '../core/heatmap';
import type { ClockFormat } from '../core/types';
import { hourLabel } from './geom';

const COLOR: Record<HeatColumn, string> = {
  feed: '--v-feed',
  wet: '--v-diaper',
  dirty: '--v-diaper',
  sleep: '--v-sleep',
  tummy: '--v-tummy',
  pump: '--v-pump',
};

function hourRange(h: number): string {
  const t = (x: number) => new Date(2026, 0, 1, x).toLocaleTimeString(undefined, { hour: 'numeric' });
  return `${t(h)}–${t((h + 1) % 24)}`;
}

function describe(col: (typeof HEAT_COLUMNS)[number], value: number): string {
  if (!value) return 'none';
  if (col.kind === 'minutes') {
    const m = Math.round(value);
    return col.id === 'sleep' ? `asleep ${m} min of the hour (${Math.round((value / 60) * 100)}%)` : `${m} min on average`;
  }
  const per = value >= 0.95 ? `${Math.round(value * 10) / 10} per day` : `${Math.round(value * 100)}% of days`;
  return per;
}

/**
 * Time-of-day heatmap as a real table: a row per hour, a column per category, darker = more.
 * Each column has its own hue and its own scale, so columns aren't compared by color.
 */
export function heatmapTableHtml(hm: Heatmap, clock: ClockFormat): string {
  const head = HEAT_COLUMNS.map((c) => `<th scope="col"><span aria-hidden="true">${c.emoji}</span><span class="hm-col">${c.label}</span></th>`).join('');
  const rows = hm.hours
    .map((h, i) => {
      const cells = HEAT_COLUMNS.map((c) => {
        const cell = hm.cells[c.id][i];
        const text = describe(c, cell.value);
        const tip = `${c.emoji} ${c.label} · ${hourRange(h)} · ${text}`;
        return `<td class="hm-cell l${cell.level}" style="--c: var(${COLOR[c.id]})" data-tip="${tip}"><span class="visually-hidden">${text}</span></td>`;
      }).join('');
      const major = i % 3 === 0;
      return `<tr><th scope="row" class="${major ? 'major' : ''}">${hourLabel(h, clock)}</th>${cells}</tr>`;
    })
    .join('');
  return `<table class="heatmap">
    <caption class="visually-hidden">What happens at each hour of the day, averaged over ${hm.days} day${hm.days === 1 ? '' : 's'}</caption>
    <thead><tr><th scope="col"><span class="visually-hidden">Hour</span></th>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="hm-legend" aria-hidden="true"><span>less</span>${[1, 2, 3, 4, 5].map((l) => `<i class="hm-cell l${l}"></i>`).join('')}<span>more</span></div>`;
}
