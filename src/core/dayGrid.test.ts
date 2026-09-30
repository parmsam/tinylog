import { describe, expect, it } from 'vitest';
import { dayGrid } from './dayGrid';
import { createEvent, patchEvent } from './events';

const at = (h: number, m = 0, d = 30) => new Date(2026, 8, d, h, m).getTime();
const ended = (e: ReturnType<typeof createEvent>, end: number) => patchEvent(e, { endAt: end }, e.at);

describe('dayGrid', () => {
  it('has a row per clock hour, 25 when clocks fall back', () => {
    expect(dayGrid([], '2026-09-30', 0, at(12))).toHaveLength(24);
    expect(dayGrid([], '2026-11-01', 0, at(12))).toHaveLength(25);
  });

  it('places instant events at their minute, and a "both" diaper in wet and dirty', () => {
    const rows = dayGrid(
      [createEvent('feed', at(3, 45), undefined, 0), createEvent('diaper', at(3, 15), { diaper: 'both' }, 0)],
      '2026-09-30',
      0,
      at(12),
    );
    expect(rows[3].cells.feed.marks[0].at).toBe(0.75);
    expect(rows[3].cells.wet.marks[0].at).toBe(0.25);
    expect(rows[3].cells.dirty.marks).toHaveLength(1);
  });

  it('splits sleep across the hours it covers, clipped to the day', () => {
    const night = ended(createEvent('sleep', at(21, 0, 29), { sleep: 'night' }, 0), at(2, 30));
    const rows = dayGrid([night], '2026-09-30', 0, at(12));
    expect(rows[0].cells.sleep.segments[0]).toMatchObject({ from: 0, to: 1 });
    expect(rows[1].cells.sleep.segments[0]).toMatchObject({ from: 0, to: 1 });
    expect(rows[2].cells.sleep.segments[0]).toMatchObject({ from: 0, to: 0.5 });
    expect(rows[3].cells.sleep.segments).toHaveLength(0);
  });

  it('runs an ongoing nap up to now and marks the current hour', () => {
    const rows = dayGrid([createEvent('sleep', at(10, 30), { sleep: 'nap' }, 0)], '2026-09-30', 0, at(11, 15));
    expect(rows[10].cells.sleep.segments[0]).toMatchObject({ from: 0.5, to: 1 });
    expect(rows[11].cells.sleep.segments[0]).toMatchObject({ from: 0, to: 0.25 });
    expect(rows[11].now).toBe(0.25);
    expect(rows[12].future).toBe(true);
  });
});
