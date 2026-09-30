export type EventType = 'feed' | 'diaper' | 'sleep' | 'tummy' | 'pump' | 'bath' | 'doctor' | 'note';

export type Side = 'L' | 'R' | 'both';

/** Optional detail. Nothing here is ever required to log an event. */
export interface Detail {
  method?: 'breast' | 'bottle'; // feed
  side?: Side; // breast feed, pump
  milk?: 'breast' | 'formula'; // bottle
  amount?: number; // ml (bottle, pump); displayed in the user's unit
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
  /** One-time tips already dismissed ("Show tips again" clears this). */
  tipsSeen: string[];
  /** How the day grid marks feeds and diapers. */
  gridMarks: GridMarks;
}
