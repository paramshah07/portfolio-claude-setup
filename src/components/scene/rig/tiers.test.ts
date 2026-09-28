import { describe, expect, it } from 'vitest';
import { nextTier } from './tiers';

describe('nextTier', () => {
  it('steps down one tier at a time and stops at low', () => {
    expect(nextTier('high', 1, 'high', [])).toMatchObject({ tier: 'medium', moved: true });
    expect(nextTier('medium', 1, 'high', [1])).toMatchObject({ tier: 'low', moved: true });
    expect(nextTier('low', 1, 'high', [1, 1])).toMatchObject({ tier: 'low', moved: false, settled: false });
  });

  it('never climbs above the tier the device started on', () => {
    expect(nextTier('medium', -1, 'medium', [])).toMatchObject({ tier: 'medium', moved: false });
    expect(nextTier('low', -1, 'medium', [1])).toMatchObject({ tier: 'medium', moved: true });
  });

  it('climbs back after a slow patch without settling', () => {
    expect(nextTier('low', -1, 'high', [1, 1])).toMatchObject({ tier: 'medium', settled: false });
    expect(nextTier('medium', -1, 'high', [1, 1, -1])).toMatchObject({ tier: 'high', settled: false });
  });

  it('settles on the lower tier once it keeps flipping between two', () => {
    // Down, up, down, then an up that would start the loop again: it stays down.
    expect(nextTier('medium', -1, 'high', [1, -1, 1])).toEqual({ tier: 'medium', moved: false, settled: true });
    // Up, down, up, then a down: it takes the step down and stays there.
    expect(nextTier('high', 1, 'high', [-1, 1, -1])).toEqual({ tier: 'medium', moved: true, settled: true });
  });
});
