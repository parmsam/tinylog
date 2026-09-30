import { describe, expect, it } from 'vitest';
import { cleanDetail, createEvent, isOngoing, mergeData, patchEvent } from './events';
import type { LogData } from './types';

describe('createEvent / patchEvent', () => {
  it('drops empty detail fields', () => {
    const e = createEvent('feed', 100, { method: 'breast', side: undefined, note: '  ' }, 100);
    expect(e.detail).toEqual({ method: 'breast' });
    expect(cleanDetail({ note: '' })).toBeUndefined();
  });

  it('bumps updatedAt even when the clock has not moved', () => {
    const e = createEvent('bath', 100, undefined, 100);
    const p = patchEvent(e, { at: 50 }, 100);
    expect(p.updatedAt).toBe(101);
    expect(p.at).toBe(50);
  });

  it('can clear an end time, making a timed event ongoing again', () => {
    const e = patchEvent(createEvent('sleep', 0, { sleep: 'nap' }, 0), { endAt: 10 }, 1);
    expect(isOngoing(e)).toBe(false);
    const again = patchEvent(e, { endAt: undefined }, 2);
    expect('endAt' in again).toBe(false);
    expect(isOngoing(again)).toBe(true);
  });

  it('only timed types can be ongoing', () => {
    expect(isOngoing(createEvent('feed', 0, undefined, 0))).toBe(false);
    expect(isOngoing(createEvent('pump', 0, undefined, 0))).toBe(true);
  });
});

describe('mergeData', () => {
  const base = createEvent('feed', 1000, { method: 'bottle', amount: 90 }, 1000);
  const ours: LogData = { events: [base], notes: [{ day: '2026-09-30', text: 'mine', updatedAt: 5 }] };

  it('adds new events and notes from the other phone', () => {
    const other = createEvent('diaper', 2000, { diaper: 'wet' }, 2000);
    const r = mergeData(ours, { events: [other], notes: [{ day: '2026-09-29', text: 'theirs', updatedAt: 1 }] });
    expect(r.events.map((e) => e.id)).toEqual([base.id, other.id]);
    expect(r.notes).toHaveLength(2);
    expect(r.added).toBe(2);
  });

  it('keeps the newer edit of the same event, from either side', () => {
    const edited = patchEvent(base, { detail: { method: 'bottle', amount: 120 } }, 3000);
    expect(mergeData(ours, { events: [edited], notes: [] }).events[0].detail?.amount).toBe(120);
    expect(mergeData({ events: [edited], notes: [] }, ours).events[0].detail?.amount).toBe(120);
  });

  it('carries deletes across', () => {
    const del = patchEvent(base, { deleted: true }, 3000);
    const r = mergeData(ours, { events: [del], notes: [] });
    expect(r.events[0].deleted).toBe(true);
    expect(r.updated).toBe(1);
  });

  it('is idempotent', () => {
    const once = mergeData(ours, ours);
    expect(once.added + once.updated).toBe(0);
    expect(once.events).toEqual(ours.events);
  });
});
