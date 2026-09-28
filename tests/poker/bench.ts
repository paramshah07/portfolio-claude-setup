// Evaluator and equity benchmarks, on one thread. Run from the repository root:
//   node tests/poker/bench.ts

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

// Every seven-card hand, dealt with nested loops so each level ORs in one more card and the
// innermost loop does nothing but evaluate.
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

const hole = ['As', 'Ks'];
const streets = [
  ['Flop', ['Qs', 'Js', '7d'], 1_070_190 + 1_081],
  ['Turn', ['Qs', 'Js', '7d', '2c'], 45_540 + 46],
  ['River', ['Qs', 'Js', '7d', '2c', 'Ts'], 990 + 1],
] as const;
for (const [street, board, evaluations] of streets) {
  const ms = time(() => computeEquity(hole, board), 25);
  console.log(`${street} against a random hand, outs included: ${ms.toFixed(2)} ms, ${(evaluations / ms / 1000).toFixed(1)} million evaluations a second`);
}
const headsUp = time(() => computeHeadsUp(['As', 'Ah'], ['Kd', 'Kc'], []));
console.log(`Preflop heads-up, 1,712,304 boards: ${headsUp.toFixed(0)} ms, ${((2 * 1_712_304) / headsUp / 1000).toFixed(1)} million evaluations a second`);
