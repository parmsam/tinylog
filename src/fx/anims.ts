import { animate } from 'animejs';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const night = () => document.documentElement.dataset.theme === 'night';

/** Squish-and-spring feedback when a card logs something. */
export function cardPop(card: HTMLElement) {
  if (reduced()) return;
  const soft = night();
  animate(card, {
    scale: [{ to: soft ? 0.97 : 0.93, duration: 110, ease: 'outQuad' }, { to: 1, duration: 520, ease: 'outElastic(1, .55)' }],
  });
  const emoji = card.querySelector<HTMLElement>('.card-emoji');
  if (emoji && !soft) {
    animate(emoji, {
      translateY: [{ to: -8, duration: 160, ease: 'outQuad' }, { to: 0, duration: 520, ease: 'outBounce' }],
      rotate: [{ to: -12, duration: 160 }, { to: 0, duration: 420, ease: 'outElastic(1, .5)' }],
    });
  }
  const ring = card.querySelector<HTMLElement>('.card-ring');
  if (ring) animate(ring, { opacity: [{ to: soft ? 0.4 : 0.9, duration: 90 }, { to: 0, duration: 700, ease: 'outQuad' }] });
}

/** Gentle arrival for freshly rendered entries. */
export function riseIn(els: HTMLElement[]) {
  if (reduced() || !els.length) return;
  els.forEach((el, i) => {
    animate(el, { opacity: [0, 1], translateY: [8, 0], duration: 380, delay: i * 25, ease: 'outCubic' });
  });
}
