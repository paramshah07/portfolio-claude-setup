# Param's portfolio: the poker table

## What this is

A personal portfolio for software engineering and quant roles, built as one hand of poker at a private table in a late-night lounge. The visitor sits down, the cards are dealt and each section is a street of the hand: The Deal (hero), The Player (about), Hand History (experience), The Board (projects), The Table (leadership) and Showdown (contact).

The look comes from the frames in /reference, which are stills from an AI-generated concept video. Match their lighting, materials and lens. Never copy their text: it is garbled, and some of it is blackjack ("Dealer busts", "Double down", "Stand"), which must never appear on this site. The video's "Login" and "Sign up" links don't exist here either.

## Current phase: 1

Build only what belongs to the current phase unless the task names a later one. Every phase has to leave the site shippable, and later work must never block earlier work.

- **Phase 1:** every section in HTML from content.md, the hero with the depth-map room and a mid-air deck, the phone and reduced-motion fallbacks, the Cmd+K palette and the Vercel deploy.
- **Phase 2:** the equity readout, the performance HUD, the "This Table" panel, the persistent 3D stage (real table, cards landing on the felt, chip stacks), the scroll-driven camera, the full light and lens pass and the quality tiers.
- **Phase 3:** sounds, chip physics, the custom cursor, dust in the lamp light, the card-bend shader, the Marble splat room and the custom domain.

## Stack

- Astro with static output and TypeScript, deployed on Vercel. Content collections with zod validate the typed content in src/content.
- Tailwind for layout. Design tokens are CSS custom properties in src/styles/tokens.css.
- React only inside islands: Stage (the WebGL scene, client:only="react"), CommandPalette (client:idle) and the HUD panels (client:idle, phase 2).
- Nanostores with @nanostores/react for state shared between the page and the islands: scroll progress, active section, quality tier, sound and HUD visibility. Stores live in src/lib/state.
- three, @react-three/fiber, @react-three/drei and @react-three/postprocessing, imported only inside src/components/scene and src/components/hud.
- Phase 3 only: three-custom-shader-material for the card bend, @react-three/rapier for chip physics (lazy-loaded) and @sparkjsdev/spark for the splat room.
- GSAP with ScrollTrigger, ScrollSmoother, SplitText, Flip and CustomEase for all motion. Follow the GSAP skills in .claude/skills. No other animation library.
- cmdk for the palette. Howler.js for sound (phase 3).
- Fonts through Fontsource: EB Garamond for headings and body, IBM Plex Mono only inside HUD-style panels.
- Vitest for unit tests.
- Dev-only scripts: @huggingface/transformers for the depth map and sharp for image conversion and the OG image.
- Ask before adding any dependency not listed here.

## Tokens

Sampled from the reference frames, except lamp, which was chosen.

| Token | Hex | Use |
|---|---|---|
| felt | #2E4C3A | table surface, section backgrounds |
| felt-shadow | #172C1E | felt in shadow, gradients |
| cream | #F3EEE2 | panels, card stock |
| ink | #231E18 | text on cream |
| brass | #AD9773 | frames, printed table lines, focus rings |
| panel | #363430 | HUD panel backgrounds |
| rail | #3A3329 | table rail, nav after the hero, footer |
| room | #1B1009 | darkest background, never pure black |
| card-red | #9B3A2E | hearts, diamonds, red chips |
| lamp | #F2D3A2 | lamp glow and bloom highlights |

## Where things live

| Area | Paths | Full spec | Workspace |
|---|---|---|---|
| Look and feel | everything visual | .claude/rules/ambience.md | all |
| Shell and state | src/pages, src/layouts, src/styles, src/lib/state, astro.config.mjs | .claude/rules/shell.md | shell |
| Content | content.md, src/content | .claude/rules/content-model.md | shell |
| Nav and sections | src/components/nav, src/components/sections | .claude/rules/sections.md | sections |
| 3D stage | src/components/scene, scripts/make-depth.mjs, scripts/make-card-faces.mjs | .claude/rules/scene.md | scene |
| HUDs and poker math | src/components/hud, src/lib/poker, src/workers, tests/poker | .claude/rules/hud.md | hud |
| Palette | src/components/palette | .claude/rules/palette.md | palette |
| Sound | src/lib/audio, public/audio | .claude/rules/audio.md | audio |

Each spec loads automatically when you open files in its area. Read it yourself before starting in an area whose folder is still empty. Stay inside your workspace's area. If you need a change elsewhere, describe it in your summary instead of making it.

## Rules for every session

- Every word on the page comes from content.md and is real HTML. Text in WebGL is limited to chip and card labels that also exist in the DOM. Never invent copy, numbers, employers or links.
- The page is fully readable and navigable with JavaScript off. The hero plate is preloaded and is the largest contentful paint.
- The stage loads after first paint, stops rendering when offscreen or when the tab is hidden and falls back to static images when WebGL2 is missing or the context is lost.
- Phones under 768px, low-power devices and prefers-reduced-motion get the static tier: the still plates, 2D card flips and no WebGL.
- Budgets: 50 KB of gzipped JS before the stage loads, hero plate under 250 KB on desktop and 120 KB on phones, 60 fps on a recent laptop, no layout shift.
- Accessibility: a visible brass focus ring, a DOM button for every interactive 3D object, dialogs that trap and return focus, text contrast of at least 4.5:1.
- Copy style: sentence case, no all-caps labels, no em dashes, no Oxford commas. Poker terms only: the deal, the flop, the turn, the river, the showdown.

## How to work

- Start the dev server on Conductor's port: npm run dev -- --port $CONDUCTOR_PORT
- After every visual change, open the page with the Chrome DevTools MCP, screenshot at 1440x900 and 390x844, compare with /reference and fix what's off before reporting. For stage work, record a performance trace too.
- Run npm run build and npm test before calling anything done. A failing build or test is not done.
- Commit in small steps with clear messages.
