import { CARDS } from './cards';
import type { AccessoryId, Settings } from './types';

export const SETTINGS_KEY = 'tinylog:v1:settings';

/** Backup reminder intervals offered in Settings (0 = only every 50 entries). */
export const BACKUP_DAY_CHOICES = [2, 4, 7, 14, 0];

const OFF_BY_DEFAULT: string[] = CARDS.filter((c) => c.offByDefault).map((c) => c.id);

export const DEFAULT_SETTINGS: Settings = {
  babyName: '',
  units: 'ml',
  growthUnits: 'metric',
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
  hiddenCards: [...OFF_BY_DEFAULT],
  cardsOffered: [...OFF_BY_DEFAULT],
  splash: true,
  confirmDeletes: true,
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
    // Settings saved before weight/height existed: match the volume unit (oz → lb and inches).
    if (saved.growthUnits !== 'metric' && saved.growthUnits !== 'imperial') s.growthUnits = s.units === 'oz' ? 'imperial' : 'metric';
    if (!['dots', 'checks', 'crosses'].includes(s.gridMarks)) s.gridMarks = 'dots';
    if (!Number.isInteger(s.backupSnoozedAt) || s.backupSnoozedAt < 0) s.backupSnoozedAt = 0;
    if (!Number.isFinite(s.backupLaterAt) || s.backupLaterAt < 0) s.backupLaterAt = 0;
    if (!BACKUP_DAY_CHOICES.includes(s.backupEveryDays)) s.backupEveryDays = DEFAULT_SETTINGS.backupEveryDays;
    if (!['glow', 'none', 'sky', 'fireflies', 'bubbles', 'mobile', 'snow'].includes(s.background)) s.background = 'glow';
    s.haptics = s.haptics !== false;
    s.splash = s.splash !== false;
    s.confirmDeletes = s.confirmDeletes !== false;
    // v0.1 stored a boolean.
    const c = s.companion as unknown;
    if (c === true) s.companion = 'puff';
    else if (c === false) s.companion = 'off';
    if (!['puff', 'sadie', 'moon', 'bunny', 'duck', 'peanut', 'star', 'unicorn', 'bee', 'random', 'off'].includes(s.companion)) s.companion = 'puff';
    const known: AccessoryId[] = ['bowtie', 'partyhat', 'flowers', 'crown', 'rainbow'];
    s.accessories = Array.isArray(s.accessories) ? s.accessories.filter((a) => known.includes(a)) : [];
    // Unknown ids are dropped, and at least one button always stays.
    const ids = CARDS.map((c) => c.id as string);
    s.hiddenCards = Array.isArray(s.hiddenCards) ? [...new Set(s.hiddenCards.filter((id) => ids.includes(id)))] : [];
    // From the saved copy only: settings saved before a card existed haven't offered it yet.
    s.cardsOffered = Array.isArray(saved.cardsOffered) ? saved.cardsOffered.filter((id) => ids.includes(id)) : [];
    offerNewCards(s);
    if (s.hiddenCards.length >= ids.length) s.hiddenCards = [];
    if (!Number.isInteger(s.dayStartHour) || s.dayStartHour < 0 || s.dayStartHour > 12) s.dayStartHour = 0;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Off-by-default cards start hidden the first time this phone sees them, so a new one doesn't just appear after an update. */
function offerNewCards(s: Settings): Settings {
  const fresh = OFF_BY_DEFAULT.filter((id) => !s.cardsOffered.includes(id));
  if (fresh.length) {
    s.hiddenCards = [...new Set([...s.hiddenCards, ...fresh])];
    s.cardsOffered = [...s.cardsOffered, ...fresh];
  }
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled or full: settings just won't persist */
  }
}
