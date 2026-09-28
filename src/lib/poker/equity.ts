// Exact equity by enumeration. Every way the board can finish is dealt once. On each finished
// board the hero's hand is scored once, then compared with every hand the opponent could hold.

import { hiBit, loBit, unseen, words, type Card } from './cards.ts';
import { evaluate } from './evaluate.ts';

export interface Tally {
  win: number;
  tie: number;
  loss: number;
}

/** Cards still in the deck, as parallel arrays of their bits, ready to OR into a hand. */
export interface Deck {
  lo: Int32Array;
  hi: Int32Array;
}

export const toDeck = (cards: readonly Card[]): Deck => ({
  lo: Int32Array.from(cards, loBit),
  hi: Int32Array.from(cards, hiBit),
});

type Visit = (lo: number, hi: number) => void;

/** Calls visit once for every k-card combination of the deck from index `from` on, ORed into lo and hi. */
export function deal(deck: Deck, k: number, from: number, lo: number, hi: number, visit: Visit): void {
  if (k === 0) return visit(lo, hi);
  for (let i = from; i <= deck.lo.length - k; i++) {
    deal(deck, k - 1, i + 1, lo | deck.lo[i], hi | deck.hi[i], visit);
  }
}

/**
 * Plays the hero's hand, already scored as `hero`, against every two cards left in the deck on
 * one complete board. The board's words are built once and each opponent hand only ORs in two
 * more bits. Cards already on the board are skipped with the same kind of bit test.
 */
export function playBoard(lo: number, hi: number, hero: number, deck: Deck, tally: Tally): void {
  const deckLo = deck.lo;
  const deckHi = deck.hi;
  const n = deckLo.length;
  let win = 0;
  let tie = 0;
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const lo1 = deckLo[i];
    const hi1 = deckHi[i];
    if ((lo1 & lo) | (hi1 & hi)) continue;
    for (let j = i + 1; j < n; j++) {
      const lo2 = deckLo[j];
      const hi2 = deckHi[j];
      if ((lo2 & lo) | (hi2 & hi)) continue;
      const villain = evaluate(lo | lo1 | lo2, hi | hi1 | hi2);
      if (hero > villain) win++;
      else if (hero === villain) tie++;
      else loss++;
    }
  }
  tally.win += win;
  tally.tie += tie;
  tally.loss += loss;
}

/**
 * Deals every way to finish the board, in slices by the first card dealt. It pauses after each
 * slice, so the worker can check for a newer job between slices and drop this one.
 */
function* runouts(deck: Deck, k: number, lo: number, hi: number, visit: Visit): Generator<void, void> {
  if (k === 0) return visit(lo, hi);
  for (let i = 0; i <= deck.lo.length - k; i++) {
    deal(deck, k - 1, i + 1, lo | deck.lo[i], hi | deck.hi[i], visit);
    yield;
  }
}

/** The hero against one random hand: every runout, and on each one every hand the opponent could hold. */
export function* versusRandom(hole: readonly Card[], board: readonly Card[]): Generator<void, Tally> {
  const tally = { win: 0, tie: 0, loss: 0 };
  const deck = toDeck(unseen([...hole, ...board]));
  const [holeLo, holeHi] = words(hole);
  const [lo, hi] = words(board);
  yield* runouts(deck, 5 - board.length, lo, hi, (lo, hi) =>
    playBoard(lo, hi, evaluate(lo | holeLo, hi | holeHi), deck, tally),
  );
  return tally;
}

/** The hero against one known hand: every runout. */
export function* headsUp(hole: readonly Card[], opponent: readonly Card[], board: readonly Card[]): Generator<void, Tally> {
  const tally = { win: 0, tie: 0, loss: 0 };
  const deck = toDeck(unseen([...hole, ...opponent, ...board]));
  const [heroLo, heroHi] = words(hole);
  const [villainLo, villainHi] = words(opponent);
  const [lo, hi] = words(board);
  yield* runouts(deck, 5 - board.length, lo, hi, (lo, hi) => {
    const hero = evaluate(lo | heroLo, hi | heroHi);
    const villain = evaluate(lo | villainLo, hi | villainHi);
    if (hero > villain) tally.win++;
    else if (hero === villain) tally.tie++;
    else tally.loss++;
  });
  return tally;
}
