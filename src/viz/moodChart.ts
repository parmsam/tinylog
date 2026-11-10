import { addDays, dayRange } from '../core/days';
import { clockTime, shortDate } from '../core/format';
import type { LogEvent, Settings } from '../core/types';
import { FEELINGS, moodInfo, moodSeries, MOODS, moodSummary, SUPPORT_LINKS, SUPPORT_TEXT, type MoodPoint } from '../core/wellbeing';

type Prefs = Pick<Settings, 'clock' | 'dayStartHour'>;

const W = 320;
const H = 170;
const M = { l: 30, r: 10, t: 10, b: 22 };
const f1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Check-ins over the range: one dot per check-in, placed by when it happened, on five rows (very
 * low at the bottom, great at the top). No line, average or trend: each check-in stands on its own.
 */
export function moodChartSvg(points: MoodPoint[], from: number, to: number, prefs: Prefs): string {
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (at: number) => f1(M.l + ((at - from) / (to - from || 1)) * iw);
  const y = (level: number) => f1(M.t + ih - ((level - 1) / 4) * ih);
  const rows = MOODS.map(
    (m) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(m.level)}" y2="${y(m.level)}" class="mc-grid" /><text x="${M.l - 8}" y="${y(m.level)}" class="mc-face" text-anchor="end" dominant-baseline="central">${m.emoji}</text>`,
  ).join('');
  const dates = `<text x="${M.l}" y="${H - 5}" class="mc-tick" text-anchor="start">${shortDate(from)}</text><text x="${W - M.r}" y="${H - 5}" class="mc-tick" text-anchor="end">${shortDate(to - 1)}</text>`;
  const marks = points
    .map((p) => {
      const cx = x(p.at);
      const cy = y(p.level);
      const tip = [`${moodInfo(p.level)!.emoji} ${shortDate(p.at)} ${clockTime(p.at, prefs.clock)}`, moodSummary(p.level, p.feelings)].join(' · ');
      return `<g class="mc-mark" data-tip="${esc(tip)}"><circle cx="${cx}" cy="${cy}" r="11" class="mc-hit" /><circle cx="${cx}" cy="${cy}" r="4.5" class="mc-dot" /></g>`;
    })
    .join('');
  return `<svg class="mood-chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">${rows}${dates}${marks}</svg>`;
}

/** The Trends "Parent mood" card: the chart, and every check-in as a table (the text equivalent). */
export function moodHtml(events: LogEvent[], lastDay: string, days: number, prefs: Prefs): string {
  const [from] = dayRange(addDays(lastDay, -(days - 1)), prefs.dayStartHour);
  const [, to] = dayRange(lastDay, prefs.dayStartHour);
  const points = moodSeries(events, from, to);
  if (!points.length)
    return `<p class="hint">Tap 🌷 Parent mood to check in with yourself, as often or as rarely as you like. Check-ins from the last ${days} days show up here. They stay on this phone and out of the baby’s Markdown log.</p>`;
  const body = [...points]
    .reverse()
    .map((p) => {
      const m = moodInfo(p.level)!;
      const feelings = p.feelings.map((f) => FEELINGS.find(([id]) => id === f)?.[1] ?? f).join(', ');
      return `<tr><th scope="row">${shortDate(p.at)} · ${clockTime(p.at, prefs.clock)}</th><td>${m.emoji} ${m.label}</td><td>${feelings ? esc(feelings) : '—'}</td></tr>`;
    })
    .join('');
  const n = points.length;
  return `<p class="hint">${n} check-in${n === 1 ? '' : 's'} in the last ${days} days. Hover or tap a dot for details.</p>
    <div class="viz-box">${moodChartSvg(points, from, to, prefs)}</div>
    <div class="table-wrap"><table class="totals mood-table">
      <caption>Check-ins</caption>
      <thead><tr><th scope="col">When</th><th scope="col">Mood</th><th scope="col">Feelings</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
}

/** Where to find help: the same fixed note for every check-in, never triggered by what was picked. */
export function supportHtml(): string {
  return `<details class="support"><summary>Need support?</summary>
    <p>${SUPPORT_TEXT}</p>
    <ul>${SUPPORT_LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}</ul>
    <p class="hint">Outside the US, your doctor, midwife or health visitor can point you to local support.</p>
  </details>`;
}
