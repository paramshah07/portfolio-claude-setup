import { expect, test } from 'vitest';
import { checkDeck } from '../src/lib/deck';

const board = [
  ['flop', 'Qs'],
  ['flop', 'Js'],
  ['flop', '7d'],
  ['turn', '2c'],
  ['river', 'Ts'],
].map(([street, card]) => ({ street, card }));

test('accepts the hand in content.md', () => {
  expect(() => checkDeck(['As', 'Ks'], board)).not.toThrow();
});

test('rejects a board without three flop cards, one turn and one river', () => {
  const twoTurns = board.map((b, i) => (i === 2 ? { ...b, street: 'turn' } : b));
  expect(() => checkDeck(['As', 'Ks'], twoTurns)).toThrow('2 flop, 2 turn and 1 river');
});

test('rejects a card that is dealt twice', () => {
  expect(() => checkDeck(['As', 'Qs'], board)).toThrow('Qs is dealt twice');
});

test('rejects something that is not a card', () => {
  expect(() => checkDeck(['As', '1s'], board)).toThrow('"1s" isn\'t a card');
});
