import { expect, test } from 'vitest';
import { pickTier } from '../src/lib/state';

const laptop = { width: 1440, reducedMotion: false, webgl2: true };

test('treats a missing deviceMemory as unknown, not low', () => {
  // Safari and Firefox don't report memory at all.
  expect(pickTier(laptop)).toBe('high');
});

test('sends phones, reduced motion, missing WebGL2 and low memory to the static tier', () => {
  expect(pickTier({ ...laptop, width: 390 })).toBe('static');
  expect(pickTier({ ...laptop, reducedMotion: true })).toBe('static');
  expect(pickTier({ ...laptop, webgl2: false })).toBe('static');
  expect(pickTier({ ...laptop, memory: 2 })).toBe('static');
});

test('starts 4 GB devices on medium and 8 GB on high', () => {
  expect(pickTier({ ...laptop, memory: 4 })).toBe('medium');
  expect(pickTier({ ...laptop, memory: 8 })).toBe('high');
});
