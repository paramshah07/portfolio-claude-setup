// Cards as numbers and hands as bits.
//
// A card is one number, suit * 16 + rank, with ranks 0 to 12 for 2 to A and suits 0 to 3 for
// spades, hearts, diamonds and clubs. That number is also the card's bit in a 64-bit hand made of
// four 16-bit lanes, one per suit, each holding a 13-bit mask of the ranks in that suit.
// JavaScript's bitwise operators work on 32 bits, so a hand travels as two words:
//
//        hi                              lo
//   [ clubs   | diamonds ]          [ hearts  | spades  ]
//     bits 16-28  bits 0-12           bits 16-28  bits 0-12
//
//   each lane:  A K Q J T 9 8 7 6 5 4 3 2    the deuce is bit 0, the ace bit 12
//
// So As is card 12 (bit 12 of lo), Kh is card 27 (bit 27 of lo) and 2d is card 32 (bit 0 of hi).

import { CARD, PIPS, SUIT_OF } from '../deck.ts';

export type Card = number;

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';

/** Reads a card written like "As" or "Td". */
export function parseCard(text: string): Card {
  if (!CARD.test(text)) throw new Error(`"${text}" isn't a card. Write cards as a rank and a suit, like "As" or "Td".`);
  return SUITS.indexOf(text[1]) * 16 + RANKS.indexOf(text[0]);
}

/** Reads cards separated by spaces, like "As Ks". */
export const parseCards = (text: string): Card[] => text.trim().split(/\s+/).map(parseCard);

/** The card as it's written in content.md: "Ts". */
export const cardText = (card: Card) => RANKS[card & 15] + SUITS[card >> 4];

/** The card as the readout shows it: "T♠". */
export const cardPip = (card: Card) => RANKS[card & 15] + PIPS[SUIT_OF[SUITS[card >> 4] as keyof typeof SUIT_OF]];

/** The card's bit in the low word (spades and hearts), or 0. */
export const loBit = (card: Card) => (card < 32 ? 1 << card : 0);

/** The card's bit in the high word (diamonds and clubs), or 0. */
export const hiBit = (card: Card) => (card < 32 ? 0 : 1 << (card - 32));

/** The two words of a hand holding these cards. */
export function words(cards: readonly Card[]): [lo: number, hi: number] {
  let lo = 0;
  let hi = 0;
  for (const card of cards) {
    lo |= loBit(card);
    hi |= hiBit(card);
  }
  return [lo, hi];
}

/** Every card that isn't in seen, in suit then rank order. */
export function unseen(seen: readonly Card[]): Card[] {
  const cards: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      if (!seen.includes(suit * 16 + rank)) cards.push(suit * 16 + rank);
    }
  }
  return cards;
}

/**
 * The starting hand two hole cards belong to: "AKs", "AKo" or "AA". Relabelling suits changes no
 * result, so As Ks and Ah Kh have the same equity and share one entry.
 */
export function startingHand(hole: readonly Card[]): string {
  const [high, low] = (hole[0] & 15) >= (hole[1] & 15) ? hole : [hole[1], hole[0]];
  const name = RANKS[high & 15] + RANKS[low & 15];
  if ((high & 15) === (low & 15)) return name;
  return name + (high >> 4 === low >> 4 ? 's' : 'o');
}
