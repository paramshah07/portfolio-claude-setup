import type { Tier } from '../../../lib/state';

export type Live = Exclude<Tier, 'static'>;
/** The order the monitor steps down in. Static is never stepped into: it's decided on load. */
export const TIERS: Live[] = ['high', 'medium', 'low'];

/**
 * Where the performance monitor goes when it declines (by = 1) or inclines (by = -1): one tier at a
 * time and never above the tier the device got on load. moves holds the steps it has actually
 * taken. When the last four keep reversing, the device can't hold the upper of two tiers, so it
 * settles on the lower one and stops watching.
 */
export function nextTier(current: Live, by: 1 | -1, ceiling: Live, moves: readonly number[]) {
  const next = TIERS[Math.min(TIERS.length - 1, Math.max(TIERS.indexOf(ceiling), TIERS.indexOf(current) + by))];
  if (next === current) return { tier: current, moved: false, settled: false };
  const recent = [...moves, by].slice(-4);
  const settled = recent.length === 4 && recent.every((d, k) => k === 0 || d !== recent[k - 1]);
  return settled && by < 0 ? { tier: current, moved: false, settled } : { tier: next, moved: true, settled };
}
