import { describe, expect, it } from 'vitest';
import { coins, coinsBefore, milestonePassed, nextMilestone } from './coins';
import { createEvent, patchEvent } from './events';

const at = (h: number, d = 30) => new Date(2026, 8, d, h).getTime();

describe('coins', () => {
  it('gives one per entry, today and all time', () => {
    const events = [createEvent('feed', at(8), undefined, at(8)), createEvent('diaper', at(9), { diaper: 'wet' }, at(9)), createEvent('feed', at(20, 29), undefined, at(20, 29))];
    expect(coins(events, at(10), 0)).toEqual({ today: 2, total: 3 });
  });

  it('counts the day an entry was added, not the day it is about', () => {
    // Filled in this morning for yesterday evening: still today's coin.
    expect(coins([createEvent('feed', at(20, 29), undefined, at(8))], at(10), 0)).toEqual({ today: 1, total: 1 });
  });

  it('takes the coin back on undo, and skips day notes', () => {
    const fed = createEvent('feed', at(8), undefined, at(8));
    expect(coins([patchEvent(fed, { deleted: true }, at(8)), createEvent('note', at(8), undefined, at(8))], at(10), 0)).toEqual({ today: 0, total: 0 });
  });

  it('follows "day starts at"', () => {
    // 2 AM belongs to yesterday when the day starts at 6.
    expect(coins([createEvent('feed', at(2), undefined, at(2))], at(10), 6).today).toBe(0);
    expect(coins([createEvent('feed', at(2), undefined, at(2))], at(4), 6).today).toBe(1);
  });

  it('counts coins earned before a time (what was unlocked by the start of a day)', () => {
    const events = [createEvent('feed', at(8, 29), undefined, at(8, 29)), createEvent('feed', at(8), undefined, at(8)), createEvent('note', at(7, 29), undefined, at(7, 29))];
    expect(coinsBefore(events, at(0))).toBe(1);
    expect(coinsBefore(events, at(9))).toBe(2);
  });
});

describe('coin milestones', () => {
  it('notices passing a milestone, once', () => {
    expect(milestonePassed(0, 1)).toBe(1);
    expect(milestonePassed(49, 50)).toBe(50);
    expect(milestonePassed(50, 51)).toBeUndefined();
    expect(milestonePassed(50, 49)).toBeUndefined(); // undo
  });

  it('celebrates the biggest one when a merge jumps past several', () => {
    expect(milestonePassed(40, 260)).toBe(250);
  });

  it('knows the next one, and runs out eventually', () => {
    expect(nextMilestone(0)).toBe(1);
    expect(nextMilestone(50)).toBe(100);
    expect(nextMilestone(10_000)).toBeUndefined();
  });
});
