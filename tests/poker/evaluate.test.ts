import { describe, expect, test } from 'vitest';
import { cardPip, cardText, parseCard, parseCards, unseen } from '../../src/lib/poker/cards';
import { STRAIGHT, STRAIGHT_FLUSH, categoryOf, evaluate5, evaluate7, handName } from '../../src/lib/poker/evaluate';
import { draw, mulberry32 } from './random';

const score = (text: string) => evaluate7(parseCards(text));

describe('all 2,598,960 five-card hands', () => {
  // One pass over every hand, shared by the tests below.
  const deck = unseen([]);
  const counts = Array<number>(9).fill(0);
  const lowest = Array<number>(9).fill(Infinity);
  const ranks = new Set<number>();
  const hand = [0, 0, 0, 0, 0];
  for (let a = 0; a < 52; a++) {
    hand[0] = deck[a];
    for (let b = a + 1; b < 52; b++) {
      hand[1] = deck[b];
      for (let c = b + 1; c < 52; c++) {
        hand[2] = deck[c];
        for (let d = c + 1; d < 52; d++) {
          hand[3] = deck[d];
          for (let e = d + 1; e < 52; e++) {
            hand[4] = deck[e];
            const value = evaluate5(hand);
            const category = categoryOf(value);
            counts[category]++;
            lowest[category] = Math.min(lowest[category], value);
            ranks.add(value);
          }
        }
      }
    }
  }

  test('have exactly 7,462 distinct ranks', () => {
    expect(ranks.size).toBe(7462);
  });

  test('fall into the known category counts, high card first', () => {
    expect(counts).toEqual([1_302_540, 1_098_240, 123_552, 54_912, 10_200, 5_108, 3_744, 624, 40]);
  });

  test('put the wheel lowest among straights and among straight flushes', () => {
    expect(lowest[STRAIGHT]).toBe(score('Ah 2d 3c 4s 5h'));
    expect(lowest[STRAIGHT_FLUSH]).toBe(score('Ah 2h 3h 4h 5h'));
    expect(score('Ah 2d 3c 4s 5h')).toBeLessThan(score('2d 3c 4s 5h 6d'));
  });
});

test('kickers break ties and identical hands split', () => {
  // Same pair: the third kicker decides.
  expect(score('Ah Ad Kc Qs 9h')).toBeGreaterThan(score('As Ac Kd Qh 8s'));
  // Same two pair: the kicker decides.
  expect(score('Kh Kd 7c 7s Ah')).toBeGreaterThan(score('Ks Kc 7d 7h Qh'));
  // Flushes compare card by card, down to the fifth.
  expect(score('Ah Kh 9h 7h 3h')).toBeGreaterThan(score('Ad Kd 9d 7d 2d'));
  // A full house compares its trips before its pair.
  expect(score('3s 3d 3c 2h 2s')).toBeGreaterThan(score('2d 2c 2h Ah Ad'));
  // The sixth and seventh cards never count, so the same best five split.
  expect(score('Ah Ad Kc Qs Jh 3d 2c')).toBe(score('As Ac Kd Qh Js 4d 3c'));
  // A straight on the board that neither hand improves is a split.
  expect(score('2c 3d Ts Js Qd Kc Ah')).toBe(score('4c 5d Ts Js Qd Kc Ah'));
  // Suits never break a tie.
  expect(score('As Kd Qc Jh 9s')).toBe(score('Ah Kc Qd Js 9h'));
});

test('evaluate7 matches the best of its 21 five-card subsets on 100,000 random hands', () => {
  const random = mulberry32(7);
  const deck = unseen([]);
  const wrong: string[] = [];
  for (let n = 0; n < 100_000; n++) {
    const seven = draw(deck, 7, random);
    let best = 0;
    // Leaving out two of the seven cards picks one of the 21 five-card subsets.
    for (let x = 0; x < 7; x++) {
      for (let y = x + 1; y < 7; y++) best = Math.max(best, evaluate5(seven.filter((_, i) => i !== x && i !== y)));
    }
    if (evaluate7(seven) !== best) wrong.push(seven.map(cardText).join(' '));
  }
  expect(wrong).toEqual([]);
});

test('names hands in plain words', () => {
  expect(handName(score('As Ks Qs Js Ts'))).toBe('Royal flush');
  expect(handName(score('9h 8h 7h 6h 5h'))).toBe('Straight flush, nine high');
  expect(handName(score('Ah 2h 3h 4h 5h'))).toBe('Straight flush, five high');
  expect(handName(score('6s 6d 6c 6h Ks'))).toBe('Four of a kind, sixes');
  expect(handName(score('3s 3d 3c 2h 2s'))).toBe('Full house, threes full of twos');
  expect(handName(score('Ah Jh 8h 4h 2h'))).toBe('Flush, ace high');
  expect(handName(score('Ah 2d 3c 4s 5h'))).toBe('Straight, five high');
  expect(handName(score('7s 7d 7c Kh 2s'))).toBe('Three of a kind, sevens');
  expect(handName(score('As Ad Ks Kd 2c'))).toBe('Two pair, aces and kings');
  expect(handName(score('Qs Qd 9c 5h 2s'))).toBe('Pair of queens');
  expect(handName(score('As Kd 9c 5h 2s'))).toBe('Ace high');
  // Two hole cards before the flop are a hand too.
  expect(handName(score('As Ks'))).toBe('Ace high');
});

test('reads cards and writes them back', () => {
  expect(parseCard('As')).toBe(12);
  expect(parseCard('2d')).toBe(32);
  expect(unseen([]).map(cardText).map(parseCard)).toEqual(unseen([]));
  expect(cardPip(parseCard('Ts'))).toBe('T♠');
  expect(() => parseCard('1s')).toThrow('"1s" isn\'t a card');
  expect(() => parseCard('as')).toThrow();
});
