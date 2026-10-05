import { expect, test } from 'vitest';
import { dealt, next } from './EquityReadout';
import { frameStats } from './PerfHud';

test('frame stats take the median, the nearest-rank 95th percentile and the fps', () => {
  // Nineteen smooth frames and one long one.
  const stats = frameStats([...Array(19).fill(10), 50])!;
  expect(stats.median).toBe(10);
  expect(stats.p95).toBe(10);
  expect(stats.fps).toBeCloseTo(1000 / 12);
  expect(frameStats([10, 20, 30, 40])).toMatchObject({ median: 25, p95: 40 });
  expect(frameStats([])).toBeNull();
});

test('each street adds its cards to the board, in deal order', () => {
  const board = [
    { street: 'flop', card: 'Kc' },
    { street: 'flop', card: 'Qd' },
    { street: 'flop', card: '7d' },
    { street: 'turn', card: '2c' },
    { street: 'river', card: '7c' },
  ];
  expect(dealt(board, 'preflop')).toEqual([]);
  expect(dealt(board, 'flop')).toEqual(['Kc', 'Qd', '7d']);
  expect(dealt(board, 'turn')).toEqual(['Kc', 'Qd', '7d', '2c']);
  expect(dealt(board, 'river')).toEqual(['Kc', 'Qd', '7d', '2c', '7c']);
});

test('the deal button deals the flop, the turn and the river, then goes away', () => {
  expect(next('preflop')).toBe('flop');
  expect(next('flop')).toBe('turn');
  expect(next('turn')).toBe('river');
  expect(next('river')).toBeUndefined();
});
