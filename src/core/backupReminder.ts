import type { LogEvent, Settings } from './types';

const DAY = 86_400_000;

/** Remind again every this many new entries since the last backup. */
export const BACKUP_EVERY = 50;

export interface BackupStatus {
  /** Entries created since the last backup (all of them if there's never been one). */
  newSince: number;
  /** Why a reminder is due now, if it is. */
  reason: 'count' | 'time' | null;
}

/**
 * Two triggers, whichever comes first:
 * - count: every 50 new entries since the last backup (50, 100, 150…). "Not now" snoozes to the next 50.
 * - time: 7 days since the last backup, once there are 20+ entries and the log is over 3 days old.
 */
export function backupStatus(
  events: LogEvent[],
  s: Pick<Settings, 'lastBackupAt' | 'backupSnoozedAt'>,
  now: number,
): BackupStatus {
  const live = events.filter((e) => !e.deleted);
  const since = s.lastBackupAt ?? 0;
  const newSince = live.filter((e) => e.createdAt > since).length;
  if (newSince >= BACKUP_EVERY && newSince >= s.backupSnoozedAt + BACKUP_EVERY) return { newSince, reason: 'count' };

  const oldest = live.reduce((m, e) => Math.min(m, e.createdAt), now);
  const stale = !s.lastBackupAt || now - s.lastBackupAt > 7 * DAY;
  if (live.length >= 20 && now - oldest > 3 * DAY && stale && newSince > 0) return { newSince, reason: 'time' };
  return { newSince, reason: null };
}
