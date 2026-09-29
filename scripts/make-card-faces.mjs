// Sets every card in content from Adrian Kennard's deck and packs them with the back into one atlas:
// public/cards/atlas.webp, a grid of cells in reading order holding the hole cards, the board cards
// and then the back. src/components/scene/objects/atlas.json records the layout for the scene, and
// a test fails if content stops matching it.
//
// scripts/cards/kennard is the deck from https://www.me.uk/cards/makeadeck.cgi (poker size, large
// ace, card #F3EEE2, black #231E18, red #9B3A2E), released under CC0. Its courts are traced from
// Goodall & Son cards of about 1870. This recolours their inks to the tokens and sets the indices
// in EB Garamond SemiBold from scripts/cards/ranks.json, so no font has to be installed.
// Run from the repo root: node scripts/make-card-faces.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// 512 x 716 cells (63 x 88 mm) hold up with a card a third of the screen tall at DPR 2. The scene
// cuts the rounded corners in geometry, so faces run square to the cell edge and the gutters are
// card stock too, which keeps the card edges cream as the mipmaps shrink.
const CELL = { w: 512, h: 716, gutter: 16 };
const COLS = 4;
const CREAM = '#F3EEE2';
const INK = '#231E18';
const RED = '#9B3A2E';
// Kennard's court inks and white, in the tokens: brass, card red, felt and ink on cream.
const INKS = { '#FC4': '#AD9773', red: RED, '#44F': '#2E4C3A', black: INK, white: CREAM };
const ranks = JSON.parse(await readFile('scripts/cards/ranks.json', 'utf8'));

// Kennard's indices are stroked letters in a square box of the card's 240 x 336 units. This sets
// the rank there in EB Garamond instead, a little under the stroked letter's height so the Q and
// J tails clear the pip below, centred on the box and condensed to its width if wider, as 10 is.
function index(rank, color, x, y, size) {
  const TRACK = -60; // font units between the 1 and the 0
  let pen = 0;
  const glyphs = [...(rank === 'T' ? '10' : rank)].map((c) => {
    const g = ranks.glyphs[c];
    const at = pen;
    pen += g.advance + TRACK;
    return { ...g, at };
  });
  const [first, last] = [glyphs[0], glyphs.at(-1)];
  // Tails don't count toward the width: the Q's sweeps right and the J's left.
  const left = first.at + Math.max(first.ink[0], 0);
  const right = last.at + Math.min(last.ink[2], last.advance);
  const scale = (size * 0.84) / ranks.capHeight;
  const squeeze = Math.min(1, size / ((right - left) * scale));
  const paths = glyphs.map((g) => `<path transform="translate(${g.at} 0)" d="${g.d}"/>`).join('');
  const place = `translate(${x + size / 2} ${y + size * 0.86}) scale(${scale * squeeze} ${scale}) translate(${-(left + right) / 2} 0)`;
  return `<g fill="${color}" transform="${place}">${paths}</g>`;
}

async function face(card) {
  const [rank, suit] = card;
  const color = 'hd'.includes(suit) ? RED : INK;
  const svg = (await readFile(`scripts/cards/kennard/${rank}${suit.toUpperCase()}.svg`, 'utf8'))
    .replace(/="(#FC4|red|#44F|black|white)"/g, (_, ink) => `="${INKS[ink]}"`)
    // The outline: the scene's geometry is the card's edge, so the stock fills the cell instead.
    .replace(/<rect [^>]*rx="12"[^>]*>(<\/rect>)?/, `<rect x="-120" y="-168" width="240" height="336" fill="${CREAM}"/>`)
    .replace(/<use xlink:href="#V[SHDC][2-9TJQKA]" height="([\d.]+)" width="[\d.]+" x="([-\d.]+)" y="([-\d.]+)"><\/use>/g, (_, size, x, y) =>
      index(rank, color, +x, +y, +size),
    )
    .replace('width="2.5in"', `width="${CELL.w}"`)
    .replace('height="3.5in"', `height="${CELL.h}"`);
  if (svg.includes('xlink:href="#V')) throw new Error(`${card}: an index wasn't replaced`);
  return Buffer.from(svg);
}

// The back art has its own rounded corners on white. The scene's corners cut deeper, so it only
// needs stretching to the cell.
const back = () => sharp('public/cards/back.png').resize(CELL.w, CELL.h, { fit: 'fill' }).toBuffer();

const { hand } = JSON.parse(await readFile('src/content/profile.json', 'utf8'));
const files = (await readdir('src/content/board')).filter((f) => f.endsWith('.md')).sort();
const board = await Promise.all(
  files.map(async (f) => (await readFile(`src/content/board/${f}`, 'utf8')).match(/^card:\s*['"]?([2-9TJQKA][shdc])/m)[1]),
);
const cards = [...hand.hole, ...board];

const cells = [...(await Promise.all(cards.map(face))), await back()];
const rows = Math.ceil(cells.length / COLS);
const [dx, dy] = [CELL.w + CELL.gutter, CELL.h + CELL.gutter];

const info = await sharp({ create: { width: dx * COLS - CELL.gutter, height: dy * rows - CELL.gutter, channels: 3, background: CREAM } })
  .composite(cells.map((input, i) => ({ input, left: (i % COLS) * dx, top: Math.floor(i / COLS) * dy })))
  .webp({ quality: 90, effort: 6 })
  .toFile('public/cards/atlas.webp');
await writeFile('src/components/scene/objects/atlas.json', `${JSON.stringify({ cell: CELL, cols: COLS, cards }, null, 2)}\n`);
console.log(`public/cards/atlas.webp: ${cards.join(' ')} and the back, ${info.width} x ${info.height}, ${Math.round(info.size / 1000)} KB`);
