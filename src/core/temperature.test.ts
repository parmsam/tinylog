import { describe, expect, it } from 'vitest';
import { formatTemp, parseTempSite, tempFrom, tempIn, tempInRange, tempSummary, tempUnit } from './temperature';

describe('temperature', () => {
  it('reads °C or °F, stored in °C', () => {
    expect(tempFrom({ c: 37.8 })).toBe(37.8);
    expect(tempFrom({ f: 100.4 })).toBe(38);
    expect(tempFrom({ f: 98.6 })).toBe(37);
    expect(tempFrom({ c: 37.2, f: 200 })).toBe(37.2);
    expect(tempFrom({})).toBeUndefined();
    expect(tempFrom({ c: Number.NaN })).toBeUndefined();
  });

  it('gives back a °F reading as typed', () => {
    for (const f of [97.1, 98.7, 99.5, 100.1, 101.3, 103.9]) expect(tempIn(tempFrom({ f })!, 'F')).toBe(f);
  });

  it('flags typos and the wrong unit', () => {
    expect(tempInRange(37)).toBe(true);
    expect(tempInRange(3.7)).toBe(false);
    expect(tempInRange(tempFrom({ c: 99 }))).toBe(false); // °F typed as °C
    expect(tempInRange(undefined)).toBe(false);
  });

  it('describes a reading, without labelling it', () => {
    expect(formatTemp(38, 'C')).toBe('38.0 °C');
    expect(formatTemp(38, 'F')).toBe('100.4 °F');
    expect(tempSummary({ tempC: 37.8, tempSite: 'ear' }, 'C')).toBe('37.8 °C · ear');
    expect(tempSummary({ tempC: 39.5 }, 'C')).not.toMatch(/fever|high/i);
    expect(parseTempSite('Underarm')).toBe('armpit');
    expect(parseTempSite('toe')).toBeUndefined();
  });

  it('picks the unit from the setting, or from the weight units', () => {
    expect(tempUnit({ tempUnit: 'F' })).toBe('F');
    expect(tempUnit({ growthUnits: 'imperial' })).toBe('F');
    expect(tempUnit({ units: 'ml' })).toBe('C');
  });
});
