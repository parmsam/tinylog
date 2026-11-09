import { describe, expect, it } from 'vitest';
import { CARDS, cardById, cardFor, feedDefaults, lastFor, lastWake, nextUpcoming, ongoingFor, orderCards } from './cards';
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

describe('orderCards', () => {
  const ids = (order: string[]) => orderCards(order).map((c) => c.id);
  it('uses the default order when nothing is saved', () => {
    expect(ids([])).toEqual(CARDS.map((c) => c.id));
  });

  it('follows a saved order, dropping unknown and repeated ids', () => {
    const saved = ['bath', 'feed', 'nope', 'bath', ...CARDS.map((c) => c.id).filter((id) => id !== 'bath' && id !== 'feed')];
    const out = ids(saved);
    expect(out.slice(0, 2)).toEqual(['bath', 'feed']);
    expect(out).toHaveLength(CARDS.length);
    expect(new Set(out).size).toBe(CARDS.length);
  });

  it('puts a card missing from the saved order (new in an update) after its default neighbour', () => {
    // Saved before Height and My mood existed, with Weight moved to the top.
    const saved = ['weight', ...CARDS.map((c) => c.id).filter((id) => !['weight', 'height', 'mood'].includes(id))];
    const out = ids(saved);
    expect(out.slice(0, 3)).toEqual(['weight', 'height', 'mood']);
    // A missing first card goes first.
    expect(ids(CARDS.slice(1).map((c) => c.id))[0]).toBe('feed');
  });
});
