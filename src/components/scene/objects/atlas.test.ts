import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import profile from '../../../content/profile.json';
import atlas from './atlas.json';

test('the card atlas has a face for every card in content', () => {
  const board = readdirSync('src/content/board')
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(`src/content/board/${f}`, 'utf8').match(/^card:\s*['"]?([2-9TJQKA][shdc])/m)?.[1]);
  expect([...atlas.cards].sort(), 'Content changed. Run node scripts/make-card-faces.mjs').toEqual([...profile.hand.hole, ...board].sort());
});
