import { expect, test } from 'vitest';
import { reach } from './build-stats';

test('reach follows static imports, and dynamic ones only when asked', () => {
  const graph = new Map([
    ['page.js', { imports: ['helper.js'], dynamicImports: ['motion.js'] }],
    ['helper.js', { imports: [], dynamicImports: [] }],
    ['motion.js', { imports: ['gsap.js', 'helper.js'], dynamicImports: [] }],
  ]);
  expect([...reach(graph, ['page.js'], false)]).toEqual(['page.js', 'helper.js']);
  expect([...reach(graph, ['page.js'], true)]).toEqual(['page.js', 'helper.js', 'motion.js', 'gsap.js']);
});
