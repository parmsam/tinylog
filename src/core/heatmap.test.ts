import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { hourHeatmap } from './heatmap';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const ended = (e: ReturnType<typeof createEvent>, end: number) => patchEvent(e, { endAt: end }, e.at);
// "Now" is the end of Sep 30, so the whole range has happened.
const now = at(30, 23, 59);

describe('hourHeatmap', () => {
  it('averages counts per day for each clock hour', () => {
    const events = [
      createEvent('feed', at(29, 3, 10), undefined, 0),
      createEvent('feed', at(30, 3, 40), undefined, 0),
      createEvent('feed', at(30, 9), undefined, 0),
      createEvent('diaper', at(30, 9, 5), { diaper: 'both' }, 0),
    ];
    const hm = hourHeatmap(events, '2026-09-30', 7, 0, now);
    // Logging began Sep 29, so only 2 days count.
    expect(hm.days).toBe(2);
    expect(hm.fromDay).toBe('2026-09-29');
    expect(hm.cells.feed[3]).toMatchObject({ value: 1, days: 2, level: 5 });
    expect(hm.cells.feed[9].value).toBe(0.5);
    expect(hm.cells.feed[9].level).toBe(3);
    expect(hm.cells.wet[9].value).toBe(0.5);
    expect(hm.cells.dirty[9].value).toBe(0.5);
    expect(hm.cells.feed[12].level).toBe(0);
  });

  it('spreads sleep across the hours it covers, as minutes of the hour', () => {
    const events = [ended(createEvent('sleep', at(30, 1, 30), { sleep: 'night' }, 0), at(30, 3))];
    const hm = hourHeatmap(events, '2026-09-30', 1, 0, now);
    expect(hm.cells.sleep[1].value).toBe(30);
    expect(hm.cells.sleep[2].value).toBe(60);
    expect(hm.cells.sleep[2].level).toBe(5);
    expect(hm.cells.sleep[1].level).toBe(3);
    expect(hm.cells.sleep[3].value).toBe(0);
  });

  it('does not count today’s hours that have not happened yet', () => {
    const events = [createEvent('feed', at(29, 20), undefined, 0), createEvent('feed', at(30, 8), undefined, 0)];
    const hm = hourHeatmap(events, '2026-09-30', 2, 0, at(30, 10));
    expect(hm.cells.feed[20]).toMatchObject({ value: 1, days: 1 });
    expect(hm.cells.feed[8]).toMatchObject({ value: 0.5, days: 2 });
  });

  it('orders rows from the day-start hour', () => {
    const hm = hourHeatmap([], '2026-09-30', 7, 7, now);
    expect(hm.hours[0]).toBe(7);
    expect(hm.hours[23]).toBe(6);
  });
});
