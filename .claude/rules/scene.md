---
paths:
  - "src/components/scene/**"
  - "scripts/make-depth.mjs"
  - "scripts/make-card-faces.mjs"
---

# 3D stage

One persistent React Three Fiber canvas (the Stage island) fixed behind the page. The page drives it through the nanostores in src/lib/state: scroll progress, active section and quality tier. The stage never owns content.

## Loading and lifecycle
- Mount after the hero plate has loaded and the browser is idle. Until then the plate is a plain HTML image.
- Crossfade from the HTML plate to the stage once the first frame renders.
- Set frameloop to "never" when the stage is offscreen or the tab is hidden, and back to "always" on return.
- On WebGL context loss or a failed load, fall back to the static tier without showing an error.

## Room
- Phases 1 and 2: the hero plate on a large subdivided plane (256 x 144 segments) behind the table, displaced by public/plates/depth.png. Pointer parallax of up to 2 degrees and a small scroll dolly. Keep camera moves small enough that edges don't smear, and let the depth of field hide the rest.
- scripts/make-depth.mjs creates depth.png from the hero plate with onnx-community/depth-anything-v2-small through @huggingface/transformers.
- Phase 3: on the high tier, replace the plate with the Marble world (public/splats/room-500k.spz, or room-100k.spz on medium) rendered with Spark and converted to metric scale with the world's semantics metadata. The plate stays as the fallback.

## Table (phase 2)
- scripts/make-table.py models the table in Blender (run headless) and exports public/models/table.glb with meshopt compression. It's a stadium about 2.4 x 1.2 m with the felt at y = 0, and the file carries geometry and UVs in metres, with its materials named felt, leather, walnut and brass for the scene to replace.
- Felt: MeshPhysicalMaterial, roughness 0.9, sheen 1 with a lighter sheen color and a sheen roughness of 0.8, and the normal map of TextureCan's snooker baize (CC0). Its albedo is a deeper green than the felt token, because the warm grade pulls green toward olive, and it renders as the reference's baize.
- Printed lines: a canvas-drawn brass decal at low opacity for the betting line and the dealer position.
- Rail: a padded leather roll swept around the felt in panels that join between the seats, in rail #3A3329 with Poly Haven's smooth leather normal map (CC0) and a soft clearcoat. A walnut apron under it. Brass cup holders sit in real holes through the rail between the seats.
- Loaded with three's own GLTFLoader and meshopt decoder, so nothing comes from a CDN.

## Cards
- Poker size, 0.063 x 0.088 in world units, 0.3 mm thick with 3.2 mm rounded corners, all real geometry from objects/card.ts. Rows run the length of the card, dense enough for the morph targets: the bend along its long axis, then the peel, which curls the near end up from a fold 58 mm back to nearly upright, so the index in the face's near left corner reads from the seat. The peel is baked in six steps at evenly spaced curvatures and blended between neighbours, so the motion follows the curl.
- scripts/make-card-faces.mjs sets the faces from Adrian Kennard's CC0 deck in scripts/cards/kennard (courts traced from Goodall & Son, recoloured to the tokens), with EB Garamond indices from scripts/cards/ranks.json, and packs them with public/cards/back.png into one atlas.
- Material: MeshStandardMaterial on cream card stock, roughness 0.42 for the satin sheen. No clearcoat and no paper normal map: at the table's distances both read as glare and grain.
- A full deck of 52. Only the cards content deals have faces; every other card is a back on both sides, so no card label shows that isn't on the page.
- The deal waits until the visitor asks for the hand (the handDealt store, set by the hero's button, a click on its table or the equity readout's button). Then half the deck springs off the top card by card, flexed, arcs over under gravity and lands face down in a ribbon spread, then zips back onto the deck. The hole cards slide to the player's seat face down, the first onto the second, 17 mm to its left and 6 mm back, as a player squares them to look, and wait there (the holeCards store goes from deck to down). While the pointer is over them, or the hero's button for them is hovered or focused (the peek store), the player lifts the near end of both together, the card underneath curling 3% less so the top one stays inside its curl. The stage takes no pointer events, so the deck hit-tests the window's pointer against the room the cards take up lying down and squeezed, which a squeeze never moves them out of. When the page turns the store to up, they're laid down, spread and turned face up on a timeline of their own, so the board's streets never wait for it. The board cards on the table deal as the readout's button writes the street store, a burn card before each street.

## Chips (phase 2)
- scripts/make-chip.py models the chip in Blender (run headless) and exports public/models/chip.glb with meshopt compression. It follows a Paulson card-suits mould, 39 mm across and 3.3 mm thick, with every part geometry and nothing painted on:
  - a clay body with a rounded rim, so stacks show a dark seam between chips
  - eight edge spots of a second clay, cut through the chip with booleans
  - the four suits embossed round the band between the spots
  - a label disc set 0.3 mm into each face, carrying a brass foil ring
- The parts are separate meshes (body, inserts, label, ring). The scene draws each as one instanced mesh for every chip on the table, colouring the body and spots per chip, a few percent lighter or darker per chip as clay batches are.
- Labels use drei Text on the label disc and always have a DOM twin.
- Colours: cream with card-red spots, then panel, felt and card red with cream spots.
- Phase 3: @react-three/rapier, loaded on the first chip interaction, lets visitors flick chips. Bodies sleep once they settle.

## Light
- drei Environment with a warm interior HDRI from Poly Haven at low intensity, used for reflections only.
- Three Lightformers above the table standing in for the pendant lamps, in lamp #F2D3A2.
- One warm spot light as the key, with soft shadows on the high tier. Static objects use AccumulativeShadows baked once. Moving cards and chips use ContactShadows.
- The blinds: a low, warm spot light from behind the player's left shoulder with a slatted cookie in its map, so soft bands of light cross the felt as in reference/hero-16x9.jpg and the camera side of the chips and cards is lit. A spot light's map only projects while it casts shadows, so the low tier goes without.
- A very slow lamp flicker under 3% intensity.
- A fill: a narrow, soft spot light from the camera on the hole cards, at zero except in the squeeze, where their faces turn toward the player and away from the lamps.
- Phase 3: a few hundred dust particles drifting slowly through the lamp light, high tier only.

## Lens and post
- @react-three/postprocessing: DepthOfField at half resolution focused on the table surface (at a quarter its edges step in blocks), with a focus range of 1.1 m so the whole table is sharp and the room soft, Bloom with a high threshold so only lamps and brass highlights glow, and a LUT for the warm grade, with AgX tone mapping. The vignette and 2% grain are a CSS overlay (rig/Lens.astro) that every tier shares.
- Camera: about a 40mm equivalent, a field of view around 45 degrees.

## The deal's shots
The deck moves four weights in layout.ts (dealShot) that the camera blends toward, each over the ones before it, handing back to the scroll path over the first 15% of the page:
- Open: once the stage shows, the camera eases up from the plate's low seat and tilts down, so the felt fills the lower half of the frame with the deck and the chips in view, the room soft above it.
- Close: as the deal starts, it pushes in low over the near rail so the spring and the spread fill the right half of the frame, clear of the hero's copy, as in the concept video.
- Peel: as the hole cards slide to the seat, it drops to the player's own view, low behind the seat and nearly level with the cards in the right half of the frame, as in a squeeze, and holds there while they wait face down. The focus range closes to 0.25 m so the table behind goes soft, and a soft fill from the seat lights the faces, which turn away from the lamps.
- Hand: once the visitor turns them face up, it settles on the hand from above the seat, the cards readable in the lower middle and the chips to the right.

## Chip riffle
- A second, small canvas (objects/ChipRiffle.tsx) in a 96 x 48 px slot the nav keeps beside the name, mounted with the scene so it never loads on the static tier. Under 1024 px the nav has no room, so the slot hides and the canvas unmounts. It's decoration only: the slot is aria-hidden and takes no pointer events, and there's no text.
- Five card-red chips and five cream chips from chip.glb riffle as the page scrolls, about one riffle per 1.2 screens: few enough that each chip reads at the height of the nav, in colours that stand out against its dark rail. The middle finger lifts the stacks' inner edges, the chips tip off one at a time from each side in turn and fall into a zipper of two overlapping columns, the pile is pushed square, and its top half is cut off beside it for the next riffle.
- objects/riffle.ts is a pure function of scroll, so scrolling back runs it backwards. Its test checks every chip against every other, front on, at a thousand points per riffle, so no chip ever passes through another.
- It draws only when the scroll moves, damped so a wheel's steps glide, at a fixed DPR of up to 2 with MSAA, so its resolution never changes. It shares the stage's reflections and chip materials.

## Camera path (phase 2)
One camera pose per section, matched to the reference frames and interpolated with a ScrollTrigger scrub (power2.inOut):
- The Deal: wide at seated eye level, lamps and room visible.
- The Player: a slow push toward the table as the room gets softer.
- Hand History: a tilt down toward the player's seat.
- The Board: nearly overhead on the center of the table.
- The Table: a low angle across the chip stacks.
- Showdown: a pull back to wide.

## Quality tiers
drei PerformanceMonitor with AdaptiveDpr moves between tiers and writes the current tier to the store.
- High: DPR up to 2, depth of field on, 2048 shadow maps, the 500k splat in phase 3.
- Medium: DPR 1.5, depth of field off, 1024 shadow maps, the 100k splat.
- Low: DPR 1, vignette and grain only, the plate instead of any splat, no real-time shadows.
- Static: no WebGL at all (phones under 768px, low-power devices, reduced motion, missing WebGL2).
