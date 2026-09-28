// Param's exact preflop equity against one random hand, computed once and committed as
// preflop.json. Every five-card board from the 50 unseen cards (2,118,760) times every hand the
// opponent could hold from the 45 cards left (990) is 2,097,572,400 matchups. That's too many for
// a visitor's browser, so it runs here with a worker thread on every core.
//
// Run it from the repository root after changing the hole cards in content.md:
//   node src/lib/poker/make-preflop.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cardText, parseCard, startingHand, unseen, words, type Card } from './cards.ts';
import { deal, playBoard, toDeck, type Tally } from './equity.ts';
import { evaluate } from './evaluate.ts';

if (isMainThread) {
  const content = readFileSync(new URL('../../../content.md', import.meta.url), 'utf8');
  const holeLine = content.match(/^- hole: (\S+) (\S+)/m);
  if (!holeLine) throw new Error('content.md needs a line like "- hole: As Ks" under ## hand.');
  const hole = holeLine.slice(1).map(parseCard);

  // Slice the boards by their first two cards: 1,081 slices, small enough that every core stays
  // busy until the end. Each slice needs three more cards after its second one.
  const cards = unseen(hole).length;
  const slices: [number, number][] = [];
  for (let i = 0; i < cards; i++) for (let j = i + 1; j <= cards - 4; j++) slices.push([i, j]);

  const threads = availableParallelism();
  const total: Tally = { win: 0, tie: 0, loss: 0 };
  const started = performance.now();
  await Promise.all(
    Array.from({ length: threads }, () => {
      const worker = new Worker(new URL(import.meta.url), { workerData: hole });
      return new Promise<void>((resolve, reject) => {
        const next = () => {
          const slice = slices.shift();
          if (slice) worker.postMessage(slice);
          else worker.terminate().then(() => resolve());
        };
        worker.on('message', (tally: Tally) => {
          total.win += tally.win;
          total.tie += tally.tie;
          total.loss += tally.loss;
          next();
        });
        worker.on('error', reject);
        next();
      });
    }),
  );
  const seconds = (performance.now() - started) / 1000;

  const matchups = total.win + total.tie + total.loss;
  const result = { hole: hole.map(cardText), startingHand: startingHand(hole), matchups, ...total };
  writeFileSync(new URL('./preflop.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);

  const percent = (count: number) => `${((100 * count) / matchups).toFixed(3)}%`;
  console.log(`${result.hole.join(' ')} against one random hand, ${matchups.toLocaleString('en')} matchups`);
  console.log(`win ${percent(total.win)}, tie ${percent(total.tie)}, loss ${percent(total.loss)}, equity ${percent(total.win + total.tie / 2)}`);
  console.log(`${seconds.toFixed(1)} s on ${threads} threads, ${(matchups / seconds / 1e6).toFixed(0)} million matchups a second`);
  console.log('Wrote src/lib/poker/preflop.json');
} else {
  const hole = workerData as Card[];
  const deck = toDeck(unseen(hole));
  const [holeLo, holeHi] = words(hole);
  parentPort!.on('message', ([i, j]: [number, number]) => {
    // Every board whose first two cards are deck[i] and deck[j]: those two and any three after j.
    const tally: Tally = { win: 0, tie: 0, loss: 0 };
    deal(deck, 3, j + 1, deck.lo[i] | deck.lo[j], deck.hi[i] | deck.hi[j], (lo, hi) =>
      playBoard(lo, hi, evaluate(lo | holeLo, hi | holeHi), deck, tally),
    );
    parentPort!.postMessage(tally);
  });
}
