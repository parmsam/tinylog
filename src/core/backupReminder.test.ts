import { describe, expect, it } from 'vitest';
import { BACKUP_EVERY, backupStatus } from './backupReminder';
import { createEvent, patchEvent } from './events';

const DAY = 86_400_000;
const now = 100 * DAY;
const many = (n: number, createdAt: number) => Array.from({ length: n }, (_, i) => createEvent('feed', createdAt + i, undefined, createdAt + i));

describe('backupStatus', () => {
  it('reminds at 50 new entries, even on a brand-new log', () => {
    expect(backupStatus(many(49, now - 1000), { lastBackupAt: null, backupSnoozedAt: 0 }, now).reason).toBeNull();
    expect(backupStatus(many(50, now - 1000), { lastBackupAt: null, backupSnoozedAt: 0 }, now)).toEqual({ newSince: 50, reason: 'count' });
  });

  it('only counts entries created after the last backup', () => {
    const events = [...many(80, now - 5 * DAY), ...many(10, now - DAY)];
    const s = backupStatus(events, { lastBackupAt: now - 2 * DAY, backupSnoozedAt: 0 }, now);
    expect(s).toEqual({ newSince: 10, reason: null });
  });

  it('"Not now" snoozes to the next 50, and it keeps coming back as the count grows', () => {
    const snoozed = { lastBackupAt: now - DAY, backupSnoozedAt: 53 };
    expect(backupStatus(many(60, now - 1000), snoozed, now).reason).toBeNull();
    expect(backupStatus(many(103, now - 1000), snoozed, now).reason).toBe('count');
    expect(backupStatus(many(103 + BACKUP_EVERY, now - 1000), { ...snoozed, backupSnoozedAt: 103 }, now).reason).toBe('count');
  });

  it('ignores deleted entries', () => {
    const events = many(50, now - 1000);
    events[0] = patchEvent(events[0], { deleted: true }, now);
    expect(backupStatus(events, { lastBackupAt: null, backupSnoozedAt: 0 }, now).reason).toBeNull();
  });

  it('keeps the weekly reminder for a slower log', () => {
    const events = many(25, now - 10 * DAY);
    expect(backupStatus(events, { lastBackupAt: null, backupSnoozedAt: 0 }, now).reason).toBe('time');
    expect(backupStatus(events, { lastBackupAt: now - 8 * DAY, backupSnoozedAt: 0 }, now).reason).toBeNull();
    const more = [...events, ...many(3, now - 7.5 * DAY)];
    expect(backupStatus(more, { lastBackupAt: now - 8 * DAY, backupSnoozedAt: 0 }, now).reason).toBe('time');
    expect(backupStatus(more, { lastBackupAt: now - 2 * DAY, backupSnoozedAt: 0 }, now).reason).toBeNull();
  });
});
