import { describe, expect, it } from 'vitest';
import { COIN_MILESTONES } from '../core/coins';
import { ACCESSORIES } from './accessories';
import { BASE_IDS, CHARACTERS } from './characters';
import { isUnlocked, REWARDS, rewardAt, unlockAt } from './rewards';

describe('rewards', () => {
  it('has one reward (and medal) per coin milestone, in order', () => {
    expect(REWARDS.map((r) => r.at)).toEqual(COIN_MILESTONES);
  });

  it('unlocks every accessory and every special companion exactly once', () => {
    const unlocks = REWARDS.flatMap((r) => (r.unlock ? [`${r.unlock.kind}:${r.unlock.id}`] : []));
    expect(new Set(unlocks).size).toBe(unlocks.length);
    const specials = CHARACTERS.map((c) => c.id).filter((id) => !BASE_IDS.includes(id));
    expect(unlocks.sort()).toEqual([...ACCESSORIES.map((a) => `accessory:${a.id}`), ...specials.map((id) => `companion:${id}`)].sort());
  });

  it('is prechosen: the same milestone always brings the same thing', () => {
    expect(rewardAt(50)?.unlock).toEqual({ kind: 'accessory', id: 'bowtie' });
    expect(rewardAt(250)?.unlock).toEqual({ kind: 'companion', id: 'star' });
    expect(rewardAt(1)?.unlock).toBeUndefined();
  });

  it('unlocks follow the all-time total; base companions are always there', () => {
    expect(unlockAt('companion', 'unicorn')).toBe(1000);
    expect(isUnlocked('companion', 'unicorn', 999)).toBe(false);
    expect(isUnlocked('companion', 'unicorn', 1000)).toBe(true);
    expect(isUnlocked('companion', 'puff', 0)).toBe(true);
    expect(isUnlocked('accessory', 'partyhat', 99)).toBe(false);
  });
});
