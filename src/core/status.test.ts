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
    expect(summary(createEvent('pump', 0, { side: 'both', amount: 120 }, 0), { units: 'oz' })).toBe('both sides · 4.1 oz');
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
