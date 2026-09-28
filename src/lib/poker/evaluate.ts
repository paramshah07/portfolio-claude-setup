// The hand evaluator: up to seven cards in, one integer out. The higher integer wins and equal
// integers split. There's no lookup table and no loop over ranks. Everything is ANDs, ORs and
// shifts on the four 13-bit suit masks laid out in cards.ts.

import { words, type Card } from './cards.ts';

// Categories, weakest to strongest.
export const HIGH_CARD = 0;
export const PAIR = 1;
export const TWO_PAIR = 2;
export const THREE_OF_A_KIND = 3;
export const STRAIGHT = 4;
export const FLUSH = 5;
export const FULL_HOUSE = 6;
export const FOUR_OF_A_KIND = 7;
export const STRAIGHT_FLUSH = 8;

// A hand's value packs three fields, most significant first:
//
//   bits 26-29   the category, 0 for high card up to 8 for a straight flush
//   bits 13-25   the ranks that make the hand, as a 13-bit mask: the pair, both pairs, the trips,
//                the quads, the straight's top card or all five cards of a flush or a high card
//   bits  0-12   the kickers, as a 13-bit mask (for a full house, the pair)
//
// A higher card is always a higher bit and a more important field always sits higher, so
// comparing two hands is one integer comparison. Two masks with the same number of bits compare
// the way you'd read the ranks from the top down: A-K-Q-7-4 beats A-K-Q-7-3 because the highest
// bit where they differ is the four, and only the first hand has it.
const value = (category: number, major: number, minor: number) => (category << 26) | (major << 13) | minor;

export const categoryOf = (value: number) => value >>> 26;

/** Scores a hand given as its two words (see cards.ts). */
export function evaluate(lo: number, hi: number): number {
  const s = lo & 0x1fff;
  const h = lo >>> 16;
  const d = hi & 0x1fff;
  const c = hi >>> 16;

  // Which ranks the hand holds at least once, twice, three times and four times, with no
  // counting. Put the suits in two teams, spades with hearts and diamonds with clubs. A rank is
  // held twice when one team holds it twice or each team holds it once. It's held three times
  // when one team holds it twice and the other at least once, because three cards spread over two
  // teams of two always fill one of them.
  const ranks = s | h | d | c;
  const twoPlus = (s & h) | (d & c) | ((s | h) & (d | c));
  const threePlus = (s & h & (d | c)) | (d & c & (s | h));
  const four = s & h & d & c;

  // A flush is a suit holding five or more ranks. Seven cards can't make two.
  const flush = popcount(s) >= 5 ? s : popcount(h) >= 5 ? h : popcount(d) >= 5 ? d : popcount(c) >= 5 ? c : 0;

  // From the strongest category down. The first one the hand makes is its category.
  if (flush) {
    const straightFlush = straightTop(flush);
    if (straightFlush) return value(STRAIGHT_FLUSH, straightFlush, 0);
  }
  if (four) return value(FOUR_OF_A_KIND, four, keepHighest(ranks & ~four, 1));
  if (threePlus) {
    // With two sets of trips the higher one is the three and the lower one can be the pair.
    const trips = keepHighest(threePlus, 1);
    const pair = keepHighest(twoPlus & ~trips, 1);
    if (pair) return value(FULL_HOUSE, trips, pair);
  }
  if (flush) return value(FLUSH, keepHighest(flush, 5), 0);
  const straight = straightTop(ranks);
  if (straight) return value(STRAIGHT, straight, 0);
  if (threePlus) return value(THREE_OF_A_KIND, threePlus, keepHighest(ranks & ~threePlus, 2));
  // x & (x - 1) clears the lowest set bit, so it's nonzero only when two or more ranks are paired.
  if (twoPlus & (twoPlus - 1)) {
    const pairs = keepHighest(twoPlus, 2);
    // A third pair can still be the kicker.
    return value(TWO_PAIR, pairs, keepHighest(ranks & ~pairs, 1));
  }
  if (twoPlus) return value(PAIR, twoPlus, keepHighest(ranks & ~twoPlus, 3));
  return value(HIGH_CARD, keepHighest(ranks, 5), 0);
}

/** Scores the best five of seven cards. */
export const evaluate7 = (cards: readonly Card[]) => evaluate(...words(cards));

/** Scores five cards. The masks don't care how many cards went in, so it's the same function. */
export const evaluate5 = evaluate7;

/**
 * The top card of the best straight in a rank mask, as a one-bit mask, or 0 if there's none.
 *
 * Copying the ace below the deuce makes A-2-3-4-5 five in a row. ANDing the mask with itself
 * shifted left by 1, 2, 3 and 4 keeps bit i only when bits i-4 through i were all set, which is
 * a straight with bit i on top.
 */
function straightTop(ranks: number): number {
  const r = (ranks << 1) | (ranks >>> 12); // 14 bits, A 2 3 ... K A, low ace at bit 0
  const runs = r & (r << 1) & (r << 2) & (r << 3) & (r << 4);
  if (!runs) return 0;
  // The highest surviving bit, moved back down one place into the 13-bit rank mask.
  return 1 << (30 - Math.clz32(runs));
}

/** Keeps the k highest set bits by clearing the lowest one, x & (x - 1), until only k are left. */
function keepHighest(mask: number, k: number): number {
  for (let extra = popcount(mask) - k; extra > 0; extra--) mask &= mask - 1;
  return mask;
}

/** Counts the set bits of a 13-bit mask by adding neighbours in parallel: pairs, nibbles, bytes. */
function popcount(x: number): number {
  x -= (x >>> 1) & 0x5555; // each 2-bit field now holds how many of its 2 bits were set
  x = (x & 0x3333) + ((x >>> 2) & 0x3333); // each 4-bit field, of its 4 bits
  x = (x + (x >>> 4)) & 0x0f0f; // each byte, of its 8 bits
  return (x + (x >>> 8)) & 0x1f; // both bytes together: 0 to 13
}

const NAMES = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];

/** The name of the highest rank in a mask. Math.clz32 counts the zeros above the top bit. */
const topName = (mask: number) => NAMES[31 - Math.clz32(mask)];
const plural = (name: string) => (name === 'six' ? 'sixes' : `${name}s`);

/** A hand's value in plain words, like "Two pair, aces and kings". */
export function handName(value: number): string {
  const major = (value >>> 13) & 0x1fff;
  const minor = value & 0x1fff;
  switch (categoryOf(value)) {
    case STRAIGHT_FLUSH:
      return major === 1 << 12 ? 'Royal flush' : `Straight flush, ${topName(major)} high`;
    case FOUR_OF_A_KIND:
      return `Four of a kind, ${plural(topName(major))}`;
    case FULL_HOUSE:
      return `Full house, ${plural(topName(major))} full of ${plural(topName(minor))}`;
    case FLUSH:
      return `Flush, ${topName(major)} high`;
    case STRAIGHT:
      return `Straight, ${topName(major)} high`;
    case THREE_OF_A_KIND:
      return `Three of a kind, ${plural(topName(major))}`;
    case TWO_PAIR:
      // x & -x keeps only the lowest set bit: the lower pair.
      return `Two pair, ${plural(topName(major))} and ${plural(topName(major & -major))}`;
    case PAIR:
      return `Pair of ${plural(topName(major))}`;
    default: {
      const name = topName(major);
      return `${name[0].toUpperCase()}${name.slice(1)} high`;
    }
  }
}
