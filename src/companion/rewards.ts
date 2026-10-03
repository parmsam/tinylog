import type { AccessoryId } from '../core/types';
import type { CompanionId } from './characters';

/**
 * What each coin milestone brings, chosen ahead of time: a medal for every one, and at most of them
 * a new accessory or a special companion. Unlocks follow the all-time coin total (derived from the
 * log, never stored), so nothing is ever spent or lost on a quiet day.
 */
export type Unlock = { kind: 'accessory'; id: AccessoryId } | { kind: 'companion'; id: CompanionId };
export type Tier = 'bronze' | 'silver' | 'gold';

export interface Reward {
  at: number;
  tier: Tier;
  unlock?: Unlock;
}

/** One per coin milestone (COIN_MILESTONES in core/coins.ts; a test keeps them in step). */
export const REWARDS: Reward[] = [
  { at: 1, tier: 'bronze' },
  { at: 50, tier: 'bronze', unlock: { kind: 'accessory', id: 'bowtie' } },
  { at: 100, tier: 'bronze', unlock: { kind: 'accessory', id: 'partyhat' } },
  { at: 250, tier: 'silver', unlock: { kind: 'companion', id: 'star' } },
  { at: 500, tier: 'silver', unlock: { kind: 'accessory', id: 'flowers' } },
  { at: 1000, tier: 'silver', unlock: { kind: 'companion', id: 'unicorn' } },
  { at: 2500, tier: 'gold', unlock: { kind: 'accessory', id: 'crown' } },
  { at: 5000, tier: 'gold', unlock: { kind: 'companion', id: 'bee' } },
  { at: 10_000, tier: 'gold', unlock: { kind: 'accessory', id: 'rainbow' } },
];

export const rewardAt = (coins: number) => REWARDS.find((r) => r.at === coins);

/** Coins needed for a special companion or an accessory (undefined: always there). */
export function unlockAt(kind: Unlock['kind'], id: string): number | undefined {
  return REWARDS.find((r) => r.unlock?.kind === kind && r.unlock.id === id)?.at;
}

export function isUnlocked(kind: Unlock['kind'], id: string, total: number): boolean {
  return (unlockAt(kind, id) ?? 0) <= total;
}
