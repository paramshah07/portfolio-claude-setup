---
paths:
  - "src/lib/audio/**"
---

# Sound (phase 3)

- Howler.js with one sprite in public/audio (sfx.webm with an sfx.mp3 fallback) and a separate looping room tone.
- Sprite entries: card-snap (a deal), card-slide, card-flip, chip-clack, chip-stack and felt-thud. Param records them himself with a real deck and real clay chips. Trim them tight and normalize them to the same loudness.
- The room tone sits far below everything else and never includes music.
- Off by default. The nav toggle and the palette switch it, and the choice persists in localStorage.
- Audio unlocks on the first user gesture after sound is turned on. Nothing ever autoplays.
- Everything mutes while the tab is hidden and resumes on return.
- Sound and motion settings are independent: reduced motion doesn't mute sound, and muting doesn't change motion.
