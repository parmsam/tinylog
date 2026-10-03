import type { AccessoryId, Settings } from './types';

export const SETTINGS_KEY = 'tinylog:v1:settings';

/** Backup reminder intervals offered in Settings (0 = only every 50 entries). */
export const BACKUP_DAY_CHOICES = [2, 4, 7, 14, 0];

export const DEFAULT_SETTINGS: Settings = {
  babyName: '',
  units: 'ml',
  clock: 'auto',
  dayStartHour: 0,
  theme: 'auto',
  lastBackupAt: null,
  backupSnoozedAt: 0,
  backupLaterAt: 0,
  backupEveryDays: 4,
  tipsSeen: [],
  gridMarks: 'dots',
  haptics: true,
  companion: 'puff',
  accessories: [],
  background: 'glow',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Settings> & { installTipSeen?: boolean };
    const s = { ...DEFAULT_SETTINGS, ...saved };
    // v0.1 stored a single flag for the install tip.
    if (!Array.isArray(s.tipsSeen)) s.tipsSeen = [];
    if (saved.installTipSeen && !s.tipsSeen.includes('install')) s.tipsSeen = [...s.tipsSeen, 'install'];
    delete (s as { installTipSeen?: boolean }).installTipSeen;
    if (!['dots', 'checks', 'crosses'].includes(s.gridMarks)) s.gridMarks = 'dots';
    if (!Number.isInteger(s.backupSnoozedAt) || s.backupSnoozedAt < 0) s.backupSnoozedAt = 0;
    if (!Number.isFinite(s.backupLaterAt) || s.backupLaterAt < 0) s.backupLaterAt = 0;
    if (!BACKUP_DAY_CHOICES.includes(s.backupEveryDays)) s.backupEveryDays = DEFAULT_SETTINGS.backupEveryDays;
    if (!['glow', 'none', 'sky', 'fireflies', 'bubbles', 'mobile', 'snow'].includes(s.background)) s.background = 'glow';
    s.haptics = s.haptics !== false;
    // v0.1 stored a boolean.
    const c = s.companion as unknown;
    if (c === true) s.companion = 'puff';
    else if (c === false) s.companion = 'off';
    if (!['puff', 'sadie', 'moon', 'bunny', 'duck', 'peanut', 'star', 'unicorn', 'bee', 'random', 'off'].includes(s.companion)) s.companion = 'puff';
    const known: AccessoryId[] = ['bowtie', 'partyhat', 'flowers', 'crown', 'rainbow'];
    s.accessories = Array.isArray(s.accessories) ? s.accessories.filter((a) => known.includes(a)) : [];
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
