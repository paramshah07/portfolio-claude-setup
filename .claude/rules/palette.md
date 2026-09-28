---
paths:
  - "src/components/palette/**"
---

# Command palette

- Built with cmdk as the CommandPalette island (client:idle). Opens with ⌘K on macOS, Ctrl K elsewhere, the nav button or "/" when focus isn't in a text field.
- Looks like the Showdown palette in the reference frames: a cream panel in a brass frame, a search field at the top, items in EB Garamond and shortcut hints in small IBM Plex Mono on the right.
- Groups:
  - Navigate: The Deal, The Player, Hand History, The Board, The Table, Showdown.
  - Contact: Copy email (shows "Email copied"), Open GitHub, Open LinkedIn, Open résumé.
  - Table (phases 2 and 3): Show performance HUD, How this table works, Turn sound on or off.
- Fuzzy search matches labels plus a few keywords per item, so "cv" finds the résumé.
- Esc closes it. Focus stays trapped inside while it's open and returns to whatever opened it.
- On phones it opens as a full-width sheet from the bottom.
- Opening and closing take 150ms with a small scale and fade. Under reduced motion only the fade remains.
