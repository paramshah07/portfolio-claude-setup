import { expect, test } from 'vitest';
import { dealt } from './EquityReadout';
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
    { street: 'flop', card: 'Qs' },
    { street: 'flop', card: 'Js' },
    { street: 'flop', card: '7d' },
    { street: 'turn', card: '2c' },
    { street: 'river', card: 'Ts' },
  ];
  expect(dealt(board, 'preflop')).toEqual([]);
  expect(dealt(board, 'flop')).toEqual(['Qs', 'Js', '7d']);
  expect(dealt(board, 'turn')).toEqual(['Qs', 'Js', '7d', '2c']);
  expect(dealt(board, 'river')).toEqual(['Qs', 'Js', '7d', '2c', 'Ts']);
});
