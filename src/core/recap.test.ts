import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { recap } from './recap';

const H = 3_600_000;
const at = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
const sleep = (d: number, h: number, hours: number) =>
  patchEvent(createEvent('sleep', at(d, h), { sleep: 'night' }, 0), { endAt: at(d, h) + hours * H }, 0);

describe('recap', () => {
  it('finds the longest stretch and whether it beats the rest of the week', () => {
    const events = [sleep(25, 1, 3), sleep(26, 1, 4), sleep(27, 1, 3.5), sleep(28, 1, 5), sleep(28, 13, 1)];
    const r = recap(events, { '2026-09-28': { day: '2026-09-28', text: ' First giggle ', updatedAt: 1 } }, '2026-09-28', 0, at(30, 9));
    expect(r.longest?.ms).toBe(5 * H);
    expect(r.longestOfWeek).toBe(true);
    expect(r.note).toBe('First giggle');
    expect(r.inProgress).toBe(false);
    expect(r.totals.sleepMs).toBe(6 * H);
  });

  it('does not call a record without enough days to compare', () => {
    const r = recap([sleep(28, 1, 5)], {}, '2026-09-28', 0, at(30, 9));
    expect(r.longestOfWeek).toBe(false);
  });

  it('marks today as in progress and skips ongoing sleeps for the longest stretch', () => {
    const ongoing = createEvent('sleep', at(30, 7), { sleep: 'nap' }, 0);
    const r = recap([ongoing], {}, '2026-09-30', 0, at(30, 9));
    expect(r.inProgress).toBe(true);
    expect(r.longest).toBeNull();
    expect(r.events).toHaveLength(1);
  });
});
