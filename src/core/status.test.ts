import { describe, expect, it } from 'vitest';
import { cardById } from './cards';
import { createEvent, patchEvent } from './events';
import { cardStatus, summary } from './status';

const at = (h: number, m = 0, d = 30) => new Date(2026, 8, d, h, m).getTime();
const prefs = { units: 'ml', clock: '24h', dayStartHour: 0 } as const;
const now = at(10, 10);
const status = (id: Parameters<typeof cardById>[0], events: ReturnType<typeof createEvent>[], day = '2026-09-30') =>
  cardStatus(cardById(id), events, day, now, prefs);

describe('summary', () => {
  it('describes feeds, diapers and pumps', () => {
    expect(summary(createEvent('feed', 0, { method: 'breast', side: 'L' }, 0), prefs)).toBe('Breast · L');
    expect(summary(createEvent('feed', 0, { method: 'bottle', amount: 90, milk: 'formula' }, 0), prefs)).toBe('Bottle · 90 ml · formula');
    expect(summary(createEvent('diaper', 0, { diaper: 'both' }, 0), prefs)).toBe('Wet + dirty');
    expect(summary(createEvent('sleep', 0, { sleep: 'nap', where: 'bassinet' }, 0), prefs)).toBe('Bassinet');
    expect(summary(createEvent('sleep', 0, { sleep: 'night', where: 'contact' }, 0), prefs)).toBe('Held');
    expect(summary(createEvent('sleep', 0, { sleep: 'nap' }, 0), prefs)).toBe('');
    expect(summary(createEvent('pump', 0, { side: 'both', amount: 120 }, 0), { units: 'oz' })).toBe('both sides · 4.1 oz');
  });

  it('shows weights and heights in the chosen growth units', () => {
    const w = createEvent('weight', 0, { grams: 7200 }, 0);
    const h = createEvent('height', 0, { cm: 62 }, 0);
    expect(summary(w, prefs)).toBe('7.2 kg');
    expect(summary(w, { units: 'ml', growthUnits: 'imperial' })).toBe('15 lb 14 oz');
    expect(summary(h, { units: 'oz' })).toBe('24.41 in');
    expect(summary(h, { units: 'oz', growthUnits: 'metric' })).toBe('62 cm');
  });
});

describe('medicine', () => {
  it('summarises the name and dose', () => {
    expect(summary(createEvent('med', 0, { med: 'Vitamin D', dose: 1, doseUnit: 'drops' }, 0), prefs)).toBe('Vitamin D · 1 drop');
  });

  it('shows when the last one was given, never when the next is due', () => {
    expect(status('med', [])).toMatchObject({ primary: 'Add a medicine' });
    const events = [createEvent('med', at(7), { med: 'Vitamin D' }, 0), createEvent('med', at(9, 10), { med: 'Paracetamol', dose: 2.5, doseUnit: 'ml' }, 0)];
    expect(status('med', events)).toMatchObject({ primary: '1h ago', secondary: 'Paracetamol · 09:10 · 2 today' });
    expect(status('med', events.slice(0, 1), '2026-09-29')).toMatchObject({ primary: '—' });
    expect(status('med', events, '2026-09-30').primary).not.toMatch(/next|due/i);
  });

  it('lists a past day’s doses and medicines', () => {
    const later = (id: Parameters<typeof cardById>[0], events: ReturnType<typeof createEvent>[], day: string) => cardStatus(cardById(id), events, day, at(10, 0, 31) + 86_400_000, prefs);
    const events = [createEvent('med', at(7), { med: 'Vitamin D' }, 0), createEvent('med', at(9), { med: 'vitamin d' }, 0), createEvent('med', at(12), { med: 'Paracetamol' }, 0)];
    expect(later('med', events, '2026-09-30')).toMatchObject({ primary: '3 doses', secondary: 'vitamin d, Paracetamol' });
  });
});

describe('temperature', () => {
  it('shows the latest reading in the chosen unit, with no label', () => {
    expect(status('temp', [])).toMatchObject({ primary: 'Add a reading' });
    const events = [createEvent('temp', at(7), { tempC: 37.2 }, 0), createEvent('temp', at(9, 10), { tempC: 38, tempSite: 'ear' }, 0)];
    expect(status('temp', events)).toMatchObject({ primary: '38.0 °C · ear', secondary: '1h ago · 09:10 · 2 today' });
    expect(cardStatus(cardById('temp'), events, '2026-09-30', now, { ...prefs, tempUnit: 'F' }).primary).toBe('100.4 °F · ear');
    expect(JSON.stringify(status('temp', events))).not.toMatch(/fever|high|normal/i);
    const later = cardStatus(cardById('temp'), events, '2026-09-30', at(10, 0, 31) + 86_400_000, prefs);
    expect(later).toMatchObject({ primary: '38.0 °C · ear', secondary: '2 readings' });
  });
});

describe('vaccines', () => {
  it('summarises the names, or just "Vaccines"', () => {
    expect(summary(createEvent('vaccine', 0, { vaccines: ['DTaP', 'Hib'] }, 0), prefs)).toBe('DTaP, Hib');
    expect(summary(createEvent('vaccine', 0, {}, 0), prefs)).toBe('Vaccines');
  });

  it('shows the last ones given, never what is due', () => {
    expect(status('vaccine', [])).toMatchObject({ primary: 'Add vaccines' });
    const s = status('vaccine', [createEvent('vaccine', at(9, 0, 2), { vaccines: ['Hep B'] }, 0)]);
    expect(s).toMatchObject({ primary: expect.stringMatching(/^last /), secondary: 'Hep B' });
    expect(`${s.primary} ${s.secondary}`).not.toMatch(/next|due/i);
  });

  it('lists a past day’s vaccines', () => {
    const later = cardStatus(cardById('vaccine'), [createEvent('vaccine', at(9), { vaccines: ['DTaP', 'Hib'] }, 0), createEvent('vaccine', at(9, 30), { vaccines: ['hib', 'PCV'] }, 0)], '2026-09-30', at(10, 0, 31) + 86_400_000, prefs);
    expect(later).toMatchObject({ primary: '3 vaccines', secondary: 'DTaP, Hib, PCV' });
  });
});

describe('cardStatus today', () => {
  it('shows how long ago the last feed was and which side is next', () => {
    const s = status('feed', [createEvent('feed', at(8, 32), { method: 'breast', side: 'L' }, 0)]);
    expect(s.primary).toBe('1h 38m ago');
    expect(s.secondary).toBe('08:32 · Breast · L · next R');
  });

  it('counts today’s diapers', () => {
    const s = status('wet', [createEvent('diaper', at(9), { diaper: 'wet' }, 0), createEvent('diaper', at(7), { diaper: 'both' }, 0)]);
    expect(s.primary).toBe('1h 10m ago');
    expect(s.secondary).toBe('09:00 · 2 today');
  });

  it('shows a running nap', () => {
    const s = status('nap', [createEvent('sleep', at(9, 40), { sleep: 'nap' }, 0)]);
    expect(s).toMatchObject({ primary: 'asleep 30m', ongoing: true });
  });

  it('shows awake time after the last sleep, and last night’s length', () => {
    const night = patchEvent(createEvent('sleep', at(20, 0, 29), { sleep: 'night' }, 0), { endAt: at(6) }, 0);
    expect(status('nap', [night]).primary).toBe('awake 4h 10m');
    expect(status('night', [night])).toMatchObject({ primary: '10h', secondary: 'last night · woke 06:00' });
  });

  it('counts today’s spit-ups and books', () => {
    expect(status('spitup', [createEvent('spitup', at(9, 40), undefined, 0), createEvent('spitup', at(7), undefined, 0)])).toMatchObject({
      primary: '30m ago',
      secondary: '09:40 · 2 today',
    });
    expect(status('books', [])).toMatchObject({ primary: 'Tap to log', secondary: 'one tap per book' });
    expect(status('books', [createEvent('book', at(8, 32, 29), undefined, 0)], '2026-09-29').primary).toBe('1 book');
    expect(status('music', [])).toMatchObject({ primary: 'Tap to log', secondary: 'one tap per song' });
    expect(status('music', [createEvent('music', at(8, 32, 29), undefined, 0), createEvent('music', at(8, 40, 29), undefined, 0)], '2026-09-29').primary).toBe('2 songs');
  });

  it('shows the latest weight and height, and when they were taken', () => {
    expect(status('weight', [])).toMatchObject({ primary: 'Add a weight' });
    expect(status('height', [])).toMatchObject({ primary: 'Add a height' });
    const events = [createEvent('weight', at(9, 0, 20), { grams: 6800 }, 0), createEvent('weight', at(9, 0, 28), { grams: 7200 }, 0), createEvent('height', at(9, 0, 28), { cm: 62 }, 0)];
    expect(status('weight', events).primary).toBe('7.2 kg');
    expect(status('weight', events).secondary).toMatch(/^Sep 28 · 2d \d+h ago$/);
    expect(status('height', events).primary).toBe('62 cm');
    // On a past day: that day's measurement.
    expect(status('weight', events, '2026-09-20').primary).toBe('6.8 kg');
    expect(status('weight', events, '2026-09-21').primary).toBe('—');
  });

  it('shows an upcoming doctor visit', () => {
    const visit = createEvent('doctor', at(10, 0, 30) + 3 * 86_400_000, { note: '2-month checkup' }, 0);
    expect(status('doctor', [visit])).toMatchObject({ primary: 'in 3 days', secondary: '2-month checkup' });
  });
});

describe('cardStatus on a past day', () => {
  it('shows that day’s totals', () => {
    const events = [
      createEvent('feed', at(8, 0, 29), { method: 'bottle', amount: 90 }, 0),
      createEvent('feed', at(11, 0, 29), { method: 'breast' }, 0),
      patchEvent(createEvent('sleep', at(13, 0, 29), { sleep: 'nap' }, 0), { endAt: at(14, 30, 29) }, 0),
    ];
    expect(status('feed', events, '2026-09-29')).toMatchObject({ primary: '2 feeds', secondary: '90 ml by bottle' });
    expect(status('nap', events, '2026-09-29')).toMatchObject({ primary: '1h 30m', secondary: '1 nap' });
    expect(status('bath', events, '2026-09-29').primary).toBe('—');
  });
});

describe('breastfeeding length', () => {
  it('shows per-side minutes, or one total', () => {
    expect(summary(createEvent('feed', 0, { method: 'breast', side: 'both', minL: 12, minR: 8 }, 0), prefs)).toBe('Breast · L 12m · R 8m');
    expect(summary(createEvent('feed', 0, { method: 'breast', side: 'L', minL: 15 }, 0), prefs)).toBe('Breast · L 15m');
    expect(summary(createEvent('feed', 0, { method: 'breast', side: 'both', min: 20 }, 0), prefs)).toBe('Breast · both sides · 20m');
    expect(summary(createEvent('feed', 0, { method: 'breast', min: 10 }, 0), prefs)).toBe('Breast · 10m');
  });
});
