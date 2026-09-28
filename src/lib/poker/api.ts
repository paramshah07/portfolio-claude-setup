// What the site calls: card strings in, the equity readout's numbers out, every one of them exact.

import preflop from './preflop.json' with { type: 'json' };
import { cardPip, cardText, hiBit, loBit, parseCard, startingHand, unseen, words, type Card } from './cards.ts';
import { headsUp, versusRandom, type Tally } from './equity.ts';
import { categoryOf, evaluate, handName } from './evaluate.ts';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

/** Unseen cards that make the same hand, like "T♥, T♦ and T♣ make a straight, ace high". */
export interface OutGroup {
  makes: string; // "Straight, ace high"
  cards: string[]; // ["Th", "Td", "Tc"]
  text: string; // "T♥, T♦ and T♣ make a straight, ace high"
}

export interface EquityResult {
  street: Street;
  win: number; // shares of all matchups, 0 to 1
  tie: number;
  loss: number;
  equity: number; // win plus half the ties
  exact: true; // preflop is precomputed and every later street is enumerated
  matchups: number; // how many pairs of runout and opponent hand were counted
  hand: string; // the hero's made hand, like "Two pair, aces and kings"
  outs?: OutGroup[]; // on the flop and turn, strongest first
}

export const PREFLOP_COMMAND = 'node src/lib/poker/make-preflop.ts';

const STREETS: Record<number, Street> = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' };

/** Exact equity for two hole cards against one random hand on a board of 0, 3, 4 or 5 cards. */
export function computeEquity(hole: readonly string[], board: readonly string[]): EquityResult {
  return finish(equityJob(hole, board));
}

/** Exact equity for two hole cards against one known opponent hand, for when visitors pick the cards. */
export function computeHeadsUp(hole: readonly string[], opponent: readonly string[], board: readonly string[]): EquityResult {
  return finish(headsUpJob(hole, opponent, board));
}

/** computeEquity as a job the worker can pause between slices. */
export function* equityJob(hole: readonly string[], board: readonly string[]): Generator<void, EquityResult> {
  const [heroCards, boardCards] = read(hole, board);
  const tally = boardCards.length === 0 ? preflopTally(heroCards) : yield* versusRandom(heroCards, boardCards);
  const outs = boardCards.length === 3 || boardCards.length === 4 ? findOuts(heroCards, boardCards) : undefined;
  return result(heroCards, boardCards, tally, outs);
}

/** computeHeadsUp as a job the worker can pause between slices. */
export function* headsUpJob(hole: readonly string[], opponent: readonly string[], board: readonly string[]): Generator<void, EquityResult> {
  if (opponent.length !== 2) throw new Error('The opponent needs exactly two cards.');
  const [heroCards, boardCards, villainCards] = read(hole, board, opponent);
  return result(heroCards, boardCards, yield* headsUp(heroCards, villainCards, boardCards));
}

/** Runs a job straight through. The worker runs the same generators with a pause between slices. */
function finish<T>(job: Generator<void, T>): T {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}

/** Parses and checks the cards, which may come from a visitor. */
function read(hole: readonly string[], board: readonly string[], opponent: readonly string[] = []): Card[][] {
  if (hole.length !== 2) throw new Error('The hero needs exactly two hole cards.');
  if (![0, 3, 4, 5].includes(board.length)) throw new Error('A board has 0, 3, 4 or 5 cards.');
  const cards = [hole, board, opponent].map((group) => group.map(parseCard));
  const all = cards.flat();
  const twice = all.find((card, i) => all.indexOf(card) !== i);
  if (twice !== undefined) throw new Error(`${cardText(twice)} is dealt twice.`);
  return cards;
}

/** Preflop against a random hand comes from preflop.json, which make-preflop.ts wrote. */
function preflopTally(hole: Card[]): Tally {
  if (startingHand(hole) !== preflop.startingHand) {
    throw new Error(`Preflop equity is precomputed for ${preflop.startingHand} only. To change it, run ${PREFLOP_COMMAND}`);
  }
  return preflop;
}

function result(hole: Card[], board: Card[], tally: Tally, outs?: OutGroup[]): EquityResult {
  const matchups = tally.win + tally.tie + tally.loss;
  return {
    street: STREETS[board.length],
    win: tally.win / matchups,
    tie: tally.tie / matchups,
    loss: tally.loss / matchups,
    equity: (tally.win + tally.tie / 2) / matchups,
    exact: true,
    matchups,
    hand: handName(evaluate(...words([...hole, ...board]))),
    ...(outs && { outs }),
  };
}

// Whether a hand's name takes "a" after "makes", by category: "makes a flush" but "makes two pair".
const ARTICLE = ['', 'a ', '', '', 'a ', 'a ', 'a ', '', 'a '];

// British English lists have no Oxford comma: "T♥, T♦ and T♣".
const list = new Intl.ListFormat('en-GB', { type: 'conjunction' });

/**
 * Every unseen card that lifts the hero's hand by more categories than it lifts the board on its
 * own, grouped by what it makes, strongest first. On Q♠ J♠ 7♦ the Q♥ turns ace high into a pair
 * of queens, but it pairs the board for everyone, so it isn't an out. A card never lowers a hand,
 * so the board's lift is never negative.
 */
function findOuts(hole: Card[], board: Card[]): OutGroup[] {
  const [heroLo, heroHi] = words(hole);
  const [lo, hi] = words(board);
  const heroNow = categoryOf(evaluate(lo | heroLo, hi | heroHi));
  const boardNow = categoryOf(evaluate(lo, hi));

  const outs: { card: Card; value: number }[] = [];
  for (const card of unseen([...hole, ...board])) {
    const boardLo = lo | loBit(card);
    const boardHi = hi | hiBit(card);
    const value = evaluate(boardLo | heroLo, boardHi | heroHi);
    const boardLift = categoryOf(evaluate(boardLo, boardHi)) - boardNow;
    if (categoryOf(value) - heroNow > boardLift) outs.push({ card, value });
  }
  outs.sort((a, b) => b.value - a.value);

  // Strongest first, so each name first appears in the order of its best card.
  const groups = new Map<string, { category: number; cards: Card[] }>();
  for (const { card, value } of outs) {
    const makes = handName(value);
    const group = groups.get(makes) ?? { category: categoryOf(value), cards: [] };
    group.cards.push(card);
    groups.set(makes, group);
  }
  return [...groups].map(([makes, { category, cards }]) => ({
    makes,
    cards: cards.map(cardText),
    text: `${list.format(cards.map(cardPip))} ${cards.length === 1 ? 'makes' : 'make'} ${ARTICLE[category]}${makes[0].toLowerCase()}${makes.slice(1)}`,
  }));
}
