import { expect, test } from 'vitest';
import { isHudKey } from './PerfHud';

const key = (key: string, mods: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; repeat?: boolean } = {}) => ({
  key,
  repeat: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

test('H toggles the HUD, with or without Shift', () => {
  expect(isHudKey(key('h'), false)).toBe(true);
  expect(isHudKey(key('H'), false)).toBe(true);
});

test('leaves typing, browser shortcuts and key repeat alone', () => {
  expect(isHudKey(key('h'), true)).toBe(false);
  // ⌘H hides the window on macOS and Ctrl H opens the history elsewhere.
  expect(isHudKey(key('h', { metaKey: true }), false)).toBe(false);
  expect(isHudKey(key('h', { ctrlKey: true }), false)).toBe(false);
  expect(isHudKey(key('h', { altKey: true }), false)).toBe(false);
  expect(isHudKey(key('h', { repeat: true }), false)).toBe(false);
});
