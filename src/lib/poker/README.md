# The hand evaluator and equity engine

Up to seven cards in, one integer out. The higher integer wins and equal integers split the pot. There's no lookup table and no loop over ranks: everything is ANDs, ORs and shifts on four 13-bit masks. On one thread it scores 75 million seven-card hands a second. That's fast enough to play the flop against every hand an opponent could hold (1,070,190 matchups) in 14 ms, so every equity number on the site is exact.

| File | What it holds |
|---|---|
| cards.ts | Cards as numbers, hands as two 32-bit words and parsing |
| evaluate.ts | evaluate, evaluate5, evaluate7 and handName |
| equity.ts | The enumeration: every runout, every opponent hand |
| api.ts | computeEquity, computeHeadsUp and the outs, which is what the site calls |
| make-preflop.ts | The one-off script behind preflop.json |
| preflop.json | Param's exact preflop counts |
| src/workers/equity.worker.ts | Runs the jobs off the main thread |

The tests are in tests/poker, and `node tests/poker/bench.ts` reproduces the benchmarks.

## A card is a bit

A card is one number, `suit * 16 + rank`, with ranks 0 to 12 for 2 to A and suits 0 to 3 for ♠ ♥ ♦ ♣. That number is also the card's position in a 64-bit hand made of four 16-bit lanes, one per suit:

```
         hi (32 bits)                    lo (32 bits)
  [ clubs     | diamonds  ]       [ hearts    | spades    ]
    bits 16-28  bits 0-12           bits 16-28  bits 0-12

  each lane:  A K Q J T 9 8 7 6 5 4 3 2     the deuce is the lowest bit
```

A♠ is card 12, bit 12 of `lo`. K♥ is card 27. A set of cards is the OR of their bits, so a seven-card hand is just two numbers. The hand is split into two words because JavaScript's bitwise operators work on 32 bits.

## Pairs, trips and quads without counting

Take A♠ K♠ A♥ 7♥ A♦ 2♦ K♣. Each suit's lane is a 13-bit mask:

```
                          A K Q J T 9 8 7 6 5 4 3 2
s  spades                 1 1 . . . . . . . . . . .    A♠ K♠
h  hearts                 1 . . . . . . 1 . . . . .    A♥ 7♥
d  diamonds               1 . . . . . . . . . . . 1    A♦ 2♦
c  clubs                  . 1 . . . . . . . . . . .    K♣

s | h | d | c             1 1 . . . . . 1 . . . . 1    held at least once
(s & h) | (d & c)
  | ((s | h) & (d | c))   1 1 . . . . . . . . . . .    at least twice
(s & h & (d | c))
  | (d & c & (s | h))     1 . . . . . . . . . . . .    at least three times
s & h & d & c             . . . . . . . . . . . . .    four times
```

Aces three times and kings twice: a full house, aces full of kings.

Put the suits in two teams, spades with hearts and diamonds with clubs. Two cards of one rank are either both in one team (`s & h` or `d & c`) or one in each (`(s | h) & (d | c)`). Three cards can't spread over two teams of two without filling one, so three of a rank means one team holds it twice and the other at least once. Each line is a few ANDs and ORs, and it answers the question for all thirteen ranks at once.

## Straights by shifting

Copy the ace below the deuce, `(ranks << 1) | (ranks >>> 12)`, then AND the mask with itself shifted up by 1, 2, 3 and 4. Here is Param's river, A K Q J T 7 2:

```
               A K Q J T 9 8 7 6 5 4 3 2 A
r              1 1 1 1 1 . . 1 . . . . 1 1
r << 1         1 1 1 1 . . 1 . . . . 1 1 .
r << 2         1 1 1 . . 1 . . . . 1 1 . .
r << 3         1 1 . . 1 . . . . 1 1 . . .
r << 4         1 . . 1 . . . . 1 1 . . . .
AND            1 . . . . . . . . . . . . .    ace high: T J Q K A
```

Column i of `r << k` holds bit i - k of `r`, so a bit survives the AND only where `r` had it and the four bits below it: five in a row with that bit on top. The highest survivor is the best straight's top card, and shifting it down one place turns it back into a 13-bit rank. For A-2-3-4-5 the copied ace completes the run under the five, so the wheel's top card is the five, which makes it the lowest straight.

## Flushes and straight flushes

A flush is a suit mask with five or more bits. `popcount` adds bits in parallel, pairs then nibbles then bytes, so checking four suits takes a few dozen operations and no loop. Seven cards can't make two flushes, so the first suit with five is the flush. The same shift test on that one suit's mask finds a straight flush, the steel wheel included.

## One integer per hand

```
 29    26 25                      13 12                         0
[category][ ranks that make the hand ][          kickers           ]
```

| Category | Bits 26 to 29 | Bits 13 to 25 | Bits 0 to 12 |
|---|---|---|---|
| Straight flush | 8 | top card | |
| Four of a kind | 7 | the quads | one kicker |
| Full house | 6 | the trips | the pair |
| Flush | 5 | all five cards | |
| Straight | 4 | top card | |
| Three of a kind | 3 | the trips | two kickers |
| Two pair | 2 | both pairs | one kicker |
| Pair | 1 | the pair | three kickers |
| High card | 0 | all five cards | |

A♠ A♦ K♠ K♦ Q♣ is two pair, aces and kings, with a queen kicker:

```
0010  1100000000000  0010000000000   =  184,550,400
two   A K            Q
pair
```

A higher card is always a higher bit and a more important field always sits higher, so hand A beats hand B exactly when its value is larger, and equal values split. Two masks with the same number of bits compare the way you'd read the cards from the top down: A-K-Q-7-4 and A-K-Q-7-3 first differ at the four, and only the first hand has that bit. Values run from 385,024 (7-5-4-3-2) to 570,425,344 (a royal flush), below 2^30, so V8 keeps them as small integers.

## The best five of seven in one pass

`evaluate` checks the categories from the strongest down and returns at the first one the hand makes. Each category keeps only the bits it needs: `keepHighest` clears the lowest set bit, `x & (x - 1)`, until k are left. That picks the best five cards directly, so seven cards cost one evaluation instead of 21. The order never hides a better hand, because seven cards can't make a flush together with a full house or quads: a full house needs at least three cards outside the flush suit, and quads need three, but a flush leaves only two.

## Equity: counting every matchup

Equity against one random hand is exact. Every way to finish the board is dealt once. Each finished board builds its words once and scores Param's hand once, and each opponent hand only ORs in two more bits:

```
for each runout:                                   1,081 on the flop
  board  = board | runout                          built once
  hero   = evaluate(board | hole)                  scored once
  for each pair i < j of unseen cards not on the board:      990
    villain = evaluate(board | card i | card j)
    count a win, a tie or a loss
```

Equity is wins plus half the ties, as a share of all matchups.

| Street | Runouts | Opponent hands | Matchups | Time |
|---|---|---|---|---|
| Preflop | C(50,5) = 2,118,760 | C(45,2) = 990 | 2,097,572,400 | 3.3 s on 12 threads, once |
| Flop | C(47,2) = 1,081 | 990 | 1,070,190 | 14 ms |
| Turn | 46 | 990 | 45,540 | 0.6 ms |
| River | 1 | 990 | 990 | 0.02 ms |

Against one known hand, `computeHeadsUp` enumerates only the board: 1,712,304 boards preflop (55 ms), 990 on the flop, 44 on the turn and 1 on the river. It's there for when visitors pick their own cards.

## Preflop, computed once

2,097,572,400 matchups would take about 28 seconds on one core of this laptop, and longer on a phone, so `make-preflop.ts` runs them once with a worker thread on every core. It slices the boards by their first two cards into 1,081 pieces, hands a piece to each thread as it frees up and adds up the counts. On an Apple M4 Pro with 12 threads it takes 3.3 s, 636 million matchups a second. Relabelling suits changes no result, so the file is keyed by starting hand (72o) and serves any offsuit seven-deuce. If the hole cards in content.md change to a different starting hand, a test fails and prints the command to rerun:

```
node src/lib/poker/make-preflop.ts
```

Node 22.18 and later run TypeScript directly, so the script needs no build step.

## Outs

On the flop and turn the readout lists every unseen card that improves Param's hand, grouped by what it makes, strongest first. An out has to lift Param's hand by more categories than it lifts the board on its own. On Q♠ J♠ 7♦ the Q♥ turns ace high into a pair of queens, but everyone gets that pair, so it isn't an out. The rule looks only at categories, so a card that just improves a kicker or turns a straight into a higher straight isn't listed.

## Param's hand, street by street

7♥ 2♠ against one random hand, dealt the board from content.md:

| Street | Board | Param holds | Win | Tie | Loss | Equity | Matchups |
|---|---|---|---|---|---|---|---|
| Preflop | | Seven high | 31.710% | 5.747% | 62.543% | 34.584% | 2,097,572,400 |
| Flop | K♣ Q♦ 7♦ | Pair of sevens | 57.116% | 4.477% | 38.407% | 59.354% | 1,070,190 |
| Turn | K♣ Q♦ 7♦ 2♣ | Two pair, sevens and twos | 86.994% | 1.212% | 11.794% | 87.600% | 45,540 |
| River | K♣ Q♦ 7♦ 2♣ 7♣ | Full house, sevens full of twos | 98.586% | 0.202% | 1.212% | 98.687% | 990 |

Preflop, seven-deuce offsuit is the worst starting hand in hold'em: it wins about one hand in three. The flop pairs the seven, and five cards improve it further, so equity climbs to 59%:

- 7♠ and 7♣ make three of a kind, sevens
- 2♥, 2♦ and 2♣ make two pair, sevens and twos

A king or a queen isn't an out: it pairs the board, and everyone gets that pair. The 2♣ on the turn makes two pair and lifts equity to 88%, with four cards left that fill it up: 7♠ and 7♣ for sevens full, 2♥ and 2♦ for twos full. The river is the 7♣, sevens full of twos. Of the 990 hands left, only twelve beat it: pocket kings or queens (three each) for a bigger full house, and the last seven with a king or a queen (three each). The last seven with a two splits (two hands).

## Benchmarks

Apple M4 Pro, Node 22.20, one thread unless noted, from `node tests/poker/bench.ts`, which reads Param's hand from content.md. The 12-thread row is from `node src/lib/poker/make-preflop.ts`:

| What | Time | Rate |
|---|---|---|
| All 133,784,560 seven-card hands | 1.77 s | 75.4 million evaluations a second |
| Preflop against a random hand, looked up in preflop.json | 0.003 ms | |
| Flop against a random hand, outs included | 14 ms | 76.8 million evaluations a second |
| Turn against a random hand, outs included | 0.57 ms | |
| River against a random hand | 0.02 ms | |
| Preflop heads-up, 1,712,304 boards | 55 ms | 61.8 million evaluations a second |
| Preflop against a random hand, 12 threads | 3.3 s | 636 million matchups a second |

In Chrome the worker's first flop took 31 ms, JIT warm-up included. The worker bundle is 5.2 KB (2.6 KB gzipped) with the evaluator and preflop.json inside.

## Tests

`npm test` runs these in tests/poker in under a second:

- All 2,598,960 five-card hands give exactly 7,462 distinct values and the textbook category counts, from 40 straight flushes to 1,302,540 high cards.
- The wheel is the lowest straight and the lowest straight flush.
- Kickers break ties, identical hands split and suits never break a tie.
- evaluate7 matches the best of its 21 five-card subsets on 100,000 random hands.
- Every street counts the right number of matchups, and preflop.json's counts add up to 2,097,572,400.
- preflop.json matches the hole cards in content.md, or the test prints the command to rerun.
- Monte Carlo agrees with preflop.json within its 95% interval and puts pocket aces near 85.2% against a random hand. Exact and Monte Carlo also agree on five sampled flops, using 99% intervals so that all five pass by chance 95% of the time, like one 95% comparison. Seeds are fixed, so every run deals the same cards.
- Pocket aces against pocket kings come out near 82%: 81.3% against K♦ K♣ and 82.6% against K♠ K♥.
- Param's flop has the 18 outs listed above, and a card that improves every hand alike isn't one.
- Bad input is rejected, and the worker drops a job when a newer one arrives.

The benchmark also checks all 133,784,560 seven-card hands against the published category counts.

## Ten questions an interviewer might ask

**1. Why four suit masks instead of counting ranks?**
Counting needs a loop over the cards and 13 counters, then more loops to find pairs and straights. With one 13-bit mask per suit, a few ANDs and ORs answer "which ranks appear at least twice" for all thirteen ranks at once. The straight test is five shifted ANDs and a flush is one popcount per suit. There's no table to build, load or keep in cache.

**2. Prove the three-of-a-kind formula.**
It's `(s & h & (d | c)) | (d & c & (s | h))`. Each term needs a rank in three different suits, so everything it keeps is held three times. The other way round, three suits drawn from the teams {s, h} and {d, c} must include both suits of one team, by pigeonhole, plus a suit from the other team. That's exactly one of the two terms.

**3. How does the wheel work, and why is it the lowest straight?**
The ace is copied into a new bit below the deuce, so A-2-3-4-5 becomes five bits in a row with the five on top. A straight's value keeps only its top card, and a five is lower than the six on top of the next straight up. The test finds the lowest straight and straight flush among all 2,598,960 hands and checks that both are wheels.

**4. Why does one integer comparison decide the winner?**
The fields are ordered by importance, and inside each field a higher rank is a higher bit. Comparing two integers finds the highest bit where they differ: the category first, then the ranks that make the hand, then the kickers, which is the order poker's rules use. Masks with the same number of bits compare like ranks read from the top down. The trap is the full house: threes full of twos must beat twos full of aces, so the pair gets the low field to itself instead of sharing a mask with the trips.

**5. Seven cards hold 21 five-card hands. Why score only one?**
The categories are checked strongest first and each keeps only the bits it needs, which is the best five directly. Seven cards can't make a flush together with a full house or quads, so checking in order never hides a better hand. evaluate7 matches the best of its 21 subsets on 100,000 random hands, and the benchmark reproduces the published category counts for all 133,784,560 seven-card hands.

**6. How do you know the numbers are right?**
In layers. The five-card census gives 7,462 distinct values and the textbook counts. The seven-card census matches the published table. evaluate7 agrees with a brute-force best of 21, and Monte Carlo agrees with the exact numbers. The results match published equities too: seven-deuce offsuit against a random hand is 34.58%, ace-king suited 67.04% and pocket aces 85.2%. And the tests catch breakage: deleting either half of the three-of-a-kind formula fails six or eight of the 22.

**7. Why precompute preflop but enumerate the flop live?**
Preflop against a random hand is 2,097,572,400 matchups: about 28 seconds on one laptop core, 3.3 s on all 12. The flop is 1,070,190, which takes 14 ms. The preflop answer only changes when the hole cards do, so it's computed once and keyed by starting hand, and a test keeps it from going stale.

**8. How do you cancel a stale job without SharedArrayBuffer?**
The enumeration is a generator that yields after each slice of runouts, 46 slices on the flop. After each slice the worker pauses through a MessageChannel, which lets any newer message run first, then checks whether its job is still the latest and stops if it isn't. setTimeout(0) would be clamped to 4 ms after a few nested calls, and terminating the worker would throw away its warmed-up JIT. The page also ignores any answer whose id isn't the latest.

**9. What counts as an out?**
A card that lifts Param's hand by more categories than it lifts the board alone. On K♣ Q♦ 7♦ the K♥ gives Param two pair, kings and sevens, but it pairs the board, so everyone climbs the same one category and it isn't an out. With A♠ K♠ on A♦ 7♣ 2♥, a seven gives two pair to every hand with a pair, so it isn't one either. The rule only looks at categories, so a better kicker or a higher straight isn't listed.

**10. How would you make it faster?**
With 7♥ 2♠ the two suits Param doesn't hold are interchangeable, so many runouts and opponent hands come in pairs that share one answer, and suit isomorphism could skip one of each. A suited hand like A♠ K♠ leaves three interchangeable suits and groups of up to six. The inner loop could also update the board's rank masks for the opponent's two cards instead of rebuilding them. A seven-card lookup table like the Two Plus Two evaluator is faster still, but it's about 130 MB, far too big to ship to a browser. One idea that didn't work: counting two suits per 32-bit word in one popcount pass ran 9% slower in V8, so the plain version stayed.
