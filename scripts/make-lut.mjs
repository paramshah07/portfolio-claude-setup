// Makes the warm grade the rig applies after AgX: public/luts/warm.png, a 32^3 LUT as a 1024 x 32
// horizontal strip for three's LUTImageLoader (32 blue slices left to right, red across each
// slice, green down from the top row). Checks itself and prints a few mappings.
// Run from the repo root: node scripts/make-lut.mjs
// Add --preview to write before and after plates and a grey ramp to .context/lut/.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SIZE = 32;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const ROOM = hex('#1B1009'); // pure black lands here
const CREAM = hex('#F3EEE2'); // pure white lands here

// postprocessing's LUT3DEffect sRGB-encodes AgX's output before the lookup and treats what comes
// back as sRGB, so this works on display sRGB values in 0-1, the same numbers as the plate's pixels.
// The room plate comes out of AgX as its own pixels, so the grade has to leave a photo alone:
// the midtones only get a small warm nudge, and each channel eases onto room at the bottom and
// cream at the top over the shortest distance that still has no corner in it.

// The nudge at mid grey, fading out toward black and white: about +3 red and -5 blue out of 255.
// It keeps each channel rising as long as every entry stays under 0.25.
const WARM = [0.012, 0, -0.02];

// A smooth max(x, floor): lands on `floor` at 0 with slope 0, follows a parabola and joins
// y = x with slope 1 at twice the floor. Everything above that passes through untouched.
const softFloor = (x, floor) => (x >= 2 * floor ? x : floor + (x * x) / (4 * floor));
const softCeiling = (x, ceiling) => 1 - softFloor(1 - x, 1 - ceiling);

const grade = (rgb) =>
  rgb.map((x, c) => softCeiling(softFloor(x + WARM[c] * 4 * x * (1 - x), ROOM[c]), CREAM[c]));

// Pixel (b * SIZE + r, g) holds the output for input (r, g, b) / (SIZE - 1).
const at = (r, g, b) => (g * SIZE * SIZE + b * SIZE + r) * 3;
const lut = Buffer.alloc(SIZE ** 3 * 3);
for (let b = 0; b < SIZE; b++)
  for (let g = 0; g < SIZE; g++)
    for (let r = 0; r < SIZE; r++)
      lut.set(grade([r, g, b].map((v) => v / (SIZE - 1))).map((v) => Math.round(v * 255)), at(r, g, b));

// Trilinear, like the GPU sampling it with LinearFilter.
function lookup(rgb) {
  const p = rgb.map((v) => Math.min(Math.max(v, 0), 1) * (SIZE - 1));
  const i = p.map((v) => Math.min(Math.floor(v), SIZE - 2));
  const f = p.map((v, c) => v - i[c]);
  const out = [0, 0, 0];
  for (let corner = 0; corner < 8; corner++) {
    const d = [corner & 1, (corner >> 1) & 1, corner >> 2];
    const w = d.reduce((w, dc, c) => w * (dc ? f[c] : 1 - f[c]), 1);
    const k = at(i[0] + d[0], i[1] + d[1], i[2] + d[2]);
    for (let c = 0; c < 3; c++) out[c] += (w * lut[k + c]) / 255;
  }
  return out;
}

// Black lands on room and white on cream, nothing leaves that range, and every output channel
// rises with its input channel, so the interpolated grade can't reverse a gradient.
const node = (r, g, b) => [...lut.subarray(at(r, g, b), at(r, g, b) + 3)];
const n = SIZE - 1;
node(0, 0, 0).forEach((v, c) => assert(Math.abs(v - ROOM[c] * 255) <= 1, `black -> ${node(0, 0, 0)}`));
node(n, n, n).forEach((v, c) => assert(Math.abs(v - CREAM[c] * 255) <= 1, `white -> ${node(n, n, n)}`));
for (let b = 0; b < SIZE; b++)
  for (let g = 0; g < SIZE; g++)
    for (let r = 0; r < SIZE; r++) {
      const here = [r, g, b];
      node(r, g, b).forEach((v, c) => {
        assert(v >= Math.round(ROOM[c] * 255) && v <= Math.round(CREAM[c] * 255), `out of range at ${here}`);
        if (here[c] === 0) return;
        const prev = here.map((x, j) => (j === c ? x - 1 : x));
        assert(v >= node(...prev)[c], `channel ${c} falls at ${here}`);
      });
    }

await mkdir('public/luts', { recursive: true });
const png = await sharp(lut, { raw: { width: SIZE * SIZE, height: SIZE, channels: 3 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile('public/luts/warm.png');
console.log(`public/luts/warm.png: ${png.width}x${png.height}, ${(png.size / 1000).toFixed(1)} KB`);

for (const [name, h] of [
  ['black', '#000000'],
  ['18% grey', '#767676'],
  ['white', '#FFFFFF'],
  ['felt', '#2E4C3A'],
  ['card-red', '#9B3A2E'],
  ['brass', '#AD9773'],
]) {
  const out = lookup(hex(h));
  console.log(`${name.padEnd(9)} ${h} -> ${toHex(out)}  (${out.map((v) => (v * 255).toFixed(1)).join(', ')})`);
}

if (process.argv.includes('--preview')) {
  await mkdir('.context/lut', { recursive: true });
  const grey = Buffer.alloc(960 * 64 * 3);
  for (let i = 0; i < grey.length; i++) grey[i] = Math.round(((Math.floor(i / 3) % 960) / 959) * 255);
  const ramp = { data: grey, info: { width: 960, height: 64, channels: 3 } };
  const room = await sharp('public/plates/room-16x9.jpg').resize(960).raw().toBuffer({ resolveWithObject: true });
  const hero = await sharp('reference/hero-16x9.jpg').resize(960).raw().toBuffer({ resolveWithObject: true });

  for (const [file, { data, info }, stacked] of [
    ['room.jpg', room, false],
    ['hero.jpg', hero, false],
    ['ramp.png', ramp, true],
  ]) {
    const after = Buffer.from(data);
    for (let i = 0; i < after.length; i += 3)
      after.set(lookup([...data.subarray(i, i + 3)].map((v) => v / 255)).map((v) => Math.round(v * 255)), i);
    const raw = { width: info.width, height: info.height, channels: 3 };
    const [width, height] = stacked ? [info.width, info.height * 2] : [info.width * 2, info.height];
    await sharp({ create: { width, height, channels: 3, background: '#000' } })
      .composite([
        { input: data, raw, left: 0, top: 0 },
        { input: after, raw, left: stacked ? 0 : info.width, top: stacked ? info.height : 0 },
      ])
      .toFile(`.context/lut/${file}`);
  }
  console.log('Previews in .context/lut/: before on the left (or top), after on the right (or bottom).');
}
