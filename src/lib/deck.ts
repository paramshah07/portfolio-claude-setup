// Cards are written as a rank and a suit: "As", "Td", "7h".
export const CARD = /^[2-9TJQKA][shdc]$/;
export const SUIT_OF = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const;
export const PIPS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;
export type Suit = keyof typeof PIPS;

type Dealt = { street: string; card: string };

// The two content rules that span entries, so zod can't check them per file.
// Throws a plain sentence, which fails the build with that message.
export function checkDeck(hole: readonly string[], board: readonly Dealt[]) {
  const count = (street: string) => board.filter((b) => b.street === street).length;
  const [flop, turn, river] = [count('flop'), count('turn'), count('river')];
  if (board.length !== 5 || flop !== 3 || turn !== 1 || river !== 1) {
    throw new Error(
      `The board needs three flop cards, one turn and one river. It has ${flop} flop, ${turn} turn and ${river} river across ${board.length} projects.`,
    );
  }

  const cards = [...hole, ...board.map((b) => b.card)];
  const bad = cards.find((c) => !CARD.test(c));
  if (bad) throw new Error(`"${bad}" isn't a card. Write cards as a rank and a suit, like "As" or "Td".`);
  const twice = cards.find((c, i) => cards.indexOf(c) !== i);
  if (twice) throw new Error(`${twice} is dealt twice. The two hole cards and the five board cards must all differ.`);
}
