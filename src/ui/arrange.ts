import { cardById, orderCards, type CardId } from '../core/cards';
import { buzz } from '../core/haptics';
import { settings } from '../core/log';
import { confirmAction } from './confirm';
import { toast } from './toast';

/**
 * Arrange mode: move the home-screen buttons around. While it's on, nothing logs: taps, holds and
 * card keys are ignored, so a stray touch at 3 AM can't add an entry. Drag a button to its new
 * spot (the others make room as you go), or focus one and use the arrow keys. Each move is saved.
 * The × on a button hides it (after asking); hidden ones are listed in the bar to bring back.
 */

let arranging = false;
let host: HTMLElement | null = null;
let bar: HTMLElement | null = null;
let live: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let pinRaf = 0;

export const isArranging = () => arranging;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const visibleCards = () => (host ? [...host.querySelectorAll<HTMLElement>('.card:not([hidden])')] : []);
const label = (el: HTMLElement) => el.querySelector('.card-label')?.textContent ?? '';

function save() {
  if (!host) return;
  const order = [...host.querySelectorAll<HTMLElement>('.card')].map((b) => b.dataset.card!);
  placeHides();
  settings.set({ cardOrder: order });
}

// ---- Hiding ----

/** Each × sits right after its button in the DOM (so Tab goes button, ×, next button). */
function placeHides() {
  host?.querySelectorAll<HTMLElement>('.card-hide').forEach((x) => host!.querySelector(`.card[data-card="${x.dataset.hide}"]`)?.after(x));
}

/** Keeps every × on its button's top-right corner (buttons move, appear and disappear while arranging). */
function pinHides() {
  if (!host) return;
  for (const x of host.querySelectorAll<HTMLElement>('.card-hide')) {
    const card = host.querySelector<HTMLElement>(`.card[data-card="${x.dataset.hide}"]`);
    x.hidden = !card || card.hidden;
    if (!card || card.hidden) continue;
    x.style.left = `${card.offsetLeft + card.offsetWidth - 22}px`;
    x.style.top = `${card.offsetTop - 10}px`;
  }
  pinRaf = requestAnimationFrame(pinHides);
}

async function hide(id: CardId) {
  const card = cardById(id);
  const hidden = settings.get().hiddenCards;
  if (visibleCards().length <= 1) {
    toast('Keep at least one button');
    return;
  }
  const ok = await confirmAction({
    title: `Hide ${card.emoji} ${card.label}?`,
    body: 'It leaves the home screen. Past entries, links and its key still work, and you can bring it back from this bar or Settings → Buttons.',
    confirm: 'Hide',
  });
  if (!ok) return;
  settings.set({ hiddenCards: [...new Set([...hidden, id])] });
  if (live) live.textContent = `${card.label} hidden`;
}

function show(id: CardId) {
  settings.set({ hiddenCards: settings.get().hiddenCards.filter((h) => h !== id) });
  if (live) live.textContent = `${cardById(id).label} is back`;
}

/** The bar's list of hidden buttons, each a chip to bring it back. */
function renderHidden() {
  const list = bar?.querySelector<HTMLElement>('[data-hidden-list]');
  if (!list) return;
  const hidden = orderCards(settings.get().cardOrder).filter((c) => settings.get().hiddenCards.includes(c.id));
  list.hidden = !hidden.length;
  list.innerHTML = hidden.length
    ? `<span class="arrange-hidden-label">Hidden:</span>${hidden.map((c) => `<button type="button" class="chip" data-show="${c.id}" aria-label="Show ${c.label}">+ ${c.emoji} ${c.label}</button>`).join('')}`
    : '';
}

function announce(el: HTMLElement) {
  const list = visibleCards();
  if (live) live.textContent = `${label(el)} moved to position ${list.indexOf(el) + 1} of ${list.length}`;
}

/** Moves DOM nodes with a short slide for the others (FLIP), so you can see where things went. */
function withSlide(change: () => void, skip?: HTMLElement) {
  if (!host) return;
  const cards = visibleCards();
  const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
  change();
  if (reduced()) return;
  for (const c of cards) {
    if (c === skip) continue;
    const a = before.get(c)!;
    const b = c.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (dx || dy) c.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 180, easing: 'ease-out' });
  }
}

// ---- Dragging ----

interface Drag {
  el: HTMLElement;
  id: number;
  startX: number;
  startY: number;
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  moved: boolean;
  raf: number;
}
let drag: Drag | null = null;

/** Where the dragged button sits in the layout (ignoring its own transform), in viewport coordinates. */
function layoutPos(el: HTMLElement) {
  const r = host!.getBoundingClientRect();
  return { left: r.left + el.offsetLeft, top: r.top + el.offsetTop };
}

function follow() {
  if (!drag) return;
  const p = layoutPos(drag.el);
  drag.el.style.translate = `${drag.x - drag.grabX - p.left}px ${drag.y - drag.grabY - p.top}px`;
}

/** If the pointer is over another button, take its place. */
function reflow() {
  if (!drag) return;
  const { el, x, y } = drag;
  const cards = visibleCards();
  const over = cards.find((c) => {
    if (c === el) return false;
    const r = c.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
  if (!over) return;
  const from = cards.indexOf(el);
  const to = cards.indexOf(over);
  withSlide(() => (to > from ? over.after(el) : over.before(el)), el);
  if (settings.get().haptics) buzz('tap');
}

/** Scrolls when a dragged button nears the top or bottom edge, so it can travel the whole list. */
function autoScroll() {
  if (!drag) return;
  const edge = 70;
  const barTop = bar?.getBoundingClientRect().top ?? innerHeight;
  const bottom = Math.min(innerHeight, barTop);
  const dy = drag.y < edge ? -Math.ceil((edge - drag.y) / 6) : drag.y > bottom - edge ? Math.ceil((drag.y - (bottom - edge)) / 6) : 0;
  if (dy && drag.moved) {
    scrollBy(0, dy);
    reflow();
    follow();
  }
  drag.raf = requestAnimationFrame(autoScroll);
}

function onDown(e: PointerEvent) {
  if (!arranging || drag || e.button !== 0) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
  if (!el || el.hidden) return;
  e.preventDefault();
  host!.classList.add('has-drag');
  el.setPointerCapture?.(e.pointerId);
  const r = el.getBoundingClientRect();
  drag = { el, id: e.pointerId, startX: e.clientX, startY: e.clientY, grabX: e.clientX - r.left, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY, moved: false, raf: 0 };
  drag.raf = requestAnimationFrame(autoScroll);
}

function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    drag.moved = true;
    drag.el.classList.add('dragging');
    if (settings.get().haptics) buzz('tap');
  }
  e.preventDefault();
  reflow();
  follow();
}

function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return;
  const { el, moved, raf } = drag;
  cancelAnimationFrame(raf);
  drag = null;
  el.classList.remove('dragging');
  host?.classList.remove('has-drag');
  if (!moved) return;
  // Settle into the new slot.
  const from = el.style.translate;
  el.style.translate = '';
  if (from && !reduced()) el.animate([{ translate: from }, { translate: '0 0' }], { duration: 160, easing: 'ease-out' });
  save();
  announce(el);
}

// ---- Keyboard ----

function onKey(e: KeyboardEvent) {
  if (!arranging) return;
  // The hide confirmation handles its own keys.
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    exitArrange();
    return;
  }
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('.card');
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!el || !host?.contains(el) || !step) return;
  e.preventDefault();
  const cards = visibleCards();
  const target = cards[cards.indexOf(el) + step];
  if (!target) return;
  withSlide(() => (step > 0 ? target.after(el) : target.before(el)));
  el.focus();
  save();
  announce(el);
}

// ---- Mode ----

export function enterArrange(cards: HTMLElement) {
  if (arranging) return;
  arranging = true;
  host = cards;
  host.classList.add('arranging');
  host.addEventListener('pointerdown', onDown);
  // Move and release on the whole page: a drag can end over the bar, or after the browser drops
  // pointer capture (WebKit does when the dragged button moves in the DOM).
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
  document.addEventListener('keydown', onKey, true);

  bar = document.createElement('div');
  bar.className = 'arrange-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Arranging buttons');
  bar.innerHTML = `<p><strong>Arranging buttons.</strong> Drag to move (or arrow keys), × to hide. Nothing gets logged.</p>
    <div class="arrange-hidden" data-hidden-list hidden></div>
    <span class="visually-hidden" aria-live="polite"></span>
    <button type="button" class="btn primary" data-arrange-done>Done</button>`;
  live = bar.querySelector('[aria-live]');
  bar.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-arrange-done]')) exitArrange();
    const showBtn = t.closest<HTMLElement>('[data-show]');
    if (showBtn) show(showBtn.dataset.show as CardId);
  });

  // A × per button, pinned to its corner.
  for (const c of orderCards(settings.get().cardOrder)) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'card-hide';
    x.dataset.hide = c.id;
    x.setAttribute('aria-label', `Hide ${c.label}`);
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
    x.addEventListener('click', () => void hide(c.id));
    host.append(x);
  }
  placeHides();
  pinHides();
  renderHidden();
  unsubscribe = settings.subscribe((s, prev) => {
    if (s.hiddenCards !== prev.hiddenCards || s.cardOrder !== prev.cardOrder) renderHidden();
  });
  document.body.append(bar);
  document.body.classList.add('is-arranging');
  host.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  visibleCards()[0]?.focus({ preventScroll: true });
}

export function exitArrange() {
  if (!arranging || !host) return;
  if (drag) {
    // Ended mid-drag (Done, Escape): keep where it got to.
    const moved = drag.moved;
    cancelAnimationFrame(drag.raf);
    drag.el.classList.remove('dragging');
    drag.el.style.translate = '';
    drag = null;
    if (moved) save();
  }
  host.classList.remove('arranging');
  host.removeEventListener('pointerdown', onDown);
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerup', onUp);
  document.removeEventListener('pointercancel', onUp);
  document.removeEventListener('keydown', onKey, true);
  cancelAnimationFrame(pinRaf);
  host.querySelectorAll('.card-hide').forEach((x) => x.remove());
  host.classList.remove('has-drag');
  unsubscribe?.();
  unsubscribe = null;
  bar?.remove();
  document.body.classList.remove('is-arranging');
  bar = live = null;
  host = null;
  arranging = false;
}
