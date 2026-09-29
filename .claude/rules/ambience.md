---
paths:
  - "src/components/**"
  - "src/layouts/**"
  - "src/styles/**"
  - "src/pages/**"
---

# Ambience

## The room
A private card room in a members' lounge, late at night. Dark walnut walls, a backlit bottle shelf, framed abstract prints and a few leather chairs, all kept soft and out of focus. One oval poker table in green baize with a padded dark rail and brass cup holders sits under three warm pendant lamps. The table is the only sharp thing in the frame.

## Light
- Key light: the pendant lamps, warm (about 2700K, rendered as lamp #F2D3A2), pooling on the felt and falling off quickly toward the rail.
- Fill: almost none. Shadows stay deep and warm, never blue.
- Practicals: the bottle shelf and wall sconces show only as soft bokeh.
- Highlights appear only on brass, card stock sheen and chip edges. Nothing else glints.

## Lens and grade
- Feels like a 40mm lens at seated eye level, with shallow depth of field focused on the table.
- The background is always soft. Nothing in the room competes with the cards.
- Tone mapping: AgX. Grade: warm, slightly lifted shadows, creamy highlights. Blacks never drop below room #1B1009 and whites never pass cream #F3EEE2.
- A vignette on every view. Fine film grain at about 2% opacity; at 4% it speckles the cards and chip inlays. No lens flare, no chromatic aberration, no light leaks.

## Materials
- Felt: matte woven baize with a soft sheen at grazing angles and faint printed brass lines.
- Rail: dark padded leather in rail #3A3329 with a gentle specular roll-off.
- Cards: poker size (63 x 88 mm), cream card stock with a satin sheen, rounded corners, ornate backs from public/cards/back.png.
- Chips: matte clay, 39 mm, with spotted edge inserts and a printed center inlay. Colors: cream, panel black, felt green and card red.
- Brass: brushed, warm and soft-edged in its reflections.

## Typography
- EB Garamond for headings and body. Scale: display clamp(3rem, 7vw, 5.5rem), h2 2.75rem, h3 1.75rem, body 1.125rem with a 1.65 line height, small 0.875rem.
- IBM Plex Mono only inside HUD-style panels (stats, equity, performance, This Table), with tabular numbers.
- Body lines under 70 characters. Headings in sentence case, except the section names, which are proper names: The Deal, The Player, Hand History, The Board, The Table, Showdown.
- No single accented word in a headline, no all-caps labels, no eyebrow labels above headings.

## Motion
- Everything moves like a physical object with weight: cards slide with friction and settle, chips land with one small bounce. Nothing is elastic or springy.
- One orchestrated moment per view at most, and the hero deal is the big one. Section reveals stay quiet: a short rise and fade on the heading, then the content.
- Eases: power3.out for deals and slides, power2.inOut for camera moves, expo.out for card flips. Durations run from 0.35s to 1.2s, and scrubbed camera moves feel like 1.5s to 2.5s.
- Ambient motion is limited to a very slow lamp flicker (under 3% intensity) and, in phase 3, dust drifting through the lamp light. Nothing else loops.
- ScrollSmoother stays off on touch devices.
- Under prefers-reduced-motion: no camera moves, no deals, no smoothing. State changes become instant or a 150ms fade.

## Sound (phase 3)
Off by default. Close-miked and real: card snaps, slides and flips, clay chips clacking and stacking, a soft felt thud. A low room tone underneath. Never music.

## Cursor (phase 3)
A 20px brass-rimmed chip that tilts toward the direction of travel and grows slightly over interactive elements. Hidden on touch devices, under reduced motion and over text fields.

## What to avoid
Casino kitsch: neon, slot-machine gold, dollar signs, dice, roulette, confetti, "jackpot" language and anything from blackjack. The mood is a quiet private game, not a casino floor.
