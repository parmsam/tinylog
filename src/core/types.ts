export type EventType = 'feed' | 'diaper' | 'sleep' | 'tummy' | 'pump' | 'fussy' | 'bath' | 'doctor' | 'note';

export type Side = 'L' | 'R' | 'both';

/** Optional detail. Nothing here is ever required to log an event. */
export interface Detail {
  method?: 'breast' | 'bottle'; // feed
  side?: Side; // breast feed, pump
  milk?: 'breast' | 'formula'; // bottle
  amount?: number; // ml (bottle, pump); displayed in the user's unit
  /** Breastfeeding length in minutes: per side, or one total (e.g. when both sides weren't timed separately). */
  minL?: number;
  minR?: number;
  min?: number;
  diaper?: 'wet' | 'dirty' | 'both';
  sleep?: 'nap' | 'night';
  note?: string;
}

export interface LogEvent {
  id: string;
  type: EventType;
  /** Start time, epoch ms. */
  at: number;
  /** End time for timed events; undefined while one is still going. */
  endAt?: number;
  detail?: Detail;
  createdAt: number;
  /** Newest wins when merging two phones' exports. */
  updatedAt: number;
  /** Soft delete, so undo and merging work. */
  deleted?: boolean;
}

export interface DayNote {
  /** Local day key, YYYY-MM-DD. */
  day: string;
  text: string;
  updatedAt: number;
}

export interface LogData {
  events: LogEvent[];
  notes: DayNote[];
}

export type Units = 'ml' | 'oz';
export type ClockFormat = 'auto' | '12h' | '24h';
export type ThemeChoice = 'auto' | 'day' | 'dusk' | 'night';
export type GridMarks = 'dots' | 'checks' | 'crosses';
export type CompanionChoice = 'puff' | 'sadie' | 'moon' | 'bunny' | 'duck' | 'peanut' | 'star' | 'unicorn' | 'bee' | 'random' | 'off';
/** Things a companion can wear, unlocked at coin milestones (see companion/rewards.ts). */
export type AccessoryId = 'bowtie' | 'partyhat' | 'flowers' | 'crown' | 'rainbow';
export type Background = 'glow' | 'none' | 'sky' | 'fireflies' | 'bubbles' | 'mobile' | 'snow';

export interface Settings {
  babyName: string;
  units: Units;
  clock: ClockFormat;
  /** Hour (0–23) a "day" starts at, for day views and daily totals. */
  dayStartHour: number;
  theme: ThemeChoice;
  lastBackupAt: number | null;
  /** New-entry count at which the backup reminder was last put off ("Not now"); 0 after a backup. */
  backupSnoozedAt: number;
  /** When the every-few-days backup reminder was last put off ("Not now"); it waits a day. 0 after a backup. */
  backupLaterAt: number;
  /** Remind to back up after this many days without one; 0 = only the every-50-entries reminder. */
  backupEveryDays: number;
  /** One-time tips already dismissed ("Show tips again" clears this). */
  tipsSeen: string[];
  /** How the day grid marks feeds and diapers. */
  gridMarks: GridMarks;
  /** Taps buzz (Android vibration, iOS switch haptics). */
  haptics: boolean;
  /** The little companion under the date, 'random' for a different one each day, or 'off'. */
  companion: CompanionChoice;
  /** What the companion is wearing (one per slot); only unlocked ones show. */
  accessories: AccessoryId[];
  /** Page background: soft glow (default), three.js night sky, or plain. */
  background: Background;
}
