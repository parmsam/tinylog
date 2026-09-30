import type { Background } from '../core/types';

/** Tiny static previews for the background picker (no WebGL until a scene is chosen). */
const bg = (inner: string, fill = 'var(--bg2)') =>
  `<svg viewBox="0 0 64 40" aria-hidden="true"><rect width="64" height="40" rx="8" fill="${fill}"/>${inner}</svg>`;

const dots = (pts: [number, number, number][], color: string, op = 0.9) =>
  pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${op}"/>`).join('');

export const PREVIEWS: Record<Background, string> = {
  glow: bg(`<circle cx="14" cy="10" r="16" fill="var(--glow1)" opacity=".5"/><circle cx="52" cy="30" r="18" fill="var(--glow2)" opacity=".5"/>`),
  none: bg(''),
  sky: bg(dots([[8, 8, 0.9], [20, 14, 0.6], [34, 6, 1.1], [46, 18, 0.7], [56, 9, 0.9], [12, 28, 0.7], [28, 30, 0.6], [50, 32, 0.9]], 'var(--text)') + `<path d="M40 12l10 5" stroke="var(--text)" stroke-width=".8" opacity=".7"/>`),
  fireflies: bg(dots([[12, 12, 2.2], [26, 26, 1.6], [40, 14, 2.4], [52, 28, 1.8], [18, 32, 1.4]], 'var(--glow3)') + dots([[12, 12, 5], [40, 14, 6]], 'var(--glow3)', 0.2)),
  bubbles: bg([[14, 26, 6], [30, 14, 4], [44, 28, 7], [54, 10, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--glow1)" stroke-width="1.1" opacity=".8"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.2}" fill="var(--text)" opacity=".8"/>`).join('')),
  mobile: bg(`<ellipse cx="32" cy="5" rx="18" ry="1.6" fill="none" stroke="var(--text)" opacity=".4"/>
    <path d="M18 5v12M30 6v18M44 5v10M50 5v20" stroke="var(--text)" stroke-width=".6" opacity=".35"/>
    <path d="M18 17a4 4 0 1 0 0 8 3 3 0 0 1 0-8Z" fill="var(--glow1)"/><path d="M30 24l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3Z" fill="var(--glow3)"/>
    <path d="M44 15c-2 0-3 3 0 5 3-2 2-5 0-5Z" fill="var(--glow2)"/><circle cx="50" cy="27" r="2.5" fill="var(--text)" opacity=".6"/>`),
  snow: bg(dots([[8, 6, 1.4], [20, 16, 1], [30, 8, 1.6], [42, 20, 1.1], [54, 12, 1.5], [14, 30, 1.2], [36, 32, 1.6], [50, 34, 1]], 'var(--text)', 0.75)),
};
