import { utils } from 'animejs';
import { buzz } from '../core/haptics';
import { settings } from '../core/log';

/** Pixels a drag moves before it counts as a swipe (or a scroll). */
const SLOP = 10;
/** Past this share of the row's width, letting go deletes. */
const COMMIT = 0.35;
/** A quick flick deletes too (px/ms, leftward). */
const FLING = 0.6;

let active = false;
/** True from the moment a row starts sliding until its delete is settled, so the list isn't re-rendered under the finger. */
export const isSwiping = () => active;

interface Drag {
  row: HTMLElement;
  li: HTMLElement;
  id: string;
  pointerId: number;
  x0: number;
  y0: number;
  dx: number;
  /** Last two samples, for the flick speed. */
  lastX: number;
  lastT: number;
  vx: number;
  sliding: boolean;
  armed: boolean;
}

/**
 * Swipe a log row left to delete it. `onSwipe` does the delete (and may ask first);
 * if it resolves false the row slides back. Rows keep vertical scrolling and pinch-zoom
 * (`touch-action: pan-y pinch-zoom` in CSS); a swipe never also opens the row.
 */
export function mountSwipeDelete(list: HTMLElement, onSwipe: (id: string) => Promise<boolean>) {
  let drag: Drag | null = null;
  let swallowClick = false;

  list.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || active) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('.entry[data-id]');
    const li = row?.parentElement;
    if (!row || !li) return;
    drag = { row, li, id: row.dataset.id!, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, lastX: e.clientX, lastT: e.timeStamp, vx: 0, sliding: false, armed: false };
  });

  list.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.sliding) {
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) drag = null; // it's a scroll
      if (!drag || dx > -SLOP || Math.abs(dx) <= Math.abs(dy)) return;
      d.sliding = true;
      active = true;
      // A row that just arrived may still be rising in; that animation also writes transform.
      utils.remove(d.row);
      d.row.style.opacity = '';
      d.row.setPointerCapture?.(e.pointerId);
      d.li.classList.add('is-swiping');
    }
    if (e.timeStamp > d.lastT) d.vx = (e.clientX - d.lastX) / (e.timeStamp - d.lastT);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    d.dx = Math.min(0, dx);
    d.row.style.transform = `translateX(${d.dx}px)`;
    const armed = -d.dx > d.row.offsetWidth * COMMIT;
    if (armed && !d.armed && settings.get().haptics) buzz('tap');
    d.armed = armed;
    d.li.classList.toggle('is-armed', armed);
  });

  const release = (e: PointerEvent, cancelled: boolean) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    drag = null;
    if (!d.sliding) return;
    // The click that follows pointerup belongs to the swipe, not to "open this entry".
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    const commit = !cancelled && (d.armed || (d.vx < -FLING && d.dx < -3 * SLOP));
    void finish(d, commit);
  };
  list.addEventListener('pointerup', (e) => release(e, false));
  list.addEventListener('pointercancel', (e) => release(e, true));

  list.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  async function finish(d: Drag, commit: boolean) {
    try {
      if (commit) {
        await settle(d.row, -d.row.offsetWidth);
        if (await onSwipe(d.id)) return;
      }
      await settle(d.row, 0);
    } finally {
      d.li.classList.remove('is-swiping', 'is-armed');
      d.row.style.transform = '';
      active = false;
    }
  }
}

/** Slides the row to `x` (instantly under reduced motion, where the CSS transition is off). */
function settle(row: HTMLElement, x: number): Promise<void> {
  row.classList.add('is-settling');
  row.style.transform = `translateX(${x}px)`;
  const ms = parseFloat(getComputedStyle(row).transitionDuration) * 1000 || 0;
  return new Promise((done) =>
    setTimeout(() => {
      row.classList.remove('is-settling');
      done();
    }, ms),
  );
}
