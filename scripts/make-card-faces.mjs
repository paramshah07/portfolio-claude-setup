// Draws the hole cards from content as SVG and packs them with the back into one atlas:
// public/cards/atlas.webp, one cell per card in content order, then the back.
// Run from the repo root: node scripts/make-card-faces.mjs
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

// Poker size, 63 x 88 mm. The scene reads the same cell size and gutter.
export const CELL = { w: 512, h: 716, gutter: 16 };
const RADIUS = 28; // 3.5 mm corners
const INK = '#231E18';
const RED = '#9B3A2E';
const CREAM = '#F3EEE2';
const BRASS = '#AD9773';

// Suit shapes in a 100 x 100 box, so no font has to carry the pips.
const SUITS = {
  s: '<path d="M50 4C32 28 5 42 5 64c0 17 20 26 37 14l-6 19h28l-6-19c17 12 37 3 37-14C95 42 68 28 50 4z"/>',
  h: '<path d="M50 92C20 70 5 52 5 32 5 15 18 5 30 5c10 0 17 7 20 15 3-8 10-15 20-15 12 0 25 10 25 27 0 20-15 38-45 60z"/>',
  d: '<path d="M50 3l38 47-38 47-38-47z"/>',
  c: '<circle cx="50" cy="27" r="21"/><circle cx="27" cy="58" r="21"/><circle cx="73" cy="58" r="21"/><path d="M44 58l-6 39h24l-6-39z"/>',
};
const RANKS = { T: '10' };

const pip = (suit, x, y, size) =>
  `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})">${SUITS[suit]}</g>`;

function face(card) {
  const [rank, suit] = [RANKS[card[0]] ?? card[0], card[1]];
  const color = suit === 'h' || suit === 'd' ? RED : INK;
  const { w, h } = CELL;
  const index = `<text x="46" y="98" font-size="84" text-anchor="middle">${rank}</text>${pip(suit, 46, 140, 52)}`;
  // Aces carry one large pip. Other ranks carry their letter large over a small pip.
  const center = 'A'.includes(card[0])
    ? pip(suit, w / 2, h / 2, 220)
    : `<text x="${w / 2}" y="${h / 2 + 40}" font-size="260" text-anchor="middle">${rank}</text>${pip(suit, w / 2, h / 2 + 130, 70)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" rx="${RADIUS}" fill="${CREAM}"/>
    <rect x="96" y="40" width="${w - 192}" height="${h - 80}" rx="10" fill="none" stroke="${BRASS}" stroke-width="3"/>
    <g fill="${color}" font-family="EB Garamond, Garamond, Georgia, serif" font-weight="500">
      ${index}
      <g transform="rotate(180 ${w / 2} ${h / 2})">${index}</g>
      ${center}
    </g>
  </svg>`;
}

// The back art is square-cornered on white, so cut the same rounded corners into it.
async function back() {
  const { w, h } = CELL;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${RADIUS}"/></svg>`);
  return sharp('public/cards/back.png')
    .resize(w, h, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

const { hand } = JSON.parse(await readFile('src/content/profile.json', 'utf8'));
const cells = [...hand.hole.map((card) => Buffer.from(face(card))), await back()];
const step = CELL.w + CELL.gutter;

const info = await sharp({
  create: { width: step * cells.length - CELL.gutter, height: CELL.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(cells.map((input, i) => ({ input, left: i * step, top: 0 })))
  .webp({ quality: 88, alphaQuality: 100, effort: 6 })
  .toFile('public/cards/atlas.webp');
console.log(`public/cards/atlas.webp: ${hand.hole.join(' ')} and the back, ${Math.round(info.size / 1000)} KB`);
