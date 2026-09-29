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
- An oval tabletop from an extruded stadium shape, about 2.4 x 1.2 m in world units.
- Felt: MeshPhysicalMaterial in felt #2E4C3A, roughness 0.9, sheen 1 with a slightly lighter sheen color and a sheen roughness of 0.8, plus a normal map from a CC0 fabric texture in public/textures.
- Printed lines: a canvas-drawn brass decal at low opacity for the betting line and the dealer position.
- Rail: a padded profile swept around the oval in dark leather (rail #3A3329, roughness 0.5). Brass cup holders at each seat. A walnut edge under the rail.

## Cards
- Poker size, 0.063 x 0.088 in world units, 0.3 mm thick with 3.2 mm rounded corners, all real geometry from objects/card.ts. Rows run the length of the card, so a morph target bends it along its long axis.
- scripts/make-card-faces.mjs sets the faces from Adrian Kennard's CC0 deck in scripts/cards/kennard (courts traced from Goodall & Son, recoloured to the tokens), with EB Garamond indices from scripts/cards/ranks.json, and packs them with public/cards/back.png into one atlas.
- Material: MeshPhysicalMaterial on cream card stock, roughness 0.5 with a light satin clearcoat and the CC0 paper normal map in public/textures.
- A full deck of 52. Only the cards content deals have faces; every other card is a back on both sides, so no card label shows that isn't on the page.
- The deal: half the deck springs off the top card by card, flexed, arcs over under gravity and lands face down in a ribbon spread, then zips back onto the deck. The hole cards slide to the player's seat and turn over. The board cards on the table deal in sync with The Board section, a burn card before each street.

## Chips (phase 2)
- A Paulson-style clay chip, 39 mm across and 3.3 mm thick, turned from its profile in objects/chip.ts: a 0.5 mm rounded rim, so stacks show a dark seam between chips, and a 24 mm inlay set 0.15 mm into each face. Instanced stacks through drei Instances, each chip a few percent lighter or darker.
- scripts/make-chip-maps.mjs draws the maps in public/textures:
  - a colour map per clay, with six edge spots of inlaid clay running through the chip and onto each face, and a cream inlay with a brass foil ring and a faint guilloché rosette
  - a normal map the clays share: a cross-hatched mould band, raised rings and the seams round each spot
  - a roughness and metalness map they share: matte clay, satin paper on the inlay and foil for the ring
- No dice and no printed text. Labels use drei Text on the inlay and always have a DOM twin.
- Colours: cream with card-red spots, then panel, felt and card red with cream spots.
- Phase 3: @react-three/rapier, loaded on the first chip interaction, lets visitors flick chips. Bodies sleep once they settle.

## Light
- drei Environment with a warm interior HDRI from Poly Haven at low intensity, used for reflections only.
- Three Lightformers above the table standing in for the pendant lamps, in lamp #F2D3A2.
- One warm spot light as the key, with soft shadows on the high tier. Static objects use AccumulativeShadows baked once. Moving cards and chips use ContactShadows.
- A very slow lamp flicker under 3% intensity.
- Phase 3: a few hundred dust particles drifting slowly through the lamp light, high tier only.

## Lens and post
- @react-three/postprocessing: DepthOfField focused on the table surface, Bloom with a high threshold so only lamps and brass highlights glow, Vignette, Noise at about 4% and a LUT for the warm grade, with AgX tone mapping.
- Camera: about a 40mm equivalent, a field of view around 45 degrees.

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
