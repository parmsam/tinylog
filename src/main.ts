import './styles.css';
import { CARDS } from './core/cards';
import { addDays, dayKey } from './core/days';
import { app, init, settings, setupPersistence, today } from './core/log';
import { tapCard } from './ui/actions';
import { mountCards, renderCards } from './ui/cardsView';
import { goToDay, mountDayView, renderDayView } from './ui/dayView';
import { setupPwa } from './ui/pwa';
import { openSettings } from './ui/settingsView';
import { showBanner } from './ui/tips';
import { applyTheme } from './ui/theme';
import { applyBackground } from './ui/background';
import { toast, undoLast } from './ui/toast';
import { openAmbient } from './ui/ambient';
import { openShortcuts } from './ui/shortcuts';
import { openRecap } from './ui/recapView';
import { runLinkAction } from './ui/linkRunner';
import { createAgentApi } from './ui/agentApi';
import { copyMarkdown, openTrends } from './ui/trendsView';
import { renderDayGrid } from './viz/dayGridView';
import { mountCompanion, renderCompanion } from './ui/companion';
import { setHapticTriggersEnabled } from './core/haptics';
import { renderRadialClock } from './viz/radialClock';

const cardsEl = document.getElementById('cards')!;

setupPersistence();
applyTheme(settings.get().theme);
applyBackground(settings.get().background);
mountCards(cardsEl);
mountCompanion();
setHapticTriggersEnabled(settings.get().haptics);
mountDayView();
document.getElementById('settings-open')!.addEventListener('click', openSettings);
document.getElementById('trends-open')!.addEventListener('click', openTrends);
document.getElementById('ambient-open')!.addEventListener('click', openAmbient);
document.getElementById('shortcuts-open')!.addEventListener('click', openShortcuts);
document.getElementById('recap-open')!.addEventListener('click', () => void openRecap());
const clockEl = document.getElementById('day-clock')!;

// Clock or grid for the selected day; remembered per device.
let dayView: 'clock' | 'grid' = 'clock';
try {
  if (localStorage.getItem('tinylog:day-view') === 'grid') dayView = 'grid';
} catch {
  /* ignore */
}
const dayViewInputs = document.querySelectorAll<HTMLInputElement>('input[name="dayview"]');
dayViewInputs.forEach((input) => {
  input.checked = input.value === dayView;
  input.addEventListener('change', () => {
    dayView = input.value as typeof dayView;
    try {
      localStorage.setItem('tinylog:day-view', dayView);
    } catch {
      /* ignore */
    }
    render();
  });
});

let frame = 0;
function render() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const now = Date.now();
    renderCards(cardsEl, now);
    renderDayView(now);
    renderCompanion(now);
    const s = app.get();
    if (s.loaded) {
      clockEl.classList.toggle('grid-box', dayView === 'grid');
      if (dayView === 'grid') renderDayGrid(clockEl, s.events, s.day, now, settings.get());
      else renderRadialClock(clockEl, s.events, s.day, now, settings.get());
    }
    const name = settings.get().babyName.trim();
    document.getElementById('brand-name')!.textContent = name || 'tinylog';
    document.title = name ? `${name} · tinylog` : 'tinylog';
  });
}

app.subscribe(render);
// New entries can make the backup reminder due (every 50 since the last backup).
app.subscribe((s, prev) => {
  if (s.loaded && s.events.length !== prev.events.length) showBanner();
});
settings.subscribe((s, prev) => {
  if (s.theme !== prev.theme) {
    applyTheme(s.theme);
    applyBackground(s.background);
  }
  if (s.background !== prev.background) applyBackground(s.background);
  if (s.haptics !== prev.haptics) setHapticTriggersEnabled(s.haptics);
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
  else if (key === 'r') void openRecap();
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

render();
void init().then(({ restored }) => {
  if (restored) toast(`Recovered ${restored} entr${restored === 1 ? 'y' : 'ies'} from the on-device backup copy`);
  document.documentElement.dataset.ready = '';
  runLinkAction();
  showBanner();
  render();
});
setupPwa();
window.tinylog = createAgentApi();
