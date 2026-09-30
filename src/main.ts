import './styles.css';
import { CARDS } from './core/cards';
import { addDays, dayKey } from './core/days';
import { app, init, settings, setupPersistence, today } from './core/log';
import { tapCard } from './ui/actions';
import { mountCards, renderCards } from './ui/cardsView';
import { goToDay, mountDayView, renderDayView } from './ui/dayView';
import { isIosBrowserTab } from './ui/persist';
import { setupPwa } from './ui/pwa';
import { exportDownload, openSettings } from './ui/settingsView';
import { applyTheme } from './ui/theme';
import { toast, undoLast } from './ui/toast';
import { openAmbient } from './ui/ambient';
import { openShortcuts } from './ui/shortcuts';
import { copyMarkdown, openTrends } from './ui/trendsView';
import { renderRadialClock } from './viz/radialClock';

const DAY = 86_400_000;
const cardsEl = document.getElementById('cards')!;

setupPersistence();
applyTheme(settings.get().theme);
mountCards(cardsEl);
mountDayView();
document.getElementById('settings-open')!.addEventListener('click', openSettings);
document.getElementById('trends-open')!.addEventListener('click', openTrends);
document.getElementById('ambient-open')!.addEventListener('click', openAmbient);
document.getElementById('shortcuts-open')!.addEventListener('click', openShortcuts);
const clockEl = document.getElementById('day-clock')!;

let frame = 0;
function render() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const now = Date.now();
    renderCards(cardsEl, now);
    renderDayView(now);
    const s = app.get();
    if (s.loaded) renderRadialClock(clockEl, s.events, s.day, now, settings.get());
    const name = settings.get().babyName.trim();
    document.getElementById('brand-name')!.textContent = name || 'tinylog';
    document.title = name ? `${name} · tinylog` : 'tinylog';
  });
}

app.subscribe(render);
settings.subscribe((s, prev) => {
  if (s.theme !== prev.theme) applyTheme(s.theme);
  if (s.dayStartHour !== prev.dayStartHour) app.set({ day: dayKey(Date.now(), s.dayStartHour) });
  render();
});

// Everything on screen is derived from timestamps, so a once-a-second redraw keeps "ago" and timers fresh.
let shownToday = today();
setInterval(() => {
  const t = today();
  // Past midnight while looking at "today": follow along to the new day.
  if (t !== shownToday) {
    if (app.get().day === shownToday) app.set({ day: t });
    shownToday = t;
  }
  applyTheme(settings.get().theme);
  if (document.visibilityState === 'visible') render();
}, 1000);
document.addEventListener('visibilitychange', render);

// Keyboard: ←/→ change day, a letter per card logs it (same as a tap).
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const el = e.target as HTMLElement;
  if (el.closest('input, textarea, select, [contenteditable]')) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'ArrowLeft') goToDay(addDays(app.get().day, -1));
  else if (key === 'ArrowRight') goToDay(addDays(app.get().day, 1));
  else if (key === '.') goToDay(today());
  else if (key === ',') openSettings();
  else if (key === '?') openShortcuts();
  else if (key === 'g') openTrends();
  else if (key === 'a') openAmbient();
  else if (key === 'm') void copyMarkdown(1);
  else if (key === 'u') {
    if (!undoLast()) toast('Nothing to undo');
  } else {
    const card = CARDS.find((c) => c.key === key);
    if (!card) return;
    cardsEl.querySelector<HTMLElement>(`[data-card="${card.id}"]`)?.focus();
    tapCard(card.id);
  }
  e.preventDefault();
});

function showBanner() {
  const banner = document.getElementById('banner')!;
  const s = settings.get();
  const events = app.get().events.filter((e) => !e.deleted);
  const now = Date.now();
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem('tinylog:banner-dismissed') === '1';
  } catch {
    /* ignore */
  }
  if (dismissed) return;

  const oldest = events.reduce((m, e) => Math.min(m, e.createdAt), now);
  const needsBackup = events.length >= 20 && now - oldest > 3 * DAY && (!s.lastBackupAt || now - s.lastBackupAt > 7 * DAY);
  let html = '';
  if (isIosBrowserTab() && !s.installTipSeen) {
    html = `<span>📲 <b>Add to Home Screen</b> (Share → Add to Home Screen). Safari can clear data for sites that aren't installed.</span>
      <button type="button" class="chip" data-dismiss="install">Got it</button>`;
  } else if (needsBackup) {
    html = `<span>💾 It's been a while since your last backup.</span>
      <button type="button" class="chip primary" data-backup>Export</button>`;
  }
  if (!html) return;
  banner.innerHTML = html;
  banner.hidden = false;
  banner.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-dismiss="install"]')) settings.set({ installTipSeen: true });
    else if (t.closest('[data-backup]')) exportDownload();
    else return;
    banner.hidden = true;
    try {
      sessionStorage.setItem('tinylog:banner-dismissed', '1');
    } catch {
      /* ignore */
    }
  };
}

render();
void init().then(({ restored }) => {
  if (restored) toast(`Recovered ${restored} entr${restored === 1 ? 'y' : 'ies'} from the on-device backup copy`);
  document.documentElement.dataset.ready = '';
  showBanner();
  render();
});
setupPwa();
