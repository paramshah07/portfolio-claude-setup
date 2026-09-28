import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import profile from '../../../content/profile.json';
import atlas from './atlas.json';

test('the card atlas holds every card in content, in the order the scene reads it', () => {
  const ids = readdirSync('src/content/board')
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort((a, b) => a.localeCompare(b));
  const board = ids.map((id) => readFileSync(`src/content/board/${id}.md`, 'utf8').match(/^card:\s*(\S+)/m)?.[1]);
  expect(atlas.cards, 'Content changed. Run node scripts/make-card-faces.mjs').toEqual([...profile.hand.hole, ...board]);
});
