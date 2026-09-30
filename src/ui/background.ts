import type { Background } from '../core/types';
import type { SceneRunner } from '../fx/scenes';

/**
 * Page background: the soft glow (default), a three.js scene (lazy-loaded), or plain.
 * A scene is created on demand and torn down when you switch away, so it costs nothing otherwise.
 */
let runner: SceneRunner | null = null;
let current: Background | null = null;
let token = 0;
let calm = false;

const isSceneId = (bg: Background) => bg !== 'glow' && bg !== 'none';

export function applyBackground(bg: Background) {
  const host = document.querySelector<HTMLElement>('.bg')!;
  host.dataset.bg = bg;
  if (bg === current) {
    // Same scene, new theme: recolor.
    if (runner) void import('../fx/scenes').then(({ readSceneColors }) => runner?.setColors(readSceneColors()));
    return;
  }
  current = bg;
  runner?.stop();
  runner = null;
  host.querySelector('canvas.scene-canvas')?.remove();
  if (!isSceneId(bg)) return;

  const mine = ++token;
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  void import('../fx/scenes')
    .then(({ runScene }) => runScene(bg, canvas, { still }))
    .then((r) => {
      if (mine !== token) return r?.stop();
      if (!r) {
        canvas.remove();
        host.dataset.bg = 'glow'; // no WebGL: fall back quietly
        return;
      }
      runner = r;
      r.setCalm(calm);
    })
    .catch(() => {
      canvas.remove();
      host.dataset.bg = 'glow';
    });
}

/** A soft flash when something is logged. */
export function backgroundPulse() {
  runner?.pulse();
}

/** Slower while the baby sleeps. */
export function backgroundCalm(on: boolean) {
  if (on === calm) return;
  calm = on;
  runner?.setCalm(on);
}
