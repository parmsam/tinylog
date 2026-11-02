import { describe, expect, it } from 'vitest';
import { dayRange } from '../core/days';
import { arcPath, frac, hourLabel, hourMarks, niceTicks, polar } from './geom';

describe('geom', () => {
  it('maps a day onto 0–1', () => {
    const [s, e] = dayRange('2026-09-30');
    expect(frac(s, s, e)).toBe(0);
    expect(frac(s + (e - s) / 4, s, e)).toBe(0.25);
    expect(frac(e + 1, s, e)).toBe(1);
  });

  it('puts the day start at the top and goes clockwise', () => {
    const [x0, y0] = polar(100, 100, 50, 0);
    expect([Math.round(x0), Math.round(y0)]).toEqual([100, 50]);
    const [x1, y1] = polar(100, 100, 50, 0.25);
    expect([Math.round(x1), Math.round(y1)]).toEqual([150, 100]);
  });

  it('uses the large-arc flag past half a turn and draws a full turn as two halves', () => {
    expect(arcPath(0, 0, 10, 0, 0.25)).toContain(' 0 0 1 ');
    expect(arcPath(0, 0, 10, 0, 0.75)).toContain(' 0 1 1 ');
    // A full day of sleep must still draw: two half arcs, not one zero-length arc.
    expect(arcPath(0, 0, 10, 0, 1)).toBe('M0 -10A10 10 0 1 1 0 10A10 10 0 1 1 0 -10');
  });

  it('has 23 or 25 hour marks on DST days', () => {
    expect(hourMarks(...dayRange('2026-09-30'))).toHaveLength(24);
    expect(hourMarks(...dayRange('2027-03-14'))).toHaveLength(23);
    expect(hourMarks(...dayRange('2026-11-01'))).toHaveLength(25);
    expect(hourMarks(...dayRange('2026-09-30', 7))[0].hour).toBe(7);
  });

  it('labels hours', () => {
    expect(hourLabel(0, '12h')).toBe('12a');
    expect(hourLabel(15, '12h')).toBe('3p');
    expect(hourLabel(6, '24h')).toBe('06');
  });

  it('picks round axis ticks covering the range', () => {
    expect(niceTicks(3.4, 7.9)).toEqual([2, 4, 6, 8]);
    expect(niceTicks(50.5, 62)).toEqual([50, 55, 60, 65]);
    expect(niceTicks(6.41, 6.62)).toEqual([6.4, 6.5, 6.6, 6.7]);
    // A single value gets a window around it, and ticks never come out as float noise.
    const one = niceTicks(7.2, 7.2);
    expect(one[0]).toBeLessThan(7.2);
    expect(one[one.length - 1]).toBeGreaterThan(7.2);
    expect(one.every((v) => String(v).length <= 4)).toBe(true);
    expect(niceTicks(NaN, 3)).toEqual([]);
  });
});
