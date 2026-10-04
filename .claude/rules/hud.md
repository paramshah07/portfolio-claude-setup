---
paths:
  - "src/components/hud/**"
  - "src/lib/poker/**"
  - "src/workers/**"
  - "tests/poker/**"
  - "src/integrations/**"
---

# HUD panels and poker math (phase 2)

All three panels share one look: a brass frame around panel #363430, a small title bar like the reference frames, cream text and IBM Plex Mono with tabular numbers. All of them are keyboard reachable and work with screen readers.

## Equity readout
The site's signature feature. As The Board deals, it shows how Param's hole cards (hand.hole in content) stand against one random opponent hand.

- It runs street by street: preflop, flop, turn and river. It starts preflop, and its button (Deal the flop, Deal the turn, Deal the river) deals one street at a time by writing the street store, which The Board's cards and the stage's deck follow. The button also asks for the hand, so the stage deals the hole cards first. It's gone once the river is out.
- A ladder keeps each street's equity as it lands, so the hand reads as a story.
- On a wide screen it runs as one strip under the board, so the cards, the numbers and the button fit on one screen. On a phone it stacks.
- Every street is exact. Preflop against a random hand is 2,097,572,400 matchups, too many for a visitor's browser, so node src/lib/poker/make-preflop.ts computes it once with a worker thread on every core and commits src/lib/poker/preflop.json. A test fails and prints that command if the hole cards in content.md stop matching it. Flop, turn and river use exact enumeration over every remaining runout and opponent hand.
- It shows win, tie and loss percentages, equity (wins plus half the ties), the current made hand in plain words ("Two pair, aces and kings") and whether the number is exact or estimated.
- The math runs in src/workers/equity.worker.ts with plain postMessage, so the main thread never blocks. Stale jobs are cancelled when the street changes.
- Numbers update with a short count-up. Under reduced motion they jump straight to the value.
- The readout is an aria-live polite region that announces only the final number for each street.

## Hand evaluator
- Lives in src/lib/poker as pure TypeScript with no dependencies: card parsing, the equity functions and a 5-card and 7-card evaluator that returns a comparable rank and a category.
- Param owns the evaluator's design. Before implementing it, propose an approach in a short note (for example rank counts with bitmask flush and straight detection, or a lookup table) and wait for his go-ahead. Comment the math so he can explain every line in an interview.
- Tests in tests/poker with Vitest, all passing before the readout ships:
  - Enumerating all 2,598,960 five-card hands yields exactly 7,462 distinct ranks.
  - Category counts across all five-card hands: 40 straight flushes, 624 four of a kinds, 3,744 full houses, 5,108 flushes, 10,200 straights, 54,912 three of a kinds, 123,552 two pairs, 1,098,240 pairs and 1,302,540 high cards.
  - The wheel (A-2-3-4-5) is the lowest straight and the lowest straight flush.
  - Kickers break ties correctly and identical ranks split the pot.
  - Pocket aces against one random hand come out near 85.2% preflop.
  - Exact and Monte Carlo results agree within the Monte Carlo interval on sampled flops.

## Performance HUD
- Toggled with the H key, the palette or the button on the stats panel. Off by default and costs nothing while hidden.
- Shows frame time (median and 95th percentile over the last second), fps, the DPR, the quality tier and five counters from renderer.info: draw calls, triangles, geometries, textures and shader programs.
- Updates four times a second. Written by hand, not taken from a library.

## This Table panel
A slide-over dialog explaining how the site is built, opened from the footer link or the palette.
- What you're looking at: two plain sentences.
- Architecture: an inline SVG diagram of the static Astro HTML, the islands, the stage, the equity worker and the shared stores.
- Performance: live numbers from the performance HUD plus bundle sizes from dist/build-stats.json, which an Astro integration hook writes at build time.
- The evaluator: its approach, its test counts and a link to the source.
- Source: a link to the repository.
