// Draws the clay chip's maps into public/textures: a colour map for each clay, and a normal map and a
// roughness and metalness map that every clay shares. The layout matches chipGeometry in
// src/components/scene/objects/chip.ts: the face in the top 1024 x 1024, where the rim's inner edge
// is 500 px from the centre, and the edge unrolled round the 1024 x 128 strip under it.
// The design follows a Paulson clay chip: six edge spots of inlaid clay running through the chip
// and 4.5 mm onto each face, a cross-hatched mould band with a raised ring either side, and a
// printed cream inlay with a brass foil ring and a faint guilloché rosette. No text.
// Run from the repo root: node scripts/make-chip-maps.mjs
import sharp from 'sharp';

const [W, FACE, EDGE] = [1024, 1024, 128];
const H = FACE + EDGE;
const MM = 500 / 19; // pixels per millimetre on the face: the rim's inner edge is 19 mm out
const C = FACE / 2;
const CREAM = '#F3EEE2';
const BRASS = '#AD9773';
const SPOTS = 6;
const SPOT = 8.8; // mm across, about 26 degrees of the edge
// Body and spot clays, in the order Chips.tsx uses them.
const CLAYS = {
  cream: ['#E9E1CF', '#9B3A2E'],
  panel: ['#363430', CREAM],
  felt: ['#2E4C3A', CREAM],
  red: ['#9B3A2E', CREAM],
};

// A point on the face at radius r mm and angle a, where the geometry's angle a lands. Image y
// runs down and texture v up, so the angle turns the other way in the image.
const at = (r, a) => [C + r * MM * Math.cos(a), C - r * MM * Math.sin(a)];
const angles = Array.from({ length: SPOTS }, (_, k) => ((k + 0.5) / SPOTS) * Math.PI * 2);

// A spot on the face: a rectangle of inlaid clay SPOT wide from 15 mm out to just past the face's edge.
function spot(a) {
  // r mm out along the spot's centre line and `side` mm across it.
  const corner = (r, side) => at(Math.hypot(r, side), a + Math.atan2(side, r)).join(' ');
  return `M${corner(15, -SPOT / 2)} L${corner(20, -SPOT / 2)} L${corner(20, SPOT / 2)} L${corner(15, SPOT / 2)} Z`;
}
// The same spot on the edge strip, which unrolls the edge left to right by angle.
const edgeSpot = (a) => {
  const w = (SPOT / (19.5 * Math.PI * 2)) * W;
  const x = (a / (Math.PI * 2)) * W;
  return `<rect x="${x - w / 2}" y="${FACE}" width="${w}" height="${EDGE}"/>`;
};
const circle = (r, attrs) => `<circle cx="${C}" cy="${C}" r="${r * MM}" ${attrs}/>`;
// The rosette: 36 circles whose centres ring the middle, the classic engine-turned pattern.
const rosette = Array.from({ length: 36 }, (_, k) => {
  const [x, y] = at(4.4, (k / 36) * Math.PI * 2);
  return `<circle cx="${x}" cy="${y}" r="${4.4 * MM}"/>`;
}).join('');
// Every map clips face drawing to the face square, so nothing spills onto the edge strip below it.
const svg = (body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><clipPath id="face"><rect width="${W}" height="${FACE}"/></clipPath>${body}</svg>`);

// A fixed pseudo-random stream, so the grain comes out the same every run.
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const grain = Float32Array.from({ length: W * H }, () => random() - 0.5);
const blur = (src, radius) => {
  const out = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[y * W + Math.min(W - 1, Math.max(0, x + k))];
      tmp[y * W + x] = sum / (2 * radius + 1);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x];
      out[y * W + x] = sum / (2 * radius + 1);
    }
  return out;
};
// A faint, broad variation in the clay's sheen. Anything finer or in the colour reads as grain.
const mottle = blur(grain, 8).map((v) => v * 10);
const raw = async (body) => (await sharp(svg(body)).greyscale().raw().toBuffer({ resolveWithObject: true })).data;

// Masks, white where each part is: the spots, the inlay and its brass rings.
const spots = `<g clip-path="url(#face)">${angles.map((a) => `<path d="${spot(a)}"/>`).join('')}</g>${angles.map(edgeSpot).join('')}`;
const inlayMask = await raw(`<rect width="${W}" height="${H}"/>${circle(12, 'fill="#fff"')}`);
const brassMask = await raw(`<rect width="${W}" height="${H}"/><g fill="none" stroke="#fff">${circle(11.2, 'stroke-width="9"')}${circle(10.5, 'stroke-width="2.5"')}</g>`);

for (const [name, [body, spotColour]] of Object.entries(CLAYS)) {
  const base = svg(`
    <rect width="${W}" height="${H}" fill="${body}"/>
    <g fill="${spotColour}">${spots}</g>
    ${circle(12, `fill="${CREAM}"`)}
    <g fill="none" stroke="${BRASS}">
      ${circle(11.2, 'stroke-width="9"')}${circle(10.5, 'stroke-width="2.5"')}
      <g stroke-width="1.6" opacity="0.35">${rosette}</g>
    </g>`);
  await sharp(base).removeAlpha().webp({ quality: 90 }).toFile(`public/textures/chip-${name}.webp`);
}

// Height, then normals from its slope. The band is cross-hatched between two raised rings, the
// inlay sits flat, and a hairline groove runs round every spot where the inlaid clay meets the body.
const band = `<clipPath id="band"><path fill-rule="evenodd" d="M${C} ${C - 18.1 * MM}a${18.1 * MM} ${18.1 * MM} 0 1 0 0.01 0zM${C} ${C - 13.3 * MM}a${13.3 * MM} ${13.3 * MM} 0 1 0 0.01 0z"/></clipPath>
  <pattern id="hatch" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="13" height="13" fill="#606060"/><rect width="13" height="3" fill="#8a8a8a"/><rect width="3" height="13" fill="#8a8a8a"/>
  </pattern>`;
const height = await raw(`
  <defs>${band}</defs>
  <rect width="${W}" height="${H}" fill="#606060"/>
  <rect width="${W}" height="${FACE}" fill="url(#hatch)" clip-path="url(#band)"/>
  <g fill="none" stroke="#a0a0a0">${circle(18.6, 'stroke-width="10"')}${circle(12.9, 'stroke-width="8"')}</g>
  <g fill="none" stroke="#404040" stroke-width="2">${spots}</g>
  ${circle(12, 'fill="#606060"')}`);
const h = blur(Float32Array.from(height, (v) => v / 255), 1);
const STRENGTH = 3;
const normal = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const px = (dx, dy) => h[Math.min(H - 1, Math.max(0, y + dy)) * W + ((x + dx + W) % W)];
    // Image y runs down and texture v up, so the v slope flips sign.
    const du = (px(1, 0) - px(-1, 0)) * STRENGTH;
    const dv = -(px(0, 1) - px(0, -1)) * STRENGTH;
    const len = Math.hypot(du, dv, 1);
    const i = (y * W + x) * 3;
    [normal[i], normal[i + 1], normal[i + 2]] = [(-du / len) * 127.5 + 127.5, (-dv / len) * 127.5 + 127.5, (1 / len) * 127.5 + 127.5];
  }
await sharp(normal, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toFile('public/textures/chip-normal.webp');

// Occlusion in red, roughness in green and metalness in blue, as three.js reads them.
// - Occlusion darkens the inlay's rim, where the recess shades it, and the very top and bottom of
//   the edge, where a stacked chip sits on the next.
// - Roughness: matte clay with a little variation, the rounded rim worn smoother by handling so it
//   catches the lamps, satin paper on the inlay and foil for the ring.
const edgeRow = (i) => (Math.floor(i / W) - FACE) / (EDGE - 1); // 0 at the top of the rim, 1 at the bottom
const ringDistance = (i) => Math.abs(Math.hypot((i % W) - C, Math.floor(i / W) - C) / MM - 12); // mm from the inlay's edge
const orm = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const edge = i >= FACE * W;
  const rim = edge ? Math.max(0, 1 - Math.min(edgeRow(i), 1 - edgeRow(i)) / 0.2) : 0; // 1 at the edge's top and bottom
  const occlusion = edge ? 1 - 0.45 * rim ** 2 : 1 - 0.35 * Math.max(0, 1 - ringDistance(i) / 0.6);
  const rough = brassMask[i] > 127 ? 0.35 : inlayMask[i] > 127 ? 0.45 : edge ? 0.6 - 0.15 * rim : 0.68 + mottle[i] * 0.02;
  [orm[i * 3], orm[i * 3 + 1], orm[i * 3 + 2]] = [Math.round(occlusion * 255), Math.round(rough * 255), brassMask[i] > 127 ? 255 : 0];
}
await sharp(orm, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toFile('public/textures/chip-orm.webp');
console.log(`public/textures/chip-{${Object.keys(CLAYS).join(',')},normal,orm}.webp`);
