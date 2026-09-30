import type { ThemeChoice } from '../core/types';

const THEME_COLOR = { day: '#fff8f1', dusk: '#1b1726', night: '#0b0806' } as const;
type Theme = keyof typeof THEME_COLOR;

/** Auto: night from 9 PM to 6 AM, otherwise follows the system light/dark setting. */
export function resolveTheme(choice: ThemeChoice, now = new Date(), prefersDark = matchMedia('(prefers-color-scheme: dark)').matches): Theme {
  if (choice !== 'auto') return choice;
  const h = now.getHours();
  if (h >= 21 || h < 6) return 'night';
  return prefersDark ? 'dusk' : 'day';
}

export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
