import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayRange, eventsForDay, overlap } from './days';
import type { LogEvent } from './types';

const t = (s: string) => new Date(s).getTime();
const ev = (type: LogEvent['type'], at: number, endAt?: number, extra: Partial<LogEvent> = {}): LogEvent => ({
  id: Math.random().toString(36),
  type,
  at,
  endAt,
  createdAt: at,
  updatedAt: at,
  ...extra,
});

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(t('2026-09-30T00:05'))).toBe('2026-09-30');
    expect(dayKey(t('2026-09-30T23:59'))).toBe('2026-09-30');
  });

  it('counts early hours as the previous day when the day starts later', () => {
    expect(dayKey(t('2026-09-30T05:59'), 6)).toBe('2026-09-29');
    expect(dayKey(t('2026-09-30T06:00'), 6)).toBe('2026-09-30');
  });

  it('handles month and year boundaries', () => {
    expect(dayKey(t('2027-01-01T03:00'), 6)).toBe('2026-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('dayRange', () => {
  it('is 24 hours on a normal day', () => {
    const [a, b] = dayRange('2026-09-30');
    expect(b - a).toBe(24 * 3_600_000);
  });

  it('is 23 hours when clocks spring forward and 25 when they fall back', () => {
    const [a1, b1] = dayRange('2027-03-14');
    expect(b1 - a1).toBe(23 * 3_600_000);
    const [a2, b2] = dayRange('2026-11-01');
    expect(b2 - a2).toBe(25 * 3_600_000);
  });

  it('starts at the day-start hour', () => {
    const [a] = dayRange('2026-09-30', 7);
    expect(new Date(a).getHours()).toBe(7);
  });
});

describe('eventsForDay', () => {
  const now = t('2026-09-30T12:00');

  it('shows a night sleep that crosses midnight on both days', () => {
    const sleep = ev('sleep', t('2026-09-29T20:00'), t('2026-09-30T06:00'));
    expect(eventsForDay([sleep], '2026-09-29', 0, now)).toHaveLength(1);
    expect(eventsForDay([sleep], '2026-09-30', 0, now)).toHaveLength(1);
    expect(eventsForDay([sleep], '2026-10-01', 0, now)).toHaveLength(0);
  });

  it('keeps instant events on their own day and skips deleted ones', () => {
    const feed = ev('feed', t('2026-09-29T23:50'));
    const gone = ev('bath', t('2026-09-29T18:00'), undefined, { deleted: true });
    expect(eventsForDay([feed, gone], '2026-09-29', 0, now)).toEqual([feed]);
    expect(eventsForDay([feed, gone], '2026-09-30', 0, now)).toEqual([]);
  });

  it('treats an ongoing sleep as running until now', () => {
    const nap = ev('sleep', t('2026-09-29T23:00'));
    expect(eventsForDay([nap], '2026-09-30', 0, now)).toHaveLength(1);
    expect(overlap(nap, ...dayRange('2026-09-30'), now)).toBe(12 * 3_600_000);
  });
});
