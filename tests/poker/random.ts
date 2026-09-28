// A seeded random number generator (mulberry32), so the random tests deal the same cards every run.
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moves k random cards to the front of the deck with a partial Fisher-Yates shuffle and returns them. */
export function draw(deck: number[], k: number, random: () => number): number[] {
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, k);
}
