import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { PREFLOP_COMMAND, computeEquity, computeHeadsUp } from '../../src/lib/poker/api';
import { cardText, parseCard, startingHand, unseen, words } from '../../src/lib/poker/cards';
import { evaluate } from '../../src/lib/poker/evaluate';
import preflop from '../../src/lib/poker/preflop.json';
import type { EquityRequest, EquityResponse } from '../../src/workers/equity.worker';
import { draw, mulberry32 } from './random';

// Param's hand from content.md, dealt street by street.
const hole = ['As', 'Ks'];
const flop = ['Qs', 'Js', '7d'];
const turn = [...flop, '2c'];
const river = [...turn, 'Ts'];

/**
 * Equity by sampling runouts, against a random hand or a known one, with its interval: the
 * estimate plus or minus z standard errors. z = 1.96 gives the usual 95% interval.
 */
function monteCarlo(hole: string[], board: string[], { samples = 200_000, seed = 1, z = 1.96, opponent = [] as string[] } = {}) {
  const random = mulberry32(seed);
  const [heroLo, heroHi] = words(hole.map(parseCard));
  const [boardLo, boardHi] = words(board.map(parseCard));
  const [knownLo, knownHi] = words(opponent.map(parseCard));
  const deck = unseen([...hole, ...board, ...opponent].map(parseCard));
  const dealt = 5 - board.length + (opponent.length ? 0 : 2);
  let sum = 0;
  let squares = 0;
  for (let n = 0; n < samples; n++) {
    // With no known opponent, the first two cards drawn are the opponent's hand.
    const cards = draw(deck, dealt, random);
    const [lo, hi] = words(opponent.length ? cards : cards.slice(2));
    const [villainLo, villainHi] = opponent.length ? [knownLo, knownHi] : words(cards.slice(0, 2));
    const hero = evaluate(boardLo | lo | heroLo, boardHi | hi | heroHi);
    const villain = evaluate(boardLo | lo | villainLo, boardHi | hi | villainHi);
    const share = hero > villain ? 1 : hero === villain ? 0.5 : 0;
    sum += share;
    squares += share * share;
  }
  const equity = sum / samples;
  const error = Math.sqrt((squares / samples - equity * equity) / samples);
  return { equity, low: equity - z * error, high: equity + z * error };
}

test('counts every matchup: 1,070,190 on the flop, 45,540 on the turn and 990 on the river', () => {
  expect(computeEquity(hole, flop).matchups).toBe(1_070_190);
  expect(computeEquity(hole, turn).matchups).toBe(45_540);
  expect(computeEquity(hole, river).matchups).toBe(990);
});

test('preflop is 2,097,572,400 matchups, every one of them counted in preflop.json', () => {
  // Every five-card board from 50 unseen cards, then every opponent hand from the 45 left.
  expect(2_118_760 * 990).toBe(2_097_572_400);
  expect(preflop.win + preflop.tie + preflop.loss).toBe(2_097_572_400);
  expect(computeEquity(hole, []).matchups).toBe(2_097_572_400);
});

test('preflop.json was computed for the hole cards in content.md', () => {
  const content = readFileSync(new URL('../../content.md', import.meta.url), 'utf8');
  const cards = content.match(/^- hole: (\S+) (\S+)/m)?.slice(1) ?? [];
  expect(
    startingHand(cards.map(parseCard)),
    `content.md holds ${cards.join(' ')} but preflop.json was computed for ${preflop.hole.join(' ')}. Rerun: ${PREFLOP_COMMAND}`,
  ).toBe(preflop.startingHand);
});

test('every street is exact and its shares add up', () => {
  for (const board of [[], flop, turn, river]) {
    const result = computeEquity(hole, board);
    expect(result.exact).toBe(true);
    expect(result.win + result.tie + result.loss).toBeCloseTo(1, 12);
    expect(result.equity).toBeCloseTo(result.win + result.tie / 2, 12);
  }
});

test('Monte Carlo agrees with preflop.json within its interval', () => {
  const exact = computeEquity(hole, []).equity;
  const { low, high } = monteCarlo(hole, []);
  expect(exact).toBeGreaterThanOrEqual(low);
  expect(exact).toBeLessThanOrEqual(high);
});

test('pocket aces against one random hand come out near 85.2% preflop', () => {
  const { low, high } = monteCarlo(['As', 'Ah'], [], { seed: 2 });
  expect(0.852).toBeGreaterThanOrEqual(low);
  expect(0.852).toBeLessThanOrEqual(high);
});

test('exact and Monte Carlo agree within the interval on sampled flops', () => {
  // Five comparisons at 99% each all pass by chance 95% of the time, like one 95% comparison.
  const random = mulberry32(3);
  for (let n = 0; n < 5; n++) {
    const [a, b, ...board] = draw(unseen([]), 5, random).map(cardText);
    const exact = computeEquity([a, b], board).equity;
    const { low, high } = monteCarlo([a, b], board, { seed: 10 + n, z: 2.576 });
    expect(exact, `${a} ${b} on ${board.join(' ')}`).toBeGreaterThanOrEqual(low);
    expect(exact, `${a} ${b} on ${board.join(' ')}`).toBeLessThanOrEqual(high);
  }
});

test('pocket aces against pocket kings come out near 82% and match Monte Carlo', () => {
  const offsuit = computeHeadsUp(['As', 'Ah'], ['Kd', 'Kc'], []);
  const sameSuits = computeHeadsUp(['As', 'Ah'], ['Ks', 'Kh'], []);
  expect(offsuit.equity).toBeGreaterThan(0.81);
  expect(sameSuits.equity).toBeLessThan(0.83);
  // Kings of the aces' suits make fewer flushes the aces can't beat.
  expect(sameSuits.equity).toBeGreaterThan(offsuit.equity);
  const { low, high } = monteCarlo(['As', 'Ah'], [], { seed: 4, opponent: ['Kd', 'Kc'] });
  expect(offsuit.equity).toBeGreaterThanOrEqual(low);
  expect(offsuit.equity).toBeLessThanOrEqual(high);
});

test('heads-up counts every runout: 1,712,304 preflop, 990 on the flop, 44 on the turn and 1 on the river', () => {
  const opponent = ['Ah', 'Kd'];
  expect(computeHeadsUp(hole, opponent, []).matchups).toBe(1_712_304);
  expect(computeHeadsUp(hole, opponent, flop).matchups).toBe(990);
  expect(computeHeadsUp(hole, opponent, turn).matchups).toBe(44);
  expect(computeHeadsUp(hole, opponent, river).matchups).toBe(1);
});

test("lists Param's flop outs by what they make, strongest first", () => {
  const { outs = [] } = computeEquity(hole, flop);
  expect(outs.map((group) => group.makes)).toEqual([
    'Royal flush',
    'Flush, ace high',
    'Straight, ace high',
    'Pair of aces',
    'Pair of kings',
  ]);
  expect(outs[0].text).toBe('T♠ makes a royal flush');
  expect(outs[2].text).toBe('T♥, T♦ and T♣ make a straight, ace high');
  expect(outs.flatMap((group) => group.cards)).toHaveLength(18);
  // A queen or a seven only pairs the board, and everyone has that pair.
  expect(outs.flatMap((group) => group.cards)).not.toContain('Qh');
  expect(outs.flatMap((group) => group.cards)).not.toContain('7h');
});

test('a card that improves every hand the same way is not an out', () => {
  // With aces already paired, a seven gives two pair to every hand holding a pair.
  const { outs = [] } = computeEquity(hole, ['Ad', '7c', '2h']);
  expect(outs.map((group) => group.text)).toContain('A♥ and A♣ make three of a kind, aces');
  expect(outs.map((group) => group.text)).toContain('K♥, K♦ and K♣ make two pair, aces and kings');
  expect(outs.flatMap((group) => group.cards)).not.toContain('7h');
});

test('outs appear on the flop and turn only', () => {
  expect(computeEquity(hole, []).outs).toBeUndefined();
  expect(computeEquity(hole, turn).outs?.[0].text).toBe('T♠ makes a royal flush');
  expect(computeEquity(hole, river).outs).toBeUndefined();
});

test("Param's river is a royal flush that wins all 990 matchups", () => {
  const result = computeEquity(hole, river);
  expect(result.madeHand).toBe('Royal flush');
  expect(result.win).toBe(1);
});

test('rejects cards dealt twice, boards of the wrong size and hands preflop.json does not hold', () => {
  expect(() => computeEquity(['As', 'As'], [])).toThrow('As is dealt twice');
  expect(() => computeEquity(hole, ['Qs', 'Js'])).toThrow('0, 3, 4 or 5 cards');
  expect(() => computeHeadsUp(hole, ['Ks', 'Qd'], [])).toThrow('Ks is dealt twice');
  expect(() => computeEquity(['7c', '2d'], [])).toThrow(PREFLOP_COMMAND);
});

test('the worker drops a job when a newer one arrives', async () => {
  const replies: EquityResponse[] = [];
  const worker = { onmessage: null as unknown as (event: { data: EquityRequest }) => Promise<void>, postMessage: (reply: EquityResponse) => replies.push(reply) };
  vi.stubGlobal('self', worker);
  await import('../../src/workers/equity.worker');
  // The flop is still running when the turn arrives, so only the turn answers.
  const running = worker.onmessage({ data: { id: 1, hole, board: flop } });
  const newer = worker.onmessage({ data: { id: 2, hole, board: turn } });
  await Promise.all([running, newer]);
  expect(replies.map((reply) => reply.id)).toEqual([2]);
  await worker.onmessage({ data: { id: 3, hole: ['As', 'As'], board: [] } });
  expect(replies[1]).toEqual({ id: 3, error: 'As is dealt twice.' });
  vi.unstubAllGlobals();
});
