import type { Settings } from './types';

export const SETTINGS_KEY = 'tinylog:v1:settings';

export const DEFAULT_SETTINGS: Settings = {
  babyName: '',
  units: 'ml',
  clock: 'auto',
  dayStartHour: 0,
  theme: 'auto',
  lastBackupAt: null,
  installTipSeen: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    if (!Number.isInteger(s.dayStartHour) || s.dayStartHour < 0 || s.dayStartHour > 12) s.dayStartHour = 0;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled or full: settings just won't persist */
  }
}
