import { addDays, dayDate } from '../core/days';
import { dayTotals } from '../core/daily';
import { amount, dayTitle, duration } from '../core/format';
import { app, settings, today } from '../core/log';
import { toMarkdown } from '../core/markdown';
import { hourHeatmap } from '../core/heatmap';
import { dayStripSvg } from '../viz/dayStrip';
import { heatmapTableHtml } from '../viz/heatmapTable';
import { attachTips, hideTip } from '../viz/tooltip';
import { weekRingsSvg } from '../viz/weekRings';
import { copyText, downloadText } from './clipboard';
import { toast } from './toast';

const RANGES = [7, 14, 28] as const;
let range: (typeof RANGES)[number] = 7;
type View = 'timeline' | 'heatmap';
let view: View = 'timeline';

try {
  const saved = Number(localStorage.getItem('tinylog:trends-range'));
  if ((RANGES as readonly number[]).includes(saved)) range = saved as typeof range;
  if (localStorage.getItem('tinylog:trends-view') === 'heatmap') view = 'heatmap';
} catch {
  /* per-viewer convenience only */
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function timelineCard(last: string, now: number): string {
  const s = app.get();
  const prefs = settings.get();
  return `<p class="hint">Each row is a day, ${prefs.dayStartHour ? `from ${prefs.dayStartHour}:00` : 'midnight to midnight'}. Tap a mark for details.</p>
      <div class="viz-box">${dayStripSvg(s.events, last, range, now, prefs)}</div>
      <ul class="viz-legend" aria-hidden="true">
        <li><span class="sw sleep"></span>Sleep</li><li><span class="sw feed tick"></span>Feed</li><li><span class="sw diaper"></span>Diaper <small>○ wet ● dirty</small></li>
      </ul>`;
}

function heatmapCard(last: string, now: number): string {
  const prefs = settings.get();
  const hm = hourHeatmap(app.get().events, last, range, prefs.dayStartHour, now);
  return `<p class="hint">Each row is an hour of the day; darker means it happens more at that hour, averaged over ${hm.days} day${hm.days === 1 ? '' : 's'}. Each column is scaled on its own; sleep shows how much of the hour was spent asleep.</p>
      <div class="viz-box hm-box">${heatmapTableHtml(hm, prefs.clock)}</div>`;
}

function table(lastDay: string, days: number, now: number): string {
  const prefs = settings.get();
  const events = app.get().events;
  const dash = (v: string | number) => (v ? String(v) : '—');
  const rows = Array.from({ length: days }, (_, i) => {
    const day = addDays(lastDay, -i);
    const t = dayTotals(events, day, prefs.dayStartHour, now);
    return `<tr>
      <th scope="row">${dayTitle(dayDate(day))}</th>
      <td>${t.sleepMs ? duration(t.sleepMs) : '—'}</td>
      <td>${t.naps ? `${t.naps} · ${duration(t.napMs)}` : '—'}</td>
      <td>${dash(t.feeds)}</td>
      <td>${t.bottleMl ? amount(t.bottleMl, prefs.units) : '—'}</td>
      <td>${dash(t.wet)}</td>
      <td>${dash(t.dirty)}</td>
      <td>${t.tummyMs ? duration(t.tummyMs) : '—'}</td>
      <td>${t.pumpMl ? amount(t.pumpMl, prefs.units) : t.pumps ? `${t.pumps}×` : '—'}</td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="totals">
    <caption>Daily totals</caption>
    <thead><tr><th scope="col">Day</th><th scope="col">Sleep</th><th scope="col">Naps</th><th scope="col">Feeds</th><th scope="col">Bottle</th><th scope="col">Wet</th><th scope="col">Dirty</th><th scope="col">Tummy</th><th scope="col">Pump</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function markdownFor(days: number) {
  const s = app.get();
  const last = today();
  return {
    text: toMarkdown(s.events, s.notes, addDays(last, -(days - 1)), last, settings.get(), Date.now()),
    name: `tinylog-${addDays(last, -(days - 1))}-to-${last}.md`,
  };
}

export async function copyMarkdown(days: number) {
  const ok = await copyText(markdownFor(days).text);
  toast(ok ? `Copied ${days === 1 ? 'today' : `the last ${days} days`} as Markdown` : "Couldn't copy. Try Download instead.");
}

function render(dialog: HTMLDialogElement) {
  const now = Date.now();
  const last = today(now);
  const s = app.get();
  const prefs = settings.get();
  dialog.innerHTML = `<div class="trends">
    <div class="sheet-head"><h2 id="trends-title">Trends</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="seg" role="radiogroup" aria-label="Range">${RANGES.map(
      (r) => `<label><input type="radio" name="range" value="${r}" ${r === range ? 'checked' : ''} /><span>${r} days</span></label>`,
    ).join('')}</div>

    <section class="viz-card">
      <div class="card-head">
        <h3>${view === 'heatmap' ? 'By time of day' : 'Day by day'}</h3>
        <div class="seg small" role="radiogroup" aria-label="View">
          <label><input type="radio" name="view" value="timeline" ${view === 'timeline' ? 'checked' : ''} /><span>Timeline</span></label>
          <label><input type="radio" name="view" value="heatmap" ${view === 'heatmap' ? 'checked' : ''} /><span>Heatmap</span></label>
        </div>
      </div>
      ${view === 'heatmap' ? heatmapCard(last, now) : timelineCard(last, now)}
    </section>

    <section class="viz-card">
      <h3>Sleep this week</h3>
      <p class="hint">Today is the outer ring. As a rhythm settles, the arcs line up.</p>
      <div class="viz-box rings-box">${weekRingsSvg(s.events, last, now, prefs)}</div>
      <ul class="viz-legend" aria-hidden="true"><li><span class="sw sleep"></span>Sleep</li><li><span class="sw feed dot"></span>Feed</li></ul>
    </section>

    <section class="viz-card">${table(last, range, now)}</section>

    <section class="viz-card">
      <h3>Markdown</h3>
      <p class="hint">A readable log of the last ${range} days, with totals and day notes. Paste it into Notes or Obsidian, or bring it to a checkup.</p>
      <div class="btn-row">
        <button type="button" class="btn primary" data-md-copy>Copy as Markdown</button>
        <button type="button" class="btn" data-md-download>Download .md</button>
      </div>
    </section>
  </div>`;
  dialog.querySelectorAll<HTMLElement>('.viz-box').forEach(attachTips);
}

export function openTrends() {
  const dialog = document.getElementById('trends') as HTMLDialogElement;
  render(dialog);
  dialog.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'range') {
      range = Number(t.value) as typeof range;
      remember('tinylog:trends-range', String(range));
    } else if (t.name === 'view') {
      view = t.value as View;
      remember('tinylog:trends-view', view);
    } else return;
    const scroll = dialog.scrollTop;
    render(dialog);
    dialog.scrollTop = scroll;
    dialog.querySelector<HTMLInputElement>(`input[name="${t.name}"][value="${t.value}"]`)?.focus();
  };
  dialog.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) dialog.close();
    else if (t.closest('[data-md-copy]')) void copyMarkdown(range);
    else if (t.closest('[data-md-download]')) {
      const md = markdownFor(range);
      downloadText(md.name, md.text);
    }
  };
  dialog.onclose = hideTip;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLElement>('#trends-title')?.setAttribute('tabindex', '-1');
  dialog.querySelector<HTMLElement>('#trends-title')?.focus();
}
