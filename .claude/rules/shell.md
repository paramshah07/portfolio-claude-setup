---
paths:
  - "src/pages/**"
  - "src/layouts/**"
  - "src/styles/**"
  - "src/lib/state/**"
  - "astro.config.*"
---

# Shell and state

- One page. src/pages/index.astro composes the nav, the six sections in order and the footer. The Stage island sits in a fixed layer behind the content and only takes pointer events where the scene needs them.
- Section ids match the nav and the palette: the-deal, the-player, hand-history, the-board, the-table, showdown.
- src/layouts/Base.astro owns the head: title and description from content, the canonical URL, Open Graph and Twitter tags, the OG image (1200x630, made by scripts/make-og.mjs from the hero plate with Param's name), an SVG favicon of a brass-rimmed chip, theme-color room #1B1009 and preloads for the hero plate and the two main font files.
- Add @astrojs/sitemap and a robots.txt that allows everything.
- src/styles/tokens.css defines every token from CLAUDE.md as a custom property, plus spacing on a 4px base (4, 8, 12, 16, 24, 32, 48, 64, 96, 128), radii (cards 10px, panels 14px, chips fully round) and z-index layers (stage 0, content 10, nav 20, overlays 30, palette 40).
- src/styles/global.css sets the base: room background, cream text on dark, ink text on cream panels, the brass focus ring (2px with a 3px offset) and a skip link to #the-player.
- src/lib/state holds the nanostores: scrollProgress (0 to 1), activeSection (a section id), tier (high, medium, low, static), sound (on or off, persisted in localStorage) and hud (whether the performance HUD is open).
- The tier is decided once on load (viewport width, reduced motion, WebGL2 support, device memory) and then adjusted by the stage's performance monitor.
- The footer carries one line of credits in small type, the link that opens the "This Table" panel (phase 2) and the date of the last deploy.
- No analytics unless Param asks for them.
