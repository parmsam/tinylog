import { describe, expect, it } from 'vitest';
import { ago, amount, duration, fromLocalInput, fromMl, stopwatch, toLocalInput, toMl, until } from './format';

const M = 60_000;
const H = 60 * M;

describe('format', () => {
  it('formats durations compactly', () => {
    expect(duration(30_000)).toBe('<1m');
    expect(duration(42 * M)).toBe('42m');
    expect(duration(98 * M)).toBe('1h 38m');
    expect(duration(2 * H)).toBe('2h');
    expect(duration(51 * H)).toBe('2d 3h');
  });

  it('formats running timers', () => {
    expect(stopwatch(247_000)).toBe('4:07');
    expect(stopwatch(H + 2 * M + 33_000)).toBe('1:02:33');
  });

  it('says ago and until', () => {
    expect(ago(0, 10_000)).toBe('just now');
    expect(ago(0, 42 * M)).toBe('42m ago');
    expect(until(3 * 24 * H, 0)).toBe('in 3 days');
    expect(until(30 * M, 0)).toBe('in 30m');
  });

  it('converts units', () => {
    expect(amount(120, 'ml')).toBe('120 ml');
    expect(amount(120, 'oz')).toBe('4.1 oz');
    expect(toMl(4, 'oz')).toBe(118);
    expect(fromMl(118, 'oz')).toBe(4);
    expect(fromMl(118, 'ml')).toBe(118);
  });

  it('round-trips datetime-local values in local time', () => {
    const ts = new Date(2026, 8, 30, 3, 15).getTime();
    expect(toLocalInput(ts)).toBe('2026-09-30T03:15');
    expect(fromLocalInput('2026-09-30T03:15')).toBe(ts);
    expect(fromLocalInput('')).toBeUndefined();
  });
});
