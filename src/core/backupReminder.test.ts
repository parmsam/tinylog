import { describe, expect, it } from 'vitest';
import { BACKUP_EVERY, backupStatus } from './backupReminder';
import { createEvent, patchEvent } from './events';

const DAY = 86_400_000;
const now = 100 * DAY;
const many = (n: number, createdAt: number) => Array.from({ length: n }, (_, i) => createEvent('feed', createdAt + i, undefined, createdAt + i));

describe('backupStatus', () => {
  it('reminds at 50 new entries, even on a brand-new log', () => {
    expect(backupStatus(many(49, now - 1000), { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
    expect(backupStatus(many(50, now - 1000), { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now)).toEqual({ newSince: 50, reason: 'count', days: null });
  });

  it('only counts entries created after the last backup', () => {
    const events = [...many(80, now - 5 * DAY), ...many(10, now - DAY)];
    const s = backupStatus(events, { lastBackupAt: now - 2 * DAY, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now);
    expect(s).toEqual({ newSince: 10, reason: null, days: 2 });
  });

  it('"Not now" snoozes to the next 50, and it keeps coming back as the count grows', () => {
    const snoozed = { lastBackupAt: now - DAY, backupSnoozedAt: 53, backupLaterAt: 0, backupEveryDays: 4 };
    expect(backupStatus(many(60, now - 1000), snoozed, now).reason).toBeNull();
    expect(backupStatus(many(103, now - 1000), snoozed, now).reason).toBe('count');
    expect(backupStatus(many(103 + BACKUP_EVERY, now - 1000), { ...snoozed, backupSnoozedAt: 103, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBe('count');
  });

  it('ignores deleted entries', () => {
    const events = many(50, now - 1000);
    events[0] = patchEvent(events[0], { deleted: true }, now);
    expect(backupStatus(events, { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
  });

  it('reminds every 4 days for a slower log, when something new was logged since', () => {
    const events = many(25, now - 10 * DAY);
    expect(backupStatus(events, { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now)).toEqual({ newSince: 25, reason: 'time', days: null });
    // Nothing new since the backup: no reminder however long ago it was.
    expect(backupStatus(events, { lastBackupAt: now - 8 * DAY, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
    const more = [...events, ...many(3, now - 3.5 * DAY)];
    expect(backupStatus(more, { lastBackupAt: now - 4 * DAY, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now)).toEqual({ newSince: 3, reason: 'time', days: 4 });
    expect(backupStatus(more, { lastBackupAt: now - 3.9 * DAY, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
  });

  it('"Not now" puts the every-few-days reminder off for a day', () => {
    const events = many(25, now - 10 * DAY);
    const s = { lastBackupAt: null, backupSnoozedAt: 25 };
    expect(backupStatus(events, { ...s, backupLaterAt: now - 23 * 3600_000, backupEveryDays: 4 }, now).reason).toBeNull();
    expect(backupStatus(events, { ...s, backupLaterAt: now - DAY, backupEveryDays: 4 }, now).reason).toBe('time');
  });

  it('follows the chosen interval, and can be left to the 50-entry reminder only', () => {
    const events = [...many(25, now - 10 * DAY), ...many(3, now - DAY)];
    const s = { lastBackupAt: now - 5 * DAY, backupSnoozedAt: 0, backupLaterAt: 0 };
    expect(backupStatus(events, { ...s, backupEveryDays: 7 }, now).reason).toBeNull();
    expect(backupStatus(events, { ...s, backupEveryDays: 2 }, now).reason).toBe('time');
    expect(backupStatus(events, { ...s, backupEveryDays: 0 }, now).reason).toBeNull();
  });

  it('waits for a real log before the time reminder (20+ entries, over 3 days old)', () => {
    expect(backupStatus(many(19, now - 10 * DAY), { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
    expect(backupStatus(many(25, now - 2 * DAY), { lastBackupAt: null, backupSnoozedAt: 0, backupLaterAt: 0, backupEveryDays: 4 }, now).reason).toBeNull();
  });
});
