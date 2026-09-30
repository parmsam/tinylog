import type { Scene, SceneColors, SceneFactory, SceneId } from './types';

export type { SceneId } from './types';

/** Scenes in picker order. Small static previews live in `ui/scenePreviews.ts`. */
export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'sky', label: 'Night sky' },
  { id: 'fireflies', label: 'Fireflies' },
  { id: 'bubbles', label: 'Bubbles' },
  { id: 'mobile', label: 'Crib mobile' },
  { id: 'snow', label: 'Snow' },
];

export const isScene = (v: string): v is SceneId => SCENES.some((s) => s.id === v);

// Each scene (and three.js with it) is only downloaded when chosen.
const loaders: Record<SceneId, () => Promise<SceneFactory>> = {
  sky: () => import('./sky').then((m) => m.createSky),
  fireflies: () => import('./fireflies').then((m) => m.createFireflies),
  bubbles: () => import('./bubbles').then((m) => m.createBubbles),
  mobile: () => import('./mobile').then((m) => m.createMobile),
  snow: () => import('./snow').then((m) => m.createSnow),
};

/** Theme colors resolved to plain rgb() so three.js can read them (tokens may use color-mix). */
export function readSceneColors(): SceneColors {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const get = (v: string) => {
    probe.style.color = `var(${v})`;
    return getComputedStyle(probe).color;
  };
  const colors = { bg: get('--bg'), a: get('--glow1'), b: get('--glow2'), c: get('--glow3'), text: get('--text') };
  probe.remove();
  return colors;
}

export interface SceneRunner {
  setColors(c: SceneColors): void;
  /** Calmer while the baby sleeps: motion slows smoothly. */
  setCalm(calm: boolean): void;
  /** A soft flash, e.g. when something is logged. */
  pulse(): void;
  stop(): void;
}

/**
 * Runs a scene on a canvas: ~30 fps render loop, paused while the tab is hidden, resize,
 * and smoothly eased speed. `still` draws a single frame (reduced motion).
 * Returns null if WebGL isn't available.
 */
export async function runScene(id: SceneId, canvas: HTMLCanvasElement, opts: { still: boolean }): Promise<SceneRunner | null> {
  let scene: Scene;
  try {
    scene = (await loaders[id]())(canvas, readSceneColors());
  } catch {
    return null; // no WebGL or failed to load: caller falls back to the CSS background
  }

  let raf = 0;
  let last = performance.now();
  let time = 0;
  let speed = 1;
  let targetSpeed = 1;
  let pulse = 0;
  let stopped = false;

  const resize = () => {
    scene.resize(canvas.clientWidth, canvas.clientHeight);
    if (opts.still) scene.render(12, 0, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (now - last < 32) return; // ~30 fps is plenty for a background
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
    time += dt * speed;
    pulse = Math.max(0, pulse - dt * 0.6);
    scene.render(time, dt * speed, pulse);
  }

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden && !stopped && !opts.still) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  if (opts.still) scene.render(12, 0, 0);
  else onVisibility();

  return {
    setColors: (c) => {
      scene.setColors(c);
      if (opts.still) scene.render(12, 0, 0);
    },
    setCalm: (calm) => (targetSpeed = calm ? 0.4 : 1),
    pulse: () => (pulse = 1),
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.dispose();
    },
  };
}
