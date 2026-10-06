/** Shortest time the splash stays up, so it reads as a moment rather than a flicker. */
export const SPLASH_MIN_MS = 900;
/** It never holds the app longer than this, even if loading is slow. */
export const SPLASH_MAX_MS = 2500;

const MOON = `<svg class="splash-mark" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="splash-moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc7a8"/><stop offset="1" stop-color="#ff9f8a"/></linearGradient></defs>
  <path class="splash-moon" d="M38.5 14.5a19 19 0 1 0 12 30.4A15.5 15.5 0 0 1 38.5 14.5Z" fill="url(#splash-moon)"/>
  <circle class="splash-star s1" cx="47" cy="17" r="2.6" fill="#b3a4ff"/>
  <circle class="splash-star s2" cx="53.5" cy="27" r="1.6" fill="#7cc8ee"/>
</svg>`;

/**
 * Branded splash over the app while it opens. It leaves once the log has loaded and the minimum
 * time has passed, or straight away on any tap or key (the tap is swallowed so it never logs).
 * Links that log something (`?do=`) skip it: they should feel instant.
 */
export function showSplash(ready: Promise<unknown>, { enabled, search = location.search }: { enabled: boolean; search?: string }) {
  if (!enabled || new URLSearchParams(search).has('do')) return;
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `${MOON}<p class="splash-name">tinylog</p><p class="splash-caption">Little moments, logged.</p>`;
  document.body.append(el);

  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    // Fallback for when animationend never fires (reduced motion, hidden tab).
    const remove = () => el.remove();
    el.addEventListener('animationend', remove, { once: true });
    window.setTimeout(remove, 600);
  };
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    leave();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    leave();
  });
  // The tap that dismisses shouldn't land on a card underneath once the splash is fading.
  el.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('keydown', onKey, true);

  const min = new Promise((res) => window.setTimeout(res, SPLASH_MIN_MS));
  void Promise.race([Promise.all([ready.catch(() => undefined), min]), new Promise((res) => window.setTimeout(res, SPLASH_MAX_MS))]).then(leave);
}
