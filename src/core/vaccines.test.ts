import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { COMMON_VACCINES, parseVaccines, shotCount, vaccineOptions, vaccineRecord, vaccineSummary } from './vaccines';

const at = (h: number, d = 30) => new Date(2026, 8, d, h).getTime();

describe('vaccines', () => {
  it('reads a list of names, without repeats', () => {
    expect(parseVaccines(' DTaP, hib ;  PCV\n dtap ,, ')).toEqual(['DTaP', 'hib', 'PCV']);
    expect(parseVaccines(['Hep B', '  ', 'hep  b'])).toEqual(['Hep B']);
    expect(parseVaccines(null)).toEqual([]);
    expect(parseVaccines('x'.repeat(100))[0]).toHaveLength(40);
    expect(parseVaccines(Array.from({ length: 20 }, (_, i) => `V${i}`))).toHaveLength(12);
  });

  it('describes an entry and counts its shots', () => {
    expect(vaccineSummary(['DTaP', 'Hib'])).toBe('DTaP, Hib');
    expect(vaccineSummary(undefined)).toBe('Vaccines');
    expect(shotCount(createEvent('vaccine', 0, { vaccines: ['DTaP', 'Hib'] }, 0))).toBe(2);
    expect(shotCount(createEvent('vaccine', 0, {}, 0))).toBe(1);
  });

  it('offers the common names, then any others given before', () => {
    const events = [createEvent('vaccine', 0, { vaccines: ['6-in-1', 'dtap'] }, 0), patchEvent(createEvent('vaccine', 0, { vaccines: ['Gone'] }, 0), { deleted: true }, 1)];
    const opts = vaccineOptions(events, ['MenB']);
    expect(opts.slice(0, COMMON_VACCINES.length)).toEqual([...COMMON_VACCINES]);
    expect(opts.slice(COMMON_VACCINES.length)).toEqual(['6-in-1', 'MenB']);
  });

  it('keeps a record, one row per day, newest first', () => {
    const events = [
      createEvent('vaccine', at(9), { vaccines: ['DTaP', 'Hib'], note: 'left thigh' }, 0),
      createEvent('vaccine', at(10), { vaccines: ['hib', 'PCV'] }, 0),
      createEvent('vaccine', at(9, 1), {}, 0),
      createEvent('vaccine', at(9, 31), { vaccines: ['Future'] }, 0),
      createEvent('med', at(9), { med: 'Vitamin D' }, 0),
    ];
    expect(vaccineRecord(events, at(12), 0)).toEqual([
      { at: at(10), vaccines: ['DTaP', 'Hib', 'PCV'], notes: ['left thigh'] },
      { at: at(9, 1), vaccines: [], notes: [] },
    ]);
  });
});
