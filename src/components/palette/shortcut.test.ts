import { expect, test } from 'vitest';
import { isShortcut } from './CommandPalette';

const key = (key: string, mods: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

test('opens with ⌘K on Apple devices and Ctrl K elsewhere', () => {
  expect(isShortcut(key('k', { metaKey: true }), true, false)).toBe(true);
  expect(isShortcut(key('k', { ctrlKey: true }), false, true)).toBe(true);
  // Ctrl K deletes to the end of the line in macOS text fields.
  expect(isShortcut(key('k', { ctrlKey: true }), true, false)).toBe(false);
  expect(isShortcut(key('k', { metaKey: true }), false, false)).toBe(false);
  expect(isShortcut(key('k'), true, false)).toBe(false);
});

test('opens with "/" only outside text fields', () => {
  expect(isShortcut(key('/'), true, false)).toBe(true);
  expect(isShortcut(key('/'), true, true)).toBe(false);
  expect(isShortcut(key('/', { ctrlKey: true }), false, false)).toBe(false);
});
