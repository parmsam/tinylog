import type { LogEvent, Settings } from './types';

const DAY = 86_400_000;

/** Remind again every this many new entries since the last backup. */
export const BACKUP_EVERY = 50;

export interface BackupStatus {
  /** Entries created since the last backup (all of them if there's never been one). */
  newSince: number;
  /** Why a reminder is due now, if it is. */
  reason: 'count' | 'time' | null;
  /** Whole days since the last backup (null if there's never been one). */
  days: number | null;
}

/**
 * Two triggers, whichever comes first:
 * - count: every 50 new entries since the last backup (50, 100, 150…). "Not now" snoozes to the next 50.
 * - time: `backupEveryDays` (4 by default, 0 = off) since the last backup, with something new since,
 *   once there are 20+ entries and the log is over 3 days old. "Not now" puts it off for a day.
 */
export function backupStatus(
  events: LogEvent[],
  s: Pick<Settings, 'lastBackupAt' | 'backupSnoozedAt' | 'backupLaterAt' | 'backupEveryDays'>,
  now: number,
): BackupStatus {
  const live = events.filter((e) => !e.deleted);
  const since = s.lastBackupAt ?? 0;
  const newSince = live.filter((e) => e.createdAt > since).length;
  const days = s.lastBackupAt ? Math.floor((now - s.lastBackupAt) / DAY) : null;
  if (newSince >= BACKUP_EVERY && newSince >= s.backupSnoozedAt + BACKUP_EVERY) return { newSince, reason: 'count', days };

  const oldest = live.reduce((m, e) => Math.min(m, e.createdAt), now);
  const stale = !s.lastBackupAt || now - s.lastBackupAt >= s.backupEveryDays * DAY;
  const putOff = now - s.backupLaterAt < DAY;
  if (s.backupEveryDays > 0 && live.length >= 20 && now - oldest > 3 * DAY && stale && !putOff && newSince > 0) return { newSince, reason: 'time', days };
  return { newSince, reason: null, days };
}
