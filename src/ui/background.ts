import type { Background } from '../core/types';
import type { Sky } from '../fx/sky';

/**
 * Page background: the soft glow blobs (default), a three.js night sky (lazy-loaded), or plain.
 * The sky is created on demand and torn down when you switch away, so it costs nothing otherwise.
 */
let sky: Sky | null = null;
let loading: Promise<void> | null = null;
let current: Background | null = null;

function starColor(): string {
  const probe = document.createElement('span');
  probe.style.color = 'var(--text)';
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  // three.js wants a plain color; rgb() from getComputedStyle is fine.
  return c.startsWith('rgb') ? c : '#f7f0ff';
}

export function applyBackground(bg: Background) {
  const host = document.querySelector<HTMLElement>('.bg')!;
  host.dataset.bg = bg;
  if (bg === current) {
    sky?.setColor(starColor());
    return;
  }
  current = bg;
  if (bg !== 'sky') {
    sky?.dispose();
    sky = null;
    return;
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dim = document.documentElement.dataset.theme === 'night';
  loading ??= import('../fx/sky')
    .then(({ createSky }) => {
      if (current !== 'sky') return;
      sky = createSky(host, { color: starColor(), still, dim });
    })
    .catch(() => {
      host.dataset.bg = 'glow'; // no WebGL: fall back quietly
    })
    .finally(() => {
      loading = null;
    });
}
