import { CARDS, type CardId } from '../core/cards';
import { dayKey } from '../core/days';
import { app, settings } from '../core/log';
import { cardStatus } from '../core/status';
import { cardPop } from '../fx/anims';
import { buzz, hapticTrigger } from '../core/haptics';
import { holdCard, tapCard } from './actions';

const HOLD_MS = 450;

export function mountCards(host: HTMLElement) {
  host.innerHTML = CARDS.map(
    (c) => `<button type="button" class="card" data-card="${c.id}" style="--c: var(--c-${c.id})">
      <span class="card-ring" aria-hidden="true"></span>
      <span class="card-emoji" aria-hidden="true">${c.emoji}</span>
      <span class="card-label">${c.label}</span>
      <span class="card-primary"></span>
      <span class="card-secondary"></span>
    </button>`,
  ).join('');

  for (const btn of host.querySelectorAll<HTMLButtonElement>('.card')) {
    const id = btn.dataset.card as CardId;
    hapticTrigger(btn);
    let timer: number | undefined;
    let held = false;
    let startX = 0;
    let startY = 0;
    const cancel = () => clearTimeout(timer);

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      held = false;
      startX = e.clientX;
      startY = e.clientY;
      timer = window.setTimeout(() => {
        held = true;
        if (settings.get().haptics) buzz('tap');
        holdCard(id);
      }, HOLD_MS);
    });
    btn.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    });
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!held) {
        cancel();
        held = true;
        holdCard(id);
      }
    });
    // Click also covers keyboard (Enter/Space).
    btn.addEventListener('click', () => {
      if (held) {
        held = false;
        return;
      }
      cancel();
      if (settings.get().haptics) buzz('tap');
      cardPop(btn);
      tapCard(id);
    });
  }
}

export function renderCards(host: HTMLElement, now = Date.now()) {
  const s = app.get();
  const prefs = settings.get();
  const isToday = s.day === dayKey(now, prefs.dayStartHour);
  for (const c of CARDS) {
    const btn = host.querySelector<HTMLButtonElement>(`[data-card="${c.id}"]`)!;
    const st = cardStatus(c, s.events, s.day, now, prefs);
    btn.querySelector('.card-primary')!.textContent = st.primary;
    btn.querySelector('.card-secondary')!.textContent = st.secondary;
    btn.classList.toggle('is-ongoing', st.ongoing);
    // A hidden button still shows while its timer runs, so it can be stopped.
    btn.hidden = prefs.hiddenCards.includes(c.id) && !st.ongoing;
    const hint = !isToday ? 'Tap to add an entry for this day' : c.timed ? (st.ongoing ? 'Tap to stop' : 'Tap to start') : c.sheetFirst ? 'Tap to add' : 'Tap to log now';
    btn.setAttribute('aria-label', `${c.label}: ${st.primary}${st.secondary ? `, ${st.secondary}` : ''}. ${hint}; hold for details.`);
  }
}
