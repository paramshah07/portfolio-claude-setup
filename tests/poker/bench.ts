// Evaluator and equity benchmarks, on one thread. Run from the repository root:
//   node tests/poker/bench.ts

import { readFileSync } from 'node:fs';
import { computeEquity, computeHeadsUp } from '../../src/lib/poker/api.ts';
import { hiBit, loBit, unseen } from '../../src/lib/poker/cards.ts';
import { evaluate } from '../../src/lib/poker/evaluate.ts';

/** The median time of a few runs after one to warm up the JIT, in milliseconds. */
function time(run: () => void, runs = 7): number {
  run();
  const times = Array.from({ length: runs }, () => {
    const started = performance.now();
    run();
    return performance.now() - started;
  });
  return times.sort((a, b) => a - b)[runs >> 1];
}

// Every seven-card hand from nested loops. The first five cards are ORed together once per
// five-card prefix, so the innermost loop only ORs in the last two cards, evaluates and counts the
// category.
const deck = unseen([]);
const lo = Int32Array.from(deck, loBit);
const hi = Int32Array.from(deck, hiBit);
const counts = Array<number>(9).fill(0);
function everySevenCardHand() {
  counts.fill(0);
  for (let a = 0; a < 46; a++) {
    for (let b = a + 1; b < 47; b++) {
      for (let c = b + 1; c < 48; c++) {
        for (let d = c + 1; d < 49; d++) {
          for (let e = d + 1; e < 50; e++) {
            const lo5 = lo[a] | lo[b] | lo[c] | lo[d] | lo[e];
            const hi5 = hi[a] | hi[b] | hi[c] | hi[d] | hi[e];
            for (let f = e + 1; f < 51; f++) {
              for (let g = f + 1; g < 52; g++) counts[evaluate(lo5 | lo[f] | lo[g], hi5 | hi[f] | hi[g]) >>> 26]++;
            }
          }
        }
      }
    }
  }
}

const hands = 133_784_560;
const published = [23_294_460, 58_627_800, 31_433_400, 6_461_620, 6_180_020, 4_047_644, 3_473_184, 224_848, 41_584];
const allHands = time(everySevenCardHand, 3);
const matches = counts.every((count, category) => count === published[category]);
console.log(`All ${hands.toLocaleString('en')} seven-card hands: ${(allHands / 1000).toFixed(2)} s, ${(hands / allHands / 1000).toFixed(1)} million evaluations a second`);
console.log(`Category counts ${matches ? 'match' : 'DO NOT match'} the published table`);

// Param's hand from content.md, read the way make-preflop.ts reads it: the hole cards, then the
// board from the project headings, flop first, then the turn and the river.
const content = readFileSync(new URL('../../content.md', import.meta.url), 'utf8');
const hole = content.match(/^- hole: (\S+) (\S+)/m)!.slice(1);
const dealt = [...content.matchAll(/^### (flop|turn|river): (\S+)/gm)];
const board = ['flop', 'turn', 'river'].flatMap((street) => dealt.filter((m) => m[1] === street).map((m) => m[2]));

// Preflop is a lookup. make-preflop.ts computes preflop.json once and prints its own time.
const preflop = time(() => computeEquity(hole, []), 25);
console.log(`Preflop ${hole.join(' ')} against a random hand, looked up in preflop.json: ${preflop.toFixed(3)} ms`);

// Every later street scores the hero once per runout and the opponent once per matchup. Each
// runout leaves the same 45 cards, so it faces C(45, 2) = 990 opponent hands and the number of
// runouts is matchups / 990.
for (const [street, cards] of [['Flop', 3], ['Turn', 4], ['River', 5]] as const) {
  const shown = board.slice(0, cards);
  const evaluations = computeEquity(hole, shown).matchups * (1 + 1 / 990);
  const ms = time(() => computeEquity(hole, shown), 25);
  const outs = cards < 5 ? ', outs included' : '';
  console.log(`${street} ${shown.join(' ')} against a random hand${outs}: ${ms.toFixed(2)} ms, ${(evaluations / ms / 1000).toFixed(1)} million evaluations a second`);
}
const headsUp = time(() => computeHeadsUp(['As', 'Ah'], ['Kd', 'Kc'], []));
console.log(`Preflop heads-up, 1,712,304 boards: ${headsUp.toFixed(0)} ms, ${((2 * 1_712_304) / headsUp / 1000).toFixed(1)} million evaluations a second`);
