import { cardById, lastFor, lastWake, ongoingFor } from '../core/cards';
import { clockTime, duration } from '../core/format';
import { app, settings } from '../core/log';
import { summary } from '../core/status';

/**
 * Bedside display: big, dim, readable from across the room. Last feed, awake/asleep, the time.
 * Keeps the screen on while open (where Wake Lock is supported). Tap anywhere or press Esc to close.
 */
let lock: WakeLockSentinel | null = null;
let timer: number | undefined;

async function keepAwake() {
  try {
    lock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    lock = null;
  }
}

function update(root: HTMLElement) {
  const now = Date.now();
  const { events } = app.get();
  const prefs = settings.get();
  const feed = lastFor(events, cardById('feed'), now);
  const sleeping = ongoingFor(events, cardById('nap')) ?? ongoingFor(events, cardById('night'));
  const wake = lastWake(events, now);
  const set = (sel: string, text: string) => {
    const el = root.querySelector(sel);
    if (el && el.textContent !== text) el.textContent = text;
  };
  set('.amb-clock', clockTime(now, prefs.clock));
  set('.amb-feed', feed ? duration(now - feed.at) : '—');
  set('.amb-feed-sub', feed ? `${clockTime(feed.at, prefs.clock)} · ${summary(feed, prefs)}` : 'no feeds yet');
  set('.amb-sleep-label', sleeping ? 'asleep for' : 'awake for');
  set('.amb-sleep', sleeping ? duration(now - sleeping.at) : wake !== undefined ? duration(now - wake) : '—');
  set('.amb-sleep-sub', sleeping ? `since ${clockTime(sleeping.at, prefs.clock)}` : wake !== undefined ? `woke ${clockTime(wake, prefs.clock)}` : '');
}

export function openAmbient() {
  const dialog = document.getElementById('ambient') as HTMLDialogElement;
  const name = settings.get().babyName.trim();
  dialog.innerHTML = `<div class="amb" aria-live="off">
    <div class="amb-clock"></div>
    <div class="amb-grid">
      <div><div class="amb-label">🍼 since last feed</div><div class="amb-big amb-feed"></div><div class="amb-sub amb-feed-sub"></div></div>
      <div><div class="amb-label">${name ? `${name} · ` : ''}<span class="amb-sleep-label"></span></div><div class="amb-big amb-sleep"></div><div class="amb-sub amb-sleep-sub"></div></div>
    </div>
    <p class="amb-hint">Tap anywhere to close</p>
  </div>`;
  const root = dialog.firstElementChild as HTMLElement;
  update(root);
  clearInterval(timer);
  timer = window.setInterval(() => update(root), 1000);
  dialog.onclick = () => dialog.close();
  dialog.onclose = () => {
    clearInterval(timer);
    void lock?.release().catch(() => {});
    lock = null;
  };
  if (!dialog.open) dialog.showModal();
  void keepAwake();
}

// A wake lock is dropped when the page is hidden; take it back when the display is still up.
document.addEventListener('visibilitychange', () => {
  const open = (document.getElementById('ambient') as HTMLDialogElement | null)?.open;
  if (open && document.visibilityState === 'visible') void keepAwake();
});
