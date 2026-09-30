import { describe, expect, it } from 'vitest';
import { cardById, cardFor, feedDefaults, lastFor, lastWake, nextUpcoming, ongoingFor } from './cards';
import { createEvent, patchEvent } from './events';

const H = 3_600_000;

describe('cards', () => {
  it('counts a "both" diaper as wet and dirty', () => {
    const both = createEvent('diaper', 0, { diaper: 'both' }, 0);
    expect(cardById('wet').matches(both)).toBe(true);
    expect(cardById('dirty').matches(both)).toBe(true);
    expect(cardById('dirty').matches(createEvent('diaper', 0, { diaper: 'wet' }, 0))).toBe(false);
  });

  it('shows each event under one card', () => {
    expect(cardFor(createEvent('sleep', 0, { sleep: 'night' }, 0))?.id).toBe('night');
    expect(cardFor(createEvent('sleep', 0, undefined, 0))?.id).toBe('nap');
    expect(cardFor(createEvent('diaper', 0, { diaper: 'dirty' }, 0))?.id).toBe('dirty');
  });

  it('finds the last event, ignoring deleted and future ones', () => {
    const a = createEvent('bath', 1 * H, undefined, 0);
    const b = patchEvent(createEvent('bath', 2 * H, undefined, 0), { deleted: true }, 1);
    const future = createEvent('bath', 9 * H, undefined, 0);
    expect(lastFor([a, b, future], cardById('bath'), 3 * H)?.id).toBe(a.id);
  });

  it('finds ongoing and upcoming events', () => {
    const nap = createEvent('sleep', H, { sleep: 'nap' }, 0);
    expect(ongoingFor([nap], cardById('nap'))?.id).toBe(nap.id);
    expect(ongoingFor([nap], cardById('night'))).toBeUndefined();
    const visit = createEvent('doctor', 50 * H, { note: 'checkup' }, 0);
    expect(nextUpcoming([visit], cardById('doctor'), H)?.id).toBe(visit.id);
  });

  it('suggests the other breast, or the same bottle, for a one-tap feed', () => {
    expect(feedDefaults([], H)).toEqual({ method: 'breast', side: undefined });
    const left = createEvent('feed', 0, { method: 'breast', side: 'L' }, 0);
    expect(feedDefaults([left], H)).toEqual({ method: 'breast', side: 'R' });
    const bottle = createEvent('feed', 1, { method: 'bottle', milk: 'formula', amount: 90 }, 0);
    expect(feedDefaults([left, bottle], H)).toEqual({ method: 'bottle', milk: 'formula' });
  });

  it('knows when the baby last woke', () => {
    const nap = patchEvent(createEvent('sleep', H, { sleep: 'nap' }, 0), { endAt: 2 * H }, 0);
    const night = createEvent('sleep', 5 * H, { sleep: 'night' }, 0);
    expect(lastWake([nap, night], 6 * H)).toBe(2 * H);
  });
});
