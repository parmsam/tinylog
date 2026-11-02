import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { cmFrom, formatHeight, formatWeight, gramsFrom, growthSeries, growthUnits, heightInRange, toLbOz, weightInRange } from './growth';

describe('growth units', () => {
  it('formats weights in kg or lb + oz', () => {
    expect(formatWeight(7200, 'metric')).toBe('7.2 kg');
    expect(formatWeight(3452, 'metric')).toBe('3.452 kg');
    expect(formatWeight(gramsFrom({ lb: 15, oz: 14 })!, 'imperial')).toBe('15 lb 14 oz');
    expect(formatWeight(gramsFrom({ lb: 8 })!, 'imperial')).toBe('8 lb');
    expect(formatWeight(gramsFrom({ oz: 12.5 })!, 'imperial')).toBe('12.5 oz');
    expect(formatWeight(7200, 'imperial')).toBe('15 lb 14 oz');
  });

  it('formats heights in cm or inches', () => {
    expect(formatHeight(62, 'metric')).toBe('62 cm');
    expect(formatHeight(61.55, 'metric')).toBe('61.6 cm');
    expect(formatHeight(cmFrom({ inches: 24.25 })!, 'imperial')).toBe('24.25 in');
    expect(formatHeight(62, 'imperial')).toBe('24.41 in');
  });

  it('round-trips whatever unit was typed', () => {
    // Every tenth of an ounce and hundredth of an inch comes back exactly.
    for (let tenths = 0; tenths < 160; tenths++) {
      const oz = tenths / 10;
      expect(toLbOz(gramsFrom({ lb: 9, oz })!)).toEqual({ lb: 9, oz });
    }
    for (let h = 2000; h < 2600; h += 7) {
      const inches = h / 100;
      expect(formatHeight(cmFrom({ inches })!, 'imperial')).toBe(`${inches} in`);
    }
    expect(gramsFrom({ kg: 3.452 })).toBe(3452);
    expect(gramsFrom({ g: 6400 })).toBe(6400);
  });

  it('carries 16 oz into a pound', () => {
    expect(toLbOz(gramsFrom({ lb: 7, oz: 15.99 })!)).toEqual({ lb: 8, oz: 0 });
  });

  it('ignores empty or bad input', () => {
    expect(gramsFrom({})).toBeUndefined();
    expect(gramsFrom({ kg: NaN })).toBeUndefined();
    expect(gramsFrom({ kg: -1 })).toBeUndefined();
    expect(cmFrom({ cm: 0 })).toBeUndefined();
  });

  it('flags implausible values (likely typos)', () => {
    expect(weightInRange(gramsFrom({ kg: 72 })!)).toBe(false);
    expect(weightInRange(gramsFrom({ kg: 7.2 })!)).toBe(true);
    expect(heightInRange(6.2)).toBe(false);
    expect(heightInRange(62)).toBe(true);
  });

  it('falls back to the volume unit when there is no growth setting', () => {
    expect(growthUnits({ units: 'oz' })).toBe('imperial');
    expect(growthUnits({ units: 'ml' })).toBe('metric');
    expect(growthUnits({ units: 'oz', growthUnits: 'metric' })).toBe('metric');
  });
});

describe('growthSeries', () => {
  it('lists measurements oldest first, skipping deleted, empty and future ones', () => {
    const a = createEvent('weight', 3000, { grams: 6000 }, 0);
    const b = createEvent('weight', 1000, { grams: 5000 }, 0);
    const gone = patchEvent(createEvent('weight', 2000, { grams: 5500 }, 0), { deleted: true }, 0);
    const empty = createEvent('weight', 2500, {}, 0);
    const later = createEvent('weight', 9000, { grams: 7000 }, 0);
    const h = createEvent('height', 1500, { cm: 60 }, 0);
    const all = [a, b, gone, empty, later, h];
    expect(growthSeries(all, 'weight', 5000).map((p) => p.value)).toEqual([5000, 6000]);
    expect(growthSeries(all, 'height').map((p) => p.value)).toEqual([60]);
  });
});
