---
paths:
  - "content.md"
  - "src/content/**"
---

# Content model

content.md is the source Param edits. src/content mirrors it as typed data validated with zod. When they disagree, content.md wins: update src/content to match and never the other way round. A missing field renders nothing. Never fill a gap with invented text.

- site: name, tagline, title, description, email, github, linkedin, resumePath (public/resume.pdf), url
- player: blurb (three sentences at most), stats (label, value, optional note; four at most, only numbers Param can defend)
- hand: hole (exactly two cards written like "As" and "Ks"), used by the equity readout
- experience: company, role, start, end, location, result (one sentence), details (up to three bullets), tags, suit
- board: exactly five projects, each with street (flop, flop, flop, turn, river), card (rank and suit, like "Qh"), name, pitch (one line), metric (one number with its unit), stack (tags), links (label and href) and details (markdown for the project sheet)
- table: org, role, dates, summary, teams (name and member count)
- showdown: one inviting sentence

The build must fail with a clear message when:
- the board doesn't have exactly three flop cards, one turn and one river
- the seven cards (hole plus board) aren't all valid and distinct
- a link isn't https or mailto
- an experience suit isn't one of spades, hearts, diamonds, clubs

Suits in Hand History mean something. Spades: quant and trading. Hearts: product and full-stack. Diamonds: data and research. Clubs: infrastructure. Show a small legend once.
