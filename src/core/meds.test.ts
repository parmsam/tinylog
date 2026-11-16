import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { cleanMedName, formatDose, medSummary, parseDose, parseDoseUnit, recentMeds } from './meds';

describe('medicine details', () => {
  it('cleans names and doses', () => {
    expect(cleanMedName('  vitamin   D ')).toBe('vitamin D');
    expect(cleanMedName(undefined)).toBe('');
    expect(cleanMedName('x'.repeat(100))).toHaveLength(60);
    expect(parseDose('2.5')).toBe(2.5);
    expect(parseDose('0.333')).toBe(0.33);
    expect(parseDose('0')).toBeUndefined();
    expect(parseDose('abc')).toBeUndefined();
    expect(parseDose('')).toBeUndefined();
    expect(parseDoseUnit('Drop')).toBe('drops');
    expect(parseDoseUnit('tsp')).toBeUndefined();
  });

  it('describes a dose', () => {
    expect(formatDose(1, 'drops')).toBe('1 drop');
    expect(formatDose(2, 'drops')).toBe('2 drops');
    expect(formatDose(2.5, 'ml')).toBe('2.5 ml');
    expect(formatDose(3, undefined)).toBe('3');
    expect(formatDose(undefined, 'ml')).toBe('');
    expect(medSummary({ med: 'Vitamin D', dose: 1, doseUnit: 'drops' })).toBe('Vitamin D · 1 drop');
    expect(medSummary({ med: 'Gripe water' })).toBe('Gripe water');
  });

  it('lists each medicine once, most recently given first, with its last dose', () => {
    const events = [
      createEvent('med', 100, { med: 'Vitamin D', dose: 1, doseUnit: 'drops' }, 0),
      createEvent('med', 200, { med: 'Infant paracetamol', dose: 2.5, doseUnit: 'ml' }, 0),
      createEvent('med', 300, { med: 'vitamin d', dose: 2, doseUnit: 'drops' }, 0),
      patchEvent(createEvent('med', 400, { med: 'Deleted one' }, 0), { deleted: true }, 1),
      createEvent('med', 9_999, { med: 'Future' }, 0),
      createEvent('feed', 500, {}, 0),
    ];
    expect(recentMeds(events, 1000)).toEqual([
      { name: 'vitamin d', dose: 2, doseUnit: 'drops', at: 300 },
      { name: 'Infant paracetamol', dose: 2.5, doseUnit: 'ml', at: 200 },
    ]);
    expect(recentMeds(events, 1000, 1)).toHaveLength(1);
  });
});
